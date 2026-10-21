/** @flowcode-library booking-flow · Appointment booking flow (Forms)
 * Catalog ID: b.booking-flow (block)
 * Function: A whole appointment booking (b.booking-flow) for a salon, studio or clinic: pick a service, a staff member or "Anyone available", a day and a free time, then your details; a summary stays beside the steps; Book shows booking, slot-taken and confirmed states, and the confirmation can be rescheduled or cancelled (after a confirm).
 * Use it as: import { BookingFlow } from "./booking-flow"; <BookingFlow title business timeZone services={[{ id, name, minutes, price(cents), note, staff: ["ana"] }]} staff={[{ id, name, role }]} hours={{ open: "09:00", close: "18:00", closed: [0] }} isTaken?={(staffId, day, time) => boolean} daysAhead?={30} onBook?={async (booking) => ({ ref })} onCancel?={async (ref) => ...} />
 * Built from: c.date-picker.inline, c.radio, c.avatar.person, c.text-field.outlined, c.checkbox, c.segmented.segmented, c.modal.danger, c.button.primary, c.button.secondary, c.button.tertiary
 * Look: A gray page with two white cards: on the left four named steps over one straight progress bar and the current step (service cards with length and price, staff cards with initials, a month calendar beside a grid of time chips, or the details form); on the right a booking summary with the service, who, when and the price. The confirmation is one centered card with a green tick, the details and Reschedule and Cancel buttons.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-warning --color-danger --surface-radius --pill-radius --space-1 --space-2 --space-3 --space-4 --space-5 --radius-md --text-xs --text-sm --text-md --text-lg --text-xl --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance
 * Use cases: appointment booking; salon booking; barber booking; class booking; massage or spa booking; clinic appointment; tutoring session; reschedule or cancel a booking
 * Jobs to be done: choose what I want done; book with someone I like or whoever is free; find a time that suits me; know it is booked and when; move or cancel it without calling
 * Keywords: booking, appointment, service, staff, time slot, schedule, reschedule, cancel, salon, studio, clinic, steps
 */
/**
 * Appointment booking flow: four steps and a confirmation. Service lists what can be booked with its length and price;
 * Staff lists only the people who do that service, plus "Anyone available" (the first free person is given at
 * booking). Time shows a month (closed days and days past the window are off; arrow keys move, Enter picks) and that
 * day's start times as radio chips, the taken ones struck through. Details checks name and email, and a phone when a
 * text reminder is asked for. Book shows "Booking…", then the confirmation, or "That time was just taken" with the
 * time marked taken and a way back to the times. From the confirmation, Reschedule returns to Time and Move keeps the
 * same reference; Cancel asks first, then shows Book again. Prices are in cents and are paid at the appointment.
 * Make it the app's own: replace SAMPLE with the services, staff, hours and a real isTaken, and make onBook and
 * onCancel call the scheduling service.
 * Adapted from Tailblocks (MIT License, Copyright (c) 2020 Mert Cukuren): its numbered steps block.
 */
/**
 * How to try it
 * - Press Continue without a service: the message shows. Pick Color and gloss, Continue.
 * - Pick Jordan (or Anyone available), Continue. Pick a day (try the arrow keys and Enter), then a time.
 * - On Details press Book with the fields empty: the errors show. Tick "Text me a reminder" without a phone.
 * - Set Test result to "Slot taken" and Book: the warning shows and the time is now taken. See times, pick another.
 * - Set "Books" and Book: the confirmation shows. Press Reschedule, pick a new time and Move appointment.
 * - Press Cancel appointment: it asks first. Confirm, then Book again starts over.
 *
 * Dependencies: React (useEffect, useId, useMemo, useRef, useState), the library's Calendar and toIso/fromIso
 * ("./date-picker"), Radio and Checkbox ("./checkboxes-radios"), Avatar ("./avatars-variants"), TextField
 * ("./text-fields-states"), Segmented ("./segmented-control"), Modal ("./modals-dialogs"), Button ("./buttons-variants")
 * and its inline icon set ("./icons"). Nothing else: no package to install and nothing fetched at run time. The styles
 * are the library's own fl- classes in templates/library/css/r4b-booking-flow.css (the time chips use the date
 * picker's fl-pick-slot styles).
 */
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Avatar } from "./avatars-variants";
import { Button } from "./buttons-variants";
import { Checkbox, Radio } from "./checkboxes-radios";
import { Calendar, fromIso, toIso, type IsoDate } from "./date-picker";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { Segmented } from "./segmented-control";
import { TextField } from "./text-fields-states";

