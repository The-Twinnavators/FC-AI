/** @flowcode-library time-off-request · Time-off request (Forms)
 * Catalog ID: b.time-off-request (block)
 * Function: Time off for one person and their manager (b.time-off-request): balances per leave type (left, booked, waiting), a request form with a type, first and last day, half days, a day-by-day strip that skips weekends and holidays and a live day count, checks for past dates, an end before the start, too few days left and days already asked for; the person's own requests with Cancel after a confirm; and a manager's queue with Approve (with Undo), Decline with a reason, and a warning when others on the team are out the same days.
 * Use it as: import { TimeOff } from "./time-off-request"; <TimeOff me={{ name }} types={[{ id, name, allowance, used }]} requests={[{ id, type, start: "2026-11-02", end, startPart: "full"|"am"|"pm", endPart: "full"|"am", days, note, status }]} queue?={[{ id, person: { name, role }, type, start, end, days, note, status, alsoOut: ["Sam"] }]} holidays?={[{ date, name }]} onSubmit?={async (req) => void} onCancel?={async (id) => void} onDecide?={async (id, "approved"|"declined"|"pending", reason?) => void} />
 * Built from: c.segmented.segmented, c.select.outlined, c.text-field.outlined, c.button.primary, c.button.secondary, c.button.tertiary, c.badge.status, c.avatar.person, c.modal.form, c.modal.danger, c.empty-state
 * Look: A white card: the title with a My time off / Approvals switch (with a count); three balance tiles, each a big "8.5 days left" over a straight split bar (used, booked, waiting); then the form in two columns (type, first and last day, half-day selects, a note) beside a sunken summary: a strip of day chips, weekends and holidays faded and half days split, the day count and what is left after it. Below, request rows with a status pill. The Approvals view is a queue of rows: initials, name and role, type, dates, a note, an amber "Also out" line, and Approve and Decline.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-warning --color-danger --color-info --surface-bg --surface-radius --pill-radius --space-1 --space-2 --space-3 --space-4 --space-5 --radius-sm --radius-md --text-xs --text-sm --text-md --text-lg --text-xl --font-display --weight-medium --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger
 * Use cases: time off requests; leave requests; vacation planner; PTO balance; sick days; manager approvals; HR self-service; holiday booking
 * Jobs to be done: see how many days off I have left; ask for days off, including half days; know my request won't clash with holidays or another request; take back a request; approve or decline my team's requests; see who else is out before I approve
 * Keywords: time off, PTO, leave, vacation, holiday, sick day, half day, balance, approval, manager, HR, absence
 */
/**
 * Time-off request: what an employee and their manager use. Balances read allowance minus taken, booked (approved
 * and still ahead) and waiting (sent, not decided); the bar splits the same way. The form counts working days only:
 * weekends and the holiday list are skipped, a half day counts 0.5. It checks on send and focuses the first problem.
 * A sent request lands in the list as Waiting and takes its days from the balance; Cancel asks first and gives them
 * back. Approvals lists the team's requests: Approve marks it at once with an Undo; Decline asks for a reason; a
 * request on days when others are out says who. Arrow keys move between the row buttons (one tab stop per list).
 * Make it the app's own: replace SAMPLE with the person's balances and requests, load the holiday calendar for their
 * region, and make the callbacks save to the leave system.
 * Adapted from Creative Tim UI (MIT License, Copyright (c) 2025 Creative Tim): its CRUD and modal blocks.
 */
