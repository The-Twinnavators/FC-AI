/**
 * Frameproof evaluation: one fresh end-to-end run of the attached PRD (Frameproof-PRD.md, the source of truth) on a
 * separate daemon (port 7464, data in .flowcode-frameproof-2, built from the tested commit into packages/daemon/dist-v4),
 * so no project, scope, design state or revision from Clean Cart or any other run is present. Matches the configuration
 * of the earlier measured runs: runtime options and support-role assignments copied from the main daemon, the
 * planner/coder/debugger pinned to qwen3-coder:30b at 0.1 on the run. No deadline (the run is measured, not cut off).
 * Creates the project and run, records freeze.json, and stops; it approves nothing.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const MAIN = { url: "http://127.0.0.1:7457", h: { authorization: "Bearer dev-token-flowcode", "content-type": "application/json" } };
const EVAL = { url: "http://127.0.0.1:7464", h: { authorization: "Bearer frameproof-token-2", "content-type": "application/json" } };
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const root = path.resolve(here, "../../..");
const call = async (d, method, p, body) => {
  const r = await fetch(d.url + p, { method, headers: d.h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${p}: ${r.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
};
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const PRD_FILE = path.join(here, "Frameproof-PRD.md");
const OBJECTIVE = "Frameproof: build the attached PRD as a complete working prototype.";
const PINNED = { providerId: "ollama", model: "qwen3-coder:30b", temperature: 0.1 };

await call(EVAL, "POST", "/settings/runtime", await call(MAIN, "GET", "/settings/runtime"));
const mainRoles = await call(MAIN, "GET", "/models/roles");
for (const [role, v] of Object.entries(mainRoles).filter(([r]) => !["planner", "coder", "debugger"].includes(r))) await call(EVAL, "POST", "/models/roles", { role, assignment: v.assignment });
const tags = await (await fetch("http://127.0.0.1:11434/api/tags")).json();
const git = (...a) => execFileSync("git", a, { cwd: root }).toString().trim();

const freeze = {
  recordedAt: new Date().toISOString(),
  label: "Frameproof end-to-end evaluation 2 (after the 84f648f repair): a different PRD, separate from Clean Cart. Passing it says nothing about the Clean Cart failure.",
  commit: git("rev-parse", "HEAD"),
  commitIncludes: git("log", "--format=%h %s", "0e47443^..HEAD").split("\n").map((l) => l.slice(0, 200)),
  trackedChanges: git("status", "--short").split("\n").filter((l) => l && !l.startsWith("??")),
  daemon: { port: 7464, dataDir: ".flowcode-frameproof-2", build: "packages/daemon/dist-v4 (compiled from the commit above)", health: await call(EVAL, "GET", "/health") },
  prd: { file: "docs/reliability/frameproof-eval/Frameproof-PRD.md", from: "C:/Users/JenoU/Downloads/Frameproof-PRD.md", sha256: sha(PRD_FILE), chars: fs.readFileSync(PRD_FILE, "utf8").length },
  promptsAndSkills: { file: "packages/daemon/test/fixtures/builtin-hashes.json", sha256: sha(path.join(root, "packages/daemon/test/fixtures/builtin-hashes.json")) },
  roleAssignments: await call(EVAL, "GET", "/models/roles"),
  runtimeOptions: await call(EVAL, "GET", "/settings/runtime"),
  modelDigests: Object.fromEntries(tags.models.map((m) => [m.name, m.digest.slice(0, 12)])),
  run: { project: "Frameproof (evaluation 2)", autonomy: "supervised", kind: "spec_build", buildMode: "complete", objective: OBJECTIVE, references: ["Frameproof-PRD.md (role prd)"], pinnedModels: { planner: PINNED, coder: PINNED, debugger: PINNED }, deadline: "none", constraints: [] },
};
const project = await call(EVAL, "POST", "/projects", { name: "Frameproof (evaluation 2)", createWorkspace: true });
await call(EVAL, "POST", `/projects/${project.id}/settings`, { autonomy: "supervised" });
const run = await call(EVAL, "POST", "/runs", {
  projectId: project.id,
  objective: OBJECTIVE,
  kind: "spec_build",
  buildMode: "complete",
  references: [{ name: "Frameproof-PRD.md", role: "prd", content: fs.readFileSync(PRD_FILE, "utf8") }],
  modelAssignments: { planner: PINNED, coder: PINNED, debugger: PINNED },
});
freeze.created = { projectId: project.id, runId: run.id, createdAt: run.createdAt, modelAssignments: run.modelAssignments, constraints: run.constraints };
fs.writeFileSync(path.join(here, "freeze.json"), JSON.stringify(freeze, null, 2));
console.log(JSON.stringify({ projectId: project.id, runId: run.id }));
