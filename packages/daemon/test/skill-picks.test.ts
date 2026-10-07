/**
 * Which skills a step gets: design skills first for interface work, learned repair skills only once something failed,
 * and no skill picked by one everyday word ("register the service worker", "the PRD's colour roles", "calculator").
 * Also the app-wide palette check and the building-block refresh for older apps.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SkillSpec } from "@flowcode/contracts";
import { BUILTIN_SKILLS, capSkills, designSkillIds, selectSkills } from "../src/knowledge/skills.js";
import { designQa } from "../src/quality/designQa.js";
import { staleBlocks } from "../src/orchestrator/upgradeSteps.js";

const repair = { ...BUILTIN_SKILLS.find((s) => s.id === "skill.exact-patch")!, id: "skill.proposed-fix-tsx-patch-mismatch", source: "user", purpose: "Helps when patches fail in .tsx files because the find text doesn't match", triggers: ["component", "button", "ui"] } as SkillSpec;
const library = [...BUILTIN_SKILLS, repair];
const ids = (xs: SkillSpec[]) => xs.map((s) => s.id);
const pick = (text: string, retry = false) => {
  const design = designSkillIds(text).map((id) => library.find((s) => s.id === id)!).filter(Boolean);
  return ids(capSkills(selectSkills(library, "coder", text), [], undefined, { design, retry }));
};

describe("skills for a step", () => {
  it("doesn't pick a skill from one everyday word", () => {
    expect(pick("Serve offline assets\nMove the service worker to public/ and register it only in production builds")).not.toContain("skill.recipe-sign-in");
    expect(pick("Restyle the keys\nFollow the PRD's colour roles for number and operator keys")).not.toContain("skill.database-backed-feature");
    expect(pick("Implement calculator logic\nEvaluate expressions with operator precedence")).not.toContain("skill.data-simulation-scenarios");
    // Real requests still get them.
    expect(pick("Add sign-in\nBuild a sign-in screen with email and password")).toContain("skill.recipe-sign-in");
    expect(pick("Admin area\nAdd user roles and permissions with an audit trail")).toContain("skill.database-backed-feature");
  });

  it("gives interface steps the design skills first", () => {
    const tokens = pick("Define calculator design tokens\nAdd key colour tokens for the light and dark themes");
    expect(tokens.slice(0, 3)).toEqual(["skill.interface-design-system", "skill.extend-tokens", "skill.avoid-ai-slop"]);
    expect(pick("Build the history screen\nList past calculations")).toContain("skill.design-playbook-custom-ux");
    expect(designSkillIds("Evaluate expressions with operator precedence")).toEqual([]);
    // Screens are art-directed first (a concept and portfolio-level craft), with the anti-generic rules kept.
    expect(designSkillIds("Design the main screens\nCompose each screen")).toEqual(["skill.art-direction", "skill.interface-design-system", "skill.design-playbook-custom-ux", "skill.avoid-ai-slop"]);
  });

  it("keeps learned repair skills for retries", () => {
    const text = "Build the keypad component\nA button for each key";
    expect(pick(text).indexOf(repair.id)).toBe(-1);
    expect(pick(text, true)[0]).toBe(repair.id);
  });
});

function app(files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-skillpicks-"));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return { root } as never;
}

describe("palette check", () => {
  it("flags colours that aren't from the Styles palette, in tokens and component stylesheets", () => {
    const tokens = ":root {\n  --color-accent: #042935;\n  --brand-secondary-100: #ccf3ff;\n  --neutral-50: #f7fbff;\n  --status-error-500: #c33;\n  --key-operator-bg: #d9eaff;\n  --key-equals-bg: var(--brand-primary-900);\n}\n";
    const off = designQa(app({ "src/styles/tokens.css": tokens, "src/screens/Calc.css": ".calc { --clear-bg: #fef0c7; background: var(--clear-bg); }\n" })).filter((f) => f.rule === "off-palette");
    expect(off).toHaveLength(2);
    expect(off.every((f) => f.severity === "serious")).toBe(true);
    expect(off.map((f) => f.message).join(" ")).toMatch(/--key-operator-bg: #d9eaff.*--clear-bg: #fef0c7|--clear-bg: #fef0c7.*--key-operator-bg: #d9eaff/s);
    expect(off.map((f) => f.message).join(" ")).not.toMatch(/--color-accent|--brand-|--neutral-|--status-|--key-equals-bg/);
  });
});

describe("building-block refresh", () => {
  const starter = path.resolve(__dirname, "../../../templates/react-vite-starter");
  const current = fs.readFileSync(path.join(starter, "src/components/ui/index.tsx"), "utf8");

  it("updates an old copy, leaves current and extended copies alone", () => {
    const old = current.replace("{screens.length > 1 ? (", "{true ? (");
    // Kit files the app lacks (src/sim came later) are added too.
    expect(staleBlocks(app({ "src/components/ui/index.tsx": old }))).toEqual(expect.arrayContaining(["src/components/ui/index.tsx", "src/sim/index.ts"]));
    expect(staleBlocks(app({ "src/components/ui/index.tsx": current }))).not.toContain("src/components/ui/index.tsx");
    expect(staleBlocks(app({ "src/components/ui/index.tsx": `${old}\nexport function KeypadGrid() { return null; }\n` }))).not.toContain("src/components/ui/index.tsx");
  });
});
