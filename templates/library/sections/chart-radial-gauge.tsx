/** @flowcode-library chart-radial-gauge · Radial gauges (Charts and data)
 * Catalog ID: c.gauge (component)
 * Function: The gauge (c.gauge): one radial progress ring in three sizes; the reference sheet shows three rings with notes and buttons to nudge each value.
 * Use it as: import { Gauge } from "./chart-radial-gauge"; <Gauge value={72} max?={100} label="Completion" tone?="gradient"|"accent"|"success" size?="sm"|"md"|"lg" />
 * Look: A ring that fills clockwise from the top to value/max with a soft gradient glow and the percentage in the middle; it is an image named by its label and percentage.
 * Tokens: --color-accent --color-success --color-surface-sunken --color-text --font-sans --text-md --text-lg --text-xl --weight-semibold --duration-base --easing
 * Use cases: goal progress; completion rate; storage usage; fitness goals; budget used; project progress; score display; health metrics
 * Jobs to be done: see how close i am to a goal; check how much is used up; track progress at a glance
 * Keywords: gauge, progress, ring, percentage, chart
 */
/**
 * Chart: radial gauges. Three rings of different sizes that fill to a percentage with a soft glow, each with a label,
 * a short note and buttons to nudge the value. Use for progress toward a goal, a pass rate or readiness on a dashboard.
 * Make it the app's own: replace SAMPLE with the app's real measures and how each note reads; keep the biggest ring
 * for the measure that matters most.
 * Adapted from FlowCode's own UI (Branding page).
 */
import { useEffect, useId, useState } from "react";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Spring term",
  title: "Getting the new timetable ready",
  lede: "How close the studio is to opening bookings for the spring term.",
  step: 5,
  reset: "Back to today's figures",
  gauges: [
    { id: "completion", label: "Completion", size: "lg", value: 72, total: 25, note: "{done} of {total} classes scheduled" },
    { id: "pass", label: "Pass rate", size: "md", value: 88, total: 40, note: "{done} of {total} safety checks passed" },
    { id: "ready", label: "Ready", size: "sm", value: 45, total: 12, note: "{done} of {total} teachers confirmed" },
  ],
  done: "All done",
  notStarted: "Not started yet",
};

export type GaugeSize = "sm" | "md" | "lg";
export type GaugeTone = "gradient" | "accent" | "success";
type Size = GaugeSize;

const VIEW = 100;
const STROKE: Record<Size, number> = { sm: 10, md: 9, lg: 8 };
const SIZE_CLASS: Record<Size, string> = { sm: "fl-dat-gauge--sm", md: "fl-dat-gauge--md", lg: "fl-dat-gauge--lg" };
// Three gradient stops per tone: the default runs from the accent to the success color.
const STOPS: Record<GaugeTone, [string, string, string]> = {
  gradient: ["fl-dat-stop-accent", "fl-dat-stop-mid", "fl-dat-stop-success"],
  accent: ["fl-dat-stop-accent", "fl-dat-stop-accent", "fl-dat-stop-accent"],
  success: ["fl-dat-stop-success", "fl-dat-stop-success", "fl-dat-stop-success"],
};

function useReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const m = window.matchMedia?.(query);
    if (!m) return;
    const on = () => setReduced(m.matches);
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/**
 * c.gauge: one ring that fills from the top, clockwise, to value / max, with the percentage in the middle. The fill
 * animates in and on change (reduced motion jumps). It is an image with the label and percentage as its name.
 */
