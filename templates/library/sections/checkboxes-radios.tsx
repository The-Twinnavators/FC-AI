/** @flowcode-library checkboxes-radios · Checkboxes and radios: every state (Forms)
 * Catalog ID: c.checkbox (component)
 * Function: The checkbox (c.checkbox) for choosing several things, with the indeterminate state a select-all needs; the reference sheet shows every state, sizes, a label with a description and a working select all.
 * Use it as: import { Checkbox } from "./checkboxes-radios"; <Checkbox label? description? size?={14|16|18|20|24} indeterminate? checked? defaultChecked? disabled? onChange? aria-label?/>
 * Look: A native square checkbox filled with the accent color when ticked, with a dash when indeterminate; with a label it becomes a bordered, fully clickable block with an optional muted description.
 * Tokens: --color-accent --color-border --color-surface-sunken --space-3 --space-4 --radius-md
 * Also: c.radio (component)
 *   Use it as: import { Radio } from "./checkboxes-radios"; <Radio name="group" label? description? size?={14|16|18|20|24} checked? defaultChecked? disabled? onChange? aria-label?/>
 *   Look: A native round radio filled with the accent color when chosen; with a label it becomes the same bordered clickable block as the checkbox.
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
import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";

// ── c.checkbox and c.radio: the two choice controls. Every piece's checkboxes and radios are these. ──

export type CheckSize = 14 | 16 | 18 | 20 | 24;

// Written out in full (not built from the size) so a build finds every class the control needs.
const SIZE: Record<CheckSize, string> = { 14: "fl-ctl-check--14", 16: "fl-ctl-check--16", 18: "fl-ctl-check--18", 20: "fl-ctl-check--20", 24: "fl-ctl-check--24" };

type ChoiceOwn = {
  /** Visible text. Without it the control is bare, so pass aria-label to name it. */
  label?: ReactNode;
  /** A line of explanation under the label; only shown with a label. */
  description?: ReactNode;
  /** Pixel size of the box; 18 when left out. */
  size?: CheckSize;
  className?: string;
};
type ChoiceProps = ChoiceOwn & Omit<InputHTMLAttributes<HTMLInputElement>, keyof ChoiceOwn | "type" | "size">;

function Choice({ kind, indeterminate, label, description, size = 18, className, ...rest }: ChoiceProps & { kind: "checkbox" | "radio"; indeterminate?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);
  const fl = `c.${kind}`;
  const input = <input {...rest} ref={ref} type={kind} className={["fl-ctl-check", SIZE[size], className ?? ""].filter(Boolean).join(" ")} data-fl={label ? undefined : fl} />;
  if (!label) return input;
  return (
    <label className="fl-ctl-choice" data-fl={fl}>
      {input}
      <span>
        <strong>{label}</strong>
        {description ? <span className="fl-ctl-matrix-what">{description}</span> : null}
      </span>
    </label>
  );
}

/** Several choices at once. `indeterminate` is the "some chosen" state a select-all box needs. */
export function Checkbox(props: ChoiceProps & { indeterminate?: boolean }) {
  return <Choice {...props} kind="checkbox" />;
}

/** Exactly one of a set: give every radio in the set the same `name`. */
export function Radio(props: ChoiceProps) {
  return <Choice {...props} kind="radio" />;
}

// flowcode:sample
const SAMPLE = {
  states: [
    { id: "off", label: "Unchecked" },
    { id: "on", label: "Checked" },
    { id: "mixed", label: "Indeterminate" },
    { id: "disabled", label: "Disabled" },
    { id: "disabled-on", label: "Disabled, checked" },
  ],
  sizes: [14, 16, 18, 20, 24] as CheckSize[],
};

function Box({ state, name, kind }: { state: string; name: string; kind: "checkbox" | "radio" }) {
  const common = { name, defaultChecked: state === "on" || state === "disabled-on", disabled: state.startsWith("disabled"), "aria-label": `${kind}, ${state}` };
  return kind === "radio" ? <Radio {...common} /> : <Checkbox {...common} indeterminate={state === "mixed"} />;
}

/** A select all whose own state is worked out from the rows under it. */
function SelectAll() {
  const rows = ["Riverside wedding", "Harbour engagement", "Studio headshots", "Vineyard anniversary"];
  const [on, setOn] = useState<string[]>([rows[0]]);
  const some = on.length > 0 && on.length < rows.length;

  return (
    <div className="fl-ctl-selectall">
      <Checkbox
        checked={on.length === rows.length}
        indeterminate={some}
        onChange={() => setOn(on.length === rows.length ? [] : rows)}
        label="Select all"
        description={
          <span role="status" aria-live="polite">
            {on.length === 0 ? "None chosen" : on.length === rows.length ? "All four chosen" : `${on.length} of ${rows.length} chosen, so this box is indeterminate`}
          </span>
        }
      />
      <ul className="fl-ctl-choice-list">
        {rows.map((r) => (
          <li key={r}>
            <Checkbox checked={on.includes(r)} onChange={() => setOn((v) => (v.includes(r) ? v.filter((x) => x !== r) : [...v, r]))} label={r} />
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
            <Checkbox defaultChecked label="Email me about my bookings" description="Confirmations, changes and reminders. Never marketing." />
          </li>
          <li>
            <Checkbox label="Share my studio in the public directory" description="Your name, town and the work you show. Turn it off at any time." />
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
                <Checkbox size={px} defaultChecked aria-label={`Checkbox, ${px} px`} />
                <Radio size={px} name="size-demo" defaultChecked={px === 18} aria-label={`Radio, ${px} px`} />
              </span>
              <span className="fl-ctl-btn-what">{px} px</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
