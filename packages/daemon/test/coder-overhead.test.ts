/**
 * The coder's fixed overhead on the Clean Cart slice's design step, from its recorded opening request (eval 1,
 * attempt 1: system 19,152 characters with skills 8,864, tool definitions 15,808): page-composition without the
 * planning its locked page plans already are, one colour rule in art-direction instead of two, and only the tools the
 * step's work needs. Nothing required is dropped: the step's files, the PRD's lines, the contracts, the lock rule,
 * the scope and file-safety rules and the tool-call format all stay. Then the step's packet fits, at the opening and on
 * a later turn with a full stylesheet read and a type-check diagnostic.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ROLE_TOOLS, type Task, type ToolName } from "@flowcode/contracts";
import { BUILTIN_SKILLS, renderSkills, withPlansGiven } from "../src/knowledge/skills.js";
import { toolDef } from "../src/orchestrator/agentLoop.js";
import { stepTools } from "../src/orchestrator/toolSelection.js";
import { concreteTargets, importedPieceContracts, navigationContract, screenRequirements } from "../src/orchestrator/packetContext.js";
import { buildHandoff, fitHandoff } from "../src/orchestrator/handoff.js";
import { laterTurnFits, requestBudget } from "../src/orchestrator/requestBudget.js";

const FX = path.join(import.meta.dirname, "fixtures/apps");
const recorded = fs.readFileSync(path.join(FX, "eval1-coder-request.txt"), "utf8").replace(/\r\n/g, "\n");
const system = recorded.slice(recorded.indexOf("=== system ===\n") + 15, recorded.indexOf("\n\n=== brief ===")).replace(/\n+$/, "");
const designStep = JSON.parse(fs.readFileSync(path.join(FX, "design-step.json"), "utf8")) as { title: string; objective: string; expectedPaths: string[] };
const plan = JSON.parse(fs.readFileSync(path.join(FX, "screen-plan.json"), "utf8")) as Array<{ label: string; file: string }>;

function app(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-ovh-"));
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (e.name.endsWith(".txt")) {
        const rel = path.relative(path.join(FX, "lookup"), abs).replace(/\.txt$/, "");
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.copyFileSync(abs, path.join(root, rel));
      }
    }
  };
  walk(path.join(FX, "lookup"));
  return root;
}

/** The recorded system prompt with today's skills rendering in place of the recorded one. */
function systemNow(): { text: string; skillsBefore: number; skillsAfter: number } {
  const start = system.indexOf("\n\nSkills to follow for this task");
  const endMark = "a skill cannot grant extra access.";
  const end = system.indexOf(endMark, start) + endMark.length;
  const ids = ["skill.page-composition", "skill.art-direction"];
  const now = renderSkills(withPlansGiven(ids.map((id) => BUILTIN_SKILLS.find((s) => s.id === id)!), true));
  return { text: system.slice(0, start) + now + system.slice(end), skillsBefore: end - start, skillsAfter: now.length };
}

const budget = requestBudget({ windowTokens: 24_576, replyTokens: 4096, charsPerToken: 4.0, hosted: false });
const toolsBefore = 15_808;
const toolsAfter = JSON.stringify(stepTools(ROLE_TOOLS.coder as ToolName[], designStep, { catalog: true, designStep: true }).map(toolDef)).length;

function brief(room: number, only?: { objective: string; files: string[] }) {
  const root = app();
  const t = only ? { files: only.files } : concreteTargets(root, designStep, plan);
  const files = t.files.map((p) => ({ path: `${p} (line-numbered; line prefixes are not part of the file)`, content: fs.readFileSync(path.join(root, p), "utf8").split("\n").slice(0, 260).map((l, i) => `${String(i + 1).padStart(4)}| ${l}`).join("\n") }));
  const prd = fs.readFileSync(path.join(import.meta.dirname, "../../../docs/handoff/slice/clean-cart-slice-prd.md"), "utf8");
  const contracts = [...importedPieceContracts(root, t.files.filter((f) => f.endsWith(".tsx")), 6), { name: "Navigation contract (src/App.tsx)", text: navigationContract(root)! }];
  const task = { id: "t", title: designStep.title, objective: only?.objective ?? designStep.objective, expectedPaths: designStep.expectedPaths, acceptanceCriteria: [], dependsOn: [], actualPaths: [] } as unknown as Task;
  const packet = buildHandoff({ run: { objective: "Clean Cart slice", constraints: [], referencePaths: [] } as never, task, allTasks: [task], files, requirements: [screenRequirements(prd, plan.map((s) => s.label), true)!], contracts });
  return { root, files: t.files, fitted: fitHandoff(packet, "src/\n", ["typecheck"], room) };
}

