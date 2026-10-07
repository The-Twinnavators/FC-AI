/**
 * Run performance: where a run's time went, built from what the runtime already records (events, model calls with
 * the provider's timing, commands, tool calls, checks). Nothing is sampled or estimated except per-check durations,
 * which are the gaps between consecutive check results in the verification phase and are labelled as approximate.
 */
import { TERMINAL_RUN_STATUSES, type FlowEvent } from "@flowcode/contracts";
import type { App } from "../app.js";

export interface PerfItem {
  kind: "model" | "command" | "tool" | "check";
  label: string;
  ms: number;
  task?: string;
}

export interface RunPerformance {
  runId: string;
  status: string;
  finished: boolean;
  startedAt?: string;
  endedAt?: string;
  /** Wall-clock time from the first to the last recorded event (or now, while running). */
  elapsedMs: number;
  /** Time the run sat waiting for a person (plan or action approval). */
  waitingMs: number;
  phases: Array<{ phase: string; ms: number }>;
  /** Busy time by kind of work. Model and tool time run one after the other inside a step, so these add up. */
  busy: { modelMs: number; commandMs: number; toolMs: number; checkMs: number };
  model: {
    calls: number;
    failed: number;
    retries: number;
    totalMs: number;
    /** Provider-reported split; only when the provider reports it (Ollama does). */
    hasTiming: boolean;
    loadMs: number;
    promptMs: number;
    generateMs: number;
    promptTokens: number;
    outputTokens: number;
    /** Writing speed: output tokens per second of generation. */
    tokensPerSec?: number;
    /** Calls that had to load the model into memory first (load time over a second). */
    coldLoads: number;
    /** Times consecutive calls used a different model (each can force a reload on a small GPU). */
    switches: number;
    avgPromptChars: number;
    maxPromptChars: number;
    byModel: Array<{ model: string; roles: string[]; calls: number; totalMs: number; loadMs: number; promptMs: number; generateMs: number; outputTokens: number; coldLoads: number }>;
  };
  commands: { count: number; failed: number; totalMs: number };
  tools: { count: number; totalMs: number; byName: Array<{ name: string; count: number; totalMs: number }> };
  tasks: Array<{ id: string; title: string; status: string; attempts: number; elapsedMs: number; modelMs: number; modelCalls: number; commandMs: number; toolCalls: number; avgPromptChars: number }>;
  checks: Array<{ kind: string; status: string; approxMs: number }>;
  slowest: PerfItem[];
  /** Plain-language observations about the biggest costs. */
  notes: string[];
}

// Tool calls that run commands: their time is counted under commands, not tools.
const COMMAND_TOOLS = new Set(["run_script", "run_command"]);
const WAITING = new Set(["awaiting_approval"]);

const ms = (a?: string, b?: string) => (a && b ? Math.max(0, Date.parse(b) - Date.parse(a)) : 0);

