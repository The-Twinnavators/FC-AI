/**
 * The prototype plan (launch-readiness-checklist-rebuild-guide.md): every item has a prompt in the standard format,
 * every PRD requirement is placed, code items become build steps, and the guide's rules hold. The Launch readiness
 * checklist lists the plan's features as real-app work with prompts of its own.
 */
import { describe, expect, it } from "vitest";
import { ALWAYS_CONSTRAINT, PROMPT_HEADINGS, buildTaskPrompt, generatedTaskPrompt, lintAiPrompt, promptConfigFor, taskPromptFor } from "../src/quality/taskPrompt.js";
import { batchItems, groupSteps, isProjectSection, placeBySection, sectionRole, parseBatch, planBatches, planKey, requirementItem, stepsFromGroups, uniqueIds, type LrcPlan } from "../src/quality/lrcPlan.js";
import { PromptLintError, addLaunchTask, editLaunchItem, launchLevel, launchReadiness, setLaunchNotes } from "../src/quality/launchReadiness.js";
import { extractRequirements } from "../src/quality/spec.js";
import { makeApp, makeProject } from "./helpers.js";

const cfg = promptConfigFor({ stack: "React 19 + Vite + TypeScript", scripts: ["typecheck", "build", "lint"] });

const PRD = [
  "# Basic calendar",
  "## 1. Goals",
  "- Users plan their week in under a minute.",
  "- Weekly active use above 40%.",
  "## 4. Calendar views",
  "- The app shows a Month view with today highlighted.",
  "- Users switch between Month, Week and Day views.",
  "- The Week view lists events by hour.",
  "## 5. Events",
  "- Users create an event with a title, date and time.",
  "- Users edit and delete events.",
  "- Events are saved in `localStorage` under `calendar.events`.",
].join("\n");

