/**
 * A design step split into parts is held only to the sections its title names (Clean Cart: "Compose the Home hero"
 * was held to How it works and Why you can trust it, sections of later parts, and stopped after 30 turns).
 */
import { describe, expect, it } from "vitest";
import { sectionNamedBy } from "../src/orchestrator/compositionManifest.js";

describe("sectionNamedBy", () => {
  it("matches the sections a part's title names", () => {
    expect(sectionNamedBy("How it works", "Add How it works and Why you can trust it to Home")).toBe(true);
    expect(sectionNamedBy("Why you can trust it", "Add How it works and Why you can trust it to Home")).toBe(true);
    expect(sectionNamedBy("Featured categories", "Fill the Home category and most-liked pieces with real content")).toBe(true);
    expect(sectionNamedBy("Most liked this week", "Fill the Home category and most-liked pieces with real content")).toBe(true);
  });
  it("leaves other parts' sections alone", () => {
    for (const s of ["How it works", "Why you can trust it", "Most liked this week", "Featured categories"]) expect(sectionNamedBy(s, "Compose the Home hero from core parts")).toBe(false);
    expect(sectionNamedBy("Most liked this week", "Add How it works and Why you can trust it to Home")).toBe(false);
  });
});
