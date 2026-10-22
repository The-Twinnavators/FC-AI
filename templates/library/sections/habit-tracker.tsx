/** @flowcode-library habit-tracker · Habit tracker (Charts and data)
 * Catalog ID: b.habit-tracker (block)
 * Function: A weekly habit tracker (b.habit-tracker): a grid of habits by day where each day is ticked or unticked, how many are done today, each habit's current streak and its count against a days-per-week goal, earlier weeks to look back at, and habits added, edited (name, goal, color, a daily reminder with its time) and deleted after a confirm.
 * Use it as: import { HabitTracker } from "./habit-tracker"; <HabitTracker title="My habits" habits={[{ id, name, target: 5, tone?: "accent"|"secondary"|"success"|"warning", reminder?: { on: true, time: "07:30" }, done: ["2026-10-20"] }]} weeksBack?={12} locale? loading? onToggle?={async (habitId, date, done) => ...} onSave?={async (habit) => ...} onRemove?={async (id) => ...} />
 * Built from: c.choice-group.swatch, c.quantity, c.switch, c.text-field.outlined, c.modal.form, c.modal.danger, c.button.primary, c.button.secondary, c.button.tertiary, c.empty-state
 * Look: A white card: the title with the week ("Oct 19 – 25") between previous and next buttons and an Add habit button, a sunken strip with "3 of 5 done today" over one straight bar, then a grid: a header row of weekday initials and dates (today circled), and one row per habit with its color dot, name, a flame-like bolt with "12-day streak" and a bell with the reminder time, seven round day buttons that fill with the habit's color when done, a small ring with "4/5" for the week and a pencil button.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-secondary --color-success --color-warning --color-danger --surface-radius --pill-radius --radius-sm --radius-md --space-1 --space-2 --space-3 --space-4 --space-5 --text-xs --text-sm --text-md --text-lg --weight-semibold --weight-bold --font-sans --font-display --focus-ring --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger
 * Use cases: habit tracker; daily routine app; wellness app; study tracker; fitness consistency; self-improvement journal; team rituals
 * Jobs to be done: tick off what I did today; see my streaks; know if I'm meeting my weekly goal; look back at last week; add a new habit; get reminded at a set time
 * Keywords: habits, habit tracker, streak, routine, daily, weekly goal, check-in, reminder, wellness, productivity
 */
/**
 * Habit tracker: dates are local "YYYY-MM-DD" strings and weeks start on Monday. A day button ticks or unticks that
 * habit on that day (onToggle may return a promise: the tick shows at once and goes back if it fails); days after
 * today can't be ticked. The streak counts days in a row up to today (or up to yesterday while today is still open);
 * the ring shows the week's ticks against the habit's days-per-week goal and turns green once it's met.
 * The grid is a WAI-ARIA grid: it is one Tab stop; the arrow keys move between cells, Home and End go to the first and
 * last cell of a row, Ctrl+Home and Ctrl+End to the first and last row; Space or Enter ticks a day.
 * Add habit and the pencil open the same dialog: name (required, not used by another habit), days per week, color,
 * and a reminder switch with its time. Delete habit, in the dialog, asks first. Focus returns to the button that opened it.
 * Bars and rings fill, ticks pop and the "all done" line rises in; everything works with motion off.
 * Adapted from TailAdmin (MIT, Copyright (c) 2023 TailAdmin): its task list and calendar grid, reshaped into a habit
 * week grid with streaks.
 */
