// Asking whether a measured finding is true, and failing safely when it cannot.
//
// ── What has to hold ─────────────────────────────────────────────────────────
//
// This pass DELETES findings. A false positive in a report is an embarrassment;
// a real security or compliance finding deleted because a 7B model misread it
// is a problem shipped silently, and nobody ever sees the page it should have
// been on. So every test here is about the model behaving badly, and every one
// of those paths has to end with the findings intact.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Finding, Severity } from '../../../src/flowReport/types.js'

const chatJson = vi.fn()
vi.mock('../../../src/flowReport/comprehend/model.js', () => ({
  DEFAULT_MODEL: 'test-model',
  modelStatus: async () => ({ up: true, models: ['test-model'] }),
  chooseModel: () => 'test-model',
  chatJson: (...a: unknown[]) => chatJson(...a),
}))

const { adjudicateSection, excerpt, termsOf } = await import('../../../src/flowReport/comprehend/adjudicate.js')

const finding = (id: string, over: Partial<Finding> = {}): Finding => ({
  id,
  category: 'compliance',
  title: 'A subscription exists; nothing shows the renewal terms being disclosed',
  summary: 'Subscription handling appears in 6 files.',
  severity: 'high' as Severity,
  confidence: 'medium',
  status: 'open',
  impact: 'i',
  recommendation: 'r',
  rationale: 'ra',
  evidence: [{ kind: 'file', path: 'src/newsletter.ts', description: 'd' }],
  claudeCodePrompts: [],
  ...over,
})

const PRODUCT = {
  whatItIs: 'A portfolio site.',
  domain: 'portfolio',
  isTwoSidedMarketplace: false,
  actors: [], coreFlows: [], entities: [], externalServices: [], architecture: '', unknowns: [],
}

const FILES = [{ path: 'src/newsletter.ts', text: 'const url = buildUnsubscribeLink(email)' }]

const run = (findings: Finding[]) =>
  adjudicateSection('Compliance', findings, PRODUCT, FILES)

beforeEach(() => { chatJson.mockReset() })

describe('withdrawing a finding the evidence does not support', () => {
  it('returns the id and the reason', async () => {
    chatJson.mockResolvedValue({
      withdraw: [{ id: 'a', reason: 'the six matches are the word unsubscribe in a mailing list' }],
    })
    const v = await run([finding('a'), finding('b')])
    expect([...v.keys()]).toEqual(['a'])
    expect(v.get('a')!.reason).toMatch(/unsubscribe/)
  })

  it('leaves everything else alone', async () => {
    chatJson.mockResolvedValue({ withdraw: [{ id: 'a', reason: 'x' }] })
    const v = await run([finding('a'), finding('b'), finding('c')])
    expect(v.has('b')).toBe(false)
    expect(v.has('c')).toBe(false)
  })
})

