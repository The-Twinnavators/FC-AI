/** @flowcode-library chart-zoom · Zoomable chart (Charts and data)
 * Catalog ID: p.zoom-chart (pattern)
 * Function: A trend chart you zoom into: drag across it to zoom to that stretch, drag or key the brush on the overview strip to pan and resize the window, jump with 7, 30 or 90-day presets, and the scale refits to what is shown.
 * Use it as: import { ZoomChart } from "./chart-zoom"; <ZoomChart title="Visitors and sign-ups" labels={["2026-07-23", ...]} series={[{ name: "Visitors", points: [1204, ...], tone?: "accent"|"secondary" }]} initial?={{ from: 60, to: 89 }} minSpan?={4} presets?={[{ label: "7D", days: 7 }]} formatY?={(n) => string} formatX?={(label) => string} locale? text?={{ zoomIn, zoomOut, reset, range, brush, start, end, chart, data, presets }} onRangeChange?={({ from, to }) => ...} />
 * Built from: c.segmented.toggle, c.button.tertiary
 * Look: A white card with a title, a legend with each series' total for the window and 7D/30D/90D pills; overlaid soft areas with a crosshair and a small readout, and under them a slim overview of the whole period with a bright window and two grips that slide; the chart glides to each new window.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-secondary --surface-radius --radius-sm --space-2 --space-3 --space-4 --text-xs --text-sm --font-sans --duration-base --duration-slow --ease-out --focus-ring
 * Use cases: analytics dashboard; traffic over time; sales trend; usage history; server metrics; price history; habit tracker history
 * Jobs to be done: look closely at one stretch of time; compare a week to the whole quarter; find when a spike started; read the exact value on a day
 * Keywords: zoomable chart, area chart, brush, range selector, time series, zoom, pan, trend, analytics
 */
/**
 * Zoom chart: a long time series is unreadable at full length and misleading when cut short, so this shows both. The
 * big chart shows a window; the strip under it shows the whole period with that window marked. Drag across the big
 * chart to zoom into a stretch; drag the window on the strip to pan it, or its grips to widen or narrow it; click the
 * strip to center the window there. The vertical scale refits to the window, so a quiet week is not a flat line.
 * From the keyboard: the chart takes Left and Right to read day by day, + and - to zoom around that day; the window
 * and each grip are sliders (arrows a day, Page Up and Page Down a week, Home and End to the ends). Each new window is
 * said in words, and a hidden table holds the numbers.
 * Make it the app's own: pass the app's own dates and series; keep it to two or three series.
 * Adapted from TailGrids (MIT, Copyright (c) 2025 Tailgrids): its zoomable area chart example (drag a reference area
 * to zoom, refit the axis, zoom out), rewritten without its chart dependency, with a brush added.
 */
