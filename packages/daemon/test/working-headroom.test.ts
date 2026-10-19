/**
 * Working headroom for a local model's request (requestBudget.headroomTokens): a later turn must leave a tenth of the
 * window free, and optional material (extra knowledge, other steps' blockers, other files, long plan lists) is fitted
 * only up to the opening that allows it, while what the step needs is still fitted to the full room. A design step's
 * direction comes from the person's applied Look and notes and the PRD (designContext.ts), as requirements that are
 * never cut; the person's notes travel with the Look from draft to applied.
 */
import { describe, expect, it } from "vitest";
import type { ReferenceFile, Run, Task } from "@flowcode/contracts";
import { BASE_APPEARANCE } from "@flowcode/contracts";
import { buildHandoff, fitHandoff } from "../src/orchestrator/handoff.js";
import { headroomTokens, laterTurnFits, openingWithin, requestBudget } from "../src/orchestrator/requestBudget.js";
import { designDirectionContext, lookRequirement } from "../src/orchestrator/designContext.js";
import { getDesignState, restoreVersion, saveDraft, selectDraft, type DesignState } from "../src/workspace/designState.js";
import { makeApp } from "./helpers.js";

const budget = requestBudget({ windowTokens: 24_576, replyTokens: 4096, charsPerToken: 3.8, hosted: false });

describe("working headroom", () => {
  it("is a tenth of the window, and the opening it allows leaves exactly that free on a later turn", () => {
    const h = headroomTokens(24_576);
    expect(h).toBe(2457);
    const open = openingWithin(budget, 4000, h);
    expect(laterTurnFits(budget, open, 4000, 2000, h).fits).toBe(true);
    expect(laterTurnFits(budget, open + 40, 4000, 2000, h).fits).toBe(false);
    // Without the headroom the same opening has room to spare: the headroom is what's kept free.
    expect(24_576 - laterTurnFits(budget, open, 4000).tokens).toBeGreaterThanOrEqual(h);
  });

  it("fits optional material to the smaller size and keeps everything the step needs", () => {
    const task = { id: "t", runId: "r", title: "Design the Gallery screen", objective: "Design the Gallery screen in src/screens/GalleryScreen.tsx.", expectedPaths: ["src/screens/GalleryScreen.tsx"], actualPaths: [], acceptanceCriteria: [], dependsOn: [], status: "running", role: "coder", ordinal: 1, attempts: 1, validationPlan: { kinds: [] } } as unknown as Task;
    const other = { ...task, id: "o", title: "R2 — Search", blocker: { reason: "Prerequisite is blocked", category: "prerequisite", evidenceRefs: [] } } as unknown as Task;
    const run = { id: "r", objective: "o", constraints: [], plan: { goal: "Frameproof", assumptions: [`Scope:\n- Required behaviour: ${Array.from({ length: 40 }, (_, i) => `R${i + 4}`).join(", ")} (each built and tested).`] } } as unknown as Run;
    const packet = buildHandoff({
      run,
      task,
      allTasks: [task, other],
      files: [{ path: "src/screens/GalleryScreen.tsx", content: "export function GalleryScreen() {\n  return null;\n}\n" }],
      requirements: ["R110 [Gallery composition]: Photo grid."],
      knowledge: Array.from({ length: 4 }, (_, i) => ({ id: `k${i}`, title: `Playbook part ${i}`, content: "x".repeat(1400), provenance: [], tags: [], excluded: false }) as never),
    });
    const all = fitHandoff(packet, "src/\n", [], 50_000);
    const lean = fitHandoff(packet, "src/\n", [], 50_000, 1500);
    expect(lean.overflow).toBe(0);
    expect(lean.text.length).toBeLessThanOrEqual(1500);
    expect(lean.dropped.filter((d) => d.startsWith("knowledge"))).toHaveLength(4);
    // Knowledge goes first; other steps' blockers only when that isn't enough.
    expect(lean.text).toContain("Open blockers elsewhere");
    expect(lean.text).toContain("R110 [Gallery composition]: Photo grid.");
    expect(lean.text).toContain("export function GalleryScreen()");
    expect(lean.text).toContain("Design the Gallery screen in src/screens/GalleryScreen.tsx.");
    // Without the smaller size nothing optional goes.
    expect(all.dropped).toEqual([]);
    // The plan's long list of requirement numbers is counted when space is still short.
    const tighter = fitHandoff(packet, "src/\n", [], 50_000, 900);
    expect(tighter.text).toContain("40 PRD requirements (R4–R43)");
    expect(tighter.dropped).toContain("other steps' blockers");
    expect(tighter.text).not.toContain("Open blockers elsewhere");
    expect(tighter.text).toContain("R110 [Gallery composition]: Photo grid.");
  });
});

