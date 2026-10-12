/** @flowcode-library stats-compare · Stats compared (Charts and data)
 * Catalog ID: p.stats-compare (pattern)
 * Function: The stats-compare pattern (p.stats-compare): period-switched metric tiles with change and trend; the reference sheet shows bookings, revenue, cancellations and gift cards.
 * Use it as: import { StatsCompare } from "./stats-compare"; <StatsCompare title lede? periods={[{ id: "week", label: "Week", previous: "last week" }]} metrics={[{ id, label, format?: "count"|"money", lowerIsBetter?, data: { week: { now, prev, series: number[] } } }]} empty? defaultPeriod? />
 * Look: A row of stat tiles with a big figure, an up/down/flat percentage pill colored good or bad against the previous period, the previous figure and a small trend line, under a title and a period switch.
 * Tokens: --color-accent --color-success --color-danger --color-text-muted --color-surface --color-surface-sunken --color-border --font-display --text-2xl --text-xs --space-2 --space-4 --space-5 --radius-lg
 * Use cases: kpi dashboard; metrics overview; sales summary; performance report; business stats; weekly report; admin dashboard
 * Jobs to be done: see how the business is doing; compare this period to the last; spot trends at a glance; track key numbers over time
 * Keywords: stats, kpi, comparison, sparkline, trend, period, dashboard
 */
/**
 * Stats compared with the last period: tiles for the numbers that matter, a week / month / quarter switch, an arrow
 * and percentage against the previous period, and a small trend line drawn in SVG. Use it at the top of a dashboard
 * or report. Make it the app's own: replace SAMPLE with your metrics and series; mark metrics where going down is
 * good with `lowerIsBetter` so the colors read the right way.
 */
import { useEffect, useId, useRef, useState } from "react";

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

const DELTA: Record<string, string> = { good: "fl-dsp-delta--good", bad: "fl-dsp-delta--bad", flat: "fl-dsp-delta--flat" };

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

export type StatsPeriod = { id: string; label: string; previous: string };
export type StatsFigures = { now: number; prev: number; series: number[] };
export type StatsMetric = {
  id: string;
  label: string;
  format?: "count" | "money";
  lowerIsBetter?: boolean;
  data: Record<string, StatsFigures>;
};

/**
 * p.stats-compare: tiles for the numbers that matter, a period switch (week / month / quarter), an arrow and percentage
 * against the previous period, and a small trend line. Each metric gives its figures per period id in `data`
 * ({ now, prev, series }). Set `lowerIsBetter` where going down is good so the colors read the right way. An empty
 * series shows `empty` instead of the trend. It has its own tiles: the catalog has no KPI component yet.
 */
export function StatsCompare({ title, lede, periods, metrics, empty = "No data in this period yet.", defaultPeriod, className }: {
  title: string;
  lede?: string;
  periods: StatsPeriod[];
  metrics: StatsMetric[];
  empty?: string;
  defaultPeriod?: string;
  className?: string;
}) {
  const titleId = useId();
  const [period, setPeriod] = useState(defaultPeriod ?? periods[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const p = periods.find((x) => x.id === period) ?? periods[0];

  function choose(id: string) {
    if (id === period) return;
    setPeriod(id);
    setLoading(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setLoading(false), 350);
  }

  return (
    <div className={className} data-fl="p.stats-compare" role="group" aria-labelledby={titleId}>
      <div className="fl-dsp-toolbar">
        <div className="fl-head" style={{ marginBottom: 0 }}>
          <h2 id={titleId} className="fl-title fl-title--md">
            {title}
          </h2>
          {lede ? <p className="fl-text">{lede}</p> : null}
        </div>
        <div className="fl-toggle" role="group" aria-label="Period">
          {periods.map((x) => (
            <button key={x.id} type="button" aria-pressed={period === x.id} onClick={() => choose(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
      </div>
      <p className="fl-sr" aria-live="polite">
        {loading ? "Updating" : `Showing this ${p.label.toLowerCase()} against ${p.previous}`}
      </p>
      <ul className={`fl-dsp-stats${loading ? " fl-dsp-stats--loading" : ""}`} aria-busy={loading}>
        {metrics.map((m) => {
          const v = m.data[p.id];
          const kind = m.format ?? "count";
          const change = v.prev === 0 ? (v.now === 0 ? 0 : 100) : ((v.now - v.prev) / v.prev) * 100;
          const dir = Math.abs(change) < 0.5 ? "flat" : change > 0 ? "up" : "down";
          const good = dir === "flat" ? "flat" : (dir === "up") !== !!m.lowerIsBetter ? "good" : "bad";
          const isEmpty = v.series.length === 0;
          return (
            <li key={m.id} className="fl-dsp-stat">
              <p className="fl-dsp-stat__label">{m.label}</p>
              <p className="fl-dsp-stat__value">
                <strong>{fmt(v.now, kind)}</strong>
                {!isEmpty && (
                  <span className={`fl-dsp-delta ${DELTA[good]}`}>
                    <Arrow dir={dir} />
                    <span className="fl-sr">{dir === "flat" ? "No change" : dir === "up" ? "Up" : "Down"}</span>
                    {dir === "flat" ? "0%" : `${Math.abs(change).toFixed(1)}%`}
                  </span>
                )}
              </p>
              {isEmpty ? (
                <p className="fl-dsp-stat__prev">{empty}</p>
              ) : (
                <>
                  <p className="fl-dsp-stat__prev">
                    {fmt(v.prev, kind)} {p.previous}
                  </p>
                  <Spark series={v.series} label={`${m.label} trend this ${p.label.toLowerCase()}: from ${fmt(v.series[0], kind)} to ${fmt(v.series[v.series.length - 1], kind)}`} />
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function StatsCompareSheet() {
  const d = SAMPLE;
  return (
    <section className="fl-section">
      <div className="fl-wrap">
        <StatsCompare title={d.title} lede={d.lede} periods={d.periods} metrics={d.metrics as StatsMetric[]} empty={d.empty} />
      </div>
    </section>
  );
}
