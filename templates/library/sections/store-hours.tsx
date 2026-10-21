/** @flowcode-library store-hours · Opening hours and open now (Contact)
 * Catalog ID: b.store-hours (block)
 * Function: A local business's hours (b.store-hours): whether it is open right now in the shop's own time zone (open, closes soon, opens soon, closed) and when that changes, a notice for upcoming holidays and special hours, this week's dates or the regular week with today marked, a "Will you be open?" check for a day and time, and the address and phone with copy and call.
 * Use it as: import { StoreHours } from "./store-hours"; <StoreHours name timeZone="America/Los_Angeles" zoneLabel="Pacific Time" week={[[], [{ open: "07:00", close: "15:00" }], ...]} exceptions?={[{ date: "2026-11-26", label, periods: [] }]} address phone soonMinutes?={60} />
 * Built from: c.segmented.segmented, c.select.outlined, c.text-field.outlined, c.badge.status, c.button.secondary, c.button.tertiary, c.alert.inline
 * Look: One white card on a gray page: the shop's name over a large status line with a colored pill (a soft pulsing dot while open) and "Closes at 3 PM"; a tinted notice strip for the next holiday with a close button; a This week / Regular hours switch over a list of days and their hours (today marked with a straight accent bar and bold, holidays tagged); a small "Will you be open?" row with a day select, a time field and the answer; then the address and phone with Copy and Call.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-warning --color-danger --surface-radius --pill-radius --space-1 --space-2 --space-3 --space-4 --space-5 --radius-md --text-xs --text-sm --text-md --text-lg --text-xl --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --easing --enter-distance
 * Use cases: opening hours; store hours; cafe or bakery hours; holiday hours notice; clinic or office hours; contact and hours block; "are you open now"
 * Jobs to be done: know if it is open right now; know when it closes or opens next; see holiday closures before I go; check it will be open when I get there; call or find the address
 * Keywords: hours, opening hours, open now, closed, holiday, special hours, store, business hours, time zone, local business, contact
 */
/**
 * Opening hours and open now: the hours block every local business needs, worked out in the shop's own time zone (so a
 * visitor elsewhere still sees the shop's clock, with their own time beside it when it differs). The status line
 * says Open now, Closes soon (within soonMinutes), Opens soon or Closed, and the next change ("Opens Thursday at
 * 7 AM"), skipping closed days and holidays; it refreshes every 30 seconds and announces a change. Days can have more
 * than one period (a lunch break). Exceptions replace a date's hours: no periods means closed. The notice shows the
 * next exception within two weeks and can be dismissed. "Will you be open?" answers for any day this week and a time.
 * Make it the app's own: replace SAMPLE with the shop's week, exceptions, time zone and contact details.
 * Adapted from Meraki UI (MIT License, Copyright (c) 2021 Khatab Wedaa): its contact section with an hours list.
 */
/**
 * How to try it
 * - Read the status line; it is the shop's time now. The notice names the next holiday; close it with its button.
 * - Switch to Regular hours: the plain week shows. Back on This week, the holiday and special hours are tagged.
 * - In Will you be open?, pick the holiday and a time: Closed, with the reason. Pick tomorrow at 2:45 PM: Closes soon.
 * - Clear the time and press Check: the field asks for a time.
 * - Press Copy address: the status says it was copied (or that it couldn't be). Call opens the phone app.
 *
 * Dependencies: React (useEffect, useId, useMemo, useRef, useState), the library's Segmented ("./segmented-control"),
 * Select ("./dropdowns-states"), TextField ("./text-fields-states"), Badge ("./badges-status"), Button
 * ("./buttons-variants") and its inline icon set ("./icons"). Nothing else: no package to install and nothing fetched at
 * run time. The styles are the library's own fl- classes in templates/library/css/r4b-store-hours.css.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { Segmented } from "./segmented-control";
import { TextField } from "./text-fields-states";

// ── b.store-hours: open now, next change, holiday notice, the week and a "will you be open" check. ──

export type HoursPeriod = { open: string; close: string };
export type HoursException = { date: string; label: string; periods: HoursPeriod[] };
export type StoreHoursProps = {
  name: string;
  /** IANA zone the shop's hours are in, e.g. "America/Los_Angeles". */
  timeZone: string;
  /** Said under the hours, e.g. "Pacific Time". */
  zoneLabel: string;
  /** Seven days, Sunday first; an empty list is closed. close may be "24:00". */
  week: HoursPeriod[][];
  exceptions?: HoursException[];
  address: string;
  phone: string;
  /** "Closes soon" and "Opens soon" within this many minutes. */
  soonMinutes?: number;
  locale?: string;
};

