/**
 * A local model's later turn is measured with a read allowance and a 2,000-character check result
 * (requestBudget.laterTurnFits). Its tool results are held to those: a read longer than the allowance shows the lines
 * that fit and says how to read the rest (and counts only those lines as seen, so replace_file can't drop the unseen
 * ones); every other result is held to the output allowance in the loop. Without allowances nothing changes.
 */
import { describe, expect, it } from "vitest";
import type { ChatMessage, Task } from "@flowcode/contracts";
import { createDispatcher, linesWithin } from "../src/orchestrator/tools.js";
import { runAgentLoop } from "../src/orchestrator/agentLoop.js";
import { ScriptedProvider, call } from "../src/models/scripted.js";
import { makeApp, makeProject } from "./helpers.js";

const LONG = Array.from({ length: 300 }, (_, i) => `export const v${i} = ${i};`).join("\n") + "\n";

function setup(readChars?: number) {
  const { app } = makeApp();
  const { project, jail } = makeProject(app, { "src/long.ts": LONG });
  app.projects.updateSettings(project.id, { autonomy: "assisted" });
  const run = app.orchestrator.createRun({ projectId: project.id, objective: "o", constraints: [], attachedKnowledgeIds: [] });
  const task = { id: "t1", runId: run.id, title: "Rework long", objective: "Rework src/long.ts", role: "coder", status: "running", attempts: 1, expectedPaths: ["src/long.ts"], actualPaths: [], acceptanceCriteria: [], dependsOn: [], ordinal: 1, validationPlan: { kinds: [] } } as unknown as Task;
  app.store.tasks.upsert(task);
  app.bus.subscribe((e) => void (e.type === "approval.requested" && setTimeout(() => app.approvals.pending().forEach((a) => app.approvals.decide(a.id, "once")), 5)));
  const dispatch = createDispatcher({ project: app.store.projects.require(project.id), run: app.store.runs.require(run.id), task, jail, ops: app.ops, runner: app.runner, approvals: app.approvals, preflight: () => undefined, refreshPreflight: () => app.projects.preflight(project.id), signal: new AbortController().signal, onPathsChanged: () => undefined, onAwaitingApproval: () => undefined, phase: "implementation", readChars: () => readChars });
  return { dispatch };
}

describe("tool results within the later-turn allowances", () => {
  it("shows a long whole read up to the read allowance, says where to go on, and counts only what it showed", async () => {
    const s = setup(2000);
    const r = await s.dispatch("read_file", { path: "src/long.ts" }, undefined, "a");
    const shown = linesWithin(LONG.split("\n"), 2000, 0);
    expect(shown).toBeLessThan(301);
    expect(r.content).toContain(`(src/long.ts: lines 1–${shown} of 301, as much as this step's context holds at once. Read the rest with read_file from=${shown + 1} and to.)`);
    expect(r.content.length).toBeLessThan(2000 + 600);
    expect(r.content).not.toContain(`v${shown} = ${shown};`);
    // Only the shown lines are seen: a whole rewrite is refused until the rest is read.
    const refused = await s.dispatch("replace_file", { path: "src/long.ts", content: "export const w = 1;\n", reason: "rework" }, undefined, "b");
    expect(refused.content).toMatch(new RegExp(`lines ${shown + 1}–301 of 301 are unseen`));
  });

  it("cuts a ranged read at the allowance and names the next line", async () => {
    const s = setup(2000);
    const r = await s.dispatch("read_file", { path: "src/long.ts", from: 1, to: 300 }, undefined, "a");
    const to = linesWithin(LONG.split("\n").slice(0, 300), 2000, 5);
    expect(r.content).toContain(`lines 1–${to} of 301`);
    expect(r.content).toContain(`Lines after ${to} didn't fit this step's context: read them next with from=${to + 1}.`);
    expect(r.content.length).toBeLessThan(2000 + 600);
  });

  it("changes nothing without an allowance", async () => {
    const s = setup();
    const r = await s.dispatch("read_file", { path: "src/long.ts" }, undefined, "a");
    expect(r.content).toContain("v299 = 299;");
    expect(r.content).not.toContain("as much as this step's context holds");
  });

  it("holds reads to the read allowance and every other result to the output allowance in the loop", async () => {
    const { app } = makeApp();
    const replies = [
      () => ({ toolCalls: [call("read_file", { path: "a.ts" })] }),
      () => ({ toolCalls: [call("run_script", { script: "typecheck", reason: "check" })] }),
      () => ({ toolCalls: [call("task_complete", { summary: "done", changedPaths: [] })] }),
    ];
    let turn = 0;
    app.router.register(new ScriptedProvider({ id: "p", kind: "scripted", label: "p", enabled: true, hosted: false }, () => replies[turn++]!()));
    let seen: ChatMessage[] = [];
    await runAgentLoop({
      router: app.router,
      store: app.store,
      bus: app.bus,
      role: "coder",
      assignment: { providerId: "p", model: "m" },
      system: "s",
      user: "u",
      runId: "run_caps",
      maxTurns: 5,
      toolResultChars: 5000,
      outputResultChars: 2000,
      onTranscript: (m) => (seen = [...m]),
      executor: async (name) => {
        if (name === "task_complete") return { ok: true, content: "ok", terminal: { kind: "complete", summary: "done", changedPaths: [] } };
        return { ok: true, content: name === "read_file" ? "r".repeat(9000) : "o".repeat(9000) };
      },
    });
    const results = seen.filter((m) => m.role === "tool").map((m) => String(m.content));
    expect(results[0]).toMatch(/^r{5000}\n\[truncated 4000 chars; read the rest with read_file from and to\]$/);
    expect(results[1]).toMatch(/^o{2000}\n\[truncated 7000 chars\]$/);
  });
});
