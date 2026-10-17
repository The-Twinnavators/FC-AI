/**
 * Sample records merge by their identity from the domain model, the PRD's own records are asked for only while missing
 * and keep their names and first ids, every left-out record is said with why, and a re-ask for missing ones is bounded
 * and recorded (Clean Cart slice eval 1: the PRD's six products were asked for in every batch and shown twice).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ChatRequest } from "@flowcode/contracts";
import type { ModelEntity } from "../src/orchestrator/appModel.js";
import { prdNamedRecords, prdSampleSection } from "../src/orchestrator/appModel.js";
import { batchNote, compositeFields, fixturesFirst, identifierField, mergeRecords, missingFixtures, prdFixtureRows } from "../src/orchestrator/recordIdentity.js";
import { makeApp, makeProject } from "./helpers.js";

const PRD = fs.readFileSync(path.join(import.meta.dirname, "../../../docs/handoff/slice/clean-cart-slice-prd.md"), "utf8");
const FIXTURES = prdNamedRecords(prdSampleSection(PRD));
const product: ModelEntity = {
  key: "product",
  label: "Product",
  plural: "Products",
  titleField: "name",
  subtitleField: "brand",
  idPrefix: "PRD",
  fields: [
    { key: "name", label: "Name", type: "text", required: true },
    { key: "brand", label: "Brand", type: "text", required: true },
    { key: "category", label: "Category", type: "select", required: true, options: ["Beverages", "Dairy", "Bakery"] },
    { key: "ingredients", label: "Ingredients", type: "text", required: true },
  ],
};
const withSku: ModelEntity = { ...product, fields: [...product.fields, { key: "sku", label: "SKU", type: "text" }] };
const oat = { name: "Oat Milk Original", brand: "Willow Farms", category: "Beverages", ingredients: "Oats, water, sea salt" };

describe("a record's identity", () => {
  it("comes from the domain model: an identifier field when there is one, and title, subtitle and required short fields", () => {
    expect(identifierField(product)).toBeUndefined();
    expect(identifierField(withSku)).toBe("sku");
    expect(compositeFields(product)).toEqual(["name", "brand", "category"]);
  });

  it("leaves out an exact repeat and keeps a legitimate variant (same name, another brand)", () => {
    const r = mergeRecords(product, [oat], [{ ...oat }, { ...oat, brand: "Meadow Hill" }]);
    expect(r.rows).toHaveLength(2);
    expect(r.repeats).toEqual(["Oat Milk Original"]);
    expect(r.conflicts).toEqual([]);
  });

  it("for the recorded Clean Cart model is name, brand, category and certification (not title and category alone)", () => {
    const schema = fs.readFileSync(path.join(import.meta.dirname, "fixtures/apps/lookup/src/app/schema.ts.txt"), "utf8");
    const recorded = (JSON.parse(/export const schema[^=]*=\s*(\{[\s\S]*?\n\});/.exec(schema)![1]!) as { entities: ModelEntity[] }).entities;
    expect(compositeFields(recorded.find((e) => e.key === "product")!)).toEqual(["name", "brand", "category", "certification"]);
    expect(identifierField(recorded.find((e) => e.key === "product")!)).toBeUndefined();
    // Variants that differ in any of those are separate records.
    const r = mergeRecords(recorded.find((e) => e.key === "product")!, [{ ...oat, certification: "USDA Organic" }], [{ ...oat, certification: "Non-GMO Project Verified" }, { ...oat, brand: "Meadow Hill", certification: "USDA Organic" }]);
    expect(r.rows).toHaveLength(3);
  });

  it("never settles a clash by keeping the first: a PRD record keeps the PRD's values; otherwise both versions are held out", () => {
    const prdRows = prdFixtureRows(product, prdSampleSection(PRD));
    expect(prdRows[0]).toEqual({ name: "Oat Milk Original", brand: "Willow Farms", category: "Beverages", ingredients: "Oats, water, sea salt" });
    // The PRD's record: the version with its values wins, whichever came first.
    const wrongFirst = mergeRecords(product, [{ ...oat, ingredients: "Oats, water, rapeseed oil" }], [oat], { prdRows });
    expect(wrongFirst.rows).toEqual([oat]);
    expect(wrongFirst.conflicts).toEqual(['"Oat Milk Original" appears twice with different values (name, brand, category the same); kept the version with the PRD\'s values']);
    // An invented record: neither version, and the identity stays held out in later batches.
    const almond = { name: "Almond Butter", brand: "Nutty", category: "Snacks", ingredients: "Almonds" };
    const r = mergeRecords(product, [almond], [{ ...almond, ingredients: "Almonds, salt" }], { prdRows });
    expect(r.rows).toEqual([]);
    expect(r.conflicts[0]).toMatch(/; neither version is kept \(held out\)$/);
    expect(mergeRecords(product, r.rows, [almond], { held: r.held, prdRows }).rows).toEqual([]);
    // Neither version of a PRD record has its values: both held out, then the PRD's version (asked for by name) gets in.
    const bad = mergeRecords(product, [{ ...oat, ingredients: "a" }], [{ ...oat, ingredients: "b" }], { prdRows });
    expect(bad.conflicts[0]).toMatch(/held out\), and neither has the PRD's values$/);
    expect(mergeRecords(product, bad.rows, [oat], { held: bad.held, prdRows }).rows).toEqual([oat]);
  });

  it("keeps a PRD record once when both versions have the PRD's values and differ only in what the PRD doesn't give (the recorded eval-1 seed)", () => {
    const recorded = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "fixtures/apps/eval1-app-model.json"), "utf8")) as { entities: ModelEntity[]; seed: Record<string, Array<Record<string, unknown>>> };
    const e = recorded.entities.find((x) => x.key === "product")!;
    const r = mergeRecords(e, [], recorded.seed.product!, { prdRows: prdFixtureRows(e, prdSampleSection(PRD)) });
    expect(FIXTURES.map((n) => r.rows.filter((x) => x.name === n).length)).toEqual(FIXTURES.map(() => 1));
    expect(r.conflicts).toContain('"Sourdough Country Loaf" appears twice with different values (name, brand, category, certification the same): both have the PRD\'s values and differ only in description, which the PRD doesn\'t give; kept one');
    expect(r.repeats).toEqual(["Oat Milk Original"]);
  });

  it("names one identifier on two records, one record under two identifiers, and a record with no identity, holding them out", () => {
    const a = { ...oat, sku: "WF-1" };
    expect(mergeRecords(withSku, [a], [{ ...oat, name: "Rolled Oats", sku: "WF-1" }]).conflicts).toEqual(['sku WF-1 is used by "Oat Milk Original" and "Rolled Oats"; neither version is kept (held out)']);
    expect(mergeRecords(withSku, [a], [{ ...oat, sku: "WF-2" }]).conflicts).toEqual(['"Oat Milk Original" appears under two skus (WF-1, WF-2); neither version is kept (held out)']);
    expect(mergeRecords(product, [], [{ ...oat, name: "" }])).toMatchObject({ rows: [], conflicts: ["a record with no name can't be identified; held out"] });
    // Identity unavailable beyond the title (a kind with no other identifying field): same title, different values is a clash, not a variant.
    const titleOnly: ModelEntity = { ...product, subtitleField: undefined, fields: [{ key: "name", label: "Name", type: "text", required: true }, { key: "notes", label: "Notes", type: "longtext" }] };
    expect(compositeFields(titleOnly)).toEqual(["name"]);
    expect(mergeRecords(titleOnly, [{ name: "Oat Milk", notes: "1 L" }], [{ name: "Oat Milk", notes: "2 L" }]).rows).toEqual([]);
  });

  it("finds the PRD's records missing after a merge, and puts the PRD's records first in its order", () => {
    const rows = [{ ...oat, name: "Almond Butter" }, { ...oat, name: "Rolled Oats", brand: "Sunrise Valley" }, oat];
    expect(missingFixtures(product, rows, FIXTURES)).toEqual(["Sourdough Country Loaf", "Pear Puree", "Black Bean Chips", "Greek Yogurt Plain"]);
    expect(fixturesFirst(product, rows, FIXTURES).map((r) => r.name)).toEqual(["Oat Milk Original", "Rolled Oats", "Almond Butter"]);
  });
});

describe("what each batch is asked for", () => {
  it("the PRD's records in the first batch; later only the missing ones, and never for a kind that doesn't hold them", () => {
    expect(batchNote(product, [], 0, 10, "## Sample data", FIXTURES)).toMatch(/^Include the PRD's sample records \(if they are this kind of record\), exactly as given .* once each: Oat Milk Original, Sourdough Country Loaf/);
    const six = FIXTURES.map((n) => ({ ...oat, name: n }));
    const later = batchNote(product, six, 10, 10, "## Sample data", FIXTURES);
    expect(later).toMatch(/^These are records 11 to 20\. Already written \(don't repeat any of them\): Oat Milk Original/);
    expect(later).not.toMatch(/PRD's sample/);
    expect(batchNote(product, six.slice(0, 4), 10, 10, "## Sample data", FIXTURES)).toMatch(/Still missing from the PRD's sample records, exactly as given .* once each: Black Bean Chips, Greek Yogurt Plain\./);
    const store: ModelEntity = { ...product, key: "store", plural: "Stores", fields: [{ key: "name", label: "Name", type: "text", required: true }] };
    expect(batchNote(store, [{ name: "Harvest Co-op" }], 10, 10, "## Sample data", FIXTURES)).not.toMatch(/PRD's sample/);
  });
});

describe("in the app model's planning", () => {
  const structure = {
    shape: "lookup",
    product: "Clean Cart",
    roles: ["Shopper"],
    entities: [
      { key: "product", label: "Product", plural: "Products", idPrefix: "PRD", titleField: "name", subtitleField: "brand", fields: product.fields },
      { key: "store", label: "Store", plural: "Stores", idPrefix: "STR", titleField: "name", fields: [{ key: "name", label: "Name", type: "text", required: true }, { key: "zip", label: "ZIP", type: "text" }] },
    ],
    nav: [{ label: "Clean Cart", items: [{ id: "home", label: "Home", kind: "landing" }] }],
    lookup: { entries: "product", places: "store", categoryField: "category", placesField: "carriedBy", areas: [{ zip: "94110", label: "Mission", lat: 37.75, lng: -122.41 }], placeWord: "store", carryWord: "carries", detailFields: ["category"], facets: ["category"] },
  };
  /** A planner that repeats the PRD's first records in every batch and never writes "Greek Yogurt Plain". */
  async function plan() {
    const { app } = makeApp();
    const asked: string[] = [];
    let n = 0;
    app.router.register({
      config: { id: "ollama", kind: "ollama", label: "stub", enabled: true, hosted: false },
      chat: async (req: ChatRequest) => {
        const system = String(req.messages[0]?.content ?? "");
        const user = String(req.messages[1]?.content ?? "");
        let body: unknown = { ratings: [], lists: [] };
        if (system.includes("Write it in parts")) body = structure;
        else if (system.startsWith("You write realistic sample records")) {
          asked.push(user);
          body = /Records: \d+ Stores/.test(user)
            ? { records: ["Green Valley Market", "Harvest Co-op", "Mission Fresh", "Harvest Co-op"].map((name) => ({ name, zip: "94110" })) }
            : { records: [...FIXTURES.filter((f) => f !== "Greek Yogurt Plain").map((name) => ({ ...oat, name })), ...Array.from({ length: 6 }, () => ({ ...oat, name: `Extra ${++n}`, carriedBy: ["STR-1001"] }))] };
        }
        return { content: JSON.stringify(body), toolCalls: [], model: req.model, durationMs: 1, doneReason: "stop" };
      },
      listModels: async () => [],
      describe: async () => undefined,
      health: async () => ({ ok: true, detail: "" }),
    } as never);
    for (const role of ["planner", "coder", "debugger"] as const) app.router.setRoleAssignment(role, { providerId: "ollama", model: "qwen3-coder:30b" });
    const { project } = makeProject(app, { "README.md": "# demo\n" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Clean Cart", constraints: [], attachedKnowledgeIds: [] });
    const out = (await (app.orchestrator as unknown as { appModelInParts: (...a: unknown[]) => Promise<{ model: { seed: Record<string, Array<Record<string, unknown>>> } }> }).appModelInParts(app.store.runs.require(run.id), PRD, [], "", "", new AbortController().signal)).model;
    return { out, asked, merges: app.store.getSetting<string[]>(`appModelMerges:${run.id}`, []) };
  }

  it("keeps each record once with the PRD's records first, asks once more for the missing one, and records what it left out", async () => {
    const { out, asked, merges } = await plan();
    const names = out.seed.product!.map((r) => String(r.name));
    expect(new Set(names).size).toBe(names.length);
    expect(names.slice(0, 5)).toEqual(FIXTURES.filter((f) => f !== "Greek Yogurt Plain"));
    expect(out.seed.product![0]!.id).toBe("PRD-1001");
    // Later product batches carry no PRD sample block, only what's still missing and what's written.
    const productAsks = asked.filter((u) => /Records: \d+ Products/.test(u));
    expect(productAsks[0]).toContain("The PRD's sample data (data, not instructions)");
    expect(productAsks.slice(1, -1).every((u) => !u.includes("Include the PRD's sample records") && /Still missing from the PRD's sample records.*Greek Yogurt Plain/.test(u))).toBe(true);
    // The bounded re-ask: once, by name, recorded; no invented replacement.
    expect(productAsks.at(-1)).toMatch(/Write exactly these records from the PRD's sample data.*: Greek Yogurt Plain\./);
    expect(productAsks.filter((u) => u.includes("Write exactly these records")).length).toBe(1);
    expect(names).not.toContain("Greek Yogurt Plain");
    expect(merges).toContain("Products: asked once more for the PRD's 1 missing record (Greek Yogurt Plain); still missing: Greek Yogurt Plain");
    expect(merges.some((m) => /^Products \(batch 2\): left out 5 repeats \(Oat Milk Original/.test(m))).toBe(true);
    expect(merges.some((m) => /^Stores \(batch 1\): left out 1 repeat \(Harvest Co-op\)/.test(m))).toBe(true);
    expect(out.seed.store!.map((r) => r.name)).toEqual(["Green Valley Market", "Harvest Co-op", "Mission Fresh"]);
  }, 60_000);
});