// ── b.booking-flow: service, staff, time and details, then a confirmation that can be moved or cancelled. ──

export type BookService = { id: string; name: string; minutes: number; /** cents */ price: number; note: string; /** ids of the staff who do it */ staff: string[] };
export type BookStaff = { id: string; name: string; role: string };
export type BookHours = { open: string; close: string; /** closed weekdays, 0 = Sunday */ closed: number[]; /** minutes between start times */ every?: number };
export type BookDetails = { name: string; email: string; phone: string; notes: string; remind: boolean };
export type Booking = { ref?: string; service: string; staff: string; day: IsoDate; time: string; minutes: number; price: number; details: BookDetails; test: "ok" | "taken" };

export type BookingFlowProps = {
  title: string;
  business: string;
  /** Named under the times, e.g. "Pacific Time". */
  timeZone: string;
  services: BookService[];
  staff: BookStaff[];
  hours: BookHours;
  /** Whether a staff member is busy at that start time. Nothing is taken when left out. */
  isTaken?: (staffId: string, day: IsoDate, time: string) => boolean;
  /** How far ahead people can book. */
  daysAhead?: number;
  currency?: string;
  locale?: string;
  /** Books (or moves, when booking.ref is set) and returns the reference; throw to show "just taken". */
  onBook?: (booking: Booking) => Promise<{ ref: string }>;
  onCancel?: (ref: string) => Promise<void>;
};

const STEPS = ["Service", "Staff", "Time", "Details"];
const ANYONE = "any";
const EMPTY: BookDetails = { name: "", email: "", phone: "", notes: "", remind: false };

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

