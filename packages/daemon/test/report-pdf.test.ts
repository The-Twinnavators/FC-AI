/** Repo report PDFs: rendered from the report's own Markdown, with a drawn cover and dividers that agree with it. */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildAnalysisMarkdown, buildAnalysisMeta, runFolderAnalysis, type Severity } from "../src/quality/buildAnalysis.js";
import { BrowserSession } from "../src/quality/preview.js";
import { PRINTABLE_MM, SEVERITIES, SEVERITY_LABEL, buildReportHtml, renderReportPdf, type ReportMeta } from "../src/quality/reportPdf/document.js";
import { findingsBySectionChart, overallGauge, sectionRankingChart, severityDistribution } from "../src/quality/reportPdf/charts.js";
import { markdownToHtml, splitByH2 } from "../src/quality/reportPdf/markdown.js";
import { makeApp, tmpDir, write } from "./helpers.js";

const FILES = {
  "package.json": '{"name":"x","scripts":{"build":"vite build","test":"vitest run","lint":"eslint ."}}',
  "tsconfig.json": "{}",
  "index.html": "<!doctype html><html><head></head><body><div id=root></div></body></html>",
  "src/App.tsx": "export function App() {\n  const email = 'x';\n  return <div><img src='a.png' /><button onClick={() => {}}></button></div>;\n}\n",
  "src/html.ts": "export const put = (el: HTMLElement, s: string) => { el.innerHTML = s; };\n",
  "src/app.ts": "export function load() {\n  try { return JSON.parse(localStorage.getItem('k') || '{}'); } catch {}\n  console.log('debug');\n}\n",
  "docs/PRD.md": "# PRD\n\nSave to `calc.history` and route `#/settings`.\n",
};

function repo(files: Record<string, string>) {
  const root = tmpDir("fc-report-");
  for (const [rel, content] of Object.entries(files)) write(root, rel, content);
  return { path: fs.realpathSync.native(root), name: path.basename(root) };
}

/** Well-formed enough to be SVG: one root, every tag closed in order. */
function balanced(svg: string): boolean {
  const stack: string[] = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z][\w-]*)[^>]*?(\/?)>/g)) {
    if (m[3]) continue;
    if (!m[1]) stack.push(m[2]);
    else if (stack.pop() !== m[2]) return false;
  }
  return stack.length === 0;
}

const styleOf = (html: string) => html.slice(html.indexOf("<style>"), html.indexOf("</style>"));

async function reports() {
  const { app } = makeApp();
  const t = repo(FILES);
  const ba = await runFolderAnalysis(app, t);
  return { ba };
}

/** The checks both reports must pass: the PDF's drawn figures agree with the Markdown it renders. */
function agrees(markdown: string, meta: ReportMeta, severityHeader: string) {
  const { html } = buildReportHtml(markdown, meta);
  // Every section the meta draws a divider for is a `## ` heading in the Markdown, and its body is found.
  const headings = splitByH2(markdown).map((p) => p.title);
  for (const s of meta.sections) expect(headings, `${s.heading} should be a heading`).toContain(s.heading);
  expect((html.match(/<div class="divider">/g) ?? []).length).toBe(meta.sections.length);
  expect((html.match(/<div class="body sec">/g) ?? []).length).toBe(meta.sections.length);
  // The cover's severity counts are the ones the Markdown's own table prints.
  expect(markdown).toContain(`| Severity | ${severityHeader} |`);
  for (const s of SEVERITIES) expect(markdown).toContain(`| ${SEVERITY_LABEL[s]} | ${meta.counts[s]} |`);
  const cover = html.slice(html.indexOf('<div class="cover">'), html.indexOf('<div class="page-break">'));
  const chips = [...cover.matchAll(/<span class="n">(\d+)<\/span>/g)].map((m) => Number(m[1]));
  expect(chips).toEqual(SEVERITIES.map((s) => meta.counts[s]));
  expect(cover).toContain(`<div class="v">${meta.overallScore}<span class="of"> / 100</span></div>`);
  expect(markdown).toContain(`**${meta.overallScore} / 100** (${meta.verdict})`);
  // Each section's score and finding count on the contents page match the Markdown's coverage table.
  for (const s of meta.sections) {
    expect(markdown).toContain(`| ${s.title} | ${s.status} | ${s.score ?? "—"} | ${s.findings} |`);
    expect(html).toContain(`<td class="t">${s.title.replace(/&/g, "&amp;")}</td><td class="st">${s.status}</td><td class="sc">${s.score ?? "no score"}</td><td class="fd">${s.findings}</td>`);
  }
  return html;
}

describe("repo report PDFs: one source", () => {
  it("build analysis: the PDF's cover, contents and dividers agree with its Markdown", async () => {
    const { ba } = await reports();
    const md = buildAnalysisMarkdown(ba);
    const html = agrees(md, buildAnalysisMeta(ba), "Open findings");
    // The prompts and the "checks were not run" statement travel into the PDF.
    expect(html).toContain("FlowCode prompt");
    expect(html).toContain('<pre class="prompt">');
    expect(html).toMatch(/checks \(type check, lint, tests, build\) were not run/);
    expect(md).toMatch(/Report content hash \(sha256, first 16\): [0-9a-f]{16}/);
    // Severity becomes a pill beside the words; the heading itself stays in ink.
    expect(html).toMatch(/<span class="sev-pill sev-(critical|high|medium|low|informational)">/);
    expect(html).toContain('<div class="stats">');
    expect(html).toContain("FlowCode AI · Repo tools");
  });

});

