/** @flowcode-library chart-area · Area chart (Charts and data)
 * Catalog ID: c.area-chart (component)
 * Function: The area chart (c.area-chart): a keyboard-readable multi-series trend chart; the reference sheet shows two series over 4 or 12 weeks with a period switch.
 * Use it as: import { AreaChart } from "./chart-area"; <AreaChart title="Classes booked" summary?="title, last 12 weeks" labels={["Jul 21",...]} series={[{ name: "Booked", points: [96,104,...], tone?: "accent"|"success" }]} formatY?={(n) => String(n)} xLabel?="Week of" hint? empty?={{ title, text }} controls?={<range switch/>} legend?={true} tooltip?={true} />
 * Look: Smooth overlaid areas with glowing end points that draw themselves in, a legend with the latest values, a crosshair tooltip on hover or arrow keys, and a hidden table with the same numbers.
 * Tokens: --color-accent --color-success --color-surface --color-border --color-text --color-text-muted --font-sans --text-xs --text-sm --space-2 --space-3 --space-4 --radius-md --duration-base --easing
 * Use cases: trend chart; analytics report; traffic over time; revenue trend; usage over time; sales comparison; time series dashboard
 * Jobs to be done: see how numbers change over time; compare two series side by side; check a value on a specific week; switch between short and long ranges
 * Keywords: chart, area, trend, time series, report
 */
/**
 * Chart: area. Two series over recent weeks as smooth, overlaid areas that draw themselves in, with glowing end
 * points, a legend, a 4 or 12 week switch and a crosshair that shows each week's numbers on hover or with the arrow
 * keys. Use for a trend on a dashboard or report. Make it the app's own: replace SAMPLE with the app's real series and
 * weeks; keep two or three series at most so the areas stay readable.
 * Adapted from FlowCode's own UI (Branding page).
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Bookings",
  title: "Classes booked and repeat clients",
  lede: "Each point is one week. Repeat clients are people who booked again within 30 days.",
  periods: [
    { weeks: 4, label: "4 weeks" },
    { weeks: 12, label: "12 weeks" },
  ],
  weeks: ["Jul 21", "Jul 28", "Aug 4", "Aug 11", "Aug 18", "Aug 25", "Sep 1", "Sep 8", "Sep 15", "Sep 22", "Sep 29", "Oct 6"],
  series: [
    { key: "booked", label: "Classes booked", tone: "accent", values: [96, 104, 99, 112, 108, 101, 118, 126, 121, 134, 141, 138] },
    { key: "repeat", label: "Repeat clients", tone: "success", values: [41, 44, 47, 46, 52, 50, 55, 61, 58, 66, 70, 74] },
  ],
  hint: "Hover the chart, or focus it and use the arrow keys, to read each week.",
  empty: { title: "No bookings yet", text: "Weekly numbers show here once the first classes are booked." },
};

const HEIGHT = 260;
const PAD = { l: 40, r: 16, t: 14, b: 30 };

export type AreaTone = "accent" | "success";
export type AreaSeries = { name: string; points: number[]; tone?: AreaTone };

const DEFAULT_TONES: AreaTone[] = ["accent", "success"];
const STOP: Record<AreaTone, string> = { accent: "fl-dat-stop-accent", success: "fl-dat-stop-success" };
const SWATCH: Record<AreaTone, string> = { accent: "fl-dat-swatch--accent", success: "fl-dat-swatch--success" };
const LINE: Record<AreaTone, string> = { accent: "fl-dat-line--accent", success: "fl-dat-line--success" };
const DOT: Record<AreaTone, string> = { accent: "fl-dat-dot--accent", success: "fl-dat-dot--success" };
const HIT: Record<AreaTone, string> = { accent: "fl-dat-hit--accent", success: "fl-dat-hit--success" };

/**
 * c.area-chart: one to three series as smooth, overlaid areas that draw themselves in, with glowing end points, a
 * legend with the latest values and a crosshair tooltip on hover or with the arrow keys (Home and End jump to the
 * ends, Escape hides it). The same numbers sit in a screen-reader table. Every series needs one point per label.
 * `controls` shows next to the legend (a range switch); `empty` replaces the chart when there is no data.
 */
