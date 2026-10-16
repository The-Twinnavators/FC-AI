/**
 * Reliability phase 2: a step is one deliverable that can be verified on its own, with the test setup it needs.
 * Built from Clean Cart's step 14 ("Write the acceptance tests and add the stylesheet rules"), which mixed two
 * deliverables, contradicted itself and was checked only by words in the test file.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Task } from "@flowcode/contracts";
import { assertionlessTests, contractProblems, runnableVerdict, separateMixed } from "../src/orchestrator/taskContract.js";
import { testScaffold, testingFacts, testingPacket } from "../src/orchestrator/testingGuide.js";

const FILE = "src/acceptance/landing-page-home-landing-with-how-it-wo.test.tsx";

// Clean Cart run_b08ca512, task_d451d799 (step 14), as it was planned.
function step14(): Task {
  return {
    id: "task_14",
    runId: "run_cc",
    title: "Write the acceptance tests and add the stylesheet rules",
    objective: `Create ${FILE} with all 24 tests written out in full. Read src/sim, src/app/store.ts and src/app/schema.ts first, and use only real product names, categories, tags and stores from the sample data. Drive screens with render() and userEvent, and read CSS with readFileSync(path.resolve(process.cwd(), 'src/styles/app.css')). Then, in src/styles/app.css, add two rules using the design tokens: the Home 'How it works' steps stack into one column at 375px wide (a max-width media query), and the product grid class is \`display: grid\` with responsive columns. The only test this step makes pass is the stylesheet-rule check; the others pass in the later steps.\n\nThis is part 1 of 4 of the step "Landing page: Home landing with How it works and 5 more".`,
    status: "pending",
    dependsOn: ["task_12"],
    expectedPaths: [FILE, "src/styles/app.css"],
    actualPaths: [],
    acceptanceCriteria: [
      { id: "tf", description: `The acceptance tests are written in ${FILE}`, check: { type: "file_exists", path: FILE }, evidenceRefs: [] },
      { id: "e0", description: 'The tests check that the app shows "How it works"', check: { type: "file_contains", path: FILE, text: "How it works" }, evidenceRefs: [] },
      { id: "e1", description: 'The tests check that the app shows "Look up a food"', check: { type: "file_contains", path: FILE, text: "Look up a food" }, evidenceRefs: [] },
      { id: "e2", description: 'The tests check that the app shows "Plan your list"', check: { type: "file_contains", path: FILE, text: "Plan your list" }, evidenceRefs: [] },
      { id: "tc", description: "The project still type-checks after this part", check: { type: "verification", kind: "typecheck" }, evidenceRefs: [] },
    ],
    validationPlan: [],
    role: "coder",
    ordinal: 13,
    attempts: 0,
  } as unknown as Task;
}

describe("the task contract", () => {
  it("finds that step 14 mixes writing tests with stylesheet work", () => {
    const problems = contractProblems(step14());
    expect(problems.map((p) => p.kind)).toEqual(["mixed_work"]);
  });

  it("separates it into a test-writing step and a stylesheet step, every check owned once", () => {
    let n = 0;
    const [tests, styles] = separateMixed(step14(), () => `task_new${++n}`);
    // Order and dependencies: tests first (after step 12), the stylesheet after the tests.
    expect(tests.dependsOn).toEqual(["task_12"]);
    expect(styles.dependsOn).toEqual([tests.id]);
    expect(tests.expectedPaths).toEqual([FILE]);
    expect(styles.expectedPaths).toEqual(["src/styles/app.css"]);
    // Every original check lands in exactly one step; the type check in both.
    const owner = (id: string) => [tests, styles].filter((t) => t.acceptanceCriteria.some((c) => c.id.startsWith(`${id}-`)));
    for (const id of ["tf", "e0", "e1", "e2"]) expect(owner(id).map((t) => t.id), id).toEqual([tests.id]);
    expect(owner("tc").length).toBe(2);
    // The test step is checked by its tests running, not only by words in the file.
    expect(tests.acceptanceCriteria.map((c) => (c.check as { kind?: string }).kind)).toContain(`tests-run:${FILE}`);
    // Each brief keeps to its own deliverable.
    expect(tests.objective).toMatch(/all 24 tests/);
    expect(tests.objective).not.toMatch(/max-width media query/);
    expect(tests.objective).toMatch(/Write the tests only/);
    expect(styles.objective).toMatch(/max-width media query/);
    expect(styles.objective).not.toMatch(/all 24 tests/);
    expect(styles.objective).toMatch(/Change only src\/styles\/app\.css/);
    // Neither step weakens anything: separated, the step is no longer mixed.
    expect(contractProblems(tests)).toEqual([]);
    expect(contractProblems(styles)).toEqual([]);
  });

  it("leaves a feature step that builds screens and proves them with its own tests as one step", () => {
    const feature = { ...step14(), expectedPaths: ["src/screens/HomeScreen.tsx", "src/styles/app.css", FILE] };
    expect(contractProblems(feature)).toEqual([]);
  });

  it("stops a step whose checks require every test to pass while its brief says most won't", () => {
    const t = { ...step14(), expectedPaths: [FILE], acceptanceCriteria: [{ id: "all", description: "All pass", check: { type: "verification", kind: `tests:${FILE}` }, evidenceRefs: [] }] } as unknown as Task;
    expect(contractProblems(t).map((p) => p.kind)).toEqual(["contradiction"]);
  });
});

describe("tests that run and check something", () => {
  it("flags tests with no expect", () => {
    const src = `it("shows How it works", () => { render(<App />); expect(screen.getByText("How it works")).toBeInTheDocument(); });\nit("opens a category", async () => { render(<App />); await user.click(x); });`;
    expect(assertionlessTests(src)).toEqual(["opens a category"]);
  });

  it("tells a file that runs (assertions failing is fine) from one that can't load", () => {
    expect(runnableVerdict(" Test Files  1 failed (1)\n      Tests  20 failed | 4 passed (24)\n")).toMatchObject({ runs: true, failed: 20, passed: 4 });
    expect(runnableVerdict(`Error: Failed to resolve import "react-router-dom" from "src/acceptance/x.test.tsx". Does the file exist?\n Test Files  1 failed (1)\n      Tests  no tests`)).toMatchObject({ runs: false, why: expect.stringMatching(/react-router-dom/) });
    expect(runnableVerdict("ReferenceError: openApp is not defined\n Tests  3 failed (3)")).toMatchObject({ runs: false });
    expect(runnableVerdict("No test files found, exiting with code 1")).toMatchObject({ runs: false });
  });
});

/** A small project shaped like Clean Cart: hash routing, sample data with a reset, a setup file, one test. */
function project(opts: { provider?: boolean } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-packet-"));
  const w = (rel: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  };
  w("package.json", JSON.stringify({ dependencies: { react: "^19" }, devDependencies: { vitest: "^3", "@testing-library/react": "^16", "@testing-library/user-event": "^14", "@testing-library/jest-dom": "^6", jsdom: "^26" } }));
  w("vite.config.ts", `export default { test: { environment: "jsdom", setupFiles: ["src/test/setup.ts"], globals: true } };`);
  w("src/test/setup.ts", `import { cleanup } from "@testing-library/react";\nimport "@testing-library/jest-dom/vitest";\nafterEach(() => cleanup());`);
  w("src/main.tsx", opts.provider ? `createRoot(root).render(<StrictMode><StoreProvider><App /></StoreProvider></StrictMode>);` : `createRoot(root).render(<StrictMode><App /></StrictMode>);`);
  w("src/App.tsx", `import { useRoute } from "./lib/screens";\nexport default function App() { return <h1>Clean Cart</h1>; }`);
  w("src/lib/screens.ts", `export function useRoute(ids: readonly string[]) { return ids; }`);
  w("src/app/routes.ts", `export const SCREEN_IDS = ["home","categories","products"];`);
  w("src/sim/index.ts", `export function resetDemoData() {}`);
  w("src/app/schema.ts", `export const schema = {};\nexport const seed = {\n  product: [\n    { "id": "p1", "name": "Orchard Lane Organic Honeycrisp Apples" },\n  ],\n  store: [\n    { "id": "s1", "name": "Harvest Co-op" },\n  ],\n};`);
  w("src/screens/HomeScreen.test.tsx", `import { render, screen } from "@testing-library/react";\nit("shows the title", () => { render(<HomeScreen />); expect(screen.getByText("Clean Cart")).toBeInTheDocument(); });`);
  return root;
}

