/** Motion & data-visual primitives: skeletons, count-up numbers, scroll reveal, parallax, gauges, area charts. */
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function Skeleton({ w = "100%", h = 12, style }: { w?: number | string; h?: number; style?: CSSProperties }) {
  return <span className="skeleton" aria-hidden="true" style={{ display: "block", width: w, height: h, ...style }} />;
}

/** A labelled loading placeholder: several shimmering rows shaped like the content to come. */
export function SkeletonBlock({ rows = 4, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} style={{ display: "grid", gap: 12, padding: 4 }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "28px 1fr 80px", gap: 12, alignItems: "center" }}>
          <Skeleton w={28} h={28} style={{ borderRadius: 8 }} />
          <div style={{ display: "grid", gap: 6 }}>
            <Skeleton w={`${70 - ((i * 13) % 30)}%`} h={12} />
            <Skeleton w={`${45 - ((i * 7) % 20)}%`} h={10} />
          </div>
          <Skeleton w={64} h={18} style={{ borderRadius: 6 }} />
        </div>
      ))}
    </div>
  );
}

/** Counts up to `value` with an ease-out curve. */
export function AnimatedNumber({ value, format = (n: number) => Math.round(n).toLocaleString(), duration = 900 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(reduced() ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reduced()) return setShown(value);
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(a + (value - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span aria-label={format(value)}>{format(shown)}</span>;
}

/** Global scroll-reveal for any element with data-reveal (stagger with style={{"--i": n}}). */
export function useRevealAll() {
  useEffect(() => {
    if (reduced() || !("IntersectionObserver" in window)) {
      document.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
      },
      { threshold: 0.08 },
    );
    const scan = () => document.querySelectorAll("[data-reveal]:not(.is-in)").forEach((el) => io.observe(el));
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
}

/** Publishes the main view's scroll offset as --scroll for parallax layers. */
export function useParallax(selector = "#main") {
  useEffect(() => {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (!el || reduced()) return;
    let raf = 0;
    const on = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        document.documentElement.style.setProperty("--scroll", String(el.scrollTop));
      });
    };
    el.addEventListener("scroll", on, { passive: true });
    return () => el.removeEventListener("scroll", on);
  }, [selector]);
}

export function RadialGauge({ value, size = 64, stroke = 6, color = "url(#gauge-grad)", label }: { value: number; size?: number; stroke?: number; color?: string; label: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [v, setV] = useState(reduced() ? value : 0);
  useEffect(() => {
    const t = setTimeout(() => setV(Math.max(0, Math.min(1, value))), 60);
    return () => clearTimeout(t);
  }, [value]);
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${Math.round(value * 100)}%`} className="gauge">
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3a60c4" />
          <stop offset="60%" stopColor="#5f7fd0" />
          <stop offset="100%" stopColor="var(--sig-ok)" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-3)" strokeWidth={stroke} />
      <circle
        className="gauge__val"
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color === "url(#gauge-grad)" ? `url(#g${id})` : color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - v)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ filter: "drop-shadow(0 0 6px rgba(58, 96, 196,.45))" }}
      />
      <text x="50%" y="54%" textAnchor="middle" fontSize={size * 0.22} fontWeight={600} style={{ fill: "var(--text-0)" }}>
        {Math.round(value * 100)}%
      </text>
    </svg>
  );
}

export interface Series {
  key: string;
  label: string;
  color: string;
  values: number[];
}

/** Overlaid area chart with smooth curves, draw-in animation, grid and a hover crosshair tooltip. */
export function AreaChart({ series, start, end, height = 280, label }: { series: Series[]; start: string; end: string; height?: number; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(900);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    if (!host.current) return;
    // The observer can fire after unmount (page transition); ignore it then.
    const ro = new ResizeObserver(() => host.current && setW(host.current.clientWidth));
    ro.observe(host.current);
    setW(host.current.clientWidth);
    return () => ro.disconnect();
  }, []);
  const n = Math.max(1, series[0]?.values.length ?? 1);
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const pad = { l: 40, r: 14, t: 12, b: 28 };
  const iw = Math.max(10, w - pad.l - pad.r);
  const ih = height - pad.t - pad.b;
  const x = (i: number) => pad.l + (i / Math.max(1, n - 1)) * iw;
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const path = (vals: number[]) => {
    let d = `M${x(0)},${y(vals[0] ?? 0)}`;
    for (let i = 1; i < vals.length; i++) {
      const x0 = x(i - 1);
      const x1 = x(i);
      const cx = (x0 + x1) / 2;
      d += ` C${cx},${y(vals[i - 1])} ${cx},${y(vals[i])} ${x1},${y(vals[i])}`;
    }
    return d;
  };
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  const t0 = new Date(start).getTime();
  const t1 = new Date(end).getTime();
  const dateAt = (i: number) => new Date(t0 + ((t1 - t0) * i) / Math.max(1, n - 1));
  const fmt = (d: Date) => (t1 - t0 > 3 * 86_400_000 ? d.toLocaleDateString([], { month: "short", day: "numeric" }) : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  const uid = useId().replace(/:/g, "");
  const key = useMemo(() => series.map((s) => s.values.join(",")).join("|"), [series]);
  return (
    <div ref={host} style={{ position: "relative" }}>
      <svg
        key={key}
        className="chart-svg"
        width="100%"
        height={height}
        viewBox={`0 0 ${w} ${height}`}
        role="img"
        aria-label={`${label}. ${series.map((s) => `${s.label}: ${s.values.at(-1) ?? 0}`).join(", ")}`}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const i = Math.round(((e.clientX - rect.left - pad.l) / iw) * (n - 1));
          setHover(i >= 0 && i < n ? i : null);
        }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`a${uid}${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.38" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray="2 4" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="10.5" style={{ fill: "var(--text-2)" }}>
              {t}
            </text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const i = Math.round(f * (n - 1));
          return (
            <text key={f} x={x(i)} y={height - 8} textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"} fontSize="10.5" style={{ fill: "var(--text-2)" }}>
              {f === 1 ? "Now" : fmt(dateAt(i))}
            </text>
          );
        })}
        {series.map((s) => (
          <g key={s.key}>
            <path className="area-fill" d={`${path(s.values)} L${x(n - 1)},${pad.t + ih} L${x(0)},${pad.t + ih} Z`} fill={`url(#a${uid}${s.key})`} />
            <path className="area-line" d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} style={{ filter: `drop-shadow(0 0 6px ${s.color}66)` }} />
            <circle cx={x(n - 1)} cy={y(s.values.at(-1) ?? 0)} r={4} fill={s.color} style={{ filter: `drop-shadow(0 0 8px ${s.color})` }} />
          </g>
        ))}
        {hover !== null ? (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="var(--line-strong)" />
            {series.map((s) => (
              <circle key={s.key} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4} fill={s.color} stroke="var(--solid-2)" strokeWidth={2} />
            ))}
          </g>
        ) : null}
      </svg>
      {hover !== null ? (
        <div
          className="toast"
          style={{ position: "absolute", top: 8, left: Math.min(x(hover) + 12, w - 190), padding: "8px 10px", pointerEvents: "none", fontSize: 12, minWidth: 170 }}
        >
          <div className="label" style={{ marginBottom: 4 }}>
            {fmt(dateAt(hover))}
          </div>
          {series.map((s) => (
            <div key={s.key} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="dot" style={{ background: s.color, color: s.color }} /> {s.label}
              <strong style={{ marginLeft: "auto" }}>{s.values[hover] ?? 0}</strong>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
