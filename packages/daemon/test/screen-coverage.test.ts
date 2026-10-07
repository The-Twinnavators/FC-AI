/**
 * Screens and design coverage: a broad polish pass doesn't count as designing a screen, two tabs that show and search the
 * same data are flagged (not merged), and saved screen specs reach the design steps that touch those screens.
 */
import { describe, expect, it } from "vitest";
import { saveScreenSpec, screenCoverage, screenSpecBrief, type ScreenSpec } from "../src/quality/screenCoverage.js";
import { makeApp, makeProject } from "./helpers.js";

const APP = `import HomeScreen from "./screens/HomeScreen";
import BrandsScreen from "./screens/BrandsScreen";
const SCREENS = [
  { id: "home", label: "Find brands" },
  { id: "brands", label: "Brand list" },
];
export default function App() {
  return <>{current === "brands" ? <BrandsScreen /> : null}{current === "home" ? <HomeScreen /> : null}</>;
}`;
const LIST = (extra: string) => `import { brands, useCollection } from "../sim";
export default function S() { const all = useCollection(brands); const [search] = useState(""); return <ul>{all.map((b) => <li>{b.name}</li>)}</ul>; ${extra} }`;

function setup() {
  const { app } = makeApp();
  const { project } = makeProject(app, {
    "src/App.tsx": APP,
    "src/screens/HomeScreen.tsx": LIST("// home"),
    "src/screens/BrandsScreen.tsx": LIST("// list"),
    "src/screens/BrandDetailsScreen.tsx": "export default function D() { return <article />; }",
  });
  const run = app.orchestrator.createRun({ projectId: project.id, objective: "Brands", constraints: [], attachedKnowledgeIds: [] });
  const task = (id: string, title: string, paths: string[]) => app.store.tasks.upsert({ id, runId: run.id, title, objective: title, status: "verified", dependsOn: [], expectedPaths: paths, actualPaths: [], acceptanceCriteria: [], validationPlan: { kinds: [] }, role: "coder", ordinal: 0, attempts: 1 });
  task("t1", "Design HomeScreen layout", ["src/screens/HomeScreen.tsx"]);
  task("t2", "Design polish", ["src/screens/HomeScreen.tsx", "src/screens/BrandsScreen.tsx", "src/screens/BrandDetailsScreen.tsx"]);
  return { app, project };
}

describe("screen coverage", () => {
  it("counts only dedicated design steps, and lists screens opened from other screens", () => {
    const { app, project } = setup();
    const c = screenCoverage(app, project.id);
    expect(c.screens.map((s) => s.id)).toEqual(["home", "brands", "BrandDetailsScreen"]);
    expect(c.screens.find((s) => s.id === "BrandDetailsScreen")?.inNav).toBe(false);
    expect(c.uncovered).toEqual(["Brand list", "Brand Details"]);
  });

  it("flags two tabs that show and search the same data, without merging them", () => {
    const { app, project } = setup();
    const c = screenCoverage(app, project.id);
    expect(c.similar).toHaveLength(1);
    expect(c.similar[0]).toMatchObject({ a: "Find brands", b: "Brand list" });
    expect(c.similar[0].why).toMatch(/same data \(brands\)/);
  });

  it("gives saved specs to the design steps that touch those screens, and counts the screen as covered", () => {
    const { app, project } = setup();
    const spec: ScreenSpec = { screenId: "BrandDetailsScreen", goal: "Decide if a brand is safe to buy", primaryAction: "Save the brand", hierarchy: ["Name and certification", "Products"], layout: "Two columns", responsive: "Stacks", components: ["Card"], tokens: ["--color-primary"], copy: ["Certified non-GMO"], data: "brands", states: { loading: "Skeleton", empty: "No products", error: "Retry" }, accessibility: ["Heading order"], icons: "Lucide", acceptance: ["Shows certification"], source: "test", updatedAt: new Date().toISOString() };
    saveScreenSpec(app, project.id, spec);
    expect(screenCoverage(app, project.id).uncovered).toEqual(["Brand list"]);
    expect(screenSpecBrief(app, project.id, "Design the BrandDetailsScreen")).toMatch(/Goal: Decide if a brand is safe to buy/);
    expect(screenSpecBrief(app, project.id, "Design the settings screen")).toBeUndefined();
  });
});
