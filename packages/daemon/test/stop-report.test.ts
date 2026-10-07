/** "Why it stopped": a stopped build always says who or what stopped it and why, and what carries on its work. */
import { describe, expect, it } from "vitest";
import { buildStopReport } from "../src/quality/stopReport.js";
import { makeApp, makeProject } from "./helpers.js";

describe("why a build stopped", () => {
  it("records the reason given when a build is cancelled", async () => {
    const { app } = makeApp();
    const { project } = makeProject(app, { "README.md": "# demo\n" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Add a greeting", constraints: [], attachedKnowledgeIds: [] });
    await app.orchestrator.cancel(run.id, "replaced by a fresh build with the new fixes");
    expect(app.store.runs.require(run.id).statusReason).toBe("replaced by a fresh build with the new fixes");
    const r = (await buildStopReport(app, run.id, { explain: false, web: false }))!;
    expect(r.stoppedBecause).toMatch(/replaced by a fresh build with the new fixes/);
    expect(r.next.some((n) => n.kind === "follow_up")).toBe(true);
  });

  it("points a cancelled retry at the original build that carries on", async () => {
    const { app } = makeApp();
    const { project } = makeProject(app, { "README.md": "# demo\n" });
    const original = app.orchestrator.createRun({ projectId: project.id, objective: "Basic Calendar App", constraints: [], attachedKnowledgeIds: [] });
    const retry = app.orchestrator.createRun({ projectId: project.id, objective: "Resolve the blockers", constraints: [], attachedKnowledgeIds: [], parentRunId: original.id });
    app.store.runs.upsert({ ...app.store.runs.require(original.id), status: "running" });
    await app.orchestrator.cancel(retry.id);
    const r = (await buildStopReport(app, retry.id, { explain: false, web: false }))!;
    expect(r.carriedOnBy?.runId).toBe(original.id);
    expect(r.stoppedBecause).toMatch(/original build \("Basic Calendar App"\) was resumed/);
    expect(r.next[0]).toMatchObject({ kind: "open_run", runId: original.id });
  });

  it("explains that a build stopped by request had no reason recorded, rather than nothing", async () => {
    const { app } = makeApp();
    const { project } = makeProject(app, { "README.md": "# demo\n" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Old build", constraints: [], attachedKnowledgeIds: [] });
    app.store.runs.upsert({ ...app.store.runs.require(run.id), status: "cancelled", statusReason: "Run cancelled by user" });
    const r = (await buildStopReport(app, run.id, { explain: false, web: false }))!;
    expect(r.stoppedBecause).toMatch(/No reason was recorded/);
  });
});
