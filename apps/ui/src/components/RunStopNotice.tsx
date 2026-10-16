/**
 * Why a build isn't working, shown where the person works, and kept until it is resolved (then it says it resumed).
 * What stopped, why, when, whether work still runs, whether they need to act, and what makes it go again, from the
 * run's stop record (daemon orchestrator/interruptions.ts) through /runs/:id/activity. Optional desktop notifications
 * for stops that need the person.
 */
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, BellOff, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { post, useResource } from "../api";

export interface StopInfo {
  interruption?: { cause: string; detail: string; at: string; action: string; attempt: number; maxAttempts: number; taskId?: string; continuation?: { authorized: boolean; by: string } };
  workerRunning: boolean;
  needsYou: boolean;
  resumeWhen: string;
  nextAttemptAt?: string;
  lastProgressAt?: string;
  actions: Array<{ kind: string; label: string }>;
}
export interface ActivityWithStop {
  state: string;
  label: string;
  since?: string;
  detail?: string;
  stop?: StopInfo;
}

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");
const inMin = (iso?: string) => {
  if (!iso) return "";
  const m = Math.round((Date.parse(iso) - Date.now()) / 60_000);
  return m <= 0 ? "in under a minute" : `in about ${m} min`;
};

const NOTIFY_KEY = "fc:notify-stops";
function notifyOn(): boolean {
  try {
    return localStorage.getItem(NOTIFY_KEY) === "1";
  } catch {
    return false;
  }
}