describe("the testing packet", () => {
  it("names what's installed, what isn't, the setup, the hash routing, real fixtures, an example and the command", () => {
    const root = project();
    const facts = testingFacts(root);
    expect(facts.routing?.screenIds).toEqual(["home", "categories", "products"]);
    const packet = testingPacket(root, FILE);
    expect(packet).toMatch(/Installed for tests: vitest, @testing-library\/react, @testing-library\/user-event, @testing-library\/jest-dom, jsdom/);
    expect(packet).toMatch(/Not installed, so never import them: react-router-dom/);
    expect(packet).toMatch(/src\/test\/setup\.ts runs before every test file/);
    expect(packet).toMatch(/window\.location\.hash = "#\/<screen id>"/);
    expect(packet).toMatch(/there is no router library/);
    expect(packet).toMatch(/resetDemoData\(\)/);
    expect(packet).toMatch(/"Orchard Lane Organic Honeycrisp Apples"/);
    expect(packet).toMatch(/"Harvest Co-op"/);
    expect(packet).toMatch(/A working test from this project \(src\/screens\/HomeScreen\.test\.tsx\)/);
    expect(packet).toContain(`run_script "test -- ${FILE}"`);
  });

  it("starts the test file with the hash route, the reset and one real test; not when providers are needed", () => {
    const scaffold = testScaffold(project(), "Write the acceptance tests")!;
    expect(scaffold).toMatch(/import App from "\.\.\/App";/);
    expect(scaffold).toMatch(/import \{ resetDemoData \} from "\.\.\/sim";/);
    expect(scaffold).toMatch(/function openAt\(hash = "#\/home"\)/);
    expect(scaffold).toMatch(/expect\(screen\.getAllByRole\("heading"\)\.length\)\.toBeGreaterThan\(0\)/);
    expect(scaffold).not.toMatch(/react-router/);
    expect(assertionlessTests(scaffold)).toEqual([]);
    expect(testScaffold(project({ provider: true }), "x")).toBeUndefined();
  });
});

