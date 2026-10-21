/** @flowcode-library chart-funnel · Conversion funnel (Charts and data)
 * Catalog ID: p.funnel-chart (pattern)
 * Function: A conversion funnel: one centered bar per step narrowing with the people left, how many dropped between steps with the biggest drop flagged, a switch between share of start and step-to-step rates, a period switch, and a step you pick explained in a sentence.
 * Use it as: import { FunnelChart } from "./chart-funnel"; <FunnelChart title="Checkout funnel" steps={[{ id: "visit", label: "Visited" }, { id: "cart", label: "Added to cart" }]} periods={[{ id: "week", label: "This week", counts: [12400, 3100] }]} defaultPeriod?="week" onPeriodChange?={(id) => ...} loading?={false} unit?="people" format?={(n) => string} locale? labels?={{ period, mode, ofStart, ofPrevious, overall, dropped, biggest, empty, loading, data, pick }} />
 * Built from: c.segmented.toggle, c.segmented.segmented, c.badge.status
 * Look: A white card with a title, a period switch and a large overall conversion figure; a stack of rows, each with the step name, its count and percentage over a centered accent bar that gets narrower down the stack, a small muted "dropped" line between rows (the largest one with a warning pill), and a sentence under the chart for the picked step.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-warning --color-danger --surface-radius --radius-sm --space-1 --space-2 --space-3 --space-4 --space-5 --text-xs --text-sm --text-md --text-2xl --font-sans --font-display --duration-fast --duration-slow --ease-out --stagger --focus-ring
 * Use cases: checkout funnel; sign-up funnel; sales pipeline; onboarding completion; marketing conversion; hiring pipeline; trial to paid
 * Jobs to be done: see where people drop off; find the step that loses the most; compare conversion this week and last; explain a step's numbers to the team
 * Keywords: funnel, conversion, drop-off, pipeline, steps, checkout, sign-up, analytics
 */
/**
 * Conversion funnel: a fixed list of steps people pass through, with how many reached each. Every bar is that step's
 * count against the first step's, centered so the stack reads as a funnel. Between two steps a quiet line says how many
 * were lost and what share that is; the step that loses the most gets a warning pill. The rate beside each step is its
 * share of everyone who started, or (switch to Step to step) its share of the step before.
 * Each row is a button: click it (or Tab to the list and press Up and Down, Home and End) to explain that step in a
 * sentence under the chart, which is also said. Bars grow in once when the chart comes into view and slide to their new
 * widths when the period changes; counts count up. A hidden table holds every number.
 * Loading shows gray rows; a period where nobody started says so.
 * Make it the app's own: pass the app's own steps (in order) and counts per period; three to six steps read best.
 * Adapted from TailAdmin (MIT, Copyright (c) 2023 TailAdmin): its dashboard chart card (a titled card with a
 * period menu over a chart and a headline figure), rewritten as a funnel without its chart dependency.
 */
/**
 * How to try it
 * - Switch This week, Last week and Today (today has no visits yet; the switch shows gray rows first).
 * - Switch Of start and Step to step: the rates change.
 * - Click a row, or Tab to a row and press Up and Down: the sentence under the chart explains it.
 *
 * Dependencies: React (useEffect, useId, useMemo, useRef, useState), the library's Segmented ("./segmented-control")
 * and Badge ("./badges-status"). Nothing else — no chart package and nothing fetched at run time. The styles are the
 * library's own fl- classes in templates/library/css/r3t-funnel.css, and the sample data is in the file.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Badge } from "./badges-status";
import { Segmented } from "./segmented-control";

// ── p.funnel-chart: steps as centered bars, drop-offs between them. ──

export type FunnelStep = { id: string; label: string };
export type FunnelPeriod = { id: string; label: string; counts: number[] };
type FunnelLabels = { period: string; mode: string; ofStart: string; ofPrevious: string; overall: string; dropped: string; biggest: string; empty: string; loading: string; data: string; pick: string };

const LABELS: FunnelLabels = {
  period: "Period",
  mode: "Rate",
  ofStart: "Of start",
  ofPrevious: "Step to step",
  overall: "Overall conversion",
  dropped: "{n} dropped · {p}",
  biggest: "Biggest drop",
  empty: "Nobody has started yet in this period.",
  loading: "Loading…",
  data: "Funnel numbers",
  pick: "Pick a step to explain it.",
};

const motionOff = () =>
  typeof window === "undefined" || !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off";

/** True once the element has been on screen (at once when motion is off). */
function useSeen<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || motionOff() || !("IntersectionObserver" in window)) return setSeen(true);
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) {
      const raf = requestAnimationFrame(() => setSeen(true));
      const t = window.setTimeout(() => setSeen(true), 120);
      return () => (cancelAnimationFrame(raf), window.clearTimeout(t));
    }
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        setSeen(true);
        io.disconnect();
      }
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen] as const;
}

/** True a moment after `on` turns true, so freshly mounted marks start empty and grow; at once when motion is off. */
function useGrown(on: boolean) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    if (!on) return setGrown(false);
    if (motionOff()) return setGrown(true);
    const t = window.setTimeout(() => setGrown(true), 40);
    return () => window.clearTimeout(t);
  }, [on]);
  return grown;
}

