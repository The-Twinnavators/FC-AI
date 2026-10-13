import { describe, expect, it } from "vitest";
import { appModelNote, parseAppModel } from "../src/orchestrator/appModel.js";
import { appFiles, completeAppTasks, customPlanOf, namedIndexHtml, screenPlanOf, WRITE_APP } from "../src/orchestrator/appFiles.js";
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
    // Nav: kebab ids; a list with no entity becomes a placeholder; create and detail added.
    const items = model!.nav.flatMap((g) => g.items);
    expect(items[0]).toEqual(expect.objectContaining({ id: "treaty-master", kind: "list", entity: "treaty" }));
    expect(items.find((i) => i.id === "rates")?.kind).toBe("placeholder");
    expect(items.filter((i) => i.entity === "treaty").map((i) => i.kind).sort()).toEqual(["create", "detail", "list"]);
    expect(appModelNote(model!)).toContain("Treaties (treaty)");
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
});
