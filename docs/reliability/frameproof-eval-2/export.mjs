/**
 * Frameproof evaluation evidence (read only), from the Frameproof evaluation daemon (7463): the run, every plan version with its
 * approval state, the prototype plan (requirements, steps, acceptance tests), the Home concept offer, the design state,
 * the run's model calls and timing (performance), its events. `node export.mjs <label>` writes into <label>/.
 */
import fs from "node:fs";
import path from "node:path";

const API = "http://127.0.0.1:7464";
const H = { authorization: "Bearer frameproof-token-2" };
const freezeFile = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "freeze.json");
const { created } = JSON.parse(fs.readFileSync(freezeFile, "utf8"));
const label = process.argv[2] ?? "snapshot";
const out = path.join(path.dirname(freezeFile), label);
fs.mkdirSync(out, { recursive: true });
const get = async (p) => {
  const r = await fetch(API + p, { headers: H });
  if (!r.ok) return { error: `${r.status}` };
  return r.json();
};
const save = (name, data) => fs.writeFileSync(path.join(out, name), JSON.stringify(data ?? null, null, 2));
const view = await get(`/runs/${created.runId}`);
save("run.json", { ...view.run, references: undefined });
save("plan.json", view.run.plan);
save("tasks.json", view.tasks);
save("approvals.json", view.approvals);
save("plan-versions.json", await get(`/runs/${created.runId}/plan/versions`));
save("prototype-plan.json", await get(`/projects/${created.projectId}/plan`));
save("concepts.json", await get(`/runs/${created.runId}/concepts`));
save("design-state.json", await get(`/projects/${created.projectId}/design/state`));
save("models.json", await get(`/runs/${created.runId}/models`));
save("performance.json", await get(`/runs/${created.runId}/performance`));
save("events.json", await get(`/runs/${created.runId}/events/list?limit=3000`));
save("deadline.json", await get(`/runs/${created.runId}/deadline`));
console.log("exported", out);
