// What several sections add up to.
//
// The rules themselves will change. The properties tested here should not:
// a theme fires only when every finding it needs is present, it can never be
// surer or graver than the findings it rests on, and it always names them.
// Those are what make a composed conclusion checkable instead of asserted.

import { describe, it, expect } from 'vitest'
import { synthesise, findThemes } from '../../../src/flowReport/analyzers/synthesis.js'
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
  recommendation: 'r',
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

/** The three findings SYN-003 needs: an error dropped, nothing logging it, and
 *  no way to report it. */
const observabilityGap = () => [
  section('error_log', [finding('error_log', 'ERR-001'), finding('error_log', 'ERR-003')]),
  section('product_intel', [finding('product_intel', 'LX-TEL-002')]),
]

describe('a theme needs every finding it names', () => {
  it('fires when they are all present', () => {
    const themes = findThemes(observabilityGap())
    expect(themes.map((t) => t.rule.id)).toContain('SYN-003')
  })

  it('does not fire on a partial match', () => {
    // Two of the three. The conclusion written for this rule is about all
    // three, and there is no honest way to print it for two.
    const partial = [
      section('error_log', [finding('error_log', 'ERR-001'), finding('error_log', 'ERR-003')]),
    ]
    expect(findThemes(partial).map((t) => t.rule.id)).not.toContain('SYN-003')
  })

  it('finds nothing in an empty report', () => {
    expect(findThemes([])).toEqual([])
  })
})

describe('a conclusion is never better evidenced than its premises', () => {
  it('takes the confidence of the weakest finding, not an average', () => {
    const sections = [
      section('error_log', [
        finding('error_log', 'ERR-001', { confidenceScore: 0.9 }),
        finding('error_log', 'ERR-003', { confidenceScore: 0.9 }),
      ]),
      section('product_intel', [finding('product_intel', 'LX-TEL-002', { confidenceScore: 0.4 })]),
    ]
    const out = synthesise(sections)
    const theme = out.findings.find((f) => f.id === 'SYN-003')!
    // The mean would be 0.73 and would make the theme look better supported
    // than the finding holding it up.
    expect(theme.confidenceScore).toBe(0.4)
    expect(theme.confidence).toBe('low')
  })

  it('never exceeds the severity of its worst constituent', () => {
    const sections = [
      section('error_log', [
        finding('error_log', 'ERR-001', { severity: 'low' as Severity }),
        finding('error_log', 'ERR-003', { severity: 'info' as Severity }),
      ]),
      section('product_intel', [finding('product_intel', 'LX-TEL-002', { severity: 'low' as Severity })]),
    ]
    const theme = synthesise(sections).findings.find((f) => f.id === 'SYN-003')!
    expect(theme.severity).toBe('low')
  })

  it('carries the worst severity when one constituent is grave', () => {
    const sections = [
      section('error_log', [
        finding('error_log', 'ERR-001', { severity: 'high' as Severity }),
        finding('error_log', 'ERR-003', { severity: 'info' as Severity }),
      ]),
      section('product_intel', [finding('product_intel', 'LX-TEL-002', { severity: 'info' as Severity })]),
    ]
    expect(synthesise(sections).findings.find((f) => f.id === 'SYN-003')!.severity).toBe('high')
  })
})

describe('a theme can be taken apart', () => {
  const theme = synthesise(observabilityGap()).findings.find((f) => f.id === 'SYN-003')!

  it('names every finding it was built from, and where it came from', () => {
    const described = theme.evidence.map((e) => e.description).join(' ')
    for (const id of ['ERR-001', 'ERR-003', 'LX-TEL-002']) {
      expect(described, `${id} should be cited`).toContain(id)
    }
    expect(described).toContain('error_log')
    expect(described).toContain('product_intel')
  })

  it('has one evidence entry per leg', () => {
    expect(theme.evidence).toHaveLength(3)
  })

  // The work belongs to the findings it cites, and their prompts are already
  // on them. A second prompt here would describe the same change twice.
  it('carries no prompt of its own', () => {
    expect(theme.claudeCodePrompts).toEqual([])
  })

  it('says plainly that it measured nothing', () => {
    expect(theme.rationale).toMatch(/measured/i)
    expect(theme.limitations?.join(' ')).toMatch(/measures nothing/i)
  })
})

describe('when nothing composes', () => {
  const out = synthesise([section('seo', [finding('seo', 'no-canonical')])])

  it('says so rather than leaving an empty section', () => {
    expect(out.status).toBe('not_applicable')
    expect(out.findings).toEqual([])
  })

  // An empty heading reads as a section that failed. A reason distinguishes
  // "these findings did not combine" from "the synthesis did not run".
  it('gives a reason that does not claim the sections are unrelated', () => {
    expect(out.reason).toBeTruthy()
    expect(out.reason).toMatch(/not evidence|statement about these findings/i)
  })
})

describe('the section itself', () => {
  it('is unscored, so the same evidence is not weighed twice', () => {
    // Every constituent is already scored where it lives. Scoring the theme
    // too would count it again in the overall figure.
    expect(synthesise(observabilityGap()).score).toBeNull()
  })
})
