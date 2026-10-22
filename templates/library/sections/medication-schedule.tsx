/** @flowcode-library medication-schedule · Medication schedule (Cards)
 * Catalog ID: b.medication-schedule (block)
 * Function: One person's medicines for the day and the week (b.medication-schedule): doses grouped by time, each marked taken or skipped with Undo, a warning on a dose that is past due and not marked, today's progress, supplies running low with Request refill (sending, sent, can't-send-with-Retry), a week grid of what was taken, skipped or missed with how often each medicine was taken, and medicines added with their strength, times of day and supply, checked before saving.
 * Use it as: import { MedicationSchedule } from "./medication-schedule"; <MedicationSchedule title="My medicines" medicines={[{ id, name, strength: "10 mg", form?: "tablet", instructions?: "With food", times: ["08:00", "20:00"], supply?: { left: 9, perDose: 1, refillAt: 7 }, tone?: "accent"|"success"|"warning"|"secondary" }]} log={[{ medId, date: "2026-10-21", time: "08:00", status: "taken"|"skipped", at?: "08:04" }]} now?={new Date()} graceMinutes?={60} loading? onLog?={async (medId, date, time, status|null) => void} onRefill?={async (medId) => void} onAdd?={async (medicine) => void} />
 * Built from: c.tabs.pills, c.progress.bar, c.badge.status, c.modal.form, c.text-field.outlined, c.button.primary, c.button.secondary, c.button.tertiary, c.empty-state
 * Look: A white card: the title and date with a Today / This week switch whose dark marker slides; a sunken strip with "4 of 7 doses taken" over a row of short segments that fill green one by one. Today lists time groups ("8:00 AM", "1:00 PM") and in each a row per medicine: a color dot, the name and strength, how to take it, and Take and Skip buttons; a taken row shows a green tick that pops and "Taken 8:04 AM" with Undo; a missed one gets a straight amber bar down its left side and "Not marked yet. It was due at 8:00 AM." Beside it, a Running low panel with a draining bar per medicine and Request refill. This week is a grid of medicines by day with filled, hollow and amber dots and a percentage that counts up.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-secondary --color-success --color-warning --color-danger --surface-bg --surface-radius --surface-shadow --pill-radius --radius-sm --radius-md --space-1 --space-2 --space-3 --space-4 --space-5 --text-xs --text-sm --text-md --text-lg --font-display --font-sans --weight-medium --weight-semibold --weight-bold --focus-ring --duration-instant --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger --press-scale
 * Use cases: medication reminder app; pill tracker; caregiver app; patient portal medicines tab; pharmacy app; senior care dashboard
 * Jobs to be done: see which medicines to take now; mark a dose as taken or skipped; notice a dose I haven't marked; know when I'm running low and ask for a refill; see how regularly I took my medicines this week; add a new medicine with its times
 * Keywords: medication, medicine, pills, dose, schedule, reminder, refill, pharmacy, adherence, taken, skipped, missed dose, caregiver
 */
/**
 * Medication schedule: dates are local "YYYY-MM-DD" strings and times "HH:MM". A dose is the pair of a medicine and one
 * of its times on a day. It is "due" until its time plus `graceMinutes` has passed; after that, if it isn't marked, it
 * shows a missed-dose warning in plain words (it does not give medical advice: it points to the label or a pharmacist).
 * Marking a dose taken lowers the medicine's supply by `perDose`; Undo puts it back. A medicine shows under Running low
 * when its supply is at or under `refillAt`; the days left are the supply over the doses a day.
 * The Today / This week switch is a WAI-ARIA tab list (Left and Right move and select). The dose rows keep their
 * buttons as one Tab stop: Up and Down move between rows, Left and Right between a row's buttons. After Take, Skip or
 * Undo, focus stays on the same row. onLog may return a promise: the mark shows at once and goes back if it fails.
 * Ticks pop, segments and supply bars fill or drain, percentages count up, rows slide in, the tab marker slides and
 * the add dialog rises in. Everything works and shows with motion off.
 * Adapted from HyperUI (MIT, Copyright (c) Mark Mead): its timelines, toggles, progress bars and alerts, reshaped into
 * a dose-by-dose medication schedule.
 */