type Status = { kind: "open" | "closing" | "opening" | "closed"; title: string; detail: string };

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
/** A calendar date plus n days, as ISO (worked out on the date alone, so no time zone can shift it). */
const shift = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d! + n));
  return isoOf(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
};
const dowOf = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
};

/** The shop's own date and minute of the day right now. */
function shopNow(timeZone: string, at: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minute: Number(parts.hour) * 60 + Number(parts.minute) };
}

export function StoreHours({ name, timeZone, zoneLabel, week, exceptions = [], address, phone, soonMinutes = 60, locale = "en-US" }: StoreHoursProps) {
  const uid = useId();
  const [now, setNow] = useState(() => new Date());
  const [view, setView] = useState<"week" | "regular">("week");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [checkDay, setCheckDay] = useState("");
  const [checkTime, setCheckTime] = useState("");
  const [checkError, setCheckError] = useState("");
  const [answer, setAnswer] = useState<Status | null>(null);
  const [said, setSaid] = useState("");

  // The clock moves on every 30 seconds, so the status changes on its own at opening and closing.
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(t);
  }, []);

  const fmtClock = useMemo(() => new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: "UTC" }), [locale]);
  const fmtWeekday = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }), [locale]);
  const fmtShort = useMemo(() => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }), [locale]);
  const fmtLong = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }), [locale]);
  const asUtc = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y!, m! - 1, d!));
  };
  // "7:00 AM" written as "7 AM" when it is on the hour.
  const clock = (min: number) => {
    const m = min >= 1440 ? 1439 : min;
    const s = fmtClock.format(new Date(Date.UTC(2000, 0, 1, Math.floor(m / 60), m % 60)));
    return min >= 1440 ? "midnight" : s.replace(/:00(?=\s?[AP]M)/i, "");
  };
  const range = (p: HoursPeriod) => `${clock(toMin(p.open))} – ${clock(toMin(p.close))}`;

  const exOn = (iso: string) => exceptions.find((x) => x.date === iso);
  const periodsOn = (iso: string) => exOn(iso)?.periods ?? week[dowOf(iso)] ?? [];

  const here = shopNow(timeZone, now);
  const dayWord = (iso: string) => (iso === here.date ? "today" : iso === shift(here.date, 1) ? "tomorrow" : fmtWeekday.format(asUtc(iso)));

  /** Status at a shop date and minute: open (and until when) or closed (and when it opens next). */
  const statusAt = (iso: string, minute: number): Status => {
    const today = periodsOn(iso);
    const inside = today.find((p) => minute >= toMin(p.open) && minute < toMin(p.close));
    if (inside) {
      const left = toMin(inside.close) - minute;
      const closes = `Closes at ${clock(toMin(inside.close))}`;
      return left <= soonMinutes ? { kind: "closing", title: "Closes soon", detail: `${closes} · in ${left} min` } : { kind: "open", title: "Open now", detail: closes };
    }
    // Next opening: later today, then the next 14 days.
    for (let i = 0; i <= 14; i++) {
      const d = shift(iso, i);
      const next = periodsOn(d).find((p) => i > 0 || toMin(p.open) > minute);
      if (next) {
        const wait = i === 0 ? toMin(next.open) - minute : Infinity;
        const when = `Opens ${dayWord(d) === "today" ? "" : `${dayWord(d)} `}at ${clock(toMin(next.open))}`;
        const why = i === 0 ? "" : exOn(iso) && !exOn(iso)!.periods.length ? ` · ${exOn(iso)!.label}` : "";
        return wait <= soonMinutes ? { kind: "opening", title: "Opens soon", detail: `${when} · in ${wait} min` } : { kind: "closed", title: "Closed", detail: `${when}${why}` };
      }
    }
    return { kind: "closed", title: "Closed", detail: "No opening hours in the next two weeks" };
  };

  const status = statusAt(here.date, here.minute);
  const last = useRef(status.title);
  useEffect(() => {
    if (last.current !== status.title) {
      last.current = status.title;
      setSaid(`${name} is now ${status.title.toLowerCase()}. ${status.detail}.`);
    }
  }, [status.title, status.detail, name]);

  // The visitor's own clock, when their zone isn't the shop's.
  const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const sameZone = shopNow(viewerZone, now).minute === here.minute && shopNow(viewerZone, now).date === here.date;

  const days = Array.from({ length: 7 }, (_, i) => shift(here.date, i));
  const notice = exceptions
    .filter((x) => x.date >= here.date && x.date <= shift(here.date, 14) && !dismissed.includes(x.date))
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  const check = () => {
    if (!checkTime) {
      setCheckError("Enter a time.");
      setAnswer(null);
      document.getElementById(`${uid}-time`)?.focus();
      return;
    }
    setCheckError("");
    const iso = checkDay || here.date;
    const minute = toMin(checkTime);
    const s = statusAt(iso, minute);
    const res: Status =
      s.kind === "open" || s.kind === "closing"
        ? { kind: s.kind, title: "Open then", detail: s.detail }
        : { kind: s.kind, title: "Closed then", detail: s.detail };
    setAnswer(res);
    setSaid(`${fmtLong.format(asUtc(iso))} at ${clock(minute)}: ${res.title}. ${res.detail}.`);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setSaid("Address copied.");
    } catch {
      setSaid("Couldn't copy. Select the address to copy it.");
    }
  };

  const tone = (k: Status["kind"]) => (k === "open" ? "success" : k === "closed" ? "danger" : "warning");
  const hoursText = (ps: HoursPeriod[]) => (ps.length ? ps.map(range).join(", ") : "Closed");
  const order = [1, 2, 3, 4, 5, 6, 0];
  const viewerClock = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(now);

  return (
    <div className="fl-hrs" data-fl="b.store-hours">
      <header className="fl-hrs-head">
        <h3 className="fl-hrs-name">{name}</h3>
        <div className={`fl-hrs-status is-${status.kind}`} key={status.title}>
          <Badge tone={tone(status.kind)} led pulse={status.kind === "open"}>
            {status.title}
          </Badge>
          <p className="fl-hrs-detail">{status.detail}</p>
        </div>
        <p className="fl-hrs-zone">
          <Icon name="clock" />
          Hours in {zoneLabel}
          {sameZone ? "" : ` · it's ${clock(here.minute)} there, ${viewerClock} where you are`}
        </p>
      </header>

      {notice ? (
        <div className="fl-hrs-notice" role="note" key={notice.date}>
          <span className="fl-hrs-notice-bar" aria-hidden="true" />
          <Icon name={notice.periods.length ? "info" : "calendar"} />
          <p>
            <strong>
              {notice.periods.length ? "Special hours" : "Closed"} {dayWord(notice.date) === "today" || dayWord(notice.date) === "tomorrow" ? dayWord(notice.date) : `${fmtWeekday.format(asUtc(notice.date))}, ${fmtShort.format(asUtc(notice.date))}`}
            </strong>
            {" · "}
            {notice.label}
            {notice.periods.length ? ` · ${hoursText(notice.periods)}` : ""}
          </p>
          <Button
            variant="tertiary"
            size={32}
            icon="close"
            iconOnly
            aria-label={`Dismiss notice: ${notice.label}`}
            onClick={() => {
              setDismissed((d) => [...d, notice.date]);
              setSaid("Notice dismissed.");
              window.setTimeout(() => document.getElementById(`${uid}-view`)?.querySelector<HTMLInputElement>("input:checked")?.focus(), 0);
            }}
          >
            Dismiss
          </Button>
        </div>
      ) : null}

      <section className="fl-hrs-week" aria-labelledby={`${uid}-wk`}>
        <div className="fl-hrs-week-head">
          <h4 id={`${uid}-wk`}>Hours</h4>
          <div id={`${uid}-view`}>
            <Segmented
              label="Which hours"
              size="sm"
              value={view}
              onChange={(v) => setView(v as "week" | "regular")}
              options={[
                { value: "week", label: "This week" },
                { value: "regular", label: "Regular hours" },
              ]}
            />
          </div>
        </div>
        <ul className="fl-hrs-days" key={view}>
          {view === "week"
            ? days.map((iso, i) => {
                const ex = exOn(iso);
                const isToday = i === 0;
                return (
                  <li key={iso} className={isToday ? "is-today" : undefined} style={{ ["--fl-hrs-i" as string]: i }} aria-current={isToday ? "date" : undefined}>
                    {isToday ? <span className="fl-hrs-bar" aria-hidden="true" /> : null}
                    <span className="fl-hrs-day">
                      {isToday ? "Today" : fmtWeekday.format(asUtc(iso))}
                      <span className="fl-hrs-date">{fmtShort.format(asUtc(iso))}</span>
                    </span>
                    <span className={periodsOn(iso).length ? "fl-hrs-time" : "fl-hrs-time is-closed"}>
                      {hoursText(periodsOn(iso))}
                      {ex ? <span className={ex.periods.length ? "fl-hrs-tag is-special" : "fl-hrs-tag"}>{ex.label}</span> : null}
                    </span>
                  </li>
                );
              })
            : order.map((dow, i) => {
                const isToday = dow === dowOf(here.date);
                return (
                  <li key={dow} className={isToday ? "is-today" : undefined} style={{ ["--fl-hrs-i" as string]: i }} aria-current={isToday ? "date" : undefined}>
                    {isToday ? <span className="fl-hrs-bar" aria-hidden="true" /> : null}
                    <span className="fl-hrs-day">{fmtWeekday.format(new Date(Date.UTC(2023, 0, 1 + dow)))}</span>
                    <span className={week[dow]?.length ? "fl-hrs-time" : "fl-hrs-time is-closed"}>{hoursText(week[dow] ?? [])}</span>
                  </li>
                );
              })}
        </ul>
      </section>

      <section className="fl-hrs-check" aria-labelledby={`${uid}-ck`}>
        <h4 id={`${uid}-ck`}>Will you be open?</h4>
        <form
          className="fl-hrs-check-row"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            check();
          }}
        >
          <div className="fl-hrs-field">
            <label htmlFor={`${uid}-day`}>Day</label>
            <Select
              id={`${uid}-day`}
              value={checkDay || here.date}
              options={days.map((iso, i) => ({ value: iso, label: `${i === 0 ? "Today" : i === 1 ? "Tomorrow" : fmtWeekday.format(asUtc(iso))}, ${fmtShort.format(asUtc(iso))}` }))}
              onChange={(e) => {
                setCheckDay(e.target.value);
                setAnswer(null);
              }}
            />
          </div>
          <div className="fl-hrs-field">
            <label htmlFor={`${uid}-time`}>Time</label>
            <TextField
              id={`${uid}-time`}
              size={44}
              type="time"
              step={300}
              value={checkTime}
              invalid={Boolean(checkError)}
              aria-describedby={checkError ? `${uid}-time-err` : undefined}
              onChange={(e) => {
                setCheckTime(e.target.value);
                setCheckError("");
                setAnswer(null);
              }}
            />
          </div>
          <Button type="submit" variant="secondary" size={44}>
            Check
          </Button>
        </form>
        {checkError ? (
          <p className="fl-hrs-err" id={`${uid}-time-err`}>
            <Icon name="alert" />
            {checkError}
          </p>
        ) : null}
        {answer ? (
          <p className={`fl-hrs-answer is-${answer.kind}`} key={`${checkDay}${checkTime}`}>
            <Icon name={answer.kind === "open" ? "check" : answer.kind === "closed" ? "close" : "clock"} />
            <span>
              <strong>{answer.title}.</strong> {answer.detail}.
            </span>
          </p>
        ) : null}
      </section>

      <footer className="fl-hrs-contact">
        <p>
          <Icon name="pin" />
          <span>{address}</span>
        </p>
        <div className="fl-hrs-contact-actions">
          <Button variant="secondary" size={40} icon="copy" onClick={() => void copy()}>
            Copy address
          </Button>
          <Button variant="secondary" size={40} icon="phone" href={`tel:${phone.replace(/[^\d+]/g, "")}`} aria-label={`Call ${phone}`}>
            Call
          </Button>
        </div>
      </footer>

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

