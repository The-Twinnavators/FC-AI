/** Styles tab → Surface: switching an existing app's surface style, including apps made before surface tokens. */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { setSurfaceStyle, surfaceStyleOf } from "../src/workspace/surfaceStyle.js";
import { makeApp, makeProject } from "./helpers.js";

const OLD_TOKENS = ":root {\n  --color-bg: #f4efe6;\n  --color-surface: #fffdf8;\n  --color-text: #1e2421;\n  --border-width: 1px;\n}\n";
const OLD_COMPONENTS = ".ui-card { border: var(--border-width) solid var(--color-border); }\n";
const MAIN = 'import "./styles/tokens.css";\nimport "./styles/components.css";\nimport App from "./App";\n';

describe("changing an existing app's surface style", () => {
  it("upgrades an older app, applies the style, and undoes cleanly", () => {
    const { app } = makeApp();
    const { project, jail } = makeProject(app, {
      "src/styles/tokens.css": OLD_TOKENS,
      "src/styles/components.css": OLD_COMPONENTS,
      "src/components/ui/index.tsx": "export {};\n",
      "src/main.tsx": MAIN,
    });
    expect(surfaceStyleOf(jail)).toMatchObject({ supported: true, current: undefined });
    expect(surfaceStyleOf(jail).colors["--color-surface"]).toBe("#fffdf8");

    const r = setSurfaceStyle(jail, app.ops, { projectId: project.id, runId: "style_test" }, "neobrutalism");
    expect(r.changed.sort()).toEqual(["src/main.tsx", "src/styles/surfaces.css", "src/styles/tokens.css"]);
    const tokens = fs.readFileSync(path.join(jail.root, "src/styles/tokens.css"), "utf8");
    expect(tokens).toContain("--surface-border: 3px solid var(--color-text);");
    expect(tokens).toContain("--color-surface: #fffdf8;");
    expect(fs.readFileSync(path.join(jail.root, "src/main.tsx"), "utf8")).toContain('import "./styles/surfaces.css";');
    expect(surfaceStyleOf(jail).current).toBe("neobrutalism");

    // A second change only rewrites the tokens.
    const r2 = setSurfaceStyle(jail, app.ops, { projectId: project.id, runId: "style_test" }, "glass");
    expect(r2.changed).toEqual(["src/styles/tokens.css"]);
    expect(surfaceStyleOf(jail).current).toBe("glass");

    for (const id of [...r2.snapshotIds].reverse()) app.snapshots.restore(id, jail);
    for (const id of [...r.snapshotIds].reverse()) app.snapshots.restore(id, jail);
    expect(fs.readFileSync(path.join(jail.root, "src/styles/tokens.css"), "utf8")).toBe(OLD_TOKENS);
    expect(fs.readFileSync(path.join(jail.root, "src/main.tsx"), "utf8")).toBe(MAIN);
    expect(fs.existsSync(path.join(jail.root, "src/styles/surfaces.css"))).toBe(false);
  });

  it("explains when an app can't use surface styles", () => {
    const { app } = makeApp();
    const { jail } = makeProject(app, { "src/styles/tokens.css": OLD_TOKENS });
    expect(surfaceStyleOf(jail)).toMatchObject({ supported: false });
    expect(surfaceStyleOf(jail).reason).toMatch(/building blocks/);
  });
});
