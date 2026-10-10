/** @flowcode-library tables-states · Tables: sorting, selection, density and the states a row reaches (Tables and lists)
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
 * - Switch Dense, Striped and "No rows" to see the table's other states, including an empty one that keeps its headings.
 *
 * Dependencies: React (useEffect, useRef, useState), and the library's own inline icon set ("./icons"), which is a table of
 * SVG paths rather than an icon package. Nothing else — no package to install and nothing fetched at run time. The styles
 * are the library's own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs in a
 * built app exactly as it runs here.
 */
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  rows: [
    { id: "r1", name: "Riverside wedding", client: "Ana Moreau", date: "2026-06-12", photos: 420, total: 2400, status: "booked" },
    { id: "r2", name: "Harbour engagement", client: "Tom Reed", date: "2026-05-02", photos: 86, total: 450, status: "delivered" },
    { id: "r3", name: "Studio headshots", client: "Lane & Co", date: "2026-07-21", photos: 0, total: 1200, status: "enquiry" },
    { id: "r4", name: "Vineyard anniversary", client: "the Okonkwos", date: "2026-04-18", photos: 311, total: 1850, status: "delivered" },
    { id: "r5", name: "Autumn brand shoot", client: "Fenwick Studio", date: "2026-09-05", photos: 0, total: 3100, status: "enquiry" },
  ],
  cols: [
    { id: "name", label: "Shoot", kind: "text" },
    { id: "client", label: "Client", kind: "text" },
    { id: "date", label: "Date", kind: "text" },
    { id: "photos", label: "Photos", kind: "num" },
    { id: "total", label: "Total", kind: "num" },
    { id: "status", label: "Status", kind: "text" },
  ],
  tone: { enquiry: "neutral", booked: "info", delivered: "success" } as Record<string, string>,
};

export default function TablesStates() {
  const d = SAMPLE;
  const [sort, setSort] = useState({ col: "date", up: true });
  const [on, setOn] = useState<string[]>([]);
  const [dense, setDense] = useState(false);
  const [zebra, setZebra] = useState(true);
  const [empty, setEmpty] = useState(false);
  const head = useRef<HTMLInputElement>(null);

  const rows = empty
    ? []
    : [...d.rows].sort((a, b) => {
        const x = a[sort.col as keyof typeof a];
        const y = b[sort.col as keyof typeof b];
        const n = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
        return sort.up ? n : -n;
      });

  const some = on.length > 0 && on.length < rows.length;
  useEffect(() => {
    if (head.current) head.current.indeterminate = some;
  }, [some]);

  const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-tbl-bar">
        <label className="fl-ctl-choice fl-ctl-choice--inline">
          <input type="checkbox" className="fl-ctl-check fl-ctl-check--16" checked={dense} onChange={(e) => setDense(e.target.checked)} />
          <span>
            <strong>Dense rows</strong>
          </span>
        </label>
        <label className="fl-ctl-choice fl-ctl-choice--inline">
          <input type="checkbox" className="fl-ctl-check fl-ctl-check--16" checked={zebra} onChange={(e) => setZebra(e.target.checked)} />
          <span>
            <strong>Striped</strong>
          </span>
        </label>
        <label className="fl-ctl-choice fl-ctl-choice--inline">
          <input type="checkbox" className="fl-ctl-check fl-ctl-check--16" checked={empty} onChange={(e) => { setEmpty(e.target.checked); setOn([]); }} />
          <span>
            <strong>No rows</strong>
          </span>
        </label>
      </div>

      {on.length ? (
        <div className="fl-ctl-tbl-sel" role="status" aria-live="polite">
          <span>
            <strong>{on.length}</strong> of {rows.length} chosen
          </span>
          <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--32">
            <Icon name="download" /> Export
          </button>
          <button type="button" className="fl-btn fl-ctl-btn--destructive fl-ctl-btn--32">
            <Icon name="trash" /> Delete
          </button>
          <button type="button" className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--32" onClick={() => setOn([])}>
            Clear
          </button>
        </div>
      ) : null}

      <div className="fl-ctl-tbl-wrap">
        <table className={`fl-ctl-tbl${dense ? " is-dense" : ""}${zebra ? " is-zebra" : ""}`}>
          <caption className="fl-sr">Shoots, sortable and selectable</caption>
          <thead>
            <tr>
              <th scope="col" className="fl-ctl-tbl-pick">
                <input
                  ref={head}
                  type="checkbox"
                  className="fl-ctl-check fl-ctl-check--16"
                  checked={rows.length > 0 && on.length === rows.length}
                  disabled={!rows.length}
                  onChange={() => setOn(on.length === rows.length ? [] : rows.map((r) => r.id))}
                  aria-label="Choose every row"
                />
              </th>
              {d.cols.map((c) => {
                const here = sort.col === c.id;
                return (
                  <th key={c.id} scope="col" className={c.kind === "num" ? "is-num" : undefined} aria-sort={here ? (sort.up ? "ascending" : "descending") : "none"}>
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
              <tr key={r.id} className={on.includes(r.id) ? "is-on" : undefined}>
                <td className="fl-ctl-tbl-pick">
                  <input
                    type="checkbox"
                    className="fl-ctl-check fl-ctl-check--16"
                    checked={on.includes(r.id)}
                    onChange={() => setOn((v) => (v.includes(r.id) ? v.filter((x) => x !== r.id) : [...v, r.id]))}
                    aria-label={`Choose ${r.name}`}
                  />
                </td>
                <th scope="row">{r.name}</th>
                <td>{r.client}</td>
                <td>{new Date(r.date).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</td>
                <td className="is-num">{r.photos ? r.photos.toLocaleString("en-US") : <span className="fl-ctl-matrix-what">none yet</span>}</td>
                <td className="is-num">{money(r.total)}</td>
                <td>
                  <span className={`fl-ctl-badge fl-ctl-badge--soft fl-ctl-badge--${d.tone[r.status]}`}>{r.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length ? (
            <tfoot>
              <tr>
                <td className="fl-ctl-tbl-pick" />
                <th scope="row">Total</th>
                <td colSpan={2} />
                <td className="is-num">{rows.reduce((n, r) => n + r.photos, 0).toLocaleString("en-US")}</td>
                <td className="is-num">{money(rows.reduce((n, r) => n + r.total, 0))}</td>
                <td />
              </tr>
            </tfoot>
          ) : null}
        </table>
        {rows.length ? null : (
          <div className="fl-spec-empty">
            <span className="fl-ctl-empty-art" aria-hidden="true">
              <Icon name="search" />
            </span>
            <strong>No shoots match these filters</strong>
            <span className="fl-ctl-matrix-what">An empty table still needs its headings, so the columns do not jump when rows come back.</span>
            <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--32" onClick={() => setEmpty(false)}>
              Clear the filters
            </button>
          </div>
        )}
      </div>

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
