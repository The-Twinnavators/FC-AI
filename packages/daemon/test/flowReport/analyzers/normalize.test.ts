// Mapping the existing analysers onto the Flow Reports model.
//
// The eight Poschi analysers were written independently and agree on more than
// they disagree, but the disagreements are exactly the ones a reader would
// trip over: confidence is spelled verified/indicated/hypothesis, there is no
// critical band, and each module carries its own extra field.
//
// The risk in a mapping layer is quiet invention — filling a required field
// with something plausible because the source had nothing. These tests are
// mostly about NOT doing that: a finding with no prompt keeps no prompt, an
// absence stays labelled as an absence, and nothing gains a severity the
// source did not support.

import { describe, it, expect } from 'vitest'
import {
  normalizeCommonFinding, normalizeSecurityFinding, collate,
  type PoschiCommonFinding,
} from '../../../src/flowReport/analyzers/normalize.js'
import type { Finding } from '../../../src/flowReport/types.js'

const common = (over: Partial<PoschiCommonFinding> = {}): PoschiCommonFinding => ({
  id: 'Q1',
  area: 'tests',
  title: 'No test runner is configured',
  severity: 'medium',
  confidence: 'verified',
  detail: 'No test script in package.json and no test directory.',
  files: ['package.json'],
  because: 'Both signals agree.',
  next: 'Add a test runner.',
  isAbsence: true,
  prompt: 'Add vitest to the project.',
  ...over,
})

describe('severity and confidence', () => {
  it('carries severity across unchanged', () => {
    for (const s of ['high', 'medium', 'low', 'info'] as const) {
      expect(normalizeCommonFinding(common({ severity: s }), 'engineering_quality').severity).toBe(s)
    }
  })

  // The source has no critical band, so nothing coming through this path may
  // acquire one. A mapping that promoted "high" to "critical" would invent an
  // emergency out of a judgement somebody else already made.
  it('never promotes a source finding to critical', () => {
    const out = normalizeCommonFinding(common({ severity: 'high' }), 'engineering_quality')
    expect(out.severity).not.toBe('critical')
  })

  it('translates the confidence vocabulary', () => {
    const cases = [['verified', 'high'], ['indicated', 'medium'], ['hypothesis', 'low']] as const
    for (const [from, to] of cases) {
      expect(normalizeCommonFinding(common({ confidence: from }), 'seo').confidence).toBe(to)
    }
  })
})

describe('evidence', () => {
  it('turns each file into a file-kind evidence entry', () => {
    const out = normalizeCommonFinding(
      common({ files: ['src/a.ts', 'src/b.ts'] }), 'engineering_quality')
    expect(out.evidence).toHaveLength(2)
    expect(out.evidence[0]).toMatchObject({ kind: 'file', path: 'src/a.ts' })
  })

  // An absence has nothing to point at. Producing an empty evidence array is
  // honest; producing a fabricated path is not.
  it('produces a static-analysis evidence entry when the finding is an absence with no files', () => {
    const out = normalizeCommonFinding(common({ files: [], isAbsence: true }), 'compliance')
    expect(out.evidence).toHaveLength(1)
    expect(out.evidence[0]?.kind).toBe('static_analysis')
    expect(out.evidence[0]?.path).toBeUndefined()
  })

  it('refuses an absolute path, because a report must not carry one', () => {
    const out = normalizeCommonFinding(
      common({ files: ['C:/Users/someone/app/src/a.ts', 'src/b.ts'] }), 'seo')
    const paths = out.evidence.map((e) => e.path).filter(Boolean)
    expect(paths).toEqual(['src/b.ts'])
  })
})

describe('prompts', () => {
  it('carries a prompt through with a title and an intended outcome', () => {
    const out = normalizeCommonFinding(common({ prompt: 'Do the thing.' }), 'engineering_quality')
    expect(out.claudeCodePrompts).toHaveLength(1)
    expect(out.claudeCodePrompts[0]?.prompt).toContain('Do the thing.')
    expect(out.claudeCodePrompts[0]?.title).toBeTruthy()
    expect(out.claudeCodePrompts[0]?.intendedOutcome).toBeTruthy()
  })

  // The analysers already decided where a coding prompt is the wrong response —
  // rotating a credential, reading a policy, asking a lawyer. Manufacturing one
  // here would override a judgement made with more context than this has.
  it('leaves a finding with no prompt without one, rather than inventing it', () => {
    expect(normalizeCommonFinding(common({ prompt: null }), 'compliance').claudeCodePrompts)
      .toEqual([])
    expect(normalizeCommonFinding(common({ prompt: undefined }), 'compliance').claudeCodePrompts)
      .toEqual([])
  })

  it('names the affected paths on the prompt, so it can be acted on', () => {
    const out = normalizeCommonFinding(common({ files: ['src/a.ts'] }), 'engineering_quality')
    expect(out.claudeCodePrompts[0]?.affectedPaths).toEqual(['src/a.ts'])
  })
})

