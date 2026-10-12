/** @flowcode-library booking-calendar · Booking calendar: a day, a time, booked (Forms)
 * Catalog ID: p.booking-calendar (pattern)
 * Function: The booking pattern (p.booking-calendar): days marked by how much is left, the chosen day's times as a radio group with places left, a named time zone, and a confirmation that says what was booked and lets the person change it.
 * Use it as: import { BookingCalendar } from "./booking-calendar"; <BookingCalendar service="Wheel-throwing taster" minutes={90} timeZone="London time" days={{ "2026-04-22": [{ time: "10:00", left: 4 }, { time: "13:30", left: 0 }] }} onBook?={(day, time) => ...} locale? />  // days: only the days with sessions; left 0 is full
 * Built from: c.date-picker.inline, c.button.primary, c.button.secondary
 * Look: The month calendar with a dot under days that have times (hollow when only a few places are left, struck through when full) beside the chosen day's times as bordered tiles with places left, a named time zone and a full-width Book button; booking turns it into a centered confirmation with a tick and Change the time.
 * Tokens: --color-accent --color-on-accent --color-success --color-surface --color-surface-sunken --color-border-strong --color-text-muted --control-radius --space-2 --space-3 --space-6 --duration-fast --duration-slow --focus-ring
 * Use cases: book an appointment; class booking; reserve a table; book a session; schedule a call; clinic appointments; studio bookings; room booking
 * Jobs to be done: find a day with times free; pick a time that suits me; book it; change my booking time
 * Keywords: booking, booking calendar, appointment, schedule, time slot, availability, reservation, class booking
 */
/**
 * Booking calendar: pick a day that has times free, then a time, then book it. Days are marked by how much is left
 * (open, a few left, full); the day's times are a radio group, so the arrow keys move between them; the confirmation
 * says what was booked and lets the person change it. Times are shown in the place's time zone, which is named.
 * Written for FlowCode, built from the date picker's Calendar (c.date-picker) and the button (c.button).
 * Make it the app's own: replace SAMPLE with the service, its length, and the times free on each day (from your data).
 */
import { useId, useMemo, useState } from "react";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { Calendar, fromIso, toIso, type DayMark, type IsoDate } from "./date-picker";

export type BookingSlot = { time: string; left: number };
export type BookingDays = Record<IsoDate, BookingSlot[]>;

/** A day's mark from its times: none free is full, three or fewer places in all is "a few left". */
export function dayMark(slots: BookingSlot[] | undefined): DayMark | undefined {
  if (!slots) return undefined;
  const left = slots.reduce((n, s) => n + s.left, 0);
  return left === 0 ? "full" : left <= 3 ? "few" : "open";
}

/** 24-hour "14:30" shown in the person's own clock (2:30 PM or 14:30). */
export function showTime(time: string, locale?: string): string {
  const [h, m] = time.split(":").map(Number);
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, h, m));
}

