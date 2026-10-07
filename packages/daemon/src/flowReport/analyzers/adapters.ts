// daemon/src/flow-reports/analyzers/adapters.ts
//
// The eight existing analysers, behind the Flow Reports interface.
//
// ── Why adapt rather than rewrite ────────────────────────────────────────────
//
// `daemon/src/integrations/poschi/*/analyse.ts` already reads a `SourceFile[]`
// and produces findings with severity, confidence, evidence and prompts. They
// are under test, they are in use by the Poschi pages, and eight of the ten
// categories this feature needs are already there. Rewriting them to fit a new
// interface would duplicate working code and create two things to keep right.
//
// So each adapter is thin: call the analyser, map its findings, summarise. The
// analysers themselves are not touched by this file.
//
// ── Scoring, where a score is honest ─────────────────────────────────────────
//
// A section's score is derived from what its findings weigh, and a section
// with no findings at all scores `null` rather than 100. "Nothing was found"
// and "everything is fine" are different claims, and only the second deserves
// a number — an analyser that could not read the files it needed produces the
// first and would otherwise be rendered as a perfect result.

import { analyseQuality } from '../poschi/quality/analyse.js'
import { analyseSeo } from '../poschi/seo/analyse.js'
import { analyseMonetization } from '../poschi/monetization/analyse.js'
import { analyseMarketplace } from '../poschi/marketplace/analyse.js'
import { routerFiles } from '../poschi/product/localRepo.js'
import { parseRouterSource } from '../poschi/sitemap/routerParse.js'
import { analyseJourneys } from '../poschi/journeys/analyse.js'
import { analyseCompliance } from '../poschi/compliance/analyse.js'
import { analyseSecurity } from '../poschi/security/analyse.js'
import { analyseLocal } from '../poschi/product/fromLocal.js'
import { marketingOpportunityAnalyzer } from './marketing.js'
import { dataArchitectureAnalyzer } from './dataArchitecture.js'
import { analyseErrorHandling } from './errorLog.js'
import { analyseCompetitiveGaps } from './competitive.js'
import { sectionScore } from '../report/summarize.js'
import {
  marketplaceApplicability, type Applicability, type PrimitiveState,
} from './applicability.js'
import { dualRoleFindings, readAccountShape } from './dualRole.js'
import { readRevenuePicture, revenueOpportunities } from './revenue.js'
import {
  errorStabilityChecks, telemetryChecks, qualityChecks, monetizationChecks,
  seoChecks, journeyChecks, competitiveChecks, complianceChecks, securityChecks,
  accessibilityChecks,
  NOT_STATICALLY_CHECKABLE,
} from './launchChecks.js'
import type { AnalysisContext, SectionAnalyzer } from '../jobManager.js'
import type { Finding, ReportCategory, ReportSectionResult, Severity } from '../types.js'
import {
  collate, normalizeCommonFinding, normalizeSecurityFinding,
  type PoschiCommonFinding, type PoschiSecurityFinding,
} from './normalize.js'

/**
 * A score, or null when there is nothing to score.
 *
 * ── One curve for the whole report ───────────────────────────────────────────
 *
 * The arithmetic is `sectionScore`'s and is not repeated here. This file used
 * to subtract a fixed penalty per finding from 100, which is a different rule
 * from the one the executive summary uses, and a run against Poschi showed what
 * that costs: marketplace health scored 0 and compliance 4, while the overall
 * number for the same run was computed on the other curve. A section at 0 reads
 * as ruined when it means "more than about six findings", and two scoring rules
 * in one document means at least one of the numbers is not what it claims.
 *
 * ── Zero findings scores `null`, not 100 ─────────────────────────────────────
 *
 * That is as likely to mean the analyser could not see what it needed as it is
 * to mean the project is flawless, and rendering it as a perfect score turns an
 * absence of evidence into praise. Written the other way round first, and a run
 * against a real repository showed the cost immediately: role journeys came
 * back with no findings and scored 100 on a product that plainly has three
 * roles.
 *
 * The same reasoning covers a section holding only observations. These
 * analysers record what they noticed; none of them records that a check passed.
 * So "nothing damaging was noticed" is not evidence that anything was verified,
 * and `Insufficient evidence` stays the honest answer.
 */
