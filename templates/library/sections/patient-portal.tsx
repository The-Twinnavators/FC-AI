/** @flowcode-library patient-portal · Patient portal summary (Cards)
 * Catalog ID: b.patient-portal (block)
 * Function: A patient's home screen in a clinic portal (b.patient-portal): the next appointment with a countdown, reschedule to another open time (choose a day, then a time, confirm, saving and can't-save states) and cancel after a confirm; then tabs for test results in plain words (in the usual range, your doctor will go over it, not back yet) that open to show the value on its range, messages that open, mark themselves read and take a reply, and prescriptions to refill or ask to renew, each with sending, sent and can't-send-with-Retry states.
 * Use it as: import { PatientPortal } from "./patient-portal"; <PatientPortal patient={{ name: "Maya" }} appointment?={{ id, with: "Dr. Ana Ruiz", role, place, start: "2026-10-24T09:30", mode: "in person"|"video", slots?: ["2026-10-27T10:00"] }} results={[{ id, name, date, status: "normal"|"review"|"pending", plain, range?: { low, high, value, unit }, seen? }]} messages={[{ id, from, subject, body, at, unread? }]} prescriptions={[{ id, name, strength, refillsLeft, lastFilled, canRenew }]} loading? onReschedule?={async (start) => void} onCancel?={async () => void} onRead?={async (id) => void} onReply?={async (id, text) => void} onRefill?={async (id, kind) => void} />
 * Built from: c.card, c.tabs.underline, c.accordion, c.badge.status, c.button.primary, c.button.secondary, c.button.tertiary, c.modal.danger, c.text-field.outlined, c.empty-state
 * Look: A white card: "Good morning, Maya" with three small count tiles (new results, unread messages, to refill) that count up and jump to their tab. Then the next visit: a dark date block (day name, big date), "Annual checkup with Dr. Ana Ruiz", the time, place and an "In 3 days" pill, and Reschedule and Cancel visit; Reschedule opens a panel beneath with day chips under a sliding marker and time pills. Below, three underline tabs whose bar slides; results are rows with a status pill that open to a plain sentence and a straight range bar with the value's marker; messages are rows with an unread dot that open to the text and a reply box; prescriptions are rows with refills left and a Request refill button that turns into a green "Requested".
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-warning --color-danger --color-info --surface-bg --surface-radius --surface-shadow --pill-radius --radius-sm --radius-md --space-1 --space-2 --space-3 --space-4 --space-5 --text-xs --text-sm --text-md --text-lg --text-xl --font-display --font-sans --weight-medium --weight-semibold --weight-bold --focus-ring --duration-instant --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger --press-scale
 * Use cases: patient portal; clinic app home; telehealth dashboard; dental or physio practice portal; health plan member app; family doctor app
 * Jobs to be done: know when my next appointment is; move my appointment to a time that suits me; cancel a visit I can't make; understand my test results in plain words; read and answer my care team's messages; get my prescription refilled
 * Keywords: patient portal, appointment, reschedule, test results, lab results, messages, prescriptions, refill, renew, clinic, health record, telehealth
 */
/**
 * Patient portal summary: times are local "YYYY-MM-DDTHH:MM" strings. Results use plain words only: "In the usual
 * range", "Your doctor will go over this" or "Not back yet", never a diagnosis; a result with a `range` also shows the
 * value on a straight bar between the usual low and high. Opening a result marks it seen; opening a message marks it
 * read (onRead) and shows a reply box (onReply; empty replies are stopped).
 * Reschedule opens beneath the appointment: days come from `slots`, each with its open times; Confirm saves the new time
 * (onReschedule) and says so. Cancel visit asks first in a dialog. Prescriptions with refills left offer Request refill;
 * with none left, Ask to renew if `canRenew`, otherwise a note to ask at the next visit.
 * The tabs follow the WAI-ARIA tabs pattern (Left and Right move and select). Prescription rows keep their buttons as one
 * Tab stop (Up and Down). Results and messages open like an accordion, each with its own button. Focus stays on the
 * control that was used or moves to what replaced it.
 * Count tiles count up, the tab bar and the day marker slide, rows open with grid rows (closed rows are inert), the
 * range marker slides to its value, ticks pop and new replies slide in. Everything works and shows with motion off.
 * Adapted from Creative Tim UI (MIT, Copyright (c) 2025 Creative Tim): its dashboard cards, tabs and list blocks,
 * reshaped into a patient's portal home.
 */
