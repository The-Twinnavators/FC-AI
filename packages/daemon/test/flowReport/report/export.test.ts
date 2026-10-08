// The two exports, produced from one run.
//
// The property that matters most: the Markdown and the PDF describe the same
// report. A pair of documents whose severity counts differ is worse than either
// alone, because a reader cannot tell which one is current — so the PDF is
// rendered from the Markdown string rather than from the run, and this checks
// that the numbers survive the trip.
//
// The rest is about what must never appear: a local path, or an unrendered
// section heading that lets a reader mistake a failure for a clean result.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Db } from '../../../src/db/db.js'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FlowReportStore } from '../../../src/flowReport/store.js'
import { AnalysisJobManager } from '../../../src/flowReport/jobManager.js'
import { allAnalyzers } from '../../../src/flowReport/analyzers/adapters.js'
import { renderReportMarkdown } from '../../../src/flowReport/report/markdown.js'
import { writeArtifact, readArtifact } from '../../../src/flowReport/report/artifacts.js'
import { sectionMetrics } from '../../../src/flowReport/report/metrics.js'
import { buildRepoMap } from '../../../src/flowReport/report/repoMap.js'
import type { PdfMeta } from '../../../src/flowReport/report/pdf.js'
import { DEFAULT_SETTINGS, CATEGORY_LABEL, REPORT_CATEGORIES, type FlowReportRun } from '../../../src/flowReport/types.js'

/**
 * The product description, stubbed.
 *
 * The real one talks to a local Ollama: ten to twenty seconds per run, and not
 * running on every machine. A suite that called it would be slow, would fail on
 * a laptop with the container stopped, and would be testing the model rather
 * than the pipeline.
 *
 * Returns a description rather than an absence: an absent model is a
 * legitimate degraded run that raises a warning, and every test that just
 * wants a clean run would have been asserting the degraded path instead.
 */

/** The per-product rewrite, stubbed. Same reason as the description above: it
 *  talks to the same container, and a suite that called it would spend ninety
 *  seconds proving the model can write English. One call per finding now, so
 *  null is the answer for "nothing to add". */
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

const noComprehension = async () => ({
  producedBy: 'stub',
  filesRead: ['package.json'],
  reason: null,
  model: {
    whatItIs: 'A small example web application.',
    domain: 'example',
    isTwoSidedMarketplace: false,
    actors: [{ name: 'User', goal: 'Use the app' }],
    coreFlows: [{ name: 'Open the app', steps: ['Load the page'] }],
    entities: ['Thing'],
    externalServices: [],
    architecture: 'A single-page React application.',
    unknowns: [],
  },
})


let dir: string
let repo: string
let store: FlowReportStore
let run: FlowReportRun
let markdown: string

const write = (rel: string, text: string) => {
  const full = join(repo, rel)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, text)
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'flow-reports-export-'))
  repo = join(dir, 'demo-app')
  mkdirSync(repo, { recursive: true })
  write('package.json', JSON.stringify({
    name: 'demo-app', dependencies: { react: '^18.0.0', 'react-router-dom': '^6.0.0' },
  }))
  write('index.html', '<!doctype html><html lang="en"><head><title>Demo</title></head><body></body></html>')
  write('src/App.tsx', '<Routes><Route path="/" element={<Home />} /></Routes>')
  write('src/pages/Home.tsx', 'export default function Home() { try { go() } catch (e) {} return <div /> }')

  store = new FlowReportStore(new Db(join(dir, 'flow-reports.db')))
  const manager = new AnalysisJobManager(store, { adjudicate: withdrawNothing as never, verifyAbsences: checkNoAbsences as never, locate: locateNothing as never, writeBrief: noBrief as never, comprehend: noComprehension, rewrite: noRewrite as never })
  const project = store.createProject({
    name: 'Demo App', repositoryDisplayName: 'demo-app',
    repositoryPath: repo, settings: DEFAULT_SETTINGS,
  })
  const started = await manager.start(project.id, allAnalyzers())
  await manager.wait(started.id)
  run = store.getRun(started.id)!
  markdown = renderReportMarkdown(run, {
    projectName: 'Demo App',
    repositoryDisplayName: 'demo-app',
    analysisMode: 'Standard',
    generatedAt: '2026-09-19',
  })
}, 120_000)

