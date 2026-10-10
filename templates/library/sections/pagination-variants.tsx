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
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  pages: ["1", "2", "3", "4", "…", "48"],
  current: "3",
  sizes: [10, 25, 50, 100],
};

export default function PaginationVariants() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--specimen">
      <ul className="fl-ctl-paging-list">
        <li>
          <p className="fl-ctl-matrix-kind">Numbered</p>
          <p className="fl-ctl-matrix-what">For lists people come back to. The ends disable rather than disappear.</p>
          <nav className="fl-ctl-paging" aria-label="Pages">
            <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--32" disabled>
              <Icon name="arrow" /> Previous
            </button>
            <ol>
              {d.pages.map((p, n) => (
                <li key={p + n}>
                  {p === "\u2026" ? (
                    <span className="fl-ctl-paging-gap">{p}</span>
                  ) : (
                    <button type="button" className={`fl-ctl-paging-num${p === d.current ? " is-on" : ""}`} aria-current={p === d.current ? "page" : undefined}>
                      {p}
                    </button>
                  )}
                </li>
              ))}
            </ol>
            <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--32">
              Next <Icon name="arrow" />
            </button>
          </nav>
          <p className="fl-ctl-matrix-what">Showing 51 to 75 of 1,187</p>
        </li>

        <li>
          <p className="fl-ctl-matrix-kind">Previous and next</p>
          <p className="fl-ctl-matrix-what">When the page number does not matter, only the movement.</p>
          <nav className="fl-ctl-paging" aria-label="Pages, simple">
            <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--32">
              <Icon name="arrow" /> Newer
            </button>
            <span className="fl-ctl-matrix-what">Page 3 of 48</span>
            <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--32">
              Older <Icon name="arrow" />
            </button>
          </nav>
        </li>

        <li>
          <p className="fl-ctl-matrix-kind">Load more</p>
          <p className="fl-ctl-matrix-what">For a feed. It says what is left, so it is never a mystery button.</p>
          <div className="fl-ctl-paging fl-ctl-paging--more">
            <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--40">
              Load 25 more
            </button>
            <span className="fl-ctl-matrix-what">75 of 1,187 shown</span>
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
          <select id="rows-per-page" className="fl-input fl-ctl-field fl-ctl-field--outlined fl-ctl-field--32" defaultValue="25">
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