describe("the prompt standard", () => {
  it("builds every section in order and always fences unrelated changes", () => {
    const p = buildTaskPrompt({ title: "Month view", goal: "The Month view shows today.", context: "src/screens/Month.tsx", steps: ["Open it", "Highlight today"], acceptance: ["Today is highlighted"] });
    const at = PROMPT_HEADINGS.map((h) => p.indexOf(h));
    expect(at.every((x) => x > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(p).toContain(ALWAYS_CONSTRAINT);
    expect(p).not.toContain("## Human sign-off");
    expect(lintAiPrompt(p)).toEqual([]);
  });

  it("generates a lint-clean prompt for every kind of item, with human sign-off for sensitive work", () => {
    const base = { title: "Privacy notice accurate", detail: "Says what the product stores.", categoryTitle: "Privacy & legal" };
    for (const kind of ["code", "manual", "review", "task"] as const)
      for (const categoryId of ["a11y", "privacy", "auth", "payments"]) {
        const p = generatedTaskPrompt({ ...base, kind, categoryId, autoCheck: kind === "code" ? "typecheck" : undefined }, cfg);
        expect(lintAiPrompt(p, { categoryId }), `${kind}/${categoryId}`).toEqual([]);
        expect(p.includes("## Human sign-off")).toBe(["privacy", "auth", "payments"].includes(categoryId));
      }
    // Manual work stays human: the agent reports, it doesn't claim the step is done.
    expect(generatedTaskPrompt({ ...base, kind: "manual", categoryId: "docs" }, cfg)).toMatch(/Do not mark this item complete/);
    // A check-backed item names the check that proves it.
    expect(generatedTaskPrompt({ ...base, title: "Type check passes", kind: "code", categoryId: "foundation", autoCheck: "typecheck" }, cfg)).toMatch(/npm run typecheck/);
  });

  it("uses a stored prompt when there is one", () => {
    const src = { title: "x", detail: "", kind: "code" as const, categoryId: "docs", categoryTitle: "Docs" };
    expect(taskPromptFor("  ", src, cfg).authored).toBe(false);
    expect(taskPromptFor("# mine", src, cfg)).toEqual({ prompt: "# mine", authored: true });
  });

  it("lint catches each problem type", () => {
    const good = buildTaskPrompt({ title: "t", goal: "g", context: "c", steps: ["s"], acceptance: ["a"] });
    expect(lintAiPrompt("")).toEqual([]); // empty means "use the generated prompt"
    expect(lintAiPrompt(good.replace("## Steps", "## Things"))).toEqual(['missing the "Steps" section']);
    expect(lintAiPrompt(`${good}\nkey: sk_live_abc123`)).toContain("contains something shaped like a secret");
    expect(lintAiPrompt(good + "x".repeat(8001))).toContain("longer than 8000 characters");
    expect(lintAiPrompt(good, { categoryId: "privacy" })[0]).toMatch(/person reviews and signs off/);
  });
});

describe("readiness level (guide §5 rule 3)", () => {
  it("is green at 0, amber at 1 to 5, red at 6 critical open gates or any blocked gate", () => {
    expect(launchLevel({ gateBlocked: 0, criticalOpen: 0 })).toBe("green");
    expect(launchLevel({ gateBlocked: 0, criticalOpen: 1 })).toBe("amber");
    expect(launchLevel({ gateBlocked: 0, criticalOpen: 5 })).toBe("amber");
    expect(launchLevel({ gateBlocked: 0, criticalOpen: 6 })).toBe("red");
    expect(launchLevel({ gateBlocked: 1, criticalOpen: 0 })).toBe("red");
  });
});

describe("writing the checklist from a PRD", () => {
  const reqs = extractRequirements(PRD, 600);

  it("places sections by what they are for: only feature sections go to the planner", () => {
    expect(sectionRole("1. Goals")).toBe("project");
    expect(sectionRole("1.4 Non-goals for MVP")).toBe("later");
    expect(sectionRole("Post-MVP roadmap candidates")).toBe("later");
    expect(sectionRole("2.3 User stories")).toBe("restates");
    expect(sectionRole("3.4 Acceptance criteria")).toBe("restates");
    expect(sectionRole("6.3 Suggested sprint breakdown")).toBe("restates");
    expect(sectionRole("6.6 Launch checklist")).toBe("restates");
    expect(sectionRole("9. Open Decisions")).toBe("decision");
    expect(sectionRole("7.2 MVP success metrics")).toBe("project");
    expect(sectionRole("Event viewing, editing, and deletion")).toBe("feature");
    expect(sectionRole("4.4 Accessibility requirements")).toBe("feature");
    expect(isProjectSection("1. Goals")).toBe(true);
    const { features, items } = placeBySection(reqs, cfg);
    expect(features.every((r) => sectionRole(r.section) === "feature")).toBe(true);
    expect(items.map((i) => i.covers[0])).toEqual(["R1", "R2"]); // the two goals
    expect(items.every((i) => i.executionType === "review")).toBe(true);
    // One section per planner call, so a task can't mix requirements from different sections.
    expect(planBatches(features).map((b) => new Set(b.map((r) => r.section)).size)).toEqual([1, 1]);
  });

  it("places every requirement: the planner's answer first, then FlowCode fills the gaps", () => {
    const batch = planBatches(placeBySection(reqs, cfg).features)[0];
    expect(batch.map((r) => r.id)).toEqual(["R3", "R4", "R5"]);
    const answer = parseBatch(
      {
        tasks: [
          { title: "Calendar views", goal: "Month, Week and Day views work.", files: ["src/screens/Calendar.tsx", "../etc/passwd"], steps: ["Build the views"], acceptance: ["Switching works"], covers: ["R3", "R4", "R4", "R99"] },
          { title: "Bad task", goal: "", files: [], steps: [], acceptance: [], covers: [] },
        ],
        other: [{ id: "R3", type: "review" }],
      },
      batch,
    );
    expect(answer.tasks).toHaveLength(1);
    expect(answer.tasks[0].covers).toEqual(["R3", "R4"]); // unknown and repeated ids dropped
    expect(answer.tasks[0].files).toEqual(["src/screens/Calendar.tsx"]);
    expect(answer.other).toEqual([]); // R3 already covered by a task
    const { items, filledIn } = batchItems(batch, answer, cfg);
    expect(new Set(items.flatMap((i) => i.covers))).toEqual(new Set(["R3", "R4", "R5"]));
    expect(filledIn).toEqual(["R5"]);
    expect(items.find((i) => i.covers.includes("R5"))?.executionType).toBe("code");
    // Every code task's prompt quotes its requirements word for word and passes lint.
    const views = items.find((i) => i.title === "Calendar views")!;
    expect(views.aiPrompt).toContain("R4: Users switch between Month, Week and Day views.");
    for (const i of items) expect(lintAiPrompt(i.aiPrompt, { categoryId: i.categoryId })).toEqual([]);
  });

  it("reads requirements written as table rows, with their ids and priorities (Calculator test 1: F1–F12 were skipped)", () => {
    const md = [
      "### 1.6 Functional Requirements",
      "| ID | Requirement | Priority |",
      "| --- | --- | --- |",
      "| F5 | Chained operations (e.g., 2 + 3 × 4) follow standard order of operations | Must |",
      '| F7 | Division by zero shows a clear "Can\'t divide by zero" message | Must |',
      "",
      "### 2.5 Non-Functional Requirements",
      "| Category | Requirement |",
      "| --- | --- |",
      "| Offline | Fully functional with no connectivity |",
    ].join("\n");
    expect(extractRequirements(md).map((r) => [r.section, r.text])).toEqual([
      ["1.6 Functional Requirements", "F5: Chained operations (e.g., 2 + 3 × 4) follow standard order of operations (Must)"],
      ["1.6 Functional Requirements", 'F7: Division by zero shows a clear "Can\'t divide by zero" message (Must)'],
      ["2.5 Non-Functional Requirements", "Offline: Fully functional with no connectivity"],
    ]);
  });

  it("requires only exact on-screen values word for word in a step's test file", () => {
    const item = { ...requirementItem(reqs[2], "review", "x", cfg), executionType: "code" as const, tests: [{ behaviour: "press 1 ÷ 0 =", expect: "Can't divide by zero" }, { behaviour: "press 0.1 + 0.2 =", expect: "0.3" }, { behaviour: "look at a number key", expect: "Number keys are neutral-colored." }, { behaviour: "look at +", expect: "has the accent colour" }] };
    const [step] = stepsFromGroups([[item]], "layout");
    expect(step.acceptanceCriteria.filter((c) => c.check.type === "file_contains").map((c) => (c.check as { text: string }).text)).toEqual(["Can't divide by zero", "0.3"]);
    // The described checks are still tests the step writes.
    expect(step.objective).toContain("look at + → check that has the accent colour (a description of what to verify, not text to look for)");
    // Exact values stay "the app shows".
    expect(step.objective).toContain('press 1 ÷ 0 = → the app shows "Can\'t divide by zero"');
    expect(step.objective).toMatch(/never compare a value with itself/);
  });

  it("treats layout and visual checks as described checks, never as text on screen (Calculator app step 12)", () => {
    const item = { ...requirementItem(reqs[2], "review", "x", cfg), executionType: "code" as const, tests: [{ behaviour: "inspect the Calculator screen keypad", expect: "4 columns" }, { behaviour: "Rotate the calculator to landscape and inspect the keypad", expect: "wider, shorter keypad" }, { behaviour: "press 1 ÷ 0 =", expect: "Can't divide by zero" }] };
    const [step] = stepsFromGroups([[item]], "layout");
    expect(step.acceptanceCriteria.filter((c) => c.check.type === "file_contains").map((c) => (c.check as { text: string }).text)).toEqual(["Can't divide by zero"]);
    expect(step.objective).toContain("inspect the Calculator screen keypad → check that 4 columns");
    expect(step.objective).toMatch(/read src\/styles\/\*\.css with node:fs/);
  });

  it("groups checklist items into a few build steps without merging or losing any item", () => {
    const many = reqs.map((r) => requirementItem(r, "review", "x", cfg)).map((i) => ({ ...i, executionType: "code" as const }));
    const groups = groupSteps(many, 2);
    expect(groups).toHaveLength(2);
    // Every item is still there, on its own (the checklist tracks each one).
    expect(groups.flat()).toEqual(many);
  });

  it("makes each step write its acceptance tests first and checks it by them, not the type check alone", () => {
    const mk = (title: string, files: string[], tests: Array<{ behaviour: string; expect: string }>) => ({ ...requirementItem(reqs[2], "review", "x", cfg), id: title, title, executionType: "code" as const, files, tests });
    const items = [mk("Arithmetic", ["src/engine/calc.ts"], [{ behaviour: "press 2 + 3 × 4 =", expect: "14" }, { behaviour: "press 1 ÷ 0 =", expect: "Can't divide by zero" }]), mk("Keyboard", ["src/screens/Calculator.tsx"], [])];
    const steps = stepsFromGroups([[items[0]], [items[1]]], "layout");
    expect(steps.map((s) => s.dependsOn)).toEqual([["layout"], [steps[0].key]]);
    const [first] = steps;
    const file = "src/acceptance/arithmetic.test.tsx";
    expect(first.objective).toMatch(/^FIRST write the acceptance tests in src\/acceptance\/arithmetic\.test\.tsx/);
    expect(first.objective).toContain('press 2 + 3 × 4 = → the app shows "14"');
    expect(first.objective).toContain(items[0].aiPrompt);
    expect(first.acceptanceCriteria.map((c) => c.check)).toEqual([
      { type: "file_exists", path: file },
      { type: "file_contains", path: file, text: "14" },
      { type: "file_contains", path: file, text: "Can't divide by zero" },
      { type: "verification", kind: `tests:${file}` },
      { type: "verification", kind: "typecheck" },
    ]);
    // An item without tests from the planner still gets at least one test of what the user does.
    expect(steps[1].objective).toContain("Keyboard (R3): at least one test");
    expect(items.every((i) => i.stepKey)).toBe(true);
    expect(uniqueIds([items[0], items[0]]).map((i) => i.id)).toEqual([items[0].id, `${items[0].id}-2`]);
  });
});

describe("a spec build plans from the checklist", () => {
  it("writes the checklist, builds its code tasks as steps and links each item to its step", async () => {
    const { app } = makeApp();
    const { project } = makeProject(app);
    // The planner gets one feature section per call and leaves its last requirement out each time.
    const sections: string[] = [];
    const screenNotes: boolean[] = [];
    app.router.register({
      config: { id: "ollama", kind: "ollama", label: "stub", enabled: true, hosted: false },
      chat: async (req) => {
        const user = String(req.messages.at(-1)?.content ?? "");
        // The screens are decided first, in a call of their own; every part then gets the same screen files.
        if (String(req.messages[0]?.content ?? "").startsWith("You decide which screens")) {
          return { content: JSON.stringify({ product: "Calendar", screens: [{ name: "Calendar", purpose: "See events by month, week or day." }] }), toolCalls: [], model: "stub", durationMs: 1 };
        }
        screenNotes.push(user.includes("src/screens/CalendarScreen.tsx: Calendar"));
        const lines = [...user.matchAll(/(R\d+) \[([^\]]*)\]/g)].map((m) => ({ id: m[1], section: m[2] }));
        sections.push(...new Set(lines.map((l) => l.section)));
        const title = /views/i.test(lines[0]?.section ?? "") ? "Calendar views" : "Events";
        const content = JSON.stringify({ tasks: [{ title, goal: `${title} work as the PRD says.`, files: [`src/screens/${title.replace(/\W/g, "")}.tsx`], steps: ["Build it"], acceptance: ["It works"], covers: lines.slice(0, -1).map((l) => l.id) }], other: [] });
        return { content, toolCalls: [], model: "stub", durationMs: 1 };
      },
      listModels: async () => [],
      describe: async () => undefined,
      health: async () => ({ ok: true, detail: "stub" }),
    });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Build the calendar in the PRD.", kind: "spec_build", references: [{ name: "prd.md", role: "prd", content: PRD }], constraints: [], attachedKnowledgeIds: [] });
    await app.orchestrator.plan(run.id);
    // Goals never reach the planner; each call is one section.
    expect(sections).toEqual(["4. Calendar views", "5. Events"]);
    expect(screenNotes).toEqual([true, true]);
    expect(app.store.getSetting<{ screens: Array<{ file: string }> } | null>(`screenPlan:${run.id}`, null)?.screens.map((x) => x.file)).toEqual(["src/screens/CalendarScreen.tsx"]);
    const plan = app.store.getSetting<LrcPlan | null>(planKey(project.id), null)!;
    expect(plan.runId).toBe(run.id);
    // The planner left one requirement out per section: FlowCode placed both, so every requirement has a home.
    expect(plan.filledIn).toHaveLength(2);
    expect(new Set(plan.items.flatMap((i) => i.covers))).toEqual(new Set(plan.requirements.map((r) => r.id)));
    const tasks = app.orchestrator.graph.tasks(run.id).sort((a, b) => a.ordinal - b.ordinal);
    const views = plan.items.find((i) => i.title === "Calendar views")!;
    const feature = tasks.find((t) => t.id === views.taskId)!;
    // The step writes its acceptance tests first, then follows the item's own prompt (which quotes the PRD).
    expect(feature.objective).toMatch(/^FIRST write the acceptance tests in src\/acceptance\//);
    expect(feature.objective).toContain(views.aiPrompt);
    expect(views.aiPrompt).toMatch(/^# Calendar views\n\n## Goal/);
    expect(views.aiPrompt).toContain("R4: Users switch between Month, Week and Day views.");
    expect(feature.acceptanceCriteria.some((c) => c.check.type === "verification" && c.check.kind.startsWith("tests:src/acceptance/"))).toBe(true);
    expect(tasks.at(-1)?.title).toMatch(/^Assemble the app/);
    // No generic steps FlowCode adds on its own.
    expect(tasks.some((t) => t.title === "States, accessibility and edge cases")).toBe(false);
    // Every code item points at the step that does it.
    for (const i of plan.items.filter((x) => x.executionType === "code")) expect(tasks.some((t) => t.id === i.taskId), i.title).toBe(true);
    const r = await launchReadiness(app, project.id);
    const item = r.categories.flatMap((c) => c.items).find((i) => i.title === "Calendar views")!;
    // The Launch readiness checklist says which prototype step has it, and gives a real-app prompt, not the step's.
    expect(item.evidence).toMatch(/^The prototype has this \(step \d+, not built yet\)/);
    expect(item.status).toBe("not_started");
    expect(item.prompt).not.toBe(views.aiPrompt);
    expect(item.prompt).toMatch(/clickable prototype of this app already exists/);
  });
});

describe("the launch checklist of a project with a prototype plan", () => {
  it("lists the plan's items with real-app prompts, counts requirements, and keeps the guide's rules", async () => {
    const { app } = makeApp();
    const { project } = makeProject(app, { "package.json": '{"scripts":{"typecheck":"tsc","build":"vite build"}}' });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: PRD, constraints: [], attachedKnowledgeIds: [] });
    const reqs = extractRequirements(PRD, 600);
    const { items, filledIn } = batchItems(reqs, { tasks: [], other: [] }, cfg);
    const plan: LrcPlan = { runId: run.id, createdAt: new Date().toISOString(), requirements: reqs, items, filledIn };
    app.store.setSetting(planKey(project.id), plan);

    let r = await launchReadiness(app, project.id);
    expect(r.categories.find((c) => c.id === "plan")).toBeUndefined(); // no "Build plan" list
    expect(r.requirements).toMatchObject({ total: reqs.length, filledIn: reqs.length });
    const all = r.categories.flatMap((c) => c.items);
    expect(all.every((i) => i.prompt.startsWith("# ") && lintAiPrompt(i.prompt, { categoryId: i.categoryId }).length === 0)).toBe(true);
    const views = all.find((i) => i.categoryId === "spec.calendar-views")!;
    expect(views.promptAuthored).toBe(false); // the plan's step prompt builds the prototype, not the real app
    expect(views.detail).toContain("R3: The app shows a Month view with today highlighted.");
    expect(all.find((i) => i.id === "check.build")?.promptAuthored).toBe(false);

    // Privacy items never complete from automatic evidence alone.
    const privacy = r.categories.find((c) => c.id === "privacy")!;
    expect(privacy.items.every((i) => i.status !== "completed")).toBe(true);

    // A stored prompt that misses the standard is refused; a sensitive one must name a person's sign-off.
    expect(() => editLaunchItem(app, project.id, "manual.privacy", { aiPrompt: "# just do it" }, "privacy")).toThrow(PromptLintError);
    const noSignOff = buildTaskPrompt({ title: "t", goal: "g", context: "c", steps: ["s"], acceptance: ["a"] });
    expect(() => editLaunchItem(app, project.id, "manual.privacy", { aiPrompt: noSignOff }, "privacy")).toThrow(/signs off/);
    editLaunchItem(app, project.id, "manual.privacy", { aiPrompt: buildTaskPrompt({ title: "t", goal: "g", context: "c", steps: ["s"], acceptance: ["a"], safety: true }), priority: "high" }, "privacy");
    expect(() => addLaunchTask(app, project.id, { title: "Broken", aiPrompt: "## Goal only" })).toThrow(PromptLintError);
    setLaunchNotes(app, project.id, "manual.privacy", "Legal reviews on Friday");
    r = await launchReadiness(app, project.id);
    const p = r.categories.flatMap((c) => c.items).find((i) => i.id === "manual.privacy")!;
    expect(p).toMatchObject({ promptAuthored: true, priority: "high", notes: "Legal reviews on Friday" });
    // An empty prompt goes back to the generated one.
    editLaunchItem(app, project.id, "manual.privacy", { aiPrompt: "" }, "privacy");
    r = await launchReadiness(app, project.id);
    expect(r.categories.flatMap((c) => c.items).find((i) => i.id === "manual.privacy")?.promptAuthored).toBe(false);
    expect(["red", "amber", "green"]).toContain(r.level);
  });
});
