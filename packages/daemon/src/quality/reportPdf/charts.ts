/**
 * The report charts, drawn as SVG strings before the browser opens (ported from Repo Report's charts.ts).
 *
 * Repo Report renders these with ECharts' server-side SVG renderer; FlowCode has no charting dependency, so they are
 * drawn by hand to the same specification instead. The reasons for SVG hold either way: a chart still drawing when
 * page.pdf() runs is a blank rectangle, a canvas chart prints as a soft bitmap, and an SVG arrives as vector art with
 * selectable text. Every chart repeats a number the Markdown states in words; none introduces one.
 */
import type { Severity } from "../buildAnalysis.js";
import { BODY_STACK, INK, INK_SECONDARY, INK_TERTIARY, SEVERITY_COLOUR, SUCCESS, WASH_STRONG } from "../reportBrand.js";
import { esc } from "./markdown.js";

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "informational"];
const SEVERITY_NAME: Record<Severity, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low", informational: "Informational" };

/** Millimetres to the 96dpi px the charts are laid out in; the root carries mm so it scales to the column it lands in. */
const px = (mm: number) => Math.round(mm * (96 / 25.4));
const r1 = (n: number) => Math.round(n * 10) / 10;
/** A rough Manrope advance width, for laying out legends; generous so labels never collide. */
const textW = (s: string, size: number) => s.length * size * 0.58;

function svg(widthMm: number, heightMm: number, label: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${widthMm}mm" height="${r1(heightMm)}mm" viewBox="0 0 ${px(widthMm)} ${px(heightMm)}" role="img" aria-label="${esc(label)}" font-family="${BODY_STACK}">${body}</svg>`;
}

/**
 * Where a score sits, in bands rather than a gradient (nobody can tell 61 from 64 by hue). The bands are FlowCode's
 * verdict thresholds (Strong 85, Workable 70, Needs work 50); the middle band is deliberately colourless, because
 * "workable" is neither good news nor a problem.
 */
export function scoreColour(score: number | null): string {
  if (score === null) return INK_TERTIARY;
  if (score >= 85) return SUCCESS.light;
  if (score >= 70) return INK_SECONDARY;
  if (score >= 50) return SEVERITY_COLOUR.high.light;
  return SEVERITY_COLOUR.critical.light;
}

