/** @flowcode-library date-picker · Date picker: docked, inline and a range (Forms)
 * Catalog ID: c.date-picker (component)
 * Function: The date picker (c.date-picker): a calendar moved through with the mouse or the keyboard, in a field that opens it, on the page, or for a start and an end; typed dates read in the person's own order. Also exports Calendar, the month grid on its own.
 * Use it as: import { DatePicker, Calendar } from "./date-picker"; <DatePicker variant?="docked"|"range" label value?="2026-04-22" onChange?={(iso) => ...} range?={{ start?, end? }} onRangeChange?={(r) => ...} hint? error? min? max? isDisabled?={(iso) => boolean} marks?={{ "2026-04-22": "open"|"few"|"full" }} weekStart?={0|1} locale? />; <Calendar value? onPick={(iso) => ...} min? max? isDisabled? marks? label />  // dates are YYYY-MM-DD strings in local time
 * Variants: c.date-picker.docked - a date people may know already (a birthday, a session date): a text field that takes a typed date, with a calendar button that opens the month beside it; c.date-picker.inline - picking the day is the screen's main job (a delivery day, an appointment): the month calendar on the page, with arrows to move between months; c.date-picker.range - a start and an end (a holiday, a report period): one calendar, two clicks, the days between shaded
 * Look: A month grid of round day buttons under the month's name and two arrows; today is ringed, the chosen day filled with the accent, days that can't be chosen faded and struck through, and an optional dot under days with times free.
 * Tokens: --color-accent --color-on-accent --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-success --color-danger --control-md --field-radius --pill-radius --surface-shadow-overlay --duration-base --easing --focus-ring
 * Use cases: appointment date; delivery date; due date; date of birth; holiday dates; report period; event date; check-in and check-out
 * Jobs to be done: pick a day; choose a start and end date; type a date I already know; see which days are free
 * Keywords: date picker, calendar, date, date range, day picker, booking date, due date, birthday, schedule
 */
/**
 * Date picker: a month calendar people move through with the mouse or the keyboard, used three ways - in a field that
 * opens it (docked), on the page (inline), or to pick a start and an end (range). Dates go in and out as YYYY-MM-DD
 * strings in the person's own time zone, so nothing shifts by a day. The field also takes a typed date, in the order
 * the person's locale writes dates.
 * Written for FlowCode; the behaviour follows the date picker guidance in Material 3 and the WAI-ARIA date picker
 * dialog pattern (no code from either).
 * Make it the app's own: replace SAMPLE with your own labels and the dates that can't be chosen.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "./icons";

// ── Dates as YYYY-MM-DD, worked out in local time ──

export type IsoDate = string;
const pad = (n: number) => String(n).padStart(2, "0");
export const toIso = (d: Date): IsoDate => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function fromIso(s: IsoDate | undefined): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 ? d : undefined;
}
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** The same day in another month, kept inside that month (31 January + 1 month is 28 or 29 February). */
const addMonths = (d: Date, n: number) => {
  const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
  return new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last));
};
const todayIso = () => toIso(new Date());

/** A typed date, read in the order the locale writes dates (day/month/year, month/day/year or year-month-day). */
export function parseTyped(text: string, locale?: string): IsoDate | undefined {
  const t = text.trim();
  if (fromIso(t)) return t;
  const nums = t.split(/[^0-9]+/).filter(Boolean).map(Number);
  if (nums.length !== 3) return undefined;
  const order = new Intl.DateTimeFormat(locale).formatToParts(new Date(2000, 10, 22)).filter((p) => p.type === "day" || p.type === "month" || p.type === "year").map((p) => p.type);
  const at = (k: string) => nums[order.indexOf(k as "day")]!;
  let y = at("year");
  if (y < 100) y += 2000;
  const iso = `${y}-${pad(at("month"))}-${pad(at("day"))}`;
  return fromIso(iso) ? iso : undefined;
}

// ── c.date-picker: the calendar ──

export type DatePickerVariant = "docked" | "inline" | "range";
export type DayMark = "open" | "few" | "full";
export type DateRange = { start?: IsoDate; end?: IsoDate };

const FL: Record<DatePickerVariant, string> = { docked: "c.date-picker.docked", inline: "c.date-picker.inline", range: "c.date-picker.range" };

/**
 * The month grid. Arrow keys move a day or a week, Page Up/Down a month (with Shift, a year), Home/End to the start or
 * end of the week, Enter or Space picks. Only the focused day is in the tab order.
 */
