/**
 * Regression tests from the Clean Cart controlled build (run_73d6f4dd): two design parts passed with their work undone
 * on generic checks alone, their brief left out the files they edit and the PRD, an imagery step got the test-first
 * skill, and one reply sent 55 edits, hit the output limit and half-applied.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Task } from "@flowcode/contracts";
import { deliverableChecks, genericOnly, isTaskSpecific, seededRecords } from "../src/orchestrator/taskContract.js";
import { buildHandoff, fitHandoff } from "../src/orchestrator/handoff.js";
import { budgetSkills, requestBudget } from "../src/orchestrator/requestBudget.js";
import { buildSplit, compactPartObjective } from "../src/orchestrator/stepRecovery.js";
import { workflowSkillIds, renderSkills } from "../src/knowledge/skills.js";
import { pieceFiles } from "../src/orchestrator/sectionRecipes.js";
import { makeApp, makeProject } from "./helpers.js";

const PARENT = "Design each main screen like a senior product designer whose work is good enough for a studio portfolio. " + "Lay out everything the spec says. ".repeat(150);
const imagery = (over: Partial<Task> = {}): Task =>
  ({
    id: "task_img",
    runId: "run_cc",
    title: "Implement Real Imagery and UI Elements",
    objective: `Replace all placeholder images with real imagery from public/images (using find_image), add alt text, and use lucide-react icons.\n\nThis is part 2 of 4 of the step "Design the main screens". Work on src/screens/HomeLandingPageScreen.tsx and src/sections/ShopProductCards.tsx in this part; the other parts handle the rest of: ${PARENT}\n\nIf this part's checks can't pass because of the step's acceptance test file or a file an earlier part made (a test that can't load, a token that is missing), fix that file too: it is part of this step. Don't weaken what a test checks.`,
    status: "pending",
    dependsOn: ["task_frame"],
    expectedPaths: ["src/screens/HomeLandingPageScreen.tsx", "src/sections/ShopProductCards.tsx"],
    actualPaths: [],
    acceptanceCriteria: [{ id: "tc", description: "The project still type-checks after this part", check: { type: "verification", kind: "typecheck" }, evidenceRefs: [] }],
    validationPlan: { kinds: [] },
    role: "coder",
    ordinal: 10,
    attempts: 0,
    ...over,
  }) as Task;

describe("a step can't pass on generic checks alone", () => {
  it("knows a type check says nothing about the step's own deliverable", () => {
    expect(genericOnly(imagery())).toBe(true);
    expect(isTaskSpecific({ id: "x", description: "", check: { type: "verification", kind: "tests:src/a.test.tsx" }, evidenceRefs: [] } as never)).toBe(true);
  });

  it("adds checks for the imagery, sample-data and frame parts' own deliverables", () => {
    const kinds = (t: Task) => deliverableChecks(t).map((c) => (c.check as { kind: string }).kind);
    expect(kinds(imagery())).toEqual(["changed:src/screens/HomeLandingPageScreen.tsx|src/sections/ShopProductCards.tsx", "images-used:src/screens/HomeLandingPageScreen.tsx|src/sections/ShopProductCards.tsx", "piece-content:src/screens/HomeLandingPageScreen.tsx"]);
    expect(kinds(imagery({ title: "Seed Sample Data and Content", objective: "Populate sim collections with 8-20 realistic records using createCollection.", expectedPaths: ["src/sim/index.ts", "src/screens/CategoriesScreen.tsx"] }))).toEqual(["changed:src/sim/index.ts|src/screens/CategoriesScreen.tsx", "data-seeded:8", "piece-content:src/screens/CategoriesScreen.tsx"]);
    // The kit isn't a step's own file.
    expect(kinds(imagery({ title: "Design App Frame and Navigation", objective: "Choose the navigation pattern and restyle AppShell.", expectedPaths: ["src/styles/components.css", "src/components/ui/screen-parts.tsx"] }))).toEqual(["changed:src/styles/components.css", "frame-designed"]);
  });

  it("gives split parts those checks when they're made", () => {
    const parent = { ...imagery(), objective: PARENT, expectedPaths: ["src/screens/", "src/sections/"] } as Task;
    const [frame, img] = buildSplit(parent, [
      { title: "Design App Frame and Navigation", objective: "Choose the navigation pattern and restyle AppShell.", files: ["src/styles/components.css"] },
      { title: "Implement Real Imagery", objective: "Put real photos from public/images on Home.", files: ["src/screens/HomeLandingPageScreen.tsx"] },
    ], (() => { let n = 0; return () => `p${++n}`; })());
    expect(frame!.acceptanceCriteria.map((c) => (c.check as { kind?: string }).kind)).toContain("frame-designed");
    expect(img!.acceptanceCriteria.map((c) => (c.check as { kind?: string }).kind)).toContain("images-used:src/screens/HomeLandingPageScreen.tsx");
    // A short summary of the step, not its whole text; no test wording for a part without tests.
    expect(img!.objective.length).toBeLessThan(600);
    expect(img!.objective).not.toMatch(/acceptance test/);
  });

  it("checks the deliverables in a real workspace", async () => {
    const { app } = makeApp();
    const { project, ws, jail } = makeProject(app, { "src/screens/HomeLandingPageScreen.tsx": `import NbLanding from "../sections/NbLanding";\nexport default function Home() { return <NbLanding />; }\n`, "public/images/hero.jpg": "x", "src/sim/index.ts": "export {}\n" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Clean Cart", constraints: [], attachedKnowledgeIds: [] });
    const task = { ...imagery(), runId: run.id };
    app.store.tasks.upsert(task);
    const ctx = { jail, projectId: project.id, runId: run.id, taskId: task.id, toolCallId: "t1", approved: true };
    const problem = (kind: string) => app.verifier.deliverableProblem(kind, app.store.tasks.require(task.id), ws);
    // The Neobrutal landing exactly as the library ships it: its pottery studio demo.
    const nb = pieceFiles("nb-landing")[0]!;
    fs.mkdirSync(path.join(ws, "src/sections"), { recursive: true });
    fs.writeFileSync(path.join(ws, nb.rel), nb.content);
    expect(problem("changed:src/screens/HomeLandingPageScreen.tsx|src/sections/ShopProductCards.tsx")).toMatch(/hasn't changed/);
    expect(problem("images-used:src/screens/HomeLandingPageScreen.tsx")).toMatch(/none of .* shows a photo/);
    expect(problem("piece-content:src/screens/HomeLandingPageScreen.tsx")).toMatch(/Make something lumpy and love it anyway/);
    // Saved photos that no screen shows don't count; one the screen shows does, and the change is the step's own.
    app.ops.replaceContent(ctx, "src/screens/HomeLandingPageScreen.tsx", `import NbLanding from "../sections/NbLanding";\nexport default function Home() { return <><img src="/images/hero.jpg" alt="Fresh produce" /><NbLanding /></>; }\n`);
    expect(problem("changed:src/screens/HomeLandingPageScreen.tsx|src/sections/ShopProductCards.tsx")).toBeUndefined();
    expect(problem("images-used:src/screens/HomeLandingPageScreen.tsx")).toBeUndefined();
    fs.writeFileSync(path.join(ws, nb.rel), nb.content.replace("Make something lumpy and love it anyway.", "Food without GMOs, without reading every label."));
    expect(problem("piece-content:src/screens/HomeLandingPageScreen.tsx")).toBeUndefined();
    // Sample data: three records isn't seeded; eight is.
    const rec = (n: number) => Array.from({ length: n }, (_, i) => `{ id: "p${i}", name: "Product ${i}" }`).join(", ");
    expect(seededRecords(`const products = createCollection("products", [${rec(3)}]);`)).toBe(3);
    fs.writeFileSync(path.join(ws, "src/sim/data.ts"), `const PRODUCTS = [${rec(8)}];\nexport const products = createCollection("products", PRODUCTS);\n`);
    expect(problem("data-seeded:8")).toBeUndefined();
  });

  it("reopens a step that passed on generic checks when its deliverable isn't there, and leaves one that is", async () => {
    const { app } = makeApp();
    const { project, ws } = makeProject(app, { "src/screens/HomeLandingPageScreen.tsx": "export default function Home() { return <h1>Home</h1>; }\n", "src/sections/ShopProductCards.tsx": "export default function C() { return null; }\n" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Clean Cart", constraints: [], attachedKnowledgeIds: [] });
    // No package.json here, so the type check can't run: these steps carry no checks but the ones revalidation adds.
    const bad = { ...imagery({ acceptanceCriteria: [] }), runId: run.id, status: "verified" as const, attempts: 2 };
    const good = { ...imagery({ id: "task_ok", title: "Write the about text", objective: "Write the about text on Home.", expectedPaths: ["src/screens/HomeLandingPageScreen.tsx"], ordinal: 11, acceptanceCriteria: [] }), runId: run.id, status: "verified" as const };
    app.store.tasks.upsert(bad);
    app.store.tasks.upsert(good);
    // The second step did change its file (its snapshot is on record).
    app.ops.replaceContent({ jail: app.projects.jail(project), projectId: project.id, runId: run.id, taskId: good.id, toolCallId: "t", approved: true }, "src/screens/HomeLandingPageScreen.tsx", "export default function Home() { return <h1>About Clean Cart</h1>; }\n");
    await (app.orchestrator as unknown as { revalidateGenericPasses: (r: unknown, j: unknown, s: AbortSignal) => Promise<void> }).revalidateGenericPasses(app.store.runs.require(run.id), app.projects.jail(project), new AbortController().signal);
    expect(app.store.tasks.require(bad.id)).toMatchObject({ status: "pending", attempts: 0 });
    expect(app.store.getSetting<string[]>(`taskFindings:${bad.id}`, []).join(" ")).toMatch(/^Revalidation: this step passed on generic checks only/);
    expect(app.store.tasks.require(good.id).status).toBe("verified");
    expect(app.store.getSetting<string[]>(`addedChecks:${bad.id}`, []).length).toBeGreaterThan(0);
    expect(fs.existsSync(ws)).toBe(true);
  });
});

describe("the request is budgeted as a whole, by priority", () => {
  it("leaves room for work and the reply, at the model's measured characters per token", () => {
    const b = requestBudget({ windowTokens: 24_576, replyTokens: 4096, charsPerToken: 4.05, hosted: false });
    expect(b.workingTokens).toBe(6144);
    expect(b.inputChars).toBe(Math.floor((24_576 - 4096 - 6144) * 4.05));
    expect(b.skillChars).toBe(9000);
  });

  it("keeps whole skills in order within their budget and names the ones left out", () => {
    const skill = (id: string, n: number) => ({ id, version: "1", purpose: id, instructions: "x".repeat(n), allowedTools: [], acceptance: [], roles: ["coder"], source: "builtin" }) as never;
    const fit = budgetSkills([skill("a", 3000), skill("b", 4000), skill("c", 6000), skill("d", 1000)], 9000, renderSkills);
    expect(fit.kept.map((s: { id: string }) => s.id)).toEqual(["a", "b", "d"]);
    expect(fit.dropped).toEqual(["c"]);
    expect(fit.text.length).toBeLessThanOrEqual(9000);
  });

  it("builds Clean Cart's imagery brief with its files, its requirements and only the finished work it builds on", () => {
    const done = (id: string, title: string, paths: string[]) => ({ ...imagery({ id, title, actualPaths: paths }), status: "verified" }) as Task;
    const all = [
      done("task_frame", "Design App Frame and Navigation", ["src/styles/components.css"]),
      done("task_scaffold", "Scaffold from verified starter template", Array.from({ length: 50 }, (_, i) => `src/sections/Piece${i}.tsx`)),
      done("task_layout", "App layout and navigation", ["src/App.tsx", "src/screens/HomeLandingPageScreen.tsx"]),
      imagery(),
    ];
    const files = [
      { path: "src/screens/HomeLandingPageScreen.tsx (line-numbered; line prefixes are not part of the file)", content: Array.from({ length: 300 }, (_, i) => `${String(i + 1).padStart(4)}| <div>line ${i}</div>`).join("\n") },
      { path: "src/sections/ShopProductCards.tsx (line-numbered; line prefixes are not part of the file)", content: Array.from({ length: 300 }, (_, i) => `${String(i + 1).padStart(4)}| <div>card ${i}</div>`).join("\n") },
    ];
    const packet = buildHandoff({ run: { objective: "Clean Cart", constraints: [], plan: undefined, strategy: undefined } as never, task: imagery(), allTasks: all, files, requirements: ["R6 [Search]: Search products by name, brand or category."], guidance: ["Design direction: " + "photo-led ".repeat(400)], knowledge: [{ title: "Spec", content: "x".repeat(1500), provenance: [], excluded: false } as never] });
    expect(packet.completedTasks.map((t) => t.title)).toEqual(["Design App Frame and Navigation", "App layout and navigation"]);
    expect(packet.completedTasks[1]!.changedPaths).toEqual(["src/screens/HomeLandingPageScreen.tsx", "1 other file"]);
    expect(packet.completedOther).toBe(1);
    expect(packet.task.objective).not.toContain("Lay out everything the spec says. Lay out");
    const fitted = fitHandoff(packet, "src/\n".repeat(100), ["typecheck"], 14_000);
    expect(fitted.overflow).toBe(0);
    expect(fitted.text).toContain("R6 [Search]: Search products by name, brand or category.");
    expect(fitted.text).toContain("File src/screens/HomeLandingPageScreen.tsx");
    expect(fitted.text).toContain("File src/sections/ShopProductCards.tsx");
    expect(fitted.text).not.toContain("Not attached");
    expect(fitted.dropped[0]).toBe('knowledge "Spec"');
    // What doesn't fit is reported, for the caller to narrow or split the step.
    expect(fitHandoff(packet, "src/", [], 3000).overflow).toBeGreaterThan(0);
  });

  it("writes a part written the old way as its own work plus one sentence of its step", () => {
    const c = compactPartObjective(imagery().objective);
    expect(c.length).toBeLessThan(900);
    expect(c).toMatch(/^Replace all placeholder images/);
    expect(c).toMatch(/This is part 2 of 4 of the step "Design the main screens" \(Design each main screen like a senior product designer/);
  });
});

describe("skills come from what the step is", () => {
  it("gives test-first only to a step whose checks run tests", () => {
    const text = `${imagery().title}\n${imagery().objective}`;
    expect(workflowSkillIds("coder", text)).toEqual(["skill.test-driven-development"]);
    expect(workflowSkillIds("coder", text, { writesTests: false })).toEqual([]);
    expect(workflowSkillIds("coder", "Write the acceptance tests", { writesTests: true })).toEqual(["skill.test-driven-development"]);
  });
});

describe("a spec build's steps get the PRD's requirement text", () => {
  it("finds the PRD when planning didn't record it, records it, and quotes the requirements the step names", async () => {
    const { ScriptedProvider, call } = await import("../src/models/scripted.js");
    const { ModelRouter } = await import("../src/models/router.js");
    const { idealProbeSolver } = await import("./scripted-agents.js");
    const { waitFor } = await import("./helpers.js");
    const { app } = makeApp();
    const prd = ["# Clean Cart PRD", "", "## Search", "", "- Shoppers can search products by name, brand or category.", "- Search results show a Non-GMO badge on verified products.", "", "## Lists", "", "- Shoppers can save a product to a grocery list.", "", "Clean Cart helps people find food with no GMO ingredients. ".repeat(10)].join("\n");
    const plan = { goal: "g", assumptions: [], relevantFiles: ["README.md"], expectedChanges: ["src/Search.tsx"], risk: "low", riskNotes: [], validationPlan: ["final_report"], rollbackStrategy: "r", tasks: [{ key: "t1", title: "Build search", objective: "Build the product search (R1, R2).", dependsOn: [], expectedPaths: ["src/Search.tsx"], acceptanceCriteria: [{ id: "a", description: "exists", check: { type: "file_exists", path: "src/Search.tsx" } }], verification: [], role: "coder" }] };
    let brief = "";
    app.router.register(
      new ScriptedProvider({ id: "scripted", kind: "scripted", label: "s", enabled: true, hosted: false }, async (_req, h) => {
        if ((h[0]?.content ?? "").includes("You are the Planner")) return { content: JSON.stringify(plan) };
        brief ||= String(h.find((m) => m.role === "user")?.content ?? "");
        return { toolCalls: [call("report_blocked", { reason: "stop here", nextAction: "-" })] };
      }),
    );
    app.router.register(idealProbeSolver("scripted-ideal"));
    const asg = { providerId: "scripted", model: "agent" };
    const lab = await app.lab.probe({ providerId: "scripted-ideal", model: "agent" });
    app.store.capabilities.upsert({ ...lab, id: "cap_copy", providerId: "scripted", model: "agent", configHash: ModelRouter.configHash(asg) });
    for (const role of ["planner", "coder", "debugger"] as const) app.router.setRoleAssignment(role, asg);
    const { project } = makeProject(app, { "README.md": "# demo\n", "spec/clean-cart-prd.md": prd });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Build search", constraints: [], attachedKnowledgeIds: [] });
    await app.orchestrator.plan(run.id);
    app.orchestrator.start(run.id);
    await waitFor(() => (brief && !app.orchestrator.isActive(run.id) ? true : undefined), 30_000);
    expect(app.store.getSetting(`runPrd:${run.id}`, "")).toBe("spec/clean-cart-prd.md");
    expect(brief).toMatch(/Requirements this step builds \(quoted from the PRD/);
    expect(brief).toContain("R1 [Search]: Shoppers can search products by name, brand or category.");
    expect(brief).toContain("R2 [Search]: Search results show a Non-GMO badge on verified products.");
    expect(brief).not.toContain("save a product to a grocery list");
  });
});
