/** @flowcode-library chart-donut · Donut chart (Charts and data)
 * Catalog ID: p.donut-chart (pattern)
 * Function: A share-of-total donut: point at a slice or its legend row to light it up and read its value and share, click a legend row to hide or show that slice (the rest re-share the ring), switch the period, and read the numbers as a table.
 * Use it as: import { DonutChart } from "./chart-donut"; <DonutChart title="Visits by device" periods={[{ id: "month", label: "This month", slices: [{ id: "mobile", label: "Mobile", value: 5120 }] }]} defaultPeriod?="month" onPeriodChange?={(id) => ...} loading?={false} unit?="visits" totalLabel?="Total" format?={(n) => string} locale? labels?={{ period, chart, data, share, empty, loading, hide, show, lastOne }} />
 * Built from: c.segmented.toggle
 * Look: A white card with a title and a period switch; a thick ring split into colored slices with small gaps and the total in its middle, beside a legend of rows (swatch, name, value, share). The pointed slice thickens while the others fade, and the middle reads that slice; hidden slices go gray and struck through in the legend.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-secondary --color-success --color-warning --color-danger --surface-radius --radius-sm --space-2 --space-3 --space-4 --space-5 --text-xs --text-sm --text-md --text-2xl --font-sans --font-display --duration-fast --duration-slow --ease-out --stagger --focus-ring
 * Use cases: analytics dashboard; traffic sources; device split; spending by category; budget breakdown; plan mix; survey answers; sales by channel
 * Jobs to be done: see how a total splits up; find the biggest share; compare shares this month and last; leave one slice out to compare the rest
 * Keywords: donut chart, pie chart, share, breakdown, proportion, legend, composition, dashboard
 */
/**
 * Donut chart: a total split into a few parts. Each slice is a stroke on one circle, so a change of period or a hidden
 * slice glides the ring into its new shape instead of redrawing it. The legend is the main control: pointing at or
 * focusing a row lights its slice and puts its value and share in the middle; clicking it hides that slice (the shares
 * re-count over what is left) and clicking again brings it back. The last visible slice can't be hidden.
 * From the keyboard: Tab to the ring and press Left and Right (or Up and Down) to step through the slices, Escape to
 * let go; each slice is said in words. A hidden table holds every value and share.
 * Loading shows a pulsing gray ring; a period with nothing in it says so instead of drawing an empty ring.
 * Make it the app's own: pass the app's own periods and slices; keep it to six slices or fewer (fold the rest into
 * "Other").
 * Adapted from TailGrids (MIT, Copyright (c) 2025 Tailgrids): its pie chart example (a padded ring of colored cells
 * with a tooltip), rewritten in SVG without its chart dependency, with a legend that highlights and hides slices.
 */
/**
 * How to try it
 * - Point at a slice or a legend row: it lights up and the middle reads it.
 * - Click a legend row to hide that slice; click again to bring it back.
 * - Switch This month, Last month and Today (today has no visits yet; switching shows the loading ring first).
 * - Tab to the ring and press Left and Right.
 *
 * Dependencies: React (useEffect, useId, useMemo, useRef, useState), the library's Segmented ("./segmented-control").
 * Nothing else — no chart package and nothing fetched at run time. The styles are the library's own fl- classes in
 * templates/library/css/r3t-donut.css, and the sample data is in the file.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Segmented } from "./segmented-control";

// ── p.donut-chart: one ring of slices with a legend that lights and hides them. ──

export type DonutSlice = { id: string; label: string; value: number };
export type DonutPeriod = { id: string; label: string; slices: DonutSlice[] };
type DonutLabels = { period: string; chart: string; data: string; share: string; empty: string; loading: string; hide: string; show: string; lastOne: string };

const LABELS: DonutLabels = {
  period: "Period",
  chart: "Left and Right step through the slices.",
  data: "Values and shares",
  share: "Share",
  empty: "Nothing here yet for this period.",
  loading: "Loading…",
  hide: "Hide",
  show: "Show",
  lastOne: "At least one slice stays shown.",
};

// Written out in full so a build finds every class. Six tones, then they repeat.
const TONES = ["fl-dnt-t1", "fl-dnt-t2", "fl-dnt-t3", "fl-dnt-t4", "fl-dnt-t5", "fl-dnt-t6"];
const R = 80;
const GAP = 0.9;

const motionOff = () =>
  typeof window === "undefined" || !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off";

/** True once the element has been on screen (at once when motion is off). */
function useSeen<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || motionOff() || !("IntersectionObserver" in window)) return setSeen(true);
    // Already on screen: draw now (the observer can be late in a background frame).
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

