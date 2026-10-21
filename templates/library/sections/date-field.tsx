/** @flowcode-library date-field · Date field (Forms)
 * Catalog ID: c.date-field (component)
 * Function: A typed date (and optional time) in month, day and year boxes inside one field, in the person's own order, stepped with the arrow keys, checked against a first and last allowed day, with the full date read back in words.
 * Use it as: import { DateField } from "./date-field"; <DateField label="Date of birth" value?/defaultValue?="2026-06-16"|"2026-06-16T09:30" onChange?={(iso | null, { complete, inRange }) => ...} withTime? min?="2026-06-01" max?="2026-06-30" locale? leadingZeros?={true} required? disabled? readOnly? hint? error? name? id? labels?={{ year, month, day, hour, minute, period, clear, full, partial, before, after, changed, placeholders }} />
 * Built from: c.button.tertiary
 * Look: One bordered field holding small month, day and year boxes with quiet separators in the person's own order; the focused box fills with a soft accent tint, typed digits tick in, a clear button sits at the right edge, and the date in words sits quietly underneath.
 * Tokens: --color-surface --color-surface-sunken --color-border-strong --color-text --color-text-muted --color-accent --color-danger --field-radius --radius-sm --space-1 --space-2 --text-sm --text-md --font-sans --duration-fast --duration-base --ease-out --focus-ring
 * Use cases: date of birth; appointment date; departure date and time; invoice due date; expiry date; booking form; profile form
 * Jobs to be done: type a date I already know; fix one part of a date without retyping it; know the date I typed is allowed; enter a date the way my country writes it
 * Keywords: date field, date input, segmented date, typed date, birthday, date time, spinbutton, keyboard, locale
 */
/**
 * Date field: for dates people already know (a birthday, an expiry date) a calendar is slower than typing. Each part
 * of the date is its own small box that takes digits and jumps on when it is full, so "06162026" types straight
 * through. The boxes follow the person's own order (month first in the US, day first in the UK, year first in Japan).
 * Up and Down step a part (wrapping round), Page Up and Page Down step further, Home and End go to its ends, Left and
 * Right move between parts, Backspace clears, and typing a separator moves on. Changing the month pulls a day that no
 * longer fits back to the month's last day and says so. A first and last allowed day are checked as soon as the date
 * is whole; the whole date is read back in words under the field.
 * Make it the app's own: pass min and max from the app's rules and save the ISO value onChange.
 * Adapted from TailGrids (MIT, Copyright (c) 2025 Tailgrids): its date field's anatomy (segments, min and max,
 * validation, date and time, leading zeros, locale order), rewritten without its dependencies.
 */
/**
 * How to try it
 * - Click Date of birth and type 07041990: the boxes fill and the cursor jumps on.
 * - Press Up and Down in the month: it steps and wraps. Page Up jumps further.
 * - In Appointment, type a day in July: it says June only.
 * - Set day 31 then change the month to 2: the day becomes 28 or 29 and it says so.
 * - Switch the order to UK, Germany or Japan: the boxes reorder.
 *
 * Dependencies: React (useEffect, useId, useMemo, useRef, useState), the library's Button ("./buttons-variants"),
 * Segmented ("./segmented-control") and its inline icon set ("./icons"), which is a table of SVG paths rather than an
 * icon package. Nothing else — no package to install and nothing fetched at run time. The styles are the library's own
 * fl- classes in templates/library/css, and the sample data is in the file, so the piece runs in a built app exactly as
 * it runs here.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";
import { Segmented } from "./segmented-control";

// ── c.date-field: one spin box per part of the date, in the person's own order. ──

type Part = "year" | "month" | "day" | "hour" | "minute" | "period";
type Parts = { year?: number; month?: number; day?: number; hour?: number; minute?: number; period?: "AM" | "PM" };
type Layout = Array<{ kind: "part"; part: Part } | { kind: "sep"; text: string }>;

export type DateFieldLabels = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  period: string;
  clear: string;
  /** The field is required and empty. */
  full: string;
  /** Some parts are filled, some are not. */
  partial: string;
  /** Before min; {date} is the first allowed day. */
  before: string;
  /** After max; {date} is the last allowed day. */
  after: string;
  /** A day pulled back to fit a shorter month; {date} is the new date. */
  changed: string;
  /** Short placeholders shown in empty parts. */
  placeholders: Record<Part, string>;
};

