/** @flowcode-library card-kpi · KPI cards (Cards)
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

function Sparkline({ series, tone, label }: { series: number[]; tone: string; label: string }) {
  const pts = sparkPoints(series);
  return (
    <svg className={`fl-crd-spark fl-crd-spark--${tone}`} viewBox="0 0 100 32" preserveAspectRatio="none" role="img" aria-label={label}>
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
            const empty = v.series.length === 0;
            const dir: "up" | "down" | "flat" = v.change > 0 ? "up" : v.change < 0 ? "down" : "flat";
            const good = dir === "flat" ? "flat" : (dir === "up") === m.higherIsBetter ? "up" : "down";
            const changeText =
              dir === "flat" ? `No change on ${current.compare}` : `${dir === "up" ? "Up" : "Down"} ${Math.abs(v.change).toFixed(1)}% on ${current.compare}`;
            return (
              <li key={m.label} className="fl-card fl-crd-kpi">
                <h3 className="fl-crd-kpi__label">{m.label}</h3>
                <p className="fl-crd-kpi__value">{v.value}</p>
                {empty ? (
                  <p className="fl-crd-kpi__empty">{d.emptyNote}</p>
                ) : (
                  <>
                    <span className={`fl-crd-delta fl-crd-delta--${good}`}>
                      <Arrow dir={dir} />
                      {changeText}
                    </span>
                    <Sparkline
                      series={v.series}
                      tone={good}
                      label={`${m.label} trend, ${current.label.toLowerCase()}: from ${v.series[0]} to ${v.series[v.series.length - 1]}`}
                    />
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
