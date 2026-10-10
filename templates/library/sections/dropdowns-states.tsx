/** @flowcode-library dropdowns-states - Dropdowns: select, combo box and the open menu (Forms)
 * Use cases: country picker; status filter; assignee picker; sort order; settings choice
 * Jobs to be done: choose one from many; find an option by typing; see what is chosen now
 * Keywords: select, dropdown, combo box, menu, option, disabled
 */
/**
 * A select for a short list, a combo box when the list is long enough to need typing, and the open menu itself with a
 * chosen option and a hovered one. The open menu is drawn inline rather than floating, so it can be read here.
 *
 * Make it the app's own: replace the options. Keep the chosen option marked with a tick, not with colour alone.
 */
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  kinds: [
    { id: "select", label: "Select", what: "A short list, chosen from a menu" },
    { id: "combo", label: "Combo box", what: "Long lists: type to narrow" },
  ],
  states: [
    { id: "rest", label: "Enabled", what: "Nothing selected yet" },
    { id: "focus", label: "Focused", what: "Ready for the keyboard" },
    { id: "chosen", label: "Selected", what: "Has a value" },
    { id: "invalid", label: "Error", what: "Rejected, with the reason" },
    { id: "disabled", label: "Disabled", what: "Not available" },
  ],
  options: ["Any status", "Enquiry", "Booked", "Shot", "Delivered"],
  multi: [
    { id: "m1", label: "Enquiry", on: true },
    { id: "m2", label: "Booked", on: true },
    { id: "m3", label: "Shot", on: false },
    { id: "m4", label: "Delivered", on: false },
  ],
  actions: [
    { id: "a1", label: "Rename", icon: "pencil", keys: "F2" },
    { id: "a2", label: "Duplicate", icon: "plus", keys: "" },
    { id: "a3", label: "Download", icon: "download", keys: "" },
    { id: "a4", label: "Move to folder", icon: "layers", keys: "", disabled: true },
    { id: "a5", label: "Delete", icon: "trash", keys: "", danger: true },
  ],
};

export default function DropdownsStates() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-matrix-wrap">
        <table className="fl-ctl-matrix">
          <caption className="fl-sr">A select and a combo box in each state</caption>
          <thead>
            <tr>
              <th scope="col">State</th>
              {d.kinds.map((k) => (
                <th key={k.id} scope="col">
                  <span className="fl-ctl-matrix-kind">{k.label}</span>
                  <span className="fl-ctl-matrix-what">{k.what}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.states.map((s) => (
              <tr key={s.id}>
                <th scope="row">
                  <span className="fl-ctl-matrix-kind">{s.label}</span>
                  <span className="fl-ctl-matrix-what">{s.what}</span>
                </th>
                {d.kinds.map((k) => {
                  const id = `dd-${k.id}-${s.id}`;
                  const invalid = s.id === "invalid";
                  const cls = `fl-input fl-ctl-field fl-ctl-field--outlined${s.id === "focus" ? " is-focus" : ""}${invalid ? " is-invalid" : ""}`;
                  return (
                    <td key={k.id} data-state={k.label}>
                      <label className="fl-sr" htmlFor={id}>
                        Status, {k.label}, {s.label}
                      </label>
                      {k.id === "select" ? (
                        <span className="fl-ctl-select">
                          <select id={id} className={cls} disabled={s.id === "disabled"} defaultValue={s.id === "chosen" ? "Booked" : "Any status"} aria-invalid={invalid || undefined}>
                            {d.options.map((o) => (
                              <option key={o}>{o}</option>
                            ))}
                          </select>
                          <Icon name="chevron-down" />
                        </span>
                      ) : (
                        <span className="fl-ctl-combo">
                          <input
                            id={id}
                            className={cls}
                            role="combobox"
                            aria-expanded="false"
                            placeholder="Search statuses"
                            defaultValue={s.id === "chosen" ? "Booked" : ""}
                            disabled={s.id === "disabled"}
                            aria-invalid={invalid || undefined}
                          />
                          <Icon name="chevron-down" />
                        </span>
                      )}
                      {invalid ? <span className="fl-ctl-field-msg">Choose a status to carry on</span> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="fl-ctl-sizes">
        <h3>Menus, open</h3>
        <p className="fl-ctl-btn-what">
          Three shapes behind the same control. Choose one marks with a tick; choosing several needs checkboxes because a
          tick cannot say "not this one"; an overflow menu is a list of actions, not of values.
        </p>
        <div className="fl-ctl-menu-grid">
          <div>
            <p className="fl-ctl-matrix-kind">Choose one</p>
            <p className="fl-ctl-matrix-what">The selected option ticked, the one under the pointer highlighted.</p>
            <ul className="fl-ctl-menu" role="listbox" aria-label="Status">
              {d.options.map((o, n) => (
                <li key={o} role="option" aria-selected={o === "Booked"} className={n === 2 ? "is-hover" : undefined}>
                  <span className="fl-ctl-menu-tick">{o === "Booked" ? <Icon name="check" /> : null}</span>
                  {o}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="fl-ctl-matrix-kind">Choose several</p>
            <p className="fl-ctl-matrix-what">Checkboxes, and a count of what is on, so the menu can be read at a glance.</p>
            <div className="fl-ctl-menu" role="group" aria-label="Statuses">
              <ul>
                {d.multi.map((m) => (
                  <li key={m.id}>
                    <label className="fl-ctl-menu-check">
                      <input type="checkbox" className="fl-ctl-check fl-ctl-check--16" defaultChecked={m.on} />
                      {m.label}
                    </label>
                  </li>
                ))}
              </ul>
              <div className="fl-ctl-menu-foot">
                <span className="fl-ctl-matrix-what">2 of 4 chosen</span>
                <button type="button" className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--32">
                  Clear
                </button>
              </div>
            </div>
          </div>

          <div>
            <p className="fl-ctl-matrix-kind">Overflow menu</p>
            <p className="fl-ctl-matrix-what">Actions on one thing, opened from the kebab button. Deleting sits apart.</p>
            <span className="fl-ctl-icon-row">
              <button type="button" className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--icon fl-ctl-btn--32 is-hover" aria-label="More actions" aria-expanded="true" title="More actions">
                <Icon name="more" />
              </button>
            </span>
            <ul className="fl-ctl-menu fl-ctl-menu--actions" role="menu" aria-label="Actions">
              {d.actions.map((a) => (
                <li
                  key={a.id}
                  role="menuitem"
                  aria-disabled={a.disabled || undefined}
                  className={`${a.danger ? "is-danger" : ""}${a.disabled ? " is-disabled" : ""}${a.id === "a1" ? " is-hover" : ""}`}
                >
                  <Icon name={a.icon} />
                  {a.label}
                  {a.keys ? <kbd className="fl-ctl-menu-keys">{a.keys}</kbd> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
