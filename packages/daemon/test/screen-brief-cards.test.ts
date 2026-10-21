/**
 * The screen brief reads the library's own knowledge (screenBrief.ts partCard): each candidate part arrives as its
 * catalog card - what it does, where it belongs, what it gives a page, what it needs, when to avoid it and what it
 * already contains - instead of its name alone; a section repeating what another section's part already contains is
 * reported; and how each part is used (reuse, adapt, compose) reaches the composition manifest.
 */
import { describe, expect, it } from "vitest";
import { briefRequest, duplicateParts, parseScreenBriefs, partCard } from "../src/orchestrator/screenBrief.js";
import { manifestFromBriefs } from "../src/orchestrator/compositionManifest.js";
import type { CatalogManifest } from "../src/orchestrator/catalogMatch.js";
import type { ScreenPlan } from "../src/orchestrator/screenPlan.js";

const plan: ScreenPlan = { product: "Studio", screens: [{ id: "home", label: "Home", component: "HomeScreen", file: "src/screens/HomeScreen.tsx", purpose: "Visitors learn about the studio" }] };
const manifest: CatalogManifest = {
  screens: [{ screen: "Home", picks: [{ ref: "t.landing-sales", id: "landing-sales", name: "Sales landing", score: 9, why: "" }, { ref: "b.faq-accordion", id: "faq-accordion", name: "FAQ", score: 8, why: "" }], alternates: [] }],
  shared: [],
};

describe("screen briefs read the catalog cards", () => {
  it("gives each candidate what it does, gives a page, needs, avoid when and already contains", () => {
    // A piece's variants share its card.
    expect(partCard("c.modal", ["c.modal", "c.modal.danger"])).toContain("Also as: c.modal.danger");
    const card = partCard("p.plan-comparison");
    expect(card).toMatch(/^- p\.plan-comparison \(pattern, /);
    expect(card).toContain("Gives a page: compare");
    expect(card).toContain("Needs: two to four options with the same features");
    expect(partCard("t.landing-sales")).toContain("Already contains: b.faq-accordion, b.cta-banner");
    const req = briefRequest("A studio site", "PRD", plan, manifest);
    expect(req).toContain("- t.landing-sales (template");
    expect(req).toMatch(/Core components, for sections built from them: c\.button/);
  });

  it("reports a section that repeats what another section's part already contains", () => {
    const dup = duplicateParts("Home", [
      { title: "Sales page", part: "t.landing-sales" },
      { title: "Questions", part: "b.faq-accordion" },
    ]);
    expect(dup.find((d) => d.section === "Questions")).toMatchObject({ part: "b.faq-accordion" });
    // A whole-screen template beside other sections is flagged too: it is a page, not one section.
    expect(dup.some((d) => d.part === "t.landing-sales" && /whole screen/.test(d.reason))).toBe(true);
    expect(duplicateParts("Home", [{ title: "Questions", part: "b.faq-accordion" }, { title: "Call", part: "b.cta-banner" }])).toEqual([]);
    expect(duplicateParts("Classes", [{ title: "Book", part: "p.booking-calendar" }, { title: "Waitlist", part: "p.booking-calendar" }])).toEqual([expect.objectContaining({ section: "Waitlist" })]);
  });

  it("keeps how each part is used and what is adapted, through to the manifest", () => {
    const issues: Array<{ page: string; section: string; reason: string }> = [];
    const briefs = parseScreenBriefs(
      { screens: [{ screen: "Home", pageType: "marketing", who: "Visitors", goal: "Decide", workflow: [], firstView: "x", primaryAction: "Book", sections: [{ title: "Sales page", purpose: "Pitch", part: "t.landing-sales", use: "adapt", adapt: "Plans become the three passes" }, { title: "Questions", purpose: "FAQ", part: "b.faq-accordion", use: "reuse" }] }] },
      plan,
      manifest,
      [],
      issues,
    );
    expect(briefs[0]!.sections[0]).toMatchObject({ use: "adapt", adapt: "Plans become the three passes" });
    expect(issues.some((i) => i.section === "Questions" && /already contains/.test(i.reason))).toBe(true);
    const m = manifestFromBriefs(briefs);
    expect(m.entries.find((e) => e.ref === "t.landing-sales")).toMatchObject({ mode: "adapt", adaptations: ["Plans become the three passes"] });
    expect(m.entries.find((e) => e.ref === "b.faq-accordion")).toMatchObject({ mode: "whole" });
  });
});
