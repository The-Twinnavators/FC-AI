// daemon/src/flow-reports/analyzers/marketing.ts
//
// The Marketing Opportunity Scan, as a report section.
//
// ── Why this section carries no score ────────────────────────────────────────
//
// The figure at the top of a Flow Report is a health score: how sound is what
// has been built. This section does not answer that. A product with no referral
// programme is not damaged, and scoring it as though it were would pull the
// headline number down for a commercial decision rather than for anything wrong
// with the code. Monetization is excluded for exactly this reason and this
// follows it, enforced in `summarize.ts` where the figure is computed.
//
// ── The capability map is evidence, not prose ────────────────────────────────
//
// The brief asks for a matrix. Rather than embed a markdown table inside a
// finding field — which survives the markdown renderer and not the PDF one —
// the map is emitted as one evidence line per capability on a single
// informational finding. Same information, renders everywhere, and each row
// carries the files that decided it.
//
// ── A prompt only where the surface exists ───────────────────────────────────
//
// `implementation_ready` is the only classification that produces a Claude Code
// prompt. Everything else produces resolution instructions: what to learn, who
// should learn it, and what would settle it. The brief is explicit that a
// confident engineering prompt for a feature nobody has designed is worse than
// no prompt, and this is where that is enforced.

import type {
  ClaudeCodePrompt, Confidence, Evidence, Finding, ReportSectionResult, Severity,
} from '../types.js'
import type { SectionAnalyzer } from '../jobManager.js'
import { analyseLocal } from '../poschi/product/fromLocal.js'
import { analyseSeo } from '../poschi/seo/analyse.js'
import {
  analyseMarketing, type Capability, type MarketingReport, type Opportunity,
} from '../poschi/marketing/analyse.js'

/** Priority maps to severity so the report's own ordering puts a consent
 *  prerequisite above a nice-to-have, without this section inventing a
 *  second ranking the reader has to reconcile with the first. */
const SEVERITY: Record<Opportunity['priority'], Severity> = {
  P0: 'high', P1: 'medium', P2: 'low', P3: 'info',
}

/** A score of 4 or 5 on the confidence dimension is what the analyser means by
 *  "the repository showed me this". Below 3 it is an assumption wearing a
 *  number, and the report should say so. */
function confidenceOf(o: Opportunity): Confidence {
  const v = o.scores.confidence.value
  return v >= 4 ? 'high' : v >= 3 ? 'medium' : 'low'
}

const CLASSIFICATION_LABEL: Record<Opportunity['classification'], string> = {
  implementation_ready: 'Implementation-ready',
  measurement_first: 'Measurement first',
  experiment_first: 'Experiment first',
  external_research_first: 'External research first',
  not_applicable: 'Not applicable',
}

const STATUS_WORD: Record<Capability['status'], string> = {
  present: 'present', partial: 'partly present', missing: 'absent', unverified: 'not checkable',
}

function capabilityRow(c: Capability): Evidence {
  const found = c.found.length > 0
    ? `Found: ${c.found.map((f) => `${f.label} (${f.count} file${f.count === 1 ? '' : 's'})`).join('; ')}.`
    : ''
  const absent = c.absent.length > 0 ? ` Not found: ${c.absent.join('; ')}.` : ''
  const why = c.unverifiedBecause ? ` ${c.unverifiedBecause}` : ''
  const cite = c.found.flatMap((f) => f.files)[0]
  return {
    kind: cite ? 'file' : 'static_analysis',
    path: cite,
    description: `${c.label} — ${STATUS_WORD[c.status]}. ${found}${absent}${why}`.trim(),
  }
}

/** The scores, written so a reader can disagree with each one separately. */
function scoreLines(o: Opportunity): string {
  const names: Array<[keyof Opportunity['scores'], string]> = [
    ['userValue', 'User value'],
    ['businessRelevance', 'Business relevance'],
    ['distributionLeverage', 'Distribution leverage'],
    ['feasibility', 'Low-cost feasibility'],
    ['fitWithSurfaces', 'Fit with existing surfaces'],
    ['effort', 'Implementation effort'],
    ['measurementReadiness', 'Measurement readiness'],
    ['privacyRisk', 'Privacy and compliance risk'],
    ['abuseRisk', 'Abuse and fraud risk'],
    ['confidence', 'Confidence from repository evidence'],
  ]
  return names
    .map(([k, label]) => `${label}: ${o.scores[k].value}/5 — ${o.scores[k].basis}`)
    .join('\n')
}

