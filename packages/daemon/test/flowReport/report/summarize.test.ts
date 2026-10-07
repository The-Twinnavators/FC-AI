// The executive summary, and the number at the top of it.
//
// The overall score is the sentence most readers keep, so it has to be a
// function of the findings rather than a judgement typed into a template. Two
// properties matter more than the arithmetic:
//
//   - A section nobody could assess must not drag the score down. Scoring a
//     not-applicable marketplace as zero would punish a project for not being
//     a marketplace.
//   - The score must keep distinguishing. The first version subtracted a fixed
//     penalty per finding and hit the floor at nine, so a section with nine
//     problems and one with forty both read as 0.

import { describe, it, expect } from 'vitest'
import { sectionScore, summarizeRun, rescoreAfterDecisions } from '../../../src/flowReport/report/summarize.js'
import type {
  Finding, ReportSectionResult, ReportSummary, Severity,
} from '../../../src/flowReport/types.js'

const finding = (severity: Severity, over: Partial<Finding> = {}): Finding => ({
  id: `f-${Math.random().toString(36).slice(2, 8)}`,
  category: 'security_qa',
  title: `A ${severity} finding`,
  summary: 's', severity, confidence: 'high', status: 'open',
  impact: 'i', recommendation: 'r', rationale: 'ra',
  evidence: [], claudeCodePrompts: [],
  // A resolution closes a finding only when something has been said for it, so
  // a fixture that carries one carries a response too unless a test is
  // deliberately setting up the case where nothing was said.
  ...(over.resolution && !over.responses ? { responses: [saidSomething] } : {}),
  ...over,
})

const saidSomething = {
  id: 'resp-1',
  body: 'Replaced with timingSafeEqual in #412.',
  source: 'typed' as const,
  sourceName: null,
  createdAt: '2026-09-25T04:00:00.000Z',
  createdBy: null,
  editedAt: null,
  editedBy: null,
}

/** A finding closed the way the product closes one: a decision, and an account
 *  of the work. Either on its own leaves it open, which is the rule these
 *  fixtures exist to go through rather than around. */
const closed = (
  f: Finding, status: 'resolved' | 'not_applicable' = 'resolved',
): Finding => ({ ...f, status, resolution: because(status), responses: [saidSomething] })

/**
 * A resolution with a reason, which is what actually closes a finding.
 *
 * Setting `status` alone is not enough and must not be: a record with a blank
 * reason is an unfinished resolution, and `isClosedBy` is the one place that
 * decides. These fixtures go through the same door the product does.
 */
const because = (status: 'resolved' | 'not_applicable' | 'accepted_risk' = 'resolved') => ({
  status,
  reason: 'Replaced with timingSafeEqual in #412.',
  titleWhenResolved: 'A high finding',
  resolvedAt: '2026-09-25T04:00:00.000Z',
  resolvedBy: null,
  lastEditedAt: null,
  lastEditedBy: null,
})

const section = (over: Partial<ReportSectionResult> = {}): ReportSectionResult => ({
  category: 'security_qa', status: 'completed', score: 80,
  summary: '', findings: [], limitations: [], ...over,
})

// ── Resolving a finding ──────────────────────────────────────────────────────
//
// A person can mark a finding resolved, and the score moves. That is a claim
// about work done rather than a measurement, so the thing these tests guard is
// the distinction: the number changes, and what the scan measured is still on
// the record beside it. A version that simply overwrote the score would turn
// the report into a record of what was claimed.