describe('effort, where the analyser said one', () => {
  // The only thing that can size an absence is the analyser that looked for
  // it. From here, "built but unreachable" and "never built" cite the same
  // kind of empty file list and are indistinguishable.
  it('carries a size the analyser stated', () => {
    expect(normalizeCommonFinding(common({ effort: 'low' }), 'seo').effort).toBe('low')
  })

  it('invents none where the analyser was silent', () => {
    expect(normalizeCommonFinding(common(), 'seo').effort).toBeUndefined()
  })

  // The extras channel is untyped, so a typo must not become a size.
  it('ignores a value that is not a size', () => {
    expect(normalizeCommonFinding(common({ effort: 'trivial' }), 'seo').effort).toBeUndefined()
    expect(normalizeCommonFinding(common({ effort: 3 }), 'seo').effort).toBeUndefined()
  })
})

describe('what a stale checkout invalidates', () => {
  it('marks an absence as needing manual validation', () => {
    expect(normalizeCommonFinding(common({ isAbsence: true }), 'seo').requiresManualValidation)
      .toBe(true)
  })

  it('does not mark a finding that pointed at real files', () => {
    expect(normalizeCommonFinding(common({ isAbsence: false }), 'seo').requiresManualValidation)
      .toBe(false)
  })
})

describe('the security analyser, which has a richer shape', () => {
  const sec = {
    id: 'SEC-001',
    title: 'Public endpoint writes without checking the caller',
    category: 'Authentication',
    severity: 'high' as const,
    confidence: 'verified' as const,
    cwe: 'CWE-306',
    asvs: 'V13.2',
    components: ['supabase/functions/hook/index.ts'],
    preconditions: 'The URL is reachable.',
    impact: 'Unauthenticated writes.',
    evidence: ['config declares it public', 'no signature check in the handler'],
    whyItMatters: 'Every other receiver verifies.',
    remediation: 'Verify the signature.',
    verification: 'An unsigned request writes nothing.',
    mitigating: 'Needs a message id the caller cannot guess.',
    prompt: 'Implement signature verification.',
    resolution: null,
    needsApproval: true,
  }

  it('keeps critical severity, which only this analyser produces', () => {
    const out = normalizeSecurityFinding({ ...sec, severity: 'critical' })
    expect(out.severity).toBe('critical')
  })

  it('maps its prose fields onto the model without losing the mitigating fact', () => {
    const out = normalizeSecurityFinding(sec)
    expect(out.impact).toBe('Unauthenticated writes.')
    expect(out.recommendation).toBe('Verify the signature.')
    // The fact that argues the severity DOWN has to survive, or the reader
    // discovers it later and stops trusting the rest of the register.
    expect(out.rationale).toContain('cannot guess')
  })

  it('turns its components into evidence and its string evidence into descriptions', () => {
    const out = normalizeSecurityFinding(sec)
    expect(out.evidence.some((e) => e.path === 'supabase/functions/hook/index.ts')).toBe(true)
    expect(out.evidence.some((e) => /no signature check/.test(e.description))).toBe(true)
  })

  // A finding whose resolution is "rotate this credential" must not be handed
  // to a coding agent.
  it('does not produce a coding prompt for a finding that needs a person', () => {
    const out = normalizeSecurityFinding({
      ...sec, prompt: null, resolution: 'Ask the account owner whether the key is live.',
    })
    expect(out.claudeCodePrompts).toEqual([])
    expect(out.limitations?.join(' ')).toMatch(/account owner/)
  })

  it('records that a change needs approval', () => {
    expect(normalizeSecurityFinding(sec).requiresManualValidation).toBe(true)
  })
})

describe('collating a section', () => {
  const f = (over: Partial<Finding>): Finding => ({
    id: 'x', category: 'seo', title: 't', summary: 's',
    severity: 'low', confidence: 'medium', status: 'open',
    impact: 'i', recommendation: 'r', rationale: 'ra',
    evidence: [], claudeCodePrompts: [], ...over,
  })

  it('orders by severity, then by confidence', () => {
    // Distinct titles: identical ones are the dedup case, tested below, and
    // reusing them here would collapse the set before it could be ordered.
    const out = collate([
      f({ id: 'a', title: 'A', severity: 'low' }),
      f({ id: 'b', title: 'B', severity: 'critical' }),
      f({ id: 'c', title: 'C', severity: 'high', confidence: 'low' }),
      f({ id: 'd', title: 'D', severity: 'high', confidence: 'high' }),
    ])
    expect(out.map((x) => x.id)).toEqual(['b', 'd', 'c', 'a'])
  })

  it('removes a duplicate title within a category, keeping the stronger one', () => {
    const out = collate([
      f({ id: 'a', title: 'Same', severity: 'low', confidence: 'low' }),
      f({ id: 'b', title: 'Same', severity: 'high', confidence: 'high' }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0]?.id).toBe('b')
  })

  it('keeps the same title in two different categories, because they are two findings', () => {
    const out = collate([
      f({ id: 'a', title: 'Same', category: 'seo' }),
      f({ id: 'b', title: 'Same', category: 'compliance' }),
    ])
    expect(out).toHaveLength(2)
  })

  it('merges the evidence of a duplicate rather than discarding it', () => {
    const out = collate([
      f({ id: 'a', title: 'Same', severity: 'high', evidence: [{ kind: 'file', path: 'a.ts', description: 'x' }] }),
      f({ id: 'b', title: 'Same', severity: 'medium', evidence: [{ kind: 'file', path: 'b.ts', description: 'y' }] }),
    ])
    expect(out[0]?.evidence.map((e) => e.path).sort()).toEqual(['a.ts', 'b.ts'])
  })
})
