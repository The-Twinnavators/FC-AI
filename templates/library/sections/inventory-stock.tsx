/** @flowcode-library inventory-stock · Inventory stock (Tables and lists)
 * Catalog ID: b.inventory-stock (block)
 * Function: Stock on hand for a warehouse or shop (b.inventory-stock): totals (items, low, out, value on order), search by name or SKU, filter by status and location, sort by item, stock level or status; each row's level bar against its reorder point, low and out flagged; Reorder with a supplier, a suggested quantity, a needed-by date and a cost; Receive stock against the open order (partial deliveries and damaged units); loading, load error with Retry, empty and no-match states.
 * Use it as: import { InventoryStock } from "./inventory-stock"; <InventoryStock title items?={[{ id, sku, name, location, unit, onHand, reorderAt, par, cost (cents), supplier, onOrder?: { po, qty, due: "2026-10-28", supplier } | null }]} load?={async () => StockItem[]} suppliers={["Acme"]} locations?={["Aisle 3"]} onReorder?={async (id, order) => ({ po })} onReceive?={async (id, { received, damaged }) => void} />
 * Built from: c.text-field.outlined, c.segmented.segmented, c.select.outlined, c.quantity, c.button.primary, c.button.secondary, c.badge.status, c.modal.form, c.skeleton, c.empty-state
 * Look: A white card: the title, then four sunken stat tiles (items, low, out, on order), a search box, an All / Low / Out / On order switch and a location select over the table: the item and SKU, location, an on-hand number over a straight level bar with a tick at the reorder point (amber when low, red when out), a status pill (with "On order 40" when there is one) and Reorder and Receive buttons. On a phone each row stacks into a card.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-success --color-warning --color-danger --color-info --surface-bg --surface-radius --pill-radius --space-1 --space-2 --space-3 --space-4 --space-5 --radius-sm --radius-md --text-xs --text-sm --text-md --text-lg --text-xl --font-display --font-mono --weight-medium --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger
 * Use cases: inventory management; stock levels; warehouse stock; reorder list; purchase orders; receiving; shop back office; supplies tracker; parts inventory
 * Jobs to be done: see what is running low; reorder before we run out; record a delivery that arrived; find an item by SKU; know what is already on order
 * Keywords: inventory, stock, SKU, warehouse, reorder, reorder point, low stock, out of stock, purchase order, receive, supplier, on hand
 */
/**
 * Inventory stock: what a stock keeper uses. Status comes from on hand against the reorder point: Out at 0, Low at or
 * under it, else In stock. The level bar runs to the par (the full shelf), with a tick at the reorder point. Reorder
 * suggests par minus on hand (and what is already on order), checks the quantity and needed-by date, shows the cost,
 * and puts the order on the row. Receive takes what arrived and what came damaged; a part delivery leaves the rest on
 * order. Arrow keys move between the row buttons (one tab stop). Sorting glides the rows; every change is read out.
 * Make it the app's own: replace SAMPLE with the item list (or pass load), and make onReorder raise a real purchase
 * order and onReceive post the delivery.
 * Adapted from TailAdmin free edition (MIT License, Copyright (c) 2023 TailAdmin): its products table.
 */
