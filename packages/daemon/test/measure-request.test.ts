/**
 * Measuring a step's request (Orchestrator.measureRequest) goes through the attempt's own assembly and stops before the
 * model: no chat call, no request artifact, the task's status and attempts unchanged, no file written. Its numbers are
 * the ones the attempt would act on (the fitted brief's overflow; the budget from the window and reply cap).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Task } from "@flowcode/contracts";
import { ScriptedProvider } from "../src/models/scripted.js";
import { makeApp, makeProject } from "./helpers.js";

function setup(objective: string) {
  const { app } = makeApp();
  const provider = new ScriptedProvider({ id: "scripted", kind: "ollama", label: "Ollama", enabled: true, hosted: false }, async () => ({ content: "should not be called" }));
  app.router.register(provider);
  for (const role of ["planner", "coder", "debugger"] as const) app.router.setRoleAssignment(role, { providerId: "scripted", model: "agent" });
  const { project, ws } = makeProject(app, { "README.md": "# demo\n", "package.json": JSON.stringify({ name: "demo", version: "1.0.0", scripts: { typecheck: "tsc --noEmit" } }), "src/a.ts": "export const a = 1;\n" });
  const run = app.orchestrator.createRun({ projectId: project.id, objective: "demo", constraints: [], attachedKnowledgeIds: [] });
  const task = { id: "t1", runId: run.id, title: "Change a", objective, status: "blocked", dependsOn: [], expectedPaths: ["src/a.ts"], actualPaths: [], acceptanceCriteria: [{ id: "tc", description: "Typecheck passes", check: { type: "verification", kind: "typecheck" }, evidenceRefs: [] }], validationPlan: { kinds: [] }, role: "coder", ordinal: 1, attempts: 2 } as unknown as Task;
  app.store.tasks.upsert(task);
  return { app, provider, run, task, ws };
}

describe("measuring a step's request", () => {
  it("measures through the attempt's assembly without calling the model or changing the step", async () => {
    const s = setup("Change src/a.ts so a is 2.");
    const before = fs.readFileSync(path.join(s.ws, "src/a.ts"), "utf8");
    const m = await s.app.orchestrator.measureRequest(s.run.id, s.app.store.tasks.require("t1"));
    expect(m).toMatchObject({ task: "Change a", role: "coder", model: "agent", overflowChars: 0, overflowTokens: 0 });
    expect(m!.budgetTokens).toBeGreaterThan(0);
    expect(m!.totalTokens).toBeLessThanOrEqual(m!.budgetTokens);
    expect(m!.files.some((f) => f.startsWith("src/a.ts"))).toBe(true);
    expect(s.provider.calls).toHaveLength(0);
    expect(s.app.store.tasks.require("t1")).toMatchObject({ status: "blocked", attempts: 2 });
    expect(s.app.store.artifacts.where("run_id = ?", s.run.id).filter((a) => a.label.startsWith("Request:"))).toHaveLength(0);
    expect(fs.readFileSync(path.join(s.ws, "src/a.ts"), "utf8")).toBe(before);
  });

  it("reports the overflow of a brief that doesn't fit, as the attempt would see it, instead of stopping", async () => {
    const s = setup(`Change src/a.ts. ${"Requirement: keep every detail of this long instruction exactly as written. ".repeat(1500)}`);
    const m = await s.app.orchestrator.measureRequest(s.run.id, s.app.store.tasks.require("t1"));
    expect(m!.overflowTokens).toBeGreaterThan(0);
    expect(m!.objectiveChars).toBeGreaterThan(100_000);
    expect(s.provider.calls).toHaveLength(0);
    expect(s.app.store.tasks.require("t1")).toMatchObject({ status: "blocked", attempts: 2 });
  });
});