describe('a finding somebody has marked resolved', () => {
  it('stops counting as damage', () => {
    const open = [finding('high'), finding('high')]
    const half = [finding('high'), finding('high', { status: 'resolved', resolution: because() })]
    expect(sectionScore(half)!).toBeGreaterThan(sectionScore(open)!)
  })

  it('leaves a section clean when every damaging finding is closed', () => {
    expect(sectionScore([finding('high', { status: 'resolved', resolution: because() })])).toBe(100)
  })

  // `not_applicable` is the same kind of decision — it says the finding does
  // not bear on this project — so it closes too.
  it('closes for not applicable as well as resolved', () => {
    expect(sectionScore([finding('critical', { status: 'not_applicable', resolution: because('not_applicable') })])).toBe(100)
  })

  // The reason is what makes a resolution one. A record with a blank reason is
  // a mis-click that outlives everyone's memory of it, and it must not be able
  // to move a score — which is why `isClosedBy` decides here and not only on
  // the page.
  // The rule used to read "the reason is not blank". It now reads "something
  // has been said", because a finding holds many responses rather than one
  // string. Same rule, and it still has to hold.
  it('does not close a finding with nothing said for it', () => {
    expect(sectionScore([finding('high', { status: 'resolved', resolution: because(), responses: [] })]))
      .toBe(sectionScore([finding('high')]))
  })

  // The one that must NOT: accepting a risk is a decision to live with it, not
  // a claim that it is gone. A score that rose because somebody acknowledged a
  // problem would be worth nothing.
  it('still counts a risk somebody merely accepted', () => {
    expect(sectionScore([finding('high', { status: 'accepted_risk', resolution: because('accepted_risk') })]))
      .toBe(sectionScore([finding('high')]))
  })

  // "Nothing here was scoreable" is a statement about the analysis. It must not
  // become a score because somebody ticked a box, nor stay null once a section
  // that WAS scoreable has been cleared.
  it('does not invent a score for a section that had none to give', () => {
    expect(sectionScore([])).toBeNull()
    expect(sectionScore([finding('info', { status: 'resolved', resolution: because() })])).toBeNull()
  })
})

describe('rescoring after a decision', () => {
  const summary = (over: Partial<ReportSummary> = {}): ReportSummary => ({
    overallScore: 40,
    scoreExplanation: 'As measured.',
    narrative: 'What the run found.',
    priorities: ['a'], quickWins: [], longerTerm: [],
    couldNotVerify: ['Nothing was executed.'],
    severityCounts: { critical: 0, high: 2, medium: 0, low: 0, info: 0 },
    filesScanned: 100, filesSkipped: 5,
    ...over,
  })

  const twoHighs = [section({
    category: 'security_qa',
    findings: [finding('high'), finding('high', { title: 'Another high finding' })],
  })]

  it('raises the section score when one is resolved', () => {
    // Against the score the run would have measured, not against the fixture's
    // stored number — a section with no decision in it is deliberately left
    // alone now, so comparing the two `rescoreAfterDecisions` calls would be
    // comparing a recomputed score with an untouched one.
    const measured = sectionScore(twoHighs[0]!.findings)!
    const { sections: out } = rescoreAfterDecisions(
      [{ ...twoHighs[0]!, score: measured, findings: [
        twoHighs[0]!.findings[0]!,
        closed(twoHighs[0]!.findings[1]!),
      ] }],
      summary(),
    )
    expect(out[0]!.score!).toBeGreaterThan(measured)
  })

  // The point of the whole thing: the measured figure survives.
  it('keeps the score the scan produced', () => {
    const { summary: s } = rescoreAfterDecisions(
      [{ ...twoHighs[0]!, findings: twoHighs[0]!.findings.map((f) => closed(f)) }],
      summary({ overallScore: 40 }),
    )
    expect(s!.resolved).toEqual({ count: 2, scoreAsMeasured: 40 })
  })

  // Through any number of later changes. Recomputing it from the previous
  // summary each time would let it drift to whatever the last click produced.
  it('keeps pointing at the original scan across repeated changes', () => {
    const both = [{ ...twoHighs[0]!, findings: twoHighs[0]!.findings.map((f) => closed(f)) }]
    const once = rescoreAfterDecisions(both, summary({ overallScore: 40 }))
    const twice = rescoreAfterDecisions(both, once.summary)
    expect(twice.summary!.resolved?.scoreAsMeasured).toBe(40)
  })

  it('says nothing at all when nothing has been marked', () => {
    expect(rescoreAfterDecisions(twoHighs, summary()).summary!.resolved).toBeUndefined()
  })

  // ── What a decision may not reach ──
  //
  // Seen on a real report: resolving one compliance finding recomputed every
  // section, gave scores to five that the run had deliberately left unscored,
  // and three of those then entered the overall average — so the headline
  // figure moved through sections that had nothing to do with the decision.

  it('leaves a section nobody decided anything in exactly as the run measured it', () => {
    const untouched = section({
      category: 'seo',
      // Deliberately disagreeing with what the curve would produce, so the test
      // fails if the number is recomputed rather than preserved.
      score: 12,
      findings: [finding('low', { category: 'seo' })],
    })
    const touched = section({
      category: 'security_qa',
      findings: [finding('high', { status: 'resolved', resolution: because() })],
    })
    const { sections: out } = rescoreAfterDecisions([untouched, touched], summary())
    expect(out.find((s) => s.category === 'seo')!.score).toBe(12)
  })

  // A person marking a finding resolved cannot turn "this was not scored" into
  // a score — and a section that is null is one the run chose not to score.
  it('does not give a score to a section the run left unscored', () => {
    const unscored = section({
      category: 'competitive_gaps',
      score: null,
      findings: [finding('high', { category: 'competitive_gaps', status: 'resolved', resolution: because() })],
    })
    const { sections: out } = rescoreAfterDecisions([unscored], summary())
    expect(out[0]!.score).toBeNull()
  })

  // The consequence the overall figure cares about: a section that was not
  // scored stays out of the average.
  it('does not let an unscored section into the overall average', () => {
    const base = [
      section({ category: 'security_qa', score: 80, findings: [finding('medium')] }),
      section({ category: 'error_log', score: 80, findings: [finding('medium', { category: 'error_log' })] }),
      section({ category: 'competitive_gaps', score: null, findings: [
        finding('high', { category: 'competitive_gaps', status: 'resolved', resolution: because() }),
      ] }),
    ]
    const { summary: after } = rescoreAfterDecisions(base, summary())
    // 80 and 80, both heavy, with the unscored one absent rather than 100.
    expect(after!.overallScore).toBe(80)
  })

  // The narrative and the explanation describe the run as analysed. A button
  // must not rewrite them — that is what `resolved` is printed beside them for.
  it('does not touch the prose written about the run', () => {
    const before = summary()
    const { summary: after } = rescoreAfterDecisions(twoHighs, before)
    expect(after!.narrative).toBe(before.narrative)
    expect(after!.scoreExplanation).toBe(before.scoreExplanation)
    expect(after!.couldNotVerify).toEqual(before.couldNotVerify)
    expect(after!.filesScanned).toBe(before.filesScanned)
  })

  // The row of counts at the top has to agree with the score beside it.
  it('counts only what is still open', () => {
    const { summary: after } = rescoreAfterDecisions(
      [{ ...twoHighs[0]!, findings: [
        twoHighs[0]!.findings[0]!,
        closed(twoHighs[0]!.findings[1]!),
      ] }],
      summary(),
    )
    expect(after!.severityCounts.high).toBe(1)
  })
})

