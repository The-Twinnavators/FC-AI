/**
 * Reliability phase 3: reading that stops producing anything new gets one structured check instead of an ended
 * attempt or a forced edit; legitimate investigation across many files isn't interrupted.
 */
import { describe, expect, it } from "vitest";
import { InvestigationTracker, investigationLimits, parseInvestigationAnswer } from "../src/orchestrator/investigation.js";
import { runAgentLoop, type AgentLoopInput } from "../src/orchestrator/agentLoop.js";
import { ScriptedProvider, call } from "../src/models/scripted.js";
import type { ChatMessage } from "../src/models/types.js";
import { supplyFromProject } from "../src/orchestrator/orchestrator.js";
import { makeApp } from "./helpers.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("counting reads", () => {
  it("tells re-reads of unchanged content from new investigation", () => {
    const t = new InvestigationTracker(investigationLimits(false));
    expect(t.read("src/a.ts", "one").kind).toBe("new");
    expect(t.read("src/b.ts", "two").kind).toBe("new");
    expect(t.read("src/a.ts", "one")).toEqual({ kind: "repeat", times: 2 });
    // Changed since it was read: that's new content, not a repeat.
    expect(t.read("src/a.ts", "one, edited").kind).toBe("new");
    expect([t.newSinceEdit, t.repeatsSinceEdit]).toEqual([3, 1]);
    t.edited();
    expect([t.newSinceEdit, t.repeatsSinceEdit]).toEqual([0, 0]);
  });

  it("has a configurable budget, larger for a cloud model and when relaxed", () => {
    expect(investigationLimits(false)).toEqual({ newReads: 40, repeats: 7, readTurns: 10 });
    expect(investigationLimits(true).newReads).toBe(120);
    expect(investigationLimits(false, true).newReads).toBe(120);
    expect(investigationLimits(false, false, 20)).toEqual({ newReads: 20, repeats: 4, readTurns: 6 });
  });

  it("reads the structured answer, fenced or with words around it", () => {
    expect(parseInvestigationAnswer('Here: ```json\n{"status": "missing information", "detail": "the route ids", "needs": ["src/app/routes.ts"]}\n```')).toEqual({ status: "missing_information", detail: "the route ids", needs: ["src/app/routes.ts"] });
    expect(parseInvestigationAnswer('{"status": "done"}')).toBeUndefined();
    expect(parseInvestigationAnswer("I will read more files")).toBeUndefined();
  });
});

type Reply = (h: ChatMessage[], turn: number) => ReturnType<ConstructorParameters<typeof ScriptedProvider>[1]>;

async function loop(reply: Reply, extra: Partial<AgentLoopInput> = {}) {
  const { app } = makeApp();
  let turn = 0;
  app.router.register(new ScriptedProvider({ id: "p", kind: "scripted", label: "p", enabled: true, hosted: false }, (_req, h) => reply(h, ++turn)));
  const files: Record<string, string> = {};
  const edits: string[] = [];
  const res = await runAgentLoop({
    router: app.router,
    store: app.store,
    bus: app.bus,
    role: "coder",
    assignment: { providerId: "p", model: "m" },
    system: "s",
    user: "u",
    runId: "run_inv",
    maxTurns: 80,
    executor: async (name, args) => {
      const a = args as { path?: string; content?: string };
      if (name === "read_file") return { ok: true, content: files[a.path!] ?? `contents of ${a.path}` };
      if (name === "create_file") {
        files[a.path!] = a.content ?? "";
        edits.push(a.path!);
        return { ok: true, content: "created" };
      }
      if (name === "task_complete") return { ok: true, content: "ok", terminal: { kind: "complete", summary: "done", changedPaths: edits } };
      return { ok: true, content: "ok" };
    },
    ...extra,
  });
  const checks = res.transcript.filter((m) => m.role === "user" && m.content.startsWith("Runtime check:") && /Reply with only this JSON/.test(m.content)).length;
  return { res, edits, checks, events: app.bus.list({ runId: "run_inv", types: ["recovery.action"] }).map((e) => e.message) };
}