const LABELS: DateFieldLabels = {
  year: "Year",
  month: "Month",
  day: "Day",
  hour: "Hour",
  minute: "Minute",
  period: "AM or PM",
  clear: "Clear date",
  full: "Enter a date.",
  partial: "Finish the date.",
  before: "Pick {date} or later.",
  after: "Pick {date} or earlier.",
  changed: "Day changed to fit: {date}.",
  placeholders: { year: "yyyy", month: "mm", day: "dd", hour: "––", minute: "––", period: "AM" },
};

export type DateFieldProps = {
  label: string;
  /** "YYYY-MM-DD", or "YYYY-MM-DDTHH:MM" with withTime; null or "" for empty. Controlled when given. */
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string | null, info: { complete: boolean; inRange: boolean }) => void;
  /** Adds hour and minute (and AM/PM where the locale's clock is 12-hour). */
  withTime?: boolean;
  /** First and last allowed day, "YYYY-MM-DD". */
  min?: string;
  max?: string;
  /** Decides the order of the parts and the clock; the browser's when left out. */
  locale?: string;
  /** "06" rather than "6" for months, days and hours. */
  leadingZeros?: boolean;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  hint?: string;
  /** An error from outside (the server, a rule the field doesn't know). */
  error?: string;
  /** Posts the ISO value with a form. */
  name?: string;
  id?: string;
  labels?: Partial<DateFieldLabels>;
  className?: string;
};

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const daysIn = (y: number | undefined, m: number | undefined) => (m ? new Date(Date.UTC(y ?? 2000, m, 0)).getUTCDate() : 31);
const isoOf = (y: number, m: number, d: number) => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;

function parse(v: string | null | undefined, hour12: boolean): Parts {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(v ?? "");
  if (!m) return {};
  const p: Parts = { year: +m[1]!, month: +m[2]!, day: +m[3]! };
  if (m[4] !== undefined) {
    const h = +m[4]!;
    p.minute = +m[5]!;
    if (hour12) {
      p.hour = h % 12 || 12;
      p.period = h < 12 ? "AM" : "PM";
    } else p.hour = h;
  }
  return p;
}