describe('a section score that keeps distinguishing', () => {
  it('falls as findings accumulate', () => {
    const one = sectionScore([finding('high')])!
    const three = sectionScore([finding('high'), finding('high'), finding('high')])!
    expect(three).toBeLessThan(one)
  })

  // The bug this replaced: nine findings and forty both scored 0, so the
  // number stopped saying anything exactly where a reader most wants it to.
  it('still separates a bad section from a much worse one', () => {
    const nine = sectionScore(Array.from({ length: 9 }, () => finding('high')))!
    const forty = sectionScore(Array.from({ length: 40 }, () => finding('high')))!
    expect(nine).toBeGreaterThan(forty)
    expect(nine - forty).toBeGreaterThan(2)
  })

  it('weighs a critical finding more heavily than a low one', () => {
    expect(sectionScore([finding('critical')])!).toBeLessThan(sectionScore([finding('low')])!)
  })

  it('ignores informational findings, which are observations rather than faults', () => {
    expect(sectionScore([finding('info'), finding('info')])).toBeNull()
  })

  it('returns null for no findings, because that is not the same as perfect', () => {
    expect(sectionScore([])).toBeNull()
  })

  it('stays within range', () => {
    const many = Array.from({ length: 500 }, () => finding('critical'))
    const s = sectionScore(many)!
    expect(s).toBeGreaterThanOrEqual(0)
    expect(s).toBeLessThanOrEqual(100)
  })
})