export function AreaChart({ series, labels, formatY = String, title, summary, xLabel = "Week of", hint, empty, controls, legend = true, tooltip = true, className }: {
  series: AreaSeries[];
  labels: string[];
  formatY?: (n: number) => string;
  title: string;
  summary?: string;
  xLabel?: string;
  hint?: string;
  empty?: { title: string; text: string };
  controls?: ReactNode;
  legend?: boolean;
  tooltip?: boolean;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
  const [hover, setHover] = useState<number | null>(null);
  const [said, setSaid] = useState("");
  const uid = useId().replace(/:/g, "");

  const n = labels.length;
  const rows = series.map((s, i) => ({ ...s, tone: s.tone ?? DEFAULT_TONES[i % DEFAULT_TONES.length] }));
  const hasData = n > 0 && rows.some((s) => s.points.some((v) => v > 0));
  const name = summary ?? title;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    setW(el.clientWidth || 720);
    if (!("ResizeObserver" in window)) return;
    const ro = new ResizeObserver(() => host.current && setW(host.current.clientWidth || 720));
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasData]);

  // A new set of labels (a different range) clears the crosshair.
  useEffect(() => setHover(null), [n]);

  const rawMax = Math.max(1, ...rows.flatMap((s) => s.points));
  const step = rawMax > 100 ? 50 : 10;
  const max = Math.ceil(rawMax / step) * step;
  const iw = Math.max(10, w - PAD.l - PAD.r);
  const ih = HEIGHT - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => PAD.t + ih - (v / max) * ih;
  // Smooth curve: a cubic between each pair of points with both handles at the horizontal midpoint.
  const path = (vals: number[]) => {
    let p = `M${x(0)},${y(vals[0] ?? 0)}`;
    for (let i = 1; i < vals.length; i++) {
      const cx = (x(i - 1) + x(i)) / 2;
      p += ` C${cx},${y(vals[i - 1])} ${cx},${y(vals[i])} ${x(i)},${y(vals[i])}`;
    }
    return p;
  };
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  const xTicks = Array.from(new Set([0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (n - 1)))));

  const describe = (i: number) => `${labels[i]}: ${rows.map((s) => `${s.name} ${formatY(s.points[i])}`).join(", ")}`;
  const show = (i: number | null, announce: boolean) => {
    setHover(i);
    if (announce && i !== null) setSaid(describe(i));
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!hasData) return;
    const cur = hover ?? n - 1;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = Math.min(n - 1, hover === null ? n - 1 : cur + 1);
    else if (e.key === "ArrowLeft") next = Math.max(0, hover === null ? n - 1 : cur - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    else if (e.key === "Escape") return show(null, false);
    if (next === null) return;
    e.preventDefault();
    show(next, true);
  };

  const tipLeft = hover === null ? 0 : Math.max(0, Math.min(x(hover) + 12, w - 176));

  return (
    <div className={["fl-dat-panel", className].filter(Boolean).join(" ")} data-fl="c.area-chart">
      {legend || controls ? (
        <div className="fl-dat-chart-head">
          {legend ? (
            <ul className="fl-dat-list fl-dat-legend" aria-label="Legend">
              {rows.map((s) => (
                <li key={s.name}>
                  <span className={`fl-dat-swatch ${SWATCH[s.tone]}`} aria-hidden="true" />
                  {s.name}
                  {hasData ? <strong>{formatY(s.points[n - 1])}</strong> : null}
                </li>
              ))}
            </ul>
          ) : (
            <span />
          )}
          {controls}
        </div>
      ) : null}

      {hasData ? (
        <>
          <div
            ref={host}
            className="fl-dat-plot"
            tabIndex={0}
            role="group"
            aria-label={`${name}. Use the arrow keys to read each point.`}
            onKeyDown={onKey}
            onFocus={() => hover === null && show(n - 1, true)}
            onBlur={() => setHover(null)}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const i = Math.round(((e.clientX - rect.left - PAD.l) / iw) * (n - 1));
              show(i >= 0 && i < n ? i : null, false);
            }}
            onMouseLeave={() => setHover(null)}
          >
            <svg key={n} width="100%" height={HEIGHT} viewBox={`0 0 ${w} ${HEIGHT}`} aria-hidden="true" focusable="false">
              <defs>
                {rows.map((s, k) => (
                  <linearGradient key={s.name} id={`fl-dat-a${uid}${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" className={STOP[s.tone]} stopOpacity="0.36" />
                    <stop offset="100%" className={STOP[s.tone]} stopOpacity="0.02" />
                  </linearGradient>
                ))}
              </defs>
              {ticks.map((t) => (
                <g key={t}>
                  <line className="fl-dat-grid" x1={PAD.l} x2={w - PAD.r} y1={y(t)} y2={y(t)} />
                  <text className="fl-dat-axis" x={PAD.l - 8} y={y(t) + 4} textAnchor="end">
                    {formatY(t)}
                  </text>
                </g>
              ))}
              {xTicks.map((i, k) => (
                <text key={i} className="fl-dat-axis" x={x(i)} y={HEIGHT - 8} textAnchor={k === 0 ? "start" : k === xTicks.length - 1 ? "end" : "middle"}>
                  {labels[i]}
                </text>
              ))}
              {rows.map((s, k) => (
                <g key={s.name}>
                  <path className="fl-dat-area" d={`${path(s.points)} L${x(n - 1)},${PAD.t + ih} L${x(0)},${PAD.t + ih} Z`} fill={`url(#fl-dat-a${uid}${k})`} />
                  <path className={`fl-dat-line ${LINE[s.tone]}`} d={path(s.points)} pathLength={1} />
                  <circle className={`fl-dat-dot ${DOT[s.tone]}`} cx={x(n - 1)} cy={y(s.points[n - 1] ?? 0)} r={4} />
                </g>
              ))}
              {hover !== null ? (
                <g pointerEvents="none">
                  <line className="fl-dat-cross" x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} />
                  {rows.map((s) => (
                    <circle key={s.name} className={`fl-dat-hit ${HIT[s.tone]}`} cx={x(hover)} cy={y(s.points[hover] ?? 0)} r={4.5} />
                  ))}
                </g>
              ) : null}
            </svg>
            {tooltip && hover !== null ? (
              <div className="fl-dat-tip" style={{ left: tipLeft }} aria-hidden="true">
                <span className="fl-dat-tip-title">
                  {xLabel} {labels[hover]}
                </span>
                {rows.map((s) => (
                  <span key={s.name} className="fl-dat-tip-row">
                    <span className={`fl-dat-swatch ${SWATCH[s.tone]}`} />
                    {s.name}
                    <strong>{formatY(s.points[hover])}</strong>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          {hint ? <p className="fl-dat-hint">{hint}</p> : null}
          <table className="fl-sr">
            <caption>{name}</caption>
            <thead>
              <tr>
                <th scope="col">{xLabel}</th>
                {rows.map((s) => (
                  <th key={s.name} scope="col">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((l, i) => (
                <tr key={l}>
                  <th scope="row">{l}</th>
                  {rows.map((s) => (
                    <td key={s.name}>{formatY(s.points[i])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : empty ? (
        <div className="fl-dat-empty">
          <strong>{empty.title}</strong>
          <p>{empty.text}</p>
        </div>
      ) : null}
      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

export default function ChartArea() {
  const d = SAMPLE;
  const [weeks, setWeeks] = useState(12);
  const [said, setSaid] = useState("");
  const labels = d.weeks.slice(-weeks);
  const series = d.series.map((s) => ({ name: s.label, tone: s.tone as AreaTone, points: s.values.slice(-weeks) }));

  return (
    <section className="fl-section" aria-labelledby="chart-area-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="chart-area-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>

        <AreaChart
          series={series}
          labels={labels}
          title={d.title}
          summary={`${d.title}, last ${weeks} weeks`}
          hint={d.hint}
          empty={d.empty}
          controls={
            <div className="fl-toggle" role="group" aria-label="Period">
              {d.periods.map((p) => (
                <button
                  key={p.weeks}
                  type="button"
                  aria-pressed={weeks === p.weeks}
                  onClick={() => {
                    setWeeks(p.weeks);
                    setSaid(`Showing the last ${p.label}.`);
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          }
        />
        <p className="fl-sr" role="status" aria-live="polite">
          {said}
        </p>
      </div>
    </section>
  );
}
