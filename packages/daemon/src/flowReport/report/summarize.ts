// daemon/src/flow-reports/report/summarize.ts
//
// The executive summary, and the number at the top of it.
//
// ── The score has to keep distinguishing ─────────────────────────────────────
//
// The first version subtracted a fixed penalty per finding from 100 and
// clamped at zero. Run against a real repository it hit the floor at nine
// findings, so a section with nine problems and one with forty both read as 0 —
// the number stopped saying anything exactly where a reader most wants it to.
//
// This uses a hyperbolic decay instead: the score falls steeply over the first
// few findings and more gently after, and never quite reaches zero. It is still
// explainable in one sentence, which the brief requires, and a section with
// twenty problems still ranks below one with nine.
//
// ── Absence must not be scored as failure ────────────────────────────────────
//
// A section that is not applicable, or that failed, contributes nothing to the
// overall score. Averaging a null as zero would punish a project for not being
// a marketplace, or for an analyser throwing — neither of which is a fact about
// the code. And when too few sections produced a score, the overall number is
// withheld entirely rather than computed from two of ten.

import {
  CATEGORY_LABEL, isClosedBy,
  type Finding, type ReportSectionResult, type ReportSummary, type Severity,
} from '../types.js'
import type { SkippedEntry } from '../scanner/scan.js'
import type { SkipKind } from '../scanner/ignorePolicy.js'

/** What each severity contributes to a section's damage. */
const WEIGHT: Record<Severity, number> = {
  critical: 30, high: 16, medium: 6, low: 2, info: 0,
}

/**
 * How fast the score falls.
 *
 * `score = 100 · k / (k + damage)`. At k = 55 a single high finding lands near
 * 77, a critical near 65, nine highs near 28 and forty highs near 8 — still
 * ordered, still bounded, and never flat.
 */
const DECAY = 55

/** Sections whose problems matter more to the overall number. */
const HEAVY = new Set(['security_qa', 'error_log', 'compliance'])
const HEAVY_WEIGHT = 2

/**
 * Sections that never count towards the overall figure.
 *
 * The number at the top of the report is a health score — how sound is what has
 * been built. Two sections do not answer that, and both report opportunity
 * instead: Monetization on an audience nobody charges and a per-use cost nobody
 * meters, Marketing opportunity on ways to reach people the product has not
 * built. A product that has built one revenue stream and not a second, or that
 * has no referral programme, is not damaged — and averaging either judgement
 * into the health figure pulls it down for a commercial decision rather than for
 * anything wrong with the code.
 *
 * Enforced here rather than left to the section returning null, because that is
 * a property of one analyser today and this is the decision. A future change
 * that gives the section a score should not silently put it back in the average.
 */
const NOT_IN_OVERALL = new Set(['monetization', 'marketing_opportunity'])

/**
 * A section's score, or null when there is nothing to score.
 *
 * Informational findings do not count as damage — they are observations, and a
 * section holding only observations has not established anything to score.
 */
export function sectionScore(findings: Finding[]): number | null {
  // Null means "nothing here was scoreable", which is a statement about the
  // analysis and must not change because somebody ticked a box. So it is
  // decided before any decision is applied.
  const scorable = findings.filter((f) => f.severity !== 'info')
  if (scorable.length === 0) return null

  // A finding closed by a resolution stops counting as damage. `isClosedBy`
  // decides, so the rule that a blank reason closes nothing is applied here as
  // well as on the page — a record with no reason must not be able to move a
  // score quietly. `accepted_risk` deliberately still counts: accepting a risk
  // is a decision to live with it, not a claim that it is gone.
  //
  // With everything closed the damage is zero and the curve returns 100 on its
  // own — no special case, and a section that was assessed and then cleared
  // reads as clean rather than reverting to "insufficient evidence".
  const live = scorable.filter((f) => !isClosedBy(f.resolution, f.responses?.length ?? 0))
  const damage = live.reduce((n, f) => n + WEIGHT[f.severity], 0)
  return Math.max(0, Math.min(100, Math.round((100 * DECAY) / (DECAY + damage))))
}

export interface RunFacts {
  filesScanned: number
  filesSkipped: number
  truncated: boolean
  limitsHit: string[]
  /** Every exclusion the scan made, so the report can say what it did not read
   *  rather than only how many. Optional: a caller summarising a single
   *  re-analysed section has no scan of its own to report. */
  skipped?: SkippedEntry[]
}

