/** @flowcode-library pagination-variants · Pagination: numbered, simple and load more (Tabs, breadcrumbs and paging)
 * Catalog ID: c.pagination (component)
 * Function: The pager for long lists (c.pagination); the reference sheet shows numbered, previous/next and load-more paging and the rows-per-page select beside them.
 * Use it as: import { Pagination } from "./pagination-variants"; <Pagination variant?="numbered"|"simple"|"load-more" page={n} pageCount={n} onPageChange={fn} prevLabel? nextLabel? version?="classic" total? pageSizes? defaultPageSize? defaultPage? /> or <Pagination variant="load-more" shown={n} total={n} step? onLoadMore={fn} />
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
 * Motion (classic): one accent marker glides to the current page instead of jumping, page buttons press in, and the
 * Previous/Next chevrons nudge toward where they go. Reduced motion or animation off: the marker moves at once.
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
import { useId, useLayoutEffect, useRef, useState, type HTMLAttributes } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";

// ── c.pagination: the one pager. Every list's paging is this component; the specimen below shows every variant. ──

export type PaginationVariant = "numbered" | "simple" | "load-more";
/** An alternative design of the whole pager (c.pagination@<version>); left out = the variant's look. */
export type PaginationVersion = "classic";

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
  /** classic: page numbers with chevron Previous/Next, "…" for long ranges, a "Showing x-y of z" line (from total) and an optional rows-per-page select. variant is ignored. */
  version?: PaginationVersion;
  /** classic: rows per page (controlled, with onPageSizeChange); defaultPageSize when left out. */
  pageSize?: number;
  defaultPageSize?: number;
  /** classic: the sizes to offer; the rows-per-page select shows only when this is given. */
  pageSizes?: number[];
  onPageSizeChange?: (size: number) => void;
  /** classic: the page to start on when page is not controlled. */
  defaultPage?: number;
  className?: string;
} & Omit<HTMLAttributes<HTMLElement>, "className" | "onChange">;

const fmt = (n: number) => n.toLocaleString("en-US");

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

/** c.pagination@classic: numbered pages, "Showing x-y of z", and a rows-per-page select. Works on its own or controlled. */
function ClassicPager({ page: controlled, defaultPage = 1, pageCount, total = 0, onPageChange, pageSize: fixedSize, defaultPageSize, pageSizes, onPageSizeChange, className }: PaginationProps) {
  const uid = useId();
  const [ownPage, setOwnPage] = useState(defaultPage);
  const [ownSize, setOwnSize] = useState(defaultPageSize ?? pageSizes?.[0] ?? 20);
  const size = fixedSize ?? ownSize;
  const pages = Math.max(1, pageCount ?? Math.ceil(total / size));
  const safePage = Math.min(controlled ?? ownPage, pages);
  const from = total === 0 ? 0 : (safePage - 1) * size + 1;
  const to = Math.min(safePage * size, total);
  const setPage = (n: number) => {
    const next = Math.min(pages, Math.max(1, n));
    if (controlled === undefined) setOwnPage(next);
    onPageChange?.(next);
  };
  // One marker for the current page: measured from its button, it glides when the page changes (once placed).
  const list = useRef<HTMLUListElement>(null);
  const [mark, setMark] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    const ul = list.current;
    if (!ul) return;
    const place = () => {
      const b = ul.querySelector<HTMLElement>('[aria-current="page"]');
      if (!b || !b.offsetParent) return setMark(null);
      // The list is the positioned parent (fl-way-pages), so offsets are measured from it.
      const next = { x: b.offsetLeft, y: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight };
      setMark((m) => (m && m.x === next.x && m.y === next.y && m.w === next.w && m.h === next.h ? m : next));
    };
    place();
    const ro = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(place);
    ro?.observe(ul);
    return () => ro?.disconnect();
  }, [safePage, pages]);
  // Once the first placement is committed, let the browser take it in (a style read), then allow gliding.
  useLayoutEffect(() => {
    if (!mark || ready) return;
    void list.current?.offsetWidth;
    setReady(true);
  }, [mark, ready]);
  const changeSize = (n: number) => {
    // Keep the first row you were looking at on screen.
    if (fixedSize === undefined) setOwnSize(n);
    onPageSizeChange?.(n);
    setPage(Math.floor((from > 0 ? from - 1 : 0) / n) + 1);
  };
  return (
    <div className={className} data-fl="c.pagination@classic">
      {total > 0 ? (
        <p className="fl-way-range" role="status" aria-live="polite">
          Showing <strong>{from}–{to}</strong> of <strong>{total}</strong>
        </p>
      ) : null}
      <div className="fl-way-pager">
        <nav aria-label="Pages">
          <ul ref={list} className={`fl-way-pages${mark ? ` is-sliding${ready ? " is-ready" : ""}` : ""}`}>
            {mark ? (
              <li className="fl-way-pages__mark" aria-hidden="true" style={{ transform: `translate(${mark.x}px, ${mark.y}px)`, width: mark.w, height: mark.h }} />
            ) : null}
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
                  <button type="button" className="fl-way-page" aria-current={p === safePage ? "page" : undefined} aria-label={`Page ${p}`} onClick={() => setPage(p)}>
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
        {pageSizes ? (
          <label className="fl-way-pagesize" htmlFor={`${uid}-size`}>
            Rows per page
            <span className="fl-way-select">
              <select id={`${uid}-size`} value={size} onChange={(e) => changeSize(Number(e.target.value))}>
                {pageSizes.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <Chevron dir="down" />
            </span>
          </label>
        ) : null}
      </div>
    </div>
  );
}

