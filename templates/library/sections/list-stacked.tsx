/** @flowcode-library list-stacked · Stacked list (Tables and lists)
 * Catalog ID: p.filterable-list (pattern)
 * Function: The filterable list pattern (p.filterable-list): a search box and status filter above stacked rows that each show a name, a line of detail, an amount and a status badge, and open to show more; an empty state when nothing matches.
 * Use it as: import { FilterableList } from "./list-stacked"; <FilterableList title? lede? noun? items={[{ id, title, meta?, aside?, status?, keywords?, detail?: [{ label, value }] }]} statuses={{ paid: { label, tone } }} searchLabel? searchPlaceholder? emptyTitle? emptyText? resetLabel? />
 * Built from: c.list-row.link, c.avatar.person, c.badge.status, c.chip.filter, c.text-field.outlined, c.empty-state.no-results, c.button.secondary
 * Look: A heading and lede, a search field with a row of filter chips beside it, then a bordered stack of rows (initial avatar, name and detail, amount and status badge, chevron) where the open row shows its facts underneath.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text-muted --color-accent --radius-lg --space-2 --space-3 --space-4 --text-sm
 * Use cases: contact list; team members; order list; inbox; search results; file list; patient list; ticket list; mobile list
 * Jobs to be done: find a person or item quickly; filter by status; see details without leaving the list; check what needs attention
 * Keywords: list, mobile, search, filter
 */
/**
 * Filterable list: the phone-friendly view of a table. Each row shows initials, a title, a meta line, a status and a
 * chevron, and opens to show more. A search box and status filter sit above, with an empty state when nothing
 * matches, and a hidden live count tells screen readers how many rows are shown. Use it instead of a wide table on
 * small screens, or for inboxes and client lists. Make it the app's own: pass real items and statuses, and point
 * each row's detail at your own record.
 */
