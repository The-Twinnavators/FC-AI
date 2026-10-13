import { describe, expect, it } from "vitest";
import { parseAppModel } from "../src/orchestrator/appModel.js";

/** A look-up app's answer from the planner: products and the stores near people that carry them. */
const raw = {
  shape: "lookup",
  product: "Clean Cart",
  roles: ["Member"],
  entities: [
    {
      key: "product",
      label: "Product",
      plural: "Products",
      titleField: "name",
      subtitleField: "brand",
      idPrefix: "prd",
      statusField: "status",
      statuses: [{ key: "x", label: "X", tone: "info" }],
      fields: [
        { key: "name", label: "Name", type: "text", required: true },
        { key: "brand", label: "Brand", type: "text" },
        { key: "category", label: "Category", type: "select", options: ["Produce", "Pantry", "Snacks"] },
        { key: "diet", label: "Dietary", type: "select", options: ["Vegan", "Gluten-free"] },
        { key: "cert", label: "Certification", type: "text" },
        { key: "ingredients", label: "Ingredients", type: "longtext" },
      ],
    },
    {
      key: "store",
      label: "Store",
      plural: "Stores",
      titleField: "name",
      idPrefix: "sto",
      fields: [
        { key: "name", label: "Name", type: "text" },
        { key: "address", label: "Address", type: "text" },
        { key: "zip", label: "ZIP", type: "text" },
      ],
    },
  ],
  seed: {
    product: Array.from({ length: 14 }, (_, i) => ({ name: `Product ${i}`, brand: "Sunrise", category: ["Produce", "Pantry", "Snacks"][i % 3], carriedBy: i % 2 ? ["STO-1001", "STO-1002", "STO-9999"] : ["sto-1002"], status: "x" })),
    store: [
      { name: "Green Valley Market", zip: "94110", lat: 37.75, lng: -122.41 },
      { name: "Harvest Co-op", zip: "94110" },
    ],
  },
  lookup: {
    entries: "product",
    places: "store",
    categoryField: "category",
    placesField: "carriedBy",
    areas: [{ zip: "94110", label: "San Francisco, CA", lat: 37.7486, lng: -122.4158 }, { zip: "9411", label: "bad", lat: 1, lng: 1 }],
    placeWord: "Store",
    carryWord: "carries",
    badgeField: "cert",
    detailFields: ["brand", "cert", "nope"],
    facets: ["diet", "category", "brand"],
    ratings: [{ entry: "PRD-1001", who: "Dana W.", stars: 7, text: "Great", at: "2026-09-01", helpful: 2 }, { entry: "PRD-9999", who: "X", stars: 3, text: "", at: "" }],
    lists: [{ name: "Weekly shop", place: "STO-1001", items: [{ entry: "PRD-1002", qty: 2 }, { entry: "PRD-0000", qty: 1 }] }],
    likes: { "PRD-1001": 40, "PRD-5000": 3 },
  },
  nav: [{ label: "Clean Cart", items: [{ id: "products", label: "Products", kind: "catalog" }, { id: "product", label: "Product", kind: "entry" }, { id: "reports", label: "Reports", kind: "dashboard" }] }],
};