export function Gauge({ value, max = 100, label, tone = "gradient", size = "md", className }: {
  value: number;
  max?: number;
  label: string;
  tone?: GaugeTone;
  size?: GaugeSize;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const stroke = STROKE[size];
  const r = (VIEW - stroke) / 2;
  const c = 2 * Math.PI * r;
  const target = pct / 100;
  // Start empty, then fill on the next tick so the ring animates in; changes animate through the CSS transition.
  const [shown, setShown] = useState(reduced ? target : 0);
  useEffect(() => {
    if (reduced) return setShown(target);
    const t = window.setTimeout(() => setShown(target), 60);
    return () => window.clearTimeout(t);
  }, [target, reduced]);
  const id = `fl-dat-g${useId().replace(/:/g, "")}`;
  const [s0, s1, s2] = STOPS[tone];
  return (
    <div
      className={["fl-dat-gauge", SIZE_CLASS[size], className].filter(Boolean).join(" ")}
      role="img"
      aria-label={`${label}: ${Math.round(pct)}%`}
      data-fl="c.gauge"
    >
      <svg viewBox={`0 0 ${VIEW} ${VIEW}`} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" className={s0} />
            <stop offset="60%" className={s1} />
            <stop offset="100%" className={s2} />
          </linearGradient>
        </defs>
        <circle className="fl-dat-gauge-track" cx={VIEW / 2} cy={VIEW / 2} r={r} strokeWidth={stroke} />
        <circle
          className="fl-dat-gauge-value"
          cx={VIEW / 2}
          cy={VIEW / 2}
          r={r}
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown)}
          transform={`rotate(-90 ${VIEW / 2} ${VIEW / 2})`}
          opacity={pct <= 0 ? 0 : 1}
        />
      </svg>
      <span className="fl-dat-gauge-num" aria-hidden="true">
        {Math.round(pct)}%
      </span>
    </div>
  );
}

const noteFor = (note: string, value: number, total: number) =>
  note.replace("{done}", String(Math.round((value / 100) * total))).replace("{total}", String(total));

const initial = () => Object.fromEntries(SAMPLE.gauges.map((g) => [g.id, g.value])) as Record<string, number>;

export default function ChartRadialGauge() {
  const d = SAMPLE;
  const [values, setValues] = useState<Record<string, number>>(initial);
  const [status, setStatus] = useState("");

  const change = (id: string, label: string, by: number) => {
    const next = Math.max(0, Math.min(100, (values[id] ?? 0) + by));
    setValues({ ...values, [id]: next });
    setStatus(next === 100 ? `${label} is at 100%. ${SAMPLE.done}.` : `${label} is now ${next}%.`);
  };
  const changed = d.gauges.some((g) => values[g.id] !== g.value);

  return (
    <section className="fl-section fl-section--tint" aria-labelledby="chart-radial-gauge-title">
      <div className="fl-wrap">
        <div className="fl-dat-bar">
          <div className="fl-head">
            <p className="fl-eyebrow">{d.eyebrow}</p>
            <h2 id="chart-radial-gauge-title" className="fl-title">
              {d.title}
            </h2>
            <p className="fl-lede">{d.lede}</p>
          </div>
          <button
            type="button"
            className="fl-btn fl-btn--secondary"
            disabled={!changed}
            onClick={() => {
              setValues(initial());
              setStatus("Gauges set back to today's figures.");
            }}
          >
            {d.reset}
          </button>
        </div>

        <ul className="fl-dat-list fl-dat-gauges">
          {d.gauges.map((g) => {
            const v = values[g.id] ?? 0;
            return (
              <li key={g.id} className="fl-card fl-dat-gauge-card">
                <Gauge value={v} label={g.label} size={g.size as Size} />
                <h3 className="fl-dat-gauge-label">{g.label}</h3>
                <p className="fl-dat-gauge-note">{v === 100 ? d.done : v === 0 ? d.notStarted : noteFor(g.note, v, g.total)}</p>
                <div className="fl-dat-stepper" role="group" aria-label={`Change ${g.label}`}>
                  <button type="button" className="fl-dat-iconbtn" aria-label={`Lower ${g.label} by ${d.step}%`} disabled={v <= 0} onClick={() => change(g.id, g.label, -d.step)}>
                    <span aria-hidden="true">−</span>
                  </button>
                  <button type="button" className="fl-dat-iconbtn" aria-label={`Raise ${g.label} by ${d.step}%`} disabled={v >= 100} onClick={() => change(g.id, g.label, d.step)}>
                    <span aria-hidden="true">+</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="fl-dat-status" role="status" aria-live="polite" style={{ marginTop: "var(--space-4)" }}>
          {status}
        </p>
      </div>
    </section>
  );
}
