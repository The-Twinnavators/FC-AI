/** @flowcode-library number-field · Number field (Forms)
 * Catalog ID: c.number-field (component)
 * Function: The number field (c.number-field): a spin button for money, percents and units formatted in the person's locale, with minus and plus buttons that repeat while held, arrow and Page Up / Page Down steps, Home and End for the limits, and typed values kept inside min and max with a note. Adapted from TailGrids (MIT).
 * Use it as: import { NumberField } from "./number-field"; <NumberField label="Nightly rate" value?={n|null} defaultValue?={n} onChange?={(n|null) => ...} min? max? step?={1} largeStep?={10} format?={{ style: "currency", currency: "USD" }|{ style: "percent" }|{ style: "unit", unit: "centimeter" }} locale? hint? error? disabled? readOnly? required? placeholder? id? name? labels?={{ decrement, increment, clampedMin, clampedMax }} />
 * Look: A bordered field with a minus button at the left edge, the formatted number centered between and a plus button at the right edge, each behind a thin divider; the buttons dim at the limits, press in and repeat while held; a pulled-back value pulses the field and adds a note below.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-border-strong --color-accent --color-danger --color-text --color-text-muted --control-md --field-radius --text-sm --text-md --space-2 --focus-ring --control-shadow-focus --duration-fast --duration-base --easing --ease-out
 * Use cases: price entry; nightly rate; discount percent; measurements; tip amount; stock level; budget limit; guest count
 * Jobs to be done: set an exact price; nudge a number up or down; enter a percent without doing the math; type a measurement with its unit
 * Keywords: number field, numeric input, stepper, spinbutton, currency input, percent input, unit input
 */
/**
 * Input: number field. A spin button (role="spinbutton") for numbers that need their own format: money, a percent or a
 * unit, written by Intl.NumberFormat in the person's own locale. Type a number (any currency sign, spaces or group
 * commas are ignored) and leave the field or press Enter: it is read, rounded to the step's decimals and kept inside
 * min and max, with a note when it had to be pulled back. ↑ ↓ step by `step`, Page Up / Page Down by `largeStep`,
 * Home and End jump to min and max, Escape puts back what was there. The minus and plus buttons repeat while held.
 * For whole counts in a cart or booking (tickets, guests), the quantity stepper c.quantity is the simpler choice.
 * Make it the app's own: replace SAMPLE with the app's own fields, limits and formats.
 * Adapted from TailGrids (MIT, Copyright (c) 2025 Tailgrids): the number field.
 */

/**
 * How to try it
 * - Tab to Nightly rate and press ↑ ↓, Page Up / Page Down, Home and End.
 * - Hold the plus button: it repeats, and stops at $900.00.
 * - Type 1200 into Nightly rate and press Enter: it comes back as $900.00 with a note.
 * - Discount takes 15 or 15%: both mean 15%.
 * - Guests starts over the room's limit: bring it down to 12 and the message clears.
 *
 * Dependencies: React (useEffect, useId, useMemo, useRef, useState), and the library's own inline icon set ("./icons").
 * Nothing else: no package to install and nothing fetched at run time. Styles are the fl-nf- classes in
 * templates/library/css/number-field.css.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Icon } from "./icons";

// ── c.number-field: a formatted number with steppers, keyboard steps and clamping. ──

export type NumberFieldProps = {
  label: string;
  /** Controlled value; null is empty. */
  value?: number | null;
  defaultValue?: number | null;
  onChange?: (value: number | null) => void;
  min?: number;
  max?: number;
  /** ↑ ↓ and the buttons. For a percent, in fractions: 0.01 is one percent. */
  step?: number;
  /** Page Up / Page Down. Ten steps when left out. */
  largeStep?: number;
  /** Intl.NumberFormat options: { style: "currency", currency: "USD" }, { style: "percent" }, { style: "unit", unit: "kilogram" }. */
  format?: Intl.NumberFormatOptions;
  locale?: string;
  hint?: string;
  /** Rejected: the reason, tied to the field and shown in red. */
  error?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  placeholder?: string;
  id?: string;
  name?: string;
  labels?: { decrement?: string; increment?: string; clampedMin?: string; clampedMax?: string };
  className?: string;
};

const decimalsOf = (n: number) => {
  const s = String(n);
  if (s.includes("e-")) return Number(s.split("e-")[1]);
  return s.includes(".") ? s.split(".")[1]!.length : 0;
};

