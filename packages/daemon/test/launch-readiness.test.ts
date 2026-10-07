/** Launch Readiness Checklist: tailored per project, derived from evidence, ticks off as work completes. */
import { describe, expect, it } from "vitest";
import { addLaunchTask, editLaunchItem, launchReadiness, removeLaunchItem, restoreLaunchItems, setLaunchFlag, setLaunchOverride } from "../src/quality/launchReadiness.js";
import { makeApp, makeProject } from "./helpers.js";

type Report = Awaited<ReturnType<typeof launchReadiness>>;
const item = (r: Report, id: string) => r.categories.flatMap((c) => c.items).find((i) => i.id === id)!;
const cat = (r: Report, id: string) => r.categories.find((c) => c.id === id);

const PRD = [
  "# Workshop companion",
  "## 2. Recommended stack",
  "- **Hash routing** (`#/w1/s2`). No server needed.",
  "- **State in `localStorage`** under the key `pdaw2`.",
  "- Users can export and import their notes as a backup.",
].join("\n");

describe("launch readiness checklist", () => {
  it("derives items from files and checks, and ticks them off as checks pass", async () => {
    const { app } = makeApp();
    const { project } = makeProject(app, { "README.md": "# demo\n", ".gitignore": "node_modules\n.env\n", ".env": "SECRET=x\n", "package.json": '{"name":"x"}', "tsconfig.json": "{}" });
    let r = await launchReadiness(app, project.id);
    expect(item(r, "ws.readme").status).toBe("completed");
    expect(item(r, "ws.license").status).toBe("not_started");
    expect(item(r, "ws.env").status).toBe("completed"); // .env exists but is ignored
    // The prototype build's own tasks are not real-app work: no "Build plan" list.
    expect(cat(r, "plan")).toBeUndefined();
    expect(r.totals.total).toBe(r.categories.reduce((n, c) => n + c.items.length, 0));

    const run = app.orchestrator.createRun({ projectId: project.id, objective: "x", constraints: [], attachedKnowledgeIds: [] });
    app.store.checks.upsert({ id: "chk_1", runId: run.id, kind: "typecheck", required: true, status: "running", evidenceRefs: [], summary: "", updatedAt: new Date().toISOString() });
    r = await launchReadiness(app, project.id);
    expect(item(r, "check.typecheck").status).toBe("in_progress");
    app.store.checks.upsert({ id: "chk_1", runId: run.id, kind: "typecheck", required: true, status: "passed", evidenceRefs: [], summary: "tsc clean", updatedAt: new Date(Date.now() + 1000).toISOString() });
    r = await launchReadiness(app, project.id);
    expect(item(r, "check.typecheck").status).toBe("completed");
    expect(item(r, "check.typecheck").evidence).toContain("tsc clean");
    // A failed check is Blocked, not just "needs review".
    app.store.checks.upsert({ id: "chk_1", runId: run.id, kind: "typecheck", required: true, status: "failed", evidenceRefs: [], summary: "2 errors", updatedAt: new Date(Date.now() + 2000).toISOString() });
    r = await launchReadiness(app, project.id);
    expect(item(r, "check.typecheck").status).toBe("blocked");
  });

  it("tailors categories to the spec and lists PRD lines as real-app work a person ticks", async () => {
    const { app } = makeApp();
    const { project } = makeProject(app, { "index.html": "<!doctype html><title>x</title>", "src/state.ts": "const KEY = 'pdaw2';\nlocalStorage.setItem(KEY, '{}');\n" });
    const bare = await launchReadiness(app, project.id);
    expect(cat(bare, "data")).toBeUndefined();
    app.orchestrator.createRun({ projectId: project.id, objective: PRD, constraints: [], attachedKnowledgeIds: [] });
    const r = await launchReadiness(app, project.id);
    expect(cat(r, "data")?.reason).toMatch(/stores data/);
    expect(cat(r, "nav")).toBeDefined();
    expect(item(r, "code.storage").status).toBe("completed");
    const spec = r.categories.find((c) => c.title === "Spec · Recommended stack")!;
    expect(spec).toBeDefined();
    // Code found in the prototype doesn't make a PRD line done in the real app.
    expect(spec.items.find((i) => i.detail.includes("pdaw2"))?.status).toBe("not_started");
    expect(spec.items.every((i) => i.status === "not_started")).toBe(true);
  });

  it("flags an unignored .env as an open launch gate", async () => {
    const { app } = makeApp();
    const { project } = makeProject(app, { ".env": "SECRET=x\n" });
    const r = await launchReadiness(app, project.id);
    expect(item(r, "ws.env").status).toBe("not_started");
    expect(item(r, "ws.env").gate).toBe(true);
    expect(item(r, "ws.env").priority).toBe("critical");
    expect(r.totals.gateOpen).toBeGreaterThan(0);
  });

  it("persists overrides, flags, edits, custom tasks and hide/restore", async () => {
    const { app } = makeApp();
    const { project } = makeProject(app, {});
    setLaunchOverride(app, project.id, "manual.deploy", "completed");
    setLaunchFlag(app, project.id, "manual.rollback", true);
    editLaunchItem(app, project.id, "manual.rollback", { title: "Rollback rehearsed" });
    const id = addLaunchTask(app, project.id, { title: "Legal sign-off", gate: true, severity: "critical" });
    let r = await launchReadiness(app, project.id);
    expect(item(r, "manual.deploy").status).toBe("completed");
    expect(item(r, "manual.rollback").flagged).toBe(true);
    expect(item(r, "manual.rollback").title).toBe("Rollback rehearsed");
    expect(item(r, id).gate).toBe(true);
    expect(cat(r, "custom")?.items.map((i) => i.id)).toContain(id);

    setLaunchOverride(app, project.id, "manual.deploy", "not_applicable");
    removeLaunchItem(app, project.id, "manual.rollback");
    r = await launchReadiness(app, project.id);
    // Not applicable counts as done (guide §5 rule 1).
    expect(r.totals.done).toBe(r.totals.completed + r.totals.not_applicable);
    expect(r.totals.percent).toBe(Math.round((r.totals.done / r.totals.total) * 100));
    expect(cat(r, "launch")?.hidden).toContain("manual.rollback");
    restoreLaunchItems(app, project.id, ["manual.rollback"]);
    removeLaunchItem(app, project.id, id);
    r = await launchReadiness(app, project.id);
    expect(item(r, "manual.rollback")).toBeDefined();
    expect(item(r, id)).toBeUndefined();
  });
});