/**
 * How to try it
 * - Tick today for Read and Stretch: the today bar fills and the streak goes up. Untick one.
 * - Tab into the grid and move with the arrow keys; press Space to tick. Try Ctrl+End and Home.
 * - Press the previous week button: last week's ticks show; future days in this week can't be ticked.
 * - Press Add habit, submit it empty, then add "Walk" 4 days a week with a reminder at 18:00.
 * - Press the pencil on a habit and Delete habit: it asks first.
 *
 * Dependencies: React (useEffect, useId, useMemo, useRef, useState), the library's ChoiceGroup ("./checkboxes-radios"),
 * Quantity ("./input-quantity"), Switch ("./switches-states"), TextField ("./text-fields-states"), Modal
 * ("./modals-dialogs"), Button ("./buttons-variants") and its icons ("./icons"). Nothing else: nothing fetched at run
 * time. The styles are the library's own fl- classes in templates/library/css/r5b-habits.css.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Button } from "./buttons-variants";
import { ChoiceGroup } from "./checkboxes-radios";
import { Icon } from "./icons";
import { Quantity } from "./input-quantity";
import { Modal } from "./modals-dialogs";
import { Switch } from "./switches-states";
import { TextField } from "./text-fields-states";

// ── b.habit-tracker: a week grid of habits with streaks, weekly goals and reminders. ──

export type HabitTone = "accent" | "secondary" | "success" | "warning";
export type Habit = {
  id: string;
  name: string;
  /** Days per week, 1 to 7. */
  target: number;
  tone?: HabitTone;
  reminder?: { on: boolean; time: string };
  /** "YYYY-MM-DD" days it was done. */
  done: string[];
};
export type HabitTrackerProps = {
  title: string;
  habits: Habit[];
  /** How many weeks back the previous button reaches. */
  weeksBack?: number;
  locale?: string;
  loading?: boolean;
  onToggle?: (habitId: string, date: string, done: boolean) => Promise<void>;
  onSave?: (habit: Habit) => Promise<void>;
  onRemove?: (id: string) => Promise<void>;
  className?: string;
};

const TONES: { value: HabitTone; label: string; color: string }[] = [
  { value: "accent", label: "Accent", color: "var(--color-accent)" },
  { value: "secondary", label: "Secondary", color: "var(--color-secondary, var(--color-accent))" },
  { value: "success", label: "Green", color: "var(--color-success)" },
  { value: "warning", label: "Amber", color: "var(--color-warning)" },
];
const quick = async () => undefined;
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const monday = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));

function streakOf(done: Set<string>, today: Date) {
  let d = done.has(ymd(today)) ? today : addDays(today, -1);
  let n = 0;
  while (done.has(ymd(d))) {
    n += 1;
    d = addDays(d, -1);
  }
  return n;
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

/** True a moment after `on`, so the today bar and rings start empty and fill; at once when motion is off. */
function useGrown(on: boolean) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    if (!on) return setGrown(false);
    if (typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off") return setGrown(true);
    const t = window.setTimeout(() => setGrown(true), 40);
    return () => window.clearTimeout(t);
  }, [on]);
  return grown;
}

type Draft = { id?: string; name: string; target: number; tone: HabitTone; remind: boolean; time: string };

