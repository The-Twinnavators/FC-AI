/** PRD intake: find the PRD, index it by section, give each step only the sections it cites. */
import { describe, expect, it } from "vitest";
import { findPrd, matchSections, parseSections, repoInstructions, sectionIndex, sectionText } from "../src/orchestrator/prd.js";
import { BUILTIN_SKILLS, selectSkills } from "../src/knowledge/skills.js";
import { makeApp, makeProject } from "./helpers.js";

const PRD = [
  "# Product Requirements Document: Basic Calendar App",
  "## 1. Product Summary",
  "### 1.4 Non-goals for MVP",
  "- Shared calendars.",
  "## 3. Scope and Requirements",
  "### 3.3 Functional requirements",
  "#### Search and preferences (should-have)",
  "- Users can search their events by title.",
  "### 3.4 Acceptance criteria",
  "- A user can create an event with a title and time.",
  "- Search returns matching events.",
  "## 5. Technical Specification",
  "```",
  "## not a heading (inside code)",
  "```",
  "### 5.3 Data model",
  "Event { id, title, date, time }",
  "x".repeat(500),
].join("\n");

describe("PRD intake", () => {
  it("indexes numbered sections, skips headings inside code, and includes the acceptance and non-goal text", () => {
    const ids = parseSections(PRD).map((s) => s.id);
    expect(ids).toEqual(["s1", "1", "1.4", "3", "3.3", "s6", "3.4", "5", "5.3"]);
    const index = sectionIndex(PRD);
    expect(index).toMatch(/3\.4 Acceptance criteria/);
    expect(index).toMatch(/--- 3\.4 Acceptance criteria ---\n### 3\.4 Acceptance criteria\n- A user can create an event/);
    expect(index).toMatch(/--- 1\.4 Non-goals for MVP ---/);
    expect(index).not.toMatch(/Event \{ id, title/); // the data model text stays out of the index
  });

  it("gives a step only its cited sections (with subsections) and ignores unknown ids", () => {
    const r = sectionText(PRD, ["3.3", "9.9", "3.4"]);
    expect(r.used).toEqual(["3.3", "3.4"]);
    expect(r.text).toMatch(/search their events by title/);
    expect(r.text).toMatch(/Search returns matching events/);
    expect(r.text).not.toMatch(/Data model/);
    expect(sectionText(PRD, ["5.3"], 300).text).toMatch(/\[section truncated\]$/);
  });

  it("cites the sections a step's words point at, plus the functional requirements, when the plan cited none (Calculator test 1)", () => {
    const md = [
      "# Calculator PRD",
      "## 1. Product",
      "### 1.6 Functional Requirements",
      "| F7 | Division by zero shows a clear \"Can't divide by zero\" message | Must |",
      "### 1.7 Privacy Requirements",
      "Store listing/privacy label states: Data not collected.",
      "## 2. Technical",
      "### 2.4 Numeric Accuracy",
      "Handle overflow and Infinity gracefully; avoid floating-point errors.",
      "## 3. Design",
      "### 3.5 Accessibility Plan",
      "ARIA labels on all keys; the display is a live region. Visible focus ring for keyboard users.",
    ].join("\n");
    const ids = matchSections(md, "Handle states, accessibility, and edge cases in CalculatorScreen.tsx");
    expect(ids).toEqual(expect.arrayContaining(["3.5", "2.4", "1.6"]));
    expect(ids).not.toContain("1.7");
    expect(ids).not.toContain("1");
  });

  it("finds the PRD in spec/ and reads repository instructions first", () => {
    const { app } = makeApp();
    const { jail } = makeProject(app, { "spec/calendar-prd.md": PRD, "spec/notes.md": "short", "AGENTS.md": "Use pnpm. Never edit generated files.", "README.md": "# x" });
    expect(findPrd(jail)).toBe("spec/calendar-prd.md");
    expect(repoInstructions(jail)).toEqual({ file: "AGENTS.md", text: "Use pnpm. Never edit generated files." });
  });

  it("the patch and check skills are always on for their roles; PRD intake matches PRD wording", () => {
    const ids = (role: string, text: string) => selectSkills(BUILTIN_SKILLS, role, text).map((s) => s.id);
    expect(ids("coder", "Fix the footer link")).toContain("skill.exact-patch");
    expect(ids("debugger", "Fix the footer link")).toContain("skill.exact-patch");
    expect(ids("planner", "Fix the footer link")).toContain("skill.acceptance-checks");
    expect(ids("planner", "Implement search from the PRD")).toContain("skill.prd-intake");
    expect(ids("coder", "Implement search from the PRD")).not.toContain("skill.prd-intake");
  });
});

describe("PRD is used only when the request is about it", () => {
  it("brings in the PRD for spec work, not for small unrelated changes", async () => {
    const { relatesToPrd } = await import("../src/orchestrator/prd.js");
    expect(relatesToPrd({ objective: "Change the accent colour to a darker teal, #0f766e." })).toBe(false);
    expect(relatesToPrd({ objective: "Add a badge next to the month title" })).toBe(false);
    expect(relatesToPrd({ objective: "Implement the search requirement from the PRD (section 3.3)" })).toBe(true);
    expect(relatesToPrd({ objective: "Build what §4.2 describes" })).toBe(true);
    expect(relatesToPrd({ objective: "Meet the acceptance criteria for sign-in" })).toBe(true);
    expect(relatesToPrd({ objective: "x", referencePaths: ["spec/attachments/prd.md"] })).toBe(true);
    expect(relatesToPrd({ objective: "x", strategy: { kind: "spec_build" } })).toBe(true);
  });
});