describe("a design step's direction", () => {
  const applied = (notes?: string[]): DesignState => ({
    base: { source: "starter", detail: "" },
    surfaceExceptions: [],
    applied: { appearance: { ...BASE_APPEARANCE, primary: "#3b5bdb", fonts: { display: "Playfair Display", body: "Source Sans 3" }, shape: { radius: 4, density: "comfortable", borders: "hairline" } as never }, version: 3, appliedAt: "", snapshotIds: [], ...(notes ? { notes } : {}) },
  });
  const prd: ReferenceFile = { role: "prd", name: "PRD.md", content: "# PRD\n\n## Visual direction\n\n### Concept: Editorial contact sheet\n- Warm off-white background.\n- Muted cobalt accent.\n\n## Data\n- photos\n" } as unknown as ReferenceFile;

  it("is the person's applied Look, their notes and the PRD's direction, replacing FlowCode's guess", () => {
    const c = designDirectionContext(applied(["Compact product header", "Avoid dashboard KPI cards"]), [prd], 1200);
    expect(c.fromPersonOrPrd).toBe(true);
    expect(c.requirements[0]).toBe("The Look the person applied (version 3): light mode, Flat surfaces; headings in Playfair Display, text in Source Sans 3; primary #3b5bdb, pure neutrals; corners up to 4px, comfortable density, hairline borders. These are the app's tokens in src/styles/tokens.css: style with them (var(--…)), never other colours or fonts.");
    expect(c.requirements[1]).toBe("The person's own notes for the design build (their words; follow them):\n- Compact product header\n- Avoid dashboard KPI cards");
    expect(c.requirements[2]).toContain("Concept: Editorial contact sheet");
    expect(c.requirements[2]).not.toContain("photos");
    // Nothing applied and no PRD direction: FlowCode's own direction stays in use.
    expect(designDirectionContext({ base: { source: "none", detail: "" }, surfaceExceptions: [] }, [], 1200)).toEqual({ requirements: [], fromPersonOrPrd: false });
    expect(lookRequirement({ base: { source: "none", detail: "" }, surfaceExceptions: [] })).toEqual([]);
  });

  it("keeps the person's notes with the Look from draft to chosen version, and back from a restored version", () => {
    const { app } = makeApp();
    saveDraft(app.store, "p1", BASE_APPEARANCE, {}, undefined, ["Photo grid first"]);
    // A later edit without notes keeps them.
    saveDraft(app.store, "p1", { ...BASE_APPEARANCE, primary: "#3b5bdb" }, {});
    expect(getDesignState(app.store, "p1").draft?.notes).toEqual(["Photo grid first"]);
    const chosen = selectDraft(app.store, "p1");
    expect(chosen.selected?.notes).toEqual(["Photo grid first"]);
    expect(chosen.versions?.at(-1)?.notes).toEqual(["Photo grid first"]);
    saveDraft(app.store, "p1", BASE_APPEARANCE, {}, undefined, []);
    selectDraft(app.store, "p1");
    expect(restoreVersion(app.store, "p1", chosen.selected!.version).draft?.notes).toEqual(["Photo grid first"]);
  });
});
