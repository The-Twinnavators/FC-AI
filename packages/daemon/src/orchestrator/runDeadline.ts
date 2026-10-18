/**
 * A run's absolute deadline, kept in FlowCode (the settings store), so it holds through approval waits, retries,
 * recovery and daemon restarts. Every path that starts or resumes work checks it; at expiry, interruptible work is
 * aborted, work that can't be cut (a file write, a snapshot, a check record) settles, the run pauses, and the overrun
 * is recorded. Only an extension, recorded with who, when and why, lets the run go on.
 *
 * Clean Cart eval 3 (docs/reliability/DEADLINE-EVAL3.md): the two-hour limit lived only in an external watcher's
 * arguments, so Continue, Retry, restart auto-resume and approval resolution all started work after it, and about 36
 * minutes of build work ran past it.
 */
import type { Store } from "../db/store.js";

export interface DeadlineExtension {
  from: string;
  to: string;
  at: string;
  by: string;
  reason: string;
}

export interface RunDeadline {
  /** The absolute deadline (ISO). */
  at: string;
  setAt: string;
  setBy: string;
  reason: string;
  extensions: DeadlineExtension[];
  /** Filled at expiry: when it was found, where, what was running or waiting; when work actually stopped. */
  expired?: { found: string; where: string; inProgress: string[]; waiting: string[]; stoppedAt?: string; overrunMs?: number };
}

export const deadlineKey = (runId: string) => `runDeadline:${runId}`;

export function getDeadline(store: Store, runId: string): RunDeadline | undefined {
  return store.getSetting<RunDeadline | null>(deadlineKey(runId), null) ?? undefined;
}

export function deadlinePassed(d: RunDeadline | undefined, now = Date.now()): boolean {
  return !!d && Date.parse(d.at) <= now;
}

export function setDeadline(store: Store, runId: string, at: string, by: string, reason: string): RunDeadline {
  const t = Date.parse(at);
  if (!Number.isFinite(t)) throw new Error(`"${at}" isn't a date and time`);
  if (getDeadline(store, runId)) throw new Error("This run already has a deadline; extend it instead (the extension is recorded)");
  const d: RunDeadline = { at: new Date(t).toISOString(), setAt: new Date().toISOString(), setBy: by, reason, extensions: [] };
  store.setSetting(deadlineKey(runId), d);
  return d;
}

/** An explicit extension: later than the current deadline and than now, with who and why. Clears the expiry so work may resume. */
export function extendDeadline(store: Store, runId: string, until: string, by: string, reason: string): RunDeadline {
  const d = getDeadline(store, runId);
  if (!d) throw new Error("This run has no deadline to extend");
  const t = Date.parse(until);
  if (!Number.isFinite(t)) throw new Error(`"${until}" isn't a date and time`);
  if (t <= Date.parse(d.at) || t <= Date.now()) throw new Error("An extension must be later than both the current deadline and now");
  if (!reason.trim()) throw new Error("Say why the deadline is extended (it is recorded)");
  const to = new Date(t).toISOString();
  const next: RunDeadline = { ...d, at: to, extensions: [...d.extensions, { from: d.at, to, at: new Date().toISOString(), by, reason: reason.trim() }], expired: undefined };
  store.setSetting(deadlineKey(runId), next);
  return next;
}

/** Records the expiry once (later calls keep the first record). */
export function markExpired(store: Store, runId: string, where: string, inProgress: string[], waiting: string[]): RunDeadline | undefined {
  const d = getDeadline(store, runId);
  if (!d || d.expired) return d;
  const next = { ...d, expired: { found: new Date().toISOString(), where, inProgress, waiting } };
  store.setSetting(deadlineKey(runId), next);
  return next;
}

/** Work actually stopped: the overrun is from the deadline to now. */
export function markStopped(store: Store, runId: string): RunDeadline | undefined {
  const d = getDeadline(store, runId);
  if (!d?.expired || d.expired.stoppedAt) return d;
  const stoppedAt = new Date().toISOString();
  const next = { ...d, expired: { ...d.expired, stoppedAt, overrunMs: Math.max(0, Date.parse(stoppedAt) - Date.parse(d.at)) } };
  store.setSetting(deadlineKey(runId), next);
  return next;
}

/** Starting or resuming work on a run whose deadline passed (the API answers 409 with this message). */
export class DeadlinePassedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeadlinePassedError";
  }
}