function layoutFor(locale: string | undefined, withTime: boolean): { layout: Layout; hour12: boolean } {
  const parts = new Intl.DateTimeFormat(locale, { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(2026, 0, 2));
  const layout: Layout = [];
  for (const p of parts) {
    if (p.type === "year" || p.type === "month" || p.type === "day") layout.push({ kind: "part", part: p.type });
    else if (p.type === "literal" && layout.length && layout.length < 5) layout.push({ kind: "sep", text: p.value.trim() || " " });
  }
  while (layout.length && layout[layout.length - 1]!.kind === "sep") layout.pop();
  const hc = new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions().hourCycle;
  const hour12 = hc === "h12" || hc === "h11";
  if (withTime) {
    layout.push({ kind: "sep", text: "," }, { kind: "part", part: "hour" }, { kind: "sep", text: ":" }, { kind: "part", part: "minute" });
    if (hour12) layout.push({ kind: "sep", text: " " }, { kind: "part", part: "period" });
  }
  return { layout, hour12 };
}

const RANGE = (part: Part, p: Parts, hour12: boolean): [number, number] =>
  part === "year" ? [1, 9999] : part === "month" ? [1, 12] : part === "day" ? [1, daysIn(p.year, p.month)] : part === "hour" ? (hour12 ? [1, 12] : [0, 23]) : part === "minute" ? [0, 59] : [0, 1];
const BIG: Record<Part, number> = { year: 10, month: 3, day: 7, hour: 6, minute: 15, period: 1 };

export function DateField({
  label,
  value,
  defaultValue,
  onChange,
  withTime = false,
  min,
  max,
  locale,
  leadingZeros = true,
  required,
  disabled,
  readOnly,
  hint,
  error,
  name,
  id,
  labels,
  className,
}: DateFieldProps) {
  const L = { ...LABELS, ...labels, placeholders: { ...LABELS.placeholders, ...labels?.placeholders } };
  const auto = useId();
  const base = id ?? `df${auto.replace(/:/g, "")}`;
  const { layout, hour12 } = useMemo(() => layoutFor(locale, withTime), [locale, withTime]);
  const order = layout.flatMap((x) => (x.kind === "part" ? [x.part] : []));
  const [parts, setParts] = useState<Parts>(() => parse(value !== undefined ? value : defaultValue, hour12));
  const [typed, setTyped] = useState<{ part: Part; text: string } | null>(null);
  const [touched, setTouched] = useState(false);
  const [note, setNote] = useState("");
  const [tick, setTick] = useState<{ part: Part; n: number } | null>(null);
  const refs = useRef<Partial<Record<Part, HTMLInputElement | null>>>({});
  const group = useRef<HTMLDivElement>(null);
  // The keys of a fast typist (or a pasted date) arrive before React draws again, so the handlers read these refs.
  const pRef = useRef(parts);
  const tRef = useRef(typed);
  pRef.current = parts;
  tRef.current = typed;
  const putParts = (p: Parts) => {
    pRef.current = p;
    setParts(p);
  };
  const putTyped = (t: { part: Part; text: string } | null) => {
    tRef.current = t;
    setTyped(t);
  };
  const fmtDate = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }), [locale]);
  const fmtLong = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}) }),
    [locale, withTime],
  );
  const says = (iso: string) => fmtDate.format(new Date(`${iso}T00:00:00Z`));

  const needed = order;
  const filled = needed.filter((k) => parts[k] !== undefined).length;
  const complete = filled === needed.length;
  const empty = filled === 0;
  const hour24 = parts.hour === undefined ? undefined : hour12 ? (parts.hour % 12) + (parts.period === "PM" ? 12 : 0) : parts.hour;
  const dateIso = parts.year && parts.month && parts.day ? isoOf(parts.year, parts.month, parts.day) : null;
  const iso = complete && dateIso ? (withTime ? `${dateIso}T${pad(hour24 ?? 0)}:${pad(parts.minute ?? 0)}` : dateIso) : null;
  const before = !!(dateIso && min && dateIso < min);
  const after = !!(dateIso && max && dateIso > max);
  const inRange = !before && !after;

  // A controlled value from outside replaces what is shown, unless it is what the field already holds.
  const last = useRef<string | null>(iso);
  useEffect(() => {
    if (value === undefined || (value || null) === last.current) return;
    last.current = value || null;
    putParts(parse(value, hour12));
    putTyped(null);
  }, [value, hour12]);

  const commit = (next: Parts) => {
    // A day that no longer fits the month is pulled back to the month's last day, and that is said out loud.
    setNote("");
    if (next.day && next.month && next.day > daysIn(next.year, next.month)) {
      next = { ...next, day: daysIn(next.year, next.month) };
      if (next.year) setNote(L.changed.replace("{date}", says(isoOf(next.year, next.month!, next.day!))));
    }
    putParts(next);
    const filledNext = order.filter((k) => next[k] !== undefined).length === order.length;
    const d = next.year && next.month && next.day ? isoOf(next.year, next.month, next.day) : null;
    const h = next.hour === undefined ? 0 : hour12 ? (next.hour % 12) + (next.period === "PM" ? 12 : 0) : next.hour;
    const out = filledNext && d ? (withTime ? `${d}T${pad(h)}:${pad(next.minute ?? 0)}` : d) : null;
    if (out !== last.current) {
      last.current = out;
      onChange?.(out, { complete: filledNext, inRange: !(d && ((min && d < min) || (max && d > max))) });
    }
  };

  const set = (part: Part, n: number | undefined | "AM" | "PM") => {
    const next = { ...pRef.current, [part]: n } as Parts;
    if (n !== undefined) setTick({ part, n: Date.now() });
    commit(next);
  };
  const focusAt = (i: number) => {
    const k = order[Math.max(0, Math.min(order.length - 1, i))];
    if (k) refs.current[k]?.focus();
  };
  const move = (part: Part, by: number) => focusAt(order.indexOf(part) + by);

  const step = (part: Part, by: number) => {
    if (part === "period") return set("period", pRef.current.period === "PM" ? "AM" : "PM");
    const [lo, hi] = RANGE(part, pRef.current, hour12);
    const now = new Date();
    const cur = pRef.current[part] as number | undefined;
    if (cur === undefined) {
      const start = part === "year" ? now.getFullYear() : part === "month" ? now.getMonth() + 1 : part === "day" ? Math.min(now.getDate(), hi) : part === "hour" ? (hour12 ? now.getHours() % 12 || 12 : now.getHours()) : 0;
      return set(part, start);
    }
    const span = hi - lo + 1;
    set(part, part === "year" ? Math.max(lo, Math.min(hi, cur + by)) : ((((cur - lo + by) % span) + span) % span) + lo);
  };

  const typeDigit = (part: Part, digit: string) => {
    const [lo, hi] = RANGE(part, pRef.current, hour12);
    const width = part === "year" ? 4 : 2;
    let text = tRef.current?.part === part ? tRef.current!.text + digit : digit;
    if (part !== "year" && Number(text) > hi) text = digit;
    const n = Number(text);
    // Full when it has all its digits, or when no further digit could still fit (a 4 in the month can only be April).
    const full = text.length >= width || (part !== "year" && n * 10 > hi);
    putTyped(full ? null : { part, text });
    set(part, n >= lo ? n : full ? lo : undefined);
    if (full) move(part, 1);
    return full;
  };

  const onKey = (part: Part, e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    const k = e.key;
    const nav: Record<string, () => void> = {
      ArrowLeft: () => move(part, -1),
      ArrowRight: () => move(part, 1),
    };
    if (nav[k]) return (e.preventDefault(), nav[k]!());
    if (readOnly || e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === "ArrowUp" || k === "ArrowDown" || k === "PageUp" || k === "PageDown") {
      e.preventDefault();
      putTyped(null);
      return step(part, (k.startsWith("Page") ? BIG[part] : 1) * (k === "ArrowUp" || k === "PageUp" ? 1 : -1));
    }
    if (k === "Home" || k === "End") {
      e.preventDefault();
      putTyped(null);
      if (part === "period") return set("period", k === "Home" ? "AM" : "PM");
      const [lo, hi] = RANGE(part, pRef.current, hour12);
      return set(part, k === "Home" ? lo : hi);
    }
    if (k === "Backspace" || k === "Delete") {
      e.preventDefault();
      if (tRef.current?.part === part && tRef.current!.text.length > 1) {
        const text = tRef.current!.text.slice(0, -1);
        putTyped({ part, text });
        return set(part, Number(text) || undefined);
      }
      putTyped(null);
      if (pRef.current[part] === undefined && k === "Backspace") return move(part, -1);
      return set(part, undefined);
    }
    if (part === "period" && /^[ap]$/i.test(k)) return (e.preventDefault(), set("period", k.toLowerCase() === "a" ? "AM" : "PM"), move(part, 1));
    if (/^\d$/.test(k) && part !== "period") return (e.preventDefault(), typeDigit(part, k));
    if (/^[/.\-:, ]$/.test(k)) {
      e.preventDefault();
      if (pRef.current[part] !== undefined) (putTyped(null), move(part, 1));
      return;
    }
    if (k.length === 1) e.preventDefault();
  };

  // Phones send typed characters without a usable key; read the character from the input event instead.
  const onInput = (part: Part, data: string | null) => {
    if (!data || disabled || readOnly) return;
    // Several characters at once (a paste, a fast keyboard) flow on from part to part.
    let at = part;
    const next = () => order[Math.min(order.length - 1, order.indexOf(at) + 1)]!;
    for (const ch of data) {
      if (/\d/.test(ch) && at !== "period") {
        if (typeDigit(at, ch)) at = next();
      } else if (at === "period" && /[ap]/i.test(ch)) set("period", ch.toLowerCase() === "a" ? "AM" : "PM");
      else if (/[/.\-:, ]/.test(ch) && pRef.current[at] !== undefined) {
        putTyped(null);
        move(at, 1);
        at = next();
      }
    }
  };

  const shown = (part: Part): string => {
    if (typed?.part === part) return part === "year" ? typed.text : typed.text.padStart(leadingZeros ? 2 : 1, "0");
    const v = parts[part];
    if (v === undefined) return "";
    if (part === "period") return String(v);
    if (part === "year") return pad(v as number, 4);
    if (part === "minute") return pad(v as number);
    return leadingZeros ? pad(v as number) : String(v);
  };

  const onBlurGroup = () => {
    requestAnimationFrame(() => {
      if (group.current?.contains(document.activeElement)) return;
      setTouched(true);
      putTyped(null);
      // A two-digit year means this century unless that is more than 20 years ahead.
      if (pRef.current.year !== undefined && pRef.current.year < 100) {
        const yy = new Date().getFullYear() % 100;
        commit({ ...pRef.current, year: (pRef.current.year <= yy + 20 ? 2000 : 1900) + pRef.current.year });
      }
    });
  };

  const own = error
    ? error
    : before && min
      ? L.before.replace("{date}", says(min))
      : after && max
        ? L.after.replace("{date}", says(max))
        : touched && !empty && !complete
          ? L.partial
          : touched && required && empty
            ? L.full
            : "";
  const words = iso && inRange ? fmtLong.format(new Date(`${iso.length === 10 ? `${iso}T00:00` : iso}:00Z`)) : "";
  const labelId = `${base}-label`;
  const hintId = `${base}-hint`;
  const errId = `${base}-err`;
  const described = [own ? errId : "", hint ? hintId : "", `${base}-said`].filter(Boolean).join(" ");

  return (
    <div className={["fl-dtf", className ?? ""].filter(Boolean).join(" ")} data-fl="c.date-field">
      <label id={labelId} className="fl-dtf-label" htmlFor={`${base}-first`}>
        {label}
        {required ? <span className="fl-dtf-req" aria-hidden="true"> *</span> : null}
      </label>
      <div
        ref={group}
        role="group"
        aria-labelledby={labelId}
        aria-describedby={described}
        aria-invalid={own ? true : undefined}
        aria-disabled={disabled || undefined}
        className={`fl-dtf-box${own ? " is-invalid" : ""}${disabled ? " is-disabled" : ""}${readOnly ? " is-readonly" : ""}`}
        onBlur={onBlurGroup}
        onMouseDown={(e) => {
          // A click on the field's padding goes to the first empty part, as a single input would.
          if (e.target === e.currentTarget && !disabled) {
            e.preventDefault();
            const i = order.findIndex((k) => parts[k] === undefined);
            focusAt(i === -1 ? order.length - 1 : i);
          }
        }}
      >
        <Icon name="calendar" />
        <span className="fl-dtf-parts">
          {layout.map((x, i) =>
            x.kind === "sep" ? (
              <span key={`s${i}`} className="fl-dtf-sep" aria-hidden="true">
                {x.text}
              </span>
            ) : (
              <input
                key={x.part}
                ref={(el) => {
                  refs.current[x.part] = el;
                }}
                id={x.part === order[0] ? `${base}-first` : undefined}
                className={`fl-dtf-seg fl-dtf-seg--${x.part}${parts[x.part] === undefined && typed?.part !== x.part ? " is-empty" : ""}`}
                data-tick={tick?.part === x.part ? tick.n % 2 : undefined}
                role="spinbutton"
                inputMode={x.part === "period" ? "text" : "numeric"}
                autoComplete="off"
                spellCheck={false}
                aria-label={L[x.part]}
                aria-valuemin={x.part === "period" ? undefined : RANGE(x.part, parts, hour12)[0]}
                aria-valuemax={x.part === "period" ? undefined : RANGE(x.part, parts, hour12)[1]}
                aria-valuenow={x.part === "period" || parts[x.part] === undefined ? undefined : (parts[x.part] as number)}
                aria-valuetext={parts[x.part] === undefined ? "Empty" : x.part === "month" ? new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, (parts.month ?? 1) - 1, 1))) : shown(x.part)}
                aria-readonly={readOnly || undefined}
                disabled={disabled}
                placeholder={L.placeholders[x.part]}
                value={shown(x.part)}
                size={x.part === "year" ? 4 : 2}
                onKeyDown={(e) => onKey(x.part, e)}
                onChange={(e) => onInput(x.part, (e.nativeEvent as InputEvent).data ?? null)}
                onFocus={(e) => {
                  putTyped(null);
                  e.currentTarget.select();
                }}
                onClick={(e) => e.currentTarget.select()}
              />
            ),
          )}
        </span>
        {!empty && !disabled && !readOnly ? (
          <Button
            variant="tertiary"
            size={24}
            icon="close"
            iconOnly
            className="fl-dtf-clear"
            tabIndex={-1}
            onClick={() => {
              putTyped(null);
              commit({});
              setNote("");
              focusAt(0);
            }}
          >
            {L.clear}
          </Button>
        ) : null}
      </div>
      {name ? <input type="hidden" name={name} value={iso ?? ""} /> : null}
      {own ? (
        <p id={errId} className="fl-dtf-error">
          <Icon name="alert" />
          {own}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="fl-dtf-hint">
          {hint}
        </p>
      ) : null}
      <p id={`${base}-said`} className="fl-dtf-said" role="status">
        {note || words}
      </p>
    </div>
  );
}