describe('the overall score', () => {
  // Two ordinary sections, so this tests the average rather than the weighting.
  // Security, reliability and compliance count double, which the weighting test
  // below covers separately. Monetization cannot stand in for "ordinary" here:
  // it is excluded from this figure entirely, which the block at the end of
  // this file covers.
  it('averages the sections that produced one', () => {
    const s = summarizeRun([
      section({ category: 'seo', score: 90, findings: [finding('low')] }),
      section({ category: 'engineering_quality', score: 50, findings: [finding('high')] }),
    ], { filesScanned: 10, filesSkipped: 0, truncated: false, limitsHit: [] })
    expect(s.overallScore).toBe(70)
  })

  // Punishing a project for not being a marketplace is the clearest way to
  // make the number meaningless.
  it('excludes a not-applicable section rather than scoring it zero', () => {
    const s = summarizeRun([
      section({ category: 'seo', score: 90, findings: [finding('low')] }),
      section({ category: 'monetization', score: 90, findings: [finding('low')] }),
      section({ category: 'product_intel', score: 90, findings: [finding('low')] }),
      section({ category: 'marketplace_health', status: 'not_applicable', score: null }),
    ], { filesScanned: 10, filesSkipped: 0, truncated: false, limitsHit: [] })
    expect(s.overallScore).toBe(90)
  })

  it('excludes a failed section, which is an absence of evidence not a bad result', () => {
    const s = summarizeRun([
      section({ category: 'seo', score: 90, findings: [finding('low')] }),
      section({ category: 'product_intel', score: 90, findings: [finding('low')] }),
      section({ category: 'role_journeys', score: 90, findings: [finding('low')] }),
      section({ category: 'monetization', status: 'failed', score: null, reason: 'threw' }),
    ], { filesScanned: 10, filesSkipped: 0, truncated: false, limitsHit: [] })
    expect(s.overallScore).toBe(90)
  })

  // The guard that caught the fixtures above: an average of one or two
  // sections out of ten would read as a verdict on the whole repository.
  it('withholds a score when only a couple of sections were assessed', () => {
    const s = summarizeRun([
      section({ category: 'seo', score: 90, findings: [finding('low')] }),
      section({ category: 'monetization', status: 'not_applicable', score: null }),
      section({ category: 'compliance', status: 'failed', score: null }),
      section({ category: 'security_qa', status: 'failed', score: null }),
    ], { filesScanned: 10, filesSkipped: 0, truncated: false, limitsHit: [] })
    expect(s.overallScore).toBeNull()
  })

  it('weighs security and reliability above the rest', () => {
    const securityBad = summarizeRun([
      section({ category: 'security_qa', score: 20, findings: [finding('critical')] }),
      section({ category: 'seo', score: 90, findings: [finding('low')] }),
    ], { filesScanned: 10, filesSkipped: 0, truncated: false, limitsHit: [] })
    const seoBad = summarizeRun([
      section({ category: 'security_qa', score: 90, findings: [finding('low')] }),
      section({ category: 'seo', score: 20, findings: [finding('critical')] }),
    ], { filesScanned: 10, filesSkipped: 0, truncated: false, limitsHit: [] })
    expect(securityBad.overallScore!).toBeLessThan(seoBad.overallScore!)
  })

  it('refuses a score when too little was assessed to mean anything', () => {
    const s = summarizeRun([
      section({ category: 'seo', score: 90, findings: [finding('low')] }),
      section({ category: 'compliance', status: 'not_applicable', score: null }),
      section({ category: 'security_qa', status: 'failed', score: null }),
    ], { filesScanned: 10, filesSkipped: 0, truncated: false, limitsHit: [] })
    expect(s.overallScore).toBeNull()
    expect(s.scoreExplanation).toMatch(/not enough|insufficient/i)
  })

  it('always explains how the number was reached', () => {
    const s = summarizeRun([
      section({ category: 'seo', score: 90, findings: [finding('low')] }),
      section({ category: 'security_qa', score: 80, findings: [finding('medium')] }),
      section({ category: 'compliance', score: 70, findings: [finding('medium')] }),
    ], { filesScanned: 10, filesSkipped: 0, truncated: false, limitsHit: [] })
    expect(s.scoreExplanation).toBeTruthy()
    expect(s.scoreExplanation).toMatch(/section/i)
  })
})

