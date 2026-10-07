// packages/daemon/src/flowReport/report/charts.ts
//
// FlowReport's charts, drawn as SVG strings before the browser opens.
//
// ── ECharts did not come across ──────────────────────────────────────────────
//
// In FlowAgent these were Apache ECharts rendered server-side to SVG. FlowCode
// has no charting dependency and already draws the same charts by hand, to the
// same specification, for its printed reports (`quality/reportPdf/charts.ts`):
// the score gauge, the severity bar, the section ranking and the findings by
// section. FlowReport's document is built on that shell, so those four come
// from there and are not repeated here.
//
// What is left is FlowReport's own: the word under a score, and the findings
// by area of the codebase, which is the companion to the repository map and
// has no equivalent in FlowCode's other reports.
//
// The reasons for SVG hold either way: a chart still drawing when the PDF is
// printed is a blank rectangle, and an SVG prints as vector art with
// selectable text.
//
// ── A chart repeats; it never introduces ─────────────────────────────────────
//
// Every value drawn here is one the prose also states. The point of a bar is
// that comparing areas by eye is something prose is bad at, not that it
// carries information the sentences lack.

import { scoreColour as fcScoreColour } from '../../quality/reportPdf/charts.js'
import { esc } from '../../quality/reportPdf/markdown.js'
import { ACCENT_ON_LIGHT, BODY_STACK, INK, INK_SECONDARY, SEVERITY_COLOUR } from '../brand.js'
import type { Severity } from '../types.js'

/** Where a score sits. FlowCode's bands, so the gauge the shell draws and any
 *  bar drawn here agree about what colour a score is. */
export const scoreColour = fcScoreColour

/** The word under a score. FlowReport's own words: "Insufficient evidence" is
 *  a legitimate reading and must never become a number. */
export function scoreWord(score: number | null): string {
  if (score === null) return 'Insufficient evidence'
  if (score >= 80) return 'Healthy'
  if (score >= 60) return 'Workable'
  if (score >= 40) return 'Needs work'
  return 'Poor'
}

/** Millimetres to the 96dpi pixels the chart is laid out in. */
const px = (mm: number): number => Math.round(mm * (96 / 25.4))
const r1 = (n: number): number => Math.round(n * 10) / 10

/**
 * Findings per area of the codebase.
 *
 * The companion to the flow diagram: the diagram says what the areas are and
 * how they connect, this says which of them the findings landed in. Coloured by
 * the worst severity present, because a count alone lets twelve informational
 * notes outrank one critical.
 */
export function findingsByAreaChart(
  areas: Array<{ name: string; findings: number; worst: Severity | null }>,
  widthMm = 257,
): string {
  const ranked = [...areas].filter((a) => a.findings > 0)
    .sort((a, b) => b.findings - a.findings).slice(0, 10)
  if (ranked.length === 0) return ''

  const w = px(widthMm)
  const left = 150
  const right = 40
  const rowH = px(7.6)
  const max = Math.max(...ranked.map((a) => a.findings))
  const scale = (w - left - right) / max
  const fit = (v: string): string => (v.length > 22 ? `${v.slice(0, 21)}…` : v)

  const body = ranked.map((a, i) => {
    const mid = 4 + i * rowH + rowH / 2
    const bw = a.findings * scale
    const fill = a.worst ? SEVERITY_COLOUR[a.worst].light : ACCENT_ON_LIGHT
    return `<text x="${left - 10}" y="${r1(mid)}" text-anchor="end" dominant-baseline="central" `
      + `font-size="11" fill="${INK_SECONDARY}">${esc(fit(a.name))}</text>`
      + `<rect x="${left}" y="${r1(mid - 6.5)}" width="${r1(bw)}" height="13" fill="${fill}"/>`
      + `<text x="${r1(left + bw + 8)}" y="${r1(mid)}" dominant-baseline="central" font-size="11" `
      + `font-weight="600" fill="${INK}">${a.findings}</text>`
  }).join('')

  const heightMm = ranked.length * 7.6 + 2.2
  const label = `Findings by area: ${ranked.map((a) => `${a.name} ${a.findings}`).join(', ')}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${widthMm}mm" height="${r1(heightMm)}mm" `
    + `viewBox="0 0 ${w} ${px(heightMm)}" role="img" aria-label="${esc(label)}" `
    + `font-family="${BODY_STACK}">${body}</svg>`
}