describe('every way this can go wrong keeps the findings', () => {
  it.each([
    ['an empty list', { withdraw: [] }],
    ['no withdraw key', { something: 'else' }],
    ['not an object', 'nonsense'],
    ['null', null],
    ['a list of nonsense', { withdraw: ['a', 42, null] }],
  ])('withdraws nothing on %s', async (_label, reply) => {
    chatJson.mockResolvedValue(reply)
    expect((await run([finding('a'), finding('b')])).size).toBe(0)
  })

  it('withdraws nothing when the model is unreachable', async () => {
    chatJson.mockResolvedValue(null)
    expect((await run([finding('a')])).size).toBe(0)
  })

  // An id nobody sent is a finding the model imagined. Acting on it would
  // delete something by coincidence of naming.
  it('ignores an id that was not sent', async () => {
    chatJson.mockResolvedValue({ withdraw: [{ id: 'never-sent', reason: 'x' }] })
    expect((await run([finding('a')])).size).toBe(0)
  })

  // An unexplained deletion is exactly what this pass exists to avoid: the
  // reason is printed in the report, and without one nothing can be printed.
  it('ignores a withdrawal with no reason', async () => {
    chatJson.mockResolvedValue({ withdraw: [{ id: 'a' }, { id: 'b', reason: '   ' }] })
    expect((await run([finding('a'), finding('b')])).size).toBe(0)
  })

  // A model rejecting almost everything has misunderstood the task rather than
  // found nine false findings — and the result would look exactly like a clean
  // section, which is the one outcome nobody could detect by reading.
  it('discards the whole verdict when it withdraws most of a section', async () => {
    const many = ['a', 'b', 'c', 'd', 'e'].map((id) => finding(id))
    chatJson.mockResolvedValue({
      withdraw: many.map((f) => ({ id: f.id, reason: 'no' })),
    })
    expect((await run(many)).size).toBe(0)
  })

  it('accepts a withdrawal that stays under that share', async () => {
    const many = ['a', 'b', 'c', 'd', 'e'].map((id) => finding(id))
    chatJson.mockResolvedValue({ withdraw: [{ id: 'a', reason: 'no' }, { id: 'b', reason: 'no' }] })
    expect((await run(many)).size).toBe(2)
  })

  it('asks nothing of a section with no findings', async () => {
    expect((await run([])).size).toBe(0)
    expect(chatJson).not.toHaveBeenCalled()
  })
})

describe('what the model is shown', () => {
  it('sends the text around the match, not the whole file', async () => {
    chatJson.mockResolvedValue({ withdraw: [] })
    await run([finding('a')])
    const sent = JSON.parse((chatJson.mock.calls[0]![0] as any)[1].content)
    expect(sent.findings[0].evidence[0].file).toBe('src/newsletter.ts')
    // The point of the whole pass: the model sees that the "subscription"
    // match is actually the word unsubscribe.
    expect(sent.findings[0].evidence[0].excerpt).toMatch(/Unsubscribe/i)
  })

  // The analyser that did the measuring decides this, not the length of the
  // evidence list. Inferring it from an empty list conflates "cites no file"
  // with "reports an absence", and a finding that counts something across the
  // whole repository is the first kind and not the second.
  it('says plainly when a finding reports an absence', async () => {
    chatJson.mockResolvedValue({ withdraw: [] })
    await run([finding('a', {
      requiresManualValidation: true,
      evidence: [{ kind: 'static_analysis', description: 'nothing found' }],
    })])
    const sent = JSON.parse((chatJson.mock.calls[0]![0] as any)[1].content)
    expect(sent.findings[0].reportsAnAbsence).toBe(true)
  })

  it('does not call a finding an absence merely because it cites no file', async () => {
    chatJson.mockResolvedValue({ withdraw: [] })
    await run([finding('a', {
      title: 'Console logging appears throughout the production source',
      evidence: [{ kind: 'static_analysis', description: '128 console calls' }],
    })])
    const sent = JSON.parse((chatJson.mock.calls[0]![0] as any)[1].content)
    expect(sent.findings[0].reportsAnAbsence).toBe(false)
  })

  it('says so when the cited file contains nothing related', async () => {
    chatJson.mockResolvedValue({ withdraw: [] })
    await adjudicateSection('Compliance', [finding('a')], PRODUCT,
      [{ path: 'src/newsletter.ts', text: 'const x = 1' }])
    const sent = JSON.parse((chatJson.mock.calls[0]![0] as any)[1].content)
    expect(sent.findings[0].evidence[0].excerpt).toMatch(/nothing in this file matches/i)
  })
})

describe('finding the evidence inside a file', () => {
  it('takes the distinctive words of the finding', () => {
    const t = termsOf(finding('a'))
    expect(t).toContain('subscription')
    // Short and common words carry no signal and would match everywhere.
    expect(t).not.toContain('the')
    expect(t).not.toContain('nothing')
  })

  it('returns the text around the first term it finds', () => {
    const got = excerpt('aaa bbb subscription_id ccc', ['subscription'], 40)
    expect(got).toMatch(/subscription_id/)
  })

  it('returns null when no term appears', () => {
    expect(excerpt('nothing relevant here', ['subscription'])).toBeNull()
  })

  it('collapses whitespace so an excerpt stays one readable line', () => {
    expect(excerpt('a\n\n   subscription\t\tb', ['subscription'], 60)).not.toMatch(/\n/)
  })
})

