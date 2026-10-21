/** @flowcode-library activity-heatmap · Activity heatmap (Charts and data)
 * Catalog ID: p.activity-heatmap (pattern)
 * Function: A year of activity by day as a calendar of small squares (GitHub-style): darker means more, a tooltip names the day and count, arrow keys walk the days, a picked day is explained under it, and totals with the longest and current streaks sit above. On a phone it shows the latest weeks with Earlier and Later.
 * Use it as: import { ActivityHeatmap } from "./activity-heatmap"; <ActivityHeatmap title="Practice" days={[{ date: "2026-10-20", count: 3 }]} end?="2026-10-21" weeks?={53} weekStart?={0|1} unit?={{ one: "session", other: "sessions" }} loading?={false} onSelect?={(date, count) => ...} locale? labels?={{ total, activeDays, longest, current, less, more, earlier, later, empty, loading, data, pick, dayUnit }} />
 * Built from: c.button.tertiary
 * Look: A white card with a title and four small figures (total, active days, longest and current streak) over a grid of small rounded squares, seven rows of weekdays by week columns, month names on top and Mon, Wed, Fri at the left; empty days are a soft gray and busy ones step up through four shades of the accent. A Less–More key and a line about the picked day sit under it.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --surface-radius --radius-sm --space-1 --space-2 --space-3 --space-4 --space-5 --text-xs --text-sm --text-md --text-xl --font-sans --font-display --duration-fast --duration-slow --ease-out --stagger-max --focus-ring
 * Use cases: habit tracker; contribution graph; workout log; practice streaks; support tickets by day; sales by day; attendance history; journal streak
 * Jobs to be done: see how often i showed up this year; find my busiest days; keep my streak going; spot quiet stretches
 * Keywords: heatmap, calendar heatmap, contribution graph, streak, activity, habit, daily, github
 */
/**
 * Activity heatmap: each square is one day, columns are weeks and rows are weekdays, so a year fits in one band and
 * habits show as patterns (busy weekends, a quiet August). Shades come from the days themselves: the busy days are
 * split into four even groups, so one huge day doesn't wash the rest out. Days after `end` stay blank.
 * The grid is a real grid for assistive tech: Tab lands on one day; Left and Right move a week, Up and Down a day,
 * Home and End jump to the first and last day shown, Page Up and Page Down move four weeks. Each day is read with
 * its date and count, and the pointed or focused day shows a small tooltip. Enter, Space or a click picks the day:
 * the line under the grid explains it and onSelect gets it. A hidden table sums each month.
 * When the card is too narrow for every week (a phone), the latest weeks fit and Earlier and Later page through the
 * rest; the keyboard pages by itself. Squares fade in column by column the first time the grid is on screen.
 * Make it the app's own: pass the app's own days (missing days count as none) and the unit it counts.
 * Adapted from TailGrids (MIT, Copyright (c) 2025 Tailgrids): its calendar (a keyboard-walkable grid of days with
 * weekday headers), reshaped into a year of week columns with shaded days.
 */
