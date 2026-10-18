/**
 * The project's design state (workspace/designState.ts) and its place in the build: draft, selected and applied kept
 * apart; a failed update keeps what was applied; the base is read from evidence; the build's style step applies a
 * selected direction and otherwise writes no industry default; a concept with a selected look brings only its layout.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BASE_APPEARANCE, appearanceFromTheme, appearanceTokens, type Appearance, type Task } from "@flowcode/contracts";
import { allowSurface, applySelected, describeState, discardDraft, getDesignState, saveDraft, selectDraft } from "../src/workspace/designState.js";
import { captureStyleStep } from "../src/orchestrator/templates.js";
import { appStep } from "../src/orchestrator/appFiles.js";
import { appModelKey, type AppModel } from "../src/orchestrator/appModel.js";
import { designSpecKey } from "../src/orchestrator/homeConceptOffer.js";
import { HOME_CONCEPTS } from "../src/workspace/homeConcepts.js";
import type { OrchestratorDeps } from "../src/orchestrator/orchestrator.js";
import { makeApp, makeProject } from "./helpers.js";

const RECORDED = path.resolve(import.meta.dirname, "../../../.flowcode-data/workspaces/clean-cart-slice-eval-1-9b1947");
const MODEL = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "fixtures/apps/eval1-app-model.json"), "utf8")) as AppModel;
const source = () => {
  const files: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(RECORDED, dir), { withFileTypes: true })) {
      const rel = path.posix.join(dir, e.name);
      if (e.isDirectory()) walk(rel);
      else files[rel] = fs.readFileSync(path.join(RECORDED, rel), "utf8");
    }
  };
  walk("src");
  return files;
};
const withApp = () => {
  const { app } = makeApp();
  const { project, jail } = makeProject(app, source());
  return { app, project, jail, restore: (id: string) => void app.snapshots.restore(id, jail) };
};
const tokensOf = (root: string) => fs.readFileSync(path.join(root, "src/styles/tokens.css"), "utf8");
const MARKET: Appearance = { ...BASE_APPEARANCE, primary: "#1f6f43", neutral: "warm", fonts: { display: "Fraunces", body: "Work Sans" } };

describe.skipIf(!fs.existsSync(RECORDED))("a project's design state", () => {
  it("keeps draft, selected and applied apart: a draft writes nothing, selecting doesn't claim the app changed, applying does after it succeeds", () => {
    const { app, project, jail, restore } = withApp();
    const before = tokensOf(jail.root);
    saveDraft(app.store, project.id, MARKET, { primary: "you" }, jail);
    expect(tokensOf(jail.root)).toBe(before);
    expect(describeState(app.store, project.id, jail).label).toBe("Base styling — no brand direction selected");
    selectDraft(app.store, project.id, jail);
    const selected = describeState(app.store, project.id, jail);
    expect(selected.label).toBe("Selected, not yet applied");
    expect(selected.applied).toBeUndefined();
    expect(selected.draft).toBeUndefined();
    expect(tokensOf(jail.root)).toBe(before);
    const res = applySelected(app.store, project.id, jail, app.ops, { projectId: project.id, runId: "design" }, restore);
    expect(res.ok).toBe(true);
    expect(tokensOf(jail.root)).toContain(`--font-display: ${appearanceTokens(MARKET)["--font-display"]};`);
    const applied = describeState(app.store, project.id, jail);
    expect(applied.label).toBe("Applied");
    expect(applied.applied?.version).toBe(1);
    expect(applied.differs).toEqual([]);
    // Undo through the snapshots puts the previous styles back.
    for (const id of [...res.state.applied!.snapshotIds].reverse()) restore(id);
    expect(tokensOf(jail.root)).toBe(before);
  });

  it("a failed update keeps the previous applied direction and the draft, and records the failure", () => {
    const { app, project, jail, restore } = withApp();
    saveDraft(app.store, project.id, MARKET, {}, jail);
    selectDraft(app.store, project.id, jail);
    applySelected(app.store, project.id, jail, app.ops, { projectId: project.id, runId: "design" }, restore);
    const good = tokensOf(jail.root);
    // A second direction, then the app's tokens broken so the update can't be written.
    saveDraft(app.store, project.id, { ...MARKET, primary: "#7a3b1e" }, {}, jail);
    selectDraft(app.store, project.id, jail);
    saveDraft(app.store, project.id, { ...MARKET, primary: "#123456" }, {}, jail);
    fs.writeFileSync(path.join(jail.root, "src/styles/tokens.css"), "/* no root block */\n");
    const res = applySelected(app.store, project.id, jail, app.ops, { projectId: project.id, runId: "design" }, restore);
    expect(res.ok).toBe(false);
    const s = describeState(app.store, project.id, jail);
    expect(s.applied?.version).toBe(1);
    expect(s.lastFailure?.version).toBe(2);
    expect(s.draft?.appearance.primary).toBe("#123456");
    expect(s.label).not.toBe("Applied");
    fs.writeFileSync(path.join(jail.root, "src/styles/tokens.css"), good);
  });

  it("says when the app's styles differ from the applied direction", () => {
    const { app, project, jail, restore } = withApp();
    saveDraft(app.store, project.id, MARKET, {}, jail);
    selectDraft(app.store, project.id, jail);
    applySelected(app.store, project.id, jail, app.ops, { projectId: project.id, runId: "design" }, restore);
    const css = tokensOf(jail.root).replace(/(--font-display:)[^;]+;/, '$1 "Oswald", sans-serif;');
    fs.writeFileSync(path.join(jail.root, "src/styles/tokens.css"), css);
    const s = describeState(app.store, project.id, jail);
    expect(s.differs).toContain("--font-display");
    expect(s.label).toBe("The app's styles differ from the applied direction");
  });

  it("refuses surfaces other than Flat and Tactile unless the person asks for one in this project; a theme starts Flat", () => {
    const { app, project, jail } = withApp();
    expect(() => saveDraft(app.store, project.id, { ...MARKET, surface: "neobrutalism" }, {}, jail)).toThrow(/used only when you ask for it/);
    expect(appearanceFromTheme("bold-editorial")?.surface).toBe("flat");
    allowSurface(app.store, project.id, "neobrutalism", jail);
    expect(() => saveDraft(app.store, project.id, { ...MARKET, surface: "neobrutalism" }, {}, jail)).not.toThrow();
    discardDraft(app.store, project.id, jail);
    expect(getDesignState(app.store, project.id, jail).draft).toBeUndefined();
  });

  it("reads a legacy automatic default from its evidence, without rewriting it or crediting the person", () => {
    const { app, project, jail } = withApp();
    app.store.setSetting(`styleCapture:${project.id}`, { sources: ["the food / grocery / restaurant design direction"], applied: ["colors #15803d"] });
    app.store.setSetting(`designChoice:${project.id}`, { id: "custom", by: "flowcode" });
    const s = describeState(app.store, project.id, jail);
    expect(s.base).toEqual({ source: "legacy-default", detail: "Legacy FlowCode default (food / grocery / restaurant design direction)" });
    expect(s.label).toBe("Legacy FlowCode default (food / grocery / restaurant design direction)");
    expect(app.store.getSetting(`designState:${project.id}`, null)).toBeNull();
  });

  it("the build's style step: no direction → no industry default written; a selected direction → applied", async () => {
    for (const selected of [false, true]) {
      const { app, project, jail } = withApp();
      const run = app.orchestrator.createRun({ projectId: project.id, objective: "Clean Cart: a grocery finder", constraints: [], attachedKnowledgeIds: [] });
      app.store.setSetting(`runRefs:${run.id}`, [{ name: "prd.md", role: "prd", content: "# Clean Cart\nA grocery product finder." }]);
      if (selected) (saveDraft(app.store, project.id, MARKET, {}, jail), selectDraft(app.store, project.id, jail));
      const before = tokensOf(jail.root);
      const deps = (app.orchestrator as unknown as { d: OrchestratorDeps }).d;
      const task = { id: "t_style", runId: run.id, title: "Capture the style", objective: "", status: "pending", dependsOn: [], expectedPaths: [], actualPaths: [], acceptanceCriteria: [], validationPlan: { kinds: [] }, role: "coder", ordinal: 1, attempts: 0 } as unknown as Task;
      const out = await captureStyleStep({ deps, run, task, jail, signal: new AbortController().signal, onChanged: () => undefined });
      expect(out.kind).toBe("complete");
      if (!selected) {
        // Unchanged: no industry default written (this fixture app already carries its own legacy default).
        expect(tokensOf(jail.root)).toBe(before);
      } else {
        expect(tokensOf(jail.root)).toContain(appearanceTokens(MARKET)["--color-accent"]);
        expect(getDesignState(app.store, project.id, jail).applied?.version).toBe(1);
      }
    }
  });

  it("a concept with a selected look brings only its Home layout; the person's branding stays", async () => {
    const { app, project, jail, restore } = withApp();
    saveDraft(app.store, project.id, MARKET, {}, jail);
    selectDraft(app.store, project.id, jail);
    applySelected(app.store, project.id, jail, app.ops, { projectId: project.id, runId: "design" }, restore);
    const branded = tokensOf(jail.root);
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Clean Cart", constraints: [], attachedKnowledgeIds: [] });
    const bold = HOME_CONCEPTS.find((c) => c.id === "concept-bold")!;
    app.store.setSetting(appModelKey(run.id), { ...MODEL, home: bold.composition.home });
    app.store.setSetting(designSpecKey(run.id), bold);
    const task = { id: "t_write", runId: run.id, title: "Write the complete app", objective: "", status: "pending", dependsOn: [], expectedPaths: [], actualPaths: [], acceptanceCriteria: [], validationPlan: { kinds: [] }, role: "coder", ordinal: 1, attempts: 0 } as unknown as Task;
    app.store.tasks.upsert(task);
    const deps = (app.orchestrator as unknown as { d: OrchestratorDeps }).d;
    const out = await appStep({ deps, run: { ...app.store.runs.require(run.id), planApproved: true }, task, jail, signal: new AbortController().signal, onChanged: () => undefined });
    expect(out.kind, JSON.stringify(out)).toBe("complete");
    expect(fs.readFileSync(path.join(jail.root, "src/screens/LandingScreen.tsx"), "utf8")).toContain("<LookupHomeListings");
    // Colours, fonts and surface: the person's, unchanged by the concept.
    expect(tokensOf(jail.root)).toBe(branded);
  });
});
