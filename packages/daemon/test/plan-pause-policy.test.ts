/**
 * Eval 4's setup check (attempt 1 was auto-approved by the Assisted policy, so the plan card never stopped and no
 * concept could be picked): with the Supervised policy, a spec build's plan waits for the person whatever risk the
 * planner gives it (its install step keeps it above low risk), the Home concepts are offered on the card while it
 * waits (Bold aisle, the one approved Home page), and the person's pick is what approval settles. Under Assisted the
 * same plan is approved on its own: the cause, kept as a contrast. Existing controls only; no live build.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { ScriptedProvider } from "../src/models/scripted.js";
import type { ChatMessage } from "../src/models/types.js";
import { appModelKey, type AppModel } from "../src/orchestrator/appModel.js";
import { chooseConcept, conceptOffer, designDirectionKey, type DesignDirection } from "../src/orchestrator/homeConceptOffer.js";
import { idealProbeSolver } from "./scripted-agents.js";
import { makeApp, makeProject } from "./helpers.js";

const MODEL = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "fixtures/apps/eval1-app-model.json"), "utf8")) as AppModel;
// A plan the planner calls low risk, with an install step as every spec build has.
const PLAN = {
  goal: "Clean Cart slice",
  assumptions: [],
  relevantFiles: ["README.md"],
  expectedChanges: ["package.json", "src/App.tsx"],
  risk: "low",
  riskNotes: [],
  validationPlan: ["final_report"],
  rollbackStrategy: "Restore snapshots",
  tasks: [
    { key: "deps", title: "Install dependencies", objective: "Install", dependsOn: [], expectedPaths: ["package-lock.json"], acceptanceCriteria: [{ id: "d", description: "installed", check: { type: "file_exists", path: "package-lock.json" } }], verification: ["install"], role: "coder" },
    { key: "app", title: "Write the app", objective: "Write it", dependsOn: ["deps"], expectedPaths: ["src/App.tsx"], acceptanceCriteria: [{ id: "a", description: "app", check: { type: "file_exists", path: "src/App.tsx" } }], verification: [], role: "coder" },
  ],
};

async function setup(app: ReturnType<typeof createApp>) {
  app.router.register(new ScriptedProvider({ id: "scripted", kind: "scripted", label: "scripted", enabled: true, hosted: false }, async (_r, h: ChatMessage[]) => ((h[0]?.content ?? "").includes("You are the Planner") ? { content: JSON.stringify(PLAN) } : { content: "" })));
  app.router.register(idealProbeSolver("scripted-ideal"));
  const asg = { providerId: "scripted", model: "agent" };
  const lab = await app.lab.probe({ providerId: "scripted-ideal", model: "agent" });
  app.store.capabilities.upsert({ ...lab, id: "cap_copy", providerId: "scripted", model: "agent", configHash: (await import("../src/models/router.js")).ModelRouter.configHash(asg) });
  for (const role of ["planner", "coder", "debugger"] as const) app.router.setRoleAssignment(role, asg);
}

async function planned(autonomy: "supervised" | "assisted") {
  const { app } = makeApp();
  await setup(app);
  const { project } = makeProject(app, { "README.md": "# demo\n" });
  app.projects.updateSettings(project.id, { autonomy });
  const run = app.orchestrator.createRun({ projectId: project.id, objective: "Clean Cart slice", constraints: [], attachedKnowledgeIds: [] });
  const after = await app.orchestrator.plan(run.id);
  return { app, run: after };
}

describe("eval 4 setup: the plan waits for the person, with the concept picker", () => {
  it("Supervised: the plan waits (raised above low risk by its install step), with a plan approval for the person", async () => {
    const { app, run } = await planned("supervised");
    expect(run.plan?.risk).toBe("medium");
    expect(run.status).toBe("awaiting_approval");
    expect(run.planApproved).toBeFalsy();
    expect(app.store.approvals.where("run_id = ? AND status = 'pending'", run.id).map((a) => a.kind)).toEqual(["plan"]);
    expect(app.orchestrator.isActive(run.id)).toBe(false);
    app.orchestrator.stopWatchdog();
  });

  it("while it waits, the card offers Bold aisle (the approved Home page) and only it; the person's pick is what approval settles", async () => {
    const { app, run } = await planned("supervised");
    app.store.setSetting(appModelKey(run.id), MODEL);
    // The live catalog: lookup-home-listings approved, the other two Home pages still on the shelf.
    const offer = conceptOffer(app.store, run.id, false);
    expect(offer.offered).toBe(true);
    expect(offer.concepts.map((c) => [c.id, c.name, c.design])).toEqual([["concept-bold", "Bold aisle", "listings"]]);
    chooseConcept(app.store, app.bus, run, "concept-bold", "user");
    app.orchestrator.approvePlan(run.id, "user", false);
    expect(app.store.getSetting<DesignDirection | null>(designDirectionKey(run.id), null)).toMatchObject({ kind: "concept", conceptId: "concept-bold", visualApproval: "pending" });
    expect(app.store.getSetting<AppModel | null>(appModelKey(run.id), null)?.home?.design).toBe("listings");
    app.orchestrator.stopWatchdog();
  });

  it("Assisted (attempt 1's policy): the same plan is approved on its own, so no concept can be picked", async () => {
    const { app, run } = await planned("assisted");
    expect(run.planApproved).toBe(true);
    expect(app.bus.list({ runId: run.id }).some((e) => /auto-approved by assisted policy: medium-risk plan/.test(e.message))).toBe(true);
    await new Promise((r) => setTimeout(r, 200));
    for (const [, c] of (app.orchestrator as unknown as { active: Map<string, AbortController> }).active) c.abort();
    app.orchestrator.stopWatchdog();
  });
});