export function BookingCalendar({
  service,
  minutes,
  timeZone,
  days,
  onBook,
  locale,
}: {
  /** What is being booked, for the summary and the confirmation. */
  service: string;
  minutes: number;
  /** Named under the times, e.g. "London time". */
  timeZone: string;
  days: BookingDays;
  onBook?: (day: IsoDate, time: string) => void;
  locale?: string;
}) {
  const id = useId().replace(/:/g, "");
  const first = Object.keys(days).sort().find((d) => dayMark(days[d]) !== "full");
  const [day, setDay] = useState<IsoDate | undefined>(first);
  const [time, setTime] = useState<string>();
  const [booked, setBooked] = useState<{ day: IsoDate; time: string }>();
  const marks = useMemo(() => Object.fromEntries(Object.entries(days).map(([d, s]) => [d, dayMark(s)!])), [days]);
  const fmtDay = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" });
  const slots = (day && days[day]) || [];
  const free = slots.filter((s) => s.left > 0);
  const keys = Object.keys(days).sort();

  if (booked) {
    return (
      <div className="fl-pick-book fl-pick-book--done" data-fl="p.booking-calendar" role="status">
        <span className="fl-pick-book__tick" aria-hidden="true">
          <Icon name="check" />
        </span>
        <h3 className="fl-pick-book__title">You're booked</h3>
        <p className="fl-pick-book__what">
          {service}, {fmtDay.format(fromIso(booked.day)!)} at {showTime(booked.time, locale)} ({timeZone}), {minutes} minutes.
        </p>
        <div className="fl-pick-book__actions">
          <Button variant="secondary" size={40} onClick={() => setBooked(undefined)}>
            Change the time
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fl-pick-book" data-fl="p.booking-calendar">
      <div className="fl-pick-book__cal">
        <p className="fl-pick-book__service">
          <strong>{service}</strong> · {minutes} min
        </p>
        <Calendar
          value={day}
          onPick={(d) => {
            setDay(d);
            setTime(undefined);
          }}
          min={keys[0]}
          max={keys[keys.length - 1]}
          isDisabled={(d) => !days[d]}
          marks={marks}
          label={`Days for ${service}`}
          locale={locale}
        />
        <ul className="fl-pick-book__key" aria-label="What the marks mean">
          <li className="fl-pick-book__key--open">Times free</li>
          <li className="fl-pick-book__key--few">A few left</li>
          <li className="fl-pick-book__key--full">Full</li>
        </ul>
      </div>
      <div className="fl-pick-book__times">
        <h3 id={`${id}-times`} className="fl-pick-book__title">
          {day ? fmtDay.format(fromIso(day)!) : "Pick a day"}
        </h3>
        <p className="fl-pick-book__tz">Times in {timeZone}</p>
        {day && !free.length ? (
          <p className="fl-pick-book__none">Nothing free on this day. Days with a dot have times.</p>
        ) : (
          <div className="fl-pick-slots" role="radiogroup" aria-labelledby={`${id}-times`}>
            {slots.map((s) => (
              <label key={s.time} className={`fl-pick-slot${s.left === 0 ? " fl-pick-slot--full" : ""}`}>
                <input type="radio" name={`${id}-slot`} value={s.time} checked={time === s.time} disabled={s.left === 0} onChange={() => setTime(s.time)} />
                <span className="fl-pick-slot__time">{showTime(s.time, locale)}</span>
                <span className="fl-pick-slot__left">{s.left === 0 ? "Full" : s.left === 1 ? "1 place" : `${s.left} places`}</span>
              </label>
            ))}
          </div>
        )}
        <Button
          variant="primary"
          size={48}
          block
          disabled={!day || !time}
          onClick={() => {
            if (!day || !time) return;
            setBooked({ day, time });
            onBook?.(day, time);
          }}
        >
          {time ? `Book ${showTime(time, locale)}` : "Choose a time"}
        </Button>
      </div>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  service: "Wheel-throwing taster",
  minutes: 90,
  timeZone: "London time",
  // Times free on the next three weeks' open days: weekends busier, Mondays closed.
  pattern: [
    [], // Sunday: closed
    [],
    [{ time: "10:00", left: 4 }, { time: "13:30", left: 2 }, { time: "18:00", left: 6 }],
    [{ time: "10:00", left: 0 }, { time: "18:00", left: 1 }],
    [{ time: "10:00", left: 3 }, { time: "13:30", left: 5 }, { time: "18:00", left: 0 }],
    [{ time: "13:30", left: 1 }, { time: "18:00", left: 2 }],
    [{ time: "09:30", left: 0 }, { time: "12:00", left: 0 }, { time: "15:00", left: 0 }],
  ] as BookingSlot[][],
};

function sampleDays(): BookingDays {
  const out: BookingDays = {};
  const now = new Date();
  for (let i = 1; i <= 21; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const slots = SAMPLE.pattern[d.getDay()]!;
    if (slots.length) out[toIso(d)] = slots;
  }
  return out;
}

export default function BookingCalendarSection() {
  const d = SAMPLE;
  const days = useMemo(sampleDays, []);
  const [said, setSaid] = useState("");
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>Book a class</h3>
        <p className="fl-ctl-btn-what">A day first (only days with times can be picked; Saturdays here are full), then a time, then Book. Booking shows what was booked, with a way to change it.</p>
        <BookingCalendar service={d.service} minutes={d.minutes} timeZone={d.timeZone} days={days} onBook={(day, time) => setSaid(`Booked ${day} at ${time}.`)} />
        <p className="fl-sr" aria-live="polite">
          {said}
        </p>
      </div>
    </section>
  );
}
