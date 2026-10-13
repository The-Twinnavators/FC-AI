/**
 * Page blocking as a composition contract: pieces know where they belong and what they give a page; each page plan has
 * a type that is checked against its parts at planning; the planned structure is locked on the design steps, and a
 * change needs a recorded reason the person sees at review.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { relationsOf, ROLE_TOOLS, type Task } from "@flowcode/contracts";
import { catalogContract, contractText } from "../src/orchestrator/catalogContract.js";
import { entryFor, lockedButMissing, recordChange, verifyManifest, type CompositionManifest } from "../src/orchestrator/compositionManifest.js";
import { checkComposition, pageTypeOf } from "../src/orchestrator/pageTypes.js";
import { parseScreenBriefs } from "../src/orchestrator/screenBrief.js";
import { createDispatcher } from "../src/orchestrator/tools.js";
import { DESIGN_SCREENS } from "../src/orchestrator/templates.js";
import { BUILTIN_SKILLS, workflowSkillIds } from "../src/knowledge/skills.js";
import type { ScreenPlan } from "../src/orchestrator/screenPlan.js";
import { makeApp, makeProject } from "./helpers.js";

describe("catalog relations", () => {
  it("say where a piece belongs, what it gives a page, what it needs and when to avoid it", () => {
    expect(relationsOf("b.hero-split").contexts).toEqual(["marketing"]);
    expect(relationsOf("p.data-table@sortable")).toEqual(expect.objectContaining({ contexts: ["app"], provides: expect.arrayContaining(["results", "sort"]) }));
    expect(relationsOf("c.button.primary").contexts).toEqual(["app", "marketing"]);
    const text = contractText(catalogContract("p.resource-table")!);
    expect(text).toContain("Belongs on: app screens");
    expect(text).toContain("Gives a page: results");
    expect(text).toContain("Avoid when: fewer than four records");
  });
});

describe("page types", () => {
  it("are the planner's choice when given, else read from the page's name and purpose", () => {
    expect(pageTypeOf("dashboard", "Home", "")).toBe("dashboard");
    expect(pageTypeOf(undefined, "Brand detail", "", true)).toBe("detail");
    expect(pageTypeOf(undefined, "Brands", "Find and filter certified brands")).toBe("list");
    expect(pageTypeOf("nonsense", "Settings", "Change notifications")).toBe("settings");
  });

  it("take marketing parts off app pages and record a page that has nothing doing its job", () => {
    const { sections, issues } = checkComposition("Brands", "list", [
      { title: "Welcome", purpose: "", part: "b.hero-split" },
      { title: "Search", purpose: "", part: "p.filter-panel" },
    ]);
    expect(sections.map((s) => s.part)).toEqual(["", "p.filter-panel"]);
    expect(issues[0]).toEqual(expect.objectContaining({ page: "Brands", part: "b.hero-split", reason: expect.stringContaining("belongs on marketing pages") }));
    expect(issues[1]!.reason).toMatch(/A list page needs a part that gives it results; none was chosen\. Catalog parts that do: p\.filterable-list/);
    expect(checkComposition("Brands", "list", [{ title: "Brands", part: "p.filterable-list" }]).issues).toEqual([]);
  });

  it("are planned per page: the brief's type, its notes, and the issues for the manifest", () => {
    const plan = { product: "Brands", screens: [{ id: "brands", label: "Brands", component: "BrandsScreen", file: "src/screens/BrandsScreen.tsx", purpose: "Find a brand" }] } as ScreenPlan;
    const issues: Parameters<typeof parseScreenBriefs>[4] = [];
    const manifest = { screens: [{ screen: "Brands", picks: [{ ref: "b.hero-split" }, { ref: "p.filterable-list" }], alternates: [] }], shared: [] } as never;
    const [b] = parseScreenBriefs({ screens: [{ screen: "Brands", pageType: "list", who: "Shoppers", goal: "Find a brand", workflow: [], firstView: "Brands", primaryAction: "Open one", sections: [{ title: "Hero", purpose: "Welcome", part: "b.hero-split" }, { title: "Results", purpose: "Brands", part: "p.filterable-list" }] }] }, plan, manifest, [], issues);
    expect(b!.pageType).toBe("list");
    expect(b!.sections.map((s) => s.part)).toEqual(["", "p.filterable-list"]);
    expect(issues!.map((i) => i.part)).toEqual(["b.hero-split"]);
  });
});

describe("the layout lock", () => {
  it("names planned sections left unbuilt, unless a change with its reason was recorded", () => {
    const { app } = makeApp();
    const { ws } = makeProject(app, { "src/sections/ListStacked.tsx": "export default function X() { return null; }\n" });
    let m: CompositionManifest = { entries: [entryFor("p.filterable-list", "Brands", "Results", "plan")!, entryFor("c.empty-state", "Brands", "Nothing yet", "plan")!], gaps: [], changes: [] };
    m = verifyManifest(ws, m);
    expect(lockedButMissing(m, "all").map((e) => e.section)).toEqual(["Results", "Nothing yet"]);
    expect(lockedButMissing(m, ["Home"])).toEqual([]);
    m = recordChange(m, { page: "Brands", section: "Nothing yet", change: "remove", why: "The sample data always has brands", by: "Design the screens", at: "now" });
    fs.mkdirSync(path.join(ws, "src/screens"), { recursive: true });
    fs.writeFileSync(path.join(ws, "src/screens/BrandsScreen.tsx"), 'import X from "../sections/ListStacked";\nexport default X;\n');
    m = verifyManifest(ws, m);
    expect(lockedButMissing(m, "all")).toEqual([]);
  });

  it("counts a part App.tsx renders around every page (the app frame) as on each page", () => {
    const { app } = makeApp();
    const { ws } = makeProject(app, {
      "src/sections/LookupFrame.tsx": "export function LookupFrame() { return null; }\n",
      "src/screens/HomeScreen.tsx": "export default function HomeScreen() { return <main />; }\n",
      "src/App.tsx": 'import { LookupFrame } from "./sections/LookupFrame";\nexport default function App() { return <LookupFrame />; }\n',
    });
    const entry = entryFor("p.lookup-frame", "Home", "Top bar and navigation", "plan")!;
    expect(entry).toBeTruthy();
    const m = verifyManifest(ws, { entries: [entry], gaps: [], changes: [] }, undefined, { Home: "src/screens/HomeScreen.tsx" });
    expect(m.entries[0]!.verification?.onPage).toBe(true);
    expect(lockedButMissing(m, ["Home"])).toEqual([]);
  });

  it("the builders' tool records a change with its reason and refuses an invented part", async () => {
    const { app } = makeApp();
    const { project, jail } = makeProject(app);
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Brands", constraints: [], attachedKnowledgeIds: [] });
    const task = { id: "t1", runId: run.id, title: DESIGN_SCREENS, objective: "", role: "coder", status: "running", attempts: 1, expectedPaths: [], actualPaths: [], acceptanceCriteria: [], dependsOn: [], ordinal: 1, verification: [] } as unknown as Task;
    const got: unknown[] = [];
    const dispatch = createDispatcher({ project, run, task, jail, ops: app.ops, runner: app.runner, approvals: app.approvals, preflight: () => undefined, refreshPreflight: () => app.projects.preflight(project.id), signal: new AbortController().signal, onPathsChanged: () => undefined, onAwaitingApproval: () => undefined, phase: "implementation", onLayoutChange: (c) => (got.push(c), "Recorded") });
    expect((await dispatch("propose_layout_change", { page: "Brands", section: "Hero", change: "replace", replacement: "c.made-up", why: "The hero doesn't fit a list" }, undefined, "a")).ok).toBe(false);
    expect((await dispatch("propose_layout_change", { page: "Brands", section: "Hero", change: "remove", why: "short" }, undefined, "b")).ok).toBe(false);
    const ok = await dispatch("propose_layout_change", { page: "Brands", section: "Hero", change: "replace", replacement: "c.search.bar", why: "People come to find a brand, not to read a welcome" }, undefined, "c");
    expect(ok.ok).toBe(true);
    expect(got).toEqual([expect.objectContaining({ change: "replace", ref: "c.search.bar" })]);
    expect(ROLE_TOOLS.coder).toContain("propose_layout_change");
    expect(ROLE_TOOLS.planner).not.toContain("propose_layout_change");
  });

  it("design steps working from screen briefs get the page-composition skill", () => {
    expect(BUILTIN_SKILLS.some((s) => s.id === "skill.page-composition")).toBe(true);
    expect(workflowSkillIds("coder", "Design the screens. Screen briefs (locked: ...)")).toEqual(["skill.page-composition"]);
  });
});

describe("the Pages view", () => {
  it("shows each page's type, sections with their parts and status, findings and layout changes", async () => {
    const { projectPages } = await import("../src/quality/pagePlans.js");
    const { app } = makeApp();
    const { project, ws } = makeProject(app, { "src/sections/ListStacked.tsx": "export default function X() { return null; }\n", "src/screens/BrandsScreen.tsx": 'import X from "../sections/ListStacked";\nexport default X;\n' });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Brands", constraints: [], attachedKnowledgeIds: [] });
    app.store.setSetting(`screenPlan:${run.id}`, { product: "Brands", screens: [{ id: "brands", label: "Brands", component: "BrandsScreen", file: "src/screens/BrandsScreen.tsx", purpose: "Find a brand" }] });
    app.store.setSetting(`screenBrief:${run.id}`, [{ screen: "Brands", pageType: "list", who: "Shoppers", goal: "Find a brand", workflow: [], firstView: "The list", primaryAction: "Open one", sections: [{ title: "Results", purpose: "The brands", part: "p.filterable-list" }, { title: "Hero", purpose: "Welcome", part: "" }, { title: "Empty", purpose: "Nothing found", part: "c.empty-state" }] }]);
    app.store.setSetting(`composition:${run.id}`, {
      entries: [entryFor("p.filterable-list", "Brands", "Results", "plan")!, entryFor("c.empty-state", "Brands", "Empty", "plan")!],
      gaps: [{ page: "Brands", section: "Hero", reason: "b.hero-split belongs on marketing pages" }],
      changes: [{ page: "Brands", section: "Empty", change: "remove", why: "The sample data always has brands", by: "Design the screens", at: "now" }],
    });
    const view = projectPages(app, project.id);
    expect(view.runId).toBe(run.id);
    const p = view.pages[0]!;
    expect(p.type?.label).toBe("List");
    expect(p.sections.map((s) => [s.title, s.status])).toEqual([["Results", "used"], ["Hero", "no part"], ["Empty", "changed"]]);
    expect(p.findings).toEqual(["Hero: b.hero-split belongs on marketing pages"]);
    expect(p.changes[0]).toEqual(expect.objectContaining({ change: "remove", why: "The sample data always has brands" }));
    expect(p.states).toEqual(expect.arrayContaining(["no matches for the search or filters"]));
    void ws;
  });
});

describe("used on the page, and the release boundary", () => {
  it("counts a part as used only when the page's own file uses it, not when the starter kit imports it", () => {
    const { app } = makeApp();
    const { ws } = makeProject(app, {
      "src/sections/EmptyStates.tsx": "export function EmptyState() { return null; }\n",
      "src/components/ui/index.tsx": 'export { EmptyState } from "../sections/EmptyStates";\n',
      "src/screens/HomeScreen.tsx": "export default function Home() { return null; }\n",
      "src/screens/DetailScreen.tsx": 'import { EmptyState } from "../components/ui";\nexport default function D() { return <EmptyState title="x" />; }\n',
    });
    const e1 = entryFor("c.empty-state", "Home", "Nothing yet", "plan")!;
    const e2 = entryFor("c.empty-state", "Detail", "Missing", "plan")!;
    const m = verifyManifest(ws, { entries: [e1, e2], gaps: [] }, undefined, { Home: "src/screens/HomeScreen.tsx", Detail: "src/screens/DetailScreen.tsx" });
    expect(m.entries.map((e) => [e.page, e.verification?.usedBy.length, e.verification?.onPage])).toEqual([["Home", 1, false], ["Detail", 1, true]]);
    expect(lockedButMissing(m, "all").map((e) => e.page)).toEqual(["Home"]);
  });

  it("tells the planners what this release leaves out", async () => {
    const { releaseBoundary } = await import("../src/orchestrator/experienceMap.js");
    const text = releaseBoundary([{ id: "a", title: "Filter by category", later: "Should have later" }, { id: "b", title: "Brand list" }] as never[]);
    expect(text).toMatch(/^Not in this release/);
    expect(text).toContain("- Filter by category");
    expect(text).not.toContain("Brand list");
  });
});
