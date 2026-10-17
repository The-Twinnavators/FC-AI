/**
 * A complete app is built only from an app model complete enough for it (records for every kind, a look-up app's
 * entries linked to places, a page for every screen the PRD names); otherwise planning stops and says so, offering
 * the reduced deliverable (a Quick sketch) as the person's choice. It never quietly becomes demo screens.
 */
import { describe, expect, it } from "vitest";
import type { ChatRequest } from "@flowcode/contracts";
import { completenessProblems, coversScreen, parseAppModel, prdNamedRecords, prdSampleSection } from "../src/orchestrator/appModel.js";
import { makeApp, makeProject } from "./helpers.js";

const structure = {
  shape: "lookup",
  product: "Clean Cart",
  roles: ["Shopper"],
  entities: [
    { key: "product", label: "Product", plural: "Products", idPrefix: "PRD", titleField: "name", fields: [{ key: "name", label: "Name", type: "text" }, { key: "category", label: "Category", type: "select", options: ["Produce", "Dairy"] }] },
    { key: "store", label: "Store", plural: "Stores", idPrefix: "STR", titleField: "name", fields: [{ key: "name", label: "Name", type: "text" }, { key: "zip", label: "ZIP", type: "text" }] },
  ],
  nav: [{ label: "Clean Cart", items: [{ id: "home", label: "Home", kind: "landing" }] }],
  lookup: { entries: "product", places: "store", categoryField: "category", placesField: "carriedBy", areas: [{ zip: "94110", label: "Mission", lat: 37.75, lng: -122.41 }], placeWord: "store", carryWord: "carries", detailFields: ["category"], facets: ["category"] },
};
const withSeed = (products: number, carried: boolean) =>
  parseAppModel({ ...structure, seed: { store: Array.from({ length: 6 }, (_, i) => ({ name: `Store ${i}`, zip: "94110" })), product: Array.from({ length: products }, (_, i) => ({ name: `Apples ${i}`, category: "Produce", carriedBy: carried ? ["STR-1001"] : [] })) } }).model!;

describe("app model completeness", () => {
  it("passes a model with records, linked entries and a page for each named screen", () => {
    const m = withSeed(20, true);
    expect(completenessProblems(m, [{ name: "Home (landing page)" }, { name: "Search" }, { name: "Product" }, { name: "Saved" }, { name: "Choose a store" }, { name: "Grocery lists" }])).toEqual([]);
  });

  it("names a kind with no records, entries no place carries, and a PRD screen with no page", () => {
    expect(completenessProblems(withSeed(0, true), [])).toContain("No sample products: every page of them would be empty");
    expect(completenessProblems(withSeed(20, false), [])).toContain("None of the products say which stores carry them");
    expect(completenessProblems(withSeed(20, true), [{ name: "Recipes" }])).toEqual(['The PRD\'s "Recipes" screen has no page in the app model']);
  });

  it("matches a named screen to a page by its words or its kind of look-up page", () => {
    const views = withSeed(20, true).nav.flatMap((g) => g.items);
    expect(coversScreen(views, "Choose a store")).toBe(true);
    expect(coversScreen(views, "Saved")).toBe(true);
    expect(coversScreen(views, "Recipes")).toBe(false);
  });
});

describe("the PRD's own sample data", () => {
  const PRD = "# Shop\n\n## 8. Sample data\n\n| Product | Brand | Category |\n|---|---|---|\n| Oat Milk Original | Willow Farms | Beverages |\n| Sourdough Loaf | Hearth & Grain | Bakery |\n\nStores: three in 94110.\n\n## 9. Look\nGreen.";

  it("finds the sample-data section and the records its tables name", () => {
    const section = prdSampleSection(PRD);
    expect(section).toMatch(/^## 8\. Sample data/);
    expect(section).not.toContain("## 9. Look");
    expect(prdNamedRecords(section)).toEqual(["Oat Milk Original", "Sourdough Loaf"]);
    expect(prdNamedRecords("Prose only, e.g. \"Sunrise Oats\".")).toEqual([]);
  });

  it("requires every record the PRD names to be in the app's records", () => {
    const m = withSeed(20, true);
    expect(completenessProblems(m, [], ["Oat Milk Original"])).toEqual(['The PRD\'s sample record "Oat Milk Original" isn\'t in the app\'s records']);
    m.seed.product![0]!.name = "Oat Milk Original";
    expect(completenessProblems(m, [], ["oat milk original"])).toEqual([]);
  });
});

describe("an unusable app model stops planning", () => {
  it("blocks with the reasons and the reduced option, instead of designing demo screens", async () => {
    const { app } = makeApp();
    const { project } = makeProject(app);
    const asked: string[] = [];
    app.router.register({
      config: { id: "ollama", kind: "ollama", label: "stub", enabled: true, hosted: false },
      chat: async (req: ChatRequest) => {
        const system = String(req.messages[0]?.content ?? "");
        asked.push(system.slice(0, 40));
        // The structure comes back, but every sample-records part comes back empty.
        if (system.startsWith("You design the data and navigation")) return { content: JSON.stringify(structure), toolCalls: [], model: "stub", durationMs: 1, doneReason: "stop" };
        if (system.startsWith("You write realistic sample records")) return { content: JSON.stringify({ records: [] }), toolCalls: [], model: "stub", durationMs: 1, doneReason: "stop" };
        if (system.startsWith("You decide which screens")) throw new Error("must not fall back to designing screens");
        return { content: JSON.stringify({ tasks: [], other: [] }), toolCalls: [], model: "stub", durationMs: 1 };
      },
      listModels: async () => Object.values(app.router.roleAssignments()).map((a) => ({ name: a.model })),
      describe: async () => undefined,
      health: async () => ({ ok: true, detail: "stub" }),
    });
    const prd = "# Clean Cart\n\n## Main screens\n\n| Screen | Purpose |\n|---|---|\n| Home | Find food |\n| Product | One product |\n\n## Requirements\n\n- R1: People search products by name.\n";
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Build Clean Cart from the PRD.", kind: "spec_build", references: [{ name: "prd.md", role: "prd", content: prd }], constraints: [], attachedKnowledgeIds: [] });
    await app.orchestrator.plan(run.id);
    const r = app.store.runs.require(run.id);
    expect(r.status).toBe("blocked");
    expect(r.plan).toBeUndefined();
    const why = app.store.db.all<{ data: string }>("SELECT data FROM events WHERE run_id = ? AND type = 'run.status_changed'", run.id).map((x) => (JSON.parse(x.data) as { message: string }).message).find((m) => m.startsWith("Planning blocked"));
    expect(why).toMatch(/The app model for the complete app isn't usable: No sample products/);
    expect(why).toMatch(/Quick sketch \(New build\), which is a different, reduced deliverable/);
    // Written in parts (a local planner), never whole twice, and no fallback to designing screens.
    expect(asked.filter((a) => a.startsWith("You write realistic sample records")).length).toBeGreaterThan(0);
    expect(asked.some((a) => a.startsWith("You decide which screens"))).toBe(false);
  }, 60_000);
});
