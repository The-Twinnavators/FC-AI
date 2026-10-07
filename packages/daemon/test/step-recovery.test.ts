/** Keeping a run moving: split steps that are too big, and let independent steps go ahead (from the Calendar build). */
import { describe, expect, it } from "vitest";
import type { Task } from "@flowcode/contracts";
import { budgetOuts, buildSplit, independentOf, nearlyPassing, parseSplit, releaseIndependent, sentenceSplit } from "../src/orchestrator/stepRecovery.js";

const task = (id: string, over: Partial<Task>): Task =>
  ({ id, runId: "run_x", title: id, objective: `Do ${id}.`, status: "pending", dependsOn: [], expectedPaths: [], actualPaths: [], acceptanceCriteria: [], validationPlan: { kinds: [] }, role: "coder", specSections: [], ordinal: 0, attempts: 0, ...over }) as Task;

// The Calendar follow-up's plan: four steps on four different files, chained 1 → 2 → 3 → 4.
const STEP1_OBJECTIVE =
  "Rebuild the main screen with AppShell and PageHeader from src/components/ui (product name: Calendar). Build the toolbar, buttons, the Month / Week / Day switcher and the event form and dialog from Button, Field, Tabs, Card, Notice and Dialog. Keep the calendar grid's own styles, but take every colour, size and spacing value from the design tokens in src/styles/tokens.css.";
const calendar = () => [
  task("s1", { title: "Rebuild the main screen", objective: STEP1_OBJECTIVE, status: "blocked", expectedPaths: ["src/components/Calendar/Calendar.tsx"], acceptanceCriteria: [{ id: "a1", description: "PageHeader used", check: { type: "file_contains", path: "src/components/Calendar/Calendar.tsx", text: "PageHeader" }, evidenceRefs: [] } as never], ordinal: 0 }),
  task("s2", { title: "Replace the 2px gap", objective: "Replace the hard-coded 2px gap in src/styles/calendar.css with a spacing token.", status: "invalidated", dependsOn: ["s1"], expectedPaths: ["src/styles/calendar.css"], blocker: { reason: "Prerequisite", category: "prerequisite", evidenceRefs: [], nextAction: "" }, ordinal: 1 }),
  task("s3", { title: "Bigger privacy link", objective: "Make the Privacy notice link at least 44px tall.", status: "invalidated", dependsOn: ["s2"], expectedPaths: ["src/components/Privacy/PrivacyNotice.tsx"], blocker: { reason: "Prerequisite", category: "prerequisite", evidenceRefs: [], nextAction: "" }, ordinal: 2 }),
  task("s4", { title: "Real app name", objective: "Use the name Calendar in index.html.", status: "invalidated", dependsOn: ["s3"], expectedPaths: ["index.html"], blocker: { reason: "Prerequisite", category: "prerequisite", evidenceRefs: [], nextAction: "" }, ordinal: 3 }),
];

