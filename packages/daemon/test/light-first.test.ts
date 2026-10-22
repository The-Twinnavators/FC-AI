/**
 * Light-first design specs: a dark approved palette becomes the app's dark theme exactly, and the light theme is
 * derived from its accent (ShelfSure: light mode felt like dark mode).
 */
import { describe, expect, it } from "vitest";
import { contrastRatio, luminance } from "@flowcode/contracts";
import { lightFirst, type DesignSpec } from "../src/workspace/designSpec.js";
import { withDarkValues } from "../src/workspace/darkTheme.js";

const dark = { bg: "#121212", surface: "#1e1e1e", surfaceSunken: "#0d0d0d", text: "#ffffff", textMuted: "#b3b3b3", border: "#333333", borderStrong: "#555555", accent: "#22c55e", accentHover: "#16a34a", onAccent: "#0b0b0b", secondary: "#0ea5e9" };
const spec = { palette: dark } as unknown as DesignSpec;

describe("light-first design specs", () => {
  it("keep a light palette as it is", () => {
    const light = { ...spec, palette: { ...dark, bg: "#fafafa", text: "#111111" } } as DesignSpec;
    expect(lightFirst(light)).toBe(light);
  });
  it("turn a dark palette into the dark theme and derive a readable light one from its accent", () => {
    const s = lightFirst(spec);
    expect(s.darkPalette).toEqual(dark);
    expect(luminance(s.palette.bg)).toBeGreaterThan(0.7);
    expect(contrastRatio(s.palette.text, s.palette.bg)).toBeGreaterThanOrEqual(4.5);
    expect(lightFirst(s)).toBe(s);
  });
  it("write the approved dark colors into the managed dark theme", () => {
    const css = ":root {\n  --color-accent: #1d803e;\n  --color-secondary: #1672a0;\n  --color-bg: #ffffff;\n}\n";
    const out = withDarkValues(css, { "--color-bg": "#121212", "--color-text": "#ffffff" });
    const block = out.slice(out.indexOf(':root[data-theme="dark"]'));
    expect(block).toContain("--color-bg: #121212;");
    expect(block).toContain("--color-text: #ffffff;");
    expect(out.slice(0, out.indexOf(':root[data-theme="dark"]'))).toContain("--color-bg: #ffffff;");
  });
});
