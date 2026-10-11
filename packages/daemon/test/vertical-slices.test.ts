/**
 * Feature steps are one journey each. The titles here are the ones the planner really returned for the Non-GMO brand
 * finder, where the two layer steps ran against a screen no step had written and took the run down with them.
 */
import { describe, expect, it } from "vitest";
import { isCrossCutting, verticalSlices } from "../src/orchestrator/verticalSlices.js";

const PLAN = [
  { title: "Main user journeys: Display list of non-GMO brands and 2 more" },
  { title: "Functional requirements: Display list of non-GMO brands and 3 more" },
  { title: "Accessibility requirements: Implement keyboard navigation and 5 more" },
  { title: "Implement responsive behavior for phone and tablet widths" },
  { title: "Track user engagement with non-GMO brands list, Show non-GMO brands" },
];

describe("a step that is a layer across the app", () => {
  it("is recognised in the plan that failed", () => {
    expect(PLAN.filter(isCrossCutting).map((s) => s.title)).toEqual([
      "Accessibility requirements: Implement keyboard navigation and 5 more",
      "Implement responsive behavior for phone and tablet widths",
    ]);
  });

  it("leaves journey steps alone", () => {
    for (const title of [
      "Display list of non-GMO brands",
      "Browse brands and open a brand's detail",
      "Search for a product by name",
      "Sign in with an email address",
    ])
      expect(isCrossCutting({ title }), title).toBe(false);
  });

  it("keeps a step that names a screen even when it mentions the quality", () => {
    expect(isCrossCutting({ title: "Accessibility for the brands list screen" })).toBe(false);
    expect(isCrossCutting({ title: "Responsive brands list page" })).toBe(false);
  });
});

describe("the journeys taken from a plan", () => {
  it("drops the layers and keeps the rest in order", () => {
    const { kept, dropped } = verticalSlices(PLAN);
    expect(kept.map((s) => s.title)).toEqual([PLAN[0].title, PLAN[1].title, PLAN[4].title]);
    expect(dropped).toHaveLength(2);
  });

  it("changes nothing when every step is a journey", () => {
    const plan = [{ title: "Display the brands list" }, { title: "Open a brand" }];
    expect(verticalSlices(plan)).toEqual({ kept: plan, dropped: [] });
  });

  it("keeps a plan that is all layers, because no plan at all is worse", () => {
    const plan = [{ title: "Accessibility pass" }, { title: "Responsive pass" }];
    expect(verticalSlices(plan)).toEqual({ kept: plan, dropped: [] });
  });
});
