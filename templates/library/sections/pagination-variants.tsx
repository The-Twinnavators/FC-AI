/** @flowcode-library pagination-variants · Pagination: numbered, simple and load more (Tabs, breadcrumbs and paging)
 * Catalog ID: c.pagination (component)
 * Function: The pager for long lists (c.pagination); the reference sheet shows numbered, previous/next and load-more paging and the rows-per-page select beside them.
 * Use it as: import { Pagination } from "./pagination-variants"; <Pagination variant?="numbered"|"simple"|"load-more" page={n} pageCount={n} onPageChange={fn} prevLabel? nextLabel? /> or <Pagination variant="load-more" shown={n} total={n} step? onLoadMore={fn} />
 * Variants: c.pagination.numbered - A list people come back to: page numbers with an ellipsis between Previous and Next, the current page filled with the accent color; c.pagination.simple - Only the movement matters: Newer/Previous and Older/Next buttons around "Page x of y"; c.pagination.load-more - A feed: one secondary button that says how many it adds, and a "shown of total" count beneath
 * Look: A row of small bordered buttons with arrows and, when numbered, page numbers; the ends disable rather than disappear.
 * Tokens: --color-accent --color-on-accent --color-text --color-text-muted --color-surface-sunken --radius-sm --space-1 --space-2 --space-3 --weight-semibold
 * Use cases: long lists; search results; tables; galleries; activity feeds; paged list; order history; bookings list; transaction list; data table paging; records list; archive
 * Jobs to be done: get to the next page; jump to a page; see how much there is left; browse through a long list; jump to a specific page; show more results per page; filter records by status
 * Keywords: pagination, paging, next, previous, page size, load more, pages, list, navigation
 */
/**
 * Three ways through a long list. Numbered paging when people need to come back to a place; previous and next when
 * they do not; load more when the list is a feed. Each says how much there is, because a page number alone does not.
 *
 * Make it the app's own: keep the count. "Page 3" means nothing without "of 48".
 */
/**
 * How to try it
 * - Press a page number, Previous or Next: the numbers and the "showing" line follow.
 * - Press "Load 25 more" until it runs out.
 * - Change rows per page: it goes back to page one, which is what changing the page size has to do.
 *
 * Dependencies: React (useState), and the library's own inline icon set ("./icons"), which is a table of SVG paths rather
 * than an icon package. Nothing else — no package to install and nothing fetched at run time. The styles are the library's
 * own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs in a built app exactly as
 * it runs here.
 */
import { useState, type HTMLAttributes } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";

// ── c.pagination: the one pager. Every list's paging is this component; the specimen below shows every variant. ──

export type PaginationVariant = "numbered" | "simple" | "load-more";

// Written out in full (not built from the variant name) so a build finds every class the pager needs.
const CLS: Record<PaginationVariant, string> = {
  numbered: "fl-ctl-paging",
  simple: "fl-ctl-paging",
  "load-more": "fl-ctl-paging fl-ctl-paging--more",
};

type PaginationProps = {
  variant?: PaginationVariant;
  /** Current page, from 1 (numbered and simple). */
  page?: number;
  pageCount?: number;
  onPageChange?: (page: number) => void;
  /** Button text for simple: "Previous" and "Next" when left out. */
  prevLabel?: string;
  nextLabel?: string;
  /** Load more: how many are shown, how many exist, how many one press adds. */
  shown?: number;
  total?: number;
  step?: number;
  onLoadMore?: () => void;
  className?: string;
} & Omit<HTMLAttributes<HTMLElement>, "className" | "onChange">;

const fmt = (n: number) => n.toLocaleString("en-US");

export function Pagination(props: PaginationProps) {
  const { variant = "numbered", page = 1, pageCount = 1, onPageChange, prevLabel = "Previous", nextLabel = "Next", shown = 0, total = 0, step = 25, onLoadMore, className, ...rest } = props;
  const cls = `${CLS[variant]}${className ? ` ${className}` : ""}`;
  const fl = `c.pagination.${variant}`;
  const go = (n: number) => onPageChange?.(Math.min(pageCount, Math.max(1, n)));
  if (variant === "load-more") {
    return (
      <div {...(rest as HTMLAttributes<HTMLDivElement>)} className={cls} data-fl={fl}>
        <Button variant="secondary" size={40} disabled={shown >= total} onClick={onLoadMore}>
          {shown >= total ? "That is all of them" : `Load ${step} more`}
        </Button>
        <span className="fl-ctl-matrix-what" role="status" aria-live="polite">
          {fmt(shown)} of {fmt(total)} shown
        </span>
      </div>
    );
  }
  const prev = (
    <Button variant="secondary" size={32} icon="arrow" disabled={page <= 1} onClick={() => go(page - 1)}>
      {prevLabel}
    </Button>
  );
  const next = (
    <Button variant="secondary" size={32} icon="arrow" iconAt="end" disabled={page >= pageCount} onClick={() => go(page + 1)}>
      {nextLabel}
    </Button>
  );
  if (variant === "simple") {
    return (
      <nav aria-label="Pages, simple" {...rest} className={cls} data-fl={fl}>
        {prev}
        <span className="fl-ctl-matrix-what" role="status" aria-live="polite">
          Page {page} of {pageCount}
        </span>
        {next}
      </nav>
    );
  }
  const run = page <= 3 ? [1, 2, 3, 4] : page >= pageCount - 2 ? [pageCount - 3, pageCount - 2, pageCount - 1, pageCount] : [page - 1, page, page + 1];
  const pages = run.map(String).concat(run[run.length - 1] < pageCount ? ["…", String(pageCount)] : []);
  return (
    <nav aria-label="Pages" {...rest} className={cls} data-fl={fl}>
      {prev}
      <ol>
        {pages.map((p, n) => (
          <li key={p + n}>
            {p === "…" ? (
              <span className="fl-ctl-paging-gap">{p}</span>
            ) : (
              <button
                type="button"
                className={`fl-ctl-paging-num${Number(p) === page ? " is-on" : ""}`}
                aria-current={Number(p) === page ? "page" : undefined}
                aria-label={`Page ${p}`}
                onClick={() => go(Number(p))}
              >
                {p}
              </button>
            )}
          </li>
        ))}
      </ol>
      {next}
    </nav>
  );
}

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
  return (
    <section className="fl-section fl-section--specimen">
      <ul className="fl-ctl-paging-list">
        <li>
          <p className="fl-ctl-matrix-kind">Numbered</p>
          <p className="fl-ctl-matrix-what">For lists people come back to. The ends disable rather than disappear.</p>
          <Pagination page={page} pageCount={last} onPageChange={setPage} />
          <p className="fl-ctl-matrix-what" role="status" aria-live="polite">
            Showing {first.toLocaleString("en-US")} to {upTo.toLocaleString("en-US")} of {count.toLocaleString("en-US")}
          </p>
        </li>

        <li>
          <p className="fl-ctl-matrix-kind">Previous and next</p>
          <p className="fl-ctl-matrix-what">When the page number does not matter, only the movement.</p>
          <Pagination variant="simple" page={simple} pageCount={last} onPageChange={setSimple} prevLabel="Newer" nextLabel="Older" />
        </li>

        <li>
          <p className="fl-ctl-matrix-kind">Load more</p>
          <p className="fl-ctl-matrix-what">For a feed. It says what is left, so it is never a mystery button.</p>
          <Pagination variant="load-more" shown={shown} total={count} onLoadMore={() => setShown((n) => Math.min(count, n + 25))} />
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
