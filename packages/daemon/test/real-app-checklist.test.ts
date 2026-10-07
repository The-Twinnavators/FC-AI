/**
 * Phase 2 of the prototype builder (docs/prototype-builder-plan.md): the build follows the Prototype plan, and the
 * Launch readiness checklist is the tool for building the real app (real-app prompts, Markdown download).
 */
import { describe, expect, it } from "vitest";
import type { Task } from "@flowcode/contracts";
import { PROTOTYPE_NOTE, generatedTaskPrompt, lintAiPrompt, promptConfigFor } from "../src/quality/taskPrompt.js";
import { batchItems, groupSteps, planKey, stepsFromGroups, type LrcPlan } from "../src/quality/lrcPlan.js";
import { featuresStoreData, launchMarkdown, launchReadiness, setLaunchNotes, setLaunchOverride } from "../src/quality/launchReadiness.js";
import { planView } from "../src/quality/prototypePlan.js";
import { extractRequirements } from "../src/quality/spec.js";
import { makeApp, makeProject } from "./helpers.js";

const cfg = promptConfigFor({ stack: "React 19 + Vite + TypeScript", scripts: ["typecheck", "build"] });

const PRD = [
  "# Notes app",
  "## 1. Goals",
  "- People capture a thought in under five seconds.",
  "## 3. Notes",
  "- Users write a note with a title and a body.",
  "- Notes are saved and listed newest first.",
  "## 4. Search",
  "- Users search notes by title.",
  "## 7. Roadmap",
  "- Shared notebooks.",
].join("\n");

/** A plan as a spec build stores it: the planner's tasks, steps assigned, and (optionally) the build's task ids. */
function makePlan(runId: string) {
  const reqs = extractRequirements(PRD, 600);
  const id = (text: string) => reqs.find((r) => r.text.startsWith(text))!.id;
  const notes = reqs.filter((r) => r.section.includes("Notes"));
  const search = reqs.filter((r) => r.section.includes("Search"));
  const a = batchItems(notes, { tasks: [{ title: "Write and list notes", goal: "Notes can be written and listed.", files: ["src/screens/Notes.tsx"], steps: ["Build it"], acceptance: ["It works"], covers: notes.map((r) => r.id), tests: [{ behaviour: "type 'Milk' and press Save", expect: "Milk" }] }], other: [] }, cfg);
  const b = batchItems(search, { tasks: [{ title: "Search notes", goal: "Search finds notes by title.", files: ["src/screens/Search.tsx"], steps: ["Build it"], acceptance: ["It works"], covers: search.map((r) => r.id) }], other: [] }, cfg);
  const goals = batchItems(reqs.filter((r) => r.section.includes("Goals")), { tasks: [], other: [{ id: id("People capture"), type: "review", reason: "A goal" }] }, cfg);
  const later = batchItems(reqs.filter((r) => r.section.includes("Roadmap")), { tasks: [], other: [{ id: id("Shared notebooks"), type: "later", reason: "Roadmap" }] }, cfg);
  const items = [...a.items, ...b.items, ...goals.items, ...later.items];
  // A requirement only the real app can meet: left out of the prototype "for the real app".
  items.push({ ...later.items[0], id: "spec.hosting", title: "Hosted with backups", description: "Hosted with backups", later: "for the real app" });
  stepsFromGroups(groupSteps(items), "layout");
  const plan: LrcPlan = { runId, createdAt: "2026-10-05T10:00:00.000Z", requirements: reqs, items, filledIn: [] };
  return plan;
}