/**
 * How to try it
 * - Press Reschedule, pick another day and a time, then Confirm. Press Reschedule again and Cancel the panel.
 * - Open the Cholesterol result: the marker slides along the range.
 * - Press the unread messages tile: the Messages tab opens. Open a message, send an empty reply, then a real one.
 * - In Prescriptions press Request refill: the first one fails in this preview; press Retry.
 * - Press Cancel visit: it asks first.
 *
 * Dependencies: React (useEffect, useId, useMemo, useRef, useState), the library's Button ("./buttons-variants"), Icon
 * ("./icons"), Modal ("./modals-dialogs") and TextField ("./text-fields-states"). Nothing else: nothing fetched at run
 * time. The styles are the library's own fl- classes in templates/library/css/r6a-patient-portal.css.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { TextField } from "./text-fields-states";

// ── b.patient-portal: next appointment, results, messages and prescriptions at a glance. ──

export type PortalAppointment = { id: string; with: string; role: string; place: string; start: string; mode: "in person" | "video"; slots?: string[] };
export type PortalResult = { id: string; name: string; date: string; status: "normal" | "review" | "pending"; plain: string; range?: { low: number; high: number; value: number; unit: string }; seen?: boolean };
export type PortalMessage = { id: string; from: string; subject: string; body: string; at: string; unread?: boolean; replies?: { text: string; at: string }[] };
export type PortalPrescription = { id: string; name: string; strength: string; refillsLeft: number; lastFilled: string; canRenew: boolean };
export type PatientPortalProps = {
  patient: { name: string };
  appointment?: PortalAppointment | null;
  results: PortalResult[];
  messages: PortalMessage[];
  prescriptions: PortalPrescription[];
  locale?: string;
  loading?: boolean;
  onReschedule?: (start: string) => Promise<void>;
  onCancel?: () => Promise<void>;
  onRead?: (id: string) => Promise<void>;
  onReply?: (id: string, text: string) => Promise<void>;
  onRefill?: (id: string, kind: "refill" | "renew") => Promise<void>;
  className?: string;
};

const quick = async () => undefined;
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseAt = (s: string) => new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)), Number(s.slice(11, 13) || 0), Number(s.slice(14, 16) || 0));
const motionOff = () => typeof window === "undefined" || !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off";
const STATUS = {
  normal: { label: "In the usual range", icon: "check" },
  review: { label: "Your doctor will go over this", icon: "info" },
  pending: { label: "Not back yet", icon: "clock" },
} as const;

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
  return <span aria-hidden="true">{Math.round(shown)}</span>;
}

/** True a moment after `on`, so a marker starts at the left and slides to its place; at once when motion is off. */
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

/** A result's value on its usual range: a straight bar with the usual band and a marker. */
function RangeBar({ range, open }: { range: NonNullable<PortalResult["range"]>; open: boolean }) {
  const grown = useGrown(open);
  // The bar runs from half a range below the low to half a range above the high.
  const span = range.high - range.low;
  const lo = range.low - span / 2;
  const hi = range.high + span / 2;
  const at = Math.max(0, Math.min(1, (range.value - lo) / (hi - lo)));
  const inside = range.value >= range.low && range.value <= range.high;
  return (
    <div className="fl-ptp-range">
      <div className="fl-ptp-rangebar" aria-hidden="true">
        <span className="fl-ptp-band" style={{ left: "25%", width: "50%" }} />
        <span className={`fl-ptp-mark${inside ? "" : " is-out"}`} style={{ left: `${(grown ? at : 0) * 100}%` }} />
      </div>
      <p className="fl-ptp-rangetext">
        <span>
          Yours: <strong>{range.value}</strong> {range.unit}
        </span>
        <span>
          Usual: {range.low}–{range.high} {range.unit}
        </span>
      </p>
    </div>
  );
}

type Tab = "results" | "messages" | "prescriptions";
type Send = "idle" | "sending" | "sent" | "error";

