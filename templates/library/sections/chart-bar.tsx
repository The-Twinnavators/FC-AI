/** @flowcode-library chart-bar · Bar chart (Charts and data)
 * Catalog ID: c.bar-chart (component)
 * Function: The bar chart (c.bar-chart): one or two series as vertical bars per month or week, each month a keyboard stop; the reference sheet shows orders shipped per month with a year switch.
 * Use it as: import { BarChart } from "./chart-bar"; <BarChart title="Monthly sales" summary?="title, 2026" labels={["Jan",...]} series={[{ name: "Orders", points: [164,171,...], tone?: "accent"|"success" }]} formatY?={(n) => String(n)} xLabel?="Month" hint? empty?={{ title, text }} controls?={<year switch/>} legend?={true} tooltip?={true} />
 * Look: Vertical bars with rounded tops that grow in from the axis, a value axis with dashed grid lines, month labels, a legend with each series' total, a highlighted column and tooltip on hover or arrow keys, and a hidden table with the same numbers.
 * Tokens: --color-accent --color-success --color-focus --color-surface --color-surface-sunken --color-border --color-border-strong --color-text --color-text-muted --font-sans --text-xs --text-sm --space-2 --space-3 --space-4 --radius-md --duration-base --easing
 * Use cases: monthly sales; orders per month; sign-ups per week; revenue by month; sales report; ecommerce dashboard; comparison by period
 * Jobs to be done: see how much was sold each month; compare one month with another; check the number for a specific month; switch between years
 * Keywords: chart, bar, bars, monthly, sales, report
 */
/**
 * Chart: bar. Monthly amounts as vertical bars that grow in from the axis, with a value axis, month labels, a legend
 * with each series' total, a year switch and a tooltip that shows a month's numbers on hover or when its bar has
 * keyboard focus (arrow keys move between bars). Use for sales, orders or sign-ups per month on a dashboard or report.
 * Make it the app's own: replace SAMPLE with the app's real months and amounts; keep one or two series so the bars
 * stay wide enough to read.
 * Adapted from TailAdmin (MIT License, Copyright (c) 2023 TailAdmin): the "Monthly Sales" bar chart.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Sales",
  title: "Orders shipped each month",
  lede: "Every order that left the workshop, counted in the month it shipped.",
  years: [
    {
      year: "2025",
      series: [{ key: "orders", label: "Orders shipped", tone: "accent", values: [118, 132, 141, 156, 149, 162, 171, 158, 184, 203, 247, 296] }],
    },
    {
      year: "2026",
      series: [{ key: "orders", label: "Orders shipped", tone: "accent", values: [164, 171, 189, 204, 198, 221, 236, 219, 248, 0, 0, 0] }],
    },
  ],
  months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  hint: "Hover a bar, or tab to the chart and use the arrow keys, to read each month.",
  empty: { title: "No orders shipped yet", text: "Monthly numbers show here once the first orders go out." },
};

const HEIGHT = 260;
const PAD = { l: 44, r: 12, t: 14, b: 30 };

export type BarTone = "accent" | "success";
export type BarSeries = { name: string; points: number[]; tone?: BarTone };

const DEFAULT_TONES: BarTone[] = ["accent", "success"];
const SWATCH: Record<BarTone, string> = { accent: "fl-dat-swatch--accent", success: "fl-dat-swatch--success" };
const RECT: Record<BarTone, string> = { accent: "fl-dat-rect--accent", success: "fl-dat-rect--success" };

/** A round step for the value axis: 1, 2, 2.5 or 5 times a power of ten, so four steps cover the biggest bar. */
function niceStep(raw: number) {
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
}

/** A bar with rounded top corners (square at the axis), as an SVG path. */
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.max(0, Math.min(4, w / 2, h));
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

/**
 * c.bar-chart: one or two series as vertical bars per label (months, weeks), grouped side by side, growing in from the
 * axis. Each label's bars are one focusable stop named with its numbers: Tab reaches the chart, the arrow keys move
 * between labels (Home and End jump to the ends, Escape hides the tooltip), and hover shows the same tooltip. The same
 * numbers sit in a screen-reader table. Every series needs one point per label. The legend shows each series' total;
 * `controls` shows next to it (a year switch); `empty` replaces the chart when there is no data.
 */
