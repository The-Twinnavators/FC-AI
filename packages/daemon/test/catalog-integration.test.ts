/**
 * Proof that the build's agents are connected to the catalog, along the real path:
 *   PRD → page planning (screens) → catalog match → screen briefs (the planner chooses parts from each screen's list)
 *   → composition manifest → design step's instructions and the coder's catalog section → the agent's tools (search,
 *   contract, add) → the manifest records the choice → verification tells "selected" from "used".
 * A stand-in model answers the planning calls; everything else is FlowCode's own code.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ROLE_TOOLS, type Task } from "@flowcode/contracts";
import { catalogContract, resolveCatalogId, searchCatalog } from "../src/orchestrator/catalogContract.js";
import { compositionKey, entryFor, recordEntry, verifyManifest, type CompositionManifest } from "../src/orchestrator/compositionManifest.js";
import { createDispatcher } from "../src/orchestrator/tools.js";
import { DESIGN_SCREENS } from "../src/orchestrator/templates.js";
import { makeApp, makeProject } from "./helpers.js";

const PRD = [
  "# Studio plans",
  "## Users",
  "Studio owners who want to pick a plan for their budget.",
  "## 4. Main screens",
  "| Screen | Responsibility |",
  "| --- | --- |",
  "| Plans | Compare plans and pick one for their budget |",
  "## 5. Plans",
  "- Owners compare plans side by side.",
  "- Owners see what each plan includes.",
].join("\n");

describe("the catalog reaches the build's agents", () => {
  it("PRD → screens → catalog match → briefs → manifest → design instructions and the coder's catalog", async () => {
    const { app } = makeApp();
    const { project, ws } = makeProject(app, { "src/styles/library.css": "/* library */\n" });
    let briefPartsSeen = "";
    app.router.register({
      config: { id: "ollama", kind: "ollama", label: "stub", enabled: true, hosted: false },
      chat: async (req) => {
        const system = String(req.messages[0]?.content ?? "");
        const user = String(req.messages.at(-1)?.content ?? "");
        if (system.startsWith("You decide which screens")) return { content: JSON.stringify({ product: "Studio plans", screens: [{ name: "Plans", purpose: "Owners compare plans and pick one for their budget" }] }), toolCalls: [], model: "stub", durationMs: 1 };
        if (system.startsWith("You plan the screens")) {
          // The planner chooses from the parts FlowCode matched to this screen (and invents one, which becomes a gap).
          briefPartsSeen = user;
          return {
            content: JSON.stringify({ screens: [{ screen: "Plans", who: "Studio owners", goal: "Pick a plan", workflow: ["Compare", "Choose"], firstView: "The plans side by side", primaryAction: "Choose a plan", sections: [{ title: "Compare plans", purpose: "Plans side by side", part: "p.plan-comparison" }, { title: "Savings dial", purpose: "Shows the saving", part: "c.savings-dial" }] }] }),
            toolCalls: [],
            model: "stub",
            durationMs: 1,
          };
        }
        const ids = [...user.matchAll(/(R\d+) \[/g)].map((m) => m[1]);
        return { content: JSON.stringify({ tasks: [{ title: "Plans", goal: "Compare plans.", files: ["src/screens/PlansScreen.tsx"], steps: ["Build it"], acceptance: ["It works"], covers: ids }], other: [] }), toolCalls: [], model: "stub", durationMs: 1 };
      },
      // The models it serves (the check before planning asks Ollama for its list).
      listModels: async () => Object.values(app.router.roleAssignments()).map((a) => ({ name: a.model })),
      describe: async () => undefined,
      health: async () => ({ ok: true, detail: "stub" }),
    });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Build the plans page in the PRD.", kind: "spec_build", references: [{ name: "prd.md", role: "prd", content: PRD }], constraints: [], attachedKnowledgeIds: [] });
    await app.orchestrator.plan(run.id);

    // Page planning: the PRD's own screen.
    expect(app.store.getSetting<{ screens: Array<{ label: string }> } | null>(`screenPlan:${run.id}`, null)?.screens.map((s) => s.label)).toEqual(["Plans"]);
    // Catalog search (deterministic match): the screen's parts.
    const match = app.store.getSetting<{ screens: Array<{ screen: string; picks: Array<{ ref: string }> }> } | null>(`catalogManifest:${run.id}`, null)!;
    expect(match.screens[0]!.picks.map((p) => p.ref)).toContain("p.plan-comparison");
    // The planner writing the brief saw that list (it can only choose matched, real parts).
    expect(briefPartsSeen).toContain("- p.plan-comparison:");
    // Composition manifest: the chosen part as an entry with its contract facts; the invented one as a gap.
    const comp = app.store.getSetting<CompositionManifest | null>(compositionKey(run.id), null)!;
    expect(comp.entries).toEqual([expect.objectContaining({ page: "Plans", section: "Compare plans", ref: "p.plan-comparison", version: "base", mode: "whole", by: "plan", pieceId: "table-plan-compare", appFile: "src/sections/TablePlanCompare.tsx" })]);
    expect(comp.gaps).toEqual([expect.objectContaining({ page: "Plans", section: "Savings dial" })]);
    // Design handoff: the design step's instructions carry the brief with the catalog ID, and the gap.
    const design = app.orchestrator.graph.tasks(run.id).find((t) => t.title === DESIGN_SCREENS)!;
    expect(design.objective).toContain("[p.plan-comparison]");
    expect(design.objective).toContain("Savings dial: GAP");
    // The coder's catalog section: the matched IDs for its screens, and how to look a part up.
    const catalog = app.orchestrator.catalogFor(app.store.runs.require(run.id), design, ws);
    expect(catalog).toContain("matched to this PRD");
    expect(catalog).toContain("p.plan-comparison");
    expect(catalog).toContain("get_catalog_contract");
    expect(catalog).toContain("search_catalog");
  });

  it("the agents' tools: search, read the contract, add the part with its page and section; invented IDs are refused; verification sees it used", async () => {
    const { app } = makeApp();
    const { project, ws, jail } = makeProject(app, { "src/styles/library.css": "/* library */\n" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Plans page", constraints: [], attachedKnowledgeIds: [] });
    const task = { id: "task_design", runId: run.id, title: DESIGN_SCREENS, objective: "Design the Plans screen", role: "coder", status: "running", attempts: 1, expectedPaths: ["src/screens/"], actualPaths: [], acceptanceCriteria: [], dependsOn: [], ordinal: 1, verification: [] } as unknown as Task;
    let manifest: CompositionManifest = { entries: [], gaps: [] };
    const dispatch = createDispatcher({
      project,
      run,
      task,
      jail,
      ops: app.ops,
      runner: app.runner,
      approvals: app.approvals,
      preflight: () => undefined,
      refreshPreflight: () => app.projects.preflight(project.id),
      signal: new AbortController().signal,
      onPathsChanged: () => undefined,
      onAwaitingApproval: () => undefined,
      phase: "implementation",
      onCatalogUse: (use) => {
        const e = entryFor(use.ref, use.page ?? "?", use.section ?? "?", "coder", { mode: use.mode, why: use.why });
        if (e) manifest = recordEntry(manifest, e);
      },
    });
    const search = await dispatch("search_catalog", { query: "compare plans before choosing one" }, undefined, "t1");
    expect(search.ok).toBe(true);
    expect(search.content).toContain("p.plan-comparison");
    const contract = await dispatch("get_catalog_contract", { id: "p.plan-comparison" }, undefined, "t2");
    expect(contract.content).toContain("Use it as: <PlanComparison");
    expect(contract.content).toContain("Built from: c.badge.status");
    expect(contract.content).toContain('import { PlanComparison } from "../sections/TablePlanCompare";');
    // Strict IDs: an invented variant is an error that names the real ones, never its base component.
    const bad = await dispatch("add_library_piece", { piece: "c.button.huge" }, undefined, "t3");
    expect(bad.ok).toBe(false);
    expect(bad.content).toContain("c.button.secondary");
    expect(manifest.entries).toEqual([]);
    const added = await dispatch("add_library_piece", { piece: "p.plan-comparison", page: "Plans", section: "Compare plans", why: "Owners compare plans side by side" }, undefined, "t4");
    expect(added.ok).toBe(true);
    expect(fs.existsSync(path.join(ws, "src/sections/TablePlanCompare.tsx"))).toBe(true);
    expect(manifest.entries).toEqual([expect.objectContaining({ ref: "p.plan-comparison", page: "Plans", section: "Compare plans", by: "coder", why: "Owners compare plans side by side" })]);
    // Selected is not used: verification says so until a screen imports it.
    expect(verifyManifest(ws, manifest).entries[0]!.verification).toEqual(expect.objectContaining({ inApp: true, usedBy: [] }));
    fs.mkdirSync(path.join(ws, "src/screens"), { recursive: true });
    fs.writeFileSync(path.join(ws, "src/screens/PlansScreen.tsx"), 'import { PlanComparison } from "../sections/TablePlanCompare";\nexport default function PlansScreen() { return null; }\n');
    expect(verifyManifest(ws, manifest).entries[0]!.verification?.usedBy).toEqual(["src/screens/PlansScreen.tsx"]);
  });

  it("contracts resolve exactly: pieces, variants, versions and secondary components", () => {
    expect(resolveCatalogId("c.button.huge")).toBeUndefined();
    expect(resolveCatalogId("c.button.secondary")).toEqual(expect.objectContaining({ kind: "variant" }));
    expect(resolveCatalogId("c.tabs@folder")).toEqual(expect.objectContaining({ kind: "version" }));
    expect(resolveCatalogId("c.combobox")).toEqual(expect.objectContaining({ kind: "also", piece: expect.objectContaining({ id: "dropdowns-states" }) }));
    const tabs = catalogContract("c.tabs")!;
    expect(tabs.versions.map((v) => v.id)).toEqual(expect.arrayContaining(["c.tabs@folder", "c.tabs@pill"]));
    expect(tabs.variants.map((v) => v.id)).toContain("c.tabs.pills");
    expect(searchCatalog("a list people filter by category", { level: "pattern" }).every((h) => h.level === "pattern")).toBe(true);
  });

  it("every role that plans, designs, builds or reviews can look parts up; only builders can add them", () => {
    for (const role of ["planner", "designer", "reviewer", "critic", "coder", "debugger"]) {
      expect(ROLE_TOOLS[role], role).toEqual(expect.arrayContaining(["search_catalog", "get_catalog_contract"]));
    }
    expect(ROLE_TOOLS.planner).not.toContain("add_library_piece");
    expect(ROLE_TOOLS.coder).toContain("add_library_piece");
  });
});