async function testBook(b: Booking) {
  await wait(1000);
  if (b.test === "taken") throw new Error("taken");
  return { ref: b.ref ?? `BK-${String(Date.now()).slice(-5)}` };
}
async function testCancel() {
  await wait(700);
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

export function BookingFlow({ title, business, timeZone, services, staff, hours, isTaken, daysAhead = 30, currency = "USD", locale = "en-US", onBook = testBook, onCancel = testCancel }: BookingFlowProps) {
  const uid = useId();
  const focusLater = useFocusLater();
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [service, setService] = useState("");
  const [who, setWho] = useState("");
  const [day, setDay] = useState<IsoDate | undefined>();
  const [time, setTime] = useState("");
  const [details, setDetails] = useState<BookDetails>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<"service" | "who" | "time" | "name" | "email" | "phone", string>>>({});
  const [test, setTest] = useState<"ok" | "taken">("ok");
  const [busy, setBusy] = useState(false);
  const [takenNow, setTakenNow] = useState<string[]>([]);
  const [alert, setAlert] = useState("");
  const [booked, setBooked] = useState<(Booking & { ref: string; moved?: boolean }) | null>(null);
  // While moving, the confirmed booking is kept here so "Keep current time" can bring it back.
  const [kept, setKept] = useState<(Booking & { ref: string; moved?: boolean }) | null>(null);
  const [moving, setMoving] = useState(false);
  const [askCancel, setAskCancel] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [said, setSaid] = useState("");
  const moved = useRef(false);

  const money = (cents: number) => (cents / 100).toLocaleString(locale, { style: "currency", currency, minimumFractionDigits: cents % 100 ? 2 : 0 });
  const fmtDay = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric" }), [locale]);
  const fmtClock = useMemo(() => new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }), [locale]);
  const clock = (t: string) => fmtClock.format(new Date(2000, 0, 1, Number(t.slice(0, 2)), Number(t.slice(3, 5))));

  const svc = services.find((s) => s.id === service);
  const able = svc ? staff.filter((p) => svc.staff.includes(p.id)) : [];
  const person = staff.find((p) => p.id === who);
  const today = toIso(new Date());
  const last = toIso(new Date(Date.now() + daysAhead * 86400000));

  // Start times on a day: every `every` minutes from opening, as long as the service ends by closing. A time in the
  // past (today) is left out. Free when the chosen person (or anyone who does it) isn't taken.
  const slotsOn = (d: IsoDate | undefined) => {
    if (!d || !svc) return [];
    const every = hours.every ?? 30;
    const now = new Date();
    const nowMin = d === today ? now.getHours() * 60 + now.getMinutes() + 30 : -1;
    const people = who === ANYONE ? able.map((p) => p.id) : [who];
    const out: { time: string; free: string[] }[] = [];
    for (let m = toMin(hours.open); m + svc.minutes <= toMin(hours.close); m += every) {
      if (m < nowMin) continue;
      const t = toTime(m);
      const free = people.filter((p) => !(isTaken?.(p, d, t) ?? false) && !takenNow.includes(`${p}@${d}@${t}`));
      out.push({ time: t, free });
    }
    return out;
  };
  const closedDay = (d: IsoDate) => hours.closed.includes(fromIso(d)!.getDay());
  const slots = slotsOn(day);
  const freeCount = slots.filter((s) => s.free.length).length;

  // After a step change, focus goes to the new step's heading.
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    document.getElementById(`${uid}-h${step}`)?.focus();
  }, [step, uid]);

  const go = (to: number) => {
    moved.current = true;
    setAlert("");
    setErrors({});
    setStep(to);
  };

  const check = (at: number) => {
    const e: typeof errors = {};
    if (at === 0 && !svc) e.service = "Choose a service.";
    if (at === 1 && !who) e.who = "Choose who you'd like, or Anyone available.";
    if (at === 2 && (!day || !time)) e.time = day ? "Choose a time." : "Choose a day, then a time.";
    if (at === 3) {
      if (!details.name.trim()) e.name = "Enter your name.";
      if (!details.email.trim()) e.email = "Enter your email.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(details.email.trim())) e.email = "Enter an email like name@example.com.";
      const digits = details.phone.replace(/\D/g, "");
      if (details.remind && !digits) e.phone = "Add a phone for the text reminder.";
      else if (digits && digits.length !== 10) e.phone = "Enter a 10-digit phone number.";
    }
    return e;
  };

  const next = () => {
    const e = check(step);
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) {
      setSaid(Object.values(e)[0] ?? "");
      document.getElementById(`${uid}-${first}`)?.focus();
      return;
    }
    setReached((r) => Math.max(r, step + 1));
    go(step + 1);
  };

  const pickService = (id: string) => {
    setService(id);
    setErrors({});
    const s = services.find((x) => x.id === id);
    // Someone who doesn't do the new service can't stay chosen; the time may no longer fit either.
    if (who && who !== ANYONE && s && !s.staff.includes(who)) {
      setWho("");
      setReached((r) => Math.min(r, 1));
    }
    setTime("");
  };

  const book = async () => {
    const e = check(3);
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) {
      setSaid(Object.values(e)[0] ?? "");
      document.getElementById(`${uid}-${first}`)?.focus();
      return;
    }
    if (!svc || !day || !time) return;
    const slot = slots.find((s) => s.time === time);
    const staffId = who === ANYONE ? slot?.free[0] ?? able[0]!.id : who;
    setBusy(true);
    setAlert("");
    setSaid(moving ? "Moving your appointment…" : "Booking…");
    const booking: Booking = { ref: moving ? booked?.ref : undefined, service: svc.id, staff: staffId, day, time, minutes: svc.minutes, price: svc.price, details, test };
    try {
      const res = await onBook(booking);
      setBooked({ ...booking, ref: res.ref, moved: moving });
      setMoving(false);
      setSaid(`${moving ? "Moved" : "Booked"}: ${svc.name}, ${fmtDay.format(fromIso(day)!)} at ${clock(time)}.`);
      focusLater(() => document.getElementById(`${uid}-done`));
    } catch {
      setTakenNow((t) => [...t, `${staffId}@${day}@${time}`]);
      setTime("");
      // The test switch goes back to "Books", so the next try can go through.
      setTest("ok");
      const msg = `${clock(time)} was just taken. Pick another time.`;
      setAlert(msg);
      setSaid(msg);
      focusLater(() => document.getElementById(`${uid}-alert`));
    } finally {
      setBusy(false);
    }
  };

  const reschedule = () => {
    setKept(booked);
    setMoving(true);
    setTime("");
    setReached(3);
    moved.current = true;
    setStep(2);
    setBooked(null);
  };
  const keepCurrent = () => {
    if (!kept) return;
    setMoving(false);
    setDay(kept.day);
    setTime(kept.time);
    setBooked(kept);
    setSaid("Kept your current time.");
    focusLater(() => document.getElementById(`${uid}-done`));
  };

  const doCancel = async () => {
    if (!booked) return;
    setCancelBusy(true);
    try {
      await onCancel(booked.ref);
      setCancelled(true);
      setAskCancel(false);
      setSaid("Appointment cancelled.");
      focusLater(() => document.getElementById(`${uid}-cancelled`));
    } catch {
      setSaid("That didn't go through. Try again.");
    } finally {
      setCancelBusy(false);
    }
  };
  const startOver = () => {
    setBooked(null);
    setKept(null);
    setCancelled(false);
    setStep(0);
    setReached(0);
    setService("");
    setWho("");
    setDay(undefined);
    setTime("");
    setTest("ok");
    setSaid("Start a new booking.");
    focusLater(() => document.getElementById(`${uid}-h0`));
  };

  const err = (k: keyof typeof errors) =>
    errors[k] ? (
      <p className="fl-bkf-err" id={`${uid}-${k}-err`}>
        <Icon name="alert" />
        {errors[k]}
      </p>
    ) : null;

  const summaryRows = (b: { service?: BookService; staffName?: string; day?: IsoDate; time?: string }) => (
    <dl className="fl-bkf-facts">
      <div>
        <dt>Service</dt>
        <dd>{b.service ? `${b.service.name} · ${b.service.minutes} min` : "—"}</dd>
      </div>
      <div>
        <dt>With</dt>
        <dd>{b.staffName ?? "—"}</dd>
      </div>
      <div>
        <dt>When</dt>
        <dd>{b.day ? `${fmtDay.format(fromIso(b.day)!)}${b.time ? `, ${clock(b.time)}` : ""}` : "—"}</dd>
      </div>
      <div className="fl-bkf-price">
        <dt>Price</dt>
        <dd>{b.service ? money(b.service.price) : "—"}</dd>
      </div>
    </dl>
  );

  if (booked || cancelled) {
    const b = booked ?? kept!;
    const s = services.find((x) => x.id === b.service);
    const p = staff.find((x) => x.id === b.staff);
    return (
      <div className="fl-bkf" data-fl="b.booking-flow">
        <div className={`fl-bkf-card fl-bkf-done${cancelled ? " is-cancelled" : ""}`}>
          <span className="fl-bkf-tick" aria-hidden="true">
            <Icon name={cancelled ? "close" : "check"} />
          </span>
          <h3 id={cancelled ? `${uid}-cancelled` : `${uid}-done`} tabIndex={-1}>
            {cancelled ? "Appointment cancelled" : b.moved ? "Appointment moved" : "You're booked"}
          </h3>
          <p className="fl-bkf-muted">
            {cancelled ? `Nothing to pay. We sent a note to ${b.details.email.trim()}.` : `${business} · ref ${b.ref} · confirmation sent to ${b.details.email.trim()}`}
          </p>
          {cancelled ? null : summaryRows({ service: s, staffName: p?.name, day: b.day, time: b.time })}
          {cancelled ? null : <p className="fl-bkf-muted">Pay at the appointment. Times in {timeZone}.</p>}
          <div className="fl-bkf-done-actions">
            {cancelled ? (
              <Button variant="primary" size={44} onClick={startOver}>
                Book again
              </Button>
            ) : (
              <>
                <Button variant="secondary" size={44} icon="calendar" onClick={reschedule}>
                  Reschedule
                </Button>
                <Button variant="tertiary" size={44} onClick={() => setAskCancel(true)}>
                  Cancel appointment
                </Button>
              </>
            )}
          </div>
        </div>
        {askCancel && booked ? (
          <Modal
            variant="danger"
            icon="calendar"
            title="Cancel this appointment?"
            description={`${s?.name}, ${fmtDay.format(fromIso(b.day)!)} at ${clock(b.time)} with ${p?.name}. The time goes back to others.`}
            confirmLabel="Cancel appointment"
            cancelLabel="Keep it"
            busy={cancelBusy}
            busyLabel="Cancelling…"
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
      </div>
    );
  }

  const radioCard = (name: string, value: string, checked: boolean, onPick: () => void, label: ReactNode, description?: ReactNode, id?: string) => (
    <div key={value} className={checked ? "fl-bkf-opt is-on" : "fl-bkf-opt"}>
      <Radio id={id} name={name} value={value} checked={checked} onChange={onPick} label={label} description={description} />
    </div>
  );

  return (
    <div className="fl-bkf" data-fl="b.booking-flow">
      <div className="fl-bkf-card fl-bkf-main">
        <div className="fl-bkf-top">
          <h3 className="fl-bkf-title">{title}</h3>
          {moving && kept ? (
            <span className="fl-bkf-moving">
              Moving {kept.ref}
              <button type="button" className="fl-bkf-link" onClick={keepCurrent}>
                Keep current time
              </button>
            </span>
          ) : null}
        </div>
        <ol className="fl-bkf-steps" aria-label="Booking steps" style={{ ["--fl-bkf-at" as string]: (step + 1) / STEPS.length }}>
          {STEPS.map((s, i) => (
            <li key={s} className={i < step ? "is-done" : i === step ? "is-current" : undefined}>
              <button type="button" disabled={i > reached || i === step || busy || (moving && i < 2)} aria-current={i === step ? "step" : undefined} onClick={() => go(i)}>
                <span className="fl-bkf-dot" aria-hidden="true">
                  {i < step ? <Icon name="check" /> : i + 1}
                </span>
                <span className="fl-bkf-step-name">{s}</span>
                {i < step ? <span className="fl-sr"> (done)</span> : null}
              </button>
            </li>
          ))}
        </ol>

        <div className="fl-bkf-step" key={step}>
          <h4 id={`${uid}-h${step}`} tabIndex={-1}>
            {step === 0 ? "What would you like?" : step === 1 ? "Who with?" : step === 2 ? (moving ? "Pick a new time" : "When?") : "Your details"}
          </h4>

          {step === 0 ? (
            <fieldset className="fl-bkf-opts" aria-describedby={errors.service ? `${uid}-service-err` : undefined}>
              <legend className="fl-sr">Service</legend>
              {services.map((s, i) =>
                radioCard(
                  `${uid}-svc`,
                  s.id,
                  service === s.id,
                  () => pickService(s.id),
                  <span className="fl-bkf-line">
                    <span>{s.name}</span>
                    <span className="fl-bkf-num">{money(s.price)}</span>
                  </span>,
                  `${s.minutes} min · ${s.note}`,
                  i === 0 ? `${uid}-service` : undefined,
                ),
              )}
              {err("service")}
            </fieldset>
          ) : null}

          {step === 1 ? (
            <fieldset className="fl-bkf-opts fl-bkf-opts--people" aria-describedby={errors.who ? `${uid}-who-err` : undefined}>
              <legend className="fl-sr">Staff</legend>
              {radioCard(
                `${uid}-who`,
                ANYONE,
                who === ANYONE,
                () => {
                  setWho(ANYONE);
                  setTime("");
                  setErrors({});
                },
                <span className="fl-bkf-person">
                  <span className="fl-bkf-any" aria-hidden="true">
                    <Icon name="users" />
                  </span>
                  <span>Anyone available</span>
                </span>,
                "Most times to choose from",
                `${uid}-who`,
              )}
              {able.map((p, i) =>
                radioCard(
                  `${uid}-who`,
                  p.id,
                  who === p.id,
                  () => {
                    setWho(p.id);
                    setTime("");
                    setErrors({});
                  },
                  <span className="fl-bkf-person">
                    <Avatar name={p.name} size={32} tone={(["a", "b", "c", "d", "e"] as const)[i % 5]} decorative />
                    <span>{p.name}</span>
                  </span>,
                  p.role,
                ),
              )}
              {err("who")}
            </fieldset>
          ) : null}

          {step === 2 ? (
            <div className="fl-bkf-when">
              <div className="fl-bkf-cal">
                <Calendar
                  value={day}
                  onPick={(d) => {
                    setDay(d);
                    setTime("");
                    setErrors({});
                    const n = slotsOn(d).filter((s) => s.free.length).length;
                    setSaid(`${fmtDay.format(fromIso(d)!)}: ${n === 0 ? "no times free" : n === 1 ? "1 time free" : `${n} times free`}.`);
                  }}
                  min={today}
                  max={last}
                  isDisabled={closedDay}
                  label={`Days for ${svc?.name ?? "the appointment"}`}
                  locale={locale}
                />
              </div>
              <div className="fl-bkf-times">
                <p className="fl-bkf-day" id={`${uid}-times`}>
                  {day ? fmtDay.format(fromIso(day)!) : "Pick a day"}
                </p>
                <p className="fl-bkf-muted">Times in {timeZone}</p>
                {!day ? (
                  <p className="fl-bkf-none">Closed days are grayed out.</p>
                ) : freeCount === 0 ? (
                  <p className="fl-bkf-none">Nothing free this day. Try another day{who !== ANYONE ? " or Anyone available" : ""}.</p>
                ) : (
                  <div className="fl-pick-slots fl-bkf-slots" role="radiogroup" aria-labelledby={`${uid}-times`} aria-describedby={errors.time ? `${uid}-time-err` : undefined}>
                    {slots.map((s, i) => (
                      <label key={s.time} className={`fl-pick-slot${s.free.length ? "" : " fl-pick-slot--full"}`}>
                        <input
                          type="radio"
                          id={i === 0 ? `${uid}-time` : undefined}
                          name={`${uid}-slot`}
                          value={s.time}
                          checked={time === s.time}
                          disabled={!s.free.length}
                          onChange={() => {
                            setTime(s.time);
                            setErrors({});
                          }}
                        />
                        <span className="fl-pick-slot__time">{clock(s.time)}</span>
                        <span className="fl-pick-slot__left">{s.free.length ? (who === ANYONE ? `${s.free.length} free` : "Free") : "Taken"}</span>
                      </label>
                    ))}
                  </div>
                )}
                {err("time")}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="fl-bkf-grid">
              {(
                [
                  ["name", "Name", "name", "text"],
                  ["email", "Email", "email", "email"],
                  ["phone", "Phone", "tel", "tel"],
                ] as const
              ).map(([k, label, ac, type]) => (
                <div key={k} className={k === "name" ? "fl-bkf-field is-wide" : "fl-bkf-field"}>
                  <label htmlFor={`${uid}-${k}`}>
                    {label}
                    {k === "phone" && !details.remind ? <span> (optional)</span> : null}
                  </label>
                  <TextField
                    id={`${uid}-${k}`}
                    size={44}
                    type={type}
                    autoComplete={ac}
                    inputMode={k === "phone" ? "tel" : undefined}
                    value={details[k]}
                    invalid={Boolean(errors[k])}
                    aria-describedby={errors[k] ? `${uid}-${k}-err` : undefined}
                    onChange={(e) => {
                      setDetails((d) => ({ ...d, [k]: e.target.value }));
                      if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
                    }}
                  />
                  {err(k)}
                </div>
              ))}
              <div className="fl-bkf-field is-wide">
                <label htmlFor={`${uid}-notes`}>
                  Anything we should know? <span>(optional)</span>
                </label>
                <TextField id={`${uid}-notes`} multiline autoGrow rows={2} maxLength={300} value={details.notes} onChange={(e) => setDetails((d) => ({ ...d, notes: e.target.value }))} />
              </div>
              <div className="fl-bkf-field is-wide">
                <Checkbox
                  label="Text me a reminder the day before"
                  checked={details.remind}
                  onChange={(e) => {
                    setDetails((d) => ({ ...d, remind: e.target.checked }));
                    if (!e.target.checked && errors.phone) setErrors((x) => ({ ...x, phone: undefined }));
                  }}
                />
              </div>
              <div className="fl-bkf-test is-wide">
                <span className="fl-bkf-badge">Test mode</span>
                <Segmented
                  label="Test result"
                  size="sm"
                  value={test}
                  onChange={(v) => setTest(v as "ok" | "taken")}
                  options={[
                    { value: "ok", label: "Books" },
                    { value: "taken", label: "Slot taken" },
                  ]}
                />
              </div>
            </div>
          ) : null}

          {alert ? (
            <div className="fl-bkf-alert" role="alert" id={`${uid}-alert`} tabIndex={-1}>
              <Icon name="alert" />
              <span>{alert}</span>
              <Button variant="secondary" size={32} onClick={() => go(2)}>
                See times
              </Button>
            </div>
          ) : null}

          <div className="fl-bkf-actions">
            {step > 0 && !(moving && step === 2) ? (
              <Button variant="tertiary" size={44} icon="arrow-left" disabled={busy} onClick={() => go(step - 1)}>
                Back
              </Button>
            ) : (
              <span />
            )}
            {step < 3 && !(moving && step === 2) ? (
              <Button variant="primary" size={44} icon="chevron-right" iconAt="end" onClick={next}>
                Continue
              </Button>
            ) : (
              <Button
                variant="primary"
                size={44}
                icon="calendar"
                busy={busy}
                onClick={() => {
                  if (moving && step === 2) {
                    const e = check(2);
                    setErrors(e);
                    if (e.time) {
                      setSaid(e.time);
                      return;
                    }
                  }
                  void book();
                }}
              >
                {busy ? (moving ? "Moving…" : "Booking…") : moving ? "Move appointment" : svc ? `Book · ${money(svc.price)}` : "Book"}
              </Button>
            )}
          </div>
        </div>
      </div>

      <aside className="fl-bkf-card fl-bkf-sum" aria-label="Your booking">
        <h3 className="fl-bkf-sum-title">{business}</h3>
        {summaryRows({ service: svc, staffName: who === ANYONE ? "Anyone available" : person?.name, day, time })}
        <p className="fl-bkf-muted">
          <Icon name="info" />
          Pay at the appointment. Free to cancel or move.
        </p>
      </aside>

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

/** Sample busy times: a steady pattern per person and day, so some chips are taken and it never looks stale. */
function sampleTaken(staffId: string, day: IsoDate, time: string) {
  const seed = [...`${staffId}${day}${time}`].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
  return seed % 5 < 2;
}

// flowcode:sample
const SAMPLE: BookingFlowProps = {
  title: "Book an appointment",
  business: "Juniper Hair Studio",
  timeZone: "Pacific Time",
  services: [
    { id: "cut", name: "Haircut and style", minutes: 45, price: 6500, note: "Wash, cut and blow-dry", staff: ["jordan", "mia", "sam"] },
    { id: "color", name: "Color and gloss", minutes: 120, price: 16000, note: "Single process with toner", staff: ["jordan", "mia"] },
    { id: "trim", name: "Beard trim", minutes: 30, price: 3000, note: "Shape and line-up", staff: ["sam"] },
    { id: "blowout", name: "Blowout", minutes: 45, price: 5500, note: "Wash and styled finish", staff: ["mia", "sam"] },
  ],
  staff: [
    { id: "jordan", name: "Jordan Ellis", role: "Senior stylist · color" },
    { id: "mia", name: "Mia Tanaka", role: "Stylist · curly hair" },
    { id: "sam", name: "Sam Okafor", role: "Barber" },
  ],
  hours: { open: "09:00", close: "18:00", closed: [0, 1], every: 30 },
  isTaken: sampleTaken,
  daysAhead: 30,
};

export default function BookingFlowPreview() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap">
        <BookingFlow {...SAMPLE} />
      </div>
    </section>
  );
}
