/** The three problems the "accent colour to teal" baseline run hit, each replayed and prevented. */
import { describe, expect, it } from "vitest";
import { alignCheckNames, closestToken, editGuard, tokenUsage, undefinedTokens } from "../src/orchestrator/guards.js";
import { BUILTIN_SKILLS, selectSkills } from "../src/knowledge/skills.js";

const TOKENS = new Set(["--color-accent", "--color-accent-hover", "--color-on-accent", "--color-text", "--font-sans", "--text-md"]);

describe("plan checks use the project's real token names", () => {
  it("maps an invented name to the real token and checks the declaration, not a var() fallback", () => {
    expect(closestToken("--accent-color", TOKENS)).toBe("--color-accent");
    const r = alignCheckNames("var(--accent-color, teal)", "src/styles/tokens.css", TOKENS, "Change the accent colour to teal");
    expect(r.text).toBe("--color-accent: teal");
    expect(r.drop).toBeFalsy();
    expect(r.note).toMatch(/--color-accent/);
  });
  it("keeps real names, keeps a new token the request asks for, and drops a name that matches nothing", () => {
    expect(alignCheckNames("--color-text", "src/styles/tokens.css", TOKENS, "x")).toEqual({ text: "--color-text", note: undefined });
    expect(alignCheckNames("--color-warning", "src/styles/tokens.css", TOKENS, "Add a --color-warning token").drop).toBeFalsy();
    expect(alignCheckNames("--sparkle-glow", "src/styles/tokens.css", TOKENS, "x").drop).toBe(true);
  });
});

describe("edit guards", () => {
  const tokens = [":root {", ...Array.from({ length: 200 }, (_, i) => `  --t-${i}: ${i}px;`), "  --color-accent: #4f46e5;", "}", ""].join("\n");
  it("refuses rewriting a large file to change one line, and says which line to patch", () => {
    const msg = editGuard("replace_file", "src/styles/tokens.css", tokens, { content: tokens.replace("#4f46e5", "teal") }, { patchMisses: 2 });
    expect(msg).toMatch(/rewrites all 204 lines/);
    expect(msg).toMatch(/--color-accent: teal/);
    expect(msg).toMatch(/read_file first/);
  });
  it("allows rewriting a small file, and a large rewrite that really changes most of it", () => {
    expect(editGuard("replace_file", "src/a.css", ":root {\n  --a: 1;\n}\n", { content: ":root {\n  --a: 2;\n}\n" }, { patchMisses: 0 })).toBeUndefined();
    expect(editGuard("replace_file", "src/styles/tokens.css", tokens, { content: tokens.replace(/px/g, "rem") }, { patchMisses: 0 })).toBeUndefined();
  });
  it("refuses declaring the same token twice in one block", () => {
    const css = ":root {\n  --color-accent: teal;\n  --accent-color: teal;\n}\n";
    const msg = editGuard("apply_patch", "src/styles/tokens.css", css, { edits: [{ find: "  --accent-color: teal;\n", replace: "  --accent-color: teal;\n  --accent-color: teal;\n" }] }, { patchMisses: 0 });
    expect(msg).toMatch(/--accent-color would be declared 2 times/);
    expect(editGuard("apply_patch", "src/styles/tokens.css", css, { edits: [{ find: "--color-accent: teal", replace: "--color-accent: #0d9488" }] }, { patchMisses: 0 })).toBeUndefined();
  });
});

describe("skills match on specific phrases, not loose words", () => {
  // Always-on skills (exact-patch, acceptance-checks) are left out: these tests are about what gets matched.
  const ids = (role: string, text: string) => selectSkills(BUILTIN_SKILLS, role, text).filter((s) => !s.triggers.includes("*")).map((s) => s.id);
  it("a one-value token change pulls in no design skills", () => {
    expect(ids("coder", "Update the accent color in design tokens to teal")).toEqual([]);
    expect(ids("planner", "Change the accent colour to teal")).toEqual([]);
  });
  it("the right skill still matches real requests", () => {
    expect(ids("planner", "Redesign the settings page layout")).toContain("skill.avoid-ai-slop");
    expect(ids("coder", "Add a new colour token for warnings")).toContain("skill.extend-tokens");
    expect(ids("coder", "Create a component for event cards")).toContain("skill.generate-component");
    expect(ids("coder", "Fix the reactive store")).not.toContain("skill.generate-component");
  });
});

describe("tokens still in use", () => {
  const before = ":root {\n  --color-accent: teal;\n  --accent-color: teal;\n  --color-border: #ddd;\n}\n";
  const usage = () =>
    tokenUsage([
      { rel: "src/styles/tokens.css", text: before },
      { rel: "src/styles/app.css", text: ".a { color: var(--color-accent); border: 1px solid var(--color-border); } .b { color: var(--maybe, red); }" },
    ]);
  it("refuses an edit that removes a token the app still uses, and allows removing an unused one", async () => {
    const { removesTokenInUse, afterEdit } = await import("../src/orchestrator/guards.js");
    const broken = afterEdit("apply_patch", before, { edits: [{ find: "  --color-accent: teal;\n  --accent-color: teal;\n", replace: "" }] })!;
    expect(removesTokenInUse("src/styles/tokens.css", before, broken, usage())).toMatch(/removes --color-accent, which the app still uses 1 time \(src\/styles\/app\.css\)/);
    const clean = afterEdit("apply_patch", before, { edits: [{ find: "  --accent-color: teal;\n", replace: "" }] })!;
    expect(removesTokenInUse("src/styles/tokens.css", before, clean, usage())).toBeUndefined();
  });
  it("lists tokens used but not defined, ignoring var() with a fallback", async () => {
    const after = tokenUsage([
      { rel: "src/styles/tokens.css", text: ":root {\n  --accent-color: teal;\n}\n" },
      { rel: "src/styles/app.css", text: ".a { color: var(--color-accent); border: 1px solid var(--color-border); } .b { color: var(--maybe, red); }" },
    ]);
    expect(undefinedTokens(after).map((t) => t.name).sort()).toEqual(["--color-accent", "--color-border"]);
    expect(undefinedTokens(usage())).toEqual([]);
  });
});
