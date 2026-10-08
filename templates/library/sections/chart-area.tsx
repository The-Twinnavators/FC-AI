/**
 * Chart: area. Two series over recent weeks as smooth, overlaid areas that draw themselves in, with glowing end
 * points, a legend, a 4 or 12 week switch and a crosshair that shows each week's numbers on hover or with the arrow
 * keys. Use for a trend on a dashboard or report. Make it the app's own: replace SAMPLE with the app's real series and
 * weeks; keep two or three series at most so the areas stay readable.
 * Adapted from FlowCode's own UI (Branding page).
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

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

export default function ChartArea() {
  const d = SAMPLE;
  const host = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
  const [weeks, setWeeks] = useState(12);
  const [hover, setHover] = useState<number | null>(null);
  const [said, setSaid] = useState("");
  const uid = useId().replace(/:/g, "");

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    setW(el.clientWidth || 720);
    if (!("ResizeObserver" in window)) return;
    const ro = new ResizeObserver(() => host.current && setW(host.current.clientWidth || 720));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const labels = d.weeks.slice(-weeks);
  const series = d.series.map((s) => ({ ...s, values: s.values.slice(-weeks) }));
  const n = labels.length;
  const hasData = n > 0 && series.some((s) => s.values.some((v) => v > 0));

  const rawMax = Math.max(1, ...series.flatMap((s) => s.values));
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

  const describe = (i: number) => `${labels[i]}: ${series.map((s) => `${s.label} ${s.values[i]}`).join(", ")}`;
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
    <section className="fl-section" aria-labelledby="chart-area-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="chart-area-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>

        <div className="fl-dat-panel">
          <div className="fl-dat-chart-head">
            <ul className="fl-dat-list fl-dat-legend" aria-label="Legend">
              {series.map((s) => (
                <li key={s.key}>
                  <span className={`fl-dat-swatch fl-dat-swatch--${s.tone}`} aria-hidden="true" />
                  {s.label}
                  {hasData ? <strong>{s.values[n - 1]}</strong> : null}
                </li>
              ))}
            </ul>
            <div className="fl-toggle" role="group" aria-label="Period">
              {d.periods.map((p) => (
                <button
                  key={p.weeks}
                  type="button"
                  aria-pressed={weeks === p.weeks}
                  onClick={() => {
                    setWeeks(p.weeks);
                    setHover(null);
                    setSaid(`Showing the last ${p.label}.`);
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {hasData ? (
            <>
              <div
                ref={host}
                className="fl-dat-plot"
                tabIndex={0}
                role="group"
                aria-label={`${d.title}, last ${weeks} weeks. Use the arrow keys to read each week.`}
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
                <svg key={`${weeks}`} width="100%" height={HEIGHT} viewBox={`0 0 ${w} ${HEIGHT}`} aria-hidden="true" focusable="false">
                  <defs>
                    {series.map((s) => (
                      <linearGradient key={s.key} id={`fl-dat-a${uid}${s.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" className={`fl-dat-stop-${s.tone}`} stopOpacity="0.36" />
                        <stop offset="100%" className={`fl-dat-stop-${s.tone}`} stopOpacity="0.02" />
                      </linearGradient>
                    ))}
                  </defs>
                  {ticks.map((t) => (
                    <g key={t}>
                      <line className="fl-dat-grid" x1={PAD.l} x2={w - PAD.r} y1={y(t)} y2={y(t)} />
                      <text className="fl-dat-axis" x={PAD.l - 8} y={y(t) + 4} textAnchor="end">
                        {t}
                      </text>
                    </g>
                  ))}
                  {xTicks.map((i, k) => (
                    <text key={i} className="fl-dat-axis" x={x(i)} y={HEIGHT - 8} textAnchor={k === 0 ? "start" : k === xTicks.length - 1 ? "end" : "middle"}>
                      {labels[i]}
                    </text>
                  ))}
                  {series.map((s) => (
                    <g key={s.key}>
                      <path className="fl-dat-area" d={`${path(s.values)} L${x(n - 1)},${PAD.t + ih} L${x(0)},${PAD.t + ih} Z`} fill={`url(#fl-dat-a${uid}${s.key})`} />
                      <path className={`fl-dat-line fl-dat-line--${s.tone}`} d={path(s.values)} pathLength={1} />
                      <circle className={`fl-dat-dot fl-dat-dot--${s.tone}`} cx={x(n - 1)} cy={y(s.values[n - 1] ?? 0)} r={4} />
                    </g>
                  ))}
                  {hover !== null ? (
                    <g pointerEvents="none">
                      <line className="fl-dat-cross" x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} />
                      {series.map((s) => (
                        <circle key={s.key} className={`fl-dat-hit fl-dat-hit--${s.tone}`} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4.5} />
                      ))}
                    </g>
                  ) : null}
                </svg>
                {hover !== null ? (
                  <div className="fl-dat-tip" style={{ left: tipLeft }} aria-hidden="true">
                    <span className="fl-dat-tip-title">Week of {labels[hover]}</span>
                    {series.map((s) => (
                      <span key={s.key} className="fl-dat-tip-row">
                        <span className={`fl-dat-swatch fl-dat-swatch--${s.tone}`} />
                        {s.label}
                        <strong>{s.values[hover]}</strong>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <p className="fl-dat-hint">{d.hint}</p>
              <table className="fl-sr">
                <caption>
                  {d.title}, last {weeks} weeks
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Week of</th>
                    {series.map((s) => (
                      <th key={s.key} scope="col">
                        {s.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {labels.map((l, i) => (
                    <tr key={l}>
                      <th scope="row">{l}</th>
                      {series.map((s) => (
                        <td key={s.key}>{s.values[i]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <div className="fl-dat-empty">
              <strong>{d.empty.title}</strong>
              <p>{d.empty.text}</p>
            </div>
          )}
          <p className="fl-sr" role="status" aria-live="polite">
            {said}
          </p>
        </div>
      </div>
    </section>
  );
}
