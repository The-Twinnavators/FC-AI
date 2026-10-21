/** @flowcode-library input-card-number · Card details fields (Forms)
 * Catalog ID: c.card-fields (component)
 * Function: The card details fields (c.card-fields): name, card number, expiry and security code that space themselves as you type, recognize the card brand, check the number's checksum, the date and the code length, move on by themselves when a part is complete, and save with a busy and a done state; the reference sheet shows a billing card form that takes Visa, Mastercard and American Express.
 * Use it as: import { CardFields } from "./input-card-number"; <CardFields accepted?={["visa","mastercard","amex"]} onSave?={async ({ brand, last4, expMonth, expYear, name }) => ...} submitLabel?="Save card" now?={new Date()} labels?={{ name, number, expiry, cvc, cvcHint, cvcHintAmex, accepted, saved, another, failed, errors: { name, number, invalid, brand, expiry, past, cvc } }} />
 * Built from: c.text-field.outlined, c.chip.static, c.button.primary, c.button.secondary
 * Look: A two-column form: name on card across the top, the card number with the recognized brand as a small pill at its right edge, then expiry (MM / YY) and security code side by side, a row of the accepted brands with the matching one lit, and a full-width Save card button; errors slide open under each field, and a saved card is shown as a tinted panel with the brand, the last four digits and Add another.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-accent --color-success --color-danger --color-text --color-text-muted --space-1 --space-2 --space-3 --space-4 --space-5 --radius-md --radius-lg --text-xs --text-sm --duration-fast --duration-base --ease-out --ease-spring --enter-distance --focus-ring
 * Use cases: checkout payment; add a payment method; billing settings; subscription sign-up; donation form; saved cards; membership renewal; booking deposit
 * Jobs to be done: enter my card without mistakes; see that the site takes my card; fix a mistyped number before I pay; save a card for later
 * Keywords: credit card, debit card, card number, payment, checkout, billing, expiry, cvc, form field, validation
 */
/**
 * Card details fields. The number is spaced the way the card prints it (4-6-5 for American Express, groups of four for
 * the rest), the brand is recognized from the first digits and shown at the field's edge, and the number is checked
 * with the Luhn checksum, so a mistyped digit is caught before anything is sent. Expiry takes MM / YY (a single 2 to 9
 * becomes 02 to 09) and refuses a month that has passed; the code wants 3 digits, or 4 for American Express. Each part
 * moves focus to the next when it is complete. Errors show when a field is left, or all at once on Save, with focus on
 * the first one. Save is busy while onSave runs, then the card is shown saved. onSave gets only the brand, last four
 * digits, expiry and name, never the whole number. Make it the app's own: pass the brands the app takes and send the
 * fields to the payment provider's own tokenizing call in onSave; never store the full number or the code.
 * Adapted from TailAdmin (MIT License, Copyright (c) 2023 TailAdmin): the form elements' card number input.
 */
/**
 * How to try it
 * - Type 4242 4242 4242 4242 (a published test number): Visa lights up and focus jumps to Expiry. Type 1229, then 123.
 * - Change one digit of the number and leave the field: "Check the card number" slides open.
 * - Start a number with 6011 (Discover, not taken here) to see that error, or press Save with empty fields to see them all.
 *
 * Dependencies: React (useId, useLayoutEffect, useRef, useState), the library's text field ("./text-fields-states"), chip
 * ("./chips-tags"), button ("./buttons-variants") and inline icon set ("./icons"). Nothing else: no payment library and
 * nothing fetched at run time. The styles are the library's own fl- classes in templates/library/css, and the sample
 * data is in the file.
 */