export function BarChart({ series, labels, formatY = String, title, summary, xLabel = "Month", hint, empty, controls, legend = true, tooltip = true, className }: {
  series: BarSeries[];
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
  const stops = useRef<Array<SVGGElement | null>>([]);
  const [w, setW] = useState(720);
  const [hover, setHover] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);

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

  // A new set of labels (another year) clears the tooltip and starts the keyboard at the first bar.
  useEffect(() => {
    setHover(null);
    setActive(0);
  }, [n, labels[0]]);

  const step = niceStep(Math.max(1, ...rows.flatMap((s) => s.points)) / 4);
  const max = step * 4;
  const iw = Math.max(10, w - PAD.l - PAD.r);
  const ih = HEIGHT - PAD.t - PAD.b;
  const slot = iw / Math.max(1, n);
  // Bars fill about 56% of each slot; a second series sits beside the first with a small gap.
  const gap = rows.length > 1 ? Math.min(4, slot * 0.04) : 0;
  const barW = Math.max(2, (slot * 0.56 - gap * (rows.length - 1)) / Math.max(1, rows.length));
  const groupW = barW * rows.length + gap * (rows.length - 1);
  const x0 = (i: number) => PAD.l + i * slot + (slot - groupW) / 2;
  const y = (v: number) => PAD.t + ih - (Math.max(0, v) / max) * ih;
  const ticks = [0, 1, 2, 3, 4].map((k) => k * step);
  // Every label when there is room, every other one on narrow screens.
  const every = slot >= 34 ? 1 : 2;

  const describe = (i: number) => `${labels[i]}: ${rows.map((s) => `${s.name} ${formatY(s.points[i] ?? 0)}`).join(", ")}`;

  const go = (i: number) => {
    setActive(i);
    stops.current[i]?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = Math.min(n - 1, active + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = Math.max(0, active - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    else if (e.key === "Escape") return setHover(null);
    if (next === null) return;
    e.preventDefault();
    go(next);
  };

  const tipLeft = hover === null ? 0 : Math.max(0, Math.min(x0(hover) + groupW + 8, w - 176));

  return (
    <div className={["fl-dat-panel", className].filter(Boolean).join(" ")} data-fl="c.bar-chart">
      {legend || controls ? (
        <div className="fl-dat-chart-head">
          {legend ? (
            <ul className="fl-dat-list fl-dat-legend" aria-label="Legend">
              {rows.map((s) => (
                <li key={s.name}>
                  <span className={`fl-dat-swatch ${SWATCH[s.tone]}`} aria-hidden="true" />
                  {s.name}
                  {hasData ? <strong>{formatY(s.points.reduce((a, v) => a + v, 0))}</strong> : null}
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
            className={["fl-dat-plot", "fl-dat-bars", focused ? "is-focused" : ""].filter(Boolean).join(" ")}
            role="group"
            aria-label={`${name}. Use the arrow keys to move between ${labels.length} bars.`}
            onKeyDown={onKey}
            onFocus={() => setFocused(true)}
            onBlur={(e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
              setFocused(false);
              setHover(null);
            }}
            onMouseLeave={() => setHover(focused ? active : null)}
          >
            <svg key={`${n}-${labels[0]}`} width="100%" height={HEIGHT} viewBox={`0 0 ${w} ${HEIGHT}`} focusable="false">
              <g aria-hidden="true">
                {ticks.map((t) => (
                  <g key={t}>
                    <line className="fl-dat-grid" x1={PAD.l} x2={w - PAD.r} y1={y(t)} y2={y(t)} />
                    <text className="fl-dat-axis" x={PAD.l - 8} y={y(t) + 4} textAnchor="end">
                      {formatY(t)}
                    </text>
                  </g>
                ))}
                {labels.map((l, i) =>
                  i % every === 0 ? (
                    <text key={l} className="fl-dat-axis" x={PAD.l + i * slot + slot / 2} y={HEIGHT - 8} textAnchor="middle">
                      {l}
                    </text>
                  ) : null,
                )}
              </g>
              {labels.map((l, i) => (
                <g
                  key={l}
                  ref={(el) => {
                    stops.current[i] = el;
                  }}
                  className="fl-dat-col"
                  tabIndex={i === active ? 0 : -1}
                  role="img"
                  aria-label={describe(i)}
                  onFocus={() => {
                    setActive(i);
                    setHover(i);
                  }}
                  onMouseEnter={() => setHover(i)}
                >
                  <rect className={hover === i ? "fl-dat-band is-on" : "fl-dat-band"} x={PAD.l + i * slot + 1} y={PAD.t} width={Math.max(0, slot - 2)} height={ih} rx={4} />
                  {rows.map((s, k) => {
                    const v = s.points[i] ?? 0;
                    const top = y(v);
                    return v > 0 ? (
                      <path
                        key={s.name}
                        className={`fl-dat-rect ${RECT[s.tone]}`}
                        style={{ animationDelay: `calc(var(--duration-base) * ${(i * 0.25).toFixed(2)})` }}
                        d={barPath(x0(i) + k * (barW + gap), top, barW, PAD.t + ih - top)}
                      />
                    ) : null;
                  })}
                  {focused && hover === i ? (
                    <rect className="fl-dat-focus" x={PAD.l + i * slot + 1} y={PAD.t} width={Math.max(0, slot - 2)} height={ih} rx={4} />
                  ) : null}
                </g>
              ))}
              <line className="fl-dat-baseline" x1={PAD.l} x2={w - PAD.r} y1={PAD.t + ih} y2={PAD.t + ih} aria-hidden="true" />
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
                    <strong>{formatY(s.points[hover] ?? 0)}</strong>
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
                    <td key={s.name}>{formatY(s.points[i] ?? 0)}</td>
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
    </div>
  );
}

export default function ChartBar() {
  const d = SAMPLE;
  const [year, setYear] = useState(d.years[d.years.length - 1].year);
  const [said, setSaid] = useState("");
  const data = d.years.find((y) => y.year === year) ?? d.years[0];
  const series = data.series.map((s) => ({ name: s.label, tone: s.tone as BarTone, points: s.values }));

  return (
    <section className="fl-section" aria-labelledby="chart-bar-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="chart-bar-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>

        <BarChart
          series={series}
          labels={d.months}
          title={d.title}
          summary={`${d.title}, ${year}`}
          formatY={(n) => n.toLocaleString()}
          hint={d.hint}
          empty={d.empty}
          controls={
            <div className="fl-toggle" role="group" aria-label="Year">
              {d.years.map((y) => (
                <button
                  key={y.year}
                  type="button"
                  aria-pressed={year === y.year}
                  onClick={() => {
                    setYear(y.year);
                    setSaid(`Showing ${y.year}.`);
                  }}
                >
                  {y.year}
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
