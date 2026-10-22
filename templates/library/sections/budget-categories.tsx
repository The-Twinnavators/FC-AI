/** @flowcode-library budget-categories · Budget by category (Charts and data)
 * Catalog ID: b.budget-categories (block)
 * Function: A month's budget split into categories (b.budget-categories): what is budgeted, spent and left in all, about how much a day is left to spend, one bar per category with a mark for where spending should be by today, an overspend warning that names each category over its limit, limits edited in place, categories added and removed (after a confirm), and a sort and an "Over only" filter.
 * Use it as: import { BudgetCategories } from "./budget-categories"; <BudgetCategories title="October budget" day={21} daysInMonth={31} categories={[{ id, name, limit(cents), spent(cents) }]} currency?="USD" locale? loading? error? onRetry? onLimitChange?={async (id, limit) => ...} onAdd?={async (category) => ...} onRemove?={async (id) => ...} />
 * Built from: c.segmented.segmented, c.badge.status, c.text-field.outlined, c.modal.form, c.modal.danger, c.button.primary, c.button.secondary, c.button.tertiary, c.empty-state
 * Look: A white card: the month's title and an Add category button, a sunken summary panel with "Left to spend" as a big figure, budgeted and spent beside it, one straight bar and the daily allowance, a warning strip naming the categories over budget with Raise limit buttons, a sort control and an Over only toggle, then one row per category with its name, "$312 of $400", a straight bar (accent, amber near the limit, red over it) with a thin upright mark for today, what's left or how far over, and quiet Edit and Remove buttons.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-success --color-warning --color-danger --surface-radius --radius-sm --radius-md --space-1 --space-2 --space-3 --space-4 --space-5 --text-xs --text-sm --text-md --text-lg --text-xl --weight-semibold --weight-bold --font-sans --font-display --focus-ring --duration-fast --duration-base --duration-slow --ease-out --easing --enter-distance --stagger
 * Use cases: monthly budget; personal finance app; household budget; envelope budgeting; team or project spending limits; student budget; travel budget
 * Jobs to be done: see how much I can still spend this month; find the category I'm overspending in; raise or lower a limit; add a category I forgot; know what I can spend a day
 * Keywords: budget, categories, spending, limits, envelopes, overspend, left to spend, personal finance, money, progress bars
 */
/**
 * Budget by category: money is whole cents throughout. The summary adds the limits and the spending; "Left to spend"
 * is what is left under the limits (over-spending in one category is not netted against another) and the daily
 * figure spreads it over the days left in the month. Each bar is a meter: accent while under 90% of its limit, amber
 * from 90%, red once over; the upright mark is where spending would be if it went evenly through the month.
 * The warning strip names every category over its limit; Raise limit opens that row's editor.
 * Edit limit turns the row into a money field: Enter or Save keeps it (onLimitChange may return a promise; the row
 * waits and puts the old limit back if it fails), Escape or Cancel leaves it, and focus goes back to the Edit button.
 * A limit under what's already spent is allowed but flagged. Add category asks for a name (not used yet) and a limit.
 * Remove asks first. Edit and Remove are one Tab stop: arrow keys move between rows (Up and Down) and between a row's
 * two buttons (Left and Right); Home and End jump to the first and last row.
 * Bars grow in when the card first draws and slide when a limit changes; the totals count up; rows glide on re-sort.
 * Adapted from TailAdmin (MIT, Copyright (c) 2023 TailAdmin): its progress-by-category card (a label, a figure and a
 * bar per row), reshaped into an editable monthly budget.
 */
/**
 * How to try it
 * - Watch the gray rows, then the bars grow. The warning strip names Dining out and Shopping.
 * - Press Raise limit beside Dining out: the row opens with its field focused. Type 500 and press Enter.
 * - Press Edit on Groceries and type 6000: the save fails (the sample refuses limits over $5,000) and the old limit is back.
 * - Press Tab to reach a row's Edit button, then use the arrow keys, Home and End.
 * - Pick Least left and Over only. Press Add category, submit it empty, then add "Gifts" with 150.
 * - Press Remove on a row: it asks first.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useMemo, useRef, useState), the library's Segmented
 * ("./segmented-control"), Badge ("./badges-status"), TextField ("./text-fields-states"), Modal ("./modals-dialogs"),
 * Button ("./buttons-variants") and its icons ("./icons"). Nothing else: no chart package, nothing fetched at run
 * time. The styles are the library's own fl- classes in templates/library/css/r5b-budget.css.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { Segmented } from "./segmented-control";
import { TextField } from "./text-fields-states";

// ── b.budget-categories: a month's budget by category, with limits edited in place and overspend warnings. ──

export type BudgetCategory = { id: string; name: string; /** cents */ limit: number; /** cents */ spent: number };
export type BudgetCategoriesProps = {
  title: string;
  /** Today's day of the month and the month's length, for the pace mark and the daily allowance. */
  day: number;
  daysInMonth: number;
  categories: BudgetCategory[];
  currency?: string;
  locale?: string;
  loading?: boolean;
  /** A load failure: shown with a Retry button in place of the rows. */
  error?: string;
  onRetry?: () => void;
  /** Saves a new limit in cents; a rejected promise puts the old one back. */
  onLimitChange?: (id: string, limit: number) => void | Promise<void>;
  onAdd?: (category: BudgetCategory) => void | Promise<void>;
  onRemove?: (id: string) => void | Promise<void>;
  className?: string;
};