import { useId, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "./buttons-variants";
import { Chip } from "./chips-tags";
import { Icon } from "./icons";
import { TextField } from "./text-fields-states";

// ── c.card-fields: name, number, expiry and code that format and check themselves. ──

export type CardBrand = "visa" | "mastercard" | "amex" | "discover";

const BRANDS: Record<CardBrand, { label: string; test: RegExp; lengths: number[]; groups: number[]; cvc: number }> = {
  visa: { label: "Visa", test: /^4/, lengths: [13, 16, 19], groups: [4, 4, 4, 4, 3], cvc: 3 },
  mastercard: { label: "Mastercard", test: /^(5[1-5]|2[2-7])/, lengths: [16], groups: [4, 4, 4, 4], cvc: 3 },
  amex: { label: "American Express", test: /^3[47]/, lengths: [15], groups: [4, 6, 5], cvc: 4 },
  discover: { label: "Discover", test: /^(6011|65|64[4-9])/, lengths: [16], groups: [4, 4, 4, 4], cvc: 3 },
};

export const brandOf = (digits: string): CardBrand | null => (Object.keys(BRANDS) as CardBrand[]).find((b) => BRANDS[b].test.test(digits)) ?? null;

/** The Luhn checksum every card number carries in its last digit. */
export function luhn(digits: string) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return digits.length > 0 && sum % 10 === 0;
}

const group = (digits: string, groups: number[]) => {
  const out: string[] = [];
  let i = 0;
  for (const g of groups) {
    if (i >= digits.length) break;
    out.push(digits.slice(i, i + g));
    i += g;
  }
  return out.join(" ");
};

export type SavedCard = { brand: CardBrand; last4: string; expMonth: number; expYear: number; name: string };

export type CardFieldsProps = {
  /** The brands the app takes; all four when left out. */
  accepted?: CardBrand[];
  /** Hand the card to the payment provider here; resolve when done, throw to show an error. */
  onSave?: (card: SavedCard) => void | Promise<void>;
  submitLabel?: string;
  /** Today, for refusing a past expiry; the real date when left out. */
  now?: Date;
  labels?: {
    name?: string;
    number?: string;
    expiry?: string;
    cvc?: string;
    cvcHint?: string;
    cvcHintAmex?: string;
    accepted?: string;
    saved?: string;
    another?: string;
    failed?: string;
    errors?: { name?: string; number?: string; invalid?: string; brand?: string; expiry?: string; past?: string; cvc?: string };
  };
};

type Key = "name" | "number" | "expiry" | "cvc";

