/**
 * Phase 7 acceptance: evidence-backed quality results, no critical accessibility defects in the
 * reference app, and exports redact secrets. The browser suite runs the real verifier (dev server,
 * Playwright, axe, screenshots, smoke flow) against the reference scheduler built on the verified
 * starter template; it is skipped when dependencies cannot be installed (offline).
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { makeApp, makeProject, tmpDir } from "./helpers.js";
import { staticAccessibility } from "../src/quality/a11yStatic.js";
import { designQa } from "../src/quality/designQa.js";
import { complianceTriage, securityTriage, seoTriage } from "../src/quality/staticTriage.js";
import { contrastRatio } from "../src/quality/tokens.js";
import { PathJail } from "../src/security/pathJail.js";
import { markdownToHtml } from "../src/reports/report.js";
import { TEMPLATES } from "../src/orchestrator/templates.js";

const FIXTURE = path.resolve(__dirname, "fixtures/scheduler-reference");

function copyDir(from: string, to: string) {
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === "dist") continue;
    const s = path.join(from, e.name);
    const d = path.join(to, e.name);
    if (e.isDirectory()) {
      fs.mkdirSync(d, { recursive: true });
      copyDir(s, d);
    } else fs.copyFileSync(s, d);
  }
}

function referenceApp(): string {
  const ws = tmpDir("fc-ref-");
  copyDir(TEMPLATES["react-vite-scheduler"].dir, ws);
  copyDir(FIXTURE, ws);
  const css = path.join(ws, "src/styles/app.css");
  fs.appendFileSync(css, fs.readFileSync(path.join(ws, "src/styles/scheduler-additions.css"), "utf8"));
  fs.rmSync(path.join(ws, "src/styles/scheduler-additions.css"));
  return ws;
}

describe("static quality analyzers", () => {
  it("finds seeded accessibility, design, security, compliance and SEO issues", () => {
    const root = tmpDir();
    const w = (rel: string, c: string) => {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), c);
    };
    w("index.html", "<!doctype html><html><head><meta name='viewport' content='width=device-width, user-scalable=no'></head><body></body></html>");
    w("src/styles/tokens.css", ":root { --color-text: #777777; --color-bg: #888888; --radius-lg: 16px; }");
    w("src/styles/app.css", ".x { color: #ff00ff; border-radius: 24px; outline: none; }");
    w("src/Bad.tsx", `export function Bad({ html }: { html: string }) {
  return (<div>
    <img src="a.png" />
    <input id="q" />
    <button></button>
    <div onClick={() => 1}>click</div>
    <p style={{ color: "red" }}>Lorem ipsum dolor sit amet</p>
    <div dangerouslySetInnerHTML={{ __html: html }} />
  </div>);
}
const k = "sk-proj-abcdefghijklmnopqrstuvwxyz0123";
eval("1+1");
fetch("http://api.example.com/data");
`);
    w("src/signup.tsx", 'export const F = () => <input type="email" aria-label="Email" />;');
    const jail = new PathJail(root);
    const a11y = staticAccessibility(jail).map((f) => f.rule);
    for (const r of ["img-alt", "form-label", "button-name", "click-events-have-key-events", "html-lang", "document-title", "meta-viewport", "focus-visible", "color-contrast-tokens"]) expect(a11y).toContain(r);
    const design = designQa(jail, { maxRadiusPx: 10 }).map((f) => f.rule);
    for (const r of ["raw-color", "inline-style", "filler-copy", "radius-cap", "state-coverage"]) expect(design).toContain(r);
    // Corners made rounder in the Design studio raise the cap with them: 24px under a 32px token isn't a violation.
    w("src/styles/tokens.css", ":root { --color-text: #777777; --color-bg: #888888; --radius-lg: 16px; --radius-xl: 32px; }");
    expect(designQa(jail, { maxRadiusPx: 10 }).map((f) => f.rule)).not.toContain("radius-cap");
    // Sizes and positions computed from data (a chart bar, an event on a time grid) aren't token escapes; literals still are.
    w("src/Chart.tsx", "export const C = ({ pct, top }: { pct: number; top: number }) => <><span style={{ height: `${pct}%` }} /><span style={{ top, '--h': pct }} /></>;");
    const lines = (file: string) => designQa(jail, { maxRadiusPx: 10 }).filter((f) => f.rule === "inline-style" && f.path === file);
    expect(lines("src/Chart.tsx")).toHaveLength(0);
    w("src/Chart.tsx", "export const C = ({ pct }: { pct: number }) => <><span style={{ height: '40%' }} /><span style={{ height: pct, color: 'red' }} /></>;");
    expect(lines("src/Chart.tsx")).toHaveLength(2);
    const sec = securityTriage(jail);
    for (const r of ["eval", "dangerous-html", "hardcoded-secret", "insecure-http"]) expect(sec.map((f) => f.rule)).toContain(r);
    expect(sec.every((f) => f.manualValidationRequired)).toBe(true);
    expect(JSON.stringify(sec)).not.toContain("sk-proj-abcdefghij");
    expect(complianceTriage(jail).map((f) => f.rule)).toContain("personal-data");
    expect(seoTriage(jail).map((f) => f.rule)).toEqual(expect.arrayContaining(["title", "meta-description"]));
  });

  it("computes WCAG contrast ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")!).toBeCloseTo(21, 0);
    expect(contrastRatio("#777777", "#888888")!).toBeLessThan(1.5);
  });

  it("the verified starter and reference app have no static critical/serious accessibility or design defects", () => {
    const ws = referenceApp();
    const jail = new PathJail(ws);
    const a11y = staticAccessibility(jail).filter((f) => f.severity === "critical" || f.severity === "serious");
    expect(a11y, JSON.stringify(a11y, null, 2)).toEqual([]);
    const design = designQa(jail).filter((f) => f.severity === "critical" || f.severity === "serious");
    expect(design, JSON.stringify(design, null, 2)).toEqual([]);
  });

  it("exports redact secrets and keep repository-relative paths", () => {
    const html = markdownToHtml("# Report\n- token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789\n| a | b |\n|---|---|\n| `x` | y |");
    expect(html).toContain("<table>");
    const { app } = makeApp();
    const { project } = makeProject(app, { "src/config.ts": 'export const API_KEY = "sk-proj-abcdefghijklmnopqrstuvwxyz0123";\n' });
    const md = app.verifier.reports.repositoryIntelligence(project.id);
    expect(md).not.toContain("sk-proj-abcdefghij");
    expect(md).not.toMatch(/[A-Za-z]:\\|\/tmp\//);
    expect(md).toContain("src/config.ts");
    expect(md).toContain("not legal advice");
  });
});

let canInstall = true;
try {
  execFileSync(process.platform === "win32" ? "where.exe" : "which", ["npm"], { stdio: "ignore" });
} catch {
  canInstall = false;
}

describe.skipIf(!canInstall || process.env.FLOWCODE_SKIP_BROWSER === "1")("browser verification on the reference scheduler", () => {
  it(
    "produces evidence-backed preview, screenshots, axe, smoke flow and a report",
    async () => {
      const { app } = makeApp();
      const ws = referenceApp();
      execFileSync(process.execPath, [path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"), "install", "--no-fund", "--no-audit"], { cwd: ws, stdio: "ignore", timeout: 600_000 });
      const project = app.projects.create({ name: "Reference scheduler", workspacePath: ws });
      const run = app.orchestrator.createRun({ projectId: project.id, objective: "Verify reference scheduler", kind: "template_build", templateId: "react-vite-scheduler", constraints: [], attachedKnowledgeIds: [] });
      app.store.runs.upsert({ ...app.store.runs.require(run.id), strategy: { kind: "template_build", templateId: "react-vite-scheduler", previewStrategy: "vite_dev", requiredChecks: TEMPLATES["react-vite-scheduler"].requiredChecks }, planApproved: true });
      app.verifier.record(run.id, "install", "passed", "installed by test harness", ["test:npm-install"]);
      await app.verifier.runRequired(app.store.runs.require(run.id));
      const checks = Object.fromEntries(app.store.checks.where("run_id = ?", run.id).filter((c) => !c.taskId).map((c) => [c.kind, c]));
      for (const k of ["typecheck", "lint", "build", "server_start", "preview_health", "screenshots"]) expect(checks[k]?.status, `${k}: ${checks[k]?.summary}`).toMatch(/^passed/);
      expect(checks.tests.status, checks.tests.summary).toBe("passed");
      expect(checks.tests.summary).toMatch(/6\/6 steps passed|7\/7 steps passed/);
      expect(checks.accessibility.status, checks.accessibility.summary).toMatch(/^passed/);
      expect(checks.design_qa.status, checks.design_qa.summary).toMatch(/^passed/);
      expect(checks.screenshots.evidenceRefs).toHaveLength(3);
      for (const c of Object.values(checks)) if (c.status.startsWith("passed")) expect(c.evidenceRefs.length, c.kind).toBeGreaterThan(0);
      // Owned processes were cleaned up.
      expect(app.processes.liveForRun(run.id)).toHaveLength(0);
      // Report + PDF export.
      const art = await app.verifier.generateReport(app.store.runs.require(run.id), undefined);
      const md = app.artifacts.read(art.id).content.toString("utf8");
      expect(md).toContain("Verification matrix");
      const pdf = await app.verifier.reports.exportPdf(run.id, md);
      expect(app.artifacts.read(pdf.id).content.subarray(0, 4).toString()).toBe("%PDF");
    },
    600_000,
  );
});