export function Calendar({
  value,
  range,
  onPick,
  min,
  max,
  isDisabled,
  marks,
  weekStart = 1,
  locale,
  label = "Choose a date",
  autoFocus,
  variant = "inline",
}: {
  /** The chosen day (single mode). */
  value?: IsoDate;
  /** The chosen start and end (range mode). */
  range?: DateRange;
  onPick: (day: IsoDate) => void;
  min?: IsoDate;
  max?: IsoDate;
  /** Days that can't be chosen (closed days, full days). */
  isDisabled?: (day: IsoDate) => boolean;
  /** Availability under each day: a dot for open, a hollow dot for a few left, a line through when full. */
  marks?: Record<IsoDate, DayMark>;
  /** 0 Sunday, 1 Monday. */
  weekStart?: 0 | 1;
  locale?: string;
  label?: string;
  autoFocus?: boolean;
  variant?: DatePickerVariant;
}) {
  const id = useId().replace(/:/g, "");
  const start = range ? range.start : value;
  const [focus, setFocus] = useState<Date>(() => fromIso(start) ?? fromIso(min && todayIso() < min ? min : todayIso())!);
  const [dir, setDir] = useState<"next" | "prev" | "">("");
  const grid = useRef<HTMLTableElement>(null);
  const moved = useRef(false);
  const month = new Date(focus.getFullYear(), focus.getMonth(), 1);
  const fmtMonth = useMemo(() => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }), [locale]);
  const fmtDay = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }), [locale]);
  const fmtWeek = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "narrow" }), [locale]);
  const fmtWeekLong = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "long" }), [locale]);
  const off = (iso: IsoDate) => (min !== undefined && iso < min) || (max !== undefined && iso > max) || !!isDisabled?.(iso) || marks?.[iso] === "full";

  // Six weeks from the first day of the week that holds the 1st.
  const first = addDays(month, -((month.getDay() - weekStart + 7) % 7));
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i));
  const weeks = Array.from({ length: 6 }, (_, w) => days.slice(w * 7, w * 7 + 7));
  const heads = days.slice(0, 7);
  const today = todayIso();
  const focusIso = toIso(focus);

  useEffect(() => {
    if (!moved.current && !autoFocus) return;
    moved.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focusIso}"]`)?.focus();
  }, [focusIso, autoFocus]);

  const go = (d: Date) => {
    if (d.getMonth() !== focus.getMonth() || d.getFullYear() !== focus.getFullYear()) setDir(d > focus ? "next" : "prev");
    moved.current = true;
    setFocus(d);
  };
  const onKey = (e: KeyboardEvent) => {
    const k = e.key;
    const map: Record<string, () => Date> = {
      ArrowLeft: () => addDays(focus, -1),
      ArrowRight: () => addDays(focus, 1),
      ArrowUp: () => addDays(focus, -7),
      ArrowDown: () => addDays(focus, 7),
      PageUp: () => addMonths(focus, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focus, e.shiftKey ? 12 : 1),
      Home: () => addDays(focus, -((focus.getDay() - weekStart + 7) % 7)),
      End: () => addDays(focus, 6 - ((focus.getDay() - weekStart + 7) % 7)),
    };
    if (map[k]) {
      e.preventDefault();
      go(map[k]!());
    }
  };
  const inRange = (iso: IsoDate) => !!range?.start && !!range.end && iso > range.start && iso < range.end;
  const heading = `${id}-month`;

  return (
    <div className="fl-pick-cal" data-fl={FL[variant]}>
      <div className="fl-pick-cal__head">
        <button type="button" className="fl-pick-cal__nav" aria-label="Previous month" onClick={() => go(addMonths(focus, -1))}>
          <Icon name="chevron-left" />
        </button>
        <h3 id={heading} className="fl-pick-cal__month" aria-live="polite">
          {fmtMonth.format(month)}
        </h3>
        <button type="button" className="fl-pick-cal__nav" aria-label="Next month" onClick={() => go(addMonths(focus, 1))}>
          <Icon name="chevron-right" />
        </button>
      </div>
      <table ref={grid} className={`fl-pick-cal__grid${dir ? ` fl-pick-cal__grid--${dir}` : ""}`} role="grid" aria-labelledby={heading} aria-label={label} key={`${month.getFullYear()}-${month.getMonth()}`} onKeyDown={onKey} onAnimationEnd={() => setDir("")}>
        <thead>
          <tr>
            {heads.map((d) => (
              <th key={d.getDay()} scope="col" abbr={fmtWeekLong.format(d)}>
                {fmtWeek.format(d)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={toIso(w[0]!)}>
              {w.map((d) => {
                const iso = toIso(d);
                const outside = d.getMonth() !== month.getMonth();
                const chosen = range ? iso === range.start || iso === range.end : iso === value;
                const disabled = off(iso);
                const mark = marks?.[iso];
                const cls = [
                  "fl-pick-day",
                  outside ? "fl-pick-day--outside" : "",
                  iso === today ? "fl-pick-day--today" : "",
                  chosen ? "fl-pick-day--chosen" : "",
                  inRange(iso) ? "fl-pick-day--between" : "",
                  range?.start === iso && range.end ? "fl-pick-day--from" : "",
                  range?.end === iso && range.start ? "fl-pick-day--to" : "",
                  mark ? `fl-pick-day--${mark}` : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                const note = mark === "full" ? ", fully booked" : mark === "few" ? ", a few times left" : mark === "open" ? ", times available" : "";
                return (
                  <td key={iso} role="gridcell" aria-selected={chosen || undefined}>
                    <button
                      type="button"
                      className={cls}
                      data-day={iso}
                      tabIndex={iso === focusIso ? 0 : -1}
                      aria-label={`${fmtDay.format(d)}${iso === today ? ", today" : ""}${note}`}
                      aria-disabled={disabled || undefined}
                      onClick={() => {
                        setFocus(d);
                        if (!disabled) onPick(iso);
                      }}
                    >
                      {d.getDate()}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A date field that opens the calendar beside it (docked) - or, as range, two dates picked one after the other. The
 * field takes a typed date too; Escape closes the calendar and returns focus to the button that opened it.
 */
export function DatePicker({
  variant = "docked",
  label,
  value,
  onChange,
  range,
  onRangeChange,
  hint,
  error,
  min,
  max,
  isDisabled,
  marks,
  weekStart = 1,
  locale,
}: {
  variant?: DatePickerVariant;
  label: string;
  value?: IsoDate;
  onChange?: (day: IsoDate | undefined) => void;
  range?: DateRange;
  onRangeChange?: (range: DateRange) => void;
  hint?: string;
  error?: string;
  min?: IsoDate;
  max?: IsoDate;
  isDisabled?: (day: IsoDate) => boolean;
  marks?: Record<IsoDate, DayMark>;
  weekStart?: 0 | 1;
  locale?: string;
}) {
  const id = useId().replace(/:/g, "");
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState<string | undefined>(undefined);
  const [typedBad, setTypedBad] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const fmt = useMemo(() => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }), [locale]);
  const show = (iso?: IsoDate) => (fromIso(iso) ? fmt.format(fromIso(iso)!) : "");
  const example = useMemo(() => new Intl.DateTimeFormat(locale).format(new Date(2026, 3, 22)), [locale]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const close = () => {
    setOpen(false);
    opener.current?.focus();
  };
  const pick = (iso: IsoDate) => {
    if (variant === "range") {
      const r = range ?? {};
      // First click starts a new range; the second ends it (an earlier day swaps them round).
      const next: DateRange = !r.start || r.end ? { start: iso } : iso < r.start ? { start: iso, end: r.start } : { start: r.start, end: iso };
      onRangeChange?.(next);
      if (next.end) close();
      return;
    }
    onChange?.(iso);
    setTyped(undefined);
    setTypedBad(false);
    close();
  };
  const commitTyped = () => {
    if (typed === undefined) return;
    if (!typed.trim()) {
      onChange?.(undefined);
      setTyped(undefined);
      return;
    }
    const iso = parseTyped(typed, locale);
    const bad = !iso || (min !== undefined && iso < min) || (max !== undefined && iso > max) || !!isDisabled?.(iso);
    setTypedBad(bad);
    if (!bad) {
      onChange?.(iso);
      setTyped(undefined);
    }
  };
  const message = typedBad ? `That isn't a date that can be chosen. Type it like ${example}, or pick it from the calendar.` : error;
  const describedBy = [hint ? `${id}-hint` : "", message ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined;
  const text = variant === "range" ? [show(range?.start), show(range?.end)].filter(Boolean).join(" – ") : typed ?? show(value);

  return (
    <div ref={wrap} className={`fl-pick${message ? " fl-pick--invalid" : ""}`} data-fl={FL[variant]} onKeyDown={(e) => e.key === "Escape" && open && (e.stopPropagation(), close())}>
      <label className="fl-pick__label" htmlFor={`${id}-in`}>
        {label}
      </label>
      <div className="fl-pick__field">
        <input
          id={`${id}-in`}
          className="fl-pick__input"
          value={text}
          placeholder={variant === "range" ? "Start – end" : example}
          readOnly={variant === "range"}
          aria-invalid={!!message || undefined}
          aria-describedby={describedBy}
          onChange={(e) => setTyped(e.target.value)}
          onBlur={commitTyped}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitTyped();
            if (e.key === "ArrowDown" && e.altKey) setOpen(true);
          }}
          onClick={() => variant === "range" && setOpen(true)}
        />
        <button ref={opener} type="button" className="fl-pick__open" aria-label={`${open ? "Close" : "Open"} calendar for ${label}`} aria-expanded={open} aria-controls={`${id}-pop`} onClick={() => setOpen((o) => !o)}>
          <Icon name="calendar" />
        </button>
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="fl-pick__hint">
          {hint}
        </p>
      ) : null}
      {message ? (
        <p id={`${id}-err`} className="fl-pick__error" role="alert">
          {message}
        </p>
      ) : null}
      {open ? (
        <div id={`${id}-pop`} className="fl-pick__pop" role="dialog" aria-modal="false" aria-label={`Choose ${variant === "range" ? "the dates" : "a date"} for ${label}`}>
          <Calendar variant={variant} value={value} range={variant === "range" ? range : undefined} onPick={pick} min={min} max={max} isDisabled={isDisabled} marks={marks} weekStart={weekStart} locale={locale} autoFocus />
          {variant === "range" ? (
            <p className="fl-pick__step" aria-live="polite">
              {!range?.start || range.end ? "Pick the first day." : "Now pick the last day."}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  docked: { label: "Session date", hint: "Type a date or open the calendar. Sundays are closed." },
  range: { label: "Holiday dates", hint: "Pick the first day, then the last." },
  inline: { title: "Pick a delivery day", lede: "Deliveries run Monday to Saturday, from tomorrow up to six weeks ahead." },
  keys: [
    ["← →", "a day"],
    ["↑ ↓", "a week"],
    ["Page Up / Down", "a month (with Shift, a year)"],
    ["Home / End", "start or end of the week"],
    ["Enter or Space", "pick the day"],
    ["Esc", "close, back to the field"],
  ],
};

export default function DatePickerSheet() {
  const d = SAMPLE;
  const [day, setDay] = useState<IsoDate | undefined>(undefined);
  const [holiday, setHoliday] = useState<DateRange>({});
  const [delivery, setDelivery] = useState<IsoDate | undefined>(undefined);
  const today = new Date();
  const tomorrow = toIso(addDays(today, 1));
  const sixWeeks = toIso(addDays(today, 42));
  const sundays = (iso: IsoDate) => fromIso(iso)?.getDay() === 0;
  const fmt = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" });
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-spec">
        <h3>Docked: a field that opens a calendar</h3>
        <p className="fl-ctl-btn-what">For a date people might know already: they can type it, or open the calendar. Closed days can't be picked.</p>
        <DatePicker label={d.docked.label} hint={d.docked.hint} value={day} onChange={setDay} isDisabled={sundays} />
        <p className="fl-ctl-status" role="status">
          {day ? `Chosen: ${fmt.format(fromIso(day)!)}` : "Nothing chosen yet."}
        </p>
      </div>
      <div className="fl-ctl-spec">
        <h3>Range: a start and an end</h3>
        <p className="fl-ctl-btn-what">Two clicks in one calendar; the days between are shaded. Picking an earlier day second swaps them round.</p>
        <DatePicker variant="range" label={d.range.label} hint={d.range.hint} range={holiday} onRangeChange={setHoliday} />
      </div>
      <div className="fl-ctl-spec">
        <h3>{d.inline.title}</h3>
        <p className="fl-ctl-btn-what">{d.inline.lede} Inline, when picking the day is the main thing on the screen.</p>
        <Calendar value={delivery} onPick={setDelivery} min={tomorrow} max={sixWeeks} isDisabled={sundays} label={d.inline.title} />
        <p className="fl-ctl-status" role="status">
          {delivery ? `Delivery on ${fmt.format(fromIso(delivery)!)}.` : "Pick a day."}
        </p>
      </div>
      <div className="fl-ctl-spec">
        <h3>Keyboard</h3>
        <p className="fl-ctl-btn-what">Only the focused day is in the tab order; these keys move it.</p>
        <dl className="fl-pick-keys">
          {d.keys.map(([k, what]) => (
            <div key={k}>
              <dt>
                <kbd>{k}</kbd>
              </dt>
              <dd>{what}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
