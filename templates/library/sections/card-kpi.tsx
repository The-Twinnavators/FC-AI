/** @flowcode-library card-kpi · KPI cards (Cards)
 * Catalog ID: c.kpi (component)
 * Function: The KPI tile component (c.kpi) for one dashboard measure with its change and trend; the reference sheet lays four of them in a grid with a this-week / this-month switch and an empty state.
 * Use it as: import { Kpi } from "./card-kpi"; <Kpi label="Bookings" value="142" change?={12.4} period?="last week" higherIsBetter?={true} series?={[18, 22, 19, 24]} emptyNote?="No sign-ups yet" />
 * Built from: c.card.surface
 * Look: A bordered tile with a small muted label, a large tabular number, a colored pill saying up or down by how much against the last period, and a filled trend line beneath; green when the move is good news, red when not, grey when flat.
 * Tokens: --color-surface --color-border --color-text --color-text-muted --color-success --color-danger --color-danger-surface --color-surface-sunken --text-sm --text-xs --text-2xl --font-display --space-2 --space-3 --space-5 --radius-sm
 * Use cases: dashboard overview; kpi summary; analytics dashboard; sales metrics; admin overview; business performance; finance summary; store stats
 * Jobs to be done: see how the business is doing; spot whether numbers are up or down; compare this week with last week; check key metrics at a glance
 * Keywords: dashboard, kpi, metrics, analytics, overview
 */
/**
 * Cards: KPI. A row of dashboard numbers, each with its change against the last period (up or down) and a small
 * trend line. Use at the top of a dashboard or an owner's overview. Make it the app's own: replace SAMPLE with the
 * app's real measures and periods; keep "higher is better" right for each one so up and down get the right color.
 */
import { useState } from "react";
import { Card } from "./cards-variants";

// ── c.kpi: one dashboard number with its change against the last period and a small trend line. ──

export type KpiProps = {
  /** What is measured: "Bookings". */
  label: string;
  /** The number, already formatted: "$6,380". */
  value: string;
  /** Signed percent change against the last period (12.4, -3.2); 0 reads as no change. Leave out for no change line. */
  change?: number;
  /** What the change is measured against: "last week". */
  period?: string;
  /** Whether a rise is good news (revenue) or bad (cancellations); it decides green or red. True when left out. */
  higherIsBetter?: boolean;
  /** The trend, oldest first; at least two points draw the line. */
  series?: number[];
  /** Shown instead of the change and line when there is no data yet (an empty series). */
  emptyNote?: string;
  className?: string;
};

