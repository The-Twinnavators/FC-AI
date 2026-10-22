/** @flowcode-library transactions-list · Transactions with categories (Tables and lists)
 * Catalog ID: b.transactions-list (block)
 * Function: A month of bank and card transactions (b.transactions-list): switch months, see money in, out and net, search by payee, note or amount, filter by category or "Needs a category", assign a category to one transaction or many at once, and split one transaction across categories with the parts adding up to the total.
 * Use it as: import { TransactionsList } from "./transactions-list"; <TransactionsList title="Transactions" categories={[{ id, name }]} transactions={[{ id, date: "2026-10-21", payee, account, note?, amount(cents, negative is money out), category?, splits?: [{ category, amount(cents) }] }]} month?="2026-10" minMonth?="2026-08" currency?="USD" locale? onMonthLoad?={async (month) => ...} onCategorize?={async (ids, categoryId) => ...} onSplit?={async (id, splits | null) => ...} />
 * Built from: c.text-field.outlined, c.select.outlined, c.checkbox, c.radio, c.badge.status, c.modal.form, c.button.primary, c.button.secondary, c.button.tertiary, c.empty-state
 * Look: A white card: the title with previous and next month buttons around "October 2026", three figures (In, Out, Net) and a "5 need a category" pill, a search field and a category select, a select-all row that grows a bulk bar (count, Assign category, Clear) when anything is picked, then the transactions grouped under day headers with the day's net. Each row has a checkbox, the payee over the account and note, a category pill (dashed when missing, "Split · 2" when split), a Split button and the amount, green with a plus for money in.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-success --color-warning --color-danger --surface-radius --pill-radius --radius-sm --radius-md --space-1 --space-2 --space-3 --space-4 --space-5 --text-xs --text-sm --text-md --text-lg --text-xl --weight-semibold --weight-bold --font-sans --font-display --font-mono --focus-ring --duration-fast --duration-base --duration-slow --ease-out --easing --enter-distance --stagger
 * Use cases: personal finance app; bank transactions; card statement; expense categorization; bookkeeping inbox; household spending review; small business expenses
 * Jobs to be done: see what came in and went out this month; find a payment by name or amount; put each transaction in a category; categorize a batch at once; split one purchase across categories; look back at last month
 * Keywords: transactions, ledger, bank, card, categorize, split transaction, bulk edit, search, month, money in, money out, personal finance
 */
/**
 * Transactions with categories: money is whole cents; a negative amount is money out. The month switch loads the month
 * (onMonthLoad may return a promise: gray rows show while it runs and a failure shows Retry). Search matches payee,
 * note and the amount ("12.5" finds $12.50); the category select adds "Needs a category". Rows group under day
 * headers, newest first, with each day's net.
 * Pick rows with their checkboxes (or Select all shown): a bulk bar opens with Assign category and Clear. The category
 * dialog is a radio list; it replaces a split when there is one, and says so. Split opens a dialog of category and
 * amount lines that must add up to the transaction (it shows what's left to split, and won't save until it is $0.00);
 * an existing split can be undone there.
 * In the list, each row's checkbox, category and Split buttons are one Tab stop: Up and Down move between rows, Left
 * and Right across a row, Home and End jump to the first and last row. After an assign or a split, focus goes back to
 * the button you came from (or the search field when the row has left the filtered view).
 * Adapted from HyperUI (MIT, Copyright (c) Mark Mead): its table with checkboxes and a bulk actions bar, reshaped into
 * a grouped transactions list.
 */
