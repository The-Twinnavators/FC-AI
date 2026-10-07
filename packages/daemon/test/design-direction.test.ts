/** Design direction: the PRD's industry picks a palette, a Google font pairing and the anti-patterns to avoid. */
import { describe, expect, it } from "vitest";
import { designDirection, directionBrief } from "../src/knowledge/designDirection.js";
import { designSkillIds } from "../src/knowledge/skills.js";

describe("design direction", () => {
  it("reads the product's industry from the PRD", () => {
    // No BIO & GMO build: a grocery app started from the starter's default blue.
    const food = designDirection("People need a way to find healthy food options: non-GMO brands in the grocery aisle");
    expect(food.industry).toMatch(/Food/);
    expect(food.avoid).toMatch(/Cold blue palettes/);
    expect(food.fonts).toEqual({ heading: "Fraunces", body: "Work Sans" });
    expect(designDirection("A personal calendar to schedule events").industry).toMatch(/calendar/i);
    expect(designDirection("A clinic appointment booking app for patients").palette.primary).toBe("#0E7490");
    expect(designDirection("Something entirely new").industry).toBe("General product");
  });

  it("briefs the design steps with the direction and its anti-patterns", () => {
    const brief = directionBrief(designDirection("A meditation and sleep app"));
    expect(brief).toMatch(/Mental health \/ wellness/);
    expect(brief).toMatch(/Avoid for this kind of product: Urgency timers/);
    // A photo-led industry asks for real photos from find_image (No BIO & GMO build used none).
    expect(directionBrief(designDirection("non-GMO grocery brands"))).toMatch(/photo-led. Use real photos from find_image: one for the hero/);
  });

  it("gives a polish pass the UI/UX Pro Max checklist", () => {
    expect(designSkillIds("Design polish\nPolish every screen")).toEqual(["skill.art-direction", "skill.ui-ux-pro-max", "skill.interface-design-system", "skill.avoid-ai-slop"]);
  });
});

describe("brand colours", () => {
  it("shows up to three: captured first, then companions of the main colour, or the direction's palette", async () => {
    const { brandTrio } = await import("../src/knowledge/designDirection.js");
    const food = designDirection("non-GMO grocery brands");
    // No BIO & GMO build: squareup.com gave one blue, so the Styles page showed a single brand colour.
    const square = brandTrio(["#006AFF"], food);
    expect(square).toHaveLength(3);
    expect(square[0]).toBe("#006aff");
    expect(new Set(square).size).toBe(3);
    expect(brandTrio([], food)).toEqual(["#15803d", "#166534", "#d9f99d"]);
    expect(brandTrio(["#111111", "#222222", "#333333", "#444444"], food)).toEqual(["#111111", "#222222", "#333333"]);
  });
});
