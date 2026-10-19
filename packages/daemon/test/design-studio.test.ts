/** Styles → Design: the studio writes tokens for one theme, manages the web-font import, and remembers picked blocks. */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyComponentStyle, applyDesign, applyPalette, componentStylesOf, designBrief, designComponents, paletteOf, setDesignComponents, tokenValues } from "../src/workspace/designStudio.js";
import { withDarkTheme } from "../src/workspace/darkTheme.js";
import { makeApp, makeProject } from "./helpers.js";

const TOKENS = `:root {\n  --color-text: #1e2421;\n  --font-sans: system-ui, sans-serif;\n  --text-md: 1rem;\n  --radius-xl: 10px;\n}\n\n@media (prefers-color-scheme: dark) {\n  :root {\n    --color-text: #ece6da;\n  }\n}\n`;

describe("design studio", () => {
  it("writes the chosen theme, falls back to shared tokens, loads web fonts and undoes", () => {
    const { app } = makeApp();
    const { project, jail } = makeProject(app, { "src/styles/tokens.css": TOKENS });
    const ctx = { projectId: project.id, runId: "style_test" };
    const read = () => fs.readFileSync(path.join(jail.root, "src/styles/tokens.css"), "utf8");

    // Dark: the colour changes inside the dark block; the radius (only defined once) changes in :root.
    const r = applyDesign(jail, app.ops, ctx, { theme: "dark", values: { "--color-text": "#ffffff", "--radius-xl": "6px" } });
    expect(r.changed.sort()).toEqual(["--color-text", "--radius-xl"]);
    expect(read()).toContain("--color-text: #1e2421;");
    expect(read()).toContain("    --color-text: #ffffff;");
    expect(read()).toContain("--radius-xl: 6px;");

    // A Google font adds one managed import at the top; changing fonts replaces it rather than stacking imports.
    applyDesign(jail, app.ops, ctx, { theme: "default", values: { "--font-sans": '"Inter", system-ui, sans-serif' }, googleFonts: ["Inter"] });
    const f2 = applyDesign(jail, app.ops, ctx, { theme: "default", values: { "--font-sans": '"Manrope", system-ui, sans-serif' }, googleFonts: ["Manrope"] });
    expect(read().match(/FlowCode fonts/g)).toHaveLength(1);
    expect(read().split("\n")[0]).toContain("family=Manrope");
    expect(f2.changed).toContain("fonts");

    expect(() => applyDesign(jail, app.ops, ctx, { theme: "default", values: { "--text-md": "Georgia" } })).toThrow(/is a size/);
    expect(() => applyDesign(jail, app.ops, ctx, { theme: "default", values: { "--color-text": "var(--color-text)" } })).toThrow(/itself/);

    app.snapshots.restore(r.snapshotId!, jail);
    expect(read()).toBe(TOKENS);
  });

  it("saves a palette: ramps in one managed block, light and dark colour roles, all undone together", () => {
    const { app } = makeApp();
    const tokens = `:root {\n  --color-bg: #ffffff;\n  --color-text: #111111;\n  --color-accent: #24423a;\n  --color-on-accent: #ffffff;\n}\n\n@media (prefers-color-scheme: dark) {\n  :root {\n    --color-accent: #9cc7b4;\n  }\n}\n`;
    const { project, jail } = makeProject(app, { "src/styles/tokens.css": tokens });
    const read = () => fs.readFileSync(path.join(jail.root, "src/styles/tokens.css"), "utf8");
    expect(paletteOf(jail)).toEqual({ config: { brand: [{ hex: "#24423a", role: "primary" }], neutral: "brand" }, saved: false });

    const r = applyPalette(jail, app.ops, { projectId: project.id, runId: "style_test" }, { brand: [{ hex: "#9810fa", role: "primary" }, { hex: "#71f245", role: "secondary" }] });
    const css = read();
    expect(css).toContain("--brand-primary-500:");
    expect(css).toContain("--brand-secondary-900:");
    expect(css).toContain("--neutral-50:");
    expect(css).toContain("--status-error-600:");
    expect(css).toMatch(/--color-accent: #9810fa;/);
    // The dark theme gets a lighter accent from the same ramp, not the light one.
    expect(css).not.toMatch(/--color-accent: #9cc7b4;/);
    expect(r.palette.brand).toHaveLength(2);
    expect(paletteOf(jail).saved).toBe(true);

    // Saving again replaces the block instead of adding a second one.
    applyPalette(jail, app.ops, { projectId: project.id, runId: "style_test" }, { brand: [{ hex: "#0b5fff", role: "primary" }] });
    expect(read().match(/FlowCode palette: brand/g)).toHaveLength(1);
    expect(read()).not.toContain("--brand-secondary-500");

    app.snapshots.restore(r.snapshotId!, jail);
    expect(read()).toBe(tokens);
  });

  it("adds the newer control size tokens to an app made before them", () => {
    const { app } = makeApp();
    const { project, jail } = makeProject(app, { "src/styles/tokens.css": ":root {\n  --control-md: 2.75rem;\n}\n" });
    const r = applyDesign(jail, app.ops, { projectId: project.id, runId: "style_test" }, { theme: "default", values: { "--control-md": "2.5rem", "--control-xl": "3.5rem", "--control-pad-md": "1.25rem", "--not-a-control": "1px" } });
    const css = fs.readFileSync(path.join(jail.root, "src/styles/tokens.css"), "utf8");
    expect(css).toContain("--control-md: 2.5rem;");
    expect(css).toContain("--control-xl: 3.5rem;");
    expect(css).toContain("--control-pad-md: 1.25rem;");
    expect(css).not.toContain("--not-a-control");
    expect(r.changed).toContain("--control-xl");
  });

  it("rewrites FlowCode's dark theme from a new light accent, and leaves a hand-edited one alone", () => {
    const { app } = makeApp();
    const start = withDarkTheme(":root {\n  --color-bg: #ffffff;\n  --color-text: #111111;\n  --color-accent: #2563eb;\n}\n");
    const darkAccent = (css: string) => /:root\[data-theme="dark"\][\s\S]*?--color-accent: ([^;]+);/.exec(css)?.[1];
    const { project, jail } = makeProject(app, { "src/styles/tokens.css": start });
    const ctx = { projectId: project.id, runId: "style_test" };
    const read = () => fs.readFileSync(path.join(jail.root, "src/styles/tokens.css"), "utf8");
    const r = applyDesign(jail, app.ops, ctx, { theme: "default", values: { "--color-accent": "#a82fd3" } });
    expect(r.changed).toContain("dark theme");
    expect(darkAccent(read())).toBe(darkAccent(withDarkTheme(start.replace("#2563eb", "#a82fd3"))));
    expect(darkAccent(read())).not.toBe(darkAccent(start));

    // A dark accent set by hand stays when the light accent changes again.
    applyDesign(jail, app.ops, ctx, { theme: "dark", values: { "--color-accent": "#ffcc00" } });
    applyDesign(jail, app.ops, ctx, { theme: "default", values: { "--color-accent": "#19804d" } });
    expect(darkAccent(read())).toBe("#ffcc00");
  });

  it("writes a component's settings as one managed CSS block, replaced on each save and undone together", () => {
    const { app } = makeApp();
    const base = ".fl-btn {\n  border-radius: var(--radius-md);\n}\n";
    const { project, jail } = makeProject(app, { "src/styles/components.css": base });
    const ctx = { projectId: project.id, runId: "style_test" };
    const read = () => fs.readFileSync(path.join(jail.root, "src/styles/components.css"), "utf8");
    const r = applyComponentStyle(jail, app.ops, ctx, "fl-btn", { shape: "pill", weight: "bold", bogus: "x" });
    expect(read()).toContain(":root .fl-btn { border-radius: 999px; font-weight: var(--weight-bold); }");
    expect(componentStylesOf(jail)).toEqual({ "fl-btn": { shape: "pill", weight: "bold" } });
    // Size, on every component: the kit's text, space and control tokens scaled on that component only.
    applyComponentStyle(jail, app.ops, ctx, "fl-btn", { shape: "pill", weight: "bold", size: "large" });
    expect(read()).toContain(":root .fl-btn { font-size: 1.2em; --text-xs: 0.9rem;");
    expect(read()).toContain("--control-md: 3rem;");
    expect(read()).toContain(":root .fl-btn { border-radius: 999px; font-weight: var(--weight-bold); }");
    applyComponentStyle(jail, app.ops, ctx, "fl-ctl-alert", { size: "compact" });
    expect(read()).toContain(":root .fl-ctl-alert { font-size: 0.875em;");
    // A kit component with no options of its own can still be sized.
    applyComponentStyle(jail, app.ops, ctx, "fl-spec-empty", { size: "large" });
    expect(read()).toContain(":root .fl-spec-empty { font-size: 1.2em;");
    applyComponentStyle(jail, app.ops, ctx, "fl-ctl-alert", {});
    applyComponentStyle(jail, app.ops, ctx, "fl-spec-empty", {});
    applyComponentStyle(jail, app.ops, ctx, "fl-btn", { shape: "pill", weight: "bold" });
    applyComponentStyle(jail, app.ops, ctx, "fl-ctl-tabset", { variant: "pills" });
    expect(read().match(/FlowCode component settings \(/g)).toHaveLength(1);
    expect(read()).toContain(":root .fl-ctl-tabset .fl-spec-tab { border-radius: 999px; }");
    expect(read()).toContain(":root .fl-btn {");
    // Back to the kit's defaults for both: the block goes away.
    applyComponentStyle(jail, app.ops, ctx, "fl-btn", { shape: "rounded" });
    applyComponentStyle(jail, app.ops, ctx, "fl-ctl-tabset", {});
    expect(read()).toBe(base);
    expect(() => applyComponentStyle(jail, app.ops, ctx, "ui-nope", {})).toThrow(/no options/);
    app.snapshots.restore(r.snapshotId!, jail);
    expect(read()).toBe(base);
  });

  it("remembers the picked building blocks and tells the builder", () => {
    const { app } = makeApp();
    const { jail } = makeProject(app, { "src/styles/tokens.css": TOKENS });
    expect(designComponents(jail).components).toBeUndefined();
    // Nothing picked: the builder is still told what to build from. An empty brief dropped the step back to generic
    // guidance, and that is how a build came to write its own screens beside the library it was given.
    expect(designBrief(jail)).toMatch(/whole starter kit/);
    expect(designBrief(jail)).toMatch(/don.t make new ones/);
    const picked = setDesignComponents(jail, ["fl-btn", "fl-card", "ui-nope", "fl-btn"]);
    expect(picked.components).toEqual(["fl-btn", "fl-card"]);
    expect(designBrief(jail)).toMatch(/Button \(\.fl-btn\), Card \(\.fl-card\)/);
  });

  it("shows the Top Nav / App Bar pick as the app's top navigation, with its own settings", () => {
    // Calendar design rebuild: "Top Nav / App Bar" was added on the Styles page but never drawn, so the menu kept the kit's look.
    const { app } = makeApp();
    const { project, jail } = makeProject(app, { "src/styles/tokens.css": TOKENS, "src/styles/components.css": ".ui-shell__link {}\n" });
    expect(setDesignComponents(jail, ["fl-btn", "top-nav"]).components).toEqual(["fl-btn", "ui-shell"]);
    expect(designComponents(jail).catalogue.find((c) => c.block === "ui-shell")?.label).toBe("Top Nav / App Bar");
    expect(designBrief(jail)).toMatch(/Top Nav \/ App Bar \(\.ui-shell\)/);
    const read = () => fs.readFileSync(path.join(jail.root, "src/styles/components.css"), "utf8");
    applyComponentStyle(jail, app.ops, { projectId: project.id, runId: "style_test" }, "ui-shell", { bar: "brand", current: "pill" });
    expect(read()).toContain(":root .ui-shell__header { background: var(--color-accent); color: var(--color-on-accent)");
    expect(read()).toContain(':root .ui-shell__link[aria-current="page"] { box-shadow: none;');
  });
});

/**
 * Picking a ready-made design style overwrites the app's tokens, so the values it replaces are kept first and
 * "Custom" puts them back. Only the light theme's values are the app's look; the dark block is a variation of it.
 */
describe("the app's own look", () => {
  it("reads the named tokens, ignores the dark block and leaves out what is not defined", () => {
    const { app } = makeApp();
    const { jail } = makeProject(app, { "src/styles/tokens.css": TOKENS });
    expect(tokenValues(jail, ["--color-text", "--radius-xl", "--color-accent"])).toEqual({ "--color-text": "#1e2421", "--radius-xl": "10px" });
  });

  it("is empty when the app has no tokens to read", () => {
    const { app } = makeApp();
    const { jail } = makeProject(app, {});
    expect(tokenValues(jail, ["--color-text"])).toEqual({});
  });
});