/**
 * How to try it
 * - Press Send request with nothing changed: the first day is checked. Pick a first day in the past: it says so.
 * - Pick a Monday to Friday range: the strip shows the days and the count. Set "Starts" to Afternoon: it drops 0.5.
 * - Pick more days than are left: it says how many are left. Pick days you already asked for: it says so.
 * - Send a good request: it appears under My requests as Waiting and the balance moves. Press Cancel on it.
 * - Switch to Approvals: Approve one (Undo shows), Decline one (a reason is required). Use the arrow keys between buttons.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useMemo, useRef, useState), the library's Segmented
 * ("./segmented-control"), Select ("./dropdowns-states"), TextField ("./text-fields-states"), Button
 * ("./buttons-variants"), Badge ("./badges-status"), Avatar ("./avatars-variants"), Modal ("./modals-dialogs") and its
 * inline icon set ("./icons"). Nothing else: no package to install and nothing fetched at run time. The styles are the
 * library's own fl- classes in templates/library/css/r5c-time-off.css.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent, type RefObject } from "react";
import { Avatar } from "./avatars-variants";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { Segmented } from "./segmented-control";
import { TextField } from "./text-fields-states";

// ── b.time-off-request: balances, a request form with half days, my requests, a manager's queue. ──

export type LeaveType = { id: string; name: string; /** days a year */ allowance: number; /** days already taken */ used: number };
export type LeaveStatus = "pending" | "approved" | "declined" | "cancelled";
export type LeaveRequest = {
  id: string;
  type: string;
  /** "YYYY-MM-DD" */
  start: string;
  end: string;
  /** full day, morning only or afternoon only (a single day); full or from the afternoon (several days) */
  startPart: "full" | "am" | "pm";
  /** full day or the morning only on the last day */
  endPart: "full" | "am";
  days: number;
  note: string;
  status: LeaveStatus;
  reason?: string;
};
export type TeamRequest = { id: string; person: { name: string; role: string }; type: string; start: string; end: string; days: number; note: string; status: "pending" | "approved" | "declined"; reason?: string; /** others on the team out on some of these days */ alsoOut: string[] };
export type TimeOffProps = {
  title?: string;
  me: { name: string };
  types: LeaveType[];
  requests: LeaveRequest[];
  /** The manager's queue; leave it out for someone without reports and the Approvals view is hidden. */
  queue?: TeamRequest[];
  holidays?: Array<{ date: string; name: string }>;
  locale?: string;
  onSubmit?: (req: LeaveRequest) => Promise<void>;
  onCancel?: (id: string) => Promise<void>;
  onDecide?: (id: string, status: "approved" | "declined" | "pending", reason?: string) => Promise<void>;
};

