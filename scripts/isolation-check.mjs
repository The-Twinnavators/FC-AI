/**
 * Read-only isolation check for a measured run (docs/reliability/ISOLATION.md). It reports competing activity; it
 * never starts, resumes, pauses or changes anything. Exit 0 when the machine is clear for the run named (or for a new
 * run when none is named), 1 when something competes.
 *
 *   node scripts/isolation-check.mjs [runId]     (daemon 127.0.0.1:7457, dev token; Ollama 127.0.0.1:11434)
 */
const DAEMON = process.env.FLOWCODE_DAEMON ?? "http://127.0.0.1:7457";
const TOKEN = process.env.FLOWCODE_TOKEN ?? "dev-token-flowcode";
const OLLAMA = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";
const measured = process.argv[2];
const get = async (url, auth = true) => (await fetch(url, auth ? { headers: { authorization: `Bearer ${TOKEN}` } } : {})).json();

const problems = [];
const notes = [];
try {
  const sys = await get(`${DAEMON}/system`);
  const graph = await get(`${DAEMON}/graph`);
  const active = (graph.activeRuns ?? []).map((r) => r.runId ?? r.id).filter(Boolean);
  for (const id of active.filter((id) => id !== measured)) problems.push(`another run is active: ${id}`);
  if (sys.activeRuns > active.length) problems.push(`${sys.activeRuns} active run(s), not all identified`);
  if (sys.pendingApprovals) notes.push(`${sys.pendingApprovals} approval(s) pending`);
  notes.push(`daemon: ${sys.activeRuns} active run(s), ${sys.queueDepth} waiting`);
} catch (err) {
  problems.push(`daemon not reachable at ${DAEMON}: ${err.message}`);
}
try {
  const ps = await get(`${OLLAMA}/api/ps`, false);
  const loaded = (ps.models ?? []).map((m) => `${m.name} (${Math.round((m.size_vram ?? 0) / 2 ** 30)} GB on GPU)`);
  notes.push(`Ollama loaded: ${loaded.join(", ") || "none"}`);
  if (loaded.length > 1) problems.push(`more than one model is loaded: ${loaded.join(", ")}`);
} catch (err) {
  problems.push(`Ollama not reachable at ${OLLAMA}: ${err.message}`);
}
for (const n of notes) console.log(`- ${n}`);
for (const p of problems) console.log(`! ${p}`);
console.log(problems.length ? "Competing activity: pause the measured run (POST /runs/<id>/pause) until it clears." : "Clear: no competing run or model.");
process.exit(problems.length ? 1 : 0);
