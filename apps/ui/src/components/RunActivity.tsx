/**
 * What the build is doing right now, honestly: its current state, a time range (or "not enough data yet") with what it's
 * based on, and an advisory note when it may be stuck. Nothing here acts on its own; the buttons are the person's.
 */
import { useDisplayMode } from "../displayMode";
import { useState } from "react";
import { post, useResource } from "../api";
import { RunTimeBar } from "./RunTimeBar";

interface Activity {
  firstLookAt?: string;
  state: string;
  label: string;
  since?: string;
  detail?: string;
  waitingMs: number;
  eta?: { lowMs?: number; highMs?: number; basis: string; remainingSteps: number; comparable: string };
  stall?: { signals: Array<{ signal: string; since: string }>; actions: Array<{ kind: string; label: string }>; needsYou?: { verdict: "yes" | "not_yet" | "unsure"; why: string } };
}

const DONE = ["finished", "finished_unverified", "failed", "cancelled"];
const mins = (ms: number) => {
  const m = Math.max(1, Math.round(ms / 60000));
  return m >= 90 ? `${Math.round(m / 6) / 10} h` : `${m} min`;
};
const ago = (iso?: string) => (iso ? mins(Date.now() - Date.parse(iso)) : "");

export function RunActivity({ runId, taskId, onChanged }: { runId: string; taskId?: string; onChanged?: () => void }) {
  const technical = useDisplayMode() === "technical";
  const res = useResource<Activity>(`/runs/${runId}/activity`, [runId], 15_000);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const a = res.data;
  if (!a) return null;
  if (DONE.includes(a.state)) {
    return (
      <section className="run-activity run-activity--done" aria-label="Where the build stands">
        <div className="run-activity__now">
          <strong>{a.label}</strong>
          {a.since ? <span className="muted run-activity__since">{new Date(a.since).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span> : null}
        </div>
        {a.state === "finished_unverified" ? <p className="run-activity__note">A check couldn't run, so part of the work isn't verified. See the review below.</p> : null}
      </section>
    );
  }
  const act = async (kind: string) => {
    if (kind === "cancel_run" && !confirmCancel) return setConfirmCancel(true);
    setBusy(true);
    try {
      if (kind === "pause") await post(`/runs/${runId}/pause`, {});
      if (kind === "cancel_run") await post(`/runs/${runId}/cancel`, {});
      if (kind === "retry_step" && taskId) await post(`/runs/${runId}/tasks/${taskId}/retry`, {});
      setConfirmCancel(false);
      res.reload();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };
  const eta = a.eta;
  return (
    <section className={`run-activity${a.stall ? " run-activity--stall" : ""}`} aria-label="What the build is doing" aria-live="polite">
      <div className="run-activity__now">
        <strong>{a.label}</strong>
        {a.detail ? <span className="run-activity__detail">{a.detail}</span> : null}
        {a.since ? <span className="muted run-activity__since">for {ago(a.since)}</span> : null}
        {/* Time left on the same line; its basis opens under it. */}
        {eta && a.state !== "waiting_approval" && a.state !== "needs_decision" && a.state !== "paused" ? (
          <details className="run-activity__eta" open={technical}>
            <summary>{eta.lowMs !== undefined && eta.highMs !== undefined ? (eta.remainingSteps ? `about ${mins(eta.lowMs)}–${mins(eta.highMs)} left` : "no steps left; final checks next") : "time left: not enough data yet"}</summary>
            <p>{eta.basis}</p>
            {a.waitingMs > 60_000 ? <p>Waiting for you so far: {mins(a.waitingMs)} (not part of the estimate).</p> : null}
          </details>
        ) : null}
      </div>
      {a.firstLookAt && ["planning", "generating", "running_tools", "checking", "retrying", "waiting_service", "possibly_stalled", "waiting_approval"].includes(a.state) ? (
        <div className="run-activity__firstlook" data-cp="first-look" role="status">
          <span title="Your main screens are designed, with sample data. FlowCode is now adding the features.">
            <strong>First look ready:</strong> screens designed with sample data
          </span>
          <button type="button" className="btn btn--sm btn--primary" onClick={() => window.dispatchEvent(new CustomEvent("fc:show-tab", { detail: "preview" }))}>
            Open Preview
          </button>
        </div>
      ) : null}
      <RunTimeBar runId={runId} live={["planning", "generating", "running_tools", "checking", "retrying", "waiting_service", "possibly_stalled", "waiting_approval"].includes(a.state)} />
      {a.stall ? (
        <div className="run-activity__stall" role="status">
          <p className="run-activity__stall-title">This build may be stuck. Nothing has been stopped; you decide.</p>
          {a.stall.needsYou ? (
            <p className={`run-activity__needs run-activity__needs--${a.stall.needsYou.verdict}`}>
              <strong>{a.stall.needsYou.verdict === "yes" ? "Needs you." : a.stall.needsYou.verdict === "not_yet" ? "No action needed yet." : "Not sure yet."}</strong> {a.stall.needsYou.why}
            </p>
          ) : null}
          <ul>
            {a.stall.signals.map((s, i) => (
              <li key={i}>{s.signal}</li>
            ))}
          </ul>
          <div className="run-activity__actions">
            {a.stall.actions
              .filter((x) => x.kind !== "open_details" && (x.kind !== "retry_step" || taskId))
              .map((x) => (
                <button key={x.kind} type="button" className={`btn btn--sm${x.kind === "cancel_run" && confirmCancel ? " btn--danger" : ""}`} disabled={busy} onClick={() => void act(x.kind)}>
                  {x.kind === "cancel_run" && confirmCancel ? "Confirm: cancel the build" : x.label}
                </button>
              ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
