/** @flowcode-library cards-variants · Cards: kinds, elevation and states (Cards)
 * Use cases: dashboard tiles; project list; article list; settings groups; pickable options
 * Jobs to be done: scan a list of things; open one of them; choose one of several
 * Keywords: card, tile, elevation, surface, clickable, selected
 */
/**
 * A card is a surface, and what matters is whether it does anything. A plain card holds content; a clickable card is
 * a link or a button and so has hover, focus and pressed states; a chosen card is a radio in disguise.
 *
 * The clickable cards here report what they opened and the selectable ones are one real radio group, so only one of
 * them can be chosen at a time. Make it the app's own: pick one kind per list and keep it. Mixing clickable and plain
 * cards in one grid confuses.
 */
import { useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  kinds: [
    { id: "plain", label: "Plain", what: "Holds content; does nothing" },
    { id: "clickable", label: "Clickable", what: "The whole card opens something" },
    { id: "selectable", label: "Selectable", what: "One of a set; a radio underneath" },
  ],
  states: [
    { id: "rest", label: "Enabled" },
    { id: "hover", label: "Hovered" },
    { id: "selected", label: "Selected" },
    { id: "disabled", label: "Disabled" },
  ],
  elevations: [
    { id: "flat", label: "Flat", what: "A line, no shadow: lists and dense grids" },
    { id: "raised", label: "Raised", what: "A soft shadow: the default card" },
    { id: "floating", label: "Floating", what: "A deeper shadow: something over the page" },
  ],
  shoot: { name: "Riverside wedding", meta: "12 June · 420 photos" },
};

export default function CardsVariants() {
  const d = SAMPLE;
  // One radio group across the whole column: choosing one card lets go of the last.
  const [picked, setPicked] = useState("selected");
  const [said, setSaid] = useState("");

  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-matrix-wrap">
        <table className="fl-ctl-matrix">
          <caption className="fl-sr">Each kind of card in each state</caption>
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
                  const off = s.id === "disabled";
                  const on = k.id === "selectable" && picked === s.id;
                  const hovered = s.id === "hover" ? " is-hover" : "";
                  const cls = `fl-ctl-card fl-ctl-card--${k.id}${hovered}${on ? " is-on" : ""}${off ? " is-off" : ""}`;
                  // A plain card reacts to nothing, and only the selectable one can stay chosen.
                  const why = k.id === "plain" && s.id !== "rest" ? "Not applicable" : k.id === "clickable" && s.id === "selected" ? "Not applicable: opens something" : "";
                  if (why) {
                    return (
                      <td key={k.id} data-state={k.label}>
                        <span className="fl-ctl-matrix-what">{why}</span>
                      </td>
                    );
                  }

                  if (k.id === "selectable") {
                    return (
                      <td key={k.id} data-state={k.label}>
                        <label className={cls} aria-disabled={off || undefined}>
                          <strong>{d.shoot.name}</strong>
                          <span className="fl-ctl-matrix-what">{d.shoot.meta}</span>
                          <span className="fl-ctl-card-pick">
                            <input
                              type="radio"
                              name="card-pick"
                              className="fl-ctl-check fl-ctl-check--16"
                              checked={on}
                              disabled={off}
                              onChange={() => {
                                setPicked(s.id);
                                setSaid(`Chose the ${s.label.toLowerCase()} card`);
                              }}
                              aria-label={`Choose the ${s.label.toLowerCase()} card`}
                            />
                          </span>
                        </label>
                      </td>
                    );
                  }

                  if (k.id === "clickable") {
                    const open = () => {
                      if (off) return;
                      setSaid(`Opened ${d.shoot.name}`);
                    };
                    return (
                      <td key={k.id} data-state={k.label}>
                        <div
                          className={cls}
                          role="button"
                          tabIndex={off ? -1 : 0}
                          aria-disabled={off || undefined}
                          onClick={open}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              open();
                            }
                          }}
                        >
                          <strong>{d.shoot.name}</strong>
                          <span className="fl-ctl-matrix-what">{d.shoot.meta}</span>
                          <Icon name="arrow" />
                        </div>
                      </td>
                    );
                  }

                  return (
                    <td key={k.id} data-state={k.label}>
                      <div className={cls}>
                        <strong>{d.shoot.name}</strong>
                        <span className="fl-ctl-matrix-what">{d.shoot.meta}</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="fl-ctl-status" role="status" aria-live="polite">
        {said || "Open a clickable card, or choose a selectable one."}
      </p>

      <div className="fl-ctl-sizes">
        <h3>Elevation</h3>
        <p className="fl-ctl-btn-what">How far off the page a card sits. One level per list: a grid of mixed elevations reads as a mistake.</p>
        <ul className="fl-ctl-elev-list">
          {d.elevations.map((e) => (
            <li key={e.id}>
              <div className={`fl-ctl-card fl-ctl-card--${e.id}`}>
                <strong>{e.label}</strong>
                <span className="fl-ctl-matrix-what">{e.what}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