// The prompt has always said to keep an absence, and the model withdrew them
// anyway: two of its rules collide on exactly this case, because a finding that
// reports something missing IS "a finding that assumes a capability the product
// does not have". Measured on a real report, nine went that way in one run, and
// the reasons were agreements wearing a rejection — "Make provider signup
// measurable" struck with "the evidence does not support that this product can
// currently measure provider signup funnels", which is the finding restated.
describe('an observation is never withdrawn, because it claims nothing', () => {
  // ── Measured on POSCHI, every run, before any of this was touched ──
  //
  // This pass asks whether the evidence supports the claim. An informational
  // finding makes no claim to support, so the model reaches for the only frame
  // it has and inverts it: "18 monetization endpoint(s) and page(s)" was struck
  // as "the evidence is an absence of monetization endpoints and pages", and
  // "client: 7 of 7 stages have a surface" as "the evidence does not support
  // the absence of surfaces ... as every stage has a route behind it" — the
  // finding, restated as its own refutation.
  const observation = (id: string, over = {}) => finding(id, {
    title: '18 monetization endpoint(s) and page(s)',
    severity: 'info' as const,
    ...over,
  })

  it('ignores a withdrawal aimed at one', async () => {
    chatJson.mockResolvedValue({
      withdraw: [{ id: 'a', reason: 'the evidence is an absence of monetization endpoints' }],
    })
    expect((await run([observation('a'), finding('b')])).has('a')).toBe(false)
  })

  it('ignores one aimed at a finding an analyser typed as an observation', async () => {
    chatJson.mockResolvedValue({ withdraw: [{ id: 'a', reason: 'no evidence' }] })
    const typed = observation('a', { severity: 'low' as const, type: 'observation' as const })
    expect((await run([typed, finding('b')])).has('a')).toBe(false)
  })

  // The report's own statement of what it cannot know is the worst thing to
  // lose: deleting it leaves a reader believing the question was never asked.
  it('keeps a finding that says the repository cannot answer something', async () => {
    chatJson.mockResolvedValue({
      withdraw: [{ id: 'a', reason: 'no evidence of liquidity was found' }],
    })
    const limit = finding('a', {
      title: 'Liquidity is not a question a repository can answer',
      severity: 'info' as const,
    })
    expect((await run([limit, finding('b')])).has('a')).toBe(false)
  })

  it('still withdraws an ordinary finding in the same section', async () => {
    chatJson.mockResolvedValue({
      withdraw: [
        { id: 'a', reason: 'inverted reasoning about a count' },
        { id: 'b', reason: 'the match is the word unsubscribe in a mailing list' },
      ],
    })
    const v = await run([observation('a'), finding('b'), finding('c'), finding('d')])
    expect(v.has('a')).toBe(false)
    expect(v.has('b')).toBe(true)
  })
})

