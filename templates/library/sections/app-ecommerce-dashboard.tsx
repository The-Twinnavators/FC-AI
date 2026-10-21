/** @flowcode-library app-ecommerce-dashboard · eCommerce dashboard (App screens)
 * Catalog ID: t.app-ecommerce-dashboard (template)
 * Function: A store owner's eCommerce dashboard screen (t.app-ecommerce-dashboard) assembled from the app top nav, KPI cards, the bar chart, the gauge, the area chart, progress bars and the data table, with loading and empty states.
 * Use it as: Copy app-ecommerce-dashboard.tsx (FlowCode brings the patterns and components it uses); replace SAMPLE with the shop's own figures, monthly target, countries and orders, and load them from the app's data.
 * Built from: p.top-nav.app, c.segmented.toggle, c.segmented.segmented, c.kpi, c.bar-chart, c.gauge, c.badge.status, c.area-chart, c.progress.bar, p.data-table
 * Look: A top bar with a year switch, two KPI tiles above monthly sales bars beside a monthly-target ring with three figures, sales and revenue areas with an Overview / Sales / Revenue switch, and a recent orders table with status badges beside customers by country as bars.
 * Use cases: ecommerce dashboard; store dashboard; shop admin home; sales overview; order management; seller dashboard; retail metrics; back office
 * Jobs to be done: see how my store is doing; check sales against this month's target; find recent orders and their status; see where my customers are
 * Keywords: app, dashboard, ecommerce, store, sales, orders, chart, kpi, table
 */
/**
 * App screen: eCommerce dashboard. A whole store-owner home screen with its own top bar (shop name, pages, year), two
 * KPI tiles (customers and orders, with their change), monthly sales as bars, progress toward this month's revenue
 * target as a ring, sales and revenue over the year as areas with an Overview / Sales / Revenue switch, customers by
 * country as bars, and a recent orders table with a status filter. Changing the year shows a loading state; a status
 * with no orders shows the table's empty state. Use it as the home screen of a shop's back office. Make it the app's
 * own: replace SAMPLE with the shop's real figures, countries and orders, and load them from the app's data.
 * Assembled from: p.top-nav.app > c.segmented.toggle (year) > c.kpi x2 > c.bar-chart (monthly sales) + c.gauge (monthly
 * target, with c.badge.status) > c.area-chart (statistics, c.segmented.segmented switch) > customers by country (inline,
 * each bar is c.progress.bar) + p.data-table bare (recent orders, c.badge.status per row, c.segmented.segmented filter).
 * Adapted from TailAdmin (MIT License, Copyright (c) 2023 TailAdmin): the eCommerce dashboard (index.html). Its vector
 * map is replaced by a ranked country list, so the screen needs no map library.
 */
import { useEffect, useRef, useState } from "react";
import { TopNav } from "./top-nav-variants";
import { Kpi } from "./card-kpi";
import { BarChart } from "./chart-bar";
import { Gauge } from "./chart-radial-gauge";
import { AreaChart } from "./chart-area";
import { DataTable, type TableColumn } from "./tables-states";
import { Badge, type BadgeTone } from "./badges-status";
import { Progress } from "./progress-indicators";
import { Segmented } from "./segmented-control";