describe("the look-up app model", () => {
  it("reads what is looked up and where, keeping only references to real records", () => {
    const { model, problems } = parseAppModel(raw);
    expect(model?.lookup).toBeTruthy();
    const l = model!.lookup!;
    expect(l).toEqual(expect.objectContaining({ entries: "product", places: "store", categoryField: "category", placesField: "carriedBy", placeWord: "store", badgeField: "cert" }));
    // Bad ZIPs, unknown fields and non-select facets are dropped.
    expect(l.areas.map((a) => a.zip)).toEqual(["94110"]);
    expect(l.detailFields).toEqual(["brand", "cert"]);
    expect(l.facets).toEqual(["diet"]);
    // Places carried: real ids only, matched whatever their case.
    expect(model!.seed.product![1]!.carriedBy).toEqual(["STO-1001", "STO-1002"]);
    expect(model!.seed.product![0]!.carriedBy).toEqual(["STO-1002"]);
    // A place without coordinates sits near its area's centre.
    expect(typeof model!.seed.store![1]!.lat).toBe("number");
    // No statuses in a look-up app.
    expect(model!.entities[0]!.statuses).toBeUndefined();
    expect(model!.seed.product![0]!.status).toBeUndefined();
    // Ratings, lists and likes keep only real entries; stars are 1 to 5.
    expect(l.ratings).toEqual([expect.objectContaining({ entryId: "PRD-1001", stars: 5 })]);
    expect(l.lists[0]).toEqual(expect.objectContaining({ name: "Weekly shop", placeId: "STO-1001", items: [{ entryId: "PRD-1002", qty: 2, done: false }] }));
    expect(l.likes).toEqual({ "PRD-1001": 40 });
    // The working set is complete, with the landing page first; a staff kind becomes a placeholder.
    const items = model!.nav.flatMap((g) => g.items);
    expect(items[0]!.kind).toBe("landing");
    expect(new Set(items.map((i) => i.kind))).toEqual(new Set(["landing", "catalog", "categories", "entry", "places", "lists", "mylist", "saved", "placeholder"]));
    expect(items.find((i) => i.id === "reports")?.kind).toBe("placeholder");
    expect(problems.join(" ")).not.toMatch(/isn't usable/);
  });

  it("refuses a look-up model with no usable ZIP areas", () => {
    const { model, problems } = parseAppModel({ ...raw, lookup: { ...raw.lookup, areas: [{ zip: "abc", lat: 0, lng: 0 }] } });
    expect(model).toBeUndefined();
    expect(problems.join(" ")).toMatch(/ZIP code areas/);
  });
});

describe("writing a look-up app", () => {
  it("writes the look-up layer, a working screen per destination and the look-up frame, all valid code, and guards them", async () => {
    const ts = (await import("typescript")).default;
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const { appFiles, appKept } = await import("../src/orchestrator/appFiles.js");
    const { model } = parseAppModel(raw);
    const files = appFiles(model!);
    const paths = files.map((f) => f.path);
    expect(paths).toContain("src/app/lookup.ts");
    expect(paths.filter((p) => p === "src/App.tsx")).toHaveLength(1);
    const app = files.find((f) => f.path === "src/App.tsx")!.content;
    expect(app).toContain("<LookupFrame");
    expect(app).not.toContain("<AppFrame");
    for (const f of files.filter((x) => /\.tsx?$/.test(x.path))) {
      const src = ts.createSourceFile(f.path, f.content, ts.ScriptTarget.Latest, true, f.path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      expect((src as unknown as { parseDiagnostics: unknown[] }).parseDiagnostics, f.path).toEqual([]);
    }
    const screen = (kind: string) => files.find((f) => f.path === `src/screens/${model!.nav.flatMap((g) => g.items).find((v) => v.kind === kind)!.id.split("-").map((w) => w[0]!.toUpperCase() + w.slice(1)).join("")}Screen.tsx`)!.content;
    expect(screen("catalog")).toContain("<LookupCatalog");
    expect(screen("entry")).toContain("<LookupEntry");
    expect(screen("places")).toContain("<PlaceFinder");
    expect(screen("mylist")).toContain("<ListBuilder");
    expect(screen("saved")).toContain("only={saved}");
    // The guard: kept as written, then a rebuilt catalog and a missing frame are caught.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-lookup-"));
    const write = (rel: string, content: string) => {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), content);
    };
    for (const f of files) write(f.path, f.content);
    for (const p of ["LookupFrame", "LookupCatalog", "LookupEntry", "PlaceFinder", "ListBuilder", "LookupData", "AppData"]) write(`src/sections/${p}.tsx`, "export {};");
    expect(appKept(root, model!)).toEqual([]);
    const catalogFile = files.find((f) => f.content.includes("<LookupCatalog") && f.content.includes("useHashId"))!.path;
    write(catalogFile, "export default function X() { return <ul />; }\n");
    write("src/App.tsx", "export default function App() { return <main />; }\n");
    const problems = appKept(root, model!);
    expect(problems.some((p) => p.includes("<LookupFrame>"))).toBe(true);
    expect(problems.some((p) => p.startsWith(catalogFile) && p.includes("LookupCatalog"))).toBe(true);
    fs.rmSync(root, { recursive: true, force: true });
  });
});

describe("pieces waiting for approval", () => {
  it("names the look-up pieces a look-up app needs that aren't approved yet, and none once they are", async () => {
    const { unapprovedPieces } = await import("../src/orchestrator/appFiles.js");
    const { model } = parseAppModel(raw);
    expect(unapprovedPieces(model!, [])).toEqual(["lookup-frame", "lookup-catalog", "lookup-entry", "place-finder", "list-builder"]);
    const all = ["lookup-frame", "lookup-catalog", "lookup-entry", "place-finder", "list-builder"].map((id) => ({ id }) as never);
    expect(unapprovedPieces(model!, all)).toEqual([]);
  });
});

describe("sized for the planner's provider", () => {
  it("asks a cloud planner for the full app model and a local one for a compact model that fits its memory", async () => {
    const { appModelBudget } = await import("../src/orchestrator/appModel.js");
    const { localContext } = await import("../src/models/ollama.js");
    const cloud = appModelBudget(true);
    const local = appModelBudget(false);
    expect(cloud.maxOutputTokens).toBe(32_000);
    expect(cloud.note).toBe("");
    expect(local.maxOutputTokens).toBeLessThanOrEqual(8_000);
    expect(local.note).toMatch(/compact/);
    // A local call asking for a long reply gets the working memory to hold it; ordinary calls keep theirs.
    expect(localContext(undefined, local.maxOutputTokens)).toBeGreaterThanOrEqual(local.maxOutputTokens + 4096);
    expect(localContext(undefined, undefined)).toBe(8192);
    expect(localContext(16_384, 4096)).toBe(16_384);
    expect(localContext(undefined, 64_000)).toBe(32_768);
  });
});

describe("a look-up app's landing page", () => {
  it("may use the look-up pieces: the search, ZIP prompt, category tiles and featured entries are its working parts", async () => {
    const { checkComposition } = await import("../src/orchestrator/pageTypes.js");
    const sections = [
      { title: "Hero: promise, search, ZIP", part: "p.lookup-catalog.search" },
      { title: "Find it near you", part: "p.place-finder.prompt" },
      { title: "Featured categories", part: "p.lookup-catalog.categories" },
      { title: "Most liked", part: "p.lookup-catalog.grid" },
    ];
    const { sections: kept, issues } = checkComposition("Home", "marketing", sections);
    expect(issues.filter((i) => /belongs on/.test(i.reason))).toEqual([]);
    expect(kept.map((s) => s.part)).toEqual(sections.map((s) => s.part));
    // Still app-only: an entry page and a list don't belong on a marketing page.
    expect(checkComposition("Home", "marketing", [{ title: "A list", part: "p.list-builder.list" }]).issues.some((i) => /belongs on app screens/.test(i.reason))).toBe(true);
  });
});