/**
 * How to try it
 * - Press the "need a category" pill: the list shows only those. Pick two with their checkboxes, press Assign category,
 *   choose Groceries and press Assign; they leave the view and the count drops.
 * - Press Split on Target: change the first line to 60.00 and pick Shopping, set the second line to Household; it
 *   shows $0.00 left. Save. Open it again and press Undo split.
 * - Type "uber" or "12.5" in Search. Press the previous month button twice: the first try at the oldest month fails, Retry loads it.
 * - Tab into the list and use the arrow keys, Home and End.
 *
 * Dependencies: React (useEffect, useId, useMemo, useRef, useState), the library's TextField ("./text-fields-states"),
 * Select ("./dropdowns-states"), Checkbox and Radio ("./checkboxes-radios"), Marked ("./search-field"), Modal
 * ("./modals-dialogs"), Button ("./buttons-variants") and its icons ("./icons"). Nothing else: nothing fetched at run
 * time. The styles are the library's own fl- classes in templates/library/css/r5b-transactions.css.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Button } from "./buttons-variants";
import { Checkbox, Radio } from "./checkboxes-radios";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { Marked } from "./search-field";
import { TextField } from "./text-fields-states";

// ── b.transactions-list: a month of transactions with search, category assign (one or many) and splits. ──

export type TxnCategory = { id: string; name: string };
export type TxnSplit = { category: string; /** cents, positive */ amount: number };
export type Txn = {
  id: string;
  /** "YYYY-MM-DD" */
  date: string;
  payee: string;
  account: string;
  note?: string;
  /** cents; negative is money out */
  amount: number;
  category?: string;
  splits?: TxnSplit[];
};
export type TransactionsListProps = {
  title: string;
  categories: TxnCategory[];
  transactions: Txn[];
  /** "YYYY-MM" to open on; this month when left out. */
  month?: string;
  /** The oldest "YYYY-MM" the previous button reaches. */
  minMonth?: string;
  currency?: string;
  locale?: string;
  /** Runs when the month changes; a rejected promise shows the error state with Retry. */
  onMonthLoad?: (month: string) => Promise<void>;
  onCategorize?: (ids: string[], categoryId: string) => Promise<void>;
  /** null undoes a split. */
  onSplit?: (id: string, splits: TxnSplit[] | null) => Promise<void>;
  className?: string;
};

type Line = { key: number; category: string; amount: string };

const quick = async () => undefined;
const pad = (n: number) => String(n).padStart(2, "0");
const ymOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const shiftMonth = (ym: string, by: number) => {
  const [y, m] = ym.split("-").map(Number);
  return ymOf(new Date(y!, m! - 1 + by, 1));
};
const dateOf = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
};

