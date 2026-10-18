/**
 * Why a build isn't working right now, and what makes it go again (unattended runs). Every stop is recorded on the run
 * with its cause, whether FlowCode recovers from it on its own, the recovery action, its retry budget and timeout, the
 * condition that lets it resume, and whether the person must act. Kept in the database, so a daemon restart picks it up.
 * Nothing waits without a stated way out: a recovery either succeeds and resumes the build, or runs out of attempts and
 * says the person is needed.
 */
import type { EventBus } from "../events/bus.js";
import type { Store } from "../db/store.js";

export type InterruptionCause =
  | "provider_unavailable" // the local model service isn't answering (recoverable)
  | "provider_busy" // out of GPU memory or rate limited (recoverable)
  | "provider_account" // out of credit or sign-in refused (the person)
  | "model_missing" // a model isn't installed (the person: FlowCode never downloads one)
  | "gpu_queue" // another build is using the GPU (starts on its own)
  | "maintenance" // FlowCode paused it for its own work (resumes on its own when authorized)
  | "user_pause" // the person paused it
  | "approval" // waiting for an approval
  | "attempts_exhausted" // a step used all its attempts
  | "task_contract" // a step's brief and checks need the person's choice
  | "internal_error" // FlowCode itself failed (one bounded retry)
  | "orphaned" // marked as working, but no FlowCode worker runs it (resumed from its checkpoint, at most twice)
  | "deadline" // the run's absolute deadline passed (only an extension the person records lets it go on)
  | "cancelled";

export interface Interruption {
  runId: string;
  taskId?: string;
  cause: InterruptionCause;
  /** What stopped and why, in a sentence. */
  detail: string;
  at: string;
  by: "system" | "user";
  recoverable: boolean;
  needsUser: boolean;
  /** What FlowCode does about it ("Retrying the local model"). */
  action: string;
  /** What lets it go again ("the model service answers", "you press Continue"). */
  resumeWhen: string;
  attempt: number;
  maxAttempts: number;
  /** Each recovery attempt's own time limit. */
  timeoutMs: number;
  nextAttemptAt?: string;
  /** A system pause's registered continuation: resume on its own once the work it paused for is done and checked. */
  continuation?: { authorized: boolean; by: string; at: string; consumedAt?: string };
  state: "active" | "resuming" | "resolved";
  resolvedAt?: string;
  resolution?: string;
}

/** Waits between automatic recovery attempts (provider): 30 s, 1, 2, 5, 10 and 15 minutes, about 33 minutes in all. */
export const RECOVERY_BACKOFF_MS = [30_000, 60_000, 120_000, 300_000, 600_000, 900_000];

export interface Policy {
  recoverable: boolean;
  needsUser: boolean;
  action: string;
  resumeWhen: string;
  maxAttempts: number;
  timeoutMs: number;
}

