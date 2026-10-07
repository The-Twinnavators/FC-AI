import { describe, expect, it } from "vitest";
import { makeApp, makeProject } from "./helpers.js";
import { runPerformance } from "../src/api/performance.js";

describe("run performance", () => {
  it("splits model time into loading, reading and writing, and counts loads, switches and waiting", () => {
    const { app } = makeApp();
    const { project } = makeProject(app);
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "x", constraints: [], attachedKnowledgeIds: [] });
    const ev = { projectId: project.id, runId: run.id };
    const call = (model: string, role: string, timing: { loadMs: number; promptMs: number; generateMs: number }, out: number, chars: number) =>
      app.bus.emit({ ...ev, type: "model.completed", message: "m", data: { role, model, durationMs: timing.loadMs + timing.promptMs + timing.generateMs, usage: { promptTokens: 1000, completionTokens: out }, timing, promptChars: chars } });
    app.bus.emit({ ...ev, type: "phase.started", message: "p", data: { phase: "planning" } });
    call("qwen3:8b", "planner", { loadMs: 4000, promptMs: 1000, generateMs: 5000 }, 200, 9000);
    app.bus.emit({ ...ev, type: "phase.completed", message: "p", data: { phase: "planning" } });
    call("qwen3:14b", "coder", { loadMs: 9000, promptMs: 2000, generateMs: 10_000 }, 300, 15_000);
    call("qwen3:14b", "coder", { loadMs: 100, promptMs: 1000, generateMs: 4000 }, 100, 12_000);
    app.bus.emit({ ...ev, type: "model.failed", message: "f", data: {} });

    const p = runPerformance(app, run.id);
    expect(p.model.calls).toBe(3);
    expect(p.model.failed).toBe(1);
    expect(p.model.hasTiming).toBe(true);
    expect([p.model.loadMs, p.model.promptMs, p.model.generateMs]).toEqual([13_100, 4000, 19_000]);
    expect(p.model.coldLoads).toBe(2);
    expect(p.model.switches).toBe(1);
    expect(p.model.maxPromptChars).toBe(15_000);
    expect(p.model.avgPromptChars).toBe(12_000);
    expect(p.model.tokensPerSec).toBe(31.6);
    expect(p.model.byModel.map((m) => [m.model, m.calls, m.coldLoads])).toEqual([["qwen3:14b", 2, 1], ["qwen3:8b", 1, 1]]);
    expect(p.busy.modelMs).toBe(36_100);
    expect(p.phases.map((x) => x.phase)).toEqual(["planning"]);
    expect(p.slowest[0]).toMatchObject({ kind: "model", ms: 21_000 });
    expect(p.notes[0]).toMatch(/Most of the working time went to the AI model/);
    expect(p.notes.join(" ")).toMatch(/Loading models into memory took 13.1s \(36% of model time\) across 2 loads and 1 model switch/);
  });

  it("says so when a run has no timing breakdown", () => {
    const { app } = makeApp();
    const { project } = makeProject(app);
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "x", constraints: [], attachedKnowledgeIds: [] });
    app.bus.emit({ projectId: project.id, runId: run.id, type: "model.completed", message: "m", data: { role: "coder", model: "m", durationMs: 2000 } });
    const p = runPerformance(app, run.id);
    expect(p.model.hasTiming).toBe(false);
    expect(p.notes.join(" ")).toMatch(/no load, prompt or writing breakdown/);
  });
});
