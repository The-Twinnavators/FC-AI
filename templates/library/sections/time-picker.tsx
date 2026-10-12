/** @flowcode-library time-picker · Time picker: typed in, or picked from a list (Forms)
 * Catalog ID: c.time-picker (component)
 * Function: The time picker (c.time-picker): hour and minute boxes that take digits and step with the arrow keys, or a field with the day's times at a fixed step; 24-hour values in and out, shown in the person's own clock.
 * Use it as: import { TimePicker } from "./time-picker"; <TimePicker variant?="input"|"list" label value?="14:30" onChange={(t) => ...} step?={15} min?="08:00" max?="18:00" hint? locale? />  // times are 24-hour "HH:MM", shown in the person's own clock
 * Variants: c.time-picker.input - any time of day (a reminder, an alarm): an hour box and a minute box people type into or step with the arrow keys, with AM/PM where the clock is 12-hour; c.time-picker.list - only some times are possible (pick-up slots, opening hours): a field that opens the times at a fixed step, filtered as people type
 * Look: Two large rounded boxes for hours and minutes with a colon between and a small AM/PM pair beside them; or a field with a clock icon over a scrolling list of times, the chosen one in the accent.
 * Tokens: --color-accent --color-surface --color-surface-sunken --color-border-strong --color-text --color-text-muted --control-lg --control-md --field-radius --text-2xl --surface-shadow-overlay --focus-ring
 * Use cases: reminder time; pick-up time; delivery window; meeting time; alarm; opening hours; shift start
 * Jobs to be done: set a time; pick from the times on offer; type a time quickly
 * Keywords: time picker, time, clock, hour, minute, time slot, opening hours, reminder
 */
/**
 * Time picker: a time of day, two ways. "input" is an hour box and a minute box people type into or step with the
 * arrow keys (with AM/PM where the locale uses a 12-hour clock); "list" is a field that opens the day's times at a
 * fixed step, filtered as people type. Times go in and out as 24-hour "HH:MM", shown in the person's own clock.
 * Written for FlowCode; the behaviour follows the time picker guidance in Material 3 and the WAI-ARIA spinbutton and
 * combobox patterns (no code from either).
 * Make it the app's own: replace SAMPLE with your labels, opening hours and step.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "./icons";

export type Time24 = string;
export type TimePickerVariant = "input" | "list";
const FL: Record<TimePickerVariant, string> = { input: "c.time-picker.input", list: "c.time-picker.list" };
const pad = (n: number) => String(n).padStart(2, "0");
const split = (t: Time24 | undefined): [number, number] | undefined => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t ?? "");
  return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? [Number(m[1]), Number(m[2])] : undefined;
};
const join = (h: number, m: number): Time24 => `${pad(h)}:${pad(m)}`;
/** Whether the locale writes times on a 12-hour clock. */
export const uses12h = (locale?: string) => new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions().hourCycle?.startsWith("h1") ?? false;
export const showTime = (t: Time24, locale?: string) => {
  const p = split(t);
  return p ? new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, p[0], p[1])) : "";
};

/** One box of the input picker: a spinbutton that takes digits and steps with the arrow keys (wrapping round). */
function Spin({ label, value, min, max, step = 1, onChange, show }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; show: (v: number) => string }) {
  const [typed, setTyped] = useState("");
  const span = max - min + 1;
  const wrap = (v: number) => ((((v - min) % span) + span) % span) + min;
  const onKey = (e: KeyboardEvent) => {
    const k = e.key;
    if (k === "ArrowUp" || k === "ArrowDown") {
      e.preventDefault();
      setTyped("");
      onChange(wrap(value + (k === "ArrowUp" ? step : -step)));
    } else if (k === "Home" || k === "End") {
      e.preventDefault();
      onChange(k === "Home" ? min : max);
    } else if (/^\d$/.test(k)) {
      e.preventDefault();
      const next = typed.length >= 2 ? k : typed + k;
      const n = Number(next);
      setTyped(n * 10 > max ? "" : next);
      if (n >= min && n <= max) onChange(n);
    } else if (k === "Backspace") {
      setTyped("");
    }
  };
  return (
    <span className="fl-pick-spin" role="spinbutton" tabIndex={0} aria-label={label} aria-valuenow={value} aria-valuemin={min} aria-valuemax={max} aria-valuetext={show(value)} onKeyDown={onKey} onBlur={() => setTyped("")}>
      {show(value)}
    </span>
  );
}

