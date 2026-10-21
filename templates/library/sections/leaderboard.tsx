/** @flowcode-library leaderboard · Leaderboard (Charts and data)
 * Catalog ID: p.leaderboard (pattern)
 * Function: A ranked list of people (or teams, products) by one measure: switch the measure and the period and the rows slide to their new places, each with an arrow saying how many places it moved since the last period, a bar against the leader, the top few or everyone, and your own row pinned when it falls below the cut.
 * Use it as: import { Leaderboard } from "./leaderboard"; <Leaderboard title="Top sellers" metrics={[{ id: "revenue", label: "Revenue", format?: "count"|"money"|"percent", lowerIsBetter? }]} periods={[{ id: "week", label: "Week", previous: "last week" }]} people={[{ id, name, detail?, src?, scores: { week: { now: { revenue: 18400 }, before?: { revenue: 15100 } } } }]} me?="id" top?={5} currency?="USD" locale? loading?={false} onChange?={({ metric, period }) => ...} labels?={{ metric, period, rank, person, change, showAll, showTop, you, empty, loading, isNew, same, up, down }} />
 * Built from: c.segmented.segmented, c.segmented.toggle, c.avatar.person, c.button.tertiary
 * Look: A white card with a title, a measure switch and a period switch over rows: a rank (the first three on tinted medal pills), a round initials avatar with a name and a muted line, the figure over a thin bar against the leader, and a small green up or red down arrow with the places moved (a gray dash when unchanged, a "New" pill for newcomers); your row is tinted and pinned under a divider when it's below the cut.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-success --color-danger --color-warning --surface-radius --radius-sm --space-1 --space-2 --space-3 --space-4 --space-5 --text-xs --text-sm --text-md --font-sans --duration-fast --duration-slow --ease-out --stagger --focus-ring
 * Use cases: sales leaderboard; team rankings; top products; top contributors; game scores; fundraising leaders; class rankings; referral contest
 * Jobs to be done: see who is leading; find my own rank; see who moved up this week; compare by a different measure
 * Keywords: leaderboard, ranking, top performers, rank change, scores, competition, table, dashboard
 */
/**
 * Leaderboard: rank comes from the chosen measure in the chosen period (lowest first when lower is better, ties by
 * name); the arrow compares it with the rank the same measure gave in the period before, so a climb reads at a glance.
 * Someone with no earlier score is "New". The first `top` rows show, with Show all to see everyone; when `me` is below
 * the cut, that row is pinned under a divider so you always see where you stand.
 * Switching the measure or the period slides each row from its old place to its new one (the browser's own animation,
 * nothing when motion is off) and figures count to their new values. It is a real table: the rank change is said in
 * words ("Up 2 places since last week") and a status line says what is sorted.
 * Loading shows gray rows; a period with no scores says so.
 * Make it the app's own: pass the app's own people, measures and periods; use only people the PRD names.
 * Adapted from TailAdmin (MIT, Copyright (c) 2023 TailAdmin): its dashboard table card (a titled card with a filter
 * button over rows with a thumbnail, a name, a figure and a status), reshaped into a ranking with rank changes.
 */
/**
 * How to try it
 * - Switch Revenue, Deals and Calls, then Week and Month: rows slide and arrows update.
 * - Press Show all 9, then Show top 5: your row (Sam) is pinned when it's below the cut.
 * - Switch to Quarter: no scores yet (the switch shows gray rows first).
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useMemo, useRef, useState), the library's Segmented
 * ("./segmented-control"), Avatar ("./avatars-variants") and Button ("./buttons-variants"). Nothing else — nothing
 * fetched at run time. The styles are the library's own fl- classes in templates/library/css/r3t-leaderboard.css,
 * and the sample data is in the file.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "./avatars-variants";
import { Button } from "./buttons-variants";
import { Segmented } from "./segmented-control";

// ── p.leaderboard: a ranking with rank changes that slides when it re-sorts. ──

export type LeaderMetric = { id: string; label: string; format?: "count" | "money" | "percent"; lowerIsBetter?: boolean };
export type LeaderPeriod = { id: string; label: string; previous: string };
export type LeaderPerson = {
  id: string;
  name: string;
  detail?: string;
  src?: string;
  scores: Record<string, { now: Record<string, number>; before?: Record<string, number> } | undefined>;
};
type LeaderLabels = { metric: string; period: string; rank: string; person: string; change: string; showAll: string; showTop: string; you: string; empty: string; loading: string; isNew: string; same: string; up: string; down: string; sorted: string };

const LABELS: LeaderLabels = {
  metric: "Measure",
  period: "Period",
  rank: "Rank",
  person: "Name",
  change: "Change",
  showAll: "Show all {n}",
  showTop: "Show top {n}",
  you: "You",
  empty: "No scores yet for this period.",
  loading: "Loading…",
  isNew: "New",
  same: "Same place as {previous}",
  up: "Up {n} since {previous}",
  down: "Down {n} since {previous}",
  sorted: "Ranked by {metric}, {period}. {leader} leads.",
};

const motionOff = () =>
  typeof window === "undefined" || !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off";

/** A number that counts toward its target with an ease-out curve; jumps when motion is off. */
function useTween(target: number, ms = 600) {
  const [v, setV] = useState(() => (motionOff() ? target : 0));
  const cur = useRef(v);
  useEffect(() => {
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
  }, [target, ms]);
  return v;
}

