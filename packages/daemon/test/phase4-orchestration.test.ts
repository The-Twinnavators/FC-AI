/**
 * Phase 4 acceptance: a mocked agent completes a multi-task change; an interruption resumes at the
 * correct task; a blocked prerequisite invalidates downstream tasks. Also: prose-only answers are
 * not treated as work, and Done is computed by the gate.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { ScriptedProvider, call } from "../src/models/scripted.js";
import type { ChatMessage } from "../src/models/types.js";
import { evaluateCompletionGate } from "../src/orchestrator/completionGate.js";
import { idealProbeSolver } from "./scripted-agents.js";
import { makeApp, makeProject, waitFor } from "./helpers.js";

const PLAN = {
  goal: "Add a greeting module with a formatter and an index export",
  assumptions: ["No existing greeting code"],
  relevantFiles: ["README.md"],
  expectedChanges: ["src/greet.ts", "src/format.ts", "src/index.ts"],
  risk: "low",
  riskNotes: [],
  validationPlan: ["final_report"],
  rollbackStrategy: "Restore snapshots",
  tasks: [
    { key: "t1", title: "Create greet", objective: "Create src/greet.ts", dependsOn: [], expectedPaths: ["src/greet.ts"], acceptanceCriteria: [{ id: "a", description: "greet exists", check: { type: "file_contains", path: "src/greet.ts", text: "export function greet" } }], verification: [], role: "coder" },
    { key: "t2", title: "Create format", objective: "Create src/format.ts", dependsOn: ["t1"], expectedPaths: ["src/format.ts"], acceptanceCriteria: [{ id: "b", description: "format exists", check: { type: "file_contains", path: "src/format.ts", text: "export function shout" } }], verification: [], role: "coder" },
    { key: "t3", title: "Create index", objective: "Create src/index.ts", dependsOn: ["t2"], expectedPaths: ["src/index.ts"], acceptanceCriteria: [{ id: "c", description: "index exports", check: { type: "file_contains", path: "src/index.ts", text: "export * from" } }], verification: [], role: "coder" },
  ],
};

const FILES: Record<string, [string, string]> = {
  "Create greet": ["src/greet.ts", "export function greet(name: string) {\n  return `Hello ${name}`;\n}\n"],
  "Create format": ["src/format.ts", "export function shout(s: string) {\n  return s.toUpperCase();\n}\n"],
  "Create index": ["src/index.ts", 'export * from "./greet";\nexport * from "./format";\n'],
};

interface Behaviour {
  block?: string;
  hang?: string;
  proseFirst?: string;
}

function scriptedAgents(b: Behaviour = {}) {
  const hangs: Array<() => void> = [];
  const provider = new ScriptedProvider({ id: "scripted", kind: "scripted", label: "scripted", enabled: true, hosted: false }, async (req, h: ChatMessage[]) => {
    const sys = h[0]?.content ?? "";
    if (sys.includes("You are the Planner")) return { content: JSON.stringify(PLAN) };
    const user = h.find((m) => m.role === "user")?.content ?? "";
    const title = Object.keys(FILES).find((t) => user.startsWith(`# Task: ${t}`));
    if (!title) return { toolCalls: [call("report_blocked", { reason: "unknown task", nextAction: "-" })] };
    const tools = h.filter((m) => m.role === "tool").length;
    const nudged = h.some((m) => m.role === "user" && m.content.startsWith("Runtime notice"));
    if (b.proseFirst === title && !nudged) return { content: "I will now create the file with the formatter." };
    if (b.block === title) return { toolCalls: [call("report_blocked", { reason: "Cannot decide the API shape", nextAction: "Ask the user" })] };
    if (b.hang === title) {
      await new Promise<void>((resolve) => {
        hangs.push(resolve);
        req.signal?.addEventListener("abort", () => resolve());
      });
    }
    const [p, content] = FILES[title];
    return tools === 0 ? { toolCalls: [call("create_file", { path: p, content })] } : { toolCalls: [call("task_complete", { summary: `created ${p}`, changedPaths: [p] })] };
  });
  return provider;
}

async function setup(app: ReturnType<typeof createApp>, b: Behaviour = {}) {
  app.router.register(scriptedAgents(b));
  app.router.register(idealProbeSolver("scripted-ideal"));
  const asg = { providerId: "scripted", model: "agent" };
  // The scripted coder must pass the capability lab before it can be assigned (FR-M2).
  const lab = await app.lab.probe({ providerId: "scripted-ideal", model: "agent" });
  expect(lab.passed).toBe(true);
  app.store.capabilities.upsert({ ...lab, id: "cap_copy", providerId: "scripted", model: "agent", configHash: (await import("../src/models/router.js")).ModelRouter.configHash(asg) });
  for (const role of ["planner", "coder", "debugger"] as const) app.router.setRoleAssignment(role, asg);
}

describe("orchestration with mocked agents", () => {
  it("tries the fast model on a step's first attempt", async () => {
    const { app } = makeApp();
    await setup(app);
    (await import("../src/orchestrator/runtimeOptions.js")).setRuntimeOptions(app.store, { fastModel: { enabled: true, model: "agent-fast" } });
    const { project } = makeProject(app, { "README.md": "# demo\n" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Add a greeting module", constraints: [], attachedKnowledgeIds: [] });
    await app.orchestrator.plan(run.id);
    app.orchestrator.start(run.id);
    await waitFor(() => (!app.orchestrator.isActive(run.id) && ["done", "done_with_warnings", "blocked", "failed"].includes(app.store.runs.require(run.id).status) ? true : undefined), 30_000);
    const models = new Set(app.store.toolCalls.where("run_id = ?", run.id).map((t) => t.modelAssignment.model));
    expect(models.has("agent-fast")).toBe(true);
    expect(app.bus.list({ runId: run.id, types: ["model.tier"] }).length).toBeGreaterThan(0);
  });

  it("completes a multi-task change, with Done computed by the gate", async () => {
    const { app } = makeApp();
    await setup(app, { proseFirst: "Create format" });
    const { project, ws } = makeProject(app, { "README.md": "# demo\n" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Add a greeting module", constraints: [], attachedKnowledgeIds: [] });
    const planned = await app.orchestrator.plan(run.id);
    expect(planned.planApproved).toBe(true); // low risk → auto-approved, recorded
    app.orchestrator.start(run.id);
    const done = await waitFor(() => {
      const r = app.store.runs.require(run.id);
      return ["done", "done_with_warnings", "blocked", "failed"].includes(r.status) && !app.orchestrator.isActive(run.id) ? r : undefined;
    }, 30_000);
    expect(done.status).toMatch(/^done/);
    for (const [, [p]] of Object.entries(FILES)) expect(fs.existsSync(path.join(ws, p))).toBe(true);
    const tasks = app.orchestrator.graph.tasks(run.id);
    expect(tasks.map((t) => t.status)).toEqual(["verified", "verified", "verified"]);
    expect(tasks.every((t) => t.acceptanceCriteria.every((c) => c.met))).toBe(true);
    // Prose-only reply was nudged, not treated as work.
    expect(app.bus.list({ runId: run.id, types: ["agent.message"] }).some((e) => e.message.includes("I will now create"))).toBe(true);
    // Evidence: report artifact, snapshots, tool calls with model assignment.
    expect(app.verifier.hasFinalReport(run.id)).toBe(true);
    expect(app.snapshots.forRun(run.id)).toHaveLength(3);
    expect(app.store.toolCalls.where("run_id = ?", run.id).every((t) => t.modelAssignment.model === "agent")).toBe(true);
    const report = app.verifier.reports.latestReport(run.id)!;
    expect(report.markdown).toContain("Completion gate");
    expect(report.markdown).not.toMatch(/[A-Za-z]:\\Users\\/);
  });

  it("resumes an interrupted run at the correct task after a daemon restart", async () => {
    const { app, dataDir } = makeApp();
    await setup(app, { hang: "Create format" });
    const { project, ws } = makeProject(app, { "README.md": "# demo\n" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Add a greeting module", constraints: [], attachedKnowledgeIds: [] });
    await app.orchestrator.plan(run.id);
    app.orchestrator.start(run.id);
    // Wait until task 2 is running (task 1 verified), then simulate a crash (abort without cancel).
    await waitFor(() => app.orchestrator.graph.tasks(run.id).find((t) => t.title === "Create format" && t.status === "running"), 20_000);
    (app.orchestrator as unknown as { active: Map<string, AbortController> }).active.get(run.id)!.abort();
    await waitFor(() => !app.orchestrator.isActive(run.id));
    app.db.close();

    // "Restart": new daemon instance on the same data directory.
    const app2 = createApp({ dataDir });
    await setup(app2, {});
    await app2.orchestrator.reconcileOnStartup();
    const before = app2.orchestrator.graph.tasks(run.id);
    expect(before.map((t) => t.status)).toEqual(["verified", "attempted", "pending"]);
    app2.orchestrator.resume(run.id);
    await waitFor(() => {
      const r = app2.store.runs.require(run.id);
      return r.status.startsWith("done") && !app2.orchestrator.isActive(run.id) ? r : undefined;
    }, 30_000);
    // Task 1 was not re-executed: exactly one create_file for greet.ts.
    const greetCalls = app2.store.toolCalls.where("run_id = ?", run.id).filter((t) => t.toolName === "create_file" && JSON.stringify(t.argsRedacted).includes("greet.ts"));
    expect(greetCalls).toHaveLength(1);
    expect(fs.readFileSync(path.join(ws, "src/index.ts"), "utf8")).toContain("export * from");
  });

  it("a blocked prerequisite invalidates downstream tasks and verification", async () => {
    const { app } = makeApp();
    await setup(app, { block: "Create format" });
    const { project } = makeProject(app, { "README.md": "# demo\n" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Add a greeting module", constraints: [], attachedKnowledgeIds: [] });
    await app.orchestrator.plan(run.id);
    app.orchestrator.start(run.id);
    const final = await waitFor(() => {
      const r = app.store.runs.require(run.id);
      return ["done", "done_with_warnings", "blocked", "failed"].includes(r.status) && !app.orchestrator.isActive(run.id) ? r : undefined;
    }, 30_000);
    expect(final.status).toBe("blocked");
    const tasks = app.orchestrator.graph.tasks(run.id);
    expect(tasks.map((t) => t.status)).toEqual(["verified", "blocked", "invalidated"]);
    expect(tasks[2].blocker?.category).toBe("prerequisite");
    expect(app.bus.list({ runId: run.id, types: ["task.invalidated"] })).toHaveLength(1);
    // Retrying the blocked task re-opens its invalidated dependents.
    const reopened = app.orchestrator.graph.reopen(run.id, tasks[1].id);
    expect(reopened.map((t) => t.title)).toEqual(["Create format", "Create index"]);
  });

  it("refuses to run with a Coder that has not passed the capability lab", async () => {
    const { app } = makeApp();
    app.router.register(scriptedAgents());
    for (const role of ["planner", "coder", "debugger"] as const) app.router.setRoleAssignment(role, { providerId: "scripted", model: "agent" } as never);
    const { project } = makeProject(app, { "README.md": "# demo\n" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "x", constraints: [], attachedKnowledgeIds: [] });
    await app.orchestrator.plan(run.id);
    app.orchestrator.start(run.id);
    // With no record, the capability lab runs automatically; this scripted model cannot pass it, so the run blocks.
    const r = await waitFor(() => {
      const x = app.store.runs.require(run.id);
      return x.status === "blocked" ? x : undefined;
    }, 30_000);
    expect(r.status).toBe("blocked");
    const rec = app.lab.latest({ providerId: "scripted", model: "agent" });
    expect(rec?.passed).toBe(false);
    expect(app.store.tasks.where("run_id = ?", run.id).every((t) => t.status === "pending")).toBe(true);
  });

  it("never declares Done without evidence", () => {
    const gate = evaluateCompletionGate({ tasks: [], checks: [], requiredChecks: ["typecheck", "final_report"], hasFinalReport: false, planApproved: true });
    expect(gate.status).toBe("blocked");
    expect(gate.unmet.join(" ")).toMatch(/typecheck/);
    expect(gate.unmet.join(" ")).toMatch(/Final report/);
  });
});
