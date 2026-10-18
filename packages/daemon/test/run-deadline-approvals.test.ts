/**
 * The run deadline while a step waits for approval (eval 3 ran past its deadline waiting on the step-level "Review the
 * prototype plan and the design" approval): expiry during the wait stops the step without doing what it waited for;
 * an approval given after expiry records the decision and executes nothing; a restart with that expired approval still
 * present doesn't resume the run. The existing deadline mechanism (orchestrator/runDeadline.ts), no new one.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { ScriptedProvider, call } from "../src/models/scripted.js";
import type { ChatMessage } from "../src/models/types.js";
import { getInterruption } from "../src/orchestrator/interruptions.js";
import { REVIEW } from "../src/orchestrator/templates.js";
import { idealProbeSolver } from "./scripted-agents.js";
import { makeApp, makeProject, waitFor } from "./helpers.js";

const task = (key: string, title: string, p: string, dependsOn: string[]) => ({ key, title, objective: `Create ${p}`, dependsOn, expectedPaths: [p], acceptanceCriteria: [{ id: key, description: `${p} exists`, check: { type: "file_exists", path: p } }], verification: [], role: "coder" });
const PLAN = (first: ReturnType<typeof task>, risk = "low") => ({
  goal: "Add a greeting module",
  assumptions: [],
  relevantFiles: ["README.md"],
  expectedChanges: ["src/greet.ts", "src/index.ts"],
  risk,
  riskNotes: [],
  validationPlan: ["final_report"],
  rollbackStrategy: "Restore snapshots",
  tasks: [first, task("t2", "Create index", "src/index.ts", ["t1"])],
});

/** The agent for "Create greet" asks to write a file outside its planned paths: a step-level approval it waits on. */
async function setup(app: ReturnType<typeof createApp>, first: ReturnType<typeof task>, risk = "low") {
  const provider = new ScriptedProvider({ id: "scripted", kind: "scripted", label: "scripted", enabled: true, hosted: false }, async (_req, h: ChatMessage[]) => {
    if ((h[0]?.content ?? "").includes("You are the Planner")) return { content: JSON.stringify(PLAN(first, risk)) };
    const user = h.find((m) => m.role === "user")?.content ?? "";
    const tools = h.filter((m) => m.role === "tool").length;
    if (user.startsWith("# Task: Create greet")) return tools === 0 ? { toolCalls: [call("create_file", { path: "src/outside.ts", content: "export const outside = 1;\n" })] } : { toolCalls: [call("report_blocked", { reason: "denied", nextAction: "-" })] };
    if (user.startsWith("# Task: Create index")) return tools === 0 ? { toolCalls: [call("create_file", { path: "src/index.ts", content: "export {};\n" })] } : { toolCalls: [call("task_complete", { summary: "index", changedPaths: ["src/index.ts"] })] };
    return { toolCalls: [call("report_blocked", { reason: "unknown task", nextAction: "-" })] };
  });
  app.router.register(provider);
  app.router.register(idealProbeSolver("scripted-ideal"));
  const asg = { providerId: "scripted", model: "agent" };
  const lab = await app.lab.probe({ providerId: "scripted-ideal", model: "agent" });
  app.store.capabilities.upsert({ ...lab, id: "cap_copy", providerId: "scripted", model: "agent", configHash: (await import("../src/models/router.js")).ModelRouter.configHash(asg) });
  for (const role of ["planner", "coder", "debugger"] as const) app.router.setRoleAssignment(role, asg);
}

const inSeconds = (s: number) => new Date(Date.now() + s * 1000).toISOString();
const armNow = (app: ReturnType<typeof createApp>, runId: string, s: number) => {
  // The deadline comes due while the step waits (moved to now the way a clock reaches it, the timer re-armed).
  app.store.setSetting(`runDeadline:${runId}`, { ...app.orchestrator.runDeadline(runId)!, at: inSeconds(s) });
  (app.orchestrator as unknown as { armDeadline: (id: string) => void }).armDeadline(runId);
};
const pending = (app: ReturnType<typeof createApp>, runId: string) => app.store.approvals.where("run_id = ? AND status = 'pending'", runId);

