/**
 * The repo reports' PDF, rendered from the report's Markdown (a port of FlowMap's FlowReport pdf.ts).
 *
 * Why it converts a string instead of reading the report: walking the report object would be a second
 * implementation of it, and the two would disagree the first time one changed. Converting the exact Markdown the
 * .md export contains means the PDF cannot claim a different count. The cover and the section dividers are drawn,
 * so their figures come in through `meta`, built by the same caller from the same report, with tests asserting the
 * two agree.
 *
 * The rules it keeps:
 * - Nothing is set bolder than semibold (600), headings included. Hierarchy is carried by size, colour and space; a
 *   page where every heading, label and emphasis is bold has no emphasis left to give.
 * - One dark page. The cover is the app's canvas, full bleed; everything else prints on white, because these reports
 *   are meant to be handed around and a reversed page every few pages is a document nobody prints twice.
 * - Two columns. A 257mm measure is about twice what anybody reads comfortably, so section bodies set in two columns.
 *   Tables, charts, callout strips and prompts span both: each is something you look at rather than read, and each
 *   is unusable at half width.
 * - No accent bars down the left of boxes: notes and prompts are set apart with a fill and a hairline instead.
 * - It flows. There is no per-sheet repaginate or zoom pass; Chromium paginates, with break rules keeping a figure
 *   with its title and a prompt in one piece.
 */
import type { App } from "../../app.js";
import { BrowserSession } from "../preview.js";
import type { Severity } from "../buildAnalysis.js";
import {
  ACCENT,
  ACCENT_ON_LIGHT,
  BODY_STACK,
  BORDER_DARK,
  BORDER_DARK_STRONG,
  BORDER_LIGHT,
  BORDER_LIGHT_STRONG,
  CANVAS,
  COVER_GRADIENT,
  HEADING_STACK,
  INK,
  INK_SECONDARY,
  INK_TERTIARY,
  MONO_STACK,
  SEVERITY_COLOUR,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_TERTIARY,
  WASH,
  WASH_STRONG,
  boltMark,
  reportFontFace,
  wordmark,
} from "../reportBrand.js";
import { findingsBySectionChart, overallGauge, sectionRankingChart, severityDistribution } from "./charts.js";
import { sectionIcon } from "./figures.js";
import { esc, markdownToHtml, splitByH2 } from "./markdown.js";

export const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "informational"];
/** The words the Markdown uses. The PDF's chips use the short form for informational only. */
export const SEVERITY_LABEL: Record<Severity, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low", informational: "Informational" };
const CHIP_LABEL: Record<Severity, string> = { ...SEVERITY_LABEL, informational: "Info" };

export interface ReportSectionMeta {
  /** The section's id (picks its icon). */
  id: string;
  /** The exact `## ` heading the Markdown gives this section: how the PDF finds its body. */
  heading: string;
  title: string;
  /** Printed as given ("Completed", "Not run", "Not applicable"). */
  status: string;
  score: number | null;
  /** The word under the section's gauge (the verdict, or "No score"). */
  word: string;
  findings: number;
  counts: Record<Severity, number>;
  examines: string;
  limits: string;
  /** Figures worth setting large on the divider. May be empty. */
  metrics: Array<{ value: string; label: string }>;
  /** Why the section is empty or unscored, when it is. */
  reason?: string;
}

export interface ReportMeta {
  /** "Build analysis" or "Compliance report": the cover kicker and the running header. */
  kind: string;
  title: string;
  standfirst: string;
  /** Set in a hairline box on the cover (the compliance disclaimer, the checks-not-run statement). */
  notice?: string;
  /** The cover's credit line, e.g. "FlowCode AI · Repo tools". */
  credit: string;
  scoreLabel: string;
  overallScore: number | null;
  verdict: string;
  /** Drawn on the cover; must come from the same report the Markdown's severity table was written from. */
  counts: Record<Severity, number>;
  /** Up to four label/value pairs along the foot of the cover. */
  facts: Array<{ label: string; value: string }>;
  generatedAt: string;
  /** In report order. Drives the contents page, the charts and the dividers. */
  sections: ReportSectionMeta[];
  /**
   * FlowReport's additions (both optional, so the repo tools' reports are unchanged without them):
   * - `glanceIntro`: HTML set on the glance page above the gauge. FlowReport puts the description of the product
   *   there, because a reader who does not know the project cannot judge a score about it.
   * - `extraPages`: whole pages after the glance page (FlowReport's map of the codebase).
   * - `omitFrontMatter`: `## ` headings that are not printed as front matter because a hook above already placed them.
   */
  glanceIntro?: string;
  extraPages?: Array<{ title: string; lede: string; html: string }>;
  omitFrontMatter?: string[];
}

