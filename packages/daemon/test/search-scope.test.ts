/** search_code's glob: folders and bare file patterns cover what an agent means (Calendar test 5). */
import { describe, expect, it } from "vitest";
import { searchScope, searchWorkspace } from "../src/workspace/fileService.js";
import { makeApp, makeProject } from "./helpers.js";

describe("search scope", () => {
  it("treats a glob without wildcards as a folder or a file", () => {
    const inUi = searchScope("src/components/ui");
    expect(inUi("src/components/ui/index.tsx")).toBe(true);
    expect(inUi("src/components/ui/screen-parts.tsx")).toBe(true);
    expect(inUi("src/components/uix/x.tsx")).toBe(false);
    expect(searchScope("src/components/ui/")("src/components/ui/index.tsx")).toBe(true);
    expect(searchScope("./src/App.tsx")("src/App.tsx")).toBe(true);
    expect(searchScope("src\\components\\ui")("src/components/ui/index.tsx")).toBe(true);
  });

  it("matches a bare file pattern at any depth, and keeps path globs as they are", () => {
    expect(searchScope("*.tsx")("src/screens/Home.tsx")).toBe(true);
    expect(searchScope("*.tsx")("src/styles/app.css")).toBe(false);
    expect(searchScope("src/**/*.css")("src/styles/app.css")).toBe(true);
    expect(searchScope("src/*.tsx")("src/screens/Home.tsx")).toBe(false);
    expect(searchScope(undefined)("anything")).toBe(true);
  });

  it("finds the building blocks when the agent searches the ui folder", () => {
    const { app } = makeApp();
    const { jail } = makeProject(app, { "src/components/ui/index.tsx": "export function AppShell() { return null; }\n", "src/App.tsx": "export default 1;\n" });
    expect(searchWorkspace(jail, "AppShell", { glob: "src/components/ui" }).map((h) => h.path)).toEqual(["src/components/ui/index.tsx"]);
  });
});
