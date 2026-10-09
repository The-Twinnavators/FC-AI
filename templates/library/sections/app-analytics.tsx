/** @flowcode-library app-analytics · Analytics dashboard (App screens)
 * Use cases: analytics dashboard; website analytics; traffic report; kpi dashboard; reporting; metrics overview; marketing dashboard; admin home
 * Jobs to be done: see how my site is performing; compare traffic across date ranges; find my top pages; see where visitors come from
 * Keywords: app, dashboard, analytics, chart, kpi, table, sortable, date range
 */
/**
 * App screen: analytics dashboard. A whole screen with its own top bar (product name, pages, date range), a row of
 * KPI tiles with change against the previous period, a line chart with a hover and keyboard tooltip, a sortable table
 * of top pages and a bar list of traffic sources. Changing the range shows a loading state; a range with no visits
 * shows an empty state. Use it as the home screen of a reporting or back-office app. Make it the app's own: replace
 * SAMPLE with the app's real metrics, ranges and pages, and load the numbers from the app's data instead of SAMPLE.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  product: "Kiln Room",
  mark: "K",
  screen: "Website insights",
  nav: ["Overview", "Pages", "Sources", "Bookings"],
  menuLabel: "Open pages menu",
  rangeLabel: "Date range",
  loading: "Loading the numbers for this range",
  emptyTitle: "No visits yet today",
  emptyText: "Visits show up here a few minutes after they happen. Try a longer range to see recent trends.",
  emptyAction: "Show last 7 days",
  chartTitle: "Visitors",
  chartHint: "Hover the chart, or focus it and use the arrow keys, to read each day.",
  pagesTitle: "Top pages",
  sourcesTitle: "Where visitors came from",
  ranges: [
    { id: "today", label: "Today", empty: true },
    { id: "7d", label: "7 days", empty: false },
    { id: "30d", label: "30 days", empty: false },
    { id: "90d", label: "90 days", empty: false },
  ],
  data: {
    "7d": {
      kpis: [
        { label: "Visitors", value: "1,284", change: 8.2 },
        { label: "Class bookings", value: "96", change: 12.5 },
        { label: "Booking rate", value: "7.5%", change: 0.6 },
        { label: "Time on site", value: "2m 41s", change: -3.1 },
      ],
      points: [
        { label: "Mon 2 Oct", value: 164 },
        { label: "Tue 3 Oct", value: 152 },
        { label: "Wed 4 Oct", value: 188 },
        { label: "Thu 5 Oct", value: 201 },
        { label: "Fri 6 Oct", value: 176 },
        { label: "Sat 7 Oct", value: 229 },
        { label: "Sun 8 Oct", value: 174 },
      ],
      pages: [
        { path: "/classes/wheel-throwing", title: "Wheel throwing for beginners", views: 642, time: 184, bookings: 38 },
        { path: "/", title: "Home", views: 1120, time: 52, bookings: 9 },
        { path: "/classes/hand-building", title: "Hand-building evenings", views: 388, time: 141, bookings: 21 },
        { path: "/gift-cards", title: "Gift cards", views: 271, time: 96, bookings: 14 },
        { path: "/open-studio", title: "Open studio membership", views: 203, time: 167, bookings: 11 },
        { path: "/visit", title: "Find the studio", views: 158, time: 38, bookings: 0 },
      ],
      sources: [
        { name: "Search", visits: 512 },
        { name: "Direct", visits: 341 },
        { name: "Newsletter", visits: 208 },
        { name: "Social posts", visits: 147 },
        { name: "Local listings", visits: 76 },
      ],
    },
    "30d": {
      kpis: [
        { label: "Visitors", value: "5,431", change: 4.9 },
        { label: "Class bookings", value: "402", change: 9.1 },
        { label: "Booking rate", value: "7.4%", change: 0.3 },
        { label: "Time on site", value: "2m 47s", change: 1.2 },
      ],
      points: [
        { label: "Week of 11 Sep", value: 1180 },
        { label: "Week of 18 Sep", value: 1254 },
        { label: "Week of 25 Sep", value: 1342 },
        { label: "Week of 2 Oct", value: 1284 },
        { label: "This week", value: 371 },
      ],
      pages: [
        { path: "/classes/wheel-throwing", title: "Wheel throwing for beginners", views: 2710, time: 179, bookings: 161 },
        { path: "/", title: "Home", views: 4802, time: 49, bookings: 37 },
        { path: "/classes/hand-building", title: "Hand-building evenings", views: 1604, time: 138, bookings: 88 },
        { path: "/gift-cards", title: "Gift cards", views: 1022, time: 92, bookings: 52 },
        { path: "/open-studio", title: "Open studio membership", views: 911, time: 171, bookings: 49 },
        { path: "/visit", title: "Find the studio", views: 640, time: 41, bookings: 0 },
      ],
      sources: [
        { name: "Search", visits: 2204 },
        { name: "Direct", visits: 1420 },
        { name: "Newsletter", visits: 806 },
        { name: "Social posts", visits: 690 },
        { name: "Local listings", visits: 311 },
      ],
    },
    "90d": {
      kpis: [
        { label: "Visitors", value: "15,902", change: 21.4 },
        { label: "Class bookings", value: "1,138", change: 17.8 },
        { label: "Booking rate", value: "7.2%", change: -0.4 },
        { label: "Time on site", value: "2m 39s", change: 2.6 },
      ],
      points: [
        { label: "July", value: 4510 },
        { label: "August", value: 4870 },
        { label: "September", value: 5091 },
        { label: "October so far", value: 1431 },
      ],
      pages: [
        { path: "/classes/wheel-throwing", title: "Wheel throwing for beginners", views: 7930, time: 176, bookings: 452 },
        { path: "/", title: "Home", views: 13980, time: 51, bookings: 104 },
        { path: "/classes/hand-building", title: "Hand-building evenings", views: 4410, time: 140, bookings: 251 },
        { path: "/gift-cards", title: "Gift cards", views: 2240, time: 90, bookings: 133 },
        { path: "/open-studio", title: "Open studio membership", views: 2602, time: 169, bookings: 151 },
        { path: "/visit", title: "Find the studio", views: 1870, time: 40, bookings: 0 },
      ],
      sources: [
        { name: "Search", visits: 6420 },
        { name: "Direct", visits: 4110 },
        { name: "Newsletter", visits: 2380 },
        { name: "Social posts", visits: 2105 },
        { name: "Local listings", visits: 887 },
      ],
    },
  } as Record<string, Dataset>,
};

type Point = { label: string; value: number };
type PageRow = { path: string; title: string; views: number; time: number; bookings: number };
type Dataset = {
  kpis: { label: string; value: string; change: number }[];
  points: Point[];
  pages: PageRow[];
  sources: { name: string; visits: number }[];
};
type SortKey = "title" | "views" | "time" | "bookings";

const W = 960;
const H = 280;
const PAD = { top: 16, right: 16, bottom: 32, left: 48 };

function fmtTime(s: number) {
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

function niceMax(v: number) {
  const step = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil((v * 1.1) / step) * step;
}

export default function AppAnalytics() {
  const d = SAMPLE;
  const [range, setRange] = useState("7d");
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [page, setPage] = useState(d.nav[0]);
  const [active, setActive] = useState<number | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "ascending" | "descending" }>({ key: "views", dir: "descending" });
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function pickRange(id: string) {
    if (id === range) return;
    setRange(id);
    setActive(null);
    setLoading(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setLoading(false), 700);
  }

  const meta = d.ranges.find((r) => r.id === range)!;
  const data = meta.empty ? null : d.data[range];

  const max = data ? niceMax(Math.max(...data.points.map((p) => p.value))) : 1;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const xs = data ? data.points.map((_, i) => PAD.left + (data.points.length === 1 ? innerW / 2 : (i * innerW) / (data.points.length - 1))) : [];
  const ys = data ? data.points.map((p) => PAD.top + innerH - (p.value / max) * innerH) : [];
  const line = xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(" ");
  const area = xs.length ? `${line} L${xs[xs.length - 1].toFixed(1)} ${PAD.top + innerH} L${xs[0].toFixed(1)} ${PAD.top + innerH} Z` : "";
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));

  function onChartMove(e: MouseEvent<SVGSVGElement>) {
    if (!data) return;
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    xs.forEach((px, i) => {
      if (Math.abs(px - x) < Math.abs(xs[best] - x)) best = i;
    });
    setActive(best);
  }

  function onChartKey(e: KeyboardEvent<SVGSVGElement>) {
    if (!data) return;
    const last = data.points.length - 1;
    if (e.key === "ArrowRight") setActive((a) => (a === null ? 0 : Math.min(last, a + 1)));
    else if (e.key === "ArrowLeft") setActive((a) => (a === null ? last : Math.max(0, a - 1)));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(last);
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  }

  function sortBy(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "ascending" ? "descending" : "ascending" } : { key, dir: key === "title" ? "ascending" : "descending" }));
  }

  const rows = data
    ? [...data.pages].sort((a, b) => {
        const av = a[sort.key];
        const bv = b[sort.key];
        const c = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
        return sort.dir === "ascending" ? c : -c;
      })
    : [];
  const sourceMax = data ? Math.max(...data.sources.map((s) => s.visits)) : 1;
  const sourceTotal = data ? data.sources.reduce((n, s) => n + s.visits, 0) : 1;

  const cols: { key: SortKey; label: string; num: boolean }[] = [
    { key: "title", label: "Page", num: false },
    { key: "views", label: "Views", num: true },
    { key: "time", label: "Avg. time", num: true },
    { key: "bookings", label: "Bookings", num: true },
  ];

  return (
    <div className="fl-as-app">
      <header className="fl-as-top">
        <div className="fl-as-brand">
          <span className="fl-as-mark" aria-hidden="true">
            {d.mark}
          </span>
          <span className="fl-as-brand__name">{d.product}</span>
        </div>
        <button type="button" className="fl-as-iconbtn fl-as-menubtn" aria-expanded={menuOpen} aria-controls="fl-as-an-nav" onClick={() => setMenuOpen((o) => !o)}>
          <Icon name="menu" />
          <span className="fl-sr">{d.menuLabel}</span>
        </button>
        <nav id="fl-as-an-nav" className="fl-as-topnav" data-open={menuOpen} aria-label={d.product}>
          <ul>
            {d.nav.map((n) => (
              <li key={n}>
                <a
                  href={`#${n.toLowerCase()}`}
                  aria-current={page === n ? "page" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    setPage(n);
                    setMenuOpen(false);
                  }}
                >
                  {n}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="fl-as-main">
        <div className="fl-as-pagehead">
          <div>
            <p className="fl-eyebrow">{page}</p>
            <h1 className="fl-as-h1">{d.screen}</h1>
          </div>
          <div className="fl-toggle fl-as-range" role="group" aria-label={d.rangeLabel}>
            {d.ranges.map((r) => (
              <button key={r.id} type="button" aria-pressed={range === r.id} onClick={() => pickRange(r.id)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <p className="fl-sr" aria-live="polite">
          {loading ? d.loading : `${d.screen}, ${meta.label}`}
        </p>

        {loading ? (
          <div className="fl-as-stack" aria-busy="true">
            <div className="fl-as-kpis">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="fl-as-panel fl-as-kpi">
                  <span className="fl-as-skel" style={{ width: "50%" }} />
                  <span className="fl-as-skel fl-as-skel--lg" style={{ width: "70%" }} />
                </div>
              ))}
            </div>
            <div className="fl-as-panel">
              <span className="fl-as-skel fl-as-skel--block" />
            </div>
          </div>
        ) : !data ? (
          <div className="fl-as-panel fl-as-empty">
            <span className="fl-icon">
              <Icon name="chart" />
            </span>
            <h2 className="fl-as-h2">{d.emptyTitle}</h2>
            <p className="fl-text">{d.emptyText}</p>
            <button type="button" className="fl-btn fl-btn--primary" onClick={() => pickRange("7d")}>
              {d.emptyAction}
            </button>
          </div>
        ) : (
          <div className="fl-as-stack">
            <ul className="fl-as-kpis">
              {data.kpis.map((k) => {
                const up = k.change >= 0;
                return (
                  <li key={k.label} className="fl-as-panel fl-as-kpi">
                    <span className="fl-meta">{k.label}</span>
                    <strong>{k.value}</strong>
                    <span className={`fl-as-delta ${up ? "fl-as-delta--up" : "fl-as-delta--down"}`}>
                      <span aria-hidden="true">{up ? "▲" : "▼"}</span> {Math.abs(k.change)}%<span className="fl-sr"> {up ? "up" : "down"} on the previous period</span>
                    </span>
                  </li>
                );
              })}
            </ul>

            <section className="fl-as-panel" aria-labelledby="fl-as-an-chart">
              <div className="fl-as-panelhead">
                <h2 id="fl-as-an-chart" className="fl-as-h2">
                  {d.chartTitle}
                </h2>
                <span className="fl-meta">{d.chartHint}</span>
              </div>
              <div className="fl-as-chart">
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  role="img"
                  tabIndex={0}
                  aria-label={`${d.chartTitle}, ${meta.label}: ${data.points.map((p) => `${p.label} ${p.value.toLocaleString()}`).join(", ")}`}
                  onMouseMove={onChartMove}
                  onMouseLeave={() => setActive(null)}
                  onKeyDown={onChartKey}
                  onBlur={() => setActive(null)}
                >
                  {ticks.map((t) => {
                    const y = PAD.top + innerH - (t / max) * innerH;
                    return (
                      <g key={t}>
                        <line className="fl-as-chart__grid" x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} />
                        <text className="fl-as-chart__axis" x={PAD.left - 8} y={y + 4} textAnchor="end">
                          {t.toLocaleString()}
                        </text>
                      </g>
                    );
                  })}
                  {data.points.map((p, i) => (
                    <text key={p.label} className="fl-as-chart__axis" x={xs[i]} y={H - 10} textAnchor={i === 0 ? "start" : i === data.points.length - 1 ? "end" : "middle"}>
                      {p.label.split(" ").slice(0, 2).join(" ")}
                    </text>
                  ))}
                  <path className="fl-as-chart__area" d={area} />
                  <path className="fl-as-chart__line" d={line} />
                  {active !== null && <line className="fl-as-chart__cursor" x1={xs[active]} x2={xs[active]} y1={PAD.top} y2={PAD.top + innerH} />}
                  {xs.map((x, i) => (
                    <circle key={i} className="fl-as-chart__dot" data-active={active === i} cx={x} cy={ys[i]} r={active === i ? 6 : 4} />
                  ))}
                </svg>
                {active !== null && (
                  <div
                    className="fl-as-tip"
                    role="status"
                    style={{ left: `${(xs[active] / W) * 100}%`, top: `${(ys[active] / H) * 100}%` }}
                    data-edge={active === 0 ? "start" : active === data.points.length - 1 ? "end" : undefined}
                  >
                    <span className="fl-meta">{data.points[active].label}</span>
                    <strong>{data.points[active].value.toLocaleString()} visitors</strong>
                  </div>
                )}
              </div>
            </section>

            <div className="fl-as-two">
              <section className="fl-as-panel" aria-labelledby="fl-as-an-pages">
                <div className="fl-as-panelhead">
                  <h2 id="fl-as-an-pages" className="fl-as-h2">
                    {d.pagesTitle}
                  </h2>
                </div>
                <div className="fl-as-scroll">
                  <table className="fl-as-tbl">
                    <caption className="fl-sr">
                      {d.pagesTitle}, {meta.label}. Column headers sort the table.
                    </caption>
                    <thead>
                      <tr>
                        {cols.map((c) => (
                          <th key={c.key} scope="col" aria-sort={sort.key === c.key ? sort.dir : "none"} className={c.num ? "fl-as-num" : undefined}>
                            <button type="button" className="fl-as-sort" onClick={() => sortBy(c.key)}>
                              {c.label}
                              <span aria-hidden="true">{sort.key === c.key ? (sort.dir === "ascending" ? "↑" : "↓") : "↕"}</span>
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.path}>
                          <th scope="row">
                            <span className="fl-as-cell-title">{r.title}</span>
                            <span className="fl-as-cell-sub">{r.path}</span>
                          </th>
                          <td className="fl-as-num">{r.views.toLocaleString()}</td>
                          <td className="fl-as-num">{fmtTime(r.time)}</td>
                          <td className="fl-as-num">{r.bookings.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="fl-as-panel" aria-labelledby="fl-as-an-sources">
                <div className="fl-as-panelhead">
                  <h2 id="fl-as-an-sources" className="fl-as-h2">
                    {d.sourcesTitle}
                  </h2>
                </div>
                <ul className="fl-as-bars">
                  {data.sources.map((s) => (
                    <li key={s.name}>
                      <div className="fl-as-bars__row">
                        <span>{s.name}</span>
                        <span className="fl-as-bars__val">
                          {s.visits.toLocaleString()} <span className="fl-meta">({Math.round((s.visits / sourceTotal) * 100)}%)</span>
                        </span>
                      </div>
                      <span className="fl-as-bars__track" aria-hidden="true">
                        <span className="fl-as-bars__fill" style={{ width: `${(s.visits / sourceMax) * 100}%` }} />
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
