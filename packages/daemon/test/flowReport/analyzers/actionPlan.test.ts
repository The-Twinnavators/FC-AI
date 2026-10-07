// The findings, as work.
//
// The bucketing rules will change; a later reader may decide 0.6 was the wrong
// line or that impact 6 was too generous. What must not change is that the plan
// is a view of the report rather than an addition to it: every action traces to
// a finding, nothing is invented, thin evidence is not scheduled as work, and
// the plan does not make the report read worse than it is.

import { describe, it, expect } from 'vitest'
import { buildActionPlan, planFrom } from '../../../src/flowReport/analyzers/actionPlan.js'
import { summarizeRun } from '../../../src/flowReport/report/summarize.js'
import type { Finding, ReportCategory, ReportSectionResult, Severity } from '../../../src/flowReport/types.js'

const finding = (
  category: string, id: string, over: Partial<Finding> = {},
): Finding => ({
  id,
  category: category as ReportCategory,
  title: `${id} title`,
  summary: 's',
  severity: 'medium',
  confidence: 'medium',
  confidenceScore: 0.7,
  status: 'open',
  impact: 'i',
  recommendation: `do the thing for ${id}`,
  rationale: 'ra',
  evidence: [],
  claudeCodePrompts: [],
  ...over,
})

const section = (category: string, findings: Finding[]): ReportSectionResult => ({
  category: category as ReportCategory,
  status: 'completed',
  score: null,
  summary: '',
  findings,
  limitations: [],
})

describe('an action is a finding, placed', () => {
  it('carries the finding\'s own recommendation rather than a new instruction', () => {
    const [action] = planFrom([section('seo', [
      finding('seo', 'A', { recommendation: 'Add a canonical tag to the share page.' }),
    ])])
    expect(action!.objective).toBe('Add a canonical tag to the share page.')
    expect(action!.from[0]!.id).toBe('A')
  })

  it('leaves out observations, which ask for nothing', () => {
    const actions = planFrom([section('seo', [
      finding('seo', 'A', { type: 'observation' }),
      finding('seo', 'B', { severity: 'info' as Severity }),
    ])])
    expect(actions).toEqual([])
  })

  it('never plans its own plan', () => {
    const first = buildActionPlan([section('seo', [finding('seo', 'A')])])
    // Feeding the finished plan back in must produce the same plan, not a plan
    // about it. A section that compounds on re-entry grows every time it runs.
    const again = buildActionPlan([section('seo', [finding('seo', 'A')]), first])
    expect(again.summary).toBe(first.summary)
  })
})

describe('what goes where', () => {
  const horizonOf = (over: Partial<Finding>) =>
    planFrom([section('seo', [finding('seo', 'A', over)])])[0]!.horizon

  it('puts cheap and valuable work first', () => {
    expect(horizonOf({ effort: 'low', dimensions: { impact: 8 } })).toBe('immediate')
  })

  it('puts large work in strategic', () => {
    expect(horizonOf({ effort: 'high', dimensions: { impact: 8 } })).toBe('strategic')
  })

  it('puts the rest in short-term', () => {
    expect(horizonOf({ effort: 'medium', dimensions: { impact: 5 } })).toBe('short_term')
  })

  // The one that matters. A hypothesis sitting in "immediate" beside a measured
  // defect is how a plan loses the difference between the two.
  it('does not schedule a finding it is not sure of, however valuable', () => {
    expect(horizonOf({ effort: 'low', dimensions: { impact: 10 }, confidenceScore: 0.45 }))
      .toBe('exploratory')
  })

  it('does not schedule an opportunity the repository cannot settle', () => {
    expect(horizonOf({
      type: 'opportunity', requiresManualValidation: true, effort: 'low',
      dimensions: { impact: 9 },
    })).toBe('exploratory')
  })

  it('says which numbers put it there, so the placement can be argued with', () => {
    const [a] = planFrom([section('seo', [
      finding('seo', 'A', { effort: 'low', dimensions: { impact: 8 } }),
    ])])
    expect(a!.because).toMatch(/impact 8/)
  })
})

