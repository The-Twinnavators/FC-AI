/**
 * Unattended builds: every stop is recorded with what resumes it; recoverable ones recover on their own (bounded) and
 * resume exactly once; the person's pauses, cancellations and approvals are never resumed for them; a build marked as
 * working with no worker is found and recovered.
 */
import { describe, expect, it } from "vitest";
import { ScriptedProvider, call } from "../src/models/scripted.js";
import { ModelRouter } from "../src/models/router.js";
import { getInterruption } from "../src/orchestrator/interruptions.js";
import { runActivity } from "../src/api/runActivity.js";
import { acquireGpu } from "../src/models/gpuGate.js";
import { setRuntimeOptions } from "../src/orchestrator/runtimeOptions.js";
import { idealProbeSolver } from "./scripted-agents.js";
import { makeApp, makeProject, waitFor } from "./helpers.js";

const PLAN = {
  goal: "g",
  assumptions: [],
  relevantFiles: ["README.md"],
  expectedChanges: ["src/a.ts"],
  risk: "low",
  riskNotes: [],
  validationPlan: ["final_report"],
  rollbackStrategy: "r",
  tasks: [{ key: "t1", title: "Create a", objective: "Create src/a.ts", dependsOn: [], expectedPaths: ["src/a.ts"], acceptanceCriteria: [{ id: "a", description: "a exists", check: { type: "file_contains", path: "src/a.ts", text: "export const a" } }], verification: [], role: "coder" }],
};

async function harness(opts: { supervised?: boolean } = {}) {
  const { app } = makeApp();
  app.router.sleep = async () => {};
  const service = { up: true };
  const provider = new ScriptedProvider({ id: "scripted", kind: "ollama", label: "Ollama", enabled: true, hosted: false }, async (_req, h) => {
    if ((h[0]?.content ?? "").includes("You are the Planner")) return { content: JSON.stringify(PLAN) };
    const tools = h.filter((m) => m.role === "tool").length;
    return tools === 0 ? { toolCalls: [call("create_file", { path: "src/a.ts", content: "export const a = 1;\n" })] } : { toolCalls: [call("task_complete", { summary: "done", changedPaths: ["src/a.ts"] })] };
  });
  provider.health = async () => (service.up ? { ok: true, detail: "Ollama 0.40.5 at 127.0.0.1:11434" } : { ok: false, detail: "connection_refused: Ollama not reachable" });
  provider.listModels = async () => [{ name: "agent" }];
  app.router.register(provider);
  app.router.register(idealProbeSolver("scripted-ideal"));
  const asg = { providerId: "scripted", model: "agent" };
  const lab = await app.lab.probe({ providerId: "scripted-ideal", model: "agent" });
  app.store.capabilities.upsert({ ...lab, id: "cap_copy", providerId: "scripted", model: "agent", configHash: ModelRouter.configHash(asg) });
  for (const role of ["planner", "coder", "debugger"] as const) app.router.setRoleAssignment(role, asg);
  const { project } = makeProject(app, { "README.md": "# demo\n" });
  app.projects.updateSettings(project.id, { autonomy: opts.supervised ? "supervised" : "assisted" });
  const run = app.orchestrator.createRun({ projectId: project.id, objective: "g", constraints: [], attachedKnowledgeIds: [] });
  const settled = () => waitFor(() => (!app.orchestrator.isActive(run.id) && ["done", "done_with_warnings", "blocked", "failed", "awaiting_approval"].includes(app.store.runs.require(run.id).status) ? app.store.runs.require(run.id) : undefined), 30_000);
  const orch = app.orchestrator as unknown as { reconcileOnStartup: () => Promise<void>; stopWatchdog: () => void; findOrphans: () => string[]; recoveryTimers: Map<string, unknown> };
  // A build interrupted mid-way: planned and run, then its step reopened and the run marked as working with no worker.
  const interrupted = async () => {
    await app.orchestrator.plan(run.id);
    await settled();
    const t = app.orchestrator.graph.tasks(run.id)[0]!;
    app.orchestrator.graph.reopen(run.id, t.id);
    app.store.runs.upsert({ ...app.store.runs.require(run.id), status: "running" });
  };
  return { app, run, service, settled, orch, interrupted, it: () => getInterruption(app.store, run.id) };
}