const asked = (h: ChatMessage[]) => /Reply with only this JSON/.test(h.at(-1)?.content ?? "");

describe("a repetitive-read scenario", () => {
  it("pauses once, takes 'ready to implement', and goes on to the agent's own change (no dummy edit)", async () => {
    const two = ["src/styles/app.css", "src/screens/HomeScreen.tsx"];
    let ready = false;
    let wrote = false;
    const { res, edits, checks, events } = await loop((h, turn) => {
      if (asked(h)) return ((ready = true), { content: '{"status": "ready_to_implement", "detail": "add the media query to app.css"}' });
      if (ready) return wrote ? { toolCalls: [call("task_complete", { summary: "done", changedPaths: ["src/styles/app.css"] })] } : ((wrote = true), { toolCalls: [call("create_file", { path: "src/styles/app.css", content: "@media (max-width: 375px) {}" })] });
      return { toolCalls: [call("read_file", { path: two[turn % 2] })] };
    });
    expect(checks).toBe(1);
    expect(events.some((e) => /Investigation budget reached \(repeats/.test(e))).toBe(true);
    expect(events.some((e) => /Investigation check: ready to implement/.test(e))).toBe(true);
    expect(res.outcome.kind).toBe("complete");
    expect(edits).toEqual(["src/styles/app.css"]);
  });

  it("ends the attempt when it says it's ready and keeps re-reading (the recovery is bounded)", async () => {
    let ready = false;
    const { res, checks } = await loop((h) => (asked(h) ? ((ready = true), { content: '{"status": "ready_to_implement", "detail": "x"}' }) : { toolCalls: [call("read_file", { path: "src/a.ts" })] }));
    expect(ready).toBe(true);
    expect(checks).toBe(1);
    expect(res.outcome).toMatchObject({ kind: "no_action", reason: expect.stringMatching(/^No progress: .*after saying it was ready to implement/) });
  });

  it("routes an ambiguous step to the person and a too-big step to a split", async () => {
    const ambiguous = await loop((h) => (asked(h) ? { content: '{"status": "ambiguous_task", "detail": "grid of cards or a list?"}' } : { toolCalls: [call("read_file", { path: "src/a.ts" })] }));
    expect(ambiguous.res.outcome).toMatchObject({ kind: "blocked", reason: "Ambiguous task: grid of cards or a list?" });
    const big = await loop((h) => (asked(h) ? { content: '{"status": "split_required", "detail": "tests, then styles"}' } : { toolCalls: [call("read_file", { path: "src/a.ts" })] }));
    expect(big.res.outcome).toMatchObject({ kind: "split_required", reason: "tests, then styles" });
  });
});

describe("a legitimate multi-file investigation", () => {
  it("reads 30 different files over 30 turns, then writes, without being interrupted", async () => {
    const { res, checks, edits } = await loop((_h, turn) => (turn <= 30 ? { toolCalls: [call("read_file", { path: `src/f${turn}.ts` })] } : turn === 31 ? { toolCalls: [call("create_file", { path: "src/new.ts", content: "x" })] } : { toolCalls: [call("task_complete", { summary: "done", changedPaths: ["src/new.ts"] })] }));
    expect(checks).toBe(0);
    expect(res.outcome.kind).toBe("complete");
    expect(edits).toEqual(["src/new.ts"]);
  });

  it("past its budget, gets the files it says it's missing (once), then writes", async () => {
    let supplied: string[] = [];
    let got = false;
    let wrote = false;
    const { res, checks } = await loop(
      (h, turn) => {
        if (asked(h)) return { content: '{"status": "missing_information", "detail": "the screen ids", "needs": ["src/app/routes.ts"]}' };
        if (/what FlowCode found/.test(h.at(-1)?.content ?? "")) got = true;
        if (got) return wrote ? { toolCalls: [call("task_complete", { summary: "done", changedPaths: ["src/x.ts"] })] } : ((wrote = true), { toolCalls: [call("create_file", { path: "src/x.ts", content: "x" })] });
        return { toolCalls: [call("read_file", { path: `src/f${turn}.ts` })] };
      },
      { supplyInfo: async (needs) => ((supplied = needs), "src/app/routes.ts:\nexport const SCREEN_IDS = ['home']") },
    );
    expect(checks).toBe(1);
    expect(supplied).toEqual(["src/app/routes.ts"]);
    expect(res.outcome.kind).toBe("complete");
  });
});

describe("missing information from the project", () => {
  it("supplies a named file or where a name appears, bounded, and nothing outside the project", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-supply-"));
    fs.mkdirSync(path.join(root, "src/app"), { recursive: true });
    fs.writeFileSync(path.join(root, "src/app/routes.ts"), `export const SCREEN_IDS = ["home"];\n${"// pad\n".repeat(2000)}`);
    fs.writeFileSync(path.join(root, "src/App.tsx"), `import { SCREEN_IDS } from "./app/routes";\n`);
    const out = supplyFromProject(root, ["src/app/routes.ts", "where SCREEN_IDS is used", "../../etc/passwd"])!;
    expect(out).toContain('src/app/routes.ts:\nexport const SCREEN_IDS = ["home"];');
    expect(out).toMatch(/Where "SCREEN_IDS" appears:[\s\S]*src\/App\.tsx:1:/);
    expect(out).not.toMatch(/passwd/);
    expect(out.length).toBeLessThanOrEqual(12_000 + 10);
    expect(supplyFromProject(root, ["nothing-like-this-anywhere"])).toBeUndefined();
  });
});

