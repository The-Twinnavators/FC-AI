/**
 * Build baseline from a run's recorded events (no model calls, read-only): model calls with prompt / generation /
 * load time and tokens, tool calls and repeated reads, attempts and failures per step, failure kinds, time per step and
 * to the first verified step. Usage: node scripts/build-baseline.mjs <runId> [--json out.json]
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";

const runId = process.argv[2];
if (!runId) throw new Error("usage: node scripts/build-baseline.mjs <runId> [--json out.json]");
const out = process.argv.includes("--json") ? process.argv[process.argv.indexOf("--json") + 1] : undefined;
const db = new DatabaseSync(".flowcode-data/flowcode.sqlite", { readOnly: true });
const events = db.prepare("SELECT seq, type, task_id, created_at, data FROM events WHERE run_id = ? ORDER BY seq").all(runId).map((e) => ({ ...e, d: JSON.parse(e.data) }));
const tasks = db.prepare("SELECT id, data FROM tasks WHERE run_id = ? ORDER BY ordinal").all(runId).map((t) => JSON.parse(t.data));
const t = (s) => Date.parse(s);
const sum = (a) => a.reduce((x, y) => x + y, 0);
const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0);

// Model calls.
const calls = events.filter((e) => e.type === "model.completed").map((e) => ({ task: e.task_id, model: e.d.data?.model, role: e.d.data?.role, ms: e.d.data?.durationMs ?? 0, load: e.d.data?.timing?.loadMs ?? 0, prompt: e.d.data?.timing?.promptMs ?? 0, gen: e.d.data?.timing?.generateMs ?? 0, inTok: e.d.data?.usage?.promptTokens ?? 0, outTok: e.d.data?.usage?.completionTokens ?? 0 }));
const byModel = {};
for (const c of calls) {
  const m = (byModel[c.model] ??= { calls: 0, ms: 0, load: 0, prompt: 0, gen: 0, inTok: 0, outTok: 0, durations: [] });
  m.calls++;
  m.ms += c.ms;
  m.load += c.load;
  m.prompt += c.prompt;
  m.gen += c.gen;
  m.inTok += c.inTok;
  m.outTok += c.outTok;
  m.durations.push(c.ms);
}
const models = Object.fromEntries(
  Object.entries(byModel).map(([k, m]) => [
    k,
    { calls: m.calls, totalMin: +(m.ms / 60000).toFixed(1), medianReplyS: +(med(m.durations) / 1000).toFixed(1), loadShare: +(m.load / Math.max(1, m.ms)).toFixed(2), promptShare: +(m.prompt / Math.max(1, m.ms)).toFixed(2), genShare: +(m.gen / Math.max(1, m.ms)).toFixed(2), genTokPerS: m.gen ? +(m.outTok / (m.gen / 1000)).toFixed(1) : null, promptTokPerS: m.prompt ? +(m.inTok / (m.prompt / 1000)).toFixed(0) : null, avgPromptTok: Math.round(m.inTok / m.calls), avgOutTok: Math.round(m.outTok / m.calls) },
  ]),
);
const failedCalls = events.filter((e) => e.type === "model.failed").map((e) => String(e.d.message ?? "")).map((m) => (/quota|credit/i.test(m) ? "credits" : /not found|404/i.test(m) ? "model missing" : /timeout|abort/i.test(m) ? "timeout" : /ECONNREFUSED|fetch failed|unreachable/i.test(m) ? "unreachable" : "other"));
const failKinds = failedCalls.reduce((a, k) => ((a[k] = (a[k] ?? 0) + 1), a), {});

// Tool calls and repeated reads (same path read again with no write in between).
const tools = events.filter((e) => e.type === "tool.requested");
let repeated = 0;
const seen = new Map();
for (const e of tools) {
  const m = /requested (\w+) \(([^)]*)\)/.exec(String(e.d.message ?? ""));
  if (!m) continue;
  const [, tool, arg] = m;
  const key = `${e.task_id}|${arg}`;
  if (tool === "read_file") {
    if (seen.get(key)) repeated++;
    seen.set(key, true);
  } else if (/create_file|apply_patch|replace_file|edit_/.test(tool)) for (const k of seen.keys()) if (k.startsWith(`${e.task_id}|`)) seen.set(k, false);
}
const toolCounts = tools.reduce((a, e) => {
  const k = /requested (\w+)/.exec(String(e.d.message ?? ""))?.[1] ?? "?";
  a[k] = (a[k] ?? 0) + 1;
  return a;
}, {});

// Steps.
const started = new Map();
const steps = tasks.map((task) => {
  const evs = events.filter((e) => e.task_id === task.id);
  const first = evs.find((e) => e.type === "task.started");
  const verified = evs.find((e) => e.type === "task.verified");
  const end = verified ?? [...evs].reverse().find((e) => /task\.(blocked|failed)/.test(e.type));
  if (first) started.set(task.id, first.created_at);
  const tc = calls.filter((c) => c.task === task.id);
  return { n: task.ordinal + 1, title: task.title.slice(0, 60), status: task.status, attempts: task.attempts, modelCalls: tc.length, modelMin: +(sum(tc.map((c) => c.ms)) / 60000).toFixed(1), wallMin: first && end ? +((t(end.created_at) - t(first.created_at)) / 60000).toFixed(1) : null, blocker: task.blocker?.reason?.slice(0, 140) };
});
const runStart = events[0] ? t(events[0].created_at) : 0;
const firstVerifiedModelStep = events.find((e) => e.type === "task.verified" && calls.some((c) => c.task === e.task_id));
const report = {
  runId,
  events: events.length,
  wallHours: events.length ? +((t(events.at(-1).created_at) - runStart) / 3600000).toFixed(1) : 0,
  modelCalls: calls.length,
  modelHours: +(sum(calls.map((c) => c.ms)) / 3600000).toFixed(1),
  failedModelCalls: failedCalls.length,
  failKinds,
  toolCalls: tools.length,
  toolCounts,
  repeatedReads: repeated,
  stepsVerified: tasks.filter((x) => x.status === "verified").length,
  stepsTotal: tasks.filter((x) => x.status !== "skipped").length,
  attemptsTotal: sum(tasks.map((x) => x.attempts ?? 0)),
  minToFirstVerifiedModelStep: firstVerifiedModelStep ? +((t(firstVerifiedModelStep.created_at) - runStart) / 60000).toFixed(0) : null,
  models,
  steps,
};
console.log(JSON.stringify(report, null, 2));
if (out) fs.writeFileSync(out, JSON.stringify(report, null, 2));
