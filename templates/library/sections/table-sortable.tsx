/** @flowcode-library table-sortable · Sortable table (Tables and lists)
 * Use cases: data table; report table; sales report; leaderboard; budget breakdown; price list; inventory list; expense report
 * Jobs to be done: sort data to find the highest values; compare figures across rows; see the total at a glance; review numbers in a report
 * Keywords: table, sort, data, numbers
 */
/**
 * Table: sortable columns. A clean data table with a caption, click-to-sort headers (aria-sort) and tabular numbers
 * that line up, plus a total row. Use it for any list people compare by a column: bookings, orders, invoices.
 * Make it the app's own: replace SAMPLE with real columns and rows; set `numeric` on columns that hold amounts.
 */
import { useMemo, useState } from "react";

// flowcode:sample
const SAMPLE = {
  title: "Studio bookings this week",
  meta: "Select a column heading to sort. Select it again to reverse.",
  columns: [
    { key: "client", label: "Client", numeric: false },
    { key: "service", label: "Service", numeric: false },
    { key: "date", label: "Date", numeric: false },
    { key: "hours", label: "Hours", numeric: true },
    { key: "amount", label: "Amount", numeric: true },
  ],
  rows: [
    { id: "b1", client: "Maya Okafor", service: "Portrait session", date: "2026-10-05", dateLabel: "Mon 5 Oct", hours: 1.5, amount: 180 },
    { id: "b2", client: "Tom Reyes", service: "Product shoot", date: "2026-10-06", dateLabel: "Tue 6 Oct", hours: 4, amount: 520 },
    { id: "b3", client: "Ana Lindqvist", service: "Headshots", date: "2026-10-06", dateLabel: "Tue 6 Oct", hours: 1, amount: 95 },
    { id: "b4", client: "Corner Bakery", service: "Menu photos", date: "2026-10-08", dateLabel: "Thu 8 Oct", hours: 3, amount: 360 },
    { id: "b5", client: "Jonah Patel", service: "Family session", date: "2026-10-09", dateLabel: "Fri 9 Oct", hours: 2, amount: 240 },
    { id: "b6", client: "Elif Demir", service: "Studio hire", date: "2026-10-10", dateLabel: "Sat 10 Oct", hours: 6, amount: 300 },
  ],
  currency: "$",
  totalLabel: "Total",
  emptyTitle: "No bookings this week",
  emptyText: "New bookings show up here as soon as they are made.",
};

type Row = (typeof SAMPLE.rows)[number];
type Key = "client" | "service" | "date" | "hours" | "amount";

function SortIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M6 11l6-6 6 6" />
    </svg>
  );
}

export default function TableSortable() {
  const d = SAMPLE;
  const [sort, setSort] = useState<{ key: Key; dir: "ascending" | "descending" }>({ key: "date", dir: "ascending" });

  const rows = useMemo(() => {
    const out = [...d.rows];
    out.sort((a: Row, b: Row) => {
      const x = a[sort.key];
      const y = b[sort.key];
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return sort.dir === "ascending" ? c : -c;
    });
    return out;
  }, [d.rows, sort]);

  const money = (n: number) => `${d.currency}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const totalHours = d.rows.reduce((s, r) => s + r.hours, 0);
  const totalAmount = d.rows.reduce((s, r) => s + r.amount, 0);
  const sortedLabel = d.columns.find((c) => c.key === sort.key)?.label ?? "";

  function toggle(key: Key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "ascending" ? "descending" : "ascending" } : { key, dir: "ascending" }));
  }

  return (
    <section className="fl-section" aria-labelledby="table-sortable-title">
      <div className="fl-wrap">
        <div className="fl-tbl-panel">
          <div className="fl-tbl-scroll" tabIndex={0} role="region" aria-labelledby="table-sortable-title">
            <table className="fl-tbl-table">
              <caption>
                <span id="table-sortable-title" className="fl-tbl-caption-title">
                  {d.title}
                </span>
                <span className="fl-tbl-caption-meta">{d.meta}</span>
              </caption>
              <thead>
                <tr>
                  {d.columns.map((c) => (
                    <th key={c.key} scope="col" className={c.numeric ? "fl-tbl-num" : undefined} aria-sort={sort.key === c.key ? sort.dir : "none"}>
                      <button type="button" className="fl-tbl-sort" onClick={() => toggle(c.key as Key)}>
                        {c.label}
                        <SortIcon />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={d.columns.length} className="fl-tbl-empty-cell">
                      <div className="fl-tbl-empty">
                        <strong>{d.emptyTitle}</strong>
                        <span>{d.emptyText}</span>
                      </div>
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id}>
                    <th scope="row">{r.client}</th>
                    <td>{r.service}</td>
                    <td className="fl-tbl-nowrap">
                      <time dateTime={r.date}>{r.dateLabel}</time>
                    </td>
                    <td className="fl-tbl-num">{r.hours.toFixed(1)}</td>
                    <td className="fl-tbl-num">{money(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
              <tfoot>
                <tr>
                  <th scope="row" colSpan={3}>
                    {d.totalLabel}
                  </th>
                  <td className="fl-tbl-num">{totalHours.toFixed(1)}</td>
                  <td className="fl-tbl-num">{money(totalAmount)}</td>
                </tr>
              </tfoot>
              )}
            </table>
          </div>
        </div>
        <p className="fl-sr" aria-live="polite">
          Sorted by {sortedLabel}, {sort.dir}.
        </p>
      </div>
    </section>
  );
}