/** A shop date n days from today (in the shop's zone), so the sample's holidays are always coming up. */
const shopDay = (n: number) => shift(shopNow("America/Los_Angeles", new Date()).date, n);

// flowcode:sample
const SAMPLE: StoreHoursProps = {
  name: "Tartine Corner Bakery",
  timeZone: "America/Los_Angeles",
  zoneLabel: "Pacific Time",
  week: [
    [{ open: "08:00", close: "14:00" }],
    [],
    [{ open: "07:00", close: "15:00" }],
    [{ open: "07:00", close: "15:00" }],
    [{ open: "07:00", close: "15:00" }],
    [{ open: "07:00", close: "12:00" }, { open: "13:00", close: "18:00" }],
    [{ open: "08:00", close: "16:00" }],
  ],
  exceptions: [
    { date: shopDay(3), label: "Staff training day", periods: [] },
    { date: shopDay(9), label: "Holiday hours", periods: [{ open: "09:00", close: "13:00" }] },
  ],
  address: "595 Alabama St, San Francisco, CA 94110",
  phone: "(415) 555-0142",
  soonMinutes: 60,
};

export default function StoreHoursPreview() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.name}>
      <div className="fl-wrap fl-wrap--narrow">
        <StoreHours {...SAMPLE} />
      </div>
    </section>
  );
}
