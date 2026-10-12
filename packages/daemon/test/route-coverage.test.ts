import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { routeCoverage, unfilledSlots } from "../src/quality/routeCoverage.js";
import type { ScreenPlan } from "../src/orchestrator/screenPlan.js";

const plan: ScreenPlan = {
  product: "Classes",
  screens: [
    { id: "classes", label: "Classes", component: "ClassesScreen", file: "src/screens/ClassesScreen.tsx", purpose: "Browse" },
    { id: "class-detail", label: "Class detail", component: "ClassDetailScreen", file: "src/screens/ClassDetailScreen.tsx", purpose: "One class" },
    { id: "account", label: "Account", component: "AccountScreen", file: "src/screens/AccountScreen.tsx", purpose: "Settings" },
  ],
};

function app(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "routes-"));
  for (const [f, c] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), c);
  }
  return root;
}

const APP = `const SCREENS = [{ id: "classes", label: "Classes" }, { id: "class-detail", label: "Class detail", hidden: true, parent: "classes" }];`;

describe("route coverage", () => {
  it("finds planned pages missing from the navigation, detail pages nothing links to, and empty laid-out sections", () => {
    const root = app({
      "src/App.tsx": APP,
      "src/screens/ClassesScreen.tsx": `export default function ClassesScreen() {\n  return (\n    <main>\n      {/* 1. Today: classes today */}\n      <List />\n      {/* 2. Filters: narrow down Build it with c.chip */}\n    </main>\n  );\n}`,
      "src/screens/ClassDetailScreen.tsx": `export default function ClassDetailScreen() { return <main />; }`,
    });
    const r = routeCoverage(root, plan);
    expect(r.missing).toEqual(["Account"]);
    expect(r.unlinked).toEqual(["Class detail"]);
    expect(r.unfilled).toEqual(["Classes: Filters"]);
    expect(r.status).toBe("failed");
  });

  it("passes when every page is in the app, the detail page is linked and every section is built", () => {
    const root = app({
      "src/App.tsx": APP.replace("];", `, { id: "account", label: "Account" }];`),
      "src/screens/ClassesScreen.tsx": `import { linkTo } from "../lib/screens";\nexport default function ClassesScreen() {\n  return (\n    <main>\n      {/* 1. Today: classes today */}\n      <a href={linkTo("class-detail", "c1")}>Yoga</a>\n    </main>\n  );\n}`,
    });
    expect(routeCoverage(root, plan)).toEqual(expect.objectContaining({ status: "passed", missing: [], unlinked: [], unfilled: [] }));
  });

  it("an unfilled slot is a numbered section comment with nothing under it", () => {
    expect(unfilledSlots(`{/* 1. Hero: first view */}\n<Hero />\n{/* 2. List: items */}\n</main>`)).toEqual(["List"]);
  });
});
