// daemon/src/flow-reports/analyzers/normalize.ts
//
// Mapping the existing analysers onto the Flow Reports model.
//
// ── The risk in a layer like this is quiet invention ─────────────────────────
//
// Every required field on the target model tempts a mapper to fill it with
// something plausible when the source had nothing. That is how a report grows
// claims nobody made. So the rules here are subtractive:
//
//   - Nothing gains a severity the source could not express. The Poschi
//     analysers have no `critical` band, so nothing arriving through
//     `normalizeCommonFinding` may acquire one; only the security analyser,
//     which does have the band, can produce it.
//   - A finding with no prompt keeps no prompt. Those analysers already decided
//     where a coding prompt is the wrong response — rotating a credential,
//     reading a policy, asking a lawyer — and manufacturing one here would
//     override a judgement made with more context than this has.
//   - An absence stays labelled. `isAbsence` marks the findings a stale
//     checkout invalidates, and the label travels so a reader can discount them
//     as a group rather than one at a time.
//
// ── Absolute paths are dropped, not rewritten ────────────────────────────────
//
// Evidence paths must be repository-relative. An absolute one is a privacy leak
// and is useless on another machine, and guessing the relative form from it
// would be guessing. It is dropped and the rest of the finding stands.

import { findingKey } from '../types.js'
import type {
  Confidence, Effort, Evidence, Finding, ReportCategory, Severity,
} from '../types.js'

/** The shape seven of the eight analysers share. The extra fields each module
 *  carries — `audience`, `side`, `role` — are read off the index signature
 *  where present rather than being modelled here. */
export interface PoschiCommonFinding {
  id: string
  area: string
  title: string
  severity: 'high' | 'medium' | 'low' | 'info'
  confidence: 'verified' | 'indicated' | 'hypothesis'
  detail: string
  files: string[]
  because: string
  next: string
  isAbsence: boolean
  prompt?: string | null
  [extra: string]: unknown
}

/** The security analyser's richer shape. */
export interface PoschiSecurityFinding {
  id: string
  title: string
  category: string
  severity: Severity
  confidence: 'verified' | 'indicated' | 'hypothesis'
  cwe: string | null
  asvs: string | null
  components: string[]
  preconditions: string
  impact: string
  evidence: string[]
  whyItMatters: string
  remediation: string
  verification: string
  mitigating: string | null
  prompt: string | null
  resolution: string | null
  needsApproval: boolean
}

const CONFIDENCE: Record<string, Confidence> = {
  verified: 'high',
  indicated: 'medium',
  hypothesis: 'low',
}

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info']
const CONFIDENCE_ORDER: Confidence[] = ['high', 'medium', 'low']

/** A path is usable as evidence only if it is relative. Windows drive letters
 *  and POSIX roots are both rejected. */
const isRelative = (p: string): boolean => !/^[A-Za-z]:[\\/]|^[\\/]/.test(p)

function promptsFrom(
  prompt: string | null | undefined,
  title: string,
  next: string,
  files: string[],
) {
  if (!prompt || !prompt.trim()) return []

  // A prompt somebody has to fill in before running is a prompt that does not
  // get run. Where the finding cites files and the prompt does not name them,
  // they are appended — so what the report hands over is executable against
  // this repository rather than a template about repositories.
  const paths = files.filter(isRelative)
  const namesThem = paths.some((p) => prompt.includes(p))
  const body = paths.length > 0 && !namesThem
    ? [
      prompt.trimEnd(),
      '',
      'Files this was measured in:',
      ...paths.slice(0, 12).map((p) => `- ${p}`),
    ].join('\n')
    : prompt

  return [{
    title: `Implement: ${title}`,
    prompt: body,
    // Taken from the finding's own next step rather than composed, so the
    // stated outcome is the one the analyser meant.
    intendedOutcome: next,
    affectedPaths: files.filter(isRelative),
  }]
}