/**
 * How to try it
 * - Press Take on a dose: the tick pops and a segment fills. Press Undo.
 * - Find the missed-dose row (amber bar) and mark it.
 * - Tab to a dose's buttons and move with the arrow keys.
 * - Press Request refill on Metformin: the first try fails in this preview; press Retry.
 * - Switch to This week with the arrow keys; then press Add medicine and save it empty, then with two times.
 *
 * Dependencies: React (useEffect, useId, useMemo, useRef, useState), the library's Button ("./buttons-variants"), Icon
 * ("./icons"), Modal ("./modals-dialogs") and TextField ("./text-fields-states"). Nothing else: nothing fetched at run
 * time. The styles are the library's own fl- classes in templates/library/css/r6a-medication-schedule.css.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { TextField } from "./text-fields-states";

// ── b.medication-schedule: doses by time with taken, skipped and missed, refills and a week view. ──

export type MedTone = "accent" | "success" | "warning" | "secondary";
export type Medicine = {
  id: string;
  name: string;
  strength: string;
  form?: string;
  instructions?: string;
  /** "HH:MM" times of day. */
  times: string[];
  supply?: { left: number; perDose: number; refillAt?: number };
  tone?: MedTone;
};
export type DoseStatus = "taken" | "skipped";
export type DoseLog = { medId: string; date: string; time: string; status: DoseStatus; at?: string };
export type MedicationScheduleProps = {
  title: string;
  medicines: Medicine[];
  log: DoseLog[];
  /** The time the schedule is drawn for; now when left out. */
  now?: Date;
  /** Minutes after a dose's time before an unmarked dose counts as missed. */
  graceMinutes?: number;
  locale?: string;
  loading?: boolean;
  onLog?: (medId: string, date: string, time: string, status: DoseStatus | null) => Promise<void>;
  onRefill?: (medId: string) => Promise<void>;
  onAdd?: (medicine: Medicine) => Promise<void>;
  className?: string;
};

const quick = async () => undefined;
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const motionOff = () => typeof window === "undefined" || !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off";
const keyOf = (medId: string, date: string, time: string) => `${medId}|${date}|${time}`;
const TONES: MedTone[] = ["accent", "success", "secondary", "warning"];

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

function Pct({ value }: { value: number }) {
  const shown = useCountUp(value);
  return (
    <>
      <span aria-hidden="true">{Math.round(shown)}%</span>
      <span className="fl-sr">{Math.round(value)}%</span>
    </>
  );
}

/** True a moment after `on`, so bars start empty and fill; at once when motion is off. */
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

type Draft = { name: string; strength: string; instructions: string; times: { id: string; v: string }[]; left: string; perDose: string };
type Refill = "idle" | "sending" | "sent" | "error";
let seq = 0;
const newId = (p: string) => `${p}${Date.now().toString(36)}${(seq += 1)}`;

