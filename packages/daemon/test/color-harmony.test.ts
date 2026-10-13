import { describe, expect, it } from "vitest";
import {
  DESIGN_TEMPLATES,
  buildPalette,
  contrastAudit,
  contrastRatio,
  defaultSecondary,
  harmonies,
  hexToOklch,
  paletteFromTokens,
  roleTokens,
  secondaryFit,
  secondaryTokens,
  templateTokens,
} from "@flowcode/contracts";

const hueDelta = (a: string, b: string) => ((hexToOklch(a).h - hexToOklch(b).h + 540) % 360) - 180;
const SECONDARY = ["--color-secondary", "--color-secondary-hover", "--color-on-secondary", "--color-secondary-surface", "--color-secondary-border"];

/** The AA pairs every set of secondary tokens must pass. */
function expectSecondaryAA(t: Record<string, string>, surface: string, label: string) {
  expect(contrastRatio(t["--color-on-secondary"], t["--color-secondary"]), `${label} on-secondary`).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(t["--color-on-secondary"], t["--color-secondary-hover"]), `${label} on-secondary hover`).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(t["--color-secondary"], surface), `${label} secondary on cards`).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(t["--color-secondary"], t["--color-secondary-surface"]), `${label} secondary on its tint`).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(t["--color-text"], t["--color-secondary-surface"]), `${label} text on tint`).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(t["--color-secondary-border"], t["--color-secondary-surface"]), `${label} border on tint`).toBeGreaterThanOrEqual(3);
}

describe("60/30/10: secondary colours traced from the accent", () => {
  it("offers analogous, split-complementary, complementary and triadic options at their hue offsets", () => {
    for (const accent of ["#2563eb", "#c2410c", "#0f766e", "#7c3aed", "#22d3ee"]) {
      const hs = harmonies(accent);
      expect(hs.map((h) => h.offset).sort((a, b) => a - b)).toEqual([-150, -120, -30, 30, 120, 150, 180]);
      expect(new Set(hs.map((h) => h.kind))).toEqual(new Set(["analogous", "split-complementary", "complementary", "triadic"]));
      for (const h of hs) {
        expect(h.hex).toMatch(/^#[0-9a-f]{6}$/);
        expect(h.why.length).toBeGreaterThan(20);
        // Hue lands within a few degrees of the offset (gamut mapping keeps hue), and chroma is calmer than the accent.
        const d = hueDelta(h.hex, accent);
        expect(Math.abs(((d - h.offset + 540) % 360) - 180), `${accent} ${h.name} ${h.offset}`).toBeLessThanOrEqual(4);
        expect(hexToOklch(h.hex).c).toBeLessThan(hexToOklch(accent).c);
      }
    }
  });

  it("gives a black accent a slate secondary instead of failing", () => {
    const hs = harmonies("#111111");
    expect(hs).toHaveLength(7);
    for (const h of hs) expect(hexToOklch(h.hex).c).toBeGreaterThan(0.02);
  });

  it("defaults to an analogous neighbour clear of the status hues", () => {
    const d = defaultSecondary("#c8102e"); // red: +30 is orange (warning-ish), −30 is rose
    expect(d.kind).toBe("analogous");
    expect(d.offset).toBe(-30);
  });

  it("makes AA-passing tokens from any secondary, light and dark, nudging to the nearest passing shade", () => {
    for (const hex of ["#2563eb", "#fde047", "#a3e635", "#111827", "#f0abfc", "#64748b"]) {
      const light = { ...secondaryTokens(hex, "light", { surface: "#ffffff", text: "#111827" }), "--color-text": "#111827" };
      expectSecondaryAA(light, "#ffffff", `${hex} light`);
      const dark = { ...secondaryTokens(hex, "dark", { surface: "#171d2b", text: "#e8ebf3" }), "--color-text": "#e8ebf3" };
      expectSecondaryAA(dark, "#171d2b", `${hex} dark`);
    }
    // A colour that already passes is kept exactly.
    expect(secondaryTokens("#0d749d", "light")["--color-secondary"]).toBe("#0d749d");
  });

  it("flags a secondary that clashes with the accent", () => {
    expect(secondaryFit("#2a65e8", "#2563eb").clash).toMatch(/same colour/);
    expect(secondaryFit("#197aa3", "#2563eb").harmony?.kind).toBe("analogous");
    expect(secondaryFit("#197aa3", "#2563eb").clash).toBeUndefined();
  });

  it("maps a palette's secondary (own or derived) onto the five tokens, and audits them", () => {
    const derived = buildPalette({ brand: [{ hex: "#2563eb", role: "primary" }] });
    const own = buildPalette({ brand: [{ hex: "#2563eb", role: "primary" }, { hex: "#0f766e", role: "secondary" }] });
    for (const p of [derived, own])
      for (const dark of [false, true]) {
        const t = roleTokens(p, dark);
        for (const k of SECONDARY) expect(t[k], k).toMatch(/^#[0-9a-f]{6}$/);
        expectSecondaryAA(t, t["--color-surface"], `palette ${dark ? "dark" : "light"}`);
        const audit = contrastAudit(p, t).filter((c) => /secondary/.test(c.id));
        expect(audit).toHaveLength(4);
        expect(audit.every((c) => c.pass)).toBe(true);
      }
    expect(roleTokens(own)["--color-secondary"]).toBe("#0f766e");
    expect(paletteFromTokens({ "--color-accent": "#2563eb", "--color-secondary": "#0f766e" }).brand.map((b) => b.role)).toEqual(["primary", "secondary"]);
  });

  it("gives every design template a secondary traced from its accent by the stated harmony, passing AA", () => {
    for (const t of DESIGN_TEMPLATES) {
      const offered = harmonies(t.colors.accent).find((h) => h.kind === t.secondaryHarmony.kind && h.offset === t.secondaryHarmony.offset);
      expect(offered, `${t.id} harmony`).toBeDefined();
      expect(t.colors.secondary, `${t.id} secondary is the harmony's colour`).toBe(offered!.hex);
      const tokens = templateTokens(t);
      for (const k of SECONDARY) expect(tokens[k], `${t.id} ${k}`).toMatch(/^#[0-9a-f]{6}$/);
      expectSecondaryAA(tokens, t.colors.surface, t.id);
      expect(contrastRatio(tokens["--color-text"], tokens["--color-secondary-surface"]), `${t.id} text on tint`).toBeGreaterThanOrEqual(4.5);
      // Calmer than the accent (except a black accent, which has no colour of its own).
      if (hexToOklch(t.colors.accent).c > 0.03) expect(hexToOklch(t.colors.secondary).c, t.id).toBeLessThan(hexToOklch(t.colors.accent).c);
    }
  });
});

describe("the warning colour", () => {
  it("is a real token in both starters and in every theme, readable on its surface and page", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { templatesRoot } = await import("../src/orchestrator/templates.js");
    for (const s of ["react-vite-starter", "angular-starter"]) {
      const css = fs.readFileSync(path.join(templatesRoot(), s, "src/styles/tokens.css"), "utf8");
      expect(css.match(/--color-warning:/g)?.length, s).toBe(2);
    }
    for (const t of DESIGN_TEMPLATES) {
      const w = templateTokens(t)["--color-warning"]!;
      expect(w, t.id).toMatch(/^#[0-9a-f]{6}$/);
      expect(Math.min(contrastRatio(w, t.colors.surface)!, contrastRatio(w, t.colors.bg)!), t.id).toBeGreaterThanOrEqual(4.5);
    }
  });
});