export function scoreFrom(findings: Array<{ severity: Severity }>, checked: boolean): number | null {
  if (!checked) return null
  return sectionScore(findings as Finding[])
}

/** The one-line summary a section header shows. */
function summarise(category: string, findings: Array<{ severity: Severity }>): string {
  if (findings.length === 0) return 'No findings were produced for this section.'
  const counts = findings.reduce<Record<string, number>>((acc, f) => {
    acc[f.severity] = (acc[f.severity] ?? 0) + 1
    return acc
  }, {})
  const parts = (['critical', 'high', 'medium', 'low', 'info'] as Severity[])
    .filter((s) => counts[s])
    .map((s) => `${counts[s]} ${s}`)
  return `${findings.length} finding${findings.length === 1 ? '' : 's'}: ${parts.join(', ')}.`
}

/**
 * Wrap one of the seven common-shaped analysers.
 *
 * `limitations` carries the scan's own truncation into the section, because a
 * section analysed over a partial file list is a partial section and the
 * report has to say so where the reader meets the findings.
 */
function commonAdapter(
  category: ReportCategory,
  run: (ctx: AnalysisContext) => { findings: PoschiCommonFinding[] },
  /** Pre-launch checks this section owns. Kept separate from the analyser so
   *  the existing one stays the single source of what it already measures, and
   *  so nothing here can duplicate a finding it already produces. */
  extra?: (ctx: AnalysisContext) => PoschiCommonFinding[],
): SectionAnalyzer {
  return {
    category,
    async run(ctx): Promise<ReportSectionResult> {
      const raw = run(ctx)
      const added = extra ? extra(ctx) : []
      const findings = collate(
        [...raw.findings, ...added].map((f) => normalizeCommonFinding(f, category)),
      )
      const limitations: string[] = []
      if (ctx.scan.truncated) {
        limitations.push(
          'The file scan was truncated, so this section was analysed over part of the '
          + 'repository. ' + ctx.scan.limitsHit.join(' '),
        )
      }
      return {
        category,
        status: limitations.length > 0 ? 'completed_with_warnings' : 'completed',
        score: scoreFrom(findings, true),
        summary: summarise(category, findings),
        findings,
        limitations,
      }
    },
  }
}

// ── The seven ────────────────────────────────────────────────────────────────

export const engineeringQualityAnalyzer = (): SectionAnalyzer => {
  const base = commonAdapter('engineering_quality', (ctx) =>
    analyseQuality(ctx.files) as unknown as { findings: PoschiCommonFinding[] },
  (ctx) => qualityChecks(ctx.files))
  return {
    category: 'engineering_quality',
    async run(ctx): Promise<ReportSectionResult> {
      const r = await base.run(ctx)
      // Said once, here, because this is the section a reader checks for build
      // and test health — and the honest answer is that nothing was executed.
      return { ...r, limitations: [...r.limitations, ...NOT_STATICALLY_CHECKABLE] }
    },
  }
}

export const seoAnalyzer = (): SectionAnalyzer =>
  commonAdapter('seo', (ctx) => analyseSeo(ctx.files) as unknown as { findings: PoschiCommonFinding[] },
    (ctx) => seoChecks(ctx.files))

/**
 * Accessibility: whether somebody using a keyboard or a screen reader can work
 * the product.
 *
 * ── Why it is scored, and what the score is not ──────────────────────────────
 *
 * The score counts the structural failures a file can show — a control the
 * keyboard cannot reach, a button with no name, a field with no label. It is
 * not a WCAG conformance figure and must not be read as one: half of any
 * accessibility audit is contrast, focus behaviour and layout at zoom, and all
 * of that needs a drawn page. Those are listed on the section as limitations,
 * every time, so the number is never mistaken for the whole answer.
 *
 * ── Why it scores null when there is no interface ────────────────────────────
 *
 * A repository with no markup — a library, a CLI, a set of functions — has no
 * accessibility to assess. Scoring it 100 would say it passed something it was
 * never given, so it scores nothing and says why.
 */