// flowcode:sample
const SAMPLE = {
  product: "Fernhill Supply",
  screen: "Store overview",
  nav: ["Dashboard", "Orders", "Products", "Customers"],
  yearLabel: "Year",
  loading: "Loading this year's figures",
  months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  salesTitle: "Monthly sales",
  salesSeries: "Orders",
  salesHint: "Hover a bar, or tab to it and use the arrow keys, to read each month.",
  targetTitle: "Monthly target",
  targetLede: "Revenue against the goal set for this month",
  statsTitle: "Statistics",
  statsLede: "Gross sales and net revenue, in thousands of dollars",
  statsViews: [
    { value: "overview", label: "Overview" },
    { value: "sales", label: "Sales" },
    { value: "revenue", label: "Revenue" },
  ],
  countriesTitle: "Customers by country",
  countriesLede: "Where this year's customers live",
  ordersTitle: "Recent orders",
  orderFilters: [
    { value: "all", label: "All" },
    { value: "Delivered", label: "Delivered" },
    { value: "Pending", label: "Pending" },
    { value: "Canceled", label: "Canceled" },
    { value: "Returned", label: "Returned" },
  ],
  ordersEmpty: "No orders with this status",
  ordersEmptyHint: "Pick All to see every recent order.",
  years: [
    {
      year: "2025",
      customers: { value: "3,412", change: 6.4 },
      orders: { value: "4,915", change: 3.2 },
      sales: [312, 344, 368, 391, 377, 402, 426, 398, 441, 489, 562, 605],
      target: { goal: 52000, revenue: 47100, today: 2840, change: 4.1, goalChange: -2.0, revenueChange: 5.6, todayChange: 3.3 },
      stats: {
        sales: [24.1, 26.3, 28.0, 29.8, 28.9, 30.7, 32.4, 30.2, 33.6, 37.1, 42.8, 46.0],
        revenue: [18.2, 19.9, 21.4, 22.7, 21.9, 23.5, 24.8, 23.0, 25.7, 28.4, 32.9, 35.6],
      },
      countries: [
        { name: "United States", customers: 1784 },
        { name: "Canada", customers: 602 },
        { name: "United Kingdom", customers: 455 },
        { name: "Germany", customers: 318 },
        { name: "Australia", customers: 253 },
      ],
    },
    {
      year: "2026",
      customers: { value: "3,782", change: 11.0 },
      orders: { value: "5,359", change: -9.1 },
      sales: [366, 381, 409, 437, 421, 468, 492, 455, 517],
      target: { goal: 48000, revenue: 36250, today: 3287, change: 10.0, goalChange: -8.0, revenueChange: 12.4, todayChange: 9.6 },
      stats: {
        sales: [27.9, 29.4, 31.8, 33.5, 32.6, 36.2, 38.0, 35.1, 39.9],
        revenue: [21.1, 22.6, 24.5, 25.8, 25.0, 27.9, 29.4, 27.1, 30.8],
      },
      countries: [
        { name: "United States", customers: 1951 },
        { name: "Canada", customers: 688 },
        { name: "United Kingdom", customers: 512 },
        { name: "Germany", customers: 371 },
        { name: "Australia", customers: 260 },
      ],
    },
  ],
  orders: [
    { id: "FS-10482", product: "Waxed canvas field jacket", options: "2 sizes", category: "Outerwear", price: 248, status: "Delivered" },
    { id: "FS-10481", product: "Merino trail hoodie", options: "1 size", category: "Knitwear", price: 129, status: "Pending" },
    { id: "FS-10480", product: "Copper camp kettle", options: "1 size", category: "Camp kitchen", price: 86, status: "Delivered" },
    { id: "FS-10479", product: "Leather map case", options: "2 colors", category: "Accessories", price: 64, status: "Canceled" },
    { id: "FS-10478", product: "Wool blanket, Highland check", options: "1 size", category: "Home", price: 158, status: "Delivered" },
  ],
};

type OrderStatus = "Delivered" | "Pending" | "Canceled" | "Returned";
type OrderRow = { id: string; product: string; options: string; category: string; price: number; status: OrderStatus };
const STATUS_TONE: Record<OrderStatus, BadgeTone> = { Delivered: "success", Pending: "warning", Canceled: "danger", Returned: "neutral" };

const money = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const thousands = (n: number) => `$${n >= 1000 ? `${(n / 1000).toFixed(n % 1000 ? 1 : 0)}K` : n}`;
const signed = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;

