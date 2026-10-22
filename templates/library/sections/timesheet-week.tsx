/** @flowcode-library timesheet-week · Weekly timesheet with timer (Forms)
 * Catalog ID: b.timesheet-week (block)
 * Function: Track time and hand in the week (b.timesheet-week): a start and stop timer with a project and a note, the week's entries by day with their start, end and length, entries added, edited (with overlap and time checks) and deleted after a confirm, hours per day in a bar chart against the daily target, the week's total and billable amount, and Submit week (after a confirm) that locks the week until it is withdrawn.
 * Use it as: import { TimesheetWeek } from "./timesheet-week"; <TimesheetWeek title="Timesheet" projects={[{ id, name, rate?(cents per hour) }]} entries={[{ id, project, note, date: "2026-10-20", start: "09:00", end: "12:30" }]} running?={{ project, note, startedAt: "2026-10-21T13:05:00" }} submitted?={["2026-10-12"]} targetHours?={40} weeksBack?={8} currency?="USD" locale? loading? onSave?={async (entry) => ...} onRemove?={async (id) => ...} onSubmit?={async (weekStart) => ...} onWithdraw?={async (weekStart) => ...} />
 * Built from: c.select.outlined, c.text-field.outlined, c.badge.status, c.modal.form, c.modal.confirm, c.modal.danger, c.button.primary, c.button.secondary, c.button.tertiary, c.empty-state
 * Look: A white card: a timer bar (project select, note field, a big running clock and a round Start or red Stop button), then the week ("Oct 19 – 25") between previous and next buttons with an Open or Submitted badge, a summary panel with "32h 15m of 40h", a straight bar, the billable amount and seven slim bars by day with a dashed target line, and the days as sections (weekday, date and the day's total, an Add button) with entry rows: a color dot, project and note, the time range, the length and quiet Edit and Delete buttons; Submit week sits at the bottom.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-secondary --color-success --color-warning --color-danger --surface-radius --pill-radius --radius-sm --radius-md --space-1 --space-2 --space-3 --space-4 --space-5 --text-xs --text-sm --text-md --text-lg --text-xl --weight-semibold --weight-bold --font-sans --font-display --focus-ring --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger
 * Use cases: freelancer time tracking; agency timesheets; consultant billable hours; employee weekly timesheet; client project hours; study time log
 * Jobs to be done: time what I'm working on now; fix an entry I got wrong; add time I forgot to track; see how many hours I've done this week; know what I can bill; hand in my week
 * Keywords: timesheet, time tracker, timer, stopwatch, hours, billable, projects, weekly total, submit, time entries, productivity
 */
/**
 * Weekly timesheet: times are local "HH:MM" on a "YYYY-MM-DD" day and weeks start on Monday; money is whole cents.
 * Start needs a project; the clock runs until Stop, which saves an entry for today from the start to now (under a
 * minute isn't saved). An entry can't cross midnight, end before it starts, run past 16 hours or overlap another entry
 * that day (the error names the one it overlaps). Edit and Delete on the entries are one Tab stop: Up and Down move
 * between entries, Left and Right between the two buttons, Home and End to the first and last entry.
 * The summary shows the total against the weekly target, the billable amount (each project's hourly rate), and hours
 * per day against the daily target (the weekly target over five days) as bars with a text alternative.
 * Submit week asks first; the timer must be stopped. A submitted week is locked (no add, edit, delete or timer) until
 * Withdraw. onSave, onRemove, onSubmit and onWithdraw may return promises; a failure is said and nothing is lost.
 * Bars grow, totals count up and new entries rise in; everything works with motion off.
 * Adapted from HyperUI (MIT, Copyright (c) Mark Mead): its stats, tables and form controls, reshaped into a timer and a
 * weekly timesheet.
 */