export const accessibilityAnalyzer = (): SectionAnalyzer => ({
  category: 'accessibility',
  async run(ctx): Promise<ReportSectionResult> {
    const ui = ctx.files.filter((f) =>
      /\.(html?|ejs|hbs|liquid|astro|vue|svelte|tsx|jsx)$/i.test(f.path))
    const findings = collate(
      accessibilityChecks(ctx.files).map((f) => normalizeCommonFinding(f, 'accessibility')),
    )

    return {
      category: 'accessibility',
      status: 'completed',
      score: scoreFrom(findings, ui.length > 0),
      summary: ui.length === 0
        ? 'No interface files were found, so there was no interface to assess.'
        : `${ui.length} interface file${ui.length === 1 ? ' was' : 's were'} read. `
          + summarise('accessibility', findings),
      findings,
      limitations: [
        'Structural only. What is reported is what a file can show — a control the keyboard '
        + 'cannot reach, a button with no name, a field with no label. This is not a WCAG '
        + 'conformance result and a clean section here does not mean the product is accessible.',
        ...NOT_STATICALLY_CHECKABLE,
      ],
    }
  },
})

/**
 * Monetization: where revenue could come from, and whether what exists works.
 *
 * ── Why this section is not scored ───────────────────────────────────────────
 *
 * It used to be, and the number was answering a different question from the one
 * the section asks. Most of what it reports is opportunity — an audience nobody
 * charges, a per-use cost nobody meters — and an opportunity is not damage. A
 * product that has built one revenue stream and not a second is not broken, and
 * a score says that it is. Worse, it dragged the figure at the top of the report
 * down for a commercial decision rather than for anything wrong with the code.
 *
 * So the section reports no score and is excluded from the overall one, which
 * `summarize.ts` enforces where that figure is computed rather than relying on
 * this returning null.
 *
 * The payment-plumbing findings stay. "A checkout exists and nothing collects"
 * is a defect and belongs in the report — it is simply no longer the whole of
 * what this section is for.
 */
export const monetizationAnalyzer = (): SectionAnalyzer => ({
  category: 'monetization',
  async run(ctx): Promise<ReportSectionResult> {
    const raw = analyseMonetization(ctx.files) as unknown as { findings: PoschiCommonFinding[] }

    const local = analyseLocal(ctx.repositoryDisplayName, {
      source: {
        root: ctx.repositoryDisplayName,
        files: ctx.files,
        total: ctx.files.length + ctx.scan.skipped.length,
        newest: null,
      },
    })
    const picture = readRevenuePicture(ctx.files, local.map.roles)
    const opportunities = revenueOpportunities(picture)

    // The revenue opportunities are marked as such; the payment-plumbing
    // findings beside them are not. Both live in this section and they are
    // different kinds of thing — "a checkout exists and nothing collects" is a
    // defect, and a rule that called everything here an opportunity turned
    // "35 money paths carry a placeholder marker" into a proposal.
    const findings = collate([
      ...opportunities
        .map((f) => normalizeCommonFinding(f, 'monetization'))
        .map((f) => ({ ...f, type: 'opportunity' as const })),
      ...[...monetizationChecks(ctx.files), ...raw.findings]
        .map((f) => normalizeCommonFinding(f, 'monetization')),
    ])
    const n = opportunities.length

    return {
      category: 'monetization',
      status: 'completed',
      score: null,
      summary: n > 0
        ? `${n} revenue opportunit${n === 1 ? 'y' : 'ies'} identified from capabilities this `
          + `product has already built. ${summarise('monetization', findings)}`
        : `No revenue opportunity was identified from what is built here. `
          + summarise('monetization', findings),
      findings,
      limitations: [
        'This section is not scored and does not count towards the overall figure. What it '
        + 'mostly reports is opportunity rather than damage, and a product that has not built '
        + 'a second revenue stream has not done anything wrong.',
        'Opportunities are read from capabilities present in the repository. Pricing, terms and '
        + 'fees configured in the payment processor\'s own dashboard rather than in code are invisible '
        + 'here, so an opportunity may already have been taken.',
        'Nothing here is a forecast. Whether any of it is worth doing depends on what accounts '
        + 'cost to serve and what they would pay, neither of which a repository can answer.',
        ...(ctx.scan.truncated ? ['The file scan was truncated; this section saw part of the repository.'] : []),
      ],
    }
  },
})

