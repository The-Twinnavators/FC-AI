/**
 * Representative steps, run the way a build runs them (brief, agent loop, verifier, retries) on a fresh copy of a frozen
 * baseline (database and workspace), against the real local model. One configuration per call; nothing in FlowCode's
 * own data or any live build is touched. Usage:
 *   node scripts/bench-steps.mjs <baselineDir> <workDir> <config> <task> [--cold]
 * config: think-on-24k | think-off-24k | gpu8-16k | gpu8-12k      task: patch | compose | tests | plan
 * Prints one JSON line of measurements.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const FC = "C:/Users/JenoU/Desktop/FlowCode";
const [baseline, workRoot, config, taskId] = process.argv.slice(2);
// Each run in its own folder (a folder still held by an earlier run's process can't be reused).
const work = path.join(workRoot, `${config}-${taskId}-${Date.now()}`);
const cold = process.argv.includes("--cold");
const RUN = "run_73d6f4dd581f4b0d80dc";
const WS = "workspaces/clean-cart-controlled-build-d804f3";
const OLLAMA = "http://127.0.0.1:11434";

// A fresh copy of the baseline (node_modules is a junction to the real one, read-only use; it is removed with rmdir,
// which drops the link only, never with a recursive delete).
fs.mkdirSync(path.join(work, WS), { recursive: true });
fs.copyFileSync(path.join(baseline, "flowcode.sqlite"), path.join(work, "flowcode.sqlite"));
fs.cpSync(path.join(baseline, WS), path.join(work, WS), { recursive: true, filter: (src) => !/node_modules/.test(src) });
execFileSync("cmd", ["/c", "mklink", "/J", path.join(work, WS, "node_modules").replace(/\//g, "\\"), path.join(FC, ".flowcode-data", WS, "node_modules").replace(/\//g, "\\")], { stdio: "ignore" });

const TESTS = {
  patch: ["src/acceptance/bench-patch.test.tsx", `import { render, screen } from "@testing-library/react";\nimport SearchScreen from "../screens/SearchScreen";\n\nit("describes the search in the product's words", () => {\n  render(<SearchScreen />);\n  expect(screen.getByText("Find products by name, brand or category.")).toBeInTheDocument();\n});\n`],
  compose: ["src/acceptance/bench-compose.test.tsx", `import { render, screen, within } from "@testing-library/react";\nimport CategoriesScreen from "../screens/CategoriesScreen";\n\nit("shows four popular categories above the catalog", () => {\n  render(<CategoriesScreen />);\n  const region = screen.getByRole("region", { name: "Popular categories" });\n  for (const name of ["Produce", "Dairy", "Bakery", "Pantry"]) expect(within(region).getByRole("button", { name })).toBeInTheDocument();\n});\n`],
};
const TASKS = {
  patch: { title: "Reword the Search screen's description", objective: 'In src/screens/SearchScreen.tsx, change the PageHeader description to exactly "Find products by name, brand or category." Nothing else changes.', expectedPaths: ["src/screens/SearchScreen.tsx"], criteria: [{ id: "b1", description: "The Search screen shows the new description", check: { type: "verification", kind: "tests:src/acceptance/bench-patch.test.tsx" } }] },
  compose: { title: "Add popular categories to the Categories screen", objective: 'In src/screens/CategoriesScreen.tsx, above the catalog, add a section labelled "Popular categories" (a <section aria-label="Popular categories">) with four buttons, Produce, Dairy, Bakery and Pantry, using the kit\'s Button from ../components/ui. Keep the PageHeader and the catalog.', expectedPaths: ["src/screens/CategoriesScreen.tsx"], criteria: [{ id: "b1", description: "Popular categories show above the catalog", check: { type: "verification", kind: "tests:src/acceptance/bench-compose.test.tsx" } }, { id: "b2", description: "The project still type-checks", check: { type: "verification", kind: "typecheck" } }] },
  tests: { title: "Write the Search screen's acceptance tests", objective: "Write src/acceptance/bench-search.test.tsx: at least three tests of the Search screen (src/screens/SearchScreen.tsx) as a person sees it: its title, its filters and its results list. Render it with render() from @testing-library/react.", expectedPaths: ["src/acceptance/bench-search.test.tsx"], criteria: [{ id: "b1", description: "The tests are written", check: { type: "file_exists", path: "src/acceptance/bench-search.test.tsx" } }, { id: "b2", description: "The tests load and run, and each checks the screen", check: { type: "verification", kind: "tests-run:src/acceptance/bench-search.test.tsx" } }] },
};

const opts = {
  "think-on-24k": { gpuProfile: "standard", routineThinking: true },
  "think-off-24k": { gpuProfile: "standard", routineThinking: false },
  "gpu8-16k": { gpuProfile: "8gb", profileContext: 16384, routineThinking: false },
  "gpu8-12k": { gpuProfile: "8gb", profileContext: 12288, routineThinking: false },
}[config];
if (!opts) throw new Error(`unknown config ${config}`);

if (cold) await fetch(`${OLLAMA}/api/generate`, { method: "POST", body: JSON.stringify({ model: "qwen3:8b", keep_alive: 0 }) }).catch(() => undefined);

// Placement and memory while it runs.
const samples = [];
const poll = setInterval(async () => {
  try {
    const m = ((await (await fetch(`${OLLAMA}/api/ps`)).json()).models ?? []).find((x) => x.name === "qwen3:8b");
    let used = 0;
    try {
      used = Number(execFileSync("nvidia-smi", ["--query-gpu=memory.used", "--format=csv,noheader,nounits"], { encoding: "utf8" }).trim().split("\n")[0]);
    } catch {}
    samples.push({ onGpu: m ? Math.round((100 * m.size_vram) / m.size) : undefined, ctx: m?.context_length, vramMiB: used });
  } catch {}
}, 2000);

const { createApp } = await import(`file:///${FC}/packages/daemon/dist/app.js`);
const { setRuntimeOptions } = await import(`file:///${FC}/packages/daemon/dist/orchestrator/runtimeOptions.js`);
const app = createApp({ dataDir: work });
app.orchestrator.d.mcp = undefined;
setRuntimeOptions(app.store, opts);
const run = app.store.runs.require(RUN);
const project = app.store.projects.require(run.projectId);
const jail = app.projects.jail(project);
const t0 = Date.now();
const startSeq = app.store.db.get("SELECT max(seq) m FROM events")?.m ?? 0;
let outcome = "";
const ids = [];

if (taskId === "plan") {
  const prd = (app.store.getSetting(`runRefs:${RUN}`, []).find((r) => r.role === "prd") ?? {}).content ?? "";
  const { extractRequirements } = await import(`file:///${FC}/packages/daemon/dist/quality/spec.js`);
  const model = await app.orchestrator.decideAppModel(run, extractRequirements(prd, 600), "", new AbortController().signal).catch((e) => (outcome = `error: ${e.message}`, undefined));
  outcome ||= model ? `model: ${model.entities.map((e) => `${e.key} ${(model.seed[e.key] ?? []).length} records`).join(", ")}${model.lookup ? `, ${model.lookup.ratings.length} ratings` : ""}` : "no usable model";
} else {
  const def = TASKS[taskId];
  if (TESTS[taskId]) {
    fs.mkdirSync(path.dirname(path.join(work, WS, TESTS[taskId][0])), { recursive: true });
    fs.writeFileSync(path.join(work, WS, TESTS[taskId][0]), TESTS[taskId][1]);
  }
  const id = `task_bench_${taskId}`;
  app.store.tasks.upsert({ id, runId: RUN, title: def.title, objective: def.objective, status: "pending", dependsOn: [], expectedPaths: def.expectedPaths, actualPaths: [], acceptanceCriteria: def.criteria.map((c) => ({ ...c, evidenceRefs: [] })), validationPlan: { kinds: [] }, role: "coder", ordinal: 999, attempts: 0 });
  // Like the build loop: attempts until verified or blocked; a split step's parts after it.
  const queue = [id];
  while (queue.length && ids.length < 6) {
    const tid = queue.shift();
    ids.push(tid);
    for (let i = 0; i < 4; i++) {
      await app.orchestrator.runTask(app.store.runs.require(RUN), app.store.tasks.require(tid), jail, new AbortController().signal);
      const st = app.store.tasks.require(tid).status;
      if (st === "verified" || st === "blocked") break;
      if (st === "skipped") {
        for (const t of app.store.tasks.where("run_id = ?", RUN)) if (app.store.getSetting(`splitFrom:${t.id}`, "") === tid) queue.push(t.id);
        break;
      }
    }
  }
  const st = ids.map((x) => app.store.tasks.require(x));
  outcome = st.map((t) => `${t.status}${t.status === "blocked" ? ` (${(t.blocker?.reason ?? "").slice(0, 120)})` : ""}`).join(" → ");
}
clearInterval(poll);
await app.processes.cleanupAll("benchmark run finished").catch(() => undefined);
const evs = app.store.db.all("SELECT type, data FROM events WHERE seq > ? AND run_id = ?", startSeq, RUN).map((e) => ({ type: e.type, d: JSON.parse(e.data) }));
const mc = evs.filter((e) => e.type === "model.completed").map((e) => e.d.data ?? {});
const tools = evs.filter((e) => e.type === "tool.completed").map((e) => e.d.message);
const rejected = evs.filter((e) => e.type === "tool.rejected").length;
const sum = (k) => mc.reduce((n, d) => n + (d.timing?.[k] ?? 0), 0);
const final = taskId === "plan" ? undefined : app.store.tasks.require(ids.at(-1));
console.log(JSON.stringify({
  config,
  task: taskId,
  cold,
  outcome,
  verified: taskId === "plan" ? /^model:/.test(outcome) : ids.every((x) => app.store.tasks.require(x).status === "verified") || app.store.tasks.require(ids[0]).status === "skipped" && final?.status === "verified",
  checksAtEnd: final ? final.acceptanceCriteria.map((c) => (c.check.kind ?? c.check.type)) : undefined,
  wallS: Math.round((Date.now() - t0) / 1000),
  attempts: taskId === "plan" ? undefined : ids.map((x) => app.store.tasks.require(x).attempts),
  modelCalls: mc.length,
  genTokens: mc.reduce((n, d) => n + (d.usage?.completionTokens ?? 0), 0),
  thinkingChars: mc.reduce((n, d) => n + (d.thinkingChars ?? 0), 0),
  think: [...new Set(mc.map((d) => d.think))],
  promptTokensMax: Math.max(0, ...mc.map((d) => d.usage?.promptTokens ?? 0)),
  genS: Math.round(sum("generateMs") / 1000),
  promptS: Math.round(sum("promptMs") / 1000),
  loadS: Math.round(sum("loadMs") / 1000),
  truncated: mc.filter((d) => d.doneReason === "length").length,
  toolsOk: tools.filter((m) => / → ok/.test(m)).length,
  toolsFailed: tools.filter((m) => / → failed/.test(m)).length + rejected,
  onGpu: [...new Set(samples.map((s) => s.onGpu).filter((x) => x !== undefined))],
  ctx: [...new Set(samples.map((s) => s.ctx).filter(Boolean))],
  peakVramMiB: Math.max(0, ...samples.map((s) => s.vramMiB || 0)),
}));
try {
  execFileSync("cmd", ["/c", "rmdir", path.join(work, WS, "node_modules").split("/").join("\\")], { stdio: "ignore" });
} catch {}
process.exit(0);
