/**
 * A batch becomes a build step, so what a batch holds decides whether a step is one finished journey or one layer
 * across the app. Batching used to be by PRD section, which is how the Non-GMO brand finder's §17 Accessibility and
 * §18 Responsive became the steps "Ensure Accessibility Compliance" and "Responsive Design" - both planned to run
 * after every screen was built, both retrofitting screens, and the first of them took the run down.
 */
import { describe, expect, it } from "vitest";
import { planBatches } from "../src/quality/lrcPlan.js";

const req = (id: string, section: string, text: string) => ({ id, section, text, code: [] });

// Shaped like the Non-GMO PRD: a section per screen's features, then a section per quality.
const REQS = [
  req("F1", "13. Functional requirements", "Display a list of trusted non-GMO brands on the Home screen"),
  req("F2", "13. Functional requirements", "Filter the brands list by category"),
  req("F3", "13. Functional requirements", "Open a Brand Detail page from the list"),
  req("F4", "13. Functional requirements", "Show the brand's certifications on Brand Detail"),
  req("A1", "17. Accessibility requirements", "Every control is reachable by keyboard with a visible focus ring"),
  req("A2", "17. Accessibility requirements", "Images have alternative text for a screen reader"),
  req("R1", "18. Responsive requirements", "The layout works at 375px with no sideways scrolling"),
];

const SCREENS = [{ label: "Home" }, { label: "Brand Detail" }];

describe("batching with the app's screens known", () => {
  const batches = planBatches(REQS, SCREENS);

  it("makes one batch per screen, not one per PRD section", () => {
    expect(batches).toHaveLength(2);
  });

  it("puts each screen's own requirements in its own batch", () => {
    expect(batches[0].map((r) => r.id)).toEqual(expect.arrayContaining(["F1", "F2"]));
    expect(batches[1].map((r) => r.id)).toEqual(expect.arrayContaining(["F3", "F4"]));
  });

  it("gives every journey the accessibility and responsive requirements, so no step retrofits them", () => {
    for (const b of batches) expect(b.map((r) => r.id)).toEqual(expect.arrayContaining(["A1", "A2", "R1"]));
  });

  it("never makes a batch of only cross-cutting requirements", () => {
    for (const b of batches) expect(b.some((r) => /^[FR]\d/.test(r.id) && r.id !== "R1")).toBe(true);
  });
});

describe("batching without screens", () => {
  it("keeps the old shape, one batch per PRD section", () => {
    const batches = planBatches(REQS);
    expect(batches).toHaveLength(3);
    expect(batches.map((b) => b[0].section)).toEqual(["13. Functional requirements", "17. Accessibility requirements", "18. Responsive requirements"]);
  });
});

describe("a requirement that names no screen", () => {
  it("joins the journey a person lands on", () => {
    const reqs = [req("F1", "Features", "Display the brands list on Home"), req("G1", "Features", "The product is called NoBio")];
    const batches = planBatches(reqs, SCREENS);
    expect(batches[0].map((r) => r.id)).toEqual(["F1", "G1"]);
  });
});
