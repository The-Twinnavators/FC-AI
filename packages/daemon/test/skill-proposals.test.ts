/** Skill proposals: repeated failures across runs become a pattern, and a proposed skill stays off until turned on. */
import { describe, expect, it } from "vitest";
import type { SkillSpec, ToolCallRecord } from "@flowcode/contracts";
import { detectPatterns, dismissProposal, enableProposal, proposals, proposalsView } from "../src/knowledge/skillProposals.js";
import { makeApp } from "./helpers.js";

const now = () => new Date().toISOString();
let n = 0;
const failed = (runId: string, toolName: string, summary: string): ToolCallRecord => ({
  id: `tool_${++n}`,
  runId,
  agentRole: "coder",
  modelAssignment: { providerId: "p", model: "m" },
  toolName,
  argsRedacted: {},
  status: "failed",
  idempotencyKey: `k${n}`,
  resultSummaryRedacted: summary,
  startedAt: now(),
  completedAt: now(),
});

describe("skill proposals", () => {
  it("finds a failure that repeats across runs, and ignores one that only happens in a single run", () => {
    const { app } = makeApp();
    for (const run of ["run_a", "run_a", "run_b"]) app.store.toolCalls.upsert(failed(run, "apply_patch", "Patch context mismatch: find text not found in src/App.tsx"));
    for (let i = 0; i < 5; i++) app.store.toolCalls.upsert(failed("run_c", "run_script", "npm run lint exited with code 1"));
    const found = detectPatterns(app);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ category: "patch_miss", count: 3, needsCodeFix: false });
    expect(found[0].runs.sort()).toEqual(["run_a", "run_b"]);
    expect(found[0].title).toMatch(/\.tsx files: find text not found/);
    expect(proposalsView(app).open.map((p) => p.id)).toEqual([found[0].id]);
  });

  it("keeps a proposed skill off until turned on, and turns it off again on dismiss", () => {
    const { app } = makeApp();
    const skill: SkillSpec = {
      id: "skill.proposed-test",
      version: "0.1.0",
      purpose: "Re-read the file before patching.",
      instructions: "1. Read the lines you plan to change.",
      allowedTools: [],
      inputSchema: "Task",
      outputSchema: "ChangedPaths",
      policies: { network: "denied", filesystem: "governed_write" },
      acceptance: [],
      tests: [],
      changelog: [],
      roles: ["coder"],
      triggers: ["*"],
      enabled: false,
      source: "user",
    };
    app.knowledge.saveSkill(skill);
    app.store.setSetting("skillProposals", { "patch_miss:abc": { patternId: "patch_miss:abc", skillId: skill.id, status: "proposed", createdAt: now() } });
    expect(app.store.skills.require(skill.id).enabled).toBe(false);

    const on = enableProposal(app, "patch_miss:abc");
    expect(on.status).toBe("enabled");
    expect(on.before).toEqual({ runs: 0, hits: 0 });
    expect(app.store.skills.require(skill.id).enabled).toBe(true);
    expect(proposalsView(app).items[0].effect?.verdict).toMatch(/Too early to tell/);

    dismissProposal(app, "patch_miss:abc");
    expect(app.store.skills.require(skill.id).enabled).toBe(false);
    expect(proposals(app)["patch_miss:abc"].status).toBe("dismissed");
    expect(proposalsView(app).items).toEqual([]);
  });
});

describe("drafted skill text", () => {
  it("puts steps on numbered lines, and leaves already-numbered text alone", async () => {
    const { numbered } = await import("../src/knowledge/skillProposals.js");
    expect(numbered("Read the file first. Copy the find text exactly. Pass the line number.")).toBe("1. Read the file first.\n2. Copy the find text exactly.\n3. Pass the line number.");
    expect(numbered("1. Read.\n2. Patch.")).toBe("1. Read.\n2. Patch.");
  });

  it("names only tools the agent has, in new and already-saved skills (skill.proposed-patch-check-ts said search_files)", async () => {
    const { renderSkills } = await import("../src/knowledge/skills.js");
    const base = { version: "0.1.0", purpose: "p", allowedTools: [], inputSchema: "Task", outputSchema: "ChangedPaths", policies: { network: "denied", filesystem: "governed_write" }, acceptance: [], tests: [], changelog: [], roles: ["coder"], triggers: ["*"], enabled: true } as const;
    const out = renderSkills([{ ...base, id: "skill.proposed-x", source: "user", instructions: "3. If not, use search_files to locate the correct file." } as never]);
    expect(out).toContain("use search_code to locate");
    expect(out).not.toContain("search_files");
  });
});