/**
 * The exclusions a reader might disagree with, named; the rest, counted.
 *
 * ── Why not simply list all of them ──────────────────────────────────────────
 *
 * Most exclusions are categorical and uninteresting: a PNG is not source, a
 * lockfile is generated, `.env` is never opened on purpose. Printing eleven
 * such lines buries the one that matters among ten that do not, and a
 * limitations section nobody finishes reading is the same as no limitations
 * section.
 *
 * Two kinds are different. `too_large` is a threshold, and `build_output` is a
 * judgement about a file's shape — either can be wrong about a particular file,
 * and only the person who wrote the repository can tell. Those are named with
 * the measurement that produced them, so the decision can be checked.
 *
 * This is the failure that prompted it: a 488KB admin screen sat above the
 * size ceiling for months and the report said "1856 of 1857 files", which is
 * true, unhelpful, and impossible to act on.
 */
function describeExclusions(skipped: SkippedEntry[]): string[] {
  if (skipped.length === 0) return []

  const NAMED: SkipKind[] = ['too_large', 'build_output']
  // Both forms, because the count in front of them is often 1 and "1 lockfiles"
  // in a report is the sort of thing that makes a reader trust the rest of it
  // less.
  const LABEL: Partial<Record<SkipKind, [one: string, many: string]>> = {
    directory: ['file in an excluded directory', 'files in excluded directories'],
    environment: ['environment file, never opened', 'environment files, never opened'],
    lockfile: ['lockfile', 'lockfiles'],
    minified: ['minified file, recognised by its name', 'minified files, recognised by their names'],
    binary: ['binary or media file', 'binary or media files'],
    tests: ['test file, by the analysis settings', 'test files, by the analysis settings'],
    docs: ['documentation file, by the analysis settings', 'documentation files, by the analysis settings'],
    ignore_rule: ['file matching an ignore rule', 'files matching an ignore rule'],
  }

  const out: string[] = []
  for (const entry of skipped.filter((s) => s.kind && NAMED.includes(s.kind))) {
    out.push(`Not read — ${entry.path}: ${entry.reason} Check this one: if it is source, `
      + 'every absence reported below was measured without it.')
  }

  const FALLBACK: [string, string] = ['file excluded for another reason', 'files excluded for other reasons']
  const counts = new Map<SkipKind | 'other', number>()
  for (const s of skipped) {
    if (s.kind && NAMED.includes(s.kind)) continue
    const key = s.kind && LABEL[s.kind] ? s.kind : 'other'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  if (counts.size > 0) {
    const parts = [...counts]
      .sort((a, b) => b[1] - a[1])
      .map(([kind, n]) => {
        const pair = kind === 'other' ? FALLBACK : LABEL[kind]!
        return `${n} ${n === 1 ? pair[0] : pair[1]}`
      })
    out.push(`Also not read, for reasons that need no checking: ${parts.join('; ')}.`)
  }
  return out
}

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info']

export function summarizeRun(
  sections: ReportSectionResult[],
  facts: RunFacts,
): ReportSummary {
  const allFindings = sections.flatMap((s) => s.findings)

  const severityCounts = SEVERITY_ORDER.reduce((acc, s) => {
    acc[s] = allFindings.filter((f) => f.severity === s).length
    return acc
  }, {} as Record<Severity, number>)

  // Only sections that actually produced a score AND belong in a health
  // figure, weighted.
  const eligible = sections.filter((s) => !NOT_IN_OVERALL.has(s.category))
  const scored = eligible.filter((s) => typeof s.score === 'number')
  const totalWeight = scored.reduce(
    (n, s) => n + (HEAVY.has(s.category) ? HEAVY_WEIGHT : 1), 0)

  // Two of fifteen sections is not a view of a repository. Below a third, the
  // number would be an average of whatever happened to work. Counted against
  // the sections that could have contributed, so excluding one does not make
  // the threshold harder to clear.
  const enough = scored.length >= Math.max(2, Math.ceil(eligible.length / 3))

  const overallScore = enough && totalWeight > 0
    ? Math.round(scored.reduce(
      (n, s) => n + s.score! * (HEAVY.has(s.category) ? HEAVY_WEIGHT : 1), 0) / totalWeight)
    : null

  // Named, not just subtracted. A reader who counts the sections and cannot
  // make the arithmetic work has lost confidence in the number.
  const excluded = sections
    .filter((s) => NOT_IN_OVERALL.has(s.category))
    .map((s) => CATEGORY_LABEL[s.category])

  const excludedNote = excluded.length > 0
    ? ` ${excluded.join(' and ')} ${excluded.length === 1 ? 'is' : 'are'} left out of this `
      + 'figure entirely: what that section reports is opportunity rather than damage, and not '
      + 'having built a second way to earn is not a fault in what has been built.'
    : ''

  const scoreExplanation = overallScore === null
    ? `Not enough sections produced a score to give an overall number. `
      + `${scored.length} of ${eligible.length} were scored; the rest were not applicable, `
      + 'failed, or found nothing to assess. An average of those few would read as a verdict '
      + `on the whole repository.${excludedNote}`
    : `A weighted average of the ${scored.length} section${scored.length === 1 ? '' : 's'} that `
      + `produced a score, out of ${eligible.length} that count towards it. Security, `
      + `reliability and compliance count double. Each section's own score falls steeply over `
      + 'its first few findings and more gently after, so a section with many problems still '
      + 'ranks below one with a few. Sections that were not applicable or could not be assessed '
      + `are left out rather than counted as zero.${excludedNote}`

  const ranked = [...allFindings].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))

  const priorities = ranked
    .filter((f) => f.severity === 'critical' || f.severity === 'high')
    .slice(0, 5)
    .map((f) => `${CATEGORY_LABEL[f.category]}: ${f.title}`)

  // A quick win is small and specific: something already actionable, with a
  // prompt attached, that is not a structural change.
  const quickWins = ranked
    .filter((f) => (f.severity === 'medium' || f.severity === 'low')
      && f.claudeCodePrompts.length > 0)
    .slice(0, 5)
    .map((f) => `${CATEGORY_LABEL[f.category]}: ${f.title}`)

  const longerTerm = ranked
    .filter((f) => f.requiresManualValidation && f.severity !== 'info')
    .slice(0, 5)
    .map((f) => `${CATEGORY_LABEL[f.category]}: ${f.title}`)

  // Always populated, even when short. A report with no "could not verify"
  // section reads as though everything was verified.
  const couldNotVerify: string[] = []
  for (const s of sections) {
    if (s.status === 'not_applicable') {
      couldNotVerify.push(`${CATEGORY_LABEL[s.category]} was not applicable: ${s.reason ?? 'no reason recorded'}`)
    } else if (s.status === 'failed') {
      couldNotVerify.push(`${CATEGORY_LABEL[s.category]} failed and was not assessed: ${s.reason ?? 'no reason recorded'}`)
    } else if (s.status === 'skipped') {
      couldNotVerify.push(`${CATEGORY_LABEL[s.category]} was skipped: ${s.reason ?? 'no reason recorded'}`)
    }
    for (const l of s.limitations) couldNotVerify.push(`${CATEGORY_LABEL[s.category]}: ${l}`)
  }
  if (facts.truncated) {
    couldNotVerify.push(
      'The file scan was truncated, so the whole report describes part of the repository. '
      + facts.limitsHit.join(' '))
  }
  // After the sections and before the closing statement: what was not read is
  // a limitation of the whole report rather than of any one analyser.
  for (const line of describeExclusions(facts.skipped ?? [])) couldNotVerify.push(line)
  couldNotVerify.push(
    'Everything here is read from files. Nothing was executed, no request was made to any '
    + 'host, and nothing about the running product was observed.')

  const worst = ranked[0]
  // Grouped. Four digits without a separator ("1859 files") reads as an
  // identifier rather than a count on first glance.
  const n = (v: number) => v.toLocaleString('en-GB')
  const narrative = [
    facts.truncated
      ? `This report covers part of the repository: ${n(facts.filesScanned)} files were read `
        + 'before a scan limit stopped it, so absences below may simply be files nobody looked at.'
      : `${n(facts.filesScanned)} files were read and ${n(facts.filesSkipped)} skipped.`,
    allFindings.length === 0
      ? 'No findings were produced. That is a statement about these analysers and these files, '
        + 'not a clean bill of health.'
      : `${allFindings.length} findings across ${sections.filter((s) => s.findings.length > 0).length} `
        + `of ${sections.length} sections`
        + (worst ? `, the most severe being ${worst.severity}: ${worst.title}.` : '.'),
    overallScore === null
      ? 'No overall score is given, because too little was assessed to support one.'
      : `The overall score is ${overallScore} out of 100.`,
  ].join(' ')

  return {
    overallScore,
    scoreExplanation,
    narrative,
    priorities,
    quickWins,
    longerTerm,
    couldNotVerify,
    severityCounts,
    filesScanned: facts.filesScanned,
    filesSkipped: facts.filesSkipped,
  }
}

