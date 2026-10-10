/** @flowcode-library checkboxes-radios · Checkboxes and radios: every state (Forms)
 * Use cases: settings toggles; multi-select filters; single choice from a list; terms agreement; table row selection
 * Jobs to be done: choose several things; choose exactly one thing; see what is already chosen
 * Keywords: checkbox, radio, indeterminate, selection, disabled
 */
/**
 * Checkboxes for several choices, radios for one, each in every state including the indeterminate checkbox a
 * "select all" box needs when only some rows are chosen. Real inputs, so keyboard and screen readers work.
 *
 * Underneath, a working select all: tick some of the rows and the box above them goes indeterminate on its own,
 * which is the one state a static picture can only assert.
 *
 * Make it the app's own: replace the labels. Keep the description under a label where the choice needs explaining.
 */
/**
 * How to try it
 * - Tick any box or radio in the matrix: they are real inputs, so the keyboard and screen readers work.
 * - In "Select all, in practice", tick one or two rows: the box above them goes indeterminate on its own.
 * - Press the indeterminate box: it chooses everything, which is what people expect.
 *
 * Dependencies: React (useEffect, useRef, useState). Nothing else — no package to install and nothing fetched at run time.
 * The styles are the library's own fl- classes in templates/library/css, and the sample data is in the file, so the piece
 * runs in a built app exactly as it runs here.
 */
import { useEffect, useRef, useState } from "react";

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

/** A select all whose own state is worked out from the rows under it. */
function SelectAll() {
  const rows = ["Riverside wedding", "Harbour engagement", "Studio headshots", "Vineyard anniversary"];
  const [on, setOn] = useState<string[]>([rows[0]]);
  const head = useRef<HTMLInputElement>(null);
  const some = on.length > 0 && on.length < rows.length;

  useEffect(() => {
    if (head.current) head.current.indeterminate = some;
  }, [some]);

  return (
    <div className="fl-ctl-selectall">
      <label className="fl-ctl-choice">
        <input
          ref={head}
          type="checkbox"
          className="fl-ctl-check fl-ctl-check--18"
          checked={on.length === rows.length}
          onChange={() => setOn(on.length === rows.length ? [] : rows)}
        />
        <span>
          <strong>Select all</strong>
          <span className="fl-ctl-matrix-what" role="status" aria-live="polite">
            {on.length === 0 ? "None chosen" : on.length === rows.length ? "All four chosen" : `${on.length} of ${rows.length} chosen, so this box is indeterminate`}
          </span>
        </span>
      </label>
      <ul className="fl-ctl-choice-list">
        {rows.map((r) => (
          <li key={r}>
            <label className="fl-ctl-choice">
              <input
                type="checkbox"
                className="fl-ctl-check fl-ctl-check--18"
                checked={on.includes(r)}
                onChange={() => setOn((v) => (v.includes(r) ? v.filter((x) => x !== r) : [...v, r]))}
              />
              <span>
                <strong>{r}</strong>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
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
        <h3>Select all, in practice</h3>
        <p className="fl-ctl-btn-what">
          Tick one or two rows and the box above them goes indeterminate; tick them all and it fills. Pressing it when
          it is indeterminate chooses everything, which is what people expect.
        </p>
        <SelectAll />
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