afterAll(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

/** The drawn pages take their figures from the run, exactly as the job manager
 *  builds them — so a divergence between the two would fail here rather than
 *  reaching a document. */
function metaFor(): PdfMeta {
  const counted = (findings: FlowReportRun['sections'][number]['findings']) =>
    (['critical', 'high', 'medium', 'low', 'info'] as const).reduce((acc, s) => {
      acc[s] = findings.filter((f) => f.severity === s).length
      return acc
    }, {} as Record<'critical' | 'high' | 'medium' | 'low' | 'info', number>)

  return {
    projectName: 'Demo App',
    repositoryDisplayName: 'demo-app',
    analysisMode: 'Standard',
    generatedAt: '2026-09-19',
    runStatus: 'Completed',
    overallScore: run.summary?.overallScore == null
      ? 'Insufficient evidence' : `${run.summary.overallScore} / 100`,
    overallScoreValue: run.summary?.overallScore ?? null,
    severityCounts: run.summary?.severityCounts
      ?? { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    sections: REPORT_CATEGORIES
      .map((c) => run.sections.find((s) => s.category === c))
      .filter((s): s is FlowReportRun['sections'][number] => s !== undefined)
      .map((s) => ({
        category: s.category,
        status: s.status,
        score: s.score,
        findings: s.findings.length,
        counts: counted(s.findings),
        metrics: sectionMetrics(s.findings),
        reason: s.reason ?? null,
      })),
    repoMap: buildRepoMap(
      [{ path: 'package.json' }, { path: 'src/App.tsx' }, { path: 'src/pages/Home.tsx' }],
      run.sections.flatMap((s) => s.findings)),
  }
}

describe('the markdown', () => {
  it('carries a cover, a summary and an appendix', () => {
    expect(markdown).toMatch(/^# Demo App — Repo Report/m)
    expect(markdown).toMatch(/## Executive Summary/)
    expect(markdown).toMatch(/## Appendix/)
    expect(markdown).toMatch(/### Methodology/)
  })

  // All of them, always. A section that failed and is simply absent from the
  // document reads as a section with nothing wrong in it.
  // Not a fixed count: the eleventh section arrived and this kept passing
  // because it iterates the taxonomy. Named for the taxonomy rather than a
  // number so it does not read as stale the next time one is added.
  it('writes a heading for every section in the taxonomy', () => {
    for (const c of REPORT_CATEGORIES) {
      expect(markdown, `${c} should have a heading`).toContain(`## ${CATEGORY_LABEL[c]}`)
    }
  })

  it('says "Insufficient evidence" rather than a number where nothing was scored', () => {
    const unscored = run.sections.filter((s) => s.score === null)
    if (unscored.length > 0) expect(markdown).toMatch(/Insufficient evidence/)
  })

  it('explains how the overall score was calculated', () => {
    expect(markdown).toMatch(/How this score was calculated/)
  })

  it('states that nothing was executed', () => {
    expect(markdown).toMatch(/[Nn]othing.*executed/)
  })

  it('carries a content hash, so a copy can be checked against what was reviewed', () => {
    expect(markdown).toMatch(/Report content hash \(sha256, first 16\): [0-9a-f]{16}/)
  })

  // The guard here used to be `if (prompts.length > 0)`, so a change that
  // stopped producing prompts altogether passed this test in silence. A prompt
  // is one of the three things this report exists to hand over, alongside the
  // markdown and the PDF, so its absence has to fail rather than skip.
  it('produces Claude Code prompts at all', () => {
    const prompts = run.sections.flatMap((s) => s.findings).flatMap((f) => f.claudeCodePrompts)
    expect(prompts.length, 'no finding carried a Claude Code prompt').toBeGreaterThan(0)
  })

  it('renders prompts as fenced blocks that survive conversion', () => {
    expect(markdown).toMatch(/```text/)
    // A disclosure element would arrive in the PDF as escaped tag text.
    expect(markdown).not.toContain('<details>')
  })

  // Six named parts, the same six every time. A heading that is always present
  // makes an empty one visible — "no location, this is an absence" is
  // information, and a missing Where section is indistinguishable from a
  // renderer that dropped it.
  it('answers the same six questions for every finding', () => {
    const findings = run.sections.flatMap((s) => s.findings)
    expect(findings.length).toBeGreaterThan(0)
    const parts = [
      'What was found', 'Where it was found', 'Why it matters',
      'Recommendations', 'What to do', 'Claude Code prompt',
    ]
    for (const p of parts) {
      const n = (markdown.match(new RegExp(`^##### ${p}$`, 'gm')) ?? []).length
      expect(n, `every finding needs a "${p}" part`).toBe(findings.length)
    }
  })

  it('explains each finding in words a non-technical reader can act on', () => {
    // The plain reading names no file and no library; that is the whole point
    // of it being a second register rather than a shorter first one.
    expect(markdown).toMatch(/##### What was found\n\n[A-Z][^\n]{40,}/)
    expect(markdown).toMatch(/\*\*If nothing is done\.\*\*/)
    expect(markdown).toMatch(/All paths are relative to the repository root\./)
  })
})

describe('nothing local escapes into the export', () => {
  it('has no absolute path in the markdown', () => {
    expect(markdown).not.toContain(repo)
    expect(markdown).not.toContain(dir)
  })

  it('names the repository by its display name only', () => {
    expect(markdown).toContain('demo-app')
  })
})

describe('the artifacts on disk', () => {
  it('writes the markdown under the daemon directory, never into the repository', () => {
    const written = writeArtifact(run.id, 'Demo App', 'markdown', markdown)
    expect(written.storageReference).toBe(`${run.id}/${written.filename}`)
    expect(written.storageReference).not.toMatch(/^[A-Za-z]:|^\//)
    expect(written.absolutePath).not.toContain(repo)
    expect(existsSync(written.absolutePath)).toBe(true)
    expect(written.bytes).toBeGreaterThan(0)
    expect(written.sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('reads back exactly what was written', () => {
    const written = writeArtifact(run.id, 'Demo App', 'markdown', markdown)
    const back = readArtifact(written.storageReference)
    expect(back?.toString('utf8')).toBe(markdown)
  })

  it('refuses a reference that tries to climb out of the directory', () => {
    // Well-formed shape, traversing run id: has to be refused loudly.
    expect(() => readArtifact('../x.md')).toThrow(/outside/i)
    // Malformed shape: not a reference at all, so there is nothing to read.
    expect(readArtifact('../../../etc/passwd')).toBeNull()
    expect(readArtifact('nope/missing.md')).toBeNull()
  })

  it('keeps one artifact per format when a run is exported twice', () => {
    store.saveArtifact(run.id, writeArtifact(run.id, 'Demo App', 'markdown', markdown))
    store.saveArtifact(run.id, writeArtifact(run.id, 'Demo App', 'markdown', markdown))
    const artifacts = store.getRun(run.id)!.artifacts.filter((a) => a.format === 'markdown')
    expect(artifacts).toHaveLength(1)
  })
})

// The PDF needs Chromium, which is present for the daemon but is the one part
// of this suite that depends on a binary rather than on code. It is skipped
// rather than failed when the browser cannot launch, and says so — a silent
// skip would let a broken exporter ship.
describe('the pdf', () => {
  // The cover is drawn rather than converted, so its severity chips come from
  // `meta` while the body's table comes from the Markdown. This is the one
  // place the two formats could disagree, so it is the one thing asserted
  // before anything is rendered.
  it('takes its cover counts from the same table the markdown prints', () => {
    const counts = run.summary!.severityCounts
    for (const [label, key] of [
      ['Critical', 'critical'], ['High', 'high'], ['Medium', 'medium'],
      ['Low', 'low'], ['Informational', 'info'],
    ] as const) {
      expect(markdown).toContain(`| ${label} | ${counts[key]} |`)
    }
  })

  // The layout is asserted on the HTML rather than the PDF, because a PDF that
  // renders is not a PDF that looks right. Several defects shipped before this
  // existed and none of them failed a test.
  it('gives every section a title page and a two-column body', async () => {
    const { buildReportHtml } = await import('../../../src/flowReport/report/pdf.js')
    const { html } = buildReportHtml(markdown, metaFor())

    // One divider per section, each carrying its number and its name.
    for (let i = 0; i < REPORT_CATEGORIES.length; i++) {
      const label = CATEGORY_LABEL[REPORT_CATEGORIES[i]!].replace(/&/g, '&amp;')
      expect(html, `${label} needs a title page`)
        .toContain(`<h2 class="d-title">${label}</h2>`)
      expect(html).toContain(`<div class="d-num">${String(i + 1).padStart(2, '0')}</div>`)
    }
    // FlowCode's document shell marks a divider `divider` and a section body `body sec`.
    expect((html.match(/<div class="divider">/g) ?? []).length)
      .toBe(REPORT_CATEGORIES.length)
    expect((html.match(/class="body sec"/g) ?? []).length)
      .toBe(REPORT_CATEGORIES.length)

    // Two columns for prose, one for the things you look at rather than read.
    expect(html).toMatch(/\.body \{[^}]*column-count: 2/)
    expect(html).toMatch(/\.body table, \.body pre[^{]*\{ column-span: all; \}/)

    // Severity is a pill on the line beneath the heading, not the colour of
    // the heading's words: colour carries a scale badly at 10pt and not at all
    // in a photocopy, and the word is inside the pill so the severity survives
    // losing the colour entirely.
    if (run.sections.some((s) => s.findings.length > 0)) {
      expect(html).toMatch(/<span class="sev-pill sev-(critical|high|medium|low|informational)">/)
      expect(html, 'the heading itself stays in ink').not.toMatch(/<h4 class="sev-/)
    }
  })

  it('draws charts as vector SVG, not as a script that runs later', async () => {
    const { buildReportHtml } = await import('../../../src/flowReport/report/pdf.js')
    const { html } = buildReportHtml(markdown, metaFor())
    expect(html).toContain('<svg')
    // Nothing may depend on JavaScript: the page is printed a moment after it
    // loads, and a chart still drawing is a blank rectangle.
    expect(html).not.toContain('<script')
    expect(html).toContain('class="toc"')
  })

  // ── The defect this guards against ─────────────────────────────────────────
  //
  // Chromium's print shrink-to-fit is DOCUMENT-WIDE. The severity chart was
  // rendered at the full 255mm page measure while sitting in a grid column that
  // starts 70mm in, so it reached 325mm; Chromium scaled every page in the file
  // by 257/325 = 0.79, and the full-bleed cover came out with white margins on
  // two sides. Nothing failed — the PDF rendered, the bytes were stable, and
  // the only symptom was that the document looked wrong.
  it('declares no figure wider than the printable page', async () => {
    const { buildReportHtml } = await import('../../../src/flowReport/report/pdf.js')
    const { html } = buildReportHtml(markdown, metaFor())

    const PRINTABLE = 257 // 297mm paper less the 20mm side margins
    const widths = [...html.matchAll(/width="([\d.]+)mm"/g)].map((m) => Number(m[1]))
    expect(widths.length).toBeGreaterThan(0)
    for (const w of widths) {
      expect(w, `a figure declares ${w}mm inside a ${PRINTABLE}mm page`)
        .toBeLessThanOrEqual(PRINTABLE)
    }

    // A figure in a grid has to be told the width of its cell, not the page.
    // The exec grid is 60mm + a 10mm gap + the rest of 257mm.
    expect(html).toMatch(/width="187mm"/)
  })

  // ── FlowCode's palette, not FlowAgent's ───────────────────────────────────
  //
  // In FlowAgent this pinned the magenta and teal duotone. Repo Report now prints
  // in FlowCode's style guide (`quality/reportBrand.ts`), so what is pinned is
  // that: FlowCode's tokens are present, none of FlowAgent's survived the port,
  // and no box carries a thick accent bar down its left edge.
  it("prints in FlowCode's palette, with nothing left of FlowAgent's", async () => {
    const { buildReportHtml } = await import('../../../src/flowReport/report/pdf.js')
    const { html } = buildReportHtml(markdown, metaFor())
    const style = html.slice(html.indexOf('<style>'), html.indexOf('</style>')).toLowerCase()

    for (const hex of ['#05070f', '#d946ef', '#b81fd1', '#863bff', '#0d9488', '#a21caf']) {
      expect(style, `${hex} is FlowAgent's`).not.toContain(hex)
    }
    expect(style).toContain('#0d1119') // FlowCode's canvas, on the cover
    expect(style).toContain('#d0342c') // critical, on paper
    expect(style).toContain('#6d28d9') // the one accent on type
    expect(style).not.toMatch(/border-left:\s*[2-9](\.\d+)?pt/)
    expect(html).toContain('FlowCode <em')
    expect(html).not.toContain('FlowAgent')
  })

  it('sets prompts on a light background, so the report can be printed', async () => {
    const { buildReportHtml } = await import('../../../src/flowReport/report/pdf.js')
    const { html } = buildReportHtml(markdown, metaFor())
    const rule = html.match(/pre\.prompt \{[^}]*\}/)?.[0] ?? ''
    expect(rule).not.toMatch(/background:\s*#(0|1|2)/)
    expect(rule).toContain('#f7f8fa')
  })

  it('renders from that markdown into a real document', async () => {
    const { renderReportPdf } = await import('../../../src/flowReport/report/pdf.js')
    let out
    try {
      out = await renderReportPdf(markdown, metaFor(), { stamp: new Date('2026-09-19T00:00:00Z') })
    } catch (err: any) {
      if (/browserType\.launch|Executable doesn't exist|ENOENT/i.test(String(err?.message))) {
        console.warn('[export.test] Chromium unavailable — PDF render not verified')
        return
      }
      throw err
    }

    expect(out.bytes.subarray(0, 5).toString()).toBe('%PDF-')
    expect(out.bytes.length).toBeGreaterThan(1000)
    expect(out.sha256).toMatch(/^[0-9a-f]{64}$/)
    // Missing brand faces are reported, not hidden. The document still renders.
    expect(Array.isArray(out.missingFonts)).toBe(true)
  }, 120_000)

  // FlowAgent asserted two renders produced the same bytes, which it got by
  // rewriting the PDF's creation date with pdf-lib. FlowCode adds no PDF library,
  // so Chromium's timestamp stands and the bytes differ between renders. What is
  // still pinned is the part that decides what the reader sees: the document
  // built from one run is the same document every time.
  it('builds the same document from the same run every time', async () => {
    const { buildReportHtml } = await import('../../../src/flowReport/report/pdf.js')
    const meta = metaFor()
    // The bolt's gradient id is numbered per drawing so two marks on one page
    // cannot share one; that number is the only thing allowed to differ.
    const norm = (h: string) => h.replace(/fcmark\d+/g, 'fcmark')
    expect(norm(buildReportHtml(markdown, meta).html)).toBe(norm(buildReportHtml(markdown, meta).html))
  })
})

// ── The three things a run has to hand over ─────────────────────────────────
//
// A combined report, one report per domain, and prompts inside both. None of
// this was pinned: the per-domain files in particular were produced by a loop
// nothing asserted, so a refactor could have stopped writing them and every
// test would still have passed.
//
// These are deliberately contract tests rather than content tests. They do not
// care what a section says, only that it is handed over at all.
describe('every run hands over a report per domain', () => {
  const perDomain = () => run.artifacts.filter((a) => a.format.startsWith('markdown:'))

  it('writes one markdown per section that produced a report', () => {
    // Not every section produces one — a section that is not applicable has
    // nothing to write — so this is checked against the sections that ran
    // rather than against the taxonomy.
    const reported = run.sections.filter((s) => s.status !== 'skipped')
    expect(perDomain().length, 'per-domain reports are missing').toBeGreaterThan(0)
    expect(perDomain().length).toBeLessThanOrEqual(reported.length)
  })

  it('names each one after the section it covers', () => {
    for (const a of perDomain()) {
      const category = a.format.slice('markdown:'.length)
      expect(REPORT_CATEGORIES, `${a.format} is not a known section`).toContain(category)
    }
  })

  it('writes the combined report as well as the per-domain ones', () => {
    expect(run.artifacts.some((a) => a.format === 'markdown')).toBe(true)
  })

  it('gives every per-domain report its own file', () => {
    const names = perDomain().map((a) => a.filename)
    expect(new Set(names).size, 'two sections share a filename').toBe(names.length)
  })
})
