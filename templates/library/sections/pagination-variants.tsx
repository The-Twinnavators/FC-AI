/** @flowcode-library pagination-variants - Pagination: numbered, simple and load more (Tabs, breadcrumbs and paging)
 * Use cases: long lists; search results; tables; galleries; activity feeds
 * Jobs to be done: get to the next page; jump to a page; see how much there is left
 * Keywords: pagination, paging, next, previous, page size, load more, infinite
 */
/**
 * Three ways through a long list. Numbered paging when people need to come back to a place; previous and next when
 * they do not; load more when the list is a feed. Each says how much there is, because a page number alone does not.
 *
 * Make it the app's own: keep the count. "Page 3" means nothing without "of 48".
 */
import { useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  pages: ["1", "2", "3", "4", "…", "48"],
  current: "3",
  sizes: [10, 25, 50, 100],
};

export default function PaginationVariants() {
  const d = SAMPLE;
  const last = 48;
  const count = 1187;
  const [page, setPage] = useState(3);
  const [simple, setSimple] = useState(3);
  const [perPage, setPerPage] = useState(25);
  const [shown, setShown] = useState(75);
  const first = (page - 1) * perPage + 1;
  const upTo = Math.min(page * perPage, count);
  const run = page <= 3 ? [1, 2, 3, 4] : page >= last - 2 ? [last - 3, last - 2, last - 1, last] : [page - 1, page, page + 1];
  const pages = run.map(String).concat(run[run.length - 1] < last ? ["\u2026", String(last)] : []);
  return (
    <section className="fl-section fl-section--specimen">
      <ul className="fl-ctl-paging-list">
        <li>
          <p className="fl-ctl-matrix-kind">Numbered</p>
          <p className="fl-ctl-matrix-what">For lists people come back to. The ends disable rather than disappear.</p>
          <nav className="fl-ctl-paging" aria-label="Pages">
            <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--32" disabled={page === 1} onClick={() => setPage((n) => Math.max(1, n - 1))}>
              <Icon name="arrow" /> Previous
            </button>
            <ol>
              {pages.map((p, n) => (
                <li key={p + n}>
                  {p === "\u2026" ? (
                    <span className="fl-ctl-paging-gap">{p}</span>
                  ) : (
                    <button
                      type="button"
                      className={`fl-ctl-paging-num${Number(p) === page ? " is-on" : ""}`}
                      aria-current={Number(p) === page ? "page" : undefined}
                      aria-label={`Page ${p}`}
                      onClick={() => setPage(Number(p))}
                    >
                      {p}
                    </button>
                  )}
                </li>
              ))}
            </ol>
            <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--32" disabled={page === last} onClick={() => setPage((n) => Math.min(last, n + 1))}>
              Next <Icon name="arrow" />
            </button>
          </nav>
          <p className="fl-ctl-matrix-what" role="status" aria-live="polite">
            Showing {first.toLocaleString("en-US")} to {upTo.toLocaleString("en-US")} of {count.toLocaleString("en-US")}
          </p>
        </li>

        <li>
          <p className="fl-ctl-matrix-kind">Previous and next</p>
          <p className="fl-ctl-matrix-what">When the page number does not matter, only the movement.</p>
          <nav className="fl-ctl-paging" aria-label="Pages, simple">
            <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--32" disabled={simple === 1} onClick={() => setSimple((n) => Math.max(1, n - 1))}>
              <Icon name="arrow" /> Newer
            </button>
            <span className="fl-ctl-matrix-what" role="status" aria-live="polite">
              Page {simple} of {last}
            </span>
            <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--32" disabled={simple === last} onClick={() => setSimple((n) => Math.min(last, n + 1))}>
              Older <Icon name="arrow" />
            </button>
          </nav>
        </li>

        <li>
          <p className="fl-ctl-matrix-kind">Load more</p>
          <p className="fl-ctl-matrix-what">For a feed. It says what is left, so it is never a mystery button.</p>
          <div className="fl-ctl-paging fl-ctl-paging--more">
            <button
              type="button"
              className="fl-btn fl-btn--secondary fl-ctl-btn--40"
              disabled={shown >= count}
              onClick={() => setShown((n) => Math.min(count, n + 25))}
            >
              {shown >= count ? "That is all of them" : "Load 25 more"}
            </button>
            <span className="fl-ctl-matrix-what" role="status" aria-live="polite">
              {shown.toLocaleString("en-US")} of {count.toLocaleString("en-US")} shown
            </span>
          </div>
        </li>
      </ul>

      <div className="fl-ctl-sizes">
        <h3>Rows per page</h3>
        <p className="fl-ctl-btn-what">Beside the paging, not inside it: changing the page size moves you back to the first page.</p>
        <span className="fl-ctl-select fl-ctl-paging-size">
          <label className="fl-sr" htmlFor="rows-per-page">
            Rows per page
          </label>
          <select
            id="rows-per-page"
            className="fl-input fl-ctl-field fl-ctl-field--outlined fl-ctl-field--32"
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value));
              setPage(1);
            }}
          >
            {d.sizes.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          <Icon name="chevron-down" />
        </span>
      </div>
    </section>
  );
}