/**
 * How to try it
 * - The timer is running. Press Stop: a new entry shows under today. Press Start without a project, then pick one.
 * - Press Edit on an entry and set its end before its start, or overlap the entry before it: each is refused with why.
 * - Press Add on a day and log 1:00 PM to 2:30 PM. Delete an entry: it asks first.
 * - Tab to an entry's Edit button and use the arrow keys, Home and End.
 * - Press Submit week (stop the timer first): the week locks. Press Withdraw. Go back a week to see a submitted one.
 *
 * Dependencies: React (useEffect, useId, useMemo, useRef, useState), the library's Select ("./dropdowns-states"),
 * TextField ("./text-fields-states"), Badge ("./badges-status"), Modal ("./modals-dialogs"), Button
 * ("./buttons-variants") and its icons ("./icons"). Nothing else: no chart package, nothing fetched at run time. The
 * styles are the library's own fl- classes in templates/library/css/r5b-timesheet.css.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { TextField } from "./text-fields-states";

// ── b.timesheet-week: a timer, the week's entries by day, totals and a chart, and submit. ──

export type TsProject = { id: string; name: string; /** cents per hour; not billable when left out */ rate?: number };
export type TsEntry = { id: string; project: string; note: string; /** "YYYY-MM-DD" */ date: string; /** "HH:MM" */ start: string; end: string };
export type TsRunning = { project: string; note: string; /** local ISO, "2026-10-21T13:05:00" */ startedAt: string };
export type TimesheetWeekProps = {
  title: string;
  projects: TsProject[];
  entries: TsEntry[];
  running?: TsRunning | null;
  /** Mondays ("YYYY-MM-DD") of the weeks already submitted. */
  submitted?: string[];
  targetHours?: number;
  weeksBack?: number;
  currency?: string;
  locale?: string;
  loading?: boolean;
  onSave?: (entry: TsEntry) => Promise<void>;
  onRemove?: (id: string) => Promise<void>;
  onSubmit?: (weekStart: string) => Promise<void>;
  onWithdraw?: (weekStart: string) => Promise<void>;
  className?: string;
};

type Draft = { id?: string; project: string; note: string; date: string; start: string; end: string };
type DraftErr = Partial<Record<"project" | "date" | "start" | "end", string>>;

