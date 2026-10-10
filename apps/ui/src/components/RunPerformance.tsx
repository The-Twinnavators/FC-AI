/**
 * Workspace → Performance: where the selected run's time went. Leads with what took longest, then the split of the
 * AI model's time (loading, reading the prompt, writing the reply), each step, and the slowest single operations.
 */
import { RefreshCw } from "lucide-react";
import type { Run } from "@flowcode/contracts";
import { useResource } from "../api";
import { RobotHead, ROLE_COLOR, ROLE_LABEL } from "./RobotHead";
import { navigate } from "../router";
import { Empty } from "./ui";
import { SkeletonBlock } from "./motion";

interface Perf {
  status: string;
  finished: boolean;
  elapsedMs: number;
  waitingMs: number;
  phases: Array<{ phase: string; ms: number }>;
  busy: { modelMs: number; commandMs: number; toolMs: number; checkMs: number };
  model: {
    calls: number;
    failed: number;
    retries: number;
    totalMs: number;
    hasTiming: boolean;
    loadMs: number;
    promptMs: number;
    generateMs: number;
    promptTokens: number;
    outputTokens: number;
    tokensPerSec?: number;
    coldLoads: number;
    switches: number;
    avgPromptChars: number;
    maxPromptChars: number;
    byModel: Array<{ model: string; roles: string[]; calls: number; totalMs: number; loadMs: number; promptMs: number; generateMs: number; outputTokens: number; coldLoads: number }>;
  };
  commands: { count: number; failed: number; totalMs: number };
  tools: { count: number; totalMs: number; byName: Array<{ name: string; count: number; totalMs: number }> };
  tasks: Array<{ id: string; title: string; status: string; attempts: number; elapsedMs: number; modelMs: number; modelCalls: number; commandMs: number; toolCalls: number; avgPromptChars: number }>;
  checks: Array<{ kind: string; status: string; approxMs: number }>;
  slowest: Array<{ kind: string; label: string; ms: number; task?: string }>;
  notes: string[];
}

