/** @flowcode-library text-fields-states · Text fields: every variant and state (Forms)
 * Catalog ID: c.text-field (component)
 * Function: The text field (c.text-field) in three looks and six heights, with an auto-growing multiline option; the reference sheet shows rest, focused, filled, invalid, disabled and read-only states plus a live field with message, counter and a note that grows as you type.
 * Use it as: import { TextField } from "./text-fields-states"; <TextField version?="default"|"neobrutal" variant?="outlined"|"filled"|"underlined" size?={24|32|40|44|48|56} multiline? autoGrow? invalid? valid? id name type value placeholder disabled readOnly aria-label? aria-describedby? onChange? />
 * Variants: c.text-field.outlined - the default for forms: a visible border on every side; c.text-field.filled - dense or dark screens: a tinted box, no border until focus; c.text-field.underlined - sparse, editorial forms: a single rule under the text
 * Look: A full-width one-line input (or multi-line textarea) with an accent focus ring, a danger border when invalid, a success border when valid, dimmed when disabled and a sunken tint when read-only. version="neobrutal" swaps in c.text-field@neobrutal: ink border, hard shadow, focus nudge, radius capped at 24px.
 * Tokens: --color-accent --color-border --color-border-strong --color-danger --color-success --color-surface --color-surface-sunken --color-text-muted --control-bg --control-border --control-edge --control-radius --control-shadow-focus --focus-ring --space-2 --space-3 --space-4 --space-5 --text-sm --text-xs --well-shadow
 * Use cases: sign-up form; settings form; search box; validation messages; read-only record; sign up form; club membership; waitlist form; class registration; event registration; application form; contact form
 * Jobs to be done: fill in a form; understand why an entry was refused; see a field I cannot change; join a club or studio; register for a class; sign up for the waitlist; tell them about myself
 * Keywords: input, text field, validation, invalid, disabled, focus, form, sign up, radio, checkbox, select, neobrutalism
 */
/**
 * Text fields in three looks (outlined, filled, underlined) and every state a field reaches: rest, focused, filled,
 * invalid with its message, disabled and read-only. Focus is drawn on purpose so the set reads without tabbing.
 *
 * Make it the app's own: keep the look your forms use and delete the other two. The invalid row shows where the
 * message goes and how it is tied to the field for a screen reader. Underneath, the same field live: the error
 * appears when you leave it empty or half-written, and goes when the address is whole.
 */
/**
 * How to try it
 * - Type in any cell: the matrix rows are real fields, not pictures of fields.
 * - In "The same field, live", leave the email half-written and tab out: the error arrives on the way out, not on every
 *   keystroke, and clears when the address is whole.
 * - Type past 140 characters in the note: the count turns into an error.
 *
 * Dependencies: React (useState). Nothing else — no package to install and nothing fetched at run time. The styles are the
 * library's own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs in a built app
 * exactly as it runs here.
 */
