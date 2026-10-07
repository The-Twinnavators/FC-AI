/** Component recipes from the CSSVibes prompt library: complete, plain, and picked up for the right tasks. */
import { describe, expect, it } from "vitest";
import { RECIPE_SKILLS } from "../src/knowledge/componentRecipes.js";
import { BUILTIN_SKILLS, selectSkills } from "../src/knowledge/skills.js";

const PARTS = ["When to use:", "When not to use:", "Inspect first:", "Process:", "Accessibility and responsive:", "Edge cases:", "Done when:", "QA:", "Report in plain language"];

describe("more ready-made layouts", () => {
  it("adds pricing, about and sign-in screens only when the spec asks", async () => {
    const { pickLayouts } = await import("../src/orchestrator/layoutRecipes.js");
    const v = (t: string) => pickLayouts(t).map((p) => p.version);
    expect(v("A pricing page with three subscription plans")).toEqual(["pricing-cards"]);
    expect(v("Pricing with a feature comparison table")).toEqual(["pricing-compare"]);
    expect(v("An about us page telling our story")).toEqual(["about-story"]);
    expect(v("An about page: meet the team and contact us")).toEqual(["about-team"]);
    expect(v("Users sign in or create an account")).toEqual(["signin-centered"]);
    // A personal calendar for first-time visitors isn't a marketing site: no promise-and-checklist split sign-in.
    expect(v("First-time visitors sign in or create an account")).toEqual(["signin-centered"]);
    expect(v("A marketing site where visitors sign up")).toEqual(["signin-split"]);
    expect(v("Local only, no login. Users never create an account.")).toEqual([]);
  });

  it("reads only the PRD's screen sections, not its goals, launch plan or analytics (Calendar CSSVibes test)", async () => {
    const { pickLayouts } = await import("../src/orchestrator/layoutRecipes.js");
    const prd = [
      "# Product Requirements Document: Basic Calendar App",
      "## 1.3 Product goals\n- Help people plan at different levels of detail and track goals.",
      "## 4.1 Information architecture\n- Sign in\n- Calendar (month, week, day)\n- Account settings",
      "## 4.2 Main screens\n| Calendar | Month grid with events |\n| Sign in | Email and password |",
      "## 5.3 Data model\nRow-level security for saving events.",
      "## 6.2 Phased plan\n| 5. Launch | Release candidate, deployment runbook, monitoring dashboard |",
      "## 7. Analytics and Success Metrics\nTrack goals, streaks and analytics events.",
    ].join("\n\n");
    const kinds = pickLayouts(prd).map((p) => p.kind);
    expect(kinds).not.toContain("dashboard");
    expect(kinds).toEqual(expect.arrayContaining(["settings", "signin"]));
  });
});

describe("component recipes", () => {
  it("are built-in skills with every part and plain copy", () => {
    for (const s of RECIPE_SKILLS) {
      expect(BUILTIN_SKILLS.some((b) => b.id === s.id)).toBe(true);
      for (const p of PARTS) expect(s.instructions).toContain(p);
      expect(`${s.purpose}\n${s.instructions}`).not.toMatch(/—|\b(ensure|enable|foster|comprehensive)\b/i);
    }
  });

  it("are chosen for the component a task names", () => {
    const pick = (text: string) => selectSkills(BUILTIN_SKILLS, "coder", text).map((s) => s.id);
    expect(pick("Add toast messages after saving")).toContain("skill.recipe-toasts");
    expect(pick("Add tooltips to the toolbar icons")).toContain("skill.recipe-tooltips");
    expect(pick("Build the sign in and create account forms")).toContain("skill.recipe-sign-in");
    expect(pick("Show an order tracking timeline")).toContain("skill.recipe-status-tracking");
    expect(pick("Create a photo gallery with a lightbox")).toContain("skill.recipe-gallery");
  });
});