// ───────────────────────── drawn pieces ─────────────────────────

function severityChips(counts: Record<Severity, number>, dark: boolean): string {
  return (
    `<div class="chips${dark ? " on-dark" : ""}">` +
    SEVERITIES.map((s) => {
      const n = counts[s] ?? 0;
      // A zero is still printed: dropping it would let a reader take "absent" for "none found".
      return `<div class="chip${n === 0 ? " zero" : ""}"><span class="dot" style="background:${dark ? SEVERITY_COLOUR[s].dark : SEVERITY_COLOUR[s].light}"></span><span class="n">${n}</span><span class="l">${CHIP_LABEL[s]}</span></div>`;
    }).join("") +
    "</div>"
  );
}

function statStrip(metrics: Array<{ value: string; label: string }>): string {
  if (!metrics.length) return "";
  return `<div class="stats">${metrics.map((m) => `<div class="stat"><div class="v">${esc(m.value)}</div><div class="l">${esc(m.label)}</div></div>`).join("")}</div>`;
}

/** A section's title page. Light, so the document stays printable; sections are told apart by number, icon and name. */
function dividerPage(s: ReportSectionMeta, index: number, total: number): string {
  return `<div class="divider">
  <div class="d-num">${String(index).padStart(2, "0")}</div>
  <div class="d-head">
    <div class="d-icon">${sectionIcon(s.id, 9)}</div>
    <div><div class="d-kicker">${total === 1 ? "Single-domain report" : `Section ${index} of ${total}`}</div><h2 class="d-title">${esc(s.title)}</h2></div>
  </div>
  <div class="d-grid">
    <div class="d-gauge">${overallGauge(s.score, 52)}<div class="d-word">${esc(s.word)}</div></div>
    <div class="d-detail">
      <div class="d-row"><span class="k">Status</span><span class="v">${esc(s.status)}</span></div>
      <div class="d-row"><span class="k">Score</span><span class="v">${s.score === null ? "No score" : `${s.score} / 100`}</span></div>
      <div class="d-row"><span class="k">Findings</span><span class="v">${s.findings}</span></div>
      ${severityChips(s.counts, false)}
      ${s.reason ? `<p class="d-reason">${esc(s.reason)}</p>` : ""}
    </div>
  </div>
  <div class="d-scope">
    <p><span class="s-k">Examines</span>${esc(s.examines)}</p>
    <p><span class="s-k">Limits</span>${esc(s.limits)}</p>
  </div>
  ${statStrip(s.metrics)}
</div>`;
}

/**
 * Promotes a finding's severity to a pill and turns the key-figures line into a callout strip. Done on the HTML rather
 * than in the Markdown, because the Markdown is the artifact a person reads and must not carry presentation. The
 * severity word is wrapped, not replaced, so it is still readable if the colour is lost.
 */
function decorate(html: string): string {
  const key = (sev: string) => sev.toLowerCase();
  let out = html.replace(/<h4>(.*?)<\/h4>\s*<p><strong>(Critical|High|Medium|Low|Informational)<\/strong>\s*·\s*/g, (_m, title: string, sev: string) => `<h4>${title}</h4>\n<p><span class="sev-pill sev-${key(sev)}">${sev}</span>`);
  // A findings table (the compliance report) carries the severity in its first cell.
  out = out.replace(/<tr><td>(Critical|High|Medium|Low|Informational)<\/td>/g, (_m, sev: string) => `<tr><td><span class="sev-pill sev-${key(sev)}">${sev}</span></td>`);
  // "Key figures. 3 catch blocks · 2 files" becomes a strip of large numbers; a line that does not parse stays prose.
  out = out.replace(/<p><strong>Key figures\.<\/strong>\s*([^<]*)<\/p>/g, (m, body: string) => {
    const items = body
      .split("·")
      .map((s) => s.trim().match(/^([\d,.]+)\s+(.+)$/))
      .filter((v): v is RegExpMatchArray => !!v)
      .map((v) => ({ value: v[1], label: v[2] }));
    return items.length ? statStrip(items) : m;
  });
  return out;
}

// ───────────────────────── the document ─────────────────────────

