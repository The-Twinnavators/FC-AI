/** @flowcode-library meal-log · Meal log (Charts and data)
 * Catalog ID: b.meal-log (block)
 * Function: A day of eating logged by meal (b.meal-log): calories against a daily target in a ring split by protein, carbs and fat, a bar per macro against its target, meals by time with their foods and subtotals, foods added from a searchable list with a portion and a live calorie preview, removed after a confirm, and earlier days to page back to, with loading, can't-load-with-Retry and nothing-logged states.
 * Use it as: import { MealLog } from "./meal-log"; <MealLog title="Food log" targets={{ kcal: 2100, protein: 130, carbs: 230, fat: 70 }} meals={[{ id: "breakfast", label: "Breakfast", time: "08:00" }]} foods={[{ id, name, serving: { amount: 100, unit: "g"|"ml"|"serving" }, kcal, protein, carbs, fat }]} entries={[{ id, date: "2026-10-21", meal: "breakfast", foodId, amount: 170 }]} load?={async (date) => entries} loading? onAdd?={async (entry) => void} onRemove?={async (id) => void} />
 * Built from: c.progress.ring, c.progress.bar, c.collapsible, c.modal.form, c.text-field.outlined, c.select.outlined, c.chip.filter, c.button.primary, c.button.secondary, c.button.tertiary, c.empty-state
 * Look: A white card: the title with the day ("Today, Oct 21") between previous and next buttons; a summary row with a ring in three colored arcs and the calories eaten counting up in its middle ("1,240 of 2,100 kcal", "860 left"), beside three macro bars that fill; then one block per meal with a fold chevron, its time, a calorie subtotal and an Add food button, and its foods as rows (name, portion, calories, a small macro line and a remove button that asks "Remove?" before it goes). Add food opens a dialog that rises in: a search list, the portion with quick ½, 1 and 2 serving chips, the meal select and a live preview of what the portion adds.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-warning --color-danger --surface-bg --surface-radius --surface-shadow --surface-shadow-overlay --pill-radius --radius-sm --radius-md --space-1 --space-2 --space-3 --space-4 --space-5 --text-xs --text-sm --text-md --text-lg --text-xl --font-display --font-sans --weight-medium --weight-semibold --weight-bold --focus-ring --duration-instant --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger --press-scale
 * Use cases: food diary; calorie counter; nutrition tracker; diet coaching app; meal plan check-in; fitness app nutrition tab
 * Jobs to be done: log what I ate at each meal; see how many calories I have left today; check my protein, carbs and fat against my targets; add a food with the right portion; look back at yesterday
 * Keywords: meal, food log, nutrition, calories, kcal, macros, protein, carbs, fat, diet, portion, daily target
 */
/**
 * Meal log: dates are local "YYYY-MM-DD" strings. A food's numbers are per `serving` (100 g, 250 ml or 1 serving); an
 * entry's `amount` is in that unit, so 170 g of a food listed per 100 g counts 1.7 times. Today's entries come in
 * `entries`; other days are fetched once with `load(date)` (a loading state while it runs, and an error with Retry
 * when it fails). Days after today can't be opened.
 * The ring's arcs are the calories from protein (4 kcal per g), carbs (4) and fat (9) as a share of the target; past
 * the target it turns amber and says by how much. The ring and bars have a text equivalent read by screen readers.
 * Each meal's rows keep their remove buttons as one Tab stop (Up and Down move between foods). Remove asks once in
 * place ("Remove?"); Escape or leaving the button keeps the food. The add dialog is a native modal dialog: Escape
 * closes it and focus goes back to the button that opened it.
 * Arcs and bars fill, totals count up, rows slide in and glide out, meals fold with grid rows (the folded part is
 * inert), the dialog rises in with @starting-style. Everything works and shows with motion off.
 * Adapted from TailAdmin (MIT, Copyright (c) 2023 TailAdmin): its radial chart card and table rows, reshaped into a
 * meal-by-meal food log.
 */