type Sort = "spent" | "left" | "name";
type Tone = "ok" | "near" | "over";

const MAX_LIMIT = 100_000_000; // $1,000,000

const motionOff = () =>
  typeof window === "undefined" || !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off";

function tokenMs(name: string, fallback: number) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  return raw.endsWith("ms") ? n : raw.endsWith("s") ? n * 1000 : n;
}

/** "$1,234.5" or "1234.50" to cents; null when it isn't a plain amount. */
function parseCents(raw: string): number | null {
  const s = raw.replace(/[$,\s]/g, "");
  if (!/^(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

/** True a moment after `on` turns true, so freshly drawn bars start empty and grow; at once when motion is off. */
function useGrown(on: boolean) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    if (!on) return setGrown(false);
    if (motionOff()) return setGrown(true);
    const t = window.setTimeout(() => setGrown(true), 40);
    return () => window.clearTimeout(t);
  }, [on]);
  return grown;
}

/** A number that counts toward its target with an ease-out curve; jumps when motion is off. */
function useTween(target: number, ms = 700) {
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

/** FLIP: rows marked data-flip glide from where they were to where they are whenever `key` changes. */
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
        if (dy) n.animate([{ translate: `0 ${dy}px` }, { translate: "0 0" }], { duration: tokenMs("--duration-slow", 320), easing: "cubic-bezier(0.2, 0, 0, 1)" });
      }
    }
    last.current = now;
  }, [key, box]);
}

/** Focuses an element once React has drawn it. */
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