// ── The reference sheet: a birthday, an appointment in June and a departure with a time, in four orders. ──

// flowcode:sample
const SAMPLE = {
  eyebrow: "Forms",
  title: "Type a date",
  lede: "Each part takes digits and moves on. Arrows step, Backspace clears.",
  locales: [
    { value: "en-US", label: "US" },
    { value: "en-GB", label: "UK" },
    { value: "de-DE", label: "Germany" },
    { value: "ja-JP", label: "Japan" },
  ],
  birthday: { label: "Date of birth", hint: "As on your ID.", max: "2026-10-21" },
  appointment: { label: "Appointment", hint: "June 2026 only.", min: "2026-06-01", max: "2026-06-30", value: "2026-06-16" },
  departure: { label: "Departure", hint: "Local time at the airport.", value: "2026-11-03T07:45" },
  saved: "Saved",
};

export default function DateFieldPreview() {
  const d = SAMPLE;
  const [locale, setLocale] = useState("en-US");
  const [birthday, setBirthday] = useState<string | null>(null);
  const [appt, setAppt] = useState<string | null>(d.appointment.value);
  const [apptOk, setApptOk] = useState(true);
  const [leave, setLeave] = useState<string | null>(d.departure.value);

  return (
    <section className="fl-section fl-section--canvas" aria-labelledby="date-field-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="date-field-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <div className="fl-dtf-sheet">
          <Segmented variant="toggle" label="Date order" options={d.locales} value={locale} onChange={setLocale} size="sm" />
          <div className="fl-dtf-grid">
            <div className="fl-dtf-card">
              <DateField key={`b${locale}`} label={d.birthday.label} hint={d.birthday.hint} max={d.birthday.max} required locale={locale} value={birthday} onChange={(v) => setBirthday(v)} name="birthday" />
            </div>
            <div className="fl-dtf-card">
              <DateField
                key={`a${locale}`}
                label={d.appointment.label}
                hint={d.appointment.hint}
                min={d.appointment.min}
                max={d.appointment.max}
                locale={locale}
                value={appt}
                onChange={(v, info) => {
                  setAppt(v);
                  setApptOk(info.inRange);
                }}
              />
            </div>
            <div className="fl-dtf-card">
              <DateField key={`d${locale}`} label={d.departure.label} hint={d.departure.hint} withTime locale={locale} value={leave} onChange={(v) => setLeave(v)} />
            </div>
          </div>
          <dl className="fl-dtf-out" aria-label="Values the form would save">
            <div>
              <dt>{d.birthday.label}</dt>
              <dd>{birthday ?? "—"}</dd>
            </div>
            <div>
              <dt>{d.appointment.label}</dt>
              <dd>{appt ? `${appt}${apptOk ? "" : " (not allowed)"}` : "—"}</dd>
            </div>
            <div>
              <dt>{d.departure.label}</dt>
              <dd>{leave ?? "—"}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