export default function AppEcommerceDashboard() {
  const d = SAMPLE;
  const [year, setYear] = useState(d.years[d.years.length - 1].year);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(d.nav[0]);
  const [view, setView] = useState("overview");
  const [status, setStatus] = useState("all");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function pickYear(next: string) {
    if (next === year) return;
    setYear(next);
    setLoading(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setLoading(false), 700);
  }

  const data = d.years.find((y) => y.year === year) ?? d.years[0];
  const labels = d.months.slice(0, data.sales.length);
  const t = data.target;
  const statsSeries = [
    { name: "Sales", points: data.stats.sales, tone: "accent" as const },
    { name: "Revenue", points: data.stats.revenue, tone: "success" as const },
  ].filter((s) => view === "overview" || s.name.toLowerCase() === view);
  const viewLabel = d.statsViews.find((v) => v.value === view)?.label ?? "";
  const countryTotal = data.countries.reduce((n, c) => n + c.customers, 0);

  const orders = (d.orders as OrderRow[]).filter((o) => status === "all" || o.status === status);
  const cols: TableColumn<OrderRow>[] = [
    {
      id: "product",
      label: "Product",
      render: (r) => (
        <>
          <span className="fl-as-cell-title">{r.product}</span>
          <span className="fl-as-cell-sub">{r.options}</span>
        </>
      ),
    },
    { id: "category", label: "Category" },
    { id: "price", label: "Price", num: true, render: (r) => money(r.price) },
    {
      id: "status",
      label: "Status",
      render: (r) => (
        <Badge tone={STATUS_TONE[r.status]} led>
          {r.status}
        </Badge>
      ),
    },
  ];

  const figures = [
    { label: "Target", value: thousands(t.goal), change: t.goalChange },
    { label: "Revenue", value: thousands(t.revenue), change: t.revenueChange },
    { label: "Today", value: money(t.today), change: t.todayChange },
  ];

  return (
    <div className="fl-as-app fl-as-app--canvas">
      <TopNav variant="app" brand={d.product} links={d.nav.map((n) => ({ label: n }))} current={page} onSelect={setPage} />

      <main className="fl-as-main">
        <div className="fl-as-pagehead">
          <div>
            <p className="fl-eyebrow">{page}</p>
            <h1 className="fl-as-h1">{d.screen}</h1>
          </div>
          <Segmented variant="toggle" className="fl-as-range" label={d.yearLabel} options={d.years.map((y) => ({ value: y.year, label: y.year }))} value={year} onChange={pickYear} />
        </div>

        <p className="fl-sr" aria-live="polite">
          {loading ? d.loading : `${d.screen}, ${year}`}
        </p>

        {loading ? (
          <div className="fl-as-stack" aria-busy="true">
            <div className="fl-as-two">
              <div className="fl-as-stack">
                <div className="fl-as-kpis fl-as-ec-kpis">
                  {[0, 1].map((i) => (
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
              <div className="fl-as-panel">
                <span className="fl-as-skel fl-as-skel--block" />
              </div>
            </div>
            <div className="fl-as-panel">
              <span className="fl-as-skel fl-as-skel--block" />
            </div>
          </div>
        ) : (
          <div className="fl-as-stack">
            <div className="fl-as-two">
              <div className="fl-as-stack">
                <div className="fl-as-kpis fl-as-ec-kpis">
                  <Kpi label="Customers" value={data.customers.value} change={data.customers.change} period="last year" />
                  <Kpi label="Orders" value={data.orders.value} change={data.orders.change} period="last year" />
                </div>

                <section className="fl-as-panel" aria-labelledby="fl-as-ec-sales">
                  <div className="fl-as-panelhead">
                    <h2 id="fl-as-ec-sales" className="fl-as-h2">
                      {d.salesTitle}
                    </h2>
                  </div>
                  <BarChart
                    key={year}
                    className="fl-as-ec-bare"
                    title={d.salesTitle}
                    summary={`${d.salesTitle}, ${year}`}
                    labels={labels}
                    series={[{ name: d.salesSeries, points: data.sales }]}
                    formatY={(n) => n.toLocaleString()}
                    hint={d.salesHint}
                  />
                </section>
              </div>

              <section className="fl-as-panel fl-as-ec-target" aria-labelledby="fl-as-ec-target">
                <div>
                  <h2 id="fl-as-ec-target" className="fl-as-h2">
                    {d.targetTitle}
                  </h2>
                  <p className="fl-meta">{d.targetLede}</p>
                </div>
                <div className="fl-as-ec-ring">
                  <Gauge value={t.revenue} max={t.goal} label={`${d.targetTitle}, revenue against goal`} size="lg" />
                  <Badge tone={t.change >= 0 ? "success" : "danger"}>
                    <span aria-hidden="true">{signed(t.change)}</span>
                    <span className="fl-sr">
                      {t.change >= 0 ? "Up" : "Down"} {Math.abs(t.change).toFixed(1)}% on last month
                    </span>
                  </Badge>
                </div>
                <p className="fl-as-ec-note">
                  {money(t.today)} earned today, {t.todayChange >= 0 ? "more" : "less"} than the same day last month.
                </p>
                <dl className="fl-as-ec-figures">
                  {figures.map((f) => (
                    <div key={f.label}>
                      <dt>{f.label}</dt>
                      <dd>
                        {f.value}
                        <span className={f.change >= 0 ? "fl-as-ec-up" : "fl-as-ec-down"}>
                          <span aria-hidden="true">{f.change >= 0 ? "▲" : "▼"}</span>
                          <span className="fl-sr">{f.change >= 0 ? "up" : "down"} {Math.abs(f.change).toFixed(1)}%</span>
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>

            <section className="fl-as-panel" aria-labelledby="fl-as-ec-stats">
              <div className="fl-as-panelhead">
                <div>
                  <h2 id="fl-as-ec-stats" className="fl-as-h2">
                    {d.statsTitle}
                  </h2>
                  <p className="fl-meta">{d.statsLede}</p>
                </div>
                <Segmented size="sm" label={d.statsTitle} options={d.statsViews} value={view} onChange={setView} />
              </div>
              <AreaChart
                key={`${year}-${view}`}
                className="fl-as-ec-bare"
                title={d.statsTitle}
                summary={`${d.statsTitle}, ${viewLabel}, ${year}`}
                labels={labels}
                series={statsSeries}
                formatY={(n) => `$${n}K`}
                xLabel="Month"
              />
            </section>

            <div className="fl-as-two">
              <section className="fl-as-panel" aria-labelledby="fl-as-ec-orders">
                <div className="fl-as-panelhead">
                  <h2 id="fl-as-ec-orders" className="fl-as-h2">
                    {d.ordersTitle}
                  </h2>
                  <Segmented size="sm" label={`${d.ordersTitle} by status`} options={d.orderFilters} value={status} onChange={setStatus} className="fl-as-range" />
                </div>
                <DataTable caption={`${d.ordersTitle}, ${status === "all" ? "all statuses" : status}`} columns={cols} rows={orders} bare sortable={false} emptyTitle={d.ordersEmpty} emptyHint={d.ordersEmptyHint} emptyAction="Show all" onEmptyAction={() => setStatus("all")} />
              </section>

              <section className="fl-as-panel" aria-labelledby="fl-as-ec-countries">
                <div>
                  <h2 id="fl-as-ec-countries" className="fl-as-h2">
                    {d.countriesTitle}
                  </h2>
                  <p className="fl-meta">{d.countriesLede}</p>
                </div>
                <ul className="fl-as-bars">
                  {data.countries.map((c) => {
                    const pct = Math.round((c.customers / countryTotal) * 100);
                    return (
                      <li key={c.name}>
                        <div className="fl-as-bars__row">
                          <span>{c.name}</span>
                          <span className="fl-as-bars__val">
                            {c.customers.toLocaleString()} <span className="fl-meta">({pct}%)</span>
                          </span>
                        </div>
                        <Progress value={pct} label={`${c.name}, ${c.customers.toLocaleString()} customers, ${pct}%`} thin />
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
