/** @flowcode-library bill-splitter · Bill splitter (Forms)
 * Catalog ID: b.bill-splitter (block)
 * Function: Split a shared bill fairly (b.bill-splitter): add the people and what was ordered, mark who had each item, set the tax and the tip, pick who paid, and see each person's share (items plus their part of tax and tip, to the cent) in a bar chart and as who owes whom, then mark each debt settled and copy a summary to send.
 * Use it as: import { BillSplitter } from "./bill-splitter"; <BillSplitter title="Dinner at Thai Basil" people={[{ id, name }]} items={[{ id, name, price(cents), shares: [personId] }]} payer?={personId} taxRate?={8.875} tipPercent?={18} tipOptions?={[0, 15, 18, 20]} maxPeople?={8} currency?="USD" locale? loading? onSettle?={async (personId, cents, settled) => ...} onCopy?={async (text) => ...} />
 * Built from: c.avatar.person, c.text-field.outlined, c.select.outlined, c.segmented.segmented, c.badge.status, c.modal.danger, c.button.primary, c.button.secondary, c.button.tertiary, c.empty-state
 * Look: Two white cards side by side (stacked on a phone). Items: the people as round initials with a remove button and an add field, then one row per item with its name and price over a row of small name pills (filled when that person had it) and a remove button, and an add-item line at the bottom. Totals: subtotal, a tax rate field, a tip control (0, 15, 18, 20, Custom), the bold total and a Paid by select; a horizontal bar per person with their share; then "Ben owes Ana $34.20" rows with Mark paid (a green Paid badge and Undo once done) and Copy summary.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-secondary --color-success --color-warning --color-danger --surface-radius --pill-radius --radius-sm --radius-md --space-1 --space-2 --space-3 --space-4 --space-5 --text-xs --text-sm --text-md --text-lg --text-xl --weight-semibold --weight-bold --font-sans --font-display --focus-ring --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger
 * Use cases: split a restaurant bill; group dinner; shared groceries; trip expenses; roommates splitting a delivery order; office lunch order; bar tab
 * Jobs to be done: work out what each person owes; split shared dishes only among who had them; add tax and tip fairly; know who to pay back; keep track of who has paid; send everyone the numbers
 * Keywords: bill splitter, split the check, split bill, tip calculator, tax, who owes whom, settle up, IOU, group expenses, restaurant
 */
/**
 * Bill splitter: money is whole cents and nothing is lost to rounding. Each item's price is shared evenly among the
 * people who had it (the odd cents go to the first of them, in the order the people are listed); tax and tip are
 * worked out on the subtotal and shared in proportion to each person's items, with the leftover cents going to the
 * largest remainders, so the shares always add up to the total exactly.
 * People: add a name (two to eight people; names must differ); removing someone who is on items asks first, and their
 * items are then shared by whoever else had them. Items: add a name and a price; a new item is shared by everyone.
 * An item no one is on is flagged and holds back Settle up until it has someone.
 * The name pills on each item are toggle buttons. The pills and the remove button are one Tab stop for the whole
 * list: Left and Right move along a row, Up and Down between items, Home and End to the first and last item.
 * Tip offers fixed percents or Custom (a field from 0 to 100). Settle up lists who owes the payer; Mark paid calls
 * onSettle (a failure is shown on the row) and Undo takes it back. Copy summary puts the split on the clipboard; when
 * the clipboard is refused it shows the text ready to select.
 * Bars grow and figures count up when they change. Every figure is also written out, and the chart has a text alternative.
 * Adapted from TailGrids (MIT, Copyright (c) 2025 Tailgrids): its order summary and checkout line-item layouts,
 * reshaped into a shared-bill calculator.
 */
