/**
 * The run's absolute deadline (orchestrator/runDeadline.ts), from the eval 3 breach (docs/reliability/DEADLINE-EVAL3.md):
 * kept in FlowCode, checked wherever work starts, enforced at expiry (interruptible work aborted, the run paused, the
 * overrun recorded), held through approval waits, retries and restarts, and lifted only by a recorded extension.
 */
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { ScriptedProvider, call } from "../src/models/scripted.js";
import type { ChatMessage } from "../src/models/types.js";
import { DeadlinePassedError } from "../src/orchestrator/runDeadline.js";
import { getInterruption } from "../src/orchestrator/interruptions.js";
import { idealProbeSolver } from "./scripted-agents.js";
import { makeApp, makeProject, waitFor } from "./helpers.js";

const task = (key: string, title: string, p: string, text: string, dependsOn: string[]) => ({ key, title, objective: `Create ${p}`, dependsOn, expectedPaths: [p], acceptanceCriteria: [{ id: key, description: `${p} exists`, check: { type: "file_contains", path: p, text } }], verification: [], role: "coder" });
const plan = (risk: "low" | "high") => ({
  goal: "Add a greeting module",
  assumptions: [],
  relevantFiles: ["README.md"],
  expectedChanges: ["src/greet.ts", "src/format.ts", "src/index.ts"],
  risk,
  riskNotes: [],
  validationPlan: ["final_report"],
  rollbackStrategy: "Restore snapshots",
  tasks: [task("t1", "Create greet", "src/greet.ts", "export function greet", []), task("t2", "Create format", "src/format.ts", "export function shout", ["t1"]), task("t3", "Create index", "src/index.ts", "export * from", ["t2"])],
});
const FILES: Record<string, [string, string]> = {
  "Create greet": ["src/greet.ts", "export function greet(n: string) {\n  return n;\n}\n"],
  "Create format": ["src/format.ts", "export function shout(s: string) {\n  return s.toUpperCase();\n}\n"],
  "Create index": ["src/index.ts", 'export * from "./greet";\nexport * from "./format";\n'],
};

async function setup(app: ReturnType<typeof createApp>, o: { hang?: string; risk?: "low" | "high" } = {}) {
  const provider = new ScriptedProvider({ id: "scripted", kind: "scripted", label: "scripted", enabled: true, hosted: false }, async (req, h: ChatMessage[]) => {
    if ((h[0]?.content ?? "").includes("You are the Planner")) return { content: JSON.stringify(plan(o.risk ?? "low")) };
    const user = h.find((m) => m.role === "user")?.content ?? "";
    const title = Object.keys(FILES).find((t) => user.startsWith(`# Task: ${t}`));
    if (!title) return { toolCalls: [call("report_blocked", { reason: "unknown task", nextAction: "-" })] };
    // A model call that runs until it is aborted: the work the deadline must stop.
    if (o.hang === title) await new Promise<void>((resolve) => req.signal?.addEventListener("abort", () => resolve()));
    const [p, content] = FILES[title]!;
    return h.filter((m) => m.role === "tool").length === 0 ? { toolCalls: [call("create_file", { path: p, content })] } : { toolCalls: [call("task_complete", { summary: `created ${p}`, changedPaths: [p] })] };
  });
  app.router.register(provider);
  app.router.register(idealProbeSolver("scripted-ideal"));
  const asg = { providerId: "scripted", model: "agent" };
  const lab = await app.lab.probe({ providerId: "scripted-ideal", model: "agent" });
  app.store.capabilities.upsert({ ...lab, id: "cap_copy", providerId: "scripted", model: "agent", configHash: (await import("../src/models/router.js")).ModelRouter.configHash(asg) });
  for (const role of ["planner", "coder", "debugger"] as const) app.router.setRoleAssignment(role, asg);
}

const inSeconds = (s: number) => new Date(Date.now() + s * 1000).toISOString();
const settled = (app: ReturnType<typeof createApp>, runId: string) => waitFor(() => !app.orchestrator.isActive(runId) || undefined, 20_000);