export function NumberField({
  label,
  value,
  defaultValue = null,
  onChange,
  min,
  max,
  step = 1,
  largeStep,
  format,
  locale = "en-US",
  hint,
  error,
  disabled,
  readOnly,
  required,
  placeholder,
  id,
  name,
  labels = {},
  className,
}: NumberFieldProps) {
  const l = { decrement: "Decrease", increment: "Increase", clampedMin: "Set to the least allowed:", clampedMax: "Set to the most allowed:", ...labels };
  const uid = useId();
  const inputId = id ?? `${uid}-input`;
  const [own, setOwn] = useState<number | null>(defaultValue);
  const num = value !== undefined ? value : own;
  const [text, setText] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [pulse, setPulse] = useState(0);
  const current = useRef(num);
  current.current = num;
  // The text being typed, readable from the hold-to-repeat timer without a stale copy.
  const typed = useRef<string | null>(null);
  typed.current = text;

  const fmt = useMemo(() => new Intl.NumberFormat(locale, format), [locale, format]);
  const decimalSign = useMemo(() => new Intl.NumberFormat(locale).formatToParts(1.1).find((p) => p.type === "decimal")?.value ?? ".", [locale]);
  const percent = format?.style === "percent";
  const places = Math.max(decimalsOf(step), decimalsOf(min ?? 0));
  const big = largeStep ?? step * 10;

  const round = (n: number) => Number(n.toFixed(places));
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));

  const parse = (s: string): number | null => {
    const kept = s.split(decimalSign).map((part) => part.replace(/[^\d-]/g, "")).join(".");
    if (!/\d/.test(kept)) return null;
    const n = Number(kept.replace(/(?!^)-/g, ""));
    if (Number.isNaN(n)) return null;
    return percent ? n / 100 : n;
  };

  const set = (n: number | null, why?: "typed") => {
    let next = n;
    if (next !== null) {
      const kept = round(clamp(next));
      if (why === "typed" && kept !== round(next)) {
        setNote(`${kept === max ? l.clampedMax : l.clampedMin} ${fmt.format(kept)}`);
        setPulse((p) => p + 1);
      } else setNote("");
      next = kept;
    } else setNote("");
    current.current = next;
    if (value === undefined) setOwn(next);
    if (next !== num) onChange?.(next);
  };

  const commit = () => {
    if (text === null) return;
    set(parse(text), "typed");
    setText(null);
  };

  const stepBy = (delta: number) => {
    if (disabled || readOnly) return;
    let base = current.current;
    if (typed.current !== null) {
      base = parse(typed.current);
      typed.current = null;
      setText(null);
    }
    const origin = min ?? 0;
    if (base === null) return set(delta > 0 ? (min ?? 0) : (max ?? min ?? 0));
    // Land on the step grid (measured from min), so 147 + 5 goes to 150 rather than 152.
    const onGrid = Math.round((base - origin) / step) * step + origin;
    const next = Math.abs(onGrid - base) > 1e-9 && Math.sign(onGrid - base) === Math.sign(delta) ? onGrid : onGrid + delta;
    // At a limit the button switches off and may never see the pointer leave: end any held repeat here.
    if ((max !== undefined && next >= max) || (min !== undefined && next <= min)) stop();
    set(next);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const map: Record<string, () => void> = {
      ArrowUp: () => stepBy(step),
      ArrowDown: () => stepBy(-step),
      PageUp: () => stepBy(big),
      PageDown: () => stepBy(-big),
      Home: () => min !== undefined && set(min),
      End: () => max !== undefined && set(max),
      Enter: commit,
      Escape: () => setText(null),
    };
    const run = map[e.key];
    if (!run) return;
    if ((e.key === "Home" && min === undefined) || (e.key === "End" && max === undefined)) return;
    if (e.key !== "Enter") e.preventDefault();
    run();
  };

  // Hold to repeat: one step on press, then a steady run after a short pause.
  const hold = useRef<{ wait?: number; run?: number }>({});
  const stop = () => {
    window.clearTimeout(hold.current.wait);
    window.clearInterval(hold.current.run);
    hold.current = {};
  };
  useEffect(() => stop, []);
  const press = (delta: number) => (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault(); // keeps focus (and the caret) in the field
    stepBy(delta);
    hold.current.wait = window.setTimeout(() => {
      hold.current.run = window.setInterval(() => stepBy(delta), 70);
    }, 400);
  };

  const shown = text ?? (num === null ? "" : fmt.format(num));
  const atMin = num !== null && min !== undefined && num <= min;
  const atMax = num !== null && max !== undefined && num >= max;
  const hintId = hint ? `${uid}-hint` : "";
  const errId = error ? `${uid}-err` : "";
  const noteId = `${uid}-note`;
  const described = [errId, hintId, note ? noteId : ""].filter(Boolean).join(" ") || undefined;

  const groupRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = groupRef.current;
    if (!el || !pulse) return;
    el.classList.remove("is-pulsing");
    void el.offsetWidth;
    el.classList.add("is-pulsing");
  }, [pulse]);

  return (
    <div className={["fl-nf", className ?? ""].filter(Boolean).join(" ")} data-fl="c.number-field">
      <label className="fl-nf-label" htmlFor={inputId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <div
        ref={groupRef}
        className={`fl-nf-group${error ? " is-invalid" : ""}${disabled ? " is-disabled" : ""}${readOnly ? " is-readonly" : ""}`}
        onAnimationEnd={(e) => {
          if (e.target === groupRef.current) groupRef.current.classList.remove("is-pulsing");
        }}
      >
        <button
          type="button"
          className="fl-nf-btn"
          tabIndex={-1}
          aria-label={`${l.decrement} ${label}`}
          aria-controls={inputId}
          disabled={disabled || readOnly || atMin}
          onPointerDown={press(-step)}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
          onClick={(e) => e.detail === 0 && stepBy(-step)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
            <path d="M5 12h14" />
          </svg>
        </button>
        <input
          id={inputId}
          name={name}
          className="fl-nf-input"
          type="text"
          inputMode={places > 0 || format?.style === "currency" ? "decimal" : "numeric"}
          autoComplete="off"
          role="spinbutton"
          aria-valuenow={num ?? undefined}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuetext={num === null ? undefined : fmt.format(num)}
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
          aria-describedby={described}
          value={shown}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={onKey}
        />
        <button
          type="button"
          className="fl-nf-btn"
          tabIndex={-1}
          aria-label={`${l.increment} ${label}`}
          aria-controls={inputId}
          disabled={disabled || readOnly || atMax}
          onPointerDown={press(step)}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
          onClick={(e) => e.detail === 0 && stepBy(step)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
      {error ? (
        <p id={errId} className="fl-nf-error" role="alert">
          <Icon name="alert" />
          {error}
        </p>
      ) : null}
      <p id={noteId} className="fl-nf-note" role="status">
        {note}
      </p>
      {hint ? (
        <p id={hintId} className="fl-nf-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Number field",
  lede: "Money, a percent and a length, a value over a limit, and the disabled state.",
  rate: { label: "Nightly rate", value: 145, min: 40, max: 900, step: 5, largeStep: 50, hint: "$40 to $900, in steps of $5" },
  discount: { label: "Weekly discount", value: 0.15, min: 0, max: 0.5, step: 0.01, hint: "Up to 50%" },
  width: { label: "Shelf width", value: 82.5, min: 20, max: 240, step: 0.5, hint: "Measured wall to wall" },
  guests: { label: "Guests", value: 14, min: 1, max: 30, limit: 12, error: "This room sleeps up to 12. Pick a larger room or fewer guests." },
  deposit: { label: "Security deposit", value: 250, hint: "Set by the property owner" },
  total: "Rate after discount",
};

const USD: Intl.NumberFormatOptions = { style: "currency", currency: "USD" };
const PCT: Intl.NumberFormatOptions = { style: "percent", maximumFractionDigits: 0 };
const CM: Intl.NumberFormatOptions = { style: "unit", unit: "centimeter", minimumFractionDigits: 1, maximumFractionDigits: 1 };

export default function NumberFieldSheet() {
  const d = SAMPLE;
  const uid = useId();
  const [rate, setRate] = useState<number | null>(d.rate.value);
  const [discount, setDiscount] = useState<number | null>(d.discount.value);
  const [guests, setGuests] = useState<number | null>(d.guests.value);
  const after = rate !== null ? rate * (1 - (discount ?? 0)) : null;
  return (
    <section className="fl-section fl-section--canvas" aria-labelledby={`${uid}-title`}>
      <div className="fl-wrap">
        <div className="fl-head">
          <h2 id={`${uid}-title`} className="fl-title fl-title--md">
            {d.title}
          </h2>
          <p className="fl-text">{d.lede}</p>
        </div>
        <div className="fl-nf-sheet">
          <div className="fl-nf-card">
            <h3>Currency</h3>
            <NumberField {...d.rate} value={rate} onChange={setRate} format={USD} />
          </div>
          <div className="fl-nf-card">
            <h3>Percent</h3>
            <NumberField {...d.discount} value={discount} onChange={setDiscount} format={PCT} />
            <p className="fl-nf-sum">
              <span>{d.total}</span>
              <strong aria-live="polite">{after === null ? "–" : new Intl.NumberFormat("en-US", USD).format(after)}</strong>
            </p>
          </div>
          <div className="fl-nf-card">
            <h3>Unit</h3>
            <NumberField label={d.width.label} min={d.width.min} max={d.width.max} step={d.width.step} hint={d.width.hint} defaultValue={d.width.value} format={CM} />
          </div>
          <div className="fl-nf-card">
            <h3>Invalid</h3>
            <NumberField label={d.guests.label} min={d.guests.min} max={d.guests.max} value={guests} onChange={setGuests} required error={guests !== null && guests > d.guests.limit ? d.guests.error : undefined} />
          </div>
          <div className="fl-nf-card">
            <h3>Disabled</h3>
            <NumberField label={d.deposit.label} defaultValue={d.deposit.value} hint={d.deposit.hint} format={USD} disabled />
          </div>
        </div>
      </div>
    </section>
  );
}