/** Printable width of a landscape A4 page inside the 20mm side margins. Any figure wider than this shrinks every page. */
export const PRINTABLE_MM = 257;
const MARGIN = { top: "23mm", right: "20mm", bottom: "16mm", left: "20mm" };

/**
 * The document as HTML. Separate from the render so the layout can be opened in a browser and looked at without
 * producing a PDF, and so tests can check it without Chromium.
 */
export function buildReportHtml(markdown: string, meta: ReportMeta): { html: string; missingFonts: string[] } {
  const font = reportFontFace();
  const parts = splitByH2(markdown);
  const headings = new Set(meta.sections.map((s) => s.heading));
  const firstSection = parts.findIndex((p) => headings.has(p.title));
  // Everything before the first section is front matter (summary, reconcile prompt, coverage); the contents page is
  // drawn from meta instead. Anything after the sections that is not the appendix still prints: silently dropping an
  // unrecognised heading is how a renderer loses a part nobody notices is missing.
  const before = firstSection < 0 ? parts : parts.slice(0, firstSection);
  const omitted = new Set(meta.omitFrontMatter ?? []);
  const frontMatter = before.filter((p) => p.title !== "Contents" && p.title !== "Appendix" && !omitted.has(p.title));
  const appendix = parts.find((p) => p.title === "Appendix");
  const unclaimed = (firstSection < 0 ? [] : parts.slice(firstSection)).filter((p) => !headings.has(p.title) && p.title !== "Appendix" && p.title !== "Contents");
  const find = (heading: string) => parts.find((p) => p.title === heading);

  const contentsRows = meta.sections
    .map(
      (s, i) => `<tr><td class="n">${String(i + 1).padStart(2, "0")}</td><td class="ic">${sectionIcon(s.id, 4.2)}</td><td class="t">${esc(s.title)}</td><td class="st">${esc(s.status)}</td><td class="sc">${s.score === null ? "no score" : s.score}</td><td class="fd">${s.findings}</td></tr>`,
    )
    .join("");
  // The distribution sits in the second cell of a 60mm + 10mm gap grid, so it is told its real width: one element
  // wider than the printable page makes Chromium shrink every page in the file, the full-bleed cover included.
  const EXEC_CHART_W = PRINTABLE_MM - 70;
  const distribution = severityDistribution(meta.counts, EXEC_CHART_W);
  const ranking = sectionRankingChart(meta.sections.map((s) => ({ label: s.title, score: s.score, findings: s.findings })), EXEC_CHART_W);
  const bySection = findingsBySectionChart(meta.sections.map((s) => ({ label: s.title, counts: s.counts })), PRINTABLE_MM);
  const scoreText = meta.overallScore === null ? "No score" : String(meta.overallScore);

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(meta.title)} — FlowCode ${esc(meta.kind.toLowerCase())}</title><style>
${font.css}
@page { size: 297mm 210mm; margin: ${MARGIN.top} ${MARGIN.right} ${MARGIN.bottom} ${MARGIN.left};
  ${runningChrome(meta)} }
