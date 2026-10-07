// daemon/src/flow-reports/analyzers/synthesis.ts
//
// What several sections add up to that none of them says alone.
//
// ── The problem this solves ──────────────────────────────────────────────────
//
// Twelve analysers each answer their own question and stop. A reader holding
// the whole report can see that the product stores dates of birth, that there
// is no way to export or delete an account, and that no terms of service exist
// — but those are three findings in two sections, each individually modest, and
// nothing on the page puts them together. The conclusion they support is
// stronger than any of them and appears nowhere.
//
// ── Deterministic, because a relationship must be checkable ──────────────────
//
// This could be a model reading the whole report and saying what it notices. It
// is not, for the same reason the analysers are not: a relationship a model
// asserted cannot be checked, and one it hallucinated is indistinguishable from
// one it found. Each rule here names the findings it requires, fires only when
// every one of them is present, and carries their ids into its evidence — so
// any theme can be taken apart back into the measurements that produced it.
//
// ── A conclusion is never surer than its premises ────────────────────────────
//
// Confidence is the MINIMUM of the findings a theme is built from, never an
// average and never its own number. Three findings at 0.9, 0.8 and 0.45 compose
// to 0.45: the weak one is load-bearing, and averaging it away would make the
// composite look better evidenced than the thing it rests on.
//
// ── Themes are not new findings ──────────────────────────────────────────────
//
// Nothing here measures anything. A theme cites findings that already exist and
// says what they mean together; it never introduces a claim of its own, and it
// never raises a severity. If every constituent is withdrawn by adjudication,
// the theme goes with them.

import type { Finding, ReportSectionResult } from '../types.js'

const CATEGORY = 'cross_domain' as const

/** One leg of a rule: what it is looking for, and how to recognise it. */
interface Leg {
  /** Printed in the evidence, so a reader can see which legs matched. */
  label: string
  match: (f: Finding) => boolean
}

interface Rule {
  id: string
  title: string
  /** What the combination means — the sentence none of the parts says. */
  theme: string
  implication: string
  recommendation: string
  opportunity?: string
  /** Every leg must match at least one finding for the rule to fire. */
  legs: Leg[]
}

/** Matches a finding by its section and its analyser-assigned id. Ids are
 *  constants in the analysers rather than anything repository-specific, so
 *  they are stable across projects in a way a title is not. */
const is = (category: string, ...ids: string[]): Leg['match'] =>
  (f) => f.category === category && ids.includes(f.id)

/** Matches a family of ids that share a prefix, where an analyser emits one per
 *  role, per primitive or per capability. */
const startsWith = (category: string, prefix: string): Leg['match'] =>
  (f) => f.category === category && f.id.startsWith(prefix)

/**
 * The rules.
 *
 * Every one was written against a real report rather than from the
 * methodology's illustrations, and each was checked to fire on findings that
 * actually exist. A rule that reads well and never matches anything is worse
 * than no rule: it suggests the synthesis is working when it is idle.
 */
