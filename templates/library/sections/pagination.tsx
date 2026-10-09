/** @flowcode-library pagination · Pagination (Tabs, breadcrumbs and paging)
 * Use cases: paged list; search results; order history; bookings list; transaction list; data table paging; records list; archive
 * Jobs to be done: browse through a long list; jump to a specific page; show more results per page; filter records by status
 * Keywords: pagination, pages, page size, list, navigation
 */
/**
 * Pagination: numbered pages with previous and next, ellipses for long ranges, a page-size select and a
 * "Showing 21–40 of 312" line. Use it under any long list or table that loads a page at a time.
 * Make it the app's own: replace SAMPLE with your record type and filters, and feed `rows` from your own data.
 */
import { useMemo, useState } from "react";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Studio bookings",
  title: "All bookings",
  total: 312,
  firstRef: 1001,
  people: ["Ana Ruiz", "Tom Okafor", "Mei Lin", "Sam Patel", "Jo Byrne", "Lena Fischer", "Kofi Mensah", "Priya Shah"],
  classes: ["Wheel taster", "Glazing evening", "Hand-building", "Kids' clay club", "Open studio"],
  statuses: [
    { id: "confirmed", label: "Confirmed" },
    { id: "waiting", label: "Waiting list" },
    { id: "cancelled", label: "Cancelled" },
    { id: "refund", label: "Refund requested" },
  ],
  pageSizes: [10, 20, 50],
  defaultSize: 20,
  defaultPage: 2,
  emptyTitle: "No bookings here",
  emptyText: "Nothing matches this filter. Try another status.",
};

type Row = { ref: number; person: string; cls: string; status: string };

function Chevron({ dir }: { dir: "left" | "right" | "down" }) {
  const d = dir === "left" ? "M15 6l-6 6 6 6" : dir === "right" ? "M9 6l6 6-6 6" : "M6 9l6 6 6-6";
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** Page numbers to show: first, last, and the current page with one neighbour each side; gaps become "…". */
function pageList(page: number, pages: number): Array<number | "gap"> {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: Array<number | "gap"> = [1];
  const start = Math.max(2, Math.min(page - 1, pages - 4));
  const end = Math.min(pages - 1, Math.max(page + 1, 5));
  if (start > 2) out.push("gap");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < pages - 1) out.push("gap");
  out.push(pages);
  return out;
}

export default function Pagination() {
  const d = SAMPLE;
  // Sample data kept in memory: the status pattern leaves "Refund requested" empty to show the no-results state.
  const all = useMemo<Row[]>(
    () =>
      Array.from({ length: d.total }, (_, i) => ({
        ref: d.firstRef + i,
        person: d.people[(i * 3) % d.people.length],
        cls: d.classes[i % d.classes.length],
        status: i % 9 === 4 ? "cancelled" : i % 5 === 2 ? "waiting" : "confirmed",
      })),
    [d],
  );

  const [filter, setFilter] = useState("all");
  const [size, setSize] = useState(d.defaultSize);
  const [page, setPage] = useState(d.defaultPage);

  const rows = filter === "all" ? all : all.filter((r) => r.status === filter);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const safePage = Math.min(page, pages);
  const from = rows.length === 0 ? 0 : (safePage - 1) * size + 1;
  const to = Math.min(safePage * size, rows.length);
  const visible = rows.slice(from - 1, to);
  const label = (id: string) => d.statuses.find((s) => s.id === id)?.label ?? id;
  const count = (id: string) => (id === "all" ? all.length : all.filter((r) => r.status === id).length);

  const changeSize = (n: number) => {
    // Keep the first row you were looking at on screen.
    setPage(Math.floor((from > 0 ? from - 1 : 0) / n) + 1);
    setSize(n);
  };

  return (
    <section className="fl-section" aria-labelledby="pagination-title">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="pagination-title" className="fl-title">
            {d.title}
          </h2>
        </div>

        <div className="fl-way-toolbar-row">
          <label className="fl-way-pagesize" htmlFor="pagination-filter">
            Status
            <span className="fl-way-select">
              <select
                id="pagination-filter"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All ({count("all")})</option>
                {d.statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({count(s.id)})
                  </option>
                ))}
              </select>
              <Chevron dir="down" />
            </span>
          </label>
          <p className="fl-way-range" role="status" aria-live="polite">
            {rows.length === 0 ? (
              "No results"
            ) : (
              <>
                Showing <strong>{from}–{to}</strong> of <strong>{rows.length}</strong>
              </>
            )}
          </p>
        </div>

        {visible.length === 0 ? (
          <div className="fl-way-empty">
            <p>
              <strong>{d.emptyTitle}</strong>
            </p>
            <p>{d.emptyText}</p>
            <button type="button" className="fl-way-btn-sm" onClick={() => setFilter("all")}>
              Show all bookings
            </button>
          </div>
        ) : (
          <ul className="fl-way-list" aria-label={`Bookings ${from} to ${to}`}>
            {visible.map((r) => (
              <li key={r.ref}>
                <span className="fl-way-num">#{r.ref}</span>
                <div className="fl-way-list__main">
                  <p className="fl-way-list__title">{r.person}</p>
                  <p className="fl-way-list__meta">{r.cls}</p>
                </div>
                <span className="fl-meta">{label(r.status)}</span>
              </li>
            ))}
          </ul>
        )}

        {rows.length > 0 && (
          <div className="fl-way-pager">
            <nav aria-label="Pages">
              <ul className="fl-way-pages">
                <li>
                  <button type="button" className="fl-way-page fl-way-page--step" disabled={safePage === 1} onClick={() => setPage(safePage - 1)} aria-label="Previous page">
                    <Chevron dir="left" />
                    <span className="fl-way-hide-sm" aria-hidden="true">Previous</span>
                  </button>
                </li>
                {pageList(safePage, pages).map((p, i) =>
                  p === "gap" ? (
                    <li key={`gap-${i}`} className="fl-way-gap fl-way-page--far" aria-hidden="true">
                      …
                    </li>
                  ) : (
                    <li key={p} className={Math.abs(p - safePage) > 1 && p !== 1 && p !== pages ? "fl-way-page--far" : undefined}>
                      <button
                        type="button"
                        className="fl-way-page"
                        aria-current={p === safePage ? "page" : undefined}
                        aria-label={`Page ${p}`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    </li>
                  ),
                )}
                <li>
                  <button type="button" className="fl-way-page fl-way-page--step" disabled={safePage === pages} onClick={() => setPage(safePage + 1)} aria-label="Next page">
                    <span className="fl-way-hide-sm" aria-hidden="true">Next</span>
                    <Chevron dir="right" />
                  </button>
                </li>
              </ul>
            </nav>
            <label className="fl-way-pagesize" htmlFor="pagination-size">
              Rows per page
              <span className="fl-way-select">
                <select id="pagination-size" value={size} onChange={(e) => changeSize(Number(e.target.value))}>
                  {d.pageSizes.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <Chevron dir="down" />
              </span>
            </label>
          </div>
        )}
      </div>
    </section>
  );
}
