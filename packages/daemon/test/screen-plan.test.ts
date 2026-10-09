/**
 * The app's screens are decided once (NOBIO build: one screen named five ways, and a layout step that read for three
 * attempts and stopped). FlowCode derives the files and writes the layout itself.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { layoutFiles, parseScreenPlan, screenPlanNote, writesLayout } from "../src/orchestrator/screenPlan.js";
import { PathJail } from "../src/security/pathJail.js";

describe("the app's screens, decided once", () => {
  it("derives ids, components and files, and drops repeats and the word 'screen'", () => {
    const plan = parseScreenPlan({ product: "NOBIO", screens: [{ name: "Brands", purpose: "Browse non-GMO brands." }, { name: "brands", purpose: "again" }, { name: "Shopping list screen", purpose: "Keep brands to buy." }, { name: "", purpose: "x" }] })!;
    expect(plan.screens.map((s) => [s.id, s.label, s.file])).toEqual([
      ["brands", "Brands", "src/screens/BrandsScreen.tsx"],
      ["shopping-list", "Shopping list", "src/screens/ShoppingListScreen.tsx"],
    ]);
    expect(screenPlanNote(plan)).toMatch(/src\/screens\/BrandsScreen\.tsx: Brands, Browse non-GMO brands\./);
    expect(parseScreenPlan({ product: "X", screens: [] })).toBeUndefined();
  });

  it("writes App.tsx with the app shell and one file per screen", () => {
    const plan = parseScreenPlan({ product: "NOBIO", screens: [{ name: "Brands", purpose: "Browse brands." }, { name: "Shopping list", purpose: "Keep brands to buy." }] })!;
    const [app, ...screens] = layoutFiles(plan);
    expect(app!.path).toBe("src/App.tsx");
    expect(app!.content).toContain('<AppShell name="NOBIO" screens={SCREENS} current={current} onNavigate={go}>');
    expect(app!.content).toContain('{current === "shopping-list" ? <ShoppingListScreen /> : null}');
    expect(screens.map((s) => s.path)).toEqual(["src/screens/BrandsScreen.tsx", "src/screens/ShoppingListScreen.tsx"]);
    expect(screens[0]!.content).toContain('<PageHeader title="Brands" description="Browse brands." />');
  });

  it("is written by FlowCode only over the starter's App, with no screens yet", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-screens-"));
    const put = (rel: string, text: string) => (fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }), fs.writeFileSync(path.join(root, rel), text));
    put("src/components/ui/index.tsx", "export function AppShell() {}");
    put("src/lib/screens.ts", "export function useScreen() {}");
    put("src/App.tsx", "export default function App() { return null; }");
    const plan = parseScreenPlan({ product: "X", screens: [{ name: "Home", purpose: "Start." }] });
    const jail = new PathJail(root);
    expect(writesLayout(plan, jail)).toBe(true);
    expect(writesLayout(undefined, jail)).toBe(false);
    put("src/screens/Ready.tsx", "export default function Ready() { return null; }");
    expect(writesLayout(plan, jail)).toBe(false);
  });
});

describe("a role on a model too big for this computer's GPU", () => {
  it("is named, with the planner's, coder's or debugger's faster model as the suggestion", async () => {
    const { slowRoles } = await import("../src/models/modelPerformance.js");
    const local = (model: string) => ({ providerId: "ollama", model });
    const speeds = new Map([["qwen3:14b", 9.4], ["qwen3-coder:30b", 35.7], ["qwen2.5vl:3b", 112]]);
    const slow = slowRoles({ planner: local("qwen3-coder:30b"), coder: local("qwen3-coder:30b"), reviewer: local("qwen3:14b"), critic: local("qwen2.5vl:3b") }, speeds);
    expect(slow).toEqual([{ role: "reviewer", model: "qwen3:14b", tokPerSec: 9.4, faster: "qwen3-coder:30b", fasterTokPerSec: 35.7 }]);
    expect(slowRoles({ planner: local("qwen3:14b"), coder: local("qwen3:14b") }, speeds)).toEqual([]);
  });
});

describe("actions named as screens", () => {
  it("fold into the screen they act on (NOBIO: filter, search, sort and detail screens for one list)", () => {
    const plan = parseScreenPlan({ product: "NOBIO", screens: ["Brands List", "Brand Detail", "Filter Brands", "Search Brands", "Shopping list", "Event Creation"].map((name) => ({ name, purpose: "x" })) })!;
    expect(plan.screens.map((s) => s.label)).toEqual(["Brands List", "Shopping list", "Event Creation"]);
  });
});
