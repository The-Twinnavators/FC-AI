/** Home overview: activity over time, headline stats with gauges, and a live 3D preview of the network. */
import { lazy, Suspense, useState } from "react";
import { useResource } from "../api";
import { AnimatedNumber, AreaChart, RadialGauge, Skeleton } from "./motion";
import { navigate } from "../router";

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
  const { data } = useResource<TS>(`/metrics/timeseries?range=${range}`, [range], 20_000);
  const t = data?.totals;
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
              <h2 className="section__title" style={{ fontSize: 17 }}>
                Build activity
              </h2>
              <span className="muted" style={{ fontSize: 12.5 }}>
                Cumulative · from your builds, checked steps, agent tool calls and knowledge
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
        </div>
      </div>
      <div className="stat-cards">
        <Stat i={0} label="Steps checked" value={t?.tasksVerified} gauge={t && t.tasks ? t.tasksVerified / t.tasks : 0} gaugeLabel="Share of steps whose checks passed" />
        <Stat i={1} label="Checks run" value={t?.checksDecided} gauge={t?.checksPassRate ?? 0} gaugeLabel="Checks passed" />
        <Stat i={2} label="Agent tool calls" value={t?.toolCalls} gauge={t && t.runs ? t.runsDone / t.runs : 0} gaugeLabel="Builds finished" />
        <Stat i={3} label="Waiting on you" value={t?.pendingApprovals} gauge={t?.coderReady ? 1 : 0} gaugeLabel={t?.coderReady ? `Coder ready (${t.coderModel})` : "Coder not ready"} />
      </div>
    </section>
  );
}

function Stat({ i, label, value, suffix = "", gauge, gaugeLabel }: { i: number; label: string; value?: number; suffix?: string; gauge: number; gaugeLabel: string }) {
  return (
    <div className="section stat-card lift" data-reveal style={{ ["--i" as string]: i }}>
      <div>
        <span className="label">{label}</span>
        <div className="stat-card__value">{value === undefined ? <Skeleton w={70} h={30} /> : <AnimatedNumber value={value} format={(n) => `${Math.round(n).toLocaleString()}${suffix}`} />}</div>
        <span className="muted" style={{ fontSize: 11.5, display: "block", marginTop: 8 }}>
          {gaugeLabel}
        </span>
      </div>
      <RadialGauge value={gauge} label={gaugeLabel} />
    </div>
  );
}
