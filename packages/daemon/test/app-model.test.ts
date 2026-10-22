import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { appModelNote, parseAppModel } from "../src/orchestrator/appModel.js";
import { appFiles, appKept, completeAppTasks, customPlanOf, namedIndexHtml, screenPlanOf, WRITE_APP } from "../src/orchestrator/appFiles.js";
import { ADD_LAYOUTS } from "../src/orchestrator/layoutRecipes.js";
import { APP_LAYOUT } from "../src/orchestrator/screenPlan.js";
import { DESIGN_SCREENS, specRuntimeTasks } from "../src/orchestrator/templates.js";

const raw = {
  product: "Treaty Tables",
  roles: ["Reinsurance Ops", "Manager"],
  entities: [
    {
      key: "treaty",
      label: "Treaty",
      plural: "Treaties",
      titleField: "name",
      subtitleField: "counterparty",
      idPrefix: "trt",
      statusField: "status",
      statuses: [
        { key: "draft", label: "Draft", tone: "neutral" },
        { key: "approval", label: "Awaiting approval", tone: "info" },
        { key: "active", label: "Active", tone: "success" },
        { key: "runoff", label: "Runoff", tone: "loud" },
      ],
      fields: [
        { key: "name", label: "Treaty name", type: "text", required: true },
        { key: "counterparty", label: "Counterparty", type: "text" },
        { key: "line", label: "Product line", type: "select", options: ["Fixed deferred annuity", "Variable annuity"] },
        { key: "limit", label: "Places limit", type: "money", min: 0 },
        { key: "weird", label: "Weird", type: "hologram" },
        { key: "badselect", label: "No options", type: "select" },
      ],
      columns: ["name", "line", "limit", "status", "nope"],
      filters: ["status", "line", "name"],
      steps: [{ key: "terms", label: "General terms", fields: ["name", "line", "ghost"] }, { key: "empty", label: "Empty", fields: ["ghost"] }],
      transitions: [
        { key: "submit", label: "Submit", from: ["draft"], to: "approval" },
        { key: "approve", label: "Approve", from: ["approval"], to: "active", roles: ["Manager", "CEO"] },
        { key: "bad", label: "Bad", from: ["nowhere"], to: "active" },
      ],
    },
  ],
  seed: { treaty: Array.from({ length: 22 }, (_, i) => ({ name: `Treaty ${i}`, limit: `${i * 1000}`, status: i % 2 ? "active" : "unknown" })) },
  nav: [
    { label: "Treaty Tables", items: [{ id: "Treaty Master", label: "Treaty Master", kind: "list", entity: "treaty" }, { id: "rates", label: "Rate tables", kind: "list" }, { id: "x", label: "Audit", kind: "placeholder" }] },
  ],
};