export function DonutChart({
  title,
  periods,
  defaultPeriod,
  onPeriodChange,
  loading = false,
  unit,
  totalLabel = "Total",
  format,
  locale,
  labels,
  className,
}: {
  title: string;
  /** One or more periods; a switch shows when there are two or more. */
  periods: DonutPeriod[];
  defaultPeriod?: string;
  onPeriodChange?: (id: string) => void;
  /** Data on its way: a pulsing gray ring. */
  loading?: boolean;
  /** What the values count ("visits"), said after each value. */
  unit?: string;
  totalLabel?: string;
  format?: (n: number) => string;
  locale?: string;
  labels?: Partial<DonutLabels>;
  className?: string;
}) {
  const L = { ...LABELS, ...labels };
  const uid = useId().replace(/:/g, "");
  const [periodId, setPeriodId] = useState(defaultPeriod ?? periods[0]?.id ?? "");
  const period = periods.find((p) => p.id === periodId) ?? periods[0];
  const slices = period?.slices ?? [];
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<string | null>(null);
  const [said, setSaid] = useState("");
  const [box, seen] = useSeen<HTMLElement>();
  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const pf = useMemo(() => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }), [locale]);
  const fmt = format ?? ((n: number) => nf.format(Math.round(n)));
  const withUnit = (n: number) => (unit ? `${fmt(n)} ${unit}` : fmt(n));

  const shown = slices.filter((s) => !hidden.has(s.id) && s.value > 0);
  const total = shown.reduce((t, s) => t + s.value, 0);
  const empty = !loading && slices.reduce((t, s) => t + Math.max(0, s.value), 0) === 0;
  const tweenTotal = useTween(total, seen && !loading);

  // Where each slice starts and how long it is, in hundredths of the ring.
  const arcs = useMemo(() => {
    let at = 0;
    return slices.map((s) => {
      const on = !hidden.has(s.id) && s.value > 0 && total > 0;
      const share = on ? (s.value / total) * 100 : 0;
      const arc = { id: s.id, start: at, len: on ? (shown.length > 1 ? Math.max(share * 0.5, share - GAP) : share) : 0, share: on ? s.value / total : 0 };
      at += share;
      return arc;
    });
  }, [slices, hidden, total, shown.length]);

  const describe = (id: string) => {
    const s = slices.find((x) => x.id === id);
    const a = arcs.find((x) => x.id === id);
    if (!s || !a) return "";
    return hidden.has(id) ? `${s.label}: ${withUnit(s.value)}, hidden` : `${s.label}: ${withUnit(s.value)}, ${pf.format(a.share)} of ${fmt(total)}`;
  };

  const pick = (id: string) => {
    setPeriodId(id);
    setActive(null);
    setHidden(new Set());
    onPeriodChange?.(id);
  };
  const toggle = (id: string) => {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id);
    else if (shown.length <= 1) return setSaid(L.lastOne);
    else next.add(id);
    setHidden(next);
    const s = slices.find((x) => x.id === id);
    if (s) setSaid(`${s.label} ${next.has(id) ? "hidden" : "shown"}`);
  };
  const onRingKey = (e: ReactKeyboardEvent) => {
    if (!shown.length) return;
    const ids = shown.map((s) => s.id);
    const i = active ? ids.indexOf(active) : -1;
    let n = -2;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") n = (i + 1) % ids.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = i <= 0 ? ids.length - 1 : i - 1;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = ids.length - 1;
    else if (e.key === "Escape") return setActive(null);
    if (n === -2) return;
    e.preventDefault();
    setActive(ids[n]!);
    setSaid(describe(ids[n]!));
  };

  const act = active && !hidden.has(active) ? slices.find((s) => s.id === active) : undefined;
  const actArc = act ? arcs.find((a) => a.id === act.id) : undefined;
  const draw = useGrown(seen && !loading);

  return (
    <figure ref={box} className={["fl-dnt", className ?? ""].filter(Boolean).join(" ")} data-fl="p.donut-chart" aria-labelledby={`${uid}-t`} aria-busy={loading || undefined}>
      <div className="fl-dnt-top">
        <figcaption id={`${uid}-t`} className="fl-dnt-title">
          {title}
        </figcaption>
        {periods.length > 1 ? (
          <Segmented variant="toggle" size="sm" label={L.period} options={periods.map((p) => ({ value: p.id, label: p.label }))} value={period?.id ?? ""} onChange={pick} />
        ) : null}
      </div>
      <div className={`fl-dnt-body${loading ? " is-loading" : ""}${active ? " has-active" : ""}`}>
        <div className="fl-dnt-ringwrap">
          <svg
            className="fl-dnt-ring"
            viewBox="0 0 200 200"
            tabIndex={loading || empty ? -1 : 0}
            role="img"
            aria-label={`${title}. ${loading ? L.loading : empty ? L.empty : `${totalLabel} ${withUnit(total)}. ${L.chart}`}`}
            aria-describedby={`${uid}-said`}
            onKeyDown={onRingKey}
            onBlur={() => setActive(null)}
          >
            <circle className="fl-dnt-track" cx="100" cy="100" r={R} pathLength={100} />
            {!loading && !empty
              ? slices.map((s, k) => {
                  const a = arcs[k]!;
                  return (
                    <circle
                      key={s.id}
                      className={`fl-dnt-slice ${TONES[k % TONES.length]}${active === s.id ? " is-active" : ""}`}
                      cx="100"
                      cy="100"
                      r={R}
                      pathLength={100}
                      strokeDasharray={`${draw ? a.len : 0} ${100 - (draw ? a.len : 0)}`}
                      strokeDashoffset={-(draw ? a.start : 0)}
                      style={{ ["--i" as string]: k }}
                      onPointerEnter={() => setActive(s.id)}
                      onPointerLeave={() => setActive(null)}
                    />
                  );
                })
              : null}
          </svg>
          <div className="fl-dnt-mid" aria-hidden="true">
            {loading ? (
              <span className="fl-dnt-mid-label">{L.loading}</span>
            ) : empty ? (
              <span className="fl-dnt-mid-label">{fmt(0)}</span>
            ) : act && actArc ? (
              <>
                <span className="fl-dnt-mid-label">{act.label}</span>
                <strong className="fl-dnt-mid-value">{fmt(act.value)}</strong>
                <span className="fl-dnt-mid-label">{pf.format(actArc.share)}</span>
              </>
            ) : (
              <>
                <span className="fl-dnt-mid-label">{totalLabel}</span>
                <strong className="fl-dnt-mid-value">{fmt(tweenTotal)}</strong>
                {unit ? <span className="fl-dnt-mid-label">{unit}</span> : null}
              </>
            )}
          </div>
        </div>
        {loading ? (
          <ul className="fl-dnt-legend" aria-hidden="true">
            {[0, 1, 2, 3].map((k) => (
              <li key={k} className="fl-dnt-ghost" />
            ))}
          </ul>
        ) : empty ? (
          <p className="fl-dnt-empty">{L.empty}</p>
        ) : (
          <ul className="fl-dnt-legend">
            {slices.map((s, k) => {
              const off = hidden.has(s.id);
              const a = arcs[k]!;
              return (
                <li key={s.id} style={{ ["--i" as string]: k }} className={draw ? "is-in" : undefined}>
                  <button
                    type="button"
                    className={`fl-dnt-key ${TONES[k % TONES.length]}${off ? " is-off" : ""}${active === s.id ? " is-active" : ""}`}
                    aria-pressed={!off}
                    aria-label={`${describe(s.id)}. ${off ? L.show : L.hide}`}
                    onPointerEnter={() => !off && setActive(s.id)}
                    onPointerLeave={() => setActive(null)}
                    onFocus={() => !off && setActive(s.id)}
                    onBlur={() => setActive(null)}
                    onClick={() => toggle(s.id)}
                  >
                    <span className="fl-dnt-swatch" aria-hidden="true" />
                    <span className="fl-dnt-name">{s.label}</span>
                    <span className="fl-dnt-val">{fmt(s.value)}</span>
                    <span className="fl-dnt-pct">{off ? "—" : pf.format(a.share)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p id={`${uid}-said`} className="fl-dnt-said" role="status">
        {loading ? L.loading : said}
      </p>
      {!loading && !empty ? (
        <div className="fl-dnt-sr">
          <table>
            <caption>{`${L.data}, ${period?.label ?? ""}`}</caption>
            <thead>
              <tr>
                <th scope="col">{title}</th>
                <th scope="col">{unit ?? "Value"}</th>
                <th scope="col">{L.share}</th>
              </tr>
            </thead>
            <tbody>
              {slices.map((s, k) => (
                <tr key={s.id}>
                  <th scope="row">{s.label}</th>
                  <td>{fmt(s.value)}</td>
                  <td>{hidden.has(s.id) ? "hidden" : pf.format(arcs[k]!.share)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </figure>
  );
}

// ── The reference sheet: a shop's visits by device. ──

// flowcode:sample
const SAMPLE = {
  eyebrow: "Analytics",
  title: "Where visits come from",
  lede: "Point at a slice, or hide one to compare the rest.",
  chartTitle: "Visits by device",
  unit: "visits",
  periods: [
    {
      id: "month",
      label: "This month",
      slices: [
        { id: "mobile", label: "Mobile", value: 18420 },
        { id: "desktop", label: "Desktop", value: 9310 },
        { id: "tablet", label: "Tablet", value: 2870 },
        { id: "tv", label: "Smart TV", value: 640 },
        { id: "other", label: "Other", value: 410 },
      ],
    },
    {
      id: "last",
      label: "Last month",
      slices: [
        { id: "mobile", label: "Mobile", value: 15160 },
        { id: "desktop", label: "Desktop", value: 10240 },
        { id: "tablet", label: "Tablet", value: 3390 },
        { id: "tv", label: "Smart TV", value: 380 },
        { id: "other", label: "Other", value: 520 },
      ],
    },
    { id: "today", label: "Today", slices: [] as DonutSlice[] },
  ],
};

export default function ChartDonutPreview() {
  const d = SAMPLE;
  const [loading, setLoading] = useState(false);
  const timer = useRef<number>(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // A period switch fetches in a real app: show the loading ring for a moment.
  const onPeriod = () => {
    setLoading(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setLoading(false), 650);
  };
  return (
    <section className="fl-section fl-section--canvas" aria-labelledby="chart-donut-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="chart-donut-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <DonutChart title={d.chartTitle} unit={d.unit} periods={d.periods} loading={loading} onPeriodChange={onPeriod} labels={{ empty: "No visits yet today." }} />
      </div>
    </section>
  );
}