/**
 * How to try it
 * - Press Ben's pill on Green curry: it leaves his share and the others go up. Press it again.
 * - Tab to a pill and use the arrow keys, Home and End; Space or Enter toggles it.
 * - Pick Tip 20%, or Custom and type 22. Change Tax to 10.
 * - Add a person "Dee", then an item "Mango sticky rice" for 9.50. Turn off every pill on an item: it's flagged.
 * - Press the remove button on Ben: it asks first. Press Mark paid on a row, then Undo. Press Copy summary.
 *
 * Dependencies: React (useEffect, useId, useMemo, useRef, useState), the library's Avatar ("./avatars-variants"),
 * TextField ("./text-fields-states"), Select ("./dropdowns-states"), Segmented ("./segmented-control"), Badge
 * ("./badges-status"), Modal ("./modals-dialogs"), Button ("./buttons-variants") and its icons ("./icons"). Nothing
 * else: no chart package, nothing fetched at run time. The styles are the library's own fl- classes in
 * templates/library/css/r5b-bill-splitter.css.
 */
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Avatar } from "./avatars-variants";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { Segmented } from "./segmented-control";
import { TextField } from "./text-fields-states";

// ── b.bill-splitter: people, items and who had them, tax and tip, each share to the cent, and settle up. ──

export type SplitPerson = { id: string; name: string };
export type SplitItem = { id: string; name: string; /** cents */ price: number; /** ids of the people who had it */ shares: string[] };
export type BillSplitterProps = {
  title: string;
  people: SplitPerson[];
  items: SplitItem[];
  /** Who paid the bill; the first person when left out. */
  payer?: string;
  /** Percent, e.g. 8.875. */
  taxRate?: number;
  tipPercent?: number;
  tipOptions?: number[];
  maxPeople?: number;
  currency?: string;
  locale?: string;
  loading?: boolean;
  /** Marks a person's share paid (settled true) or not; a rejected promise shows an error on the row. */
  onSettle?: (personId: string, cents: number, settled: boolean) => Promise<void>;
  /** Shares the summary text; the clipboard when left out. */
  onCopy?: (text: string) => Promise<void>;
  className?: string;
};

const TONES = ["a", "b", "c", "d", "e"] as const;
const quick = async () => undefined;

/** "$1,234.5" or "1234.50" to cents; null when it isn't a plain amount. */
function parseCents(raw: string): number | null {
  const s = raw.replace(/[$,\s]/g, "");
  if (!/^(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}
/** A percent from 0 to max with up to three decimals; null otherwise. */
function parsePercent(raw: string, max: number): number | null {
  const s = raw.replace(/[%\s]/g, "");
  if (!/^(\d+(\.\d{0,3})?|\.\d{1,3})$/.test(s)) return null;
  const n = Number(s);
  return n <= max ? n : null;
}

/** Splits `total` cents in proportion to `weights`, giving the leftover cents to the largest remainders. */
function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum || !total) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, f: r - Math.floor(r) })).sort((a, b) => b.f - a.f || a.i - b.i);
  for (const o of order) {
    if (left <= 0) break;
    out[o.i]! += 1;
    left -= 1;
  }
  return out;
}

const motionOff = () =>
  typeof window === "undefined" || !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off";

/** A number that counts toward its target with an ease-out curve; jumps when motion is off or frames are paused. */
function useTween(target: number, ms = 500) {
  const [v, setV] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    if (motionOff() || document.hidden) {
      cur.current = target;
      return setV(target);
    }
    const from = cur.current;
    let start = -1;
    let raf = 0;
    const tick = (t: number) => {
      if (start < 0) start = t;
      const p = Math.min(1, (t - start) / ms);
      const n = from + (target - from) * (1 - (1 - p) ** 3);
      cur.current = n;
      setV(n);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const land = window.setTimeout(() => {
      cancelAnimationFrame(raf);
      cur.current = target;
      setV(target);
    }, ms + 150);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(land);
    };
  }, [target, ms]);
  return v;
}
function Count({ cents, fmt }: { cents: number; fmt: (c: number) => string }) {
  return <>{fmt(Math.round(useTween(cents)))}</>;
}

/** Focuses the element found once React has drawn it. */
function useFocusLater() {
  const want = useRef<(() => HTMLElement | null | undefined) | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    const find = want.current;
    if (!find) return;
    want.current = null;
    find()?.focus();
  });
  return (find: () => HTMLElement | null | undefined) => {
    want.current = find;
    setTick((t) => t + 1);
  };
}

/**
 * Roving focus over repeated row actions: the list is one Tab stop; Up and Down move between rows, Left and Right
 * along a row, Home and End jump to the first and last row.
 */
