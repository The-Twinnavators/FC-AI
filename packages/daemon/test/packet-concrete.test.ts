/**
 * Folder-scoped steps get concrete, bounded files; their packets carry the contracts of what those files import and
 * how App.tsx renders the screens (route tables included); splits produce parts that can each run as a step. Fixtures:
 * the Clean Cart slice's generated look-up app (its design step's real paths and objective, eval 1) and the controlled
 * build's starter-kit app (a differently structured App.tsx).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Task } from "@flowcode/contracts";
import { concreteTargets, importedPieceContracts, navigationContract, screenRequirements } from "../src/orchestrator/packetContext.js";
import { buildHandoff, fitHandoff } from "../src/orchestrator/handoff.js";
import { requestBudget } from "../src/orchestrator/requestBudget.js";
import { partProblems, sentenceSplit, parseSplit } from "../src/orchestrator/stepRecovery.js";

const FX = path.join(import.meta.dirname, "fixtures/apps");
function app(name: string, extra: Record<string, string> = {}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `fc-${name}-`));
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (e.name.endsWith(".txt")) {
        const rel = path.relative(path.join(FX, name), abs).replace(/\.txt$/, "");
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.copyFileSync(abs, path.join(root, rel));
      }
    }
  };
  walk(path.join(FX, name));
  for (const [rel, text] of Object.entries(extra)) (fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }), fs.writeFileSync(path.join(root, rel), text));
  return root;
}
const designStep = JSON.parse(fs.readFileSync(path.join(FX, "design-step.json"), "utf8")) as { title: string; objective: string; expectedPaths: string[] };
const plan = JSON.parse(fs.readFileSync(path.join(FX, "screen-plan.json"), "utf8")) as Array<{ label: string; file: string }>;

describe("concrete files for a folder-scoped step", () => {
  it("turns the slice design step's src/screens/ and src/styles/ into a bounded list of its files, and names the rest", () => {
    const root = app("lookup");
    const t = concreteTargets(root, designStep, plan);
    // The screens it names and the planned ones, at most six; the stylesheets it names (tokens.css, components.css).
    expect(t.files.filter((f) => f.startsWith("src/screens/"))).toHaveLength(6);
    expect(t.files).toEqual(expect.arrayContaining(["src/screens/SavedScreen.tsx", "src/screens/ProductScreen.tsx", "src/styles/tokens.css", "src/styles/components.css"]));
    expect(t.files.every((f) => !f.endsWith("/"))).toBe(true);
    expect(t.gaps.join(" ")).toMatch(/src\/screens\/: 2 more relevant files not attached/);
  });

  it("works on a differently structured app: a file path stays, a folder resolves from App.tsx's imports, an empty folder is a gap", () => {
    const root = app("shell", { "src/screens/HomeLandingPageScreen.tsx": "export default function H() { return null; }\n", "src/screens/Unused.tsx": "export default function U() { return null; }\n", "src/styles/components.css": ".ui-shell{}\n" });
    const t = concreteTargets(root, { title: "Restyle the frame", objective: "Restyle AppShell.", expectedPaths: ["src/styles/components.css", "src/screens/", "src/widgets/"] }, []);
    expect(t.files).toEqual(["src/styles/components.css", "src/screens/HomeLandingPageScreen.tsx"]);
    expect(t.gaps).toEqual(["src/widgets/ has no files to work on yet"]);
  });

  it("reports a folder none of whose files the step, the plan or the app points at, instead of attaching it all", () => {
    const root = app("shell", { "src/notes/a.md": "a\n", "src/notes/b.md": "b\n" });
    const t = concreteTargets(root, { title: "Write the notes", objective: "Write them.", expectedPaths: ["src/notes/"] }, []);
    expect(t.files).toEqual([]);
    expect(t.gaps[0]).toMatch(/^src\/notes\/: none of its 2 files is named by the step/);
  });
});

describe("contracts for the concrete files", () => {
  it("reads the slice's route table, its screens' props and its link with no working page", () => {
    const c = navigationContract(app("lookup"))!;
    expect(c).toContain("<LandingScreen /> (no props: the screen must not require any)");
    expect(c).toContain("#/landing → LandingScreen");
    expect(c).toContain("Navigation links with no working page yet: Search (#/search).");
  });

  it("gives the pieces the slice's screens import", () => {
    const root = app("lookup");
    const files = concreteTargets(root, designStep, plan).files.filter((f) => f.endsWith(".tsx"));
    const names = importedPieceContracts(root, files, 6).map((c) => c.name);
    expect(names.some((n) => n.includes("src/sections/LookupCatalog.tsx"))).toBe(true);
    expect(names.some((n) => n.includes("src/sections/LookupEntry.tsx"))).toBe(true);
  });
});

describe("the slice design step's packet at its recorded budgets", () => {
  // qwen3-coder:30b, 24k window, 4.0 characters a token; system 19,152 (coder) or 9,706 (debugger), tools 15,808 / 13,378.
  const fitAt = (systemChars: number, toolsChars: number) => {
    const root = app("lookup");
    const t = concreteTargets(root, designStep, plan);
    const files = t.files.map((p) => ({ path: `${p} (line-numbered; line prefixes are not part of the file)`, content: fs.readFileSync(path.join(root, p), "utf8").split("\n").slice(0, 260).map((l, i) => `${String(i + 1).padStart(4)}| ${l}`).join("\n") }));
    const prd = fs.readFileSync(path.join(import.meta.dirname, "../../../docs/handoff/slice/clean-cart-slice-prd.md"), "utf8");
    const contracts = [...importedPieceContracts(root, t.files.filter((f) => f.endsWith(".tsx")), 6), { name: "Navigation contract (src/App.tsx)", text: navigationContract(root)! }];
    const task = { id: "t", title: designStep.title, objective: designStep.objective, expectedPaths: designStep.expectedPaths, acceptanceCriteria: [], dependsOn: [], actualPaths: [] } as unknown as Task;
    const packet = buildHandoff({ run: { objective: "Clean Cart slice", constraints: [], referencePaths: [] } as never, task, allTasks: [task], files, requirements: [screenRequirements(prd, plan.map((s) => s.label), true)!], contracts });
    const budget = requestBudget({ windowTokens: 24_576, replyTokens: 4096, charsPerToken: 4.0, hosted: false });
    return { t, fitted: fitHandoff(packet, "src/\n", ["typecheck"], budget.inputChars - systemChars - toolsChars) };
  };

  it("never drops the step's own files, screen requirements or contracts; with the coder's system prompt it reports an overflow (split or block), with the debugger's it fits", () => {
    const coder = fitAt(19_152, 15_808);
    for (const f of coder.t.files) expect(coder.fitted.text).toContain(f);
    expect(coder.fitted.text).toContain("What the PRD says each screen shows:");
    expect(coder.fitted.text).toContain("Navigation contract (src/App.tsx)");
    expect(coder.fitted.text).toContain("src/sections/LookupEntry.tsx, imported by src/screens/ProductScreen.tsx");
    expect(coder.fitted.overflow).toBeGreaterThan(0);
    const dbg = fitAt(9_706, 13_378);
    expect(dbg.fitted.overflow).toBe(0);
    for (const f of dbg.t.files) expect(dbg.fitted.text).toContain(f);
  });
});

describe("splits that can run", () => {
  const parent = { id: "t", title: designStep.title, objective: designStep.objective, expectedPaths: designStep.expectedPaths, acceptanceCriteria: [] } as unknown as Task;

  it("rejects the slice's recorded part 1: no files and only the step's own first sentence", () => {
    const part1 = { title: "Design the complete app like a senior product designer", objective: designStep.objective.split(/(?<=[.;])\s+(?=[A-Z])/)[0]!, files: [] };
    expect(partProblems(part1, designStep.objective)).toEqual([`"${part1.title}" has no files to change`, `"${part1.title}" only repeats the step's own summary and names none of its files`]);
  });

  it("splits by sentence only into parts that name their files; otherwise doesn't split", () => {
    expect(sentenceSplit(parent, [])).toBeUndefined();
    const t = { ...parent, objective: "Restyle the frame in src/styles/components.css with the brand colours. Rewrite the hero on LandingScreen with the PRD's promise. Keep the pages working." } as Task;
    const parts = sentenceSplit(t, ["src/styles/components.css", "src/screens/LandingScreen.tsx"])!;
    expect(parts.map((p) => p.files)).toEqual([["src/styles/components.css"], ["src/screens/LandingScreen.tsx"]]);
    expect(parts.every((p) => !partProblems(p, t.objective).length)).toBe(true);
  });

  it("gives each long file a part of its own (two long stylesheets together are the too-broad step again)", () => {
    const lines = (f: string) => ({ "src/styles/tokens.css": 284, "src/styles/components.css": 283, "src/screens/LandingScreen.tsx": 28 })[f] ?? 0;
    const both = { title: "Look", objective: "Restyle src/styles/tokens.css and src/styles/components.css.", files: ["src/styles/tokens.css", "src/styles/components.css"] };
    expect(partProblems(both, designStep.objective, lines)).toEqual(['"Look" has more than one long file (src/styles/tokens.css, src/styles/components.css); give each its own part']);
    expect(partProblems({ ...both, files: ["src/styles/tokens.css", "src/screens/LandingScreen.tsx"] }, designStep.objective, lines)).toEqual([]);
  });

  it("keeps a model's parts only when each has files and its own objective", () => {
    const raw = { steps: [
      { title: "Frame", objective: "Restyle the LookupFrame bar in src/styles/components.css: brand colour and type.", files: ["src/styles/components.css"] },
      { title: "Copy", objective: designStep.objective.slice(0, 120), files: [] },
      { title: "Home", objective: "Compose LandingScreen's hero from the PRD's summary line.", files: ["src/screens/LandingScreen.tsx"] },
    ] };
    const parts = parseSplit(raw, parent, ["src/styles/components.css", "src/screens/LandingScreen.tsx"])!;
    expect(parts.map((p) => p.title)).toEqual(["Frame", "Home"]);
  });
});