export function Pagination(props: PaginationProps) {
  if (props.version === "classic") return <ClassicPager {...props} />;
  const { variant = "numbered", page = 1, pageCount = 1, onPageChange, prevLabel = "Previous", nextLabel = "Next", shown = 0, total = 0, step = 25, onLoadMore, version: _version, pageSize: _ps, defaultPageSize: _dps, pageSizes: _pss, onPageSizeChange: _opsc, defaultPage: _dp, className, ...rest } = props;
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
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>Numbered</h3>
        <p className="fl-ctl-btn-what">For lists people come back to. The ends disable rather than disappear.</p>
        <Pagination page={page} pageCount={last} onPageChange={setPage} />
        <p className="fl-ctl-matrix-what" role="status" aria-live="polite">
          Showing {first.toLocaleString("en-US")} to {upTo.toLocaleString("en-US")} of {count.toLocaleString("en-US")}
        </p>
      </div>

      <div className="fl-ctl-spec">
        <h3>Previous and next</h3>
        <p className="fl-ctl-btn-what">When the page number does not matter, only the movement.</p>
        <Pagination variant="simple" page={simple} pageCount={last} onPageChange={setSimple} prevLabel="Newer" nextLabel="Older" />
      </div>

      <div className="fl-ctl-spec">
        <h3>Load more</h3>
        <p className="fl-ctl-btn-what">For a feed. It says what is left, so it is never a mystery button.</p>
        <Pagination variant="load-more" shown={shown} total={count} onLoadMore={() => setShown((n) => Math.min(count, n + 25))} />
      </div>

      <div className="fl-ctl-sizes fl-ctl-spec fl-ctl-spec--wide">
        <h3>Versions</h3>
        <p className="fl-ctl-btn-what">
          c.pagination@classic: numbered pages with chevron Previous and Next, an ellipsis for long ranges, a Showing line and a
          rows-per-page select that keeps your first row in view. On a phone the far page numbers drop away.
        </p>
        <Pagination version="classic" total={312} defaultPage={2} defaultPageSize={20} pageSizes={[10, 20, 50]} />
      </div>

      <div className="fl-ctl-sizes fl-ctl-spec">
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
