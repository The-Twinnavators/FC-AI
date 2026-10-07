// daemon/src/flow-reports/analyzers/classify.ts
//
// What kind of thing each finding is, derived once for every analyser.
//
// ── Why derived rather than authored ─────────────────────────────────────────
//
// Eleven analysers produce findings and six of them share a shape while the
// rest build their own. Asking each to declare a type would mean eleven edits
// to find out whether the taxonomy was right, eleven places for it to drift,
// and a new analyser silently producing untyped findings the day somebody
// forgets. This runs at the single point every result passes through, so the
// classification is one decision applied uniformly.
//
// An analyser that knows better can still say so: anything already set here is
// left alone. Derivation is the default, not the rule.
//
// ── The classification is conservative on purpose ────────────────────────────
//
// `defect` is the strongest claim this taxonomy makes — something is wrong —
// and it is the one a reader will act on first. So it is reserved for findings
// that assert a present fault. Everything the analysers phrase as an absence
// becomes `gap`, which is the honest word: a capability is missing, and whether
// it should exist is a decision the report does not get to make.

import type {
  Confidence, Effort, Finding, FindingType, ReportSectionResult,
} from '../types.js'
import { bandOf, scoreOfBand } from '../types.js'

/**
 * Sections where revenue is the subject, for the dimensions only.
 *
 * Deliberately NOT used to decide the type. The first version classified
 * everything in these two as an opportunity and immediately mislabelled "35
 * money path(s) carry a placeholder marker" — a placeholder left in a payment
 * path is a defect, and calling it an opportunity turns a fault into a
 * proposal.
 *
 * Both sections carry both kinds. Monetization reports revenue proposals AND
 * payment plumbing that is broken; the marketing scan reports opportunities
 * AND a capability map that is pure observation. So the analysers that know
 * which is which now say so on the finding, and anything they do not mark
 * falls through to the ordinary rules below.
 */
const REVENUE_SECTIONS = new Set(['monetization', 'marketing_opportunity'])

/**
 * Sections that describe what is absent rather than what is broken.
 *
 * Competitive gaps is the clear case — its whole output is "products of this
 * kind commonly have X and this one does not", which is a gap by definition
 * and never a defect.
 */
const GAP_SECTIONS = new Set(['competitive_gaps'])

/** Phrasing the analysers use when they mean "this is not here". */
const ABSENCE = /\b(no|not|nothing|never|missing|absent|without)\b/i

export function classifyFinding(f: Finding): Finding {
  const type = f.type ?? deriveType(f)
  const confidenceScore = f.confidenceScore ?? scoreOfBand(f.confidence)

  return {
    ...f,
    type,
    confidenceScore,
    // The word is derived from the number wherever the number was derived from
    // the word, so a later change to one cannot leave the other behind.
    confidence: f.confidenceScore ? bandOf(f.confidenceScore) : f.confidence,
    effort: f.effort ?? deriveEffort(f, type),
    dimensions: f.dimensions ?? deriveDimensions(f, type),
  }
}

function deriveType(f: Finding): FindingType {
  if (GAP_SECTIONS.has(f.category)) return 'gap'

  // `requiresManualValidation` is set from `isAbsence` by the normaliser, which
  // makes it the most reliable absence signal available — it was decided by the
  // analyser that did the measuring rather than inferred from wording here.
  if (f.requiresManualValidation) return 'gap'

  if (f.severity === 'info') return 'observation'

  // A title phrased as an absence is a gap even in a section that mostly finds
  // faults: "No error boundary was found" is not a broken error boundary.
  if (ABSENCE.test(f.title)) return 'gap'

  // What is left asserts a present fault. High and above is a defect; below it
  // the finding is usually "this shape invites a problem" rather than "this is
  // broken", which is the difference between a defect and a risk.
  return f.severity === 'critical' || f.severity === 'high' ? 'defect' : 'risk'
}

/**
 * Rough cost to act, where the evidence supports a guess at all.
 *
 * From the shape of the evidence rather than from the subject: a finding that
 * names one file is usually one file's worth of work, and one that names
 * fifteen is a change across the codebase whatever it is about. A gap is
 * bumped up a band because building something absent costs more than correcting
 * something present.
 *
 * ── Nothing cited means nothing known ────────────────────────────────────────
 *
 * The first version read zero files as "medium", then bumped gaps a band, so
 * every clean absence came out `high`. That is not a cautious estimate, it is
 * an estimate made from no information and printed with the same confidence as
 * one made from fifteen files — and it reversed the plain meaning of findings
 * whose own recommendation began "this is the cheapest kind of work there is".
 * An absence cites few files precisely because the thing is absent, so the
 * count is not evidence about it either way.
 *
 * So: nothing cited, nothing said. The finding carries no effort, the report
 * says the cost was not established, and the analyser that knows better can
 * set `effort` itself — which several now do.
 */
function deriveEffort(f: Finding, type: FindingType): Effort | undefined {
  const files = new Set(f.evidence.map((e) => e.path).filter(Boolean)).size
  if (files === 0) return undefined
  const base: Effort = files <= 2 ? 'low' : files <= 8 ? 'medium' : 'high'
  if (type !== 'gap' && type !== 'opportunity') return base
  return base === 'low' ? 'medium' : 'high'
}

const SEVERITY_IMPACT: Record<string, number> = {
  critical: 10, high: 8, medium: 5, low: 3, info: 1,
}
const EFFORT_SCORE: Record<Effort, number> = { low: 2, medium: 5, high: 8 }

/**
 * The dimensions, from what is actually known.
 *
 * Only the ones the evidence supports are set. `securityImportance` is absent
 * outside the security section rather than zero, because zero is a rating and
 * absence is the truth — nobody assessed the security importance of an SEO
 * finding, and printing 0 would say somebody did and found none.
 */
function deriveDimensions(f: Finding, type: FindingType): Finding['dimensions'] {
  const effort = f.effort ?? deriveEffort(f, type)
  const d: NonNullable<Finding['dimensions']> = {
    impact: SEVERITY_IMPACT[f.severity] ?? 1,
  }

  // Absent rather than zero, for the same reason as `securityImportance`
  // below: nobody sized this, and 0 would say somebody did and found it free.
  if (effort) d.effort = EFFORT_SCORE[effort]

  if (f.category === 'security_qa' || f.category === 'compliance') {
    d.securityImportance = SEVERITY_IMPACT[f.severity] ?? 1
  }
  if (REVENUE_SECTIONS.has(f.category)) {
    // Relevance, not size. That this finding is about revenue at all is
    // established; how much revenue is not, and a repository cannot say.
    d.revenueRelevance = type === 'opportunity' ? 6 : 3
  }
  return d
}

/** Every finding in a section, classified. */
export function classifySection(s: ReportSectionResult): ReportSectionResult {
  return { ...s, findings: s.findings.map(classifyFinding) }
}

export type { Confidence }
