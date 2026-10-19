/**
 * A bounded run (boundedRun.ts): only the steps the person names run, and the runner stops itself, enforced in the run
 * loop before any step starts. Another ready step never starts; Continue can't pass the bound; a stuck step ends it
 * without releasing its neighbours; a split ends it with the parts left for a later command. Clearing the bound lets
 * Continue run the rest.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Task } from "@flowcode/contracts";
import { ScriptedProvider, call } from "../src/models/scripted.js";
import type { ChatMessage } from "../src/models/types.js";
import { ModelRouter } from "../src/models/router.js";
import { boundProblem, boundaryStop, type RunBound } from "../src/orchestrator/boundedRun.js";
import { getInterruption } from "../src/orchestrator/interruptions.js";
import { idealProbeSolver } from "./scripted-agents.js";
import { makeApp, makeProject, waitFor } from "./helpers.js";

const crit = (id: string, p: string, text: string) => [{ id, description: `${p} exists`, check: { type: "file_contains", path: p, text } }];
const PLAN = {
  goal: "Greeting module",
  assumptions: [],
  relevantFiles: ["README.md"],
  expectedChanges: ["src/note.ts", "src/greet.ts", "src/format.ts", "src/index.ts"],
  risk: "low",
  riskNotes: [],
  validationPlan: ["final_report"],
  rollbackStrategy: "Restore snapshots",
  tasks: [
    // Ready from the start and first in order: a bound that doesn't name it must not start it.
    { key: "t0", title: "Create note", objective: "Create src/note.ts", dependsOn: [], expectedPaths: ["src/note.ts"], acceptanceCriteria: crit("n", "src/note.ts", "export const note"), verification: [], role: "coder" },
    { key: "t1", title: "Create greet", objective: "Create src/greet.ts", dependsOn: [], expectedPaths: ["src/greet.ts"], acceptanceCriteria: crit("a", "src/greet.ts", "export function greet"), verification: [], role: "coder" },
    { key: "t2", title: "Create format", objective: "Create src/format.ts", dependsOn: ["t1"], expectedPaths: ["src/format.ts"], acceptanceCriteria: crit("b", "src/format.ts", "export function shout"), verification: [], role: "coder" },
    { key: "t3", title: "Create index", objective: "Create src/index.ts", dependsOn: ["t2"], expectedPaths: ["src/index.ts"], acceptanceCriteria: crit("c", "src/index.ts", "export * from"), verification: [], role: "coder" },
  ],
};
const FILES: Record<string, [string, string]> = {
  "Create note": ["src/note.ts", "export const note = 1;\n"],
  "Create greet": ["src/greet.ts", "export function greet(name: string) {\n  return `Hello ${name}`;\n}\n"],
  "Create format": ["src/format.ts", "export function shout(s: string) {\n  return s.toUpperCase();\n}\n"],
  "Create index": ["src/index.ts", 'export * from "./greet";\nexport * from "./format";\n'],
};

async function setup(block?: string) {
  const { app } = makeApp();
  const started: string[] = [];
  app.router.register(
    new ScriptedProvider({ id: "scripted", kind: "scripted", label: "scripted", enabled: true, hosted: false }, async (_req, h: ChatMessage[]) => {
      if ((h[0]?.content ?? "").includes("You are the Planner")) return { content: JSON.stringify(PLAN) };
      const user = h.find((m) => m.role === "user")?.content ?? "";
      const title = Object.keys(FILES).find((t) => user.startsWith(`# Task: ${t}`));
      if (!title) return { toolCalls: [call("report_blocked", { reason: "unknown task", nextAction: "-" })] };
      if (!h.some((m) => m.role === "tool")) started.push(title);
      if (block === title) return { toolCalls: [call("report_blocked", { reason: "Missing information: which greeting the product uses", nextAction: "Ask the user" })] };
      const [p, content] = FILES[title]!;
      return h.some((m) => m.role === "tool") ? { toolCalls: [call("task_complete", { summary: `created ${p}`, changedPaths: [p] })] } : { toolCalls: [call("create_file", { path: p, content })] };
    }),
  );
  app.router.register(idealProbeSolver("scripted-ideal"));
  const asg = { providerId: "scripted", model: "agent" };
  const lab = await app.lab.probe({ providerId: "scripted-ideal", model: "agent" });
  app.store.capabilities.upsert({ ...lab, id: "cap_copy", providerId: "scripted", model: "agent", configHash: ModelRouter.configHash(asg) });
  for (const role of ["planner", "coder", "debugger"] as const) app.router.setRoleAssignment(role, asg);
  const { project, ws } = makeProject(app, { "README.md": "# demo\n" });
  // Supervised: the plan waits for approval, so nothing runs before the bounded command.
  app.projects.updateSettings(project.id, { autonomy: "supervised" });
  const run = app.orchestrator.createRun({ projectId: project.id, objective: "Add a greeting module", constraints: [], attachedKnowledgeIds: [] });
  await app.orchestrator.plan(run.id);
  // Held before approval (approving starts the loop): nothing runs until the bounded command clears the pause.
  app.orchestrator.pauseRun(run.id, true, "system");
  if (!app.store.runs.require(run.id).planApproved) app.orchestrator.approvePlan(run.id, "user", false);
  const byTitle = (t: string) => app.orchestrator.graph.tasks(run.id).find((x) => x.title === t)!;
  const stopped = () => waitFor(() => (!app.orchestrator.isActive(run.id) && app.orchestrator.boundOf(run.id)?.stop ? app.orchestrator.boundOf(run.id) : undefined), 30_000);
  return { app, run, ws, started, byTitle, stopped };
}

describe("a bounded run", () => {
  it("runs only the named steps, stops itself, and Continue can't pass the bound until it is cleared", async () => {
    const s = await setup();
    expect(s.started).toEqual([]);
    s.app.orchestrator.runBounded(s.run.id, [s.byTitle("Create greet").id, s.byTitle("Create format").id]);
    const b = await s.stopped();
    expect(b!.stop!.reason).toBe('every step it named is done ("Create greet", "Create format")');
    expect(s.started).toEqual(["Create greet", "Create format"]);
    expect(s.byTitle("Create note").status).toBe("pending");
    expect(s.byTitle("Create index").status).toBe("pending");
    expect(fs.existsSync(path.join(s.ws, "src/note.ts"))).toBe(false);
    expect(getInterruption(s.app.store, s.run.id)).toMatchObject({ cause: "boundary", recoverable: false, needsUser: true });
    expect(s.app.orchestrator.isRunPaused(s.run.id)).toBe(true);

    // Continue: the loop runs again and stops at the same bound; nothing else starts.
    s.app.orchestrator.pauseRun(s.run.id, false);
    await waitFor(() => (!s.app.orchestrator.isActive(s.run.id) && s.app.orchestrator.isRunPaused(s.run.id) ? true : undefined), 30_000);
    expect(s.started).toEqual(["Create greet", "Create format"]);

    // Cleared: Continue runs the rest.
    s.app.orchestrator.clearBound(s.run.id);
    s.app.orchestrator.pauseRun(s.run.id, false);
    await waitFor(() => (s.byTitle("Create index").status === "verified" && s.byTitle("Create note").status === "verified" ? true : undefined), 30_000);
    expect(s.started.sort()).toEqual(["Create format", "Create greet", "Create index", "Create note"]);
  }, 60_000);

  it("ends at a stuck step without releasing the steps around it", async () => {
    const s = await setup("Create greet");
    s.app.orchestrator.runBounded(s.run.id, [s.byTitle("Create greet").id, s.byTitle("Create format").id]);
    const b = await s.stopped();
    expect(b!.stop!.reason).toMatch(/^"Create greet" stopped \(/);
    expect(s.started).toEqual(["Create greet"]);
    expect(s.byTitle("Create greet").attempts).toBeLessThanOrEqual(3);
    for (const t of ["Create note", "Create format", "Create index"]) expect(s.started).not.toContain(t);
    expect(s.byTitle("Create format").dependsOn).toEqual([s.byTitle("Create greet").id]);
  }, 60_000);

  it("refuses steps that can't run as named", async () => {
    const s = await setup();
    expect(() => s.app.orchestrator.runBounded(s.run.id, [s.byTitle("Create format").id])).toThrow('"Create format" needs "Create greet" first, which isn\'t done and isn\'t named');
    expect(() => s.app.orchestrator.runBounded(s.run.id, ["task_nope"])).toThrow("There is no step task_nope in this build");
    await new Promise((r) => setTimeout(r, 1500));
    expect(s.started).toEqual([]);
    expect(s.app.orchestrator.boundOf(s.run.id)).toBeUndefined();
  });
});

describe("where a bounded run stops", () => {
  const t = (id: string, status: Task["status"], extra: Partial<Task> = {}) => ({ id, title: id.toUpperCase(), status, dependsOn: [], ...extra }) as unknown as Task;
  const bound: RunBound = { taskIds: ["a", "b"], titles: ["A", "B"], declaredAt: "", by: "user" };
  it("goes on while a named step can start, and stops when it is split or nothing named can start", () => {
    expect(boundaryStop(bound, [t("a", "verified"), t("b", "pending")], t("b", "pending"))).toBeUndefined();
    const split = [t("a", "skipped", { blocker: { reason: "split", category: "prerequisite", evidenceRefs: ["p1", "p2"] } as Task["blocker"] }), t("p1", "pending"), t("p2", "pending"), t("b", "pending")];
    expect(boundaryStop(bound, split, t("b", "pending"))).toBe('"A" was split into 2 smaller steps ("P1", "P2"); they run when you name them');
    expect(boundaryStop(bound, [t("a", "verified"), t("b", "invalidated")], undefined)).toBe('nothing it named can start ("B" is invalidated)');
    expect(boundProblem(["a"], [t("a", "verified")])).toBe('"A" is already done');
  });
});
