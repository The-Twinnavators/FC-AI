/** @flowcode-library pagination · Pagination (classic) (Tabs, breadcrumbs and paging)
 * Catalog ID: c.pagination@classic (component version)
 * Version of: c.pagination
 * Function: Numbered pagination with previous/next, ellipses for long ranges, a page-size select, a status filter and a "Showing 21–40 of 312" line over a list of bookings.
 * Use it as: import { Pagination } from "./pagination-variants"; <Pagination version="classic" total={312} pageSizes?={[10,20,50]} defaultPageSize? defaultPage? page? pageCount? onPageChange? pageSize? onPageSizeChange? />
 * Look: Bordered page-number buttons with chevron Previous and Next, a Showing x-y of z line and a rows-per-page select.
 * Tokens: --color-accent --color-on-accent --color-border --color-text --color-text-muted --color-surface --radius-md --space-1 --space-2 --space-3 --weight-semibold --focus-ring
 * Use cases: paged list; search results; order history; bookings list; transaction list; data table paging; records list; archive
 * Jobs to be done: browse through a long list; jump to a specific page; show more results per page; filter records by status
 * Keywords: pagination, pages, page size, list, navigation
 */
/**
 * Pagination: c.pagination@classic. The implementation lives in the component, in ./pagination-variants. Numbered
 * pages with previous and next, ellipses for long ranges, a page-size select and a "Showing 21–40 of 312" line. Use it
 * under any long list or table that loads a page at a time.
 * Make it the app's own: replace SAMPLE with your row count and page sizes.
 */
import { Pagination as Pager } from "./pagination-variants";

// flowcode:sample
const SAMPLE = {
  total: 312,
  pageSizes: [10, 20, 50],
  defaultSize: 20,
  defaultPage: 2,
};

export default function Pagination() {
  const d = SAMPLE;
  return (
    <section className="fl-section">
      <div className="fl-wrap fl-wrap--narrow">
        <Pager version="classic" total={d.total} pageSizes={d.pageSizes} defaultPageSize={d.defaultSize} defaultPage={d.defaultPage} />
      </div>
    </section>
  );
}
