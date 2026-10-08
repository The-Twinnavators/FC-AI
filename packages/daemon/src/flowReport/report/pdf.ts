// packages/daemon/src/flowReport/report/pdf.ts
//
// The PDF, rendered from the Markdown rather than from the run.
//
// ── Why it converts a string instead of reading the run ──────────────────────
//
// If this walked the run object it would be a second implementation of the
// report, and the two would disagree the first time one changed. Converting the
// exact Markdown that gets written to disk means the PDF cannot claim a
// different severity count from its own .md. The covers and dividers are drawn,
// so their figures come in through `meta` — built by the same caller in the
// same breath as the Markdown, with tests asserting the two agree.
//
// ── It is FlowCode's document now ────────────────────────────────────────────
//
// FlowAgent's version drew its own document: FlowAgent's palette, ECharts for
// the charts, pdf-lib to stamp the metadata. FlowCode already has a port of that
// very document for its printed reports (`quality/reportPdf/document.ts`) —
// FlowCode's brand, its embedded faces, hand-drawn SVG charts, no accent bars
// down the left of boxes, and the code-span placeholder fix. So this builds
// FlowCode's report meta from Repo Report's and hands it to that shell, adding
// the two things only Repo Report has: the description of the product on the
// glance page, and the map of the codebase on a page of its own.
//
// The rules the shell keeps are Repo Report's rules: nothing set bolder than
// semibold, one dark page and the rest print, two columns with charts and
// prompts spanning both, and a document that flows rather than being paginated
// sheet by sheet.
//
// ── What did not come across ─────────────────────────────────────────────────
//
// The byte-stable stamp. FlowAgent rewrote the PDF's creation date with pdf-lib
// so two renders of one run produced identical bytes. FlowCode has no PDF
// library and adds none, so Chromium's own timestamp stands: the sha256 is still
// recorded against each artifact, it just describes that file rather than every
// possible render of the run. `stamp` is still accepted so callers need not
// change, and it sets the date printed in the document.

import { createHash } from 'node:crypto'
import { buildReportHtml as buildShellHtml, renderReportPdf as renderShellPdf, type ReportMeta, type ReportSectionMeta } from '../../quality/reportPdf/document.js'
import { markdownToHtml } from '../../quality/reportPdf/markdown.js'
import { BrowserSession } from '../../quality/preview.js'
import type { ProcessManager } from '../../commands/processManager.js'
import type { Severity as FcSeverity } from '../../quality/buildAnalysis.js'
import { findingsByAreaChart, scoreWord } from './charts.js'
import { renderFlowDiagram, flowDiagramCaption, type RepoMap } from './repoMap.js'
import { PRODUCT_HEADING } from './markdown.js'
import type { Metric } from './metrics.js'
import { CATEGORY_LABEL, CATEGORY_SCOPE, type ReportCategory, type Severity } from '../types.js'

export interface PdfSection {
  category: ReportCategory
  status: string
  score: number | null
  findings: number
  counts: Record<Severity, number>
  /** The figures worth setting large on the divider. May be empty. */
  metrics: Metric[]
  /** Why the section is empty or partial, when it is. */
  reason?: string | null
}

export interface PdfMeta {
  projectName: string
  repositoryDisplayName: string
  analysisMode: string
  generatedAt: string
  runStatus: string
  /** Printed as given — "Insufficient evidence" is a legitimate value and must
   *  not be turned into a number by this layer. */
  overallScore: string
  /** The number behind `overallScore`, for the gauge. Null when there is none. */
  overallScoreValue: number | null
  /** Drawn on the cover. Must come from the same run object that produced the
   *  Markdown, because the Markdown's own table is the authority. */
  severityCounts: Record<Severity, number>
  /** In report order. Drives the contents page and the divider pages. */
  sections: PdfSection[]
  /** Null when the scan produced nothing to map. */
  repoMap: RepoMap | null
}

export interface RenderedPdf {
  bytes: Buffer
  sha256: string
  /** Brand faces that were not on disk. The document still renders; it just
   *  renders in something else, and a caller that wants to say so can. */
  missingFonts: string[]
}

/** Repo Report says `info`; FlowCode's shell says `informational`. Same count. */
const toShellCounts = (c: Record<Severity, number>): Record<FcSeverity, number> => ({
  critical: c.critical ?? 0, high: c.high ?? 0, medium: c.medium ?? 0, low: c.low ?? 0,
  informational: c.info ?? 0,
})

/** The standfirst. True of every run: the analysis reads files and nothing
 *  else. What a model was shown is stated in the report itself. */
const STANDFIRST = 'A reading of one repository: what was found, where it was found, why it matters, '
  + 'and what to do about it. Produced by reading files — nothing was executed, no dependency was '
  + 'installed, and the code was not run.'