/** c.time-picker: an hour and minute input, or a field with a list of times. */
export function TimePicker({
  variant = "input",
  label,
  value,
  onChange,
  step = 15,
  min = "00:00",
  max = "23:59",
  hint,
  locale,
}: {
  variant?: TimePickerVariant;
  label: string;
  value?: Time24;
  onChange: (t: Time24) => void;
  /** Minutes between times in the list, and the minute box's arrow step. */
  step?: number;
  min?: Time24;
  max?: Time24;
  hint?: string;
  locale?: string;
}) {
  const id = useId().replace(/:/g, "");
  const twelve = useMemo(() => uses12h(locale), [locale]);
  const [h, m] = split(value) ?? split(min) ?? [9, 0];
  const describedBy = hint ? `${id}-hint` : undefined;

  if (variant === "input") {
    const pm = h >= 12;
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const setHour = (v: number) => onChange(join(twelve ? (v % 12) + (pm ? 12 : 0) : v, m));
    return (
      <div className="fl-pick-time" data-fl={FL.input} role="group" aria-labelledby={`${id}-label`} aria-describedby={describedBy}>
        <span id={`${id}-label`} className="fl-pick__label">
          {label}
        </span>
        <div className="fl-pick-time__boxes">
          <Spin label="Hours" value={twelve ? h12 : h} min={twelve ? 1 : 0} max={twelve ? 12 : 23} onChange={setHour} show={(v) => (twelve ? String(v) : pad(v))} />
          <span className="fl-pick-time__colon" aria-hidden="true">
            :
          </span>
          <Spin label="Minutes" value={m} min={0} max={59} step={step >= 5 ? 5 : 1} onChange={(v) => onChange(join(h, v))} show={pad} />
          {twelve ? (
            <div className="fl-pick-time__ampm" role="radiogroup" aria-label="Morning or afternoon">
              {(["AM", "PM"] as const).map((p) => (
                <button key={p} type="button" role="radio" aria-checked={(p === "PM") === pm} onClick={() => onChange(join(p === "PM" ? (h % 12) + 12 : h % 12, m))}>
                  {p}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {hint ? (
          <p id={`${id}-hint`} className="fl-pick__hint">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }

  return <TimeList id={id} label={label} value={value} onChange={onChange} step={step} min={min} max={max} hint={hint} locale={locale} />;
}

function TimeList({ id, label, value, onChange, step, min, max, hint, locale }: { id: string; label: string; value?: Time24; onChange: (t: Time24) => void; step: number; min: Time24; max: Time24; hint?: string; locale?: string }) {
  const times = useMemo(() => {
    const [h0, m0] = split(min) ?? [0, 0];
    const [h1, m1] = split(max) ?? [23, 59];
    const out: Time24[] = [];
    for (let t = h0 * 60 + m0; t <= h1 * 60 + m1; t += step) out.push(join(Math.floor(t / 60), t % 60));
    return out;
  }, [min, max, step]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | undefined>(undefined);
  const [active, setActive] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const shown = query ? times.filter((t) => showTime(t, locale).toLowerCase().replace(/\s/g, "").startsWith(query.toLowerCase().replace(/\s/g, "")) || t.startsWith(query)) : times;

  useEffect(() => {
    if (!open) return;
    const at = Math.max(0, shown.indexOf(value ?? ""));
    setActive(at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const choose = (t: Time24) => {
    onChange(t);
    setQuery(undefined);
    setOpen(false);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      setActive((a) => Math.min(shown.length - 1, Math.max(0, a + (e.key === "ArrowDown" ? 1 : -1))));
    } else if (e.key === "Enter" && open && shown[active]) {
      e.preventDefault();
      choose(shown[active]!);
    } else if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
      setQuery(undefined);
    }
  };
  return (
    <div ref={wrap} className="fl-pick" data-fl={FL.list}>
      <label className="fl-pick__label" htmlFor={`${id}-in`}>
        {label}
      </label>
      <div className="fl-pick__field">
        <input
          id={`${id}-in`}
          className="fl-pick__input"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && shown[active] ? `${id}-o${active}` : undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
          value={query ?? (value ? showTime(value, locale) : "")}
          placeholder={showTime(times[0] ?? "09:00", locale)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
        />
        <span className="fl-pick__open" aria-hidden="true">
          <Icon name="clock" />
        </span>
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="fl-pick__hint">
          {hint}
        </p>
      ) : null}
      {open ? (
        <ul ref={list} id={`${id}-list`} className="fl-pick__pop fl-pick-times" role="listbox" aria-label={`Times for ${label}`}>
          {shown.length ? (
            shown.map((t, i) => (
              <li key={t} id={`${id}-o${i}`} data-i={i} role="option" aria-selected={t === value} className={`fl-pick-times__opt${i === active ? " is-active" : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(t)} onMouseEnter={() => setActive(i)}>
                {showTime(t, locale)}
              </li>
            ))
          ) : (
            <li className="fl-pick-times__none" role="presentation">
              No time matches “{query}”.
            </li>
          )}
        </ul>
      ) : null}
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  input: { label: "Reminder time", hint: "Type the hour and minutes, or use the arrow keys." },
  list: { label: "Pick-up time", hint: "Every 15 minutes while the shop is open, 8:00 to 18:00. Type to jump.", min: "08:00", max: "18:00" },
};

export default function TimePickerSheet() {
  const d = SAMPLE;
  const [reminder, setReminder] = useState<Time24>("07:30");
  const [pickup, setPickup] = useState<Time24 | undefined>(undefined);
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-spec">
        <h3>Input: hours and minutes</h3>
        <p className="fl-ctl-btn-what">For any time of day. Each box takes digits; ↑ and ↓ step it (minutes by five) and wrap round. AM/PM shows only where the clock is 12-hour.</p>
        <TimePicker label={d.input.label} hint={d.input.hint} value={reminder} onChange={setReminder} />
        <p className="fl-ctl-status" role="status">
          Reminder at {showTime(reminder)}.
        </p>
      </div>
      <div className="fl-ctl-spec">
        <h3>List: times at a step</h3>
        <p className="fl-ctl-btn-what">When only some times are possible. The list opens on focus, ↑ ↓ move, Enter picks, typing filters, Esc closes.</p>
        <TimePicker variant="list" label={d.list.label} hint={d.list.hint} min={d.list.min} max={d.list.max} step={15} value={pickup} onChange={setPickup} />
        <p className="fl-ctl-status" role="status">
          {pickup ? `Pick-up at ${showTime(pickup)}.` : "No time chosen yet."}
        </p>
      </div>
    </section>
  );
}
