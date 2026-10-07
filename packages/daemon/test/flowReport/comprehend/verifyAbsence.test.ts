// Checking whether a thing the report calls missing is actually missing.
//
// The model's contribution here is vocabulary and judgement. It must never be
// able to contribute evidence — so these tests are mostly about the gate: what
// happens when the model is confident and wrong, and what happens when it is
// unavailable. Both must end with the finding standing, because this pass
// exists to remove claims that are false, never claims it could not read.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { search, verifyAbsences, withdrawnBy } from '../../../src/flowReport/comprehend/verifyAbsence.js'
import type { Finding, ReportCategory } from '../../../src/flowReport/types.js'

const files = [
  { path: 'src/pages/ProviderProfile.tsx', text: 'export function ProviderProfile() {\n  return null\n}' },
  { path: 'docs/OPEN-ITEMS.md', text: 'the provider profile page is still to do' },
  { path: 'src/App.tsx', text: '<Route path="/provider/profile" />' },
]

const absence = (over: Partial<Finding> = {}): Finding => ({
  id: 'unsurfaced-supply-profile',
  category: 'marketplace_health' as ReportCategory,
  title: 'A provider can describe themselves — built, but no screen reaches it',
  summary: 'The router declares no route that would surface it.',
  severity: 'high',
  confidence: 'medium',
  status: 'open',
  impact: 'i',
  recommendation: 'r',
  rationale: 'ra',
  evidence: [],
  claudeCodePrompts: [],
  requiresManualValidation: true,
  ...over,
})

// The two model calls, in order: naming, then judging.
const mockModel = (...replies: unknown[]) => {
  const calls: unknown[] = []
  let i = 0
  vi.doMock('../../../src/flowReport/comprehend/model.js', () => ({
    DEFAULT_MODEL: 'test',
    modelStatus: async () => ({ available: true, models: ['test'] }),
    chooseModel: () => 'test',
    chatJson: async (messages: unknown) => {
      calls.push(messages)
      return replies[i++] ?? null
    },
  }))
  return calls
}

beforeEach(() => { vi.resetModules() })
afterEach(() => { vi.doUnmock('../../../src/flowReport/comprehend/model.js') })

const load = async () => await import('../../../src/flowReport/comprehend/verifyAbsence.js')

