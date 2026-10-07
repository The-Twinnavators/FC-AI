/**
 * A suggested next step at a blocker (C4 / VUS): only when this computer's own history gives a basis. It looks at
 * every earlier stop of the same kind (checks not met, no progress, model error), whether the person retried it, and
 * whether the step then passed. With at least MIN_TRIES retries of that kind and at least half clearing, Retry is
 * suggested, with the numbers; otherwise it says there's no basis. It never pre-selects or presses anything.
 */
import type { App } from "../app.js";

export type StopKind = "checks" | "no_progress" | "model";
export interface BlockerAdvice {
  kind: StopKind;
  /** Retries of this kind of stop on this computer, and how many then passed. */
  history: { tries: number; cleared: number; guidedTries: number; guidedCleared: number };
  suggest?: "retry" | "retry_guided";
  why: string;
  /** D6: the same kind of stop, retried on cloud builds vs local ones on this computer; a hint only with enough of both. */
  byCoder: { cloudTries: number; cloudCleared: number; localTries: number; localCleared: number };
  cloudHint?: string;
}

const MIN_TRIES = 4;
const KIND_WORDS: Record<StopKind, string> = { checks: "a step's checks weren't met", no_progress: "a step made no progress", model: "the model failed" };
export const stopKind = (message: string): StopKind => (/model error/i.test(message) ? "model" : /no progress/i.test(message) ? "no_progress" : "checks");

export function blockerAdvice(app: App, runId: string, taskId: string): BlockerAdvice {
  const evs = app.db.all<{ task_id: string; type: string; data: string; run_id: string }>(
    "SELECT task_id, type, data, run_id FROM events WHERE task_id IS NOT NULL AND type IN ('task.blocked','task.started','task.verified') ORDER BY seq ASC",
  );
  const msg = (d: string) => {
    try {
      return JSON.parse(d) as { message?: string; data?: { retry?: boolean; guided?: boolean } };
    } catch {
      return {};
    }
  };
  // The kind of the stop being looked at: its latest blocked event.
  let current: StopKind = "checks";
  for (const e of evs) if (e.task_id === taskId && e.type === "task.blocked") current = stopKind(msg(e.data).message ?? "");

  const lastBlock = new Map<string, StopKind>();
  const pending = new Map<string, { kind: StopKind; guided?: boolean; cloud: boolean }>();
  const h = { tries: 0, cleared: 0, guidedTries: 0, guidedCleared: 0 };
  const byCoder = { cloudTries: 0, cloudCleared: 0, localTries: 0, localCleared: 0 };
  const cloudRun = new Map<string, boolean>();
  const isCloud = (id: string) => {
    if (!cloudRun.has(id)) cloudRun.set(id, app.store.runs.get(id)?.modelAssignments.coder?.providerId.startsWith("hosted") ?? false);
    return cloudRun.get(id)!;
  };
  const settle = (task: string, passed: boolean) => {
    const p = pending.get(task);
    if (!p) return;
    pending.delete(task);
    if (p.kind !== current) return;
    h.tries++;
    if (passed) h.cleared++;
    if (p.cloud) {
      byCoder.cloudTries++;
      if (passed) byCoder.cloudCleared++;
    } else {
      byCoder.localTries++;
      if (passed) byCoder.localCleared++;
    }
    if (p.guided) {
      h.guidedTries++;
      if (passed) h.guidedCleared++;
    }
  };
  for (const e of evs) {
    const m = msg(e.data);
    if (e.type === "task.blocked") {
      settle(e.task_id, false);
      lastBlock.set(e.task_id, stopKind(m.message ?? ""));
    } else if (e.type === "task.started" && /^Retry requested/.test(m.message ?? "") && lastBlock.has(e.task_id)) {
      // The retry of the stop being looked at hasn't an outcome yet; it isn't counted.
      if (e.task_id === taskId && e.run_id === runId) continue;
      pending.set(e.task_id, { kind: lastBlock.get(e.task_id)!, cloud: isCloud(e.run_id), ...(m.data?.guided !== undefined ? { guided: m.data.guided } : {}) });
    } else if (e.type === "task.verified") settle(e.task_id, true);
  }

  const what = KIND_WORDS[current];
  // A cloud hint only with at least MIN_TRIES retries each way and the cloud clearly ahead (and this build is local).
  const thisLocal = !isCloud(runId);
  const cloudHintFor = (): { cloudHint?: string } => {
    const { cloudTries: ct, cloudCleared: cc, localTries: lt, localCleared: lc } = byCoder;
    if (!thisLocal || ct < MIN_TRIES || lt < MIN_TRIES) return {};
    if (cc / ct < lc / lt + 0.2) return {};
    return { cloudHint: `On this computer, when ${what}, a retry passed ${cc} of ${ct} times on cloud builds and ${lc} of ${lt} on local ones. To try the cloud, ask for this as a new change with "Use the cloud for this change" ticked.` };
  };
  if (h.tries < MIN_TRIES)
    return { kind: current, history: h, byCoder, ...cloudHintFor(), why: `No basis to suggest a choice yet: on this computer, ${h.tries ? `only ${h.tries} earlier stop${h.tries === 1 ? "" : "s"} where ${what} ${h.tries === 1 ? "was" : "were"} retried` : `no earlier stop where ${what} was retried`}.` };
  const rate = h.cleared / h.tries;
  if (rate < 0.5) return { kind: current, history: h, byCoder, ...cloudHintFor(), why: `No suggestion: when ${what}, a retry passed only ${h.cleared} of ${h.tries} times on this computer. Changing the request or undoing the step may work better.` };
  const guided = h.guidedTries >= 3 && h.guidedCleared / h.guidedTries > rate;
  return {
    kind: current,
    history: h,
    byCoder,
    ...cloudHintFor(),
    suggest: guided ? "retry_guided" : "retry",
    why: guided
      ? `When ${what}, a retry with your guidance passed ${h.guidedCleared} of ${h.guidedTries} times on this computer (any retry: ${h.cleared} of ${h.tries}).`
      : `When ${what}, a retry passed ${h.cleared} of ${h.tries} times on this computer.`,
  };
}
