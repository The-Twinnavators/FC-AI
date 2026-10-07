/** Build analysis: repository-report findings with FlowCode prompts, honest scoring, resolution marks. */
import { describe, expect, it } from "vitest";
import { buildAnalysisMarkdown, latestBuildAnalysis, markResolved, renderBuildAnalysisHtml, runBuildAnalysis } from "../src/quality/buildAnalysis.js";
import { makeApp, makeProject } from "./helpers.js";

const FILES = {
  "package.json": '{"name":"x","scripts":{"build":"vite build"}}',
  "tsconfig.json": "{}",
  "index.html": "<!doctype html><html><head><title>x</title></head><body><input id=a></body></html>",
  "src/app.ts": "export function load() {\n  try { return JSON.parse(localStorage.getItem('k') || '{}'); } catch {}\n  console.log('debug');\n}\n",
  "src/net.ts": "export const go = () => fetch('/x').then((r) => r.json());\n",
};

describe("build analysis", () => {
  it("produces sectioned findings, each with a FlowCode prompt naming its files", async () => {
    const { app } = makeApp();
    const { project } = makeProject(app, FILES);
    const r = await runBuildAnalysis(app, project.id);
    expect(r.sections.map((s) => s.id)).toEqual(expect.arrayContaining(["build", "spec", "errors", "engineering", "security", "a11y", "compliance"]));
    const all = r.sections.flatMap((s) => s.findings);
    expect(all.length).toBeGreaterThan(0);
    for (const f of all) {
      expect(f.prompt.body).toMatch(/Acceptance criteria:/);
      for (const p of f.files) expect(f.prompt.body).toContain(p);
    }
    expect(all.find((f) => f.key === "errors:empty-catch")?.files).toContain("src/app.ts");
    expect(all.find((f) => f.key === "errors:fetch-no-failure-path")?.files).toContain("src/net.ts");
    expect(all.find((f) => f.key === "engineering:no-ci")?.absence).toBe(true);
    expect(r.reconcilePrompt).toMatch(/Reconcile the major issues/);
    expect(renderBuildAnalysisHtml(r)).toContain("FlowCode prompt");
    expect(buildAnalysisMarkdown(r)).toContain("Reconcile everything major");
  });

  it("caps the overall score when the production build fails", async () => {
    const { app } = makeApp();
    const { project } = makeProject(app, FILES);
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "x", constraints: [], attachedKnowledgeIds: [] });
    app.store.checks.upsert({ id: "chk_b", runId: run.id, kind: "build", required: true, status: "failed", evidenceRefs: [], summary: "error TS2304", updatedAt: new Date().toISOString() });
    const r = await runBuildAnalysis(app, project.id);
    expect(r.sections.find((s) => s.id === "build")!.findings[0].severity).toBe("critical");
    expect(r.overall).toBeLessThanOrEqual(49);
    expect(r.scoreNote).toMatch(/capped/);
  });

  it("records resolution by hand without counting it, and keeps score history", async () => {
    const { app } = makeApp();
    const { project } = makeProject(app, FILES);
    const first = await runBuildAnalysis(app, project.id);
    const key = first.sections.flatMap((s) => s.findings)[0].key;
    const after = markResolved(app, project.id, key, true)!;
    expect(after.sections.flatMap((s) => s.findings).find((f) => f.key === key)?.resolved).toBeDefined();
    const second = await runBuildAnalysis(app, project.id);
    expect(second.history).toHaveLength(2);
    expect(second.resolvedCount).toBe(1);
    expect(latestBuildAnalysis(app, project.id)?.id).toBe(second.id);
  });
});
