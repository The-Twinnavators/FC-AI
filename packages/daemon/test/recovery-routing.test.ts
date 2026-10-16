/**
 * Recovery routing: a failed check doesn't hand the step to the debugger by itself. A located error goes back to the
 * coder as a focused correction (the exact diagnostic, the source around it, the types it names); the debugger takes a
 * persistent failure, with a record of what failed, what was tried, why it didn't work and what it gets that's new.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ScriptedProvider, call } from "../src/models/scripted.js";
import { ModelRouter } from "../src/models/router.js";
import { classifyFailure, correctionBrief, getRecovery, routeAfterFailure, sourceNear, typeDefinitions, typeNamesIn, type RecoveryState } from "../src/orchestrator/recoveryRouting.js";
import { recoveryStats, runPerformance } from "../src/api/performance.js";
import { setRuntimeOptions } from "../src/orchestrator/runtimeOptions.js";
import { idealProbeSolver } from "./scripted-agents.js";
import { makeApp, makeProject, waitFor } from "./helpers.js";

const TYPE_ERR = "The project still type-checks: npm run typecheck failed: src/screens/Home.tsx(11,9): error TS2322: Type '{ title: string; cta: string; }' is not assignable to type 'IntrinsicAttributes & HeroSplitProps'.";
const policy = { coderCorrections: 2 };
const none = () => ["the diff"];
const fail = (s: RecoveryState, attempt: number, why: string[], role: "coder" | "debugger" = "coder", outcomeKind = "complete") => routeAfterFailure(s, { attempt, role, outcomeKind, why, signature: why.join("|").replace(/\d+/g, "#") }, policy, none);
const fresh = (): RecoveryState => ({ corrections: 0, history: [] });

describe("classifying a failure", () => {
  it("tells a located error, a refusal, a step that can't be done as written, the service and an unlocated failure apart", () => {
    const t = classifyFailure("complete", [TYPE_ERR]);
    expect(t).toMatchObject({ cls: "implementation", what: "a type error" });
    expect(t.diagnostics[0]).toMatchObject({ kind: "type", file: "src/screens/Home.tsx", line: 11 });
    expect(classifyFailure("complete", ["The step's tests pass: these tests of this part fail:\n- shows four popular categories\n- keeps the header"]).what).toBe("2 failing tests");
    expect(classifyFailure("no_action", ["agent outcome: no_action (Rejected replace_file: Invalid arguments for replace_file: reason: Invalid input)"]).cls).toBe("guard");
    expect(classifyFailure("complete", ["task has no machine-checkable acceptance criteria; it needs manual review"]).cls).toBe("task_contract");
    expect(classifyFailure("model_error", ["agent outcome: model_error"]).cls).toBe("provider");
    expect(classifyFailure("budget_exhausted", ["agent outcome: budget_exhausted (out of turns)"]).cls).toBe("persistent");
    // A loop stop that carries the completion check's own errors is the type error, not the loop.
    expect(classifyFailure("no_action", ["agent outcome: no_action (No progress: the identical task_complete call failed 3 times (Runtime verification FAILED))", TYPE_ERR]).cls).toBe("implementation");
  });
});

describe("routing the next attempt", () => {
  it("gives the coder two focused corrections while each makes progress, then escalates with a record", () => {
    let s = fail(fresh(), 1, [TYPE_ERR]);
    expect(s.next).toMatchObject({ role: "coder", correction: true, label: "Coder correcting a type error" });
    s = fail(s, 2, ["src/a.ts(3,1): error TS2304: Cannot find name 'x'."]);
    expect(s.next).toMatchObject({ role: "coder", correction: true });
    expect(s.corrections).toBe(2);
    s = fail(s, 3, ["src/a.ts(9,1): error TS2551: Property 'nme' does not exist."]);
    expect(s.next).toMatchObject({ role: "debugger", label: "Debugger investigating a persistent failure" });
    expect(s.escalation).toMatchObject({ cause: "corrections_exhausted", attempt: 4, different: ["the diff"] });
    expect(s.escalation!.attempted).toHaveLength(3);
    expect(s.escalation!.whyUnresolved).toMatch(/2 focused corrections didn't resolve it/);
    // The debugger keeps the step from then on.
    expect(fail(s, 4, [TYPE_ERR], "debugger").next?.role).toBe("debugger");
  });

  it("stops correcting as soon as a correction makes no progress", () => {
    const s = fail(fail(fresh(), 1, [TYPE_ERR]), 2, [TYPE_ERR]);
    expect(s.next?.role).toBe("debugger");
    expect(s.escalation).toMatchObject({ cause: "no_progress" });
    expect(s.escalation!.whyUnresolved).toMatch(/correction \(attempt 2\) ended with the same failure as attempt 1/);
  });

  it("sends a failure with nothing located straight to the debugger, and never sends a step that can't be done as written there", () => {
    expect(fail(fresh(), 1, ["agent outcome: budget_exhausted (out of turns)"], "coder", "budget_exhausted").escalation).toMatchObject({ cause: "not_located" });
    expect(fail(fresh(), 1, ["task has no machine-checkable acceptance criteria; it needs manual review"]).next?.role).toBe("coder");
  });

  it("with corrections turned off, every retry goes to the debugger, and says why", () => {
    const s = routeAfterFailure(fresh(), { attempt: 1, role: "coder", outcomeKind: "complete", why: [TYPE_ERR], signature: "x" }, { coderCorrections: 0 }, none);
    expect(s.escalation).toMatchObject({ cause: "corrections_off" });
    expect(s.escalation!.whyUnresolved).toMatch(/turned off/);
  });
});

describe("the correction brief", () => {
  it("carries the diagnostic, the lines around it and the type it names, not the whole project", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-brief-"));
    fs.mkdirSync(path.join(root, "src/screens"), { recursive: true });
    fs.mkdirSync(path.join(root, "src/sections"), { recursive: true });
    fs.writeFileSync(path.join(root, "src/screens/Home.tsx"), Array.from({ length: 14 }, (_, i) => (i === 10 ? "  <HeroSplit title='x' cta='Go' />" : `// line ${i + 1}`)).join("\n"));
    fs.writeFileSync(path.join(root, "src/sections/HeroSplit.tsx"), "import x from 'y';\nexport interface HeroSplitProps {\n  title: string;\n  action?: { label: string };\n}\nexport function HeroSplit() {}\n");
    const v = classifyFailure("complete", [TYPE_ERR]);
    expect(typeNamesIn(v.diagnostics)).toEqual(["HeroSplitProps"]);
    const brief = correctionBrief(v, (f, l) => sourceNear(root, f, l), typeDefinitions(root, typeNamesIn(v.diagnostics), ["src/screens/Home.tsx", "src/sections/HeroSplit.tsx"]));
    expect(brief).toMatch(/^Focused correction: fix a type error and nothing else/);
    expect(brief).toContain("   11|   <HeroSplit title='x' cta='Go' />");
    expect(brief).toContain("src/sections/HeroSplit.tsx:2\nexport interface HeroSplitProps {\n  title: string;\n  action?: { label: string };\n}");
    expect(brief).not.toContain("export function HeroSplit");
  });
});

// A stand-in type check: an error at the line of src/a.ts that says BAD.
const CHECK = `const fs = require("fs");\nlet t = "";\ntry { t = fs.readFileSync("src/a.ts", "utf8"); } catch {}\nconst i = t.split("\\n").findIndex((l) => l.includes("BAD"));\nif (i < 0) process.exit(0);\nconsole.log("src/a.ts(" + (i + 1) + ",14): error TS2322: Type 'string' is not assignable to type 'number'.");\nprocess.exit(1);\n`;

async function build(fixOnCorrection: boolean) {
  const { app } = makeApp();
  app.router.sleep = async () => {};
  const plan = {
    goal: "g",
    assumptions: [],
    relevantFiles: ["README.md"],
    expectedChanges: ["src/a.ts"],
    risk: "low",
    riskNotes: [],
    validationPlan: ["final_report"],
    rollbackStrategy: "r",
    tasks: [{ key: "t1", title: "Create a", objective: "Create src/a.ts exporting the number a", dependsOn: [], expectedPaths: ["src/a.ts"], acceptanceCriteria: [{ id: "a", description: "a exists", check: { type: "file_contains", path: "src/a.ts", text: "export const a" } }, { id: "tc", description: "The project still type-checks", check: { type: "verification", kind: "typecheck" } }], verification: [], role: "coder" }],
  };
  const requests: Array<{ role: "coder" | "debugger"; focused: boolean; escalated: boolean; diff: boolean }> = [];
  const provider = new ScriptedProvider({ id: "scripted", kind: "ollama", label: "Ollama", enabled: true, hosted: false }, async (_req, h) => {
    const sys = String(h[0]?.content ?? "");
    if (sys.includes("You are the Planner")) return { content: JSON.stringify(plan) };
    const role = sys.startsWith("You are the Debugger") ? "debugger" : "coder";
    const brief = h.filter((m) => m.role === "user").map((m) => String(m.content)).join("\n");
    const focused = brief.includes("Focused correction: fix a type error");
    requests.push({ role, focused, escalated: brief.includes("Escalated to you (the debugger)"), diff: brief.includes("What the earlier attempts changed (diff)") });
    const did = (name: string) => h.some((m) => m.role === "assistant" && JSON.stringify(m).includes(`"${name}"`));
    const exists = brief.includes("src/a.ts") && (focused || role === "debugger");
    if (!exists && !did("create_file")) return { toolCalls: [call("create_file", { path: "src/a.ts", content: 'export const a: number = "BAD";\n' })] };
    if (exists && !did("read_file")) return { toolCalls: [call("read_file", { path: "src/a.ts" })] };
    if (exists && !did("apply_patch")) return { toolCalls: [call("apply_patch", { path: "src/a.ts", edits: [{ find: /BAD\d*/.exec(fs.readFileSync(path.join(ws, "src/a.ts"), "utf8"))![0], replace: fixOnCorrection && focused ? "1" : `BAD${requests.length}` }] })] };
    return { toolCalls: [call("task_complete", { summary: "done", changedPaths: ["src/a.ts"] })] };
  });
  provider.listModels = async () => [{ name: "agent" }];
  app.router.register(provider);
  app.router.register(idealProbeSolver("scripted-ideal"));
  const asg = { providerId: "scripted", model: "agent" };
  const lab = await app.lab.probe({ providerId: "scripted-ideal", model: "agent" });
  app.store.capabilities.upsert({ ...lab, id: "cap_copy", providerId: "scripted", model: "agent", configHash: ModelRouter.configHash(asg) });
  for (const role of ["planner", "coder", "debugger"] as const) app.router.setRoleAssignment(role, asg);
  const { project, ws } = makeProject(app, { "README.md": "# demo\n", "package.json": JSON.stringify({ name: "demo", version: "1.0.0", scripts: { typecheck: "tsc --noEmit" } }), "check.js": CHECK });
  const bin = path.join(ws, "node_modules", ".bin");
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, "tsc.cmd"), '@node "%~dp0\\..\\..\\check.js" %*\r\n');
  fs.writeFileSync(path.join(bin, "tsc"), '#!/bin/sh\nnode "$(dirname "$0")/../../check.js" "$@"\n', { mode: 0o755 });
  app.projects.preflight(project.id);
  app.projects.updateSettings(project.id, { autonomy: "assisted" });
  // No clarified retry of a blocked build here: only this run's attempts are counted.
  setRuntimeOptions(app.store, { coderCorrections: 2, autoRetry: false });
  const labels: string[] = [];
  app.bus.subscribe((e) => void (e.type === "recovery.action" && (e.data as { routing?: unknown })?.routing && labels.push(e.message)));
  const run = app.orchestrator.createRun({ projectId: project.id, objective: "g", constraints: [], attachedKnowledgeIds: [] });
  await app.orchestrator.plan(run.id);
  await waitFor(() => !app.orchestrator.isActive(run.id) && ["done", "done_with_warnings", "blocked", "failed"].includes(app.store.runs.require(run.id).status), 120_000);
  const task = app.orchestrator.graph.tasks(run.id)[0]!;
  return { app, run, task, requests, labels, ws };
}