describe("independent steps go ahead", () => {
  it("releases the Calendar steps that don't touch the stuck step's files", () => {
    const { updates, notes } = releaseIndependent(calendar(), () => true);
    const by = new Map(updates.map((t) => [t.id, t]));
    expect(by.get("s2")).toMatchObject({ status: "pending", dependsOn: [] });
    expect(by.get("s3")?.status).toBe("pending");
    expect(by.get("s4")?.status).toBe("pending");
    expect(notes[0]).toMatch(/doesn't need "Rebuild the main screen"/);
  });

  it("keeps a step waiting when it shares or names the stuck step's files", () => {
    const [s1] = calendar();
    expect(independentOf(task("same", { expectedPaths: ["src/components/Calendar/Calendar.tsx"] }), s1)).toBe(false);
    expect(independentOf(task("dir", { expectedPaths: ["src/components/"] }), s1)).toBe(false);
    expect(independentOf(task("named", { expectedPaths: ["src/App.tsx"], objective: "Render the new Calendar.tsx screen in App." }), s1)).toBe(false);
    expect(independentOf(task("none", { expectedPaths: [] }), s1)).toBe(false);
    expect(independentOf(task("other", { expectedPaths: ["src/styles/calendar.css"] }), s1)).toBe(true);
    // The stuck step was to create a file that doesn't exist yet: later steps may need it.
    expect(independentOf(task("index", { expectedPaths: ["src/index.ts"] }), task("format", { expectedPaths: ["src/format.ts"] }), () => false)).toBe(false);
    expect(independentOf(task("assemble", { title: "Assemble the app: wire every page into App.tsx", expectedPaths: ["src/App.tsx"] }), s1)).toBe(false);
  });
});

describe("a coder giving up on its own work", () => {
  it("gets another try for the reasons seen in the Calendar (CSSVibes test) build", async () => {
    const { selfBlockIsWork } = await import("../src/orchestrator/stepRecovery.js");
    expect(selfBlockIsWork("The file src/lib/auth.ts does not exist in the workspace. It needs to be created as part of this task.")).toMatch(/create_file/);
    expect(selfBlockIsWork("The typecheck command is blocked due to policy restrictions. The task cannot proceed without running the typecheck to verify the code.")).toMatch(/isn't a permission problem/);
    expect(selfBlockIsWork("Typecheck fails with 3 errors in Calendar.tsx")).toMatch(/Fixing them is part of this step/);
    expect(selfBlockIsWork("The patch for serializeUrlParams in urlUtils.ts is already correct. No further changes needed.")).toMatch(/already done/);
    expect(selfBlockIsWork("The file src/screens/Calendar/EventCreationDialog.tsx contains components (DialogContent, DialogHeader, DialogTitle, DialogFooter) that are not building blocks in this project.")).toMatch(/Dialog is ONE component/);
    expect(selfBlockIsWork("The apply_patch tool is not making changes because the find and replace text are identical.")).toMatch(/patches changed nothing/);
    // Calendar test 7: a duplicated App was reported as a blocker instead of being removed.
    expect(selfBlockIsWork("The App.tsx file contains duplicate code blocks which need to be removed to prevent errors.")).toMatch(/write it once with replace_file/);
    // No GMO App, Home screen step: patches that changed nothing, then a give-up.
    expect(selfBlockIsWork("The apply_patch command is not producing any changes in the file. It's possible that the find text is not unique or the file has not been re-read properly. A different approach should be taken to modify the file.")).toMatch(/changed nothing[\s\S]*corrected code in "replace"/);
    // Calendar (CSSVibes test 2): the coder gave up after its patches kept missing.
    expect(selfBlockIsWork("Cannot apply patch due to repeated failure; need to re-read file and adjust approach.")).toMatch(/replace_file/);
    // Calendar (checklist plan, test 5): the building blocks "could not be found" after a search with a folder glob.
    const kit = selfBlockIsWork("The required components AppShell, Button, and PageHeader could not be found in the project. These components are expected to be part of the provided UI components in src/components/ui, but they are not present. Please ensure these components are available or create them if necessary.");
    expect(kit).toMatch(/They exist/);
    expect(kit).not.toMatch(/use create_file to make it/);
    // Calendar (checklist plan, test 3): the coder stopped because the shell was "already implemented".
    expect(selfBlockIsWork("The app shell and navigation structure is already implemented in src/App.tsx. The next step is to create the screens for the calendar app.")).toMatch(/task_complete/);
  });

  it("still stops for blocks only the user can resolve", async () => {
    const { selfBlockIsWork } = await import("../src/orchestrator/stepRecovery.js");
    expect(selfBlockIsWork("The spec doesn't say whether events can repeat; I need the user to decide.")).toBeUndefined();
    expect(selfBlockIsWork("An API key for the email service is required and isn't configured.")).toBeUndefined();
    // Anything that isn't the user's to settle goes back to the step (Calendar test 7, URL state step).
    expect(selfBlockIsWork("Failed to apply patch to urlUtils.ts. The apply_patch tool is inserting text instead of replacing the existing block.")).toMatch(/something this step can still do/);
  });
});

describe("splitting a step that is too big", () => {
  it("counts the attempts that ran out of actions", () => {
    expect(budgetOuts(["agent outcome: budget_exhausted (Turn budget of 30 exhausted without completion)", "typecheck failed", "agent outcome: budget_exhausted (x)"])).toBe(2);
  });

  it("accepts the planner's parts only when they are small and name real files", () => {
    const [s1] = calendar();
    const files = ["src/components/Calendar/Calendar.tsx", "src/components/Calendar/CalendarHeader.tsx", "src/components/EventDialog/EventDialog.tsx"];
    const ok = parseSplit({ steps: [
      { title: "Page shell", objective: "Wrap the calendar screen in AppShell and PageHeader.", files: ["src/components/Calendar/Calendar.tsx"] },
      { title: "Toolbar", objective: "Rebuild the toolbar and view switcher with Button and Tabs.", files: ["src/components/Calendar/CalendarHeader.tsx"] },
      { title: "Dialog", objective: "Rebuild the event dialog with Dialog and Field.", files: ["src/components/EventDialog/EventDialog.tsx", "src/nope/../../etc/passwd"] },
    ] }, s1, files)!;
    expect(ok.map((p) => p.files)).toEqual([["src/components/Calendar/Calendar.tsx"], ["src/components/Calendar/CalendarHeader.tsx"], ["src/components/EventDialog/EventDialog.tsx"]]);
    expect(parseSplit({ steps: [{ title: "All", objective: STEP1_OBJECTIVE, files: files }] }, s1, files)).toBeUndefined();
    expect(parseSplit("not json", s1, files)).toBeUndefined();
  });

  it("falls back to the step's own sentences, keeping the rules in every part", () => {
    const parts = sentenceSplit(calendar()[0])!;
    expect(parts).toHaveLength(2);
    expect(parts[0].objective).toMatch(/^Rebuild the main screen/);
    expect(parts[1].objective).toMatch(/^Build the toolbar/);
    expect(parts.every((p) => p.objective.includes("Keep the calendar grid's own styles"))).toBe(true);
  });

  it("chains the parts in place of the step and moves its file checks to the right part", () => {
    const [s1] = calendar();
    let n = 0;
    const pieces = buildSplit(s1, [
      { title: "Toolbar", objective: "Rebuild the toolbar with Button and Tabs.", files: ["src/components/Calendar/CalendarHeader.tsx"] },
      { title: "Page shell", objective: "Wrap the screen in AppShell and PageHeader.", files: ["src/components/Calendar/Calendar.tsx"] },
    ], () => `p${++n}`);
    expect(pieces.map((p) => p.dependsOn)).toEqual([[], ["p1"]]);
    expect(pieces[1].acceptanceCriteria.some((c) => c.check.type === "file_contains")).toBe(true);
    expect(pieces[0].acceptanceCriteria.some((c) => c.check.type === "file_contains")).toBe(false);
    expect(pieces.every((p) => p.acceptanceCriteria.some((c) => c.check.type === "verification"))).toBe(true);
    expect(pieces[0].objective).toMatch(/part 1 of 2/);
  });

  it("gives the step's acceptance-test check to its last part, so a split step is done only when its tests pass", () => {
    const [s1] = calendar();
    const step = { ...s1, acceptanceCriteria: [...s1.acceptanceCriteria, { id: "t", description: "The acceptance tests pass", check: { type: "verification" as const, kind: "tests:src/acceptance/calc.test.tsx" }, evidenceRefs: [] }] };
    let n = 0;
    const pieces = buildSplit(step, [
      { title: "Write the tests first", objective: "Write the acceptance tests.", files: ["src/acceptance/calc.test.tsx"] },
      { title: "Build it", objective: "Build the screen.", files: ["src/screens/Calc.tsx"] },
    ], () => `p${++n}`);
    const kinds = (i: number) => pieces[i].acceptanceCriteria.filter((c) => c.check.type === "verification").map((c) => (c.check as { kind: string }).kind);
    expect(kinds(0)).toEqual(["typecheck"]);
    expect(kinds(1)).toEqual(["tests:src/acceptance/calc.test.tsx", "typecheck"]);
  });
});

describe("split parts own their acceptance tests", () => {
  it("reads test titles, gives each earlier part a check for its own tests, and keeps the whole file for the last", async () => {
    const { testTitles, parsePartTests } = await import("../src/orchestrator/stepRecovery.js");
    const src = `describe("calendar", () => {\n  it("assigns evt-1001 to the first saved event", () => {});\n  test('signs in a registered account', async () => {});\n  it.skip(\`renders 42 date cells\`, () => {});\n});`;
    const titles = testTitles(src);
    expect(titles).toEqual(["assigns evt-1001 to the first saved event", "signs in a registered account", "renders 42 date cells"]);
    const step = task("ev", { acceptanceCriteria: [{ id: "t", description: "The acceptance tests pass", check: { type: "verification", kind: "tests:src/acceptance/ev.test.tsx" }, evidenceRefs: [] } as never] });
    const parts = parseSplit(
      { steps: [
        { title: "Event records", objective: "Generate ids and timestamps in src/sim/events.ts.", files: ["src/sim/events.ts"], tests: ["assigns evt-1001 to the first saved event", "not a real test"] },
        { title: "Sign in", objective: "Simulated sign-in in src/sim/auth.ts and the screen.", files: ["src/sim/auth.ts"], tests: ["signs in a registered account"] },
        { title: "Month view", objective: "Render the month grid in src/screens/CalendarScreen.tsx.", files: ["src/screens/CalendarScreen.tsx"], tests: ["renders 42 date cells"] },
      ] },
      step,
      ["src/sim/events.ts", "src/sim/auth.ts", "src/screens/CalendarScreen.tsx"],
      titles,
    )!;
    expect(parts[0].tests).toEqual(["assigns evt-1001 to the first saved event"]);
    let n = 0;
    const pieces = buildSplit(step, parts, () => `p${n++}`);
    const testKinds = (i: number) => pieces[i].acceptanceCriteria.map((c) => (c.check as { kind?: string }).kind ?? "").filter((k) => k.startsWith("tests:"));
    expect(parsePartTests(testKinds(0)[0])).toEqual({ file: "src/acceptance/ev.test.tsx", titles: ["assigns evt-1001 to the first saved event"] });
    expect(parsePartTests(testKinds(1)[0]).titles).toEqual(["signs in a registered account"]);
    // The last part still has to pass the whole file.
    expect(testKinds(2)).toEqual(["tests:src/acceptance/ev.test.tsx"]);
  });
});

describe("keeping nearly finished work", () => {
  it("keeps a step that stopped with nearly all its tests passing, and undoes one that was far off", () => {
    // Calendar design rebuild: stopped at 28 of 29 and all 16 file changes were undone.
    expect(nearlyPassing({ failed: 1, passed: 28 })).toBe(true);
    expect(nearlyPassing({ failed: 3, passed: 20 })).toBe(true);
    expect(nearlyPassing({ failed: 5, passed: 40 })).toBe(false);
    expect(nearlyPassing({ failed: 2, passed: 4 })).toBe(false);
    expect(nearlyPassing({ failed: 0, passed: 10 })).toBe(false);
  });
});