describe('order between actions', () => {
  it('puts a change behind the measurement of the thing it changes', () => {
    const actions = planFrom([section('marketing_opportunity', [
      finding('marketing_opportunity', 'MKT-001', { title: 'Sharing a link records no event' }),
      finding('marketing_opportunity', 'MKT-004', { title: 'Shared links carry no preview' }),
    ])])
    const change = actions.find((a) => a.from[0]!.id === 'MKT-004')!
    const measure = actions.find((a) => a.from[0]!.id === 'MKT-001')!
    expect(change.dependsOn).toEqual([measure.id])
    expect(measure.dependsOn).toEqual([])
  })

  // "Do X — comes after Y" printed above Y reads as a contradiction of the
  // line beside it.
  it('prints the prerequisite above the thing that waits on it', () => {
    const actions = planFrom([section('marketing_opportunity', [
      // The dependent outranks the measurement on impact, so impact alone
      // would put it first.
      finding('marketing_opportunity', 'MKT-004', {
        title: 'Shared links carry no preview', severity: 'critical' as Severity,
      }),
      finding('marketing_opportunity', 'MKT-001', {
        title: 'Sharing a link records no event', severity: 'low' as Severity,
      }),
    ])])
    const order = actions.map((a) => a.from[0]!.id)
    expect(order.indexOf('MKT-001')).toBeLessThan(order.indexOf('MKT-004'))
  })

  it('claims no order across sections, where nothing establishes one', () => {
    const actions = planFrom([
      section('marketing_opportunity', [
        finding('marketing_opportunity', 'MKT-001', { title: 'Sharing a link records no event' }),
      ]),
      section('seo', [finding('seo', 'no-canonical', { title: 'No canonical tag' })]),
    ])
    expect(actions.find((a) => a.from[0]!.category === 'seo')!.dependsOn).toEqual([])
  })

  it('leaves the list empty rather than guessing', () => {
    const actions = planFrom([section('seo', [
      finding('seo', 'A'), finding('seo', 'B'),
    ])])
    expect(actions.every((a) => a.dependsOn.length === 0)).toBe(true)
  })
})

describe('every action can be checked afterwards', () => {
  it('gives a test the person doing the work can run themselves', () => {
    const [a] = planFrom([section('seo', [finding('seo', 'A', { type: 'defect' })])])
    expect(a!.validation).toMatch(/re-run this report/i)
  })

  // An opportunity taken is not an absence closed, so re-running proves
  // nothing. Saying otherwise would hand someone a test that always fails.
  it('does not promise a re-run can settle an opportunity', () => {
    const [a] = planFrom([section('monetization', [
      finding('monetization', 'A', { type: 'opportunity', confidenceScore: 0.8 }),
    ])])
    expect(a!.validation).not.toMatch(/should no longer appear/i)
    expect(a!.validation).toMatch(/decide the measure before/i)
  })

  // Some analysers put `path:line  the matching source line` in the path. It
  // reads fine in a citation list and turns a sentence into rubble.
  // The renderer prints the first cited file beside the action.
  // "docs/OPEN-ITEMS.md" next to "a provider cannot be reached from any screen"
  // sends somebody to a file where there is nothing to do.
  it('anchors to a code file rather than a doc or a build script', () => {
    const ev = (path: string) => ({ kind: 'file' as const, path, description: 'd' })
    const [a] = planFrom([section('marketplace_health', [
      finding('marketplace_health', 'A', {
        evidence: [ev('docs/OPEN-ITEMS.md'), ev('scripts/clean.mjs'), ev('src/App.tsx')],
      }),
    ])])
    expect(a!.affected[0]).toBe('src/App.tsx')
    // Ordered, not filtered — nothing the finding cited is dropped.
    expect(a!.affected).toHaveLength(3)
  })

  it('keeps the finding\'s own files when it cites nothing else', () => {
    const [a] = planFrom([section('seo', [
      finding('seo', 'A', {
        evidence: [{ kind: 'file', path: 'docs/README.md', description: 'd' }],
      }),
    ])])
    expect(a!.affected).toEqual(['docs/README.md'])
  })

  it('names the file, not the line and the source that was matched', () => {
    const [a] = planFrom([section('monetization', [finding('monetization', 'A', {
      type: 'defect',
      evidence: [{
        kind: 'file', description: 'd',
        path: 'src/pages/Home.tsx:5  const price = 19.99 // TODO real pricing',
      }],
    })])])
    expect(a!.validation).toContain('src/pages/Home.tsx')
    expect(a!.validation).not.toContain('19.99')
  })

  // Several analysers give every instance of a check the same recommendation.
  // Opening with it printed the same sentence four times over four different
  // capabilities, with the only distinguishing text at the end of the line.
  it('leads with the finding title, so two instances of one check differ', () => {
    const plan = buildActionPlan([section('marketplace_health', [
      finding('marketplace_health', 'unsurfaced-a', {
        title: 'A provider can describe themselves — built, but no screen reaches it',
        recommendation: 'Confirm whether a screen already uses it.',
      }),
      finding('marketplace_health', 'unsurfaced-b', {
        title: 'A customer can find a provider — built, but no screen reaches it',
        recommendation: 'Confirm whether a screen already uses it.',
      }),
    ])])
    const lines = plan.findings.flatMap((f) => f.evidence.map((e) => e.description))
    expect(lines).toHaveLength(2)
    expect(lines[0]!.startsWith('A provider can describe themselves')).toBe(true)
    expect(lines[1]!.startsWith('A customer can find a provider')).toBe(true)
  })

  it('names the finding and the section it came from', () => {
    const plan = buildActionPlan([section('seo', [
      finding('seo', 'no-canonical', { effort: 'low', dimensions: { impact: 8 } }),
    ])])
    const described = plan.findings.flatMap((f) => f.evidence.map((e) => e.description)).join(' ')
    expect(described).toContain('no-canonical')
    expect(described).toContain('seo')
  })
})

