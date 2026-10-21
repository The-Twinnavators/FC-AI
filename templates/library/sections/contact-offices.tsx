/** @flowcode-library contact-offices · Contact page with offices and hours (Contact)
 * Catalog ID: b.contact-offices (block)
 * Function: A contact page block (b.contact-offices): cards for each way to reach you, office tabs that show the address, phone, the office's local time, an Open now or Closed status and the week's hours with today marked, and a validated message form with topic, office and a character count, with sending, sent and failed states. Adapted from Meraki UI (MIT).
 * Use it as: import { ContactOffices } from "./contact-offices"; <ContactOffices title eyebrow? lede? channels={[{ icon, label, text, value, href }]} offices={[{ id, city, address, phone, timeZone: "Europe/Lisbon", hours: [{ label, days: [1,2,3,4,5], open?: "09:00", close?: "18:00" }] }]} topics={["Sales", ...]} onSend?={(data) => Promise<void>} />  // use only offices the PRD names
 * Built from: c.tabs.underline, c.badge, c.text-field.outlined, c.select.outlined, c.button.primary, c.button.secondary
 * Look: A centered heading over a row of small cards, each an icon in a tinted square, a label, a line and a link; below, an office card with underline tabs, the address, hours table and a live open status beside a bordered form card.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-accent --color-success --color-danger --color-text --color-text-muted --focus-ring --radius-md --radius-lg --space-1 --space-2 --space-3 --space-4 --space-5 --space-6 --text-xs --text-sm --text-lg --duration-fast --duration-base --duration-slow --ease-out --ease-spring --enter-distance --stagger
 * Use cases: contact page; contact us; offices; locations; opening hours; visit us; support contact; get in touch
 * Jobs to be done: find the right way to reach the team; see if an office is open now; check opening hours; find an office address; send a message to the right team
 * Keywords: contact, offices, locations, hours, opening hours, open now, address, phone, form, support, sales
 */
/**
 * Contact page: channel cards, office tabs and a message form. The tabs follow the WAI-ARIA tabs pattern (arrow keys,
 * Home and End, one tab in the Tab order) with one indicator that slides under the chosen tab. Each office shows its
 * local time and whether it is open, worked out with Intl in the office's own time zone and refreshed every half minute.
 * The form checks a field when you leave it and everything on send; the first wrong field takes focus. Sending shows a
 * busy button, a failure keeps the message and says why, and success shows a short note with Send another.
 * Make it the app's own: replace SAMPLE with the real channels, offices and hours, and pass onSend to deliver messages.
 * Adapted from Meraki UI (MIT License, Copyright (c) 2021 Khatab Wedaa): its contact grid and map layouts.
 */
/**
 * How to try it
 * - Use the arrow keys on the office tabs: the indicator slides and the hours, local time and open status change.
 * - Press Send message with an empty form: each field says what's missing and the first one takes focus.
 * - Fill it in and send; an email ending in "@fail.test" shows the failure, any other shows the sent note.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useRef, useState) and the library's own pieces and inline icon
 * set. Nothing else — no package to install and nothing fetched at run time. The styles are the fl-cof- classes in
 * templates/library/css/r2m-contact-offices.css.
 */
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { TextField } from "./text-fields-states";

// ── b.contact-offices: channels, office tabs with live hours, and a validated message form. ──

export type ContactChannel = {
  icon: string;
  label: string;
  text: string;
  value: string;
  href: string;
};
export type OfficeHours = {
  label: string;
  /** 0 = Sunday ... 6 = Saturday */ days: number[];
  /** "09:00"; left out = closed */ open?: string;
  close?: string;
};
export type ContactOffice = {
  id: string;
  city: string;
  address: string;
  phone?: string;
  timeZone: string;
  hours: OfficeHours[];
};
export type ContactMessage = {
  name: string;
  email: string;
  topic: string;
  office: string;
  message: string;
};

export type ContactOfficesProps = {
  title: string;
  eyebrow?: string;
  lede?: string;
  channels: ContactChannel[];
  offices: ContactOffice[];
  topics: string[];
  /** Delivers the message; reject with an Error to show its message. Resolves after a short pause when left out. */
  onSend?: (data: ContactMessage) => Promise<void>;
};