import { useLayoutEffect, useRef, useState, type FormEvent, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";

// ── c.text-field: the one text field. Every form's inputs are this component; the specimen below shows every look and state. ──

export type TextFieldVariant = "outlined" | "filled" | "underlined";
export type TextFieldSize = 24 | 32 | 40 | 44 | 48 | 56;
/** "default" follows the app's tokens; "neobrutal" is the neobrutalism kit's field (thick ink border, hard shadow, focus nudge). */
export type TextFieldVersion = "default" | "neobrutal";

// Written out in full (not built from the variant name) so a build finds every class the field needs.
const VARIANT: Record<TextFieldVariant, string> = {
  outlined: "fl-ctl-field--outlined",
  filled: "fl-ctl-field--filled",
  underlined: "fl-ctl-field--underlined",
};
const SIZE: Record<TextFieldSize, string> = {
  24: "fl-ctl-field--24",
  32: "fl-ctl-field--32",
  40: "fl-ctl-field--40",
  44: "fl-ctl-field--44",
  48: "fl-ctl-field--48",
  56: "fl-ctl-field--56",
};

type TextFieldOwn = {
  /** "neobrutal" draws the neobrutalism kit's field whatever the surface style; "default" when left out. variant and size do not apply to it. */
  version?: TextFieldVersion;
  variant?: TextFieldVariant;
  /** Height in px for a one-line field; the stylesheet's own height when left out. */
  size?: TextFieldSize;
  /** Rejected: danger border and aria-invalid. Point aria-describedby at the message. */
  invalid?: boolean;
  /** Accepted: success border. Pair it with a "Looks good" message. */
  valid?: boolean;
  className?: string;
};
type AsInput = TextFieldOwn & { multiline?: false; autoGrow?: undefined } & Omit<InputHTMLAttributes<HTMLInputElement>, keyof TextFieldOwn>;
/** autoGrow: the textarea gets taller as you type instead of scrolling. */
type AsTextarea = TextFieldOwn & { multiline: true; autoGrow?: boolean } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, keyof TextFieldOwn>;

/** Give it a label (a <label htmlFor> or aria-label); the field does not draw one. */
export function TextField(props: AsInput | AsTextarea) {
  const { version = "default", variant = "outlined", size, invalid, valid, className, multiline, autoGrow, ...rest } = props;
  const area = useRef<HTMLTextAreaElement>(null);
  const grow = () => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  };
  const value = (rest as { value?: unknown }).value;
  useLayoutEffect(() => {
    if (multiline && autoGrow) grow();
  }, [multiline, autoGrow, value]);
  const nb = version === "neobrutal";
  const cls = (
    nb
      ? ["fl-nb", multiline ? "fl-nb-textarea" : "fl-nb-input", multiline && autoGrow ? "fl-in-grow" : "", className ?? ""]
      : ["fl-input", "fl-ctl-field", VARIANT[variant], size && !multiline ? SIZE[size] : "", multiline && autoGrow ? "fl-in-grow" : "", invalid ? "is-invalid" : valid ? "is-valid" : "", className ?? ""]
  )
    .filter(Boolean)
    .join(" ");
  // The kit's corner is a small token radius; the min() keeps a field at 24px or less whatever the theme sets.
  const style = nb ? { ...(rest as { style?: object }).style, borderRadius: "min(var(--fl-nb-radius), 24px)" } : (rest as { style?: object }).style;
  const own = { className: cls, style, "data-fl": nb ? "c.text-field@neobrutal" : `c.text-field.${variant}`, "aria-invalid": invalid || undefined };
  if (multiline) {
    const ta = rest as TextareaHTMLAttributes<HTMLTextAreaElement>;
    return (
      <textarea
        {...ta}
        {...own}
        ref={area}
        onInput={(e) => {
          if (autoGrow) grow();
          ta.onInput?.(e);
        }}
      />
    );
  }
  return <input {...(rest as InputHTMLAttributes<HTMLInputElement>)} {...own} />;
}

// ── c.text-field@neobrutal in use: the neobrutalism kit's sign-up form (nb-form wraps this). ──

export type NeobrutalFormProps = {
  eyebrow: string;
  title: string;
  lede: string;
  studios: string[];
  levels: string[];
  notesMax: number;
  submit: string;
  success: { title: string; text: string; again: string };
};

type NbValues = { name: string; email: string; password: string; studio: string; level: string; notes: string; terms: boolean };
type NbErrors = Partial<Record<keyof NbValues, string>>;
const NB_EMPTY: NbValues = { name: "", email: "", password: "", studio: "", level: "", notes: "", terms: false };

function nbValidate(v: NbValues, max: number): NbErrors {
  const e: NbErrors = {};
  if (!v.name.trim()) e.name = "Tell us your name.";
  if (!v.email.trim()) e.email = "Add your email so we can confirm the seat.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) e.email = "That email looks incomplete, like name@example.com.";
  if (v.password.length < 8) e.password = "Use at least 8 characters.";
  if (!v.studio) e.studio = "Pick a studio.";
  if (!v.level) e.level = "Choose how much you have done.";
  if (v.notes.length > max) e.notes = `Keep it under ${max} characters.`;
  if (!v.terms) e.terms = "Please accept the studio rules to continue.";
  return e;
}

/** A field message with its icon: an error (danger) or, with ok, a confirmation. */
function NbMessage({ id, text, ok }: { id: string; text?: string; ok?: boolean }) {
  if (!text) return null;
  return (
    <p id={id} className={ok ? "fl-nb-err fl-nb-ok" : "fl-nb-err"}>
      {ok ? (
        <Icon name="check" />
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5v5.5M12 16.5v.01" />
        </svg>
      )}
      {text}
    </p>
  );
}

