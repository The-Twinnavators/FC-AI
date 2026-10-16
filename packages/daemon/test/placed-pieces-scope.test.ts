/**
 * The library pieces placed in the screens: the design step answers for all of them; any other step only for the
 * screens it changed. A reword of the Search screen was sent back for pieces missing from the Home screen.
 */
import { describe, expect, it } from "vitest";
import { ScriptedProvider, call } from "../src/models/scripted.js";
import { ModelRouter } from "../src/models/router.js";
import { placedKey } from "../src/orchestrator/screenPlan.js";
import { idealProbeSolver } from "./scripted-agents.js";
import { makeApp, makeProject, waitFor } from "./helpers.js";

const SEARCH = `import ListStacked from "../sections/ListStacked";\nexport default function Search() { return <ListStacked />; }\n// Find products\n`;

async function runStep(edit: { path: string; find: string; replace: string }) {
  const { app } = makeApp();
  app.router.sleep = async () => {};
  const plan = {
    goal: "g",
    assumptions: [],
    relevantFiles: [edit.path],
    expectedChanges: [edit.path],
    risk: "low",
    riskNotes: [],
    validationPlan: ["final_report"],
    rollbackStrategy: "r",
    tasks: [{ key: "t1", title: "Change a screen's words", objective: `In ${edit.path}, change the words`, dependsOn: [], expectedPaths: [edit.path], acceptanceCriteria: [{ id: "a", description: "changed", check: { type: "file_contains", path: edit.path, text: "Search the shop" } }], verification: [], role: "coder" }],
  };
  const provider = new ScriptedProvider({ id: "scripted", kind: "ollama", label: "Ollama", enabled: true, hosted: false }, async (_req, h) => {
    if ((h[0]?.content ?? "").includes("You are the Planner")) return { content: JSON.stringify(plan) };
    const did = (name: string) => h.some((m) => m.role === "assistant" && JSON.stringify(m).includes(`"${name}"`));
    if (!did("read_file")) return { toolCalls: [call("read_file", { path: edit.path })] };
    if (!did("apply_patch")) return { toolCalls: [call("apply_patch", { path: edit.path, edits: [{ find: edit.find, replace: edit.replace }] })] };
    return { toolCalls: [call("task_complete", { summary: "done", changedPaths: [edit.path] })] };
  });
  provider.listModels = async () => [{ name: "agent" }];
  app.router.register(provider);
  app.router.register(idealProbeSolver("scripted-ideal"));
  const asg = { providerId: "scripted", model: "agent" };
  const lab = await app.lab.probe({ providerId: "scripted-ideal", model: "agent" });
  app.store.capabilities.upsert({ ...lab, id: "cap_copy", providerId: "scripted", model: "agent", configHash: ModelRouter.configHash(asg) });
  for (const role of ["planner", "coder", "debugger"] as const) app.router.setRoleAssignment(role, asg);
  const { project } = makeProject(app, {
    "README.md": "# demo\n",
    "src/screens/Search.tsx": SEARCH,
    // The Home screen's piece was already gone before this step (half-done work from another step).
    "src/screens/Home.tsx": "export default function Home() { return <main />; }\n",
    "src/sections/ListStacked.tsx": "export default function ListStacked() { return <ul />; }\n",
    "src/sections/NbLanding.tsx": "export default function NbLanding() { return <div />; }\n",
  });
  app.projects.updateSettings(project.id, { autonomy: "assisted" });
  const run = app.orchestrator.createRun({ projectId: project.id, objective: "g", constraints: [], attachedKnowledgeIds: [] });
  app.store.setSetting(placedKey(run.id), [
    { screen: "Search", id: "list-stacked", component: "ListStacked", template: false, screenFile: "src/screens/Search.tsx" },
    { screen: "Home", id: "nb-landing", component: "NbLanding", template: true, screenFile: "src/screens/Home.tsx" },
  ]);
  await app.orchestrator.plan(run.id);
  await waitFor(() => !app.orchestrator.isActive(run.id) && ["done", "done_with_warnings", "blocked", "failed"].includes(app.store.runs.require(run.id).status), 30_000);
  const task = app.orchestrator.graph.tasks(run.id)[0]!;
  return { task, attempts: task.attempts, status: task.status };
}

describe("placed library pieces", () => {
  it("a step that changes the Search screen isn't held to the Home screen's pieces", async () => {
    const r = await runStep({ path: "src/screens/Search.tsx", find: "Find products", replace: "Search the shop" });
    expect(r.status).toBe("verified");
    expect(r.attempts).toBe(1);
  });

  it("a step that drops a piece from the screen it changed is still sent back", async () => {
    const r = await runStep({ path: "src/screens/Search.tsx", find: 'import ListStacked from "../sections/ListStacked";\nexport default function Search() { return <ListStacked />; }', replace: "export default function Search() { return <main>Search the shop</main>; }" });
    expect(r.attempts).toBeGreaterThan(1);
  });
});
