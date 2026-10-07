// Whether a question applies, and what a "no" has to say for itself.
//
// This exists because of a measured failure: several analysers were written for
// one marketplace and reused against whatever folder somebody picks. A digital
// book project produced fourteen marketplace findings — more than the
// marketplace they were written for — and a static site was told that
// "providers are paid for work arranged by the platform".
//
// The gate that was supposed to prevent that asked whether ANY primitive
// matched, and the primitives include patterns as ordinary as `/\/search\b/`.

import { describe, it, expect } from 'vitest'
import { marketplaceApplicability, type PrimitiveState, type Side } from '../../../src/flowReport/analyzers/applicability.js'

const p = (id: string, side: Side, found: boolean): PrimitiveState =>
  ({ id, side, name: id, inApi: found, hasRoute: found ? true : null })

/** Fifteen primitives, none found, as the shape the analyser returns. */
const none = (): PrimitiveState[] => [
  p('s1', 'supply', false), p('s2', 'supply', false), p('s3', 'supply', false),
  p('d1', 'demand', false), p('d2', 'demand', false), p('d3', 'demand', false),
  p('m1', 'matching', false), p('m2', 'matching', false),
  p('t1', 'transaction', false), p('t2', 'transaction', false), p('t3', 'transaction', false),
  p('t4', 'transaction', false), p('t5', 'transaction', false),
  p('r1', 'repeat', false), p('r2', 'repeat', false),
]

const withFound = (...ids: Array<[string, Side]>): PrimitiveState[] => {
  const all = none()
  for (const [id, side] of ids) {
    const i = all.findIndex((x) => x.id === id)
    if (i >= 0) all[i] = p(id, side, true)
  }
  return all
}

describe('a marketplace has to be shown, not matched', () => {
  it('refuses on a single generic hit — the defect this replaced', () => {
    // One demand primitive is what `/\/search\b/` alone produced, and the old
    // gate let that through.
    const r = marketplaceApplicability(withFound(['d1', 'demand']))
    expect(r.applies).toBe(false)
    expect(r.reason).toMatch(/only 1 of the 15/)
  })

  it('refuses when only one side of the model is present', () => {
    const r = marketplaceApplicability(withFound(
      ['s1', 'supply'], ['s2', 'supply'], ['s3', 'supply'], ['m1', 'matching']))
    expect(r.applies).toBe(false)
    expect(r.reason).toMatch(/demand side/)
  })

  it('refuses supply and demand with nothing between them', () => {
    // Four primitives, both sides, but only two sides in play: a directory.
    const r = marketplaceApplicability(withFound(
      ['s1', 'supply'], ['s2', 'supply'], ['d1', 'demand'], ['d2', 'demand']))
    expect(r.applies).toBe(false)
    expect(r.reason).toMatch(/directory rather than a marketplace/)
  })

  it('accepts both sides with matching and a transaction', () => {
    const r = marketplaceApplicability(withFound(
      ['s1', 'supply'], ['d1', 'demand'], ['m1', 'matching'], ['t1', 'transaction']))
    expect(r.applies).toBe(true)
    expect(r.evidence).toHaveLength(4)
  })
})

describe('a "no" says which test it failed', () => {
  // "Not applicable" with no reason is the same ambiguity the whole report is
  // built to remove — a reader cannot tell a judgement from a bug.
  it('names what was looked for and what turned up', () => {
    const r = marketplaceApplicability(withFound(['d1', 'demand'], ['t1', 'transaction']))
    expect(r.applies).toBe(false)
    expect(r.reason).toMatch(/does not appear to be a marketplace/)
    expect(r.reason).toMatch(/What did match/)
    expect(r.reason).toContain('d1')
  })

  it('says plainly that findings were not invented', () => {
    const r = marketplaceApplicability(none())
    expect(r.reason).toMatch(/not manufactured/)
    expect(r.evidence).toEqual([])
    // Nothing matched, so there is no "what did match" clause to write.
    expect(r.reason).not.toMatch(/What did match/)
  })

  it('records the evidence when it does apply, so the reading can be disputed', () => {
    const r = marketplaceApplicability(withFound(
      ['s1', 'supply'], ['d1', 'demand'], ['t1', 'transaction'], ['r1', 'repeat']))
    expect(r.applies).toBe(true)
    expect(r.reason).toMatch(/across 4 sides/)
  })
})
