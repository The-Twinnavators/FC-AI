/** @flowcode-library text-fields-states · Text fields: every variant and state (Forms)
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
import { useState } from "react";

// flowcode:sample
const SAMPLE = {
  looks: [
    { id: "outlined", label: "Outlined", cls: "fl-ctl-field--outlined", what: "A visible border on every side" },
    { id: "filled", label: "Filled", cls: "fl-ctl-field--filled", what: "A tinted box, no border until focus" },
    { id: "underlined", label: "Underlined", cls: "fl-ctl-field--underlined", what: "A single rule under the text" },
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
    { px: 24, cls: "fl-ctl-field--24", note: "Dense toolbars and table rows" },
    { px: 32, cls: "fl-ctl-field--32", note: "Compact filters" },
    { px: 40, cls: "fl-ctl-field--40", note: "Forms on a desktop screen" },
    { px: 44, cls: "fl-ctl-field--44", note: "Comfortable to tap" },
    { px: 48, cls: "fl-ctl-field--48", note: "Default" },
    { px: 56, cls: "fl-ctl-field--56", note: "A single prominent field" },
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
                        <input
                          id={id}
                          className={`fl-input fl-ctl-field ${l.cls}${s.id === "focus" ? " is-focus" : ""}${invalid ? " is-invalid" : ""}`}
                          type="email"
                          defaultValue={s.value}
                          placeholder={s.placeholder || undefined}
                          disabled={s.id === "disabled"}
                          readOnly={s.id === "readonly"}
                          aria-invalid={invalid || undefined}
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
            <input
              id="fld-live-email"
              className={`fl-input fl-ctl-field fl-ctl-field--outlined fl-ctl-field--40${emailBad ? " is-invalid" : ""}`}
              type="email"
              value={email}
              placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={emailBad || undefined}
              aria-describedby="fld-live-email-msg"
            />
            <span className={`fl-ctl-field-msg${emailBad ? "" : " is-quiet"}`} id="fld-live-email-msg">
              {emailBad ? "Finish the address, like ana@northlight.example" : "We only use this to send booking confirmations."}
            </span>
          </p>
          <p>
            <label htmlFor="fld-live-note">Anything we should know?</label>
            <textarea
              id="fld-live-note"
              className={`fl-input fl-ctl-field fl-ctl-field--outlined${left < 0 ? " is-invalid" : ""}`}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-invalid={left < 0 || undefined}
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
              <input
                className={`fl-input fl-ctl-field fl-ctl-field--outlined ${z.cls}`}
                type="email"
                defaultValue="ana@northlight.example"
                aria-label={`Email address, ${z.px} px`}
              />
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
