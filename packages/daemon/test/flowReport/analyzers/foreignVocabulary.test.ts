// No report may describe a project in another product's words.
//
// ── The defect ───────────────────────────────────────────────────────────────
//
// The analysers were written for one product — a marketplace where providers
// take bookings from clients — and reused against whatever folder somebody
// picks. Reports for a serverless functions suite and a CSS design-system
// builder came back mentioning "booking" 41 times and "stylist" 5 times.
//
// Three separate sources, all fixed and all pinned here:
//
//   1. The marketplace section cleared a structural gate built on regexes as
//      ordinary as /\/profile\b/, so a design tool was handed nine findings
//      about providers and bookings. The description now vetoes it.
//   2. The per-product rewrite was handed that text and faithfully rewrote it
//      in the same vocabulary, turning 24 occurrences into 63.
//   3. Prose baked into the shared analysers named one product's flows —
//      "signup and booking are the candidates", "anything a stylist records
//      about a client" — and leaked regardless of any gate.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Db } from '../../../src/db/db.js'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FlowReportStore } from '../../../src/flowReport/store.js'
import { AnalysisJobManager } from '../../../src/flowReport/jobManager.js'
import { allAnalyzers } from '../../../src/flowReport/analyzers/adapters.js'
import { renderReportMarkdown } from '../../../src/flowReport/report/markdown.js'
import { DEFAULT_SETTINGS, type FlowReportRun } from '../../../src/flowReport/types.js'

/** Nouns belonging to the product the analysers were written for. None of them
 *  can be true of the fixture below, which is a note-taking tool. */
const FOREIGN = /\b(booking|bookings|stylist|stylists|appointment|appointments|salon)\b/gi

/**
 * Prose that assumes a product the fixture is not.
 *
 * The noun list above could not catch these, because every word in them is
 * ordinary English. They were found by reading a report for a portfolio site,
 * which was told that it holds "photographs, measurements, notes about a
 * person's body", that "styling services are plausibly bought for teenagers",
 * and that its terms should say who is responsible "between two people the
 * platform introduced". All three were fixed sentences in findings that fire
 * on every project analysed.
 */
const ASSUMED = [
  /styling (product|service)/i,
  /notes about a person's body/i,
  /photographs, measurements/i,
  /between two people the platform introduced/i,
  /plausibly bought for teenagers/i,
]

/** A description of the fixture, as the comprehension step would produce it.
 *  Stubbed so the suite needs no model — see the note in jobManager. */
const describesANoteTool = async () => ({
  producedBy: 'stub',
  filesRead: ['package.json', 'README.md'],
  reason: null,
  model: {
    whatItIs: 'A note-taking tool for writing and organising plain-text notes.',
    domain: 'note taking',
    isTwoSidedMarketplace: false,
    actors: [{ name: 'Writer', goal: 'Write and find notes' }],
    coreFlows: [{ name: 'Write a note', steps: ['Open the editor', 'Save'] }],
    entities: ['Note', 'Tag'],
    externalServices: [],
    architecture: 'A single-page React application.',
    unknowns: [],
  },
})
const noRewrite = async () => null

/** The evidence check, stubbed. Same reason as the two above: it talks to the
 *  same container. Withdrawing nothing is the neutral answer — every finding
 *  the analysers produced reaches the assertions unchanged. */
const withdrawNothing = async () => new Map()

/** The absence check, stubbed. Same reason as the passes above: it talks to
 *  the same container, one call per absence finding. Checking nothing is the
 *  neutral answer — every absence reaches the assertions as measured. */
const checkNoAbsences = async () => new Map()

/** The per-file location pass, stubbed: one model call per finding, and a
 *  suite that made them would spend a minute proving the container is up. */
const locateNothing = async () => null

/** The buildable brief, stubbed: five fields in one generation, and the most
 *  expensive call in a run. Writing none is the neutral answer — the one-line
 *  recommendation every finding already carries is unaffected. */
const noBrief = async () => null

let dir: string
let markdown: string
let run: FlowReportRun

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'foreign-vocab-'))
  const repo = join(dir, 'notes')
  const write = (rel: string, text: string) => {
    const full = join(repo, rel)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, text)
  }
  mkdirSync(repo, { recursive: true })

  // Deliberately includes the route shapes that used to clear the marketplace
  // gate — /profile, /search, /browse — so this fixture would have failed
  // before the description was allowed to veto.
  write('package.json', JSON.stringify({ name: 'notes', dependencies: { react: '^18.0.0' } }))
  write('README.md', '# Notes\n\nA tool for writing notes.\n')
  write('index.html', '<!doctype html><html lang="en"><head><title>Notes</title></head><body></body></html>')
  write('src/App.tsx', [
    '<Routes>',
    '  <Route path="/profile" element={<Profile />} />',
    '  <Route path="/search" element={<Search />} />',
    '  <Route path="/browse" element={<Browse />} />',
    '</Routes>',
  ].join('\n'))
  write('src/pages/Editor.tsx', 'export default function Editor() { try { save() } catch (e) {} }')

  const store = new FlowReportStore(new Db(join(dir, 'db.sqlite')))
  const manager = new AnalysisJobManager(store, { adjudicate: withdrawNothing as never, verifyAbsences: checkNoAbsences as never, locate: locateNothing as never, writeBrief: noBrief as never,
    comprehend: describesANoteTool, rewrite: noRewrite as never,
  })
  const project = store.createProject({
    name: 'Notes', repositoryDisplayName: 'notes',
    repositoryPath: repo, settings: DEFAULT_SETTINGS,
  })
  const started = await manager.start(project.id, allAnalyzers())
  await manager.wait(started.id)
  run = store.getRun(started.id)!
  markdown = renderReportMarkdown(run, {
    projectName: 'Notes', repositoryDisplayName: 'notes',
    analysisMode: 'Standard', generatedAt: '2026-09-20',
  })
  store.close()
}, 120_000)