function resolutionText(o: Opportunity): string {
  const r = o.resolution
  if (!r) return ''
  return [
    `What must be learned: ${r.mustLearn}`,
    `Owner: ${r.ownerRole}`,
    'Questions to answer:',
    ...r.questions.map((q) => `  - ${q}`),
    `Expected evidence: ${r.expectedEvidence}`,
    `Method: ${r.method}`,
    `Safe next step: ${r.safeNextStep}`,
    `Decision criteria: ${r.decisionCriteria}`,
  ].join('\n')
}

function toFinding(o: Opportunity): Finding {
  const prompts: ClaudeCodePrompt[] = o.prompt
    ? [{
      title: `${o.id} — ${o.title}`,
      prompt: o.prompt,
      intendedOutcome: o.successMetric,
      affectedPaths: o.evidence,
    }]
    : []

  const evidence: Evidence[] = o.evidence.map((p) => ({
    kind: 'file' as const, path: p, description: o.observed,
  }))
  if (evidence.length === 0) {
    evidence.push({ kind: 'static_analysis', description: o.observed })
  }

  const rationale = [
    `Expected mechanism, as a hypothesis: ${o.hypothesis}`,
    '',
    `Ratings, with what produced each one:`,
    scoreLines(o),
    '',
    o.requiredData.length > 0 ? `Data or instrumentation required:\n${o.requiredData.map((d) => `  - ${d}`).join('\n')}` : '',
    o.risks.length > 0 ? `Risks and abuse cases:\n${o.risks.map((d) => `  - ${d}`).join('\n')}` : '',
    o.privacy.length > 0 ? `Privacy and compliance:\n${o.privacy.map((d) => `  - ${d}`).join('\n')}` : '',
    o.resolution ? `\nResolution instructions:\n${resolutionText(o)}` : '',
  ].filter(Boolean).join('\n')

  return {
    id: o.id,
    category: 'marketing_opportunity',
    title: o.title,
    summary: o.observed,
    severity: SEVERITY[o.priority],
    confidence: confidenceOf(o),
    status: 'open',
    impact: `${o.priority} · ${CLASSIFICATION_LABEL[o.classification]}. Serves: ${o.serves}`,
    recommendation: `Cheapest next action: ${o.cheapestNextAction} `
      + `Success metric: ${o.successMetric} Guardrail: ${o.guardrailMetric}`,
    rationale,
    evidence,
    claudeCodePrompts: prompts,
    // Declared rather than derived. This section carries proposals and a
    // capability map side by side, and a rule that classified the whole
    // section one way got both wrong — see the note in classify.ts.
    type: 'opportunity',
    effort: o.scores.effort.value >= 4 ? 'high'
      : o.scores.effort.value >= 3 ? 'medium' : 'low',
    confidenceScore: o.scores.confidence.value / 5,
    implication: o.serves,
    opportunity: o.hypothesis,
    dimensions: {
      impact: o.scores.businessRelevance.value * 2,
      effort: o.scores.effort.value * 2,
      risk: Math.max(o.scores.privacyRisk.value, o.scores.abuseRisk.value) * 2,
      userValue: o.scores.userValue.value * 2,
      technicalLeverage: o.scores.distributionLeverage.value * 2,
      revenueRelevance: o.scores.businessRelevance.value * 2,
    },
    // Anything that is not implementation-ready rests on something this scan
    // cannot settle, and the report should label it rather than let a reader
    // assume it was confirmed.
    requiresManualValidation: o.classification !== 'implementation_ready',
  }
}

