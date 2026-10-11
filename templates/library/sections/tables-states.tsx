/** @flowcode-library tables-states · Tables: sorting, selection, density and the states a row reaches (Tables and lists)
 * Catalog ID: p.data-table (pattern)
 * Function: The data table pattern (p.data-table); the reference sheet shows sorting, row selection with a bulk bar, totals, dense and striped looks, and the loading and empty states.
 * Use it as: import { DataTable } from "./tables-states"; <DataTable caption="Shoots" columns={[{ id, label, num?, render?, total? }]} rows={[{ id, ... }]} selectable? bulk?={(ids, clear) => buttons} defaultSort?={{ col, up }} dense? striped? loading? emptyTitle? emptyHint? emptyAction? onEmptyAction? />
 * Built from: c.checkbox, c.button.tertiary, c.button.secondary, c.progress.spinner, c.badge.status
 * Look: A full-width table with a muted sticky header, a caret on the sorted column, right-aligned tabular numbers, a tinted row when ticked and an accent bar above it counting the chosen rows.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --radius-md --space-2 --space-3 --text-sm
 * Use cases: an admin list; invoices; search results; a report; anything with more than three columns
 * Jobs to be done: sort by a column; pick some rows and act on them; read a long table without losing the row
 * Keywords: table, data table, sort, select rows, sticky header, zebra, density, empty, aria-sort
 */
/**
 * One table doing the four things tables have to do: sort, select, stay readable while it scrolls, and say something
 * sensible when it is empty.
 *
 * It all works. Press a column heading to sort, and aria-sort moves with it; tick rows and a bar appears saying how
 * many and what can be done to them; the select-all box goes indeterminate when only some are ticked. Numbers are
 * right-aligned and set in tabular figures, which is the one typographic rule a table cannot do without.
 *
 * Make it the app's own: replace the columns. Keep the header in a thead so it sticks and is read as headings.
 */
/**
 * How to try it
 * - Press a column heading to sort; press it again to reverse. aria-sort moves with it.
 * - Tick rows: an actions bar appears and the header box goes indeterminate.
 * - Switch Dense, Striped, Loading and "No rows" to see the table's other states, including an empty one that keeps its headings.
 *
 * Dependencies: React (useState), and the library's own inline icon set ("./icons"), which is a table of
 * SVG paths rather than an icon package. Nothing else — no package to install and nothing fetched at run time. The styles
 * are the library's own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs in a
 * built app exactly as it runs here.
 */
import { useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";
import { Badge, type BadgeTone } from "./badges-status";
import { Checkbox } from "./checkboxes-radios";
import { Progress } from "./progress-indicators";

// ── p.data-table: a sortable, selectable table with its loading and empty states. Built from c.checkbox, c.button, c.progress. ──

export type TableRow = { id: string } & Record<string, unknown>;
export type TableColumn<R extends TableRow = TableRow> = {
  id: string;
  label: string;
  /** Right-aligned tabular figures. */
  num?: boolean;
  /** Draws the cell; the raw value is shown when left out. */
  render?: (row: R) => ReactNode;
  /** Draws this column's cell in the totals row; no totals row unless some column has one. */
  total?: (rows: R[]) => ReactNode;
};

type TableProps<R extends TableRow> = {
  /** Read by screen readers as the table's name. */
  caption: string;
  /** The first column is the row header (a th), so a screen reader can say which row a cell belongs to. */
  columns: TableColumn<R>[];
  rows: R[];
  /** A tick box on every row and a select-all in the header. */
  selectable?: boolean;
  /** What to show above the table while rows are ticked: the chosen ids and a function that clears them. */
  bulk?: (ids: string[], clear: () => void) => ReactNode;
  defaultSort?: { col: string; up: boolean };
  dense?: boolean;
  striped?: boolean;
  /** Rows are on their way: the headings stay and a spinner stands in for the body. */
  loading?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  /** Adds a button to the empty state (for example "Clear the filters"). */
  emptyAction?: string;
  onEmptyAction?: () => void;
  className?: string;
};

const sortValue = (v: unknown) => (typeof v === "number" ? v : String(v ?? ""));

export function DataTable<R extends TableRow>({
  caption,
  columns,
  rows: data,
  selectable,
  bulk,
  defaultSort,
  dense,
  striped,
  loading,
  emptyTitle = "Nothing to show",
  emptyHint = "An empty table still needs its headings, so the columns do not jump when rows come back.",
  emptyAction,
  onEmptyAction,
  className,
}: TableProps<R>) {
  const [sort, setSort] = useState(defaultSort ?? { col: "", up: true });
  const [on, setOn] = useState<string[]>([]);

  const shown = loading ? [] : data;
  const rows = sort.col
    ? [...shown].sort((a, b) => {
        const x = sortValue(a[sort.col]);
        const y = sortValue(b[sort.col]);
        const n = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
        return sort.up ? n : -n;
      })
    : shown;
  const chosen = on.filter((id) => rows.some((r) => r.id === id));
  const clear = () => setOn([]);
  const hasTotals = columns.some((c) => c.total);

  return (
    <div className={className} data-fl="p.data-table">
      {chosen.length && bulk ? (
        <div className="fl-ctl-tbl-sel" role="status" aria-live="polite">
          <span>
            <strong>{chosen.length}</strong> of {rows.length} chosen
          </span>
          {bulk(chosen, clear)}
          <Button variant="tertiary" size={32} onClick={clear}>
            Clear
          </Button>
        </div>
      ) : null}

      <div className="fl-ctl-tbl-wrap">
        <table className={`fl-ctl-tbl${dense ? " is-dense" : ""}${striped ? " is-zebra" : ""}`} aria-busy={loading || undefined}>
          <caption className="fl-sr">{caption}</caption>
          <thead>
            <tr>
              {selectable ? (
                <th scope="col" className="fl-ctl-tbl-pick">
                  <Checkbox
                    size={16}
                    checked={rows.length > 0 && chosen.length === rows.length}
                    indeterminate={chosen.length > 0 && chosen.length < rows.length}
                    disabled={!rows.length}
                    onChange={() => setOn(chosen.length === rows.length ? [] : rows.map((r) => r.id))}
                    aria-label="Choose every row"
                  />
                </th>
              ) : null}
              {columns.map((c) => {
                const here = sort.col === c.id;
                return (
                  <th key={c.id} scope="col" className={c.num ? "is-num" : undefined} aria-sort={here ? (sort.up ? "ascending" : "descending") : "none"}>
                    <button type="button" className="fl-ctl-tbl-sort" onClick={() => setSort((s) => ({ col: c.id, up: s.col === c.id ? !s.up : true }))}>
                      {c.label}
                      <span className={`fl-ctl-tbl-caret${here ? " is-on" : ""}${here && !sort.up ? " is-down" : ""}`} aria-hidden="true">
                        <Icon name="chevron-down" />
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={chosen.includes(r.id) ? "is-on" : undefined}>
                {selectable ? (
                  <td className="fl-ctl-tbl-pick">
                    <Checkbox
                      size={16}
                      checked={chosen.includes(r.id)}
                      onChange={() => setOn((v) => (v.includes(r.id) ? v.filter((x) => x !== r.id) : [...v, r.id]))}
                      aria-label={`Choose ${String(r[columns[0].id] ?? r.id)}`}
                    />
                  </td>
                ) : null}
                {columns.map((c, i) => {
                  const cell = c.render ? c.render(r) : (r[c.id] as ReactNode);
                  return i === 0 ? (
                    <th key={c.id} scope="row">
                      {cell}
                    </th>
                  ) : (
                    <td key={c.id} className={c.num ? "is-num" : undefined}>
                      {cell}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          {rows.length && hasTotals ? (
            <tfoot>
              <tr>
                {selectable ? <td className="fl-ctl-tbl-pick" /> : null}
                {columns.map((c, i) =>
                  i === 0 ? (
                    <th key={c.id} scope="row">
                      Total
                    </th>
                  ) : (
                    <td key={c.id} className={c.num ? "is-num" : undefined}>
                      {c.total ? c.total(rows) : null}
                    </td>
                  )
                )}
              </tr>
            </tfoot>
          ) : null}
        </table>
        {loading ? (
          <div className="fl-spec-empty" role="status">
            <Progress variant="spinner" size={32} label="Loading rows" />
            <span className="fl-ctl-matrix-what">Loading. The headings stay put so the columns do not jump.</span>
          </div>
        ) : rows.length ? null : (
          <div className="fl-spec-empty">
            <span className="fl-ctl-empty-art" aria-hidden="true">
              <Icon name="search" />
            </span>
            <strong>{emptyTitle}</strong>
            <span className="fl-ctl-matrix-what">{emptyHint}</span>
            {emptyAction ? (
              <Button variant="secondary" size={32} onClick={onEmptyAction}>
                {emptyAction}
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  rows: [
    { id: "r1", name: "Riverside wedding", client: "Ana Moreau", date: "2026-06-12", photos: 420, total: 2400, status: "booked" },
    { id: "r2", name: "Harbour engagement", client: "Tom Reed", date: "2026-05-02", photos: 86, total: 450, status: "delivered" },
    { id: "r3", name: "Studio headshots", client: "Lane & Co", date: "2026-07-21", photos: 0, total: 1200, status: "enquiry" },
    { id: "r4", name: "Vineyard anniversary", client: "the Okonkwos", date: "2026-04-18", photos: 311, total: 1850, status: "delivered" },
    { id: "r5", name: "Autumn brand shoot", client: "Fenwick Studio", date: "2026-09-05", photos: 0, total: 3100, status: "enquiry" },
  ],
  tone: { enquiry: "neutral", booked: "info", delivered: "success" } as Record<string, BadgeTone>,
};

type Shoot = (typeof SAMPLE.rows)[number] & Record<string, unknown>;

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const COLUMNS: TableColumn<Shoot>[] = [
  { id: "name", label: "Shoot" },
  { id: "client", label: "Client" },
  { id: "date", label: "Date", render: (r) => new Date(r.date).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) },
  {
    id: "photos",
    label: "Photos",
    num: true,
    render: (r) => (r.photos ? r.photos.toLocaleString("en-US") : <span className="fl-ctl-matrix-what">none yet</span>),
    total: (rs) => rs.reduce((n, r) => n + r.photos, 0).toLocaleString("en-US"),
  },
  { id: "total", label: "Total", num: true, render: (r) => money(r.total), total: (rs) => money(rs.reduce((n, r) => n + r.total, 0)) },
  { id: "status", label: "Status", render: (r) => <Badge tone={SAMPLE.tone[r.status]}>{r.status}</Badge> },
];

export default function TablesStates() {
  const d = SAMPLE;
  const [dense, setDense] = useState(false);
  const [zebra, setZebra] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-tbl-bar">
        <label className="fl-ctl-choice fl-ctl-choice--inline">
          <Checkbox size={16} checked={dense} onChange={(e) => setDense(e.target.checked)} />
          <span>
            <strong>Dense rows</strong>
          </span>
        </label>
        <label className="fl-ctl-choice fl-ctl-choice--inline">
          <Checkbox size={16} checked={zebra} onChange={(e) => setZebra(e.target.checked)} />
          <span>
            <strong>Striped</strong>
          </span>
        </label>
        <label className="fl-ctl-choice fl-ctl-choice--inline">
          <Checkbox size={16} checked={loading} onChange={(e) => setLoading(e.target.checked)} />
          <span>
            <strong>Loading</strong>
          </span>
        </label>
        <label className="fl-ctl-choice fl-ctl-choice--inline">
          <Checkbox size={16} checked={empty} onChange={(e) => setEmpty(e.target.checked)} />
          <span>
            <strong>No rows</strong>
          </span>
        </label>
      </div>

      <DataTable
        key={empty ? "empty" : "rows"}
        caption="Shoots, sortable and selectable"
        columns={COLUMNS}
        rows={empty ? [] : (d.rows as Shoot[])}
        selectable
        defaultSort={{ col: "date", up: true }}
        dense={dense}
        striped={zebra}
        loading={loading}
        emptyTitle="No shoots match these filters"
        emptyAction="Clear the filters"
        onEmptyAction={() => setEmpty(false)}
        bulk={() => (
          <>
            <Button variant="secondary" size={32} icon="download">
              Export
            </Button>
            <Button variant="destructive" size={32} icon="trash">
              Delete
            </Button>
          </>
        )}
      />

      <div className="fl-ctl-sizes">
        <h3>The rules a table lives by</h3>
        <ul className="fl-ctl-tip-rules">
          <li>
            <strong>Numbers right, text left.</strong>
            <span className="fl-ctl-matrix-what">And set in tabular figures, so the digits line up down the column.</span>
          </li>
          <li>
            <strong>The sorted column says so.</strong>
            <span className="fl-ctl-matrix-what">aria-sort on the heading, not just an arrow. Press a heading above and watch it move.</span>
          </li>
          <li>
            <strong>Row headers are th, not td.</strong>
            <span className="fl-ctl-matrix-what">That is what lets a screen reader say which shoot a cell belongs to.</span>
          </li>
          <li>
            <strong>Empty keeps its headings.</strong>
            <span className="fl-ctl-matrix-what">Tick "No rows" above: the columns stay, and the message sits under them.</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
