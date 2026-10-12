/**
 * Bringing the starter's kit to an older app also brings the catalog components it draws (src/sections/) and their
 * styles (src/styles/library.css, loaded from src/main.tsx), or the refreshed kit would import files the app lacks.
 * The app's own section files and library.css rules are never overwritten.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ADD_BLOCKS, REFRESH_BLOCKS, UPGRADE_STEPS, cssBlocks, kitLibraryPlan, mergeLibraryCss, refreshPaths } from "../src/orchestrator/upgradeSteps.js";

const starter = path.resolve(__dirname, "../../../templates/react-vite-starter");
const kitFiles = fs.readdirSync(path.join(starter, "src/sections")).map((f) => `src/sections/${f}`);
const kitCss = fs.readFileSync(path.join(starter, "src/styles/library.css"), "utf8");

const app = (files: Record<string, string>) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-kitlib-"));
  const all = { "package.json": JSON.stringify({ name: "flowcode-starter" }), "src/main.tsx": 'import "./styles/tokens.css";\nimport "./styles/app.css";\n', ...files };
  for (const [rel, text] of Object.entries(all)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return { root, jail: { root } as never };
};

// The governed file operations, reduced to writing the file.
const ops = (root: string) => {
  const put = (_c: unknown, a: { path: string; content: string }) => (fs.mkdirSync(path.dirname(path.join(root, a.path)), { recursive: true }), fs.writeFileSync(path.join(root, a.path), a.content), { ok: true });
  return { create_file: put, replace_file: put } as never;
};
const run = async (title: string, root: string) => {
  const jail = { root } as never;
  const out = await UPGRADE_STEPS[title]!({ deps: { ops: ops(root), bus: { emit: () => undefined } }, run: { projectId: "p", id: "r", planApproved: true }, task: { id: "t", title }, jail, onChanged: () => undefined } as never);
  return out;
};

describe("merging library.css", () => {
  it("reads top-level rules, including nested at-rules, and ignores braces in comments and strings", () => {
    const css = '/* a { b */\n.a { color: red; }\n@media (min-width: 40rem) { .b { content: "}"; } }\n@import "x.css";';
    expect(cssBlocks(css)).toEqual(['.a { color: red; }', '@media (min-width: 40rem) { .b { content: "}"; } }', '@import "x.css";']);
  });

  it("keeps the app's rules and adds only what the kit needs and it lacks", () => {
    const kit = ".fl-btn { color: red; }\n.fl-card { padding: 1rem; }\n";
    const mine = ".fl-btn { color: red; }\n.fl-mine { color: blue; }\n";
    const merged = mergeLibraryCss(mine, kit);
    expect(merged.startsWith(mine.trimEnd())).toBe(true);
    expect(merged).toContain(".fl-mine { color: blue; }");
    expect(merged).toContain(".fl-card { padding: 1rem; }");
    expect(merged.match(/\.fl-btn \{/g)).toHaveLength(1);
    // Nothing missing: untouched. Nothing there at all: the kit's.
    expect(mergeLibraryCss(`${kit}.fl-mine { color: blue; }\n`, kit)).toBe(`${kit}.fl-mine { color: blue; }\n`);
    expect(mergeLibraryCss(undefined, kit)).toBe(kit);
  });
});

describe("the kit comes with the library it draws", () => {
  it("plans the missing sections, the styles and the import after the tokens", () => {
    const { jail } = app({ "src/sections/ButtonsVariants.tsx": "// mine\n" });
    const plan = kitLibraryPlan(jail);
    expect([...plan.sections].sort()).toEqual(kitFiles.filter((f) => f !== "src/sections/ButtonsVariants.tsx").sort());
    expect(plan.css).toBe(kitCss);
    expect(plan.main).toBe('import "./styles/tokens.css";\nimport "./styles/library.css";\nimport "./styles/app.css";\n');
  });

  it("plans nothing for an app that has it all", () => {
    const files: Record<string, string> = { "src/styles/library.css": kitCss, "src/main.tsx": 'import "./styles/tokens.css";\nimport "./styles/library.css";\n' };
    for (const rel of kitFiles) files[rel] = fs.readFileSync(path.join(starter, rel), "utf8");
    expect(kitLibraryPlan(app(files).jail)).toEqual({ sections: [], css: undefined, main: undefined });
  });

  it("adding the building blocks to an app that has none adds sections, library.css and its import", async () => {
    const { root } = app({});
    const out = await run(ADD_BLOCKS, root);
    expect(out.kind).toBe("complete");
    for (const rel of kitFiles) expect(fs.existsSync(path.join(root, rel))).toBe(true);
    expect(fs.readFileSync(path.join(root, "src/styles/library.css"), "utf8")).toBe(kitCss);
    const main = fs.readFileSync(path.join(root, "src/main.tsx"), "utf8");
    expect(main).toContain('import "./styles/tokens.css";\nimport "./styles/library.css";');
    expect(main).toContain("components.css");
  });

  it("refreshing an old kit brings the library, keeping the app's sections and library.css rules", async () => {
    const current = fs.readFileSync(path.join(starter, "src/components/ui/index.tsx"), "utf8");
    const old = current.replace("{screens.filter((s) => !s.hidden).length > 1 ? (", "{true ? (");
    const { root, jail } = app({
      "src/components/ui/index.tsx": old,
      "src/sections/ButtonsVariants.tsx": "// the app's own Button\n",
      "src/styles/library.css": ".fl-mine { color: blue; }\n",
    });
    const paths = refreshPaths(jail);
    expect(paths).toEqual(expect.arrayContaining(["src/components/ui/index.tsx", "src/styles/library.css", "src/main.tsx", "src/sections/CardsVariants.tsx"]));
    expect(paths).not.toContain("src/sections/ButtonsVariants.tsx");
    const out = await run(REFRESH_BLOCKS, root);
    expect(out.kind).toBe("complete");
    expect(fs.readFileSync(path.join(root, "src/sections/ButtonsVariants.tsx"), "utf8")).toBe("// the app's own Button\n");
    expect(fs.existsSync(path.join(root, "src/sections/CardsVariants.tsx"))).toBe(true);
    const css = fs.readFileSync(path.join(root, "src/styles/library.css"), "utf8");
    expect(css.startsWith(".fl-mine { color: blue; }")).toBe(true);
    expect(css).toContain(".fl-btn {");
    expect(fs.readFileSync(path.join(root, "src/main.tsx"), "utf8")).toContain('import "./styles/library.css";');
  });

  it("leaves the library alone for an app without the kit", () => {
    const { jail } = app({});
    expect(refreshPaths(jail)).toEqual([]);
  });
});