describe('what the summary carries', () => {
  const run = () => summarizeRun([
    section({
      category: 'security_qa', score: 40,
      findings: [finding('critical', { title: 'Unauthenticated write' }), finding('low')],
    }),
    section({
      category: 'seo', score: 85,
      findings: [finding('medium', { title: 'No meta description' })],
    }),
    section({ category: 'marketplace_health', status: 'not_applicable', score: null }),
  ], { filesScanned: 120, filesSkipped: 8, truncated: false, limitsHit: [] })

  it('counts findings by severity', () => {
    expect(run().severityCounts.critical).toBe(1)
    expect(run().severityCounts.medium).toBe(1)
  })

  it('leads the priorities with the most severe finding', () => {
    expect(run().priorities[0]).toMatch(/Unauthenticated write/)
  })

  it('reports what was scanned and what was skipped', () => {
    expect(run().filesScanned).toBe(120)
    expect(run().filesSkipped).toBe(8)
  })

  // Always present, even when empty: a report with no "could not verify"
  // section reads as though everything was verified.
  it('always lists what could not be verified', () => {
    expect(Array.isArray(run().couldNotVerify)).toBe(true)
  })

  it('names a not-applicable section among the things it did not assess', () => {
    expect(run().couldNotVerify.join(' ')).toMatch(/marketplace/i)
  })

  it('says when the scan was truncated, because the whole report is then partial', () => {
    const s = summarizeRun([section({ score: 80, findings: [finding('low')] })], {
      filesScanned: 100, filesSkipped: 0, truncated: true,
      limitsHit: ['Stopped at the 100-file limit; the repository has more.'],
    })
    expect(s.couldNotVerify.join(' ')).toMatch(/truncat|limit/i)
    expect(s.narrative).toMatch(/part of|partial|truncat/i)
  })
})

// ── Monetization is not a health measure ─────────────────────────────────────
//
// The number at the top is "how sound is what has been built". Monetization
// reports opportunity — an audience nobody charges, a per-use cost nobody
// meters — and averaging that in pulls the figure down for a commercial
// decision rather than for anything wrong with the code.
describe('sections that do not count towards the overall figure', () => {
  const facts = { filesScanned: 100, filesSkipped: 0, truncated: false, limitsHit: [] }

  it('leaves monetization out of the average', () => {
    const without = summarizeRun([
      section({ category: 'security_qa', score: 90 }),
      section({ category: 'seo', score: 90 }),
      section({ category: 'engineering_quality', score: 90 }),
    ], facts)

    const withIt = summarizeRun([
      section({ category: 'security_qa', score: 90 }),
      section({ category: 'seo', score: 90 }),
      section({ category: 'engineering_quality', score: 90 }),
      // A score low enough that including it could not go unnoticed.
      section({ category: 'monetization', score: 10 }),
    ], facts)

    expect(withIt.overallScore).toBe(without.overallScore)
    expect(withIt.overallScore).toBe(90)
  })

  it('says so, rather than leaving the arithmetic unexplainable', () => {
    const s = summarizeRun([
      section({ category: 'security_qa', score: 90 }),
      section({ category: 'seo', score: 90 }),
      section({ category: 'monetization', score: 10 }),
    ], facts)
    expect(s.scoreExplanation).toMatch(/Monetization/)
    expect(s.scoreExplanation).toMatch(/opportunity rather than damage/)
  })

  // The "enough sections" threshold is a fraction of the sections that COULD
  // have contributed. Counting an excluded one in the denominator would make
  // the bar harder to clear for no reason.
  it('does not count an excluded section against the threshold', () => {
    const s = summarizeRun([
      section({ category: 'security_qa', score: 90 }),
      section({ category: 'seo', score: 90 }),
      section({ category: 'compliance', status: 'not_applicable', score: null }),
      section({ category: 'monetization', score: null }),
    ], facts)
    expect(s.overallScore).not.toBeNull()
    expect(s.scoreExplanation).toMatch(/out of 3 that count towards it/)
  })

  it('still reports monetization findings in the counts', () => {
    const s = summarizeRun([
      section({ category: 'security_qa', score: 90 }),
      section({
        category: 'monetization',
        score: null,
        findings: [finding('info', { category: 'monetization', title: 'An opportunity' })],
      }),
    ], facts)
    // Excluded from the score is not excluded from the report.
    expect(s.severityCounts.info).toBe(1)
  })
})