/**
 * How to try it
 * - Wait for the rows to load. Type "glove" in Search; pick Low; pick a location; clear them.
 * - Press the On hand header to sort by level; press it again to flip the order.
 * - Press Reorder on a low row: set the quantity to 0 and save (checked), then save the suggestion: "On order" shows.
 * - Press Receive on that row: take 30 of 40 with 2 damaged: on hand goes up by 28 and 10 stay on order.
 * - Use the arrow keys between the row buttons.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useMemo, useRef, useState), the library's TextField
 * ("./text-fields-states"), Segmented ("./segmented-control"), Select ("./dropdowns-states"), Quantity
 * ("./input-quantity"), Button ("./buttons-variants"), Badge ("./badges-status"), Marked ("./search-field"), Modal
 * ("./modals-dialogs") and its inline icon set ("./icons"). Nothing else: no package to install and nothing fetched at
 * run time. The styles are the library's own fl- classes in templates/library/css/r5c-inventory-stock.css.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent, type RefObject } from "react";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { Quantity } from "./input-quantity";
import { Modal } from "./modals-dialogs";
import { Marked } from "./search-field";
import { Segmented } from "./segmented-control";
import { TextField } from "./text-fields-states";

// ── b.inventory-stock: totals, filters, sortable stock rows with level bars, reorder and receive. ──

export type OpenOrder = { po: string; qty: number; due: string; supplier: string };
export type StockItem = {
  id: string;
  sku: string;
  name: string;
  location: string;
  unit: string;
  onHand: number;
  /** at or under this, the item is low */
  reorderAt: number;
  /** the full-shelf level the bar runs to */
  par: number;
  /** unit cost in cents */
  cost: number;
  supplier: string;
  onOrder?: OpenOrder | null;
};
export type InventoryStockProps = {
  title?: string;
  items?: StockItem[];
  /** Loads the list (a loading state, then the rows or an error with Retry). */
  load?: () => Promise<StockItem[]>;
  suppliers: string[];
  locale?: string;
  currency?: string;
  onReorder?: (id: string, order: { supplier: string; qty: number; due: string }) => Promise<{ po: string }>;
  onReceive?: (id: string, delivery: { po: string; received: number; damaged: number }) => Promise<void>;
};

type Show = "all" | "low" | "out" | "ordered";
type SortKey = "name" | "level" | "status";
type Status = "out" | "low" | "ok";

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
};
const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return isoOf(d);
};
const statusOf = (i: StockItem): Status => (i.onHand <= 0 ? "out" : i.onHand <= i.reorderAt ? "low" : "ok");
const RANK: Record<Status, number> = { out: 0, low: 1, ok: 2 };
const defaultReorder = async () => ({ po: `PO-${String(Date.now()).slice(-5)}` });
const quick = async () => undefined;

function motionOff() {
  if (typeof window === "undefined") return true;
  return document.documentElement.dataset.motion === "off" || Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}
function tokenMs(name: string, fallback: number) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  return raw.endsWith("ms") ? n : raw.endsWith("s") ? n * 1000 : n;
}

/** FLIP: rows marked data-flip glide from where they were to where they are now whenever `key` changes. */
function useFlip(box: RefObject<HTMLElement | null>, key: string) {
  const last = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    const now = new Map<string, number>();
    const nodes = Array.from(el.querySelectorAll<HTMLElement>("[data-flip]"));
    for (const n of nodes) now.set(n.dataset.flip!, n.getBoundingClientRect().top - top);
    if (!motionOff()) {
      for (const n of nodes) {
        const was = last.current.get(n.dataset.flip!);
        const dy = was === undefined ? 0 : was - now.get(n.dataset.flip!)!;
        if (dy) n.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: tokenMs("--duration-slow", 320), easing: "cubic-bezier(0.2, 0, 0, 1)" });
      }
    }
    last.current = now;
  }, [key, box]);
}

/** Focuses an element once React has drawn it (and after any dialog has handed focus back). */
function useFocusLater() {
  const want = useRef<(() => HTMLElement | null | undefined) | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    const find = want.current;
    if (!find) return;
    const el = find();
    if (el) {
      want.current = null;
      el.focus();
    }
  });
  return (find: () => HTMLElement | null | undefined) => {
    want.current = find;
    setTick((t) => t + 1);
  };
}

