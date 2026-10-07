/** replace_file: a much shorter rewrite is allowed when it removes a pasted second copy of the code. */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { duplicateDeclarations, parseErrors } from "../src/workspace/operations.js";
import { makeApp, makeProject } from "./helpers.js";

const APP = (n: number) => `import { AppShell } from "./components/ui";\n// ${"x".repeat(n)}\nexport default function App() {\n  return <AppShell name="A" screens={[]} current="" onNavigate={() => {}}>hi</AppShell>;\n}\n`;

describe("rewriting a file this run made, or one that doesn't parse", () => {
  const LONG = `${"// layout notes\n".repeat(120)}export default function Screen() {\n  return <div>sample</div>;\n}\n`;
  const SHORT = `export default function CalendarScreen() {\n  return <h1>Calendar</h1>;\n}\n`;

  it("lets a much shorter file replace one this run created (a copied-in layout)", () => {
    const { app } = makeApp();
    const { project, jail } = makeProject(app, { "README.md": "x\n" });
    const ctx = { jail, projectId: project.id, runId: "r1", approved: true };
    expect(app.ops.create_file(ctx, { path: "src/screens/CalendarScreen.tsx", content: LONG, reason: "layout" }).ok).toBe(true);
    expect(app.ops.replace_file(ctx, { path: "src/screens/CalendarScreen.tsx", content: SHORT, reason: "the real screen" }).ok).toBe(true);
    // Another run (the file was there before it) still gets the cut-off protection.
    const other = { ...ctx, runId: "r2" };
    app.ops.replace_file(ctx, { path: "src/screens/CalendarScreen.tsx", content: LONG, reason: "back" });
    expect(app.ops.replace_file(other, { path: "src/screens/CalendarScreen.tsx", content: SHORT, reason: "fix" }).message).toMatch(/looks cut off/);
  });

  it("lets a broken file (it doesn't parse) be replaced by a much shorter one", () => {
    const { app } = makeApp();
    const { project, jail } = makeProject(app, { "src/Broken.tsx": `/* unclosed comment\n${LONG}` });
    expect(parseErrors("src/Broken.tsx", fs.readFileSync(path.join(jail.root, "src/Broken.tsx"), "utf8"))).toBeGreaterThan(0);
    expect(app.ops.replace_file({ jail, projectId: project.id, runId: "r", approved: true }, { path: "src/Broken.tsx", content: SHORT, reason: "fix" }).ok).toBe(true);
  });
});

describe("rewriting a file with duplicated code", () => {
  it("finds a second copy of a declaration or import", () => {
    expect(duplicateDeclarations(APP(10) + APP(10))).toBe('import { AppShell } from "./components/ui";');
    expect(duplicateDeclarations(APP(10))).toBeUndefined();
  });

  it("lets the clean, much shorter file replace the duplicated one, but still refuses a cut-off rewrite", () => {
    const { app } = makeApp();
    const doubled = APP(800) + APP(800);
    const { project, jail } = makeProject(app, { "src/App.tsx": doubled, "src/Other.tsx": `${"// note\n".repeat(300)}export const x = 1;\n` });
    const ctx = { jail, projectId: project.id, runId: "r", approved: true };
    const ok = app.ops.replace_file(ctx, { path: "src/App.tsx", content: APP(10), reason: "fix App" });
    expect(ok.ok).toBe(true);
    expect(fs.readFileSync(path.join(jail.root, "src/App.tsx"), "utf8")).toBe(APP(10));
    const cut = app.ops.replace_file(ctx, { path: "src/Other.tsx", content: "export const x = 1;\n", reason: "fix" });
    expect(cut.ok).toBe(false);
    expect(cut.message).toMatch(/looks cut off/);
  });
});