export function CardFields({ accepted = ["visa", "mastercard", "amex", "discover"], onSave, submitLabel = "Save card", now, labels = {} }: CardFieldsProps) {
  const l = {
    name: "Name on card",
    number: "Card number",
    expiry: "Expiry",
    cvc: "Security code",
    cvcHint: "3 digits on the back",
    cvcHintAmex: "4 digits on the front",
    accepted: "We take",
    saved: "saved",
    another: "Add another card",
    failed: "That card couldn't be saved. Try again.",
    ...labels,
  };
  const e = {
    name: "Enter the name on the card.",
    number: "Enter the card number.",
    invalid: "Check the card number.",
    brand: "We don't take {brand}.",
    expiry: "Enter the expiry as MM / YY.",
    past: "This card has expired.",
    cvc: "Enter the {n}-digit code.",
    ...labels.errors,
  };
  const id = useId();
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [touched, setTouched] = useState<Record<Key, boolean>>({ name: false, number: false, expiry: false, cvc: false });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState<SavedCard | null>(null);
  const caret = useRef<number | null>(null);

  const brand = brandOf(number);
  const spec = brand ? BRANDS[brand] : null;
  const maxLen = spec ? Math.max(...spec.lengths) : 16;
  const groups = spec?.groups ?? [4, 4, 4, 4];
  const shownNumber = group(number, groups);
  const cvcLen = spec?.cvc ?? 3;
  const today = now ?? new Date();

  // Keep the caret after the same digit when spaces come and go.
  useLayoutEffect(() => {
    if (caret.current === null) return;
    const el = document.getElementById(`${id}-number`) as HTMLInputElement | null;
    let n = caret.current;
    let at = 0;
    while (at < shownNumber.length && n > 0) {
      if (shownNumber[at] !== " ") n--;
      at++;
    }
    if (el && document.activeElement === el) el.setSelectionRange(at, at);
    caret.current = null;
  }, [shownNumber, id]);

  const mm = Number(expiry.slice(0, 2));
  const yy = Number(expiry.slice(2, 4));
  const errorOf = (k: Key): string => {
    if (k === "name") return name.trim().length < 2 ? e.name : "";
    if (k === "number") {
      if (!number) return e.number;
      if (brand && !accepted.includes(brand)) return e.brand.replace("{brand}", BRANDS[brand].label);
      if (!spec || !spec.lengths.includes(number.length) || !luhn(number)) return e.invalid;
      return "";
    }
    if (k === "expiry") {
      if (expiry.length < 4 || mm < 1 || mm > 12) return e.expiry;
      const end = new Date(2000 + yy, mm, 1); // first day after the expiry month
      return end <= new Date(today.getFullYear(), today.getMonth(), 1) ? e.past : "";
    }
    return cvc.length !== cvcLen ? e.cvc.replace("{n}", String(cvcLen)) : "";
  };
  const shown = (k: Key) => (touched[k] ? errorOf(k) : "");
  const focus = (k: Key) => document.getElementById(`${id}-${k}`)?.focus();
  const touch = (k: Key) => setTouched((t) => ({ ...t, [k]: true }));

  const onNumber = (raw: string, sel: number | null) => {
    const before = raw.slice(0, sel ?? raw.length).replace(/\D/g, "").length;
    const b = brandOf(raw.replace(/\D/g, ""));
    const cap = b ? Math.max(...BRANDS[b].lengths) : 19;
    const digits = raw.replace(/\D/g, "").slice(0, cap);
    caret.current = Math.min(before, digits.length);
    setNumber(digits);
    setFailed(false);
    // Complete and correct, at the end of the field: go on to the expiry.
    // (16 digits counts as complete for Visa, which also allows 13 and 19.)
    if (b && digits.length === Math.min(Math.max(...BRANDS[b].lengths), 16) && BRANDS[b].lengths.includes(digits.length) && luhn(digits) && accepted.includes(b) && before >= digits.length) {
      touch("number");
      requestAnimationFrame(() => focus("expiry"));
    }
  };
  const onExpiry = (raw: string, prev: string) => {
    let d = raw.replace(/\D/g, "");
    // Deleting the " / " deletes the digit before it.
    if (raw.length < formatExpiry(prev).length && d.length === prev.length) d = d.slice(0, -1);
    if (d.length === 1 && Number(d) > 1) d = `0${d}`;
    d = d.slice(0, 4);
    setExpiry(d);
    if (d.length === 4) {
      touch("expiry");
      requestAnimationFrame(() => focus("cvc"));
    }
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setTouched({ name: true, number: true, expiry: true, cvc: true });
    const first = (["name", "number", "expiry", "cvc"] as Key[]).find((k) => errorOf(k));
    if (first) {
      focus(first);
      return;
    }
    const card: SavedCard = { brand: brand!, last4: number.slice(-4), expMonth: mm, expYear: 2000 + yy, name: name.trim() };
    setBusy(true);
    setFailed(false);
    try {
      await onSave?.(card);
      setSaved(card);
      setNumber("");
      setCvc("");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  const reset = () => {
    setSaved(null);
    setName("");
    setExpiry("");
    setTouched({ name: false, number: false, expiry: false, cvc: false });
    requestAnimationFrame(() => focus("name"));
  };

  if (saved) {
    return (
      <div className="fl-cn-done" data-fl="c.card-fields" role="status" tabIndex={-1} ref={(el) => el?.focus()}>
        <span className="fl-cn-done-mark" aria-hidden="true">
          <Icon name="check" />
        </span>
        <div>
          <strong>
            {BRANDS[saved.brand].label} •••• {saved.last4} {l.saved}
          </strong>
          <span>
            {saved.name} · {String(saved.expMonth).padStart(2, "0")} / {String(saved.expYear).slice(2)}
          </span>
        </div>
        <Button variant="secondary" size={40} onClick={reset}>
          {l.another}
        </Button>
      </div>
    );
  }

  return (
    <form className="fl-cn" data-fl="c.card-fields" onSubmit={submit} noValidate aria-busy={busy || undefined}>
      <Field id={`${id}-name`} label={l.name} error={shown("name")} wide>
        <TextField
          id={`${id}-name`}
          autoComplete="cc-name"
          value={name}
          disabled={busy}
          invalid={!!shown("name")}
          aria-describedby={shown("name") ? `${id}-name-err` : undefined}
          onChange={(ev) => setName(ev.target.value)}
          onBlur={() => touch("name")}
        />
      </Field>

      <Field id={`${id}-number`} label={l.number} error={shown("number")} wide>
        <span className={`fl-cn-numbox${brand ? " has-brand" : ""}`}>
          <TextField
            id={`${id}-number`}
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="0000 0000 0000 0000"
            value={shownNumber}
            maxLength={maxLen + groups.length}
            disabled={busy}
            invalid={!!shown("number")}
            aria-describedby={[`${id}-brand`, shown("number") ? `${id}-number-err` : ""].filter(Boolean).join(" ")}
            onChange={(ev) => onNumber(ev.target.value, ev.target.selectionStart)}
            onBlur={() => touch("number")}
          />
          <span id={`${id}-brand`} className="fl-cn-brand" aria-live="polite">
            {brand ? (
              <span key={brand} className={`fl-cn-brand-pill${accepted.includes(brand) ? "" : " is-off"}`}>
                {BRANDS[brand].label}
              </span>
            ) : null}
          </span>
        </span>
      </Field>

      <Field id={`${id}-expiry`} label={l.expiry} error={shown("expiry")}>
        <TextField
          id={`${id}-expiry`}
          inputMode="numeric"
          autoComplete="cc-exp"
          placeholder="MM / YY"
          value={formatExpiry(expiry)}
          disabled={busy}
          invalid={!!shown("expiry")}
          aria-describedby={shown("expiry") ? `${id}-expiry-err` : undefined}
          onChange={(ev) => onExpiry(ev.target.value, expiry)}
          onBlur={() => touch("expiry")}
        />
      </Field>

      <Field id={`${id}-cvc`} label={l.cvc} error={shown("cvc")} hint={brand === "amex" ? l.cvcHintAmex : l.cvcHint}>
        <TextField
          id={`${id}-cvc`}
          inputMode="numeric"
          autoComplete="cc-csc"
          placeholder={"0".repeat(cvcLen)}
          value={cvc}
          maxLength={cvcLen}
          disabled={busy}
          invalid={!!shown("cvc")}
          aria-describedby={[`${id}-cvc-hint`, shown("cvc") ? `${id}-cvc-err` : ""].filter(Boolean).join(" ")}
          onChange={(ev) => setCvc(ev.target.value.replace(/\D/g, "").slice(0, cvcLen))}
          onBlur={() => touch("cvc")}
        />
      </Field>

      <div className="fl-cn-brands">
        <span>{l.accepted}</span>
        <ul aria-label={l.accepted}>
          {accepted.map((b) => (
            <li key={b} className={brand === b ? "is-match" : undefined}>
              <Chip variant="static" size={24}>
                {BRANDS[b].label}
              </Chip>
            </li>
          ))}
        </ul>
      </div>

      <div className="fl-cn-foot">
        {failed ? (
          <p className="fl-cn-err" role="alert">
            <Icon name="alert" />
            {l.failed}
          </p>
        ) : null}
        <Button type="submit" size={48} block icon="lock" busy={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

const formatExpiry = (d: string) => (d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d.length === 2 ? `${d} / ` : d);

/** A label, the control, a hint and an error line that slides open. */
function Field({ id, label, error, hint, wide, children }: { id: string; label: string; error: string; hint?: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={`fl-cn-field${wide ? " is-wide" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="fl-cn-hint">
          {hint}
        </p>
      ) : null}
      <div className="fl-cn-msg" data-open={error ? "true" : "false"} inert={!error}>
        <div>
          <p id={`${id}-err`} className="fl-cn-err">
            <Icon name="alert" />
            {error}
          </p>
        </div>
      </div>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Payment method",
  lede: "Your plan renews on November 1. Change the card any time.",
  test: "Test card: 4242 4242 4242 4242, any future date, any 3 digits.",
  submitLabel: "Save card",
  accepted: ["visa", "mastercard", "amex"] as CardBrand[],
};

export default function InputCardNumber() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--canvas" aria-labelledby="fl-cn-demo-title">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-cn-demo">
          <div>
            <h2 id="fl-cn-demo-title">{d.title}</h2>
            <p>{d.lede}</p>
          </div>
          <CardFields accepted={d.accepted} submitLabel={d.submitLabel} onSave={() => new Promise((r) => setTimeout(r, 900))} />
          <p className="fl-cn-test">{d.test}</p>
        </div>
      </div>
    </section>
  );
}
