/** @flowcode-library checkboxes-radios - Checkboxes and radios: every state (Forms)
 * Use cases: settings toggles; multi-select filters; single choice from a list; terms agreement; table row selection
 * Jobs to be done: choose several things; choose exactly one thing; see what is already chosen
 * Keywords: checkbox, radio, indeterminate, selection, disabled
 */
/**
 * Checkboxes for several choices, radios for one, each in every state including the indeterminate checkbox a
 * "select all" box needs when only some rows are chosen. Real inputs, so keyboard and screen readers work.
 *
 * Make it the app's own: replace the labels. Keep the description under a label where the choice needs explaining.
 */
import { useEffect, useRef } from "react";

// flowcode:sample
const SAMPLE = {
  states: [
    { id: "off", label: "Unchecked" },
    { id: "on", label: "Checked" },
    { id: "mixed", label: "Indeterminate" },
    { id: "disabled", label: "Disabled" },
    { id: "disabled-on", label: "Disabled, checked" },
  ],
  sizes: [14, 16, 18, 20, 24],
};

function Box({ state, name, kind }: { state: string; name: string; kind: "checkbox" | "radio" }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === "mixed";
  }, [state]);
  return (
    <input
      ref={ref}
      type={kind}
      name={name}
      className="fl-ctl-check"
      defaultChecked={state === "on" || state === "disabled-on"}
      disabled={state.startsWith("disabled")}
      aria-label={`${kind}, ${state}`}
    />
  );
}

export default function CheckboxesRadios() {
  const d = SAMPLE;
  const rows = [
    { id: "checkbox", label: "Checkbox", what: "Several choices at once", kind: "checkbox" as const },
    { id: "radio", label: "Radio", what: "Exactly one of a set", kind: "radio" as const },
  ];
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-matrix-wrap">
        <table className="fl-ctl-matrix">
          <caption className="fl-sr">Checkboxes and radios in each state</caption>
          <thead>
            <tr>
              <th scope="col">Control</th>
              {d.states.map((s) => (
                <th key={s.id} scope="col">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <th scope="row">
                  <span className="fl-ctl-matrix-kind">{r.label}</span>
                  <span className="fl-ctl-matrix-what">{r.what}</span>
                </th>
                {d.states.map((s) => (
                  <td key={s.id} data-state={s.label}>
                    {r.kind === "radio" && s.id === "mixed" ? (
                      <span className="fl-ctl-matrix-what">Not applicable</span>
                    ) : (
                      <Box state={s.id} name={`${r.id}-${s.id}`} kind={r.kind} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="fl-ctl-sizes">
        <h3>With a label and a description</h3>
        <p className="fl-ctl-btn-what">How a choice looks when it needs explaining. The whole block is clickable.</p>
        <ul className="fl-ctl-choice-list">
          <li>
            <label className="fl-ctl-choice">
              <input type="checkbox" className="fl-ctl-check" defaultChecked />
              <span>
                <strong>Email me about my bookings</strong>
                <span className="fl-ctl-matrix-what">Confirmations, changes and reminders. Never marketing.</span>
              </span>
            </label>
          </li>
          <li>
            <label className="fl-ctl-choice">
              <input type="checkbox" className="fl-ctl-check" />
              <span>
                <strong>Share my studio in the public directory</strong>
                <span className="fl-ctl-matrix-what">Your name, town and the work you show. Turn it off at any time.</span>
              </span>
            </label>
          </li>
        </ul>
      </div>

      <div className="fl-ctl-sizes">
        <h3>Sizes</h3>
        <p className="fl-ctl-btn-what">A checkbox sits beside text, so the scale is smaller than a button's. 20 px and up are the comfortable ones to tap.</p>
        <ul className="fl-ctl-size-list">
          {d.sizes.map((px) => (
            <li key={px}>
              <span className="fl-ctl-icon-row">
                <input type="checkbox" className={`fl-ctl-check fl-ctl-check--${px}`} defaultChecked aria-label={`Checkbox, ${px} px`} />
                <input type="radio" name="size-demo" className={`fl-ctl-check fl-ctl-check--${px}`} defaultChecked={px === 18} aria-label={`Radio, ${px} px`} />
              </span>
              <span className="fl-ctl-btn-what">{px} px</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
