// One controlled activation of the committed FlowCode build on the main daemon: back up the database (online backup)
// and the Frameproof workspace (without node_modules), keep a rollback copy of the running build, rebuild contracts and
// daemon, restart once through System → Restart, and check the new code answers and the run is as it was.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { DatabaseSync, backup } from "node:sqlite";

const root = "C:/Users/JenoU/Desktop/FlowCode";
const API = "http://127.0.0.1:7457";
const H = { authorization: "Bearer dev-token-flowcode", "content-type": "application/json" };
const RUN = "run_b789650d36dd4323aa4b";
const ts = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const log = (...a) => console.log(new Date().toISOString(), ...a);
const get = async (p) => {
  const r = await fetch(`${API}${p}`, { headers: H });
  return { status: r.status, body: r.status === 200 ? await r.json() : await r.text() };
};

// 0. Nothing may be working.
const before = await get(`/runs/${RUN}`);
if (before.body.active) throw new Error("the run is active: not activating");
const taskStates = (b) => b.tasks.map((t) => `${t.id}:${t.status}:${t.attempts}`).join("\n");

// 1. Backups.
const dir = path.join(root, ".flowcode-data/backups", ts);
fs.mkdirSync(dir, { recursive: true });
const live = new DatabaseSync(path.join(root, ".flowcode-data/flowcode.sqlite"), { readOnly: true });
await backup(live, path.join(dir, "flowcode.sqlite"));
live.close();
fs.cpSync(path.join(root, ".flowcode-data/workspaces/frameproof-f6873f"), path.join(dir, "frameproof-f6873f"), { recursive: true, filter: (s) => !/[\\/]node_modules([\\/]|$)/.test(s) });
const rollback = path.join(root, `packages/daemon/dist-rollback-${ts}`);
fs.cpSync(path.join(root, "packages/daemon/dist"), rollback, { recursive: true });
const contractsRollback = path.join(root, `packages/contracts/dist-rollback-${ts}`);
fs.cpSync(path.join(root, "packages/contracts/dist"), contractsRollback, { recursive: true });
log("backups", JSON.stringify({ db: path.join(dir, "flowcode.sqlite"), workspace: path.join(dir, "frameproof-f6873f"), daemonDist: rollback, contractsDist: contractsRollback }));

// 2. Build.
execSync("npx tsc -b", { cwd: path.join(root, "packages/contracts"), stdio: "inherit" });
execSync("npx tsc -b", { cwd: path.join(root, "packages/daemon"), stdio: "inherit" });
for (const f of ["packages/daemon/dist/orchestrator/boundedRun.js", "packages/daemon/dist/orchestrator/designContext.js"]) if (!fs.existsSync(path.join(root, f))) throw new Error(`build is missing ${f}`);
log("built", execSync("git rev-parse --short HEAD", { cwd: root }).toString().trim());

// 3. One restart.
const sys0 = await get("/system");
// The daemon exits while answering: a closed connection here means the restart began.
try {
  await fetch(`${API}/system/restart`, { method: "POST", headers: H });
} catch (e) {
  log("restart request closed by the exiting daemon:", e.cause?.code ?? e.message);
}
log("restart requested");
let up;
for (let i = 0; i < 90; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  try {
    const sys = await get("/system");
    up = await get("/runs/" + RUN + "/run-steps");
    if (up.status === 200 && sys.body?.pid && sys.body.pid !== sys0.body?.pid) break;
  } catch {
    /* down */
  }
}
if (up?.status !== 200) throw new Error(`the new build didn't answer: ${JSON.stringify(up)}`);
log("new daemon", JSON.stringify({ pidBefore: sys0.body?.pid, runSteps: up.body }));

// 4. The run is as it was, nothing started.
const after = await get(`/runs/${RUN}`);
const same = taskStates(before.body) === taskStates(after.body);
log("run", JSON.stringify({ status: after.body.run.status, active: after.body.active, paused: after.body.paused, tasksUnchanged: same }));
if (!same) console.log(taskStates(after.body));
fs.writeFileSync(path.join(dir, "activation.json"), JSON.stringify({ at: new Date().toISOString(), commit: execSync("git rev-parse HEAD", { cwd: root }).toString().trim(), backups: { db: "flowcode.sqlite", workspace: "frameproof-f6873f", daemonDist: rollback, contractsDist: contractsRollback }, systemBefore: sys0.body?.daemon ?? null, runAfter: { status: after.body.run.status, active: after.body.active, tasksUnchanged: same } }, null, 2));
