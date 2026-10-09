/** @flowcode-library list-stacked · Stacked list (Tables and lists)
 * Use cases: contact list; team members; order list; inbox; search results; file list; patient list; ticket list; mobile list
 * Jobs to be done: find a person or item quickly; filter by status; see details without leaving the list; check what needs attention
 * Keywords: list, mobile, search, filter
 */
/**
 * Stacked list: the phone-friendly view of a table. Each row shows initials, a title, a meta line, a status and a
 * chevron, and opens to show more. A search box and status filter sit above, with an empty state when nothing
 * matches. Use it instead of a wide table on small screens, or for inboxes and client lists. Make it the app's own:
 * replace SAMPLE with real records and statuses, and point each row at its detail screen.
 */
import { useMemo, useState } from "react";

// flowcode:sample
const SAMPLE = {
  title: "Clients",
  lede: "Everyone booked in this month. Tap a client to see their booking.",
  searchLabel: "Search clients",
  searchPlaceholder: "Search by name or service",
  currency: "$",
  filters: [
    { id: "all", label: "All" },
    { id: "upcoming", label: "Upcoming" },
    { id: "paid", label: "Paid" },
    { id: "cancelled", label: "Cancelled" },
  ],
  statuses: {
    upcoming: { label: "Upcoming", tone: "accent" },
    paid: { label: "Paid", tone: "success" },
    cancelled: { label: "Cancelled", tone: "danger" },
  },
  rows: [
    { id: "c1", name: "Maya Okafor", service: "Portrait session", date: "Mon 5 Oct", time: "10:00", amount: 180, status: "paid", note: "Wants two outfit changes. Bringing her own props." },
    { id: "c2", name: "Tom Reyes", service: "Product shoot", date: "Tue 6 Oct", time: "13:30", amount: 520, status: "upcoming", note: "Twelve ceramic pieces, white background, square crops." },
    { id: "c3", name: "Ana Lindqvist", service: "Headshots", date: "Tue 6 Oct", time: "16:00", amount: 95, status: "upcoming", note: "Deposit still due. Reminder sent on Friday." },
    { id: "c4", name: "Corner Bakery", service: "Menu photos", date: "Thu 8 Oct", time: "08:00", amount: 360, status: "paid", note: "Shoot before opening. Natural light by the window." },
    { id: "c5", name: "Jonah Patel", service: "Family session", date: "Fri 9 Oct", time: "11:00", amount: 240, status: "cancelled", note: "Moved to next month. Deposit kept as credit." },
  ],
  emptyTitle: "No clients match",
  emptyText: "Try another name, or show all clients.",
};

type Row = (typeof SAMPLE.rows)[number];
type StatusKey = keyof typeof SAMPLE.statuses;

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function Svg({ d, className }: { d: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function ListStacked() {
  const d = SAMPLE;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return d.rows.filter((r: Row) => (filter === "all" || r.status === filter) && (!q || `${r.name} ${r.service}`.toLowerCase().includes(q)));
  }, [d.rows, query, filter]);

  const money = (n: number) => `${d.currency}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  function reset() {
    setQuery("");
    setFilter("all");
  }

  return (
    <section className="fl-section fl-section--tint" aria-labelledby="list-stacked-title">
      <div className="fl-wrap fl-wrap--narrow fl-tbl">
        <div className="fl-head" style={{ marginBottom: 0 }}>
          <h2 id="list-stacked-title" className="fl-title fl-title--md">
            {d.title}
          </h2>
          <p className="fl-text">{d.lede}</p>
        </div>

        <div className="fl-tbl-filters">
          <div className="fl-tbl-search" role="search">
            <label htmlFor="ls-search" className="fl-sr">
              {d.searchLabel}
            </label>
            <Svg d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4" />
            <input id="ls-search" className="fl-input" type="search" placeholder={d.searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="fl-toggle" role="group" aria-label="Show clients by status" style={{ maxWidth: "100%", overflowX: "auto" }}>
            {d.filters.map((f) => (
              <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <p className="fl-sr" aria-live="polite">
          {shown.length} {shown.length === 1 ? "client" : "clients"} shown
        </p>

        <div className="fl-tbl-panel">
          {shown.length === 0 ? (
            <div className="fl-tbl-empty">
              <span className="fl-icon">
                <Svg d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4" />
              </span>
              <strong>{d.emptyTitle}</strong>
              <span>{d.emptyText}</span>
              <button type="button" className="fl-btn fl-btn--secondary fl-tbl-btn-sm" onClick={reset} style={{ marginTop: "var(--space-2)" }}>
                Show all clients
              </button>
            </div>
          ) : (
            <ul className="fl-tbl-list" aria-label={d.title}>
              {shown.map((r) => {
                const s = d.statuses[r.status as StatusKey];
                const open = openId === r.id;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="fl-tbl-row"
                      aria-expanded={open}
                      aria-controls={open ? `ls-detail-${r.id}` : undefined}
                      onClick={() => setOpenId(open ? null : r.id)}
                    >
                      <span className="fl-person__avatar" aria-hidden="true">
                        {initials(r.name)}
                      </span>
                      <span className="fl-tbl-row__body">
                        <span className="fl-tbl-row__title">{r.name}</span>
                        <span className="fl-tbl-row__meta">
                          {r.service} · {r.date}, {r.time}
                        </span>
                      </span>
                      <span className="fl-tbl-row__end">
                        <span className="fl-tbl-row__amount">{money(r.amount)}</span>
                        <span className={`fl-tbl-status fl-tbl-status--${s.tone}`}>{s.label}</span>
                      </span>
                      <Svg className="fl-tbl-chevron" d={open ? "M6 9l6 6 6-6" : "M9 6l6 6-6 6"} />
                    </button>
                    {open && (
                      <div id={`ls-detail-${r.id}`} className="fl-tbl-detail">
                        <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "var(--space-2) var(--space-4)", margin: 0 }}>
                          <dt className="fl-tbl-muted">When</dt>
                          <dd style={{ margin: 0 }}>
                            {r.date} at {r.time}
                          </dd>
                          <dt className="fl-tbl-muted">Service</dt>
                          <dd style={{ margin: 0 }}>{r.service}</dd>
                          <dt className="fl-tbl-muted">Notes</dt>
                          <dd style={{ margin: 0 }}>{r.note}</dd>
                        </dl>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