/** 950 → "0.9s", 74_000 → "1 min 14s". */
export function dur(ms: number): string {
  if (ms < 1000) return `${(ms / 1000).toFixed(1)}s`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} min ${s % 60}s` : `${Math.floor(m / 60)} h ${m % 60} min`;
}
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
const KIND: Record<string, string> = { model: "AI model", command: "Command", tool: "File tool", check: "Check" };

/** One horizontal bar split into labelled segments, with a legend that carries the numbers (not color alone). */
function SplitBar({ parts, label }: { parts: Array<{ name: string; ms: number; tone: string }>; label: string }) {
  const total = parts.reduce((n, p) => n + p.ms, 0);
  if (!total) return null;
  return (
    <div className="perf-split">
      <div className="perf-split__bar" role="img" aria-label={`${label}: ${parts.map((p) => `${p.name} ${pct(p.ms, total)}%`).join(", ")}`}>
        {parts.filter((p) => p.ms > 0).map((p) => (
          <span key={p.name} className={`perf-split__seg perf-tone-${p.tone}`} style={{ flexGrow: p.ms }} />
        ))}
      </div>
      <ul className="perf-split__legend">
        {parts.map((p) => (
          <li key={p.name}>
            <i className={`perf-dot perf-tone-${p.tone}`} aria-hidden="true" />
            <span>{p.name}</span>
            <b>{dur(p.ms)}</b>
            <span className="muted">{pct(p.ms, total)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RunPerformance({ runId }: { runId?: string }) {
  const { data, error, reload, loading } = useResource<Perf>(runId ? `/runs/${runId}/performance` : null, [runId], 10_000);
  if (!runId) return <div style={{ padding: 16 }}><Empty title="No run selected">Start or pick a run to see where its time went.</Empty></div>;
  if (!data) return <div style={{ padding: 16 }}>{error ? <p className="notice notice--bad" role="alert">{error}</p> : <SkeletonBlock rows={5} label="Measuring the run" />}</div>;
  const busyTotal = data.busy.modelMs + data.busy.commandMs + data.busy.toolMs + data.busy.checkMs;
  return (
    <div className="perf">
      <div className="perf__head">
        <div className="perf__stats">
          <div>
            <span className="perf__k">Elapsed</span>
            <b className="perf__v">{dur(data.elapsedMs)}</b>
            <span className="muted">{data.finished ? data.status.replace(/_/g, " ") : "still running"}</span>
          </div>
          <div>
            <span className="perf__k">Working</span>
            <b className="perf__v">{dur(busyTotal)}</b>
            <span className="muted">model, commands, tools, checks</span>
          </div>
          <div>
            <span className="perf__k">Waiting for you</span>
            <b className="perf__v">{dur(data.waitingMs)}</b>
            <span className="muted">approvals</span>
          </div>
          <div>
            <span className="perf__k">Model calls</span>
            <b className="perf__v">{data.model.calls}</b>
            <span className="muted">{data.model.failed ? `${data.model.failed} failed` : "none failed"}</span>
          </div>
        </div>
        <button className="btn btn--sm" onClick={reload} disabled={loading} aria-label="Refresh performance">
          <RefreshCw size={14} aria-hidden="true" />
        </button>
      </div>

      {data.notes.length ? (
        <section className="perf-sec" aria-labelledby="perf-notes">
          <h3 id="perf-notes" className="perf-sec__title">What took the time</h3>
          <ul className="perf-notes">
            {data.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="perf-sec" aria-labelledby="perf-busy">
        <h3 id="perf-busy" className="perf-sec__title">Working time by kind</h3>
        <SplitBar
          label="Working time"
          parts={[
            { name: "AI model", ms: data.busy.modelMs, tone: "a" },
            { name: "Commands", ms: data.busy.commandMs, tone: "b" },
            { name: "Checks", ms: data.busy.checkMs, tone: "c" },
            { name: "File tools", ms: data.busy.toolMs, tone: "d" },
          ]}
        />
      </section>

      <section className="perf-sec" aria-labelledby="perf-model">
        <h3 id="perf-model" className="perf-sec__title">AI model time</h3>
        {data.model.hasTiming ? (
          <SplitBar
            label="Model time"
            parts={[
              { name: "Loading the model", ms: data.model.loadMs, tone: "c" },
              { name: "Reading the prompt", ms: data.model.promptMs, tone: "b" },
              { name: "Writing the reply", ms: data.model.generateMs, tone: "a" },
            ]}
          />
        ) : (
          <p className="muted perf-sec__note">No loading, reading and writing split for this run. FlowCode records it from now on; start a new run to see it.</p>
        )}
        <dl className="perf-facts">
          <div>
            <dt>Prompt size</dt>
            <dd>{data.model.maxPromptChars ? `${data.model.avgPromptChars.toLocaleString()} characters on average, ${data.model.maxPromptChars.toLocaleString()} at most` : "not recorded for this run"}</dd>
          </div>
          <div>
            <dt>Tokens</dt>
            <dd>
              {data.model.promptTokens.toLocaleString()} read, {data.model.outputTokens.toLocaleString()} written{data.model.tokensPerSec ? ` · ${data.model.tokensPerSec} per second while writing` : ""}
            </dd>
          </div>
          <div>
            <dt>Model loads</dt>
            <dd>
              {data.model.hasTiming ? `${data.model.coldLoads} load${data.model.coldLoads === 1 ? "" : "s"} into memory` : "not recorded"} · {data.model.switches} switch{data.model.switches === 1 ? "" : "es"} between models
            </dd>
          </div>
        </dl>
        {data.model.byModel.length ? (
          <table className="table perf-table">
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">Used for</th>
                <th scope="col" className="num">Calls</th>
                <th scope="col" className="num">Total</th>
                <th scope="col" className="num">Loading</th>
                <th scope="col" className="num">Reading</th>
                <th scope="col" className="num">Writing</th>
              </tr>
            </thead>
            <tbody>
              {data.model.byModel.map((m) => (
                <tr key={m.model}>
                  <td className="mono">{m.model}</td>
                  <td>{m.roles.join(", ")}</td>
                  <td className="num">{m.calls}</td>
                  <td className="num">{dur(m.totalMs)}</td>
                  <td className="num">{data.model.hasTiming ? dur(m.loadMs) : "–"}</td>
                  <td className="num">{data.model.hasTiming ? dur(m.promptMs) : "–"}</td>
                  <td className="num">{data.model.hasTiming ? dur(m.generateMs) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      {data.tasks.length ? (
        <section className="perf-sec" aria-labelledby="perf-steps">
          <h3 id="perf-steps" className="perf-sec__title">Steps</h3>
          <table className="table perf-table">
            <thead>
              <tr>
                <th scope="col">Step</th>
                <th scope="col">Result</th>
                <th scope="col" className="num">Tries</th>
                <th scope="col" className="num">Elapsed</th>
                <th scope="col" className="num">Model</th>
                <th scope="col" className="num">Commands</th>
                <th scope="col" className="num">Tool calls</th>
                <th scope="col" className="num">Avg prompt</th>
              </tr>
            </thead>
            <tbody>
              {data.tasks.map((t) => (
                <tr key={t.id}>
                  <td>{t.title}</td>
                  <td>{t.status.replace(/_/g, " ")}</td>
                  <td className="num">{t.attempts}</td>
                  <td className="num">{dur(t.elapsedMs)}</td>
                  <td className="num">
                    {dur(t.modelMs)} <span className="muted">({t.modelCalls})</span>
                  </td>
                  <td className="num">{dur(t.commandMs)}</td>
                  <td className="num">{t.toolCalls}</td>
                  <td className="num">{t.avgPromptChars ? `${Math.round(t.avgPromptChars / 100) / 10}k chars` : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <LibraryUsed runId={runId} />

      {data.slowest.length ? (
        <section className="perf-sec" aria-labelledby="perf-slow">
          <h3 id="perf-slow" className="perf-sec__title">Slowest operations</h3>
          <ol className="perf-slow">
            {data.slowest.map((s, i) => (
              <li key={i}>
                <b className="num">{dur(s.ms)}</b>
                <span className="perf-slow__kind">{KIND[s.kind] ?? s.kind}</span>
                <span className="perf-slow__label mono">{s.label}</span>
                {s.task ? <span className="muted perf-slow__task">{s.task}</span> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {data.phases.length || data.checks.length || data.commands.count || data.tools.count ? (
        <section className="perf-sec" aria-labelledby="perf-more">
          <h3 id="perf-more" className="perf-sec__title">Phases, checks and tools</h3>
          <dl className="perf-facts">
            {data.phases.map((p) => (
              <div key={p.phase}>
                <dt>{p.phase.charAt(0).toUpperCase() + p.phase.slice(1)}</dt>
                <dd>{dur(p.ms)}</dd>
              </div>
            ))}
            <div>
              <dt>Commands</dt>
              <dd>
                {data.commands.count} run, {dur(data.commands.totalMs)}
                {data.commands.failed ? `, ${data.commands.failed} failed` : ""}
              </dd>
            </div>
            <div>
              <dt>File tools</dt>
              <dd>
                {data.tools.count} calls, {dur(data.tools.totalMs)}
                {data.tools.byName.length ? ` · most used: ${data.tools.byName.slice(0, 3).map((t) => `${t.name} (${t.count})`).join(", ")}` : ""}
              </dd>
            </div>
            {data.checks.length ? (
              <div>
                <dt>Checks (approximate)</dt>
                <dd>
                  {data.checks
                    .filter((c) => c.approxMs >= 1000)
                    .sort((a, b) => b.approxMs - a.approxMs)
                    .slice(0, 6)
                    .map((c) => `${c.kind.replace(/_/g, " ")} ${dur(c.approxMs)}`)
                    .join(" · ") || "all under a second"}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}
    </div>
  );
}

interface LibraryRow {
  id: string;
  name: string;
  by: string;
  step: string;
  reason?: string;
  inApp: boolean;
  inScreen: boolean;
  file?: string;
}

/** Which component library pieces the build used, who chose each (FlowCode or an agent), and where each ended up. */
function LibraryUsed({ runId }: { runId?: string }) {
  const { data } = useResource<{ pieces: LibraryRow[] }>(runId ? `/runs/${runId}/library` : null, [runId], 15_000);
  if (!data) return null;
  const used = data.pieces.filter((p) => p.inScreen).length;
  return (
    <section className="perf-sec" aria-labelledby="perf-library">
      <h3 id="perf-library" className="perf-sec__title">Component library</h3>
      {data.pieces.length ? (
        <>
          <p className="muted perf-lib__sum">
            {data.pieces.length} piece{data.pieces.length === 1 ? "" : "s"} added, {used} in a screen.
          </p>
          <table className="table perf-table">
            <thead>
              <tr>
                <th scope="col">Piece</th>
                <th scope="col">Chosen by</th>
                <th scope="col">Why</th>
                <th scope="col">Now</th>
              </tr>
            </thead>
            <tbody>
              {data.pieces.map((p) => (
                <tr key={`${p.id}-${p.by}`}>
                  <td>
                    {p.name}
                    {p.file ? <span className="muted mono perf-lib__file"> {p.file.replace("src/sections/", "")}</span> : null}
                  </td>
                  <td>
                    {p.by === "flowcode" ? (
                      "FlowCode"
                    ) : p.by === "unrecorded" ? (
                      <span className="muted">Not recorded</span>
                    ) : (
                      <span className="perf-lib__agent">
                        <RobotHead color={ROLE_COLOR[p.by] ?? "#9a9fd6"} id={`lib-${p.id}`} size={18} />
                        {ROLE_LABEL[p.by] ?? p.by}
                      </span>
                    )}
                  </td>
                  <td>{p.reason ?? <span className="muted">{p.step ? `Picked from the library index in “${p.step}”` : "Added before FlowCode recorded library use"}</span>}</td>
                  <td>{p.inScreen ? "In a screen" : p.inApp ? <span className="muted">Added, not in a screen yet</span> : <span className="muted">Removed</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="muted">No library pieces were used in this build yet.</p>
      )}
    </section>
  );
}

/** My Projects → Performance: choose one of the project's runs (newest by default) and see where its time went. */
export function RunPerformancePage({ projectId, runId }: { projectId: string; runId?: string }) {
  const runs = useResource<Run[]>("/runs", [projectId]);
  const mine = (runs.data ?? []).filter((r) => r.projectId === projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const selected = runId && mine.some((r) => r.id === runId) ? runId : mine[0]?.id;
  if (runs.data && !mine.length) return <Empty title="No runs yet">Send a request to this project; each run&apos;s timing shows up here.</Empty>;
  return (
    <div className="perf-page">
      <div className="perf-page__pick">
        <label htmlFor="perf-run" className="label">
          Run
        </label>
        <select id="perf-run" className="select" value={selected ?? ""} onChange={(e) => navigate(`/quality/${projectId}/performance/${e.target.value}`)}>
          {mine.map((r) => (
            <option key={r.id} value={r.id}>
              {new Date(r.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · {r.status.replace(/_/g, " ")} · {r.objective.replace(/\s+/g, " ").slice(0, 70)}
            </option>
          ))}
        </select>
      </div>
      <RunPerformance runId={selected} />
    </div>
  );
}
