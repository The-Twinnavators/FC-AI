/** @flowcode-library input-phone · Phone number field (Forms)
 * Catalog ID: c.phone-field (component)
 * Function: The phone number field (c.phone-field): a country code picker joined to a number box that spaces the digits the way that country writes them, takes a pasted +44 number and switches the country, checks the length when you leave it and hands back the number in international form; the reference sheet shows a contact form with a required mobile and an optional work number.
 * Use it as: import { PhoneField } from "./input-phone"; <PhoneField label="Mobile" countries={[{ code: "US", name: "United States", dial: "+1", pattern: "(###) ###-####", lengths?: [10], trunk?: "0" }]} defaultCountry?="US" value?={{ country, digits }} onChange?={({ country, digits, e164, valid }) => ...} required? hint? showErrors? id? labels?={{ country, required, length, valid, optional }} />
 * Built from: c.select.outlined, c.text-field.outlined
 * Look: One bordered control in two parts: a narrow country code select (code and dial, chevron 8px from its right edge) joined to the number box, which shows the country's pattern as its placeholder and a tick at the right once the number is complete; a hint sits under it and an error line slides open when the number is short.
 * Tokens: --color-surface --color-border --color-border-strong --color-accent --color-success --color-danger --color-text-muted --space-1 --space-2 --space-3 --radius-md --text-xs --text-sm --duration-fast --duration-base --ease-out --focus-ring
 * Use cases: contact form; sign-up with phone; delivery details; two-step verification setup; booking form; customer record; emergency contact; SMS updates opt-in
 * Jobs to be done: enter my phone number without guessing the format; pick my country code; paste a number from somewhere else; know my number is complete before I send the form
 * Keywords: phone, telephone, mobile, country code, dial code, international, tel input, form field, validation
 */
/**
 * Phone number field. The country select and the number box read as one control. As the person types, the digits are
 * spaced to the chosen country's pattern (the caret stays where they are typing, and Backspace steps over spaces and
 * brackets); a leading trunk 0 is dropped where the country uses one; pasting a number that starts with + picks the
 * country from its code. The length is checked when the field is left (or when the form asks with showErrors), the
 * error line slides open under it, and a tick shows when it is complete. onChange gets the digits and the number in
 * international (E.164) form, ready to store. Make it the app's own: list the countries the app serves and store e164.
 * Adapted from TailAdmin (MIT License, Copyright (c) 2023 TailAdmin): the form elements' phone input with a country code.
 */
/**
 * How to try it
 * - Type 5550104477 in Mobile: it reads (555) 010-4477 and a tick shows. Press Save to see the stored +15550104477.
 * - Switch the country to GB and type 07400 123456: the 0 is dropped and the number is spaced the British way.
 * - Paste +49 30 12345678 into Work phone: the country switches to DE. Clear Mobile and press Save to see the error.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useRef, useState), the library's select ("./dropdowns-states"),
 * text field ("./text-fields-states"), button ("./buttons-variants") and inline icon set ("./icons"). Nothing else: no
 * package to install, no phone number library and nothing fetched at run time. The styles are the library's own fl-
 * classes in templates/library/css, and the sample data is in the file.
 */