/** "$1,234.5" or "1234.50" to cents; null when it isn't a plain amount. */
function parseCents(raw: string): number | null {
  const s = raw.replace(/[$,\s]/g, "");
  if (!/^(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

const motionOff = () =>
  typeof window === "undefined" || !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off";

/** A number that counts toward its target with an ease-out curve; jumps when motion is off. */
function useTween(target: number, ms = 600) {
  const [v, setV] = useState(motionOff() ? target : 0);
  const cur = useRef(v);
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
    // A frame loop can be paused (a background tab): land on the figure anyway.
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

/** Focuses the first element found once React has drawn it. */
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
 * across a row, Home and End jump to the first and last row.
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

export function TransactionsList({
  title,
  categories,
  transactions,
  month: startMonth,
  minMonth,
  currency = "USD",
  locale = "en-US",
  onMonthLoad,
  onCategorize = quick,
  onSplit = quick,
  className,
}: TransactionsListProps) {
  const uid = useId().replace(/:/g, "");
  const focusLater = useFocusLater();
  const thisMonth = ymOf(new Date());
  const [month, setMonth] = useState(startMonth ?? thisMonth);
  const [txns, setTxns] = useState(transactions);
  const [load, setLoad] = useState<"idle" | "loading" | "failed">("idle");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [said, setSaid] = useState("");
  const [assign, setAssign] = useState<{ ids: string[]; from: string } | null>(null);
  const [assignTo, setAssignTo] = useState("");
  const [assignErr, setAssignErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [splitId, setSplitId] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [splitErr, setSplitErr] = useState("");
  const lineKey = useRef(0);
  const loadRun = useRef(0);
  const box = useRef<HTMLElement>(null);

  const mf = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency }), [locale, currency]);
  const money = (c: number) => mf.format(c / 100);
  const signed = (c: number) => (c > 0 ? `+${money(c)}` : money(c));
  const monthName = useMemo(() => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }), [locale]);
  const monthShort = useMemo(() => new Intl.DateTimeFormat(locale, { month: "long" }), [locale]);
  const dayName = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" }), [locale]);
  const catName = (id?: string) => categories.find((c) => c.id === id)?.name ?? "";
  const monthLabel = monthName.format(dateOf(`${month}-01`));

  const inMonth = txns.filter((t) => t.date.startsWith(month));
  const moneyIn = inMonth.reduce((n, t) => n + Math.max(0, t.amount), 0);
  const moneyOut = inMonth.reduce((n, t) => n + Math.min(0, t.amount), 0);
  const needs = inMonth.filter((t) => !t.category && !t.splits?.length);
  const q = query.trim().toLowerCase();
  const qNum = q.replace(/[$,\s]/g, "");
  const shown = inMonth
    .filter((t) => {
      if (q) {
        const hit = t.payee.toLowerCase().includes(q) || (t.note ?? "").toLowerCase().includes(q) || (/^[\d.]+$/.test(qNum) && (Math.abs(t.amount) / 100).toFixed(2).includes(qNum));
        if (!hit) return false;
      }
      if (filter === "none") return !t.category && !t.splits?.length;
      if (filter) return t.category === filter || !!t.splits?.some((s) => s.category === filter);
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.payee.localeCompare(b.payee));
  const days: { date: string; rows: Txn[] }[] = [];
  for (const t of shown) {
    const last = days[days.length - 1];
    if (last && last.date === t.date) last.rows.push(t);
    else days.push({ date: t.date, rows: [t] });
  }
  const ids = shown.map((t) => t.id);
  const rove = useRoving(ids);
  const pickedShown = ids.filter((id) => picked.has(id));
  const allPicked = ids.length > 0 && pickedShown.length === ids.length;

  // The live count after a search or filter change (not on first draw).
  const firstDraw = useRef(true);
  useEffect(() => {
    if (firstDraw.current) {
      firstDraw.current = false;
      return;
    }
    setSaid(shown.length === 0 ? "No transactions match." : `${shown.length} ${shown.length === 1 ? "transaction" : "transactions"}.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filter]);

  // Focus never drops to the page: a month button that turns disabled, or Retry going away, hands focus on.
  const refocus = (from: "prev" | "next" | "retry", failed = false) =>
    focusLater(() => {
      const a = document.activeElement;
      if (a && a !== document.body && box.current?.contains(a) && !(a as HTMLButtonElement).disabled) return null;
      if (failed) return document.getElementById(`${uid}-retry`);
      const p = document.getElementById(`${uid}-prev`) as HTMLButtonElement | null;
      const n = document.getElementById(`${uid}-next`) as HTMLButtonElement | null;
      return from === "next" ? (n && !n.disabled ? n : p) : p && !p.disabled ? p : n;
    });
  const goMonth = async (ym: string, from: "prev" | "next" | "retry") => {
    setMonth(ym);
    setPicked(new Set());
    setSaid("");
    refocus(from);
    if (!onMonthLoad) return setSaid(monthName.format(dateOf(`${ym}-01`)));
    const run = ++loadRun.current;
    setLoad("loading");
    try {
      await onMonthLoad(ym);
      if (run !== loadRun.current) return;
      setLoad("idle");
      setSaid(`${monthName.format(dateOf(`${ym}-01`))} loaded.`);
      refocus(from);
    } catch {
      if (run !== loadRun.current) return;
      setLoad("failed");
      setSaid(`Couldn't load ${monthName.format(dateOf(`${ym}-01`))}.`);
      refocus(from, true);
    }
  };

  const togglePick = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const pickAll = () => setPicked((s) => (allPicked ? new Set([...s].filter((id) => !ids.includes(id))) : new Set([...s, ...ids])));

  const openAssign = (ids: string[], from: string) => {
    const one = ids.length === 1 ? txns.find((t) => t.id === ids[0]) : undefined;
    setAssignTo(one?.category ?? "");
    setAssignErr("");
    setAssign({ ids, from });
  };
  const doAssign = async () => {
    if (!assign) return;
    if (!assignTo) {
      setAssignErr("Pick a category.");
      return;
    }
    setBusy(true);
    try {
      await onCategorize(assign.ids, assignTo);
      setTxns((all) => all.map((t) => (assign.ids.includes(t.id) ? { ...t, category: assignTo, splits: undefined } : t)));
      const n = assign.ids.length;
      setSaid(`${n === 1 ? txns.find((t) => t.id === assign.ids[0])?.payee ?? "1 transaction" : `${n} transactions`} set to ${catName(assignTo)}.`);
      const from = assign.from;
      setAssign(null);
      if (n > 1) setPicked(new Set());
      focusLater(() => document.getElementById(from) ?? document.getElementById(`${uid}-q`));
    } catch {
      setAssignErr("Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const splitting = splitId ? txns.find((t) => t.id === splitId) : undefined;
  const openSplit = (t: Txn) => {
    const total = Math.abs(t.amount);
    const start: Line[] = t.splits?.length
      ? t.splits.map((s) => ({ key: ++lineKey.current, category: s.category, amount: (s.amount / 100).toFixed(2) }))
      : [
          { key: ++lineKey.current, category: t.category ?? "", amount: (Math.ceil(total / 2) / 100).toFixed(2) },
          { key: ++lineKey.current, category: "", amount: (Math.floor(total / 2) / 100).toFixed(2) },
        ];
    setLines(start);
    setSplitErr("");
    setSplitId(t.id);
  };
  const lineCents = lines.map((l) => parseCents(l.amount));
  const splitTotal = splitting ? Math.abs(splitting.amount) : 0;
  const splitLeft = splitTotal - lineCents.reduce<number>((n, c) => n + (c ?? 0), 0);
  const setLine = (key: number, patch: Partial<Line>) => {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    setSplitErr("");
  };
  const saveSplit = async () => {
    if (!splitting) return;
    const bad = lines.findIndex((l, i) => !l.category || lineCents[i] === null || lineCents[i]! <= 0);
    if (bad >= 0) {
      const l = lines[bad]!;
      setSplitErr(!l.category ? `Pick a category for line ${bad + 1}.` : `Enter an amount above zero on line ${bad + 1}.`);
      document.getElementById(`${uid}-sl-${l.key}-${!l.category ? "c" : "a"}`)?.focus();
      return;
    }
    if (splitLeft !== 0) {
      setSplitErr(splitLeft > 0 ? `${money(splitLeft)} is still left to split.` : `The lines are ${money(-splitLeft)} over the total.`);
      return;
    }
    const merged = new Map<string, number>();
    lines.forEach((l, i) => merged.set(l.category, (merged.get(l.category) ?? 0) + lineCents[i]!));
    const splits = [...merged].map(([category, amount]) => ({ category, amount }));
    setBusy(true);
    try {
      if (splits.length === 1) {
        await onCategorize([splitting.id], splits[0]!.category);
        setTxns((all) => all.map((t) => (t.id === splitting.id ? { ...t, category: splits[0]!.category, splits: undefined } : t)));
        setSaid(`${splitting.payee} set to ${catName(splits[0]!.category)}.`);
      } else {
        await onSplit(splitting.id, splits);
        setTxns((all) => all.map((t) => (t.id === splitting.id ? { ...t, category: undefined, splits } : t)));
        setSaid(`${splitting.payee} split across ${splits.length} categories.`);
      }
      const id = splitting.id;
      setSplitId(null);
      focusLater(() => document.getElementById(`${uid}-sp-${id}`) ?? document.getElementById(`${uid}-q`));
    } catch {
      setSplitErr("Couldn't save the split. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const undoSplit = async () => {
    if (!splitting?.splits?.length) return;
    const biggest = [...splitting.splits].sort((a, b) => b.amount - a.amount)[0]!.category;
    setBusy(true);
    try {
      await onSplit(splitting.id, null);
      setTxns((all) => all.map((t) => (t.id === splitting.id ? { ...t, category: biggest, splits: undefined } : t)));
      setSaid(`Split undone. ${splitting.payee} is in ${catName(biggest)}.`);
      const id = splitting.id;
      setSplitId(null);
      focusLater(() => document.getElementById(`${uid}-sp-${id}`) ?? document.getElementById(`${uid}-q`));
    } catch {
      setSplitErr("Couldn't undo the split. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const clearFilters = () => {
    setQuery("");
    setFilter("");
    focusLater(() => document.getElementById(`${uid}-q`));
  };
  const assignHasSplit = assign ? assign.ids.some((id) => txns.find((t) => t.id === id)?.splits?.length) : false;
  const assignOne = assign && assign.ids.length === 1 ? txns.find((t) => t.id === assign.ids[0]) : undefined;
  const ready = load === "idle";

  return (
    <section ref={box} className={["fl-txn", className ?? ""].filter(Boolean).join(" ")} data-fl="b.transactions-list" aria-labelledby={`${uid}-t`} aria-busy={load === "loading" || undefined}>
      <header className="fl-txn-head">
        <h3 id={`${uid}-t`} className="fl-txn-title">
          {title}
        </h3>
        <div className="fl-txn-month" role="group" aria-label="Month">
          <Button id={`${uid}-prev`} variant="tertiary" size={32} icon="chevron-left" iconOnly disabled={!!minMonth && month <= minMonth} onClick={() => void goMonth(shiftMonth(month, -1), "prev")}>
            Previous month
          </Button>
          <span className="fl-txn-month-name" aria-live="polite">
            {monthLabel}
          </span>
          <Button id={`${uid}-next`} variant="tertiary" size={32} icon="chevron-right" iconOnly disabled={month >= thisMonth} onClick={() => void goMonth(shiftMonth(month, 1), "next")}>
            Next month
          </Button>
        </div>
      </header>

      {load === "loading" ? (
        <div className="fl-txn-ghosts" aria-hidden="true">
          <span className="fl-txn-ghost fl-txn-ghost--big" />
          {[0, 1, 2, 3, 4].map((k) => (
            <span key={k} className="fl-txn-ghost" />
          ))}
        </div>
      ) : load === "failed" ? (
        <div className="fl-txn-state" role="alert">
          <Icon name="alert" />
          <strong>Couldn't load {monthShort.format(dateOf(`${month}-01`))}</strong>
          <p>Check your connection and try again.</p>
          <Button id={`${uid}-retry`} variant="secondary" size={40} icon="refresh" onClick={() => void goMonth(month, "retry")}>
            Retry
          </Button>
        </div>
      ) : null}

      {ready ? (
        <>
          <div className="fl-txn-sum">
          <dl>
            <div>
              <dt>In</dt>
              <dd className="is-in">
                <Count cents={moneyIn} fmt={signed} />
              </dd>
            </div>
            <div>
              <dt>Out</dt>
              <dd>
                <Count cents={moneyOut} fmt={money} />
              </dd>
            </div>
            <div>
              <dt>Net</dt>
              <dd className={moneyIn + moneyOut >= 0 ? "is-in" : "is-out"}>
                <Count cents={moneyIn + moneyOut} fmt={signed} />
              </dd>
            </div>
          </dl>
            {needs.length ? (
              <button type="button" className="fl-txn-needs" aria-pressed={filter === "none"} onClick={() => setFilter((f) => (f === "none" ? "" : "none"))}>
                <span className="fl-txn-dot" aria-hidden="true" />
                {needs.length} need a category
              </button>
            ) : null}
          </div>

          <div className="fl-txn-tools" role="search">
            <div className="fl-txn-search">
              <label htmlFor={`${uid}-q`} className="fl-sr">
                Search transactions
              </label>
              <Icon name="search" />
              <TextField id={`${uid}-q`} size={40} type="search" placeholder="Payee, note or amount" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="fl-txn-filter">
              <label htmlFor={`${uid}-f`} className="fl-sr">
                Category
              </label>
              <Select
                id={`${uid}-f`}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                options={[{ value: "", label: "All categories" }, { value: "none", label: "Needs a category" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
              />
            </div>
          </div>

          {shown.length ? (
            <div className="fl-txn-pick">
              <Checkbox
                id={`${uid}-all`}
                label="Select all shown"
                checked={allPicked}
                indeterminate={pickedShown.length > 0 && !allPicked}
                onChange={pickAll}
              />
              <div className={`fl-txn-bulk${pickedShown.length ? " is-open" : ""}`} inert={!pickedShown.length} aria-hidden={!pickedShown.length || undefined}>
                <div>
                  <strong>{pickedShown.length} selected</strong>
                  <Button id={`${uid}-bulk`} variant="primary" size={32} icon="folder" onClick={() => openAssign(pickedShown, `${uid}-all`)}>
                    Assign category
                  </Button>
                  <Button
                    variant="tertiary"
                    size={32}
                    onClick={() => {
                      setPicked(new Set());
                      document.getElementById(`${uid}-all`)?.focus();
                    }}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {!inMonth.length ? (
            <div className="fl-txn-state" data-fl="c.empty-state">
              <Icon name="calendar" />
              <strong>No transactions in {monthShort.format(dateOf(`${month}-01`))}</strong>
              <p>New ones show up here as your accounts sync.</p>
            </div>
          ) : !shown.length ? (
            <div className="fl-txn-state" data-fl="c.empty-state">
              <Icon name="search" />
              <strong>{filter === "none" && !q ? "Everything has a category" : "No transactions match"}</strong>
              <p>{filter === "none" && !q ? "Nice work. Nothing left to sort this month." : "Check the spelling or clear the filters."}</p>
              <Button variant="secondary" size={40} onClick={clearFilters}>
                {filter === "none" && !q ? "Show all" : "Clear filters"}
              </Button>
            </div>
          ) : (
            <div className="fl-txn-days" onKeyDown={rove.onKeyDown}>
              {days.map((d, di) => {
                const net = d.rows.reduce((n, t) => n + t.amount, 0);
                return (
                  <section key={d.date} className="fl-txn-day" aria-labelledby={`${uid}-d-${d.date}`} style={{ ["--i" as string]: Math.min(di, 6) }}>
                    <h4 id={`${uid}-d-${d.date}`} className="fl-txn-day-head">
                      <span>{dayName.format(dateOf(d.date))}</span>
                      <span className={net > 0 ? "is-in" : undefined}>{signed(net)}</span>
                    </h4>
                    <ul className="fl-txn-rows">
                      {d.rows.map((t) => {
                        const split = t.splits?.length ?? 0;
                        const cat = catName(t.category);
                        return (
                          <li key={t.id} className={`fl-txn-row${picked.has(t.id) ? " is-picked" : ""}`}>
                            <Checkbox {...rove.item(t.id, 0)} checked={picked.has(t.id)} onChange={() => togglePick(t.id)} aria-label={`Select ${t.payee}, ${money(t.amount)}`} />
                            <div className="fl-txn-who">
                              <strong>
                                <Marked text={t.payee} query={q} />
                              </strong>
                              <span>
                                {t.account}
                                {t.note ? (
                                  <>
                                    {" · "}
                                    <Marked text={t.note} query={q} />
                                  </>
                                ) : null}
                              </span>
                            </div>
                            <div className="fl-txn-acts">
                              <button
                                {...rove.item(t.id, 1)}
                                id={`${uid}-c-${t.id}`}
                                type="button"
                                className={`fl-txn-cat${!cat && !split ? " is-none" : ""}${split ? " is-split" : ""}`}
                                aria-label={`Category for ${t.payee}: ${split ? `split across ${split}` : cat || "none"}. Change`}
                                onClick={() => openAssign([t.id], `${uid}-c-${t.id}`)}
                              >
                                {split ? `Split · ${split}` : cat || "Add category"}
                              </button>
                              <Button {...rove.item(t.id, 2)} id={`${uid}-sp-${t.id}`} variant="tertiary" size={32} icon="layers" iconOnly aria-label={`Split ${t.payee}`} onClick={() => openSplit(t)}>
                                Split
                              </Button>
                            </div>
                            <span className={`fl-txn-amt${t.amount > 0 ? " is-in" : ""}`}>{signed(t.amount)}</span>
                            {split ? (
                              <ul className="fl-txn-parts" aria-label={`${t.payee} split`}>
                                {t.splits!.map((s) => (
                                  <li key={s.category}>
                                    {catName(s.category)} <span>{money(s.amount)}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </>
      ) : null}

      {assign ? (
        <Modal
          variant="form"
          title={assignOne ? `Category for ${assignOne.payee}` : `Category for ${assign.ids.length} transactions`}
          description={assignOne ? `${money(assignOne.amount)} · ${dayName.format(dateOf(assignOne.date))}` : undefined}
          confirmLabel="Assign"
          busy={busy}
          busyLabel="Saving…"
          onConfirm={() => {
            void doAssign();
            return false;
          }}
          onClose={() => {
            const from = assign.from;
            setAssign(null);
            focusLater(() => document.getElementById(from));
          }}
        >
          <fieldset className="fl-txn-radios" aria-describedby={assignErr ? `${uid}-ae` : undefined}>
            <legend className="fl-sr">Category</legend>
            {categories.map((c, i) => (
              <Radio key={c.id} name={`${uid}-cat`} label={c.name} value={c.id} checked={assignTo === c.id} data-autofocus={(assignTo ? assignTo === c.id : i === 0) || undefined} onChange={() => (setAssignTo(c.id), setAssignErr(""))} />
            ))}
          </fieldset>
          {assignHasSplit ? <p className="fl-txn-note">This replaces the split{assign.ids.length > 1 ? " on the split ones" : ""}.</p> : null}
          {assignErr ? (
            <p id={`${uid}-ae`} className="fl-txn-err" role="alert">
              {assignErr}
            </p>
          ) : null}
        </Modal>
      ) : null}

      {splitting ? (
        <Modal
          variant="form"
          title={`Split ${splitting.payee}`}
          description={`${money(splitTotal)} · ${dayName.format(dateOf(splitting.date))}`}
          confirmLabel="Save split"
          busy={busy}
          busyLabel="Saving…"
          onConfirm={() => {
            void saveSplit();
            return false;
          }}
          onClose={() => {
            const id = splitting.id;
            setSplitId(null);
            focusLater(() => document.getElementById(`${uid}-sp-${id}`));
          }}
          className="fl-txn-dlg"
        >
          <ol className="fl-txn-lines">
            {lines.map((l, i) => (
              <li key={l.key}>
                <span className="fl-txn-line-n" aria-hidden="true">
                  {i + 1}
                </span>
                <label htmlFor={`${uid}-sl-${l.key}-c`} className="fl-sr">
                  Line {i + 1} category
                </label>
                <Select
                  id={`${uid}-sl-${l.key}-c`}
                  value={l.category}
                  data-autofocus={i === 0 || undefined}
                  invalid={!!splitErr && !l.category}
                  onChange={(e) => setLine(l.key, { category: e.target.value })}
                  placeholder="Category"
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                />
                <label htmlFor={`${uid}-sl-${l.key}-a`} className="fl-sr">
                  Line {i + 1} amount
                </label>
                <span className="fl-txn-money">
                  <span aria-hidden="true">$</span>
                  <TextField
                    id={`${uid}-sl-${l.key}-a`}
                    size={40}
                    inputMode="decimal"
                    autoComplete="off"
                    value={l.amount}
                    invalid={!!splitErr && (lineCents[i] === null || lineCents[i]! <= 0)}
                    onChange={(e) => setLine(l.key, { amount: e.target.value })}
                  />
                </span>
                <Button
                  variant="tertiary"
                  size={32}
                  icon="close"
                  iconOnly
                  disabled={lines.length <= 2}
                  aria-label={`Remove line ${i + 1}`}
                  onClick={() => {
                    const next = lines[i + 1] ?? lines[i - 1];
                    setLines((ls) => ls.filter((x) => x.key !== l.key));
                    setSplitErr("");
                    focusLater(() => (next ? document.getElementById(`${uid}-sl-${next.key}-a`) : null));
                  }}
                >
                  Remove line
                </Button>
              </li>
            ))}
          </ol>
          <div className="fl-txn-split-foot">
            <Button
              variant="secondary"
              size={32}
              icon="plus"
              disabled={lines.length >= 6}
              onClick={() => {
                const key = ++lineKey.current;
                setLines((ls) => [...ls, { key, category: "", amount: splitLeft > 0 ? (splitLeft / 100).toFixed(2) : "" }]);
                focusLater(() => document.getElementById(`${uid}-sl-${key}-c`));
              }}
            >
              Add line
            </Button>
            <p className={`fl-txn-left${splitLeft === 0 ? " is-done" : splitLeft < 0 ? " is-over" : ""}`} aria-live="polite">
              {splitLeft === 0 ? "All split" : splitLeft > 0 ? `${money(splitLeft)} left to split` : `${money(-splitLeft)} over`}
            </p>
          </div>
          {splitErr ? (
            <p className="fl-txn-err" role="alert">
              {splitErr}
            </p>
          ) : null}
          {splitting.splits?.length ? (
            <Button variant="tertiary" size={32} icon="refresh" onClick={() => void undoSplit()}>
              Undo split
            </Button>
          ) : null}
        </Modal>
      ) : null}

      <p className="fl-sr" role="status" aria-live="polite">
        {load === "loading" ? "Loading…" : said}
      </p>
    </section>
  );
}

// ── The reference sheet: one household's checking and credit card, this month and the two before. ──

const TODAY = new Date();
/** A date `back` months ago on `day` (kept on or before today in this month, and inside short months). */
const on = (back: number, day: number) => {
  const first = new Date(TODAY.getFullYear(), TODAY.getMonth() - back, 1);
  const last = back === 0 ? TODAY.getDate() : new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return `${ymOf(first)}-${pad(Math.max(1, Math.min(day, last)))}`;
};

// flowcode:sample
const SAMPLE: TransactionsListProps = {
  title: "Transactions",
  minMonth: ymOf(new Date(TODAY.getFullYear(), TODAY.getMonth() - 2, 1)),
  categories: [
    { id: "groceries", name: "Groceries" },
    { id: "dining", name: "Dining out" },
    { id: "transport", name: "Transport" },
    { id: "utilities", name: "Utilities" },
    { id: "shopping", name: "Shopping" },
    { id: "household", name: "Household" },
    { id: "income", name: "Income" },
    { id: "rent", name: "Rent" },
  ],
  transactions: [
    { id: "t1", date: on(0, 1), payee: "Maple Street Apartments", account: "Checking", note: "October rent", amount: -165000, category: "rent" },
    { id: "t2", date: on(0, 1), payee: "Northwind Payroll", account: "Checking", amount: 284250, category: "income" },
    { id: "t3", date: on(0, 3), payee: "Corner Market", account: "Visa ••4821", amount: -6418 },
    { id: "t4", date: on(0, 5), payee: "City Power & Light", account: "Checking", amount: -9312, category: "utilities" },
    { id: "t5", date: on(0, 7), payee: "Uber", account: "Visa ••4821", note: "Airport", amount: -3875, category: "transport" },
    { id: "t6", date: on(0, 9), payee: "Target", account: "Visa ••4821", amount: -11240 },
    { id: "t7", date: on(0, 11), payee: "Blue Bottle Coffee", account: "Visa ••4821", amount: -1250, category: "dining" },
    { id: "t8", date: on(0, 12), payee: "Corner Market", account: "Visa ••4821", amount: -4733, category: "groceries" },
    { id: "t9", date: on(0, 14), payee: "Venmo from Sam", account: "Checking", note: "Concert tickets", amount: 6000 },
    { id: "t10", date: on(0, 15), payee: "Northwind Payroll", account: "Checking", amount: 284250, category: "income" },
    { id: "t11", date: on(0, 16), payee: "Shell", account: "Visa ••4821", amount: -5210, category: "transport" },
    { id: "t12", date: on(0, 18), payee: "Thai Basil", account: "Visa ••4821", note: "Dinner with Jo", amount: -6840 },
    { id: "t13", date: on(0, 19), payee: "Hardware Depot", account: "Visa ••4821", amount: -2899 },
    { id: "t14", date: on(0, 20), payee: "Uber", account: "Visa ••4821", amount: -1450, category: "transport" },
    { id: "t15", date: on(0, 21), payee: "Corner Market", account: "Visa ••4821", amount: -3122, category: "groceries" },
    { id: "s1", date: on(1, 1), payee: "Maple Street Apartments", account: "Checking", note: "September rent", amount: -165000, category: "rent" },
    { id: "s2", date: on(1, 1), payee: "Northwind Payroll", account: "Checking", amount: 284250, category: "income" },
    { id: "s3", date: on(1, 6), payee: "Corner Market", account: "Visa ••4821", amount: -8810, category: "groceries" },
    { id: "s4", date: on(1, 12), payee: "Target", account: "Visa ••4821", amount: -7425, splits: [{ category: "household", amount: 4425 }, { category: "groceries", amount: 3000 }] },
    { id: "s5", date: on(1, 15), payee: "Northwind Payroll", account: "Checking", amount: 284250, category: "income" },
    { id: "s6", date: on(1, 22), payee: "City Power & Light", account: "Checking", amount: -8840, category: "utilities" },
    { id: "a1", date: on(2, 1), payee: "Maple Street Apartments", account: "Checking", amount: -165000, category: "rent" },
    { id: "a2", date: on(2, 15), payee: "Northwind Payroll", account: "Checking", amount: 284250, category: "income" },
  ],
};

export default function TransactionsListPreview() {
  // The sample's oldest month fails to load the first time, to show the error state and Retry.
  const failed = useRef(false);
  return (
    <section className="fl-section fl-section--canvas" aria-label="Transactions">
      <div className="fl-wrap">
        <TransactionsList
          {...SAMPLE}
          onMonthLoad={(ym) =>
            new Promise<void>((done, fail) =>
              window.setTimeout(() => {
                if (ym === SAMPLE.minMonth && !failed.current) {
                  failed.current = true;
                  fail(new Error("offline"));
                } else done();
              }, 500),
            )
          }
          onCategorize={() => new Promise<void>((done) => window.setTimeout(done, 250))}
          onSplit={() => new Promise<void>((done) => window.setTimeout(done, 250))}
        />
      </div>
    </section>
  );
}