/**
 * Section scores after a decision, leaving alone everything a decision did not
 * touch.
 *
 * ── Only what it touched ─────────────────────────────────────────────────────
 *
 * The first version recomputed every section and wrote all of them back, which
 * quietly rewrote numbers nobody had touched. Two ways it went wrong, both seen
 * on a real report:
 *
 *   - Five sections the run had deliberately left unscored — shown as "—" —
 *     acquired scores, and three of those then entered the overall average.
 *     Resolving one compliance finding moved the headline figure through
 *     sections that had nothing to do with it.
 *   - A section nobody decided anything in is not a place a recomputation
 *     belongs at all. Its number is what the run measured, and only a new run
 *     may change it.
 *
 * So a section is recomputed when it holds a decision, and a stored null stays
 * null: marking a finding resolved cannot turn "this was not scored" into a
 * score.
 */
export function rescoreSections(sections: ReportSectionResult[]): ReportSectionResult[] {
  return sections.map((s) => {
    // Any decision or account on this section, not just one that closes
    // something.
    //
    // This used to ask whether anything was closed, and that was wrong in one
    // direction it could not see. A section scored while its findings were
    // closed carries that higher number; withdrawing those decisions leaves
    // nothing closed, so the old test said "untouched" and the stale score
    // stood — a section reading 100 with two unresolved findings under it. The
    // next decision then made it recompute and the score fell, which looks like
    // a penalty for resolving something.
    //
    // Recomputing whenever a section has been decided on at all is stable in
    // both directions: with nothing closed the formula returns what the scan
    // would have measured anyway.
    const touched = s.findings.some((f) =>
      f.resolution || (f.responses?.length ?? 0) > 0)
    if (!touched || s.score === null) return s
    return { ...s, score: sectionScore(s.findings) }
  })
}