/**
 * Repo Report's meta, as FlowCode's shell reads it.
 *
 * Every figure is passed through, not recomputed. The section heading is the
 * label the Markdown writes (`## Security QA`), which is how the shell finds
 * each section's body.
 */
export function shellMeta(markdown: string, meta: PdfMeta): ReportMeta {
  const sections: ReportSectionMeta[] = meta.sections.map((s) => {
    const label = CATEGORY_LABEL[s.category] ?? s.category
    const scope = CATEGORY_SCOPE[s.category]
    return {
      id: s.category,
      heading: label,
      title: label,
      status: s.status,
      score: s.score,
      word: scoreWord(s.score),
      findings: s.findings,
      counts: toShellCounts(s.counts),
      examines: scope?.covers ?? '',
      limits: scope?.excludes ?? '',
      metrics: s.metrics.map((m) => ({ value: m.value, label: m.label })),
      ...(s.reason ? { reason: s.reason } : {}),
    }
  })

  // The description of the product belongs with the numbers: a reader who does
  // not already know the project cannot judge a score about it. Taken from the
  // Markdown, so it is the same words the .md carries.
  const product = productSection(markdown)
  const flow = meta.repoMap ? renderFlowDiagram(meta.repoMap) : ''
  const byArea = meta.repoMap ? findingsByAreaChart(meta.repoMap.areas) : ''

  return {
    kind: 'Repository report',
    title: meta.projectName,
    standfirst: STANDFIRST,
    credit: 'FlowCode AI · Repo Report',
    scoreLabel: 'Overall health',
    overallScore: meta.overallScoreValue,
    // The shell prints the number; Repo Report's own score text says what a
    // missing one means, so it is what goes under the gauge.
    verdict: meta.overallScoreValue === null ? meta.overallScore : scoreWord(meta.overallScoreValue),
    counts: toShellCounts(meta.severityCounts),
    facts: [
      { label: 'Repository', value: meta.repositoryDisplayName },
      { label: 'Generated', value: meta.generatedAt },
      { label: 'Analysis mode', value: meta.analysisMode },
      { label: 'Run status', value: meta.runStatus },
    ],
    generatedAt: meta.generatedAt,
    sections,
    glanceIntro: product ? `<div class="body">${markdownToHtml(product)}</div>` : undefined,
    omitFrontMatter: [PRODUCT_HEADING],
    extraPages: [{
      title: 'Where this lives in the codebase',
      lede: 'The areas the project is made of, how they feed each other, and which of them the '
        + 'findings landed in — so a developer can go to the right folder before reading a single finding.',
      html: (flow || '<div class="fig-empty">No files were read, so there is no structure to draw.</div>')
        + (meta.repoMap ? `<p class="fig-cap">${escapeHtml(flowDiagramCaption(meta.repoMap))}</p>` : '')
        + (byArea ? `<div class="fig-block"><div class="fig-title">Findings by area</div><div class="fig">${byArea}</div></div>` : ''),
    }],
  }
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** The body under `## What this product is`, skipping fenced blocks so a
 *  heading inside a prompt cannot end it early. */
function productSection(markdown: string): string | null {
  const lines = markdown.split('\n')
  let fenced = false
  let inside = false
  const body: string[] = []
  for (const ln of lines) {
    if (/^```/.test(ln)) fenced = !fenced
    const h = !fenced && /^##\s+(.*)$/.exec(ln)
    if (h) {
      if (inside) break
      inside = h[1]!.trim() === PRODUCT_HEADING
      continue
    }
    if (inside) body.push(ln)
  }
  return inside || body.length > 0 ? body.join('\n') : null
}

/**
 * The document, as HTML.
 *
 * Separated from the render so the layout can be opened in a browser and looked
 * at without producing a PDF. A stylesheet nobody has seen rendered is a
 * stylesheet nobody has checked.
 */
export function buildReportHtml(markdown: string, meta: PdfMeta): {
  html: string
  missingFonts: string[]
} {
  return buildShellHtml(markdown, shellMeta(markdown, meta))
}

/**
 * Render the report.
 *
 * Launches a browser of its own and closes it whatever happens. `processes`,
 * when given, registers Chromium with FlowCode's process manager so a browser
 * left behind by a crash is found and stopped like any other.
 */
export async function renderReportPdf(
  markdown: string,
  meta: PdfMeta,
  o: { stamp: Date; runId?: string; processes?: ProcessManager },
): Promise<RenderedPdf> {
  const session = await BrowserSession.launch(o.runId ?? 'flow-report', o.processes)
  try {
    const { bytes, missingFonts } = await renderShellPdf(session, markdown, shellMeta(markdown, meta))
    return { bytes, sha256: createHash('sha256').update(bytes).digest('hex'), missingFonts }
  } finally {
    await session.close()
  }
}