describe("repo report PDFs: typography and layout", () => {
  it("sets nothing bolder than semibold, in the stylesheet or in the charts", async () => {
    const { ba } = await reports();
    for (const html of [buildReportHtml(buildAnalysisMarkdown(ba), buildAnalysisMeta(ba)).html]) {
      const weights = [...html.matchAll(/font-weight\s*[:=]\s*"?(\d+)/g)].map((m) => Number(m[1]));
      expect(weights.length).toBeGreaterThan(0);
      for (const w of weights) expect(w).toBeLessThanOrEqual(600);
      expect(html).not.toMatch(/font-weight\s*:\s*(bold|bolder)/);
      // The one variable face covers 200-800; that range is a face declaration, not a weight anything is set in.
      expect(styleOf(html)).not.toMatch(/\{[^}]*font-weight:\s*[789]00/);
    }
  });

  it("has one dark page, two-column bodies, spanning figures and prompts, and no left accent bars", async () => {
    const { ba } = await reports();
    const html = buildReportHtml(buildAnalysisMarkdown(ba), buildAnalysisMeta(ba)).html;
    const css = styleOf(html);
    expect(css).toMatch(/@page cover \{ margin: 0; \}/);
    expect(css).toMatch(/\.body \{[^}]*column-count: 2/);
    expect(css).toMatch(/\.body table, \.body pre[^{]*\{ column-span: all; \}/);
    expect((html.match(/class="cover"/g) ?? []).length).toBe(1);
    // Prompts print on a light fill, not reversed.
    expect(css).toMatch(/pre\.prompt \{ background: #f7f8fa;/);
    // Hairline separators only; nothing is marked with a thick bar down its left edge.
    for (const m of css.matchAll(/border-left:\s*([\d.]+)(px|pt|mm)/g)) expect(m[2] === "px" ? Number(m[1]) : 99).toBeLessThanOrEqual(1);
    expect(html).not.toContain("<script");
    // Offline: nothing is fetched at render time.
    expect(html).not.toMatch(/fonts\.googleapis|<link /);
  });
});

describe("repo report PDFs: charts", () => {
  const counts: Record<Severity, number> = { critical: 1, high: 2, medium: 3, low: 0, informational: 4 };
  const rows = [
    { label: "Security QA", score: 41, findings: 3 },
    { label: "Build health", score: null, findings: 1 },
    { label: "Error handling & logs", score: 88, findings: 2 },
  ];

  it("draws valid SVG at a declared width no wider than the printable page", () => {
    const charts = [overallGauge(72), overallGauge(null), severityDistribution(counts), sectionRankingChart(rows), findingsBySectionChart([{ label: "Security & privacy", counts }])];
    for (const c of charts) {
      expect(c.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
      expect(balanced(c)).toBe(true);
      expect(c).not.toMatch(/NaN|undefined/);
      const w = Number(c.match(/width="([\d.]+)mm"/)![1]);
      expect(w).toBeLessThanOrEqual(PRINTABLE_MM);
    }
    expect(charts[3]).toContain("Error handling &amp; logs");
  });

  it("states absence rather than drawing nothing", () => {
    expect(overallGauge(null)).toContain("No score");
    expect(sectionRankingChart(rows)).toContain("no score");
    // Worst first, unscored last.
    const order = [...sectionRankingChart(rows).matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map((m) => m[1]);
    expect(order).toEqual(["Security QA", "Error handling &amp; logs", "Build health"]);
    expect(severityDistribution({ critical: 0, high: 0, medium: 0, low: 0, informational: 0 })).toBe("");
    // A severity with no findings keeps its legend entry.
    expect(severityDistribution(counts)).toContain("Low (0)");
  });
});

describe("repo report PDFs: Markdown conversion", () => {
  it("keeps numbers in prose next to code spans, and escapes HTML", () => {
    const html = markdownToHtml("Found 3 files in `src/a.ts` and 0 in <b>x</b>.");
    expect(html).toBe("<p>Found 3 files in <code>src/a.ts</code> and 0 in &lt;b&gt;x&lt;/b&gt;.</p>");
  });

  it("does not cut the document at a heading inside a fenced prompt", () => {
    const parts = splitByH2("## A\n\n```text\n## not a heading\n```\n\n## B\n");
    expect(parts.map((p) => p.title)).toEqual(["A", "B"]);
  });
});

/**
 * Prints both reports through Chromium. Set FLOWCODE_REPORT_SAMPLES to a folder to keep the PDFs (the calculator
 * workspace is scanned when it exists, otherwise a small fixture repo).
 */
describe.skipIf(process.env.FLOWCODE_SKIP_BROWSER === "1")("repo report PDFs: printed", () => {
  it("renders the report to a real PDF", async () => {
    const { app } = makeApp();
    const calc = path.resolve(process.cwd(), ".flowcode-data/workspaces/calculator-app-81ed36");
    const t = fs.existsSync(calc) ? { path: calc, name: path.basename(calc) } : repo(FILES);
    const ba = await runFolderAnalysis(app, t);
    const out = process.env.FLOWCODE_REPORT_SAMPLES ?? tmpDir("fc-report-pdf-");
    fs.mkdirSync(out, { recursive: true });
    const session = await BrowserSession.launch("report-pdf-test");
    try {
      for (const [name, md, meta] of [
        ["sample-build-analysis.pdf", buildAnalysisMarkdown(ba), buildAnalysisMeta(ba)],
      ] as const) {
        const { bytes, missingFonts } = await renderReportPdf(session, md, meta);
        expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
        expect(bytes.length).toBeGreaterThan(10_000);
        expect(missingFonts).toEqual([]);
        fs.writeFileSync(path.join(out, name), bytes);
      }
    } finally {
      await session.close();
    }
  }, 120_000);
});
