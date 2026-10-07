/**
 * Improvements: what FlowCode proposes to change about how it works, from the evidence in run reviews. Each proposal says
 * what will change, why it should help, how it will be tested, and whether it actually helped. FlowCode only proposes;
 * you approve, and an improvement is "confirmed" only after it was tested on later runs.
 */
import { useState } from "react";
import type { Project } from "@flowcode/contracts";
import { post, useResource } from "../api";
import { ErrorNotice } from "../components/ui";
import { navigate } from "../router";

interface Improvement {
  id: string;
  name: string;
  status: string;
  relatedRuns: string[];
  runProjects?: Record<string, string>;
  evidence: string[];
  benefit: string;
  change: string;
  target: string;
  owner: string;
  priority: string;
  scope: string;
  baseline: string;
  successMeasure: string;
  validation: string;
  approvalRequired: boolean;
  rollback: string;
  history: Array<{ at: string; status: string; note: string; actor: string }>;
}

export const IMPROVEMENT_STATUS: Record<string, string> = {
  proposed: "Suggested improvement",
  awaiting_approval: "Waiting for approval",
  approved: "Approved",
  in_progress: "In progress",
  testing: "Being tested",
  verified: "Confirmed improvement",
  rejected: "Rejected",
  rolled_back: "Did not help — reverted",
  deferred: "Deferred",
};

/** What the person can do next from each state. "Confirm" only after testing. */
const NEXT: Record<string, Array<{ to: string; label: string; primary?: boolean }>> = {
  proposed: [{ to: "approved", label: "Approve to try", primary: true }, { to: "deferred", label: "Later" }, { to: "rejected", label: "Reject" }],
  awaiting_approval: [{ to: "approved", label: "Approve to try", primary: true }, { to: "rejected", label: "Reject" }],
  approved: [{ to: "in_progress", label: "Mark in progress" }, { to: "deferred", label: "Later" }],
  in_progress: [{ to: "testing", label: "Ready to test", primary: true }],
  testing: [{ to: "verified", label: "It helped: confirm", primary: true }, { to: "rolled_back", label: "Didn't help: revert" }],
  verified: [{ to: "rolled_back", label: "Revert" }],
  deferred: [{ to: "proposed", label: "Reconsider" }],
  rejected: [],
  rolled_back: [],
};

export function ImprovementsView({ projects }: { projects: Project[] }) {
  const list = useResource<Improvement[]>("/improvements", []);
  const [error, setError] = useState<string>();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const move = async (id: string, to: string) => {
    setError(undefined);
    try {
      await post(`/improvements/${id}/status`, { status: to, ...(notes[id] ? { note: notes[id] } : {}) });
      list.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const items = [...(list.data ?? [])].sort((a, b) => order(a.status) - order(b.status));
  return (
    <div className="page page-enter improvements-page">
      <header className="page__head">
        <div>
          <span className="label">Intelligence</span>
          <h1 className="page__title">Improvements</h1>
          <p className="lib__lede">Changes FlowCode proposes to how it works, from what its run reviews found. Each one says what will change, why it should help, and how we'll know. Nothing is applied without your approval.</p>
        </div>
      </header>
      {error ? <ErrorNotice error={error} doing="update that improvement" /> : null}
      {!items.length ? <p className="apv-empty">No improvements proposed yet. When a run review finds a problem FlowCode knows how to prevent, it shows up here.</p> : null}
      <ul className="imp-list">
        {items.map((i) => (
          <li key={i.id} className="imp">
            <div className="imp__head">
              <h2 className="imp__name">{i.name}</h2>
              <span className={`chip imp__status imp__status--${i.status}`}>{IMPROVEMENT_STATUS[i.status] ?? i.status}</span>
            </div>
            <p className="imp__why">{i.benefit}</p>
            <dl className="imp__facts">
              <dt>What changes</dt>
              <dd>{i.change}</dd>
              <dt>How we'll know</dt>
              <dd>{i.successMeasure}</dd>
              <dt>How it's tested</dt>
              <dd>{i.validation}</dd>
              <dt>Seen in</dt>
              <dd>
                {i.relatedRuns.length} run{i.relatedRuns.length === 1 ? "" : "s"}
                {i.relatedRuns.slice(-3).map((r) => {
                  const pid = i.runProjects?.[r];
                  const p = projects.find((x) => x.id === pid);
                  return (
                    <button key={r} type="button" className="btn btn--sm imp__run" onClick={() => navigate(pid ? `/projects/${pid}/runs/${r}` : "/quality")}>
                      {p ? p.name.replace(/\s+/g, " ") : "Open run"}
                    </button>
                  );
                })}
              </dd>
            </dl>
            {NEXT[i.status]?.length ? (
              <div className="imp__actions">
                <input className="input imp__note" placeholder="Note (optional): why" value={notes[i.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [i.id]: e.target.value }))} aria-label={`Note for ${i.name}`} />
                {NEXT[i.status].map((n) => (
                  <button key={n.to} type="button" className={`btn btn--sm${n.primary ? " btn--primary" : ""}`} onClick={() => void move(i.id, n.to)}>
                    {n.label}
                  </button>
                ))}
              </div>
            ) : null}
            <details className="imp__more">
              <summary>Evidence, baseline and history</summary>
              <dl className="imp__facts">
                <dt>Where</dt>
                <dd className="mono">{i.target}</dd>
                <dt>Baseline</dt>
                <dd>{i.baseline}</dd>
                <dt>If it doesn't help</dt>
                <dd>{i.rollback}</dd>
                <dt>Applies to</dt>
                <dd>{i.scope === "global" ? "All projects" : "This project only"}</dd>
              </dl>
              <ul className="imp__evidence">
                {i.evidence.map((e, k) => (
                  <li key={k}>{e}</li>
                ))}
              </ul>
              <ol className="imp__history">
                {i.history.map((h, k) => (
                  <li key={k}>
                    {new Date(h.at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {IMPROVEMENT_STATUS[h.status] ?? h.status} · {h.actor === "user" ? "You" : "FlowCode"}
                    {h.note ? ` — ${h.note}` : ""}
                  </li>
                ))}
              </ol>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

const ORDER = ["testing", "in_progress", "approved", "proposed", "awaiting_approval", "verified", "deferred", "rolled_back", "rejected"];
const order = (s: string) => (ORDER.indexOf(s) + 1 || 99);