/**
 * Each audience's path through the product, and whether one person can be on
 * more than one of those paths.
 *
 * ── Why this is not a `commonAdapter` ────────────────────────────────────────
 *
 * The journey analyser needs a route-to-role map, and calling it without one
 * returns a report with no roles in it — no journeys, no gaps, no findings.
 * That is what this adapter did, and the whole section came back empty for
 * every repository that had ever been analysed: twelve stored runs, ten
 * categories, and the one that exists to describe who uses the product said
 * "No findings were produced for this section" every time. Nothing errored,
 * which is why it survived.
 *
 * The map is derived here from the router in the scanned files, the same way
 * the product intel section derives its sitemap.
 */
export const roleJourneysAnalyzer = (): SectionAnalyzer => ({
  category: 'role_journeys',
  async run(ctx): Promise<ReportSectionResult> {
    const local = analyseLocal(ctx.repositoryDisplayName, {
      source: {
        root: ctx.repositoryDisplayName,
        files: ctx.files,
        total: ctx.files.length + ctx.scan.skipped.length,
        newest: null,
      },
    })
    const roles = local.map.roles
    const routed = Object.keys(roles).length

    const raw = analyseJourneys(ctx.files, { roles }) as unknown as {
      findings: PoschiCommonFinding[]
    }

    // Whether one account can be on two sides at once is only a question for a
    // product that HAS two sides. On a single-audience product, one role per
    // account is the correct shape and reporting it would be noise.
    const shape = readAccountShape(ctx.files, roles)
    const isMarket = isMarketplace(ctx)
    const dual = isMarket ? dualRoleFindings(shape) : []
    const withheld = !isMarket && dualRoleFindings(shape).length > 0

    const findings = collate(
      [...raw.findings, ...dual, ...journeyChecks(ctx.files)]
        .map((f) => normalizeCommonFinding(f, 'role_journeys')),
    )

    return {
      category: 'role_journeys',
      status: routed === 0 ? 'completed_with_warnings' : 'completed',
      score: scoreFrom(findings, routed > 0),
      summary: routed > 0
        ? `${routed} routes were read across ${new Set(Object.values(roles).map((r) => r.role)).size} `
          + `audiences. ${summarise('role_journeys', findings)}`
        : 'No router was recognised, so no journey could be walked.',
      findings,
      limitations: [
        ...(routed === 0
          ? ['No route declarations were recognised in this repository, so the journeys could not '
            + 'be built. Routes generated at runtime or declared in a dialect this does not parse '
            + 'are invisible to it, and an empty section here is not evidence of a simple product.']
          : ['Roles are read from the router: the roles a guard names in its props, then the names '
            + 'of the components wrapping a route, then the path. A permission checked inside a '
            + 'component rather than at the route is not visible to this.']),
        ...(withheld
          ? ['An observation about one person holding two roles was not made, because this project '
            + 'was not assessed as a two-sided product. See the Marketplace health section.']
          : []),
        ...(ctx.scan.truncated ? ['The file scan was truncated; this section saw part of the repository.'] : []),
      ],
    }
  },
})

/**
 * Obligations that only exist because a project is a marketplace.
 *
 * ── Why this list is needed ──────────────────────────────────────────────────
 *
 * The compliance analyser was written for a marketplace and states worker
 * classification as fact — "this is a marketplace where providers deliver
 * services to clients the platform introduced" — with no test that it is one.
 * Asked of a static site or a CLI it says the same thing, at high severity,
 * with the largest consequence in the report attached to it.
 *
 * Every other finding in that analyser is a ternary over evidence: it says
 * either "a privacy notice exists" or "no privacy notice appears", both of
 * which are true statements about any repository. This one is not, so it is
 * the only one gated.
 *
 * Gated here rather than in the analyser, because the Poschi Reports page uses
 * the same analyser against a project that genuinely is a marketplace, where
 * the claim is correct and should keep being made.
 */
const MARKETPLACE_ONLY_COMPLIANCE = new Set(['worker-classification'])

