/** PRD colours become contrast-safe theme roles: same hue, darkened only as far as WCAG AA needs. */
import { describe, expect, it } from "vitest";
import { mapRoles, readableOn } from "../src/orchestrator/starterIdentity.js";
import { contrastRatio } from "../src/quality/tokens.js";

describe("contrast-safe PRD colours", () => {
  it("darkens a colour only until it passes", () => {
    expect(readableOn("#3a60c4", "#ffffff", 4.5)).toBe("#3a60c4");
    const amber = readableOn("#f59e0b", "#ffffff", 4.5);
    expect(contrastRatio(amber, "#ffffff")!).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(amber, "#ffffff")!).toBeLessThan(5.5);
  });

  it("keeps a bright brand accent usable for buttons, focus and muted text", () => {
    const r = mapRoles([
      { name: "primary", hex: "#ffd23f", use: "primary buttons accent" },
      { name: "text", hex: "#333333", use: "body text" },
      { name: "bg", hex: "#fff8e7", use: "page background" },
    ] as never);
    expect(contrastRatio(r["--color-accent"], r["--color-surface"])!).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(r["--color-on-accent"], r["--color-accent"])!).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(r["--color-text-muted"], r["--color-bg"])!).toBeGreaterThanOrEqual(4.5);
  });
});
