/** @flowcode-library chips-tags - Chips and tags: filters, choices and labels (Forms)
 * Use cases: filter bar; chosen filters; labels on a card; category tags; removable selections
 * Jobs to be done: narrow a list; see what I have already narrowed it by; take a filter off again
 * Keywords: chip, tag, filter, label, dismiss, remove
 */
/**
 * Three jobs that look alike and behave differently: a filter chip you switch on and off, a chosen chip you can take
 * off again, and a label that is only a label. Filters are buttons; labels are not, so they are not focusable.
 *
 * Make it the app's own: replace the words. Keep the dismiss button inside the chip labelled with what it removes.
 */
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  kinds: [
    { id: "filter", label: "Filter chip", what: "Turns a filter on and off" },
    { id: "removable", label: "Selected", what: "A selected filter, with a way to remove it" },
    { id: "label", label: "Static chip", what: "Says something; not interactive" },
  ],
  states: [
    { id: "rest", label: "Enabled" },
    { id: "hover", label: "Hovered" },
    { id: "on", label: "Selected" },
    { id: "disabled", label: "Disabled" },
  ],
  sizes: [
    { px: 20, note: "Inside a table cell, beside the text it labels" },
    { px: 24, note: "In a table row or a dense toolbar" },
    { px: 32, note: "Default: a filter bar above a list" },
    { px: 40, note: "Beside 40 px buttons and fields" },
    { px: 44, note: "Comfortable to tap" },
  ],
};

export default function ChipsTags() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-matrix-wrap">
        <table className="fl-ctl-matrix">
          <caption className="fl-sr">Each kind of chip in each state</caption>
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
                </th>
                {d.kinds.map((k) => {
                  const on = s.id === "on";
                  const cls = `fl-ctl-chip-item${on ? " is-on" : ""}${s.id === "hover" ? " is-hover" : ""}`;
                  if (k.id === "label") {
                    return (
                      <td key={k.id} data-state={k.label}>
                        {s.id === "rest" || s.id === "on" ? <span className={`fl-ctl-chip-item fl-ctl-chip-item--label${on ? " is-on" : ""}`}>Wedding</span> : <span className="fl-ctl-matrix-what">Not a control</span>}
                      </td>
                    );
                  }
                  if (k.id === "removable") {
                    return (
                      <td key={k.id} data-state={k.label}>
                        <span className={cls}>
                          Wedding
                          <button type="button" className="fl-ctl-chip-x" aria-label="Remove the Wedding filter" disabled={s.id === "disabled"}>
                            <Icon name="close" />
                          </button>
                        </span>
                      </td>
                    );
                  }
                  return (
                    <td key={k.id} data-state={k.label}>
                      <button type="button" className={cls} aria-pressed={on} disabled={s.id === "disabled"}>
                        Wedding
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="fl-ctl-sizes">
        <h3>In a filter bar</h3>
        <p className="fl-ctl-btn-what">How they sit together: what is on, what is off, and one way to clear the lot.</p>
        <div className="fl-ctl-chip-bar">
          <button type="button" className="fl-ctl-chip-item is-on" aria-pressed="true">
            Wedding
          </button>
          <button type="button" className="fl-ctl-chip-item is-on" aria-pressed="true">
            This year
          </button>
          <button type="button" className="fl-ctl-chip-item" aria-pressed="false">
            Portrait
          </button>
          <button type="button" className="fl-ctl-chip-item" aria-pressed="false">
            Commercial
          </button>
          <button type="button" className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--32">
            Clear all
          </button>
        </div>
      </div>

      <div className="fl-ctl-sizes">
        <h3>Heights</h3>
        <p className="fl-ctl-btn-what">The lower half of the button scale, so a chip and a button in the same bar line up. A chip is never a screen's main action, so it stops at 44.</p>
        <ul className="fl-ctl-size-list">
          {d.sizes.map((z) => (
            <li key={z.px}>
              <span className="fl-ctl-icon-row">
                <button type="button" className={`fl-ctl-chip-item fl-ctl-chip-item--${z.px}`} aria-pressed="false">
                  Wedding
                </button>
                <span className={`fl-ctl-chip-item fl-ctl-chip-item--${z.px} is-on`}>
                  Booked
                  <button type="button" className="fl-ctl-chip-x" aria-label="Remove the Booked filter">
                    <Icon name="close" />
                  </button>
                </span>
              </span>
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
