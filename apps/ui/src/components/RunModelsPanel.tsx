/** Models and data for a build: which model did each job and what, if anything, left this computer (B1). */
import { useResource } from "../api";
import { Icon } from "./ui";

type Use = { role: string; model: string; providerId: string; hosted: boolean; calls: number; imageCalls: number; unknownCalls?: number; steps: string[] };
type Data = { assigned: Array<{ role: string; model: string; hosted: boolean }>; used: Use[]; summary: string; leftThisComputer: boolean };

const ROLE: Record<string, string> = { planner: "Planner", coder: "Coder", debugger: "Debugger", critic: "Visual critic", reviewer: "Reviewer", researcher: "Researcher", repository_analyst: "Repository analyst", documenter: "Documenter" };
const roleName = (r: string) => ROLE[r] ?? r.replace(/_/g, " ");

export function RunModelsPanel({ runId }: { runId: string }) {
  const res = useResource<Data>(`/runs/${runId}/models`, [runId], 15_000);
  const d = res.data;
  if (!d) return null;
  return (
    <details className="run-models" data-cp="models-data" open={d.leftThisComputer}>
      <summary>
        <span className={`run-models__dot${d.leftThisComputer ? " run-models__dot--cloud" : ""}`} aria-hidden="true" />
        <span className="run-models__title">Models and data</span>
        <span className="run-models__sum">{d.summary}</span>
      </summary>
      {d.used.length ? (
        <table className="run-models__table">
          <thead>
            <tr>
              <th scope="col">Job</th>
              <th scope="col">Model</th>
              <th scope="col">Where</th>
              <th scope="col">Calls</th>
              <th scope="col">Steps</th>
            </tr>
          </thead>
          <tbody>
            {d.used.map((u) => (
              <tr key={`${u.role}-${u.providerId}-${u.model}`}>
                <td>{roleName(u.role)}</td>
                <td className="mono">{u.model}</td>
                <td>{u.hosted ? <span className="run-models__cloud"><Icon name="external" size={12} /> Cloud{u.imageCalls ? ", with screenshots" : u.unknownCalls ? ", screenshots not recorded" : ""}</span> : "This computer"}</td>
                <td>{u.calls}</td>
                <td className="run-models__steps">{u.steps.length ? null : "Whole build"}{u.steps.slice(0, 4).join(" · ")}{u.steps.length > 4 ? ` +${u.steps.length - 4} more` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted" style={{ margin: "6px 0 0" }}>
          Set up with: {d.assigned.map((a) => `${roleName(a.role)} ${a.model}${a.hosted ? " (cloud)" : ""}`).join(", ")}.
        </p>
      )}
    </details>
  );
}