import { useId, useLayoutEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "./buttons-variants";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { TextField } from "./text-fields-states";

// ── c.phone-field: a country code select joined to a number box that formats as you type. ──

export type PhoneCountry = {
  /** ISO code shown in the select: "US". */
  code: string;
  name: string;
  /** Dial code with the plus: "+1". */
  dial: string;
  /** How the national number is written; each # is a digit: "(###) ###-####". */
  pattern: string;
  /** Allowed digit counts; the number of # in the pattern when left out. */
  lengths?: number[];
  /** A national prefix people type but that isn't dialed from abroad, dropped as they type: "0". */
  trunk?: string;
};

export type PhoneValue = { country: string; digits: string; e164: string; valid: boolean };

export type PhoneFieldProps = {
  label: string;
  countries: PhoneCountry[];
  defaultCountry?: string;
  /** Controlled value; leave out to let the field keep its own. */
  value?: { country: string; digits: string };
  onChange?: (value: PhoneValue) => void;
  required?: boolean;
  hint?: string;
  /** Show any error now (for a form that was submitted), not only after the field is left. */
  showErrors?: boolean;
  id?: string;
  labels?: { country?: string; required?: string; length?: string; valid?: string; optional?: string };
};

const slots = (p: string) => [...p].filter((c) => c === "#").length;
const lengthsOf = (c: PhoneCountry) => c.lengths ?? [slots(c.pattern)];

/** Spaces digits into the pattern; digits past the pattern are added at the end. */
export function formatPhone(digits: string, pattern: string) {
  let out = "";
  let i = 0;
  for (const ch of pattern) {
    if (i >= digits.length) break;
    if (ch === "#") out += digits[i++];
    else out += ch;
  }
  return out + digits.slice(i);
}

export function phoneValue(country: PhoneCountry, digits: string): PhoneValue {
  return { country: country.code, digits, e164: digits ? `${country.dial}${digits}` : "", valid: lengthsOf(country).includes(digits.length) };
}

export function PhoneField({ label, countries, defaultCountry, value, onChange, required, hint, showErrors, id: given, labels = {} }: PhoneFieldProps) {
  const l = { country: "Country code", required: "Enter a phone number.", length: "Enter a {n}-digit number for {country}.", valid: "Complete", optional: "Optional", ...labels };
  const auto = useId();
  const id = given ?? auto;
  const [own, setOwn] = useState({ country: defaultCountry ?? countries[0]?.code ?? "", digits: "" });
  const cur = value ?? own;
  const country = countries.find((c) => c.code === cur.country) ?? countries[0];
  const [touched, setTouched] = useState(false);
  const caret = useRef<number | null>(null);
  const max = Math.max(...lengthsOf(country));

  /** cap: trim to the country's longest number (typing); a country switch keeps every digit and lets the check speak. */
  const commit = (code: string, digits: string, cap = true) => {
    const c = countries.find((x) => x.code === code) ?? country;
    const clean = cap ? digits.slice(0, Math.max(...lengthsOf(c))) : digits;
    if (value === undefined) setOwn({ country: c.code, digits: clean });
    onChange?.(phoneValue(c, clean));
  };

  // After a re-format, put the caret back after the same number of digits it was after.
  const shown = formatPhone(cur.digits, country.pattern);
  useLayoutEffect(() => {
    if (caret.current === null) return;
    const el = document.getElementById(id) as HTMLInputElement | null;
    let n = caret.current;
    let at = 0;
    while (at < shown.length && n > 0) {
      if (/\d/.test(shown[at])) n--;
      at++;
    }
    if (el && document.activeElement === el) el.setSelectionRange(at, at);
    caret.current = null;
  }, [shown, id]);

  const strip = (raw: string, c: PhoneCountry) => {
    let d = raw.replace(/\D/g, "");
    if (c.trunk && d.startsWith(c.trunk)) d = d.slice(c.trunk.length);
    return d;
  };

  /** A number with +code picks its country: the longest dial code that matches, keeping the current one on a tie. */
  const fromIntl = (raw: string) => {
    const all = raw.replace(/\D/g, "");
    const hits = countries.filter((c) => all.startsWith(c.dial.replace(/\D/g, ""))).sort((a, b) => b.dial.length - a.dial.length);
    if (!hits.length) return null;
    const best = hits.find((c) => c.code === country.code && c.dial === hits[0].dial) ?? hits[0];
    return { code: best.code, digits: strip(all.slice(best.dial.replace(/\D/g, "").length), best) };
  };

  const onInput = (raw: string, sel: number | null) => {
    if (raw.trim().startsWith("+")) {
      const hit = fromIntl(raw);
      if (hit) {
        caret.current = hit.digits.length;
        commit(hit.code, hit.digits);
        return;
      }
    }
    const before = raw.slice(0, sel ?? raw.length).replace(/\D/g, "");
    const digits = strip(raw, country);
    const dropped = raw.replace(/\D/g, "").length - digits.length;
    caret.current = Math.max(0, before.length - dropped);
    commit(country.code, digits);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Backspace") return;
    const el = e.currentTarget;
    const at = el.selectionStart ?? 0;
    if (at !== el.selectionEnd || at === 0 || /\d/.test(el.value[at - 1])) return;
    // The character before the caret is a space or bracket: delete the digit before it instead.
    e.preventDefault();
    let i = at - 1;
    while (i >= 0 && !/\d/.test(el.value[i])) i--;
    if (i < 0) return;
    const n = el.value.slice(0, i).replace(/\D/g, "").length;
    caret.current = n;
    commit(country.code, cur.digits.slice(0, n) + cur.digits.slice(n + 1));
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!text.trim().startsWith("+")) return;
    e.preventDefault();
    onInput(text, null);
  };

  const done = phoneValue(country, cur.digits);
  const need = lengthsOf(country);
  const error =
    touched || showErrors
      ? !cur.digits
        ? required
          ? l.required
          : ""
        : !done.valid
          ? l.length.replace("{n}", need.length > 1 ? `${Math.min(...need)} or ${Math.max(...need)}` : String(need[0])).replace("{country}", country.name)
          : ""
      : "";
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`fl-ph${error ? " is-invalid" : ""}`} data-fl="c.phone-field">
      <label htmlFor={id}>
        {label}
        {required ? null : <span className="fl-ph-opt"> {l.optional}</span>}
      </label>
      <div className="fl-ph-group">
        <Select
          aria-label={`${l.country}, ${label}`}
          value={country.code}
          onChange={(e) => {
            const c = countries.find((x) => x.code === e.target.value)!;
            commit(c.code, cur.digits, false);
          }}
          options={countries.map((c) => ({ value: c.code, label: `${c.code} ${c.dial}` }))}
          title={`${country.name} ${country.dial}`}
        />
        <span className={`fl-ph-box${done.valid ? " has-ok" : ""}`}>
          <TextField
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder={country.pattern.replace(/#/g, "0")}
            value={shown}
            maxLength={country.pattern.length + max}
            required={required}
            invalid={!!error}
            aria-describedby={describedBy}
            onChange={(e) => onInput(e.target.value, e.target.selectionStart)}
            onKeyDown={onKey}
            onPaste={onPaste}
            onBlur={() => setTouched(true)}
          />
          {done.valid ? (
            <span className="fl-ph-ok">
              <Icon name="check" />
              <span className="fl-sr">{l.valid}</span>
            </span>
          ) : null}
        </span>
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="fl-ph-hint">
          {hint}
        </p>
      ) : null}
      <div className="fl-ph-msg" data-open={error ? "true" : "false"} inert={!error}>
        <div>
          <p id={`${id}-err`} className="fl-ph-err">
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
  title: "Contact details",
  lede: "We text you when your order ships. We never share your number.",
  saveLabel: "Save",
  savedText: "Saved",
  fields: [
    { key: "mobile", label: "Mobile", country: "US", required: true, hint: "For delivery updates." },
    { key: "work", label: "Work phone", country: "GB", required: false, hint: "Paste a number with + and its code to switch country." },
  ],
  countries: [
    { code: "US", name: "United States", dial: "+1", pattern: "(###) ###-####" },
    { code: "CA", name: "Canada", dial: "+1", pattern: "(###) ###-####" },
    { code: "MX", name: "Mexico", dial: "+52", pattern: "## #### ####" },
    { code: "GB", name: "United Kingdom", dial: "+44", pattern: "#### ######", trunk: "0" },
    { code: "IE", name: "Ireland", dial: "+353", pattern: "## ### ####", trunk: "0" },
    { code: "DE", name: "Germany", dial: "+49", pattern: "#### #######", lengths: [10, 11], trunk: "0" },
    { code: "FR", name: "France", dial: "+33", pattern: "# ## ## ## ##", trunk: "0" },
    { code: "ES", name: "Spain", dial: "+34", pattern: "### ### ###" },
    { code: "IN", name: "India", dial: "+91", pattern: "##### #####", trunk: "0" },
    { code: "AU", name: "Australia", dial: "+61", pattern: "### ### ###", trunk: "0" },
    { code: "JP", name: "Japan", dial: "+81", pattern: "##-####-####", trunk: "0" },
    { code: "BR", name: "Brazil", dial: "+55", pattern: "(##) #####-####", lengths: [10, 11] },
    { code: "NG", name: "Nigeria", dial: "+234", pattern: "### ### ####", trunk: "0" },
  ] as PhoneCountry[],
};