describe("the launch readiness checklist builds the real app", () => {
  it("lists the prototype plan's features to build for real, with what the prototype has as information only", async () => {
    const { app } = makeApp();
    const { project } = makeProject(app, { "index.html": "<!doctype html>", "src/sim/store.ts": "localStorage.setItem('demo', '{}');\n" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: PRD, constraints: [], attachedKnowledgeIds: [] });
    const plan = makePlan(run.id);
    app.store.setSetting(planKey(project.id), plan);
    const r = await launchReadiness(app, project.id);
    const all = r.categories.flatMap((c) => c.items);

    const notes = r.categories.find((c) => c.title === "Spec · Notes")!;
    expect(notes).toBeDefined();
    const write = notes.items.find((i) => i.title === "Write and list notes")!;
    // Prototype done is not real-app done: it starts Not started and says which step built the prototype's version.
    expect(write.status).toBe("not_started");
    expect(write.evidence).toBe("The prototype has this (step 1, not built yet). Build the real version.");
    expect(all.find((i) => i.title === "Search notes")?.evidence).toMatch(/^The prototype has this \(step 2, /);

    // The plan's step prompts build the prototype; the checklist's prompts build the real app.
    const planPrompt = plan.items.find((i) => i.title === "Write and list notes")!.aiPrompt;
    expect(write.prompt).not.toBe(planPrompt);
    expect(write.promptAuthored).toBe(false);
    expect(write.prompt).toContain(PROTOTYPE_NOTE);
    expect(all.every((i) => !plan.items.some((p) => p.aiPrompt === i.prompt))).toBe(true);
    expect(all.every((i) => lintAiPrompt(i.prompt, { categoryId: i.categoryId }).length === 0)).toBe(true);

    // Left out "for the real app" is work here; a roadmap idea is not for this release.
    expect(all.find((i) => i.id === "spec.hosting")).toMatchObject({ status: "not_started" });
    expect(all.find((i) => i.title.startsWith("Shared notebooks"))?.status).toBe("not_applicable");

    // "Notes are saved": the real app needs a data store and an API.
    expect(r.categories.find((c) => c.id === "api")?.reason).toMatch(/save or share data/);
    expect(r.categories.find((c) => c.id === "data")).toBeDefined();
    // The simulated store in src/sim is not real storage.
    expect(all.find((i) => i.id === "code.storage")?.status).toBe("not_started");
    expect(r.requirements?.total).toBe(plan.requirements.length);
  });

  it("adds data and backend only when the PRD's features keep or share data", () => {
    const calc = extractRequirements(["# Calculator", "## 3. Keypad", "- Users press digits and operators.", "- The display shows the result.", "- No account and no login."].join("\n"), 100);
    expect(featuresStoreData(calc, null)).toBe(false);
    const withHistory = extractRequirements(["# Calculator", "## 3. History", "- Past calculations are kept in a history list."].join("\n"), 100);
    expect(featuresStoreData(withHistory, null)).toBe(true);
  });

  it("writes real-app prompts that point at the prototype's screens, simulated data and tokens", () => {
    const p = generatedTaskPrompt({ title: "Notes sync across devices", detail: "A note written on one device appears on the others.", kind: "code", categoryId: "spec.notes", categoryTitle: "Spec · Notes" }, cfg);
    expect(p).toMatch(/clickable prototype of this app already exists in this repo/);
    expect(p).toContain("src/screens");
    expect(p).toContain("src/sim");
    expect(p).toContain("src/styles/tokens.css");
    expect(p).toMatch(/implement the real version/i);
    expect(p).toMatch(/Keep the prototype's screens/);
    expect(p).not.toMatch(/add no new dependencies/);
    expect(lintAiPrompt(p)).toEqual([]);
  });

  it("downloads as Markdown with task-list lines, markers, status, notes and each prompt", async () => {
    const { app } = makeApp();
    const { project } = makeProject(app, { "README.md": "# x\n", "index.html": "<!doctype html>" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: PRD, constraints: [], attachedKnowledgeIds: [] });
    app.store.setSetting(planKey(project.id), makePlan(run.id));
    setLaunchOverride(app, project.id, "manual.rollback", "not_applicable");
    setLaunchNotes(app, project.id, "manual.deploy", "Use the team's host");
    const r = await launchReadiness(app, project.id);
    const { markdown, filename } = launchMarkdown(r, new Date("2026-10-05T12:00:00Z"));
    const name = app.store.projects.require(project.id).name;
    expect(filename).toBe(`${name.trim().toLowerCase().replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "")}-launch-readiness-2026-10-05.md`);
    expect(markdown).toMatch(new RegExp(`^# Launch readiness: ${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\n`));
    expect(markdown).toContain("- Date: 2026-10-05");
    expect(markdown).toMatch(/- Overall progress: \d+ of \d+ items done \(\d+%\)/);
    for (const c of r.categories) expect(markdown).toContain(`\n## ${c.title}`);
    expect(markdown).toContain("- [x] **README**");
    expect(markdown).toMatch(/- \[x\] \*\*Rollback plan\*\*/);
    expect(markdown).toMatch(/- \[ \] \*\*Write and list notes\*\* · High priority · Launch gate/);
    expect(markdown).toContain("  Status: Not started. The prototype has this (step 1, not built yet). Build the real version.");
    expect(markdown).toContain("  Notes: Use the team's host");
    expect(markdown).toContain("  <details><summary>Prompt</summary>\n\n  ```text\n  # Write and list notes\n");
    expect(markdown.split("<details>").length - 1).toBe(r.totals.total);
  });

  it("names the file from the project slug", () => {
    const r = { projectName: "Café Planner: v2!", projectType: "react", totals: { done: 0, total: 0, percent: 0, gateOpen: 0 }, categories: [] } as unknown as Awaited<ReturnType<typeof launchReadiness>>;
    expect(launchMarkdown(r, new Date("2026-01-02T00:00:00Z")).filename).toBe("caf-planner-v2-launch-readiness-2026-01-02.md");
  });
});

describe("the prototype plan view", () => {
  it("groups code items into numbered steps with live status, requirements and tests; review and later apart", () => {
    const plan = makePlan("run_1");
    const write = plan.items.find((i) => i.title === "Write and list notes")!;
    write.taskId = "task_1";
    const task = { id: "task_1", runId: "run_1", title: "Write and list notes", status: "verified", attempts: 1 } as unknown as Task;
    const v = planView("p1", plan, (id) => (id === "task_1" ? task : undefined));
    expect(v.hasPlan).toBe(true);
    expect(v.steps.map((s) => [s.n, s.title, s.kind])).toEqual([
      [1, "Write and list notes", "feature"],
      [2, "Search notes", "feature"],
    ]);
    expect(v.steps[0]).toMatchObject({ status: "completed", taskStatus: "verified", taskId: "task_1", runId: "run_1" });
    expect(v.steps[1]).toMatchObject({ status: "not_started", taskStatus: undefined });
    const item = v.steps[0].items[0];
    expect(item).toMatchObject({ title: "Write and list notes", section: "Notes", files: ["src/screens/Notes.tsx"], tests: [{ behaviour: "type 'Milk' and press Save", expect: "Milk" }] });
    expect(item.description).toBe("Notes can be written and listed.");
    expect(item.covers.map((c) => c.text)).toEqual(["Users write a note with a title and a body.", "Notes are saved and listed newest first."]);
    expect(v.review.map((x) => x.title)).toEqual(["People capture a thought in under five seconds."]);
    expect(v.later.map((x) => [x.reason, !!x.realApp])).toEqual([
      ["Roadmap", false],
      ["for the real app", true],
    ]);
    expect(v.requirements).toMatchObject({ total: plan.requirements.length, forPeople: 1, later: 2 });
  });

  it("is empty for a project built before prototype plans", () => {
    expect(planView("p1", null, () => undefined)).toEqual({ projectId: "p1", hasPlan: false, steps: [], review: [], later: [] });
  });
});
