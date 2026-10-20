/**
 * The Look's gradient: one gradient from the primary (to the secondary, the tertiary or a lighter primary, at an angle)
 * and where the app uses it. Buttons and the page background are tokens; page titles and feature panels are a managed
 * block of rules in components.css, removed when neither is used. Older apps get the --gradient token added.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BASE_APPEARANCE, appearanceChecks, appearanceTokens, gradientOf, type Appearance } from "@flowcode/contracts";
import { applySelected, saveDraft, selectDraft } from "../src/workspace/designState.js";
import { gradientRules } from "../src/workspace/gradientStyle.js";
import { makeApp, makeProject } from "./helpers.js";

const RECORDED = path.resolve(import.meta.dirname, "../../../.flowcode-data/workspaces/clean-cart-slice-eval-1-9b1947");
const source = () => {
  const files: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(RECORDED, dir), { withFileTypes: true })) {
      const rel = path.posix.join(dir, e.name);
      if (e.isDirectory()) walk(rel);
      else files[rel] = fs.readFileSync(path.join(RECORDED, rel), "utf8");
    }
  };
  walk("src");
  return files;
};
const LOOK: Appearance = { ...BASE_APPEARANCE, primary: "#a82fd3", secondary: "#39154c" };

describe("the Look's gradient", () => {
  it("reads the older switch as the main button only", () => {
    expect(gradientOf({ ...LOOK, gradient: true })).toEqual({ to: "secondary", angle: 135, uses: ["buttons"] });
    expect(gradientOf({ ...BASE_APPEARANCE, gradient: true })?.to).toBe("lighter");
    expect(gradientOf(LOOK)).toBeUndefined();
  });

  it("sets a token per use, and leaves the surface style's own values for the uses that are off", () => {
    const off = appearanceTokens(LOOK);
    expect(off["--gradient"]).toBe("none");
    expect(off["--accent-bg"]).toBe("var(--color-accent)");
    const t = appearanceTokens({ ...LOOK, gradient: { to: "secondary", angle: 90, uses: ["background"] } });
    expect(t["--gradient"]).toMatch(/^linear-gradient\(90deg, #[0-9a-f]{6}, #39154c\)$/);
    expect(t["--page-backdrop"]).toContain("linear-gradient(90deg");
    expect(t["--accent-bg"]).toBe("var(--color-accent)");
    // No tertiary yet: a lighter primary, never an empty stop.
    expect(appearanceTokens({ ...LOOK, gradient: { to: "tertiary", angle: 135, uses: ["buttons"] } })["--accent-bg"]).toMatch(/linear-gradient\(135deg, #[0-9a-f]{6}, #[0-9a-f]{6}\)/);
  });

  it("checks the text it carries: button and panel text on its end, gradient titles on the page", () => {
    const labels = (a: Appearance) => appearanceChecks(a).map((c) => c.label);
    expect(labels(LOOK)).not.toContain("Gradient page titles on the page");
    const all = labels({ ...LOOK, gradient: { to: "secondary", angle: 135, uses: ["panels", "headline"] } });
    expect(all).toContain("Button and panel text on the gradient's end");
    expect(all).toContain("Gradient page titles on the page");
  });

  it("writes rules only for page titles and feature panels", () => {
    expect(gradientRules({ ...LOOK, gradient: { to: "secondary", angle: 135, uses: ["buttons", "background"] } })).toBe("");
    const rules = gradientRules({ ...LOOK, gradient: { to: "secondary", angle: 135, uses: ["headline", "panels"] } });
    expect(rules).toContain("h1 { background-image: var(--gradient)");
    expect(rules).toContain(".fl-gradient-panel");
  });

  it("applies to an older app: adds --gradient, writes the rules, and takes them out again", () => {
    const { app } = makeApp();
    const { project, jail } = makeProject(app, source());
    const ctx = { projectId: project.id, runId: "design" };
    const restore = (id: string) => void app.snapshots.restore(id, jail);
    const read = (rel: string) => fs.readFileSync(path.join(jail.root, rel), "utf8");
    expect(read("src/styles/tokens.css")).not.toContain("--gradient:");

    saveDraft(app.store, project.id, { ...LOOK, gradient: { to: "secondary", angle: 135, uses: ["buttons", "headline"] } }, {}, jail);
    selectDraft(app.store, project.id, jail);
    expect(applySelected(app.store, project.id, jail, app.ops, ctx, restore).ok).toBe(true);
    expect(read("src/styles/tokens.css")).toMatch(/--gradient: linear-gradient\(135deg/);
    expect(read("src/styles/tokens.css")).toMatch(/--accent-bg: linear-gradient\(135deg/);
    expect(read("src/styles/components.css")).toContain("FlowCode gradient uses");

    saveDraft(app.store, project.id, LOOK, {}, jail);
    selectDraft(app.store, project.id, jail);
    expect(applySelected(app.store, project.id, jail, app.ops, ctx, restore).ok).toBe(true);
    expect(read("src/styles/tokens.css")).toContain("--gradient: none;");
    expect(read("src/styles/components.css")).not.toContain("FlowCode gradient uses");
  });
});
