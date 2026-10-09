/** @flowcode-library stats-compare · Stats compared (Charts and data)
 * Use cases: kpi dashboard; metrics overview; sales summary; performance report; business stats; weekly report; admin dashboard
 * Jobs to be done: see how the business is doing; compare this period to the last; spot trends at a glance; track key numbers over time
 * Keywords: stats, kpi, comparison, sparkline, trend, period, dashboard
 */
/**
 * Stats compared with the last period: tiles for the numbers that matter, a week / month / quarter switch, an arrow
 * and percentage against the previous period, and a small trend line drawn in SVG. Use it at the top of a dashboard
 * or report. Make it the app's own: replace SAMPLE with your metrics and series; mark metrics where going down is
 * good with `lowerIsBetter` so the colours read the right way.
 */
import { useEffect, useRef, useState } from "react";

// flowcode:sample
const SAMPLE = {
  title: "How the studio is doing",
  lede: "Compared with the period before.",
  periods: [
    { id: "week", label: "Week", previous: "last week" },
    { id: "month", label: "Month", previous: "last month" },
    { id: "quarter", label: "Quarter", previous: "last quarter" },
  ],
  metrics: [
    {
      id: "bookings",
      label: "Class bookings",
      format: "count",
      lowerIsBetter: false,
      data: {
        week: { now: 84, prev: 71, series: [9, 12, 10, 14, 11, 15, 13] },
        month: { now: 342, prev: 355, series: [78, 85, 81, 92, 88, 84, 79, 90] },
        quarter: { now: 1012, prev: 876, series: [270, 290, 305, 298, 320, 336, 342] },
      },
    },
    {
      id: "revenue",
      label: "Revenue",
      format: "money",
      lowerIsBetter: false,
      data: {
        week: { now: 3240, prev: 2980, series: [380, 420, 410, 520, 460, 560, 490] },
        month: { now: 13480, prev: 12110, series: [2900, 3100, 3050, 3300, 3420, 3380, 3500, 3480] },
        quarter: { now: 38900, prev: 39400, series: [13200, 12800, 12600, 12900, 13100, 12700, 13100] },
      },
    },
    {
      id: "cancellations",
      label: "Cancellations",
      format: "count",
      lowerIsBetter: true,
      data: {
        week: { now: 3, prev: 6, series: [1, 0, 2, 0, 0, 0, 0] },
        month: { now: 19, prev: 14, series: [3, 4, 2, 5, 3, 4, 6, 5] },
        quarter: { now: 48, prev: 48, series: [16, 15, 17, 16, 14, 18, 16] },
      },
    },
    {
      id: "gift",
      label: "Gift cards sold",
      format: "count",
      lowerIsBetter: false,
      data: {
        week: { now: 0, prev: 0, series: [] as number[] },
        month: { now: 7, prev: 4, series: [0, 1, 1, 2, 0, 1, 1, 1] },
        quarter: { now: 21, prev: 12, series: [4, 6, 5, 7, 6, 8, 7] },
      },
    },
  ],
  empty: "No sales in this period yet.",
};

type PeriodId = "week" | "month" | "quarter";

function fmt(n: number, kind: string) {
  return kind === "money" ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : n.toLocaleString();
}

function Spark({ series, label }: { series: number[]; label: string }) {
  const max = Math.max(...series);
  const min = Math.min(...series);
  const span = max - min || 1;
  const pts = series.map((v, i) => [(i / (series.length - 1)) * 100, 30 - ((v - min) / span) * 26]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return (
    <svg className="fl-dsp-spark" viewBox="0 0 100 32" preserveAspectRatio="none" role="img" aria-label={label}>
      <path className="fl-dsp-spark__area" d={`${line} L100 32 L0 32 Z`} />
      <path className="fl-dsp-spark__line" d={line} />
    </svg>
  );
}

const Arrow = ({ dir }: { dir: "up" | "down" | "flat" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir === "up" ? "M12 19V5M6 11l6-6 6 6" : dir === "down" ? "M12 5v14M6 13l6 6 6-6" : "M5 12h14"} />
  </svg>
);

export default function StatsCompare() {
  const d = SAMPLE;
  const [period, setPeriod] = useState<PeriodId>("week");
  const [loading, setLoading] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const p = d.periods.find((x) => x.id === period)!;

  function choose(id: PeriodId) {
    if (id === period) return;
    setPeriod(id);
    setLoading(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setLoading(false), 350);
  }

  return (
    <section className="fl-section" aria-labelledby="stats-compare-title">
      <div className="fl-wrap">
        <div className="fl-dsp-toolbar">
          <div className="fl-head" style={{ marginBottom: 0 }}>
            <h2 id="stats-compare-title" className="fl-title fl-title--md">
              {d.title}
            </h2>
            <p className="fl-text">{d.lede}</p>
          </div>
          <div className="fl-toggle" role="group" aria-label="Period">
            {d.periods.map((x) => (
              <button key={x.id} type="button" aria-pressed={period === x.id} onClick={() => choose(x.id as PeriodId)}>
                {x.label}
              </button>
            ))}
          </div>
        </div>
        <p className="fl-sr" aria-live="polite">
          {loading ? "Updating" : `Showing this ${p.label.toLowerCase()} against ${p.previous}`}
        </p>
        <ul className={`fl-dsp-stats${loading ? " fl-dsp-stats--loading" : ""}`} aria-busy={loading}>
          {d.metrics.map((m) => {
            const v = m.data[period];
            const change = v.prev === 0 ? (v.now === 0 ? 0 : 100) : ((v.now - v.prev) / v.prev) * 100;
            const dir = Math.abs(change) < 0.5 ? "flat" : change > 0 ? "up" : "down";
            const good = dir === "flat" ? "flat" : (dir === "up") !== m.lowerIsBetter ? "good" : "bad";
            const empty = v.series.length === 0;
            return (
              <li key={m.id} className="fl-dsp-stat">
                <p className="fl-dsp-stat__label">{m.label}</p>
                <p className="fl-dsp-stat__value">
                  <strong>{fmt(v.now, m.format)}</strong>
                  {!empty && (
                    <span className={`fl-dsp-delta fl-dsp-delta--${good}`}>
                      <Arrow dir={dir} />
                      <span className="fl-sr">{dir === "flat" ? "No change" : dir === "up" ? "Up" : "Down"}</span>
                      {dir === "flat" ? "0%" : `${Math.abs(change).toFixed(1)}%`}
                    </span>
                  )}
                </p>
                {empty ? (
                  <p className="fl-dsp-stat__prev">{d.empty}</p>
                ) : (
                  <>
                    <p className="fl-dsp-stat__prev">
                      {fmt(v.prev, m.format)} {p.previous}
                    </p>
                    <Spark series={v.series} label={`${m.label} trend this ${p.label.toLowerCase()}: from ${fmt(v.series[0], m.format)} to ${fmt(v.series[v.series.length - 1], m.format)}`} />
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
