/**
 * Where a build's time is going, while it runs (C3 / VUS-10): one bar split into model thinking, commands, checks,
 * waiting for you and the rest, plus the plain facts that usually explain a long build (failed commands, steps that
 * needed another try). From /runs/:id/performance, which is built from recorded events.
 */
import { useResource } from "../api";

type Perf = {
  elapsedMs: number;
  waitingMs: number;
  busy: { modelMs: number; commandMs: number; toolMs: number; checkMs: number };
  model: { calls: number; failed: number };
  commands: { count: number; failed: number };
  tasks: Array<{ title: string; attempts: number }>;
};

const mins = (ms: number) => (ms < 60_000 ? `${Math.max(1, Math.round(ms / 1000))} s` : ms < 3_600_000 ? `${Math.round(ms / 60_000)} min` : `${(ms / 3_600_000).toFixed(1)} h`);

export function RunTimeBar({ runId, live }: { runId: string; live: boolean }) {
  const res = useResource<Perf>(`/runs/${runId}/performance`, [runId], live ? 20_000 : 0);
  const p = res.data;
  if (!p || p.elapsedMs < 60_000) return null;
  const parts = [
    { id: "model", label: "Model thinking", ms: p.busy.modelMs },
    { id: "cmd", label: "Commands", ms: p.busy.commandMs + p.busy.toolMs },
    { id: "check", label: "Checks", ms: p.busy.checkMs },
    { id: "wait", label: "Waiting for you", ms: p.waitingMs },
  ];
  const known = parts.reduce((n, x) => n + x.ms, 0);
  // Time with no recorded work: while running, starting up or waiting on the model service; once stopped, mostly the
  // time it sat stopped or paused.
  const rest = Math.max(0, p.elapsedMs - known);
  const all = [...parts, { id: "rest", label: live ? "Idle between steps" : "Idle, paused or stopped", ms: rest }].filter((x) => x.ms >= 1000);
  const retried = p.tasks.filter((t) => t.attempts > 1);
  const facts = [
    p.commands.failed ? `${p.commands.failed} of ${p.commands.count} commands failed` : "",
    retried.length ? `${retried.length} step${retried.length === 1 ? "" : "s"} needed another try` : "",
    p.model.failed ? `${p.model.failed} model call${p.model.failed === 1 ? "" : "s"} failed` : "",
  ].filter(Boolean);
  return (
    <div className="rtime" data-cp="time-bar" aria-label="Where the time went">
      <div className="rtime__head">
        <span className="label">{live ? "Where the time is going" : "Where the time went"}</span>
        <span className="muted">{mins(p.elapsedMs)}{live ? " so far" : " since it started"}</span>
      </div>
      <div className="rtime__bar" role="img" aria-label={all.map((x) => `${x.label} ${mins(x.ms)}`).join(", ")}>
        {all.map((x) => (
          <span key={x.id} className={`rtime__seg rtime__seg--${x.id}`} style={{ flexGrow: x.ms }} title={`${x.label}: ${mins(x.ms)}`} />
        ))}
      </div>
      <ul className="rtime__legend">
        {all.map((x) => (
          <li key={x.id}>
            <span className={`rtime__key rtime__seg--${x.id}`} aria-hidden="true" />
            {x.label} <b>{mins(x.ms)}</b>
          </li>
        ))}
      </ul>
      {facts.length ? <p className="rtime__facts">{facts.join(" · ")}</p> : null}
    </div>
  );
}