export function PatientPortal({ patient, appointment: givenAppt = null, results: givenResults, messages: givenMessages, prescriptions, locale = "en-US", loading = false, onReschedule = quick, onCancel = quick, onRead = quick, onReply = quick, onRefill = quick, className }: PatientPortalProps) {
  const uid = useId().replace(/:/g, "");
  const focusLater = useFocusLater();
  const now = useMemo(() => new Date(), []);
  const [appt, setAppt] = useState(givenAppt);
  const [results, setResults] = useState(givenResults);
  const [messages, setMessages] = useState(givenMessages);
  const [tab, setTab] = useState<Tab>("results");
  const [openRes, setOpenRes] = useState<string | null>(null);
  const [openMsg, setOpenMsg] = useState<string | null>(null);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [replyErr, setReplyErr] = useState<Record<string, string>>({});
  const [replySend, setReplySend] = useState<Record<string, Send>>({});
  const [rx, setRx] = useState<Record<string, Send>>({});
  const [rxRow, setRxRow] = useState(0);
  const [moving, setMoving] = useState(false);
  const [pickDay, setPickDay] = useState("");
  const [pickTime, setPickTime] = useState("");
  const [moveErr, setMoveErr] = useState("");
  const [moveBusy, setMoveBusy] = useState(false);
  const [askCancel, setAskCancel] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [flash, setFlash] = useState(0);
  const [said, setSaid] = useState("");

  const fmtTime = useMemo(() => new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }), [locale]);
  const fmtDay = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short" }), [locale]);
  const fmtMonth = useMemo(() => new Intl.DateTimeFormat(locale, { month: "short" }), [locale]);
  const fmtLong = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric" }), [locale]);
  const fmtShort = useMemo(() => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }), [locale]);
  const when = (s: string) => `${fmtLong.format(parseAt(s))} at ${fmtTime.format(parseAt(s))}`;
  const hour = now.getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const newResults = results.filter((r) => !r.seen && r.status !== "pending").length;
  const unread = messages.filter((m) => m.unread).length;
  const toRefill = prescriptions.filter((p) => (p.refillsLeft > 0 || p.canRenew) && rx[p.id] !== "sent").length;

  // Appointment.
  const start = appt ? parseAt(appt.start) : null;
  const daysAway = start ? Math.round((new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000) : 0;
  const away = daysAway <= 0 ? "Today" : daysAway === 1 ? "Tomorrow" : `In ${daysAway} days`;
  const slotDays = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of appt?.slots ?? []) {
      const k = s.slice(0, 10);
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return [...m.entries()];
  }, [appt]);
  const dayIdx = Math.max(0, slotDays.findIndex(([k]) => k === pickDay));

  const openMove = () => {
    setMoving(true);
    setMoveErr("");
    setPickDay(slotDays[0]?.[0] ?? "");
    setPickTime("");
    focusLater(() => document.querySelector<HTMLInputElement>(`#${uid}-days input:checked`));
  };
  const closeMove = () => {
    setMoving(false);
    focusLater(() => document.getElementById(`${uid}-move`));
  };
  const confirmMove = async () => {
    if (!appt) return;
    if (!pickTime) {
      setMoveErr("Pick a time.");
      document.querySelector<HTMLInputElement>(`#${uid}-times input`)?.focus();
      return;
    }
    setMoveBusy(true);
    setMoveErr("");
    try {
      await onReschedule(pickTime);
      const old = appt.start;
      setAppt({ ...appt, start: pickTime, slots: [...(appt.slots ?? []).filter((s) => s !== pickTime), old].sort() });
      setMoving(false);
      setFlash((f) => f + 1);
      setSaid(`Appointment moved to ${when(pickTime)}.`);
      focusLater(() => document.getElementById(`${uid}-move`));
    } catch {
      setMoveErr("Couldn't move the appointment. That time may have just been taken. Try another or try again.");
    } finally {
      setMoveBusy(false);
    }
  };
  const doCancel = async () => {
    if (!appt) return;
    setCancelBusy(true);
    try {
      await onCancel();
      const was = appt;
      setAppt(null);
      setAskCancel(false);
      setMoving(false);
      setSaid(`Your visit with ${was.with} is canceled.`);
      focusLater(() => document.getElementById(`${uid}-appt-empty`));
    } catch {
      setSaid("Couldn't cancel the visit. Try again.");
    } finally {
      setCancelBusy(false);
    }
  };

  // Tabs.
  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: "results", label: "Results", count: newResults },
    { id: "messages", label: "Messages", count: unread },
    { id: "prescriptions", label: "Prescriptions", count: toRefill },
  ];
  const tabIdx = TABS.findIndex((t) => t.id === tab);
  const onTabsKey = (e: ReactKeyboardEvent<HTMLElement>) => {
    let n = tabIdx;
    if (e.key === "ArrowRight") n = (tabIdx + 1) % TABS.length;
    else if (e.key === "ArrowLeft") n = (tabIdx - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = TABS.length - 1;
    else return;
    e.preventDefault();
    setTab(TABS[n]!.id);
    document.getElementById(`${uid}-tab-${TABS[n]!.id}`)?.focus();
  };
  const jump = (t: Tab) => {
    setTab(t);
    focusLater(() => document.getElementById(`${uid}-tab-${t}`));
  };

  const toggleResult = (r: PortalResult) => {
    const opening = openRes !== r.id;
    setOpenRes(opening ? r.id : null);
    if (opening && !r.seen) setResults((all) => all.map((x) => (x.id === r.id ? { ...x, seen: true } : x)));
  };
  const toggleMessage = (m: PortalMessage) => {
    const opening = openMsg !== m.id;
    setOpenMsg(opening ? m.id : null);
    if (opening && m.unread) {
      setMessages((all) => all.map((x) => (x.id === m.id ? { ...x, unread: false } : x)));
      void onRead(m.id).catch(() => undefined);
    }
  };
  const sendReply = async (m: PortalMessage) => {
    const text = (reply[m.id] ?? "").trim();
    if (!text) {
      setReplyErr((e) => ({ ...e, [m.id]: "Write a reply first." }));
      document.getElementById(`${uid}-r-${m.id}`)?.focus();
      return;
    }
    setReplySend((s) => ({ ...s, [m.id]: "sending" }));
    try {
      await onReply(m.id, text);
      setMessages((all) => all.map((x) => (x.id === m.id ? { ...x, replies: [...(x.replies ?? []), { text, at: new Date().toISOString().slice(0, 16) }] } : x)));
      setReply((r) => ({ ...r, [m.id]: "" }));
      setReplySend((s) => ({ ...s, [m.id]: "sent" }));
      setSaid(`Reply sent to ${m.from}.`);
      focusLater(() => document.getElementById(`${uid}-r-${m.id}`));
    } catch {
      setReplySend((s) => ({ ...s, [m.id]: "error" }));
      setReplyErr((e) => ({ ...e, [m.id]: "Couldn't send. Try again." }));
    }
  };

  const refill = async (p: PortalPrescription, row: number) => {
    const kind = p.refillsLeft > 0 ? "refill" : "renew";
    setRx((s) => ({ ...s, [p.id]: "sending" }));
    setRxRow(row);
    try {
      await onRefill(p.id, kind);
      setRx((s) => ({ ...s, [p.id]: "sent" }));
      setSaid(kind === "refill" ? `Refill requested for ${p.name}.` : `Renewal request sent to your doctor for ${p.name}.`);
      focusLater(() => document.getElementById(`${uid}-rx-${row}`));
    } catch {
      setRx((s) => ({ ...s, [p.id]: "error" }));
      setSaid(`Couldn't send the request for ${p.name}.`);
      focusLater(() => document.getElementById(`${uid}-rx-${row}`));
    }
  };
  const onRxKey = (e: ReactKeyboardEvent<HTMLElement>) => {
    const t = e.target as HTMLElement;
    if (t.dataset.row === undefined) return;
    let r = Number(t.dataset.row);
    if (e.key === "ArrowDown") r = Math.min(prescriptions.length - 1, r + 1);
    else if (e.key === "ArrowUp") r = Math.max(0, r - 1);
    else if (e.key === "Home") r = 0;
    else if (e.key === "End") r = prescriptions.length - 1;
    else return;
    e.preventDefault();
    setRxRow(r);
    document.getElementById(`${uid}-rx-${r}`)?.focus();
  };

  if (loading)
    return (
      <section className={["fl-ptp", className ?? ""].filter(Boolean).join(" ")} data-fl="b.patient-portal" aria-busy="true" aria-label="Patient portal">
        <div className="fl-ptp-ghosts" aria-hidden="true">
          <span className="fl-ptp-ghost fl-ptp-ghost--title" />
          <span className="fl-ptp-ghost fl-ptp-ghost--card" />
          <span className="fl-ptp-ghost" />
          <span className="fl-ptp-ghost" />
        </div>
        <p className="fl-sr" role="status">
          Loading your portal…
        </p>
      </section>
    );

  return (
    <section className={["fl-ptp", className ?? ""].filter(Boolean).join(" ")} data-fl="b.patient-portal" aria-labelledby={`${uid}-t`}>
      <header className="fl-ptp-head">
        <h3 id={`${uid}-t`} className="fl-ptp-title">
          {greet}, {patient.name}
        </h3>
        <ul className="fl-ptp-tiles" aria-label="At a glance">
          {[
            { t: "results" as Tab, n: newResults, one: "new result", many: "new results", icon: "chart" },
            { t: "messages" as Tab, n: unread, one: "unread message", many: "unread messages", icon: "mail" },
            { t: "prescriptions" as Tab, n: toRefill, one: "to refill", many: "to refill", icon: "refresh" },
          ].map((x, i) => (
            <li key={x.t} style={{ ["--i" as string]: i }}>
              <button type="button" className={`fl-ptp-tile${x.n ? " is-on" : ""}`} onClick={() => jump(x.t)} aria-label={`${x.n} ${x.n === 1 ? x.one : x.many}. Open ${x.t}.`}>
                <Icon name={x.icon} />
                <strong>
                  <Count value={x.n} />
                </strong>
                <span aria-hidden="true">{x.n === 1 ? x.one : x.many}</span>
              </button>
            </li>
          ))}
        </ul>
      </header>

      {appt && start ? (
        <article className={`fl-ptp-appt${flash ? " is-flash" : ""}`} key={`appt-${flash}`} aria-labelledby={`${uid}-appt`}>
          <div className="fl-ptp-apptmain">
            <div className="fl-ptp-date" aria-hidden="true">
              <span>{fmtDay.format(start)}</span>
              <strong>{start.getDate()}</strong>
              <span>{fmtMonth.format(start)}</span>
            </div>
            <div className="fl-ptp-apptinfo">
              <p className="fl-ptp-eyebrow">
                Next visit <span className="fl-ptp-away">{away}</span>
              </p>
              <h4 id={`${uid}-appt`}>
                {appt.role} with {appt.with}
              </h4>
              <p className="fl-ptp-meta">
                <span>
                  <Icon name="clock" />
                  {when(appt.start)}
                </span>
                <span>
                  <Icon name={appt.mode === "video" ? "play" : "pin"} />
                  {appt.mode === "video" ? "Video visit" : appt.place}
                </span>
              </p>
            </div>
            <div className="fl-ptp-appttools">
              <Button id={`${uid}-move`} variant="secondary" size={40} icon="calendar" aria-expanded={moving} aria-controls={`${uid}-movepanel`} disabled={!slotDays.length} onClick={() => (moving ? closeMove() : openMove())}>
                Reschedule
              </Button>
              <Button variant="tertiary" size={40} onClick={() => setAskCancel(true)}>
                Cancel visit
              </Button>
            </div>
          </div>
          <div id={`${uid}-movepanel`} className={`fl-ptp-move${moving ? " is-open" : ""}`} inert={!moving}>
            <div>
              <fieldset className="fl-ptp-days" id={`${uid}-days`} style={{ ["--x" as string]: dayIdx, ["--n" as string]: Math.max(1, slotDays.length) }}>
                <legend>Day</legend>
                <div>
                  <span className="fl-ptp-daymark" aria-hidden="true" />
                  {slotDays.map(([k]) => {
                    const d = parseAt(`${k}T00:00`);
                    return (
                      <label key={k} className="fl-ptp-day">
                        <input type="radio" name={`${uid}-day`} value={k} checked={pickDay === k} onChange={() => (setPickDay(k), setPickTime(""), setMoveErr(""))} />
                        <span>{fmtDay.format(d)}</span>
                        <strong>{fmtShort.format(d)}</strong>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <fieldset className="fl-ptp-times" id={`${uid}-times`} aria-describedby={moveErr ? `${uid}-move-err` : undefined}>
                <legend>Time</legend>
                <div key={pickDay}>
                  {(slotDays.find(([k]) => k === pickDay)?.[1] ?? []).map((s, i) => (
                    <label key={s} className="fl-ptp-time" style={{ ["--i" as string]: i }}>
                      <input type="radio" name={`${uid}-time`} value={s} checked={pickTime === s} onChange={() => (setPickTime(s), setMoveErr(""))} />
                      {fmtTime.format(parseAt(s))}
                    </label>
                  ))}
                </div>
              </fieldset>
              {moveErr ? (
                <p id={`${uid}-move-err`} className="fl-ptp-err" role="alert">
                  {moveErr}
                </p>
              ) : null}
              <div className="fl-ptp-movefoot">
                <span className="fl-ptp-muted">{pickTime ? `New time: ${when(pickTime)}` : "Pick a day and a time."}</span>
                <Button variant="tertiary" size={40} disabled={moveBusy} onClick={closeMove}>
                  Keep current time
                </Button>
                <Button variant="primary" size={40} icon="check" busy={moveBusy} onClick={() => void confirmMove()}>
                  {moveBusy ? "Moving…" : "Confirm"}
                </Button>
              </div>
            </div>
          </div>
        </article>
      ) : (
        <div className="fl-ptp-noappt" id={`${uid}-appt-empty`} tabIndex={-1} data-fl="c.empty-state">
          <Icon name="calendar" />
          <span>
            <strong>No upcoming visits</strong>
            <span>Book a visit when you need one.</span>
          </span>
        </div>
      )}

      <div className="fl-ptp-tabs" role="tablist" aria-label="Your records" onKeyDown={onTabsKey} style={{ ["--x" as string]: tabIdx }}>
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" id={`${uid}-tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`${uid}-panel`} tabIndex={tab === t.id ? 0 : -1} className="fl-ptp-tab" onClick={() => setTab(t.id)}>
            {t.label}
            {t.count ? <span className="fl-ptp-count">{t.count}</span> : null}
          </button>
        ))}
        <span className="fl-ptp-tabbar" aria-hidden="true" />
      </div>

      <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${tab}`} className="fl-ptp-panel" key={tab}>
        {tab === "results" ? (
          results.length ? (
            <ul className="fl-ptp-list">
              {results.map((r, i) => {
                const open = openRes === r.id;
                const s = STATUS[r.status];
                return (
                  <li key={r.id} className={`fl-ptp-item is-${r.status}${open ? " is-open" : ""}`} style={{ ["--i" as string]: i }}>
                    <button type="button" className="fl-ptp-rowbtn" aria-expanded={open} aria-controls={`${uid}-res-${r.id}`} disabled={r.status === "pending"} onClick={() => toggleResult(r)}>
                      {!r.seen && r.status !== "pending" ? (
                        <>
                          <span className="fl-ptp-new" aria-hidden="true" />
                          <span className="fl-sr">New: </span>
                        </>
                      ) : null}
                      <span className="fl-ptp-rowmain">
                        <strong>{r.name}</strong>
                        <span>{fmtShort.format(parseAt(`${r.date}T00:00`))}</span>
                      </span>
                      <span className={`fl-ptp-pill is-${r.status}`}>
                        <Icon name={s.icon} />
                        {s.label}
                      </span>
                      {r.status !== "pending" ? <Icon name="chevron-down" /> : <span className="fl-ptp-chev-space" />}
                    </button>
                    <div id={`${uid}-res-${r.id}`} className="fl-ptp-more" inert={!open}>
                      <div>
                        <p>{r.plain}</p>
                        {r.range ? <RangeBar range={r.range} open={open} /> : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="fl-ptp-empty">No results yet.</p>
          )
        ) : tab === "messages" ? (
          messages.length ? (
            <ul className="fl-ptp-list">
              {messages.map((m, i) => {
                const open = openMsg === m.id;
                const st = replySend[m.id] ?? "idle";
                return (
                  <li key={m.id} className={`fl-ptp-item${open ? " is-open" : ""}${m.unread ? " is-unread" : ""}`} style={{ ["--i" as string]: i }}>
                    <button type="button" className="fl-ptp-rowbtn" aria-expanded={open} aria-controls={`${uid}-msg-${m.id}`} onClick={() => toggleMessage(m)}>
                      <span className={`fl-ptp-dot${m.unread ? " is-on" : ""}`} aria-hidden="true" />
                      <span className="fl-ptp-rowmain">
                        <strong>
                          {m.subject}
                          {m.unread ? <span className="fl-sr"> (unread)</span> : null}
                        </strong>
                        <span>
                          {m.from} · {fmtShort.format(parseAt(m.at))}
                        </span>
                      </span>
                      <Icon name="chevron-down" />
                    </button>
                    <div id={`${uid}-msg-${m.id}`} className="fl-ptp-more" inert={!open}>
                      <div>
                        <p className="fl-ptp-body">{m.body}</p>
                        {m.replies?.length ? (
                          <ul className="fl-ptp-replies" aria-label="Your replies">
                            {m.replies.map((rp, k) => (
                              <li key={k}>
                                <span>You · just now</span>
                                {rp.text}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        <form
                          className="fl-ptp-reply"
                          noValidate
                          onSubmit={(e) => {
                            e.preventDefault();
                            void sendReply(m);
                          }}
                        >
                          <label htmlFor={`${uid}-r-${m.id}`} className="fl-sr">
                            Reply to {m.from}
                          </label>
                          <TextField
                            id={`${uid}-r-${m.id}`}
                            multiline
                            autoGrow
                            rows={1}
                            maxLength={1000}
                            placeholder={`Reply to ${m.from}`}
                            value={reply[m.id] ?? ""}
                            invalid={!!replyErr[m.id]}
                            aria-describedby={replyErr[m.id] ? `${uid}-re-${m.id}` : undefined}
                            onChange={(e) => {
                              setReply((r) => ({ ...r, [m.id]: e.target.value }));
                              setReplyErr((x) => ({ ...x, [m.id]: "" }));
                              if (st === "sent") setReplySend((s) => ({ ...s, [m.id]: "idle" }));
                            }}
                          />
                          <Button type="submit" variant="primary" size={40} icon="send" busy={st === "sending"}>
                            {st === "sending" ? "Sending…" : "Send"}
                          </Button>
                          {replyErr[m.id] ? (
                            <p id={`${uid}-re-${m.id}`} className="fl-ptp-err">
                              {replyErr[m.id]}
                            </p>
                          ) : null}
                        </form>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="fl-ptp-empty">No messages.</p>
          )
        ) : prescriptions.length ? (
          <ul className="fl-ptp-list" onKeyDown={onRxKey}>
            {prescriptions.map((p, i) => {
              const st = rx[p.id] ?? "idle";
              const kind = p.refillsLeft > 0 ? "refill" : p.canRenew ? "renew" : null;
              const rr = Math.min(rxRow, prescriptions.length - 1);
              return (
                <li key={p.id} className="fl-ptp-item fl-ptp-rx" style={{ ["--i" as string]: i }}>
                  <span className="fl-ptp-rowmain">
                    <strong>
                      {p.name} <span>{p.strength}</span>
                    </strong>
                    <span>
                      {p.refillsLeft > 0 ? `${p.refillsLeft} ${p.refillsLeft === 1 ? "refill" : "refills"} left` : "No refills left"} · last filled {fmtShort.format(parseAt(`${p.lastFilled}T00:00`))}
                    </span>
                    {st === "error" ? <span className="fl-ptp-err">Couldn't send the request.</span> : null}
                  </span>
                  {st === "sent" ? (
                    <span className="fl-ptp-sent" id={`${uid}-rx-${i}`} data-row={i} tabIndex={rr === i ? 0 : -1} onFocus={() => setRxRow(i)}>
                      <span className="fl-ptp-tick" aria-hidden="true">
                        <Icon name="check" />
                      </span>
                      {kind === "refill" ? "Refill requested" : "Renewal requested"}
                    </span>
                  ) : kind ? (
                    <Button
                      id={`${uid}-rx-${i}`}
                      data-row={i}
                      tabIndex={rr === i ? 0 : -1}
                      variant={st === "error" ? "primary" : "secondary"}
                      size={32}
                      icon={st === "error" ? "refresh" : kind === "refill" ? "refresh" : "send"}
                      busy={st === "sending"}
                      aria-label={st === "error" ? `Retry ${p.name}` : `${kind === "refill" ? "Request refill" : "Ask to renew"}: ${p.name}`}
                      onFocus={() => setRxRow(i)}
                      onClick={() => void refill(p, i)}
                    >
                      {st === "sending" ? "Sending…" : st === "error" ? "Retry" : kind === "refill" ? "Request refill" : "Ask to renew"}
                    </Button>
                  ) : (
                    <span className="fl-ptp-muted" id={`${uid}-rx-${i}`} data-row={i} tabIndex={rr === i ? 0 : -1} onFocus={() => setRxRow(i)}>
                      Ask at your next visit
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="fl-ptp-empty">No prescriptions.</p>
        )}
      </div>

      {askCancel && appt ? (
        <Modal
          variant="danger"
          icon="calendar"
          title="Cancel this visit?"
          description={`${appt.role} with ${appt.with}, ${when(appt.start)}. The time goes back to the clinic.`}
          confirmLabel="Cancel visit"
          cancelLabel="Keep visit"
          busy={cancelBusy}
          busyLabel="Canceling…"
          onConfirm={() => {
            void doCancel();
            return false;
          }}
          onClose={() => setAskCancel(false)}
        />
      ) : null}

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>
    </section>
  );
}

// ── The reference sheet: a visit in three days, five results, three messages and four prescriptions. ──

const NOW = new Date();
const on = (days: number, time = "00:00") => {
  const d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + days);
  return `${ymd(d)}T${time}`;
};

// flowcode:sample
const SAMPLE: PatientPortalProps = {
  patient: { name: "Maya" },
  appointment: {
    id: "a1",
    with: "Dr. Ana Ruiz",
    role: "Annual checkup",
    place: "Riverside Family Clinic, Room 4",
    start: on(3, "09:30"),
    mode: "in person",
    slots: [on(4, "08:30"), on(4, "11:00"), on(4, "15:15"), on(5, "09:00"), on(5, "13:45"), on(7, "10:30"), on(7, "16:00"), on(8, "08:00")],
  },
  results: [
    { id: "r1", name: "Cholesterol, total", date: on(-2).slice(0, 10), status: "review", plain: "A little above the usual range. Dr. Ruiz will go over it with you at your checkup.", range: { low: 125, high: 200, value: 214, unit: "mg/dL" } },
    { id: "r2", name: "Blood sugar (A1C)", date: on(-2).slice(0, 10), status: "normal", plain: "In the usual range. Nothing you need to do.", range: { low: 4, high: 5.6, value: 5.3, unit: "%" } },
    { id: "r3", name: "Vitamin D", date: on(-2).slice(0, 10), status: "normal", plain: "In the usual range.", range: { low: 30, high: 100, value: 42, unit: "ng/mL" }, seen: true },
    { id: "r4", name: "Thyroid (TSH)", date: on(-9).slice(0, 10), status: "normal", plain: "In the usual range.", range: { low: 0.4, high: 4, value: 1.8, unit: "mIU/L" }, seen: true },
    { id: "r5", name: "Urine test", date: on(-1).slice(0, 10), status: "pending", plain: "The lab hasn't sent this back yet. We'll let you know." },
  ],
  messages: [
    { id: "m1", from: "Dr. Ana Ruiz", subject: "Before your checkup", body: "Hi Maya, please don't eat for 8 hours before your visit so we can repeat one blood test. Water is fine. See you on the day.", at: on(-1, "16:20"), unread: true },
    { id: "m2", from: "Riverside Front Desk", subject: "Your insurance card", body: "Thanks for sending a photo of your new insurance card. It's on file now, so there's nothing else to do.", at: on(-4, "10:05") },
    { id: "m3", from: "Nurse Jordan Lee", subject: "Flu shot", body: "Flu shots are available at your checkup if you'd like one. Just let us know when you arrive.", at: on(-8, "12:40") },
  ],
  prescriptions: [
    { id: "p1", name: "Lisinopril", strength: "10 mg", refillsLeft: 2, lastFilled: on(-26).slice(0, 10), canRenew: true },
    { id: "p2", name: "Atorvastatin", strength: "20 mg", refillsLeft: 0, lastFilled: on(-31).slice(0, 10), canRenew: true },
    { id: "p3", name: "Albuterol inhaler", strength: "90 mcg", refillsLeft: 1, lastFilled: on(-60).slice(0, 10), canRenew: true },
    { id: "p4", name: "Amoxicillin", strength: "500 mg", refillsLeft: 0, lastFilled: on(-120).slice(0, 10), canRenew: false },
  ],
};

export default function PatientPortalPreview() {
  const [loading, setLoading] = useState(true);
  const tries = useRef(0);
  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 600);
    return () => window.clearTimeout(t);
  }, []);
  const wait = (ms: number) => new Promise<void>((ok) => window.setTimeout(ok, ms));
  return (
    <section className="fl-section fl-section--canvas" aria-label="Patient portal summary">
      <div className="fl-wrap">
        <PatientPortal
          {...SAMPLE}
          loading={loading}
          onReschedule={() => wait(600)}
          onCancel={() => wait(500)}
          onRead={() => wait(100)}
          onReply={() => wait(500)}
          onRefill={() =>
            new Promise<void>((ok, fail) =>
              window.setTimeout(() => {
                tries.current += 1;
                if (tries.current === 1) fail(new Error("offline"));
                else ok();
              }, 600),
            )
          }
        />
      </div>
    </section>
  );
}