/** Roving focus for repeated row buttons: one tab stop; arrows move across a row and between rows. */
function useRoving(box: RefObject<HTMLElement | null>) {
  const cur = useRef<string | null>(null);
  const focusLater = useFocusLater();
  const sync = () => {
    const el = box.current;
    if (!el) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>("[data-rv]"));
    const live = items.filter((i) => !(i as HTMLButtonElement).disabled);
    const pick = live.find((i) => i.dataset.rv === cur.current) ?? live[0];
    for (const i of items) i.tabIndex = i === pick ? 0 : -1;
  };
  useLayoutEffect(sync);
  const onFocus = (e: FocusEvent<HTMLElement>) => {
    const k = (e.target as HTMLElement).dataset?.rv;
    if (k) {
      cur.current = k;
      sync();
    }
  };
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const t = e.target as HTMLElement;
    if (!t.dataset?.rv || !box.current) return;
    const rows = Array.from(box.current.querySelectorAll<HTMLElement>("[data-rv-row]"))
      .map((r) => Array.from(r.querySelectorAll<HTMLElement>("[data-rv]")).filter((i) => !(i as HTMLButtonElement).disabled))
      .filter((r) => r.length);
    const r = rows.findIndex((row) => row.includes(t));
    if (r < 0) return;
    const c = rows[r]!.indexOf(t);
    let next: HTMLElement | undefined;
    if (e.key === "ArrowDown") next = rows[r + 1]?.[Math.min(c, rows[r + 1]!.length - 1)];
    else if (e.key === "ArrowUp") next = rows[r - 1]?.[Math.min(c, rows[r - 1]!.length - 1)];
    else if (e.key === "ArrowRight") next = rows[r]![c + 1];
    else if (e.key === "ArrowLeft") next = rows[r]![c - 1];
    else if (e.key === "Home") next = e.ctrlKey ? rows[0]![0] : rows[r]![0];
    else if (e.key === "End") next = e.ctrlKey ? rows[rows.length - 1]!.at(-1) : rows[r]!.at(-1);
    else return;
    e.preventDefault();
    if (next) {
      cur.current = next.dataset.rv!;
      sync();
      next.focus();
    }
  };
  /** Makes `k` the tab stop and focuses it once the row has drawn (after a dialog closes, say). */
  const point = (k: string) => {
    cur.current = k;
    focusLater(() => box.current?.querySelector<HTMLElement>(`[data-rv="${k}"]`));
  };
  return { onFocus, onKeyDown, point };
}

