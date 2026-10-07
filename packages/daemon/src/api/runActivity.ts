/**
 * Honest run status: what a build is doing right now, a time estimate as a range (or "not enough data"), and advisory
 * signals when it may be stuck. Built only from recorded events and the run's own records. Nothing here acts on a run:
 * a stall warning offers actions, it never cancels, skips, changes criteria or switches models by itself.
 */
import { firstLookAt } from "./firstLook.js";
import { isFinishedRun, TERMINAL_RUN_STATUSES, type Run } from "@flowcode/contracts";
import type { App } from "../app.js";

export type ActivityState =
  | "generating"
  | "running_tools"
  | "waiting_approval"
  | "waiting_service"
  | "retrying"
  | "possibly_stalled"
  | "paused"
  | "planning"
  | "checking"
  | "needs_decision"
  | "failed"
  | "cancelled"
  | "finished"
  | "finished_unverified";

export interface RunEta {
  /** Remaining active time, as a range in ms; absent when there isn't enough comparable history. */
  lowMs?: number;
  highMs?: number;
  /** Plain explanation of what the range is based on, or why there is none. */
  basis: string;
  samples: number;
  comparable: "same_model" | "any_model" | "none";
  remainingSteps: number;
}

export interface StallSignal {
  /** What was observed (facts only). */
  signal: string;
  since: string;
}

export interface RunActivity {
  runId: string;
  state: ActivityState;
  label: string;
  /** When the current state began (best effort, from events). */
  since?: string;
  /** What it's doing, in plain words (the step, the command, the model). */
  detail?: string;
  eta?: RunEta;
  stall?: {
    signals: StallSignal[];
    actions: Array<{ kind: "open_details" | "pause" | "retry_step" | "cancel_run"; label: string }>;
    /** Does this need the person now? Decided from the run's own state, never guessed. */
    needsYou: { verdict: "yes" | "not_yet" | "unsure"; why: string };
  };
  /** Time spent waiting for the person so far (not counted in the estimate). */
  waitingMs: number;
  /** When the main screens were designed (D8): a first look is ready in Preview. */
  firstLookAt?: string;
}

const LABEL: Record<ActivityState, string> = {
  generating: "Writing code",
  running_tools: "Running commands and tests",
  waiting_approval: "Waiting for your approval",
  waiting_service: "Waiting for the model service",
  retrying: "Retrying",
  possibly_stalled: "Possibly stalled",
  paused: "Paused",
  planning: "Planning",
  checking: "Running final checks",
  needs_decision: "Stopped: needs a decision",
  failed: "Failed",
  cancelled: "Cancelled",
  finished: "Finished",
  finished_unverified: "Finished, not fully checked",
};

interface Ev {
  type: string;
  task_id: string | null;
  created_at: string;
  data: string;
}

const MIN = 60_000;
const pct = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)))];

/** How long steps took (first start → verified or stopped), per coder model, from recorded runs. */
export function stepDurations(app: App, opts: { before?: string; excludeRun?: string } = {}): Map<string, number[]> {
  const rows = app.db.all<{ run_id: string; task_id: string; type: string; created_at: string }>(
    `SELECT run_id, task_id, type, created_at FROM events WHERE type IN ('task.started','task.verified','task.blocked') AND task_id IS NOT NULL ${opts.before ? "AND created_at < ?" : ""} ORDER BY seq ASC`,
    ...(opts.before ? [opts.before] : []),
  );
  const first = new Map<string, { run: string; at: number }>();
  const out = new Map<string, number[]>();
  const modelOf = new Map<string, string>();
  for (const r of rows) {
    if (r.run_id === opts.excludeRun) continue;
    if (r.type === "task.started" && !first.has(r.task_id)) first.set(r.task_id, { run: r.run_id, at: Date.parse(r.created_at) });
    // Blocked steps count too: the steps left may stop the same way, and leaving them out made estimates too short.
    if ((r.type === "task.verified" || r.type === "task.blocked") && first.has(r.task_id)) {
      const f = first.get(r.task_id)!;
      const ms = Date.parse(r.created_at) - f.at;
      // Steps verified instantly ("already done") or spanning a pause of hours say nothing about working time.
      if (ms < 5_000 || ms > 3 * 60 * MIN) continue;
      let model = modelOf.get(f.run);
      if (model === undefined) {
        model = app.store.runs.get(f.run)?.modelAssignments?.coder?.model ?? "";
        modelOf.set(f.run, model);
      }
      (out.get(model) ?? out.set(model, []).get(model)!).push(ms);
    }
  }
  return out;
}

