/** @flowcode-library text-fields-states · Text fields: every variant and state (Forms)
 * Catalog ID: c.text-field (component)
 * Function: The text field (c.text-field) in three looks and six heights; the reference sheet shows rest, focused, filled, invalid, disabled and read-only states plus a live field with message and counter.
 * Use it as: import { TextField } from "./text-fields-states"; <TextField variant?="outlined"|"filled"|"underlined" size?={24|32|40|44|48|56} multiline? invalid? id name type value placeholder disabled readOnly aria-label? aria-describedby? onChange? />
 * Variants: c.text-field.outlined - the default for forms: a visible border on every side; c.text-field.filled - dense or dark screens: a tinted box, no border until focus; c.text-field.underlined - sparse, editorial forms: a single rule under the text
 * Look: A full-width one-line input (or multi-line textarea) with an accent focus ring, a danger border when invalid, dimmed when disabled and a sunken tint when read-only.
 * Tokens: --color-border --color-border-strong --color-surface --color-surface-sunken --color-accent --color-danger --color-text-muted --focus-ring --space-2 --space-3 --space-4 --space-5 --text-sm --text-xs
 * Use cases: sign-up form; settings form; search box; validation messages; read-only record
 * Jobs to be done: fill in a form; understand why an entry was refused; see a field I cannot change
 * Keywords: input, text field, validation, invalid, disabled, focus
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
import { useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

// ── c.text-field: the one text field. Every form's inputs are this component; the specimen below shows every look and state. ──

export type TextFieldVariant = "outlined" | "filled" | "underlined";
export type TextFieldSize = 24 | 32 | 40 | 44 | 48 | 56;

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
  variant?: TextFieldVariant;
  /** Height in px for a one-line field; the stylesheet's own height when left out. */
  size?: TextFieldSize;
  /** Rejected: danger border and aria-invalid. Point aria-describedby at the message. */
  invalid?: boolean;
  className?: string;
};
type AsInput = TextFieldOwn & { multiline?: false } & Omit<InputHTMLAttributes<HTMLInputElement>, keyof TextFieldOwn>;
type AsTextarea = TextFieldOwn & { multiline: true } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, keyof TextFieldOwn>;

/** Give it a label (a <label htmlFor> or aria-label); the field does not draw one. */
export function TextField(props: AsInput | AsTextarea) {
  const { variant = "outlined", size, invalid, className, multiline, ...rest } = props;
  const cls = ["fl-input", "fl-ctl-field", VARIANT[variant], size && !multiline ? SIZE[size] : "", invalid ? "is-invalid" : "", className ?? ""].filter(Boolean).join(" ");
  const own = { className: cls, "data-fl": `c.text-field.${variant}`, "aria-invalid": invalid || undefined };
  if (multiline) return <textarea {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)} {...own} />;
  return <input {...(rest as InputHTMLAttributes<HTMLInputElement>)} {...own} />;
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
          A field that validates on the way out, not on every keystroke, and a note with a count that turns into an
          error when you go past the limit. Both are the states above, arriving in order.
        </p>
        <div className="fl-ctl-live-form">
          <p>
            <label htmlFor="fld-live-email">Email address</label>
            <TextField
              id="fld-live-email"
              size={40}
              invalid={emailBad}
              type="email"
              value={email}
              placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-describedby="fld-live-email-msg"
            />
            <span className={`fl-ctl-field-msg${emailBad ? "" : " is-quiet"}`} id="fld-live-email-msg">
              {emailBad ? "Finish the address, like ana@northlight.example" : "We only use this to send booking confirmations."}
            </span>
          </p>
          <p>
            <label htmlFor="fld-live-note">Anything we should know?</label>
            <TextField
              multiline
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