/**
 * How to try it
 * - Drag across the big chart from left to right: it zooms to that stretch.
 * - Drag the bright window on the strip below to pan; drag a grip to resize it.
 * - Press 7D, 30D or 90D; press Zoom out or Reset.
 * - Tab to the chart, press Left and Right to read days, + and - to zoom.
 * - Tab to the window or a grip and use the arrow keys.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useMemo, useRef, useState), the library's Button
 * ("./buttons-variants") and Segmented ("./segmented-control"). Nothing else — no chart package and nothing fetched
 * at run time. The styles are the library's own fl- classes in templates/library/css, and the sample data is in the
 * file, so the piece runs in a built app exactly as it runs here.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "./buttons-variants";
import { Segmented } from "./segmented-control";

// ── p.zoom-chart: a window on a long series, with a brush on an overview strip. ──

export type ZoomSeries = { name: string; points: number[]; tone?: "accent" | "secondary" };
type Win = { from: number; to: number };
type ZoomLabels = { zoomIn: string; zoomOut: string; reset: string; range: string; brush: string; start: string; end: string; chart: string; data: string; presets: string };

const LABELS: ZoomLabels = {
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  reset: "Reset",
  range: "{from} – {to} · {days} days",
  brush: "Visible window",
  start: "Window start",
  end: "Window end",
  chart: "Chart. Left and Right read days; plus and minus zoom.",
  data: "Numbers for the visible days",
  presets: "Period",
};

const PAD = { l: 48, r: 12, t: 14, b: 28 };
const H = 240;
const OH = 52;

const motionOff = () =>
  typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off";

function nice(lo: number, hi: number) {
  const span = hi - lo || Math.abs(hi) || 1;
  const step0 = span / 4;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? 10 * mag;
  const a = Math.floor(lo / step) * step;
  const b = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = a; v <= b + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { lo: a, hi: b, ticks };
}

export function ZoomChart({
  title,
  labels: xs,
  series,
  initial,
  minSpan = 4,
  presets = [
    { label: "7D", days: 7 },
    { label: "30D", days: 30 },
    { label: "90D", days: 90 },
  ],
  formatY,
  formatX,
  locale,
  text,
  onRangeChange,
  className,
}: {
  title: string;
  /** One label per point: ISO dates ("2026-10-20") are shown as short dates. */
  labels: string[];
  series: ZoomSeries[];
  /** First and last visible index. */
  initial?: Win;
  /** The narrowest window, in steps. */
  minSpan?: number;
  presets?: Array<{ label: string; days: number }>;
  formatY?: (n: number) => string;
  formatX?: (label: string) => string;
  locale?: string;
  text?: Partial<ZoomLabels>;
  onRangeChange?: (w: Win) => void;
  className?: string;
}) {
  const L = { ...LABELS, ...text };
  const uid = useId().replace(/:/g, "");
  const n = xs.length;
  const last = n - 1;
  const span0 = Math.min(minSpan, last);
  const fullWin = { from: 0, to: last };
  const [win, setWin] = useState<Win>(initial ?? fullWin);
  const [view, setView] = useState<Win>(initial ?? fullWin);
  const [hover, setHover] = useState<number | null>(null);
  const [sel, setSel] = useState<{ a: number; b: number } | null>(null);
  const [said, setSaid] = useState("");
  const [w, setW] = useState(640);
  const box = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  const fmtNum = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const fy = formatY ?? ((v: number) => fmtNum.format(v));
  const fmtDate = useMemo(() => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }), [locale]);
  const fx = formatX ?? ((s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? fmtDate.format(new Date(`${s}T00:00:00Z`)) : s));

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The window glides to its new place (and the scale with it); instant when motion is off.
  useEffect(() => {
    const from = viewRef.current;
    if (from.from === win.from && from.to === win.to) return;
    if (motionOff()) return setView(win);
    const css = getComputedStyle(box.current ?? document.documentElement).getPropertyValue("--duration-slow").trim();
    const dur = css.endsWith("ms") ? parseFloat(css) : css.endsWith("s") ? parseFloat(css) * 1000 : 360;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / (dur || 360));
      const e = 1 - (1 - k) ** 3;
      setView({ from: from.from + (win.from - from.from) * e, to: from.to + (win.to - from.to) * e });
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [win.from, win.to]);

  const apply = (next: Win, announce = true) => {
    let { from, to } = next;
    from = Math.round(from);
    to = Math.round(to);
    if (to - from < span0) {
      const mid = (from + to) / 2;
      from = Math.round(mid - span0 / 2);
      to = from + span0;
    }
    if (from < 0) (to -= from, (from = 0));
    if (to > last) (from -= to - last, (to = last));
    from = Math.max(0, from);
    const w2 = { from, to };
    setWin(w2);
    onRangeChange?.(w2);
    if (announce) setSaid(L.range.replace("{from}", fx(xs[from]!)).replace("{to}", fx(xs[to]!)).replace("{days}", String(to - from + 1)));
  };
  const zoom = (factor: number, around?: number) => {
    const c = around ?? (win.from + win.to) / 2;
    const half = ((win.to - win.from) * factor) / 2;
    apply({ from: c - half, to: c + half });
  };

  // Scale for the window shown.
  const a = view.from;
  const b = Math.max(view.to, a + 0.0001);
  const i0 = Math.max(0, Math.floor(a));
  const i1 = Math.min(last, Math.ceil(b));
  let lo = Infinity;
  let hi = -Infinity;
  for (const s of series) for (let i = i0; i <= i1; i++) (lo = Math.min(lo, s.points[i]!), (hi = Math.max(hi, s.points[i]!)));
  if (!isFinite(lo)) (lo = 0, (hi = 1));
  const padY = (hi - lo) * 0.12 || 1;
  const scale = nice(lo >= 0 ? Math.max(0, lo - padY) : lo - padY, hi + padY);
  const pw = w - PAD.l - PAD.r;
  const ph = H - PAD.t - PAD.b;
  const X = (i: number) => PAD.l + ((i - a) / (b - a)) * pw;
  const Y = (v: number) => PAD.t + (1 - (v - scale.lo) / (scale.hi - scale.lo || 1)) * ph;
  const idxAt = (px: number) => a + ((px - PAD.l) / pw) * (b - a);
  const lineOf = (pts: number[], y: (v: number) => number, x: (i: number) => number) => pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const xTicks = useMemo(() => {
    const count = Math.max(2, Math.min(7, Math.floor(pw / 90)));
    const out: number[] = [];
    for (let k = 0; k < count; k++) out.push(Math.round(win.from + ((win.to - win.from) * k) / (count - 1)));
    return [...new Set(out)];
  }, [win.from, win.to, pw]);

  // Overview strip: the whole period.
  const OX = (i: number) => (i / (last || 1)) * w;
  let olo = Infinity;
  let ohi = -Infinity;
  for (const v of series[0]?.points ?? []) (olo = Math.min(olo, v), (ohi = Math.max(ohi, v)));
  const OY = (v: number) => 4 + (1 - (v - Math.min(0, olo)) / (ohi - Math.min(0, olo) || 1)) * (OH - 8);

  // Drag across the big chart to zoom to that stretch.
  const plot = useRef<SVGSVGElement>(null);
  const localX = (e: ReactPointerEvent) => e.clientX - (plot.current?.getBoundingClientRect().left ?? 0);
  const onPlotDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const i = idxAt(localX(e));
    setSel({ a: i, b: i });
  };
  const onPlotMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const i = Math.max(a, Math.min(b, idxAt(localX(e))));
    if (sel) setSel({ ...sel, b: i });
    setHover(Math.round(i));
  };
  const onPlotUp = () => {
    if (sel && Math.abs(sel.b - sel.a) >= 1) apply({ from: Math.min(sel.a, sel.b), to: Math.max(sel.a, sel.b) });
    setSel(null);
  };
  const onPlotKey = (e: ReactKeyboardEvent) => {
    const cur = hover ?? Math.round((win.from + win.to) / 2);
    const k = e.key;
    if (k === "ArrowLeft" || k === "ArrowRight") {
      e.preventDefault();
      const nx = Math.max(0, Math.min(last, cur + (k === "ArrowLeft" ? -1 : 1)));
      setHover(nx);
      if (nx < win.from || nx > win.to) apply({ from: win.from + (nx - cur), to: win.to + (nx - cur) }, false);
      setSaid(readout(nx));
    } else if (k === "+" || k === "=") (e.preventDefault(), zoom(0.5, cur));
    else if (k === "-" || k === "_") (e.preventDefault(), zoom(2, cur));
    else if (k === "Escape") setHover(null);
  };
  const readout = (i: number) => `${fx(xs[i]!)}: ${series.map((s) => `${s.name} ${fy(s.points[i]!)}`).join(", ")}`;

  // Brush: pan by the window, resize by the grips.
  const strip = useRef<HTMLDivElement>(null);
  const drag = useRef<{ kind: "body" | "start" | "end"; x: number; win: Win } | null>(null);
  const perPx = () => last / (strip.current?.getBoundingClientRect().width || w);
  const onBrushDown = (kind: "body" | "start" | "end") => (e: ReactPointerEvent<HTMLElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { kind, x: e.clientX, win };
  };
  const onBrushMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const di = (e.clientX - d.x) * perPx();
    if (d.kind === "body") {
      const span = d.win.to - d.win.from;
      const from = Math.max(0, Math.min(last - span, d.win.from + di));
      apply({ from, to: from + span }, false);
    } else if (d.kind === "start") apply({ from: Math.min(d.win.from + di, d.win.to - span0), to: d.win.to }, false);
    else apply({ from: d.win.from, to: Math.max(d.win.to + di, d.win.from + span0) }, false);
  };
  const onBrushUp = () => {
    if (drag.current) apply(win);
    drag.current = null;
  };
  const sliderKey = (kind: "body" | "start" | "end") => (e: ReactKeyboardEvent) => {
    const step = e.key === "PageUp" || e.key === "PageDown" ? 7 : 1;
    const dir = e.key === "ArrowLeft" || e.key === "ArrowDown" || e.key === "PageDown" ? -1 : e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "PageUp" ? 1 : 0;
    const span = win.to - win.from;
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const toStart = e.key === "Home";
      if (kind === "body") return apply(toStart ? { from: 0, to: span } : { from: last - span, to: last });
      if (kind === "start") return apply({ from: toStart ? 0 : win.to - span0, to: win.to });
      return apply({ from: win.from, to: toStart ? win.from + span0 : last });
    }
    if (!dir) return;
    e.preventDefault();
    const d = dir * step;
    if (kind === "body") {
      const from = Math.max(0, Math.min(last - span, win.from + d));
      apply({ from, to: from + span });
    } else if (kind === "start") apply({ from: Math.max(0, Math.min(win.to - span0, win.from + d)), to: win.to });
    else apply({ from: win.from, to: Math.min(last, Math.max(win.from + span0, win.to + d)) });
  };
  const onStripDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const c = ((e.clientX - r.left) / r.width) * last;
    const half = (win.to - win.from) / 2;
    apply({ from: c - half, to: c + half });
  };

  const preset = presets.find((p) => win.to === last && win.to - win.from + 1 === Math.min(p.days, n))?.label ?? "";
  const totals = series.map((s) => s.points.slice(win.from, win.to + 1).reduce((t, v) => t + v, 0));
  const hv = hover !== null && hover >= Math.ceil(a) && hover <= Math.floor(b) ? hover : null;
  const isFull = win.from === 0 && win.to === last;
  const pct = (i: number) => `${(i / (last || 1)) * 100}%`;
  const valueText = (i: number) => fx(xs[Math.round(i)]!);

  return (
    <figure className={["fl-zch", className ?? ""].filter(Boolean).join(" ")} data-fl="p.zoom-chart" aria-labelledby={`${uid}-t`}>
      <div className="fl-zch-top">
        <div className="fl-zch-titles">
          <figcaption id={`${uid}-t`} className="fl-zch-title">
            {title}
          </figcaption>
          <p className="fl-zch-range">{L.range.replace("{from}", fx(xs[win.from]!)).replace("{to}", fx(xs[win.to]!)).replace("{days}", String(win.to - win.from + 1))}</p>
        </div>
        <Segmented
          variant="toggle"
          size="sm"
          label={L.presets}
          options={presets.map((p) => ({ value: p.label, label: p.label }))}
          value={preset}
          onChange={(v) => {
            const p = presets.find((x) => x.label === v);
            if (p) apply({ from: Math.max(0, last - p.days + 1), to: last });
          }}
        />
      </div>
      <ul className="fl-zch-legend">
        {series.map((s, k) => (
          <li key={s.name} className={`fl-zch-key fl-zch-key--${s.tone ?? (k ? "secondary" : "accent")}`}>
            <span className="fl-zch-swatch" aria-hidden="true" />
            {s.name}
            <strong>{fy(totals[k]!)}</strong>
          </li>
        ))}
      </ul>
      <div ref={box} className="fl-zch-plotwrap">
        <svg
          ref={plot}
          className={`fl-zch-plot${sel ? " is-selecting" : ""}`}
          width={w}
          height={H}
          viewBox={`0 0 ${w} ${H}`}
          tabIndex={0}
          role="img"
          aria-label={`${title}. ${L.chart}`}
          aria-describedby={`${uid}-said`}
          onPointerDown={onPlotDown}
          onPointerMove={onPlotMove}
          onPointerUp={onPlotUp}
          onPointerCancel={() => setSel(null)}
          onPointerLeave={() => !sel && setHover(null)}
          onKeyDown={onPlotKey}
        >
          <defs>
            <clipPath id={`${uid}-clip`}>
              <rect x={PAD.l} y={0} width={pw} height={H} />
            </clipPath>
            {series.map((s, k) => (
              <linearGradient key={s.name} id={`${uid}-g${k}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" className={`fl-zch-stop fl-zch-stop--${s.tone ?? (k ? "secondary" : "accent")}`} stopOpacity="0.28" />
                <stop offset="1" className={`fl-zch-stop fl-zch-stop--${s.tone ?? (k ? "secondary" : "accent")}`} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {scale.ticks.map((t) => (
            <g key={t} className="fl-zch-grid">
              <line x1={PAD.l} x2={w - PAD.r} y1={Y(t)} y2={Y(t)} />
              <text x={PAD.l - 8} y={Y(t)} dy="0.32em" textAnchor="end">
                {fy(t)}
              </text>
            </g>
          ))}
          {xTicks.map((i) => (
            <text key={i} className="fl-zch-xlab" x={Math.max(PAD.l + 14, Math.min(w - PAD.r - 14, X(i)))} y={H - 8} textAnchor="middle">
              {fx(xs[i]!)}
            </text>
          ))}
          <g clipPath={`url(#${uid}-clip)`}>
            {series.map((s, k) => {
              const line = lineOf(s.points, Y, X);
              const tone = s.tone ?? (k ? "secondary" : "accent");
              return (
                <g key={s.name}>
                  <path className="fl-zch-area" d={`${line}L${X(last).toFixed(1)},${PAD.t + ph}L${X(0).toFixed(1)},${PAD.t + ph}Z`} fill={`url(#${uid}-g${k})`} />
                  <path className={`fl-zch-line fl-zch-line--${tone}`} d={line} />
                </g>
              );
            })}
            {sel ? <rect className="fl-zch-sel" x={X(Math.min(sel.a, sel.b))} y={PAD.t} width={Math.abs(X(sel.b) - X(sel.a))} height={ph} /> : null}
            {hv !== null ? (
              <g className="fl-zch-cross">
                <line x1={X(hv)} x2={X(hv)} y1={PAD.t} y2={PAD.t + ph} />
                {series.map((s, k) => (
                  <circle key={s.name} className={`fl-zch-dot fl-zch-dot--${s.tone ?? (k ? "secondary" : "accent")}`} cx={X(hv)} cy={Y(s.points[hv]!)} r={4} />
                ))}
              </g>
            ) : null}
          </g>
        </svg>
        {hv !== null ? (
          <div className="fl-zch-tip" style={{ left: `${Math.min(Math.max(X(hv), 90), w - 90)}px` }} aria-hidden="true">
            <span className="fl-zch-tip-date">{fx(xs[hv]!)}</span>
            {series.map((s, k) => (
              <span key={s.name} className={`fl-zch-tip-row fl-zch-key--${s.tone ?? (k ? "secondary" : "accent")}`}>
                <span className="fl-zch-swatch" />
                {s.name} <strong>{fy(s.points[hv]!)}</strong>
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div ref={strip} className="fl-zch-strip" onPointerDown={onStripDown} onPointerMove={onBrushMove} onPointerUp={onBrushUp} onPointerCancel={onBrushUp}>
        <svg className="fl-zch-mini" width="100%" height={OH} viewBox={`0 0 ${w} ${OH}`} preserveAspectRatio="none" aria-hidden="true">
          {series[0] ? <path className="fl-zch-mini-area" d={`${lineOf(series[0].points, OY, OX)}L${w},${OH}L0,${OH}Z`} /> : null}
        </svg>
        <div className="fl-zch-shade" style={{ left: 0, width: pct(view.from) }} />
        <div className="fl-zch-shade" style={{ left: pct(view.to), right: 0 }} />
        <div
          className="fl-zch-win"
          style={{ left: pct(view.from), width: `calc(${pct(view.to)} - ${pct(view.from)})` }}
          role="slider"
          tabIndex={0}
          aria-label={L.brush}
          aria-valuemin={0}
          aria-valuemax={last - (win.to - win.from)}
          aria-valuenow={win.from}
          aria-valuetext={`${valueText(win.from)} to ${valueText(win.to)}`}
          onPointerDown={onBrushDown("body")}
          onKeyDown={sliderKey("body")}
        />
        <div
          className="fl-zch-grip"
          style={{ left: pct(view.from) }}
          role="slider"
          tabIndex={0}
          aria-label={L.start}
          aria-valuemin={0}
          aria-valuemax={win.to - span0}
          aria-valuenow={win.from}
          aria-valuetext={valueText(win.from)}
          onPointerDown={onBrushDown("start")}
          onKeyDown={sliderKey("start")}
        />
        <div
          className="fl-zch-grip"
          style={{ left: pct(view.to) }}
          role="slider"
          tabIndex={0}
          aria-label={L.end}
          aria-valuemin={win.from + span0}
          aria-valuemax={last}
          aria-valuenow={win.to}
          aria-valuetext={valueText(win.to)}
          onPointerDown={onBrushDown("end")}
          onKeyDown={sliderKey("end")}
        />
      </div>
      <div className="fl-zch-foot">
        <p id={`${uid}-said`} className="fl-zch-said" role="status">
          {said}
        </p>
        <div className="fl-zch-acts">
          <Button variant="tertiary" size={32} disabled={win.to - win.from <= span0} onClick={() => zoom(0.5, hv ?? undefined)}>
            {L.zoomIn}
          </Button>
          <Button variant="tertiary" size={32} disabled={isFull} onClick={() => zoom(2, hv ?? undefined)}>
            {L.zoomOut}
          </Button>
          <Button variant="tertiary" size={32} icon="refresh" disabled={isFull} onClick={() => apply(fullWin)}>
            {L.reset}
          </Button>
        </div>
      </div>
      <table className="fl-zch-sr">
        <caption>{L.data}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            {series.map((s) => (
              <th key={s.name} scope="col">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {xs.slice(win.from, win.to + 1).map((x, k) => (
            <tr key={x}>
              <th scope="row">{fx(x)}</th>
              {series.map((s) => (
                <td key={s.name}>{fy(s.points[win.from + k]!)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

// ── The reference sheet: 90 days of a shop's visitors and sign-ups. ──

// A steady made-up series: a weekly rhythm, slow growth and a spring sale spike, the same on every load.
const days = (end: string, count: number) => Array.from({ length: count }, (_, i) => new Date(Date.parse(`${end}T00:00:00Z`) - (count - 1 - i) * 864e5).toISOString().slice(0, 10));
const wave = (count: number, base: number, growth: number, seed: number, spikeAt: number, spike: number) =>
  Array.from({ length: count }, (_, i) => {
    const r = Math.sin((i + 1) * 12.9898 * seed) * 43758.5453;
    const noise = (r - Math.floor(r) - 0.5) * 0.18;
    const week = [0.86, 1, 1.04, 1.02, 0.98, 1.12, 0.92][i % 7]!;
    const bump = Math.exp(-((i - spikeAt) ** 2) / 6) * spike;
    return Math.round(base * (1 + (growth * i) / count) * week * (1 + noise) * (1 + bump));
  });

// flowcode:sample
const SAMPLE = {
  eyebrow: "Analytics",
  title: "Zoom into a stretch",
  lede: "Drag across the chart, or move the window below it.",
  chartTitle: "Visitors and sign-ups",
  labels: days("2026-10-20", 90),
  series: [
    { name: "Visitors", points: wave(90, 1180, 0.45, 1, 61, 1.1), tone: "accent" as const },
    { name: "Sign-ups", points: wave(90, 260, 0.6, 2.3, 62, 1.4), tone: "secondary" as const },
  ],
};

export default function ChartZoomPreview() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--canvas" aria-labelledby="chart-zoom-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="chart-zoom-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <ZoomChart title={d.chartTitle} labels={d.labels} series={d.series} initial={{ from: 60, to: 89 }} />
      </div>
    </section>
  );
}
