/** Home overview: activity over time, headline stats with gauges, and a live 3D preview of the network. */
import { lazy, Suspense, useState } from "react";
import { useResource } from "../api";
import { AnimatedNumber, AreaChart, RadialGauge, Skeleton } from "./motion";
import { navigate } from "../router";
import { ROLE_COLOR, ROLE_LABEL, RobotHead } from "./RobotHead";

const Mini3D = lazy(() => import("./Mini3D"));

interface TS {
  range: string;
  start: string;
  end: string;
  cumulative: { runs: number[]; verified: number[]; toolCalls: number[]; knowledge: number[] };
  totals: { runs: number; runsDone: number; tasks: number; tasksVerified: number; checksPassRate: number; checksDecided: number; toolCalls: number; knowledge: number; pendingApprovals: number; coderReady: boolean; coderModel: string | null };
}

const RANGES = ["7d", "30d", "90d", "all"] as const;
const COLORS = { runs: "#3a60c4", verified: "#2fc4b2", toolCalls: "#84a0db", knowledge: "#7fb0c4" };

export function Dashboard() {
  const [range, setRange] = useState<(typeof RANGES)[number]>("7d");
  const [tab, setTab] = useState<"activity" | "agents">("activity");
  const { data } = useResource<TS>(`/metrics/timeseries?range=${range}`, [range], 20_000);
  const t = data?.totals;
  // Waiting on you counts decisions only: suggestions never hold up a build (it showed 19 when nothing was waiting).
  const pending = useResource<Array<{ kind: string; savedForLater?: boolean }>>("/approvals", [], 20_000);
  const waiting = pending.data?.filter((a) => a.kind !== "enhancement_idea").length;
  const newIdeas = pending.data?.filter((a) => a.kind === "enhancement_idea" && !a.savedForLater).length ?? 0;
  return (
    <section className="dash" aria-label="Overview">
      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 0.8fr) minmax(0, 1.7fr)", gap: 20 }}>
        <div className="mini3d" data-reveal style={{ ["--i" as string]: 1, position: "relative", overflow: "hidden", minHeight: 360, height: "auto", alignSelf: "stretch", contain: "layout paint" }} onClick={() => navigate("/network")} role="link" tabIndex={0} aria-label="Open the knowledge network graph" onKeyDown={(e) => e.key === "Enter" && navigate("/network")}>
          <Suspense fallback={<Skeleton h={300} />}>
            <Mini3D />
          </Suspense>
          <div className="mini3d__label">
            <span className="label">knowledge network · live</span>
            <strong style={{ fontSize: 15 }}>Explore in 3D →</strong>
          </div>
        </div>
        <div className="section chart-card" data-reveal>
          <div className="chart-card__head">
            <div>
              {/* Two views of the same range: overall activity, and each agent's completed and failed work. */}
              <div className="dash-tabs" role="tablist" aria-label="Build activity views">
                <button type="button" role="tab" id="dash-tab-activity" aria-controls="dash-panel" aria-selected={tab === "activity"} className={tab === "activity" ? "is-on" : undefined} onClick={() => setTab("activity")}>
                  Build activity
                </button>
                <button type="button" role="tab" id="dash-tab-agents" aria-controls="dash-panel" aria-selected={tab === "agents"} className={tab === "agents" ? "is-on" : undefined} onClick={() => setTab("agents")}>
                  Agents
                </button>
              </div>
              <span className="muted" style={{ fontSize: 12.5 }}>
                {tab === "activity" ? "Cumulative · from your builds, checked steps, agent tool calls and knowledge" : "Each agent's completed and failed tasks (tool calls) in this range"}
              </span>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <div className="seg" role="radiogroup" aria-label="Range">
                {RANGES.map((r) => (
                  <button key={r} role="radio" aria-checked={range === r} onClick={() => setRange(r)}>
                    {r === "all" ? "All" : r}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div id="dash-panel" role="tabpanel" aria-labelledby={tab === "activity" ? "dash-tab-activity" : "dash-tab-agents"}>
          {tab === "agents" ? (
            <AgentWork range={range} />
          ) : (
          <>
          <div className="legend" style={{ marginBottom: 8 }}>
            <span>
              <i className="dot" style={{ background: COLORS.runs, color: COLORS.runs }} /> Runs
            </span>
            <span>
              <i className="dot" style={{ background: COLORS.verified, color: COLORS.verified }} /> Steps checked
            </span>
            <span>
              <i className="dot" style={{ background: COLORS.toolCalls, color: COLORS.toolCalls }} /> Tool calls
            </span>
            <span>
              <i className="dot" style={{ background: COLORS.knowledge, color: COLORS.knowledge }} /> Knowledge
            </span>
          </div>
          {data ? (
            <AreaChart
              label="Build activity"
              start={data.start}
              end={data.end}
              series={[
                { key: "toolCalls", label: "Tool calls", color: COLORS.toolCalls, values: data.cumulative.toolCalls },
                { key: "knowledge", label: "Knowledge", color: COLORS.knowledge, values: data.cumulative.knowledge },
                { key: "runs", label: "Runs", color: COLORS.runs, values: data.cumulative.runs },
                { key: "verified", label: "Steps checked", color: COLORS.verified, values: data.cumulative.verified },
              ]}
            />
          ) : (
            <Skeleton h={280} />
          )}
          </>
          )}
          </div>
        </div>
      </div>
      <div className="stat-cards">
        <Stat i={0} label="Steps checked" value={t?.tasksVerified} gauge={t && t.tasks ? t.tasksVerified / t.tasks : 0} gaugeLabel="Share of steps whose checks passed" />
        <Stat i={1} label="Checks run" value={t?.checksDecided} gauge={t?.checksPassRate ?? 0} gaugeLabel="Checks passed" />
        {/* Each number with the gauge that measures it (tool calls sat beside "builds finished", waiting beside "coder ready"). */}
        <Stat i={2} label="Builds finished" value={t?.runsDone} gauge={t && t.runs ? t.runsDone / t.runs : 0} gaugeLabel={t ? `of ${t.runs.toLocaleString()} builds · ${t.toolCalls.toLocaleString()} agent tool calls` : ""} />
        <Stat i={3} label="Waiting on you" value={waiting} gaugeLabel={`${waiting ? "decisions to make" : "nothing to decide"}${newIdeas ? ` · ${newIdeas} new suggestion${newIdeas === 1 ? "" : "s"}` : ""}${t ? ` · coder ${t.coderReady ? `ready (${t.coderModel})` : "not ready"}` : ""}`} />
      </div>
    </section>
  );
}

function Stat({ i, label, value, suffix = "", gauge, gaugeLabel }: { i: number; label: string; value?: number; suffix?: string; gauge?: number; gaugeLabel: string }) {
  return (
    <div className="section stat-card lift" data-reveal style={{ ["--i" as string]: i }}>
      <div>
        <span className="label">{label}</span>
        <div className="stat-card__value">{value === undefined ? <Skeleton w={70} h={30} /> : <AnimatedNumber value={value} format={(n) => `${Math.round(n).toLocaleString()}${suffix}`} />}</div>
        <span className="muted" style={{ fontSize: 11.5, display: "block", marginTop: 8 }}>
          {gaugeLabel}
        </span>
      </div>
      {gauge === undefined ? null : <RadialGauge value={gauge} label={gaugeLabel} />}
    </div>
  );
}

interface AgentRow {
  role: string;
  model: string;
  calls: number;
  ok: number;
  rejected: number;
  failed: number;
}

/** Each agent's work in the range: a bar split into completed, failed and turned down, with the counts beside it. */
function AgentWork({ range }: { range: (typeof RANGES)[number] }) {
  const { data } = useResource<{ agents: AgentRow[] }>(`/agents/activity?window=${range}`, [range], 20_000);
  if (!data) return <Skeleton h={280} />;
  const max = Math.max(1, ...data.agents.map((a) => a.calls));
  return (
    <ul className="dash-agents" aria-label="Agents' tasks">
      {/* Agents that did work this range first, busiest first. */}
      {[...data.agents].sort((x, y) => y.calls - x.calls).map((a) => {
        const done = a.calls ? Math.round((a.ok / a.calls) * 100) : 0;
        return (
          <li key={a.role} className={a.calls ? undefined : "is-idle"}>
            <span className="dash-agents__who">
              <RobotHead color={ROLE_COLOR[a.role] ?? "#9a9fd6"} id={`dash-${a.role}`} size={24} />
              <span>
                <strong>{ROLE_LABEL[a.role] ?? a.role}</strong>
                <small>{a.model}</small>
              </span>
            </span>
            <span className="dash-agents__bar" style={{ width: `${(a.calls / max) * 100}%` }} role="img" aria-label={`${a.ok} completed, ${a.failed} failed, ${a.rejected} turned down`}>
              {a.ok ? <i className="is-ok" style={{ flexGrow: a.ok }} /> : null}
              {a.failed ? <i className="is-fail" style={{ flexGrow: a.failed }} /> : null}
              {a.rejected ? <i className="is-no" style={{ flexGrow: a.rejected }} /> : null}
            </span>
            <span className="dash-agents__nums">
              {a.calls ? (
                <>
                  <span>
                    <b className="is-ok">{a.ok.toLocaleString()}</b> completed · <b className={a.failed ? "is-fail" : undefined}>{a.failed.toLocaleString()}</b> failed
                    {a.rejected ? <> · {a.rejected.toLocaleString()} turned down</> : null}
                  </span>
                  <small>{done}% completed</small>
                </>
              ) : (
                <span className="muted">No work in this range</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
