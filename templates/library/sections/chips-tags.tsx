/** @flowcode-library chips-tags · Chips and tags: filters, choices and labels (Forms)
 * Use cases: filter bar; chosen filters; labels on a card; category tags; removable selections
 * Jobs to be done: narrow a list; see what I have already narrowed it by; take a filter off again
 * Keywords: chip, tag, filter, label, dismiss, remove
 */
/**
 * Three things that look alike and behave differently: a filter chip you switch on and off, an input chip you can
 * take off again, and a static chip that is only a label. The filter bar below is live: switch filters, remove them,
 * clear them, and the count follows.
 *
 * Make it the app's own: replace the words. Keep the remove button inside the chip labelled with what it removes.
 */
import { useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  kinds: [
    { id: "filter", label: "Filter chip", what: "Turns a filter on and off" },
    { id: "input", label: "Input chip", what: "A selected filter, with a way to remove it" },
    { id: "static", label: "Static chip", what: "Says something; not interactive" },
  ],
  states: [
    { id: "enabled", label: "Enabled" },
    { id: "hovered", label: "Hovered" },
    { id: "selected", label: "Selected" },
    { id: "disabled", label: "Disabled" },
  ],
  filters: [
    { id: "f1", label: "Wedding", on: true },
    { id: "f2", label: "This year", on: true },
    { id: "f3", label: "Portrait", on: false },
    { id: "f4", label: "Commercial", on: false },
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
  const [filters, setFilters] = useState(d.filters);
  const [removed, setRemoved] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const shown = filters.filter((f) => !removed.includes(f.id));
  const onCount = shown.filter((f) => f.on).length;

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
                  const on = s.id === "selected";
                  const cls = `fl-ctl-chip-item${on ? " is-on" : ""}${s.id === "hovered" ? " is-hover" : ""}`;
                  if (k.id === "static") {
                    return (
                      <td key={k.id} data-state={k.label}>
                        {s.id === "enabled" || on ? <span className={`fl-ctl-chip-item fl-ctl-chip-item--label${on ? " is-on" : ""}`}>Wedding</span> : <span className="fl-ctl-matrix-what">Not applicable</span>}
                      </td>
                    );
                  }
                  if (k.id === "input") {
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

      <div className="fl-ctl-sizes fl-ctl-try">
        <h3>A filter bar you can use</h3>
        <p className="fl-ctl-btn-what">Switch a filter on or off, take one off the bar, or clear the lot. The count follows what is on.</p>
        <div className="fl-ctl-chip-bar">
          {shown.map((f) => (
            <span key={f.id} className={`fl-ctl-chip-item${f.on ? " is-on" : ""}`}>
              <button
                type="button"
                className="fl-ctl-chip-face"
                aria-pressed={f.on}
                onClick={() => {
                  setFilters((list) => list.map((x) => (x.id === f.id ? { ...x, on: !x.on } : x)));
                  setStatus(`${f.label} ${f.on ? "off" : "on"}.`);
                }}
              >
                {f.label}
              </button>
              <button
                type="button"
                className="fl-ctl-chip-x"
                aria-label={`Remove the ${f.label} filter`}
                onClick={() => {
                  setRemoved((r) => [...r, f.id]);
                  setStatus(`${f.label} removed from the bar.`);
                }}
              >
                <Icon name="close" />
              </button>
            </span>
          ))}
          {shown.length ? (
            <button
              type="button"
              className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--32"
              onClick={() => {
                setFilters((list) => list.map((x) => ({ ...x, on: false })));
                setStatus("All filters off.");
              }}
            >
              Clear all
            </button>
          ) : null}
          {removed.length ? (
            <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--32" onClick={() => (setRemoved([]), setStatus("Filters put back."))}>
              Put them back
            </button>
          ) : null}
        </div>
        <p className="fl-ctl-status" role="status" aria-live="polite">
          {status} {onCount} of {shown.length} on.
        </p>
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
                {z.px} px \u00b7 {z.note}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
