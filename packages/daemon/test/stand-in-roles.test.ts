import { describe, expect, it } from "vitest";
import { appliesToRole, effectiveRoles, type SkillSpec } from "@flowcode/contracts";
import { selectSkills } from "../src/knowledge/skills.js";

const skill = (id: string, roles: string[], triggers: string[]): SkillSpec =>
  ({ id, version: "1.0.0", purpose: id, instructions: "Do it.", roles, triggers, source: "builtin", enabled: true, changelog: [] }) as unknown as SkillSpec;

describe("roles that never run reach the agent doing their work", () => {
  it("maps designer to the Coder and the reviewers and scans to the Debugger, once each", () => {
    expect(effectiveRoles(["planner", "designer"])).toEqual(["planner", "coder"]);
    expect(effectiveRoles(["reviewer", "security_qa", "accessibility_qa", "compliance_triage"])).toEqual(["debugger"]);
    expect(effectiveRoles(["coder", "designer"])).toEqual(["coder"]);
  });

  it("still applies a skill with no roles to everyone, and an active role only to itself", () => {
    expect(appliesToRole([], "coder")).toBe(true);
    expect(appliesToRole(["planner"], "coder")).toBe(false);
  });

  it("gives a designer skill to the Coder on a matching step (it used to reach only the Planner)", () => {
    const skills = [skill("skill.launch-pages-plan", ["planner", "designer"], ["waitlist page"])];
    expect(selectSkills(skills, "coder", "Build the waitlist page").map((s) => s.id)).toEqual(["skill.launch-pages-plan"]);
    expect(selectSkills(skills, "debugger", "Build the waitlist page")).toEqual([]);
  });

  it("gives a reviewer skill to the Debugger", () => {
    const skills = [skill("skill.security-review", ["reviewer"], ["xss"])];
    expect(selectSkills(skills, "debugger", "Fix the XSS finding").map((s) => s.id)).toEqual(["skill.security-review"]);
  });
});