export function InventoryStock({ title = "Inventory", items: given, load, suppliers, locale = "en-US", currency = "USD", onReorder = defaultReorder, onReceive = quick }: InventoryStockProps) {
  const uid = useId();
  const focusLater = useFocusLater();
  const [items, setItems] = useState<StockItem[]>(given ?? []);
  const [phase, setPhase] = useState<"loading" | "error" | "ready">(load ? "loading" : "ready");
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<Show>("all");
  const [where, setWhere] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "status", dir: 1 });
  const [said, setSaid] = useState("");
  const [reorderId, setReorderId] = useState<string | null>(null);
  const [ro, setRo] = useState({ supplier: "", qty: 1, due: "" });
  const [roErr, setRoErr] = useState<{ qty?: string; due?: string; form?: string }>({});
  const [receiveId, setReceiveId] = useState<string | null>(null);
  const [rc, setRc] = useState({ received: 0, damaged: 0 });
  const [rcErr, setRcErr] = useState("");
  const [busy, setBusy] = useState(false);
  const body = useRef<HTMLTableSectionElement>(null);
  const rv = useRoving(body);

  const money = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency }), [locale, currency]);
  const fmtDay = useMemo(() => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }), [locale]);

  const fetchAll = async () => {
    if (!load) return;
    setPhase("loading");
    setSaid("Loading stock…");
    try {
      const list = await load();
      setItems(list);
      setPhase("ready");
      setSaid(`${list.length} items loaded.`);
    } catch {
      setPhase("error");
      setSaid("Couldn't load stock.");
    }
  };
  useEffect(() => {
    void fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locations = useMemo(() => [...new Set(items.map((i) => i.location))].sort(), [items]);
  const q = query.trim().toLowerCase();
  const shown = items
    .filter((i) => {
      if (q && !(i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q))) return false;
      if (where && i.location !== where) return false;
      const s = statusOf(i);
      if (show === "low" && s !== "low") return false;
      if (show === "out" && s !== "out") return false;
      if (show === "ordered" && !i.onOrder) return false;
      return true;
    })
    .sort((a, b) => {
      const d =
        sort.key === "name" ? a.name.localeCompare(b.name) : sort.key === "level" ? a.onHand / Math.max(1, a.par) - b.onHand / Math.max(1, b.par) : RANK[statusOf(a)] - RANK[statusOf(b)] || a.onHand / Math.max(1, a.par) - b.onHand / Math.max(1, b.par);
      return d * sort.dir;
    });
  useFlip(body, shown.map((i) => i.id).join("|"));

  const firstDraw = useRef(true);
  useEffect(() => {
    if (firstDraw.current) {
      firstDraw.current = false;
      return;
    }
    setSaid(shown.length === 0 ? "No items match." : shown.length === 1 ? "1 item." : `${shown.length} items.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, show, where]);

  const low = items.filter((i) => statusOf(i) === "low").length;
  const out = items.filter((i) => statusOf(i) === "out").length;
  const orderValue = items.reduce((n, i) => n + (i.onOrder ? i.onOrder.qty * i.cost : 0), 0);

  const sortBy = (key: SortKey) => {
    const dir: 1 | -1 = sort.key === key ? (sort.dir === 1 ? -1 : 1) : 1;
    setSort({ key, dir });
    setSaid(`Sorted by ${key === "name" ? "item" : key === "level" ? "stock level" : "status"}, ${dir === 1 ? (key === "name" ? "A to Z" : "lowest first") : key === "name" ? "Z to A" : "highest first"}.`);
  };
  const ariaSort = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none");

  const reordering = reorderId ? items.find((i) => i.id === reorderId) : undefined;
  const openReorder = (i: StockItem) => {
    setRo({ supplier: i.supplier, qty: Math.max(1, i.par - i.onHand - (i.onOrder?.qty ?? 0)), due: inDays(7) });
    setRoErr({});
    setReorderId(i.id);
    focusLater(() => document.getElementById(`${uid}-ro-qty`));
  };
  const saveReorder = async () => {
    if (!reordering) return;
    const e: typeof roErr = {};
    if (!Number.isInteger(ro.qty) || ro.qty < 1) e.qty = "Order at least 1.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ro.due)) e.due = "Pick the date you need it by.";
    else if (ro.due <= isoOf(new Date())) e.due = "Pick a date after today.";
    setRoErr(e);
    if (e.qty || e.due) {
      document.getElementById(`${uid}-ro-${e.qty ? "qty" : "due"}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const { po } = await onReorder(reordering.id, { supplier: ro.supplier, qty: ro.qty, due: ro.due });
      const prev = reordering.onOrder;
      const order: OpenOrder = prev ? { ...prev, qty: prev.qty + ro.qty, due: ro.due } : { po, qty: ro.qty, due: ro.due, supplier: ro.supplier };
      setItems((all) => all.map((i) => (i.id === reordering.id ? { ...i, onOrder: order } : i)));
      setSaid(`Ordered ${ro.qty} ${reordering.unit} of ${reordering.name} from ${ro.supplier}, due ${fmtDay.format(fromIso(ro.due))}. ${order.po}.`);
      rv.point(`${reordering.id}:in`);
      setReorderId(null);
    } catch {
      setRoErr({ form: "Couldn't place the order. Try again." });
    } finally {
      setBusy(false);
    }
  };

  const receiving = receiveId ? items.find((i) => i.id === receiveId) : undefined;
  const openReceive = (i: StockItem) => {
    setRc({ received: i.onOrder?.qty ?? 0, damaged: 0 });
    setRcErr("");
    setReceiveId(i.id);
    focusLater(() => document.getElementById(`${uid}-rc-qty`));
  };
  const saveReceive = async () => {
    if (!receiving?.onOrder) return;
    if (rc.received < 1) {
      setRcErr("Enter how many arrived.");
      document.getElementById(`${uid}-rc-qty`)?.focus();
      return;
    }
    if (rc.damaged > rc.received) {
      setRcErr("Damaged can't be more than arrived.");
      document.getElementById(`${uid}-rc-dmg`)?.focus();
      return;
    }
    setBusy(true);
    try {
      await onReceive(receiving.id, { po: receiving.onOrder.po, received: rc.received, damaged: rc.damaged });
      const left = receiving.onOrder.qty - rc.received;
      const good = rc.received - rc.damaged;
      setItems((all) => all.map((i) => (i.id === receiving.id ? { ...i, onHand: i.onHand + good, onOrder: left > 0 ? { ...i.onOrder!, qty: left } : null } : i)));
      setSaid(`Received ${good} ${receiving.unit} of ${receiving.name}${rc.damaged ? `, ${rc.damaged} damaged` : ""}.${left > 0 ? ` ${left} still on order.` : " Order complete."}`);
      rv.point(left > 0 ? `${receiving.id}:in` : `${receiving.id}:re`);
      setReceiveId(null);
    } catch {
      setRcErr("Couldn't record the delivery. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    setQuery("");
    setShow("all");
    setWhere("");
    focusLater(() => document.getElementById(`${uid}-q`));
  };

  return (
    <div className="fl-stk" data-fl="b.inventory-stock">
      <header className="fl-stk-head">
        <h3 className="fl-stk-title">{title}</h3>
        <ul className="fl-stk-stats" aria-label="Totals">
          <li>
            <span>Items</span>
            <strong>{phase === "ready" ? items.length : "–"}</strong>
          </li>
          <li className={low ? "is-low" : undefined}>
            <span>Low</span>
            <strong>{phase === "ready" ? low : "–"}</strong>
          </li>
          <li className={out ? "is-out" : undefined}>
            <span>Out</span>
            <strong>{phase === "ready" ? out : "–"}</strong>
          </li>
          <li>
            <span>On order</span>
            <strong>{phase === "ready" ? money.format(orderValue / 100) : "–"}</strong>
          </li>
        </ul>
      </header>

      <div className="fl-stk-tools" role="search">
        <div className="fl-stk-search">
          <label htmlFor={`${uid}-q`} className="fl-sr">
            Search items
          </label>
          <Icon name="search" />
          <TextField id={`${uid}-q`} size={44} type="search" placeholder="Name or SKU" value={query} autoComplete="off" onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Segmented
          label="Show"
          size="sm"
          value={show}
          onChange={(v) => setShow(v as Show)}
          options={[
            { value: "all", label: "All" },
            { value: "low", label: "Low" },
            { value: "out", label: "Out" },
            { value: "ordered", label: "On order" },
          ]}
        />
        <div className="fl-stk-where">
          <label htmlFor={`${uid}-loc`} className="fl-sr">
            Location
          </label>
          <Select id={`${uid}-loc`} value={where} options={[{ value: "", label: "All locations" }, ...locations.map((l) => ({ value: l, label: l }))]} onChange={(e) => setWhere(e.target.value)} />
        </div>
      </div>

      {phase === "error" ? (
        <div className="fl-stk-empty is-error" role="alert">
          <Icon name="alert" />
          <strong>Couldn't load stock</strong>
          <p>Check your connection and try again.</p>
          <Button variant="secondary" size={40} icon="refresh" onClick={() => void fetchAll()}>
            Retry
          </Button>
        </div>
      ) : (
        <div className="fl-stk-tablewrap">
          <table className="fl-stk-table" aria-labelledby={`${uid}-cap`} aria-busy={phase === "loading" || undefined}>
            <caption id={`${uid}-cap`} className="fl-sr">
              {title}, {shown.length} items
            </caption>
            <thead>
              <tr>
                <th scope="col" aria-sort={ariaSort("name")}>
                  <SortBtn label="Item" on={sort.key === "name"} dir={sort.dir} onClick={() => sortBy("name")} />
                </th>
                <th scope="col">Location</th>
                <th scope="col" aria-sort={ariaSort("level")}>
                  <SortBtn label="On hand" on={sort.key === "level"} dir={sort.dir} onClick={() => sortBy("level")} />
                </th>
                <th scope="col" aria-sort={ariaSort("status")}>
                  <SortBtn label="Status" on={sort.key === "status"} dir={sort.dir} onClick={() => sortBy("status")} />
                </th>
                <th scope="col">
                  <span className="fl-sr">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody ref={body} onKeyDown={rv.onKeyDown} onFocus={rv.onFocus}>
              {phase === "loading"
                ? Array.from({ length: 5 }, (_, i) => (
                    <tr key={i} className="fl-stk-skel" aria-hidden="true">
                      <td>
                        <span className="w-70" />
                        <span className="w-40" />
                      </td>
                      <td>
                        <span className="w-60" />
                      </td>
                      <td>
                        <span className="w-80" />
                      </td>
                      <td>
                        <span className="w-50" />
                      </td>
                      <td>
                        <span className="w-90" />
                      </td>
                    </tr>
                  ))
                : shown.map((i, n) => {
                    const s = statusOf(i);
                    const fill = Math.min(1, i.onHand / Math.max(1, i.par));
                    return (
                      <tr key={i.id} data-flip={i.id} data-rv-row className={`fl-stk-row is-${s}`} style={{ ["--fl-stk-i" as string]: Math.min(n, 8) }}>
                        <th scope="row" className="fl-stk-item">
                          <strong>
                            <Marked text={i.name} query={q} />
                          </strong>
                          <code>
                            <Marked text={i.sku} query={q} />
                          </code>
                        </th>
                        <td className="fl-stk-loc" data-label="Location">
                          {i.location}
                        </td>
                        <td className="fl-stk-level" data-label="On hand">
                          <span className="fl-stk-num">
                            <strong>{i.onHand}</strong> {i.unit} <span>/ {i.par}</span>
                          </span>
                          <span className="fl-stk-bar" role="img" aria-label={`${i.onHand} of ${i.par}, reorder at ${i.reorderAt}`} style={{ ["--fill" as string]: fill, ["--tick" as string]: Math.min(1, i.reorderAt / Math.max(1, i.par)) }}>
                            <span />
                          </span>
                        </td>
                        <td className="fl-stk-status" data-label="Status">
                          <Badge tone={s === "out" ? "danger" : s === "low" ? "warning" : "success"} led>
                            {s === "out" ? "Out of stock" : s === "low" ? "Low" : "In stock"}
                          </Badge>
                          {i.onOrder ? (
                            <span className="fl-stk-order" title={`${i.onOrder.po} from ${i.onOrder.supplier}`}>
                              <Icon name="clock" />
                              {i.onOrder.qty} due {fmtDay.format(fromIso(i.onOrder.due))}
                            </span>
                          ) : null}
                        </td>
                        <td className="fl-stk-act">
                          <Button variant="secondary" size={40} data-rv={`${i.id}:re`} onClick={() => openReorder(i)} aria-label={`Reorder ${i.name}`}>
                            Reorder
                          </Button>
                          {i.onOrder ? (
                            <Button variant="primary" size={40} data-rv={`${i.id}:in`} onClick={() => openReceive(i)} aria-label={`Receive ${i.name}, ${i.onOrder.qty} on order`}>
                              Receive
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
          {phase === "ready" && shown.length === 0 ? (
            <div className="fl-stk-empty" data-fl="c.empty-state">
              <Icon name="archive" />
              <strong>{items.length ? "No items match" : "No items yet"}</strong>
              <p>{items.length ? "Check the spelling or clear the filters." : "Items you stock show here."}</p>
              {items.length ? (
                <Button variant="secondary" size={40} onClick={clear}>
                  Clear filters
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {reordering ? (
        <Modal
          variant="form"
          title={`Reorder ${reordering.name}`}
          description={`${reordering.onHand} ${reordering.unit} on hand · reorder at ${reordering.reorderAt} · full at ${reordering.par}${reordering.onOrder ? ` · ${reordering.onOrder.qty} already on order` : ""}`}
          confirmLabel="Place order"
          busy={busy}
          busyLabel="Ordering…"
          onConfirm={() => {
            void saveReorder();
            return false;
          }}
          onClose={() => setReorderId(null)}
        >
          <div className="fl-stk-form">
            <div className="fl-stk-field">
              <label htmlFor={`${uid}-ro-sup`}>Supplier</label>
              <Select id={`${uid}-ro-sup`} value={ro.supplier} options={suppliers} onChange={(e) => setRo((r) => ({ ...r, supplier: e.target.value }))} />
            </div>
            <div className="fl-stk-pair">
              <div className="fl-stk-field">
                <label htmlFor={`${uid}-ro-qty`}>Quantity ({reordering.unit})</label>
                <Quantity
                  id={`${uid}-ro-qty`}
                  label="Quantity"
                  size="sm"
                  min={0}
                  max={9999}
                  value={ro.qty}
                  onChange={(v) => {
                    setRo((r) => ({ ...r, qty: v }));
                    setRoErr((x) => ({ ...x, qty: undefined }));
                  }}
                />
                {roErr.qty ? <Err id={`${uid}-ro-qty-err`} text={roErr.qty} /> : null}
              </div>
              <div className="fl-stk-field">
                <label htmlFor={`${uid}-ro-due`}>Needed by</label>
                <TextField
                  id={`${uid}-ro-due`}
                  type="date"
                  size={40}
                  min={inDays(1)}
                  value={ro.due}
                  invalid={Boolean(roErr.due)}
                  aria-describedby={roErr.due ? `${uid}-ro-due-err` : undefined}
                  onChange={(e) => {
                    setRo((r) => ({ ...r, due: e.target.value }));
                    setRoErr((x) => ({ ...x, due: undefined }));
                  }}
                />
                {roErr.due ? <Err id={`${uid}-ro-due-err`} text={roErr.due} /> : null}
              </div>
            </div>
            <p className="fl-stk-total">
              <span>
                {ro.qty} × {money.format(reordering.cost / 100)}
              </span>
              <strong>{money.format((Math.max(0, ro.qty) * reordering.cost) / 100)}</strong>
            </p>
            <p className="fl-stk-hint">
              Brings it to {reordering.onHand + (reordering.onOrder?.qty ?? 0) + Math.max(0, ro.qty)} of {reordering.par}.
            </p>
            {roErr.form ? (
              <p className="fl-stk-alert" role="alert">
                <Icon name="alert" />
                {roErr.form}
              </p>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {receiving?.onOrder ? (
        <Modal
          variant="form"
          title={`Receive ${receiving.name}`}
          description={`${receiving.onOrder.po} from ${receiving.onOrder.supplier} · ${receiving.onOrder.qty} ${receiving.unit} on order`}
          confirmLabel="Receive stock"
          busy={busy}
          busyLabel="Saving…"
          onConfirm={() => {
            void saveReceive();
            return false;
          }}
          onClose={() => setReceiveId(null)}
        >
          <div className="fl-stk-form">
            <div className="fl-stk-pair">
              <div className="fl-stk-field">
                <label htmlFor={`${uid}-rc-qty`}>Arrived</label>
                <Quantity
                  id={`${uid}-rc-qty`}
                  label="Arrived"
                  size="sm"
                  min={0}
                  max={receiving.onOrder.qty}
                  value={rc.received}
                  onChange={(v) => {
                    setRc((r) => ({ ...r, received: v }));
                    setRcErr("");
                  }}
                />
              </div>
              <div className="fl-stk-field">
                <label htmlFor={`${uid}-rc-dmg`}>Damaged</label>
                <Quantity
                  id={`${uid}-rc-dmg`}
                  label="Damaged"
                  size="sm"
                  min={0}
                  max={Math.max(0, rc.received)}
                  value={rc.damaged}
                  onChange={(v) => {
                    setRc((r) => ({ ...r, damaged: v }));
                    setRcErr("");
                  }}
                />
              </div>
            </div>
            <p className="fl-stk-total">
              <span>On hand after</span>
              <strong>
                {receiving.onHand + Math.max(0, rc.received - rc.damaged)} {receiving.unit}
              </strong>
            </p>
            {rc.received > 0 && rc.received < receiving.onOrder.qty ? <p className="fl-stk-hint">Part delivery: {receiving.onOrder.qty - rc.received} stay on order.</p> : null}
            {rcErr ? (
              <p className="fl-stk-alert" role="alert">
                <Icon name="alert" />
                {rcErr}
              </p>
            ) : null}
          </div>
        </Modal>
      ) : null}

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

function SortBtn({ label, on, dir, onClick }: { label: string; on: boolean; dir: 1 | -1; onClick: () => void }) {
  return (
    <button type="button" className={`fl-stk-sort${on ? " is-on" : ""}${on && dir === -1 ? " is-desc" : ""}`} onClick={onClick}>
      {label}
      <Icon name="chevron-down" />
    </button>
  );
}

function Err({ id, text }: { id?: string; text: string }) {
  return (
    <p className="fl-stk-err" id={id}>
      <Icon name="alert" />
      {text}
    </p>
  );
}

// flowcode:sample
const SAMPLE: InventoryStockProps & { items: StockItem[] } = {
  title: "Main warehouse",
  suppliers: ["Northside Supply", "Pacific Packaging", "SafeWorks", "Cedar Paper Co."],
  items: [
    { id: "i1", sku: "BOX-M-200", name: "Shipping box, medium", location: "Aisle 2", unit: "ea", onHand: 140, reorderAt: 150, par: 600, cost: 62, supplier: "Pacific Packaging", onOrder: null },
    { id: "i2", sku: "TAPE-48", name: "Packing tape, 48 mm", location: "Aisle 2", unit: "rolls", onHand: 0, reorderAt: 24, par: 120, cost: 189, supplier: "Pacific Packaging", onOrder: { po: "PO-31204", qty: 96, due: inDays(2), supplier: "Pacific Packaging" } },
    { id: "i3", sku: "GLV-NIT-L", name: "Nitrile gloves, large", location: "Supply room", unit: "boxes", onHand: 9, reorderAt: 10, par: 40, cost: 1240, supplier: "SafeWorks", onOrder: null },
    { id: "i4", sku: "LBL-4X6", name: "Thermal labels 4×6", location: "Packing desk", unit: "rolls", onHand: 38, reorderAt: 12, par: 50, cost: 1599, supplier: "Cedar Paper Co.", onOrder: null },
    { id: "i5", sku: "BUB-12", name: "Bubble wrap, 12 in", location: "Aisle 3", unit: "rolls", onHand: 4, reorderAt: 6, par: 20, cost: 2850, supplier: "Pacific Packaging", onOrder: null },
    { id: "i6", sku: "PAL-48", name: "Pallet, 48×40", location: "Dock", unit: "ea", onHand: 22, reorderAt: 10, par: 30, cost: 1450, supplier: "Northside Supply", onOrder: null },
    { id: "i7", sku: "VEST-HV-M", name: "Hi-vis vest, medium", location: "Supply room", unit: "ea", onHand: 0, reorderAt: 4, par: 16, cost: 899, supplier: "SafeWorks", onOrder: null },
    { id: "i8", sku: "STRP-PP", name: "Strapping, polypropylene", location: "Dock", unit: "coils", onHand: 7, reorderAt: 3, par: 10, cost: 4200, supplier: "Northside Supply", onOrder: null },
    { id: "i9", sku: "GLV-NIT-M", name: "Nitrile gloves, medium", location: "Supply room", unit: "boxes", onHand: 26, reorderAt: 10, par: 40, cost: 1240, supplier: "SafeWorks", onOrder: null },
  ],
};

export default function InventoryStockPreview() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap">
        <InventoryStock {...SAMPLE} items={undefined} load={() => new Promise((r) => setTimeout(() => r(SAMPLE.items), 700))} />
      </div>
    </section>
  );
}