afterAll(() => { rmSync(dir, { recursive: true, force: true }) })

describe('a report speaks about the project it analysed', () => {
  it('uses none of another product\'s domain nouns, anywhere', () => {
    const hits = markdown.match(FOREIGN) ?? []
    // Reported with context, because a bare count tells whoever broke this
    // nothing about where to look.
    const where = hits.slice(0, 5).map((h) => {
      const at = markdown.toLowerCase().indexOf(h.toLowerCase())
      return `…${markdown.slice(Math.max(0, at - 70), at + 70).replace(/\n/g, ' ')}…`
    })
    expect(hits, `foreign vocabulary in the report:\n${where.join('\n')}`).toEqual([])
  })

  // ── The product's own NAME, which the noun check could never catch ────────
  //
  // Four security findings were identified as `POSCHI-SEC-001` … `-004`, and
  // the id travels: it is printed beside the finding and named in its own
  // remediation prompt. A report for an unrelated project carried
  // "Implement remediation for POSCHI-SEC-002", which is the clearest possible
  // way to tell a reader the document is not about them.
  //
  // Measured in the stored runs before the rename: one occurrence in each of
  // two unrelated projects' reports, from the one security finding that fired.
  it('never prints the name of the product the analysers were written for', () => {
    const hits = markdown.match(/\bPOSCHI\b/gi) ?? []
    const where = hits.slice(0, 5).map((h) => {
      const at = markdown.toLowerCase().indexOf(h.toLowerCase())
      return `…${markdown.slice(Math.max(0, at - 70), at + 70).replace(/\n/g, ' ')}…`
    })
    expect(hits, `the analysers' original product is named:\n${where.join('\n')}`).toEqual([])
  })

  it('assumes nothing about what the product sells or who buys it', () => {
    for (const p of ASSUMED) {
      const m = p.exec(markdown)
      const where = m
        ? `…${markdown.slice(Math.max(0, m.index - 90), m.index + 90).replace(/\n/g, ' ')}…`
        : ''
      expect(m, `a sentence written for another product:\n${where}`).toBeNull()
    }
  })

  // `provider` is not on the foreign-noun list, because it legitimately means
  // the supply side of a marketplace AND a third-party vendor. What it must
  // never do is arrive here — this fixture is a note-taking tool with neither.
  it('does not describe a note-taking tool as having providers', () => {
    const hits = markdown.match(/\bproviders?\b/gi) ?? []
    const where = hits.slice(0, 5).map((h) => {
      const at = markdown.toLowerCase().indexOf(h.toLowerCase())
      return `…${markdown.slice(Math.max(0, at - 80), at + 80).replace(/\n/g, ' ')}…`
    })
    expect(hits, `"provider" in a report about a note tool:\n${where.join('\n')}`).toEqual([])
  })

  it('does not assess a note-taking tool as a marketplace', () => {
    const market = run.sections.find((s) => s.category === 'marketplace_health')!
    expect(market.status).toBe('not_applicable')
    expect(market.findings).toEqual([])
  })

  // The route shapes above match the structural check. Without the description
  // vetoing it, the section would have run and brought the vocabulary with it.
  it('lets the description overrule a structural match', () => {
    const market = run.sections.find((s) => s.category === 'marketplace_health')!
    expect(market.reason).toMatch(/note-taking tool/i)
    expect(market.reason).toMatch(/not manufactured|was not assessed as one/i)
  })

  // Two gates on one question is one of them being wrong in every report where
  // they differ. A design-system builder carried a section saying "not a
  // marketplace" beside a high-severity finding that opened "This is a
  // marketplace where providers deliver services to clients".
  it('does not assert elsewhere what the marketplace section just denied', () => {
    const compliance = run.sections.find((s) => s.category === 'compliance')!
    for (const f of compliance.findings) {
      expect(`${f.title} ${f.summary}`.toLowerCase(),
        'no finding may call this a marketplace')
        .not.toMatch(/this is a marketplace|paid for work arranged by the platform/)
    }
    expect(compliance.limitations.join(' '))
      .toMatch(/apply only to a marketplace were not assessed/)
  })
})