function useRoving(rows: string[]) {
  const [at, setAt] = useState({ r: "", c: 0 });
  const cur = rows.includes(at.r) ? at : { r: rows[0] ?? "", c: 0 };
  const item = (r: string, c: number) => ({ tabIndex: cur.r === r && cur.c === c ? 0 : -1, "data-rv": r, "data-rc": c, onFocus: () => setAt({ r, c }) });
  const onKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    const t = e.target as HTMLElement;
    const r = t.dataset.rv;
    if (r === undefined) return;
    const c = Number(t.dataset.rc);
    let i = rows.indexOf(r);
    let nc = c;
    if (e.key === "ArrowDown") i = Math.min(rows.length - 1, i + 1);
    else if (e.key === "ArrowUp") i = Math.max(0, i - 1);
    else if (e.key === "Home") i = 0;
    else if (e.key === "End") i = rows.length - 1;
    else if (e.key === "ArrowRight") nc = c + 1;
    else if (e.key === "ArrowLeft") nc = c - 1;
    else return;
    e.preventDefault();
    const inRow = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(`[data-rv="${CSS.escape(rows[i] ?? "")}"]`)).filter((el) => !(el as HTMLButtonElement).disabled);
    const pick = inRow.find((el) => Number(el.dataset.rc) === nc) ?? (nc === c ? inRow[Math.min(c, inRow.length - 1)] : undefined);
    pick?.focus();
  };
  return { item, onKeyDown };
}

