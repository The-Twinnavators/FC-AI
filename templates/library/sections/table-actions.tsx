/** @flowcode-library table-actions · Table with row actions (Tables and lists)
 * Catalog ID: p.resource-table (pattern)
 * Function: The resource table pattern (p.resource-table): a search box above a data table whose every row has an Edit, Duplicate and Delete menu, with an edit dialog, a delete confirmation and numbered pagination with row counts below.
 * Use it as: import { ResourceTable } from "./table-actions"; <ResourceTable title? lede? noun="booking" columns={[{ id, label, num?, render? }]} rows={[{ id, ... }]} editFields={[{ key, label, kind?: "text"|"number", error? }]} nameKey? pageSize? searchLabel? searchPlaceholder? copyOverrides? describe?={(row) => text} onRowsChange?={(rows) => ...} />
 * Built from: p.data-table, c.menu, c.modal.form, c.modal.danger, c.text-field.outlined, c.pagination.numbered, c.badge.status, c.button.secondary
 * Look: A heading, a search box with a live row count, a table with a three-dot menu at the end of each row, a footer with "Showing 1-4 of 9" beside page numbers, and a quiet status line announcing each change.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text-muted --color-success --radius-lg --space-2 --space-3 --space-4 --text-sm
 * Use cases: admin table; user management; order management; bookings list; invoice list; inventory management; customer list; content management
 * Jobs to be done: find a record quickly; edit or remove an entry; check the status of each order; manage records page by page
 * Keywords: table, search, pagination, admin, status
 */
/**
 * Resource table: search, row actions and pages. A search box above filters the rows; each row has a menu (edit,
 * duplicate, delete); Edit opens a dialog with the editable fields checked before saving, Delete asks first, and a
 * status line announces what changed. Pagination sits below with the row counts. Use it for admin lists people manage
 * day to day: bookings, orders, stock. Make it the app's own: pass real rows and columns, name the editable fields, and
 * save through onRowsChange.
 */
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";
import { Badge, type BadgeTone } from "./badges-status";
import { DataTable, type TableColumn, type TableRow } from "./tables-states";
import { Menu, type MenuItem } from "./popovers-menus";
import { Modal } from "./modals-dialogs";
import { TextField } from "./text-fields-states";
import { Pagination } from "./pagination-variants";

// ── p.resource-table: search, a menu on every row, edit and delete dialogs, pages. Built from p.data-table, c.menu, c.modal, c.pagination. ──

export type ResourceField = {
  /** The row key this field edits. */
  key: string;
  label: string;
  /** number: a figure of 0 or more. Text (not empty) when left out. */
  kind?: "text" | "number";
  /** The message when the entry is refused; a plain default per kind when left out. */
  error?: string;
};

export type ResourceTableProps<R extends TableRow = TableRow> = {
  title?: string;
  lede?: string;
  /** What one row is, singular: "booking". Used in the count, the dialogs and the status line. */
  noun?: string;
  columns: TableColumn<R>[];
  rows: R[];
  /** The fields the Edit dialog offers. */
  editFields: ResourceField[];
  /** The row key that names a row; the first column when left out. */
  nameKey?: string;
  pageSize?: number;
  searchLabel?: string;
  searchPlaceholder?: string;
  /** Values set on the copy a Duplicate makes, such as { status: "pending" }. The name gets " (copy)". */
  copyOverrides?: Record<string, unknown>;
  /** One sentence for the delete confirmation, saying what goes. */
  describe?: (row: R) => string;
  /** Called with the full list of rows after an edit, duplicate or delete. */
  onRowsChange?: (rows: R[]) => void;
  className?: string;
};

const MENU: MenuItem[] = [
  { id: "edit", label: "Edit", icon: "pencil" },
  { id: "duplicate", label: "Duplicate", icon: "copy" },
  { id: "delete", label: "Delete…", icon: "trash", danger: true },
];

