/** @flowcode-library resource-index · Resource index: a complete working list of records (Tables and lists)
 * Catalog ID: p.resource-index (pattern)
 * Function: The resource index (p.resource-index): the main screen for one kind of record, with summary tiles, status tabs, search and filters, sorting, row and bulk actions (status changes allowed for the current role, with reasons), CSV export, paging and the empty and no-match states. Built on the app data layer: pass the app's store (createStore from ./app-data with the app's schema and seed) and an entity key.
 * Use it as: import { ResourceIndex } from "./resource-index"; <ResourceIndex store={store} entity="contract" title? description? onOpen={(id) => go("contract-detail", id)} onCreate={() => go("new-contract")} pageSize?={10} exportName? />
 * Built from: c.button, c.search.inline, c.select, c.checkbox, c.tabs, c.pagination, c.menu, c.modal, c.empty-state
 * Look: A records page: a title with Export CSV and New buttons, a row of summary tiles (total, each status, the money total), status tabs with counts, a search and filter toolbar with a result count, a dense table with sortable headers, checkboxes, status chips and a … menu per row, a bulk action bar, and paging; stacked rows on narrow widths.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-success --color-danger --radius-md --radius-lg --pill-radius --focus-ring
 * Use cases: contracts list; treaty master; orders list; customer list; case list; applications list; inventory list; ticket queue
 * Jobs to be done: find a record; see how many are in each status; act on several at once; export the list
 * Keywords: list, records, table, repository, index page, bulk actions, filters, export, admin list, master list
 */
/**
 * Resource index: the main list screen for one kind of record (contracts, treaties, vendors, claims), the way an
 * enterprise app's repository page works. A header with the create and export actions, a row of summary tiles, status
 * tabs with live counts, search and filters, a sortable table with row selection, a row menu with the status changes
 * the person's role may make, a bulk bar for many rows at once, and pages. Every part reads the app's schema (fields,
 * statuses, columns, filters, transitions) and works against the app's store, so a change here shows on every other
 * page at once. Below about 44rem the table turns into stacked cards with the same data and the same actions.
 *
 * Status changes that need a reason, and deleting, ask in a dialog on the page; every action ends in a toast that says
 * what happened. The rows are keyboard focusable (Enter opens one) and the tabs move with the arrow keys.
 *
 * Written for FlowCode.
 * Make it the app's own: pass your store and the entity's key; set columns, filters and transitions in the schema, not
 * here. onOpen goes to the record's page and onCreate to the create wizard.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { fieldOf, formatValue, statusOf, StatusChip, titleOf, toast, Toaster, useRole, useStore, type AppStore, type EntityDef, type FieldDef, type RecordData, type TransitionDef } from "./app-data";
import { sampleStore } from "./app-sample";

export type ResourceIndexProps = {
  store: AppStore;
  /** The entity's key in the store's schema. */
  entity: string;
  /** The page heading; the entity's plural when left out. */
  title?: string;
  /** One line under the heading. */
  description?: string;
  /** A row was opened (clicked, or Enter on it). */
  onOpen?: (id: string) => void;
  /** The "New ..." button; hidden when left out. */
  onCreate?: () => void;
  /** Rows per page to start with: 10, 25 or 50. */
  pageSize?: number;
  /** The exported file's name, without the date or .csv. */
  exportName?: string;
  /** Open on this status's tab (a queue: the records waiting for a decision). */
  initialStatus?: string;
};

type Sort = { key: string; dir: "asc" | "desc" } | null;
type Dialog = { kind: "reason"; ids: string[]; t: TransitionDef } | { kind: "delete"; ids: string[] } | null;

const SIZES = [10, 25, 50];
const NUMERIC = new Set(["number", "money", "percent"]);

// ── Pure helpers ──

/** What the search looks through: the title, the subtitle and every text field. */
function matches(e: EntityDef, rec: RecordData, q: string): boolean {
  if (!q) return true;
  const keys = new Set([e.titleField, e.subtitleField, "id", ...e.fields.filter((f) => f.type === "text" || f.type === "longtext" || f.type === "email").map((f) => f.key)]);
  for (const k of keys) {
    if (k && String(rec[k] ?? "").toLowerCase().includes(q)) return true;
  }
  return false;
}

function compare(e: EntityDef, f: FieldDef | undefined, key: string, a: RecordData, b: RecordData): number {
  if (key === e.statusField && e.statuses) {
    const order = (r: RecordData) => e.statuses!.findIndex((s) => s.key === r[key]);
    return order(a) - order(b);
  }
  const va = a[key];
  const vb = b[key];
  const ea = va === undefined || va === null || va === "";
  const eb = vb === undefined || vb === null || vb === "";
  if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1;
  if (f && NUMERIC.has(f.type)) return Number(va) - Number(vb);
  if (f?.type === "boolean") return Number(!!va) - Number(!!vb);
  return String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: "base" });
}