describe("a run's absolute deadline", () => {
  it("stops a model call in progress at expiry, starts no further step, and records the overrun", async () => {
    const { app } = makeApp();
    await setup(app, { hang: "Create format" });
    const { project } = makeProject(app, { "README.md": "# demo\n" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Add a greeting module", constraints: [], attachedKnowledgeIds: [] });
    app.orchestrator.setRunDeadline(run.id, inSeconds(60), "user", "measured slice: two hours");
    await app.orchestrator.plan(run.id);
    app.orchestrator.start(run.id);
    await waitFor(() => app.orchestrator.graph.tasks(run.id).find((t) => t.title === "Create format" && t.status === "running"), 20_000);
    // The deadline comes due while step 2's model call hangs (an extension backwards isn't allowed, so the stored
    // deadline is moved to now the way a clock would reach it, and the timer re-armed).
    app.store.setSetting(`runDeadline:${run.id}`, { ...app.orchestrator.runDeadline(run.id)!, at: inSeconds(0.3) });
    (app.orchestrator as unknown as { armDeadline: (id: string) => void }).armDeadline(run.id);
    await settled(app, run.id);
    const tasks = app.orchestrator.graph.tasks(run.id);
    expect(tasks.find((t) => t.title === "Create greet")?.status).toBe("verified");
    expect(tasks.find((t) => t.title === "Create format")?.status).not.toBe("verified");
    expect(tasks.find((t) => t.title === "Create index")?.status).toBe("pending");
    const d = app.orchestrator.runDeadline(run.id)!;
    expect(d.expired?.inProgress).toEqual(["Create format"]);
    expect(d.expired?.stoppedAt).toBeTruthy();
    expect(d.expired?.overrunMs).toBeGreaterThanOrEqual(0);
    expect(getInterruption(app.store, run.id)).toMatchObject({ cause: "deadline", needsUser: true, recoverable: false });
    expect(app.orchestrator.isRunPaused(run.id)).toBe(true);
  });

  it("refuses Continue, Retry, resume and recovery after expiry, until a recorded extension", async () => {
    const { app } = makeApp();
    // A plan that waits for approval, approved without starting: nothing runs before the deadline is set.
    await setup(app, { risk: "high" });
    const { project } = makeProject(app, { "README.md": "# demo\n" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Add a greeting module", constraints: [], attachedKnowledgeIds: [] });
    await app.orchestrator.plan(run.id);
    app.orchestrator.approvePlan(run.id, "user", false);
    app.orchestrator.setRunDeadline(run.id, inSeconds(-1), "user", "already past");
    expect(() => app.orchestrator.start(run.id)).toThrow(DeadlinePassedError);
    expect(() => app.orchestrator.pauseRun(run.id, false)).toThrow(/deadline .* has passed, so it can't continue/);
    expect(() => app.orchestrator.resume(run.id)).toThrow(DeadlinePassedError);
    const t1 = app.orchestrator.graph.tasks(run.id)[0]!;
    expect(() => app.orchestrator.retryTask(run.id, t1.id)).toThrow(DeadlinePassedError);
    expect(await app.orchestrator.recoverNow(run.id, true)).toMatchObject({ resumed: false });
    expect(app.store.toolCalls.where("run_id = ?", run.id)).toHaveLength(0);
    // An extension must say why, and be later than both the deadline and now.
    expect(() => app.orchestrator.extendRunDeadline(run.id, inSeconds(-30), "user", "too early")).toThrow(/later than/);
    const ext = app.orchestrator.extendRunDeadline(run.id, inSeconds(120), "user", "agreed 30 more minutes");
    expect(ext.extensions).toHaveLength(1);
    expect(ext.extensions[0]).toMatchObject({ by: "user", reason: "agreed 30 more minutes" });
    expect(ext.expired).toBeUndefined();
    app.orchestrator.pauseRun(run.id, false);
    const done = await waitFor(() => {
      const r = app.store.runs.require(run.id);
      return r.status.startsWith("done") && !app.orchestrator.isActive(run.id) ? r : undefined;
    }, 30_000);
    expect(done.status).toMatch(/^done/);
  });

  it("holds through an approval wait: approving the plan after expiry records the approval and starts nothing", async () => {
    const { app } = makeApp();
    await setup(app, { risk: "high" });
    const { project } = makeProject(app, { "README.md": "# demo\n" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Add a greeting module", constraints: [], attachedKnowledgeIds: [] });
    const planned = await app.orchestrator.plan(run.id);
    expect(planned.status).toBe("awaiting_approval");
    app.orchestrator.setRunDeadline(run.id, inSeconds(0.2), "user", "short");
    await new Promise((r) => setTimeout(r, 400));
    const after = app.orchestrator.approvePlan(run.id);
    expect(after.planApproved).toBe(true);
    expect(app.orchestrator.isActive(run.id)).toBe(false);
    expect(app.store.toolCalls.where("run_id = ?", run.id)).toHaveLength(0);
    // What was waiting when it expired is on the record.
    expect(app.orchestrator.runDeadline(run.id)!.expired?.waiting.join(" ")).toMatch(/plan approval pending since/);
  });

  it("a restart doesn't resume an expired run, and re-arms the timer of one that hasn't expired", async () => {
    const { app, dataDir } = makeApp();
    await setup(app, { hang: "Create format" });
    const { project } = makeProject(app, { "README.md": "# demo\n" });
    app.projects.updateSettings(project.id, { autonomy: "assisted" });
    const a = app.orchestrator.createRun({ projectId: project.id, objective: "Add a greeting module", constraints: [], attachedKnowledgeIds: [] });
    await app.orchestrator.plan(a.id);
    app.orchestrator.setRunDeadline(a.id, inSeconds(1.5), "user", "short");
    app.orchestrator.start(a.id);
    await waitFor(() => app.orchestrator.graph.tasks(a.id).find((t) => t.title === "Create format" && t.status === "running"), 20_000);
    // A second build whose deadline is still ahead after the restart.
    const b = app.orchestrator.createRun({ projectId: project.id, objective: "Add a greeting module", constraints: [], attachedKnowledgeIds: [] });
    app.orchestrator.setRunDeadline(b.id, inSeconds(3600), "user", "an hour");
    // Crash before the deadline (no expiry recorded), then the deadline passes while the daemon is down.
    (app.orchestrator as unknown as { active: Map<string, AbortController> }).active.get(a.id)!.abort();
    await settled(app, a.id);
    app.orchestrator.stopWatchdog();
    for (const t of (app.orchestrator as unknown as { deadlineTimers: Map<string, ReturnType<typeof setTimeout>> }).deadlineTimers.values()) clearTimeout(t);
    app.db.close();
    await new Promise((r) => setTimeout(r, 1700));
    const app2 = createApp({ dataDir });
    await setup(app2, { hang: "Create format" });
    await app2.orchestrator.reconcileOnStartup();
    // Assisted builds resume automatically after a restart; this one's deadline passed, so it doesn't.
    expect(app2.orchestrator.isActive(a.id)).toBe(false);
    expect(app2.orchestrator.runDeadline(a.id)!.expired?.where).toBe("daemon restart");
    expect(app2.bus.list({ runId: a.id }).some((e) => /resuming automatically/.test(e.message) && e.seq > 0 && Date.parse(e.createdAt) > Date.now() - 5000)).toBe(false);
    // The other build's expiry timer is back, from the stored deadline.
    const timers = (app2.orchestrator as unknown as { deadlineTimers: Map<string, ReturnType<typeof setTimeout>> }).deadlineTimers;
    expect(timers.has(b.id)).toBe(true);
    expect(timers.has(a.id)).toBe(false);
    for (const t of timers.values()) clearTimeout(t);
    app2.orchestrator.stopWatchdog();
  });

  it("a script's pause isn't recorded as the person's", async () => {
    const { app } = makeApp();
    await setup(app);
    const { project } = makeProject(app, { "README.md": "# demo\n" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Add a greeting module", constraints: [], attachedKnowledgeIds: [] });
    await app.orchestrator.plan(run.id);
    app.orchestrator.pauseRun(run.id, true, "system");
    expect(getInterruption(app.store, run.id)?.cause).not.toBe("user_pause");
    expect(app.store.getSetting(`runPaused:${run.id}`, false)).toBe("system");
    app.orchestrator.pauseRun(run.id, true, "user");
    expect(getInterruption(app.store, run.id)?.cause).toBe("user_pause");
  });
});