describe("unattended recovery", () => {
  it("a passing service failure: recorded, recovered on its own once the service answers, and the build finishes", async () => {
    const h = await harness();
    await h.app.orchestrator.plan(h.run.id);
    h.service.up = false;
    h.app.orchestrator.start(h.run.id);
    await h.settled();
    expect(h.it()).toMatchObject({ cause: "provider_unavailable", recoverable: true, needsUser: false, state: "active" });
    expect(h.it()!.nextAttemptAt).toBeTruthy();
    expect(runActivity(h.app, h.run.id).state).toBe("recovering");
    // The service comes back; the scheduled attempt (run here directly) resumes it.
    h.service.up = true;
    expect(await h.app.orchestrator.recoverNow(h.run.id)).toEqual({ resumed: true });
    expect((await h.settled()).status).toMatch(/^done/);
    expect(h.it()!.state).toBe("resolved");
    h.orch.stopWatchdog();
  });

  it("runs out of automatic attempts, says the person is needed, and Retry recovery still works", async () => {
    const h = await harness();
    await h.app.orchestrator.plan(h.run.id);
    h.service.up = false;
    h.app.orchestrator.start(h.run.id);
    await h.settled();
    const max = h.it()!.maxAttempts;
    for (let i = 0; i < max; i++) expect((await h.app.orchestrator.recoverNow(h.run.id)).resumed).toBe(false);
    expect(h.it()).toMatchObject({ needsUser: true, recoverable: false, action: "Blocked: automatic recovery attempts exhausted" });
    expect(await h.app.orchestrator.recoverNow(h.run.id)).toEqual({ resumed: false, why: "needs you" });
    expect(runActivity(h.app, h.run.id).stop?.actions.map((a) => a.kind)).toContain("retry_recovery");
    h.service.up = true;
    expect((await h.app.orchestrator.recoverNow(h.run.id, true)).resumed).toBe(true);
    expect((await h.settled()).status).toMatch(/^done/);
    h.orch.stopWatchdog();
  });

  it("a maintenance pause with an authorized continuation resumes exactly once after the restart's checks", async () => {
    const h = await harness();
    await h.interrupted();
    h.app.orchestrator.pauseForMaintenance(h.run.id, "Benchmarks run on the GPU", "you, in chat");
    expect(runActivity(h.app, h.run.id).label).toBe("Paused for maintenance: will resume automatically after verification");
    await h.orch.reconcileOnStartup();
    expect(h.orch.recoveryTimers.has(h.run.id)).toBe(true);
    const [first, second] = await Promise.all([h.app.orchestrator.recoverNow(h.run.id), h.app.orchestrator.recoverNow(h.run.id)]);
    expect([first.resumed, second.resumed].filter(Boolean).length).toBe(1);
    expect(h.it()!.continuation!.consumedAt).toBeTruthy();
    expect((await h.settled()).status).toMatch(/^done/);
    expect(await h.app.orchestrator.recoverNow(h.run.id)).toEqual({ resumed: false, why: "nothing to recover" });
    h.orch.stopWatchdog();
  });

  it("never resumes the person's pause, on its own or across a restart", async () => {
    const h = await harness();
    await h.interrupted();
    h.app.orchestrator.pauseRun(h.run.id, true);
    expect(await h.app.orchestrator.recoverNow(h.run.id)).toEqual({ resumed: false, why: "waits for you" });
    expect(h.orch.findOrphans()).toEqual([]);
    await h.orch.reconcileOnStartup();
    expect(h.app.orchestrator.isActive(h.run.id)).toBe(false);
    expect(runActivity(h.app, h.run.id)).toMatchObject({ state: "paused", label: "Paused by you" });
    expect(runActivity(h.app, h.run.id).stop!.actions.map((a) => a.kind)).toContain("continue");
    h.orch.stopWatchdog();
  });

  it("waits for a plan approval and never approves it", async () => {
    const h = await harness();
    // A high-risk plan isn't approved on its own: the build waits for the person.
    const p = { ...PLAN, risk: "high", riskNotes: ["Deletes data"] };
    const planner = new ScriptedProvider({ id: "scripted", kind: "ollama", label: "Ollama", enabled: true, hosted: false }, async () => ({ content: JSON.stringify(p) }));
    planner.listModels = async () => [{ name: "agent" }];
    h.app.router.register(planner);
    await h.app.orchestrator.plan(h.run.id);
    expect(h.app.store.runs.require(h.run.id).status).toBe("awaiting_approval");
    expect(h.it()).toMatchObject({ cause: "approval", needsUser: true });
    expect(await h.app.orchestrator.recoverNow(h.run.id)).toEqual({ resumed: false, why: "waits for you" });
    expect(h.app.store.runs.require(h.run.id).planApproved).toBe(false);
  });

  it("finds a build marked as working with no worker and recovers it exactly once; a supervised one waits for the person", async () => {
    const h = await harness();
    // Marked as working, nothing running it (what the controlled build showed after a restart).
    await h.interrupted();
    expect(runActivity(h.app, h.run.id).state).toBe("orphaned");
    expect(h.orch.findOrphans()).toEqual([h.run.id]);
    expect(h.it()).toMatchObject({ cause: "orphaned", recoverable: true });
    const results = await Promise.all([h.app.orchestrator.recoverNow(h.run.id), h.app.orchestrator.recoverNow(h.run.id)]);
    expect(results.filter((r) => r.resumed).length).toBe(1);
    expect((await h.settled()).status).toMatch(/^done/);
    h.orch.stopWatchdog();

    const s = await harness({ supervised: true });
    await s.interrupted();
    s.orch.findOrphans();
    expect(s.it()).toMatchObject({ cause: "orphaned", needsUser: true, recoverable: false });
    expect(await s.app.orchestrator.recoverNow(s.run.id)).toEqual({ resumed: false, why: "needs you" });
    expect(runActivity(s.app, s.run.id).stop!.actions.map((a) => a.kind)).toContain("retry_recovery");
  });

  it("shows a build queued for the GPU, and clears it when its request starts", async () => {
    const h = await harness();
    setRuntimeOptions(h.app.store, { gpuProfile: "8gb" });
    const first = await acquireGpu("coder for another build");
    const waiting = acquireGpu("coder for Clean Cart", undefined, { runId: h.run.id, projectId: h.run.projectId });
    await new Promise((r) => setTimeout(r, 10));
    expect(h.it()).toMatchObject({ cause: "gpu_queue", needsUser: false });
    expect(runActivity(h.app, h.run.id).state).toBe("queued");
    first();
    (await waiting)();
    expect(h.it()!.state).toBe("resolved");
    expect(h.it()!.resolution).toMatch(/^Started: the GPU is free/);
    setRuntimeOptions(h.app.store, { gpuProfile: "standard" });
  });
});