/** The remaining-time range for a run, from comparable verified steps. */
export function estimate(app: App, run: Run, durations = stepDurations(app, { excludeRun: run.id })): RunEta {
  const tasks = app.store.tasks.where("run_id = ?", run.id);
  const remaining = tasks.filter((t) => !["verified", "skipped", "invalidated", "blocked", "failed"].includes(t.status)).length;
  const model = run.modelAssignments?.coder?.model ?? "";
  const same = durations.get(model) ?? [];
  const all = [...durations.values()].flat();
  const pick = same.length >= 5 ? { s: same, c: "same_model" as const } : all.length >= 8 ? { s: all, c: "any_model" as const } : { s: [] as number[], c: "none" as const };
  if (!remaining) return { basis: "No steps left to build.", samples: pick.s.length, comparable: pick.c, remainingSteps: 0, lowMs: 0, highMs: 0 };
  if (pick.c === "none") return { basis: `Not enough data yet: ${all.length} finished step${all.length === 1 ? "" : "s"} on record, at least 5 with the same coder model are needed.`, samples: all.length, comparable: "none", remainingSteps: remaining };
  const s = [...pick.s].sort((a, b) => a - b);
  const low = pct(s, 0.25) * remaining;
  const high = pct(s, 0.85) * remaining;
  const basis = `${remaining} step${remaining === 1 ? "" : "s"} left. Based on ${s.length} earlier steps${pick.c === "same_model" ? ` with ${model}` : " with any coder model (fewer than 5 with this one, so less comparable)"}: most took ${Math.round(pct(s, 0.25) / MIN)}–${Math.round(pct(s, 0.85) / MIN)} min each. A rough range: on past builds about 6 in 10 finished inside it. Retries and final checks can add more; time waiting for you isn't included.`;
  return { lowMs: Math.round(low), highMs: Math.round(high), basis, samples: s.length, comparable: pick.c, remainingSteps: remaining };
}

/** Typical gap between a run's activity events, to judge silence against (at least 10 minutes). */
function silenceLimit(evs: Ev[]): number {
  const times = evs.filter((e) => /^(model|tool|command)\.(completed|failed)$/.test(e.type)).map((e) => Date.parse(e.created_at));
  const gaps = times.slice(1).map((t, i) => t - times[i]).filter((g) => g > 0).sort((a, b) => a - b);
  return Math.max(10 * MIN, gaps.length >= 10 ? 4 * pct(gaps, 0.9) : 0);
}

export function runActivity(app: App, runId: string, now = Date.now()): RunActivity {
  const out = runActivityInner(app, runId, now);
  const firstLook = firstLookAt(app, runId);
  return firstLook ? { ...out, firstLookAt: firstLook } : out;
}