/**
 * The numbers again, after somebody marked something resolved.
 *
 * ── Derived on read, never written down ─────────────────────────────────────
 *
 * This is applied when a run is loaded and its result is not stored. The score
 * in the database goes on being the one the run measured, for the same reason
 * the findings blob goes on saying what the run found: a decision is a
 * different kind of fact, and folding it into the measurement means the
 * measurement is gone.
 *
 * It also makes undo work. An earlier version wrote the adjusted scores back,
 * and withdrawing a decision then left the section holding the number the
 * decision had produced — there was nothing left to recompute it from.
 *
 * ── Why this is not just `summarizeRun` a second time ────────────────────────
 *
 * `summarizeRun` needs the facts of the scan — how many files it read, what it
 * could not read, whether it was truncated — and those belong to the run and
 * are not all kept on the summary. Calling it again with invented facts would
 * quietly rewrite the "what could not be verified" list, which is the part of
 * the report that must never move because of a button.
 *
 * So this recomputes the figures a decision can legitimately change, and copies
 * everything else across untouched. `narrative` and `scoreExplanation` describe
 * the run as analysed and are left exactly as they were written; what the
 * decisions did is carried separately, in `resolved`, so the two can be told
 * apart on the page.
 *
 * `scoreAsMeasured` is preserved from the previous summary rather than
 * recomputed, so it keeps pointing at the original scan through any number of
 * later changes.
 */
export function rescoreAfterDecisions(
  sections: ReportSectionResult[],
  previous: ReportSummary | null,
): { sections: ReportSectionResult[]; summary: ReportSummary | null } {
  const rescored = rescoreSections(sections)
  if (!previous) return { sections: rescored, summary: null }
  const all = rescored.flatMap((s) => s.findings)
  const closed = all.filter((f) => isClosedBy(f.resolution, f.responses?.length ?? 0))

  // Counted over what is still open, so the row of numbers at the top agrees
  // with the score beside it.
  const live = all.filter((f) => !isClosedBy(f.resolution, f.responses?.length ?? 0))
  const severityCounts = SEVERITY_ORDER.reduce((acc, s) => {
    acc[s] = live.filter((f) => f.severity === s).length
    return acc
  }, {} as Record<Severity, number>)

  const eligible = rescored.filter((s) => !NOT_IN_OVERALL.has(s.category))
  const scored = eligible.filter((s) => typeof s.score === 'number')
  const totalWeight = scored.reduce(
    (n, s) => n + (HEAVY.has(s.category) ? HEAVY_WEIGHT : 1), 0)
  const enough = scored.length >= Math.max(2, Math.ceil(eligible.length / 3))

  const overallScore = enough && totalWeight > 0
    ? Math.round(scored.reduce(
      (n, s) => n + s.score! * (HEAVY.has(s.category) ? HEAVY_WEIGHT : 1), 0) / totalWeight)
    : null

  return {
    sections: rescored,
    summary: {
      ...previous,
      overallScore,
      severityCounts,
      resolved: closed.length === 0
        ? undefined
        : {
          count: closed.length,
          scoreAsMeasured: previous.resolved?.scoreAsMeasured ?? previous.overallScore,
        },
    },
  }
}
