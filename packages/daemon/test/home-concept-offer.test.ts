/**
 * Home concepts inside the plan approval (orchestrator/homeConceptOffer.ts): offered only for a look-up app whose Home
 * pieces are approved, picked on the plan card while the plan waits (no separate stop), settled when the plan is
 * approved (the run's design spec and the app model's Home layout), and timed per phase for the run's report.
 */
import fs from "node:fs";
import path from "node:path";
import { LIBRARY_SECTIONS } from "@flowcode/contracts";
import { describe, expect, it } from "vitest";
import { appModelKey, type AppModel } from "../src/orchestrator/appModel.js";
import { chooseConcept, conceptOffer, conceptTimingsKey, designSpecKey, settleConcept, type ConceptTimings } from "../src/orchestrator/homeConceptOffer.js";
import { runPerformance } from "../src/api/performance.js";
import type { DesignSpec } from "../src/workspace/designSpec.js";
import { makeApp, makeProject } from "./helpers.js";
import { appStep } from "../src/orchestrator/appFiles.js";
import type { OrchestratorDeps } from "../src/orchestrator/orchestrator.js";
import type { Task } from "@flowcode/contracts";

const RECORDED = path.resolve(import.meta.dirname, "../../../.flowcode-data/workspaces/clean-cart-slice-eval-1-9b1947");
const MODEL = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "fixtures/apps/eval1-app-model.json"), "utf8")) as AppModel;
const APPROVED = new Set([...LIBRARY_SECTIONS.map((s) => s.id), "lookup-home-storefront", "lookup-home-magazine", "lookup-home-listings"]);

function lookupRun() {
  const { app } = makeApp();
  const { project } = makeProject(app, { "README.md": "# demo\n" });
  const run = app.orchestrator.createRun({ projectId: project.id, objective: "Clean Cart", constraints: [], attachedKnowledgeIds: [] });
  app.store.setSetting(appModelKey(run.id), MODEL);
  return { app, run };
}