@page cover { margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: ${BODY_STACK}; color: ${INK}; font-size: 9.6pt; line-height: 1.6; background: #fff; font-weight: 400; }

/* Cover: the one dark page, full bleed, in the app's own canvas and gradient. */
.cover { page: cover; break-after: page; width: 297mm; height: 210mm; background: ${CANVAS}; background-image: ${COVER_GRADIENT};
  color: ${TEXT_PRIMARY}; padding: 18mm 22mm; position: relative; overflow: hidden; }
.brandline { display: flex; align-items: center; gap: 3.5mm; }
.wordmark { font-family: ${HEADING_STACK}; font-weight: 600; font-size: 14pt; letter-spacing: -.01em; color: #fff; }
.brandline .sub { font-size: 8pt; color: ${TEXT_TERTIARY}; margin-left: auto; letter-spacing: .16em; text-transform: uppercase; }
.hr-dark { height: 1px; background: ${BORDER_DARK_STRONG}; margin: 5mm 0 0; }
.kicker { font-size: 7.5pt; letter-spacing: .26em; text-transform: uppercase; color: ${ACCENT}; font-weight: 600; margin: 18mm 0 5mm; }
.cover h1 { font-family: ${HEADING_STACK}; font-weight: 600; font-size: 36pt; line-height: 1.06; letter-spacing: -.025em; margin: 0 0 6mm;
  color: #fff; max-width: 180mm; overflow-wrap: anywhere; }
.standfirst { font-size: 10.5pt; line-height: 1.65; color: ${TEXT_SECONDARY}; max-width: 165mm; margin: 0; }
.notice { font-size: 8.6pt; line-height: 1.55; color: ${TEXT_SECONDARY}; max-width: 165mm; margin: 5mm 0 0; padding: 3mm 4mm;
  border: 1px solid ${BORDER_DARK_STRONG}; background: rgba(255,255,255,.04); border-radius: 1.5mm; }
.score-box { position: absolute; top: 46mm; right: 22mm; width: 62mm; border: 1px solid ${BORDER_DARK_STRONG};
  background: rgba(255,255,255,.04); padding: 6mm; border-radius: 1.5mm; }
.score-box .k { font-size: 7.1pt; letter-spacing: .2em; text-transform: uppercase; color: ${TEXT_TERTIARY}; font-weight: 600; }
.score-box .v { font-family: ${HEADING_STACK}; font-weight: 600; font-size: 30pt; line-height: 1.1; margin-top: 2mm; color: #fff; letter-spacing: -.02em; }
.score-box .v .of { font-size: 12pt; color: ${TEXT_TERTIARY}; letter-spacing: 0; }
.score-box .w { font-size: 10pt; color: ${TEXT_SECONDARY}; margin-top: 1mm; }
.cover .chips { position: absolute; left: 22mm; right: 22mm; bottom: 42mm; margin: 0; }
.cover .facts { position: absolute; left: 22mm; right: 22mm; bottom: 17mm; display: grid; grid-template-columns: repeat(4, 1fr); }
.cover .facts > div { border-left: 1px solid ${BORDER_DARK_STRONG}; padding: 0 4mm; }
.cover .facts > div:first-child { border-left: 0; padding-left: 0; }
.cover .facts .k { font-size: 7.1pt; letter-spacing: .18em; text-transform: uppercase; color: ${TEXT_TERTIARY}; font-weight: 600; }
.cover .facts .v { font-size: 9.2pt; margin-top: 1.5mm; color: ${TEXT_PRIMARY}; overflow-wrap: anywhere; }
.credit { position: absolute; right: 22mm; bottom: 8mm; font-size: 7.5pt; letter-spacing: .16em; text-transform: uppercase; color: ${TEXT_TERTIARY}; }

/* Severity chips, both polarities. */
.chips { display: flex; border-top: 1px solid ${BORDER_LIGHT}; border-bottom: 1px solid ${BORDER_LIGHT}; margin: 4mm 0; }
.chips.on-dark { border-color: ${BORDER_DARK_STRONG}; }
.chip { flex: 1; padding: 3.4mm 0 3.4mm 3.5mm; border-left: 1px solid ${BORDER_LIGHT}; display: flex; align-items: baseline; gap: 1.8mm; }
.chips.on-dark .chip { border-left-color: ${BORDER_DARK}; }
.chip:first-child { border-left: 0; padding-left: 0; }
.chip .dot { width: 2.1mm; height: 2.1mm; border-radius: 50%; display: inline-block; align-self: center; }
.chip .n { font-family: ${HEADING_STACK}; font-weight: 600; font-size: 14pt; color: ${INK}; }
.chips.on-dark .chip .n { color: #fff; }
.chip .l { font-size: 7.4pt; letter-spacing: .14em; text-transform: uppercase; color: ${INK_TERTIARY}; }
.chips.on-dark .chip .l { color: ${TEXT_TERTIARY}; }
.chip.zero .n { color: ${INK_TERTIARY}; opacity: .55; }
.chips.on-dark .chip.zero .n { color: ${TEXT_TERTIARY}; }

/* Contents and the glance page. A page title and its lede travel with what follows. */
.page-break { break-after: page; }
h1.page-title { font-family: ${HEADING_STACK}; font-weight: 600; font-size: 24pt; letter-spacing: -.025em; margin: 0 0 2mm; break-after: avoid; }
.page-lede { font-size: 10.2pt; color: ${INK_SECONDARY}; max-width: 170mm; margin: 0 0 7mm; break-after: avoid; break-inside: avoid; }
table.toc { border-collapse: collapse; width: 100%; font-size: 10pt; }
table.toc td { padding: 2.4mm 2mm; border-bottom: 1px solid ${BORDER_LIGHT}; vertical-align: middle; background: none; }
table.toc td.n { font-family: ${HEADING_STACK}; font-weight: 600; color: ${INK_TERTIARY}; width: 12mm; font-size: 11pt; }
table.toc td.ic { width: 8mm; }
table.toc td.t { font-weight: 600; }
table.toc td.st { color: ${INK_SECONDARY}; width: 48mm; }
table.toc td.sc { text-align: right; width: 24mm; font-weight: 600; }
table.toc td.fd { text-align: right; width: 26mm; color: ${INK_SECONDARY}; }
table.toc th.r { text-align: right; }

/* Section divider. */
.divider { break-before: page; break-after: page; position: relative; }
.d-num { position: absolute; top: -6mm; right: 0; font-family: ${HEADING_STACK}; font-weight: 600; font-size: 86pt; line-height: 1; color: ${WASH_STRONG}; letter-spacing: -.04em; }
.d-head { display: flex; align-items: center; gap: 5mm; position: relative; padding-top: 10mm; }
.d-icon { width: 16mm; height: 16mm; border: 1px solid ${BORDER_LIGHT}; border-radius: 1.5mm; display: flex; align-items: center; justify-content: center; flex: none; }
.d-kicker { font-size: 7.5pt; letter-spacing: .24em; text-transform: uppercase; color: ${ACCENT_ON_LIGHT}; font-weight: 600; }
h2.d-title { font-family: ${HEADING_STACK}; font-weight: 600; font-size: 28pt; letter-spacing: -.025em; margin: 1.5mm 0 0; border: 0; padding: 0; }
/* A fixed measure rather than 1fr: stretched across 257mm a label and its value end up a hand's width apart. */
.d-grid { display: grid; grid-template-columns: 62mm 122mm; gap: 14mm; margin-top: 10mm; align-items: start; position: relative; justify-content: start; }
.d-gauge { text-align: center; }
.d-word { font-family: ${HEADING_STACK}; font-weight: 600; font-size: 12pt; margin-top: -2mm; color: ${INK_SECONDARY}; }
.d-row { display: flex; justify-content: space-between; padding: 2.4mm 0; border-bottom: 1px solid ${BORDER_LIGHT}; }
.d-row .k { font-size: 8pt; letter-spacing: .14em; text-transform: uppercase; color: ${INK_TERTIARY}; font-weight: 600; }
.d-row .v { font-weight: 600; }
.d-reason { background: ${WASH}; border: 1px solid ${BORDER_LIGHT}; border-radius: 1.5mm; padding: 3mm 4mm; margin: 4mm 0 0; color: ${INK_SECONDARY}; }
.d-scope { margin-top: 6mm; padding-top: 3.5mm; border-top: 1px solid ${BORDER_LIGHT}; display: grid; grid-template-columns: 1fr 1fr; gap: 9mm; }
.d-scope p { margin: 0; font-size: 8.4pt; line-height: 1.55; color: ${INK_SECONDARY}; }
.s-k { display: block; font-size: 7pt; letter-spacing: .14em; text-transform: uppercase; color: ${INK_TERTIARY}; font-weight: 600; margin-bottom: 1mm; }

/* Callout figures. */
.stats { display: flex; gap: 7mm; margin: 5mm 0; break-inside: avoid; }
.stat { flex: 1; }
.stat .v { font-family: ${HEADING_STACK}; font-weight: 600; font-size: 20pt; letter-spacing: -.02em; color: ${ACCENT_ON_LIGHT}; line-height: 1.05; }
.stat .l { font-size: 8pt; letter-spacing: .1em; text-transform: uppercase; color: ${INK_TERTIARY}; font-weight: 600; margin-top: 1mm; }
/* A figure, its title and its caption are one object. */
.fig { margin: 3mm 0; break-inside: avoid; }
.fig svg { display: block; max-width: 100%; height: auto; }
.fig-empty { background: ${WASH}; border: 1px solid ${BORDER_LIGHT}; border-radius: 1.5mm; padding: 4mm; color: ${INK_SECONDARY}; margin: 3mm 0; }
.fig-cap { font-size: 8.6pt; color: ${INK_TERTIARY}; margin: 0 0 6mm; max-width: 175mm; break-before: avoid; break-inside: avoid; }
.fig-title { font-family: ${HEADING_STACK}; font-weight: 600; font-size: 10.5pt; margin: 6mm 0 1mm; break-after: avoid; break-inside: avoid; }
.exec-grid { display: grid; grid-template-columns: 60mm ${EXEC_CHART_W}mm; gap: 10mm; align-items: start; margin-bottom: 4mm; break-inside: avoid; }
.exec-grid .gauge { text-align: center; }
.fig-block { break-inside: avoid; }
/* The front matter (summary, reconcile prompt, coverage) flows from one part into the next instead of starting a page
   each, so a three-line part does not leave a page mostly white. */
.front + .front { margin-top: 9mm; }

/* The flow: two columns; things you look at rather than read span both. Headings deliberately do not, or every h3
   would cut the columns into balanced two-line fragments. */
.body { column-count: 2; column-gap: 9mm; column-fill: auto; }
.body table, .body pre, .body .fig, .body .fig-cap, .body .fig-title { column-span: all; }
/* A key-figures strip stays in its column: two or three numbers fit a column, and spanning it cut a finding in half. */
.body .stats { gap: 6mm; margin: 3mm 0 4mm; }

h2 { font-family: ${HEADING_STACK}; font-size: 17pt; font-weight: 600; letter-spacing: -.02em; margin: 0 0 3mm; padding-bottom: 2.5mm; border-bottom: 1px solid ${BORDER_LIGHT}; break-after: avoid; }
h3 { font-family: ${HEADING_STACK}; font-weight: 600; font-size: 12pt; margin: 6mm 0 2mm; letter-spacing: -.01em; border-bottom: 1px solid ${BORDER_LIGHT}; padding-bottom: 1.5mm; break-after: avoid; }
h4 { font-family: ${HEADING_STACK}; font-weight: 600; font-size: 11pt; margin: 6mm 0 2mm; break-after: avoid; break-inside: avoid; }
/* The parts of a finding, set as labels rather than headings so the finding reads as one block of named fields. */
h5 { font-size: 7.8pt; letter-spacing: .16em; text-transform: uppercase; font-weight: 600; color: ${INK}; margin: 4.5mm 0 1.5mm; padding-bottom: 1mm; border-bottom: 1px solid ${BORDER_LIGHT}; break-after: avoid; }
p { margin: 0 0 2.6mm; }
strong, b { font-weight: 600; }
em { font-style: normal; color: ${INK_SECONDARY}; }
a { color: inherit; text-decoration: none; }
blockquote { margin: 0 0 3.5mm; padding: 2.6mm 4mm; background: ${WASH}; border: 1px solid ${BORDER_LIGHT}; border-radius: 1.5mm; color: ${INK_SECONDARY}; break-inside: avoid; font-size: 9.2pt; }
blockquote p:last-child { margin-bottom: 0; }
code { font-family: ${MONO_STACK}; font-size: 8pt; background: ${WASH_STRONG}; padding: .3mm 1.2mm; border-radius: 1mm; color: ${INK_SECONDARY}; overflow-wrap: anywhere; }
hr { border: 0; border-top: 1px solid ${BORDER_LIGHT}; margin: 7mm 0; }
ul, ol { margin: 0 0 3mm; padding-left: 5.5mm; }
li { margin-bottom: 1.4mm; }
table { border-collapse: collapse; width: 100%; margin: 0 0 5mm; font-size: 8.8pt; }
th { text-align: left; font-size: 7.2pt; letter-spacing: .15em; text-transform: uppercase; color: ${INK_TERTIARY}; font-weight: 600; padding: 2mm 2.5mm; border-bottom: 1px solid ${INK}; }
td { padding: 2mm 2.5mm; border-bottom: 1px solid ${BORDER_LIGHT}; vertical-align: top; }
tr { break-inside: avoid; }
tr:nth-child(even) td { background: ${WASH}; }
/* A prompt is meant to be copied, so it is set apart and never split across a page (a prompt broken over a page is one
   somebody pastes in half). Light, not reversed, so the document still prints. */
pre.prompt { background: ${WASH}; color: ${INK}; padding: 4mm 5mm; font-family: ${MONO_STACK}; font-size: 7.6pt; line-height: 1.55; white-space: pre-wrap;
  overflow-wrap: anywhere; margin: 0 0 4mm; border: 1px solid ${BORDER_LIGHT_STRONG}; border-radius: 1.5mm; break-inside: avoid; }
/* Except one longer than a page, which would otherwise jump to the next page, leave this one white, and split anyway. */
pre.prompt.long { break-inside: auto; }
/* A prompt's title spans with it and travels with it, rather than ending one column while the prompt starts a page. */
.body p:has(+ pre.prompt), .body h5:has(+ p + pre.prompt) { column-span: all; break-after: avoid; }
.body p:has(+ pre.prompt) { margin-top: 2mm; }
td code { font-size: 7.2pt; }
/* Two-column tables (severity counts) at their natural width rather than stretched across the page. */
.body table.cols-2 { width: auto; min-width: 110mm; }

/* Severity is a pill beside the words, never the colour of a heading: colour reinforces a word already written. */
.sev-pill { display: inline-block; font-size: 7.2pt; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; padding: .5mm 1.8mm;
  border: 0.5pt solid currentColor; border-radius: 1mm; margin-right: 2mm; vertical-align: baseline; white-space: nowrap; }
${SEVERITIES.map((s) => `.sev-pill.sev-${s} { color: ${SEVERITY_COLOUR[s].light}; background: color-mix(in srgb, ${SEVERITY_COLOUR[s].light} 8%, transparent); }`).join("\n")}
</style></head><body>

<div class="cover">
  <div class="brandline">${boltMark(30)}${wordmark(true)}<div class="sub">Personal Intelligence</div></div>
  <div class="hr-dark"></div>
  <div class="kicker">${esc(meta.kind)}</div>
  <h1>${esc(meta.title)}</h1>
  <p class="standfirst">${esc(meta.standfirst)}</p>
  ${meta.notice ? `<p class="notice">${esc(meta.notice)}</p>` : ""}
  <div class="score-box">
    <div class="k">${esc(meta.scoreLabel)}</div>
    <div class="v">${scoreText}${meta.overallScore === null ? "" : '<span class="of"> / 100</span>'}</div>
    <div class="w">${esc(meta.verdict)}</div>
  </div>
  ${severityChips(meta.counts, true)}
  <div class="facts">${meta.facts
    .slice(0, 4)
    .map((f) => `<div><div class="k">${esc(f.label)}</div><div class="v">${esc(f.value)}</div></div>`)
    .join("")}</div>
  <div class="credit">${esc(meta.credit)}</div>
</div>

<div class="page-break">
  <h1 class="page-title">Contents</h1>
  <p class="page-lede">Every section is listed whether or not it found anything. A section that does not apply, or was not run, says so here rather than being left out, because a missing section and a clean one look identical once a report is printed.</p>
  <table class="toc"><thead><tr><th></th><th></th><th>Section</th><th>Status</th><th class="r">Score</th><th class="r">Findings</th></tr></thead><tbody>${contentsRows}</tbody></table>
</div>

<div class="page-break">
  <h1 class="page-title">The picture at a glance</h1>
  <p class="page-lede">${meta.glanceIntro ? "What this product is, how it works end to end, and how it scored. The description is read from the code; every" : `How this ${esc(meta.kind.toLowerCase())} scored. Every`} figure repeats a number stated in words elsewhere in the report; it is drawn because comparing sections is something a paragraph is bad at.</p>
  ${meta.glanceIntro ? `${meta.glanceIntro}<hr/>` : ""}
  <div class="exec-grid">
    <div class="gauge">${overallGauge(meta.overallScore, 56)}<div class="d-word">${esc(meta.verdict)}</div></div>
    <div>
      <div class="fig-title" style="margin-top:0">How the findings break down by severity</div>${distribution ? `<div class="fig">${distribution}</div>` : '<div class="fig-empty">No open findings.</div>'}
      <div class="fig-title">Section scores, worst first</div>
      <div class="fig">${ranking}</div>
      <p class="fig-cap">A bar is a section&rsquo;s own score out of 100. Sections marked &ldquo;no score&rdquo; were not run or do not apply &mdash; they are not zero, and they are left out of the overall score rather than counted as failures.</p>
    </div>
  </div>
  ${bySection ? `<div class="fig-block"><div class="fig-title">Open findings by section</div><div class="fig">${bySection}</div><p class="fig-cap">A section scoring badly because of one critical finding and one scoring the same because of nine medium ones are different problems with different owners.</p></div>` : ""}
</div>

${(meta.extraPages ?? []).map((p) => `<div class="page-break"><h1 class="page-title">${esc(p.title)}</h1><p class="page-lede">${esc(p.lede)}</p>${p.html}</div>`).join("\n")}

${frontMatter.map((p) => `<div class="front"><h2>${esc(p.title)}</h2><div class="body">${decorate(markdownToHtml(p.body))}</div></div>`).join("\n")}

${meta.sections
  .map((s, i) => {
    const part = find(s.heading);
    return `${dividerPage(s, i + 1, meta.sections.length)}\n<div class="body sec">${part ? decorate(markdownToHtml(part.body)) : ""}</div>`;
  })
  .join("\n")}

${unclaimed.map((p) => `<div class="page-break" style="break-before:page"><h2>${esc(p.title)}</h2><div class="body">${decorate(markdownToHtml(p.body))}</div></div>`).join("\n")}

${appendix ? `<div style="break-before:page"><h2>Appendix</h2><div class="body">${decorate(markdownToHtml(appendix.body))}</div></div>` : ""}
</body></html>`;

  return { html, missingFonts: font.missing };
}

/** A CSS string literal (for `content:`), with quotes and backslashes escaped. */
const cssString = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\s+/g, " ")}"`;

/**
 * The running header and footer, as @page margin boxes. FlowReport draws these with page.pdf()'s header and footer
 * templates, but Chromium paints those on every page, the full-bleed cover included, and they cannot be turned off
 * for one page. Margin boxes belong to the page box, so the cover's named page (margin 0) simply has none; they also
 * set in the document's own embedded face and keep the page counters.
 */
function runningChrome(meta: ReportMeta): string {
  const caps = `font-family: ${BODY_STACK}; font-size: 6.2pt; letter-spacing: .16em; text-transform: uppercase; color: ${INK_TERTIARY};`;
  const small = `font-family: ${BODY_STACK}; font-size: 6.6pt; color: ${INK_TERTIARY};`;
  return [
    `@top-left { content: ${cssString(`${meta.title} / FlowCode ${meta.kind.toLowerCase()}`)}; ${caps} vertical-align: bottom; padding-bottom: 8mm; }`,
    `@top-right { content: "Internal · derived from source · nothing executed"; ${caps} vertical-align: bottom; padding-bottom: 8mm; }`,
    `@bottom-left { content: ${cssString(`Prepared by FlowCode AI · ${meta.generatedAt.slice(0, 10)}`)}; ${small} vertical-align: top; padding-top: 5mm; }`,
    `@bottom-right { content: "internal · derived from source · page " counter(page) " of " counter(pages); ${small} vertical-align: top; padding-top: 5mm; }`,
  ].join("\n  ");
}

const PAGE_VIEWPORT = { width: Math.round(297 * (96 / 25.4)), height: Math.round(210 * (96 / 25.4)) };

/**
 * Prints the report with an already-open browser session. Landscape A4, running header and footer, backgrounds on.
 * The first render in a fresh browser can lay out before the embedded face is parsed (FlowReport measured this), so
 * a throwaway render on its own page warms the browser first, and the real page waits for document.fonts.ready.
 */
export async function renderReportPdf(session: BrowserSession, markdown: string, meta: ReportMeta): Promise<{ bytes: Buffer; missingFonts: string[] }> {
  const { html, missingFonts } = buildReportHtml(markdown, meta);
  const warm = await session.browser.newPage({ viewport: PAGE_VIEWPORT });
  try {
    await warm.setContent(html, { waitUntil: "load" });
    await warm.evaluate(() => document.fonts.ready.then(() => true));
  } catch {
    // A warm-up that fails must not fail the export; the worst case is the behaviour it guards against.
  } finally {
    await warm.close().catch(() => undefined);
  }
  const page = await session.browser.newPage({ viewport: PAGE_VIEWPORT });
  try {
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready.then(() => true));
    await page.emulateMedia({ media: "print" });
    // Page size, margins and the running header and footer all come from the stylesheet's @page rules.
    const bytes = await page.pdf({ width: "297mm", height: "210mm", printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false });
    return { bytes, missingFonts };
  } finally {
    await page.close().catch(() => undefined);
  }
}

/** Renders a report's PDF from its Markdown and meta and saves it as an artifact under runId (shared by both reports). */
export async function saveReportPdf(app: App, o: { runId: string; markdown: string; meta: ReportMeta; label: string }): Promise<{ id: string; label: string }> {
  const session = await BrowserSession.launch(o.runId, app.processes);
  try {
    const { bytes } = await renderReportPdf(session, o.markdown, o.meta);
    const rec = app.artifacts.save({ runId: o.runId, kind: "report_pdf", label: o.label, mime: "application/pdf", content: bytes });
    return { id: rec.id, label: rec.label };
  } finally {
    await session.close();
  }
}