export const complianceAnalyzer = (): SectionAnalyzer => ({
  category: 'compliance',
  async run(ctx): Promise<ReportSectionResult> {
    const raw = analyseCompliance(ctx.files) as unknown as { findings: PoschiCommonFinding[] }
    const isMarket = isMarketplace(ctx)

    const kept = raw.findings.filter((f) =>
      isMarket || !MARKETPLACE_ONLY_COMPLIANCE.has(f.id))
    const dropped = raw.findings.length - kept.length

    const findings = collate(
      [...kept, ...complianceChecks(ctx.files)]
        .map((f) => normalizeCommonFinding(f, 'compliance')),
    )
    return {
      category: 'compliance',
      status: 'completed',
      score: scoreFrom(findings, true),
      summary: summarise('compliance', findings),
      findings,
      // Stated on the section rather than only on the cover, because a reader
      // can arrive at this section directly from the findings register.
      limitations: [
        'This assessment is a product and engineering triage, not legal advice or a '
        + 'compliance certification.',
        // What was withheld, and why. A finding removed silently is a finding a
        // reader cannot ask about.
        ...(dropped > 0
          ? [`${dropped} obligation(s) that apply only to a marketplace were not assessed, `
            + 'because this project does not appear to be one. See the Marketplace health '
            + 'section for the reasoning.']
          : []),
        ...(ctx.scan.truncated ? ['The file scan was truncated; this section saw part of the repository.'] : []),
      ],
    }
  },
})

/**
 * The marketplace reading of a repository, computed once.
 *
 * Two sections need it — marketplace health to decide whether to run, and
 * compliance to decide whether a marketplace-only obligation applies — and they
 * must agree. Memoised on the file list so the two cannot answer differently
 * within a run, and so a large repository is not walked twice for it.
 */
const marketplaceCache = new WeakMap<object, Applicability>()

/**
 * Is this a marketplace? One answer, for every section that asks.
 *
 * ── Why the two gates had to become one ──────────────────────────────────────
 *
 * Marketplace health gated on the description; compliance gated on the
 * structural check. A CSS design-system builder cleared the structural check,
 * so its report carried a section saying "not a marketplace" beside a
 * high-severity finding beginning "This is a marketplace where providers
 * deliver services to clients the platform introduced". Two gates on one
 * question is one of them being wrong in every report where they differ.
 *
 * The description wins where it exists, for the reason given at the gate
 * itself: it has read the README, the manifest and the routes, and the
 * primitives are regexes that match in most projects.
 *
 * ── Except when the description disagrees with itself ────────────────────────
 *
 * Letting one boolean from a 7B model overrule everything cost the clearest
 * marketplace in the set its entire section. Three runs in a row it wrote
 *
 *   whatItIs: "A booking marketplace and business-operations platform for
 *              independent service providers."
 *   isTwoSidedMarketplace: false
 *
 * and the report printed the two together: "this is A booking marketplace … —
 * not a marketplace, so it was not assessed as one", beside a note that ten
 * structural patterns had matched and been overruled. Marketplace health went
 * not-applicable on the product the whole feature was built against.
 *
 * A model that calls something a marketplace in prose and then denies it in a
 * field has not given an answer, it has given two. The flag is only allowed to
 * veto when the prose agrees with it; where they conflict the structural check
 * decides, which is where the question sat before any model was involved.
 *
 * Deliberately one-directional. `true` is still taken at its word, so this
 * cannot resurrect the case it was written for — a design-system builder whose
 * paths matched ten regexes and whose description says what it actually is.
 */
const CALLS_ITSELF_A_MARKETPLACE = /\bmarket[- ]?place\b|\btwo[- ]sided\b|\bmulti[- ]vendor\b/i

export function describesAMarketplace(m: { whatItIs?: string; domain?: string }): boolean {
  return CALLS_ITSELF_A_MARKETPLACE.test(`${m.whatItIs ?? ''} ${m.domain ?? ''}`)
}

function isMarketplace(ctx: AnalysisContext): boolean {
  const described = ctx.comprehension.model
  if (!described) return marketplaceStateOf(ctx.files).applies
  if (described.isTwoSidedMarketplace) return true
  if (describesAMarketplace(described)) return marketplaceStateOf(ctx.files).applies
  return false
}

