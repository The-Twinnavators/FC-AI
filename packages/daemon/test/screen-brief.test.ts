/**
 * Screen briefs (screenBrief.ts): what each screen is for in the person's terms, laid out as sections built from the
 * screen's matched catalog parts, for the design steps and the visual review.
 */
import { describe, expect, it } from "vitest";
import { matchCatalog } from "../src/orchestrator/catalogMatch.js";
import { briefParts, briefRequest, parseScreenBriefs, prdForBrief, screenBriefNote } from "../src/orchestrator/screenBrief.js";
import { parseScreenPlan } from "../src/orchestrator/screenPlan.js";

const PRD = `# Brand finder
## Users
Busy parents who want to shop non-GMO without reading every label.
## Main journeys
Find a trusted brand fast, then check why it is trusted.
## 9. Data model
- Brand: name, category`;
const plan = parseScreenPlan({ product: "Brand finder", screens: [{ name: "Brands", purpose: "Parents search and filter a list of trusted brands" }] })!;
const manifest = matchCatalog(PRD, plan.screens);

describe("screen briefs", () => {
  it("give the planner the PRD's people and journeys, and each screen's own parts to choose from", () => {
    const prd = prdForBrief(PRD);
    expect(prd).toContain("Busy parents");
    expect(prd).toContain("Find a trusted brand");
    expect(prd).not.toContain("Data model");
    const parts = briefParts(manifest, "Brands");
    expect(parts).toContain("c.button"); // the core is always there
    expect(parts).toEqual(expect.arrayContaining(manifest.screens[0]!.picks.map((p) => p.ref)));
    expect(briefRequest("Build it", prd, plan, manifest)).toContain("## Brands");
  });

  it("keep only the planned screens and the screen's own parts (an invented ID is dropped, the section kept)", () => {
    const pick = manifest.screens[0]!.picks[0]!.ref;
    const briefs = parseScreenBriefs(
      {
        screens: [
          {
            screen: "Brands",
            who: "Busy parents",
            goal: "Find a trusted brand fast",
            workflow: ["Search by name", "Narrow by category", "Open a brand"],
            firstView: "A search box and the most trusted brands",
            primaryAction: "Search brands",
            sections: [
              { title: "Find a brand", purpose: "Search and filter", part: pick },
              { title: "Hero carousel", purpose: "Looks nice", part: "c.made-up-thing" },
            ],
          },
          { screen: "Settings", who: "x", goal: "y", workflow: [], firstView: "z", primaryAction: "a", sections: [{ title: "t", purpose: "p", part: "" }] },
        ],
      },
      plan,
      manifest,
    );
    expect(briefs.map((b) => b.screen)).toEqual(["Brands"]);
    expect(briefs[0]!.sections.map((s) => s.part)).toEqual([pick, ""]);
    const note = screenBriefNote(briefs);
    expect(note).toContain("First view (without scrolling): A search box and the most trusted brands");
    expect(note).toContain(`[${pick}]`);
    expect(note).toContain("1. Search by name");
  });

  it("an unusable answer gives no briefs", () => {
    expect(parseScreenBriefs({}, plan, manifest)).toEqual([]);
    expect(screenBriefNote([])).toBe("");
  });
});