import { useMemo, useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";
import { Badge, type BadgeTone } from "./badges-status";
import { Chip } from "./chips-tags";
import { Avatar } from "./avatars-variants";
import { ListRow } from "./lists-rows";
import { TextField } from "./text-fields-states";
import { EmptyState } from "./empty-states";

// ── p.filterable-list: search, status filter and rows that open. Built from c.list-row, c.chip, c.badge and c.empty-state. ──

export type FilterableItem = {
  id: string;
  /** The row's main text; the avatar's initials come from it. */
  title: string;
  /** The quiet line under the title. */
  meta?: string;
  /** Quiet text at the right, before the status (an amount, a time). */
  aside?: ReactNode;
  /** A key of the statuses prop: draws that badge and is what the filter matches. */
  status?: string;
  /** Extra words the search also matches, besides the title and meta. */
  keywords?: string;
  /** Label and value pairs shown beneath the row while it is open. */
  detail?: { label: string; value: ReactNode }[];
};

export type FilterableStatus = { label: string; tone?: BadgeTone };

export type FilterableListProps = {
  title?: string;
  lede?: string;
  items: FilterableItem[];
  /** The statuses that exist; each becomes a filter chip after "All". */
  statuses?: Record<string, FilterableStatus>;
  /** What the rows are, plural, for the count and the filter's name: "clients". */
  noun?: string;
  searchLabel?: string;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyText?: string;
  /** The empty state's button, which clears the search and filter. */
  resetLabel?: string;
  className?: string;
};

export function FilterableList({
  title,
  lede,
  items,
  statuses = {},
  noun = "items",
  searchLabel = "Search",
  searchPlaceholder = "Search",
  emptyTitle = "Nothing matches",
  emptyText = "Try another search, or show everything.",
  resetLabel = "Show all",
  className,
}: FilterableListProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const filters = [{ id: "all", label: "All" }, ...Object.entries(statuses).map(([id, s]) => ({ id, label: s.label }))];

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((r) => (filter === "all" || r.status === filter) && (!q || (r.keywords ?? `${r.title} ${r.meta ?? ""}`).toLowerCase().includes(q) || r.title.toLowerCase().includes(q)));
  }, [items, query, filter]);

  function reset() {
    setQuery("");
    setFilter("all");
  }

  return (
    <div className={["fl-tbl", className ?? ""].filter(Boolean).join(" ")} data-fl="p.filterable-list">
      {title || lede ? (
        <div className="fl-head" style={{ marginBottom: 0 }}>
          {title ? <h2 className="fl-title fl-title--md">{title}</h2> : null}
          {lede ? <p className="fl-text">{lede}</p> : null}
        </div>
      ) : null}

      <div className="fl-tbl-filters">
        <div className="fl-tbl-search" role="search">
          <Icon name="search" />
          <TextField type="search" aria-label={searchLabel} placeholder={searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {filters.length > 1 ? (
          <div role="group" aria-label={`Show ${noun} by status`} style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", maxWidth: "100%" }}>
            {filters.map((f) => (
              <Chip key={f.id} selected={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </Chip>
            ))}
          </div>
        ) : null}
      </div>

      <p className="fl-sr" aria-live="polite">
        {shown.length} {shown.length === 1 ? noun.replace(/s$/, "") : noun} shown
      </p>

      {shown.length === 0 ? (
        <EmptyState
          variant="no-results"
          title={emptyTitle}
          action={
            <Button variant="secondary" size={32} onClick={reset}>
              {resetLabel}
            </Button>
          }
        >
          {emptyText}
        </EmptyState>
      ) : (
        <ul className="fl-ctl-rows fl-ctl-rows--links" aria-label={title ?? noun}>
          {shown.map((r) => {
            const s = r.status ? statuses[r.status] : undefined;
            const open = openId === r.id;
            return (
              <ListRow
                key={r.id}
                variant="link"
                lead={<Avatar name={r.title} size={40} decorative />}
                title={r.title}
                meta={r.meta}
                aside={
                  r.aside || s ? (
                    <>
                      {r.aside}
                      {r.aside && s ? " " : null}
                      {s ? <Badge tone={s.tone}>{s.label}</Badge> : null}
                    </>
                  ) : undefined
                }
                expanded={open}
                onClick={() => setOpenId(open ? null : r.id)}
                detail={
                  r.detail ? (
                    <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "var(--space-2) var(--space-4)", margin: 0 }}>
                      {r.detail.map((d) => (
                        <div key={d.label} style={{ display: "contents" }}>
                          <dt className="fl-tbl-muted">{d.label}</dt>
                          <dd style={{ margin: 0 }}>{d.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : undefined
                }
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Clients",
  lede: "Everyone booked in this month. Tap a client to see their booking.",
  noun: "clients",
  searchLabel: "Search clients",
  searchPlaceholder: "Search by name or service",
  emptyTitle: "No clients match",
  emptyText: "Try another name, or show all clients.",
  resetLabel: "Show all clients",
  statuses: {
    upcoming: { label: "Upcoming", tone: "info" as const },
    paid: { label: "Paid", tone: "success" as const },
    cancelled: { label: "Cancelled", tone: "danger" as const },
  },
  items: [
    { id: "c1", title: "Maya Okafor", meta: "Portrait session · Mon 5 Oct, 10:00", aside: "$180.00", status: "paid", detail: [{ label: "When", value: "Mon 5 Oct at 10:00" }, { label: "Service", value: "Portrait session" }, { label: "Notes", value: "Wants two outfit changes. Bringing her own props." }] },
    { id: "c2", title: "Tom Reyes", meta: "Product shoot · Tue 6 Oct, 13:30", aside: "$520.00", status: "upcoming", detail: [{ label: "When", value: "Tue 6 Oct at 13:30" }, { label: "Service", value: "Product shoot" }, { label: "Notes", value: "Twelve ceramic pieces, white background, square crops." }] },
    { id: "c3", title: "Ana Lindqvist", meta: "Headshots · Tue 6 Oct, 16:00", aside: "$95.00", status: "upcoming", detail: [{ label: "When", value: "Tue 6 Oct at 16:00" }, { label: "Service", value: "Headshots" }, { label: "Notes", value: "Deposit still due. Reminder sent on Friday." }] },
    { id: "c4", title: "Corner Bakery", meta: "Menu photos · Thu 8 Oct, 08:00", aside: "$360.00", status: "paid", detail: [{ label: "When", value: "Thu 8 Oct at 08:00" }, { label: "Service", value: "Menu photos" }, { label: "Notes", value: "Shoot before opening. Natural light by the window." }] },
    { id: "c5", title: "Jonah Patel", meta: "Family session · Fri 9 Oct, 11:00", aside: "$240.00", status: "cancelled", detail: [{ label: "When", value: "Fri 9 Oct at 11:00" }, { label: "Service", value: "Family session" }, { label: "Notes", value: "Moved to next month. Deposit kept as credit." }] },
  ],
};

export default function ListStacked() {
  return (
    <section className="fl-section fl-section--tint">
      <div className="fl-wrap fl-wrap--narrow">
        <FilterableList {...SAMPLE} />
      </div>
    </section>
  );
}