/** A number that counts toward its target with an ease-out curve; jumps when motion is off. */
function useTween(target: number, run: boolean, ms = 700) {
  const [v, setV] = useState(0);
  const cur = useRef(0);
  useEffect(() => {
    if (!run) return;
    if (motionOff()) {
      cur.current = target;
      return setV(target);
    }
    const from = cur.current;
    let start = -1;
    let raf = 0;
    const tick = (t: number) => {
      if (start < 0) start = t;
      const p = Math.min(1, (t - start) / ms);
      const n = from + (target - from) * (1 - (1 - p) ** 3);
      cur.current = n;
      setV(n);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);
  return v;
}

function Count({ value, run, fmt }: { value: number; run: boolean; fmt: (n: number) => string }) {
  return <>{fmt(useTween(value, run))}</>;
}

export function FunnelChart({
  title,
  steps,
  periods,
  defaultPeriod,
  onPeriodChange,
  loading = false,
  unit = "people",
  format,
  locale,
  labels,
  className,
}: {
  title: string;
  /** The steps in order, first to last. */
  steps: FunnelStep[];
  /** One count per step for each period; a switch shows when there are two or more. */
  periods: FunnelPeriod[];
  defaultPeriod?: string;
  onPeriodChange?: (id: string) => void;
  loading?: boolean;
  /** What the counts count, said after each number. */
  unit?: string;
  format?: (n: number) => string;
  locale?: string;
  labels?: Partial<FunnelLabels>;
  className?: string;
}) {
  const L = { ...LABELS, ...labels };
  const uid = useId().replace(/:/g, "");
  const [periodId, setPeriodId] = useState(defaultPeriod ?? periods[0]?.id ?? "");
  const period = periods.find((p) => p.id === periodId) ?? periods[0];
  const [mode, setMode] = useState<"start" | "previous">("start");
  const [picked, setPicked] = useState<number | null>(null);
  const [said, setSaid] = useState("");
  const [box, seen] = useSeen<HTMLElement>();
  const rows = useRef<Array<HTMLButtonElement | null>>([]);
  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const pf = useMemo(() => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }), [locale]);
  const fmt = format ?? ((n: number) => nf.format(Math.round(n)));

  const counts = steps.map((_, i) => Math.max(0, period?.counts[i] ?? 0));
  const first = counts[0] ?? 0;
  const empty = !loading && first === 0;
  const draw = useGrown(seen && !loading);
  const ofStart = (i: number) => (first ? counts[i]! / first : 0);
  const ofPrev = (i: number) => (i === 0 ? 1 : counts[i - 1] ? counts[i]! / counts[i - 1]! : 0);
  const lost = (i: number) => (i === 0 ? 0 : Math.max(0, counts[i - 1]! - counts[i]!));
  const biggest = counts.reduce((best, _, i) => (i > 0 && lost(i) > (best > 0 ? lost(best) : 0) ? i : best), 0);
  const overall = steps.length ? ofStart(steps.length - 1) : 0;
  const overallShown = useTween(overall * 1000, draw);

  const explain = (i: number) => {
    const s = steps[i]!;
    if (i === 0) return `${s.label}: ${fmt(counts[0]!)} ${unit} started.`;
    return `${s.label}: ${fmt(counts[i]!)} ${unit}, ${pf.format(ofPrev(i))} of those who reached ${steps[i - 1]!.label} and ${pf.format(ofStart(i))} of everyone who started. ${fmt(lost(i))} left before this step.`;
  };
  const pick = (i: number) => {
    setPicked(i);
    setSaid(explain(i));
  };
  const onRowKey = (i: number) => (e: ReactKeyboardEvent) => {
    let n = -1;
    if (e.key === "ArrowDown") n = Math.min(steps.length - 1, i + 1);
    else if (e.key === "ArrowUp") n = Math.max(0, i - 1);
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = steps.length - 1;
    if (n < 0) return;
    e.preventDefault();
    rows.current[n]?.focus();
    pick(n);
  };
  const choosePeriod = (id: string) => {
    setPeriodId(id);
    setPicked(null);
    setSaid("");
    onPeriodChange?.(id);
  };
  const rate = (i: number) => (mode === "start" ? ofStart(i) : ofPrev(i));
  const focusIdx = picked ?? 0;

  return (
    <figure ref={box} className={["fl-fnl", className ?? ""].filter(Boolean).join(" ")} data-fl="p.funnel-chart" aria-labelledby={`${uid}-t`} aria-busy={loading || undefined}>
      <div className="fl-fnl-top">
        <div className="fl-fnl-titles">
          <figcaption id={`${uid}-t`} className="fl-fnl-title">
            {title}
          </figcaption>
          {!loading && !empty ? (
            <p className="fl-fnl-overall">
              <strong aria-hidden="true">{pf.format(overallShown / 1000)}</strong>
              <span className="fl-fnl-sr">{pf.format(overall)}</span>
              <span>{L.overall}</span>
            </p>
          ) : null}
        </div>
        <div className="fl-fnl-controls">
          {periods.length > 1 ? (
            <Segmented variant="toggle" size="sm" label={L.period} options={periods.map((p) => ({ value: p.id, label: p.label }))} value={period?.id ?? ""} onChange={choosePeriod} />
          ) : null}
          <Segmented
            size="sm"
            label={L.mode}
            options={[
              { value: "start", label: L.ofStart },
              { value: "previous", label: L.ofPrevious },
            ]}
            value={mode}
            onChange={(v) => setMode(v as "start" | "previous")}
          />
        </div>
      </div>

      {loading ? (
        <ol className="fl-fnl-list" aria-hidden="true">
          {steps.map((s, i) => (
            <li key={s.id} className="fl-fnl-ghost" style={{ ["--w" as string]: `${100 - i * (60 / Math.max(1, steps.length))}%` }} />
          ))}
        </ol>
      ) : empty ? (
        <p className="fl-fnl-empty">{L.empty}</p>
      ) : (
        <ol className="fl-fnl-list" aria-label={title}>
          {steps.map((s, i) => {
            const w = Math.max(first ? (counts[i]! / first) * 100 : 0, counts[i] ? 1.5 : 0);
            return (
              <li key={s.id} className="fl-fnl-item" style={{ ["--i" as string]: i }}>
                {i > 0 ? (
                  <p className={`fl-fnl-drop${i === biggest ? " is-biggest" : ""}`}>
                    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                      <path d="M8 3v9M4 8l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>{L.dropped.replace("{n}", fmt(lost(i))).replace("{p}", pf.format(counts[i - 1] ? lost(i) / counts[i - 1]! : 0))}</span>
                    {i === biggest && lost(i) > 0 ? (
                      <Badge tone="warning" className="fl-fnl-flag">
                        {L.biggest}
                      </Badge>
                    ) : null}
                  </p>
                ) : null}
                <button
                  ref={(el) => {
                    rows.current[i] = el;
                  }}
                  type="button"
                  className={`fl-fnl-row${picked === i ? " is-picked" : ""}`}
                  tabIndex={i === focusIdx ? 0 : -1}
                  aria-pressed={picked === i}
                  aria-label={explain(i)}
                  onClick={() => pick(i)}
                  onKeyDown={onRowKey(i)}
                >
                  <span className="fl-fnl-head">
                    <span className="fl-fnl-num" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className="fl-fnl-name">{s.label}</span>
                    <span className="fl-fnl-count">
                      <Count value={counts[i]!} run={draw} fmt={fmt} />
                    </span>
                    <span className="fl-fnl-rate">{pf.format(rate(i))}</span>
                  </span>
                  <span className="fl-fnl-track" aria-hidden="true">
                    <span className="fl-fnl-bar" style={{ width: `${draw ? w : 0}%` }} />
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <p className="fl-fnl-said" role="status">
        {loading ? L.loading : said || (empty ? "" : L.pick)}
      </p>
      {!loading && !empty ? (
        <div className="fl-fnl-sr">
          <table>
            <caption>{`${L.data}, ${period?.label ?? ""}`}</caption>
            <thead>
              <tr>
                <th scope="col">Step</th>
                <th scope="col">{unit}</th>
                <th scope="col">{L.ofStart}</th>
                <th scope="col">{L.ofPrevious}</th>
                <th scope="col">Dropped</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((s, i) => (
                <tr key={s.id}>
                  <th scope="row">{s.label}</th>
                  <td>{fmt(counts[i]!)}</td>
                  <td>{pf.format(ofStart(i))}</td>
                  <td>{pf.format(ofPrev(i))}</td>
                  <td>{fmt(lost(i))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </figure>
  );
}

// ── The reference sheet: an online shop's checkout funnel. ──

// flowcode:sample
const SAMPLE = {
  eyebrow: "Conversion",
  title: "Where shoppers drop off",
  lede: "Pick a step to see what happened there.",
  chartTitle: "Checkout funnel",
  unit: "shoppers",
  steps: [
    { id: "visit", label: "Visited the shop" },
    { id: "product", label: "Viewed a product" },
    { id: "cart", label: "Added to cart" },
    { id: "checkout", label: "Started checkout" },
    { id: "paid", label: "Paid" },
  ],
  periods: [
    { id: "week", label: "This week", counts: [24860, 14210, 4380, 2690, 1912] },
    { id: "last", label: "Last week", counts: [22140, 11870, 4120, 2210, 1490] },
    { id: "today", label: "Today", counts: [0, 0, 0, 0, 0] },
  ],
};

export default function ChartFunnelPreview() {
  const d = SAMPLE;
  const [loading, setLoading] = useState(false);
  const timer = useRef<number>(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // A period switch fetches in a real app: show the gray rows for a moment.
  const onPeriod = () => {
    setLoading(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setLoading(false), 650);
  };
  return (
    <section className="fl-section fl-section--canvas" aria-labelledby="chart-funnel-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="chart-funnel-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <FunnelChart title={d.chartTitle} unit={d.unit} steps={d.steps} periods={d.periods} loading={loading} onPeriodChange={onPeriod} labels={{ empty: "No shoppers yet today." }} />
      </div>
    </section>
  );
}