const MAX = 1000;
const MIN = 10;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const fmtTime = (hhmm: string) => {
  const t = toMin(hhmm);
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/** The office's weekday and minute of the day right now, in its own time zone. */
function localNow(tz: string, now: Date) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const day = WEEKDAY[get("weekday")] ?? now.getDay();
    const label = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      weekday: "short",
    }).format(now);
    return {
      day,
      minute: (Number(get("hour")) % 24) * 60 + Number(get("minute")),
      label,
    };
  } catch {
    return {
      day: now.getDay(),
      minute: now.getHours() * 60 + now.getMinutes(),
      label: now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
    };
  }
}

/** Open now, or when it opens next. */
function openState(o: ContactOffice, now: Date) {
  const { day, minute, label } = localNow(o.timeZone, now);
  const today = o.hours.find((h) => h.days.includes(day));
  if (
    today?.open &&
    today.close &&
    minute >= toMin(today.open) &&
    minute < toMin(today.close)
  ) {
    return {
      open: true,
      text: `Open now · closes ${fmtTime(today.close)}`,
      label,
      day,
    };
  }
  for (let i = 0; i < 8; i++) {
    const d = (day + i) % 7;
    const h = o.hours.find((x) => x.days.includes(d));
    if (!h?.open) continue;
    if (i === 0 && minute >= toMin(h.open)) continue;
    const when = i === 0 ? "today" : i === 1 ? "tomorrow" : DAY_NAMES[d];
    return {
      open: false,
      text: `Closed · opens ${when} at ${fmtTime(h.open)}`,
      label,
      day,
    };
  }
  return { open: false, text: "Closed", label, day };
}

type Field = "name" | "email" | "topic" | "message";
type Errors = Partial<Record<Field, string>>;
const check = (k: Field, v: string): string | undefined => {
  const s = v.trim();
  if (k === "name") return s ? undefined : "Enter your name.";
  if (k === "email")
    return !s
      ? "Enter your email."
      : EMAIL.test(s)
        ? undefined
        : "Enter an email like name@example.com.";
  if (k === "topic") return s ? undefined : "Choose a topic.";
  if (k === "message")
    return !s
      ? "Write a message."
      : s.length < MIN
        ? `Write at least ${MIN} characters.`
        : undefined;
  return undefined;
};
const wait = (n: number) => new Promise<void>((r) => setTimeout(r, n));
const defaultSend = async (d: ContactMessage) => {
  await wait(800);
  if (/@fail\.test$/i.test(d.email))
    throw new Error(
      "We couldn't send your message. Check your connection and try again.",
    );
};

