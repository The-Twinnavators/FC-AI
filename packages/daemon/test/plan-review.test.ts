/**
 * Plan review before execution (orchestrator/planReview.ts), through the daemon's API as the plan card uses it:
 *  - each proposed plan is a version with a hash; its approval names them;
 *  - Request changes (before any step starts) supersedes the waiting approval, keeps the old version with the request,
 *    plans again with it and asks for a fresh approval of the next version, which records how it differs;
 *  - a superseded, changed or different-version plan can't be approved; a decision meant for another gate is refused;
 *  - unconfirmed look edits need an explicit choice (use them or discard them), and the approval records the plan
 *    version, hash and look it bound to;
 *  - Request changes is refused once work has started; a draft with one status colour saves.
 */
import { afterEach, describe, expect, it } from "vitest";
import { BASE_APPEARANCE } from "@flowcode/contracts";
import { startServer } from "../src/api/server.js";
import { ScriptedProvider } from "../src/models/scripted.js";
import type { ChatMessage } from "../src/models/types.js";
import { getDesignState, saveDraft, selectDraft } from "../src/workspace/designState.js";
import { idealProbeSolver } from "./scripted-agents.js";
import { makeApp, makeProject } from "./helpers.js";

const step = (key: string, title: string, deps: string[] = []) => ({ key, title, objective: title, dependsOn: deps, expectedPaths: [`src/${key}.ts`], acceptanceCriteria: [{ id: key, description: `${key} exists`, check: { type: "file_exists", path: `src/${key}.ts` } }], verification: [], role: "coder" });
const PLAN1 = { goal: "Clean Cart slice", assumptions: [], relevantFiles: ["README.md"], expectedChanges: ["src/**"], risk: "medium", riskNotes: [], validationPlan: ["final_report"], rollbackStrategy: "Restore snapshots", tasks: [step("home", "Home with search"), step("lists", "Working lists", ["home"]), step("ratings", "Ratings and comments", ["home"])] };
const PLAN2 = { ...PLAN1, tasks: [step("home", "Home with search"), step("save", "Save journey: search, product, save, Saved, reload, unsave", ["home"])] };

type App = ReturnType<typeof makeApp>["app"];
const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const c of closers.splice(0)) await c();
});