const quick = async () => undefined;
const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
};
const addDays = (s: string, n: number) => {
  const d = fromIso(s);
  d.setDate(d.getDate() + n);
  return isoOf(d);
};
const isIso = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const fmtDays = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)} ${n === 1 ? "day" : "days"}`;

/** Roving focus for repeated row buttons: one tab stop; arrows move across a row and between rows. */
function useRoving(box: RefObject<HTMLElement | null>) {
  const cur = useRef<string | null>(null);
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
  return { onFocus, onKeyDown };
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

type DayChip = { iso: string; kind: "work" | "weekend" | "holiday"; part: "full" | "am" | "pm"; holiday?: string };

/** The days from start to end with what each one counts for. */
function dayList(start: string, end: string, startPart: LeaveRequest["startPart"], endPart: LeaveRequest["endPart"], holidays: Map<string, string>): DayChip[] {
  const out: DayChip[] = [];
  if (!isIso(start) || !isIso(end) || end < start) return out;
  for (let d = start, n = 0; d <= end && n < 62; d = addDays(d, 1), n++) {
    const wd = fromIso(d).getDay();
    const kind = holidays.has(d) ? "holiday" : wd === 0 || wd === 6 ? "weekend" : "work";
    let part: DayChip["part"] = "full";
    if (start === end) part = startPart;
    else if (d === start && startPart === "pm") part = "pm";
    else if (d === end && endPart === "am") part = "am";
    out.push({ iso: d, kind, part, holiday: holidays.get(d) });
  }
  return out;
}
const countDays = (list: DayChip[]) => list.reduce((n, d) => n + (d.kind === "work" ? (d.part === "full" ? 1 : 0.5) : 0), 0);

type Errors = Partial<Record<"start" | "end" | "days" | "note", string>>;

export function TimeOff({ title = "Time off", me, types, requests: given, queue: givenQueue, holidays = [], locale = "en-US", onSubmit = quick, onCancel = quick, onDecide = quick }: TimeOffProps) {
  const uid = useId();
  const focusLater = useFocusLater();
  const today = isoOf(new Date());
  const hol = useMemo(() => new Map(holidays.map((h) => [h.date, h.name])), [holidays]);
  const [view, setView] = useState<"mine" | "team">("mine");
  const [mine, setMine] = useState(given);
  const [queue, setQueue] = useState(givenQueue ?? []);
  const [form, setForm] = useState({ type: types[0]?.id ?? "", start: "", end: "", startPart: "full" as LeaveRequest["startPart"], endPart: "full" as LeaveRequest["endPart"], note: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [said, setSaid] = useState("");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [declineId, setDeclineId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonErr, setReasonErr] = useState("");
  const [working, setWorking] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; text: string } | null>(null);
  const [show, setShow] = useState<"waiting" | "decided">("waiting");
  /** Decided here, this visit: they stay in the Waiting list with an Undo until the view changes. */
  const [undoable, setUndoable] = useState<string[]>([]);
  const mineList = useRef<HTMLUListElement>(null);
  const queueList = useRef<HTMLUListElement>(null);
  const rvMine = useRoving(mineList);
  const rvQueue = useRoving(queueList);

  const fmtDay = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" }), [locale]);
  const fmtShort = useMemo(() => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }), [locale]);
  const range = (a: string, b: string) => (a === b ? fmtDay.format(fromIso(a)) : `${fmtShort.format(fromIso(a))} – ${fmtShort.format(fromIso(b))}`);
  const typeName = (id: string) => types.find((t) => t.id === id)?.name ?? id;

  const balances = types.map((t) => {
    const booked = mine.filter((r) => r.type === t.id && r.status === "approved").reduce((n, r) => n + r.days, 0);
    const waiting = mine.filter((r) => r.type === t.id && r.status === "pending").reduce((n, r) => n + r.days, 0);
    return { ...t, booked, waiting, left: Math.max(0, t.allowance - t.used - booked - waiting) };
  });

  const single = form.start && form.end && form.start === form.end;
  const days = dayList(form.start, form.end || form.start, form.startPart, single || !form.end ? "full" : form.endPart, hol);
  const count = countDays(days);
  const bal = balances.find((b) => b.id === form.type);
  const leftAfter = bal ? bal.left - count : 0;

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => {
      const next = { ...f, [k]: v };
      // A one-day request has no "from the afternoon / morning only" split across days: keep the parts valid.
      if (next.start && next.end && next.start !== next.end && next.startPart === "am") next.startPart = "full";
      return next;
    });
    setErrors((e) => ({ ...e, [k === "startPart" || k === "endPart" ? "days" : k]: undefined }));
    setSendError("");
  };

  const check = (): Errors => {
    const e: Errors = {};
    if (!isIso(form.start)) e.start = "Pick a first day.";
    else if (form.start < today) e.start = "Pick today or later.";
    if (!isIso(form.end)) e.end = "Pick a last day.";
    else if (isIso(form.start) && form.end < form.start) e.end = "The last day can't be before the first.";
    if (!e.start && !e.end) {
      const overlap = mine.find((r) => (r.status === "pending" || r.status === "approved") && r.start <= form.end && r.end >= form.start);
      if (count === 0) e.days = "Those days are all weekends or holidays.";
      else if (bal && count > bal.left) e.days = `You have ${fmtDays(bal.left)} of ${bal.name} left.`;
      else if (overlap) e.days = `You already asked for ${range(overlap.start, overlap.end)}.`;
    }
    if (form.note.length > 200) e.note = "Keep the note under 200 characters.";
    return e;
  };

  const send = async () => {
    const e = check();
    setErrors(e);
    const first = (["start", "end", "days", "note"] as const).find((k) => e[k]);
    if (first) {
      setSaid(e[first]!);
      document.getElementById(`${uid}-${first === "days" ? "start-part" : first}`)?.focus();
      return;
    }
    const req: LeaveRequest = { id: `r-${Date.now()}`, type: form.type, start: form.start, end: form.end, startPart: form.startPart, endPart: single ? "full" : form.endPart, days: count, note: form.note.trim(), status: "pending" };
    setSending(true);
    setSendError("");
    try {
      await onSubmit(req);
      setMine((all) => [req, ...all]);
      setForm((f) => ({ ...f, start: "", end: "", startPart: "full", endPart: "full", note: "" }));
      setSaid(`Request sent: ${fmtDays(req.days)} of ${typeName(req.type)}, ${range(req.start, req.end)}. Waiting for approval.`);
      focusLater(() => document.getElementById(`${uid}-mine-${req.id}`));
    } catch {
      setSendError("Couldn't send the request. Check your connection and try again.");
      setSaid("Couldn't send the request.");
    } finally {
      setSending(false);
    }
  };

  const cancelling = cancelId ? mine.find((r) => r.id === cancelId) : undefined;
  const doCancel = async () => {
    if (!cancelling) return;
    setCancelBusy(true);
    try {
      await onCancel(cancelling.id);
      setMine((all) => all.map((r) => (r.id === cancelling.id ? { ...r, status: "cancelled" } : r)));
      setSaid(`Request for ${range(cancelling.start, cancelling.end)} cancelled. ${fmtDays(cancelling.days)} back in your balance.`);
      setCancelId(null);
      focusLater(() => document.getElementById(`${uid}-mine-${cancelling.id}`));
    } catch {
      setSaid("Couldn't cancel. Try again.");
    } finally {
      setCancelBusy(false);
    }
  };

  const decide = async (r: TeamRequest, status: TeamRequest["status"], why?: string) => {
    setWorking(r.id);
    setRowError(null);
    try {
      await onDecide(r.id, status, why);
      setQueue((all) => all.map((x) => (x.id === r.id ? { ...x, status, reason: why } : x)));
      setUndoable((u) => (status === "pending" ? u.filter((x) => x !== r.id) : [...u, r.id]));
      const first = r.person.name.split(" ")[0];
      setSaid(status === "approved" ? `Approved ${first}'s ${typeName(r.type)}.` : status === "declined" ? `Declined ${first}'s request.` : `${first}'s request is back to waiting.`);
      focusLater(() => document.getElementById(status === "pending" ? `${uid}-ok-${r.id}` : `${uid}-undo-${r.id}`) ?? document.getElementById(`${uid}-q-${r.id}`));
    } catch {
      setRowError({ id: r.id, text: "Couldn't save that. Try again." });
      setSaid("Couldn't save that. Try again.");
    } finally {
      setWorking(null);
    }
  };

  const declining = declineId ? queue.find((r) => r.id === declineId) : undefined;
  const waitingCount = queue.filter((r) => r.status === "pending").length;
  const shownQueue = queue.filter((r) => (show === "waiting" ? r.status === "pending" || undoable.includes(r.id) : r.status !== "pending"));

  return (
    <div className="fl-pto" data-fl="b.time-off-request">
      <header className="fl-pto-head">
        <div>
          <h3 className="fl-pto-title">{title}</h3>
          <p className="fl-pto-sub">{me.name}</p>
        </div>
        {givenQueue ? (
          <Segmented
            label="View"
            size="sm"
            value={view}
            onChange={(v) => setView(v as "mine" | "team")}
            options={[
              { value: "mine", label: "My time off" },
              { value: "team", label: waitingCount ? `Approvals (${waitingCount})` : "Approvals" },
            ]}
          />
        ) : null}
      </header>

      {view === "mine" ? (
        <div className="fl-pto-view" key="mine">
          <ul className="fl-pto-bal" aria-label="Balances">
            {balances.map((b, i) => (
              <li key={b.id} className={b.id === form.type ? "is-on" : undefined} style={{ ["--fl-pto-i" as string]: i }}>
                <span className="fl-pto-bal-name">{b.name}</span>
                <strong>
                  {Number.isInteger(b.left) ? b.left : b.left.toFixed(1)}
                  <span> {b.left === 1 ? "day" : "days"} left</span>
                </strong>
                <span className="fl-pto-split" role="img" aria-label={`${b.name}: ${b.used} taken, ${b.booked} booked, ${b.waiting} waiting, ${b.left} left of ${b.allowance}`}>
                  <span className="is-used" style={{ ["--w" as string]: b.used / b.allowance }} />
                  <span className="is-booked" style={{ ["--w" as string]: b.booked / b.allowance }} />
                  <span className="is-wait" style={{ ["--w" as string]: b.waiting / b.allowance }} />
                </span>
                <span className="fl-pto-bal-key">
                  {b.used} taken · {b.booked} booked · {b.waiting} waiting
                </span>
              </li>
            ))}
          </ul>

          <form
            className="fl-pto-form"
            noValidate
            aria-labelledby={`${uid}-form-title`}
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <div className="fl-pto-fields">
              <h4 className="fl-pto-h" id={`${uid}-form-title`}>
                New request
              </h4>
              <div className="fl-pto-field">
                <label htmlFor={`${uid}-type`}>Type</label>
                <Select id={`${uid}-type`} value={form.type} options={types.map((t) => ({ value: t.id, label: t.name }))} onChange={(e) => set("type", e.target.value)} />
              </div>
              <div className="fl-pto-pair">
                <div className="fl-pto-field">
                  <label htmlFor={`${uid}-start`}>First day</label>
                  <TextField
                    id={`${uid}-start`}
                    type="date"
                    size={44}
                    min={today}
                    value={form.start}
                    invalid={Boolean(errors.start)}
                    aria-describedby={errors.start ? `${uid}-start-err` : undefined}
                    onChange={(e) => {
                      const v = e.target.value;
                      set("start", v);
                      if (v && (!form.end || form.end < v)) setForm((f) => ({ ...f, end: v }));
                    }}
                  />
                  {errors.start ? <Err id={`${uid}-start-err`} text={errors.start} /> : null}
                </div>
                <div className="fl-pto-field">
                  <label htmlFor={`${uid}-end`}>Last day</label>
                  <TextField id={`${uid}-end`} type="date" size={44} min={form.start || today} value={form.end} invalid={Boolean(errors.end)} aria-describedby={errors.end ? `${uid}-end-err` : undefined} onChange={(e) => set("end", e.target.value)} />
                  {errors.end ? <Err id={`${uid}-end-err`} text={errors.end} /> : null}
                </div>
              </div>
              <div className="fl-pto-pair">
                <div className="fl-pto-field">
                  <label htmlFor={`${uid}-start-part`}>{single || !form.end ? "Day" : "Starts"}</label>
                  <Select
                    id={`${uid}-start-part`}
                    value={form.startPart}
                    aria-describedby={errors.days ? `${uid}-days-err` : undefined}
                    options={single || !form.end ? [{ value: "full", label: "Full day" }, { value: "am", label: "Morning only" }, { value: "pm", label: "Afternoon only" }] : [{ value: "full", label: "Full day" }, { value: "pm", label: "Afternoon" }]}
                    onChange={(e) => set("startPart", e.target.value as LeaveRequest["startPart"])}
                  />
                </div>
                {single || !form.end ? null : (
                  <div className="fl-pto-field">
                    <label htmlFor={`${uid}-end-part`}>Ends</label>
                    <Select id={`${uid}-end-part`} value={form.endPart} options={[{ value: "full", label: "Full day" }, { value: "am", label: "Morning" }]} onChange={(e) => set("endPart", e.target.value as LeaveRequest["endPart"])} />
                  </div>
                )}
              </div>
              <div className="fl-pto-field">
                <label htmlFor={`${uid}-note`}>
                  Note <span>(optional)</span>
                </label>
                <TextField id={`${uid}-note`} multiline rows={2} value={form.note} placeholder="Anything your manager should know" invalid={Boolean(errors.note)} aria-describedby={errors.note ? `${uid}-note-err` : undefined} onChange={(e) => set("note", e.target.value)} />
                {errors.note ? <Err id={`${uid}-note-err`} text={errors.note} /> : null}
              </div>
            </div>

            <div className="fl-pto-sum" aria-label="Summary">
              {days.length ? (
                <ol className="fl-pto-strip" aria-label="Days">
                  {days.slice(0, 21).map((d, i) => (
                    <li key={d.iso} className={`is-${d.kind}${d.part !== "full" && d.kind === "work" ? ` is-${d.part}` : ""}`} style={{ ["--fl-pto-i" as string]: Math.min(i, 10) }} title={d.holiday ?? undefined}>
                      <span>{fmtDay.format(fromIso(d.iso)).split(",")[0]}</span>
                      <strong>{fromIso(d.iso).getDate()}</strong>
                      <span className="fl-sr">{d.kind === "holiday" ? `holiday, ${d.holiday}` : d.kind === "weekend" ? "weekend" : d.part === "am" ? "morning" : d.part === "pm" ? "afternoon" : "full day"}</span>
                    </li>
                  ))}
                  {days.length > 21 ? <li className="is-more">+{days.length - 21}</li> : null}
                </ol>
              ) : (
                <p className="fl-pto-hint">
                  <Icon name="calendar" />
                  Pick dates to see the days.
                </p>
              )}
              <p className="fl-pto-count" aria-live="polite">
                <strong>{fmtDays(count)}</strong>
                {bal && days.length ? <span className={leftAfter < 0 ? "is-over" : undefined}>{leftAfter < 0 ? `${fmtDays(-leftAfter)} over` : `${fmtDays(leftAfter)} of ${bal.name} left after`}</span> : null}
              </p>
              {days.some((d) => d.kind === "holiday") ? (
                <p className="fl-pto-hint">
                  <Icon name="info" />
                  {days
                    .filter((d) => d.kind === "holiday")
                    .map((d) => d.holiday)
                    .join(", ")}{" "}
                  not counted.
                </p>
              ) : null}
              {errors.days ? <Err id={`${uid}-days-err`} text={errors.days} /> : null}
              {sendError ? (
                <p className="fl-pto-alert" role="alert">
                  <Icon name="alert" />
                  {sendError}
                </p>
              ) : null}
              <Button type="submit" variant="primary" size={44} icon="send" busy={sending} block>
                {sending ? "Sending…" : "Send request"}
              </Button>
            </div>
          </form>

          <section className="fl-pto-mine" aria-labelledby={`${uid}-mine-title`}>
            <h4 className="fl-pto-h" id={`${uid}-mine-title`}>
              My requests
            </h4>
            {mine.length === 0 ? (
              <div className="fl-pto-empty" data-fl="c.empty-state">
                <Icon name="calendar" />
                <strong>No requests yet</strong>
                <p>Your requests and their answers show here.</p>
              </div>
            ) : (
              <ul className="fl-pto-rows" ref={mineList} onKeyDown={rvMine.onKeyDown} onFocus={rvMine.onFocus}>
                {mine.map((r, i) => {
                  const canCancel = (r.status === "pending" || r.status === "approved") && r.start >= today;
                  return (
                    <li key={r.id} id={`${uid}-mine-${r.id}`} tabIndex={-1} className={`fl-pto-row is-${r.status}`} data-rv-row style={{ ["--fl-pto-i" as string]: Math.min(i, 6) }}>
                      <div className="fl-pto-what">
                        <strong>{range(r.start, r.end)}</strong>
                        <span>
                          {typeName(r.type)} · {fmtDays(r.days)}
                          {r.startPart !== "full" || r.endPart !== "full" ? " · half day" : ""}
                        </span>
                        {r.reason ? <span className="fl-pto-reason">“{r.reason}”</span> : null}
                      </div>
                      <Badge tone={r.status === "approved" ? "success" : r.status === "pending" ? "warning" : r.status === "declined" ? "danger" : "neutral"} led>
                        {r.status === "pending" ? "Waiting" : r.status === "approved" ? "Approved" : r.status === "declined" ? "Declined" : "Cancelled"}
                      </Badge>
                      <div className="fl-pto-act">
                        {canCancel ? (
                          <Button variant="tertiary" size={40} data-rv={`${r.id}:cancel`} onClick={() => setCancelId(r.id)} aria-label={`Cancel request for ${range(r.start, r.end)}`}>
                            Cancel
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      ) : (
        <div className="fl-pto-view" key="team">
          <div className="fl-pto-qtools">
            <Segmented
              label="Show"
              size="sm"
              value={show}
              onChange={(v) => {
                setShow(v as "waiting" | "decided");
                setUndoable([]);
              }}
              options={[
                { value: "waiting", label: `Waiting (${waitingCount})` },
                { value: "decided", label: "Decided" },
              ]}
            />
          </div>
          {shownQueue.length === 0 ? (
            <div className="fl-pto-empty" data-fl="c.empty-state">
              <Icon name={show === "waiting" ? "check" : "clock"} />
              <strong>{show === "waiting" ? "All caught up" : "Nothing decided yet"}</strong>
              <p>{show === "waiting" ? "New requests from your team show here." : "Requests you approve or decline show here."}</p>
            </div>
          ) : (
            <ul className="fl-pto-rows fl-pto-queue" ref={queueList} aria-label={show === "waiting" ? "Waiting for you" : "Decided"} onKeyDown={rvQueue.onKeyDown} onFocus={rvQueue.onFocus}>
              {shownQueue.map((r, i) => (
                <li key={r.id} id={`${uid}-q-${r.id}`} tabIndex={-1} className={`fl-pto-qrow is-${r.status}`} data-rv-row style={{ ["--fl-pto-i" as string]: Math.min(i, 6) }}>
                  <Avatar name={r.person.name} size={40} tone={(["a", "b", "c", "d", "e"] as const)[r.person.name.length % 5]} decorative />
                  <div className="fl-pto-what">
                    <strong>
                      {r.person.name} <span>{r.person.role}</span>
                    </strong>
                    <span>
                      {typeName(r.type)} · {range(r.start, r.end)} · {fmtDays(r.days)}
                    </span>
                    {r.note ? <span className="fl-pto-note">{r.note}</span> : null}
                    {r.alsoOut.length && r.status === "pending" ? (
                      <span className="fl-pto-clash">
                        <Icon name="users" />
                        Also out: {r.alsoOut.join(", ")}
                      </span>
                    ) : null}
                    {r.reason ? <span className="fl-pto-reason">“{r.reason}”</span> : null}
                  </div>
                  <div className="fl-pto-act">
                    {r.status === "pending" ? (
                      <>
                        <Button id={`${uid}-ok-${r.id}`} variant="primary" size={40} icon="check" busy={working === r.id} data-rv={`${r.id}:ok`} onClick={() => void decide(r, "approved")} aria-label={`Approve ${r.person.name}, ${range(r.start, r.end)}`}>
                          Approve
                        </Button>
                        <Button
                          variant="secondary"
                          size={40}
                          disabled={working === r.id}
                          data-rv={`${r.id}:no`}
                          onClick={() => {
                            setReason("");
                            setReasonErr("");
                            setDeclineId(r.id);
                          }}
                          aria-label={`Decline ${r.person.name}, ${range(r.start, r.end)}`}
                        >
                          Decline
                        </Button>
                      </>
                    ) : (
                      <div className="fl-pto-done">
                        <Badge tone={r.status === "approved" ? "success" : "danger"} led>
                          {r.status === "approved" ? "Approved" : "Declined"}
                        </Badge>
                        {undoable.includes(r.id) ? (
                          <button type="button" className="fl-pto-link" id={`${uid}-undo-${r.id}`} data-rv={`${r.id}:undo`} disabled={working === r.id} onClick={() => void decide(r, "pending")}>
                            Undo<span className="fl-sr"> decision for {r.person.name}</span>
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                  {rowError?.id === r.id ? <Err text={rowError.text} alert /> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {cancelling ? (
        <Modal
          variant="danger"
          icon="calendar"
          title="Cancel this request?"
          description={`${typeName(cancelling.type)}, ${range(cancelling.start, cancelling.end)}. ${fmtDays(cancelling.days)} go back to your balance${cancelling.status === "approved" ? " and your manager is told" : ""}.`}
          confirmLabel="Cancel request"
          cancelLabel="Keep it"
          busy={cancelBusy}
          busyLabel="Cancelling…"
          onConfirm={() => {
            void doCancel();
            return false;
          }}
          onClose={() => setCancelId(null)}
        />
      ) : null}

      {declining ? (
        <Modal
          variant="form"
          title={`Decline ${declining.person.name.split(" ")[0]}'s request?`}
          description={`${typeName(declining.type)}, ${range(declining.start, declining.end)}. They'll see your reason.`}
          confirmLabel="Decline"
          busy={working === declining.id}
          busyLabel="Declining…"
          onConfirm={() => {
            if (!reason.trim()) {
              setReasonErr("Give a reason.");
              document.getElementById(`${uid}-why`)?.focus();
              return false;
            }
            const r = declining;
            void decide(r, "declined", reason.trim()).then(() => setDeclineId(null));
            return false;
          }}
          onClose={() => setDeclineId(null)}
        >
          <div className="fl-pto-field">
            <label htmlFor={`${uid}-why`}>Reason</label>
            <TextField
              id={`${uid}-why`}
              multiline
              rows={3}
              data-autofocus
              value={reason}
              placeholder="e.g. Launch week: can we move it a week later?"
              invalid={Boolean(reasonErr)}
              aria-describedby={reasonErr ? `${uid}-why-err` : undefined}
              onChange={(e) => {
                setReason(e.target.value);
                setReasonErr("");
              }}
            />
            {reasonErr ? <Err id={`${uid}-why-err`} text={reasonErr} /> : null}
          </div>
        </Modal>
      ) : null}

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

function Err({ id, text, alert }: { id?: string; text: string; alert?: boolean }) {
  return (
    <p className="fl-pto-err" id={id} role={alert ? "alert" : undefined}>
      <Icon name="alert" />
      {text}
    </p>
  );
}

/** A weekday some days from today (rolled forward past a weekend), so the sample stays current. */
const workday = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return isoOf(d);
};
const nextMonday = (weeks: number) => {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7) + weeks * 7);
  return isoOf(d);
};

// flowcode:sample
const SAMPLE: TimeOffProps = {
  title: "Time off",
  me: { name: "Jordan Lee · Operations" },
  types: [
    { id: "vac", name: "Vacation", allowance: 20, used: 7 },
    { id: "sick", name: "Sick", allowance: 10, used: 2 },
    { id: "personal", name: "Personal", allowance: 3, used: 1 },
  ],
  holidays: [
    { date: addDays(nextMonday(3), 3), name: "Founders' Day" },
    { date: addDays(nextMonday(5), 4), name: "Winter break" },
  ],
  requests: [
    { id: "m1", type: "vac", start: nextMonday(4), end: addDays(nextMonday(4), 4), startPart: "full", endPart: "full", days: 5, note: "Family trip", status: "approved" },
    { id: "m2", type: "personal", start: workday(9), end: workday(9), startPart: "pm", endPart: "full", days: 0.5, note: "Moving day", status: "pending" },
    { id: "m3", type: "vac", start: addDays(nextMonday(-6), 0), end: addDays(nextMonday(-6), 1), startPart: "full", endPart: "full", days: 2, note: "", status: "declined", reason: "Quarter close: let's find another week." },
  ],
  queue: [
    { id: "q1", person: { name: "Priya Shah", role: "Warehouse lead" }, type: "vac", start: nextMonday(2), end: addDays(nextMonday(2), 4), days: 5, note: "Wedding in Austin", status: "pending", alsoOut: ["Sam Ortiz"] },
    { id: "q2", person: { name: "Sam Ortiz", role: "Picker" }, type: "sick", start: workday(1), end: workday(1), days: 1, note: "Doctor's appointment", status: "pending", alsoOut: [] },
    { id: "q3", person: { name: "Mei Chen", role: "Dispatcher" }, type: "personal", start: workday(6), end: workday(6), days: 0.5, note: "Afternoon only", status: "pending", alsoOut: [] },
    { id: "q4", person: { name: "Tomás Reyes", role: "Driver" }, type: "vac", start: nextMonday(1), end: addDays(nextMonday(1), 1), days: 2, note: "", status: "approved", alsoOut: [] },
  ],
};

export default function TimeOffPreview() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap">
        <TimeOff {...SAMPLE} />
      </div>
    </section>
  );
}