export function runPerformance(app: App, runId: string): RunPerformance {
  const run = app.store.runs.require(runId);
  const finished = TERMINAL_RUN_STATUSES.includes(run.status);
  const events = app.db.all<{ data: string }>("SELECT data FROM events WHERE run_id = ? AND type != 'command.output' ORDER BY seq ASC", runId).map((r) => JSON.parse(r.data) as FlowEvent);
  const tasks = app.store.tasks.where("run_id = ? ORDER BY ordinal ASC", runId);
  const taskTitle = new Map(tasks.map((t) => [t.id, t.title]));
  const startedAt = events[0]?.createdAt ?? run.createdAt;
  const endedAt = finished ? events.at(-1)?.createdAt : new Date().toISOString();
  const slowest: PerfItem[] = [];

  // Status timeline → waiting time.
  let waitingMs = 0;
  let status = "draft";
  let since = startedAt;
  for (const e of events) {
    if (e.type !== "run.status_changed") continue;
    const to = (e.data as { to?: string })?.to;
    if (!to) continue;
    if (WAITING.has(status)) waitingMs += ms(since, e.createdAt);
    status = to;
    since = e.createdAt;
  }
  if (WAITING.has(status) && !finished) waitingMs += ms(since, new Date().toISOString());

  // Phases.
  const phases: RunPerformance["phases"] = [];
  const open = new Map<string, string>();
  for (const e of events) {
    const phase = (e.data as { phase?: string })?.phase;
    if (!phase) continue;
    if (e.type === "phase.started") open.set(phase, e.createdAt);
    else if (e.type === "phase.completed" && open.has(phase)) {
      phases.push({ phase, ms: ms(open.get(phase), e.createdAt) });
      open.delete(phase);
    }
  }
  for (const [phase, at] of open) if (!finished) phases.push({ phase: `${phase} (in progress)`, ms: ms(at, new Date().toISOString()) });

  // Model calls.
  type Md = { role?: string; model?: string; durationMs?: number; usage?: { promptTokens?: number; completionTokens?: number }; timing?: { loadMs?: number; promptMs?: number; generateMs?: number }; promptChars?: number };
  const model = { calls: 0, failed: 0, retries: 0, totalMs: 0, hasTiming: false, loadMs: 0, promptMs: 0, generateMs: 0, promptTokens: 0, outputTokens: 0, coldLoads: 0, switches: 0, avgPromptChars: 0, maxPromptChars: 0, byModel: [] as RunPerformance["model"]["byModel"] };
  const byModel = new Map<string, RunPerformance["model"]["byModel"][number]>();
  const perTask = new Map<string, { modelMs: number; modelCalls: number; commandMs: number; toolCalls: number; promptChars: number; prompts: number }>();
  const taskStat = (id?: string) => {
    if (!id) return undefined;
    const t = perTask.get(id) ?? { modelMs: 0, modelCalls: 0, commandMs: 0, toolCalls: 0, promptChars: 0, prompts: 0 };
    perTask.set(id, t);
    return t;
  };
  let promptCharsTotal = 0;
  let prevModel: string | undefined;
  for (const e of events) {
    if (e.type === "model.failed") model.failed++;
    if (e.type === "model.retry_scheduled") model.retries++;
    if (e.type !== "model.completed") continue;
    const d = (e.data ?? {}) as Md;
    const name = d.model ?? "unknown";
    const dur = d.durationMs ?? 0;
    model.calls++;
    model.totalMs += dur;
    model.promptTokens += d.usage?.promptTokens ?? 0;
    model.outputTokens += d.usage?.completionTokens ?? 0;
    if (d.timing) {
      model.hasTiming = true;
      model.loadMs += d.timing.loadMs ?? 0;
      model.promptMs += d.timing.promptMs ?? 0;
      model.generateMs += d.timing.generateMs ?? 0;
    }
    const cold = (d.timing?.loadMs ?? 0) > 1000;
    if (cold) model.coldLoads++;
    if (prevModel && prevModel !== name) model.switches++;
    prevModel = name;
    promptCharsTotal += d.promptChars ?? 0;
    model.maxPromptChars = Math.max(model.maxPromptChars, d.promptChars ?? 0);
    const m = byModel.get(name) ?? { model: name, roles: [], calls: 0, totalMs: 0, loadMs: 0, promptMs: 0, generateMs: 0, outputTokens: 0, coldLoads: 0 };
    m.calls++;
    m.totalMs += dur;
    m.loadMs += d.timing?.loadMs ?? 0;
    m.promptMs += d.timing?.promptMs ?? 0;
    m.generateMs += d.timing?.generateMs ?? 0;
    m.outputTokens += d.usage?.completionTokens ?? 0;
    if (cold) m.coldLoads++;
    if (d.role && !m.roles.includes(d.role)) m.roles.push(d.role);
    byModel.set(name, m);
    const t = taskStat(e.taskId);
    if (t) {
      t.modelMs += dur;
      t.modelCalls++;
      t.promptChars += d.promptChars ?? 0;
      t.prompts += d.promptChars ? 1 : 0;
    }
    slowest.push({ kind: "model", label: `${d.role ?? "model"} · ${name}${cold ? " (loaded the model first)" : ""}`, ms: dur, task: e.taskId ? taskTitle.get(e.taskId) : undefined });
  }
  model.avgPromptChars = model.calls ? Math.round(promptCharsTotal / model.calls) : 0;
  model.byModel = [...byModel.values()].sort((a, b) => b.totalMs - a.totalMs);
  const tokensPerSec = model.generateMs ? Math.round((model.outputTokens / model.generateMs) * 1000 * 10) / 10 : undefined;

  // Commands.
  const commands = { count: 0, failed: 0, totalMs: 0 };
  for (const c of app.store.commands.where("run_id = ?", runId)) {
    const dur = c.durationMs ?? ms(c.startedAt, c.completedAt);
    if (!c.startedAt && !dur) continue;
    commands.count++;
    commands.totalMs += dur;
    if (c.status === "failed" || (c.exitCode !== undefined && c.exitCode !== 0)) commands.failed++;
    const t = taskStat(c.taskId);
    if (t) t.commandMs += dur;
    slowest.push({ kind: "command", label: c.argv.join(" ").slice(0, 80), ms: dur, task: c.taskId ? taskTitle.get(c.taskId) : undefined });
  }

  // Tool calls (file reads, edits, searches…), excluding the ones that ran commands.
  const tools = { count: 0, totalMs: 0, byName: [] as RunPerformance["tools"]["byName"] };
  const byTool = new Map<string, { name: string; count: number; totalMs: number }>();
  for (const c of app.store.toolCalls.where("run_id = ?", runId)) {
    const t = taskStat(c.taskId);
    if (t) t.toolCalls++;
    if (COMMAND_TOOLS.has(c.toolName)) continue;
    const dur = ms(c.startedAt, c.completedAt);
    tools.count++;
    tools.totalMs += dur;
    const b = byTool.get(c.toolName) ?? { name: c.toolName, count: 0, totalMs: 0 };
    b.count++;
    b.totalMs += dur;
    byTool.set(c.toolName, b);
    if (dur > 500) slowest.push({ kind: "tool", label: c.toolName, ms: dur, task: c.taskId ? taskTitle.get(c.taskId) : undefined });
  }
  tools.byName = [...byTool.values()].sort((a, b) => b.totalMs - a.totalMs);

  // Checks: approximate duration = time since the previous result in the verification phase.
  const verifyStart = events.find((e) => e.type === "phase.started" && (e.data as { phase?: string })?.phase === "verification")?.createdAt;
  const runChecks = app.store.checks.where("run_id = ?", runId).filter((c) => !c.taskId).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  const checks: RunPerformance["checks"] = [];
  let prev = verifyStart;
  for (const c of runChecks) {
    if (!prev || c.updatedAt < prev) continue;
    const approx = ms(prev, c.updatedAt);
    checks.push({ kind: c.kind, status: c.status, approxMs: approx });
    if (approx > 1000) slowest.push({ kind: "check", label: c.kind.replace(/_/g, " "), ms: approx });
    prev = c.updatedAt;
  }
  const verifyMs = phases.filter((p) => p.phase.startsWith("verification")).reduce((n, p) => n + p.ms, 0);
  const verifyCommandMs = app.store.commands
    .where("run_id = ?", runId)
    .filter((c) => !c.taskId && c.startedAt && verifyStart && c.startedAt >= verifyStart)
    .reduce((n, c) => n + (c.durationMs ?? ms(c.startedAt, c.completedAt)), 0);
  const checkMs = Math.max(0, verifyMs - verifyCommandMs);

  // Steps: from "started" to its last verified/blocked event.
  const taskRows: RunPerformance["tasks"] = tasks.map((t) => {
    const evs = events.filter((e) => e.taskId === t.id);
    const first = evs.find((e) => e.type === "task.started")?.createdAt ?? evs[0]?.createdAt;
    const last = [...evs].reverse().find((e) => e.type === "task.verified" || e.type === "task.blocked")?.createdAt ?? evs.at(-1)?.createdAt;
    const s = perTask.get(t.id);
    return { id: t.id, title: t.title, status: t.status, attempts: t.attempts, elapsedMs: ms(first, last), modelMs: s?.modelMs ?? 0, modelCalls: s?.modelCalls ?? 0, commandMs: s?.commandMs ?? 0, toolCalls: s?.toolCalls ?? 0, avgPromptChars: s?.prompts ? Math.round(s.promptChars / s.prompts) : 0 };
  });

  const busy = { modelMs: model.totalMs, commandMs: commands.totalMs, toolMs: tools.totalMs, checkMs };
  return {
    runId,
    status: run.status,
    finished,
    startedAt,
    endedAt,
    elapsedMs: ms(startedAt, endedAt),
    waitingMs,
    phases,
    busy,
    model: { ...model, tokensPerSec },
    commands,
    tools,
    tasks: taskRows,
    checks,
    slowest: slowest.sort((a, b) => b.ms - a.ms).slice(0, 10),
    notes: observations(busy, { ...model, tokensPerSec }, commands, waitingMs),
  };
}