async function setup() {
  const { app } = makeApp();
  app.router.register(
    new ScriptedProvider({ id: "scripted", kind: "scripted", label: "scripted", enabled: true, hosted: false }, async (_r, h: ChatMessage[]) => {
      if (!(h[0]?.content ?? "").includes("You are the Planner")) return { content: "" };
      // The revised plan answers the person's request (it reaches the planner through the run's constraints).
      return { content: JSON.stringify(h.some((m) => (m.content ?? "").includes("Revision requested by the person")) ? PLAN2 : PLAN1) };
    }),
  );
  app.router.register(idealProbeSolver("scripted-ideal"));
  const asg = { providerId: "scripted", model: "agent" };
  const lab = await app.lab.probe({ providerId: "scripted-ideal", model: "agent" });
  app.store.capabilities.upsert({ ...lab, id: "cap_copy", providerId: "scripted", model: "agent", configHash: (await import("../src/models/router.js")).ModelRouter.configHash(asg) });
  for (const role of ["planner", "coder", "debugger"] as const) app.router.setRoleAssignment(role, asg);
  const { project } = makeProject(app, { "README.md": "# demo\n", "src/styles/tokens.css": ":root { --color-accent: #2f5bd3; }\n" });
  app.projects.updateSettings(project.id, { autonomy: "supervised" });
  const run = app.orchestrator.createRun({ projectId: project.id, objective: "Clean Cart slice", constraints: [], attachedKnowledgeIds: [] });
  await app.orchestrator.plan(run.id);
  const server = await startServer(app, { port: 0, token: "t", host: "127.0.0.1" });
  closers.push(async () => (app.orchestrator.stopWatchdog(), await server.close()));
  const call = async (method: string, p: string, body?: unknown) => {
    const r = await fetch(`http://127.0.0.1:${server.port}${p}`, { method, headers: { authorization: "Bearer t", "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, body: (await r.json()) as Record<string, unknown> };
  };
  return { app, project, run, call };
}
const pendingPlan = (app: App, runId: string) => app.store.approvals.where("run_id = ? AND status = 'pending'", runId).find((a) => a.kind === "plan" && !a.taskId)!;
const waitFor = async <T>(fn: () => T | undefined, ms = 10_000) => {
  for (let t = 0; t < ms; t += 50) {
    const v = fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("timed out");
};
const stop = (app: App) => {
  for (const [, c] of (app.orchestrator as unknown as { active: Map<string, AbortController> }).active) c.abort();
};

describe("plan review before execution", () => {
  it("each plan is a version with a hash; Request changes keeps the old one, re-plans with the request and needs a fresh approval", async () => {
    const { app, run, call } = await setup();
    const v1 = pendingPlan(app, run.id);
    expect(v1).toMatchObject({ planVersion: 1 });
    expect(v1.planHash).toMatch(/^[0-9a-f]{16}$/);
    const request = "Keep only the save journey; no working lists, ratings or comments.";
    const res = await call("POST", `/runs/${run.id}/plan/request-changes`, { request, planVersion: 1, planHash: v1.planHash });
    expect(res.status).toBe(200);
    expect(app.store.approvals.require(v1.id).status).toBe("superseded");
    const v2 = await waitFor(() => pendingPlan(app, run.id));
    expect(v2.id).not.toBe(v1.id);
    expect(v2.planVersion).toBe(2);
    expect(v2.action).toContain("(version 2)");
    const versions = (await call("GET", `/runs/${run.id}/plan/versions`)).body.versions as Array<Record<string, unknown>>;
    expect(versions.map((v) => [v.version, v.status])).toEqual([[1, "superseded"], [2, "current"]]);
    expect(versions[0]!.revision).toMatchObject({ request, by: "user" });
    expect(versions[0]!.plan).toEqual(expect.objectContaining({ tasks: expect.arrayContaining([expect.objectContaining({ title: "Working lists" })]) }));
    expect(versions[1]!.outcome).toMatchObject({ from: 1, request, addedSteps: ["Save journey: search, product, save, Saved, reload, unsave"], removedSteps: ["Working lists", "Ratings and comments"], keptSteps: 1 });
    expect(app.store.runs.require(run.id).constraints.join(" ")).toContain(request);
    // The superseded approval can't be approved, by its own id or with its version.
    const old = await call("POST", `/approvals/${v1.id}/decision`, { decision: "once", kind: "plan", planVersion: 1, planHash: v1.planHash, lookVersion: 0 });
    expect(old.status).toBe(409);
    expect(old.body.code).toBe("superseded");
    const stale = await call("POST", `/approvals/${v2.id}/decision`, { decision: "once", kind: "plan", planVersion: 1, planHash: v1.planHash, lookVersion: 0 });
    expect(stale.body.code).toBe("superseded");
    const changed = await call("POST", `/approvals/${v2.id}/decision`, { decision: "once", kind: "plan", planVersion: 2, planHash: "0000000000000000", lookVersion: 0 });
    expect(changed.body.code).toBe("changed");
    expect(app.store.runs.require(run.id).planApproved).toBeFalsy();
    // The right version approves, and the record says what it bound to.
    const ok = await call("POST", `/approvals/${v2.id}/decision`, { decision: "once", kind: "plan", planVersion: 2, planHash: v2.planHash, lookVersion: 0 });
    expect(ok.status).toBe(200);
    expect(ok.body.bound).toMatchObject({ planVersion: 2, planHash: v2.planHash, look: { version: null, choice: "base" } });
    expect(app.store.runs.require(run.id).planApproved).toBe(true);
    expect(((await call("GET", `/runs/${run.id}/plan/versions`)).body.versions as Array<{ status: string }>).map((v) => v.status)).toEqual(["superseded", "approved"]);
    stop(app);
  }, 30_000);

  it("unconfirmed look edits need an explicit choice; using them binds the approval to the new look version", async () => {
    const { app, project, run, call } = await setup();
    const a = pendingPlan(app, run.id);
    saveDraft(app.store, project.id, { ...BASE_APPEARANCE, primary: "#2f9dd3" }, { primary: "you" });
    const base = { decision: "once", kind: "plan", planVersion: 1, planHash: a.planHash, lookVersion: 0 };
    const refused = await call("POST", `/approvals/${a.id}/decision`, base);
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe("unconfirmed_look");
    expect(app.store.runs.require(run.id).planApproved).toBeFalsy();
    const ok = await call("POST", `/approvals/${a.id}/decision`, { ...base, look: "use-edits" });
    expect(ok.status).toBe(200);
    expect(ok.body.bound).toMatchObject({ look: { version: 1, choice: "use-edits" } });
    expect(getDesignState(app.store, project.id).selected?.appearance.primary).toBe("#2f9dd3");
    expect(getDesignState(app.store, project.id).draft).toBeUndefined();
    stop(app);
  }, 30_000);

  it("discarding edits approves the look as shown; a look changed since review is refused", async () => {
    const { app, project, run, call } = await setup();
    const a = pendingPlan(app, run.id);
    saveDraft(app.store, project.id, { ...BASE_APPEARANCE, primary: "#1f6f43" }, { primary: "you" });
    selectDraft(app.store, project.id);
    saveDraft(app.store, project.id, { ...BASE_APPEARANCE, primary: "#aa0000" }, { primary: "you" });
    const base = { decision: "once", kind: "plan", planVersion: 1, planHash: a.planHash };
    // The card showed no selected look (version 0), but version 1 is selected now.
    const moved = await call("POST", `/approvals/${a.id}/decision`, { ...base, lookVersion: 0, look: "discard-edits" });
    expect(moved.body.code).toBe("look_changed");
    const ok = await call("POST", `/approvals/${a.id}/decision`, { ...base, lookVersion: 1, look: "discard-edits" });
    expect(ok.status).toBe(200);
    expect(ok.body.bound).toMatchObject({ look: { version: 1, choice: "discard-edits" } });
    expect(getDesignState(app.store, project.id).selected?.appearance.primary).toBe("#1f6f43");
    expect(getDesignState(app.store, project.id).draft).toBeUndefined();
    stop(app);
  }, 30_000);

  it("a decision meant for another gate is refused, both ways", async () => {
    const { app, project, run, call } = await setup();
    const plan = pendingPlan(app, run.id);
    const asInstall = await call("POST", `/approvals/${plan.id}/decision`, { decision: "once", kind: "dependency_install" });
    expect(asInstall.body.code).toBe("wrong_gate");
    const install = app.approvals.request({ projectId: project.id, runId: run.id, kind: "dependency_install", action: "Run npm install", reason: "deps", affected: [], risk: "high", consequencesOfDenial: "-" });
    const asPlan = await call("POST", `/approvals/${install.id}/decision`, { decision: "once", kind: "plan", planVersion: 1, planHash: plan.planHash });
    expect(asPlan.body.code).toBe("wrong_gate");
    expect(app.store.approvals.require(install.id).status).toBe("pending");
    expect(app.store.approvals.require(plan.id).status).toBe("pending");
    stop(app);
  }, 30_000);

  it("Request changes is refused once a step has started", async () => {
    const { app, run, call } = await setup();
    const a = pendingPlan(app, run.id);
    const t = app.orchestrator.graph.tasks(run.id)[0]!;
    app.store.tasks.upsert({ ...t, status: "running" });
    const res = await call("POST", `/runs/${run.id}/plan/request-changes`, { request: "Smaller scope please", planVersion: 1, planHash: a.planHash });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("started");
    expect(app.store.approvals.require(a.id).status).toBe("pending");
    stop(app);
  }, 30_000);

  it("a look draft with a single status colour saves", async () => {
    const { project, call } = await setup();
    const res = await call("POST", `/projects/${project.id}/design/draft`, { appearance: { ...BASE_APPEARANCE, status: { warning: "#a17404" } }, sources: {} });
    expect(res.status).toBe(200);
  }, 30_000);
});
