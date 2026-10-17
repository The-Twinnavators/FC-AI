/**
 * The functional baseline and the final journey are separate records: the baseline (on the step that wrote the app,
 * with its checkpoint and source state) never satisfies the run's required functional_journey check; a run that stops
 * in design says "Functional baseline verified at checkpoint …; design unfinished", as partial delivery, not success.
 * The journey's plan comes from the app model and the PRD (browser runs: functional-journey.test.ts).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Task, VerificationCheck } from "@flowcode/contracts";
import { journeyPlan } from "../src/quality/appJourney.js";
import { prdNamedRecords, prdSampleSection, resolveScreenAliases, type AppModel } from "../src/orchestrator/appModel.js";
import { declaredScreens } from "../src/orchestrator/screenPlan.js";
import { evaluateCompletionGate } from "../src/orchestrator/completionGate.js";
import { functionalBaselineKey, type FunctionalBaseline } from "../src/orchestrator/orchestrator.js";
import { makeApp, makeProject } from "./helpers.js";

const PRD = fs.readFileSync(path.join(import.meta.dirname, "../../../docs/handoff/slice/clean-cart-slice-prd.md"), "utf8");
const MODEL = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "fixtures/apps/eval1-app-model.json"), "utf8")) as AppModel;

describe("the journey's plan", () => {
  it("comes from the model and the PRD: a placeholder isn't a screen, an explicit alias is, and the PRD's records are each one record", () => {
    const screens = declaredScreens(PRD);
    const recorded = journeyPlan(MODEL, screens, prdNamedRecords(prdSampleSection(PRD)));
    expect(recorded.screens.find((s) => s.name === "Search")).toMatchObject({ view: "" });
    expect(recorded.records.map((r) => r.title)).toEqual(prdNamedRecords(prdSampleSection(PRD)));
    // The recorded seed lists each PRD product twice with the same identity: still one record, so it must show once.
    expect(recorded.records.every((r) => r.once)).toBe(true);
    const fixed = journeyPlan(resolveScreenAliases(MODEL, screens), screens, []);
    expect(fixed.screens.find((s) => s.name === "Search")).toMatchObject({ view: "catalog", label: "Search", kind: "catalog" });
    expect(fixed.catalog).toEqual({ view: "catalog", label: "Search" });
    expect(fixed.records.length).toBe(3);
  });
});

describe("baseline and final checks", () => {
  const check = (taskId?: string): VerificationCheck => ({ id: `c${taskId ?? "run"}`, runId: "r", ...(taskId ? { taskId } : {}), kind: "functional_journey", required: true, status: "passed", evidenceRefs: ["artifact:a"], summary: "13/13 journey steps passed", updatedAt: "" });
  const task = { id: "t", status: "verified", acceptanceCriteria: [] } as unknown as Task;

  it("a passing baseline (on the step) doesn't satisfy the run's journey check; only the final run-level one does", () => {
    const gate = (checks: VerificationCheck[]) => evaluateCompletionGate({ tasks: [task], checks, requiredChecks: ["functional_journey"], hasFinalReport: true, planApproved: true });
    expect(gate([check("t")]).unmet).toContain('Required check "functional_journey" has no evidence');
    expect(gate([check("t"), check()]).unmet).toEqual([]);
  });

  it("a run stopped in design reports the baseline as partial delivery, not success", async () => {
    const { app } = makeApp();
    const { project } = makeProject(app, { "README.md": "# demo\n" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Clean Cart", constraints: [], attachedKnowledgeIds: [] });
    app.store.runs.upsert({ ...app.store.runs.require(run.id), strategy: { kind: "spec_build", previewStrategy: "none", requiredChecks: ["functional_journey", "final_report"] }, planApproved: true });
    app.store.tasks.upsert({ id: "t1", runId: run.id, title: "Write the app", objective: "o", status: "verified", dependsOn: [], expectedPaths: [], actualPaths: [], acceptanceCriteria: [], validationPlan: { kinds: [] }, role: "coder", ordinal: 1, attempts: 1 } as unknown as Task);
    app.store.tasks.upsert({ id: "t2", runId: run.id, title: "Design the main screens", objective: "o", status: "blocked", dependsOn: [], expectedPaths: [], actualPaths: [], acceptanceCriteria: [], validationPlan: { kinds: [] }, role: "coder", ordinal: 2, attempts: 2 } as unknown as Task);
    const base: FunctionalBaseline = { checkpointId: "cp_after_write", taskId: "t1", sourceState: { snapshotSeq: 12, srcSha256: "abc" }, at: "", typecheck: "passed", dataSource: [], journey: { ok: true, summary: "13/13 journey steps passed" }, ok: true, checkpoint: "verified" };
    app.store.setSetting(functionalBaselineKey(run.id), base);
    app.verifier.record(run.id, "functional_journey", "passed", "13/13 journey steps passed", ["artifact:a"], { taskId: "t1" });
    const messages: string[] = [];
    app.bus.subscribe((e) => void (e.type === "run.status_changed" && messages.push(e.message)));
    const final = await app.orchestrator.finalize(run.id);
    expect(final.status).toBe("blocked");
    expect(messages.at(-1)).toMatch(/^Functional baseline verified at checkpoint cp_after_write; design unfinished \(partial delivery, not success\)\. Done gate not met: /);
    expect(messages.at(-1)).toContain('Required check "functional_journey" has no evidence');
  }, 60_000);
});

describe("a failed baseline governs progression", () => {
  function setup() {
    const { app } = makeApp();
    const { project } = makeProject(app, { "README.md": "# demo\n" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Clean Cart", constraints: [], attachedKnowledgeIds: [] });
    app.store.runs.upsert({ ...app.store.runs.require(run.id), strategy: { kind: "spec_build", previewStrategy: "none", requiredChecks: ["functional_journey", "final_report"] }, planApproved: true });
    const mk = (id: string, title: string, ordinal: number, status: string, dependsOn: string[]) => app.store.tasks.upsert({ id, runId: run.id, title, objective: "o", status, dependsOn, expectedPaths: [], actualPaths: [], acceptanceCriteria: [], validationPlan: { kinds: [] }, role: "coder", ordinal, attempts: 1 } as unknown as Task);
    mk("w", "Write the complete app", 1, "running", []);
    mk("d", "Design the main screens", 2, "pending", ["w"]);
    const orch = app.orchestrator as unknown as {
      correctBaseline: (r: unknown, t: Task, b: unknown) => void;
      baselineGate: (r: unknown, t: Task, v: { allMet: boolean; failures: string[] }, s: AbortSignal) => Promise<{ verdict: { allMet: boolean; failures: string[] }; stop?: boolean }>;
      functionalBaseline: (...a: unknown[]) => Promise<unknown>;
    };
    // The lint check failed too, besides the journey; tests don't apply yet (no test files).
    const failed = { taskId: "w", sourceState: { snapshotSeq: 3, srcSha256: "x" }, at: "", typecheck: "passed", checks: { typecheck: "passed", lint: "failed: 3 errors (no-unused-vars)", build: "passed", tests: "not applicable (no tests yet)" }, dataSource: [], journey: { ok: false, summary: '11/13 journey steps passed; failed: Search: opens from the top bar (no working page is this screen (a placeholder doesn\'t count))' }, ok: false };
    return { app, run, orch, failed };
  }

  it("keeps the generated files unverified and puts one bounded correction step before design, which waits on it", () => {
    const s = setup();
    s.orch.correctBaseline(s.app.store.runs.require(s.run.id), s.app.store.tasks.require("w"), s.failed);
    const base = s.app.store.getSetting<FunctionalBaseline | null>(functionalBaselineKey(s.run.id), null)!;
    expect(base).toMatchObject({ ok: false, checkpoint: "unverified", correctionTaskId: expect.any(String) });
    const cp = s.app.store.checkpoints.require(base.checkpointId);
    expect(cp).toMatchObject({ label: "Generated app, unverified (functional baseline failed)", safe: false });
    expect(s.app.store.checkpoints.where("run_id = ?", s.run.id).some((c) => c.label.startsWith("Verified"))).toBe(false);
    expect(s.app.store.tasks.require("w").status).toBe("skipped");
    const fix = s.app.store.tasks.require(base.correctionTaskId!);
    expect(fix.title).toBe("Correct the generated app");
    expect(fix.objective).toContain("- Lint: failed: 3 errors (no-unused-vars)");
    expect(fix.objective).toContain("- Journey: 11/13 journey steps passed; failed: Search: opens from the top bar");
    // Every applicable technical check, judged as it is (a failed lint can't be passed over), then records and journey.
    expect(fix.acceptanceCriteria.map((c) => (c.check as { kind: string }).kind)).toEqual(["baseline:typecheck", "baseline:lint", "baseline:build", "data-source", "functional-journey"]);
    // Bounded: a step's attempts, and it is never split.
    expect(s.app.store.getSetting(`splitPart:${fix.id}`, false)).toBe(true);
    // Design waits on the correction.
    expect(s.app.store.tasks.require("d").dependsOn).toEqual([fix.id]);
  });

  it("blocks before design when the correction doesn't pass, and claims no verified baseline", async () => {
    const s = setup();
    s.orch.correctBaseline(s.app.store.runs.require(s.run.id), s.app.store.tasks.require("w"), s.failed);
    const fixId = s.app.store.getSetting<FunctionalBaseline | null>(functionalBaselineKey(s.run.id), null)!.correctionTaskId!;
    s.app.store.tasks.upsert({ ...s.app.store.tasks.require(fixId), status: "blocked" });
    const messages: string[] = [];
    s.app.bus.subscribe((e) => void (e.type === "run.status_changed" && messages.push(e.message)));
    const final = await s.app.orchestrator.finalize(s.run.id);
    expect(final.status).toBe("blocked");
    expect(messages.at(-1)).toMatch(/^Done gate not met: /);
    expect(messages.at(-1)).not.toContain("Functional baseline verified");
    expect(s.app.store.tasks.require("d").status).toBe("pending");
  }, 60_000);

  it("verifies a correction only when the complete baseline passes again on the corrected app", async () => {
    const s = setup();
    s.orch.correctBaseline(s.app.store.runs.require(s.run.id), s.app.store.tasks.require("w"), s.failed);
    const fix = s.app.store.tasks.require(s.app.store.getSetting<FunctionalBaseline | null>(functionalBaselineKey(s.run.id), null)!.correctionTaskId!);
    const signal = new AbortController().signal;
    // Its own criteria passed, but the complete baseline run again still fails on lint: not verified.
    s.orch.functionalBaseline = async () => ({ ...s.failed, journey: { ok: true, summary: "16/16 journey steps passed" } });
    const stillFailing = await s.orch.baselineGate(s.app.store.runs.require(s.run.id), fix, { allMet: true, failures: [] }, signal);
    expect(stillFailing.verdict.allMet).toBe(false);
    expect(stillFailing.verdict.failures[0]).toBe("The complete functional baseline, run again on the corrected app, still fails: Lint: failed: 3 errors (no-unused-vars)");
    // All of it passes: verified.
    s.orch.functionalBaseline = async () => ({ ...s.failed, checks: { typecheck: "passed", lint: "passed", build: "passed", tests: "not applicable (no tests yet)" }, journey: { ok: true, summary: "16/16 journey steps passed" }, ok: true });
    const passing = await s.orch.baselineGate(s.app.store.runs.require(s.run.id), fix, { allMet: true, failures: [] }, signal);
    expect(passing.verdict.allMet).toBe(true);
    // The step that writes the app, on a failed baseline: replaced by a correction, stopped here.
    const w2 = setup();
    w2.orch.functionalBaseline = async () => w2.failed;
    const stop = await w2.orch.baselineGate(w2.app.store.runs.require(w2.run.id), w2.app.store.tasks.require("w"), { allMet: true, failures: [] }, signal);
    expect(stop.stop).toBe(true);
    expect(w2.app.store.tasks.require("w").status).toBe("skipped");
  });

  it("judges a baseline check as it is: errors there when the correction started aren't forgiven", async () => {
    const { app } = makeApp();
    const { project, ws } = makeProject(app, { "package.json": JSON.stringify({ name: "demo", version: "1.0.0", scripts: { lint: "eslint ." } }), "lint.js": 'console.log("src/a.ts(1,1): error no-unused-vars");process.exit(1);\n', "src/a.ts": "export const a = 1;\n" });
    const bin = path.join(ws, "node_modules", ".bin");
    fs.mkdirSync(bin, { recursive: true });
    fs.writeFileSync(path.join(bin, "eslint.cmd"), '@node "%~dp0\\..\\..\\lint.js" %*\r\n');
    fs.writeFileSync(path.join(bin, "eslint"), '#!/bin/sh\nnode "$(dirname "$0")/../../lint.js" "$@"\n', { mode: 0o755 });
    app.projects.preflight(project.id);
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "o", constraints: [], attachedKnowledgeIds: [] });
    const task = (kind: string) => ({ id: `t_${kind.replace(/\W/g, "")}`, runId: run.id, title: "Correct the generated app", objective: "o", status: "running", dependsOn: [], expectedPaths: ["src/a.ts"], actualPaths: [], acceptanceCriteria: [{ id: "c", description: "Lint passes", check: { type: "verification", kind }, evidenceRefs: [] }], validationPlan: { kinds: [] }, role: "coder", ordinal: 1, attempts: 1 }) as unknown as Task;
    // The same lint error was there when each step started (its step baseline, captured as the orchestrator does).
    for (const t of [task("lint"), task("baseline:lint")]) {
      app.store.tasks.upsert(t);
      await app.verifier.captureStepBaseline(app.store.runs.require(run.id), t.id);
    }
    const generic = await app.verifier.checkCriteria(app.store.runs.require(run.id), task("lint"));
    const absolute = await app.verifier.checkCriteria(app.store.runs.require(run.id), task("baseline:lint"));
    expect(generic.allMet).toBe(true);
    expect(absolute.allMet).toBe(false);
  }, 60_000);
});
