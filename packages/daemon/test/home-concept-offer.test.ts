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
import { chooseConcept, conceptOffer, conceptTimingsKey, designDirectionKey, designSpecKey, settleConcept, type ConceptTimings, type DesignDirection } from "../src/orchestrator/homeConceptOffer.js";
import { runPerformance } from "../src/api/performance.js";
import type { DesignSpec } from "../src/workspace/designSpec.js";
import { makeApp, makeProject } from "./helpers.js";
import { appStep } from "../src/orchestrator/appFiles.js";
import type { OrchestratorDeps } from "../src/orchestrator/orchestrator.js";
import type { Task } from "@flowcode/contracts";

const RECORDED = path.resolve(import.meta.dirname, "../../../.flowcode-data/workspaces/clean-cart-slice-eval-1-9b1947");
const MODEL = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "fixtures/apps/eval1-app-model.json"), "utf8")) as AppModel;
/** The catalog without the listings Home page approved, and with it: the tests say which pages are approved. */
const NONE = new Set(LIBRARY_SECTIONS.map((s) => s.id).filter((id) => !id.startsWith("lookup-home-")));
const APPROVED = new Set([...NONE, "lookup-home-listings"]);

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
    const offer = conceptOffer(app.store, run.id, false, NONE);
    expect(offer.offered).toBe(false);
    expect(offer.why).toMatch(/waiting for your approval in the Component library \(lookup-home-/);
    expect(() => chooseConcept(app.store, app.bus, run, "concept-bold", "user", NONE)).toThrow(/waiting for your approval/);
  });

  it("is offered with what the live preview runs on: the app's own records, look-up config and links", () => {
    const { app, run } = lookupRun();
    const offer = conceptOffer(app.store, run.id, false, APPROVED);
    expect(offer.offered).toBe(true);
    expect(offer.concepts.map((c) => c.design)).toEqual(["listings"]);
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
    chooseConcept(app.store, app.bus, run, "concept-bold", "user", APPROVED);
    const spec = settleConcept(app.store, app.bus, run, APPROVED);
    expect(spec?.id).toBe("concept-bold");
    // Selected with the plan; the final visual approval is still the person's, on the generated app.
    expect(app.store.getSetting<DesignDirection | null>(designDirectionKey(run.id), null)).toMatchObject({ kind: "concept", conceptId: "concept-bold", visualApproval: "pending" });
    expect(app.store.getSetting<DesignSpec | null>(designSpecKey(run.id), null)?.id).toBe("concept-bold");
    // The app is written with the concept's Home page.
    expect(app.store.getSetting<AppModel | null>(appModelKey(run.id), null)?.home?.design).toBe("listings");
    expect(() => chooseConcept(app.store, app.bus, { ...run, planApproved: true }, "concept-bold", "user", APPROVED)).toThrow(/already approved/);
    const t = app.store.getSetting<ConceptTimings>(conceptTimingsKey(run.id), {});
    expect(t.chosenAt && t.approvedAt).toBeTruthy();
  });

  it("the generic default is an explicit, labelled choice; approving without a choice leaves the design requirement open", () => {
    const direction = (app: ReturnType<typeof lookupRun>["app"], id: string) => app.store.getSetting<DesignDirection | null>(designDirectionKey(id), null);
    const a = lookupRun();
    chooseConcept(a.app.store, a.app.bus, a.run, "default", "user", APPROVED);
    expect(settleConcept(a.app.store, a.app.bus, a.run, APPROVED)).toBeUndefined();
    expect(a.app.store.getSetting<AppModel | null>(appModelKey(a.run.id), null)?.home).toBeUndefined();
    expect(direction(a.app, a.run.id)).toMatchObject({ kind: "default", outstanding: false, visualApproval: "pending" });
    // No choice at all while concepts were offered: not read as accepting the default.
    const b = lookupRun();
    settleConcept(b.app.store, b.app.bus, b.run, APPROVED);
    expect(direction(b.app, b.run.id)).toMatchObject({ kind: "none", outstanding: true, visualApproval: "pending" });
    expect(b.app.bus.list({ runId: b.run.id }).some((e) => /No custom Home direction was selected/.test(e.message))).toBe(true);
    // Concepts weren't offered (their pieces wait for approval): recorded with why, still open.
    const c = lookupRun();
    settleConcept(c.app.store, c.app.bus, c.run, NONE);
    expect(direction(c.app, c.run.id)).toMatchObject({ kind: "not_offered", outstanding: true });
    expect(direction(c.app, c.run.id)?.why).toMatch(/waiting for your approval/);
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
    const note = app.store.getSetting<string[]>(`taskFindings:${design.id}`, []).join(" ");
    expect(note).toContain("Selected concept applied (Bold aisle). Preserve its approved direction, complete remaining scoped work, and verify cross-screen consistency.");
    expect(note).not.toMatch(/finished|already done|nothing else/i);
    expect(runPerformance(app, run.id).designPath.conceptApplyMs).toBe(t.applyMs);
  });

  it("approving the plan settles the pick (no separate approval), and the run's performance has the design path", async () => {
    const { app, run } = lookupRun();
    chooseConcept(app.store, app.bus, run, "concept-bold", "user", APPROVED);
    app.store.runs.upsert({ ...app.store.runs.require(run.id), plan: { goal: "g", assumptions: [], relevantFiles: [], expectedChanges: [], risk: "high", riskNotes: [], validationPlan: ["final_report"], rollbackStrategy: "Restore snapshots", tasks: [{ key: "t1", title: "Write the complete app", objective: "Write it", dependsOn: [], expectedPaths: ["src/App.tsx"], acceptanceCriteria: [{ id: "a", description: "App exists", check: { type: "file_exists", path: "src/App.tsx" } }], verification: [], role: "coder" }] } as never });
    app.orchestrator.approvePlan(run.id, "user", false);
    expect(app.store.getSetting<AppModel | null>(appModelKey(run.id), null)?.home?.design).toBe("listings");
    const perf = runPerformance(app, run.id);
    expect(perf.designPath.concept?.chosenAt).toBeTruthy();
    expect(perf.designPath).toMatchObject({ designStepsMs: 0, stepApprovalWaitMs: 0 });
  });
});