describe("a build's recovery", () => {
  it("a type error is corrected by the coder, with the diagnostic up front, and never reaches the debugger", async () => {
    const r = await build(true);
    expect(r.task.status).toBe("verified");
    expect(r.requests.every((x) => x.role === "coder")).toBe(true);
    expect(r.requests.some((x) => x.focused)).toBe(true);
    expect(r.labels[0]).toMatch(/Coder correcting a type error \(attempt 2\): src\/a\.ts:1 TS2322/);
    const stats = runPerformance(r.app, r.run.id).recovery;
    expect(stats).toMatchObject({ steps: 1, verified: 1, firstPass: 0, corrections: { attempts: 1, resolved: 1 }, escalations: { total: 0 }, debuggerAttempts: 0 });
    expect(stats.recoveryMs).toBeGreaterThan(0);
  }, 180_000);

  it("a correction that makes no progress escalates once, with what was tried, and the same wall after that stops the step", async () => {
    const r = await build(false);
    expect(r.task.status).toBe("blocked");
    const roles = r.requests.map((x) => x.role);
    // The coder (first attempt, then its correction), then the debugger: never back to the coder.
    expect(roles.indexOf("debugger")).toBeGreaterThan(roles.lastIndexOf("coder"));
    const dbg = r.requests.filter((x) => x.role === "debugger");
    expect(dbg.length).toBeGreaterThan(0);
    expect(dbg.every((x) => x.escalated && x.diff)).toBe(true);
    expect(r.labels.some((l) => /Debugger investigating a persistent failure \(attempt 3\): The correction \(attempt 2\) ended with the same failure as attempt 1/.test(l))).toBe(true);
    const rec = getRecovery(r.app.store, r.task.id);
    expect(rec.escalation).toMatchObject({ cause: "no_progress" });
    expect(rec.escalation!.different).toContain("the diff of what the earlier attempts changed, so it doesn't repeat them");
    const stats = runPerformance(r.app, r.run.id).recovery;
    expect(stats).toMatchObject({ verified: 0, corrections: { attempts: 1, resolved: 0 }, escalations: { total: 1, byCause: { no_progress: 1 } }, debuggerAttempts: 1 });
  }, 180_000);
});

describe("recovery stats", () => {
  it("count an older run's retries as debugger attempts", () => {
    const at = (s: number) => new Date(Date.UTC(2026, 9, 16, 10, 0, s)).toISOString();
    const events = [
      { type: "task.started", taskId: "t", message: "Task started: X (attempt 1)", createdAt: at(0) },
      { type: "task.started", taskId: "t", message: "Task started: X (attempt 2)", createdAt: at(10) },
      { type: "task.verified", taskId: "t", message: "Task verified: X", createdAt: at(40) },
    ] as never;
    expect(recoveryStats(events, [{ id: "t", status: "verified", attempts: 2 }])).toMatchObject({ debuggerAttempts: 1, recoveryMs: 30_000, firstPass: 0, verified: 1 });
  });
});