/** The headline score as a near-complete ring: one even stroke, square ends, a gap at the foot so it reads as a scale. */
export function overallGauge(score: number | null, widthMm = 56): string {
  const s = px(widthMm);
  const c = s / 2;
  const stroke = s * 0.06;
  const r = s * 0.46 - stroke / 2;
  const gap = 8;
  const span = 360 - gap;
  // Angles clockwise from twelve o'clock; the ring starts just left of the foot and runs round to just right of it.
  const at = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${r1(c + r * Math.sin(a))} ${r1(c - r * Math.cos(a))}`;
  };
  const arc = (from: number, sweep: number) => `M ${at(from)} A ${r1(r)} ${r1(r)} 0 ${sweep > 180 ? 1 : 0} 1 ${at(from + sweep)}`;
  const start = 180 + gap / 2;
  const colour = scoreColour(score);
  const track = `<path d="${arc(start, span)}" fill="none" stroke="${score === null ? WASH_STRONG : colour}" stroke-opacity="${score === null ? 1 : 0.14}" stroke-width="${r1(stroke)}"/>`;
  const progress = score !== null && score > 0 ? `<path d="${arc(start, (span * Math.min(100, score)) / 100)}" fill="none" stroke="${colour}" stroke-width="${r1(stroke)}"/>` : "";
  const text =
    score === null
      ? `<text x="${c}" y="${r1(c)}" text-anchor="middle" dominant-baseline="central" font-size="${r1(s * 0.064)}" font-weight="600" fill="${INK_TERTIARY}">No score</text>`
      : `<text x="${c}" y="${r1(c - s * 0.15)}" text-anchor="middle" dominant-baseline="central" font-size="${r1(s * 0.046)}" fill="${INK_TERTIARY}">Score</text>` +
        `<text x="${c}" y="${r1(c + s * 0.02)}" text-anchor="middle" dominant-baseline="central" font-size="${r1(s * 0.165)}" font-weight="600" fill="${INK}">${score}</text>`;
  return svg(widthMm, widthMm, score === null ? "No overall score" : `Score ${score} out of 100`, track + progress + text);
}

/**
 * The severity mix as one proportional bar. A severity with no findings takes no width but keeps its legend entry,
 * because "none of these" is the useful thing to be able to see.
 */
export function severityDistribution(counts: Record<Severity, number>, widthMm = 187): string {
  const total = SEVERITIES.reduce((n, s) => n + (counts[s] ?? 0), 0);
  if (total === 0) return "";
  const w = px(widthMm);
  const barH = 26;
  let x = 0;
  const bars = SEVERITIES.map((s) => {
    const n = counts[s] ?? 0;
    if (!n) return "";
    const bw = (w * n) / total;
    const out = `<rect x="${r1(x)}" y="4" width="${r1(bw)}" height="${barH}" fill="${SEVERITY_COLOUR[s].light}"/>${n / total > 0.06 ? `<text x="${r1(x + bw / 2)}" y="${4 + barH / 2}" text-anchor="middle" dominant-baseline="central" font-size="12" font-weight="600" fill="#ffffff">${n}</text>` : ""}`;
    x += bw;
    return out;
  }).join("");
  let lx = 0;
  const legend = SEVERITIES.map((s) => {
    const label = `${SEVERITY_NAME[s]} (${counts[s] ?? 0})`;
    const item = `<rect x="${r1(lx)}" y="${barH + 22}" width="11" height="11" fill="${SEVERITY_COLOUR[s].light}"/><text x="${r1(lx + 16)}" y="${barH + 27.5}" dominant-baseline="central" font-size="11" fill="${INK_SECONDARY}">${esc(label)}</text>`;
    lx += 16 + textW(label, 11) + 18;
    return item;
  }).join("");
  return svg(widthMm, 18, `Findings by severity: ${SEVERITIES.map((s) => `${counts[s] ?? 0} ${s}`).join(", ")}`, bars + legend);
}

export interface RankRow {
  label: string;
  score: number | null;
  findings: number;
}

/**
 * The sections ranked worst first, because the question a reader brings to this page is "where is the problem".
 * Unscored sections sit at the bottom with an empty track and the words, so nobody reads them as zero.
 */
export function sectionRankingChart(rows: RankRow[], widthMm = 257): string {
  if (!rows.length) return "";
  const ordered = [...rows].sort((a, b) => {
    if (a.score === null && b.score === null) return a.label.localeCompare(b.label);
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    return a.score - b.score;
  });
  const w = px(widthMm);
  const left = 150;
  const right = 56;
  const rowH = px(7.6);
  const track = w - left - right;
  const body = ordered
    .map((r, i) => {
      const y = 4 + i * rowH;
      const mid = y + rowH / 2;
      return (
        `<text x="${left - 10}" y="${r1(mid)}" text-anchor="end" dominant-baseline="central" font-size="11" fill="${INK_SECONDARY}">${esc(r.label)}</text>` +
        `<rect x="${left}" y="${r1(mid - 6.5)}" width="${track}" height="13" fill="${WASH_STRONG}"/>` +
        (r.score ? `<rect x="${left}" y="${r1(mid - 6.5)}" width="${r1((track * Math.min(100, r.score)) / 100)}" height="13" fill="${scoreColour(r.score)}"/>` : "") +
        `<text x="${left + track + 8}" y="${r1(mid)}" dominant-baseline="central" font-size="11" font-weight="600" fill="${r.score === null ? INK_TERTIARY : INK}">${r.score === null ? "no score" : r.score}</text>`
      );
    })
    .join("");
  return svg(widthMm, Math.max(20, ordered.length * 7.6 + 2.2), `Section scores, worst first: ${ordered.map((r) => `${r.label} ${r.score ?? "no score"}`).join(", ")}`, body);
}

/**
 * Open findings per section, stacked by severity. The ranking says which section is worst; this says worst in what
 * way: a section scoring badly on one critical and one scoring the same on nine mediums are different problems.
 */
export function findingsBySectionChart(rows: Array<{ label: string; counts: Record<Severity, number> }>, widthMm = 257): string {
  const total = (r: (typeof rows)[number]) => SEVERITIES.reduce((n, s) => n + (r.counts[s] ?? 0), 0);
  const ordered = rows.filter((r) => total(r) > 0).sort((a, b) => total(b) - total(a));
  if (!ordered.length) return "";
  const w = px(widthMm);
  const left = 150;
  const right = 40;
  const rowH = px(7.6);
  const max = Math.max(...ordered.map(total));
  const scale = (w - left - right) / max;
  const body = ordered
    .map((r, i) => {
      const mid = 4 + i * rowH + rowH / 2;
      let x = left;
      const segs = SEVERITIES.map((s) => {
        const n = r.counts[s] ?? 0;
        if (!n) return "";
        const seg = `<rect x="${r1(x)}" y="${r1(mid - 6.5)}" width="${r1(n * scale)}" height="13" fill="${SEVERITY_COLOUR[s].light}"/>`;
        x += n * scale;
        return seg;
      }).join("");
      return `<text x="${left - 10}" y="${r1(mid)}" text-anchor="end" dominant-baseline="central" font-size="11" fill="${INK_SECONDARY}">${esc(r.label)}</text>${segs}<text x="${r1(x + 8)}" y="${r1(mid)}" dominant-baseline="central" font-size="11" font-weight="600" fill="${INK}">${total(r)}</text>`;
    })
    .join("");
  const ly = 4 + ordered.length * rowH + 14;
  let lx = left;
  const legend = SEVERITIES.map((s) => {
    const item = `<rect x="${r1(lx)}" y="${r1(ly - 5.5)}" width="11" height="11" fill="${SEVERITY_COLOUR[s].light}"/><text x="${r1(lx + 16)}" y="${r1(ly)}" dominant-baseline="central" font-size="10.5" fill="${INK_SECONDARY}">${SEVERITY_NAME[s]}</text>`;
    lx += 16 + textW(SEVERITY_NAME[s], 10.5) + 16;
    return item;
  }).join("");
  return svg(widthMm, ordered.length * 7.6 + 9, `Open findings by section: ${ordered.map((r) => `${r.label} ${total(r)}`).join(", ")}`, body + legend);
}