/**
 * How to try it
 * - Watch the ring and bars fill. Press Add food on Lunch, type "rice", pick it, press the 2× chip and Add.
 * - Submit the dialog with nothing picked, or a portion of 0: it says what's missing.
 * - Tab to a food's remove button, move with Up and Down, press it twice to remove.
 * - Press the previous day twice: the preview fails once there; press Retry.
 * - Fold Breakfast away and open it again.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useMemo, useRef, useState), the library's Button
 * ("./buttons-variants"), Icon ("./icons") and TextField ("./text-fields-states"). Nothing else: nothing fetched at
 * run time. The styles are the library's own fl- classes in templates/library/css/r6a-meal-log.css.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { TextField } from "./text-fields-states";

// ── b.meal-log: a day of meals with calories and macros against targets. ──

export type FoodUnit = "g" | "ml" | "serving";
export type Food = { id: string; name: string; serving: { amount: number; unit: FoodUnit }; kcal: number; protein: number; carbs: number; fat: number };
export type MealSlot = { id: string; label: string; time: string };
export type MealEntry = { id: string; date: string; meal: string; foodId: string; amount: number };
export type MealTargets = { kcal: number; protein: number; carbs: number; fat: number };
export type MealLogProps = {
  title: string;
  targets: MealTargets;
  meals: MealSlot[];
  foods: Food[];
  /** Today's entries (others may be in here too). */
  entries: MealEntry[];
  /** Fetches another day's entries. */
  load?: (date: string) => Promise<MealEntry[]>;
  /** How many days back the previous button reaches. */
  daysBack?: number;
  locale?: string;
  loading?: boolean;
  onAdd?: (entry: MealEntry) => Promise<void>;
  onRemove?: (id: string) => Promise<void>;
  className?: string;
};

const quick = async () => undefined;
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const parse = (k: string) => new Date(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, Number(k.slice(8, 10)));
const motionOff = () => typeof window === "undefined" || !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off";
const tokenMs = (name: string, fallback: number) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  return v.endsWith("ms") ? n : v.endsWith("s") ? n * 1000 : n;
};
const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
let seq = 0;
const newId = () => `m${Date.now().toString(36)}${(seq += 1)}`;

type Totals = { kcal: number; protein: number; carbs: number; fat: number };
const ZERO: Totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
const of = (food: Food | undefined, amount: number): Totals => {
  if (!food) return ZERO;
  const k = amount / food.serving.amount;
  return { kcal: food.kcal * k, protein: food.protein * k, carbs: food.carbs * k, fat: food.fat * k };
};
const sum = (list: Totals[]) => list.reduce((t, x) => ({ kcal: t.kcal + x.kcal, protein: t.protein + x.protein, carbs: t.carbs + x.carbs, fat: t.fat + x.fat }), ZERO);
const unitText = (amount: number, unit: FoodUnit) => (unit === "serving" ? `${int.format(amount) === String(amount) ? amount : amount.toFixed(1)} ${amount === 1 ? "serving" : "servings"}` : `${int.format(amount)} ${unit}`);

/** Counts from the last shown value to `value`; at once with motion off, and never left short if frames stall. */
function useCountUp(value: number, ms = 700) {
  const [shown, setShown] = useState(() => (motionOff() ? value : 0));
  const from = useRef(shown);
  useEffect(() => {
    if (motionOff()) {
      from.current = value;
      setShown(value);
      return;
    }
    const a = from.current;
    let start = -1;
    let raf = 0;
    const tick = (t: number) => {
      if (start < 0) start = t;
      const p = Math.min(1, (t - start) / ms);
      const v = a + (value - a) * (1 - Math.pow(1 - p, 3));
      from.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const done = window.setTimeout(() => {
      from.current = value;
      setShown(value);
    }, ms + 500);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(done);
    };
  }, [value, ms]);
  return shown;
}

function Count({ value }: { value: number }) {
  const shown = useCountUp(value);
  return (
    <>
      <span aria-hidden="true">{int.format(Math.round(shown))}</span>
      <span className="fl-sr">{int.format(Math.round(value))}</span>
    </>
  );
}

/** True a moment after `on`, so arcs and bars start empty and fill; at once when motion is off. */
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

/** Focuses the element found once React has drawn it (tries again on the next draw if it isn't there yet). */
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

type DayState = { status: "ready"; entries: MealEntry[] } | { status: "loading" } | { status: "error" };
type Draft = { meal: string; foodId: string; amount: string; query: string; active: number };

const MACROS = [
  { key: "protein" as const, label: "Protein", per: 4, tone: "accent" },
  { key: "carbs" as const, label: "Carbs", per: 4, tone: "success" },
  { key: "fat" as const, label: "Fat", per: 9, tone: "warning" },
];