describe('a finding with nothing to show is not ruled on', () => {
  // This pass decides whether an excerpt supports a claim. With no excerpt
  // there is nothing to weigh, and the verdict becomes the model reasoning
  // from the absence of its own input.
  //
  // Measured: "Console logging appears throughout the production source"
  // counts calls across the repository and cites none of them. It was struck
  // with "the evidence list is empty, and the finding reports an absence of
  // console logging" — an absence it does not report, on a label this module
  // had attached itself from the empty path list.
  const uncited = (id: string) => finding(id, {
    title: 'Console logging appears throughout the production source',
    severity: 'low' as const,
    evidence: [{ kind: 'static_analysis' as const, description: '128 console calls' }],
  })

  it('ignores a withdrawal aimed at one', async () => {
    chatJson.mockResolvedValue({
      withdraw: [{ id: 'a', reason: 'the evidence list is empty' }],
    })
    expect((await run([uncited('a'), finding('b')])).has('a')).toBe(false)
  })

  it('still withdraws a finding that does cite a file', async () => {
    chatJson.mockResolvedValue({
      withdraw: [
        { id: 'a', reason: 'empty evidence' },
        { id: 'b', reason: 'the match is the word unsubscribe in a mailing list' },
      ],
    })
    const v = await run([uncited('a'), finding('b'), finding('c'), finding('d')])
    expect(v.has('a')).toBe(false)
    expect(v.has('b')).toBe(true)
  })

  // The label went to the model, and the model acted on it.
  it('tells the model a finding is an absence only when the analyser said so', async () => {
    chatJson.mockResolvedValue({ withdraw: [] })
    await run([uncited('a')])
    const sent = JSON.parse((chatJson.mock.calls[0]![0] as any)[1].content)
    expect(sent.findings[0].reportsAnAbsence).toBe(false)
  })
})

describe('a computed claim is not refutable from three examples', () => {
  // This pass works because reading the matches can refute the list — six
  // files said "subscription" and every one was the word UNsubscribe. A count
  // computed from a complete parse is not a list: "24 foreign key(s) have no
  // index" comes from comparing every reference against every index across 514
  // migrations, and its twelve citations are illustrations. Shown three, the
  // model said the excerpts were incomplete and withdrew it — a true statement
  // about its own input, and a false one about the schema.
  const computed = (id: string) => finding(id, {
    title: '24 foreign key(s) have no index on the referencing column',
    severity: 'medium' as Severity,
    computedFromFullParse: true,
  })

  it('ignores a withdrawal aimed at one', async () => {
    chatJson.mockResolvedValue({
      withdraw: [{ id: 'a', reason: 'some of the excerpts are incomplete' }],
    })
    expect((await run([computed('a'), finding('b')])).has('a')).toBe(false)
  })

  // The founding case of this whole pass, which must keep working.
  it('still withdraws a finding that is a list of matches', async () => {
    chatJson.mockResolvedValue({
      withdraw: [
        { id: 'a', reason: 'excerpts incomplete' },
        { id: 'b', reason: 'the match is the word unsubscribe in a mailing list' },
      ],
    })
    const v = await run([computed('a'), finding('b'), finding('c'), finding('d')])
    expect(v.has('a')).toBe(false)
    expect(v.has('b')).toBe(true)
  })
})

describe('an absence is never withdrawn', () => {
  const absence = (id: string) => finding(id, {
    title: 'No error reporting integration was found',
    requiresManualValidation: true,
  })

  it('ignores a withdrawal aimed at one', async () => {
    chatJson.mockResolvedValue({
      withdraw: [{ id: 'a', reason: 'the evidence does not support that this product reports errors' }],
    })
    expect((await run([absence('a'), finding('b')])).has('a')).toBe(false)
  })

  it('still withdraws an ordinary finding in the same section', async () => {
    chatJson.mockResolvedValue({
      withdraw: [
        { id: 'a', reason: 'agreeing with the absence' },
        { id: 'b', reason: 'the match is the word unsubscribe in a mailing list' },
      ],
    })
    const v = await run([absence('a'), finding('b'), finding('c'), finding('d')])
    expect(v.has('a')).toBe(false)
    expect(v.has('b')).toBe(true)
  })

  // The share guard counts what actually gets withdrawn, so absences removed
  // from the verdict must not push a section over it and void the rest.
  it('does not let a struck absence count towards the withdrawal cap', async () => {
    chatJson.mockResolvedValue({
      withdraw: [
        { id: 'a', reason: 'x' }, { id: 'b', reason: 'x' }, { id: 'c', reason: 'x' },
        { id: 'd', reason: 'a real one' },
      ],
    })
    const v = await run([absence('a'), absence('b'), absence('c'), finding('d'), finding('e')])
    expect(v.has('d')).toBe(true)
  })
})
