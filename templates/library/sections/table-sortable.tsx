/** @flowcode-library table-sortable · Sortable table (sortable) (Tables and lists)
 * Catalog ID: p.data-table@sortable (pattern version)
 * Version of: p.data-table
 * Function: A clean data table with a caption, click-to-sort column headers, tabular numbers and a total row.
 * Use it as: import { DataTable } from "./tables-states"; <DataTable version="sortable" caption="Bookings" captionMeta?="Select a heading to sort" columns={[{ id, label, num?, nowrap?, render?, total? }]} rows={[{ id, ... }]} defaultSort?={{ col, up }} />
 * Look: A framed report table under a large visible caption with a hint line; every heading is a button with a small arrow that turns to show the order, numbers line up on the right and a total row closes the table.
 * Tokens: --color-surface --color-border --color-border-strong --color-text-muted --color-accent --text-sm --text-lg --space-3 --space-4 --space-5
 * Use cases: data table; report table; sales report; leaderboard; budget breakdown; price list; inventory list; expense report
 * Jobs to be done: sort data to find the highest values; compare figures across rows; see the total at a glance; review numbers in a report
 * Keywords: table, sort, data, numbers
 */
/**
 * Table: sortable columns. This is p.data-table@sortable with this piece's sample content; the implementation lives in
 * the pattern, in ./tables-states. A clean data table with a caption, click-to-sort headers (aria-sort) and tabular
 * numbers that line up, plus a total row. Use it for any list people compare by a column: bookings, orders, invoices.
 * Make it the app's own: replace SAMPLE with real columns and rows; set `num` on columns that hold amounts.
 */
import { DataTable, type TableColumn } from "./tables-states";

// flowcode:sample
const SAMPLE = {
  title: "Studio bookings this week",
  meta: "Select a column heading to sort. Select it again to reverse.",
  rows: [
    { id: "b1", client: "Maya Okafor", service: "Portrait session", date: "2026-10-05", dateLabel: "Mon 5 Oct", hours: 1.5, amount: 180 },
    { id: "b2", client: "Tom Reyes", service: "Product shoot", date: "2026-10-06", dateLabel: "Tue 6 Oct", hours: 4, amount: 520 },
    { id: "b3", client: "Ana Lindqvist", service: "Headshots", date: "2026-10-06", dateLabel: "Tue 6 Oct", hours: 1, amount: 95 },
    { id: "b4", client: "Corner Bakery", service: "Menu photos", date: "2026-10-08", dateLabel: "Thu 8 Oct", hours: 3, amount: 360 },
    { id: "b5", client: "Jonah Patel", service: "Family session", date: "2026-10-09", dateLabel: "Fri 9 Oct", hours: 2, amount: 240 },
    { id: "b6", client: "Elif Demir", service: "Studio hire", date: "2026-10-10", dateLabel: "Sat 10 Oct", hours: 6, amount: 300 },
  ],
  currency: "$",
  emptyTitle: "No bookings this week",
  emptyText: "New bookings show up here as soon as they are made.",
};

type Row = (typeof SAMPLE.rows)[number] & Record<string, unknown>;

const money = (n: number) => `${SAMPLE.currency}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const COLUMNS: TableColumn<Row>[] = [
  { id: "client", label: "Client" },
  { id: "service", label: "Service" },
  { id: "date", label: "Date", nowrap: true, render: (r) => <time dateTime={r.date}>{r.dateLabel}</time> },
  { id: "hours", label: "Hours", num: true, render: (r) => r.hours.toFixed(1), total: (rs) => rs.reduce((n, r) => n + r.hours, 0).toFixed(1) },
  { id: "amount", label: "Amount", num: true, render: (r) => money(r.amount), total: (rs) => money(rs.reduce((n, r) => n + r.amount, 0)) },
];

export default function TableSortable() {
  const d = SAMPLE;
  return (
    <section className="fl-section">
      <div className="fl-wrap">
        <DataTable<Row>
          version="sortable"
          caption={d.title}
          captionMeta={d.meta}
          columns={COLUMNS}
          rows={d.rows as Row[]}
          defaultSort={{ col: "date", up: true }}
          emptyTitle={d.emptyTitle}
          emptyHint={d.emptyText}
        />
      </div>
    </section>
  );
}