describe("the run deadline while a step waits for approval", () => {
  it("expires during a step-level approval; approving it afterwards executes nothing; a restart doesn't resume it", async () => {
    const { app, dataDir } = makeApp();
    await setup(app, task("t1", "Create greet", "src/greet.ts", []));
    const { project, ws } = makeProject(app, { "README.md": "# demo\n" });
    // Supervised: the step really waits for the person (Assisted would auto-approve an edit inside src/).
    app.projects.updateSettings(project.id, { autonomy: "supervised" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Add a greeting module", constraints: [], attachedKnowledgeIds: [] });
    app.orchestrator.setRunDeadline(run.id, inSeconds(600), "user", "two hours");
    await app.orchestrator.plan(run.id);
    if (!app.orchestrator.isActive(run.id)) app.orchestrator.start(run.id);
    // The step asks to write outside its scope and waits for the person.
    const asked = await waitFor(() => pending(app, run.id).find((a) => a.kind === "file_operation"), 20_000);
    armNow(app, run.id, 0.2);
    await waitFor(() => !app.orchestrator.isActive(run.id) || undefined, 20_000);
    // Stopped at the deadline: the wait is on the record, the file wasn't written, no later step started.
    const d = app.orchestrator.runDeadline(run.id)!;
    expect(d.expired?.waiting.join(" ")).toContain("file_operation approval pending since");
    expect(d.expired?.inProgress).toEqual(["Create greet (waiting for approval)"]);
    expect(d.expired?.stoppedAt).toBeTruthy();
    expect(getInterruption(app.store, run.id)?.cause).toBe("deadline");
    expect(fs.existsSync(path.join(ws, "src/outside.ts"))).toBe(false);
    expect(app.orchestrator.graph.tasks(run.id).find((t) => t.title === "Create index")?.status).toBe("pending");
    const callsAtExpiry = app.store.toolCalls.where("run_id = ?", run.id).length;

    // The person approves it after the deadline: the decision is recorded; nothing it waited for happens.
    const late = app.approvals.decide(asked.id, "once", "approved after the deadline");
    expect(late.status).toBe("approved");
    await new Promise((r) => setTimeout(r, 500));
    expect(fs.existsSync(path.join(ws, "src/outside.ts"))).toBe(false);
    expect(app.orchestrator.isActive(run.id)).toBe(false);
    expect(app.store.toolCalls.where("run_id = ?", run.id).length).toBe(callsAtExpiry);
    expect(() => app.orchestrator.pauseRun(run.id, false)).toThrow(/deadline .* has passed/);

    // A second approval still pending at the restart (asked again, as the agent would on resume): the restart neither
    // resumes the run (assisted builds otherwise resume on their own) nor acts on it.
    const again = app.approvals.request({ projectId: project.id, runId: run.id, taskId: asked.taskId, kind: "file_operation", action: asked.action, reason: asked.reason, affected: asked.affected, risk: "medium", consequencesOfDenial: "-" });
    app.orchestrator.stopWatchdog();
    for (const t of (app.orchestrator as unknown as { deadlineTimers: Map<string, ReturnType<typeof setTimeout>> }).deadlineTimers.values()) clearTimeout(t);
    // Assisted from here: after a restart an assisted build resumes on its own, unless its deadline has passed.
    app.projects.updateSettings(project.id, { autonomy: "assisted" });
    app.db.close();
    const app2 = createApp({ dataDir });
    await setup(app2, task("t1", "Create greet", "src/greet.ts", []));
    await app2.orchestrator.reconcileOnStartup();
    await new Promise((r) => setTimeout(r, 500));
    expect(app2.orchestrator.isActive(run.id)).toBe(false);
    expect(app2.store.approvals.require(again.id).status).not.toBe("approved");
    expect(fs.existsSync(path.join(ws, "src/outside.ts"))).toBe(false);
    expect(app2.store.toolCalls.where("run_id = ?", run.id).length).toBe(callsAtExpiry);
    app2.orchestrator.stopWatchdog();
  });

  it("expires during the review step's approval (eval 3's wait); approving it afterwards starts no step", async () => {
    const { app } = makeApp();
    await setup(app, task("t1", "Create greet", "src/greet.ts", []), "high");
    const { project, ws } = makeProject(app, { "README.md": "# demo\n" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Add a greeting module", constraints: [], attachedKnowledgeIds: [] });
    app.orchestrator.setRunDeadline(run.id, inSeconds(600), "user", "two hours");
    await app.orchestrator.plan(run.id);
    // As a spec build has it: a starter whose runtime steps run by title, and the review as the first step.
    const fresh = app.store.runs.require(run.id);
    app.store.runs.upsert({ ...fresh, strategy: { ...fresh.strategy!, templateId: "react-vite-scheduler" } });
    const first = app.orchestrator.graph.tasks(run.id).find((t) => t.title === "Create greet")!;
    app.store.tasks.upsert({ ...first, title: REVIEW });
    app.orchestrator.approvePlan(run.id, "user");
    const review = await waitFor(() => pending(app, run.id).find((a) => a.kind === "plan" && a.taskId), 20_000);
    armNow(app, run.id, 0.2);
    await waitFor(() => !app.orchestrator.isActive(run.id) || undefined, 20_000);
    expect(app.orchestrator.runDeadline(run.id)!.expired?.waiting.join(" ")).toContain("plan approval pending since");
    // Approved after the deadline (the API's path for a review step's approval decides it, nothing more).
    app.approvals.decide(review.id, "once", "approved after the deadline");
    await new Promise((r) => setTimeout(r, 500));
    expect(app.orchestrator.isActive(run.id)).toBe(false);
    expect(app.orchestrator.graph.tasks(run.id).find((t) => t.title === "Create index")?.status).toBe("pending");
    expect(fs.existsSync(path.join(ws, "src/index.ts"))).toBe(false);
    app.orchestrator.stopWatchdog();
  });
});