// The failure this section exists to prevent: a 488KB admin screen sat above
// the size ceiling for months, and the report said "1856 of 1857 files" —
// true, unhelpful, and impossible to act on. A count is not a limitation.
describe('what the scan did not read', () => {
  const base = { filesScanned: 100, filesSkipped: 0, truncated: false, limitsHit: [] }
  const verify = (skipped: unknown[]) =>
    summarizeRun([section()], { ...base, skipped: skipped as never }).couldNotVerify.join('\n')

  it('names a file left out for being too large, with the measurement', () => {
    const text = verify([{
      path: 'src/pages/admin/Screen.tsx', kind: 'too_large',
      reason: '488 KB is larger than the 586 KB per-file limit.',
    }])
    expect(text).toMatch(/src\/pages\/admin\/Screen\.tsx/)
    expect(text).toMatch(/488 KB/)
  })

  it('names a file left out as build output, with what was measured', () => {
    const text = verify([{
      path: 'assets/index-BzhBNS2H.js', kind: 'build_output',
      reason: 'build output: 3,117 characters per line on average, past the 1,000 mark.',
    }])
    expect(text).toMatch(/assets\/index-BzhBNS2H\.js/)
    expect(text).toMatch(/3,117 characters per line/)
  })

  // Eleven categorical lines would bury the one exclusion a reader should
  // check among ten they should not.
  it('counts the categorical exclusions rather than listing them', () => {
    const text = verify([
      { path: 'a.png', kind: 'binary', reason: 'binary or media file, not source.' },
      { path: 'b.png', kind: 'binary', reason: 'binary or media file, not source.' },
      { path: 'package-lock.json', kind: 'lockfile', reason: 'lockfile.' },
    ])
    expect(text).toMatch(/2 binary or media files/)
    expect(text).not.toMatch(/a\.png/)
  })

  // "1 lockfiles" in a report is the sort of thing that makes a reader trust
  // the rest of it less.
  it('agrees in number with the count in front of it', () => {
    const one = verify([{ path: 'package-lock.json', kind: 'lockfile', reason: 'lockfile.' }])
    expect(one).toMatch(/1 lockfile/)
    expect(one).not.toMatch(/1 lockfiles/)

    const two = verify([
      { path: 'package-lock.json', kind: 'lockfile', reason: 'lockfile.' },
      { path: 'yarn.lock', kind: 'lockfile', reason: 'lockfile.' },
    ])
    expect(two).toMatch(/2 lockfiles/)
  })

  it('says nothing extra when the scan excluded nothing', () => {
    const text = verify([])
    expect(text).not.toMatch(/Not read/)
    expect(text).not.toMatch(/Also not read/)
  })

  // A caller re-summarising one section passes no scan of its own.
  it('works when no scan detail was supplied at all', () => {
    expect(() => summarizeRun([section()], base)).not.toThrow()
  })
})

// ── A decision that reopens a finding ────────────────────────────────────────
//
// The case the old `touched` test could not see. A section scored while its
// findings were closed keeps that number; withdrawing the decisions leaves
// nothing closed, and the score has to come back down rather than stand.
describe('a section whose decisions were withdrawn', () => {
  it('recomputes when a finding carries a response but is not closed', () => {
    const answeredButOpen = finding('high', {
      responses: [saidSomething],
      // No resolution: written about, nothing settled.
    })
    const measured = sectionScore([finding('high')])!

    const { sections } = rescoreAfterDecisions(
      [section({ category: 'security_qa', score: 100, findings: [answeredButOpen] })],
      {
        overallScore: 100,
        scoreExplanation: 'As measured.',
        narrative: 'n',
        priorities: [], quickWins: [], longerTerm: [],
        couldNotVerify: [],
        severityCounts: { critical: 0, high: 1, medium: 0, low: 0, info: 0 },
        filesScanned: 10, filesSkipped: 0,
      },
    )

    expect(sections[0]!.score).toBe(measured)
    expect(sections[0]!.score).toBeLessThan(100)
  })
})