/**
 * The screens the router actually serves.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 *
 * `analyseMarketplace` was called here without it, so `routes` defaulted to the
 * empty list — and `hasRoute` is `routes.some(...)`, which over an empty list is
 * false for every primitive that declares a route pattern. The section then
 * reported each capability it found in the code as "built, but no screen
 * reaches it". Not one of those was measured. The router had never been read.
 *
 * On POSCHI that was four of the six actions the plan put in Immediate, every
 * one of them about a screen the product has. `lookbooks`, `notifications` and
 * `invite-client` are all declared, as children of `/provider` — which is the
 * second half of the problem, because React Router children are relative and a
 * search for `/lookbooks` finds nothing.
 *
 * `parseRouterSource` already resolves nesting through `joinPath`, and POSCHI's
 * own report path has always passed its results in. This gives the Flow Reports
 * path the same thing rather than a second parser to disagree with it.
 */
function routePathsOf(files: AnalysisContext['files']): string[] {
  const hit = routeCache.get(files)
  if (hit) return hit
  const paths = routerFiles(files as never)
    .slice(0, 8)
    .flatMap((f) => {
      // A router that cannot be parsed contributes nothing rather than taking
      // the section down. Contributing nothing is the pre-existing behaviour,
      // so this can only improve on it.
      try { return parseRouterSource(f.text).routes.map((r) => r.route) } catch { return [] }
    })
  const unique = [...new Set(paths)]
  routeCache.set(files, unique)
  return unique
}

const routeCache = new WeakMap<object, string[]>()

function marketplaceStateOf(files: AnalysisContext['files']): Applicability {
  const hit = marketplaceCache.get(files)
  if (hit) return hit
  const raw = analyseMarketplace(
    files, { routes: routePathsOf(files) }) as unknown as { primitives: PrimitiveState[] }
  const state = marketplaceApplicability(raw.primitives)
  marketplaceCache.set(files, state)
  return state
}

/**
 * Marketplace health, which decides whether it applies at all.
 *
 * ── The gate that was not a gate ─────────────────────────────────────────────
 *
 * This asked whether ANY marketplace primitive was found. The primitives
 * include patterns as ordinary as `/\/search\b/` and `/\/profile\b/`, so a
 * project with a search route was assessed as a marketplace and handed nine
 * findings about providers, bookings and customers it does not have. Measured:
 * a digital book project produced fourteen of them — more than the marketplace
 * the analyser was written for.
 *
 * The test lives in `applicability.ts` now and asks for structure rather than
 * a match: several primitives, across several sides of the model, including
 * both of the two a marketplace is defined by.
 */
export const marketplaceHealthAnalyzer = (): SectionAnalyzer => ({
  category: 'marketplace_health',
  async run(ctx): Promise<ReportSectionResult> {
    const routes = routePathsOf(ctx.files)
    const raw = analyseMarketplace(ctx.files, { routes }) as unknown as {
      findings: PoschiCommonFinding[]
      primitives: PrimitiveState[]
    }
    const state = marketplaceStateOf(ctx.files)
    const described = ctx.comprehension.model

    // ── The description vetoes the pattern match ──────────────────────────────
    //
    // The primitives are regexes against paths and source text, and patterns as
    // ordinary as `/\/profile\b/` or `/\/search\b/` appear in most projects. A
    // design-system builder cleared the structural gate and was handed nine
    // findings about providers, bookings and customers — twenty-four occurrences
    // of a vocabulary belonging to a different product.
    //
    // The description has read the README, the manifest, the schema and the
    // routes, and states in the product's own words what it is. That is better
    // evidence than a regex, so when it says this is not a marketplace, it wins.
    // Earlier this only added a footnote to a section that still ran, which put
    // the contradiction in the report instead of keeping it out.
    // The description's flag vetoes only where its own prose agrees with it.
    // `isMarketplace` holds the reasoning; this repeats the condition rather
    // than calling it because the reason text needs to name which evidence
    // decided, and a boolean cannot say that.
    if (described && !described.isTwoSidedMarketplace && !describesAMarketplace(described)) {
      return {
        category: 'marketplace_health',
        status: 'not_applicable',
        score: null,
        summary: 'This project was not assessed as a marketplace.',
        findings: [],
        limitations: [],
        reason: `Read from the code, this is ${described.whatItIs} — not a marketplace, so it `
          + 'was not assessed as one.'
          + (state.applies
            ? ` A structural check did match ${state.evidence.length} marketplace-shaped `
              + 'patterns, but those are regexes against paths and match in most projects; the '
              + 'description is the better evidence and was followed. Findings were not '
              + 'manufactured for a model this project does not have.'
            : ' The structural check agreed.'),
      }
    }

    if (!state.applies) {
      return {
        category: 'marketplace_health',
        status: 'not_applicable',
        score: null,
        summary: 'This project was not assessed as a marketplace.',
        findings: [],
        limitations: [],
        reason: state.reason,
      }
    }

    const findings = collate(raw.findings.map((f) => normalizeCommonFinding(f, 'marketplace_health')))

    // Reaching here means the structural check passed AND the description did
    // not coherently deny it. A description that denied it AND read as
    // something else returns above, because a footnote on a section that still
    // ran put the contradiction into the report instead of keeping it out.
    const contradicted = Boolean(
      described && !described.isTwoSidedMarketplace && describesAMarketplace(described),
    )
    return {
      category: 'marketplace_health',
      status: contradicted ? 'completed_with_warnings' : 'completed',
      score: scoreFrom(findings, true),
      summary: summarise('marketplace_health', findings),
      findings,
      limitations: [
        `Assessed as a marketplace because ${state.evidence.length} primitives were found: `
        + `${state.evidence.join(', ')}. If that reading is wrong, everything in this section is.`,
        // The reader is told the two signals disagreed and which one was
        // followed. Resolving it silently would leave the section looking more
        // certain than the evidence was.
        ...(contradicted
          ? ['The written description of this project calls it a marketplace and separately '
            + 'answers "no" to being a two-sided one. Those cannot both be right, so the '
            + 'structural evidence above decided it. Worth confirming by hand.']
          : []),
      ],
    }
  },
})

