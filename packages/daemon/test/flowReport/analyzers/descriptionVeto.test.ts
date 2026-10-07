// When the written description is allowed to overrule the code.
//
// ── The failure ──────────────────────────────────────────────────────────────
//
// A local 7B model describes the project before anything is measured, and its
// `isTwoSidedMarketplace` flag was given the final say. Against the clearest
// marketplace in the set it answered, three runs running:
//
//   whatItIs: "A booking marketplace and business-operations platform for
//              independent service providers."
//   isTwoSidedMarketplace: false
//
// The section went not-applicable and the report printed both halves in one
// sentence — "this is A booking marketplace … — not a marketplace, so it was
// not assessed as one" — followed by a note that ten structural patterns had
// matched and been overruled.
//
// The veto is worth keeping: it is what stops a design-system builder whose
// paths match ten regexes from being audited as a marketplace. What it may not
// do is fire when the description contradicts itself.

import { describe, it, expect } from 'vitest'
import { describesAMarketplace, marketplaceHealthAnalyzer } from '../../../src/flowReport/analyzers/adapters.js'
import type { AnalysisContext } from '../../../src/flowReport/jobManager.js'

const model = (whatItIs: string, isTwoSidedMarketplace: boolean) => ({
  whatItIs,
  domain: 'example',
  isTwoSidedMarketplace,
  actors: [],
  coreFlows: [],
  entities: [],
  externalServices: [],
  architecture: '',
  unknowns: [],
})

/** A repository with nothing marketplace-shaped in it, so the structural check
 *  cannot be what decides. */
const ctxWith = (described: ReturnType<typeof model> | null): AnalysisContext => ({
  files: [{ path: 'readme.md', text: '# A project' }],
  scan: { truncated: false, skipped: [], limitsHit: [] },
  settings: {},
  repositoryDisplayName: 'example',
  comprehension: { producedBy: 'test', filesRead: [], reason: null, model: described },
  signal: new AbortController().signal,
} as unknown as AnalysisContext)

describe('spotting a description that disagrees with itself', () => {
  it.each([
    'A booking marketplace and business-operations platform for independent service providers.',
    'A two-sided platform connecting buyers and sellers.',
    'A multi-vendor storefront.',
    'A market place for freelance work.',
  ])('reads %s as calling itself a marketplace', (text) => {
    expect(describesAMarketplace(model(text, false))).toBe(true)
  })

  it.each([
    'A design system and component library for CSS.',
    'An interactive digital book.',
    'A personal finance tracker.',
  ])('leaves %s alone', (text) => {
    expect(describesAMarketplace(model(text, false))).toBe(false)
  })

  it('reads the domain as well as the summary', () => {
    expect(describesAMarketplace({ whatItIs: 'A platform.', domain: 'marketplace' })).toBe(true)
  })
})

describe('which evidence decides', () => {
  it('still lets a coherent description veto the structural check', async () => {
    const res = await marketplaceHealthAnalyzer().run(
      ctxWith(model('A design system and component library for CSS.', false)),
    )
    expect(res.status).toBe('not_applicable')
    // The description's own words, which is the branch under test.
    expect(res.reason).toMatch(/Read from the code, this is A design system/)
  })

  // The regression. A contradictory description must not reach that branch —
  // the structural check decides instead, whichever way it lands.
  it('does not let a self-contradicting description veto anything', async () => {
    const res = await marketplaceHealthAnalyzer().run(
      ctxWith(model('A booking marketplace for independent service providers.', false)),
    )
    expect(res.reason).not.toMatch(/Read from the code, this is A booking marketplace/)
    // This fixture has no marketplace primitives, so the structural check is
    // what turns it down — and it says so in its own words.
    expect(res.status).toBe('not_applicable')
    expect(res.reason).toMatch(/marketplace primitives were found/)
  })

  it('takes a positive flag at its word without consulting anything else', async () => {
    const res = await marketplaceHealthAnalyzer().run(ctxWith(model('A shop.', true)))
    expect(res.reason).not.toMatch(/Read from the code/)
  })

  it('falls back to the structural check when no description was produced', async () => {
    const res = await marketplaceHealthAnalyzer().run(ctxWith(null))
    expect(res.status).toBe('not_applicable')
    expect(res.reason).toMatch(/marketplace primitives were found/)
  })
})