/** The transitions this person may make on this record now. */
function available(e: EntityDef, rec: RecordData, role: string): TransitionDef[] {
  if (!e.statusField) return [];
  const st = String(rec[e.statusField]);
  return (e.transitions ?? []).filter((t) => t.from.includes(st) && (!t.roles?.length || t.roles.includes(role)));
}

/** Every field, as a spreadsheet reads it (raw numbers and ISO dates, the status by its label). */
export function recordsToCsv(e: EntityDef, rows: RecordData[]): string {
  const cell = (v: unknown) => {
    const s = v === undefined || v === null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ["ID", ...e.fields.map((f) => f.label), ...(e.statusField && !fieldOf(e, e.statusField) ? ["Status"] : []), "Draft", "Updated"];
  const lines = rows.map((r) => [
    r.id,
    ...e.fields.map((f) => (f.key === e.statusField ? statusOf(e, r)?.label ?? r[f.key] : f.type === "boolean" ? (r[f.key] ? "Yes" : "No") : r[f.key])),
    ...(e.statusField && !fieldOf(e, e.statusField) ? [statusOf(e, r)?.label ?? r[e.statusField]] : []),
    r.draft ? "Yes" : "No",
    r.updatedAt ?? "",
  ]);
  return [head, ...lines].map((l) => l.map(cell).join(",")).join("\r\n");
}

function downloadCsv(name: string, csv: string) {
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const d = new Date();
  a.download = `${name}-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Page numbers to show: the first, the last, and the current one with its neighbours; gaps as null. */
function pageList(count: number, at: number): (number | null)[] {
  const want = new Set([1, count, at - 1, at, at + 1].filter((n) => n >= 1 && n <= count));
  const out: (number | null)[] = [];
  let last = 0;
  for (const n of [...want].sort((a, b) => a - b)) {
    if (n - last > 1) out.push(null);
    out.push(n);
    last = n;
  }
  return out;
}

// ── Small parts ──

/** A native select with the chevron drawn 8px from its right edge. */
function Select({ label, value, onChange, children, className }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <span className={["fl-ri-select", className ?? ""].filter(Boolean).join(" ")}>
      <label className="fl-sr" htmlFor={id}>
        {label}
      </label>
      <select id={id} value={value} onChange={(ev) => onChange(ev.target.value)}>
        {children}
      </select>
      <Icon name="chevron-down" />
    </span>
  );
}

/** A modal dialog on the page (the browser's own <dialog>, so focus stays inside and Escape closes it). */
function RiDialog({ title, children, onClose, returnTo, initial }: { title: string; children: ReactNode; onClose: () => void; returnTo: HTMLElement | null; initial?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) d.showModal();
    const first = (initial ? d.querySelector<HTMLElement>(initial) : null) ?? d.querySelector<HTMLElement>("textarea, input, button");
    first?.focus();
    return () => {
      if (d.open) d.close();
      if (returnTo?.isConnected) returnTo.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <dialog
      ref={ref}
      className="fl-ri-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onCancel={(ev) => {
        ev.preventDefault();
        onClose();
      }}
      onMouseDown={(ev) => {
        if (ev.target === ref.current) onClose();
      }}
    >
      <div className="fl-ri-dialog-body">
        <h2 id={titleId} className="fl-ri-dialog-title">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}

function ReasonForm({ t, count, noun, onSubmit, onCancel }: { t: TransitionDef; count: number; noun: string; onSubmit: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const id = useId();
  return (
    <form
      className="fl-ri-dialog-form"
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!reason.trim()) {
          setError("Give a reason first: it is kept in the activity trail.");
          return;
        }
        onSubmit(reason.trim());
      }}
    >
      <p className="fl-ri-dialog-text">
        {count > 1 ? `This applies to ${count} ${noun}. ` : ""}The reason is kept in the activity trail and shown to the owner.
      </p>
      <label className="fl-ri-field-label" htmlFor={id}>
        Reason
      </label>
      <textarea id={id} className="fl-ri-textarea" rows={3} value={reason} aria-invalid={!!error || undefined} aria-describedby={error ? `${id}-err` : undefined} onChange={(ev) => { setReason(ev.target.value); if (error) setError(""); }} />
      {error ? (
        <p id={`${id}-err`} className="fl-ri-field-error">
          {error}
        </p>
      ) : null}
      <div className="fl-ri-dialog-actions">
        <Button variant="secondary" size={40} onClick={onCancel}>
          Cancel
        </Button>
        <Button variant={t.tone === "danger" ? "destructive" : "primary"} size={40} type="submit">
          {t.label}
        </Button>
      </div>
    </form>
  );
}

/** The row's … menu: a real menu (arrow keys, Escape closes and returns focus to the button). */
function RowMenu({ label, items, onClose, trigger, up }: { label: string; items: { key: string; label: string; danger?: boolean; run: () => void }[]; onClose: (refocus: boolean) => void; trigger: HTMLElement | null; up: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const away = (ev: MouseEvent) => {
      const t = ev.target as Node;
      if (!ref.current?.contains(t) && !trigger?.contains(t)) onClose(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [onClose, trigger]);
  const onKey = (ev: ReactKeyboardEvent) => {
    const list = [...(ref.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
    const i = list.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => list[(n + list.length) % list.length]?.focus();
    if (ev.key === "ArrowDown") go(i + 1);
    else if (ev.key === "ArrowUp") go(i - 1);
    else if (ev.key === "Home") go(0);
    else if (ev.key === "End") go(list.length - 1);
    else if (ev.key === "Escape") onClose(true);
    else if (ev.key === "Tab") onClose(false);
    else return;
    if (ev.key !== "Tab") ev.preventDefault();
    ev.stopPropagation();
  };
  return (
    <div ref={ref} className={`fl-ri-menu${up ? " fl-ri-menu--up" : ""}`} role="menu" aria-label={label} onKeyDown={onKey}>
      {items.map((it) => (
        <button key={it.key} type="button" role="menuitem" tabIndex={-1} className={`fl-ri-menu-item${it.danger ? " fl-ri-menu-item--danger" : ""}`} onClick={it.run}>
          {it.label}
        </button>
      ))}
    </div>
  );
}

function Checkbox({ checked, indeterminate, onChange, label }: { checked: boolean; indeterminate?: boolean; onChange: (on: boolean) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" className="fl-ri-check" checked={checked} aria-label={label} onChange={(ev) => onChange(ev.target.checked)} />;
}

// ── The index ──

export function ResourceIndex({ store, entity: entityKey, title, description, onOpen, onCreate, pageSize = 10, exportName, initialStatus }: ResourceIndexProps) {
  const state = useStore(store);
  const e = store.entity(entityKey);
  const records = state.records[entityKey] ?? [];
  const role = state.role;
  const noun = e.plural.toLowerCase();
  const uid = useId().replace(/:/g, "");

  const [query, setQuery] = useState("");
  const [tab, setTabState] = useState(initialStatus ?? "all");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<Sort>(null);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(SIZES.includes(pageSize) ? pageSize : 10);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<{ id: string; up: boolean } | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const menuTrigger = useRef<HTMLElement | null>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const setTab = (k: string) => {
    setTabState(k);
    setPage(1);
  };
  const setFilter = (k: string, v: string) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };
  const search = (v: string) => {
    setQuery(v);
    setPage(1);
  };
  const clearAll = () => {
    setQuery("");
    setFilters({});
    setTabState("all");
    setPage(1);
  };

  // Columns: the schema's (or the first six fields), always led by the title.
  const columns = useMemo(() => {
    const keys = e.columns?.length ? e.columns : e.fields.slice(0, 6).map((f) => f.key);
    return keys.includes(e.titleField) ? keys : [e.titleField, ...keys];
  }, [e]);
  const filterKeys = (e.filters ?? []).filter((k) => k === e.statusField || fieldOf(e, k)?.type === "select" || fieldOf(e, k)?.type === "boolean");

  // Everything but the status narrows the tabs' counts; the status tab narrows the rows.
  const q = query.trim().toLowerCase();
  const base = useMemo(
    () =>
      records.filter((r) => {
        if (!matches(e, r, q)) return false;
        for (const [k, v] of Object.entries(filters)) {
          if (!v || k === e.statusField) continue;
          const f = fieldOf(e, k);
          if (f?.type === "boolean" ? String(!!r[k]) !== v : String(r[k] ?? "") !== v) return false;
        }
        return true;
      }),
    [records, e, q, filters],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    if (e.statusField) for (const r of base) c[String(r[e.statusField])] = (c[String(r[e.statusField])] ?? 0) + 1;
    return c;
  }, [base, e]);
  const rows = useMemo(() => {
    const list = tab === "all" || !e.statusField ? base : base.filter((r) => String(r[e.statusField!]) === tab);
    if (!sort) return list;
    const f = fieldOf(e, sort.key);
    const sign = sort.dir === "asc" ? 1 : -1;
    // Empty values stay at the bottom whichever way the column is sorted.
    const empty = (r: RecordData) => r[sort.key] === undefined || r[sort.key] === null || r[sort.key] === "";
    return [...list].sort((a, b) => (empty(a) || empty(b) ? Number(empty(a)) - Number(empty(b)) : sign * compare(e, f, sort.key, a, b)));
  }, [base, tab, sort, e]);

  const pages = Math.max(1, Math.ceil(rows.length / size));
  const at = Math.min(page, pages);
  const shown = rows.slice((at - 1) * size, at * size);
  const filtered = !!q || tab !== "all" || Object.values(filters).some(Boolean);

  // Selection keeps only records that still exist.
  const selectedRecs = records.filter((r) => selected.has(r.id));
  const pageIds = shown.map((r) => r.id);
  const pageAll = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const pageSome = pageIds.some((id) => selected.has(id));
  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const togglePage = (on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      for (const id of pageIds) {
        if (on) n.add(id);
        else n.delete(id);
      }
      return n;
    });

  // Summary: the total, one tile per status in use, and the first money field's sum.
  const money = e.fields.find((f) => f.type === "money");
  const moneySum = money ? records.reduce((n, r) => n + (Number(r[money.key]) || 0), 0) : 0;
  const statusTotals = (e.statuses ?? []).map((s) => ({ s, n: e.statusField ? records.filter((r) => r[e.statusField!] === s.key).length : 0 })).filter((x) => x.n > 0);

  // Bulk: the transitions every selected record allows for this role.
  const bulkTransitions = useMemo(() => {
    if (!selectedRecs.length) return [];
    return (e.transitions ?? []).filter((t) => selectedRecs.every((r) => available(e, r, role).some((x) => x.key === t.key)));
  }, [selectedRecs, e, role]);

  const fileName = exportName ?? noun.replace(/\s+/g, "-");
  const exportRows = (list: RecordData[], what: string) => {
    if (!list.length) {
      toast(`There are no ${noun} to export.`, "warning");
      return;
    }
    downloadCsv(fileName, recordsToCsv(e, list));
    toast(`Exported ${list.length} ${list.length === 1 ? e.label.toLowerCase() : noun}${what}.`);
  };

  const apply = (ids: string[], t: TransitionDef, reason?: string) => {
    if (ids.length === 1) {
      const res = store.transition(entityKey, ids[0]!, t.key, reason);
      toast(res.message, res.ok ? "success" : "danger");
      return;
    }
    let ok = 0;
    let first = "";
    for (const id of ids) {
      const res = store.transition(entityKey, id, t.key, reason);
      if (res.ok) ok++;
      else if (!first) first = res.message;
    }
    const to = e.statuses?.find((s) => s.key === t.to)?.label ?? t.to;
    if (ok === ids.length) toast(`${t.label}: ${ok} ${noun} are now ${to}.`);
    else toast(`${t.label}: ${ok} of ${ids.length} ${noun} changed. ${first}`, ok ? "warning" : "danger");
    setSelected(new Set());
  };

  const start = (ids: string[], t: TransitionDef, from: HTMLElement | null) => {
    if (t.needsReason) {
      returnTo.current = from;
      setDialog({ kind: "reason", ids, t });
    } else apply(ids, t);
  };
  const askDelete = (ids: string[], from: HTMLElement | null) => {
    returnTo.current = from;
    setDialog({ kind: "delete", ids });
  };
  const doDelete = (ids: string[]) => {
    const names = ids.map((id) => records.find((r) => r.id === id)).filter(Boolean) as RecordData[];
    for (const id of ids) store.remove(entityKey, id);
    setSelected((s) => {
      const n = new Set(s);
      ids.forEach((id) => n.delete(id));
      return n;
    });
    toast(names.length === 1 ? `Deleted ${e.label.toLowerCase()} ${titleOf(e, names[0]!)}.` : `Deleted ${names.length} ${noun}.`);
  };
  const closeDialog = () => {
    setDialog(null);
    // Focus goes back where the action came from; if that row is gone, to the heading.
    window.setTimeout(() => {
      const el = returnTo.current;
      if (el?.isConnected) el.focus();
      else headingRef.current?.focus();
    }, 0);
  };

  const open = (id: string) => onOpen?.(id);
  const openMenu = (id: string, btn: HTMLElement) => {
    if (menu?.id === id) {
      setMenu(null);
      return;
    }
    menuTrigger.current = btn;
    const r = btn.getBoundingClientRect();
    setMenu({ id, up: r.bottom + 240 > window.innerHeight && r.top > 240 });
  };
  const closeMenu = (refocus: boolean) => {
    setMenu(null);
    if (refocus) menuTrigger.current?.focus();
  };

  const onRowClick = (ev: ReactMouseEvent, id: string) => {
    if ((ev.target as HTMLElement).closest("button, a, input, select, textarea, label, [role=menu]")) return;
    open(id);
  };
  const onRowKey = (ev: ReactKeyboardEvent, id: string) => {
    if (ev.target !== ev.currentTarget) return;
    if (ev.key === "Enter") {
      ev.preventDefault();
      open(id);
    }
  };

  // Tabs: roving focus, arrows move and choose.
  const tabKeys = ["all", ...(e.statuses ?? []).map((s) => s.key)];
  const onTabKey = (ev: ReactKeyboardEvent) => {
    const i = tabKeys.indexOf(tab);
    let n = -1;
    if (ev.key === "ArrowRight") n = (i + 1) % tabKeys.length;
    else if (ev.key === "ArrowLeft") n = (i - 1 + tabKeys.length) % tabKeys.length;
    else if (ev.key === "Home") n = 0;
    else if (ev.key === "End") n = tabKeys.length - 1;
    if (n < 0) return;
    ev.preventDefault();
    setTab(tabKeys[n]!);
    tabsRef.current?.querySelectorAll<HTMLElement>("[role=tab]")[n]?.focus();
  };

  const sortBy = (key: string) => {
    setSort((s) => (s?.key === key ? (s.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" }));
    setPage(1);
  };
  const ariaSort = (key: string) => (sort?.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none");
  const labelOf = (key: string) => fieldOf(e, key)?.label ?? (key === e.statusField ? "Status" : key);

  const cell = (r: RecordData, key: string): ReactNode => {
    if (key === e.statusField) return <StatusChip entity={e} record={r} />;
    if (key === e.titleField)
      return (
        <span className="fl-ri-name">
          <span className="fl-ri-name-title">
            {titleOf(e, r)}
            {r.draft ? <span className="fl-ri-draft">Draft</span> : null}
          </span>
          <span className="fl-ri-name-id">{r.id}</span>
        </span>
      );
    return formatValue(fieldOf(e, key), r[key]);
  };
  const isNum = (key: string) => NUMERIC.has(fieldOf(e, key)?.type ?? "");

  const menuItems = (r: RecordData) => [
    ...(onOpen ? [{ key: "open", label: "Open", run: () => { setMenu(null); open(r.id); } }] : []),
    ...available(e, r, role).map((t) => ({
      key: t.key,
      label: t.needsReason ? `${t.label}…` : t.label,
      danger: t.tone === "danger",
      run: () => {
        setMenu(null);
        start([r.id], t, menuTrigger.current);
        if (!t.needsReason) menuTrigger.current?.focus();
      },
    })),
    { key: "delete", label: "Delete…", danger: true, run: () => { setMenu(null); askDelete([r.id], menuTrigger.current); } },
  ];

  const from = rows.length ? (at - 1) * size + 1 : 0;
  const to = Math.min(at * size, rows.length);
  const statusFilterField = e.statusField;

  return (
    <div className="fl-ri-root" data-fl="p.resource-index">
      <header className="fl-ri-head">
        <div className="fl-ri-head-text">
          <h2 className="fl-ri-title" ref={headingRef} tabIndex={-1}>
            {title ?? e.plural}
          </h2>
          {description ? <p className="fl-ri-lede">{description}</p> : null}
        </div>
        <div className="fl-ri-head-actions">
          <Button variant="secondary" size={40} icon="download" onClick={() => exportRows(rows, filtered ? " (filtered)" : "")}>
            Export CSV
          </Button>
          {onCreate ? (
            <Button variant="primary" size={40} icon="plus" onClick={onCreate}>
              {`New ${e.label.toLowerCase()}`}
            </Button>
          ) : null}
        </div>
      </header>

      {records.length === 0 ? (
        <div className="fl-ri-empty">
          <span className="fl-ri-empty-icon" aria-hidden="true">
            <Icon name="folder" />
          </span>
          <p className="fl-ri-empty-title">{`No ${noun} yet`}</p>
          <p className="fl-ri-empty-text">{`${e.plural} you create appear here, with their status and who owns them.`}</p>
          {onCreate ? (
            <Button variant="primary" size={40} icon="plus" onClick={onCreate}>
              {`New ${e.label.toLowerCase()}`}
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <ul className="fl-ri-tiles" aria-label="Summary">
            <li className="fl-ri-tile">
              <span className="fl-ri-tile-label">{`All ${noun}`}</span>
              <span className="fl-ri-tile-value">{records.length}</span>
            </li>
            {statusTotals.map(({ s, n }) => (
              <li key={s.key} className="fl-ri-tile-item">
                <button type="button" className={`fl-ri-tile fl-ri-tile--button fl-ri-tone-${s.tone}${tab === s.key ? " fl-ri-tile--active" : ""}`} aria-pressed={tab === s.key} onClick={() => setTab(tab === s.key ? "all" : s.key)}>
                  <span className="fl-ri-tile-label">
                    <span className="fl-ri-tile-dot" aria-hidden="true" />
                    {s.label}
                  </span>
                  <span className="fl-ri-tile-value">{n}</span>
                </button>
              </li>
            ))}
            {money ? (
              <li className="fl-ri-tile fl-ri-tile--money">
                <span className="fl-ri-tile-label">{`${money.label}, all ${noun}`}</span>
                <span className="fl-ri-tile-value">{formatValue(money, moneySum)}</span>
              </li>
            ) : null}
          </ul>

          {e.statuses?.length ? (
            <div className="fl-ri-tabs" role="tablist" aria-label={`${e.plural} by status`} ref={tabsRef} onKeyDown={onTabKey}>
              {tabKeys.map((k) => {
                const label = k === "all" ? "All" : e.statuses!.find((s) => s.key === k)!.label;
                const n = k === "all" ? base.length : counts[k] ?? 0;
                return (
                  <button key={k} type="button" role="tab" id={`${uid}-tab-${k}`} aria-selected={tab === k} aria-controls={`${uid}-panel`} tabIndex={tab === k ? 0 : -1} className="fl-ri-tab" onClick={() => setTab(k)}>
                    {label}
                    <span className="fl-ri-tab-count">{n}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="fl-ri-toolbar" role="search">
            <span className="fl-ri-search">
              <Icon name="search" />
              <label className="fl-sr" htmlFor={`${uid}-q`}>{`Search ${noun}`}</label>
              <input id={`${uid}-q`} type="search" placeholder={`Search ${noun}`} value={query} onChange={(ev) => search(ev.target.value)} />
            </span>
            {filterKeys.map((k) => {
              const f = fieldOf(e, k);
              if (k === statusFilterField) {
                return (
                  <Select key={k} label="Status" value={tab} onChange={setTab}>
                    <option value="all">All statuses</option>
                    {(e.statuses ?? []).map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                );
              }
              if (!f) return null;
              return (
                <Select key={k} label={f.label} value={filters[k] ?? ""} onChange={(v) => setFilter(k, v)}>
                  <option value="">{`${f.label}: any`}</option>
                  {f.type === "boolean" ? (
                    <>
                      <option value="true">{`${f.label}: yes`}</option>
                      <option value="false">{`${f.label}: no`}</option>
                    </>
                  ) : (
                    (f.options ?? []).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))
                  )}
                </Select>
              );
            })}
            <Select className="fl-ri-sortpick" label="Sort by" value={sort ? `${sort.key}:${sort.dir}` : ""} onChange={(v) => { const [key, dir] = v.split(":"); setSort(key ? { key: key!, dir: dir as "asc" | "desc" } : null); setPage(1); }}>
              <option value="">Sort: as listed</option>
              {columns.map((k) => (
                <optgroup key={k} label={labelOf(k)}>
                  <option value={`${k}:asc`}>{`${labelOf(k)}, ${isNum(k) ? "low to high" : "A to Z"}`}</option>
                  <option value={`${k}:desc`}>{`${labelOf(k)}, ${isNum(k) ? "high to low" : "Z to A"}`}</option>
                </optgroup>
              ))}
            </Select>
            {filtered ? (
              <Button variant="tertiary" size={32} icon="close" onClick={clearAll}>
                Clear
              </Button>
            ) : null}
            <p className="fl-ri-count" aria-live="polite">
              {rows.length ? `Showing ${from}–${to} of ${rows.length}` : `No ${noun} shown`}
            </p>
          </div>

          <div className="fl-ri-panel" id={`${uid}-panel`} role={e.statuses?.length ? "tabpanel" : undefined} aria-labelledby={e.statuses?.length ? `${uid}-tab-${tab}` : undefined}>
            {rows.length === 0 ? (
              <div className="fl-ri-empty fl-ri-empty--compact">
                <span className="fl-ri-empty-icon" aria-hidden="true">
                  <Icon name="search" />
                </span>
                <p className="fl-ri-empty-title">{`No ${noun} match`}</p>
                <p className="fl-ri-empty-text">Try other words, or clear the filters to see every one.</p>
                <Button variant="secondary" size={40} onClick={clearAll}>
                  Clear filters
                </Button>
              </div>
            ) : (
              <table className="fl-ri-table">
                <caption className="fl-sr">{`${e.plural}${tab !== "all" ? `, ${e.statuses?.find((s) => s.key === tab)?.label}` : ""}: ${from} to ${to} of ${rows.length}${sort ? `, sorted by ${labelOf(sort.key)} ${sort.dir === "asc" ? "ascending" : "descending"}` : ""}`}</caption>
                <thead>
                  <tr>
                    <th scope="col" className="fl-ri-th-check">
                      <Checkbox checked={pageAll} indeterminate={!pageAll && pageSome} onChange={togglePage} label="Select all on this page" />
                    </th>
                    {columns.map((k) => (
                      <th key={k} scope="col" aria-sort={ariaSort(k)} className={isNum(k) ? "fl-ri-num" : undefined}>
                        <button type="button" className="fl-ri-sort" onClick={() => sortBy(k)}>
                          {labelOf(k)}
                          <span className={`fl-ri-sort-icon${sort?.key === k ? ` fl-ri-sort-icon--${sort.dir}` : ""}`} aria-hidden="true">
                            <Icon name="chevron-down" />
                          </span>
                        </button>
                      </th>
                    ))}
                    <th scope="col" className="fl-ri-th-actions">
                      <span className="fl-sr">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r, i) => {
                    const name = titleOf(e, r);
                    const isSel = selected.has(r.id);
                    return (
                      <tr key={`${r.id}:${i}`} tabIndex={0} className={`fl-ri-row${isSel ? " fl-ri-row--selected" : ""}`} aria-label={`${name}, ${r.id}`} onClick={(ev) => onRowClick(ev, r.id)} onKeyDown={(ev) => onRowKey(ev, r.id)}>
                        <td className="fl-ri-td-check">
                          <Checkbox checked={isSel} onChange={(on) => toggle(r.id, on)} label={`Select ${name}`} />
                        </td>
                        {columns.map((k) => (
                          <td key={k} data-label={labelOf(k)} className={[k === e.titleField ? "fl-ri-td-title" : "", isNum(k) ? "fl-ri-num" : ""].filter(Boolean).join(" ") || undefined}>
                            {cell(r, k)}
                          </td>
                        ))}
                        <td className="fl-ri-td-actions">
                          <span className="fl-ri-menu-wrap">
                            <button type="button" className="fl-ri-more" aria-label={`Actions for ${name}`} aria-haspopup="menu" aria-expanded={menu?.id === r.id} onClick={(ev) => openMenu(r.id, ev.currentTarget)}>
                              <Icon name="more" />
                            </button>
                            {menu?.id === r.id ? <RowMenu label={`Actions for ${name}`} items={menuItems(r)} onClose={closeMenu} trigger={menuTrigger.current} up={menu.up} /> : null}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {selectedRecs.length ? (
            <div className="fl-ri-bulk" role="region" aria-label="Selected rows">
              <p className="fl-ri-bulk-count">{`${selectedRecs.length} selected`}</p>
              <div className="fl-ri-bulk-actions">
                {bulkTransitions.map((t) => (
                  <Button key={t.key} variant={t.tone === "danger" ? "destructive" : t.tone === "primary" ? "primary" : "secondary"} size={32} onClick={(ev) => start(selectedRecs.map((r) => r.id), t, ev.currentTarget)}>
                    {t.needsReason ? `${t.label}…` : t.label}
                  </Button>
                ))}
                <Button variant="secondary" size={32} icon="download" onClick={() => exportRows(selectedRecs, " (selected)")}>
                  Export selected
                </Button>
                <Button variant="tertiary" size={32} icon="trash" onClick={(ev) => askDelete(selectedRecs.map((r) => r.id), ev.currentTarget)}>
                  Delete…
                </Button>
                <Button variant="tertiary" size={32} onClick={() => setSelected(new Set())}>
                  Clear selection
                </Button>
              </div>
            </div>
          ) : null}

          {rows.length ? (
            <nav className="fl-ri-pager" aria-label={`${e.plural} pages`}>
              <Select label="Rows per page" value={String(size)} onChange={(v) => { setSize(Number(v)); setPage(1); }}>
                {SIZES.map((n) => (
                  <option key={n} value={n}>{`${n} per page`}</option>
                ))}
              </Select>
              <label className="fl-ri-pageall">
                <Checkbox checked={pageAll} indeterminate={!pageAll && pageSome} onChange={togglePage} label="Select all on this page" />
                <span aria-hidden="true">Select page</span>
              </label>
              <div className="fl-ri-pages">
                <button type="button" className="fl-ri-page fl-ri-page--step" disabled={at <= 1} onClick={() => setPage(at - 1)} aria-label="Previous page">
                  <Icon name="chevron-left" />
                </button>
                {pageList(pages, at).map((n, i) =>
                  n === null ? (
                    <span key={`gap${i}`} className="fl-ri-page-gap" aria-hidden="true">
                      …
                    </span>
                  ) : (
                    <button key={n} type="button" className="fl-ri-page" aria-current={n === at ? "page" : undefined} aria-label={`Page ${n}`} onClick={() => setPage(n)}>
                      {n}
                    </button>
                  ),
                )}
                <button type="button" className="fl-ri-page fl-ri-page--step" disabled={at >= pages} onClick={() => setPage(at + 1)} aria-label="Next page">
                  <Icon name="chevron-right" />
                </button>
              </div>
            </nav>
          ) : null}
        </>
      )}

      {dialog?.kind === "reason" ? (
        <RiDialog title={dialog.ids.length > 1 ? `${dialog.t.label}: ${dialog.ids.length} ${noun}` : `${dialog.t.label}: ${titleOf(e, records.find((r) => r.id === dialog.ids[0]) ?? { id: dialog.ids[0]! })}`} onClose={closeDialog} returnTo={null}>
          <ReasonForm
            t={dialog.t}
            count={dialog.ids.length}
            noun={noun}
            onCancel={closeDialog}
            onSubmit={(reason) => {
              apply(dialog.ids, dialog.t, reason);
              closeDialog();
            }}
          />
        </RiDialog>
      ) : null}
      {dialog?.kind === "delete" ? (
        <RiDialog title={dialog.ids.length > 1 ? `Delete ${dialog.ids.length} ${noun}?` : `Delete ${titleOf(e, records.find((r) => r.id === dialog.ids[0]) ?? { id: dialog.ids[0]! })}?`} onClose={closeDialog} returnTo={null} initial="[data-ri-cancel]">
          <p className="fl-ri-dialog-text">{dialog.ids.length > 1 ? `The ${dialog.ids.length} ${noun} and their history leave the list. This can't be undone.` : `${dialog.ids[0]} and its history leave the list. This can't be undone.`}</p>
          <div className="fl-ri-dialog-actions">
            <Button variant="secondary" size={40} data-ri-cancel="" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size={40}
              icon="trash"
              onClick={() => {
                doDelete(dialog.ids);
                closeDialog();
              }}
            >
              Delete
            </Button>
          </div>
        </RiDialog>
      ) : null}
    </div>
  );
}

// ── The reference sheet ──

function RoleSwitch({ store }: { store: AppStore }) {
  const [role, setRole] = useRole(store);
  const roles = store.schema.roles ?? [];
  return (
    <div className="fl-ri-demo-bar">
      <span className="fl-ri-demo-label" id="fl-ri-demo-role">
        Viewing as
      </span>
      <div className="fl-ri-roles" role="group" aria-labelledby="fl-ri-demo-role">
        {roles.map((r) => (
          <button key={r} type="button" className="fl-ri-role" aria-pressed={role === r} onClick={() => setRole(r)}>
            {r}
          </button>
        ))}
      </div>
      <Button
        variant="tertiary"
        size={32}
        icon="refresh"
        onClick={() => {
          store.reset();
          toast("The sample contracts are back as they started.", "info");
        }}
      >
        Reset sample data
      </Button>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  entity: "contract",
  title: "Contracts",
  description: "Every vendor contract, its value and where it stands. Managers approve and send back.",
};

export default function ResourceIndexSheet() {
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>Resource index</h3>
        <p className="fl-ctl-btn-what">The list screen for one kind of record: search, filter by status, sort, select, act on many, page through. Switch to Manager to see the approval actions.</p>
        <RoleSwitch store={sampleStore} />
        <ResourceIndex
          store={sampleStore}
          entity={SAMPLE.entity}
          title={SAMPLE.title}
          description={SAMPLE.description}
          onOpen={(id) => toast(`Opened ${id}`, "info")}
          onCreate={() => toast("The create wizard opens here", "info")}
        />
      </div>
      <Toaster />
    </section>
  );
}
