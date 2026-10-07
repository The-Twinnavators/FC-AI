// Locating a finding in the code, without letting the model decide anything.
//
// ── What this pass is for ────────────────────────────────────────────────────
//
// A 7B model asked to hold a repository in context, name real paths, obey
// negative rules and write prose produced usable output for one finding in five.
// Asked instead to do one thing — point at a name in a snippet it can see — it
// works. Every test here is about keeping its job that small, and about the
// deterministic checks that catch it when it strays.

import { describe, it, expect } from 'vitest'
import {
  validateInsight, worthLocating, insightSentence, insightPrompt,
} from '../../../src/flowReport/comprehend/extract.js'

const SNIPPET = `
export async function initSentry() {
  try { await Sentry.init({ dsn }) } catch (e) {}
}
const ECOMMERCE_HTML = '<div class="Data">…</div>'
`

const ok = (over: Record<string, unknown> = {}) =>
  validateInsight({ target_identifier: 'initSentry', where: 'the catch block', ...over },
    'src/boot.ts', SNIPPET)

describe('the answer is checked against the code', () => {
  it('accepts a name that is really in the snippet', () => {
    expect(ok()).toEqual({ file: 'src/boot.ts', identifier: 'initSentry', where: 'the catch block' })
  })

  // The failure that made this check whole-word. A model returned `Da`, which
  // passed a substring test because `Da` occurs inside `Data` — so the report
  // would have pointed at a name nobody wrote.
  it('rejects a fragment that only occurs inside another word', () => {
    expect(ok({ target_identifier: 'Da' })).toBeNull()
    expect(ok({ target_identifier: 'Sent' })).toBeNull()
  })

  it('rejects a name that is not in the snippet at all', () => {
    expect(ok({ target_identifier: 'initAnalytics' })).toBeNull()
  })

  it.each(['function', 'const', 'export', 'error', 'data', 'value'])(
    'rejects %s, which names nothing', (word) => {
      expect(validateInsight({ target_identifier: word }, 'a.ts', `const ${word} = 1`)).toBeNull()
    })

  it('treats an empty answer as the ordinary outcome it is', () => {
    expect(ok({ target_identifier: '' })).toBeNull()
    expect(validateInsight({}, 'a.ts', SNIPPET)).toBeNull()
    expect(validateInsight(null, 'a.ts', SNIPPET)).toBeNull()
    expect(validateInsight('nonsense', 'a.ts', SNIPPET)).toBeNull()
  })

  it('keeps the location short, because ten words was the instruction', () => {
    const long = 'one two three four five six seven eight nine ten eleven twelve'
    expect(ok({ where: long })!.where.split(' ')).toHaveLength(10)
  })

  // The path is injected by the caller and copied through, so there is no code
  // path by which a wrong one can be produced.
  it('carries the path it was given, never one from the model', () => {
    const got = validateInsight(
      { target_identifier: 'initSentry', file: 'somewhere/else.ts' }, 'src/boot.ts', SNIPPET)
    expect(got!.file).toBe('src/boot.ts')
  })
})

describe('which findings are worth locating at all', () => {
  const f = (over: Record<string, unknown> = {}) => ({
    severity: 'high', title: 'Catch blocks that discard the error they caught',
    evidence: [{ path: 'src/boot.ts' }], ...over,
  })

  it('locates a defect that cites a file', () => {
    expect(worthLocating(f())).toBe(true)
  })

  // Measured: the pipeline pinned "1 test files" to `rgbToHex`, a real function
  // in a real test with nothing to do with the count.
  it('skips a finding whose title is a measurement', () => {
    expect(worthLocating(f({ title: '1 test files' }))).toBe(false)
    expect(worthLocating(f({ title: '18 monetization endpoint(s) and page(s)' }))).toBe(false)
  })

  it('skips an observation', () => {
    expect(worthLocating(f({ severity: 'info' }))).toBe(false)
  })

  it('skips an absence, because there is nothing to point at', () => {
    expect(worthLocating(f({ requiresManualValidation: true }))).toBe(false)
    expect(worthLocating(f({ evidence: [{ }] }))).toBe(false)
  })
})

describe('what the application assembles', () => {
  const insight = { file: 'src/boot.ts', identifier: 'initSentry', where: 'the catch block' }

  it('states the claim from the finding, not from the model', () => {
    const line = insightSentence(insight, 'Catch blocks that discard the error they caught.')
    expect(line).toBe('In `src/boot.ts`, at `initSentry`, in the catch block: '
      + 'Catch blocks that discard the error they caught.')
  })

  it('builds a prompt that names the real file and the verified identifier', () => {
    const p = insightPrompt(insight, 'Catch blocks discard the error.', 'Surface or report it.')
    expect(p).toContain('Open src/boot.ts and fix initSentry')
    expect(p).toContain('Catch blocks discard the error.')
    expect(p).toContain('Surface or report it.')
    // A prompt with a placeholder in it is a prompt nobody runs.
    expect(p).not.toMatch(/<[a-z_]+>|\{\{|TODO/)
  })

  it('leaves the location out when there is none rather than printing an empty clause', () => {
    const line = insightSentence({ ...insight, where: '' }, 'Something is wrong.')
    expect(line).toBe('In `src/boot.ts`, at `initSentry`: Something is wrong.')
  })
})
