/** @flowcode-library app-analytics · Analytics dashboard (App screens)
 * Catalog ID: t.app-analytics (template)
 * Function: An analytics dashboard screen (t.app-analytics) assembled from the app top nav, KPI cards, the area chart, the data table and progress bars, with loading and empty states.
 * Use it as: Copy app-analytics.tsx (FlowCode brings the patterns and components it uses); replace SAMPLE with the app's own metrics, date ranges, pages and traffic sources, and load the numbers from the app's data.
 * Built from: p.top-nav.app, c.kpi, c.area-chart, p.data-table, c.progress.bar, c.empty-state.no-results, c.button.primary
 * Look: A top bar with page links, a date-range switch, four KPI tiles, a smooth area chart with a hover tooltip, a sortable top-pages table beside a bar list of traffic sources.
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
 * Assembled from: p.top-nav.app > date range toggle (inline) > c.kpi x4 > c.area-chart > p.data-table (top pages) +
 * sources bars (inline, each bar is c.progress.bar). The empty state is c.empty-state with a c.button.
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "./buttons-variants";
import { TopNav } from "./top-nav-variants";
import { Kpi } from "./card-kpi";
import { AreaChart } from "./chart-area";
import { DataTable, type TableColumn } from "./tables-states";
import { EmptyState } from "./empty-states";
import { Progress } from "./progress-indicators";

// flowcode:sample
const SAMPLE = {
  product: "Kiln Room",
  mark: "K",
  screen: "Website insights",
  nav: ["Overview", "Pages", "Sources", "Bookings"],
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
type PageTableRow = PageRow & { id: string };

function fmtTime(s: number) {
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

export default function AppAnalytics() {
  const d = SAMPLE;
  const [range, setRange] = useState("7d");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(d.nav[0]);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function pickRange(id: string) {
    if (id === range) return;
    setRange(id);
    setLoading(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setLoading(false), 700);
  }

  const meta = d.ranges.find((r) => r.id === range)!;
  const data = meta.empty ? null : d.data[range];

  const rows: PageTableRow[] = data ? data.pages.map((p) => ({ ...p, id: p.path })) : [];
  const sourceMax = data ? Math.max(...data.sources.map((s) => s.visits)) : 1;
  const sourceTotal = data ? data.sources.reduce((n, s) => n + s.visits, 0) : 1;

  const cols: TableColumn<PageTableRow>[] = [
    {
      id: "title",
      label: "Page",
      render: (r) => (
        <>
          <span className="fl-as-cell-title">{r.title}</span>
          <span className="fl-as-cell-sub">{r.path}</span>
        </>
      ),
    },
    { id: "views", label: "Views", num: true, render: (r) => r.views.toLocaleString() },
    { id: "time", label: "Avg. time", num: true, render: (r) => fmtTime(r.time) },
    { id: "bookings", label: "Bookings", num: true, render: (r) => r.bookings.toLocaleString() },
  ];

  return (
    <div className="fl-as-app">
      <TopNav variant="app" brand={d.product} links={d.nav.map((n) => ({ label: n }))} current={page} onSelect={setPage} />

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
          <div className="fl-as-panel">
            <EmptyState variant="no-results" icon="chart" title={d.emptyTitle} headingLevel={2} action={<Button onClick={() => pickRange("7d")}>{d.emptyAction}</Button>}>
              {d.emptyText}
            </EmptyState>
          </div>
        ) : (
          <div className="fl-as-stack">
            <div className="fl-as-kpis">
              {data.kpis.map((k) => (
                <Kpi key={k.label} label={k.label} value={k.value} change={k.change} period="the previous period" />
              ))}
            </div>

            <AreaChart
              key={range}
              title={d.chartTitle}
              summary={`${d.chartTitle}, ${meta.label}`}
              labels={data.points.map((p) => p.label)}
              series={[{ name: d.chartTitle, points: data.points.map((p) => p.value) }]}
              formatY={(n) => n.toLocaleString()}
              xLabel="Period"
              hint={d.chartHint}
            />

            <div className="fl-as-two">
              <section className="fl-as-panel" aria-labelledby="fl-as-an-pages">
                <div className="fl-as-panelhead">
                  <h2 id="fl-as-an-pages" className="fl-as-h2">
                    {d.pagesTitle}
                  </h2>
                </div>
                <DataTable caption={`${d.pagesTitle}, ${meta.label}. Column headers sort the table.`} columns={cols} rows={rows} defaultSort={{ col: "views", up: false }} />
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
                      <Progress value={Math.round((s.visits / sourceMax) * 100)} label={`${s.name}, ${s.visits.toLocaleString()} visits`} thin />
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