export function HabitTracker({ title, habits: given, weeksBack = 12, locale = "en-US", loading = false, onToggle = quick, onSave = quick, onRemove = quick, className }: HabitTrackerProps) {
  const uid = useId().replace(/:/g, "");
  const focusLater = useFocusLater();
  const today = useMemo(() => new Date(), []);
  const todayKey = ymd(today);
  const thisWeek = monday(today);
  const [habits, setHabits] = useState(given);
  const [offset, setOffset] = useState(0);
  const [cell, setCell] = useState({ r: 0, c: 0 });
  const [said, setSaid] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftErr, setDraftErr] = useState<{ name?: string; time?: string }>({});
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const opener = useRef<string>("");
  const grown = useGrown(!loading);

  const start = addDays(thisWeek, -7 * offset);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const dayKeys = days.map(ymd);
  const todayIndex = offset === 0 ? dayKeys.indexOf(todayKey) : -1;
  const fmtDay = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "narrow" }), [locale]);
  const fmtLong = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "long", month: "short", day: "numeric" }), [locale]);
  const fmtShort = useMemo(() => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }), [locale]);
  const fmtTime = useMemo(() => new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }), [locale]);
  const timeText = (t: string) => fmtTime.format(new Date(2000, 0, 1, Number(t.slice(0, 2)), Number(t.slice(3, 5))));
  const weekLabel = `${fmtShort.format(days[0]!)} – ${days[0]!.getMonth() === days[6]!.getMonth() ? days[6]!.getDate() : fmtShort.format(days[6]!)}`;

  const sets = useMemo(() => new Map(habits.map((h) => [h.id, new Set(h.done)])), [habits]);
  const doneToday = habits.filter((h) => sets.get(h.id)!.has(todayKey)).length;
  const best = habits.map((h) => ({ h, s: streakOf(sets.get(h.id)!, today) })).sort((a, b) => b.s - a.s)[0];

  // The grid's one Tab stop, kept inside the grid as rows come and go.
  const r = Math.min(cell.r, Math.max(0, habits.length - 1));
  const c = cell.c;
  const cellId = (row: number, col: number) => `${uid}-c${row}-${col}`;
  // Columns 0 to 6 are the days, 7 the week's count (read with its row), 8 the edit button.
  const focusables = [0, 1, 2, 3, 4, 5, 6, 8];
  const onGridKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (!t.dataset.cell) return;
    const [row, col] = t.dataset.cell.split(":").map(Number) as [number, number];
    let nr = row;
    let ci = focusables.indexOf(col);
    if (e.key === "ArrowRight") ci = Math.min(focusables.length - 1, ci + 1);
    else if (e.key === "ArrowLeft") ci = Math.max(0, ci - 1);
    else if (e.key === "ArrowDown") nr = Math.min(habits.length - 1, row + 1);
    else if (e.key === "ArrowUp") nr = Math.max(0, row - 1);
    else if (e.key === "Home") {
      ci = 0;
      if (e.ctrlKey) nr = 0;
    } else if (e.key === "End") {
      ci = focusables.length - 1;
      if (e.ctrlKey) nr = habits.length - 1;
    }
    else return;
    e.preventDefault();
    const nc = focusables[ci]!;
    setCell({ r: nr, c: nc });
    document.getElementById(cellId(nr, nc))?.focus();
  };

  const toggle = async (h: Habit, key: string, row: number, col: number) => {
    setCell({ r: row, c: col });
    if (key > todayKey) return setSaid("That day hasn't come yet.");
    const on = !sets.get(h.id)!.has(key);
    const apply = (to: boolean) => setHabits((all) => all.map((x) => (x.id === h.id ? { ...x, done: to ? [...x.done, key] : x.done.filter((d) => d !== key) } : x)));
    apply(on);
    const label = fmtLong.format(new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10))));
    if (on && key === todayKey && doneToday + 1 === habits.length) setSaid(`${h.name} done. Everything's done today.`);
    else setSaid(`${h.name} ${on ? "done" : "not done"} on ${label}.`);
    try {
      await onToggle(h.id, key, on);
    } catch {
      apply(!on);
      setSaid(`Couldn't save ${h.name} for ${label}. Try again.`);
    }
  };

  const openAdd = (from: string) => {
    opener.current = from;
    setDraftErr({});
    setDraft({ name: "", target: 5, tone: "accent", remind: false, time: "08:00" });
  };
  const openEdit = (h: Habit, from: string) => {
    opener.current = from;
    setDraftErr({});
    setDraft({ id: h.id, name: h.name, target: h.target, tone: h.tone ?? "accent", remind: !!h.reminder?.on, time: h.reminder?.time ?? "08:00" });
  };
  const closeDraft = () => {
    setDraft(null);
    const from = opener.current;
    focusLater(() => document.getElementById(from) ?? document.getElementById(`${uid}-add`));
  };
  const saveDraft = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    const err: typeof draftErr = {};
    if (!name) err.name = "Enter a name.";
    else if (habits.some((h) => h.id !== draft.id && h.name.toLowerCase() === name.toLowerCase())) err.name = `You already track ${name}.`;
    if (draft.remind && !/^\d{2}:\d{2}$/.test(draft.time)) err.time = "Pick a time for the reminder.";
    setDraftErr(err);
    if (err.name || err.time) return document.getElementById(`${uid}-${err.name ? "name" : "time"}`)?.focus();
    const old = draft.id ? habits.find((h) => h.id === draft.id) : undefined;
    const habit: Habit = { id: draft.id ?? `h${Date.now()}`, name, target: draft.target, tone: draft.tone, reminder: { on: draft.remind, time: draft.time }, done: old?.done ?? [] };
    setSaving(true);
    try {
      await onSave(habit);
      setHabits((all) => (old ? all.map((h) => (h.id === habit.id ? habit : h)) : [...all, habit]));
      setSaid(old ? `${name} saved.` : `${name} added.${habit.reminder?.on ? ` Reminder at ${timeText(habit.reminder.time)}.` : ""}`);
      if (!old) {
        opener.current = cellId(habits.length, todayIndex >= 0 ? todayIndex : 0);
        setCell({ r: habits.length, c: todayIndex >= 0 ? todayIndex : 0 });
      }
      setDraft(null);
      const from = opener.current;
      focusLater(() => document.getElementById(from) ?? document.getElementById(`${uid}-add`));
    } catch {
      setDraftErr({ name: "Couldn't save. Try again." });
    } finally {
      setSaving(false);
    }
  };
  const confirming = confirmId ? habits.find((h) => h.id === confirmId) : undefined;
  const doRemove = async () => {
    if (!confirming) return;
    setRemoving(true);
    try {
      await onRemove(confirming.id);
      setHabits((all) => all.filter((h) => h.id !== confirming.id));
      setSaid(`${confirming.name} deleted.`);
      setConfirmId(null);
      setDraft(null);
      focusLater(() => document.getElementById(`${uid}-add`));
    } catch {
      setSaid(`Couldn't delete ${confirming.name}. Try again.`);
    } finally {
      setRemoving(false);
    }
  };

  const goWeek = (to: number, from: "prev" | "next" | "now") => {
    setOffset(to);
    const d = addDays(thisWeek, -7 * to);
    setSaid(`Week of ${fmtShort.format(d)}.`);
    focusLater(() => {
      const el = document.getElementById(`${uid}-${from}`) as HTMLButtonElement | null;
      return el && !el.disabled ? el : (document.getElementById(`${uid}-${from === "next" ? "prev" : "next"}`) as HTMLButtonElement | null);
    });
  };

  return (
    <section className={["fl-hab", className ?? ""].filter(Boolean).join(" ")} data-fl="b.habit-tracker" aria-labelledby={`${uid}-t`} aria-busy={loading || undefined}>
      <header className="fl-hab-head">
        <h3 id={`${uid}-t`} className="fl-hab-title">
          {title}
        </h3>
        <div className="fl-hab-week" role="group" aria-label="Week">
          <Button id={`${uid}-prev`} variant="tertiary" size={32} icon="chevron-left" iconOnly disabled={offset >= weeksBack || loading} onClick={() => goWeek(offset + 1, "prev")}>
            Previous week
          </Button>
          <span className="fl-hab-week-name">{offset === 0 ? `This week · ${weekLabel}` : weekLabel}</span>
          <Button id={`${uid}-next`} variant="tertiary" size={32} icon="chevron-right" iconOnly disabled={offset === 0 || loading} onClick={() => goWeek(offset - 1, "next")}>
            Next week
          </Button>
        </div>
        <Button id={`${uid}-add`} variant="secondary" size={40} icon="plus" disabled={loading} onClick={() => openAdd(`${uid}-add`)}>
          Add habit
        </Button>
      </header>

      {loading ? (
        <div className="fl-hab-ghosts" aria-hidden="true">
          <span className="fl-hab-ghost fl-hab-ghost--strip" />
          {[0, 1, 2, 3].map((k) => (
            <span key={k} className="fl-hab-ghost" />
          ))}
        </div>
      ) : !habits.length ? (
        <div className="fl-hab-state" data-fl="c.empty-state">
          <Icon name="check" />
          <strong>No habits yet</strong>
          <p>Start with one small thing you want to do most days.</p>
          <Button variant="primary" size={40} icon="plus" onClick={() => openAdd(`${uid}-add`)}>
            Add your first habit
          </Button>
        </div>
      ) : (
        <>
          <div className="fl-hab-today">
            <p>
              <strong>
                {doneToday} of {habits.length}
              </strong>{" "}
              done today
              {best && best.s > 1 ? (
                <span className="fl-hab-best">
                  <Icon name="bolt" />
                  Best streak: {best.h.name}, {best.s} days
                </span>
              ) : null}
            </p>
            <span className="fl-hab-bar" role="progressbar" aria-label="Done today" aria-valuemin={0} aria-valuemax={habits.length} aria-valuenow={doneToday} aria-valuetext={`${doneToday} of ${habits.length} done today`}>
              <span style={{ ["--fl-hab-w" as string]: grown ? doneToday / habits.length : 0 }} />
            </span>
            {doneToday === habits.length ? (
              <p className="fl-hab-all" key={`all-${doneToday}`}>
                <Icon name="star" filled />
                All done today
              </p>
            ) : null}
          </div>

          <div className="fl-hab-grid" role="grid" aria-labelledby={`${uid}-t`} aria-describedby={`${uid}-gd`} onKeyDown={onGridKey}>
            <p id={`${uid}-gd`} className="fl-sr">
              Arrow keys move between days. Space ticks a day.
            </p>
            <div className="fl-hab-row fl-hab-row--head" role="row">
              <span className="fl-hab-name" role="columnheader">
                Habit
              </span>
              {days.map((d, i) => (
                <span key={dayKeys[i]} role="columnheader" className={`fl-hab-dh${dayKeys[i] === todayKey ? " is-today" : ""}`} aria-label={fmtLong.format(d)}>
                  <span aria-hidden="true">{fmtDay.format(d)}</span>
                  <span aria-hidden="true">{d.getDate()}</span>
                </span>
              ))}
              <span role="columnheader" className="fl-hab-wk">
                Week
              </span>
              <span role="columnheader" className="fl-hab-ed">
                <span className="fl-sr">Edit</span>
              </span>
            </div>
            {habits.map((h, row) => {
              const set = sets.get(h.id)!;
              const streak = streakOf(set, today);
              const count = dayKeys.filter((k) => set.has(k)).length;
              const met = count >= h.target;
              const tone = h.tone ?? "accent";
              return (
                <div key={h.id} className={`fl-hab-row is-${tone}`} role="row" style={{ ["--i" as string]: Math.min(row, 8) }}>
                  <span className="fl-hab-name" role="rowheader">
                    <span className="fl-hab-dot" aria-hidden="true" />
                    <strong>{h.name}</strong>
                    <span className="fl-hab-meta">
                      {streak ? (
                        <span>
                          <Icon name="bolt" />
                          {streak}-day streak
                        </span>
                      ) : (
                        <span>No streak yet</span>
                      )}
                      {h.reminder?.on ? (
                        <span>
                          <Icon name="bell" />
                          {timeText(h.reminder.time)}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  {dayKeys.map((k, col) => {
                    const on = set.has(k);
                    const future = k > todayKey;
                    return (
                      <span key={k} role="gridcell" className="fl-hab-cell">
                        <button
                          type="button"
                          id={cellId(row, col)}
                          data-cell={`${row}:${col}`}
                          tabIndex={r === row && c === col ? 0 : -1}
                          className={`fl-hab-day${k === todayKey ? " is-today" : ""}`}
                          aria-pressed={on}
                          aria-disabled={future || undefined}
                          aria-label={`${h.name}, ${fmtLong.format(days[col]!)}`}
                          onFocus={() => setCell({ r: row, c: col })}
                          onClick={() => void toggle(h, k, row, col)}
                        >
                          {on ? <Icon name="check" /> : null}
                        </button>
                      </span>
                    );
                  })}
                  <span role="gridcell" className={`fl-hab-wk${met ? " is-met" : ""}`}>
                    <svg viewBox="0 0 36 36" aria-hidden="true">
                      <circle className="fl-hab-ring-bg" cx="18" cy="18" r="15" pathLength={100} />
                      <circle className="fl-hab-ring" cx="18" cy="18" r="15" pathLength={100} style={{ strokeDashoffset: grown ? 100 - Math.min(1, count / h.target) * 100 : 100 }} />
                    </svg>
                    <span>
                      {count}/{h.target}
                      <span className="fl-sr"> days this week{met ? ", goal met" : ""}</span>
                    </span>
                  </span>
                  <span role="gridcell" className="fl-hab-ed">
                    <Button
                      id={cellId(row, 8)}
                      data-cell={`${row}:8`}
                      tabIndex={r === row && c === 8 ? 0 : -1}
                      variant="tertiary"
                      size={32}
                      icon="pencil"
                      iconOnly
                      aria-label={`Edit ${h.name}`}
                      onFocus={() => setCell({ r: row, c: 8 })}
                      onClick={() => openEdit(h, cellId(row, 8))}
                    >
                      Edit
                    </Button>
                  </span>
                </div>
              );
            })}
          </div>
          {offset > 0 ? (
            <Button variant="tertiary" size={32} icon="arrow" iconAt="end" onClick={() => goWeek(0, "now")} id={`${uid}-now`}>
              Back to this week
            </Button>
          ) : null}
        </>
      )}

      {draft ? (
        <Modal
          variant="form"
          title={draft.id ? `Edit ${habits.find((h) => h.id === draft.id)?.name ?? "habit"}` : "Add a habit"}
          confirmLabel={draft.id ? "Save" : "Add habit"}
          busy={saving}
          busyLabel="Saving…"
          onConfirm={() => {
            void saveDraft();
            return false;
          }}
          onClose={closeDraft}
        >
          <div className="fl-hab-form">
            <div className="fl-hab-field">
              <label htmlFor={`${uid}-name`}>Name</label>
              <TextField
                id={`${uid}-name`}
                size={44}
                autoComplete="off"
                maxLength={40}
                placeholder="Read 20 pages"
                value={draft.name}
                data-autofocus
                invalid={!!draftErr.name}
                aria-describedby={draftErr.name ? `${uid}-name-err` : undefined}
                onChange={(e) => (setDraft((d) => d && { ...d, name: e.target.value }), setDraftErr((x) => ({ ...x, name: undefined })))}
              />
              {draftErr.name ? (
                <p id={`${uid}-name-err`} className="fl-hab-err">
                  {draftErr.name}
                </p>
              ) : null}
            </div>
            <div className="fl-hab-field">
              <label htmlFor={`${uid}-target`}>Days per week</label>
              <Quantity id={`${uid}-target`} label="Days per week" size="sm" min={1} max={7} value={draft.target} onChange={(v) => setDraft((d) => d && { ...d, target: v })} />
            </div>
            <ChoiceGroup variant="swatch" label="Color" options={TONES} value={draft.tone} onChange={(v) => setDraft((d) => d && { ...d, tone: v as HabitTone })} />
            <div className="fl-hab-remind">
              <Switch on={draft.remind} size={24} label="Daily reminder" onToggle={(next) => (setDraft((d) => d && { ...d, remind: next }), setDraftErr((x) => ({ ...x, time: undefined })))} />
              <div className={`fl-hab-time${draft.remind ? " is-open" : ""}`} inert={!draft.remind}>
                <div>
                  <label htmlFor={`${uid}-time`}>Time</label>
                  <TextField
                    id={`${uid}-time`}
                    size={40}
                    type="time"
                    value={draft.time}
                    invalid={!!draftErr.time}
                    aria-describedby={draftErr.time ? `${uid}-time-err` : undefined}
                    onChange={(e) => (setDraft((d) => d && { ...d, time: e.target.value }), setDraftErr((x) => ({ ...x, time: undefined })))}
                  />
                  {draftErr.time ? (
                    <p id={`${uid}-time-err`} className="fl-hab-err">
                      {draftErr.time}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            {draft.id ? (
              <Button
                variant="tertiary"
                size={32}
                icon="trash"
                className="fl-hab-delete"
                onClick={() => {
                  // One dialog at a time: the confirm takes the edit dialog's place.
                  setConfirmId(draft.id!);
                  setDraft(null);
                }}
              >
                Delete habit
              </Button>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {confirming ? (
        <Modal
          variant="danger"
          icon="trash"
          title={`Delete ${confirming.name}?`}
          description={`Its ${confirming.done.length} ticked ${confirming.done.length === 1 ? "day goes" : "days go"} with it. This can't be undone.`}
          confirmLabel="Delete"
          cancelLabel="Keep"
          busy={removing}
          busyLabel="Deleting…"
          onConfirm={() => {
            void doRemove();
            return false;
          }}
          onClose={() => {
            setConfirmId(null);
            const from = opener.current;
            focusLater(() => document.getElementById(from) ?? document.getElementById(`${uid}-add`));
          }}
        />
      ) : null}

      <p className="fl-sr" role="status" aria-live="polite">
        {loading ? "Loading habits…" : said}
      </p>
    </section>
  );
}

// ── The reference sheet: five habits with a few weeks of history up to today. ──

const TODAY = new Date();
/** The days in the last `span` days (counting today as 0) that are not in `skip`. */
const daysAgo = (span: number, skip: number[] = []) =>
  Array.from({ length: span }, (_, i) => i)
    .filter((i) => !skip.includes(i))
    .map((i) => ymd(addDays(TODAY, -i)));

// flowcode:sample
const SAMPLE: HabitTrackerProps = {
  title: "My habits",
  habits: [
    { id: "read", name: "Read 20 pages", target: 6, tone: "accent", reminder: { on: true, time: "21:30" }, done: daysAgo(13, [0]) },
    { id: "stretch", name: "Stretch", target: 5, tone: "success", reminder: { on: true, time: "07:15" }, done: daysAgo(20, [0, 4, 9, 10, 16]) },
    { id: "water", name: "Drink 8 glasses of water", target: 7, tone: "secondary", done: daysAgo(30, [3, 11, 12, 22]) },
    { id: "spend", name: "No-spend day", target: 3, tone: "warning", done: daysAgo(28, [0, 1, 3, 4, 6, 8, 9, 10, 12, 13, 15, 17, 18, 20, 21, 23, 24, 26]) },
    { id: "journal", name: "Journal", target: 4, tone: "accent", reminder: { on: false, time: "22:00" }, done: daysAgo(9, [1, 2, 5, 6, 8]) },
  ],
};

export default function HabitTrackerPreview() {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 600);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <section className="fl-section fl-section--canvas" aria-label="Habit tracker">
      <div className="fl-wrap">
        <HabitTracker
          {...SAMPLE}
          loading={loading}
          onToggle={() => new Promise<void>((done) => window.setTimeout(done, 150))}
          onSave={() => new Promise<void>((done) => window.setTimeout(done, 250))}
          onRemove={() => new Promise<void>((done) => window.setTimeout(done, 250))}
        />
      </div>
    </section>
  );
}