/** Turn sample numbers into SVG points across a 100 by 32 box. */
function sparkPoints(series: number[]) {
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  return series.map((n, i) => {
    const x = series.length === 1 ? 50 : (i / (series.length - 1)) * 100;
    const y = 30 - ((n - min) / span) * 28;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
}

// Written out in full so a build finds every class.
const SPARK: Record<"up" | "down" | "flat", string> = { up: "fl-crd-spark fl-crd-spark--up", down: "fl-crd-spark fl-crd-spark--down", flat: "fl-crd-spark fl-crd-spark--flat" };
const DELTA: Record<"up" | "down" | "flat", string> = { up: "fl-crd-delta fl-crd-delta--up", down: "fl-crd-delta fl-crd-delta--down", flat: "fl-crd-delta fl-crd-delta--flat" };

function Sparkline({ series, tone, label }: { series: number[]; tone: "up" | "down" | "flat"; label: string }) {
  const pts = sparkPoints(series);
  return (
    <svg className={SPARK[tone]} viewBox="0 0 100 32" preserveAspectRatio="none" role="img" aria-label={label}>
      <polygon points={`0,32 ${pts.join(" ")} 100,32`} />
      <polyline points={pts.join(" ")} />
    </svg>
  );
}

function Arrow({ dir }: { dir: "up" | "down" | "flat" }) {
  const d = dir === "up" ? "M12 19V5M6 11l6-6 6 6" : dir === "down" ? "M12 5v14M6 13l6 6 6-6" : "M5 12h14";
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function Kpi({ label, value, change, period, higherIsBetter = true, series = [], emptyNote, className }: KpiProps) {
  const empty = series.length === 0 && emptyNote !== undefined;
  const dir: "up" | "down" | "flat" = !change ? "flat" : change > 0 ? "up" : "down";
  const good: "up" | "down" | "flat" = dir === "flat" ? "flat" : (dir === "up") === higherIsBetter ? "up" : "down";
  const against = period ? ` on ${period}` : "";
  const changeText = dir === "flat" ? `No change${against}` : `${dir === "up" ? "Up" : "Down"} ${Math.abs(change ?? 0).toFixed(1)}%${against}`;
  return (
    <div data-fl="c.kpi" className={className} style={{ display: "grid" }}>
      <Card variant="surface" className="fl-crd-kpi">
        <h3 className="fl-crd-kpi__label">{label}</h3>
        <p className="fl-crd-kpi__value">{value}</p>
        {empty ? (
          <p className="fl-crd-kpi__empty">{emptyNote}</p>
        ) : (
          <>
            {change !== undefined ? (
              <span className={DELTA[good]}>
                <Arrow dir={dir} />
                {changeText}
              </span>
            ) : null}
            {series.length > 1 ? (
              <Sparkline series={series} tone={good} label={`${label} trend: from ${series[0]} to ${series[series.length - 1]}`} />
            ) : null}
          </>
        )}
      </Card>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  eyebrow: "Overview",
  title: "How the studio is doing",
  periods: [
    { id: "week", label: "This week", compare: "last week" },
    { id: "month", label: "This month", compare: "last month" },
  ],
  metrics: [
    {
      label: "Bookings",
      higherIsBetter: true,
      week: { value: "142", change: 12.4, series: [18, 22, 19, 24, 21, 26, 30] },
      month: { value: "584", change: 6.1, series: [120, 131, 128, 140, 136, 149, 152, 158] },
    },
    {
      label: "Revenue",
      higherIsBetter: true,
      week: { value: "$6,380", change: -3.2, series: [980, 1040, 920, 860, 900, 820, 860] },
      month: { value: "$26,910", change: 9.8, series: [5200, 5600, 5450, 6100, 6300, 6500, 6720, 6900] },
    },
    {
      label: "Cancellations",
      higherIsBetter: false,
      week: { value: "7", change: -22.0, series: [3, 2, 2, 1, 2, 1, 1] },
      month: { value: "31", change: 4.5, series: [6, 7, 8, 7, 8, 9, 8, 8] },
    },
    {
      label: "New members",
      higherIsBetter: true,
      week: { value: "0", change: 0, series: [] as number[] },
      month: { value: "23", change: 0, series: [5, 6, 5, 6, 5, 6, 5, 6] },
    },
  ],
  emptyNote: "No sign-ups yet this period.",
};

type PeriodId = "week" | "month";

export default function CardKpi() {
  const d = SAMPLE;
  const [period, setPeriod] = useState<PeriodId>("week");
  const current = d.periods.find((p) => p.id === period) ?? d.periods[0];

  return (
    <section className="fl-section fl-section--tint" aria-labelledby="card-kpi-title">
      <div className="fl-wrap">
        <div className="fl-crd-bar" style={{ alignItems: "end" }}>
          <div className="fl-head" style={{ marginBottom: 0 }}>
            <span className="fl-eyebrow">{d.eyebrow}</span>
            <h2 id="card-kpi-title" className="fl-title fl-title--md">
              {d.title}
            </h2>
          </div>
          <div className="fl-toggle" role="group" aria-label="Period">
            {d.periods.map((p) => (
              <button key={p.id} type="button" aria-pressed={period === p.id} onClick={() => setPeriod(p.id as PeriodId)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <p className="fl-sr" aria-live="polite">Showing {current.label.toLowerCase()}, compared with {current.compare}.</p>

        <ul className="fl-grid fl-grid--4 fl-crd-list">
          {d.metrics.map((m) => {
            const v = m[period];
            return (
              <li key={m.label} style={{ display: "grid" }}>
                <Kpi
                  label={m.label}
                  value={v.value}
                  change={v.change}
                  period={current.compare}
                  higherIsBetter={m.higherIsBetter}
                  series={v.series}
                  emptyNote={d.emptyNote}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