describe("the answer in a run", () => {
  it("an ambiguous step stops for the person as a task_contract problem, without using an attempt", async () => {
    const { makeProject, waitFor } = await import("./helpers.js");
    const { ModelRouter } = await import("../src/models/router.js");
    const { idealProbeSolver } = await import("./scripted-agents.js");
    const { setRuntimeOptions } = await import("../src/orchestrator/runtimeOptions.js");
    const { app } = makeApp();
    // A small budget so the scenario is short (the option the person can set).
    setRuntimeOptions(app.store, { investigationBudget: 6 });
    const plan = { goal: "g", assumptions: [], relevantFiles: ["README.md"], expectedChanges: ["src/a.ts"], risk: "low", riskNotes: [], validationPlan: ["final_report"], rollbackStrategy: "r", tasks: [{ key: "t1", title: "Build the list", objective: "Build the product list", dependsOn: [], expectedPaths: ["src/a.ts"], acceptanceCriteria: [{ id: "a", description: "exists", check: { type: "file_exists", path: "src/a.ts" } }], verification: [], role: "coder" }] };
    let n = 0;
    app.router.register(
      new ScriptedProvider({ id: "scripted", kind: "scripted", label: "s", enabled: true, hosted: false }, async (_req, h) => {
        if ((h[0]?.content ?? "").includes("You are the Planner")) return { content: JSON.stringify(plan) };
        if (/Reply with only this JSON/.test(h.at(-1)?.content ?? "")) return { content: '{"status": "ambiguous_task", "detail": "a grid of cards or a plain list?"}' };
        return { toolCalls: [call("read_file", { path: `README${n++}.md` })] };
      }),
    );
    app.router.register(idealProbeSolver("scripted-ideal"));
    const asg = { providerId: "scripted", model: "agent" };
    const lab = await app.lab.probe({ providerId: "scripted-ideal", model: "agent" });
    app.store.capabilities.upsert({ ...lab, id: "cap_copy", providerId: "scripted", model: "agent", configHash: ModelRouter.configHash(asg) });
    for (const role of ["planner", "coder", "debugger"] as const) app.router.setRoleAssignment(role, asg);
    const { project } = makeProject(app, Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`README${i}.md`, `file ${i}`])));
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "g", constraints: [], attachedKnowledgeIds: [] });
    await app.orchestrator.plan(run.id);
    app.orchestrator.start(run.id);
    await waitFor(() => (!app.orchestrator.isActive(run.id) ? true : undefined), 30_000);
    const task = app.orchestrator.graph.tasks(run.id)[0]!;
    expect(task).toMatchObject({ status: "blocked", attempts: 0, blocker: { failureClass: "task_contract", reason: "Ambiguous task: a grid of cards or a plain list?" } });
  });
});