export function normalizeCommonFinding(
  f: PoschiCommonFinding,
  category: ReportCategory,
): Finding {
  const files = f.files.filter(isRelative)
  const evidence: Evidence[] = files.map((path) => ({
    kind: 'file',
    path,
    description: f.detail,
  }))

  // An absence has nothing to point at, so it gets one entry describing what
  // was looked for. An empty evidence array would read as "no evidence was
  // gathered" rather than "the evidence is that nothing is there".
  if (evidence.length === 0) {
    evidence.push({
      kind: 'static_analysis',
      description: f.isAbsence
        ? `Nothing matching this was found in the files that were read. ${f.detail}`
        : f.detail,
    })
  }

  return {
    id: f.id,
    category,
    title: f.title,
    summary: f.detail,
    severity: f.severity,
    confidence: CONFIDENCE[f.confidence] ?? 'low',
    status: 'open',
    impact: f.detail,
    recommendation: f.next,
    rationale: f.because,
    evidence,
    claudeCodePrompts: promptsFrom(f.prompt, f.title, f.next, files),
    // An absence is precisely what a stale checkout invalidates.
    requiresManualValidation: f.isAbsence,
    // Read off the extras, like `side` and `role`. Only the analyser that did
    // the measuring can say what a finding costs to act on: from here, "built
    // but unreachable" and "not built at all" cite the same kind of file list
    // and look identical. An analyser that says nothing gets nothing — the
    // classifier will decide, or decline to.
    ...(effortOf(f.effort) ? { effort: effortOf(f.effort) } : {}),
  }
}

const EFFORTS = new Set(['low', 'medium', 'high'])
const effortOf = (v: unknown): Effort | undefined =>
  typeof v === 'string' && EFFORTS.has(v) ? v as Effort : undefined

export function normalizeSecurityFinding(f: PoschiSecurityFinding): Finding {
  const paths = f.components.filter(isRelative)
  const evidence: Evidence[] = [
    ...paths.map((path): Evidence => ({ kind: 'file', path, description: f.preconditions })),
    ...f.evidence.map((description): Evidence => ({ kind: 'static_analysis', description })),
  ]

  // The mitigating fact belongs where the reader meets the severity, not in a
  // footnote. Folded into the rationale so it cannot be dropped by a renderer
  // that only shows some fields.
  const rationale = f.mitigating
    ? `${f.whyItMatters}\n\nWhat argues the severity down: ${f.mitigating}`
    : f.whyItMatters

  const limitations: string[] = []
  if (f.resolution) limitations.push(f.resolution)
  if (f.cwe) limitations.push(`Mapped to ${f.cwe}.`)
  if (f.asvs) limitations.push(`OWASP ASVS 5.0 ${f.asvs}.`)

  return {
    id: f.id,
    category: 'security_qa',
    title: f.title,
    summary: f.impact,
    severity: f.severity,
    confidence: CONFIDENCE[f.confidence] ?? 'low',
    status: 'open',
    impact: f.impact,
    recommendation: f.remediation,
    rationale,
    evidence,
    claudeCodePrompts: promptsFrom(f.prompt, f.title, f.verification, paths),
    limitations: limitations.length > 0 ? limitations : undefined,
    // A change needing an owner's approval is not something to present as
    // ready to apply.
    requiresManualValidation: f.needsApproval || Boolean(f.resolution),
  }
}

/**
 * Order and de-duplicate a set of findings.
 *
 * Two analysers can reach the same conclusion from different evidence — a
 * missing privacy policy is both a compliance finding and an SEO one — so the
 * key is category AND title. The same title in two categories stays as two
 * findings, because they are two different claims about the project.
 *
 * When a duplicate is collapsed, the stronger finding wins and the weaker
 * one's evidence is merged in rather than discarded: the second sighting is
 * usually the more specific one.
 */
export function collate(findings: Finding[]): Finding[] {
  const rank = (f: Finding): number =>
    SEVERITY_ORDER.indexOf(f.severity) * 10 + CONFIDENCE_ORDER.indexOf(f.confidence)

  const byKey = new Map<string, Finding>()
  for (const f of findings) {
    // Through `findingKey`, because the same pair is what a person's resolve
    // decision is hung on. If the two spellings drifted, resolving a finding
    // would silently stop matching the finding it was resolved against.
    const key = `${f.category}::${findingKey(f)}`
    const existing = byKey.get(key)
    if (!existing) { byKey.set(key, f); continue }

    const [keep, drop] = rank(f) < rank(existing) ? [f, existing] : [existing, f]
    const seen = new Set(keep.evidence.map((e) => `${e.kind}:${e.path ?? ''}:${e.description}`))
    const merged = [...keep.evidence]
    for (const e of drop.evidence) {
      const id = `${e.kind}:${e.path ?? ''}:${e.description}`
      if (!seen.has(id)) { seen.add(id); merged.push(e) }
    }
    byKey.set(key, { ...keep, evidence: merged })
  }

  return [...byKey.values()].sort((a, b) => rank(a) - rank(b))
}