export function policyFor(cause: InterruptionCause): Policy {
  switch (cause) {
    case "provider_unavailable":
      return { recoverable: true, needsUser: false, action: "Recovering: retrying the local model", resumeWhen: "the model service answers again (checked automatically)", maxAttempts: RECOVERY_BACKOFF_MS.length, timeoutMs: 15_000 };
    case "provider_busy":
      return { recoverable: true, needsUser: false, action: "Recovering: waiting for the GPU memory to free, then retrying", resumeWhen: "the model can run again (checked automatically)", maxAttempts: RECOVERY_BACKOFF_MS.length, timeoutMs: 15_000 };
    case "gpu_queue":
      return { recoverable: true, needsUser: false, action: "Queued: another build is using the GPU", resumeWhen: "the GPU is free (starts on its own)", maxAttempts: 1, timeoutMs: 0 };
    case "maintenance":
      return { recoverable: true, needsUser: false, action: "Paused for maintenance: will resume automatically after verification", resumeWhen: "the maintenance finishes and the model service and workspace check out", maxAttempts: 1, timeoutMs: 15_000 };
    case "internal_error":
      return { recoverable: true, needsUser: false, action: "Recovering: resuming from the last checkpoint once", resumeWhen: "one automatic resume from the checkpoint", maxAttempts: 1, timeoutMs: 15_000 };
    case "orphaned":
      return { recoverable: true, needsUser: false, action: "Recovering: no worker was running this build, so it resumes from its last checkpoint", resumeWhen: "a worker is dispatched and starts work (checked automatically)", maxAttempts: 2, timeoutMs: 60_000 };
    case "user_pause":
      return { recoverable: false, needsUser: true, action: "Paused by you", resumeWhen: "you press Continue", maxAttempts: 0, timeoutMs: 0 };
    case "approval":
      return { recoverable: false, needsUser: true, action: "Waiting for your approval: can't continue automatically", resumeWhen: "you approve or decline", maxAttempts: 0, timeoutMs: 0 };
    case "provider_account":
      return { recoverable: false, needsUser: true, action: "Waiting for you: the model service's account can't be used", resumeWhen: "you fix the account (credit or key) and retry", maxAttempts: 0, timeoutMs: 0 };
    case "model_missing":
      return { recoverable: false, needsUser: true, action: "Waiting for you: a model isn't installed", resumeWhen: "you install it (FlowCode doesn't download models) or pick another, then retry", maxAttempts: 0, timeoutMs: 0 };
    case "attempts_exhausted":
      return { recoverable: false, needsUser: true, action: "Blocked: the step used all its attempts", resumeWhen: "you retry the step, with guidance if you like", maxAttempts: 0, timeoutMs: 0 };
    case "task_contract":
      return { recoverable: false, needsUser: true, action: "Waiting for your choice about the step", resumeWhen: "you answer and retry the step", maxAttempts: 0, timeoutMs: 0 };
    case "deadline":
      return { recoverable: false, needsUser: true, action: "Stopped: the run's deadline passed", resumeWhen: "you extend the deadline (the extension is recorded), then continue", maxAttempts: 0, timeoutMs: 0 };
    case "cancelled":
      return { recoverable: false, needsUser: true, action: "Stopped by you", resumeWhen: "you resume it", maxAttempts: 0, timeoutMs: 0 };
  }
}

export const interruptionKey = (runId: string) => `interruption:${runId}`;

export function getInterruption(store: Store, runId: string): Interruption | undefined {
  return store.getSetting<Interruption | null>(interruptionKey(runId), null) ?? undefined;
}

/** Records a stop (replacing an earlier one) and announces it. */
export function recordInterruption(store: Store, bus: EventBus, projectId: string, x: Omit<Interruption, keyof Policy | "at" | "state" | "attempt"> & Partial<Pick<Interruption, "attempt" | "nextAttemptAt">>): Interruption {
  const p = policyFor(x.cause);
  const rec: Interruption = { ...p, attempt: 0, ...x, at: new Date().toISOString(), state: "active" };
  store.setSetting(interruptionKey(x.runId), rec);
  bus.emit({ type: "run.interrupted", projectId, runId: x.runId, taskId: x.taskId, level: rec.needsUser ? "warning" : "info", message: `${rec.action}. ${rec.detail} Resumes when ${rec.resumeWhen}.`, data: { interruption: rec } });
  return rec;
}

export function updateInterruption(store: Store, runId: string, patch: Partial<Interruption>): Interruption | undefined {
  const cur = getInterruption(store, runId);
  if (!cur) return undefined;
  const next = { ...cur, ...patch };
  store.setSetting(interruptionKey(runId), next);
  return next;
}

/** The stop is over: kept on record as resolved, announced. */
export function resolveInterruption(store: Store, bus: EventBus, projectId: string, runId: string, resolution: string): void {
  const cur = getInterruption(store, runId);
  if (!cur || cur.state === "resolved") return;
  store.setSetting(interruptionKey(runId), { ...cur, state: "resolved", resolvedAt: new Date().toISOString(), resolution });
  bus.emit({ type: "run.resumed", projectId, runId, message: resolution, data: { cause: cur.cause } });
}

/** A blocked step's cause, from its blocker. */
export function causeOfBlocker(blocker: { reason: string; category: string; failureClass?: string } | undefined): InterruptionCause {
  if (!blocker) return "attempts_exhausted";
  if (blocker.failureClass === "provider") {
    if (/credit|quota|auth_failed|sign-in|key/i.test(blocker.reason)) return "provider_account";
    if (/model_missing|isn't installed/i.test(blocker.reason)) return "model_missing";
    if (/out_of_memory|rate_limited/i.test(blocker.reason)) return "provider_busy";
    return "provider_unavailable";
  }
  if (blocker.failureClass === "task_contract") return "task_contract";
  if (blocker.category === "approval_denied") return "approval";
  return "attempts_exhausted";
}