describe('the section adds nothing to the report', () => {
  const sections = [
    section('security_qa', [finding('security_qa', 'SEC-002', { severity: 'critical' as Severity })]),
    section('seo', [finding('seo', 'no-canonical', { severity: 'high' as Severity })]),
  ]
  const plan = buildActionPlan(sections)

  // The run summary counts findings by severity to say how much is wrong. If
  // the plan carried the severity of what it points at, explaining what to do
  // about a problem would make the report say there were two of them.
  it('does not count the same problem twice in the run summary', () => {
    const facts = { filesScanned: 1, filesSkipped: 0, truncated: false, limitsHit: [], skipped: [] }
    const without = summarizeRun(sections, facts as any)
    const with_ = summarizeRun([...sections, plan], facts as any)
    expect(with_.severityCounts.critical).toBe(without.severityCounts.critical)
    expect(with_.severityCounts.high).toBe(without.severityCounts.high)
  })

  it('still says how grave the group is, in words rather than in the count', () => {
    expect(plan.findings.map((f) => f.summary).join(' ')).toMatch(/gravest of these is critical/)
  })

  it('is unscored, so the same evidence is not weighed twice', () => {
    expect(plan.score).toBeNull()
  })

  // The renderer prints `summary`, then `impact` beneath it, suppressing the
  // second only when the two match exactly. A heading repeated with a clause
  // bolted on clears that guard and reads as two findings agreeing.
  it('says something different in each field the report prints', () => {
    for (const f of plan.findings) {
      expect(f.impact.trim()).not.toBe(f.summary.trim())
      expect(f.impact).toMatch(/Drawn from \d+ section/)
    }
  })

  // The prompts belong to the findings and are already on them. A second one
  // here would put the same change in front of a reader twice.
  it('carries no prompt of its own', () => {
    expect(plan.findings.every((f) => f.claudeCodePrompts.length === 0)).toBe(true)
  })

  it('says plainly that nothing here is new', () => {
    expect(plan.limitations.join(' ')).toMatch(/nothing here is new/i)
  })
})

describe('when there is nothing to do', () => {
  const out = buildActionPlan([section('seo', [finding('seo', 'A', { type: 'observation' })])])

  it('says so rather than leaving an empty section', () => {
    expect(out.status).toBe('not_applicable')
    expect(out.findings).toEqual([])
  })

  // "No plan" and "nothing to do" are different statements, and an empty
  // heading makes them look the same.
  it('distinguishes finding nothing to act on from having found nothing', () => {
    expect(out.reason).toMatch(/found nothing to act on/i)
  })

  it('finds nothing in an empty report', () => {
    expect(buildActionPlan([]).status).toBe('not_applicable')
  })
})