function runActivityInner(app: App, runId: string, now: number): RunActivity {
  const run = app.store.runs.require(runId);
  const evs = app.db.all<Ev>("SELECT type, task_id, created_at, data FROM events WHERE run_id = ? AND type != 'command.output' ORDER BY seq DESC LIMIT 400", runId).reverse();
  const last = evs.at(-1);
  const waitingMs = waitingTime(evs, run, now);
  const base = { runId, waitingMs };
  const finishedLike = TERMINAL_RUN_STATUSES.includes(run.status);
  if (finishedLike) {
    const state: ActivityState = run.status === "done_unverified" ? "finished_unverified" : isFinishedRun(run.status) ? "finished" : run.status === "cancelled" ? "cancelled" : "failed";
    return { ...base, state, label: LABEL[state], ...(run.completedAt ? { since: run.completedAt } : {}) };
  }
  if (run.status === "blocked") return { ...base, state: "needs_decision", label: LABEL.needs_decision, ...(last ? { since: last.created_at } : {}) };
  if (app.orchestrator.isRunPaused?.(runId)) return { ...base, state: "paused", label: LABEL.paused };
  const pendingApproval = app.approvals.pending().filter((a) => a.runId === runId && a.kind !== "enhancement_idea");
  if (run.status === "awaiting_approval" || pendingApproval.length) {
    const since = pendingApproval.map((a) => a.createdAt).sort()[0];
    return { ...base, state: "waiting_approval", label: LABEL.waiting_approval, ...(since ? { since } : {}), ...(pendingApproval[0] ? { detail: pendingApproval[0].action } : {}) };
  }

  // Working: what is open right now (a model call or a command without its completion).
  const openModel = openSince(evs, "model.requested", ["model.completed", "model.failed"]);
  const openCmd = openSince(evs, "command.started", ["command.completed", "command.failed"]);
  const retry = [...evs].reverse().find((e) => e.type === "model.retry_scheduled");
  const running = app.store.tasks.where("run_id = ?", runId).find((t) => t.status === "running");
  let state: ActivityState = run.status === "draft" ? "planning" : run.status === "verifying" ? "checking" : openCmd ? "running_tools" : openModel ? "generating" : "generating";
  let since = openCmd?.created_at ?? openModel?.created_at ?? last?.created_at;
  if (retry && openModel && Date.parse(retry.created_at) >= Date.parse(openModel.created_at) - 1000) {
    state = /rate|overload|unavailable|timeout|connect/i.test(retry.data) ? "waiting_service" : "retrying";
    since = retry.created_at;
  } else if (running && running.attempts > 1 && state === "generating") {
    state = "retrying";
  }
  const detail = running ? `${running.title}${running.attempts > 1 ? ` (try ${running.attempts})` : ""}` : undefined;

  // Advisory stall signals: several facts together, never a single one.
  const signals: StallSignal[] = [];
  const silentFor = last ? now - Date.parse(last.created_at) : 0;
  const limit = silenceLimit(evs);
  const worker = app.orchestrator.isActive(runId) || app.orchestrator.isProbing?.(runId);
  if (last && silentFor > limit) signals.push({ signal: `No model, tool or command activity for ${Math.round(silentFor / MIN)} min (this run's usual gaps are under ${Math.round(limit / MIN)} min).`, since: last.created_at });
  if (!worker && ["running", "recovering", "verifying"].includes(run.status)) signals.push({ signal: "The run says it's working, but no FlowCode worker is running it.", since: last?.created_at ?? run.createdAt });
  if (running) {
    const fails = evs.filter((e) => e.task_id === running.id && e.type === "verification.completed" && /failed/.test(e.data)).map((e) => (JSON.parse(e.data) as { message?: string }).message?.replace(/\d+/g, "#").slice(0, 120) ?? "");
    const lastThree = fails.slice(-3);
    if (lastThree.length === 3 && new Set(lastThree).size === 1) signals.push({ signal: `The same check failed the same way 3 times in a row on "${running.title}".`, since: evs.filter((e) => e.task_id === running.id).at(-1)?.created_at ?? now.toString() });
  }
  // Silence alone during a long model call isn't a stall; it needs the silence and a missing worker, or repeated failures.
  const stalled = signals.length >= 2 || signals.some((s) => /no FlowCode worker|same check failed/.test(s.signal));
  if (stalled) state = "possibly_stalled";
  // "Does this need me?": only from what FlowCode knows. No worker = it can't carry on by itself. A step still within its
  // tries stops itself and asks when they run out (MAX_TASK_ATTEMPTS in the orchestrator is 3).
  const TRIES = 3;
  const needsYou: { verdict: "yes" | "not_yet" | "unsure"; why: string } = !worker
    ? { verdict: "yes", why: "No FlowCode worker is running this build, so it won't carry on by itself. Retry the step or cancel the build." }
    : running && running.attempts < TRIES
      ? { verdict: "not_yet", why: `FlowCode is on try ${Math.max(1, running.attempts)} of ${TRIES} for "${running.title}". If that runs out it stops the step and asks you, so you don't have to watch it. Pause or retry now only if you want to step in early.` }
      : openModel
        ? { verdict: "not_yet", why: `A model is still working on its answer (asked ${Math.round((now - Date.parse(openModel.created_at)) / MIN)} min ago). Local models can take a while on long steps.` }
        : { verdict: "unsure", why: "FlowCode can't tell from its records whether this will sort itself out. If it stays like this, pause it and look at the details." };

  return {
    ...base,
    state,
    label: LABEL[state],
    ...(since ? { since } : {}),
    ...(detail ? { detail } : {}),
    eta: estimate(app, run),
    ...(stalled
      ? {
          stall: {
            signals,
            actions: [
              { kind: "open_details" as const, label: "See the details" },
              { kind: "pause" as const, label: "Pause the build" },
              ...(running ? [{ kind: "retry_step" as const, label: "Retry the step" }] : []),
              { kind: "cancel_run" as const, label: "Cancel the build" },
            ],
            needsYou,
          },
        }
      : {}),
  };
}

function openSince(evs: Ev[], open: string, close: string[]): Ev | undefined {
  for (let i = evs.length - 1; i >= 0; i--) {
    if (close.includes(evs[i].type)) return undefined;
    if (evs[i].type === open) return evs[i];
  }
  return undefined;
}

/** Time spent waiting for the person (awaiting approval), so far. */
function waitingTime(evs: Ev[], run: Run, now: number): number {
  let total = 0;
  let since: number | undefined;
  for (const e of evs) {
    if (e.type !== "run.status_changed") continue;
    const to = (JSON.parse(e.data) as { data?: { to?: string } }).data?.to;
    if (!to) continue;
    const t = Date.parse(e.created_at);
    if (since !== undefined) total += t - since;
    since = to === "awaiting_approval" ? t : undefined;
  }
  if (since !== undefined && run.status === "awaiting_approval") total += now - since;
  return total;
}

/** Keeps the first estimate of each run, so the review can compare it with what actually happened. */
export function rememberFirstEstimate(app: App, runId: string, eta: RunEta) {
  const key = `eta:first:${runId}`;
  if (eta.lowMs === undefined || app.store.getSetting(key, null)) return;
  app.store.setSetting(key, { at: new Date().toISOString(), lowMs: eta.lowMs, highMs: eta.highMs, remainingSteps: eta.remainingSteps, comparable: eta.comparable });
}