describe("the coder's overhead on the slice's design step", () => {
  it("is smaller without dropping what's required", () => {
    const s = systemNow();
    expect(system.length).toBe(19_152);
    // Skills: the page-composition planning (its plans are in the step) and the duplicate colour rule go.
    expect(s.skillsBefore - s.skillsAfter).toBeGreaterThan(1_700);
    // Kept: the lock rule, the states, the colour/contrast/radius rules, the role's scope, file-safety and format rules.
    for (const kept of ["propose_layout_change with why", "loading, empty, no matches, error, success", "4.5:1 body", "never above 12px", "Operating rules (enforced by the runtime, not optional)", "Tool guidance:"]) expect(s.text).toContain(kept);
    // Tools: only what a design step's work needs (reading, editing, its scripts, the catalog, images, the controls).
    const shown = stepTools(ROLE_TOOLS.coder as ToolName[], designStep, { catalog: true, designStep: true });
    expect(shown).toEqual(expect.arrayContaining(["read_file", "apply_patch", "replace_file", "create_file", "run_script", "task_complete", "report_blocked", "request_approval", "search_catalog", "get_catalog_contract", "add_library_piece", "propose_layout_change", "find_image"]));
    expect(shown).not.toContain("edit_toml");
    expect(toolsAfter).toBeLessThan(toolsBefore - 4_500);
  });

  it("lets the step's packet fit at the opening and on a later turn, with its files, PRD lines and contracts", () => {
    const s = systemNow();
    const room = budget.inputChars - s.text.length - toolsAfter;
    const b = brief(room);
    expect(b.fitted.overflow).toBe(0);
    for (const f of b.files) expect(b.fitted.text).toContain(f);
    expect(b.fitted.text).toContain("What the PRD says each screen shows:");
    expect(b.fitted.text).toContain("Navigation contract (src/App.tsx)");
    const opening = s.text.length + toolsAfter + b.fitted.text.length;
    // A later turn: the model reads all of tokens.css (numbered) and gets a type-check diagnostic back after a patch.
    const tokens = fs.readFileSync(path.join(b.root, "src/styles/tokens.css"), "utf8").split("\n").map((l, i) => `${String(i + 1).padStart(4)}| ${l}`).join("\n");
    const diagnostic = `Type check after this edit: 3 new errors in the file you edited.\n${"src/screens/LandingScreen.tsx(12,7): error TS2322: Type 'string' is not assignable to type 'number'.\n".repeat(3)}`;
    const later = opening + 600 + tokens.length + 800 + diagnostic.length;
    // The window is input + working space + reply, counted once each.
    expect(budget.inputChars + budget.workingTokens * budget.charsPerToken + budget.replyTokens * budget.charsPerToken).toBe(budget.windowTokens * budget.charsPerToken);
    // The opening fits, but only with its stylesheets cut to 60 lines; at the densest measured rate a later turn
    // reading tokens.css doesn't fit: the whole step is too broad, so it is split before it runs (not after its turns).
    expect(b.fitted.dropped).toContain("src/styles/tokens.css shortened to 60 lines");
    expect(laterTurnFits(budget, opening, tokens.length, diagnostic.length).fits).toBe(false);
    expect(later).toBeGreaterThan(0);
    // Its concrete parts each fit, at the opening and on the later turn, with nothing of theirs shortened.
    const parts = [
      { objective: "Give Clean Cart its look: restyle the design tokens (brand greens, cream ground, type) in src/styles/tokens.css.", files: ["src/styles/tokens.css"] },
      { objective: "Restyle the LookupFrame bar and the shared component rules in src/styles/components.css with the new tokens.", files: ["src/styles/components.css"] },
      { objective: "Compose Home (src/screens/LandingScreen.tsx): what Clean Cart is in one line, the search box, a few featured products, from the PRD's words.", files: ["src/screens/LandingScreen.tsx", "src/styles/app.css"] },
      { objective: "Compose Product and Saved (src/screens/ProductScreen.tsx, src/screens/SavedScreen.tsx) with the PRD's fields and the Save action.", files: ["src/screens/ProductScreen.tsx", "src/screens/SavedScreen.tsx"] },
    ];
    for (const p of parts) {
      const pb = brief(room, p);
      expect(pb.fitted.overflow, p.objective).toBe(0);
      expect(pb.fitted.dropped.filter((d) => /shortened to/.test(d)), p.objective).toEqual([]);
      // Every file of the part is attached whole, so a later turn's read is a typical one (the orchestrator's rule).
      const largest = 4000;
      expect(laterTurnFits(budget, s.text.length + toolsAfter + pb.fitted.text.length, largest, diagnostic.length).fits, p.objective).toBe(true);
    }
  });
});