describe("a mixed step in a run", () => {
  it("is separated before any model work, without using an attempt, and later steps wait on the stylesheet step", async () => {
    const { makeApp, makeProject, waitFor } = await import("./helpers.js");
    const { ScriptedProvider, call } = await import("../src/models/scripted.js");
    const { ModelRouter } = await import("../src/models/router.js");
    const { idealProbeSolver } = await import("./scripted-agents.js");
    const { app } = makeApp();
    const plan = {
      goal: "Tests and styles",
      assumptions: [],
      relevantFiles: ["README.md"],
      expectedChanges: [FILE, "src/styles/app.css"],
      risk: "low",
      riskNotes: [],
      validationPlan: ["final_report"],
      rollbackStrategy: "Restore snapshots",
      tasks: [
        { key: "t1", title: "Write the acceptance tests and add the stylesheet rules", objective: "Write the tests for Home. Then, in src/styles/app.css, add a max-width media query.", dependsOn: [], expectedPaths: [FILE, "src/styles/app.css"], acceptanceCriteria: [{ id: "tf", description: "tests written", check: { type: "file_exists", path: FILE } }], verification: [], role: "coder" },
        { key: "t2", title: "Build the category page", objective: "Build it", dependsOn: ["t1"], expectedPaths: ["src/screens/Category.tsx"], acceptanceCriteria: [{ id: "c", description: "exists", check: { type: "file_exists", path: "src/screens/Category.tsx" } }], verification: [], role: "coder" },
      ],
    };
    const asked: string[] = [];
    const provider = new ScriptedProvider({ id: "scripted", kind: "scripted", label: "scripted", enabled: true, hosted: false }, async (_req, h) => {
      if ((h[0]?.content ?? "").includes("You are the Planner")) return { content: JSON.stringify(plan) };
      asked.push(h.find((m) => m.role === "user")?.content.split("\n")[0] ?? "");
      return { toolCalls: [call("report_blocked", { reason: "stop here", nextAction: "-" })] };
    });
    app.router.register(provider);
    app.router.register(idealProbeSolver("scripted-ideal"));
    const asg = { providerId: "scripted", model: "agent" };
    const lab = await app.lab.probe({ providerId: "scripted-ideal", model: "agent" });
    app.store.capabilities.upsert({ ...lab, id: "cap_copy", providerId: "scripted", model: "agent", configHash: ModelRouter.configHash(asg) });
    for (const role of ["planner", "coder", "debugger"] as const) app.router.setRoleAssignment(role, asg);
    const { project } = makeProject(app, { "README.md": "# demo\n" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Tests and styles", constraints: [], attachedKnowledgeIds: [] });
    await app.orchestrator.plan(run.id);
    app.orchestrator.start(run.id);
    await waitFor(() => (!app.orchestrator.isActive(run.id) ? true : undefined), 30_000);
    const tasks = app.orchestrator.graph.tasks(run.id);
    const original = tasks.find((t) => t.title === "Write the acceptance tests and add the stylesheet rules")!;
    expect(original).toMatchObject({ status: "skipped", attempts: 0 });
    const tests = tasks.find((t) => t.title.startsWith("Write the acceptance tests in"))!;
    const styles = tasks.find((t) => t.title.startsWith("Add the stylesheet rules"))!;
    expect(styles.dependsOn).toEqual([tests.id]);
    expect(tasks.find((t) => t.title === "Build the category page")!.dependsOn).toEqual([styles.id]);
    // The mixed step itself never reached a model; the first model call was the separated test step's.
    expect(asked.some((q) => q.includes("Write the acceptance tests and add the stylesheet rules"))).toBe(false);
    expect(asked[0]).toMatch(/Write the acceptance tests in/);
  });
});
