/**
 * Measured on this computer: how each coder model's steps actually ended, how long they took, how fast it writes, and
 * how much of a loaded model sits in GPU memory. A recommendation only; changing the coder stays your choice below.
 */
import { useResource } from "../api";

interface Stats {
  model: string;
  steps: number;
  firstTry: number;
  afterRetries: number;
  stopped: number;
  firstTryRate?: number;
  medianStepMin?: number;
  genTokPerSec?: number;
  hosted: boolean;
  probes?: { passed: number; total: number; seconds: number; at: string };
}
interface Perf {
  models: Stats[];
  loaded: Array<{ name: string; sizeGb: number; gpuShare: number; contextLength?: number }>;
  recommendation: { text: string; model?: string; basis: string };
  slowRoles?: Array<{ role: string; model: string; tokPerSec: number; faster: string; fasterTokPerSec: number }>;
  caveats: string[];
}

const roleName = (r: string) => r.replace(/_/g, " ").replace(/\bqa\b/, "QA").replace(/^\w/, (c) => c.toUpperCase());

type Slow = NonNullable<Perf["slowRoles"]>[number];
/** One note per slow model, naming every role that uses it. */
const slowByModel = (rows: Slow[]) => [...new Map(rows.map((r) => [r.model, { ...r, roles: rows.filter((x) => x.model === r.model).map((x) => x.role) }])).values()];
const list = (a: string[]) => (a.length < 2 ? (a[0] ?? "") : `${a.slice(0, -1).join(", ")} and ${a.at(-1)}`);

const pct = (n?: number) => (n === undefined ? "—" : `${Math.round(n * 100)}%`);

export function ModelPerformance() {
  const res = useResource<Perf>("/models/performance", []);
  const p = res.data;
  if (!p) return null;
  return (
    <section className="section model-perf" data-guide="models.performance" aria-labelledby="model-perf-title">
      <div className="section__head">
        <h2 className="section__title" id="model-perf-title">
          Measured on this computer
        </h2>
      </div>
      <div className="model-perf__body">
        <p className="model-perf__rec">
          <strong>{p.recommendation.text}</strong>
        </p>
        {slowByModel(p.slowRoles ?? []).map((g) => (
          <p key={g.model} className="model-perf__slow" role="note">
            <strong className="status-text--warn">Slow on this computer.</strong> {list(g.roles.map(roleName))} use{g.roles.length === 1 ? "s" : ""} <span className="mono">{g.model}</span>, which writes {g.tokPerSec} tokens/s here (it likely doesn't fit in GPU memory). <span className="mono">{g.faster}</span> writes {g.fasterTokPerSec}. Consider it for {g.roles.length === 1 ? "that role" : "those roles"} below.
          </p>
        ))}
        <div className="model-perf__table-wrap">
          <table className="model-perf__table">
            <thead>
              <tr>
                <th scope="col">Coder model</th>
                <th scope="col">Steps</th>
                <th scope="col">Passed first try</th>
                <th scope="col">Passed after retries</th>
                <th scope="col">Stopped</th>
                <th scope="col">Typical step</th>
                <th scope="col">Writing speed</th>
                <th scope="col">Lab probes</th>
              </tr>
            </thead>
            <tbody>
              {p.models.map((m) => (
                <tr key={m.model}>
                  <th scope="row">
                    <span className="mono">{m.model}</span> <span className="muted">{m.hosted ? "cloud" : "local"}</span>
                  </th>
                  <td>{m.steps}</td>
                  <td>{pct(m.firstTryRate)}</td>
                  <td>{m.afterRetries}</td>
                  <td>{m.stopped}</td>
                  <td>{m.medianStepMin !== undefined ? `${m.medianStepMin} min` : "—"}</td>
                  <td>{m.genTokPerSec !== undefined ? `${m.genTokPerSec} tokens/s` : "Not measured"}</td>
                  <td>{m.probes ? `${m.probes.passed}/${m.probes.total}` : "Not run"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {p.loaded.length ? (
          <p className="muted model-perf__loaded">
            In memory now:{" "}
            {p.loaded.map((l) => `${l.name} (${l.sizeGb} GB, ${Math.round(l.gpuShare * 100)}% on the GPU${l.contextLength ? `, ${Math.round(l.contextLength / 1024)}k context` : ""})`).join("; ")}
          </p>
        ) : (
          <p className="muted model-perf__loaded">No model is in memory right now, so GPU fit isn't measured. It shows here while a model is loaded.</p>
        )}
        <details className="model-perf__more">
          <summary>What this is based on</summary>
          <p>{p.recommendation.basis}</p>
          <ul>
            {p.caveats.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p>Lab probes are the same small tasks for every model (the capability lab below), so they compare like with like; build results show how each model did on real projects.</p>
        </details>
      </div>
    </section>
  );
}