/** The capability map and the refusals, as two informational findings. */
function contextFindings(r: MarketingReport): Finding[] {
  const present = r.capabilities.filter((c) => c.status === 'present').length
  const map: Finding = {
    id: 'MKT-MAP',
    category: 'marketing_opportunity',
    title: `Marketing capability map: ${present} of ${r.capabilities.length} capabilities present`,
    summary: 'What this product can already do about its own distribution, one row per capability, '
      + 'each decided by files named in the evidence.',
    severity: 'info',
    confidence: 'high',
    status: 'open',
    impact: 'This is the map the opportunities below are read from. A row marked not checkable is '
      + 'not a row marked absent: it means the scan could not look.',
    recommendation: 'Read this before the opportunities. An opportunity only makes sense against '
      + 'the capability it is attached to.',
    type: 'observation',
    rationale: 'Every capability was detected from code shapes — a call, an identifier, an import, '
      + 'a URL — and never from an English word in a comment or a heading, so a plan written down '
      + 'somewhere is not counted as a shipped feature.',
    evidence: r.capabilities.map(capabilityRow),
    claudeCodePrompts: [],
  }

  const refused: Finding = {
    id: 'MKT-NOT',
    category: 'marketing_opportunity',
    title: `${r.notRecommended.length} growth tactics deliberately not recommended`,
    summary: 'Ideas this section declined, with the reason, so a reader can see they were '
      + 'considered rather than overlooked.',
    severity: 'info',
    confidence: 'high',
    status: 'open',
    impact: 'None of these is proposed for this product. Several are common enough that their '
      + 'absence would otherwise look like an oversight.',
    recommendation: 'No action. If any of these is under consideration elsewhere, the reason given '
      + 'here is the objection to answer first.',
    type: 'observation',
    rationale: 'A report that only lists what to do cannot be checked for what it chose not to do.',
    evidence: r.notRecommended.map((n) => ({
      kind: 'static_analysis' as const,
      description: `${n.idea} — ${n.because}`,
    })),
    claudeCodePrompts: [],
  }

  return [map, refused]
}

export const marketingOpportunityAnalyzer = (): SectionAnalyzer => ({
  category: 'marketing_opportunity',
  async run(ctx): Promise<ReportSectionResult> {
    // The router and the metadata are read once, by the passes that own them,
    // and consumed here. Re-deriving either would let this section disagree
    // with the Product intel and SEO sections about the same repository.
    const local = analyseLocal(ctx.repositoryDisplayName, {
      source: {
        root: ctx.repositoryDisplayName,
        files: ctx.files,
        total: ctx.files.length + ctx.scan.skipped.length,
        newest: null,
      },
    })
    const publicRouteCount = local.routerSources.length === 0
      ? null
      : Object.values(local.map.roles).filter((r) => r.role === 'anonymous').length

    const seo = analyseSeo(ctx.files, {
      allPaths: ctx.files.map((f) => f.path),
      publicRoutes: publicRouteCount,
    })
    const facts = (seo as { facts?: Record<string, unknown> }).facts ?? {}
    const og = facts.openGraph
    const canonical = facts.canonical

    const report = analyseMarketing(ctx.files, {
      publicRouteCount,
      hasLinkPreviewMeta: Array.isArray(og) ? og.length > 0 : null,
      hasCanonical: typeof canonical === 'boolean' ? canonical : null,
    })

    const findings = [
      ...contextFindings(report),
      ...report.opportunities.map(toFinding),
    ]

    const p0 = report.opportunities.filter((o) => o.priority === 'P0').length
    const ready = report.opportunities.filter((o) => o.classification === 'implementation_ready').length

    return {
      category: 'marketing_opportunity',
      status: 'completed',
      // Unscored on purpose — see the note at the top of this file.
      score: null,
      summary: report.opportunities.length === 0
        ? 'No growth opportunity was identified that this repository gives evidence for. That is a '
          + 'statement about what was found in these files, not a judgement that none exists.'
        : `${report.opportunities.length} opportunit${report.opportunities.length === 1 ? 'y' : 'ies'} `
          + `read from what this product already has, ${p0} of them a prerequisite before the rest can `
          + `be judged. ${ready} come with a code change specific enough to hand over; the others ask a `
          + 'question first.',
      findings,
      limitations: [...report.limitations, ...report.measurementGaps],
    }
  },
})
