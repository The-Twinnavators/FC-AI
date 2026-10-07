// What kind of thing each finding is.
//
// The distinction this exists to protect: a revenue stream the product could
// add is not a low-severity problem, and a capability that may be missing is
// not a defect until somebody decides it should exist. Everything used to sit
// on the severity ramp, so every section read as a list of faults and a reader
// scanning for real damage had to discount most of the page to find it.

import { describe, it, expect } from 'vitest'
import { classifyFinding, classifySection } from '../../../src/flowReport/analyzers/classify.js'
import { bandOf, scoreOfBand, type Finding, type ReportCategory } from '../../../src/flowReport/types.js'

const finding = (over: Partial<Finding> = {}): Finding => ({
  id: 'f1',
  category: 'engineering_quality' as ReportCategory,
  title: 'Something is wrong',
  summary: 's',
  severity: 'high',
  confidence: 'high',
  status: 'open',
  impact: 'i',
  recommendation: 'r',
  rationale: 'ra',
  evidence: [{ kind: 'file', path: 'src/a.ts', description: 'd' }],
  claudeCodePrompts: [],
  ...over,
})

describe('what kind of thing a finding is', () => {
  it('calls a present fault a defect', () => {
    expect(classifyFinding(finding()).type).toBe('defect')
  })

  it('calls a lesser fault a risk, not a defect', () => {
    // "This shape invites a problem" is not "this is broken", and a reader
    // acts on the two differently.
    expect(classifyFinding(finding({ severity: 'medium' })).type).toBe('risk')
  })

  it('calls an absence a gap even in a fault-finding section', () => {
    expect(classifyFinding(finding({ title: 'No error boundary was found' })).type).toBe('gap')
  })

  it('trusts the analyser\'s own absence flag over the wording', () => {
    // Set from `isAbsence` by the normaliser — decided by the code that did the
    // measuring rather than inferred from a title here.
    expect(classifyFinding(finding({ requiresManualValidation: true })).type).toBe('gap')
  })

  // The first version classified the whole monetization section as
  // opportunity and turned '35 money path(s) carry a placeholder marker' into
  // a proposal. A placeholder left in a payment path is a fault.
  it('does not call a payment fault an opportunity just for its section', () => {
    const f = finding({ category: 'monetization' as ReportCategory, severity: 'high' })
    expect(classifyFinding(f).type).toBe('defect')
  })

  it('keeps the opportunity type the revenue analyser sets for itself', () => {
    const f = finding({ category: 'monetization' as ReportCategory, severity: 'high', type: 'opportunity' })
    expect(classifyFinding(f).type).toBe('opportunity')
  })

  it('calls a competitive gap a gap whatever its severity', () => {
    const f = finding({ category: 'competitive_gaps' as ReportCategory, severity: 'high' })
    expect(classifyFinding(f).type).toBe('gap')
  })

  it('calls an informational finding an observation', () => {
    expect(classifyFinding(finding({ severity: 'info' })).type).toBe('observation')
  })

  it('leaves a type an analyser set for itself', () => {
    const f = finding({ type: 'observation', severity: 'critical' })
    expect(classifyFinding(f).type).toBe('observation')
  })
})

describe('confidence in two forms that cannot disagree', () => {
  it('gives a number to a finding that only had a word', () => {
    expect(classifyFinding(finding({ confidence: 'high' })).confidenceScore)
      .toBe(scoreOfBand('high'))
  })

  it('derives the word from the number when the number was authored', () => {
    const f = classifyFinding(finding({ confidence: 'high', confidenceScore: 0.45 }))
    expect(f.confidence).toBe('low')
    expect(f.confidenceScore).toBe(0.45)
  })

  it('maps every band back to itself', () => {
    for (const band of ['high', 'medium', 'low'] as const) {
      expect(bandOf(scoreOfBand(band))).toBe(band)
    }
  })
})

describe('effort, from the shape of the evidence', () => {
  const withFiles = (n: number, over: Partial<Finding> = {}) => finding({
    evidence: Array.from({ length: n }, (_, i) => ({
      kind: 'file' as const, path: `src/f${i}.ts`, description: 'd',
    })),
    ...over,
  })

  it('reads one file as low effort', () => {
    expect(classifyFinding(withFiles(1)).effort).toBe('low')
  })

  it('reads fifteen files as high effort', () => {
    expect(classifyFinding(withFiles(15)).effort).toBe('high')
  })

  // Building something absent costs more than correcting something present.
  it('costs a gap more than a defect over the same files', () => {
    const defect = classifyFinding(withFiles(1)).effort
    const gap = classifyFinding(withFiles(1, { requiresManualValidation: true })).effort
    expect(defect).toBe('low')
    expect(gap).toBe('medium')
  })

  // ── The one that was wrong ──
  //
  // An absence cites no file because the thing is absent, so the count is not
  // evidence of size. Read as "medium" and then bumped a band for being a gap,
  // every clean absence came out `high` — an estimate from no information,
  // printed as confidently as one from fifteen files, over findings whose own
  // recommendation began "this is the cheapest kind of work there is".
  it('says nothing about the size of a finding that cites no file', () => {
    expect(classifyFinding(withFiles(0)).effort).toBeUndefined()
    expect(classifyFinding(withFiles(0, { requiresManualValidation: true })).effort)
      .toBeUndefined()
  })

  it('leaves the effort dimension out rather than scoring it zero', () => {
    expect(classifyFinding(withFiles(0)).dimensions).not.toHaveProperty('effort')
  })

  // The analyser did the measuring and is the only thing that can know. A
  // capability that is built but unreachable cites the files that implement
  // it, so counting them measures what exists rather than what is left to do.
  it('defers to an analyser that sized the work itself', () => {
    expect(classifyFinding(withFiles(15, { effort: 'low' })).effort).toBe('low')
    expect(classifyFinding(withFiles(0, { effort: 'high' })).dimensions?.effort)
      .toBe(8)
  })
})

describe('dimensions say unknown rather than zero', () => {
  it('leaves security importance unset outside security and compliance', () => {
    // Zero would be a rating: it would say somebody assessed the security
    // importance of an SEO finding and found none. Nobody assessed it.
    const f = classifyFinding(finding({ category: 'seo' as ReportCategory }))
    expect(f.dimensions?.securityImportance).toBeUndefined()
  })

  it('sets security importance inside them', () => {
    const f = classifyFinding(finding({ category: 'security_qa' as ReportCategory }))
    expect(f.dimensions?.securityImportance).toBeGreaterThan(0)
  })

  it('leaves revenue relevance unset outside the revenue sections', () => {
    expect(classifyFinding(finding()).dimensions?.revenueRelevance).toBeUndefined()
  })
})

describe('a whole section', () => {
  it('classifies every finding and changes nothing else', () => {
    const section = {
      category: 'engineering_quality' as ReportCategory,
      status: 'completed' as const,
      score: 61,
      summary: 'unchanged',
      findings: [finding({ id: 'a' }), finding({ id: 'b', severity: 'info' })],
      limitations: ['kept'],
    }
    const out = classifySection(section)
    expect(out.findings.map((f) => f.type)).toEqual(['defect', 'observation'])
    expect(out.score).toBe(61)
    expect(out.summary).toBe('unchanged')
    expect(out.limitations).toEqual(['kept'])
  })
})
