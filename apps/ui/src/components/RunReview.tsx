/**
 * Run review: what was asked, what happened, what was verified (and what couldn't be), and any improvement FlowCode
 * proposes. Short by default; the measurements and evidence are behind "Details". Opens by itself only when something
 * needs attention (a stop, a check that couldn't run, a recurring problem).
 */
import { useDisplayMode } from "../displayMode";
import { useResource } from "../api";

interface Review {
  level: "light" | "detailed";
  requested: string;
  outcome: { status: string; finished: boolean; verifiedSteps: number; totalSteps: number; verification: "complete" | "incomplete" | "not_run" };
  checks: Array<{ kind: string; name: string; state: string; note: string }>;
  worked: string[];
  limitations: string[];
  issues: Array<{ key: string; category: string; what: string; cause: { text: string; status: string }; recurrence: number }>;
  measurements: { wallMs?: number; waitingMs?: number; modelMs?: number; modelCalls?: number; attempts?: number; restores?: number; failedCommandMs?: number; succeededCommandMs?: number };
  proposals: string[];
}
interface Improvement {
  id: string;
  name: string;
  status: string;
  change: string;
  successMeasure: string;
}

const STATE: Record<string, string> = { passed: "Passed", passed_with_warnings: "Passed with warnings", failed: "Failed", skipped: "Skipped (not needed)", unavailable: "Couldn't run", not_run: "Not run" };
const STATUS: Record<string, string> = { proposed: "Suggested improvement", awaiting_approval: "Waiting for approval", approved: "Approved", in_progress: "In progress", testing: "Being tested", verified: "Confirmed improvement", rejected: "Rejected", rolled_back: "Reverted", deferred: "Deferred" };

const dur = (ms?: number) => {
  if (ms === undefined) return "Not measured";
  const m = Math.round(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
};

export function RunReview({ runId }: { runId: string }) {
  const technical = useDisplayMode() === "technical";
  const review = useResource<Review | null>(`/runs/${runId}/review`, [runId]);
  const backlog = useResource<Improvement[]>("/improvements", [runId]);
  const r = review.data;
  if (!r || !r.outcome) return null;
  const proposals = (backlog.data ?? []).filter((p) => r.proposals.includes(p.id));
  const verifiedLabel = r.outcome.verification === "complete" ? "All final checks ran" : r.outcome.verification === "incomplete" ? "Verification incomplete" : "Final checks not run";
  const attention = r.level === "detailed" || r.outcome.verification !== "complete";
  const m = r.measurements;
  return (
    <details className="run-review" open={attention}>
      <summary className="run-review__head">
        <span className="run-review__title">Run review</span>
        <span className={`run-review__verify run-review__verify--${r.outcome.verification}`}>{verifiedLabel}</span>
        <span className="muted run-review__steps">
          {r.outcome.verifiedSteps} of {r.outcome.totalSteps} steps passed
        </span>
      </summary>
      <div className="run-review__body">
        <p className="run-review__asked">
          <span className="label">Asked for</span> {r.requested || "—"}
        </p>
        {r.limitations.length ? (
          <div>
            <h4 className="run-review__h">Needs attention</h4>
            <ul className="run-review__list">
              {r.limitations.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {r.worked.length ? (
          <div>
            <h4 className="run-review__h">What worked</h4>
            <ul className="run-review__list">
              {r.worked.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div>
          <h4 className="run-review__h">Fixes to FlowCode <a href="#/system/problems" className="run-review__more-link">see all in System Health</a></h4>
          {proposals.length ? (
            <ul className="run-review__list">
              {proposals.map((p) => (
                <li key={p.id}>
                  <strong>{p.name}</strong> <span className="chip">{STATUS[p.status] ?? p.status}</span>
                  <div className="muted">{p.change}</div>
                  <div className="muted">How we'll know: {p.successMeasure}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted" style={{ margin: 0 }}>No new improvement identified.</p>
          )}
        </div>
        <details className="run-review__more" open={technical}>
          <summary>Details: checks, issues and measurements</summary>
          <table className="run-review__table">
            <tbody>
              {r.checks.map((c) => (
                <tr key={c.kind}>
                  <td>{c.name}</td>
                  <td className={`run-review__state run-review__state--${c.state}`}>{STATE[c.state] ?? c.state}</td>
                  <td className="muted">{c.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {r.issues.length ? (
            <ul className="run-review__list">
              {r.issues.map((i) => (
                <li key={i.key}>
                  {i.what} <span className="muted">({i.category.replace(/_/g, " ")}; cause {i.cause.status}{i.recurrence ? `; also in ${i.recurrence} earlier run${i.recurrence === 1 ? "" : "s"}` : ""})</span>
                </li>
              ))}
            </ul>
          ) : null}
          <dl className="run-review__measures">
            <dt>Elapsed</dt>
            <dd>{dur(m.wallMs)}</dd>
            <dt>Waiting for you</dt>
            <dd>{dur(m.waitingMs)}</dd>
            <dt>Model time</dt>
            <dd>
              {dur(m.modelMs)}
              {m.modelCalls ? ` · ${m.modelCalls} calls` : ""}
            </dd>
            <dt>Tries</dt>
            <dd>{m.attempts ?? "Not measured"}</dd>
            <dt>Work undone</dt>
            <dd>{m.restores ?? "Not measured"}</dd>
            <dt>Commands that failed / passed</dt>
            <dd>
              {dur(m.failedCommandMs)} / {dur(m.succeededCommandMs)}
            </dd>
          </dl>
        </details>
      </div>
    </details>
  );
}
