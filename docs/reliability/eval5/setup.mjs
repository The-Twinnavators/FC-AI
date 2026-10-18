/**
 * Eval 5 setup (one controlled end-to-end builder evaluation, authorized 2026-10-18): the same brief as eval 4
 * (Clean Cart slice PRD, same objective, complete app, Supervised, 2-hour deadline, attempt 2's models pinned on the run).
 * Creates the project and the run with its deadline, confirms the deadline, writes freeze.json, and stops. It approves
 * nothing: the plan and the Look are the owner's.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

const API = "http://127.0.0.1:7457";
const H = { authorization: "Bearer dev-token-flowcode", "content-type": "application/json" };
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "../../..");
const out = path.join(root, "docs/reliability/eval5");
const call = async (method, p, body) => {
  const r = await fetch(API + p, { method, headers: H, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${p}: ${r.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
};
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, f))).digest("hex");

const PRD_PATH = "docs/handoff/slice/clean-cart-slice-prd.md";
const OBJECTIVE = "Clean Cart: build the slice in the attached PRD as a complete working prototype: Home, search, a product's page, save it, and see it on Saved.";
const PINNED = { providerId: "ollama", model: "qwen3-coder:30b", temperature: 0.1 };

const runs = await call("GET", "/runs");
const active = runs.filter((r) => ["running", "queued", "verifying", "recovering", "awaiting_approval"].includes(r.status));
if (active.length) throw new Error(`Active runs: ${active.map((r) => r.id).join(", ")}`);
const tags = await (await fetch("http://127.0.0.1:11434/api/tags")).json();

const freeze = {
  recordedAt: new Date().toISOString(),
  label: "Eval 5: a fresh run of eval 4's brief (attempt 2 was denied and cancelled, so it can't be resumed)",
  commit: execSync("git rev-parse HEAD", { cwd: root }).toString().trim(),
  trackedChanges: execSync("git status --short", { cwd: root }).toString().split("\n").filter((l) => l && !l.startsWith("??")),
  daemon: await call("GET", "/health"),
  activeRuns: [],
  prd: { path: PRD_PATH, sha256: sha(PRD_PATH) },
  promptsAndSkills: { file: "packages/daemon/test/fixtures/builtin-hashes.json", sha256: sha("packages/daemon/test/fixtures/builtin-hashes.json") },
  globalRoleAssignments: await call("GET", "/settings"),
  runtimeOptions: await call("GET", "/settings/runtime"),
  modelDigests: Object.fromEntries(tags.models.map((m) => [m.name, m.digest.slice(0, 12)])),
  run: {
    project: "Clean Cart slice (eval 5)",
    autonomy: "supervised",
    kind: "spec_build",
    buildMode: "complete",
    objective: OBJECTIVE,
    references: [PRD_PATH],
    pinnedModels: { planner: PINNED, coder: PINNED, debugger: PINNED },
    deadlineHours: 2,
  },
  differencesFromAttempt2: [
    "Code: 9a84b42 (attempt 2 ran 68338ff). Between them: the approval pop-up fix; the design state and shared Look editor (on the plan card, the design review and the Design tab); the build applies only a selected look; Flat/Tactile defaults (Bold aisle is now Flat); applied-vs-verified results; style capture switched off; motion phases 1-2 (motion levels in the Look, motion.css, router page transitions and focus policy, catalog result continuity, starter motion parts); still screenshots in the verification path; the generated catalog no longer remounts on a category change.",
    "Global role assignments changed since attempt 2 (planner, coder and debugger are now qwen3:8b with reasoning); this run pins attempt 2's qwen3-coder:30b at temperature 0.1 on the run itself. Support roles as recorded in globalRoleAssignments.",
    "Same PRD (sha256 identical), same prompts and skills (builtin-hashes.json identical), same runtime options, same policy (Supervised) and deadline length (2 h).",
    "Attempt 2 produced no app (denied at the plan), so there is no generated-app result to compare against; eval 1-3 used different code, policies or briefs.",
  ],
};

const project = await call("POST", "/projects", { name: freeze.run.project, createWorkspace: true });
await call("POST", `/projects/${project.id}/settings`, { autonomy: "supervised" });
const prd = fs.readFileSync(path.join(root, PRD_PATH), "utf8");
const deadlineAt = new Date(Date.now() + 2 * 3600_000).toISOString();
const run = await call("POST", "/runs", {
  projectId: project.id,
  objective: OBJECTIVE,
  kind: "spec_build",
  buildMode: "complete",
  references: [{ name: "clean-cart-slice-prd.md", role: "prd", content: prd }],
  modelAssignments: { planner: PINNED, coder: PINNED, debugger: PINNED },
  deadlineAt,
  deadlineReason: "Eval 5: one two-hour measured run (planning and approvals included)",
});
const deadline = await call("GET", `/runs/${run.id}/deadline`);
if (!deadline || deadline.at !== deadlineAt) {
  await call("POST", `/runs/${run.id}/cancel`, {}).catch(() => undefined);
  throw new Error(`Deadline not set as asked (${JSON.stringify(deadline)}); the run was cancelled before work`);
}
freeze.created = { projectId: project.id, runId: run.id, createdAt: run.createdAt, deadline, modelAssignments: run.modelAssignments, strategy: run.strategy ?? null };
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "freeze.json"), JSON.stringify(freeze, null, 2));
console.log(JSON.stringify({ projectId: project.id, runId: run.id, deadline: deadline.at }));