const RULES: Rule[] = [
  {
    id: 'SYN-001',
    title: 'Personal data is stored and there is no way to get it out or remove it',
    theme: 'The schema holds personal data, the product offers no self-serve export or '
      + 'deletion, and no terms of service set out what happens to any of it.',
    implication: 'Each of these is modest alone. Together they describe a product that '
      + 'collects personal information and has published nothing about how it is handled and '
      + 'built nothing to act on a request about it. The obligation attaches to the '
      + 'combination, not to any one of them.',
    recommendation: 'Treat the three as one piece of work. A deletion path, an export path '
      + 'and the document that describes them are the same project, and doing one without the '
      + 'others leaves the gap open.',
    legs: [
      { label: 'personal or credential-shaped columns in the schema', match: is('data_architecture', 'DATA-005') },
      { label: 'no self-serve export or account deletion', match: is('compliance', 'data-rights') },
      { label: 'no terms of service', match: is('compliance', 'terms') },
    ],
  },
  {
    id: 'SYN-002',
    title: 'Two separate readings found the same weakness in how secrets are handled',
    theme: 'Credential-shaped strings appear in tracked files, and a privileged key is '
      + 'compared with ordinary string equality.',
    implication: 'These were found by different analysers looking for different things, which '
      + 'is what makes them worth reading together: the handling of secrets is weak in more '
      + 'than one place, so this is a pattern rather than an oversight.',
    recommendation: 'Look at secret handling as a whole rather than fixing the two sites. A '
      + 'constant-time comparison and a scrub of the tracked strings both follow from one '
      + 'decision about where secrets live and how they are checked.',
    legs: [
      { label: 'credential-shaped strings in tracked files', match: is('engineering_quality', 'possible-secrets') },
      { label: 'a privileged key compared unsafely', match: is('security_qa', 'SEC-002') },
    ],
  },
  {
    id: 'SYN-003',
    title: 'An error is discarded, nothing records it, and nobody can report it',
    theme: 'Catch blocks drop the error they caught, no structured logging library is '
      + 'present, and the product offers no way to report a problem.',
    implication: 'Any one of these is survivable. All three together mean a failure a '
      + 'customer hits leaves no trace anywhere: not in the code path, not in a log, and not '
      + 'in a message from the person it happened to. Nothing downstream can be fixed because '
      + 'nothing arrives to fix.',
    recommendation: 'The cheapest of the three is the reporting path, because it is the only '
      + 'one that works without the other two. Logging and error capture then make what it '
      + 'reports diagnosable.',
    legs: [
      { label: 'catch blocks that discard the error', match: is('error_log', 'ERR-001') },
      { label: 'no structured logging', match: is('error_log', 'ERR-003') },
      { label: 'no in-product way to report a problem', match: is('product_intel', 'LX-TEL-002') },
    ],
  },
  {
    id: 'SYN-004',
    title: 'Capabilities are built and no screen reaches them',
    theme: 'The marketplace analysis found primitives present in the code with no route to '
      + 'them, and the role journeys found stages with no surface for the same roles.',
    implication: 'Two analysers reading different things — the data and API layer, and the '
      + 'router — reached the same conclusion independently. That makes it a fact about the '
      + 'product rather than a limitation of either reading: work that is already paid for is '
      + 'not reachable.',
    opportunity: 'The cheapest capability to add is one that already exists and needs a route. '
      + 'What is missing here is a screen, not a system.',
    recommendation: 'Compare the unsurfaced primitives against the journey stages that have no '
      + 'surface. Where they name the same thing, one screen closes both findings.',
    legs: [
      { label: 'a primitive built with no screen reaching it', match: startsWith('marketplace_health', 'unsurfaced-') },
      { label: 'a role whose journey has stages with no surface', match: startsWith('role_journeys', 'journey-') },
    ],
  },
  {
    id: 'SYN-005',
    title: 'Links are shared, they arrive bare, and nothing counts them',
    theme: 'Sharing surfaces exist, a shared link carries no canonical URL, and no event '
      + 'records that a share happened.',
    implication: 'The product already has the loop. What it does not have is the two things '
      + 'that would make the loop worth improving: a link that looks like something when it '
      + 'lands, and a number that says whether any of it works.',
    opportunity: 'Measurement first, then the preview. In that order the preview change can be '
      + 'judged; in the other order it cannot.',
    recommendation: 'Emit an aggregate share event before changing anything else about '
      + 'sharing. It is the smaller change and it is what makes the larger one assessable.',
    legs: [
      { label: 'sharing exists and is unmeasured', match: is('marketing_opportunity', 'MKT-001') },
      { label: 'a shared link has no preview', match: is('marketing_opportunity', 'MKT-004') },
      { label: 'no canonical link', match: is('seo', 'no-canonical') },
    ],
  },
  {
    id: 'SYN-006',
    title: 'Money-handling code carries placeholders and nothing runs on a change to it',
    theme: 'Money paths contain placeholder markers, and no continuous integration '
      + 'configuration exists to run anything when they change.',
    implication: 'A placeholder in a payment path is the kind of defect a test catches and a '
      + 'reader does not. With nothing running on a change, the only thing standing between a '
      + 'placeholder and production is someone remembering.',
    recommendation: 'Of the two, continuous integration is the one that keeps paying. A test '
      + 'over the money paths is worth little if nothing runs it.',
    legs: [
      { label: 'placeholder markers in money paths', match: is('monetization', 'placeholder-money') },
      { label: 'no continuous integration', match: is('engineering_quality', 'no-ci') },
    ],
  },
]

export interface Theme {
  rule: Rule
  /** One matched finding per leg, in leg order. */
  matched: Finding[]
}

