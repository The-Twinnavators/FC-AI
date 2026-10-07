/** Fix memory: a step that passes after failing keeps the problem and the fix; later retries get the closest ones. */
import { describe, expect, it } from "vitest";
import { errorSignature, failuresOf, fixBrief, fixToSkill, recordFix, similarFixes, FIX_TAG } from "../src/knowledge/fixMemory.js";
import { makeApp } from "./helpers.js";

describe("fix memory", () => {
  it("normalises an error so the same failure matches across projects", () => {
    const a = errorSignature("src/screens/NonGMOBrandsScreen.tsx(56,3): useEffect sets filteredBrands at line 56 in run_abc123");
    const b = errorSignature("src/screens/OtherScreen.tsx(12,9): useEffect sets filteredBrands at line 12 in run_zzz999");
    expect(a).toBe(b);
    expect(errorSignature("added #faf5ec and 35 more")).toBe("added <colour> and <n> more");
  });

  it("keeps the person's guidance apart from the failures", () => {
    const { problems, guidance } = failuresOf(["Tests failed: 3", "Guidance from the user (follow this): Correct the tests first", "Tests failed: 3", "User requested retry; use a revised approach.", "agent outcome: no_action (No progress: 9 reads in a row and no change made.)"]);
    expect(problems).toEqual(["Tests failed: 3"]);
    expect(guidance).toEqual(["Correct the tests first"]);
  });

  it("records a fix as a global Knowledge Hub note and finds it again for a similar failure", async () => {
    const { app } = makeApp();
    const saved = recordFix(app.knowledge, {
      projectId: "p1",
      runId: "run_1",
      taskId: "task_1",
      step: "Add search, filter, and sorting functionality",
      model: "claude-sonnet-5-5",
      attempts: 2,
      problems: ["Endless re-render found: this useEffect sets filteredBrands and lists filteredBrands in its dependencies"],
      guidance: [],
      files: ["src/screens/NonGMOBrandsScreen.tsx"],
      diff: "-  useEffect(() => { setFilteredBrands(sorted) }, [filteredBrands])\n+  const sorted = useMemo(() => sortBrands(filtered, sort), [filtered, sort])",
    })!;
    expect(saved.scope).toBe("global");
    expect(saved.tags).toContain(FIX_TAG);
    expect(saved.content).toContain("useMemo");
    // Nothing to keep: no failure, or no change and no guidance.
    expect(recordFix(app.knowledge, { projectId: "p", runId: "r", taskId: "t", step: "s", attempts: 1, problems: [], guidance: [], files: [], diff: "x" })).toBeUndefined();
    const found = await similarFixes(app.knowledge, "Endless re-render: the useEffect sets sortedItems and lists sortedItems in its dependencies list");
    expect(found.map((k) => k.id)).toContain(saved.id);
    expect(fixBrief(found)).toMatch(/Fixes that worked before/);
    expect(await similarFixes(app.knowledge, "The Styles palette has no tertiary colour")).toEqual([]);
  });

  it("promotes a fix to a switched-on skill for coders and debuggers", () => {
    const { app } = makeApp();
    const item = recordFix(app.knowledge, { projectId: "p", runId: "r", taskId: "t", step: "Step", attempts: 2, problems: ["Patch context mismatch in a component file"], guidance: ["Re-read the file before patching"], files: [], diff: "" })!;
    const skill = fixToSkill(item);
    expect(skill.id).toMatch(/^skill\.fix-/);
    expect(skill.enabled).toBe(true);
    expect(skill.roles).toEqual(["coder", "debugger"]);
    expect(skill.instructions).toContain("Re-read the file before patching");
  });
});

describe("pattern-style contains checks", () => {
  it("match every part, in order, on one line", async () => {
    const { wildcardLine } = await import("../src/quality/verification.js");
    const body = `  { id: "pacific-foods", image: "/images/photo-broth-vegetable.jpg", imageAlt: "A big bowl of clear vegetable broth" },\n  { id: "amys" }`;
    expect(wildcardLine(body, "pacific-foods.*bowl of clear vegetable broth")).toBe(true);
    expect(wildcardLine(body, "amys.*bowl of clear vegetable broth")).toBe(false);
    expect(wildcardLine(body, "no wildcard here")).toBe(false);
  });
});
