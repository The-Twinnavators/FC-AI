// The plain reading of a finding.
//
// ── What these tests are actually guarding ───────────────────────────────────
//
// This layer restates a finding in ordinary words, and its own rule is that it
// may never assert a fact the finding does not carry. The way it breaks that
// rule is not by inventing a sentence — the sentences are all written by hand —
// it is by attaching one of them to the wrong finding.
//
// It happened. A monetization finding titled "19 monetization endpoint(s) and
// page(s)", whose evidence was a list of invoice, checkout and Stripe Connect
// routes, was printed under:
//
//   "The signup asks for an age or a date of birth."
//   "Collecting it brings obligations about children's data…"
//
// at high confidence. Nothing in the finding was about age. The rule matched
// `/age/` against the title, and "pages" contains "age".
//
// That is worse than a missing explanation. A reader cannot tell which sentence
// was matched and which was measured, so one wrong attachment puts every plain
// reading in the report in question — and this one attached a children's-data
// claim to a billing inventory.
//
// So the tests below are mostly negative. They assert that titles from one
// domain do not pick up prose from another, using the words that actually
// collide: page, package, storage, message, coverage, minor, URLs.

import { describe, it, expect } from 'vitest'
import { describePlainly, isGenericReading } from '../../../src/flowReport/report/plainLanguage.js'
import type { Finding, ReportCategory } from '../../../src/flowReport/types.js'

const finding = (title: string, category: ReportCategory, over: Partial<Finding> = {}): Finding => ({
  id: 'f1',
  category,
  title,
  severity: 'info',
  summary: 'The analyser said this.',
  evidence: [],
  recommendation: 'Do the thing.',
  ...over,
} as unknown as Finding)

/** Every sentence this layer can print for a finding, as one string. */
const said = (f: Finding) => {
  const p = describePlainly(f)
  return `${p.what} ${p.soWhat} ${p.ifIgnored}`
}

// ── The one that shipped ─────────────────────────────────────────────────────

describe('a finding never picks up another finding\'s claim', () => {
  const THE_BUG = finding('19 monetization endpoint(s) and page(s)', 'monetization')

  it('does not read a billing inventory as a question about children\'s data', () => {
    const text = said(THE_BUG)
    expect(text).not.toMatch(/date of birth/i)
    expect(text).not.toMatch(/children/i)
    expect(text).not.toMatch(/signup asks/i)
  })

  it('falls back to the generic reading rather than to a wrong one', () => {
    expect(isGenericReading(THE_BUG)).toBe(true)
  })

  // The words that collide, each in a title from a section that has nothing to
  // do with the rule they used to trigger.
  const CHILDREN = /date of birth|children/i
  const COLLISIONS: Array<[string, ReportCategory, RegExp]> = [
    ['12 marketing page(s) have no meta description', 'marketing_opportunity', CHILDREN],
    ['4 package(s) are a major version behind', 'engineering_quality', CHILDREN],
    ['Local storage is used for the cart', 'engineering_quality', CHILDREN],
    ['8 message(s) use two different vocabularies', 'role_journeys', CHILDREN],
    ['Error coverage is partial', 'engineering_quality', CHILDREN],
    ['Average payload is 2.1 MB', 'engineering_quality', CHILDREN],
    ['14 image(s) are served uncompressed', 'seo', CHILDREN],
    ['A minor inconsistency in button labels', 'role_journeys', CHILDREN],
    ['31 URLs are written into the code', 'engineering_quality', /row-level|who may see what/i],
  ]

  it.each(COLLISIONS)('%s does not acquire prose about something else', (title, category, wrong) => {
    expect(said(finding(title, category))).not.toMatch(wrong)
  })
})

// ── The rules still do their job ─────────────────────────────────────────────
//
// Tightening a regex can silence it. These pin the findings each rule exists
// for, so a fix for over-matching cannot quietly become under-matching.

describe('the findings each rule was written for still match', () => {
  it('reads the age gate finding', () => {
    const f = finding('Age or date of birth appears in signup', 'compliance')
    expect(isGenericReading(f)).toBe(false)
    expect(describePlainly(f).what).toMatch(/signup asks for an age/i)
  })

  it('reads the row-level security finding', () => {
    const f = finding('Row-level security is on with no policies', 'data_architecture')
    expect(describePlainly(f).what).toMatch(/restrict who can see which rows/i)
  })

  it('reads the renewal terms finding, in its own section', () => {
    const f = finding('Subscription renewal terms are not shown at signup', 'compliance')
    expect(describePlainly(f).what).toMatch(/charges people again on a schedule/i)
  })

  // The same word, in the section that only counts routes. An inventory cannot
  // support a claim about what a signup screen displays.
  it('does not read a subscription inventory as a statement about signup', () => {
    const f = finding('2 subscription plan(s) are defined in code', 'monetization')
    expect(said(f)).not.toMatch(/before they agree|charges people again/i)
  })
})

// ── Saying the opposite of the finding ───────────────────────────────────────
//
// The other way to attach a wrong sentence: one rule, two findings, and prose
// written for only one of them. "The document language is not declared" was
// printed under "The pages state which language they are written in."

describe('a rule covering a presence and an absence says which it found', () => {
  it('reads the absence as an absence', () => {
    const f = finding('The document language is not declared', 'seo')
    expect(describePlainly(f).what).toMatch(/do not state which language/i)
  })

  it('still reads the presence as a presence', () => {
    const f = finding('The document language is declared', 'seo')
    expect(describePlainly(f).what).toMatch(/^The pages state which language/i)
  })
})

// ── The promise the layer makes ──────────────────────────────────────────────

describe('it always says something, and labels what it could not', () => {
  it('returns a reading for a finding no rule covers', () => {
    const f = finding('Something no rule anticipated', 'engineering_quality')
    const p = describePlainly(f)
    expect(p.what).toBeTruthy()
    expect(p.soWhat).toBeTruthy()
    expect(p.ifIgnored).toBeTruthy()
  })

  it('admits when the reading is the generic one', () => {
    expect(isGenericReading(finding('Something no rule anticipated', 'engineering_quality')))
      .toBe(true)
  })

  // An absence read as a fact is the failure this whole report is built to
  // avoid, and the generic path is where it would slip through.
  it('speaks an unverified absence as one', () => {
    const f = finding('No rule covers this', 'security_qa', {
      requiresManualValidation: true,
    } as Partial<Finding>)
    expect(describePlainly(f).what).toMatch(/not the same as it not existing/i)
  })
})
