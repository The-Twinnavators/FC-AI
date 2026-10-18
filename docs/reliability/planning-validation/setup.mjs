/**
 * Planning-only validation (authorized after eval 5): the real planner, the same Clean Cart brief and PRD, on a separate
 * daemon instance running 0e47443 (port 7461, data in .flowcode-validation) so eval 5's daemon and records stay
 * untouched. Matches eval 5's configuration: runtime options and role assignments copied from the main daemon, the
 * planner/coder/debugger pinned to qwen3-coder:30b at 0.1 on the run. Creates the project and run, records freeze.json,
 * and stops; it approves nothing.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const MAIN = { url: "http://127.0.0.1:7457", h: { authorization: "Bearer dev-token-flowcode", "content-type": "application/json" } };
const VAL = { url: "http://127.0.0.1:7461", h: { authorization: "Bearer validation-token", "content-type": "application/json" } };
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "../../..");
const out = path.join(root, "docs/reliability/planning-validation");
const call = async (d, method, p, body) => {
  const r = await fetch(d.url + p, { method, headers: d.h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${p}: ${r.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
};
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, f))).digest("hex");
const PRD_PATH = "docs/handoff/slice/clean-cart-slice-prd.md";
const OBJECTIVE = "Clean Cart: build the slice in the attached PRD as a complete working prototype: Home, search, a product's page, save it, and see it on Saved.";
const PINNED = { providerId: "ollama", model: "qwen3-coder:30b", temperature: 0.1 };

// Match eval 5's configuration on the validation daemon.
const mainRuntime = await call(MAIN, "GET", "/settings/runtime");
await call(VAL, "POST", "/settings/runtime", mainRuntime);
const mainRoles = await call(MAIN, "GET", "/models/roles");
for (const [role, v] of Object.entries(mainRoles).filter(([r]) => !["planner", "coder", "debugger"].includes(r))) await call(VAL, "POST", "/models/roles", { role, assignment: v.assignment });
const tags = await (await fetch("http://127.0.0.1:11434/api/tags")).json();

const freeze = {
  recordedAt: new Date().toISOString(),
  label: "Planning-only validation of the repaired Request changes workflow: a new run of eval 5's brief. Not a continuation or a completion of eval 5.",
  commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root }).toString().trim(),
  trackedChanges: execFileSync("git", ["status", "--short"], { cwd: root }).toString().split("\n").filter((l) => l && !l.startsWith("??")),
  daemon: { port: 7461, dataDir: ".flowcode-validation", health: await call(VAL, "GET", "/health"), note: "A separate instance so eval 5's daemon (7457) and records stay untouched; eval 5 is paused there." },
  prd: { path: PRD_PATH, sha256: sha(PRD_PATH) },
  promptsAndSkills: { file: "packages/daemon/test/fixtures/builtin-hashes.json", sha256: sha("packages/daemon/test/fixtures/builtin-hashes.json") },
  roleAssignments: await call(VAL, "GET", "/models/roles"),
  runtimeOptions: await call(VAL, "GET", "/settings/runtime"),
  modelDigests: Object.fromEntries(tags.models.map((m) => [m.name, m.digest.slice(0, 12)])),
  run: { project: "Clean Cart slice (planning validation)", autonomy: "supervised", kind: "spec_build", buildMode: "complete", objective: OBJECTIVE, references: [PRD_PATH], pinnedModels: { planner: PINNED, coder: PINNED, debugger: PINNED } },
};
const project = await call(VAL, "POST", "/projects", { name: freeze.run.project, createWorkspace: true });
await call(VAL, "POST", `/projects/${project.id}/settings`, { autonomy: "supervised" });
const prd = fs.readFileSync(path.join(root, PRD_PATH), "utf8");
const deadlineAt = new Date(Date.now() + 2 * 3600_000).toISOString();
const run = await call(VAL, "POST", "/runs", {
  projectId: project.id,
  objective: OBJECTIVE,
  kind: "spec_build",
  buildMode: "complete",
  references: [{ name: "clean-cart-slice-prd.md", role: "prd", content: prd }],
  modelAssignments: { planner: PINNED, coder: PINNED, debugger: PINNED },
  deadlineAt,
  deadlineReason: "Planning-only validation (no generation authorized)",
});
freeze.created = { projectId: project.id, runId: run.id, createdAt: run.createdAt, deadline: await call(VAL, "GET", `/runs/${run.id}/deadline`), modelAssignments: run.modelAssignments };
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "freeze.json"), JSON.stringify(freeze, null, 2));
console.log(JSON.stringify({ projectId: project.id, runId: run.id }));