describe('the search is this module\'s own, and deterministic', () => {
  it('finds a term with a real path and line number', () => {
    const hits = search(files, ['ProviderProfile'])
    expect(hits[0]).toMatchObject({ path: 'src/pages/ProviderProfile.tsx', line: 1 })
  })

  // Twenty markdown hits would crowd out the one component that answers the
  // question, and the model reads a fixed budget of results.
  it('puts implementation files ahead of documentation', () => {
    // "provider" is in all three: the component, the route, and a to-do list.
    const hits = search(files, ['provider'])
    expect(hits.map((h) => h.path)).toContain('docs/OPEN-ITEMS.md')
    expect(hits[0]!.path).not.toMatch(/^docs\//)
    const firstDoc = hits.findIndex((h) => h.path.startsWith('docs/'))
    const lastCode = hits.map((h) => h.path.startsWith('docs/')).lastIndexOf(false)
    expect(firstDoc).toBeGreaterThan(lastCode)
  })

  it('returns one entry per file and line', () => {
    const hits = search(files, ['provider', 'Provider', 'provider/profile'])
    const keys = hits.map((h) => `${h.path}:${h.line}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('finds nothing when nothing is there, rather than guessing', () => {
    expect(search(files, ['refundPolicy', 'chargeback'])).toEqual([])
  })
})

describe('the model names things; it never supplies evidence', () => {
  it('withdraws a finding when the model cites a file the search returned', async () => {
    mockModel(
      { terms: ['ProviderProfile', '/provider/profile'] },
      {
        present: true,
        citations: ['src/pages/ProviderProfile.tsx'],
        reason: 'The component and its route both exist.',
      },
    )
    const { verifyAbsences: run, withdrawnBy: drop } = await load()
    const checks = await run([absence()], files)
    expect(checks.get('unsurfaced-supply-profile')?.present).toBe(true)
    expect([...drop(checks).keys()]).toEqual(['unsurfaced-supply-profile'])
  })

  // ── The gate ──
  //
  // A model that says a capability is present and cannot point at it has found
  // nothing. This is the failure that would turn a verification pass into a
  // machine for deleting true findings.
  it('keeps the finding when the model cites a file that was never found', async () => {
    mockModel(
      { terms: ['ProviderProfile'] },
      {
        present: true,
        citations: ['src/pages/StylistProfile.tsx'],
        reason: 'It is clearly implemented.',
      },
    )
    const { verifyAbsences: run } = await load()
    const checks = await run([absence()], files)
    expect(checks.has('unsurfaced-supply-profile')).toBe(false)
  })

  it('keeps the finding when the model claims presence and cites nothing', async () => {
    mockModel({ terms: ['ProviderProfile'] }, { present: true, citations: [], reason: 'It exists.' })
    const { verifyAbsences: run } = await load()
    expect((await run([absence()], files)).size).toBe(0)
  })

  it('discards a search term that is a regular expression, not a string', async () => {
    // Searching for the literal characters of a pattern finds nothing, and
    // nothing found reads as evidence of absence — the exact error this pass
    // exists to prevent.
    mockModel({ terms: ['^provider.*profile$', 'pro(vider|)', 'ProviderProfile'] },
      { present: false, citations: [], reason: 'no' })
    const { verifyAbsences: run } = await load()
    const checks = await run([absence()], files)
    expect(checks.get('unsurfaced-supply-profile')?.searched).toEqual(['ProviderProfile'])
  })

  it('discards a term that would match most of any repository', async () => {
    mockModel({ terms: ['page', 'data', 'src', 'ProviderProfile'] },
      { present: false, citations: [], reason: 'no' })
    const { verifyAbsences: run } = await load()
    expect((await run([absence()], files)).get('unsurfaced-supply-profile')?.searched)
      .toEqual(['ProviderProfile'])
  })
})

describe('an absence that survives is a stronger claim than one nobody checked', () => {
  it('records what it searched for, so the report can print it', async () => {
    mockModel({ terms: ['refundPolicy', 'chargeback', 'reimburse'] })
    const { verifyAbsences: run } = await load()
    const c = (await run([absence()], files)).get('unsurfaced-supply-profile')!
    expect(c.present).toBe(false)
    expect(c.searched).toEqual(['refundPolicy', 'chargeback', 'reimburse'])
    expect(c.reason).toMatch(/Nothing matched/)
  })

  // No second call is needed when the search found nothing: there is nothing
  // to judge, and asking a model to rule on an empty list invites it to invent.
  it('does not ask the model to judge an empty search', async () => {
    const calls = mockModel({ terms: ['refundPolicy'] })
    const { verifyAbsences: run } = await load()
    await run([absence()], files)
    expect(calls).toHaveLength(1)
  })
})

describe('when it cannot check', () => {
  it('checks nothing, rather than withdrawing on a failed call', async () => {
    mockModel(null, null)
    const { verifyAbsences: run } = await load()
    expect((await run([absence()], files)).size).toBe(0)
  })

  it('leaves every absence standing when no model is reachable', async () => {
    vi.doMock('../../../src/flowReport/comprehend/model.js', () => ({
      DEFAULT_MODEL: 'test',
      modelStatus: async () => ({ available: false, models: [], reason: 'down' }),
      chooseModel: () => null,
      chatJson: async () => { throw new Error('should not be called') },
    }))
    const { verifyAbsences: run } = await load()
    expect((await run([absence()], files)).size).toBe(0)
  })

  it('ignores findings that are not absences', async () => {
    vi.doMock('../../../src/flowReport/comprehend/model.js', () => ({
      DEFAULT_MODEL: 'test',
      modelStatus: async () => { throw new Error('should not be called') },
      chooseModel: () => null,
      chatJson: async () => null,
    }))
    const { verifyAbsences: run } = await load()
    const present = absence({ requiresManualValidation: false })
    expect((await run([present], files)).size).toBe(0)
  })
})

describe('what the caller withdraws', () => {
  it('withdraws only the findings shown to be present, with the file named', () => {
    const checks = new Map([
      ['a', { present: true, searched: ['x'], citations: ['src/A.tsx'], reason: 'Found it.' }],
      ['b', { present: false, searched: ['y'], citations: [], reason: 'Nothing matched.' }],
    ])
    const out = withdrawnBy(checks)
    expect([...out.keys()]).toEqual(['a'])
    expect(out.get('a')).toContain('src/A.tsx')
  })
})

describe('a file named for the thing has to show the thing', () => {
  // ── Two rounds of getting this wrong ──
  //
  // Content-only search never surfaced DeleteAccountPage.tsx at all, because
  // the model proposes ordinary words and six lines containing "delete" are
  // six comments. Matching the filename surfaced it and sent a placeholder —
  // "(the file is named for this)" — so the model applied its own rule, that a
  // mention is not an implementation, and answered that the files were "named
  // for those concepts but do not contain the actual implementation".
  //
  // Sending the FIRST declaration was no better: DeleteAccountPage.tsx opens
  // with an email regex and the delete-account function with a Stripe key.
  // Both true, both incidental, and the verdict did not move.
  const page = {
    path: 'src/pages/legal/DeleteAccountPage.tsx',
    text: [
      "import { useState } from 'react'",
      '// the page people reach from the footer',
      'const EMAIL_RE = /^[^s@]+@[^s@]+$/',
      '',
      'export function DeleteAccountPage() {',
      '  return null',
      '}',
    ].join('\n'),
  }

  it('shows the declaration that carries the searched word', () => {
    const [hit] = search([page], ['delete'])
    expect(hit!.path).toBe('src/pages/legal/DeleteAccountPage.tsx')
    expect(hit!.text).toContain('export function DeleteAccountPage()')
    expect(hit!.line).toBe(5)
  })

  it('does not send the first declaration when it is incidental', () => {
    expect(search([page], ['delete'])[0]!.text).not.toContain('EMAIL_RE')
  })

  it('says the match was on the name, so the model can weigh it', () => {
    expect(search([page], ['delete'])[0]!.text).toMatch(/named for this/)
  })

  it('falls back to the default export when the word is only in the path', () => {
    const f = {
      path: 'src/utils/accountExport.ts',
      text: "import x from 'y'\nexport default function run() { return 1 }",
    }
    expect(search([f], ['accountexport'])[0]!.text).toContain('export default function run()')
  })

  // A comment mentioning the word is not evidence, and six of them crowd out
  // the one declaration that would have answered the question.
  it('skips comment lines when matching content', () => {
    const f = { path: 'src/thing.ts', text: '// delete this later\nconst deleteUser = () => {}' }
    expect(search([f], ['delete']).every((h) => !h.text.startsWith('//'))).toBe(true)
  })
})