function Figure({ value, fmt }: { value: number; fmt: (n: number) => string }) {
  const v = useTween(value);
  return (
    <>
      <span aria-hidden="true">{fmt(v)}</span>
      <span className="fl-ldb-sr">{fmt(value)}</span>
    </>
  );
}

const places = (n: number) => `${n} ${n === 1 ? "place" : "places"}`;

export function Leaderboard({
  title,
  metrics,
  periods,
  people,
  me,
  top = 5,
  currency = "USD",
  locale,
  loading = false,
  defaultMetric,
  defaultPeriod,
  onChange,
  labels,
  className,
}: {
  title: string;
  metrics: LeaderMetric[];
  periods: LeaderPeriod[];
  people: LeaderPerson[];
  /** The signed-in person's id: their row is tinted, and pinned when below the cut. */
  me?: string;
  /** How many rows show before Show all. */
  top?: number;
  currency?: string;
  locale?: string;
  loading?: boolean;
  defaultMetric?: string;
  defaultPeriod?: string;
  onChange?: (v: { metric: string; period: string }) => void;
  labels?: Partial<LeaderLabels>;
  className?: string;
}) {
  const L = { ...LABELS, ...labels };
  const uid = useId().replace(/:/g, "");
  const [metricId, setMetricId] = useState(defaultMetric ?? metrics[0]?.id ?? "");
  const [periodId, setPeriodId] = useState(defaultPeriod ?? periods[0]?.id ?? "");
  const [all, setAll] = useState(false);
  const metric = metrics.find((m) => m.id === metricId) ?? metrics[0]!;
  const period = periods.find((p) => p.id === periodId) ?? periods[0]!;

  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const mf = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }), [locale, currency]);
  const pf = useMemo(() => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }), [locale]);
  const fmt = (n: number) => (metric.format === "money" ? mf.format(n) : metric.format === "percent" ? pf.format(n / 100) : nf.format(Math.round(n)));

  // Rank now and before for the chosen measure and period.
  const ranked = useMemo(() => {
    const dir = metric.lowerIsBetter ? 1 : -1;
    const order = (key: "now" | "before") =>
      people
        .filter((p) => typeof p.scores[period.id]?.[key]?.[metric.id] === "number")
        .sort((a, b) => dir * ((a.scores[period.id]![key]![metric.id] ?? 0) - (b.scores[period.id]![key]![metric.id] ?? 0)) || a.name.localeCompare(b.name));
    const before = new Map(order("before").map((p, i) => [p.id, i + 1]));
    return order("now").map((p, i) => ({ p, rank: i + 1, value: p.scores[period.id]!.now[metric.id]!, was: before.get(p.id) }));
  }, [people, metric, period]);
  const leader = ranked[0];
  const best = leader ? Math.max(...ranked.map((r) => r.value)) : 0;
  const empty = !loading && ranked.length === 0;
  const cut = all ? ranked : ranked.slice(0, top);
  const mine = me ? ranked.find((r) => r.p.id === me) : undefined;
  const pinned = mine && !cut.includes(mine) ? mine : undefined;

  // Slide rows from where they were to where they are now.
  const rowsRef = useRef(new Map<string, HTMLTableRowElement>());
  const tops = useRef(new Map<string, number>());
  const order = cut.map((r) => r.p.id).join(",") + (pinned ? `|${pinned.p.id}` : "");
  useLayoutEffect(() => {
    const next = new Map<string, number>();
    rowsRef.current.forEach((el, id) => next.set(id, el.getBoundingClientRect().top));
    if (!motionOff()) {
      const css = getComputedStyle(document.documentElement).getPropertyValue("--duration-slow").trim();
      const dur = css.endsWith("ms") ? parseFloat(css) : css.endsWith("s") ? parseFloat(css) * 1000 : 360;
      next.forEach((y, id) => {
        const was = tops.current.get(id);
        const el = rowsRef.current.get(id);
        if (!el || was === undefined || Math.abs(was - y) < 1) return;
        el.animate([{ transform: `translateY(${was - y}px)` }, { transform: "none" }], { duration: dur || 360, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
      });
    }
    tops.current = next;
  }, [order]);

  const change = (rank: number, was?: number) => {
    if (was === undefined) return { kind: "new" as const, text: L.isNew, sr: L.isNew };
    const d = was - rank;
    if (d === 0) return { kind: "same" as const, text: "—", sr: L.same.replace("{previous}", period.previous) };
    return d > 0
      ? { kind: "up" as const, text: String(d), sr: L.up.replace("{n}", places(d)).replace("{previous}", period.previous) }
      : { kind: "down" as const, text: String(-d), sr: L.down.replace("{n}", places(-d)).replace("{previous}", period.previous) };
  };

  const setBoth = (m: string, p: string) => onChange?.({ metric: m, period: p });
  const row = (r: (typeof ranked)[number], k: number) => {
    const c = change(r.rank, r.was);
    const w = best > 0 ? (metric.lowerIsBetter ? (Math.min(...ranked.map((x) => x.value)) / Math.max(r.value, 1e-9)) * 100 : (r.value / best) * 100) : 0;
    return (
      <tr
        key={r.p.id}
        ref={(el) => {
          if (el) rowsRef.current.set(r.p.id, el);
          else rowsRef.current.delete(r.p.id);
        }}
        className={`fl-ldb-row${r.p.id === me ? " is-me" : ""}`}
        style={{ ["--i" as string]: k }}
      >
        <td className="fl-ldb-rank">
          <span className={`fl-ldb-medal${r.rank <= 3 ? ` fl-ldb-medal--${r.rank}` : ""}`}>{r.rank}</span>
        </td>
        <th scope="row" className="fl-ldb-who">
          <Avatar name={r.p.name} src={r.p.src} size={32} decorative />
          <span className="fl-ldb-names">
            <span className="fl-ldb-name">
              {r.p.name}
              {r.p.id === me ? <span className="fl-ldb-you">{L.you}</span> : null}
            </span>
            {r.p.detail ? <span className="fl-ldb-detail">{r.p.detail}</span> : null}
          </span>
        </th>
        <td className="fl-ldb-val">
          <span className="fl-ldb-fig">
            <Figure value={r.value} fmt={fmt} />
          </span>
          <span className="fl-ldb-track" aria-hidden="true">
            <span className="fl-ldb-bar" style={{ width: `${Math.max(2, Math.min(100, w))}%` }} />
          </span>
        </td>
        <td className="fl-ldb-change">
          <span className={`fl-ldb-move fl-ldb-move--${c.kind}`} aria-hidden="true">
            {c.kind === "up" || c.kind === "down" ? (
              <svg viewBox="0 0 16 16" width="12" height="12">
                <path d={c.kind === "up" ? "M8 13V3M4 7l4-4 4 4" : "M8 3v10M4 9l4 4 4-4"} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : null}
            {c.text}
          </span>
          <span className="fl-ldb-sr">{c.sr}</span>
        </td>
      </tr>
    );
  };

  return (
    <section className={["fl-ldb", className ?? ""].filter(Boolean).join(" ")} data-fl="p.leaderboard" aria-labelledby={`${uid}-t`} aria-busy={loading || undefined}>
      <div className="fl-ldb-top">
        <h3 id={`${uid}-t`} className="fl-ldb-title">
          {title}
        </h3>
        <div className="fl-ldb-controls">
          {metrics.length > 1 ? (
            <Segmented
              size="sm"
              label={L.metric}
              options={metrics.map((m) => ({ value: m.id, label: m.label }))}
              value={metric.id}
              onChange={(v) => (setMetricId(v), setBoth(v, period.id))}
            />
          ) : null}
          {periods.length > 1 ? (
            <Segmented
              variant="toggle"
              size="sm"
              label={L.period}
              options={periods.map((p) => ({ value: p.id, label: p.label }))}
              value={period.id}
              onChange={(v) => (setPeriodId(v), setBoth(metric.id, v))}
            />
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="fl-ldb-ghosts" aria-hidden="true">
          {Array.from({ length: Math.min(top, 5) }, (_, k) => (
            <span key={k} className="fl-ldb-ghost" />
          ))}
        </div>
      ) : empty ? (
        <p className="fl-ldb-empty">{L.empty}</p>
      ) : (
        <table className="fl-ldb-table">
          <caption className="fl-ldb-sr">{`${title}: ${metric.label}, ${period.label}`}</caption>
          <thead>
            <tr>
              <th scope="col" className="fl-ldb-rank">
                {L.rank}
              </th>
              <th scope="col">{L.person}</th>
              <th scope="col" className="fl-ldb-val">
                {metric.label}
              </th>
              <th scope="col" className="fl-ldb-change">
                {L.change}
              </th>
            </tr>
          </thead>
          <tbody>
            {cut.map(row)}
            {pinned ? (
              <>
                <tr className="fl-ldb-gap" aria-hidden="true">
                  <td colSpan={4}>
                    <span />
                  </td>
                </tr>
                {row(pinned, cut.length)}
              </>
            ) : null}
          </tbody>
        </table>
      )}

      <div className="fl-ldb-foot">
        <p className="fl-ldb-said" role="status">
          {loading ? L.loading : leader ? L.sorted.replace("{metric}", metric.label).replace("{period}", period.label.toLowerCase()).replace("{leader}", leader.p.name) : ""}
        </p>
        {!loading && ranked.length > top ? (
          <Button variant="tertiary" size={32} aria-expanded={all} onClick={() => setAll(!all)}>
            {(all ? L.showTop : L.showAll).replace("{n}", String(all ? top : ranked.length))}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

// ── The reference sheet: a sales team's board. ──

const sc = (now: [number, number, number], before?: [number, number, number]) => ({
  now: { revenue: now[0], deals: now[1], calls: now[2] },
  ...(before ? { before: { revenue: before[0], deals: before[1], calls: before[2] } } : {}),
});

// flowcode:sample
const SAMPLE = {
  eyebrow: "Sales",
  title: "Who's leading",
  lede: "Switch the measure or the period; rows move to their new places.",
  boardTitle: "Team leaderboard",
  me: "sam",
  metrics: [
    { id: "revenue", label: "Revenue", format: "money" as const },
    { id: "deals", label: "Deals", format: "count" as const },
    { id: "calls", label: "Calls", format: "count" as const },
  ],
  periods: [
    { id: "week", label: "Week", previous: "last week" },
    { id: "month", label: "Month", previous: "last month" },
    { id: "quarter", label: "Quarter", previous: "last quarter" },
  ],
  people: [
    { id: "ana", name: "Ana Ruiz", detail: "West · Mid-market", scores: { week: sc([18400, 6, 52], [15100, 5, 61]), month: sc([61200, 21, 230], [58800, 19, 214]) } },
    { id: "tom", name: "Tom Becker", detail: "East · Enterprise", scores: { week: sc([22900, 3, 31], [24800, 4, 28]), month: sc([74100, 11, 140], [69900, 10, 151]) } },
    { id: "mei", name: "Mei Chen", detail: "West · SMB", scores: { week: sc([12750, 9, 88], [9800, 7, 70]), month: sc([47300, 33, 351], [51200, 31, 330]) } },
    { id: "raj", name: "Raj Patel", detail: "Central · Mid-market", scores: { week: sc([15600, 5, 47], [16900, 6, 45]), month: sc([55900, 18, 196], [49400, 17, 188]) } },
    { id: "lea", name: "Léa Martin", detail: "East · SMB", scores: { week: sc([9900, 7, 73], [11200, 8, 66]), month: sc([38800, 26, 290], [35100, 24, 277]) } },
    { id: "kofi", name: "Kofi Mensah", detail: "Central · SMB", scores: { week: sc([11300, 6, 64]), month: sc([29400, 19, 241]) } },
    { id: "sam", name: "Sam Okafor", detail: "West · Mid-market", scores: { week: sc([8200, 4, 58], [6900, 3, 49]), month: sc([33600, 14, 205], [36200, 15, 199]) } },
    { id: "ines", name: "Inês Costa", detail: "East · Mid-market", scores: { week: sc([7400, 3, 41], [8800, 4, 52]), month: sc([31900, 12, 176], [30300, 12, 168]) } },
    { id: "jon", name: "Jon Berg", detail: "Central · Enterprise", scores: { week: sc([5100, 1, 22], [12400, 2, 25]), month: sc([42700, 6, 98], [40100, 6, 102]) } },
  ] as LeaderPerson[],
};

export default function LeaderboardPreview() {
  const d = SAMPLE;
  const [loading, setLoading] = useState(false);
  const shownPeriod = useRef("week");
  const timer = useRef<number>(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <section className="fl-section fl-section--canvas" aria-labelledby="leaderboard-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="leaderboard-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <Leaderboard
          title={d.boardTitle}
          metrics={d.metrics}
          periods={d.periods}
          people={d.people}
          me={d.me}
          loading={loading}
          onChange={({ period }) => {
            // A new period fetches in a real app: show the gray rows for a moment.
            if (period === shownPeriod.current) return;
            shownPeriod.current = period;
            setLoading(true);
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => setLoading(false), 650);
          }}
        />
      </div>
    </section>
  );
}
