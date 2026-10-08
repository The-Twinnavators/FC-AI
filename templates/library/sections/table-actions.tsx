/**
 * Table: search, row actions and pages. Status badges, a per-row menu (edit, duplicate, delete with a confirm step),
 * a search box above and pagination below. Use it for admin lists people manage day to day: bookings, orders, stock.
 * Make it the app's own: replace SAMPLE with real rows and statuses, and change `pageSize` to suit the screen.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  title: "Bookings",
  lede: "Everything booked at the studio. Use the row menu to edit, copy or remove a booking.",
  searchLabel: "Search bookings",
  searchPlaceholder: "Search by client or service",
  pageSize: 4,
  currency: "$",
  statuses: {
    confirmed: { label: "Confirmed", tone: "accent" },
    paid: { label: "Paid", tone: "success" },
    pending: { label: "Awaiting deposit", tone: "muted" },
    cancelled: { label: "Cancelled", tone: "danger" },
  },
  rows: [
    { id: "r1", client: "Maya Okafor", service: "Portrait session", date: "Mon 5 Oct", amount: 180, status: "paid" },
    { id: "r2", client: "Tom Reyes", service: "Product shoot", date: "Tue 6 Oct", amount: 520, status: "confirmed" },
    { id: "r3", client: "Ana Lindqvist", service: "Headshots", date: "Tue 6 Oct", amount: 95, status: "pending" },
    { id: "r4", client: "Corner Bakery", service: "Menu photos", date: "Thu 8 Oct", amount: 360, status: "confirmed" },
    { id: "r5", client: "Jonah Patel", service: "Family session", date: "Fri 9 Oct", amount: 240, status: "cancelled" },
    { id: "r6", client: "Elif Demir", service: "Studio hire", date: "Sat 10 Oct", amount: 300, status: "paid" },
    { id: "r7", client: "Sam Whitfield", service: "Pet portraits", date: "Sat 10 Oct", amount: 150, status: "pending" },
    { id: "r8", client: "Green Door Florist", service: "Product shoot", date: "Mon 12 Oct", amount: 440, status: "confirmed" },
    { id: "r9", client: "Priya Nair", service: "Headshots", date: "Tue 13 Oct", amount: 95, status: "paid" },
  ],
  emptyTitle: "No bookings match",
  emptyText: "Try a different name or service, or clear the search.",
};

type Row = (typeof SAMPLE.rows)[number];
type StatusKey = keyof typeof SAMPLE.statuses;

function Svg({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const ICON = {
  dots: "M12 6.5h.01M12 12h.01M12 17.5h.01",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  copy: "M8 8h11v11H8zM5 16V5h11",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  prev: "M15 6l-6 6 6 6",
  next: "M9 6l6 6-6 6",
};

/** A small modal: labelled, Escape closes, focus moves in and goes back to whatever opened it. */
function Dialog({ title, onClose, children, returnTo }: { title: string; onClose: () => void; children: ReactNode; returnTo: HTMLElement | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = ref.current;
    box?.querySelector<HTMLElement>("input, button")?.focus();
    return () => {
      if (returnTo && document.body.contains(returnTo)) returnTo.focus();
    };
  }, [returnTo]);
  function onKey(e: ReactKeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
    if (e.key === "Tab" && ref.current) {
      const items = Array.from(ref.current.querySelectorAll<HTMLElement>("input, button"));
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
  return (
    <div className="fl-tbl-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="fl-tbl-dialog" role="dialog" aria-modal="true" aria-labelledby="table-actions-dialog-title" onKeyDown={onKey}>
        <h3 id="table-actions-dialog-title">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export default function TableActions() {
  const d = SAMPLE;
  const [rows, setRows] = useState<Row[]>(d.rows);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ kind: "edit" | "delete"; row: Row } | null>(null);
  const [draft, setDraft] = useState({ client: "", amount: "" });
  const [errors, setErrors] = useState<{ client?: string; amount?: string }>({});
  const [status, setStatus] = useState("");
  const triggers = useRef<Record<string, HTMLButtonElement | null>>({});
  const searchRef = useRef<HTMLInputElement>(null);
  const [returnTo, setReturnTo] = useState<HTMLElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => `${r.client} ${r.service}`.toLowerCase().includes(q)) : rows;
  }, [rows, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / d.pageSize));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * d.pageSize, current * d.pageSize);
  const from = filtered.length ? (current - 1) * d.pageSize + 1 : 0;
  const to = Math.min(current * d.pageSize, filtered.length);

  // Close the open row menu on an outside click.
  useEffect(() => {
    if (!menuFor) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".fl-tbl-actions-cell")) setMenuFor(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuFor]);

  // When a menu opens, move focus to its first item.
  useEffect(() => {
    if (menuFor) document.querySelector<HTMLButtonElement>(`#menu-${menuFor} button`)?.focus();
  }, [menuFor]);

  const money = (n: number) => `${d.currency}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  function closeMenu(id: string) {
    setMenuFor(null);
    triggers.current[id]?.focus();
  }

  function onMenuKey(e: ReactKeyboardEvent<HTMLUListElement>, id: string) {
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu(id);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length].focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length].focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0].focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1].focus();
    } else if (e.key === "Tab") {
      setMenuFor(null);
    }
  }

  function openDialog(kind: "edit" | "delete", row: Row) {
    setReturnTo(triggers.current[row.id] ?? null);
    setMenuFor(null);
    setErrors({});
    setDraft({ client: row.client, amount: String(row.amount) });
    setDialog({ kind, row });
  }

  function duplicate(row: Row) {
    const copy: Row = { ...row, id: `${row.id}-${Date.now()}`, client: `${row.client} (copy)`, status: "pending" };
    setRows((rs) => {
      const i = rs.findIndex((r) => r.id === row.id);
      return [...rs.slice(0, i + 1), copy, ...rs.slice(i + 1)];
    });
    setStatus(`Duplicated the booking for ${row.client}.`);
    closeMenu(row.id);
  }

  function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!dialog) return;
    const next: typeof errors = {};
    const amount = Number(draft.amount);
    if (!draft.client.trim()) next.client = "Enter the client's name.";
    if (!draft.amount.trim() || Number.isNaN(amount) || amount < 0) next.amount = "Enter an amount of 0 or more, numbers only.";
    setErrors(next);
    if (next.client || next.amount) {
      document.getElementById(next.client ? "ta-client" : "ta-amount")?.focus();
      return;
    }
    setRows((rs) => rs.map((r) => (r.id === dialog.row.id ? { ...r, client: draft.client.trim(), amount } : r)));
    setStatus(`Saved changes to ${draft.client.trim()}'s booking.`);
    setDialog(null);
  }

  function confirmDelete() {
    if (!dialog) return;
    const name = dialog.row.client;
    setRows((rs) => rs.filter((r) => r.id !== dialog.row.id));
    setStatus(`Deleted the booking for ${name}.`);
    setDialog(null);
    // The row's menu button is gone, so focus goes back to the search box.
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  return (
    <section className="fl-section fl-section--tint" aria-labelledby="table-actions-title">
      <div className="fl-wrap fl-tbl">
        <div className="fl-tbl-toolbar">
          <div className="fl-head" style={{ marginBottom: 0 }}>
            <h2 id="table-actions-title" className="fl-title fl-title--md">
              {d.title}
            </h2>
            <p className="fl-text">{d.lede}</p>
          </div>
        </div>
        <div className="fl-tbl-toolbar">
          <div className="fl-tbl-search" role="search">
            <label htmlFor="ta-search" className="fl-sr">
              {d.searchLabel}
            </label>
            <Svg d={ICON.search} />
            <input
              ref={searchRef}
              id="ta-search"
              className="fl-input"
              type="search"
              placeholder={d.searchPlaceholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <p className="fl-meta" aria-live="polite" style={{ margin: 0 }}>
            {filtered.length} {filtered.length === 1 ? "booking" : "bookings"}
          </p>
        </div>

        <div className="fl-tbl-panel">
          <div className="fl-tbl-scroll">
            <table className="fl-tbl-table" style={{ minWidth: "40rem" }}>
              <caption className="fl-sr">
                {d.title}, page {current} of {pages}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col">Service</th>
                  <th scope="col">Date</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="fl-tbl-num">
                    Amount
                  </th>
                  <th scope="col" className="fl-tbl-actions-cell">
                    <span className="fl-sr">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={6} className="fl-tbl-empty-cell">
                      <div className="fl-tbl-empty">
                        <span className="fl-icon">
                          <Svg d={ICON.search} />
                        </span>
                        <strong>{rows.length ? d.emptyTitle : "No bookings yet"}</strong>
                        <span>{rows.length ? d.emptyText : "New bookings appear here."}</span>
                        {query && (
                          <button type="button" className="fl-btn fl-btn--secondary fl-tbl-btn-sm" onClick={() => setQuery("")}>
                            Clear search
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                {visible.map((r) => {
                  const s = d.statuses[r.status as StatusKey];
                  const open = menuFor === r.id;
                  return (
                    <tr key={r.id}>
                      <th scope="row">{r.client}</th>
                      <td>{r.service}</td>
                      <td className="fl-tbl-nowrap">{r.date}</td>
                      <td>
                        <span className={`fl-tbl-status fl-tbl-status--${s.tone}`}>{s.label}</span>
                      </td>
                      <td className="fl-tbl-num">{money(r.amount)}</td>
                      <td className="fl-tbl-actions-cell">
                        <button
                          ref={(el) => {
                            triggers.current[r.id] = el;
                          }}
                          type="button"
                          className="fl-tbl-icon-btn"
                          aria-haspopup="menu"
                          aria-expanded={open}
                          aria-controls={open ? `menu-${r.id}` : undefined}
                          aria-label={`Actions for ${r.client}`}
                          onClick={() => setMenuFor(open ? null : r.id)}
                        >
                          <Svg d={ICON.dots} />
                        </button>
                        {open && (
                          <ul id={`menu-${r.id}`} className="fl-tbl-menu" role="menu" aria-label={`Actions for ${r.client}`} onKeyDown={(e) => onMenuKey(e, r.id)}>
                            <li role="none">
                              <button type="button" role="menuitem" tabIndex={-1} onClick={() => openDialog("edit", r)}>
                                <Svg d={ICON.edit} /> Edit
                              </button>
                            </li>
                            <li role="none">
                              <button type="button" role="menuitem" tabIndex={-1} onClick={() => duplicate(r)}>
                                <Svg d={ICON.copy} /> Duplicate
                              </button>
                            </li>
                            <li role="none">
                              <hr />
                            </li>
                            <li role="none">
                              <button type="button" role="menuitem" tabIndex={-1} className="fl-tbl-danger" onClick={() => openDialog("delete", r)}>
                                <Svg d={ICON.trash} /> Delete…
                              </button>
                            </li>
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <nav className="fl-tbl-foot" aria-label="Pages">
            <p className="fl-meta" style={{ margin: 0, fontVariantNumeric: "tabular-nums" }}>
              {filtered.length ? `Showing ${from}–${to} of ${filtered.length}` : "Nothing to show"}
            </p>
            <ul className="fl-tbl-pages">
              <li>
                <button type="button" className="fl-tbl-page" aria-label="Previous page" disabled={current === 1} onClick={() => setPage(current - 1)}>
                  <Svg d={ICON.prev} />
                </button>
              </li>
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                <li key={n}>
                  <button type="button" className="fl-tbl-page" aria-label={`Page ${n}`} aria-current={n === current ? "page" : undefined} onClick={() => setPage(n)}>
                    {n}
                  </button>
                </li>
              ))}
              <li>
                <button type="button" className="fl-tbl-page" aria-label="Next page" disabled={current === pages} onClick={() => setPage(current + 1)}>
                  <Svg d={ICON.next} />
                </button>
              </li>
            </ul>
          </nav>
        </div>

        <p className="fl-note" role="status" aria-live="polite" style={{ margin: 0, minHeight: "1.5em", display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          {status && (
            <>
              <span className="fl-tick">
                <Icon name="check" />
              </span>
              {status}
            </>
          )}
        </p>
      </div>

      {dialog?.kind === "edit" && (
        <Dialog title="Edit booking" onClose={() => setDialog(null)} returnTo={returnTo}>
          <form className="fl-form" onSubmit={saveEdit} noValidate>
            <div className="fl-field">
              <label htmlFor="ta-client">Client</label>
              <input
                id="ta-client"
                className="fl-input"
                value={draft.client}
                aria-invalid={!!errors.client}
                aria-describedby={errors.client ? "ta-client-error" : undefined}
                onChange={(e) => setDraft({ ...draft, client: e.target.value })}
              />
              {errors.client && (
                <span id="ta-client-error" className="fl-note" style={{ color: "var(--color-danger)" }}>
                  {errors.client}
                </span>
              )}
            </div>
            <div className="fl-field">
              <label htmlFor="ta-amount">Amount ({d.currency})</label>
              <input
                id="ta-amount"
                className="fl-input"
                inputMode="decimal"
                value={draft.amount}
                aria-invalid={!!errors.amount}
                aria-describedby={errors.amount ? "ta-amount-error" : undefined}
                onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
              />
              {errors.amount && (
                <span id="ta-amount-error" className="fl-note" style={{ color: "var(--color-danger)" }}>
                  {errors.amount}
                </span>
              )}
            </div>
            <div className="fl-actions" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="fl-btn fl-btn--secondary" onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button type="submit" className="fl-btn fl-btn--primary">
                Save changes
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {dialog?.kind === "delete" && (
        <Dialog title="Delete this booking?" onClose={() => setDialog(null)} returnTo={returnTo}>
          <p className="fl-text">
            {dialog.row.client}'s {dialog.row.service.toLowerCase()} on {dialog.row.date} will be removed. This can't be undone.
          </p>
          <div className="fl-actions">
            <button type="button" className="fl-btn fl-btn--secondary" onClick={() => setDialog(null)}>
              Keep it
            </button>
            <button type="button" className="fl-btn fl-tbl-btn-danger" onClick={confirmDelete}>
              Delete booking
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