export const securityQaAnalyzer = (): SectionAnalyzer => ({
  category: 'security_qa',
  async run(ctx): Promise<ReportSectionResult> {
    const raw = analyseSecurity(ctx.files) as unknown as {
      findings: PoschiSecurityFinding[]
      limitations: string[]
    }
    const findings = collate([
      ...raw.findings.map(normalizeSecurityFinding),
      ...securityChecks(ctx.files).map((f) => normalizeCommonFinding(f, 'security_qa')),
    ])
    return {
      category: 'security_qa',
      status: 'completed',
      score: scoreFrom(findings, true),
      summary: summarise('security_qa', findings),
      findings,
      limitations: [
        ...raw.limitations,
        ...(ctx.scan.truncated ? ['The file scan was truncated; this section saw part of the repository.'] : []),
      ],
    }
  },
})

// ── The three that are not straight wrappers ─────────────────────────────────

/**
 * Error handling, from `errorLog.ts`.
 *
 * New rather than adapted: Poschi's error section is a live feed from a
 * deployed product's API, which says nothing about an arbitrary repository.
 */
export const errorLogAnalyzer = (): SectionAnalyzer =>
  commonAdapter('error_log', (ctx) =>
    analyseErrorHandling(ctx.files) as unknown as { findings: PoschiCommonFinding[] },
  (ctx) => errorStabilityChecks(ctx.files))

/**
 * Competitive gaps, from `competitive.ts`.
 *
 * Carries its own limitations onto the section, because the constraint that it
 * has not looked at any competitor has to reach the reader who arrives at this
 * section directly.
 */
export const competitiveGapsAnalyzer = (): SectionAnalyzer => ({
  category: 'competitive_gaps',
  async run(ctx): Promise<ReportSectionResult> {
    const raw = analyseCompetitiveGaps(ctx.files, {
      networkResearch: ctx.settings.networkResearch,
    })
    if (!raw.category) {
      return {
        category: 'competitive_gaps',
        status: 'not_applicable',
        score: null,
        summary: 'The kind of product could not be identified.',
        findings: [],
        limitations: raw.limitations,
        reason: 'The files that were read did not identify what kind of product this is, so no '
          + 'category expectations were applied. Guessing would produce findings about a '
          + 'product that does not exist.',
      }
    }
    const findings = collate([
      ...raw.findings.map((f) => normalizeCommonFinding(f as unknown as PoschiCommonFinding, 'competitive_gaps')),
      ...competitiveChecks(ctx.files).map((f) => normalizeCommonFinding(f, 'competitive_gaps')),
    ])
    return {
      category: 'competitive_gaps',
      status: 'completed',
      // Unscored on purpose. These are hypotheses about what a product of this
      // kind usually has, and a number would give them an authority the
      // evidence does not support.
      score: null,
      summary: `Compared against capabilities common to a ${raw.category}. `
        + summarise('competitive_gaps', findings),
      findings,
      limitations: raw.limitations,
    }
  },
})

