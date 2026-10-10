/** @flowcode-library cards-variants - Cards: kinds, elevation and states (Cards)
 * Use cases: dashboard tiles; project list; article list; settings groups; pickable options
 * Jobs to be done: scan a list of things; open one of them; choose one of several
 * Keywords: card, tile, elevation, surface, clickable, selected
 */
/**
 * A card is a surface, and what matters is whether it does anything. A plain card holds content; a clickable card is
 * a link or a button and so has hover, focus and pressed states; a chosen card is a radio in disguise.
 *
 * Make it the app's own: pick one kind per list and keep it. Mixing clickable and plain cards in one grid confuses.
 */
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
};

export default function CardsVariants() {
  const d = SAMPLE;
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
                  const on = s.id === "selected";
                  const off = s.id === "disabled";
                  const cls = `fl-ctl-card fl-ctl-card--${k.id}${s.id === "hover" ? " is-hover" : ""}${on && k.id === "selectable" ? " is-on" : ""}${off ? " is-off" : ""}`;
                  // A plain card reacts to nothing, and only the selectable one can stay chosen.
                  const why = k.id === "plain" && s.id !== "rest" ? "Not applicable" : k.id === "clickable" && on ? "Not applicable: opens something" : "";
                  if (why) {
                    return (
                      <td key={k.id} data-state={k.label}>
                        <span className="fl-ctl-matrix-what">{why}</span>
                      </td>
                    );
                  }
                  return (
                    <td key={k.id} data-state={k.label}>
                      <div className={cls} aria-disabled={off || undefined}>
                        <strong>Riverside wedding</strong>
                        <span className="fl-ctl-matrix-what">12 June · 420 photos</span>
                        {k.id === "selectable" ? (
                          <span className="fl-ctl-card-pick">
                            <input type="radio" name={`card-${s.id}`} className="fl-ctl-check fl-ctl-check--16" defaultChecked={on} disabled={off} aria-label="Choose Riverside wedding" />
                          </span>
                        ) : null}
                        {k.id === "clickable" ? <Icon name="arrow" /> : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
