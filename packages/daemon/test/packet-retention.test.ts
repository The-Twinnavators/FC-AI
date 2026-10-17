/**
 * After fitting, a coding step's request still carries what it needs for this task: its objective and checks, what the
 * PRD says about its screens and navigation, the contracts of the pieces its screens import, how App.tsx renders the
 * screens, its own files and the located diagnostics of a correction. At the frame step's real budget (qwen3:8b, 24k
 * window, 3.6 characters a token, the recorded system prompt and tool definitions), with the real Clean Cart PRD,
 * App.tsx and Home screen. When that mandatory material can't fit, fitting reports an overflow (the step is then split,
 * or blocked for the person when it can't be): nothing is silently removed.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Run, Task } from "@flowcode/contracts";
import { buildHandoff, fitHandoff } from "../src/orchestrator/handoff.js";
import { requestBudget } from "../src/orchestrator/requestBudget.js";
import { importedPieceContracts, navigationContract, screenRequirements, touchesNavigation } from "../src/orchestrator/packetContext.js";

const fx = (f: string) => fs.readFileSync(path.join(import.meta.dirname, "fixtures/packet", f), "utf8");
const SCREENS = ["Home (landing page)", "Categories", "Category", "Search", "Product", "Grocery lists"];

function app() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-packet-"));
  fs.mkdirSync(path.join(root, "src/screens"), { recursive: true });
  fs.mkdirSync(path.join(root, "src/lib"), { recursive: true });
  fs.writeFileSync(path.join(root, "src/App.tsx"), fx("App.tsx.txt"));
  fs.writeFileSync(path.join(root, "src/screens/HomeLandingPageScreen.tsx"), fx("HomeLandingPageScreen.tsx.txt"));
  fs.writeFileSync(path.join(root, "src/lib/screens.ts"), "export function useScreen() {}\n");
  return root;
}

const frameTask = (): Task =>
  ({
    id: "task_frame",
    runId: "run_x",
    title: "Design App Frame and Navigation",
    objective: "Choose the navigation pattern for each screen (sidebar, top bar, tab bar) and restyle AppShell through ui-shell__* classes in components.css or replace it with a custom frame component in components/. Ensure the frame carries the brand's logo, color, and typography from tokens.css.",
    status: "running",
    dependsOn: [],
    expectedPaths: ["src/styles/components.css", "src/components/ui/screen-parts.tsx"],
    actualPaths: [],
    acceptanceCriteria: [
      { id: "tc", description: "The project still type-checks after this part", check: { type: "verification", kind: "typecheck" }, evidenceRefs: [] },
      { id: "fd", description: "The app frame is designed: the ui-shell__* rules are restyled or the frame is replaced by the app's own component", check: { type: "verification", kind: "frame-designed" }, evidenceRefs: [] },
    ],
    validationPlan: { kinds: [] },
    role: "coder",
    ordinal: 9,
    attempts: 2,
  }) as unknown as Task;

const run = { id: "run_x", projectId: "p", objective: "Clean Cart: an information app that helps people find food with no GMO and no bio-engineered ingredients, see which stores near their ZIP code carry it, and keep grocery lists.", status: "running", modelAssignments: {}, planApproved: true, constraints: [], createdAt: "", attachedKnowledgeIds: [], referencePaths: ["spec/non-gmo-market-prd.md"] } as unknown as Run;

// The packet as agentAttempt assembles it for the frame step, with a long CSS file, a large knowledge item (the PRD),
// design guidance and a correction brief, all competing for the budget.
function packetFor(root: string, task: Task, correction: string) {
  const md = fx("prd.md");
  const requirements = [screenRequirements(md, SCREENS, touchesNavigation(task))!];
  const contracts = [...importedPieceContracts(root, ["src/screens/HomeLandingPageScreen.tsx"]), { name: "Navigation contract (src/App.tsx)", text: navigationContract(root)! }];
  const css = Array.from({ length: 280 }, (_, i) => `${String(i + 1).padStart(4)}| .ui-shell__rule-${i} { color: var(--color-ink); padding: var(--space-2); }`).join("\n");
  return buildHandoff({
    run,
    task,
    allTasks: [task],
    files: [{ path: "src/styles/components.css (line-numbered; line prefixes are not part of the file)", content: css }],
    findings: [correction, "attempt ended with no_action: earlier attempt notes"],
    guidance: ["Design direction: ".padEnd(4000, "x")],
    requirements,
    contracts,
    knowledge: [{ id: "k1", title: "Spec: non-gmo-market-prd.md", content: md, provenance: [], tags: [], pinned: false } as never],
  });
}

describe("what survives fitting", () => {
  it("keeps the frame step's objective, checks, screen and navigation requirements, piece contracts, App.tsx contract, own file and correction evidence at its real budget", () => {
    const root = app();
    const task = frameTask();
    const correction = `Focused correction: fix a type error and nothing else. The step's other work is done and stays as it is.\n- src/App.tsx:19 TS2741: Property 'onNavigate' is missing in type '{}'\n${"   19|       {current === \"home-landing-page\" ? <HomeLandingPageScreen /> : null}\n".repeat(6)}`;
    // The frame step's recorded request: qwen3:8b, 24k window, 3.6 characters a token; system 10,057 and tools 13,378.
    const budget = requestBudget({ windowTokens: 24_576, replyTokens: 4096, charsPerToken: 3.6, hosted: false });
    const room = budget.inputChars - 10_057 - 13_378;
    const fitted = fitHandoff(packetFor(root, task, correction), "src/\n".repeat(120), ["typecheck", "lint", "test"], room);
    expect(fitted.overflow).toBe(0);
    const t = fitted.text;
    expect(t).toContain("Choose the navigation pattern for each screen");
    expect(t).toContain("The app frame is designed");
    expect(t).toContain("The project still type-checks after this part");
    // Product: the PRD's screen rows and navigation, though the whole PRD (knowledge) is left out.
    expect(t).toMatch(/\| Home \(landing page\) \| What Clean Cart is/);
    expect(t).toMatch(/\| Grocery lists \|/);
    expect(t).toContain("The PRD's navigation:");
    expect(fitted.dropped).toContain('knowledge "Spec: non-gmo-market-prd.md"');
    // Contracts: every piece Home imports, and how App.tsx renders the screens.
    for (const piece of ["HeroSplit", "ShopCollection", "FeaturesAlternating", "CtaBanner"]) expect(t).toContain(`src/sections/${piece}.tsx`);
    expect(t).toContain("<HomeLandingPageScreen /> (no props: the screen must not require any)");
    // Its own file (shortened, not dropped) and the correction's located evidence (never shortened).
    expect(t).toContain("src/styles/components.css");
    expect(t).toContain(correction.slice(0, 200));
    expect(t).toContain("Property 'onNavigate' is missing");
  });

  it("reports an overflow instead of silently dropping requirements when the mandatory material can't fit", () => {
    const root = app();
    const fitted = fitHandoff(packetFor(root, frameTask(), "Focused correction: fix a type error."), "src/\n", [], 3000);
    expect(fitted.overflow).toBeGreaterThan(0);
    // Mandatory material is still in the text that would be sent (it is never removed to fit).
    expect(fitted.text).toContain("What the PRD says each screen shows:");
    expect(fitted.text).toContain("Navigation contract (src/App.tsx)");
  });

  it("finds the frame and screen-wiring steps that need the navigation context, and not others", () => {
    expect(touchesNavigation(frameTask())).toBe(true);
    expect(touchesNavigation({ title: "Write the Search screen's tests", objective: "Three tests", expectedPaths: ["src/acceptance/search.test.tsx"] })).toBe(false);
    expect(touchesNavigation({ title: "Wire the screens", objective: "", expectedPaths: ["src/App.tsx"] })).toBe(true);
  });
});