/**
 * Roving focus over repeated row actions: the list is one Tab stop; Up and Down move between rows, Left and Right
 * between a row's actions, Home and End jump to the first and last row.
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

const quick = async () => undefined;

export function BudgetCategories({
  title,
  day,
  daysInMonth,
  categories: given,
  currency = "USD",
  locale = "en-US",
  loading = false,
  error,
  onRetry,
  onLimitChange = quick,
  onAdd = quick,
  onRemove = quick,
  className,
}: BudgetCategoriesProps) {
  const uid = useId().replace(/:/g, "");
  const focusLater = useFocusLater();
  const [cats, setCats] = useState(given);
  const [sort, setSort] = useState<Sort>("spent");
  const [overOnly, setOverOnly] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editErr, setEditErr] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [rowErr, setRowErr] = useState<{ id: string; text: string } | null>(null);
  const [said, setSaid] = useState("");
  const [adding, setAdding] = useState(false);
  const [add, setAdd] = useState({ name: "", limit: "" });
  const [addErr, setAddErr] = useState<{ name?: string; limit?: string }>({});
  const [addBusy, setAddBusy] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const list = useRef<HTMLUListElement>(null);
  const draw = useGrown(!loading && !error);

  const mf = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency }), [locale, currency]);
  const mf0 = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }), [locale, currency]);
  const money = (c: number) => mf.format(c / 100);
  const short = (c: number) => (c % 100 === 0 ? mf0.format(c / 100) : mf.format(c / 100));

  const daysLeft = Math.max(1, daysInMonth - day + 1);
  const pace = Math.min(1, Math.max(0, day / daysInMonth));
  const budgeted = cats.reduce((n, c) => n + c.limit, 0);
  const spent = cats.reduce((n, c) => n + c.spent, 0);
  const left = cats.reduce((n, c) => n + Math.max(0, c.limit - c.spent), 0);
  const perDay = Math.floor(left / daysLeft);
  const over = cats.filter((c) => c.spent > c.limit);
  const toneOf = (c: BudgetCategory): Tone => (c.spent > c.limit ? "over" : c.limit > 0 && c.spent / c.limit >= 0.9 ? "near" : "ok");

  const shown = cats
    .filter((c) => !overOnly || c.spent > c.limit)
    .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : sort === "spent" ? b.spent - a.spent : a.limit - a.spent - (b.limit - b.spent)));
  const ids = shown.map((c) => c.id);
  useFlip(list, ids.join("|"));
  const rove = useRoving(ids);

  const startEdit = (c: BudgetCategory) => {
    setEditing(c.id);
    setDraft((c.limit / 100).toFixed(2));
    setEditErr("");
    setRowErr(null);
    focusLater(() => document.getElementById(`${uid}-lim-${c.id}`));
  };
  const stopEdit = (id: string) => {
    setEditing(null);
    setEditErr("");
    focusLater(() => document.getElementById(`${uid}-edit-${id}`));
  };
  const saveLimit = async (e: FormEvent, c: BudgetCategory) => {
    e.preventDefault();
    const n = parseCents(draft);
    if (n === null || n <= 0) return setEditErr("Enter an amount above zero, like 250 or 250.00."), document.getElementById(`${uid}-lim-${c.id}`)?.focus();
    if (n > MAX_LIMIT) return setEditErr(`Keep it under ${short(MAX_LIMIT)}.`), document.getElementById(`${uid}-lim-${c.id}`)?.focus();
    const old = c.limit;
    setCats((all) => all.map((x) => (x.id === c.id ? { ...x, limit: n } : x)));
    stopEdit(c.id);
    setSaving(c.id);
    setSaid(`Saving ${c.name} limit…`);
    try {
      await onLimitChange(c.id, n);
      setSaid(`${c.name} limit set to ${money(n)}.${c.spent > n ? ` It's ${money(c.spent - n)} over.` : ""}`);
    } catch {
      setCats((all) => all.map((x) => (x.id === c.id ? { ...x, limit: old } : x)));
      const text = `Couldn't save the ${c.name} limit. It's back to ${money(old)}.`;
      setRowErr({ id: c.id, text });
      setSaid(text);
    } finally {
      setSaving(null);
    }
  };

  const submitAdd = async () => {
    const e: typeof addErr = {};
    const name = add.name.trim();
    const n = parseCents(add.limit);
    if (!name) e.name = "Enter a name.";
    else if (cats.some((c) => c.name.toLowerCase() === name.toLowerCase())) e.name = `There's already a ${name} category.`;
    if (n === null || n <= 0) e.limit = "Enter a monthly limit above zero.";
    else if (n > MAX_LIMIT) e.limit = `Keep it under ${short(MAX_LIMIT)}.`;
    setAddErr(e);
    if (e.name || e.limit) {
      document.getElementById(`${uid}-add-${e.name ? "name" : "limit"}`)?.focus();
      return;
    }
    const cat: BudgetCategory = { id: `cat-${Date.now()}`, name, limit: n!, spent: 0 };
    setAddBusy(true);
    try {
      await onAdd(cat);
      setCats((all) => [...all, cat]);
      setAdding(false);
      setAdd({ name: "", limit: "" });
      setOverOnly(false);
      setSaid(`${name} added with a ${money(cat.limit)} limit.`);
      focusLater(() => document.getElementById(`${uid}-edit-${cat.id}`));
    } catch {
      setAddErr({ name: "Couldn't add it. Try again." });
    } finally {
      setAddBusy(false);
    }
  };

  const removing = removeId ? cats.find((c) => c.id === removeId) : undefined;
  const doRemove = async () => {
    if (!removing) return;
    const at = ids.indexOf(removing.id);
    const next = ids[at + 1] ?? ids[at - 1];
    setRemoveBusy(true);
    try {
      await onRemove(removing.id);
      setCats((all) => all.filter((c) => c.id !== removing.id));
      setRemoveId(null);
      setSaid(`${removing.name} removed.`);
      focusLater(() => (next ? document.getElementById(`${uid}-edit-${next}`) : document.getElementById(`${uid}-add`)));
    } catch {
      setSaid(`Couldn't remove ${removing.name}. Try again.`);
    } finally {
      setRemoveBusy(false);
    }
  };

  const raise = (c: BudgetCategory) => {
    setOverOnly(false);
    startEdit(c);
    setDraft((Math.ceil(c.spent / 1000) * 10).toFixed(2));
  };

  const summaryTone: Tone = budgeted && spent > budgeted ? "over" : budgeted && spent / budgeted >= 0.9 ? "near" : "ok";

  return (
    <section className={["fl-bdg", className ?? ""].filter(Boolean).join(" ")} data-fl="b.budget-categories" aria-labelledby={`${uid}-t`} aria-busy={loading || undefined}>
      <header className="fl-bdg-head">
        <div>
          <h3 id={`${uid}-t`} className="fl-bdg-title">
            {title}
          </h3>
          <p className="fl-bdg-sub">
            Day {day} of {daysInMonth} · {daysLeft} {daysLeft === 1 ? "day" : "days"} left
          </p>
        </div>
        <Button id={`${uid}-add`} variant="secondary" size={40} icon="plus" disabled={loading || !!error} onClick={() => (setAddErr({}), setAdding(true))}>
          Add category
        </Button>
      </header>

      {loading ? (
        <div className="fl-bdg-ghosts" aria-hidden="true">
          <span className="fl-bdg-ghost fl-bdg-ghost--big" />
          {[0, 1, 2, 3].map((k) => (
            <span key={k} className="fl-bdg-ghost" />
          ))}
        </div>
      ) : error ? (
        <div className="fl-bdg-state" role="alert">
          <Icon name="alert" />
          <strong>Couldn't load your budget</strong>
          <p>{error}</p>
          {onRetry ? (
            <Button variant="secondary" size={40} icon="refresh" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          {cats.length ? (
            <div className="fl-bdg-sum">
              <div className="fl-bdg-left">
                <span>Left to spend</span>
                <strong>
                  <Count cents={left} fmt={money} />
                </strong>
                <span className="fl-bdg-daily">{left > 0 ? `About ${money(perDay)} a day` : "Nothing left this month"}</span>
              </div>
              <dl className="fl-bdg-figs">
                <div>
                  <dt>Budgeted</dt>
                  <dd>
                    <Count cents={budgeted} fmt={money} />
                  </dd>
                </div>
                <div>
                  <dt>Spent</dt>
                  <dd>
                    <Count cents={spent} fmt={money} />
                  </dd>
                </div>
              </dl>
              <div
                className="fl-bdg-track fl-bdg-track--sum"
                role="meter"
                aria-label="Spent of budget"
                aria-valuemin={0}
                aria-valuemax={Math.max(budgeted, spent)}
                aria-valuenow={spent}
                aria-valuetext={`${money(spent)} of ${money(budgeted)} spent, ${budgeted ? Math.round((spent / budgeted) * 100) : 0}%. ${money(left)} left.`}
              >
                <span className={`fl-bdg-fill is-${summaryTone}`} style={{ ["--fl-bdg-w" as string]: draw && budgeted ? Math.min(1, spent / budgeted) : 0 }} />
                <span className="fl-bdg-pace" style={{ left: `${pace * 100}%` }} />
              </div>
            </div>
          ) : null}

          {over.length ? (
            <div className="fl-bdg-warn" role="group" aria-label="Over budget">
              <Icon name="alert" />
              <div>
                <strong>
                  {over.length} {over.length === 1 ? "category is" : "categories are"} over budget
                </strong>
                <ul>
                  {over.map((c) => (
                    <li key={c.id}>
                      <span>
                        {c.name} by {money(c.spent - c.limit)}
                      </span>
                      <button type="button" className="fl-bdg-link" onClick={() => raise(c)}>
                        Raise limit<span className="fl-sr"> for {c.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {cats.length ? (
            <div className="fl-bdg-tools">
              <Segmented
                label="Order"
                size="sm"
                value={sort}
                onChange={(v) => setSort(v as Sort)}
                options={[
                  { value: "spent", label: "Most spent" },
                  { value: "left", label: "Least left" },
                  { value: "name", label: "A–Z" },
                ]}
              />
              <Button variant="tertiary" size={32} icon="filter" pressed={overOnly} disabled={!over.length && !overOnly} onClick={() => setOverOnly((v) => !v)}>
                Over only
              </Button>
            </div>
          ) : null}

          {!cats.length ? (
            <div className="fl-bdg-state" data-fl="c.empty-state">
              <Icon name="layers" />
              <strong>No categories yet</strong>
              <p>Add one for each kind of spending, with a monthly limit.</p>
              <Button variant="primary" size={40} icon="plus" onClick={() => (setAddErr({}), setAdding(true))}>
                Add category
              </Button>
            </div>
          ) : !shown.length ? (
            <div className="fl-bdg-state">
              <Icon name="check" />
              <strong>Nothing over budget</strong>
              <Button variant="secondary" size={40} onClick={() => setOverOnly(false)}>
                Show all
              </Button>
            </div>
          ) : (
            <ul ref={list} className="fl-bdg-list" aria-label="Categories" onKeyDown={rove.onKeyDown}>
              {shown.map((c, k) => {
                const tone = toneOf(c);
                const ratio = c.limit > 0 ? c.spent / c.limit : 1;
                const rest = c.limit - c.spent;
                const isEditing = editing === c.id;
                const errId = `${uid}-lim-${c.id}-err`;
                return (
                  <li key={c.id} data-flip={c.id} className={`fl-bdg-row is-${tone}`} style={{ ["--i" as string]: Math.min(k, 8) }}>
                    <div className="fl-bdg-row-head">
                      <span className="fl-bdg-name">{c.name}</span>
                      {tone === "over" ? (
                        <Badge tone="danger" led>
                          Over
                        </Badge>
                      ) : tone === "near" ? (
                        <Badge tone="warning" led>
                          Near limit
                        </Badge>
                      ) : null}
                      <span className="fl-bdg-fig">
                        <strong>{short(c.spent)}</strong> of {short(c.limit)}
                      </span>
                    </div>
                    <div
                      className="fl-bdg-track"
                      role="meter"
                      aria-label={c.name}
                      aria-valuemin={0}
                      aria-valuemax={Math.max(c.limit, c.spent)}
                      aria-valuenow={c.spent}
                      aria-valuetext={`${money(c.spent)} of ${money(c.limit)}, ${Math.round(ratio * 100)}%. ${rest >= 0 ? `${money(rest)} left` : `${money(-rest)} over`}.`}
                    >
                      <span className={`fl-bdg-fill is-${tone}`} style={{ ["--fl-bdg-w" as string]: draw ? Math.min(1, ratio) : 0 }} />
                      <span className="fl-bdg-pace" style={{ left: `${pace * 100}%` }} title="Where spending would be today at an even pace" />
                    </div>
                    {isEditing ? (
                      <form className="fl-bdg-edit" onSubmit={(e) => void saveLimit(e, c)} noValidate>
                        <label htmlFor={`${uid}-lim-${c.id}`} className="fl-bdg-label">
                          Monthly limit
                        </label>
                        <span className="fl-bdg-money">
                          <span aria-hidden="true">$</span>
                          <TextField
                            id={`${uid}-lim-${c.id}`}
                            size={32}
                            inputMode="decimal"
                            autoComplete="off"
                            value={draft}
                            invalid={!!editErr}
                            aria-describedby={editErr ? errId : `${errId}-n`}
                            onChange={(e) => (setDraft(e.target.value), setEditErr(""))}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                e.preventDefault();
                                stopEdit(c.id);
                              }
                            }}
                          />
                        </span>
                        <Button type="submit" variant="primary" size={32}>
                          Save
                        </Button>
                        <Button variant="tertiary" size={32} onClick={() => stopEdit(c.id)}>
                          Cancel
                        </Button>
                        {editErr ? (
                          <p id={errId} className="fl-bdg-err">
                            {editErr}
                          </p>
                        ) : (
                          <p id={`${errId}-n`} className="fl-bdg-note">
                            {(() => {
                              const n = parseCents(draft);
                              return n !== null && n > 0 && n < c.spent ? `That's under the ${money(c.spent)} already spent.` : `${money(c.spent)} spent so far.`;
                            })()}
                          </p>
                        )}
                      </form>
                    ) : (
                      <div className="fl-bdg-foot">
                        <span className={`fl-bdg-rest is-${tone}`}>
                          {saving === c.id ? "Saving…" : rest >= 0 ? `${money(rest)} left · about ${money(Math.floor(rest / daysLeft))} a day` : `Over by ${money(-rest)}`}
                        </span>
                        <span className="fl-bdg-acts">
                          <Button {...rove.item(c.id, 0)} id={`${uid}-edit-${c.id}`} variant="tertiary" size={32} icon="pencil" aria-label={`Edit limit: ${c.name}`} onClick={() => startEdit(c)}>
                            Edit
                          </Button>
                          <Button {...rove.item(c.id, 1)} variant="tertiary" size={32} icon="trash" iconOnly aria-label={`Remove ${c.name}`} onClick={() => setRemoveId(c.id)}>
                            Remove
                          </Button>
                        </span>
                      </div>
                    )}
                    {rowErr?.id === c.id && !isEditing ? (
                      <p className="fl-bdg-err" role="alert">
                        {rowErr.text}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {adding ? (
        <Modal
          variant="form"
          title="Add a category"
          description="Spending in it counts against its monthly limit."
          confirmLabel="Add category"
          busy={addBusy}
          busyLabel="Adding…"
          onConfirm={() => {
            void submitAdd();
            return false;
          }}
          onClose={() => setAdding(false)}
        >
          <div className="fl-bdg-form">
            <div className="fl-bdg-field">
              <label htmlFor={`${uid}-add-name`}>Name</label>
              <TextField
                id={`${uid}-add-name`}
                size={44}
                autoComplete="off"
                value={add.name}
                maxLength={40}
                data-autofocus
                invalid={!!addErr.name}
                aria-describedby={addErr.name ? `${uid}-add-name-err` : undefined}
                onChange={(e) => (setAdd((a) => ({ ...a, name: e.target.value })), setAddErr((x) => ({ ...x, name: undefined })))}
              />
              {addErr.name ? (
                <p id={`${uid}-add-name-err`} className="fl-bdg-err">
                  {addErr.name}
                </p>
              ) : null}
            </div>
            <div className="fl-bdg-field">
              <label htmlFor={`${uid}-add-limit`}>Monthly limit</label>
              <span className="fl-bdg-money">
                <span aria-hidden="true">$</span>
                <TextField
                  id={`${uid}-add-limit`}
                  size={44}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  value={add.limit}
                  invalid={!!addErr.limit}
                  aria-describedby={addErr.limit ? `${uid}-add-limit-err` : undefined}
                  onChange={(e) => (setAdd((a) => ({ ...a, limit: e.target.value })), setAddErr((x) => ({ ...x, limit: undefined })))}
                />
              </span>
              {addErr.limit ? (
                <p id={`${uid}-add-limit-err`} className="fl-bdg-err">
                  {addErr.limit}
                </p>
              ) : null}
            </div>
          </div>
        </Modal>
      ) : null}

      {removing ? (
        <Modal
          variant="danger"
          icon="trash"
          title={`Remove ${removing.name}?`}
          description={`Its ${money(removing.limit)} limit comes off this month's budget.${removing.spent ? ` The ${money(removing.spent)} spent stays in your transactions.` : ""}`}
          confirmLabel="Remove"
          cancelLabel="Keep"
          busy={removeBusy}
          busyLabel="Removing…"
          onConfirm={() => {
            void doRemove();
            return false;
          }}
          onClose={() => setRemoveId(null)}
        />
      ) : null}

      <p className="fl-sr" role="status" aria-live="polite">
        {loading ? "Loading budget…" : said}
      </p>
    </section>
  );
}

// ── The reference sheet: one person's October budget. ──

const now = new Date();
const DAYS_IN_MONTH = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
const MONTH = now.toLocaleDateString("en-US", { month: "long" });

// flowcode:sample
const SAMPLE = {
  eyebrow: "Budget",
  title: "Where the money goes",
  lede: "Each bar's upright mark is where spending would be today at an even pace.",
  cardTitle: `${MONTH} budget`,
  day: now.getDate(),
  daysInMonth: DAYS_IN_MONTH,
  categories: [
    { id: "groceries", name: "Groceries", limit: 60000, spent: 41236 },
    { id: "dining", name: "Dining out", limit: 25000, spent: 29210 },
    { id: "transport", name: "Transport", limit: 18000, spent: 9540 },
    { id: "utilities", name: "Utilities", limit: 22000, spent: 20385 },
    { id: "shopping", name: "Shopping", limit: 15000, spent: 16500 },
    { id: "fun", name: "Entertainment", limit: 10000, spent: 4299 },
    { id: "health", name: "Health", limit: 8000, spent: 2500 },
  ] as BudgetCategory[],
};

export default function BudgetCategoriesPreview() {
  const d = SAMPLE;
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 700);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <section className="fl-section fl-section--canvas" aria-labelledby="budget-categories-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="budget-categories-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <BudgetCategories
          title={d.cardTitle}
          day={d.day}
          daysInMonth={d.daysInMonth}
          categories={d.categories}
          loading={loading}
          // The sample's server refuses limits over $5,000, to show a failed save.
          onLimitChange={(_id, limit) => new Promise<void>((done, fail) => window.setTimeout(() => (limit > 500000 ? fail(new Error("limit")) : done()), 350))}
          onAdd={() => new Promise<void>((done) => window.setTimeout(done, 300))}
          onRemove={() => new Promise<void>((done) => window.setTimeout(done, 300))}
        />
      </div>
    </section>
  );
}