export function BillSplitter({
  title,
  people: givenPeople,
  items: givenItems,
  payer: givenPayer,
  taxRate = 0,
  tipPercent = 18,
  tipOptions = [0, 15, 18, 20],
  maxPeople = 8,
  currency = "USD",
  locale = "en-US",
  loading = false,
  onSettle = quick,
  onCopy,
  className,
}: BillSplitterProps) {
  const uid = useId().replace(/:/g, "");
  const focusLater = useFocusLater();
  const [people, setPeople] = useState(givenPeople);
  const [items, setItems] = useState(givenItems);
  const [payer, setPayer] = useState(givenPayer ?? givenPeople[0]?.id ?? "");
  const [tax, setTax] = useState(String(taxRate));
  const [tipChoice, setTipChoice] = useState(tipOptions.includes(tipPercent) ? String(tipPercent) : "custom");
  const [tipCustom, setTipCustom] = useState(tipOptions.includes(tipPercent) ? "" : String(tipPercent));
  const [newName, setNewName] = useState("");
  const [nameErr, setNameErr] = useState("");
  const [item, setItem] = useState({ name: "", price: "" });
  const [itemErr, setItemErr] = useState<{ name?: string; price?: string }>({});
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [settled, setSettled] = useState<Set<string>>(new Set());
  const [settling, setSettling] = useState<string | null>(null);
  const [rowErr, setRowErr] = useState<{ id: string; text: string } | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "done" | "failed">("idle");
  const [said, setSaid] = useState("");
  const seq = useRef(0);

  const mf = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency }), [locale, currency]);
  const money = (c: number) => mf.format(c / 100);
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "";

  // ── The math, all in cents. ──
  const taxPct = parsePercent(tax, 25);
  const tipPct = tipChoice === "custom" ? parsePercent(tipCustom, 100) : Number(tipChoice);
  const subtotal = items.reduce((n, it) => n + it.price, 0);
  const orphans = items.filter((it) => !it.shares.some((id) => people.some((p) => p.id === id)));
  const own = people.map(() => 0);
  for (const it of items) {
    const who = people.map((p, i) => (it.shares.includes(p.id) ? i : -1)).filter((i) => i >= 0);
    if (!who.length) continue;
    const base = Math.floor(it.price / who.length);
    let odd = it.price - base * who.length;
    for (const i of who) {
      own[i]! += base + (odd > 0 ? 1 : 0);
      odd -= 1;
    }
  }
  const counted = own.reduce((a, b) => a + b, 0);
  const taxCents = Math.round((subtotal * (taxPct ?? 0)) / 100);
  const tipCents = Math.round((subtotal * (tipPct ?? 0)) / 100);
  const total = subtotal + taxCents + tipCents;
  const taxShare = allocate(counted === subtotal ? taxCents : Math.round((counted * (taxPct ?? 0)) / 100), own);
  const tipShare = allocate(counted === subtotal ? tipCents : Math.round((counted * (tipPct ?? 0)) / 100), own);
  const shares = people.map((p, i) => ({ ...p, items: own[i]!, tax: taxShare[i]!, tip: tipShare[i]!, total: own[i]! + taxShare[i]! + tipShare[i]! }));
  const biggest = Math.max(1, ...shares.map((s) => s.total));
  const debts = shares.filter((s) => s.id !== payer && s.total > 0);
  const blocked = orphans.length > 0 || taxPct === null || tipPct === null || people.length < 2;
  const settledCount = debts.filter((d) => settled.has(d.id)).length;

  // A changed split un-marks payments that no longer match.
  const shareKey = shares.map((s) => `${s.id}:${s.total}`).join("|");
  const lastKey = useRef(shareKey);
  useEffect(() => {
    if (lastKey.current !== shareKey && settled.size) {
      setSettled(new Set());
      setSaid("The split changed, so payments were cleared.");
    }
    lastKey.current = shareKey;
  }, [shareKey, settled.size]);

  const rowIds = items.map((it) => it.id);
  const rove = useRoving(rowIds);

  const addPerson = (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    const err = !name
      ? "Enter a name."
      : people.some((p) => p.name.toLowerCase() === name.toLowerCase())
        ? `${name} is already here. Add a last initial.`
        : people.length >= maxPeople
          ? `Up to ${maxPeople} people.`
          : "";
    setNameErr(err);
    if (err) return document.getElementById(`${uid}-pn`)?.focus();
    const p = { id: `p${Date.now()}${++seq.current}`, name };
    setPeople((ps) => [...ps, p]);
    setItems((its) => its.map((it) => (it.shares.length === people.length ? { ...it, shares: [...it.shares, p.id] } : it)));
    setNewName("");
    setSaid(`${name} added and put on the shared items.`);
    if (!payer) setPayer(p.id);
  };

  const removing = removeId ? people.find((p) => p.id === removeId) : undefined;
  const askRemove = (p: SplitPerson) => {
    if (items.some((it) => it.shares.includes(p.id))) return setRemoveId(p.id);
    doRemove(p);
  };
  const doRemove = (p: SplitPerson) => {
    const rest = people.filter((x) => x.id !== p.id);
    setPeople(rest);
    setItems((its) => its.map((it) => ({ ...it, shares: it.shares.filter((id) => id !== p.id) })));
    if (payer === p.id) setPayer(rest[0]?.id ?? "");
    setRemoveId(null);
    setSaid(`${p.name} removed.`);
    focusLater(() => document.getElementById(`${uid}-pn`));
  };

  const toggleShare = (it: SplitItem, p: SplitPerson) => {
    const on = it.shares.includes(p.id);
    setItems((its) => its.map((x) => (x.id === it.id ? { ...x, shares: on ? x.shares.filter((id) => id !== p.id) : [...x.shares, p.id] } : x)));
    const n = on ? it.shares.length - 1 : it.shares.length + 1;
    setSaid(`${it.name}: ${n === 0 ? "no one yet" : `shared by ${n}`}.`);
  };

  const addItem = (e: FormEvent) => {
    e.preventDefault();
    const name = item.name.trim();
    const price = parseCents(item.price);
    const err: typeof itemErr = {};
    if (!name) err.name = "Enter what it was.";
    if (price === null || price <= 0) err.price = "Enter a price, like 12.50.";
    else if (price > 10_000_00) err.price = "Keep each item under $10,000.";
    setItemErr(err);
    if (err.name || err.price) return document.getElementById(`${uid}-i${err.name ? "n" : "p"}`)?.focus();
    const it = { id: `i${Date.now()}${++seq.current}`, name, price: price!, shares: people.map((p) => p.id) };
    setItems((its) => [...its, it]);
    setItem({ name: "", price: "" });
    setSaid(`${name} added for ${money(it.price)}, shared by everyone.`);
    focusLater(() => document.getElementById(`${uid}-in`));
  };
  const removeItem = (it: SplitItem) => {
    const at = rowIds.indexOf(it.id);
    const next = rowIds[at + 1] ?? rowIds[at - 1];
    setItems((its) => its.filter((x) => x.id !== it.id));
    setSaid(`${it.name} removed.`);
    focusLater(() => (next ? document.querySelector<HTMLElement>(`#${uid}-items [data-rv="${next}"][data-rc="0"]`) : document.getElementById(`${uid}-in`)));
  };

  const settle = async (d: (typeof shares)[number], on: boolean) => {
    setSettling(d.id);
    setRowErr(null);
    try {
      await onSettle(d.id, d.total, on);
      setSettled((s) => {
        const n = new Set(s);
        if (on) n.add(d.id);
        else n.delete(d.id);
        return n;
      });
      setSaid(on ? `${d.name} paid ${nameOf(payer)} ${money(d.total)}.` : `${d.name} marked not paid.`);
      focusLater(() => document.getElementById(`${uid}-st-${d.id}`));
    } catch {
      setRowErr({ id: d.id, text: "Couldn't save that. Try again." });
    } finally {
      setSettling(null);
    }
  };

  const summary = [
    `${title}: ${money(total)} (items ${money(subtotal)}, tax ${money(taxCents)}, tip ${money(tipCents)})`,
    ...shares.map((s) => `${s.name}: ${money(s.total)}`),
    ...debts.map((d) => `${d.name} owes ${nameOf(payer)} ${money(d.total)}${settled.has(d.id) ? " (paid)" : ""}`),
  ].join("\n");
  const copy = async () => {
    try {
      if (onCopy) await onCopy(summary);
      else await navigator.clipboard.writeText(summary);
      setCopyState("done");
      setSaid("Summary copied.");
    } catch {
      setCopyState("failed");
      setSaid("Couldn't copy. The summary is shown to select.");
      focusLater(() => document.getElementById(`${uid}-sum`));
    }
  };

  const tipLabel = tipChoice === "custom" ? (tipPct === null ? "Tip" : `Tip (${tipPct}%)`) : `Tip (${tipChoice}%)`;

  if (loading) {
    return (
      <div className={["fl-bsp", className ?? ""].filter(Boolean).join(" ")} data-fl="b.bill-splitter" aria-busy="true">
        <div className="fl-bsp-card fl-bsp-ghosts" aria-hidden="true">
          {[0, 1, 2, 3].map((k) => (
            <span key={k} className="fl-bsp-ghost" />
          ))}
        </div>
        <div className="fl-bsp-card fl-bsp-ghosts" aria-hidden="true">
          {[0, 1, 2].map((k) => (
            <span key={k} className="fl-bsp-ghost" />
          ))}
        </div>
        <p className="fl-sr" role="status">
          Loading the bill…
        </p>
      </div>
    );
  }

  return (
    <div className={["fl-bsp", className ?? ""].filter(Boolean).join(" ")} data-fl="b.bill-splitter">
      <section className="fl-bsp-card" aria-labelledby={`${uid}-t`}>
        <h3 id={`${uid}-t`} className="fl-bsp-title">
          {title}
        </h3>

        <h4 className="fl-bsp-h">People</h4>
        <ul className="fl-bsp-people" aria-label="People">
          {people.map((p, i) => (
            <li key={p.id} className="fl-bsp-person">
              <Avatar name={p.name} size={32} tone={TONES[i % TONES.length]} decorative />
              <span>{p.name}</span>
              <button type="button" className="fl-bsp-x" aria-label={`Remove ${p.name}`} disabled={people.length <= 2} onClick={() => askRemove(p)}>
                <Icon name="close" />
              </button>
            </li>
          ))}
        </ul>
        <form className="fl-bsp-add" onSubmit={addPerson} noValidate>
          <label htmlFor={`${uid}-pn`} className="fl-sr">
            Name
          </label>
          <TextField
            id={`${uid}-pn`}
            size={40}
            placeholder="Add a person"
            autoComplete="off"
            maxLength={24}
            value={newName}
            invalid={!!nameErr}
            aria-describedby={nameErr ? `${uid}-pn-err` : undefined}
            onChange={(e) => (setNewName(e.target.value), setNameErr(""))}
          />
          <Button type="submit" variant="secondary" size={40} icon="plus" disabled={people.length >= maxPeople}>
            Add
          </Button>
          {nameErr ? (
            <p id={`${uid}-pn-err`} className="fl-bsp-err">
              {nameErr}
            </p>
          ) : null}
        </form>

        <h4 className="fl-bsp-h">Items</h4>
        {items.length ? (
          <ul id={`${uid}-items`} className="fl-bsp-items" aria-label="Items" onKeyDown={rove.onKeyDown}>
            {items.map((it, k) => {
              const nobody = orphans.includes(it);
              return (
                <li key={it.id} className={`fl-bsp-item${nobody ? " is-orphan" : ""}`} style={{ ["--i" as string]: Math.min(k, 8) }}>
                  <div className="fl-bsp-item-head">
                    <strong>{it.name}</strong>
                    <span>{money(it.price)}</span>
                  </div>
                  <div className="fl-bsp-chips" role="group" aria-label={`Who had ${it.name}`}>
                    {people.map((p, c) => (
                      <button key={p.id} type="button" className="fl-bsp-chip" aria-pressed={it.shares.includes(p.id)} {...rove.item(it.id, c)} onClick={() => toggleShare(it, p)}>
                        {it.shares.includes(p.id) ? <Icon name="check" /> : null}
                        {p.name}
                      </button>
                    ))}
                    <Button {...rove.item(it.id, people.length)} variant="tertiary" size={32} icon="trash" iconOnly aria-label={`Remove ${it.name}`} className="fl-bsp-del" onClick={() => removeItem(it)}>
                      Remove
                    </Button>
                  </div>
                  {nobody ? (
                    <p className="fl-bsp-err">
                      <Icon name="alert" />
                      Pick who had this.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="fl-bsp-empty" data-fl="c.empty-state">
            <Icon name="cart" />
            <strong>No items yet</strong>
            <p>Add what was ordered below.</p>
          </div>
        )}
        <form className="fl-bsp-add fl-bsp-add--item" onSubmit={addItem} noValidate>
          <div className="fl-bsp-field">
            <label htmlFor={`${uid}-in`}>Item</label>
            <TextField
              id={`${uid}-in`}
              size={40}
              autoComplete="off"
              maxLength={40}
              placeholder="Pad thai"
              value={item.name}
              invalid={!!itemErr.name}
              aria-describedby={itemErr.name ? `${uid}-in-err` : undefined}
              onChange={(e) => (setItem((x) => ({ ...x, name: e.target.value })), setItemErr((x) => ({ ...x, name: undefined })))}
            />
          </div>
          <div className="fl-bsp-field fl-bsp-field--price">
            <label htmlFor={`${uid}-ip`}>Price</label>
            <span className="fl-bsp-money">
              <span aria-hidden="true">$</span>
              <TextField
                id={`${uid}-ip`}
                size={40}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={item.price}
                invalid={!!itemErr.price}
                aria-describedby={itemErr.price ? `${uid}-ip-err` : undefined}
                onChange={(e) => (setItem((x) => ({ ...x, price: e.target.value })), setItemErr((x) => ({ ...x, price: undefined })))}
              />
            </span>
          </div>
          <Button type="submit" variant="secondary" size={40} icon="plus">
            Add item
          </Button>
          {itemErr.name ? (
            <p id={`${uid}-in-err`} className="fl-bsp-err">
              {itemErr.name}
            </p>
          ) : null}
          {itemErr.price ? (
            <p id={`${uid}-ip-err`} className="fl-bsp-err">
              {itemErr.price}
            </p>
          ) : null}
        </form>
      </section>

      <section className="fl-bsp-card" aria-labelledby={`${uid}-tt`}>
        <h3 id={`${uid}-tt`} className="fl-bsp-title">
          Totals
        </h3>
        <dl className="fl-bsp-lines">
          <div>
            <dt>Subtotal</dt>
            <dd>{money(subtotal)}</dd>
          </div>
          <div>
            <dt>
              <label htmlFor={`${uid}-tax`}>Tax</label>
              <span className="fl-bsp-pct">
                <TextField
                  id={`${uid}-tax`}
                  size={32}
                  inputMode="decimal"
                  autoComplete="off"
                  value={tax}
                  invalid={taxPct === null}
                  aria-describedby={taxPct === null ? `${uid}-tax-err` : undefined}
                  onChange={(e) => setTax(e.target.value)}
                />
                <span aria-hidden="true">%</span>
              </span>
              {taxPct === null ? (
                <span id={`${uid}-tax-err`} className="fl-bsp-err">
                  Enter a tax rate from 0 to 25.
                </span>
              ) : null}
            </dt>
            <dd>{money(taxCents)}</dd>
          </div>
          <div className="fl-bsp-tip">
            <dt>
              <span id={`${uid}-tipl`}>{tipLabel}</span>
              <Segmented
                label="Tip"
                size="sm"
                value={tipChoice}
                onChange={(v) => {
                  setTipChoice(v);
                  if (v === "custom") focusLater(() => document.getElementById(`${uid}-tipc`));
                }}
                options={[...tipOptions.map((t) => ({ value: String(t), label: `${t}%` })), { value: "custom", label: "Custom" }]}
              />
              {tipChoice === "custom" ? (
                <span className="fl-bsp-pct">
                  <label htmlFor={`${uid}-tipc`} className="fl-sr">
                    Custom tip percent
                  </label>
                  <TextField
                    id={`${uid}-tipc`}
                    size={32}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="22"
                    value={tipCustom}
                    invalid={tipPct === null}
                    aria-describedby={tipPct === null ? `${uid}-tip-err` : undefined}
                    onChange={(e) => setTipCustom(e.target.value)}
                  />
                  <span aria-hidden="true">%</span>
                </span>
              ) : null}
              {tipPct === null ? (
                <span id={`${uid}-tip-err`} className="fl-bsp-err">
                  Enter a tip from 0 to 100.
                </span>
              ) : null}
            </dt>
            <dd>{money(tipCents)}</dd>
          </div>
          <div className="fl-bsp-total">
            <dt>Total</dt>
            <dd>
              <Count cents={total} fmt={money} />
            </dd>
          </div>
        </dl>
        <div className="fl-bsp-field fl-bsp-payer">
          <label htmlFor={`${uid}-payer`}>Paid by</label>
          <Select id={`${uid}-payer`} value={payer} onChange={(e) => setPayer(e.target.value)} options={people.map((p) => ({ value: p.id, label: p.name }))} />
        </div>

        <h4 className="fl-bsp-h" id={`${uid}-ch`}>
          Each share
        </h4>
        {shares.length && subtotal ? (
          <>
            <svg
              className="fl-bsp-chart"
              viewBox={`0 0 100 ${shares.length * 14}`}
              preserveAspectRatio="none"
              role="img"
              aria-labelledby={`${uid}-ch`}
              aria-describedby={`${uid}-chd`}
              style={{ height: `${shares.length * 2.25}rem` }}
            >
              {shares.map((s, i) => (
                <g key={s.id}>
                  <rect className="fl-bsp-bar-bg" x="0" y={i * 14 + 3} width="100" height="8" />
                  <rect className={`fl-bsp-bar fl-bsp-bar--${i % 3}`} x="0" y={i * 14 + 3} width="100" height="8" style={{ ["--i" as string]: i, ["--w" as string]: s.total / biggest }} />
                </g>
              ))}
            </svg>
            <ul className="fl-bsp-legend" id={`${uid}-chd`}>
              {shares.map((s, i) => (
                <li key={s.id} style={{ ["--row" as string]: i }}>
                  <span className={`fl-bsp-key fl-bsp-key--${i % 3}`} aria-hidden="true" />
                  <span className="fl-bsp-who">{s.name}</span>
                  <span className="fl-bsp-break">
                    {money(s.items)} + {money(s.tax + s.tip)} tax and tip
                  </span>
                  <strong>
                    <Count cents={s.total} fmt={money} />
                  </strong>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="fl-bsp-muted">Shares show once there are items.</p>
        )}

        <h4 className="fl-bsp-h">Settle up</h4>
        {blocked ? (
          <p className="fl-bsp-block" role="note">
            <Icon name="alert" />
            {people.length < 2
              ? "Add at least two people."
              : orphans.length
                ? `${orphans.length === 1 ? "1 item has" : `${orphans.length} items have`} no one on it.`
                : "Fix the tax or tip first."}
          </p>
        ) : !debts.length ? (
          <p className="fl-bsp-muted">Nobody owes anything.</p>
        ) : (
          <>
            <p className="fl-bsp-muted">
              {settledCount} of {debts.length} paid back
            </p>
            <ul className="fl-bsp-debts">
              {debts.map((d) => {
                const paid = settled.has(d.id);
                return (
                  <li key={d.id} className={paid ? "is-paid" : undefined}>
                    <span>
                      <strong>{d.name}</strong> owes {nameOf(payer)} <strong>{money(d.total)}</strong>
                    </span>
                    {paid ? (
                      <span className="fl-bsp-paid">
                        <Badge tone="success" led>
                          Paid
                        </Badge>
                        <Button id={`${uid}-st-${d.id}`} variant="tertiary" size={32} busy={settling === d.id} aria-label={`Undo: ${d.name} paid`} onClick={() => void settle(d, false)}>
                          Undo
                        </Button>
                      </span>
                    ) : (
                      <Button id={`${uid}-st-${d.id}`} variant="secondary" size={32} icon="check" busy={settling === d.id} aria-label={`Mark ${d.name} paid`} onClick={() => void settle(d, true)}>
                        Mark paid
                      </Button>
                    )}
                    {rowErr?.id === d.id ? (
                      <p className="fl-bsp-err" role="alert">
                        {rowErr.text}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <div className="fl-bsp-copy">
          <Button variant="primary" size={40} icon={copyState === "done" ? "check" : "copy"} disabled={!subtotal || blocked} onClick={() => void copy()}>
            {copyState === "done" ? "Copied" : "Copy summary"}
          </Button>
        </div>
        {copyState === "failed" ? (
          <div className="fl-bsp-field">
            <label htmlFor={`${uid}-sum`}>Couldn't copy. Select this text:</label>
            <TextField id={`${uid}-sum`} multiline readOnly rows={Math.min(10, summary.split("\n").length)} value={summary} onFocus={(e) => e.currentTarget.select()} />
          </div>
        ) : null}
      </section>

      {removing ? (
        <Modal
          variant="danger"
          icon="trash"
          title={`Remove ${removing.name}?`}
          description={`${removing.name} is on ${items.filter((it) => it.shares.includes(removing.id)).length} items. Those are then shared by whoever else had them.`}
          confirmLabel="Remove"
          cancelLabel="Keep"
          onConfirm={() => {
            doRemove(removing);
            return false;
          }}
          onClose={() => setRemoveId(null)}
        />
      ) : null}

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

// ── The reference sheet: dinner for three, Ana paid. ──

// flowcode:sample
const SAMPLE: BillSplitterProps = {
  title: "Dinner at Thai Basil",
  people: [
    { id: "ana", name: "Ana" },
    { id: "ben", name: "Ben" },
    { id: "chloe", name: "Chloe" },
  ],
  items: [
    { id: "i1", name: "Pad thai", price: 1695, shares: ["ana"] },
    { id: "i2", name: "Green curry", price: 1850, shares: ["ben", "chloe"] },
    { id: "i3", name: "Spring rolls", price: 995, shares: ["ana", "ben", "chloe"] },
    { id: "i4", name: "Thai iced tea", price: 1100, shares: ["ana", "chloe"] },
    { id: "i5", name: "Bottle of riesling", price: 4200, shares: ["ben", "chloe"] },
  ],
  payer: "ana",
  taxRate: 8.875,
  tipPercent: 18,
};

export default function BillSplitterPreview() {
  return (
    <section className="fl-section fl-section--canvas" aria-label="Bill splitter">
      <div className="fl-wrap">
        <BillSplitter {...SAMPLE} onSettle={() => new Promise<void>((done) => window.setTimeout(done, 250))} />
      </div>
    </section>
  );
}