export function ResourceTable<R extends TableRow>({
  title,
  lede,
  noun = "item",
  columns,
  rows: given,
  editFields,
  nameKey,
  pageSize = 10,
  searchLabel = "Search",
  searchPlaceholder = "Search",
  copyOverrides,
  describe,
  onRowsChange,
  className,
}: ResourceTableProps<R>) {
  const [rows, setRows] = useState<R[]>(given);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<{ kind: "edit" | "delete"; row: R } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const name = nameKey ?? columns[0].id;
  const nameOf = (r: R) => String(r[name] ?? r.id);
  const searchId = `rt-search-${noun}`;
  const fieldId = (key: string) => `rt-${noun}-${key}`;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => columns.map((c) => String(r[c.id] ?? "")).join(" ").toLowerCase().includes(q)) : rows;
  }, [rows, query, columns]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize);
  const from = filtered.length ? (current - 1) * pageSize + 1 : 0;
  const to = Math.min(current * pageSize, filtered.length);
  const plural = (n: number) => `${n} ${noun}${n === 1 ? "" : "s"}`;

  function commit(next: R[]) {
    setRows(next);
    onRowsChange?.(next);
  }

  function pick(row: R, id: string) {
    if (id === "duplicate") {
      const copy = { ...row, ...copyOverrides, id: `${row.id}-${Date.now()}`, [name]: `${nameOf(row)} (copy)` } as R;
      const i = rows.findIndex((r) => r.id === row.id);
      commit([...rows.slice(0, i + 1), copy, ...rows.slice(i + 1)]);
      setStatus(`Duplicated the ${noun} for ${nameOf(row)}.`);
      return;
    }
    setErrors({});
    setDialog({ kind: id === "edit" ? "edit" : "delete", row });
  }

  function saveEdit(data: FormData): false | void {
    if (!dialog) return false;
    const next: Record<string, string> = {};
    const patch: Record<string, unknown> = {};
    for (const f of editFields) {
      const raw = String(data.get(f.key) ?? "").trim();
      if (f.kind === "number") {
        const n = Number(raw);
        if (!raw || Number.isNaN(n) || n < 0) next[f.key] = f.error ?? "Enter a figure of 0 or more, numbers only.";
        else patch[f.key] = n;
      } else if (!raw) next[f.key] = f.error ?? `Enter the ${f.label.toLowerCase()}.`;
      else patch[f.key] = raw;
    }
    setErrors(next);
    const bad = editFields.find((f) => next[f.key]);
    if (bad) {
      document.getElementById(fieldId(bad.key))?.focus();
      return false;
    }
    commit(rows.map((r) => (r.id === dialog.row.id ? { ...r, ...patch } : r)));
    setStatus(`Saved changes to ${String(patch[name] ?? nameOf(dialog.row))}'s ${noun}.`);
    setDialog(null);
  }

  function confirmDelete() {
    if (!dialog) return;
    const gone = nameOf(dialog.row);
    commit(rows.filter((r) => r.id !== dialog.row.id));
    setStatus(`Deleted the ${noun} for ${gone}.`);
    setDialog(null);
    // The row's menu button is gone, so focus goes back to the search box.
    requestAnimationFrame(() => document.getElementById(searchId)?.focus());
  }

  return (
    <div className={["fl-tbl", "fl-tbl-resource", className ?? ""].filter(Boolean).join(" ")} data-fl="p.resource-table">
      {title || lede ? (
        <div className="fl-head" style={{ marginBottom: 0 }}>
          {title ? <h2 className="fl-title fl-title--md">{title}</h2> : null}
          {lede ? <p className="fl-text">{lede}</p> : null}
        </div>
      ) : null}
      <div className="fl-tbl-toolbar">
        <div className="fl-tbl-search" role="search">
          <Icon name="search" />
          <TextField
            id={searchId}
            type="search"
            aria-label={searchLabel}
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <p className="fl-meta" aria-live="polite" style={{ margin: 0 }}>
          {plural(filtered.length)}
        </p>
      </div>

      <div>
        <DataTable
          caption={`${title ?? `${noun}s`}, page ${current} of ${pages}`}
          columns={columns}
          rows={visible}
          sortable={false}
          emptyTitle={rows.length ? `No ${noun}s match` : `No ${noun}s yet`}
          emptyHint={rows.length ? "Try a different search, or clear it." : `New ${noun}s appear here.`}
          emptyAction={query ? "Clear search" : undefined}
          onEmptyAction={() => setQuery("")}
          rowActions={(r) => <Menu iconOnly align="end" label={`Actions for ${nameOf(r)}`} items={MENU} onSelect={(id) => pick(r, id)} />}
        />
        <div className="fl-tbl-resource-foot" style={{ paddingTop: "var(--space-3)" }}>
          <p className="fl-meta" style={{ margin: 0, fontVariantNumeric: "tabular-nums" }}>
            {filtered.length ? `Showing ${from}–${to} of ${filtered.length}` : "Nothing to show"}
          </p>
          <Pagination page={current} pageCount={pages} onPageChange={setPage} />
        </div>
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

      {dialog?.kind === "edit" && (
        <Modal variant="form" title={`Edit ${noun}`} confirmLabel="Save changes" onConfirm={saveEdit} onClose={() => setDialog(null)}>
          {editFields.map((f) => (
            <p key={f.key}>
              <label htmlFor={fieldId(f.key)}>{f.label}</label>
              <TextField
                id={fieldId(f.key)}
                name={f.key}
                size={40}
                inputMode={f.kind === "number" ? "decimal" : undefined}
                defaultValue={String(dialog.row[f.key] ?? "")}
                invalid={!!errors[f.key]}
                aria-describedby={errors[f.key] ? `${fieldId(f.key)}-error` : undefined}
              />
              {errors[f.key] ? (
                <span id={`${fieldId(f.key)}-error`} className="fl-dlg-error">
                  {errors[f.key]}
                </span>
              ) : null}
            </p>
          ))}
        </Modal>
      )}

      {dialog?.kind === "delete" && (
        <Modal
          variant="danger"
          title={`Delete this ${noun}?`}
          description={describe ? describe(dialog.row) : `${nameOf(dialog.row)} will be removed.`}
          warning="This can't be undone."
          confirmLabel={`Delete ${noun}`}
          cancelLabel="Keep it"
          onConfirm={confirmDelete}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Bookings",
  lede: "Everything booked at the studio. Use the row menu to edit, copy or remove a booking.",
  noun: "booking",
  searchLabel: "Search bookings",
  searchPlaceholder: "Search by client or service",
  pageSize: 4,
  nameKey: "client",
  copyOverrides: { status: "pending" },
  editFields: [
    { key: "client", label: "Client", kind: "text" as const, error: "Enter the client's name." },
    { key: "amount", label: "Amount ($)", kind: "number" as const, error: "Enter an amount of 0 or more, numbers only." },
  ],
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
  statuses: {
    confirmed: { label: "Confirmed", tone: "info" },
    paid: { label: "Paid", tone: "success" },
    pending: { label: "Awaiting deposit", tone: "neutral" },
    cancelled: { label: "Cancelled", tone: "danger" },
  } as Record<string, { label: string; tone: BadgeTone }>,
};

type Booking = (typeof SAMPLE.rows)[number] & Record<string, unknown>;

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const COLUMNS: TableColumn<Booking>[] = [
  { id: "client", label: "Client" },
  { id: "service", label: "Service" },
  { id: "date", label: "Date" },
  { id: "status", label: "Status", render: (r): ReactNode => <Badge tone={SAMPLE.statuses[r.status].tone}>{SAMPLE.statuses[r.status].label}</Badge> },
  { id: "amount", label: "Amount", num: true, render: (r) => money(r.amount) },
];

export default function TableActions() {
  const { statuses: _statuses, rows, ...rest } = SAMPLE;
  void _statuses;
  return (
    <section className="fl-section fl-section--tint">
      <div className="fl-wrap">
        <ResourceTable {...rest} columns={COLUMNS} rows={rows as Booking[]} describe={(r) => `${r.client}'s ${r.service.toLowerCase()} on ${r.date} will be removed.`} />
      </div>
    </section>
  );
}