function OfficeTabs({
  offices,
  active,
  onPick,
}: {
  offices: ContactOffice[];
  active: string;
  onPick: (id: string) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const list = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<{ x: number; w: number } | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(t);
  }, []);

  // One indicator: it measures the chosen tab and slides there.
  useLayoutEffect(() => {
    const root = list.current;
    if (!root) return;
    const measure = () => {
      const el = root.querySelector<HTMLElement>('[aria-selected="true"]');
      if (el) setBar({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    if (typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [active]);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = offices.length;
    const to =
      e.key === "ArrowRight"
        ? (i + 1) % n
        : e.key === "ArrowLeft"
          ? (i - 1 + n) % n
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? n - 1
              : -1;
    if (to < 0) return;
    e.preventDefault();
    onPick(offices[to]!.id);
    document.getElementById(`${uid}-tab-${offices[to]!.id}`)?.focus();
  };

  return (
    <div className="fl-cof-offices">
      <div
        className="fl-cof-tabs"
        role="tablist"
        aria-label="Offices"
        ref={list}
      >
        {offices.map((o, i) => (
          <button
            key={o.id}
            id={`${uid}-tab-${o.id}`}
            type="button"
            role="tab"
            className="fl-cof-tab"
            aria-selected={o.id === active}
            aria-controls={`${uid}-panel-${o.id}`}
            tabIndex={o.id === active ? 0 : -1}
            onClick={() => onPick(o.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {o.city}
          </button>
        ))}
        {bar ? (
          <span
            className="fl-cof-bar"
            aria-hidden="true"
            style={{ translate: `${bar.x}px 0`, width: bar.w }}
          />
        ) : null}
      </div>
      {offices.map((o) => {
        const st = openState(o, now);
        return (
          <div
            key={o.id}
            id={`${uid}-panel-${o.id}`}
            role="tabpanel"
            aria-labelledby={`${uid}-tab-${o.id}`}
            hidden={o.id !== active}
            tabIndex={0}
            className="fl-cof-panel"
          >
            <div className="fl-cof-status">
              <Badge tone={st.open ? "success" : "neutral"} led pulse={st.open}>
                {st.open ? "Open now" : "Closed"}
              </Badge>
              <span className="fl-cof-local">
                <Icon name="clock" />
                Local time {st.label}
              </span>
            </div>
            <p className="fl-cof-next">{st.text}</p>
            <ul className="fl-cof-addr">
              <li>
                <Icon name="pin" />
                <span>{o.address}</span>
              </li>
              {o.phone ? (
                <li>
                  <Icon name="phone" />
                  <a href={`tel:${o.phone.replace(/[^+\d]/g, "")}`}>
                    {o.phone}
                  </a>
                </li>
              ) : null}
            </ul>
            <table className="fl-cof-hours">
              <caption className="fl-sr">
                Opening hours, {o.city} local time
              </caption>
              <tbody>
                {o.hours.map((h) => {
                  const today = h.days.includes(st.day);
                  return (
                    <tr
                      key={h.label}
                      className={today ? "is-today" : undefined}
                      aria-current={today ? "date" : undefined}
                    >
                      <th scope="row">
                        {h.label}
                        {today ? (
                          <span className="fl-cof-today">Today</span>
                        ) : null}
                      </th>
                      <td>
                        {h.open && h.close
                          ? `${fmtTime(h.open)} – ${fmtTime(h.close)}`
                          : "Closed"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

export function ContactOffices({
  title,
  eyebrow,
  lede,
  channels,
  offices,
  topics,
  onSend = defaultSend,
}: ContactOfficesProps) {
  const uid = useId().replace(/:/g, "");
  const [active, setActive] = useState(offices[0]?.id ?? "");
  const [values, setValues] = useState<ContactMessage>({
    name: "",
    email: "",
    topic: "",
    office: offices[0]?.id ?? "",
    message: "",
  });
  const [officeTouched, setOfficeTouched] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [errors, setErrors] = useState<Errors>({});
  const [phase, setPhase] = useState<"edit" | "sending" | "sent">("edit");
  const [failure, setFailure] = useState("");
  const doneRef = useRef<HTMLDivElement>(null);

  const pickOffice = (id: string) => {
    setActive(id);
    if (!officeTouched) setValues((v) => ({ ...v, office: id }));
  };
  const set = (k: keyof ContactMessage, v: string) => {
    setValues((s) => ({ ...s, [k]: v }));
    if (k !== "office" && touched[k as Field])
      setErrors((e) => ({ ...e, [k]: check(k as Field, v) }));
  };
  const blur = (k: Field) => {
    setTouched((t) => ({ ...t, [k]: true }));
    setErrors((e) => ({ ...e, [k]: check(k, values[k]) }));
  };

  useEffect(() => {
    if (phase === "sent") doneRef.current?.focus();
  }, [phase]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (phase === "sending") return;
    const fields: Field[] = ["name", "email", "topic", "message"];
    const next: Errors = {};
    for (const k of fields) next[k] = check(k, values[k]);
    setErrors(next);
    setTouched({ name: true, email: true, topic: true, message: true });
    const bad = fields.find((k) => next[k]);
    if (bad) {
      document.getElementById(`${uid}-${bad}`)?.focus();
      return;
    }
    setFailure("");
    setPhase("sending");
    try {
      await onSend({
        ...values,
        name: values.name.trim(),
        email: values.email.trim(),
        message: values.message.trim(),
      });
      setPhase("sent");
    } catch (err) {
      setFailure(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
      setPhase("edit");
    }
  };

  const reset = () => {
    setValues((v) => ({
      name: v.name,
      email: v.email,
      topic: "",
      office: active,
      message: "",
    }));
    setTouched({});
    setErrors({});
    setOfficeTouched(false);
    setPhase("edit");
    setTimeout(() => document.getElementById(`${uid}-topic`)?.focus(), 0);
  };

  const err = (k: Field) =>
    errors[k] ? (
      <p className="fl-cof-err" id={`${uid}-${k}-err`}>
        <Icon name="alert" />
        {errors[k]}
      </p>
    ) : null;
  const desc = (k: Field, extra?: string) =>
    [errors[k] ? `${uid}-${k}-err` : "", extra ?? ""]
      .filter(Boolean)
      .join(" ") || undefined;
  const left = MAX - values.message.length;
  const officeName = offices.find((o) => o.id === values.office)?.city ?? "";

  return (
    <div className="fl-cof" data-fl="b.contact-offices">
      <header className="fl-cof-head">
        {eyebrow ? <p className="fl-eyebrow">{eyebrow}</p> : null}
        <h2 className="fl-title">{title}</h2>
        {lede ? <p className="fl-lede">{lede}</p> : null}
      </header>

      <ul className="fl-cof-channels">
        {channels.map((c, i) => (
          <li
            key={c.label}
            className="fl-cof-channel"
            style={{ ["--i" as string]: i }}
          >
            <span className="fl-cof-chico" aria-hidden="true">
              <Icon name={c.icon} />
            </span>
            <h3>{c.label}</h3>
            <p>{c.text}</p>
            <a href={c.href}>{c.value}</a>
          </li>
        ))}
      </ul>

      <div className="fl-cof-main">
        <section className="fl-cof-card" aria-labelledby={`${uid}-off-h`}>
          <h3 id={`${uid}-off-h`} className="fl-cof-card-h">
            Visit us
          </h3>
          <OfficeTabs offices={offices} active={active} onPick={pickOffice} />
        </section>

        <section className="fl-cof-card" aria-labelledby={`${uid}-form-h`}>
          <h3 id={`${uid}-form-h`} className="fl-cof-card-h">
            Send a message
          </h3>
          {phase === "sent" ? (
            <div
              className="fl-cof-done"
              ref={doneRef}
              tabIndex={-1}
              role="status"
            >
              <span className="fl-cof-done-ico" aria-hidden="true">
                <Icon name="check" />
              </span>
              <p>
                <strong>Message sent.</strong> The {officeName} team replies
                within one working day.
              </p>
              <Button variant="secondary" size={40} onClick={reset}>
                Send another
              </Button>
            </div>
          ) : (
            <form
              className="fl-cof-form"
              noValidate
              onSubmit={submit}
              aria-busy={phase === "sending" || undefined}
            >
              {failure ? (
                <p className="fl-cof-fail" role="alert">
                  <Icon name="alert" />
                  {failure}
                </p>
              ) : null}
              <div className="fl-cof-two">
                <div className="fl-field">
                  <label htmlFor={`${uid}-name`}>Name</label>
                  <TextField
                    id={`${uid}-name`}
                    autoComplete="name"
                    value={values.name}
                    invalid={!!errors.name}
                    aria-describedby={desc("name")}
                    onChange={(e) => set("name", e.target.value)}
                    onBlur={() => blur("name")}
                  />
                  {err("name")}
                </div>
                <div className="fl-field">
                  <label htmlFor={`${uid}-email`}>Email</label>
                  <TextField
                    id={`${uid}-email`}
                    type="email"
                    autoComplete="email"
                    value={values.email}
                    invalid={!!errors.email}
                    aria-describedby={desc("email")}
                    onChange={(e) => set("email", e.target.value)}
                    onBlur={() => blur("email")}
                  />
                  {err("email")}
                </div>
              </div>
              <div className="fl-cof-two">
                <div className="fl-field">
                  <label htmlFor={`${uid}-topic`}>Topic</label>
                  <Select
                    id={`${uid}-topic`}
                    placeholder="Choose a topic"
                    value={values.topic}
                    options={topics}
                    invalid={!!errors.topic}
                    aria-describedby={desc("topic")}
                    onChange={(e) => set("topic", e.target.value)}
                    onBlur={() => blur("topic")}
                  />
                  {err("topic")}
                </div>
                <div className="fl-field">
                  <label htmlFor={`${uid}-office`}>Office</label>
                  <Select
                    id={`${uid}-office`}
                    value={values.office}
                    options={offices.map((o) => ({
                      value: o.id,
                      label: o.city,
                    }))}
                    onChange={(e) => {
                      setOfficeTouched(true);
                      set("office", e.target.value);
                    }}
                  />
                </div>
              </div>
              <div className="fl-field">
                <label htmlFor={`${uid}-message`}>Message</label>
                <TextField
                  id={`${uid}-message`}
                  multiline
                  autoGrow
                  rows={4}
                  maxLength={MAX}
                  value={values.message}
                  invalid={!!errors.message}
                  aria-describedby={desc("message", `${uid}-count`)}
                  onChange={(e) => set("message", e.target.value)}
                  onBlur={() => blur("message")}
                />
                <div className="fl-cof-msgfoot">
                  {err("message") ?? <span />}
                  <span
                    id={`${uid}-count`}
                    className={`fl-cof-count${left < 100 ? " is-low" : ""}`}
                  >
                    {left} characters left
                  </span>
                </div>
              </div>
              <div className="fl-cof-send">
                <Button
                  type="submit"
                  variant="primary"
                  icon="send"
                  busy={phase === "sending"}
                >
                  {phase === "sending" ? "Sending..." : "Send message"}
                </Button>
              </div>
              <p className="fl-sr" role="status" aria-live="polite">
                {phase === "sending" ? "Sending your message" : ""}
              </p>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

const WEEK: OfficeHours[] = [
  {
    label: "Monday – Friday",
    days: [1, 2, 3, 4, 5],
    open: "09:00",
    close: "18:00",
  },
  { label: "Saturday", days: [6], open: "10:00", close: "14:00" },
  { label: "Sunday", days: [0] },
];
// flowcode:sample
const SAMPLE: ContactOfficesProps = {
  eyebrow: "Contact",
  title: "We'd love to hear from you",
  lede: "Pick the fastest way to reach us, or drop by an office.",
  channels: [
    {
      icon: "mail",
      label: "Sales",
      text: "Plans, pricing and demos.",
      value: "sales@northlight.example",
      href: "mailto:sales@northlight.example",
    },
    {
      icon: "help",
      label: "Support",
      text: "Replies within four hours.",
      value: "help@northlight.example",
      href: "mailto:help@northlight.example",
    },
    {
      icon: "phone",
      label: "Call us",
      text: "Mon–Fri, 9 AM to 6 PM.",
      value: "+1 (555) 010-2040",
      href: "tel:+15550102040",
    },
    {
      icon: "users",
      label: "Community",
      text: "Ask other customers.",
      value: "Join the forum",
      href: "#forum",
    },
  ],
  offices: [
    {
      id: "lisbon",
      city: "Lisbon",
      address: "Rua das Flores 28, 1200-195 Lisbon, Portugal",
      phone: "+351 21 000 4020",
      timeZone: "Europe/Lisbon",
      hours: WEEK,
    },
    {
      id: "toronto",
      city: "Toronto",
      address: "120 King Street West, Toronto, ON M5X 1A9, Canada",
      phone: "+1 (416) 555-0140",
      timeZone: "America/Toronto",
      hours: WEEK,
    },
    {
      id: "singapore",
      city: "Singapore",
      address: "8 Marina View, #12-01, Singapore 018960",
      phone: "+65 6555 0170",
      timeZone: "Asia/Singapore",
      hours: [
        {
          label: "Monday – Friday",
          days: [1, 2, 3, 4, 5],
          open: "08:30",
          close: "17:30",
        },
        { label: "Weekend", days: [0, 6] },
      ],
    },
  ],
  topics: ["Sales", "Support", "Billing", "Partnerships", "Press"],
};

export default function ContactOfficesPreview() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap">
        <ContactOffices {...SAMPLE} />
      </div>
    </section>
  );
}
