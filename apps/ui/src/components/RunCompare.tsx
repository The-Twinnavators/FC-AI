/**
 * Two builds side by side (D2): outcome, models and where they ran, time, tries, checks and changes. From each run's
 * records; FlowCode doesn't declare a winner. Rows where the two differ are marked so they're easy to spot.
 */
import { useResource } from "../api";
import { StatusChip } from "./ui";

type Side = {
  runId: string;
  objective: string;
  status: string;
  createdAt: string;
  models: { summary: string; leftThisComputer: boolean; coder?: string };
  time: { elapsedMs: number; modelMs: number; commandMs: number; checkMs: number; waitingMs: number };
  tries: { steps: number; retried: number; extraTries: number; commandsFailed: number; modelCallsFailed: number };
  checks: Array<{ kind: string; status: string }>;
  changes: { files: number; added: number; removed: number; paths: string[] };
};
type Compare = { a: Side; b: Side; filesInBoth: string[] };

const mins = (ms: number) => (ms < 60_000 ? `${Math.round(ms / 1000)} s` : ms < 3_600_000 ? `${Math.round(ms / 60_000)} min` : `${(ms / 3_600_000).toFixed(1)} h`);
const CHECK: Record<string, string> = { typecheck: "Type check", lint: "Code style", tests: "Tests", build: "Package", preview_health: "Preview", screenshots: "Screenshots", design_qa: "Design check", visual_critique: "Visual review", final_report: "Report" };

export function RunCompare({ a, b, onClose }: { a: string; b: string; onClose: () => void }) {
  const res = useResource<Compare>(`/runs/compare?a=${a}&b=${b}`, [a, b]);
  const d = res.data;
  if (res.error) return <p className="notice notice--bad" role="alert">{res.error}</p>;
  if (!d) return <p className="muted">Comparing the two builds…</p>;
  const kinds = [...new Set([...d.a.checks, ...d.b.checks].map((c) => c.kind))].filter((k) => CHECK[k]);
  const status = (s: Side, k: string) => s.checks.find((c) => c.kind === k)?.status ?? "not run";
  const rows: Array<{ label: string; a: React.ReactNode; b: React.ReactNode; same: boolean }> = [
    { label: "Asked", a: d.a.objective, b: d.b.objective, same: d.a.objective === d.b.objective },
    { label: "Ended", a: <StatusChip status={d.a.status} dot />, b: <StatusChip status={d.b.status} dot />, same: d.a.status === d.b.status },
    { label: "Coder", a: d.a.models.coder ?? "—", b: d.b.models.coder ?? "—", same: d.a.models.coder === d.b.models.coder },
    { label: "Where it ran", a: d.a.models.summary, b: d.b.models.summary, same: d.a.models.leftThisComputer === d.b.models.leftThisComputer },
    { label: "Model thinking", a: mins(d.a.time.modelMs), b: mins(d.b.time.modelMs), same: false },
    { label: "Commands and tools", a: mins(d.a.time.commandMs), b: mins(d.b.time.commandMs), same: false },
    { label: "Steps", a: `${d.a.tries.steps}, ${d.a.tries.retried} needed another try`, b: `${d.b.tries.steps}, ${d.b.tries.retried} needed another try`, same: d.a.tries.retried === d.b.tries.retried },
    { label: "Failed commands", a: d.a.tries.commandsFailed, b: d.b.tries.commandsFailed, same: d.a.tries.commandsFailed === d.b.tries.commandsFailed },
    { label: "Failed model calls", a: d.a.tries.modelCallsFailed, b: d.b.tries.modelCallsFailed, same: d.a.tries.modelCallsFailed === d.b.tries.modelCallsFailed },
    ...kinds.map((k) => ({ label: CHECK[k]!, a: status(d.a, k), b: status(d.b, k), same: status(d.a, k) === status(d.b, k) })),
    { label: "Changed", a: `${d.a.changes.files} files, +${d.a.changes.added} −${d.a.changes.removed} lines`, b: `${d.b.changes.files} files, +${d.b.changes.added} −${d.b.changes.removed} lines`, same: false },
  ];
  return (
    <section className="rcmp" data-cp="run-compare" aria-label="Two builds compared">
      <div className="rcmp__head">
        <h3>Two builds compared</h3>
        <span className="muted">From each build&apos;s records. Rows that differ are marked.</span>
        <button type="button" className="btn btn--sm btn--ghost" onClick={onClose}>Close</button>
      </div>
      <div className="rcmp__scroll">
        <table className="rcmp__table">
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">What</span></th>
              <th scope="col">This build · {new Date(d.a.createdAt).toLocaleDateString()}</th>
              <th scope="col">Compared with · {new Date(d.b.createdAt).toLocaleDateString()}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className={r.same ? "" : "is-diff"}>
                <th scope="row">{r.label}</th>
                <td>{r.a}</td>
                <td>{r.b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {d.filesInBoth.length ? <p className="rcmp__both">Both changed: <span className="mono">{d.filesInBoth.join(", ")}</span></p> : null}
    </section>
  );
}
