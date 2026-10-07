import { describe, expect, it } from "vitest";
import { BUILTIN_SKILLS, renderSkills, selectSkills } from "../src/knowledge/skills.js";

const user = { ...BUILTIN_SKILLS[0], id: "skill.responsive-tables", purpose: "Make data tables responsive on small screens", instructions: "Wrap tables in a scroll container.", roles: ["coder"], triggers: ["table"], acceptance: ["No horizontal page scroll"], source: "user" as const, enabled: true };

describe("skill selection", () => {
  it("matches on trigger phrases and role", () => {
    expect(selectSkills([...BUILTIN_SKILLS, user], "coder", "Fix the pricing table layout").map((s) => s.id)).toContain("skill.responsive-tables");
    expect(selectSkills([user], "planner", "Fix the pricing table layout")).toEqual([]);
  });
  it("skips disabled skills and unrelated tasks", () => {
    expect(selectSkills([{ ...user, enabled: false }], "coder", "pricing table")).toEqual([]);
    expect(selectSkills([user], "coder", "Rename the login button")).toEqual([]);
  });
  it("routes TypeScript repairs to the debugger skill", () => {
    expect(selectSkills(BUILTIN_SKILLS, "debugger", "Repair typecheck failure TS2322 in App.tsx")[0]?.id).toBe("skill.fix-typescript-error");
  });
  it("renders instructions and acceptance checks", () => {
    const text = renderSkills([user]);
    expect(text).toContain("skill.responsive-tables@");
    expect(text).toContain("- No horizontal page scroll");
    expect(renderSkills([])).toBe("");
  });
});