export function NeobrutalForm(d: NeobrutalFormProps) {
  const [v, setV] = useState<NbValues>(NB_EMPTY);
  const [errors, setErrors] = useState<NbErrors>({});
  const [tried, setTried] = useState(false);
  const [done, setDone] = useState<NbValues | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);

  function set<K extends keyof NbValues>(key: K, value: NbValues[K]) {
    const next = { ...v, [key]: value };
    setV(next);
    if (tried) setErrors(nbValidate(next, d.notesMax));
  }
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    const found = nbValidate(v, d.notesMax);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setDone(v);
    window.setTimeout(() => doneRef.current?.focus(), 0);
  }
  function reset() {
    setV(NB_EMPTY);
    setErrors({});
    setTried(false);
    setDone(null);
  }

  const emailOk = tried && !errors.email && v.email.trim() !== "";
  const count = v.notes.length;
  const errCount = Object.keys(errors).length;

  return (
    <section className="fl-section fl-nb" aria-labelledby="nb-form-title">
      <div className="fl-wrap fl-wrap--narrow fl-nb-stack">
        <div className="fl-head">
          <p className="fl-nb-kicker">{d.eyebrow}</p>
          <h2 id="nb-form-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>

        {done ? (
          <div className="fl-nb-box fl-nb-done" role="status" aria-live="polite">
            <span className="fl-nb-tile fl-nb-tile--success">
              <Icon name="check" />
            </span>
            <h3 ref={doneRef} tabIndex={-1}>
              {d.success.title}
            </h3>
            <p>{d.success.text.replace("{email}", done.email.trim()).replace("{studio}", done.studio)}</p>
            <Button version="neobrutal" variant="tertiary" onClick={reset}>
              {d.success.again}
            </Button>
          </div>
        ) : (
          <form ref={formRef} className="fl-nb-box fl-nb-form" noValidate onSubmit={onSubmit}>
            <p className="fl-sr" role="status" aria-live="polite">
              {tried && errCount > 0 ? `${errCount} ${errCount === 1 ? "field needs" : "fields need"} attention.` : ""}
            </p>
            <div className="fl-nb-form__row">
              <div className="fl-nb-field">
                <label className="fl-nb-label" htmlFor="nb-form-name">
                  Full name
                </label>
                <TextField
                  version="neobrutal"
                  id="nb-form-name"
                  name="name"
                  autoComplete="name"
                  value={v.name}
                  onChange={(e) => set("name", e.target.value)}
                  invalid={!!errors.name}
                  aria-describedby={errors.name ? "nb-form-name-err" : undefined}
                />
                <NbMessage id="nb-form-name-err" text={errors.name} />
              </div>
              <div className="fl-nb-field">
                <label className="fl-nb-label" htmlFor="nb-form-email">
                  Email
                </label>
                <TextField
                  version="neobrutal"
                  id="nb-form-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={v.email}
                  onChange={(e) => set("email", e.target.value)}
                  invalid={!!errors.email}
                  aria-describedby={errors.email ? "nb-form-email-err" : emailOk ? "nb-form-email-ok" : undefined}
                />
                <NbMessage id="nb-form-email-err" text={errors.email} />
                {emailOk ? <NbMessage id="nb-form-email-ok" text="Looks good." ok /> : null}
              </div>
            </div>

            <div className="fl-nb-form__row">
              <div className="fl-nb-field">
                <label className="fl-nb-label" htmlFor="nb-form-password">
                  Password
                </label>
                <TextField
                  version="neobrutal"
                  id="nb-form-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={v.password}
                  onChange={(e) => set("password", e.target.value)}
                  invalid={!!errors.password}
                  aria-describedby={errors.password ? "nb-form-password-hint nb-form-password-err" : "nb-form-password-hint"}
                />
                <p id="nb-form-password-hint" className="fl-nb-hint">
                  At least 8 characters.
                </p>
                <NbMessage id="nb-form-password-err" text={errors.password} />
              </div>
              <div className="fl-nb-field">
                <label className="fl-nb-label" htmlFor="nb-form-studio">
                  Studio
                </label>
                <select
                  id="nb-form-studio"
                  name="studio"
                  className="fl-nb-select"
                  style={{ borderRadius: "min(var(--fl-nb-radius), 24px)" }}
                  value={v.studio}
                  onChange={(e) => set("studio", e.target.value)}
                  aria-invalid={!!errors.studio}
                  aria-describedby={errors.studio ? "nb-form-studio-err" : undefined}
                >
                  <option value="">Choose a studio</option>
                  {d.studios.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <NbMessage id="nb-form-studio-err" text={errors.studio} />
              </div>
            </div>

            <fieldset className="fl-nb-fieldset" aria-invalid={!!errors.level} aria-describedby={errors.level ? "nb-form-level-err" : undefined}>
              <legend className="fl-nb-label">How much clay have you thrown?</legend>
              <div className="fl-nb-choices">
                {d.levels.map((l) => (
                  <label key={l} className="fl-nb-choice">
                    <input
                      type="radio"
                      name="level"
                      value={l}
                      checked={v.level === l}
                      onChange={() => set("level", l)}
                      aria-describedby={errors.level ? "nb-form-level-err" : undefined}
                    />
                    <span>{l}</span>
                  </label>
                ))}
              </div>
              <NbMessage id="nb-form-level-err" text={errors.level} />
            </fieldset>

            <div className="fl-nb-field">
              <label className="fl-nb-label" htmlFor="nb-form-notes">
                Anything we should know? <span className="fl-meta">(optional)</span>
              </label>
              <TextField
                version="neobrutal"
                multiline
                id="nb-form-notes"
                name="notes"
                value={v.notes}
                onChange={(e) => set("notes", e.target.value)}
                invalid={!!errors.notes}
                aria-describedby={errors.notes ? "nb-form-notes-count nb-form-notes-err" : "nb-form-notes-count"}
              />
              <span id="nb-form-notes-count" className={`fl-nb-count${count > d.notesMax ? " fl-nb-count--over" : ""}`}>
                {count}/{d.notesMax}
              </span>
              <NbMessage id="nb-form-notes-err" text={errors.notes} />
            </div>

            <div className="fl-nb-field">
              <label className="fl-nb-check">
                <input
                  type="checkbox"
                  name="terms"
                  checked={v.terms}
                  onChange={(e) => set("terms", e.target.checked)}
                  aria-invalid={!!errors.terms}
                  aria-describedby={errors.terms ? "nb-form-terms-err" : undefined}
                />
                <span>I have read the studio rules and agree to keep the wheels clean.</span>
              </label>
              <NbMessage id="nb-form-terms-err" text={errors.terms} />
            </div>

            <Button version="neobrutal" type="submit" block icon="arrow" iconAt="end">
              {d.submit}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE = {
  looks: [
    { id: "outlined" as const, label: "Outlined", what: "A visible border on every side" },
    { id: "filled" as const, label: "Filled", what: "A tinted box, no border until focus" },
    { id: "underlined" as const, label: "Underlined", what: "A single rule under the text" },
  ],
  states: [
    { id: "rest", label: "Enabled", what: "Empty", value: "", placeholder: "you@example.com" },
    { id: "focus", label: "Focused", what: "Has keyboard focus", value: "ana@", placeholder: "" },
    { id: "filled", label: "Filled", what: "Has a value", value: "ana@northlight.example", placeholder: "" },
    { id: "invalid", label: "Error", what: "Rejected, with the reason", value: "ana@", placeholder: "" },
    { id: "disabled", label: "Disabled", what: "Not available", value: "ana@northlight.example", placeholder: "" },
    { id: "readonly", label: "Read-only", what: "Shown, not editable", value: "ana@northlight.example", placeholder: "" },
  ],
  sizes: [
    { px: 24 as const, note: "Dense toolbars and table rows" },
    { px: 32 as const, note: "Compact filters" },
    { px: 40 as const, note: "Forms on a desktop screen" },
    { px: 44 as const, note: "Comfortable to tap" },
    { px: 48 as const, note: "Default" },
    { px: 56 as const, note: "A single prominent field" },
  ],
};

export default function TextFieldsStates() {
  const d = SAMPLE;
  // The live field: it only complains once you have left it, which is the rule the matrix cannot draw.
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [note, setNote] = useState("");
  const emailBad = touched && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const emailGood = touched && !emailBad && email.trim() !== "";
  const left = 140 - note.length;
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-matrix-wrap">
        <table className="fl-ctl-matrix">
          <caption className="fl-sr">Each state of a text field in each of its three looks</caption>
          <thead>
            <tr>
              <th scope="col">State</th>
              {d.looks.map((l) => (
                <th key={l.id} scope="col">
                  <span className="fl-ctl-matrix-kind">{l.label}</span>
                  <span className="fl-ctl-matrix-what">{l.what}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.states.map((s) => {
              const invalid = s.id === "invalid";
              return (
                <tr key={s.id}>
                  <th scope="row">
                    <span className="fl-ctl-matrix-kind">{s.label}</span>
                    <span className="fl-ctl-matrix-what">{s.what}</span>
                  </th>
                  {d.looks.map((l) => {
                    const id = `fld-${l.id}-${s.id}`;
                    return (
                      <td key={l.id} data-state={l.label}>
                        <label className="fl-sr" htmlFor={id}>
                          Email address, {l.label}, {s.label}
                        </label>
                        <TextField
                          id={id}
                          variant={l.id}
                          className={s.id === "focus" ? "is-focus" : undefined}
                          invalid={invalid}
                          type="email"
                          defaultValue={s.value}
                          placeholder={s.placeholder || undefined}
                          disabled={s.id === "disabled"}
                          readOnly={s.id === "readonly"}
                          aria-describedby={invalid ? `${id}-msg` : undefined}
                        />
                        {invalid ? (
                          <span className="fl-ctl-field-msg" id={`${id}-msg`}>
                            Finish the address, like ana@northlight.example
                          </span>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="fl-ctl-sizes">
        <h3>The same field, live</h3>
        <p className="fl-ctl-btn-what">
          A field that validates on the way out, not on every keystroke, and a note that grows as you type, with a count that turns into an
          error when you go past the limit. Both are the states above, arriving in order.
        </p>
        <div className="fl-ctl-live-form">
          <p>
            <label htmlFor="fld-live-email">Email address</label>
            <TextField
              id="fld-live-email"
              size={40}
              invalid={emailBad}
              valid={emailGood}
              type="email"
              value={email}
              placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-describedby="fld-live-email-msg"
            />
            <span className={`fl-ctl-field-msg${emailBad ? "" : emailGood ? " is-good" : " is-quiet"}`} id="fld-live-email-msg">
              {emailBad ? "Finish the address, like ana@northlight.example" : emailGood ? "Looks good." : "We only use this to send booking confirmations."}
            </span>
          </p>
          <p>
            <label htmlFor="fld-live-note">Anything we should know?</label>
            <TextField
              multiline
              autoGrow
              id="fld-live-note"
              invalid={left < 0}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-describedby="fld-live-note-count"
            />
            <span className={`fl-ctl-field-msg${left < 0 ? "" : " is-quiet"}`} id="fld-live-note-count" role="status" aria-live="polite">
              {left < 0 ? `${-left} characters too many` : `${left} characters left`}
            </span>
          </p>
        </div>
      </div>

      <div className="fl-ctl-sizes">
        <h3>Versions</h3>
        <p className="fl-ctl-btn-what">
          <code>version</code> picks a whole design. The default follows the app&apos;s tokens; c.text-field@neobrutal is the neobrutalism kit&apos;s
          field: a thick ink border, a hard shadow, and a small nudge up and left on focus. It stays neobrutal under any surface style, and its
          corners never pass 24 px.
        </p>
        <div className="fl-nb" style={{ display: "grid", gap: "var(--space-3)", maxWidth: "24rem", padding: "var(--space-3) 0" }}>
          <label className="fl-nb-label" htmlFor="fld-nb-demo">
            Full name
          </label>
          <TextField version="neobrutal" id="fld-nb-demo" placeholder="Ana Ruiz" />
          <label className="fl-nb-label" htmlFor="fld-nb-demo-bad">
            Email
          </label>
          <TextField version="neobrutal" id="fld-nb-demo-bad" type="email" defaultValue="ana@" invalid aria-describedby="fld-nb-demo-msg" />
          <NbMessage id="fld-nb-demo-msg" text="That email looks incomplete, like name@example.com." />
        </div>
      </div>

      <div className="fl-ctl-sizes">
        <h3>Heights</h3>
        <p className="fl-ctl-btn-what">The same six steps as the buttons, so a field and a button in the same row line up.</p>
        <ul className="fl-ctl-size-list">
          {d.sizes.map((z) => (
            <li key={z.px}>
              <TextField size={z.px} type="email" defaultValue="ana@northlight.example" aria-label={`Email address, ${z.px} px`} />
              <span className="fl-ctl-btn-what">
                {z.px} px · {z.note}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