/**
 * Product intel, from the existing structural analyser.
 *
 * `analyseLocal` is given the DISPLAY NAME where it expects a root. With a
 * pre-built source it only echoes that value into its result, so passing the
 * display name keeps a local path out of everything downstream.
 */
export const productIntelAnalyzer = (): SectionAnalyzer => ({
  category: 'product_intel',
  async run(ctx): Promise<ReportSectionResult> {
    const local = analyseLocal(ctx.repositoryDisplayName, {
      source: {
        root: ctx.repositoryDisplayName,
        files: ctx.files,
        total: ctx.files.length + ctx.scan.skipped.length,
        newest: null,
      },
    })

    const screens = local.map?.sitemap?.length ?? 0
    const findings: PoschiCommonFinding[] = []

    const readme = ctx.files.find((f) => /(^|\/)readme\.md$/i.test(f.path))
    if (!readme) {
      findings.push({
        id: 'PRD-001', area: 'positioning',
        title: 'No README explains what this product is',
        severity: 'medium', confidence: 'verified',
        detail: 'No README was found, so nothing in the repository states what the product does '
          + 'or who it is for. Everyone arriving at it has to infer that from the routes.',
        files: [], because: 'Read directly from the file list.',
        next: 'Add a README opening with one sentence on what this is and who it is for.',
        isAbsence: true, prompt: null,
      })
    } else if (readme.text.trim().length < 200) {
      findings.push({
        id: 'PRD-002', area: 'positioning',
        title: 'The README is too short to explain the product',
        severity: 'low', confidence: 'verified',
        detail: `The README is ${readme.text.trim().length} characters. That is usually a title `
          + 'and an install command rather than an explanation of what the product does.',
        files: [readme.path], because: 'Measured from the file.',
        next: 'Say what problem it solves and who for, before how to run it.',
        isAbsence: false, prompt: null,
      })
    }

    if (screens === 0) {
      findings.push({
        id: 'PRD-003', area: 'structure',
        title: 'No routes or screens were identified',
        severity: 'low', confidence: 'indicated',
        detail: 'No router configuration was recognised, so the product\'s surface could not be '
          + 'mapped. It may use a routing approach this analysis does not parse.',
        files: [], because: 'An absence, and route parsing covers only the common dialects.',
        next: 'Confirm how routes are defined here.',
        isAbsence: true, prompt: null,
      })
    }

    const normalized = collate(
      [...findings, ...telemetryChecks(ctx.files)]
        .map((f) => normalizeCommonFinding(f, 'product_intel')),
    )
    return {
      category: 'product_intel',
      status: 'completed',
      score: scoreFrom(normalized, true),
      summary: screens > 0
        ? `${screens} screen${screens === 1 ? '' : 's'} were mapped from the router. `
          + summarise('product_intel', normalized)
        : summarise('product_intel', normalized),
      findings: normalized,
      limitations: [
        'Product intent is inferred from structure and documentation. Anything about users, '
        + 'demand or value is a question for discovery, not something a repository can answer.',
      ],
    }
  },
})

/**
 * The thirteen analysed sections, in report order.
 *
 * Thirteen, not the fifteen in REPORT_CATEGORIES: cross_domain and action_plan
 * are derived from what these produce rather than read from the repository, so
 * they have no analyser to register.
 *
 * The registry is the single place that says what a full run covers, so a
 * section cannot be added to the model and forgotten here.
 */
export function allAnalyzers(): SectionAnalyzer[] {
  return [
    errorLogAnalyzer(),
    productIntelAnalyzer(),
    engineeringQualityAnalyzer(),
    monetizationAnalyzer(),
    seoAnalyzer(),
    marketplaceHealthAnalyzer(),
    roleJourneysAnalyzer(),
    accessibilityAnalyzer(),
    competitiveGapsAnalyzer(),
    complianceAnalyzer(),
    securityQaAnalyzer(),
    marketingOpportunityAnalyzer(),
    dataArchitectureAnalyzer(),
  ]
}
