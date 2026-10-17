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
    const orch = app.orchestrator as unknown as { correctBaseline: (r: unknown, t: Task, b: unknown) => void; baselineCorrected: (r: unknown, t: Task, cp: string) => void };
    const failed = { taskId: "w", sourceState: { snapshotSeq: 3, srcSha256: "x" }, at: "", typecheck: "passed", dataSource: [], journey: { ok: false, summary: '11/13 journey steps passed; failed: Search: opens from the top bar (no working page is this screen (a placeholder doesn\'t count))' }, ok: false };
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
    expect(fix.objective).toContain("- Journey: 11/13 journey steps passed; failed: Search: opens from the top bar");
    expect(fix.acceptanceCriteria.map((c) => (c.check as { kind: string }).kind)).toEqual(["typecheck", "data-source", "functional-journey"]);
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

  it("records the baseline verified at the correction's checkpoint once the correction's checks pass", () => {
    const s = setup();
    s.orch.correctBaseline(s.app.store.runs.require(s.run.id), s.app.store.tasks.require("w"), s.failed);
    const fixId = s.app.store.getSetting<FunctionalBaseline | null>(functionalBaselineKey(s.run.id), null)!.correctionTaskId!;
    // Not before its journey passed.
    s.orch.baselineCorrected(s.app.store.runs.require(s.run.id), s.app.store.tasks.require(fixId), "cp_fix");
    expect(s.app.store.getSetting<FunctionalBaseline | null>(functionalBaselineKey(s.run.id), null)!.ok).toBe(false);
    s.app.verifier.record(s.run.id, "functional_journey", "passed", "13/13 journey steps passed", ["artifact:j"], { taskId: fixId });
    s.orch.baselineCorrected(s.app.store.runs.require(s.run.id), s.app.store.tasks.require(fixId), "cp_fix");
    expect(s.app.store.getSetting<FunctionalBaseline | null>(functionalBaselineKey(s.run.id), null)).toMatchObject({ ok: true, checkpoint: "verified", checkpointId: "cp_fix", taskId: fixId, journey: { ok: true, summary: "13/13 journey steps passed", artifactId: "j" } });
  });
});