export function MedicationSchedule({ title, medicines: given, log: givenLog, now: givenNow, graceMinutes = 60, locale = "en-US", loading = false, onLog = quick, onRefill = quick, onAdd = quick, className }: MedicationScheduleProps) {
  const uid = useId().replace(/:/g, "");
  const focusLater = useFocusLater();
  const [clockNow, setClockNow] = useState(() => givenNow ?? new Date());
  useEffect(() => {
    if (givenNow) return setClockNow(givenNow);
    const t = window.setInterval(() => setClockNow(new Date()), 60000);
    return () => window.clearInterval(t);
  }, [givenNow]);
  const now = clockNow;
  const today = ymd(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const [meds, setMeds] = useState(given);
  const [log, setLog] = useState(() => new Map(givenLog.map((l) => [keyOf(l.medId, l.date, l.time), l])));
  const [tab, setTab] = useState<"today" | "week">("today");
  const [cell, setCell] = useState({ r: 0, c: 0 });
  const [refills, setRefills] = useState<Record<string, Refill>>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftErr, setDraftErr] = useState<{ name?: string; strength?: string; times?: string; left?: string; save?: string }>({});
  const [saving, setSaving] = useState(false);
  const [said, setSaid] = useState("");
  const grown = useGrown(!loading);

  const fmtTime = useMemo(() => new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }), [locale]);
  const fmtDate = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric" }), [locale]);
  const fmtDay = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short" }), [locale]);
  const fmtLongDay = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "long", month: "short", day: "numeric" }), [locale]);
  const t12 = (t: string) => fmtTime.format(new Date(2000, 0, 1, Number(t.slice(0, 2)), Number(t.slice(3, 5))));

  // Today's doses, by time.
  const doses = meds
    .flatMap((m) => m.times.map((time) => ({ med: m, time })))
    .sort((a, b) => mins(a.time) - mins(b.time) || a.med.name.localeCompare(b.med.name));
  const groups: { time: string; rows: typeof doses }[] = [];
  for (const d of doses) {
    const g = groups[groups.length - 1];
    if (g && g.time === d.time) g.rows.push(d);
    else groups.push({ time: d.time, rows: [d] });
  }
  const taken = doses.filter((d) => log.get(keyOf(d.med.id, today, d.time))?.status === "taken").length;
  const missedCount = doses.filter((d) => !log.has(keyOf(d.med.id, today, d.time)) && mins(d.time) + graceMinutes < nowMin).length;
  const low = meds.filter((m) => m.supply && m.supply.left <= (m.supply.refillAt ?? 7));

  const mark = async (med: Medicine, time: string, status: DoseStatus | null, row: number) => {
    const k = keyOf(med.id, today, time);
    const before = log.get(k);
    const apply = (to: DoseLog | undefined) => {
      setLog((m) => {
        const n = new Map(m);
        if (to) n.set(k, to);
        else n.delete(k);
        return n;
      });
      // Supply follows taken doses.
      const was = before?.status === "taken" ? 1 : 0;
      const will = to?.status === "taken" ? 1 : 0;
      if (was !== will && med.supply) setMeds((all) => all.map((x) => (x.id === med.id && x.supply ? { ...x, supply: { ...x.supply, left: Math.max(0, x.supply.left + (was - will) * x.supply.perDose) } } : x)));
    };
    const next: DoseLog | undefined = status ? { medId: med.id, date: today, time, status, at: hm(new Date()) } : undefined;
    apply(next);
    setCell({ r: row, c: 0 });
    setSaid(status === "taken" ? `${med.name} ${t12(time)} marked taken.` : status === "skipped" ? `${med.name} ${t12(time)} marked skipped.` : `${med.name} ${t12(time)} unmarked.`);
    focusLater(() => document.getElementById(`${uid}-d${row}-0`));
    try {
      await onLog(med.id, today, time, status);
    } catch {
      // Put it back the way it was.
      setLog((m) => {
        const n = new Map(m);
        if (before) n.set(k, before);
        else n.delete(k);
        return n;
      });
      const was = before?.status === "taken" ? 1 : 0;
      const will = next?.status === "taken" ? 1 : 0;
      if (was !== will && med.supply) setMeds((all) => all.map((x) => (x.id === med.id && x.supply ? { ...x, supply: { ...x.supply, left: Math.max(0, x.supply.left - (was - will) * x.supply.perDose) } } : x)));
      setSaid(`Couldn't save ${med.name} ${t12(time)}. Try again.`);
    }
  };

  const onRowsKey = (e: ReactKeyboardEvent<HTMLElement>) => {
    const t = e.target as HTMLElement;
    if (t.dataset.r === undefined) return;
    let r = Number(t.dataset.r);
    let c = Number(t.dataset.c);
    if (e.key === "ArrowDown") r = Math.min(doses.length - 1, r + 1);
    else if (e.key === "ArrowUp") r = Math.max(0, r - 1);
    else if (e.key === "ArrowRight") c += 1;
    else if (e.key === "ArrowLeft") c = Math.max(0, c - 1);
    else if (e.key === "Home") (r = 0), (c = 0);
    else if (e.key === "End") (r = doses.length - 1), (c = 0);
    else return;
    e.preventDefault();
    // A row may have one button (Undo) or two (Take, Skip).
    const el = document.getElementById(`${uid}-d${r}-${c}`) ?? document.getElementById(`${uid}-d${r}-${(c = c > 0 ? c - 1 : 0)}`);
    setCell({ r, c });
    el?.focus();
  };

  const refill = async (m: Medicine) => {
    setRefills((s) => ({ ...s, [m.id]: "sending" }));
    setSaid(`Sending a refill request for ${m.name}…`);
    try {
      await onRefill(m.id);
      setRefills((s) => ({ ...s, [m.id]: "sent" }));
      setSaid(`Refill requested for ${m.name}. Your pharmacy will let you know when it's ready.`);
      focusLater(() => document.getElementById(`${uid}-rf-${m.id}`));
    } catch {
      setRefills((s) => ({ ...s, [m.id]: "error" }));
      setSaid(`Couldn't send the refill request for ${m.name}.`);
      focusLater(() => document.getElementById(`${uid}-rfb-${m.id}`));
    }
  };

  const switchTab = (to: "today" | "week", focus = false) => {
    setTab(to);
    if (focus) document.getElementById(`${uid}-tab-${to}`)?.focus();
  };
  const onTabsKey = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const to = e.key === "Home" ? "today" : e.key === "End" ? "week" : tab === "today" ? "week" : "today";
      switchTab(to, true);
    }
  };

  const openAdd = () => {
    setDraftErr({});
    setDraft({ name: "", strength: "", instructions: "", times: [{ id: newId("t"), v: "08:00" }], left: "", perDose: "1" });
  };
  const saveAdd = async () => {
    if (!draft) return;
    const err: typeof draftErr = {};
    const name = draft.name.trim();
    if (!name) err.name = "Enter the medicine's name.";
    else if (meds.some((m) => m.name.toLowerCase() === name.toLowerCase())) err.name = `${name} is already on your list.`;
    if (!draft.strength.trim()) err.strength = "Enter the strength, as on the label (for example 10 mg).";
    const times = draft.times.map((t) => t.v).filter(Boolean);
    if (!times.length) err.times = "Add at least one time.";
    else if (new Set(times).size !== times.length) err.times = "Two times are the same.";
    if (draft.left !== "" && (!Number.isFinite(Number(draft.left)) || Number(draft.left) < 0)) err.left = "Enter how many are left, or leave it empty.";
    setDraftErr(err);
    if (err.name || err.strength || err.times || err.left) {
      document.getElementById(`${uid}-${err.name ? "name" : err.strength ? "str" : err.times ? `t-${draft.times[0]?.id}` : "left"}`)?.focus();
      return;
    }
    const med: Medicine = {
      id: newId("m"),
      name,
      strength: draft.strength.trim(),
      instructions: draft.instructions.trim() || undefined,
      times: [...times].sort((a, b) => mins(a) - mins(b)),
      supply: draft.left !== "" ? { left: Number(draft.left), perDose: Math.max(1, Number(draft.perDose) || 1), refillAt: 7 } : undefined,
      tone: TONES[meds.length % TONES.length],
    };
    setSaving(true);
    try {
      await onAdd(med);
      setMeds((all) => [...all, med]);
      setDraft(null);
      setTab("today");
      setSaid(`${med.name} added at ${med.times.map(t12).join(" and ")}.`);
      focusLater(() => document.getElementById(`${uid}-add`));
    } catch {
      setDraftErr({ save: "Couldn't save. Try again." });
    } finally {
      setSaving(false);
    }
  };

  // The week: the last seven days up to today.
  const week = Array.from({ length: 7 }, (_, i) => addDays(now, i - 6));
  const weekCells = (m: Medicine) =>
    week.map((d) => {
      const date = ymd(d);
      return m.times.map((time) => {
        const l = log.get(keyOf(m.id, date, time));
        const passed = date < today || (date === today && mins(time) + graceMinutes < nowMin);
        const state = l ? l.status : passed ? "missed" : "due";
        return { date, time, state };
      });
    });

  let rowIndex = -1;
  const tabIndexOf = tab === "today" ? 0 : 1;

  return (
    <section className={["fl-mds", className ?? ""].filter(Boolean).join(" ")} data-fl="b.medication-schedule" aria-labelledby={`${uid}-t`} aria-busy={loading || undefined}>
      <header className="fl-mds-head">
        <div>
          <h3 id={`${uid}-t`} className="fl-mds-title">
            {title}
          </h3>
          <p className="fl-mds-date">{fmtDate.format(now)}</p>
        </div>
        <div className="fl-mds-tabs" role="tablist" aria-label="View" onKeyDown={onTabsKey} style={{ ["--x" as string]: tabIndexOf }}>
          <span className="fl-mds-marker" aria-hidden="true" />
          {(["today", "week"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              id={`${uid}-tab-${k}`}
              aria-selected={tab === k}
              aria-controls={`${uid}-panel`}
              tabIndex={tab === k ? 0 : -1}
              className="fl-mds-tab"
              onClick={() => switchTab(k)}
            >
              {k === "today" ? "Today" : "This week"}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="fl-mds-ghosts" aria-hidden="true">
          <span className="fl-mds-ghost fl-mds-ghost--strip" />
          {[0, 1, 2].map((k) => (
            <span key={k} className="fl-mds-ghost" />
          ))}
        </div>
      ) : !meds.length ? (
        <div className="fl-mds-state" data-fl="c.empty-state">
          <Icon name="calendar" />
          <strong>No medicines yet</strong>
          <p>Add a medicine and the times you take it.</p>
          <Button id={`${uid}-add`} variant="primary" size={40} icon="plus" onClick={openAdd}>
            Add medicine
          </Button>
        </div>
      ) : (
        <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${tab}`} className="fl-mds-panel" key={tab}>
          {tab === "today" ? (
            <div className="fl-mds-today">
              <div className="fl-mds-main">
                <div className="fl-mds-progress">
                  <p>
                    <strong>
                      {taken} of {doses.length}
                    </strong>{" "}
                    doses taken
                    {missedCount ? (
                      <span className="fl-mds-flag">
                        <Icon name="alert" />
                        {missedCount} not marked
                      </span>
                    ) : taken === doses.length ? (
                      <span className="fl-mds-flag is-good">
                        <Icon name="check" />
                        All done today
                      </span>
                    ) : null}
                  </p>
                  <span className="fl-mds-segs" role="progressbar" aria-label="Doses taken today" aria-valuemin={0} aria-valuemax={doses.length} aria-valuenow={taken} aria-valuetext={`${taken} of ${doses.length} doses taken`}>
                    {doses.map((d, i) => {
                      const s = log.get(keyOf(d.med.id, today, d.time))?.status;
                      return <span key={`${d.med.id}${d.time}`} className={grown && s ? `is-${s}` : undefined} style={{ ["--i" as string]: i }} />;
                    })}
                  </span>
                </div>

                <div className="fl-mds-groups" onKeyDown={onRowsKey}>
                  {groups.map((g) => {
                    const passed = mins(g.time) + graceMinutes < nowMin;
                    const soon = !passed && mins(g.time) - nowMin <= 60 && mins(g.time) - nowMin >= -graceMinutes;
                    return (
                      <section key={g.time} className="fl-mds-group" aria-labelledby={`${uid}-g${g.time}`}>
                        <h4 id={`${uid}-g${g.time}`} className="fl-mds-time">
                          <Icon name="clock" />
                          {t12(g.time)}
                          {soon ? <span className="fl-mds-now">Now</span> : null}
                        </h4>
                        <ul className="fl-mds-rows">
                          {g.rows.map(({ med, time }) => {
                            rowIndex += 1;
                            const r = rowIndex;
                            const l = log.get(keyOf(med.id, today, time));
                            const missed = !l && passed;
                            const tone = med.tone ?? "accent";
                            // One Tab stop for all the rows' buttons; a row with only Undo takes column 0.
                            const stop = (c: number) => (Math.min(cell.r, doses.length - 1) === r && Math.min(cell.c, l ? 0 : 1) === c ? 0 : -1);
                            return (
                              <li key={med.id + time} className={`fl-mds-row is-${tone}${l ? ` is-${l.status}` : ""}${missed ? " is-missed" : ""}`} style={{ ["--i" as string]: Math.min(r, 8) }}>
                                {missed ? <span className="fl-mds-bar" aria-hidden="true" /> : null}
                                <span className="fl-mds-dot" aria-hidden="true" />
                                <span className="fl-mds-med">
                                  <strong>
                                    {med.name} <span>{med.strength}</span>
                                  </strong>
                                  {med.instructions || med.form ? <span>{[med.form, med.instructions].filter(Boolean).join(" · ")}</span> : null}
                                  {missed ? (
                                    <span className="fl-mds-missed">
                                      <Icon name="alert" />
                                      Not marked yet. It was due at {t12(time)}. Not sure what to do? Check the label or ask your pharmacist.
                                    </span>
                                  ) : null}
                                </span>
                                <span className="fl-mds-acts">
                                  {l ? (
                                    <>
                                      <span className={`fl-mds-status is-${l.status}`}>
                                        <span className="fl-mds-tick" aria-hidden="true">
                                          <Icon name={l.status === "taken" ? "check" : "close"} />
                                        </span>
                                        {l.status === "taken" ? `Taken${l.at ? ` ${t12(l.at)}` : ""}` : "Skipped"}
                                      </span>
                                      <Button
                                        id={`${uid}-d${r}-0`}
                                        data-r={r}
                                        data-c={0}
                                        tabIndex={stop(0)}
                                        variant="tertiary"
                                        size={32}
                                        aria-label={`Undo ${med.name} ${t12(time)}`}
                                        onFocus={() => setCell({ r, c: 0 })}
                                        onClick={() => void mark(med, time, null, r)}
                                      >
                                        Undo
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button
                                        id={`${uid}-d${r}-0`}
                                        data-r={r}
                                        data-c={0}
                                        tabIndex={stop(0)}
                                        variant="primary"
                                        size={32}
                                        icon="check"
                                        aria-label={`Take ${med.name} ${t12(time)}`}
                                        onFocus={() => setCell({ r, c: 0 })}
                                        onClick={() => void mark(med, time, "taken", r)}
                                      >
                                        Take
                                      </Button>
                                      <Button
                                        id={`${uid}-d${r}-1`}
                                        data-r={r}
                                        data-c={1}
                                        tabIndex={stop(1)}
                                        variant="tertiary"
                                        size={32}
                                        aria-label={`Skip ${med.name} ${t12(time)}`}
                                        onFocus={() => setCell({ r, c: 1 })}
                                        onClick={() => void mark(med, time, "skipped", r)}
                                      >
                                        Skip
                                      </Button>
                                    </>
                                  )}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    );
                  })}
                </div>
              </div>

              <aside className="fl-mds-side" aria-labelledby={`${uid}-low`}>
                <h4 id={`${uid}-low`}>Running low</h4>
                {low.length ? (
                  <ul className="fl-mds-low">
                    {low.map((m, i) => {
                      const perDay = m.times.length * (m.supply?.perDose ?? 1);
                      const daysLeft = Math.floor((m.supply?.left ?? 0) / Math.max(1, perDay));
                      const st = refills[m.id] ?? "idle";
                      const cap = Math.max(30, (m.supply?.refillAt ?? 7) * 3);
                      return (
                        <li key={m.id} style={{ ["--i" as string]: i }}>
                          <p>
                            <strong>
                              {m.name} {m.strength}
                            </strong>
                            <span>
                              {m.supply?.left} left · {daysLeft === 0 ? "runs out today" : `about ${daysLeft} ${daysLeft === 1 ? "day" : "days"}`}
                            </span>
                          </p>
                          <span className={`fl-mds-supply${daysLeft <= 2 ? " is-urgent" : ""}`} aria-hidden="true">
                            <span style={{ ["--w" as string]: grown ? Math.min(1, (m.supply?.left ?? 0) / cap) : 1 }} />
                          </span>
                          {st === "sent" ? (
                            <p className="fl-mds-sent" id={`${uid}-rf-${m.id}`} tabIndex={-1}>
                              <span className="fl-mds-tick" aria-hidden="true">
                                <Icon name="check" />
                              </span>
                              Refill requested
                            </p>
                          ) : (
                            <>
                              {st === "error" ? <p className="fl-mds-err">Couldn't send the request.</p> : null}
                              <Button id={`${uid}-rfb-${m.id}`} variant="secondary" size={32} icon={st === "error" ? "refresh" : "send"} busy={st === "sending"} onClick={() => void refill(m)}>
                                {st === "sending" ? "Sending…" : st === "error" ? "Retry" : "Request refill"}
                              </Button>
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="fl-mds-muted">Your supplies look fine.</p>
                )}
                <Button id={`${uid}-add`} variant="tertiary" size={32} icon="plus" onClick={openAdd}>
                  Add medicine
                </Button>
              </aside>
            </div>
          ) : (
            <div className="fl-mds-week" role="region" aria-label="This week" tabIndex={0}>
              <table className="fl-mds-grid">
                <caption className="fl-sr">Doses over the last seven days. Each cell lists every dose that day: taken, skipped, not marked, or still to come.</caption>
                <thead>
                  <tr>
                    <th scope="col">Medicine</th>
                    {week.map((d) => (
                      <th key={ymd(d)} scope="col" className={ymd(d) === today ? "is-today" : undefined}>
                        <span aria-hidden="true">{fmtDay.format(d).slice(0, 2)}</span>
                        <span className="fl-sr">{fmtLongDay.format(d)}</span>
                      </th>
                    ))}
                    <th scope="col">Taken</th>
                  </tr>
                </thead>
                <tbody>
                  {meds.map((m, mi) => {
                    const cells = weekCells(m);
                    const all = cells.flat().filter((c) => c.state !== "due");
                    const pct = all.length ? (all.filter((c) => c.state === "taken").length / all.length) * 100 : 100;
                    return (
                      <tr key={m.id} className={`is-${m.tone ?? "accent"}`} style={{ ["--i" as string]: mi }}>
                        <th scope="row">
                          <span className="fl-mds-dot" aria-hidden="true" />
                          {m.name}
                        </th>
                        {cells.map((day, di) => (
                          <td key={week[di]!.getTime()}>
                            <span className="fl-mds-dots">
                              {day.map((c, ci) => (
                                <span key={c.time} className={`fl-mds-pip is-${c.state}`} style={{ ["--j" as string]: di * 2 + ci }} aria-hidden="true" />
                              ))}
                            </span>
                            <span className="fl-sr">
                              {day.map((c) => `${t12(c.time)} ${c.state === "missed" ? "not marked" : c.state === "due" ? "to come" : c.state}`).join(", ")}
                            </span>
                          </td>
                        ))}
                        <td className={`fl-mds-pct${pct >= 90 ? " is-good" : pct < 70 ? " is-low" : ""}`}>
                          <Pct value={pct} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <ul className="fl-mds-legend" aria-hidden="true">
                <li>
                  <span className="fl-mds-pip is-taken" />
                  Taken
                </li>
                <li>
                  <span className="fl-mds-pip is-skipped" />
                  Skipped
                </li>
                <li>
                  <span className="fl-mds-pip is-missed" />
                  Not marked
                </li>
                <li>
                  <span className="fl-mds-pip is-due" />
                  To come
                </li>
              </ul>
            </div>
          )}
        </div>
      )}

      {draft ? (
        <Modal
          variant="form"
          title="Add a medicine"
          confirmLabel="Add medicine"
          busy={saving}
          busyLabel="Saving…"
          onConfirm={() => {
            void saveAdd();
            return false;
          }}
          onClose={() => {
            setDraft(null);
            focusLater(() => document.getElementById(`${uid}-add`));
          }}
        >
          <div className="fl-mds-form">
            <div className="fl-mds-field">
              <label htmlFor={`${uid}-name`}>Name</label>
              <TextField
                id={`${uid}-name`}
                size={40}
                autoComplete="off"
                maxLength={60}
                placeholder="Atorvastatin"
                data-autofocus
                value={draft.name}
                invalid={!!draftErr.name}
                aria-describedby={draftErr.name ? `${uid}-name-err` : undefined}
                onChange={(e) => (setDraft((d) => d && { ...d, name: e.target.value }), setDraftErr((x) => ({ ...x, name: undefined })))}
              />
              {draftErr.name ? (
                <p id={`${uid}-name-err`} className="fl-mds-err">
                  {draftErr.name}
                </p>
              ) : null}
            </div>
            <div className="fl-mds-field">
              <label htmlFor={`${uid}-str`}>Strength</label>
              <TextField
                id={`${uid}-str`}
                size={40}
                autoComplete="off"
                maxLength={30}
                placeholder="20 mg"
                value={draft.strength}
                invalid={!!draftErr.strength}
                aria-describedby={draftErr.strength ? `${uid}-str-err` : undefined}
                onChange={(e) => (setDraft((d) => d && { ...d, strength: e.target.value }), setDraftErr((x) => ({ ...x, strength: undefined })))}
              />
              {draftErr.strength ? (
                <p id={`${uid}-str-err`} className="fl-mds-err">
                  {draftErr.strength}
                </p>
              ) : null}
            </div>
            <fieldset className="fl-mds-times" aria-describedby={draftErr.times ? `${uid}-times-err` : undefined}>
              <legend>Times of day</legend>
              <ul>
                {draft.times.map((t, i) => (
                  <li key={t.id}>
                    <TextField
                      id={`${uid}-t-${t.id}`}
                      size={40}
                      type="time"
                      aria-label={`Time ${i + 1}`}
                      value={t.v}
                      invalid={!!draftErr.times}
                      onChange={(e) => (setDraft((d) => d && { ...d, times: d.times.map((x) => (x.id === t.id ? { ...x, v: e.target.value } : x)) }), setDraftErr((x) => ({ ...x, times: undefined })))}
                    />
                    <Button
                      variant="tertiary"
                      size={32}
                      icon="close"
                      iconOnly
                      disabled={draft.times.length === 1}
                      aria-label={`Remove time ${i + 1}`}
                      onClick={() => {
                        const next = draft.times.filter((x) => x.id !== t.id);
                        setDraft({ ...draft, times: next });
                        focusLater(() => document.getElementById(`${uid}-t-${next[Math.min(i, next.length - 1)]!.id}`));
                      }}
                    >
                      Remove time
                    </Button>
                  </li>
                ))}
              </ul>
              {draft.times.length < 4 ? (
                <Button
                  variant="tertiary"
                  size={32}
                  icon="plus"
                  onClick={() => {
                    const t = { id: newId("t"), v: "20:00" };
                    setDraft({ ...draft, times: [...draft.times, t] });
                    focusLater(() => document.getElementById(`${uid}-t-${t.id}`));
                  }}
                >
                  Add a time
                </Button>
              ) : null}
              {draftErr.times ? (
                <p id={`${uid}-times-err`} className="fl-mds-err">
                  {draftErr.times}
                </p>
              ) : null}
            </fieldset>
            <div className="fl-mds-two">
              <div className="fl-mds-field">
                <label htmlFor={`${uid}-left`}>Left in the pack (optional)</label>
                <TextField
                  id={`${uid}-left`}
                  size={40}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={draft.left}
                  invalid={!!draftErr.left}
                  aria-describedby={draftErr.left ? `${uid}-left-err` : undefined}
                  onChange={(e) => (setDraft((d) => d && { ...d, left: e.target.value }), setDraftErr((x) => ({ ...x, left: undefined })))}
                />
                {draftErr.left ? (
                  <p id={`${uid}-left-err`} className="fl-mds-err">
                    {draftErr.left}
                  </p>
                ) : null}
              </div>
              <div className="fl-mds-field">
                <label htmlFor={`${uid}-per`}>Per dose</label>
                <TextField id={`${uid}-per`} size={40} type="number" inputMode="numeric" min={1} max={10} value={draft.perDose} onChange={(e) => setDraft((d) => d && { ...d, perDose: e.target.value })} />
              </div>
            </div>
            <div className="fl-mds-field">
              <label htmlFor={`${uid}-ins`}>How to take it (optional)</label>
              <TextField id={`${uid}-ins`} size={40} autoComplete="off" maxLength={80} placeholder="With food" value={draft.instructions} onChange={(e) => setDraft((d) => d && { ...d, instructions: e.target.value })} />
            </div>
            {draftErr.save ? (
              <p className="fl-mds-err" role="alert">
                {draftErr.save}
              </p>
            ) : null}
          </div>
        </Modal>
      ) : null}

      <p className="fl-sr" role="status" aria-live="polite">
        {loading ? "Loading medicines…" : said}
      </p>
    </section>
  );
}

// ── The reference sheet: four medicines, a week of history and a day in progress at 2:10 PM. ──

const NOW = new Date();
NOW.setHours(14, 10, 0, 0);
const D = (back: number) => ymd(addDays(NOW, -back));
const MEDS: Medicine[] = [
  { id: "lis", name: "Lisinopril", strength: "10 mg", form: "Tablet", instructions: "Once a day", times: ["08:00"], supply: { left: 24, perDose: 1, refillAt: 7 }, tone: "accent" },
  { id: "met", name: "Metformin", strength: "500 mg", form: "Tablet", instructions: "With breakfast and dinner", times: ["08:00", "19:00"], supply: { left: 5, perDose: 1, refillAt: 8 }, tone: "success" },
  { id: "vitd", name: "Vitamin D3", strength: "1,000 IU", form: "Softgel", instructions: "With lunch", times: ["13:00"], supply: { left: 40, perDose: 1, refillAt: 7 }, tone: "warning" },
  { id: "ator", name: "Atorvastatin", strength: "20 mg", form: "Tablet", instructions: "At bedtime", times: ["22:00"], supply: { left: 3, perDose: 1, refillAt: 7 }, tone: "secondary" },
];
/** Six earlier days, mostly taken, with a few skipped and unmarked doses; today's morning dose of Lisinopril is left unmarked. */
const history = (): DoseLog[] => {
  const out: DoseLog[] = [];
  const gaps = new Set(["met|3|19:00", "vitd|2|13:00", "ator|5|22:00"]);
  const skips = new Set(["vitd|4|13:00", "met|1|19:00"]);
  for (let back = 6; back >= 1; back -= 1)
    for (const m of MEDS)
      for (const time of m.times) {
        const k = `${m.id}|${back}|${time}`;
        if (gaps.has(k)) continue;
        out.push({ medId: m.id, date: D(back), time, status: skips.has(k) ? "skipped" : "taken", at: `${time.slice(0, 3)}${pad(5 + (back % 4) * 3)}` });
      }
  out.push({ medId: "met", date: D(0), time: "08:00", status: "taken", at: "08:12" });
  out.push({ medId: "vitd", date: D(0), time: "13:00", status: "taken", at: "13:20" });
  return out;
};

// flowcode:sample
const SAMPLE: MedicationScheduleProps = {
  title: "My medicines",
  now: NOW,
  graceMinutes: 60,
  medicines: MEDS,
  log: history(),
};

export default function MedicationSchedulePreview() {
  const [loading, setLoading] = useState(true);
  const tries = useRef(0);
  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 600);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <section className="fl-section fl-section--canvas" aria-label="Medication schedule">
      <div className="fl-wrap">
        <MedicationSchedule
          {...SAMPLE}
          loading={loading}
          onLog={() => new Promise<void>((ok) => window.setTimeout(ok, 150))}
          onRefill={() =>
            new Promise<void>((ok, fail) =>
              window.setTimeout(() => {
                tries.current += 1;
                if (tries.current === 1) fail(new Error("offline"));
                else ok();
              }, 700),
            )
          }
          onAdd={() => new Promise<void>((ok) => window.setTimeout(ok, 300))}
        />
      </div>
    </section>
  );
}
