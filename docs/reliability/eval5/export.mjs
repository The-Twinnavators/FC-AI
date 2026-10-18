/**
 * Eval 5 evidence (read only): the run as the daemon has it (run, plan, tasks, approvals, checks, commands, tool calls,
 * artifacts), its events, deadline, Home concept offer and the project's design state, written to docs/reliability/eval5/.
 * Changes nothing in FlowCode.
 */
import fs from "node:fs";
import path from "node:path";

const API = "http://127.0.0.1:7457";
const H = { authorization: "Bearer dev-token-flowcode" };
const RUN = "run_7fe7e67ef0a94668b4e0";
const PROJECT = "prj_faa9e544c2344474836f";
const out = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")));
const get = async (p) => {
  const r = await fetch(API + p, { headers: H });
  if (!r.ok) throw new Error(`GET ${p}: ${r.status}`);
  return r.json();
};
const save = (name, data) => fs.writeFileSync(path.join(out, name), JSON.stringify(data, null, 2));

const view = await get(`/runs/${RUN}`);
save("run.json", { ...view.run, references: undefined });
save("plan.json", view.run.plan);
for (const k of ["tasks", "approvals", "checks", "commands", "toolCalls", "artifacts", "checkpoints", "snapshots"]) save(`${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}.json`, view[k] ?? []);
save("run-state.json", { active: view.active, paused: view.paused, interruption: view.interruption, resumable: view.resumable, models: view.models, coder: view.coder, exportedAt: new Date().toISOString() });
save("events.json", await get(`/runs/${RUN}/events/list?limit=3000`));
save("deadline.json", await get(`/runs/${RUN}/deadline`));
save("concepts.json", await get(`/runs/${RUN}/concepts`));
save("design-state.json", await get(`/projects/${PROJECT}/design/state`));
console.log("exported to", out);