const secs = (n: number) => (n >= 60_000 ? `${Math.round(n / 6000) / 10} min` : `${Math.round(n / 100) / 10}s`);
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

/** The few things worth knowing, biggest first. Only states what the numbers show. */
function observations(busy: RunPerformance["busy"], model: RunPerformance["model"], commands: RunPerformance["commands"], waitingMs: number): string[] {
  const total = busy.modelMs + busy.commandMs + busy.toolMs + busy.checkMs;
  const out: Array<{ weight: number; text: string }> = [];
  if (!total) return ["Nothing has been timed for this run yet."];
  const biggest = (Object.entries(busy) as Array<[keyof typeof busy, number]>).sort((a, b) => b[1] - a[1])[0];
  const names: Record<keyof typeof busy, string> = { modelMs: "the AI model", commandMs: "commands (installs, builds, tests)", toolMs: "file tools", checkMs: "browser and quality checks" };
  out.push({ weight: biggest[1], text: `Most of the working time went to ${names[biggest[0]]}: ${secs(biggest[1])} of ${secs(total)} (${pct(biggest[1], total)}%).` });
  if (model.hasTiming && model.totalMs) {
    if (model.loadMs > 0.15 * model.totalMs) out.push({ weight: model.loadMs, text: `Loading models into memory took ${secs(model.loadMs)} (${pct(model.loadMs, model.totalMs)}% of model time) across ${model.coldLoads} load${model.coldLoads === 1 ? "" : "s"}${model.switches ? ` and ${model.switches} model switch${model.switches === 1 ? "" : "es"}` : ""}.` });
    if (model.promptMs > 0.25 * model.totalMs) out.push({ weight: model.promptMs, text: `Reading prompts took ${secs(model.promptMs)} (${pct(model.promptMs, model.totalMs)}% of model time). Prompts averaged ${model.avgPromptChars.toLocaleString()} characters; the largest was ${model.maxPromptChars.toLocaleString()}.` });
    if (model.generateMs > 0.4 * model.totalMs) out.push({ weight: model.generateMs, text: `Writing replies took ${secs(model.generateMs)} (${pct(model.generateMs, model.totalMs)}% of model time)${model.tokensPerSec ? ` at about ${model.tokensPerSec} tokens per second` : ""}.` });
  } else if (model.calls) {
    out.push({ weight: 0, text: "This run has no load, prompt or writing breakdown: it ran before FlowCode started recording it, or the provider doesn't report it." });
  }
  if (model.failed || model.retries) out.push({ weight: 1, text: `${model.failed} model call${model.failed === 1 ? "" : "s"} failed and ${model.retries} ${model.retries === 1 ? "was" : "were"} retried.` });
  if (commands.failed) out.push({ weight: 1, text: `${commands.failed} of ${commands.count} commands failed.` });
  if (waitingMs > 60_000) out.push({ weight: 0, text: `The run waited ${secs(waitingMs)} for your approval; that time isn't counted as work above.` });
  return out.sort((a, b) => b.weight - a.weight).map((x) => x.text);
}