/**
 * How to try it
 * - Point at a square: the tooltip names the day and count.
 * - Tab into the grid; walk it with the arrow keys; press Enter on a day.
 * - Switch You, Whole team and New member (the new member has nothing yet; the switch shows a loading grid first).
 * - Narrow the window to a phone: use Earlier and Later.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useMemo, useRef, useState), the library's Button
 * ("./buttons-variants") and Segmented ("./segmented-control", in the reference sheet only). Nothing else — nothing
 * fetched at run time. The styles are the library's own fl- classes in templates/library/css/r3t-heatmap.css, and the
 * sample data is in the file.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Button } from "./buttons-variants";
import { Segmented } from "./segmented-control";

// ── p.activity-heatmap: a year of days as shaded squares. ──

export type ActivityDay = { date: string; count: number };
type HeatLabels = { total: string; activeDays: string; longest: string; current: string; less: string; more: string; earlier: string; later: string; empty: string; loading: string; data: string; pick: string; dayUnit: { one: string; other: string } };

const LABELS: HeatLabels = {
  total: "Total",
  activeDays: "Active days",
  longest: "Longest streak",
  current: "Current streak",
  less: "Less",
  more: "More",
  earlier: "Earlier",
  later: "Later",
  empty: "Nothing yet. Each day you're active shows here.",
  loading: "Loading…",
  data: "Totals by month",
  pick: "Pick a day to see it.",
  dayUnit: { one: "day", other: "days" },
};

// Written out in full so a build finds every class.
const LEVEL = ["fl-hmc-l0", "fl-hmc-l1", "fl-hmc-l2", "fl-hmc-l3", "fl-hmc-l4"];
const DAY = 864e5;
const GAP = 3;
const LABEL_COL = 30;
/** The month row's height plus the gap under it (r3t-heatmap.css). */
const MONTHS_H = 22;

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
      const t = window.setTimeout(() => setSeen(true), 40);
      return () => window.clearTimeout(t);
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

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const utc = (s: string) => Date.parse(`${s}T00:00:00Z`);
const todayIso = () => {
  const d = new Date();
  return iso(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
};

function Stat({ label, value, run, fmt }: { label: string; value: number; run: boolean; fmt: (n: number) => string }) {
  const v = useTween(value, run);
  return (
    <div className="fl-hmc-stat">
      <dt>{label}</dt>
      <dd>
        <span aria-hidden="true">{fmt(v)}</span>
        <span className="fl-hmc-sr">{fmt(value)}</span>
      </dd>
    </div>
  );
}

export function ActivityHeatmap({
  title,
  days,
  end,
  weeks = 53,
  weekStart = 0,
  unit = { one: "session", other: "sessions" },
  loading = false,
  onSelect,
  locale,
  labels,
  className,
}: {
  title: string;
  /** One entry per active day; days left out count as none. */
  days: ActivityDay[];
  /** The last day shown, as "2026-10-21"; today when left out. */
  end?: string;
  /** How many week columns, 53 for a year. */
  weeks?: number;
  /** 0 starts weeks on Sunday, 1 on Monday. */
  weekStart?: 0 | 1;
  unit?: { one: string; other: string };
  loading?: boolean;
  onSelect?: (date: string, count: number) => void;
  locale?: string;
  labels?: Partial<HeatLabels>;
  className?: string;
}) {
  const L = { ...LABELS, ...labels };
  const uid = useId().replace(/:/g, "");
  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const fmt = (n: number) => nf.format(Math.round(n));
  const dayFmt = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }), [locale]);
  const monFmt = useMemo(() => new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }), [locale]);
  const monthYear = useMemo(() => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }), [locale]);
  const wdFmt = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }), [locale]);
  const plural = useMemo(() => new Intl.PluralRules(locale), [locale]);
  const say = (n: number, u = unit) => `${fmt(n)} ${plural.select(Math.round(n)) === "one" ? u.one : u.other}`;

  // The calendar: week columns ending with the week that holds `end`.
  const endIso = end ?? todayIso();
  const endT = utc(endIso);
  const endDow = new Date(endT).getUTCDay();
  const lastColStart = endT - ((endDow - weekStart + 7) % 7) * DAY;
  const firstT = lastColStart - (weeks - 1) * 7 * DAY;
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of days) m.set(d.date, (m.get(d.date) ?? 0) + Math.max(0, d.count));
    return m;
  }, [days]);
  const countOf = (t: number) => (t > endT || t < firstT ? 0 : counts.get(iso(t)) ?? 0);

  // Shade steps: the active days split into four even groups.
  const cuts = useMemo(() => {
    const vals: number[] = [];
    for (let t = firstT; t <= endT; t += DAY) {
      const c = counts.get(iso(t)) ?? 0;
      if (c > 0) vals.push(c);
    }
    vals.sort((a, b) => a - b);
    const q = (p: number) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))] ?? 0;
    return [q(0.25), q(0.5), q(0.75)];
  }, [counts, firstT, endT]);
  const level = (c: number) => (c <= 0 ? 0 : c <= cuts[0]! ? 1 : c <= cuts[1]! ? 2 : c <= cuts[2]! ? 3 : 4);

  // Totals and streaks over the range.
  const stats = useMemo(() => {
    let total = 0;
    let active = 0;
    let run = 0;
    let longest = 0;
    for (let t = firstT; t <= endT; t += DAY) {
      const c = counts.get(iso(t)) ?? 0;
      total += c;
      if (c > 0) (active++, run++, (longest = Math.max(longest, run)));
      else run = 0;
    }
    // The current streak may start today or yesterday (today isn't over yet).
    let current = 0;
    let t = endT;
    if (!(counts.get(iso(t)) ?? 0)) t -= DAY;
    while (t >= firstT && (counts.get(iso(t)) ?? 0) > 0) (current++, (t -= DAY));
    return { total, active, longest, current };
  }, [counts, firstT, endT]);
  const empty = !loading && stats.total === 0;

  // How many weeks fit; the rest page.
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([e]) => setWidth(e!.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const room = Math.max(0, width - LABEL_COL);
  const fitCell = room ? room / weeks - GAP : 12;
  const cell = Math.max(10, Math.min(16, fitCell));
  const shownWeeks = width ? Math.max(4, Math.min(weeks, Math.floor((room + GAP) / (cell + GAP)))) : weeks;
  const [lastCol, setLastCol] = useState(weeks - 1);
  const lc = Math.max(shownWeeks - 1, Math.min(weeks - 1, lastCol));
  const firstCol = lc - shownWeeks + 1;
  const paged = shownWeeks < weeks;

  const [focusT, setFocusT] = useState(endT);
  const [hover, setHover] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [box, seen] = useSeen<HTMLElement>();
  const grid = useRef<HTMLDivElement>(null);
  const keyed = useRef(false);
  useEffect(() => setFocusT(endT), [endT]);

  const colOf = (t: number) => Math.floor((t - firstT) / (7 * DAY));
  const tAt = (col: number, row: number) => firstT + (col * 7 + row) * DAY;
  const describe = (t: number) => `${dayFmt.format(new Date(t))}: ${countOf(t) ? say(countOf(t)) : `no ${unit.other}`}`;

  // Keep the focused day on screen, and move real focus after a key press.
  useEffect(() => {
    const c = colOf(focusT);
    if (c < firstCol) setLastCol(c + shownWeeks - 1);
    else if (c > lc) setLastCol(c);
  }, [focusT, shownWeeks]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!keyed.current) return;
    const el = grid.current?.querySelector<HTMLElement>(`[data-t="${focusT}"]`);
    if (el) {
      keyed.current = false;
      el.focus();
    }
  }, [focusT, firstCol]);

  const choose = (t: number) => {
    setPicked(t);
    setFocusT(t);
    onSelect?.(iso(t), countOf(t));
  };
  const onKey = (e: ReactKeyboardEvent) => {
    const steps: Record<string, number> = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1, PageDown: 28, PageUp: -28 };
    let next: number | null = null;
    if (e.key in steps) next = focusT + steps[e.key]! * DAY;
    else if (e.key === "Home") next = Math.max(firstT, tAt(firstCol, 0));
    else if (e.key === "End") next = Math.min(endT, tAt(lc, 6));
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      return choose(focusT);
    }
    if (next === null) return;
    e.preventDefault();
    next = Math.max(firstT, Math.min(endT, next));
    keyed.current = true;
    setFocusT(next);
  };

  // Month names over the first column in which each month starts.
  const months: Array<{ col: number; label: string }> = [];
  for (let c = firstCol; c <= lc; c++) {
    const t = tAt(c, 0);
    const d = new Date(t);
    const prev = new Date(t - 7 * DAY);
    if (c === firstCol ? d.getUTCDate() <= 21 : d.getUTCMonth() !== prev.getUTCMonth()) months.push({ col: c - firstCol, label: monFmt.format(d) });
  }
  // A month that starts too close to the one before it (only the first can) gives way.
  if (months.length > 1 && months[1]!.col - months[0]!.col < 3) months.shift();
  const byMonth = useMemo(() => {
    const m = new Map<string, { label: string; total: number; active: number }>();
    for (let t = firstT; t <= endT; t += DAY) {
      const k = iso(t).slice(0, 7);
      const c = counts.get(iso(t)) ?? 0;
      const row = m.get(k) ?? { label: monthYear.format(new Date(t)), total: 0, active: 0 };
      row.total += c;
      if (c > 0) row.active++;
      m.set(k, row);
    }
    return [...m.values()];
  }, [counts, firstT, endT, monthYear]);

  const tip = hover ?? null;
  const tipCol = tip !== null ? colOf(tip) - firstCol : 0;
  const tipRow = tip !== null ? (new Date(tip).getUTCDay() - weekStart + 7) % 7 : 0;
  const style = { ["--cell" as string]: `${cell}px`, ["--gap" as string]: `${GAP}px`, ["--cols" as string]: shownWeeks };

  return (
    <figure ref={box} className={["fl-hmc", className ?? ""].filter(Boolean).join(" ")} data-fl="p.activity-heatmap" aria-labelledby={`${uid}-t`} aria-busy={loading || undefined}>
      <div className="fl-hmc-top">
        <figcaption id={`${uid}-t`} className="fl-hmc-title">
          {title}
        </figcaption>
        {!loading ? (
          <dl className="fl-hmc-stats">
            <Stat label={`${L.total} ${unit.other}`} value={stats.total} run={seen} fmt={fmt} />
            <Stat label={L.activeDays} value={stats.active} run={seen} fmt={fmt} />
            <Stat label={L.longest} value={stats.longest} run={seen} fmt={(n) => say(n, L.dayUnit)} />
            <Stat label={L.current} value={stats.current} run={seen} fmt={(n) => say(n, L.dayUnit)} />
          </dl>
        ) : null}
      </div>

      <div ref={wrap} className="fl-hmc-wrap" style={style}>
        <div className="fl-hmc-months" aria-hidden="true">
          {months.map((m) => (
            <span key={`${m.col}-${m.label}`} style={{ left: `${m.col * (cell + GAP)}px` }}>
              {m.label}
            </span>
          ))}
        </div>
        <div className="fl-hmc-days" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5, 6].map((r) => (
            <span key={r}>{r % 2 === 1 ? wdFmt.format(new Date(tAt(0, r))) : ""}</span>
          ))}
        </div>
        {loading ? (
          <div className="fl-hmc-grid is-loading" aria-hidden="true">
            {Array.from({ length: 7 * shownWeeks }, (_, k) => (
              <span key={k} className="fl-hmc-cell fl-hmc-l0" />
            ))}
          </div>
        ) : (
          <div
            ref={grid}
            key={firstCol}
            className={`fl-hmc-grid${seen ? " is-in" : ""}`}
            role="grid"
            aria-label={`${title}. ${L.pick}`}
            aria-describedby={`${uid}-said`}
            onKeyDown={onKey}
            onPointerLeave={() => setHover(null)}
          >
            {[0, 1, 2, 3, 4, 5, 6].map((r) => (
              <div key={r} role="row" className="fl-hmc-row">
                {Array.from({ length: shownWeeks }, (_, k) => {
                  const t = tAt(firstCol + k, r);
                  if (t > endT) return <span key={k} role="gridcell" className="fl-hmc-cell is-future" aria-hidden="true" />;
                  const c = countOf(t);
                  return (
                    <span
                      key={k}
                      role="gridcell"
                      data-t={t}
                      tabIndex={t === focusT ? 0 : -1}
                      aria-label={describe(t)}
                      aria-selected={picked === t}
                      className={`fl-hmc-cell ${LEVEL[level(c)]}${picked === t ? " is-picked" : ""}`}
                      style={{ ["--c" as string]: k }}
                      onPointerEnter={() => setHover(t)}
                      onFocus={() => (setHover(t), setFocusT(t))}
                      onBlur={() => setHover(null)}
                      onClick={() => choose(t)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        )}
        {tip !== null && !loading ? (
          <div
            className={`fl-hmc-tip${tipCol < shownWeeks / 3 ? " is-start" : tipCol > (shownWeeks * 2) / 3 ? " is-end" : ""}`}
            aria-hidden="true"
            style={{ left: `${LABEL_COL + tipCol * (cell + GAP) + cell / 2}px`, top: `${MONTHS_H + tipRow * (cell + GAP)}px` }}
          >
            <strong>{countOf(tip) ? say(countOf(tip)) : `No ${unit.other}`}</strong> {dayFmt.format(new Date(tip))}
          </div>
        ) : null}
      </div>

      <div className="fl-hmc-foot">
        <p id={`${uid}-said`} className="fl-hmc-said" role="status">
          {loading ? L.loading : empty ? L.empty : picked !== null ? describe(picked) : L.pick}
        </p>
        <div className="fl-hmc-key" aria-hidden="true">
          {L.less}
          {LEVEL.map((l) => (
            <span key={l} className={`fl-hmc-cell ${l}`} />
          ))}
          {L.more}
        </div>
        {paged ? (
          <div className="fl-hmc-page">
            <Button variant="tertiary" size={32} icon="chevron-left" disabled={firstCol <= 0} onClick={() => setLastCol(Math.max(shownWeeks - 1, lc - shownWeeks))}>
              {L.earlier}
            </Button>
            <Button variant="tertiary" size={32} icon="chevron-right" iconAt="end" disabled={lc >= weeks - 1} onClick={() => setLastCol(Math.min(weeks - 1, lc + shownWeeks))}>
              {L.later}
            </Button>
          </div>
        ) : null}
      </div>

      {!loading ? (
        <div className="fl-hmc-sr">
          <table>
            <caption>{`${L.data}: ${title}`}</caption>
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col">{unit.other}</th>
                <th scope="col">{L.activeDays}</th>
              </tr>
            </thead>
            <tbody>
              {byMonth.map((m) => (
                <tr key={m.label}>
                  <th scope="row">{m.label}</th>
                  <td>{fmt(m.total)}</td>
                  <td>{fmt(m.active)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </figure>
  );
}

// ── The reference sheet: a language app's practice log. ──

// A steady made-up year: weekends busier, a quiet two weeks in August, the same on every load.
const year = (end: string, seed: number, rate: number) => {
  const out: ActivityDay[] = [];
  const e = utc(end);
  for (let i = 0; i < 371; i++) {
    const t = e - i * DAY;
    const d = new Date(t);
    const r = Math.sin((i + 1) * 12.9898 * seed) * 43758.5453;
    const x = r - Math.floor(r);
    const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    const away = d.getUTCMonth() === 7 && d.getUTCDate() >= 4 && d.getUTCDate() <= 18;
    if (away || x > rate + (weekend ? 0.15 : 0)) continue;
    out.push({ date: iso(t), count: 1 + Math.floor(x * (weekend ? 9 : 6)) });
  }
  return out;
};

// flowcode:sample
const SAMPLE = {
  eyebrow: "Progress",
  title: "Your practice year",
  lede: "Every square is a day. Darker means more practice.",
  chartTitle: "Practice sessions",
  end: "2026-10-21",
  sets: [
    { id: "you", label: "You", days: year("2026-10-21", 1.7, 0.62) },
    { id: "team", label: "Whole team", days: year("2026-10-21", 3.1, 0.86).map((d) => ({ ...d, count: d.count * 4 })) },
    { id: "new", label: "New member", days: [] as ActivityDay[] },
  ],
};

export default function ActivityHeatmapPreview() {
  const d = SAMPLE;
  const [set, setSet] = useState(d.sets[0]!.id);
  const [loading, setLoading] = useState(false);
  const timer = useRef<number>(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const current = d.sets.find((s) => s.id === set) ?? d.sets[0]!;
  return (
    <section className="fl-section fl-section--canvas" aria-labelledby="activity-heatmap-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="activity-heatmap-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <div className="fl-hmc-demo">
          <Segmented
            variant="toggle"
            size="sm"
            label="Whose practice"
            options={d.sets.map((s) => ({ value: s.id, label: s.label }))}
            value={set}
            onChange={(v) => {
              setSet(v);
              setLoading(true);
              window.clearTimeout(timer.current);
              timer.current = window.setTimeout(() => setLoading(false), 650);
            }}
          />
          <ActivityHeatmap title={d.chartTitle} days={current.days} end={d.end} loading={loading} labels={set === "new" ? { empty: "No sessions yet. Your first one shows here." } : undefined} />
        </div>
      </div>
    </section>
  );
}