/** The stop's facts and its actions (also inside the run's status panel). */
export function StopDetails({ runId, a, taskId, onChanged }: { runId: string; a: ActivityWithStop; taskId?: string; onChanged?: () => void }) {
  const s = a.stop!;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const act = async (kind: string) => {
    if (kind === "cancel_run" && !confirmCancel) return setConfirmCancel(true);
    setBusy(true);
    setMsg(undefined);
    try {
      if (kind === "retry_recovery") {
        const r = await post<{ resumed: boolean; why?: string }>(`/runs/${runId}/recover`);
        setMsg(r.resumed ? "Recovered: the build is running again." : `Not yet: ${r.why ?? "it couldn't resume"}. FlowCode keeps the stop on record.`);
      }
      if (kind === "continue") await post(`/runs/${runId}/unpause`);
      if (kind === "retry_step" && (s.interruption?.taskId ?? taskId)) await post(`/runs/${runId}/tasks/${s.interruption?.taskId ?? taskId}/retry`, {});
      if (kind === "cancel_run") await post(`/runs/${runId}/cancel`, {});
      setConfirmCancel(false);
      onChanged?.();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const it = s.interruption;
  const stepId = it?.taskId ?? taskId;
  return (
    <div className="stop-details">
      <dl className="stop-details__facts">
        <div>
          <dt>What happened</dt>
          <dd>{a.detail ?? it?.detail}</dd>
        </div>
        <div>
          <dt>Since</dt>
          <dd>{when(it?.at ?? a.since)}</dd>
        </div>
        <div>
          <dt>Work running now</dt>
          <dd>{s.workerRunning ? "Yes: the step in progress is finishing" : "No"}</dd>
        </div>
        <div>
          <dt>Needs you</dt>
          <dd>{s.needsYou ? "Yes" : "No: FlowCode handles it"}</dd>
        </div>
        <div>
          <dt>Resumes when</dt>
          <dd>
            {s.resumeWhen}
            {s.nextAttemptAt ? ` · next automatic try ${inMin(s.nextAttemptAt)}${it && it.maxAttempts ? ` (try ${Math.min(it.attempt + 1, it.maxAttempts)} of ${it.maxAttempts})` : ""}` : ""}
          </dd>
        </div>
        {s.lastProgressAt ? (
          <div>
            <dt>Last confirmed progress</dt>
            <dd>{when(s.lastProgressAt)}</dd>
          </div>
        ) : null}
      </dl>
      {s.actions.length ? (
        <div className="stop-details__actions">
          {s.actions
            .filter((x) => x.kind !== "retry_step" || stepId)
            .map((x) => (
              <button key={x.kind} type="button" className={`btn btn--sm${x.kind === "retry_recovery" || x.kind === "continue" ? " btn--primary" : ""}${x.kind === "cancel_run" && confirmCancel ? " btn--danger" : ""}`} disabled={busy} onClick={() => void act(x.kind)}>
                {x.kind === "retry_recovery" ? <RefreshCw size={13} aria-hidden="true" /> : null}
                {x.kind === "cancel_run" && confirmCancel ? "Confirm: cancel the build" : x.label}
              </button>
            ))}
        </div>
      ) : null}
      {msg ? (
        <p className="muted stop-details__msg" role="status">
          {msg}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The notice: shown while a stop is on record (or the build is marked working with no worker), kept until it is
 * resolved, then a short "running again" confirmation.
 */
export function RunStopNotice({ runId, taskId, refreshKey, onChanged }: { runId: string; taskId?: string; refreshKey?: unknown; onChanged?: () => void }) {
  const res = useResource<ActivityWithStop>(`/runs/${runId}/activity`, [runId, refreshKey], 15_000);
  const a = res.data;
  const [resumedAt, setResumedAt] = useState<string>();
  const [notify, setNotify] = useState(notifyOn);
  const wasStopped = useRef(false);
  const lastNotified = useRef<string | undefined>(undefined);
  const stopped = !!a?.stop;
  useEffect(() => {
    if (wasStopped.current && !stopped && a) setResumedAt(new Date().toISOString());
    if (stopped) setResumedAt(undefined);
    wasStopped.current = stopped;
  }, [stopped, a]);
  // A desktop notification when a stop needs the person (once per stop), if they turned it on.
  useEffect(() => {
    const it = a?.stop?.interruption;
    if (!notify || !a?.stop?.needsYou || !it || lastNotified.current === it.at) return;
    lastNotified.current = it.at;
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(`FlowCode: ${a.label}`, { body: `${it.detail}\nResumes when ${a.stop.resumeWhen}.`, tag: `fc-stop-${runId}` });
    } catch {
      /* notifications are optional */
    }
  }, [a, notify, runId]);
  const toggleNotify = async () => {
    const next = !notify;
    if (next && typeof Notification !== "undefined" && Notification.permission !== "granted") {
      const p = await Notification.requestPermission().catch(() => "denied" as NotificationPermission);
      if (p !== "granted") return;
    }
    try {
      localStorage.setItem(NOTIFY_KEY, next ? "1" : "0");
    } catch {
      /* per-browser preference only */
    }
    setNotify(next);
  };
  if (!a) return null;
  if (!a.stop) {
    if (!resumedAt || Date.now() - Date.parse(resumedAt) > 60_000) return null;
    return (
      <div className="stop-notice stop-notice--resumed" role="status">
        <CheckCircle2 size={16} aria-hidden="true" />
        <strong>Running again.</strong> <span className="muted">The build resumed {when(resumedAt)}.</span>
      </div>
    );
  }
  const needs = a.stop.needsYou;
  const tone = needs ? "needs" : a.state === "recovering" || a.state === "orphaned" ? "recovering" : "waiting";
  return (
    <section className={`stop-notice stop-notice--${tone}`} role={needs ? "alert" : "status"} aria-label="Why the build isn't working">
      <div className="stop-notice__head">
        {needs ? <AlertTriangle size={16} aria-hidden="true" /> : <Clock size={16} aria-hidden="true" />}
        <strong>{a.label}</strong>
        <button type="button" className="btn btn--ghost btn--sm stop-notice__bell" aria-pressed={notify} title={notify ? "Desktop notifications are on for stops that need you" : "Notify me on this computer when a build needs me"} onClick={() => void toggleNotify()}>
          {notify ? <Bell size={14} aria-hidden="true" /> : <BellOff size={14} aria-hidden="true" />}
          <span className="sr-only">Desktop notifications</span>
        </button>
      </div>
      <StopDetails runId={runId} a={a} taskId={taskId} onChanged={() => (res.reload(), onChanged?.())} />
    </section>
  );
}
