/**
 * Input: quantity steppers. Minus and plus buttons around a number field in three sizes, each with its own lower and
 * upper limit. Typed numbers are kept inside the limits when you leave the field, the buttons switch off at the ends,
 * and one row shows the disabled state. A basket total updates as you go. Use it for tickets, guests, portions or
 * stock. Make it the app's own: replace SAMPLE with the real items, limits and prices.
 */
import { useId, useState } from "react";

// flowcode:sample
const SAMPLE = {
  title: "Book your places",
  lede: "Choose how many of each you need. Limits are per booking.",
  currency: "$",
  items: [
    { id: "adult", name: "Adult ticket", note: "Ages 16 and over", price: 18, min: 0, max: 8, initial: 2, size: "lg" as const },
    { id: "child", name: "Child ticket", note: "Ages 4 to 15", price: 9, min: 0, max: 6, initial: 1, size: "md" as const },
    { id: "mats", name: "Extra clay (1 kg)", note: "Collected on the day", price: 6, min: 0, max: 20, initial: 0, size: "sm" as const },
    { id: "lunch", name: "Studio lunch", note: "Sold out for this date", price: 12, min: 0, max: 0, initial: 0, size: "md" as const, disabled: true },
  ],
  total: "Total",
  needOne: "Choose at least one ticket to continue.",
  empty: "Nothing chosen yet.",
  submit: "Continue to details",
  done: "Places held for 10 minutes while you add your details.",
};

type Size = "sm" | "md" | "lg";

function Stepper({
  id,
  label,
  value,
  min,
  max,
  size,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  size: Size;
  disabled?: boolean;
  onChange: (v: number, note?: string) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? String(value);
  function commit() {
    if (text === null) return;
    const n = Math.round(Number(text));
    if (text.trim() === "" || Number.isNaN(n)) onChange(value);
    else {
      const clamped = Math.max(min, Math.min(max, n));
      onChange(clamped, clamped !== n ? `${label} set to ${clamped}, the ${clamped === max ? "most" : "fewest"} allowed.` : undefined);
    }
    setText(null);
  }
  return (
    <div className={`fl-in-qty fl-in-qty--${size}`} role="group" aria-label={label} aria-disabled={disabled || undefined}>
      <button type="button" aria-label={`One fewer ${label}`} disabled={disabled || value <= min} onClick={() => onChange(value - 1)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
          <path d="M5 12h14" />
        </svg>
      </button>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={shown}
        disabled={disabled}
        onChange={(e) => setText(e.target.value.replace(/[^\d]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "ArrowUp") {
            e.preventDefault();
            onChange(Math.min(max, value + 1));
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            onChange(Math.max(min, value - 1));
          }
        }}
      />
      <button type="button" aria-label={`One more ${label}`} disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}

export default function InputQuantity() {
  const d = SAMPLE;
  const uid = useId();
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(d.items.map((i) => [i.id, i.initial])));
  const [notice, setNotice] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const total = d.items.reduce((sum, i) => sum + (qty[i.id] ?? 0) * i.price, 0);
  const count = d.items.reduce((sum, i) => sum + (qty[i.id] ?? 0), 0);

  return (
    <section className="fl-section fl-section--tint" aria-labelledby={`${uid}-title`}>
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <h2 id={`${uid}-title`} className="fl-title fl-title--md">
            {d.title}
          </h2>
          <p className="fl-text">{d.lede}</p>
        </div>
        <div className="fl-card fl-in-panel">
          <ul className="fl-in-rows">
            {d.items.map((i) => (
              <li key={i.id} className={`fl-in-row${i.disabled ? " fl-in-row--disabled" : ""}`}>
                <div className="fl-in-row__text">
                  <label htmlFor={`${uid}-${i.id}`} className="fl-in-row__name">
                    {i.name}
                  </label>
                  <span className="fl-meta">
                    {i.note} · {d.currency}
                    {i.price} each{!i.disabled && ` · up to ${i.max}`}
                  </span>
                </div>
                <Stepper
                  id={`${uid}-${i.id}`}
                  label={i.name}
                  value={qty[i.id] ?? 0}
                  min={i.min}
                  max={i.max}
                  size={i.size}
                  disabled={i.disabled}
                  onChange={(v, note) => {
                    setQty((q) => ({ ...q, [i.id]: v }));
                    setNotice(note ?? "");
                    setDone(false);
                    setError("");
                  }}
                />
              </li>
            ))}
          </ul>
          <p className="fl-in-notice" aria-live="polite">
            {notice}
          </p>
          <div className="fl-in-total">
            <span>{d.total}</span>
            <strong aria-live="polite">
              {count === 0 ? d.empty : `${d.currency}${total.toFixed(2)}`}
            </strong>
          </div>
          {error && (
            <p className="fl-in-error" role="alert">
              {error}
            </p>
          )}
          {done && (
            <p className="fl-done" role="status">
              {d.done}
            </p>
          )}
          <div className="fl-actions">
            <button
              type="button"
              className="fl-btn fl-btn--primary"
              onClick={() => {
                if (count === 0) {
                  setError(d.needOne);
                  return;
                }
                setDone(true);
              }}
            >
              {d.submit}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