export function MealLog({ title, targets, meals, foods, entries, load, daysBack = 30, locale = "en-US", loading = false, onAdd = quick, onRemove = quick, className }: MealLogProps) {
  const uid = useId().replace(/:/g, "");
  const focusLater = useFocusLater();
  const today = useMemo(() => new Date(), []);
  const todayKey = ymd(today);
  const [offset, setOffset] = useState(0);
  const [days, setDays] = useState<Record<string, DayState>>(() => {
    const byDay: Record<string, DayState> = { [todayKey]: { status: "ready", entries: [] } };
    for (const e of entries) {
      const d = byDay[e.date];
      byDay[e.date] = { status: "ready", entries: [...(d && d.status === "ready" ? d.entries : []), e] };
    }
    return byDay;
  });
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const [rove, setRove] = useState<Record<string, number>>({});
  const [arming, setArming] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftErr, setDraftErr] = useState<{ food?: string; amount?: string; save?: string }>({});
  const [saving, setSaving] = useState(false);
  const [said, setSaid] = useState("");
  const opener = useRef("");
  const dialog = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const foodMap = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);

  const dateKey = ymd(addDays(today, -offset));
  const day = days[dateKey];
  const fmtDay = useMemo(() => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }), [locale]);
  const fmtLong = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric" }), [locale]);
  const fmtTime = useMemo(() => new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }), [locale]);
  const dayName = offset === 0 ? `Today, ${fmtDay.format(parse(dateKey))}` : offset === 1 ? `Yesterday, ${fmtDay.format(parse(dateKey))}` : fmtLong.format(parse(dateKey));

  const fetchDay = async (key: string) => {
    if (!load) {
      setDays((m) => ({ ...m, [key]: { status: "ready", entries: [] } }));
      return;
    }
    setDays((m) => ({ ...m, [key]: { status: "loading" } }));
    try {
      const got = await load(key);
      setDays((m) => ({ ...m, [key]: { status: "ready", entries: got } }));
      setSaid(`${got.length ? `${got.length} foods logged` : "Nothing logged"} on ${fmtLong.format(parse(key))}.`);
    } catch {
      setDays((m) => ({ ...m, [key]: { status: "error" } }));
      setSaid(`Couldn't load ${fmtLong.format(parse(key))}.`);
    }
  };
  useEffect(() => {
    if (!days[dateKey]) void fetchDay(dateKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

  const list = day && day.status === "ready" ? day.entries : [];
  const ready = !loading && day?.status === "ready";
  const grown = useGrown(ready);
  const total = sum(list.map((e) => of(foodMap.get(e.foodId), e.amount)));
  const left = targets.kcal - total.kcal;
  const over = left < 0;
  useFlip(listRef, list.map((e) => `${e.meal}:${e.id}`).join("|") + `|${dateKey}`);

  // Arcs: calories from each macro as a share of the target, laid end to end.
  let at = 0;
  const arcs = MACROS.map((m) => {
    const share = Math.max(0, (total[m.key] * m.per) / targets.kcal) * 100;
    const len = Math.min(share, Math.max(0, 100 - at));
    const arc = { ...m, len, start: at };
    at += len;
    return arc;
  });
  const ringText = `${int.format(total.kcal)} of ${int.format(targets.kcal)} calories${over ? `, ${int.format(-left)} over` : `, ${int.format(left)} left`}. ${MACROS.map((m) => `${m.label} ${int.format(total[m.key])} of ${targets[m.key]} grams`).join(", ")}.`;

  const goDay = (to: number, from: "prev" | "next") => {
    setOffset(to);
    setArming(null);
    const k = ymd(addDays(today, -to));
    if (days[k]?.status === "ready") setSaid(`${to === 0 ? "Today" : fmtLong.format(parse(k))}.`);
    focusLater(() => {
      const el = document.getElementById(`${uid}-${from}`) as HTMLButtonElement | null;
      return el && !el.disabled ? el : (document.getElementById(`${uid}-${from === "next" ? "prev" : "next"}`) as HTMLButtonElement | null);
    });
  };

  const openAdd = (meal: string, from: string) => {
    opener.current = from;
    setDraftErr({});
    setDraft({ meal, foodId: "", amount: "", query: "", active: 0 });
  };
  useEffect(() => {
    const d = dialog.current;
    if (draft && d && !d.open) {
      d.showModal();
      document.getElementById(`${uid}-q`)?.focus();
    }
  }, [draft, uid]);
  const closeAdd = () => {
    dialog.current?.close();
    setDraft(null);
    const from = opener.current;
    focusLater(() => document.getElementById(from));
  };

  const matches = draft ? foods.filter((f) => f.name.toLowerCase().includes(draft.query.trim().toLowerCase())).slice(0, 8) : [];
  const chosen = draft ? foodMap.get(draft.foodId) : undefined;
  const amountNum = draft && draft.amount !== "" ? Number(draft.amount) : NaN;
  const preview = of(chosen, Number.isFinite(amountNum) && amountNum > 0 ? amountNum : 0);
  const choose = (f: Food) => {
    setDraft((d) => d && { ...d, foodId: f.id, amount: d.foodId === f.id && d.amount ? d.amount : String(f.serving.amount) });
    setDraftErr((e) => ({ ...e, food: undefined }));
  };
  const onSearchKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!draft || !matches.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = (draft.active + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length;
      setDraft({ ...draft, active: n });
    } else if (e.key === "Enter") {
      e.preventDefault();
      const f = matches[Math.min(draft.active, matches.length - 1)];
      if (f) {
        choose(f);
        setSaid(`${f.name} picked.`);
      }
    }
  };

  const saveAdd = async () => {
    if (!draft) return;
    const err: typeof draftErr = {};
    if (!chosen) err.food = "Pick a food from the list.";
    if (!Number.isFinite(amountNum) || amountNum <= 0) err.amount = "Enter how much you had.";
    else if (chosen && amountNum > (chosen.serving.unit === "serving" ? 20 : 5000)) err.amount = chosen.serving.unit === "serving" ? "That's more than 20 servings." : `That's more than 5,000 ${chosen.serving.unit}.`;
    setDraftErr(err);
    if (err.food || err.amount) {
      document.getElementById(`${uid}-${err.food ? "q" : "amt"}`)?.focus();
      return;
    }
    const entry: MealEntry = { id: newId(), date: dateKey, meal: draft.meal, foodId: chosen!.id, amount: amountNum };
    setSaving(true);
    try {
      await onAdd(entry);
      setDays((m) => {
        const d = m[dateKey];
        return { ...m, [dateKey]: { status: "ready", entries: [...(d && d.status === "ready" ? d.entries : []), entry] } };
      });
      setFolded((f) => {
        const n = new Set(f);
        n.delete(draft.meal);
        return n;
      });
      const slot = meals.find((m) => m.id === draft.meal);
      setSaid(`Added ${chosen!.name}, ${unitText(amountNum, chosen!.serving.unit)}, ${int.format(preview.kcal)} kcal to ${slot?.label ?? "the meal"}.`);
      dialog.current?.close();
      setDraft(null);
      opener.current = `${uid}-add-${draft.meal}`;
      focusLater(() => document.getElementById(opener.current));
    } catch {
      setDraftErr({ save: "Couldn't add it. Try again." });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (e: MealEntry, row: number, mealList: MealEntry[]) => {
    const food = foodMap.get(e.foodId);
    if (arming !== e.id) {
      setArming(e.id);
      setSaid(`Press again to remove ${food?.name ?? "this food"}.`);
      return;
    }
    setArming(null);
    const drop = (on: boolean) =>
      setDays((m) => {
        const d = m[e.date];
        if (!d || d.status !== "ready") return m;
        return { ...m, [e.date]: { status: "ready", entries: on ? d.entries.filter((x) => x.id !== e.id) : [...d.entries, e] } };
      });
    drop(true);
    setSaid(`${food?.name ?? "Food"} removed.`);
    const remaining = mealList.length - 1;
    if (remaining > 0) {
      const r = Math.min(row, remaining - 1);
      setRove((m) => ({ ...m, [e.meal]: r }));
      focusLater(() => document.getElementById(`${uid}-rm-${e.meal}-${r}`));
    } else focusLater(() => document.getElementById(`${uid}-add-${e.meal}`));
    try {
      await onRemove(e.id);
    } catch {
      drop(false);
      setSaid(`Couldn't remove ${food?.name ?? "the food"}. It's back in the list.`);
    }
  };

  const onRowKey = (meal: string, count: number, e: ReactKeyboardEvent<HTMLElement>) => {
    const t = e.target as HTMLElement;
    if (t.dataset.row === undefined) return;
    if (e.key === "Escape" && arming) {
      setArming(null);
      setSaid("Kept.");
      return;
    }
    let r = Number(t.dataset.row);
    if (e.key === "ArrowDown") r = Math.min(count - 1, r + 1);
    else if (e.key === "ArrowUp") r = Math.max(0, r - 1);
    else if (e.key === "Home") r = 0;
    else if (e.key === "End") r = count - 1;
    else return;
    e.preventDefault();
    setArming(null);
    setRove((m) => ({ ...m, [meal]: r }));
    document.getElementById(`${uid}-rm-${meal}-${r}`)?.focus();
  };

  return (
    <section className={["fl-meal", className ?? ""].filter(Boolean).join(" ")} data-fl="b.meal-log" aria-labelledby={`${uid}-t`} aria-busy={loading || day?.status === "loading" || undefined}>
      <header className="fl-meal-head">
        <h3 id={`${uid}-t`} className="fl-meal-title">
          {title}
        </h3>
        <div className="fl-meal-day" role="group" aria-label="Day">
          <Button id={`${uid}-prev`} variant="tertiary" size={32} icon="chevron-left" iconOnly disabled={offset >= daysBack || loading} onClick={() => goDay(offset + 1, "prev")}>
            Previous day
          </Button>
          <span className="fl-meal-dayname">
            {dayName}
          </span>
          <Button id={`${uid}-next`} variant="tertiary" size={32} icon="chevron-right" iconOnly disabled={offset === 0 || loading} onClick={() => goDay(offset - 1, "next")}>
            Next day
          </Button>
        </div>
      </header>

      {loading || day?.status === "loading" || !day ? (
        <div className="fl-meal-ghosts" aria-hidden="true">
          <span className="fl-meal-ghost fl-meal-ghost--sum" />
          {[0, 1, 2].map((k) => (
            <span key={k} className="fl-meal-ghost" />
          ))}
        </div>
      ) : day.status === "error" ? (
        <div className="fl-meal-state fl-meal-state--error" role="alert">
          <Icon name="alert" />
          <strong>Couldn't load this day</strong>
          <p>Check your connection and try again.</p>
          <Button id={`${uid}-retry`} variant="secondary" size={40} icon="refresh" onClick={() => (void fetchDay(dateKey), focusLater(() => document.getElementById(`${uid}-prev`)))}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <div className={`fl-meal-sum${over ? " is-over" : ""}`}>
            <figure className="fl-meal-ring" role="img" aria-label={ringText}>
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle className="fl-meal-track" cx="60" cy="60" r="50" pathLength={100} />
                {arcs.map((a) => (
                  <circle
                    key={a.key}
                    className={`fl-meal-arc is-${a.tone}`}
                    cx="60"
                    cy="60"
                    r="50"
                    pathLength={100}
                    style={{ strokeDasharray: `${grown ? a.len : 0} 100`, strokeDashoffset: grown ? -a.start : 0 }}
                  />
                ))}
              </svg>
              <figcaption aria-hidden="true">
                <strong>
                  <Count value={total.kcal} />
                </strong>
                <span>of {int.format(targets.kcal)} kcal</span>
              </figcaption>
            </figure>
            <div className="fl-meal-macros">
              <p className="fl-meal-left">
                {over ? <Icon name="alert" /> : null}
                <strong>
                  <Count value={Math.abs(left)} />
                </strong>{" "}
                {over ? "kcal over target" : "kcal left"}
              </p>
              {MACROS.map((m, i) => {
                const v = total[m.key];
                const t = targets[m.key];
                return (
                  <div key={m.key} className={`fl-meal-macro is-${m.tone}`} style={{ ["--i" as string]: i }}>
                    <span className="fl-meal-macro-name">
                      <span className="fl-meal-swatch" aria-hidden="true" />
                      {m.label}
                    </span>
                    <span className="fl-meal-macro-val">
                      <Count value={v} /> / {t} g
                    </span>
                    <span className="fl-meal-bar" aria-hidden="true">
                      <span style={{ ["--w" as string]: grown ? Math.min(1, v / t) : 0 }} />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {!list.length ? (
            <p className="fl-meal-note">
              <Icon name="info" />
              {offset === 0 ? "Nothing logged yet today. Add your first food to a meal below." : "Nothing was logged this day."}
            </p>
          ) : null}

          <div className="fl-meal-meals" ref={listRef}>
            {meals.map((slot, si) => {
              const items = list.filter((e) => e.meal === slot.id);
              const sub = sum(items.map((e) => of(foodMap.get(e.foodId), e.amount)));
              const open = !folded.has(slot.id);
              const rr = Math.min(rove[slot.id] ?? 0, Math.max(0, items.length - 1));
              return (
                <section key={slot.id} className={`fl-meal-slot${open ? " is-open" : ""}`} aria-labelledby={`${uid}-${slot.id}-h`} style={{ ["--i" as string]: si }}>
                  <div className="fl-meal-slothead">
                    <h4 id={`${uid}-${slot.id}-h`}>
                      <button
                        type="button"
                        className="fl-meal-fold"
                        aria-expanded={open}
                        aria-controls={`${uid}-${slot.id}-b`}
                        onClick={() =>
                          setFolded((f) => {
                            const n = new Set(f);
                            if (n.has(slot.id)) n.delete(slot.id);
                            else n.add(slot.id);
                            return n;
                          })
                        }
                      >
                        <Icon name="chevron-down" />
                        <span className="fl-meal-slotname">{slot.label}</span>
                        <span className="fl-meal-slotmeta">
                          {fmtTime.format(new Date(2000, 0, 1, Number(slot.time.slice(0, 2)), Number(slot.time.slice(3, 5))))} · {items.length} {items.length === 1 ? "food" : "foods"}
                        </span>
                      </button>
                    </h4>
                    <span className="fl-meal-sub">
                      <Count value={sub.kcal} /> kcal
                    </span>
                    {offset === 0 ? (
                      <Button id={`${uid}-add-${slot.id}`} variant="secondary" size={32} icon="plus" onClick={() => openAdd(slot.id, `${uid}-add-${slot.id}`)} aria-label={`Add food to ${slot.label}`}>
                        Add food
                      </Button>
                    ) : null}
                  </div>
                  <div id={`${uid}-${slot.id}-b`} className="fl-meal-body" inert={!open}>
                    <div>
                      {items.length ? (
                        <ul className="fl-meal-items" aria-label={`${slot.label} foods`} onKeyDown={(e) => onRowKey(slot.id, items.length, e)}>
                          {items.map((e, row) => {
                            const f = foodMap.get(e.foodId);
                            const n = of(f, e.amount);
                            const armed = arming === e.id;
                            return (
                              <li key={e.id} data-flip={`${slot.id}:${e.id}`} className="fl-meal-item">
                                <span className="fl-meal-food">
                                  <strong>{f?.name ?? "Unknown food"}</strong>
                                  <span>
                                    {f ? unitText(e.amount, f.serving.unit) : ""} · P {int.format(n.protein)} g · C {int.format(n.carbs)} g · F {int.format(n.fat)} g
                                  </span>
                                </span>
                                <span className="fl-meal-kcal">{int.format(n.kcal)} kcal</span>
                                <button
                                  type="button"
                                  id={`${uid}-rm-${slot.id}-${row}`}
                                  data-row={row}
                                  tabIndex={rr === row ? 0 : -1}
                                  className={`fl-meal-x${armed ? " is-armed" : ""}`}
                                  aria-label={armed ? `Confirm: remove ${f?.name ?? "food"}` : `Remove ${f?.name ?? "food"}`}
                                  onFocus={() => setRove((m) => ({ ...m, [slot.id]: row }))}
                                  onBlur={() => armed && setArming(null)}
                                  onClick={() => void remove(e, row, items)}
                                >
                                  {armed ? <span>Remove?</span> : <Icon name="close" />}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="fl-meal-none">Nothing logged.</p>
                      )}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}

      <dialog
        ref={dialog}
        className="fl-meal-dlg"
        aria-labelledby={`${uid}-dt`}
        onCancel={(e) => {
          e.preventDefault();
          if (!saving) closeAdd();
        }}
      >
        {draft ? (
          <form
            className="fl-meal-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void saveAdd();
            }}
          >
            <div className="fl-meal-dlghead">
              <h4 id={`${uid}-dt`}>Add food</h4>
              <Button variant="tertiary" size={32} icon="close" iconOnly disabled={saving} onClick={closeAdd}>
                Close
              </Button>
            </div>
            <div className="fl-meal-field">
              <label htmlFor={`${uid}-q`}>Food</label>
              <TextField
                id={`${uid}-q`}
                size={40}
                type="search"
                autoComplete="off"
                placeholder="Search foods"
                role="combobox"
                aria-expanded={matches.length > 0}
                aria-controls={`${uid}-lb`}
                aria-activedescendant={matches.length ? `${uid}-o${Math.min(draft.active, matches.length - 1)}` : undefined}
                aria-describedby={draftErr.food ? `${uid}-q-err` : undefined}
                invalid={!!draftErr.food}
                value={draft.query}
                onKeyDown={onSearchKey}
                onChange={(e) => setDraft((d) => d && { ...d, query: e.target.value, active: 0 })}
              />
              <ul id={`${uid}-lb`} role="listbox" aria-label="Foods" className="fl-meal-options">
                {matches.map((f, i) => (
                  <li
                    key={f.id}
                    id={`${uid}-o${i}`}
                    role="option"
                    aria-selected={f.id === draft.foodId}
                    className={i === Math.min(draft.active, matches.length - 1) ? "is-active" : undefined}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      choose(f);
                      setDraft((d) => d && { ...d, active: i });
                    }}
                  >
                    <span>{f.name}</span>
                    <span>
                      {int.format(f.kcal)} kcal / {unitText(f.serving.amount, f.serving.unit)}
                    </span>
                    {f.id === draft.foodId ? <Icon name="check" /> : null}
                  </li>
                ))}
                {!matches.length ? <li className="fl-meal-nomatch">No foods match "{draft.query}".</li> : null}
              </ul>
              {draftErr.food ? (
                <p id={`${uid}-q-err`} className="fl-meal-err">
                  {draftErr.food}
                </p>
              ) : null}
            </div>
            <div className="fl-meal-row2">
              <div className="fl-meal-field">
                <label htmlFor={`${uid}-amt`}>Amount{chosen ? ` (${chosen.serving.unit === "serving" ? "servings" : chosen.serving.unit})` : ""}</label>
                <TextField
                  id={`${uid}-amt`}
                  size={40}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={chosen?.serving.unit === "serving" ? 0.5 : 1}
                  value={draft.amount}
                  disabled={!chosen}
                  invalid={!!draftErr.amount}
                  aria-describedby={draftErr.amount ? `${uid}-amt-err` : undefined}
                  onChange={(e) => (setDraft((d) => d && { ...d, amount: e.target.value }), setDraftErr((x) => ({ ...x, amount: undefined })))}
                />
                {draftErr.amount ? (
                  <p id={`${uid}-amt-err`} className="fl-meal-err">
                    {draftErr.amount}
                  </p>
                ) : null}
              </div>
              <div className="fl-meal-field">
                <label htmlFor={`${uid}-ml`}>Meal</label>
                <span className="fl-meal-select">
                  <select id={`${uid}-ml`} value={draft.meal} onChange={(e) => setDraft((d) => d && { ...d, meal: e.target.value })}>
                    {meals.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </span>
              </div>
            </div>
            {chosen ? (
              <div className="fl-meal-chips" role="group" aria-label="Quick portions">
                {[0.5, 1, 2].map((x) => {
                  const v = chosen.serving.amount * x;
                  return (
                    <button
                      key={x}
                      type="button"
                      className="fl-meal-chip"
                      aria-pressed={Number(draft.amount) === v}
                      onClick={() => (setDraft((d) => d && { ...d, amount: String(v) }), setDraftErr((e) => ({ ...e, amount: undefined })))}
                    >
                      {x === 0.5 ? "½" : x}× · {unitText(v, chosen.serving.unit)}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <div className="fl-meal-preview" aria-live="polite">
              <span>Adds</span>
              <strong>
                <Count value={preview.kcal} /> kcal
              </strong>
              <span>
                P {int.format(preview.protein)} g · C {int.format(preview.carbs)} g · F {int.format(preview.fat)} g
              </span>
            </div>
            {draftErr.save ? (
              <p className="fl-meal-err" role="alert">
                {draftErr.save}
              </p>
            ) : null}
            <div className="fl-meal-dlgfoot">
              <Button variant="secondary" size={40} disabled={saving} onClick={closeAdd}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size={40} icon="plus" busy={saving}>
                {saving ? "Adding…" : "Add"}
              </Button>
            </div>
          </form>
        ) : null}
      </dialog>

      <p className="fl-sr" role="status" aria-live="polite">
        {loading ? "Loading food log…" : said}
      </p>
    </section>
  );
}

// ── The reference sheet: today half logged, yesterday and the day before fetched on demand. ──

const T = new Date();
const dayKey = (back: number) => ymd(addDays(T, -back));

// flowcode:sample
const SAMPLE: MealLogProps = {
  title: "Food log",
  targets: { kcal: 2100, protein: 130, carbs: 230, fat: 70 },
  meals: [
    { id: "breakfast", label: "Breakfast", time: "07:45" },
    { id: "lunch", label: "Lunch", time: "12:30" },
    { id: "snacks", label: "Snacks", time: "15:30" },
    { id: "dinner", label: "Dinner", time: "19:00" },
  ],
  foods: [
    { id: "oats", name: "Rolled oats", serving: { amount: 40, unit: "g" }, kcal: 150, protein: 5, carbs: 27, fat: 3 },
    { id: "yogurt", name: "Greek yogurt, plain 2%", serving: { amount: 170, unit: "g" }, kcal: 150, protein: 20, carbs: 7, fat: 4 },
    { id: "banana", name: "Banana, medium", serving: { amount: 1, unit: "serving" }, kcal: 105, protein: 1, carbs: 27, fat: 0 },
    { id: "coffee", name: "Coffee with milk", serving: { amount: 250, unit: "ml" }, kcal: 45, protein: 3, carbs: 4, fat: 2 },
    { id: "chicken", name: "Chicken breast, grilled", serving: { amount: 100, unit: "g" }, kcal: 165, protein: 31, carbs: 0, fat: 4 },
    { id: "rice", name: "Brown rice, cooked", serving: { amount: 100, unit: "g" }, kcal: 123, protein: 3, carbs: 26, fat: 1 },
    { id: "salad", name: "Mixed salad with olive oil", serving: { amount: 1, unit: "serving" }, kcal: 140, protein: 2, carbs: 6, fat: 12 },
    { id: "almonds", name: "Almonds", serving: { amount: 28, unit: "g" }, kcal: 165, protein: 6, carbs: 6, fat: 14 },
    { id: "apple", name: "Apple, medium", serving: { amount: 1, unit: "serving" }, kcal: 95, protein: 0, carbs: 25, fat: 0 },
    { id: "salmon", name: "Salmon fillet, baked", serving: { amount: 100, unit: "g" }, kcal: 206, protein: 22, carbs: 0, fat: 12 },
    { id: "potato", name: "Sweet potato, roasted", serving: { amount: 100, unit: "g" }, kcal: 90, protein: 2, carbs: 21, fat: 0 },
    { id: "eggs", name: "Eggs, scrambled", serving: { amount: 1, unit: "serving" }, kcal: 180, protein: 12, carbs: 2, fat: 14 },
  ],
  entries: [
    { id: "t1", date: dayKey(0), meal: "breakfast", foodId: "oats", amount: 60 },
    { id: "t2", date: dayKey(0), meal: "breakfast", foodId: "yogurt", amount: 170 },
    { id: "t3", date: dayKey(0), meal: "breakfast", foodId: "coffee", amount: 250 },
    { id: "t4", date: dayKey(0), meal: "lunch", foodId: "chicken", amount: 150 },
    { id: "t5", date: dayKey(0), meal: "lunch", foodId: "salad", amount: 1 },
    { id: "t6", date: dayKey(0), meal: "snacks", foodId: "apple", amount: 1 },
  ],
};

const YESTERDAY: MealEntry[] = [
  { id: "y1", date: dayKey(1), meal: "breakfast", foodId: "eggs", amount: 1 },
  { id: "y2", date: dayKey(1), meal: "breakfast", foodId: "coffee", amount: 250 },
  { id: "y3", date: dayKey(1), meal: "lunch", foodId: "rice", amount: 200 },
  { id: "y4", date: dayKey(1), meal: "lunch", foodId: "chicken", amount: 150 },
  { id: "y5", date: dayKey(1), meal: "snacks", foodId: "almonds", amount: 56 },
  { id: "y6", date: dayKey(1), meal: "dinner", foodId: "salmon", amount: 180 },
  { id: "y7", date: dayKey(1), meal: "dinner", foodId: "potato", amount: 250 },
  { id: "y8", date: dayKey(1), meal: "dinner", foodId: "salad", amount: 1 },
];

export default function MealLogPreview() {
  const [loading, setLoading] = useState(true);
  const failed = useRef(false);
  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 600);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <section className="fl-section fl-section--canvas" aria-label="Meal log">
      <div className="fl-wrap">
        <MealLog
          {...SAMPLE}
          loading={loading}
          load={(date) =>
            new Promise<MealEntry[]>((ok, fail) =>
              window.setTimeout(() => {
                // The day before yesterday fails once, to show the error state and Retry.
                if (date === dayKey(2) && !failed.current) {
                  failed.current = true;
                  fail(new Error("offline"));
                } else ok(date === dayKey(1) ? YESTERDAY : []);
              }, 600),
            )
          }
          onAdd={() => new Promise<void>((ok) => window.setTimeout(ok, 300))}
          onRemove={() => new Promise<void>((ok) => window.setTimeout(ok, 200))}
        />
      </div>
    </section>
  );
}