describe("Home concepts on the plan card", () => {
  it("isn't offered while the Home pieces wait for approval, and says so", () => {
    const { app, run } = lookupRun();
    const offer = conceptOffer(app.store, run.id, false);
    expect(offer.offered).toBe(false);
    expect(offer.why).toMatch(/waiting for your approval in the Component library \(lookup-home-/);
    expect(() => chooseConcept(app.store, app.bus, run, "concept-market", "user")).toThrow(/waiting for your approval/);
  });

  it("is offered with what the live preview runs on: the app's own records, look-up config and links", () => {
    const { app, run } = lookupRun();
    const offer = conceptOffer(app.store, run.id, false, APPROVED);
    expect(offer.offered).toBe(true);
    expect(offer.concepts.map((c) => c.design)).toEqual(["magazine", "storefront", "listings"]);
    expect(offer.concepts.every((c) => c.problems.length === 0 && c.tokens["--font-display"])).toBe(true);
    const data = offer.preview!.data;
    expect(data.product).toBe("Clean Cart");
    expect(data.records.product!.map((r) => r.name)).toContain("Oat Milk Original");
    expect(data.lookupConfig.entries).toBe("product");
    expect(data.links.map((l) => l.label)).toContain("Saved");
    expect(app.store.getSetting<ConceptTimings>(conceptTimingsKey(run.id), {}).prepareMs).toBeGreaterThanOrEqual(0);
  });

  it("a pick is recorded while the plan waits, settled at approval, and refused afterwards", () => {
    const { app, run } = lookupRun();
    expect(() => chooseConcept(app.store, app.bus, run, "concept-nope", "user", APPROVED)).toThrow(/isn't one of/);
    chooseConcept(app.store, app.bus, run, "concept-market", "user", APPROVED);
    const spec = settleConcept(app.store, app.bus, run);
    expect(spec?.id).toBe("concept-market");
    expect(app.store.getSetting<DesignSpec | null>(designSpecKey(run.id), null)?.id).toBe("concept-market");
    // The app is written with the concept's Home page.
    expect(app.store.getSetting<AppModel | null>(appModelKey(run.id), null)?.home?.design).toBe("storefront");
    expect(() => chooseConcept(app.store, app.bus, { ...run, planApproved: true }, "concept-bold", "user", APPROVED)).toThrow(/already approved/);
    const t = app.store.getSetting<ConceptTimings>(conceptTimingsKey(run.id), {});
    expect(t.chosenAt && t.approvedAt).toBeTruthy();
  });

  it("no pick keeps the default Home", () => {
    const { app, run } = lookupRun();
    chooseConcept(app.store, app.bus, run, null, "user", APPROVED);
    expect(settleConcept(app.store, app.bus, run)).toBeUndefined();
    expect(app.store.getSetting<AppModel | null>(appModelKey(run.id), null)?.home).toBeUndefined();
    expect(app.store.getSetting(designSpecKey(run.id), null)).toBeNull();
  });

  it.skipIf(!fs.existsSync(RECORDED))("writing the app applies the picked concept, times it, and tells the design steps what is left", async () => {
    const { app } = makeApp();
    // The recorded Clean Cart app's source (no install needed: nothing is run here).
    const files: Record<string, string> = {};
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(path.join(RECORDED, dir), { withFileTypes: true })) {
        const rel = path.posix.join(dir, e.name);
        if (e.isDirectory()) walk(rel);
        else files[rel] = fs.readFileSync(path.join(RECORDED, rel), "utf8");
      }
    };
    walk("src");
    const { project, jail } = makeProject(app, files);
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Clean Cart", constraints: [], attachedKnowledgeIds: [] });
    app.store.setSetting(appModelKey(run.id), MODEL);
    chooseConcept(app.store, app.bus, run, "concept-bold", "user", APPROVED);
    settleConcept(app.store, app.bus, run);
    const task = (id: string, title: string, ordinal: number) => ({ id, runId: run.id, title, objective: title, status: "pending", dependsOn: [], expectedPaths: [], actualPaths: [], acceptanceCriteria: [], validationPlan: { kinds: [] }, role: "coder", ordinal, attempts: 0 }) as unknown as Task;
    const write = task("t_write", "Write the complete app", 1);
    const design = task("t_design", "Design the main screens", 2);
    app.store.tasks.upsert(write);
    app.store.tasks.upsert(design);
    const deps = (app.orchestrator as unknown as { d: OrchestratorDeps }).d;
    const out = await appStep({ deps, run: { ...app.store.runs.require(run.id), planApproved: true }, task: write, jail, signal: new AbortController().signal, onChanged: () => undefined });
    expect(out.kind, JSON.stringify(out)).toBe("complete");
    expect(fs.readFileSync(path.join(jail.root, "src/screens/LandingScreen.tsx"), "utf8")).toContain("<LookupHomeListings");
    expect(fs.readFileSync(path.join(jail.root, "src/styles/tokens.css"), "utf8")).toContain('--font-display: "Oswald"');
    const t = app.store.getSetting<ConceptTimings>(conceptTimingsKey(run.id), {});
    expect(t.applyMs).toBeGreaterThanOrEqual(0);
    expect(t.appliedAt).toBeTruthy();
    expect(app.store.getSetting<string[]>(`taskFindings:${design.id}`, []).join(" ")).toMatch(/concept the person chose with the plan \(Bold aisle\), already applied/);
    expect(runPerformance(app, run.id).designPath.conceptApplyMs).toBe(t.applyMs);
  });

  it("approving the plan settles the pick (no separate approval), and the run's performance has the design path", async () => {
    const { app, run } = lookupRun();
    chooseConcept(app.store, app.bus, run, "concept-editorial", "user", APPROVED);
    app.store.runs.upsert({ ...app.store.runs.require(run.id), plan: { goal: "g", assumptions: [], relevantFiles: [], expectedChanges: [], risk: "high", riskNotes: [], validationPlan: ["final_report"], rollbackStrategy: "Restore snapshots", tasks: [{ key: "t1", title: "Write the complete app", objective: "Write it", dependsOn: [], expectedPaths: ["src/App.tsx"], acceptanceCriteria: [{ id: "a", description: "App exists", check: { type: "file_exists", path: "src/App.tsx" } }], verification: [], role: "coder" }] } as never });
    app.orchestrator.approvePlan(run.id, "user", false);
    expect(app.store.getSetting<AppModel | null>(appModelKey(run.id), null)?.home?.design).toBe("magazine");
    const perf = runPerformance(app, run.id);
    expect(perf.designPath.concept?.chosenAt).toBeTruthy();
    expect(perf.designPath).toMatchObject({ designStepsMs: 0, stepApprovalWaitMs: 0 });
  });
});