const quick = async () => undefined;
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const monday = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
const dateOf = (s: string) => new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const lengthOf = (e: { start: string; end: string }) => mins(e.end) - mins(e.start);
const dur = (m: number) => (m < 60 ? `${m}m` : m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h`);
const clock = (s: number) => `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
const TONES = 4;

const motionOff = () =>
  typeof window === "undefined" || !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off";

/** A number that counts toward its target with an ease-out curve; jumps when motion is off or frames are paused. */
function useTween(target: number, ms = 600) {
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
function Count({ value, fmt }: { value: number; fmt: (n: number) => string }) {
  return <>{fmt(Math.round(useTween(value)))}</>;
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

export function TimesheetWeek({
  title,
  projects,
  entries: given,
  running: givenRunning = null,
  submitted: givenSubmitted = [],
  targetHours = 40,
  weeksBack = 8,
  currency = "USD",
  locale = "en-US",
  loading = false,
  onSave = quick,
  onRemove = quick,
  onSubmit = quick,
  onWithdraw = quick,
  className,
}: TimesheetWeekProps) {
  const uid = useId().replace(/:/g, "");
  const focusLater = useFocusLater();
  const [entries, setEntries] = useState(given);
  const [running, setRunning] = useState<TsRunning | null>(givenRunning);
  const [timerProject, setTimerProject] = useState(givenRunning?.project ?? "");
  const [timerNote, setTimerNote] = useState(givenRunning?.note ?? "");
  const [timerErr, setTimerErr] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [submitted, setSubmitted] = useState(() => new Set(givenSubmitted));
  const [offset, setOffset] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftErr, setDraftErr] = useState<DraftErr>({});
  const [busy, setBusy] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [askSubmit, setAskSubmit] = useState(false);
  const [weekErr, setWeekErr] = useState("");
  const [said, setSaid] = useState("");
  const opener = useRef("");
  const seq = useRef(0);

  // The clock ticks once a second while running.
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [running]);

  const mf = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency }), [locale, currency]);
  const money = (c: number) => mf.format(c / 100);
  const fmtTime = useMemo(() => new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }), [locale]);
  const fmtDay = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" }), [locale]);
  const fmtLong = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric" }), [locale]);
  const fmtShort = useMemo(() => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }), [locale]);
  const fmtNarrow = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "narrow" }), [locale]);
  const t12 = (t: string) => fmtTime.format(new Date(2000, 0, 1, Number(t.slice(0, 2)), Number(t.slice(3, 5))));
  const project = (id: string) => projects.find((p) => p.id === id);
  const toneOf = (id: string) => Math.max(0, projects.findIndex((p) => p.id === id)) % TONES;

  const today = new Date(now);
  const todayKey = ymd(today);
  const start = addDays(monday(new Date()), -7 * offset);
  const weekKey = ymd(start);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const dayKeys = days.map(ymd);
  const locked = submitted.has(weekKey);
  const thisWeekLocked = submitted.has(ymd(monday(new Date())));
  const weekLabel = `${fmtShort.format(days[0]!)} – ${days[0]!.getMonth() === days[6]!.getMonth() ? days[6]!.getDate() : fmtShort.format(days[6]!)}`;

  const inWeek = entries.filter((e) => dayKeys.includes(e.date)).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  const perDay = dayKeys.map((k) => inWeek.filter((e) => e.date === k).reduce((n, e) => n + lengthOf(e), 0));
  const runningSecs = running ? Math.max(0, Math.floor((now - new Date(running.startedAt).getTime()) / 1000)) : 0;
  const totalMins = perDay.reduce((a, b) => a + b, 0);
  const billable = Math.round(inWeek.reduce((n, e) => n + (lengthOf(e) * (project(e.project)?.rate ?? 0)) / 60, 0));
  const targetMins = targetHours * 60;
  const dayTarget = targetMins / 5;
  const chartMax = Math.max(dayTarget * 1.25, ...perDay);
  const ids = inWeek.map((e) => e.id);
  const rove = useRoving(ids);

  // ── Timer. ──
  const startTimer = () => {
    if (thisWeekLocked) return setTimerErr("This week is submitted. Withdraw it to track time.");
    if (!timerProject) {
      setTimerErr("Pick a project first.");
      document.getElementById(`${uid}-tp`)?.focus();
      return;
    }
    const d = new Date();
    setRunning({ project: timerProject, note: timerNote.trim(), startedAt: `${ymd(d)}T${hm(d)}:${pad(d.getSeconds())}` });
    setTimerErr("");
    setSaid(`Timer started for ${project(timerProject)?.name}.`);
  };
  const stopTimer = async () => {
    if (!running) return;
    const began = new Date(running.startedAt);
    const end = new Date();
    const r = running;
    setRunning(null);
    if (end.getTime() - began.getTime() < 60_000) return setSaid("Stopped. Under a minute, so nothing was saved.");
    // An entry stays inside one day: a timer left running past midnight is cut at the end of the day it began.
    const sameDay = ymd(began) === ymd(end);
    const entry: TsEntry = { id: `e${Date.now()}${++seq.current}`, project: r.project, note: r.note, date: ymd(began), start: hm(began), end: sameDay ? hm(end) : "23:59" };
    if (lengthOf(entry) < 1) return setSaid("Stopped. Under a minute, so nothing was saved.");
    try {
      await onSave(entry);
      setEntries((all) => [...all, entry]);
      setOffset(0);
      setTimerNote("");
      setSaid(`Stopped. ${dur(lengthOf(entry))} saved to ${project(entry.project)?.name}.`);
    } catch {
      setRunning(r);
      setTimerErr("Couldn't save the time. The timer is still running.");
    }
  };

  // ── Entries. ──
  const openDraft = (d: Draft, from: string) => {
    opener.current = from;
    setDraftErr({});
    setDraft(d);
  };
  const closeDraft = () => {
    setDraft(null);
    const from = opener.current;
    focusLater(() => document.getElementById(from));
  };
  const saveDraft = async () => {
    if (!draft) return;
    const err: DraftErr = {};
    if (!draft.project) err.project = "Pick a project.";
    if (!draft.date || !dayKeys.includes(draft.date)) err.date = `Pick a day from ${weekLabel}.`;
    else if (draft.date > todayKey) err.date = "That day hasn't come yet.";
    if (!/^\d{2}:\d{2}$/.test(draft.start)) err.start = "Enter a start time.";
    if (!/^\d{2}:\d{2}$/.test(draft.end)) err.end = "Enter an end time.";
    if (!err.start && !err.end) {
      const len = mins(draft.end) - mins(draft.start);
      if (len <= 0) err.end = "End after the start time (entries can't cross midnight).";
      else if (len > 16 * 60) err.end = "Keep an entry to 16 hours or less.";
      else if (!err.date) {
        const clash = entries.find((e) => e.id !== draft.id && e.date === draft.date && mins(e.start) < mins(draft.end) && mins(draft.start) < mins(e.end));
        if (clash) err.start = `Overlaps ${project(clash.project)?.name ?? "an entry"}, ${t12(clash.start)} – ${t12(clash.end)}.`;
      }
    }
    setDraftErr(err);
    const first = (["project", "date", "start", "end"] as const).find((k) => err[k]);
    if (first) return document.getElementById(`${uid}-d-${first}`)?.focus();
    const entry: TsEntry = { id: draft.id ?? `e${Date.now()}${++seq.current}`, project: draft.project, note: draft.note.trim(), date: draft.date, start: draft.start, end: draft.end };
    setBusy(true);
    try {
      await onSave(entry);
      setEntries((all) => (draft.id ? all.map((e) => (e.id === entry.id ? entry : e)) : [...all, entry]));
      setSaid(`${draft.id ? "Saved" : "Added"}: ${project(entry.project)?.name}, ${dur(lengthOf(entry))} on ${fmtLong.format(dateOf(entry.date))}.`);
      setDraft(null);
      focusLater(() => document.getElementById(`${uid}-ed-${entry.id}`) ?? document.getElementById(opener.current));
    } catch {
      setDraftErr({ project: "Couldn't save. Try again." });
    } finally {
      setBusy(false);
    }
  };
  const removing = removeId ? entries.find((e) => e.id === removeId) : undefined;
  const doRemove = async () => {
    if (!removing) return;
    const at = ids.indexOf(removing.id);
    const next = ids[at + 1] ?? ids[at - 1];
    setBusy(true);
    try {
      await onRemove(removing.id);
      setEntries((all) => all.filter((e) => e.id !== removing.id));
      setSaid(`Deleted ${project(removing.project)?.name}, ${dur(lengthOf(removing))}.`);
      setRemoveId(null);
      focusLater(() => (next ? document.getElementById(`${uid}-ed-${next}`) : document.getElementById(`${uid}-add-${removing.date}`)));
    } catch {
      setSaid("Couldn't delete it. Try again.");
    } finally {
      setBusy(false);
    }
  };

  // ── Week. ──
  const goWeek = (to: number, from: "prev" | "next") => {
    setOffset(to);
    setWeekErr("");
    setSaid(`Week of ${fmtShort.format(addDays(monday(new Date()), -7 * to))}.`);
    focusLater(() => {
      const el = document.getElementById(`${uid}-${from}`) as HTMLButtonElement | null;
      return el && !el.disabled ? el : document.getElementById(`${uid}-${from === "prev" ? "next" : "prev"}`);
    });
  };
  const submitBlock = !inWeek.length ? "Log some time first." : running && offset === 0 ? "Stop the timer first." : "";
  const doSubmit = async () => {
    setBusy(true);
    setWeekErr("");
    try {
      await onSubmit(weekKey);
      setSubmitted((s) => new Set([...s, weekKey]));
      setAskSubmit(false);
      setSaid(`Week of ${weekLabel} submitted: ${dur(totalMins)}.`);
      focusLater(() => document.getElementById(`${uid}-withdraw`));
    } catch {
      setAskSubmit(false);
      setWeekErr("Couldn't submit the week. Try again.");
      focusLater(() => document.getElementById(`${uid}-submit`));
    } finally {
      setBusy(false);
    }
  };
  const withdraw = async () => {
    setBusy(true);
    try {
      await onWithdraw(weekKey);
      setSubmitted((s) => new Set([...s].filter((k) => k !== weekKey)));
      setSaid("Week reopened. You can change it again.");
      setTimerErr("");
      focusLater(() => document.getElementById(`${uid}-submit`));
    } catch {
      setWeekErr("Couldn't withdraw the week. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const projectOptions = projects.map((p) => ({ value: p.id, label: p.name }));

  return (
    <section className={["fl-tms", className ?? ""].filter(Boolean).join(" ")} data-fl="b.timesheet-week" aria-labelledby={`${uid}-t`} aria-busy={loading || undefined}>
      <h3 id={`${uid}-t`} className="fl-tms-title">
        {title}
      </h3>

      <div className={`fl-tms-timer${running ? " is-running" : ""}`} role="group" aria-label="Timer">
        <div className="fl-tms-tp">
          <label htmlFor={`${uid}-tp`} className="fl-sr">
            Project
          </label>
          <Select
            id={`${uid}-tp`}
            value={timerProject}
            placeholder="Project"
            disabled={!!running || loading}
            invalid={timerErr === "Pick a project first."}
            onChange={(e) => (setTimerProject(e.target.value), setTimerErr(""))}
            options={projectOptions}
          />
        </div>
        <div className="fl-tms-tn">
          <label htmlFor={`${uid}-tn`} className="fl-sr">
            What are you working on?
          </label>
          <TextField
            id={`${uid}-tn`}
            size={40}
            placeholder="What are you working on?"
            autoComplete="off"
            maxLength={80}
            value={timerNote}
            disabled={!!running || loading}
            onChange={(e) => setTimerNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !running) startTimer();
            }}
          />
        </div>
        <span className="fl-tms-clock" role="timer" aria-label={running ? `Running for ${dur(Math.floor(runningSecs / 60))}` : "Stopped"}>
          {clock(runningSecs)}
        </span>
        {running ? (
          <Button id={`${uid}-tgo`} variant="destructive" size={44} icon="stop" onClick={() => void stopTimer()}>
            Stop
          </Button>
        ) : (
          <Button id={`${uid}-tgo`} variant="primary" size={44} icon="play" disabled={loading} onClick={startTimer}>
            Start
          </Button>
        )}
        {timerErr ? (
          <p className="fl-tms-err" role="alert">
            {timerErr}
          </p>
        ) : null}
      </div>

      <div className="fl-tms-weekbar">
        <div className="fl-tms-week" role="group" aria-label="Week">
          <Button id={`${uid}-prev`} variant="tertiary" size={32} icon="chevron-left" iconOnly disabled={offset >= weeksBack || loading} onClick={() => goWeek(offset + 1, "prev")}>
            Previous week
          </Button>
          <span className="fl-tms-week-name">{offset === 0 ? `This week · ${weekLabel}` : weekLabel}</span>
          <Button id={`${uid}-next`} variant="tertiary" size={32} icon="chevron-right" iconOnly disabled={offset === 0 || loading} onClick={() => goWeek(offset - 1, "next")}>
            Next week
          </Button>
        </div>
        <Badge tone={locked ? "success" : "neutral"} led>
          {locked ? "Submitted" : "Open"}
        </Badge>
      </div>

      {loading ? (
        <div className="fl-tms-ghosts" aria-hidden="true">
          <span className="fl-tms-ghost fl-tms-ghost--big" />
          {[0, 1, 2].map((k) => (
            <span key={k} className="fl-tms-ghost" />
          ))}
        </div>
      ) : (
        <>
          <div className="fl-tms-sum">
            <div className="fl-tms-total">
              <p>
                <strong>
                  <Count value={totalMins} fmt={dur} />
                </strong>{" "}
                of {targetHours}h
              </p>
              <span className="fl-tms-bar" role="meter" aria-label="Week total" aria-valuemin={0} aria-valuemax={Math.max(targetMins, totalMins)} aria-valuenow={totalMins} aria-valuetext={`${dur(totalMins)} of ${targetHours} hours`}>
                <span style={{ ["--fl-tms-w" as string]: Math.min(1, totalMins / targetMins) }} />
              </span>
              <p className="fl-tms-bill">
                Billable <strong>{money(billable)}</strong>
              </p>
            </div>
            <figure className="fl-tms-chart">
              <svg viewBox="0 0 140 60" preserveAspectRatio="none" role="img" aria-labelledby={`${uid}-ct`} aria-describedby={`${uid}-cd`}>
                {perDay.map((m, i) => (
                  <rect key={dayKeys[i]} className={`fl-tms-col${dayKeys[i] === todayKey ? " is-today" : ""}${m > dayTarget ? " is-over" : ""}`} x={i * 20 + 4} y="0" width="12" height="60" style={{ ["--h" as string]: m / chartMax, ["--i" as string]: i }} />
                ))}
                <line className="fl-tms-target" x1="0" x2="140" y1={60 - (dayTarget / chartMax) * 60} y2={60 - (dayTarget / chartMax) * 60} />
              </svg>
              <div className="fl-tms-days" aria-hidden="true">
                {days.map((d, i) => (
                  <span key={dayKeys[i]} className={dayKeys[i] === todayKey ? "is-today" : undefined}>
                    {fmtNarrow.format(d)}
                  </span>
                ))}
              </div>
              <figcaption id={`${uid}-ct`} className="fl-sr">
                Hours per day, against a {dur(dayTarget)} daily target
              </figcaption>
              <p id={`${uid}-cd`} className="fl-sr">
                {days.map((d, i) => `${fmtLong.format(d)}: ${perDay[i] ? dur(perDay[i]!) : "none"}`).join(". ")}.
              </p>
            </figure>
          </div>

          {locked ? (
            <p className="fl-tms-locked">
              <Icon name="lock" />
              Submitted. Withdraw the week to change it.
            </p>
          ) : null}

          <div className="fl-tms-list" onKeyDown={rove.onKeyDown}>
            {days.map((d, di) => {
              const key = dayKeys[di]!;
              const rows = inWeek.filter((e) => e.date === key);
              const future = key > todayKey;
              return (
                <section key={key} className={`fl-tms-day${key === todayKey ? " is-today" : ""}`} aria-labelledby={`${uid}-dh-${key}`}>
                  <header className="fl-tms-day-head">
                    <h4 id={`${uid}-dh-${key}`}>
                      {fmtDay.format(d)}
                      {key === todayKey ? <span className="fl-tms-tag">Today</span> : null}
                    </h4>
                    <span className="fl-tms-day-total">{perDay[di] ? dur(perDay[di]!) : future ? "" : "0h"}</span>
                    {!locked && !future ? (
                      <Button
                        id={`${uid}-add-${key}`}
                        variant="tertiary"
                        size={32}
                        icon="plus"
                        aria-label={`Add time on ${fmtLong.format(d)}`}
                        onClick={() => {
                          const last = rows[rows.length - 1];
                          const s = last ? last.end : "09:00";
                          const e = `${pad(Math.min(23, Number(s.slice(0, 2)) + 1))}:${s.slice(3)}`;
                          openDraft({ project: last?.project ?? projects[0]?.id ?? "", note: "", date: key, start: s, end: e > s ? e : "23:59" }, `${uid}-add-${key}`);
                        }}
                      >
                        Add
                      </Button>
                    ) : null}
                  </header>
                  {rows.length ? (
                    <ul className="fl-tms-rows">
                      {rows.map((e) => (
                        <li key={e.id} className={`fl-tms-row fl-tms-row--${toneOf(e.project)}`}>
                          <span className="fl-tms-dot" aria-hidden="true" />
                          <div className="fl-tms-what">
                            <strong>{project(e.project)?.name ?? "Unknown project"}</strong>
                            <span>{e.note || "No note"}</span>
                          </div>
                          <span className="fl-tms-range">
                            {t12(e.start)} – {t12(e.end)}
                          </span>
                          <span className="fl-tms-len">{dur(lengthOf(e))}</span>
                          {!locked ? (
                            <span className="fl-tms-acts">
                              <Button
                                {...rove.item(e.id, 0)}
                                id={`${uid}-ed-${e.id}`}
                                variant="tertiary"
                                size={32}
                                icon="pencil"
                                iconOnly
                                aria-label={`Edit ${project(e.project)?.name}, ${t12(e.start)} to ${t12(e.end)}`}
                                onClick={() => openDraft({ ...e }, `${uid}-ed-${e.id}`)}
                              >
                                Edit
                              </Button>
                              <Button {...rove.item(e.id, 1)} variant="tertiary" size={32} icon="trash" iconOnly aria-label={`Delete ${project(e.project)?.name}, ${t12(e.start)} to ${t12(e.end)}`} onClick={() => setRemoveId(e.id)}>
                                Delete
                              </Button>
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              );
            })}
          </div>

          {!inWeek.length ? (
            <div className="fl-tms-state" data-fl="c.empty-state">
              <Icon name="clock" />
              <strong>No time logged this week</strong>
              <p>Start the timer, or press Add on a day.</p>
            </div>
          ) : null}

          <footer className="fl-tms-foot">
            {weekErr ? (
              <p className="fl-tms-err" role="alert">
                {weekErr}
              </p>
            ) : null}
            {locked ? (
              <Button id={`${uid}-withdraw`} variant="secondary" size={44} icon="refresh" busy={busy} onClick={() => void withdraw()}>
                Withdraw
              </Button>
            ) : (
              <>
                {submitBlock ? <span className="fl-tms-why">{submitBlock}</span> : null}
                <Button id={`${uid}-submit`} variant="primary" size={44} icon="send" disabled={!!submitBlock} onClick={() => setAskSubmit(true)}>
                  Submit week
                </Button>
              </>
            )}
          </footer>
        </>
      )}

      {draft ? (
        <Modal
          variant="form"
          title={draft.id ? "Edit time" : "Add time"}
          description={draft.date && dayKeys.includes(draft.date) ? fmtLong.format(dateOf(draft.date)) : undefined}
          confirmLabel={draft.id ? "Save" : "Add"}
          busy={busy}
          busyLabel="Saving…"
          onConfirm={() => {
            void saveDraft();
            return false;
          }}
          onClose={closeDraft}
        >
          <div className="fl-tms-form">
            <div className="fl-tms-field">
              <label htmlFor={`${uid}-d-project`}>Project</label>
              <Select
                id={`${uid}-d-project`}
                value={draft.project}
                placeholder="Project"
                data-autofocus
                invalid={!!draftErr.project}
                aria-describedby={draftErr.project ? `${uid}-d-project-err` : undefined}
                onChange={(e) => (setDraft((d) => d && { ...d, project: e.target.value }), setDraftErr((x) => ({ ...x, project: undefined })))}
                options={projectOptions}
              />
              {draftErr.project ? (
                <p id={`${uid}-d-project-err`} className="fl-tms-err">
                  {draftErr.project}
                </p>
              ) : null}
            </div>
            <div className="fl-tms-field">
              <label htmlFor={`${uid}-d-note`}>
                Note <span>(optional)</span>
              </label>
              <TextField id={`${uid}-d-note`} size={44} autoComplete="off" maxLength={80} value={draft.note} onChange={(e) => setDraft((d) => d && { ...d, note: e.target.value })} />
            </div>
            <div className="fl-tms-field">
              <label htmlFor={`${uid}-d-date`}>Day</label>
              <TextField
                id={`${uid}-d-date`}
                size={44}
                type="date"
                min={dayKeys[0]}
                max={dayKeys[6]! < todayKey ? dayKeys[6] : todayKey}
                value={draft.date}
                invalid={!!draftErr.date}
                aria-describedby={draftErr.date ? `${uid}-d-date-err` : undefined}
                onChange={(e) => (setDraft((d) => d && { ...d, date: e.target.value }), setDraftErr((x) => ({ ...x, date: undefined })))}
              />
              {draftErr.date ? (
                <p id={`${uid}-d-date-err`} className="fl-tms-err">
                  {draftErr.date}
                </p>
              ) : null}
            </div>
            <div className="fl-tms-pair">
              {(["start", "end"] as const).map((k) => (
                <div key={k} className="fl-tms-field">
                  <label htmlFor={`${uid}-d-${k}`}>{k === "start" ? "Start" : "End"}</label>
                  <TextField
                    id={`${uid}-d-${k}`}
                    size={44}
                    type="time"
                    value={draft[k]}
                    invalid={!!draftErr[k]}
                    aria-describedby={draftErr[k] ? `${uid}-d-${k}-err` : undefined}
                    onChange={(e) => (setDraft((d) => d && { ...d, [k]: e.target.value }), setDraftErr((x) => ({ ...x, [k]: undefined })))}
                  />
                  {draftErr[k] ? (
                    <p id={`${uid}-d-${k}-err`} className="fl-tms-err">
                      {draftErr[k]}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
            <p className="fl-tms-len-note" aria-live="polite">
              {/^\d{2}:\d{2}$/.test(draft.start) && /^\d{2}:\d{2}$/.test(draft.end) && lengthOf(draft) > 0 ? `Length: ${dur(lengthOf(draft))}` : ""}
            </p>
          </div>
        </Modal>
      ) : null}

      {removing ? (
        <Modal
          variant="danger"
          icon="trash"
          title="Delete this time?"
          description={`${project(removing.project)?.name}, ${t12(removing.start)} – ${t12(removing.end)} (${dur(lengthOf(removing))}) on ${fmtLong.format(dateOf(removing.date))}.`}
          confirmLabel="Delete"
          cancelLabel="Keep"
          busy={busy}
          busyLabel="Deleting…"
          onConfirm={() => {
            void doRemove();
            return false;
          }}
          onClose={() => setRemoveId(null)}
        />
      ) : null}

      {askSubmit ? (
        <Modal
          variant="confirm"
          title={`Submit ${dur(totalMins)} for ${weekLabel}?`}
          description={`${inWeek.length} ${inWeek.length === 1 ? "entry" : "entries"}${billable ? `, ${money(billable)} billable` : ""}. The week locks until you withdraw it.`}
          confirmLabel="Submit week"
          busy={busy}
          busyLabel="Submitting…"
          onConfirm={() => {
            void doSubmit();
            return false;
          }}
          onClose={() => setAskSubmit(false)}
        />
      ) : null}

      <p className="fl-sr" role="status" aria-live="polite">
        {loading ? "Loading timesheet…" : said}
      </p>
    </section>
  );
}

// ── The reference sheet: a freelancer's week so far, with the timer running. ──

const NOW = new Date();
const MON = monday(NOW);
/** The weekday (0 = Monday) `w` weeks back. */
const day = (w: number, d: number) => ymd(addDays(MON, -7 * w + d));
const minsAgo = (m: number) => {
  const d = new Date(NOW.getTime() - m * 60000);
  // Keep the running timer inside today.
  const s = d.getDate() === NOW.getDate() ? d : new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate(), 0, 0, 0);
  return `${ymd(s)}T${hm(s)}:${pad(s.getSeconds())}`;
};
/** This week's entries only up to today, so the sample never shows time in the future. */
const upToToday = (list: TsEntry[]) => list.filter((e) => e.date <= ymd(NOW));

// flowcode:sample
const SAMPLE: TimesheetWeekProps = {
  title: "Timesheet",
  targetHours: 40,
  projects: [
    { id: "northwind", name: "Northwind redesign", rate: 9500 },
    { id: "harbor", name: "Harbor Bank app", rate: 11000 },
    { id: "admin", name: "Admin and email" },
    { id: "learning", name: "Learning" },
  ],
  running: { project: "northwind", note: "Checkout page polish", startedAt: minsAgo(47) },
  submitted: [day(1, 0), day(2, 0)],
  entries: upToToday([
    { id: "w1", project: "northwind", note: "Kickoff and wireframes", date: day(0, 0), start: "09:00", end: "12:30" },
    { id: "w2", project: "admin", note: "Invoices", date: day(0, 0), start: "13:15", end: "14:00" },
    { id: "w3", project: "harbor", note: "Login flow", date: day(0, 0), start: "14:00", end: "17:45" },
    { id: "w4", project: "harbor", note: "Design review", date: day(0, 1), start: "09:30", end: "11:00" },
    { id: "w5", project: "northwind", note: "Product page", date: day(0, 1), start: "11:00", end: "16:30" },
    { id: "w6", project: "learning", note: "Accessibility course", date: day(0, 2), start: "08:30", end: "10:00" },
    { id: "w7", project: "harbor", note: "Account settings", date: day(0, 2), start: "10:15", end: "15:45" },
    { id: "w8", project: "northwind", note: "Cart and checkout", date: day(0, 3), start: "09:00", end: "13:00" },
    { id: "w9", project: "harbor", note: "Handoff notes", date: day(0, 4), start: "09:00", end: "12:00" },
    { id: "l1", project: "northwind", note: "Discovery", date: day(1, 0), start: "09:00", end: "17:00" },
    { id: "l2", project: "harbor", note: "Onboarding screens", date: day(1, 1), start: "09:00", end: "16:00" },
    { id: "l3", project: "harbor", note: "Onboarding screens", date: day(1, 2), start: "09:00", end: "17:30" },
    { id: "l4", project: "admin", note: "Proposals", date: day(1, 3), start: "10:00", end: "12:00" },
    { id: "l5", project: "northwind", note: "Style tiles", date: day(1, 4), start: "09:00", end: "15:00" },
  ]),
};

export default function TimesheetWeekPreview() {
  return (
    <section className="fl-section fl-section--canvas" aria-label="Timesheet">
      <div className="fl-wrap">
        <TimesheetWeek
          {...SAMPLE}
          onSave={() => new Promise<void>((done) => window.setTimeout(done, 200))}
          onRemove={() => new Promise<void>((done) => window.setTimeout(done, 200))}
          onSubmit={() => new Promise<void>((done) => window.setTimeout(done, 400))}
          onWithdraw={() => new Promise<void>((done) => window.setTimeout(done, 250))}
        />
      </div>
    </section>
  );
}