export default function InputPhone() {
  const d = SAMPLE;
  const [vals, setVals] = useState<Record<string, PhoneValue>>({});
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    const bad = d.fields.find((f) => {
      const v = vals[f.key];
      return (f.required && !v?.digits) || (v?.digits && !v.valid);
    });
    if (bad) {
      setSaved("");
      document.getElementById(`fl-ph-${bad.key}`)?.focus();
      return;
    }
    setSaved(
      `${d.savedText}: ${d.fields
        .filter((f) => vals[f.key]?.e164)
        .map((f) => `${f.label} ${vals[f.key].e164}`)
        .join(", ")}.`,
    );
  };
  return (
    <section className="fl-section" aria-labelledby="fl-ph-demo-title">
      <div className="fl-wrap fl-wrap--narrow">
        <form className="fl-ph-demo" onSubmit={submit} noValidate>
          <div>
            <h2 id="fl-ph-demo-title">{d.title}</h2>
            <p>{d.lede}</p>
          </div>
          {d.fields.map((f) => (
            <PhoneField
              key={f.key}
              id={`fl-ph-${f.key}`}
              label={f.label}
              countries={d.countries}
              defaultCountry={f.country}
              required={f.required}
              hint={f.hint}
              showErrors={tried}
              onChange={(v) => {
                setVals((x) => ({ ...x, [f.key]: v }));
                setSaved("");
              }}
            />
          ))}
          <div className="fl-ph-demo-foot">
            <Button type="submit" size={40}>
              {d.saveLabel}
            </Button>
            <p role="status" aria-live="polite">
              {saved}
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