/** Every rule whose legs are all satisfied. */
export function findThemes(sections: ReportSectionResult[]): Theme[] {
  const all = sections.flatMap((s) => s.findings)
  const themes: Theme[] = []

  for (const rule of RULES) {
    const matched: Finding[] = []
    for (const leg of rule.legs) {
      const hit = all.find((f) => leg.match(f))
      if (!hit) break
      matched.push(hit)
    }
    // Partial matches do not fire. A theme that rests on two of its three
    // premises is a different claim from the one written here, and there is no
    // honest way to print it as this one.
    if (matched.length === rule.legs.length) themes.push({ rule, matched })
  }
  return themes
}

function themeFinding(t: Theme): Finding {
  const { rule, matched } = t

  // The weakest premise decides. A conclusion cannot be better evidenced than
  // the least of the things it is built from.
  const confidenceScore = Math.min(...matched.map((f) => f.confidenceScore ?? 0.5))

  // The highest severity among the constituents, never higher. A theme does not
  // get to escalate: it says what findings mean together, and if they were all
  // low then their combination is a low-severity observation about a pattern.
  const order = ['info', 'low', 'medium', 'high', 'critical'] as const
  const severity = matched.reduce<Finding['severity']>(
    (worst, f) => (order.indexOf(f.severity) > order.indexOf(worst) ? f.severity : worst),
    'info')

  return {
    id: rule.id,
    category: CATEGORY,
    title: rule.title,
    summary: rule.theme,
    severity,
    confidence: confidenceScore >= 0.8 ? 'high' : confidenceScore >= 0.6 ? 'medium' : 'low',
    confidenceScore,
    type: rule.opportunity ? 'opportunity' : 'risk',
    status: 'open',
    impact: rule.implication,
    implication: rule.implication,
    opportunity: rule.opportunity,
    recommendation: rule.recommendation,
    rationale: 'Composed from findings that other sections measured. Nothing here was measured '
      + 'independently, and every constituent is named below so the theme can be taken apart.',
    // Traceability, which is the whole contract: each leg, the finding that
    // satisfied it, and where that finding came from.
    evidence: matched.map((f, i) => ({
      kind: 'static_analysis' as const,
      description: `${rule.legs[i]!.label} — ${f.category} / ${f.id}: ${f.title}`,
    })),
    // The theme carries no prompt of its own. The work belongs to the findings
    // it cites and their prompts are already on them; a second prompt here
    // would be a second description of the same change.
    claudeCodePrompts: [],
    limitations: [
      'This section measures nothing. It states what findings from other sections mean '
      + 'together, and is only as good as they are.',
    ],
  }
}

/**
 * The synthesis section.
 *
 * Returns `not_applicable` rather than an empty section when nothing composed:
 * a report whose findings do not combine is a normal outcome, and an empty
 * heading reads as a section that failed.
 */
export function synthesise(sections: ReportSectionResult[]): ReportSectionResult {
  const themes = findThemes(sections)

  if (themes.length === 0) {
    return {
      category: CATEGORY,
      status: 'not_applicable',
      score: null,
      summary: 'No theme was found that spans more than one section.',
      reason: 'Every relationship this looks for requires a specific set of findings to be '
        + 'present together, and none of those sets was complete in this report. That is a '
        + 'statement about these findings, not evidence that the sections are unrelated.',
      findings: [],
      limitations: [],
    }
  }

  const findings = themes.map(themeFinding)
  const sectionsInvolved = new Set(themes.flatMap((t) => t.matched.map((f) => f.category)))

  return {
    category: CATEGORY,
    status: 'completed',
    // Unscored on purpose. A theme is a reading of findings that are already
    // scored where they live; counting them again here would weigh the same
    // evidence twice in the overall figure.
    score: null,
    summary: `${themes.length} theme${themes.length === 1 ? '' : 's'} spanning `
      + `${sectionsInvolved.size} sections, composed from findings measured elsewhere.`,
    findings,
    limitations: [
      'Every theme is built from findings other sections measured. If one of those is wrong, '
      + 'the theme built on it is wrong in the same way.',
      'Themes fire only when every finding they require is present. A report missing one of '
      + 'them says nothing here, which is not the same as the relationship being absent.',
      'A theme is never more confident than the weakest finding it rests on, and never more '
      + 'severe than the worst.',
    ],
  }
}