describe("the app model", () => {
  it("keeps what refers to real fields, statuses and roles, and fills in each entity's working set", () => {
    const { model, problems } = parseAppModel(raw);
    expect(problems).toEqual([]);
    const e = model!.entities[0]!;
    expect(e.idPrefix).toBe("TRT");
    expect(e.fields.find((f) => f.key === "weird")?.type).toBe("text");
    expect(e.fields.find((f) => f.key === "badselect")?.type).toBe("text");
    expect(e.statuses!.find((s) => s.key === "runoff")?.tone).toBe("neutral");
    expect(e.columns).toEqual(["name", "line", "limit", "status"]);
    expect(e.filters).toEqual(["status", "line"]);
    expect(e.steps).toEqual([{ key: "terms", label: "General terms", fields: ["name", "line"] }]);
    expect(e.transitions!.map((t) => t.key)).toEqual(["submit", "approve"]);
    expect(e.transitions![1]!.roles).toEqual(["Manager"]);
    // Seed: ids, numbers as numbers, unknown statuses replaced.
    const s = model!.seed.treaty!;
    expect(s).toHaveLength(22);
    expect(s[3]).toEqual(expect.objectContaining({ id: "TRT-1004", limit: 3000, status: "active" }));
    expect(["draft", "approval", "active", "runoff"]).toContain(s[0]!.status);
    // Nav: kebab ids; a list with no entity becomes a placeholder; a record page added. A create page is never implied by a
    // kind of record: it comes from the model or the PRD (planScope.applyScope).
    const items = model!.nav.flatMap((g) => g.items);
    expect(items[0]).toEqual(expect.objectContaining({ id: "treaty-master", kind: "list", entity: "treaty" }));
    expect(items.find((i) => i.id === "rates")?.kind).toBe("placeholder");
    expect(items.filter((i) => i.entity === "treaty").map((i) => i.kind).sort()).toEqual(["detail", "list"]);
    expect(appModelNote(model!)).toContain("Treaties (treaty)");
  });

  it("makes a navigation group with no destinations a page of its own (ShelfSure's planner listed screens as empty groups)", () => {
    const { model } = parseAppModel({ ...raw, nav: [...(raw as { nav: unknown[] }).nav, { label: "Swap & Compare", items: [] }] });
    const page = model!.nav.find((g) => g.label === "Swap & Compare")?.items[0];
    expect(page).toEqual(expect.objectContaining({ id: "swap-compare", label: "Swap & Compare", kind: "custom" }));
  });

  it("says what is missing instead of inventing it", () => {
    const { model, problems } = parseAppModel({ product: "X", roles: [], entities: [{ key: "a", fields: [] }], seed: {}, nav: [] });
    expect(model).toBeUndefined();
    expect(problems).toEqual(expect.arrayContaining(["No entities", "No navigation"]));
  });
  it("writes the app's files and names the page for the app, not the starter", () => {
    const { model } = parseAppModel(raw);
    const files = appFiles(model!).map((f) => f.path);
    expect(files).toContain("src/App.tsx");
    expect(files).toContain("src/app/store.ts");
    const html = '<head><meta name="description" content="A private, local-first schedule." /><title>Schedule — local-first planner</title></head>';
    const named = namedIndexHtml(html, { ...model!, product: "Treaty <Tables>" });
    expect(named).toContain("<title>Treaty &lt;Tables&gt;</title>");
    expect(named).not.toContain("Schedule");
  });

  it("turns a spec build's steps into the complete app: the app written from its model, then designed", () => {
    const { model } = parseAppModel(raw);
    const prd = { name: "prd.md", role: "prd" as const, content: "# Treaty Tables\n## Main screens\nA home dashboard, settings and a treaty list." };
    const before = specRuntimeTasks([prd], "react-vite-scheduler");
    expect(before.map((t) => t.title)).toContain(ADD_LAYOUTS);
    const tasks = completeAppTasks(before, model!);
    const titles = tasks.map((t) => t.title);
    expect(titles).toContain(WRITE_APP);
    expect(titles).not.toContain(APP_LAYOUT);
    expect(titles).not.toContain(ADD_LAYOUTS);
    // Nothing waits on a step that is gone.
    const keys = new Set(tasks.map((t) => t.key));
    for (const t of tasks) for (const d of t.dependsOn) expect(keys.has(d)).toBe(true);
    const design = tasks.find((t) => t.title === DESIGN_SCREENS)!;
    expect(design.objective).toMatch(/never rebuild, replace or wrap them/);
    expect(design.objective).toContain("src/screens/TreatyMasterScreen.tsx");
    // Every working page is a screen the checks visit; only custom pages are composed by the design steps.
    const plan = screenPlanOf(model!);
    expect(plan.screens.map((x) => x.file)).toContain("src/screens/TreatyMasterScreen.tsx");
    expect(customPlanOf(model!).screens.every((x) => model!.nav.flatMap((g) => g.items).find((v) => v.id === x.id)?.kind === "custom")).toBe(true);
  });

  it("writes the model's words as data, never as code, whatever they contain", () => {
    const evil = 'Ops" onClick={() => alert(1)} x="*/ alert(2); /*';
    const hostile = {
      ...raw,
      product: `Treaty ${evil}`,
      nav: [{ label: "Main", items: [
        { id: "home", label: evil, kind: "dashboard", entity: "treaty", purpose: evil },
        { id: "treaty-master", label: evil, kind: "list", entity: "treaty", purpose: evil },
        { id: "notes", label: evil, kind: "custom", purpose: evil },
      ] }],
    };
    const { model } = parseAppModel(hostile);
    for (const f of appFiles(model!).filter((x) => /\.tsx?$/.test(x.path))) {
      const src = ts.createSourceFile(f.path, f.content, ts.ScriptTarget.Latest, true, f.path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      expect((src as unknown as { parseDiagnostics: unknown[] }).parseDiagnostics, f.path).toEqual([]);
      // The words only ever reach the page as string values: no handler or call the model wrote.
      let calls = 0;
      const visit = (n: ts.Node) => {
        if (ts.isJsxAttribute(n) && n.name.getText(src) === "onClick") calls++;
        if (ts.isCallExpression(n) && n.expression.getText(src) === "alert") calls++;
        ts.forEachChild(n, visit);
      };
      visit(src);
      expect(calls, f.path).toBe(0);
    }
  });

  it("guards the working app: a step that rebuilds a page, drops the frame or copies the data is sent back", () => {
    const { model } = parseAppModel(raw);
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-appguard-"));
    const write = (rel: string, content: string) => {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), content);
    };
    for (const f of appFiles(model!)) write(f.path, f.content);
    for (const piece of ["AppFrame", "ResourceIndex", "RecordWizard", "RecordDetail", "AppDashboard", "AppData"]) write(`src/sections/${piece}.tsx`, "export {};");
    expect(appKept(root, model!)).toEqual([]);
    // Restyled and reworded, with content added around the pattern: still kept.
    const list = "src/screens/TreatyMasterScreen.tsx";
    write(list, fs.readFileSync(path.join(root, list), "utf8").replace("return <ResourceIndex", "return <>\n<p>Tip</p>\n<ResourceIndex").replace(" />;\n}", " />\n</>;\n}"));
    expect(appKept(root, model!)).toEqual([]);
    // Rebuilt as a plain table with its own data, the frame gone, a piece deleted.
    write(list, 'import { createStore } from "../sections/AppData";\nconst mine = createStore({ appKey: "x", roles: [], entities: [] }, {});\nexport default function TreatyMasterScreen() { void mine; return <table />; }\n');
    write("src/App.tsx", "export default function App() { return <main />; }\n");
    fs.rmSync(path.join(root, "src/sections/RecordDetail.tsx"));
    const problems = appKept(root, model!);
    expect(problems.some((x) => x.startsWith("src/App.tsx no longer draws the app frame"))).toBe(true);
    expect(problems.some((x) => x.startsWith(`${list} (Treaty Master) no longer uses the working ResourceIndex`) && x.includes("<ResourceIndex store={store}"))).toBe(true);
    expect(problems.some((x) => x.startsWith(`${list} (Treaty Master) makes its own store`))).toBe(true);
    expect(problems.some((x) => x.startsWith("src/sections/RecordDetail.tsx"))).toBe(true);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("leaves a website to the page sections: no app model for pages people read", () => {
    expect(parseAppModel({ shape: "website", product: "Harbour Dental" })).toEqual({ problems: [], website: true });
    expect(parseAppModel({ ...raw, shape: "app" }).model?.product).toBe("Treaty Tables");
  });
});

describe("required screens the planner left as placeholders", () => {
  it("builds one the PRD names when no working page stands for it, strictly by its words, and leaves the rest", async () => {
    const { buildRequiredPlaceholders } = await import("../src/orchestrator/appModel.js");
    const { model } = parseAppModel({ ...raw, nav: [...(raw as { nav: unknown[] }).nav, { label: "More", items: [{ id: "compare", label: "Compare", kind: "placeholder" }, { id: "reports", label: "Reports", kind: "placeholder" }] }] });
    const built = buildRequiredPlaceholders(model!, [{ name: "Swap & Compare", purpose: "Compare alternatives side by side" }]);
    const items = built.nav.flatMap((g) => g.items);
    expect(items.find((i) => i.id === "compare")).toEqual(expect.objectContaining({ kind: "custom", purpose: "Compare alternatives side by side" }));
    expect(items.find((i) => i.id === "reports")?.kind).toBe("placeholder");
  });
});

describe("required screens the planner left out", () => {
  it("are added as custom pages with the PRD's purpose, first in the navigation", async () => {
    const { buildRequiredPlaceholders, completenessProblems } = await import("../src/orchestrator/appModel.js");
    const { model } = parseAppModel(raw);
    const declared = [{ name: "Shopping List", purpose: "Group by grocery category with check-off" }];
    const built = buildRequiredPlaceholders(model!, declared);
    expect(built.nav[0]!.items[0]).toEqual(expect.objectContaining({ id: "shopping-list", label: "Shopping List", kind: "custom", purpose: "Group by grocery category with check-off" }));
    expect(completenessProblems(built, declared).filter((p) => /Shopping List/.test(p))).toEqual([]);
  });
});
