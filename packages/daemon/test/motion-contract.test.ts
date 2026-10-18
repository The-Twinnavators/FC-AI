/**
 * Motion in the Look (contracts motion.ts): the three levels as tokens, Balanced equal to the starter's existing values
 * (choosing it changes nothing an app already does), stagger capped by steps and total delay at every level, and
 * expressive capabilities that need both the project's opt-in and an eligible page: Balanced alone, or an opt-in on an
 * app screen, never turns one on. Directions made before motion existed carry no motion tokens.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { APPEARANCE_THEMES, BASE_APPEARANCE, EXPRESSIVE_FEATURES, MOTION_LEVELS, appearanceFromTheme, appearanceProblems, appearanceTokens, expressiveAllowed, motionTokens, staggerDelay, type Appearance } from "@flowcode/contracts";

const STARTER = fs.readFileSync(path.resolve(import.meta.dirname, "../../../templates/react-vite-starter/src/styles/tokens.css"), "utf8");
const starterValue = (name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(STARTER)?.[1]?.trim();

describe("motion levels", () => {
  it("Balanced is the starter's own motion: every Balanced token has the value new apps already ship", () => {
    for (const [k, v] of Object.entries(motionTokens("balanced"))) expect(starterValue(k), k).toBe(v);
  });

  it("levels differ only in amount, and Minimal has no travel or stagger", () => {
    const keys = Object.keys(motionTokens("balanced")).sort();
    for (const l of MOTION_LEVELS) expect(Object.keys(motionTokens(l)).sort()).toEqual(keys);
    expect(motionTokens("minimal")).toMatchObject({ "--enter-distance": "0px", "--stagger": "0ms", "--stagger-max": "0ms" });
    expect(parseFloat(motionTokens("expressive")["--duration-slow"]!)).toBeGreaterThan(parseFloat(motionTokens("balanced")["--duration-slow"]!));
  });

  it("stagger is capped by steps and by total delay at every level, so no item waits past the cap", () => {
    for (const l of MOTION_LEVELS) {
      const max = parseFloat(motionTokens(l)["--stagger-max"]!);
      for (const i of [0, 1, 3, 6, 12, 200]) expect(staggerDelay(l, i), `${l} #${i}`).toBeLessThanOrEqual(max);
      expect(staggerDelay(l, 200)).toBe(staggerDelay(l, 10_000));
    }
    expect(staggerDelay("minimal", 50)).toBe(0);
    expect(staggerDelay("balanced", 0)).toBe(0);
    expect(staggerDelay("balanced", 200)).toBe(200);
    expect(staggerDelay("expressive", 200)).toBe(300);
  });
});

describe("expressive capabilities: the Look approves, the page decides", () => {
  it("a level alone enables nothing, Balanced or Expressive", () => {
    for (const f of EXPRESSIVE_FEATURES) {
      expect(expressiveAllowed({ level: "balanced" }, f, "homepage")).toBe(false);
      expect(expressiveAllowed({ level: "expressive" }, f, "homepage")).toBe(false);
    }
  });
  it("an approved hero shows only on an eligible page; an app screen in the same project never gets it", () => {
    const m = { level: "balanced" as const, expressive: ["hero" as const] };
    expect(expressiveAllowed(m, "hero", "homepage")).toBe(true);
    expect(expressiveAllowed(m, "hero", "marketing")).toBe(true);
    expect(expressiveAllowed(m, "hero", "app")).toBe(false);
    expect(expressiveAllowed(m, "productDemo", "homepage")).toBe(false);
  });
  it("Minimal turns every expressive capability off, even approved ones", () => {
    expect(expressiveAllowed({ level: "minimal", expressive: [...EXPRESSIVE_FEATURES] }, "hero", "homepage")).toBe(false);
  });
});

describe("motion in the appearance", () => {
  it("new directions start Balanced; older ones (no motion) carry no motion tokens, so applying them leaves motion alone", () => {
    expect(BASE_APPEARANCE.motion).toEqual({ level: "balanced" });
    expect(appearanceFromTheme(APPEARANCE_THEMES[0]!.id)?.motion).toEqual({ level: "balanced" });
    const old: Appearance = { ...BASE_APPEARANCE, motion: undefined };
    expect(Object.keys(appearanceTokens(old)).filter((k) => k in motionTokens("balanced"))).toEqual([]);
    expect(appearanceTokens({ ...BASE_APPEARANCE, motion: { level: "expressive" } })).toMatchObject(motionTokens("expressive"));
  });
  it("changing only the level changes only motion tokens", () => {
    const a = appearanceTokens({ ...BASE_APPEARANCE, motion: { level: "balanced" } });
    const b = appearanceTokens({ ...BASE_APPEARANCE, motion: { level: "expressive" } });
    const differ = Object.keys(a).filter((k) => a[k] !== b[k]);
    expect(differ.every((k) => k in motionTokens("balanced"))).toBe(true);
    expect(differ.length).toBeGreaterThan(0);
  });
  it("an unknown level or capability is refused", () => {
    expect(appearanceProblems({ ...BASE_APPEARANCE, motion: { level: "wild" as never } }).join()).toMatch(/motion level "wild"/);
    expect(appearanceProblems({ ...BASE_APPEARANCE, motion: { level: "balanced", expressive: ["confetti" as never] } }).join()).toMatch(/"confetti"/);
  });
});
