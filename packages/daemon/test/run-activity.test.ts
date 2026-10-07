/**
 * Honest run status: the state is what the records show, the estimate is a range with its basis (or "not enough data"),
 * and a stall is only suggested from several signals together; nothing is stopped or changed automatically.
 */
import { describe, expect, it } from "vitest";
import { looksLikeQuestion } from "@flowcode/contracts";
import type { App } from "../src/app.js";
import { estimate, runActivity } from "../src/api/runActivity.js";
import { makeApp, makeProject } from "./helpers.js";

function setup(app: App, status: string) {
  const { project } = makeProject(app, { "README.md": "# demo\n" });
  const r = app.orchestrator.createRun({ projectId: project.id, objective: "Build", constraints: [], attachedKnowledgeIds: [] });
  app.store.runs.upsert({ ...app.store.runs.require(r.id), status: status as never });
  return app.store.runs.require(r.id);
}
function task(app: App, runId: string, id: string, status: string, attempts = 1) {
  app.store.tasks.upsert({ id, runId, title: `Step ${id}`, objective: "x", status: status as never, dependsOn: [], expectedPaths: [], actualPaths: [], acceptanceCriteria: [], validationPlan: { kinds: [] }, role: "coder", ordinal: 0, attempts });
}
/** Records a step that took `min` minutes, by writing its events with explicit times. */
function pastStep(app: App, runId: string, taskId: string, min: number, at = Date.parse("2026-10-01T10:00:00Z")) {
  const ins = (type: string, t: number) => app.db.run("INSERT INTO events (id, type, run_id, task_id, data, created_at) VALUES (?, ?, ?, ?, ?, ?)", `evt_${taskId}_${type}`, type, runId, taskId, JSON.stringify({ type, message: "", data: {} }), new Date(t).toISOString());
  ins("task.started", at);
  ins("task.verified", at + min * 60_000);
}

describe("questions in the project chat", () => {
  it("are answered, not turned into builds", () => {
    for (const q of ["Why did the run stop?", "what's left", "is it done?", "How long will this take?"]) expect(looksLikeQuestion(q), q).toBe(true);
    for (const q of ["Add a footer", "Can you add a dark mode toggle?", "Please make the header sticky", "Move the dot inside the badge", "Fix the login page.\nAlso the footer.\nAnd the nav."]) expect(looksLikeQuestion(q), q).toBe(false);
  });
});

describe("run activity", () => {
  it("reports a stopped build as needing a decision, and finished-but-unchecked as such", () => {
    const { app } = makeApp();
    expect(runActivity(app, setup(app, "blocked").id).state).toBe("needs_decision");
    expect(runActivity(app, setup(app, "done_unverified").id).label).toBe("Finished, not fully checked");
  });

  it("separates waiting for approval from working, and ignores optional suggestions", () => {
    const { app } = makeApp();
    const run = setup(app, "running");
    app.approvals.request({ projectId: run.projectId, runId: run.id, kind: "enhancement_idea", action: "Add dark mode", reason: "idea", affected: [], risk: "low", consequencesOfDenial: "none" } as never);
    expect(runActivity(app, run.id).state).not.toBe("waiting_approval");
    app.approvals.request({ projectId: run.projectId, runId: run.id, kind: "command", action: "npm install left-pad", reason: "test", affected: [], risk: "medium", consequencesOfDenial: "the step stops" } as never);
    const a = runActivity(app, run.id);
    expect(a.state).toBe("waiting_approval");
    expect(a.detail).toBe("npm install left-pad");
  });

  it("says there isn't enough data rather than guessing a time", () => {
    const { app } = makeApp();
    const run = setup(app, "running");
    task(app, run.id, "t1", "pending");
    const eta = estimate(app, run);
    expect(eta.lowMs).toBeUndefined();
    expect(eta.basis).toMatch(/Not enough data yet/);
  });

  it("gives a range from comparable earlier steps, with its basis", () => {
    const { app } = makeApp();
    const old = setup(app, "done");
    [4, 6, 8, 10, 12, 14].forEach((m, i) => pastStep(app, old.id, `old${i}`, m));
    const run = setup(app, "running");
    task(app, run.id, "a", "running");
    task(app, run.id, "b", "pending");
    task(app, run.id, "c", "verified");
    const eta = estimate(app, run);
    expect(eta.remainingSteps).toBe(2);
    expect(eta.lowMs).toBeGreaterThan(0);
    expect(eta.highMs!).toBeGreaterThan(eta.lowMs!);
    expect(eta.basis).toMatch(/2 steps left/);
    expect(eta.basis).toMatch(/waiting for you isn't included/);
  });

  it("suggests a stall only from several signals, and offers actions without taking them", () => {
    const { app } = makeApp();
    const run = setup(app, "running");
    task(app, run.id, "t1", "running");
    app.bus.emit({ type: "model.completed", projectId: run.projectId, runId: run.id, message: "done" });
    // No worker is running this run (nothing started it in the test), and it has been silent for an hour.
    const a = runActivity(app, run.id, Date.now() + 60 * 60_000);
    expect(a.state).toBe("possibly_stalled");
    expect(a.stall?.signals.length).toBeGreaterThanOrEqual(2);
    expect(a.stall?.actions.map((x) => x.kind)).toEqual(["open_details", "pause", "retry_step", "cancel_run"]);
    expect(app.store.runs.require(run.id).status).toBe("running"); // nothing was changed
  });

  it("doesn't call a recent quiet moment a stall", () => {
    const { app } = makeApp();
    const run = setup(app, "running");
    app.bus.emit({ type: "model.requested", projectId: run.projectId, runId: run.id, message: "coder → model" });
    const a = runActivity(app, run.id, Date.now() + 2 * 60_000);
    expect(a.stall?.signals.some((s) => /No model, tool or command activity/.test(s.signal)) ?? false).toBe(false);
  });
});
