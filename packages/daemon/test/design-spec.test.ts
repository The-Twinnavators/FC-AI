/** The design spec (workspace/designSpec.ts): problems that stop it, deterministic tokens, and who implements what. */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyDesignSpec, specProblems, specRequirements, specTokens, type DesignSpec } from "../src/workspace/designSpec.js";
import { makeApp, makeProject } from "./helpers.js";
import { STYLE_VIBES } from "@flowcode/contracts";

const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "fixtures/design", name), "utf8")) as DesignSpec;
const A = fixture("spec-field-notes.json");
const B = fixture("spec-bold-aisle.json");
/** Fixture B is neo-brutalist on purpose (a contrasting regression): used here as an explicit, recorded exception. */
const ALL = STYLE_VIBES.map((v) => v.id);

describe("a design spec", () => {
  it("the two controlled fixtures have no problems", () => {
    expect(specProblems(A)).toEqual([]);
    expect(specProblems(B, ALL)).toEqual([]);
    // Without the exception, FlowCode doesn't use a neo-brutalist surface.
    expect(specProblems(B).join(" ")).toMatch(/Neo-brutalist surface style is used only when the person asks for it/);
  });

  it("refuses unbundled fonts, low contrast, corners over 12px and unknown surface styles", () => {
    const bad: DesignSpec = { ...A, typography: { ...A.typography, display: "Comic Sans MS" }, palette: { ...A.palette, textMuted: "#c9c0b0" }, surface: { vibe: "chrome", radii: [4, 8, 16, 24], borderWidth: 1 } };
    const p = specProblems(bad).join("\n");
    expect(p).toContain('display font "Comic Sans MS"');
    expect(p).toContain("muted text on the background");
    expect(p).toContain("corners over 12px");
    expect(p).toContain('surface style "chrome"');
    // A conflict between the surface style and the spec is reported, not silently resolved.
    expect(specProblems({ ...B, surface: { ...B.surface, borderWidth: 1 } }, ALL)).toEqual(["the neobrutalism surface style draws 3px outlines but the spec says 1px borders; choose one"]);
  });

  it("gives the same tokens for the same spec, and different typography, hierarchy, density, shape and palette for different specs", () => {
    expect(specTokens(A)).toEqual(specTokens(structuredClone(A)));
    const a = specTokens(A);
    const b = specTokens(B);
    for (const n of ["--font-display", "--font-sans", "--text-2xl", "--heading-weight", "--space-4", "--radius-lg", "--border-width", "--content-max", "--color-bg"]) expect(a[n], n).not.toBe(b[n]);
    // Hierarchy: the expressive scale steps up far more than the compact one.
    expect(parseFloat(a["--text-2xl"]!) / parseFloat(b["--text-2xl"]!)).toBeGreaterThan(1.9);
    // Density: airy spacing is 1.3x the base, compact 0.8x.
    expect(a["--space-4"]).toBe("1.3rem");
    expect(b["--space-4"]).toBe("0.8rem");
  });

  it("names who implements each requirement; composition, the signature and responsive changes are the coder's, never claimed as tokens", () => {
    const by = (s: DesignSpec) => Object.fromEntries(specRequirements(s).map((r) => [r.id, r.by]));
    expect(by(A)).toEqual({ "type-families": "tokens", "type-scale": "tokens", palette: "tokens", density: "tokens", shape: "tokens", surfaces: "tokens", "content-width": "tokens", "composition-1": "coder", signature: "coder", "responsive-1": "coder" });
    // Capital headings have no token: the coder's.
    expect(by(B)["heading-case"]).toBe("coder");
    for (const r of specRequirements(B).filter((r) => r.by === "coder")) expect(r.tokens).toBeUndefined();
  });

  it("applies through the app's tokens and surface style, lists bounded coder work, and marks tokens the app lacks as unsupported", () => {
    const { app } = makeApp();
    const tokens = ":root {\n  --color-bg: #ffffff;\n  --color-text: #000000;\n  --font-sans: Inter;\n  --font-display: Inter;\n  --border-width: 1px;\n}\n";
    const { project, jail } = makeProject(app, {
      "src/styles/tokens.css": tokens,
      "src/styles/components.css": ".ui-card { border: var(--surface-border); }\n",
      "src/components/ui/index.tsx": "export {};\n",
      "src/main.tsx": 'import "./styles/tokens.css";\nimport "./styles/components.css";\n',
    });
    const res = applyDesignSpec(jail, app.ops, { projectId: project.id, runId: "spec_test" }, B, { frameCss: "src/styles/components.css", screens: ["src/screens/SearchScreen.tsx", "src/screens/HomeScreen.tsx"], allowedSurfaces: ALL });
    const css = fs.readFileSync(path.join(jail.root, "src/styles/tokens.css"), "utf8");
    expect(css).toContain("--color-bg: #fff3c4;");
    expect(css).toContain('--font-display: "Oswald"');
    // The surface style went in first and the spec's heading weight overrides the style's own 800.
    expect(css).toContain("--surface-shadow: 6px 6px 0 var(--color-text);");
    expect(css).toContain("--heading-weight: 600;");
    expect(res.humanApproval).toBe("pending");
    // Spacing tokens aren't declared in this app: density is unsupported here, not silently "applied".
    expect(res.requirements.find((r) => r.id === "density")).toMatchObject({ by: "unsupported" });
    expect(res.missing).toContain("--space-4");
    // Coder work names its files: the Search change goes to the Search screen, the rest to the frame stylesheet.
    expect(res.coderWork).toEqual([
      { requirement: "heading-case", statement: "Headings in capitals, tracked", files: ["src/styles/components.css"] },
      { requirement: "composition-1", statement: "Search: Filters as a sticky row of chips above a dense four-column grid", files: ["src/screens/SearchScreen.tsx"] },
      { requirement: "signature", statement: "A price tag tilted on each product card's corner", files: ["src/styles/components.css"] },
      { requirement: "responsive-1", statement: "Below 600px the grid becomes two columns and the chip row scrolls sideways", files: ["src/styles/components.css"] },
    ]);
  });

  it("isn't applied when it has problems", () => {
    const { app } = makeApp();
    const { project, jail } = makeProject(app, { "src/styles/tokens.css": ":root {}\n" });
    expect(() => applyDesignSpec(jail, app.ops, { projectId: project.id, runId: "spec_test" }, { ...A, surface: { ...A.surface, radii: [4, 8, 14, 20] } })).toThrow(/can't be applied: corners over 12px/);
  });
});
