/** @flowcode-library focus-rings · Focus rings: thickness, offset, color and where they break (Small components)
 * Use cases: an accessible design system; a keyboard audit; a dark theme; a dense toolbar; a custom control
 * Jobs to be done: see where the keyboard is; pick a ring that works on every background; stop hiding focus
 * Keywords: focus ring, focus-visible, outline, keyboard, accessibility, contrast, offset
 */
/**
 * The ring that says where the keyboard is. Tab through this page rather than reading it: every control below takes
 * focus, and the ring is the only thing telling you which one has it.
 *
 * Four shapes, with the trade-offs made visible. A thin ring disappears on a busy background; one with no offset gets
 * lost in the control's own border; one drawn only in color fails for anyone who cannot see that color; and a ring on
 * :focus rather than :focus-visible follows the mouse around, which is why people switch it off and break their app
 * for keyboards.
 *
 * Make it the app's own: 2px or more, 2px of offset, and a second color underneath so it survives any background.
 */
import { useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  rings: [
    { id: "thin", label: "1 px, no offset", what: "Too thin to find, and it hides in the control's own border" },
    { id: "good", label: "2 px, 2 px offset", what: "The one to use: thick enough to see, clear of the border" },
    { id: "double", label: "Two-tone", what: "Light under dark: survives a photograph or a colored panel behind it" },
    { id: "inset", label: "Inset", what: "For a control flush against an edge, where an outer ring would be cut off" },
  ],
  grounds: [
    { id: "plain", label: "On the page" },
    { id: "sunken", label: "On a panel" },
    { id: "busy", label: "On something busy" },
  ],
};

export default function FocusRings() {
  const d = SAMPLE;
  const [mouseToo, setMouseToo] = useState(false);

  return (
    <section className="fl-section fl-section--specimen">
      <p className="fl-ctl-btn-what">
        Tab through this rather than reading it. Every button below takes focus; nothing else about them changes.
      </p>

      <div className="fl-ctl-matrix-wrap">
        <table className="fl-ctl-matrix">
          <caption className="fl-sr">Each ring on each background</caption>
          <thead>
            <tr>
              <th scope="col">Ring</th>
              {d.grounds.map((g) => (
                <th key={g.id} scope="col">
                  <span className="fl-ctl-matrix-kind">{g.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.rings.map((r) => (
              <tr key={r.id}>
                <th scope="row">
                  <span className="fl-ctl-matrix-kind">{r.label}</span>
                  <span className="fl-ctl-matrix-what">{r.what}</span>
                </th>
                {d.grounds.map((g) => (
                  <td key={g.id} data-state={g.label}>
                    <span className={`fl-ctl-ring-ground fl-ctl-ring-ground--${g.id}`}>
                      <button type="button" className={`fl-btn fl-btn--secondary fl-ctl-btn--32 fl-ctl-focus fl-ctl-focus--${r.id}${mouseToo ? " is-mouse" : ""}`}>
                        Tab to me
                      </button>
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="fl-ctl-sizes">
        <h3>:focus or :focus-visible</h3>
        <p className="fl-ctl-btn-what">
          Turn this on and the rings above switch to plain :focus, so they appear on a mouse press too. That is what
          makes designers ask for focus to be removed, and removing it is what strands every keyboard user.
        </p>
        <label className="fl-ctl-choice">
          <span className="fl-ctl-switch fl-ctl-switch--20">
            <input type="checkbox" checked={mouseToo} onChange={(e) => setMouseToo(e.target.checked)} />
            <span className="fl-ctl-switch-track" aria-hidden="true">
              <span className="fl-ctl-switch-thumb" />
            </span>
          </span>
          <span>
            <strong>Show the ring on mouse presses too</strong>
            <span className="fl-ctl-matrix-what">
              {mouseToo ? "Now click one of the buttons above: the ring stays behind, on something you already pressed." : "Off, which is right: :focus-visible shows the ring for the keyboard only."}
            </span>
          </span>
        </label>
      </div>

      <div className="fl-ctl-sizes">
        <h3>Everything that takes focus</h3>
        <p className="fl-ctl-btn-what">A ring has to work on all of these, not only on buttons. Tab across the row.</p>
        <div className="fl-ctl-focus-row">
          <button type="button" className="fl-btn fl-btn--primary fl-ctl-btn--40">
            A button
          </button>
          <a className="fl-btn fl-btn--secondary fl-ctl-btn--40" href="#top">
            A link
          </a>
          <input className="fl-input fl-ctl-field fl-ctl-field--outlined fl-ctl-field--40" placeholder="A field" aria-label="A field" />
          <span className="fl-ctl-select">
            <label className="fl-sr" htmlFor="focus-select">
              A select
            </label>
            <select id="focus-select" className="fl-input fl-ctl-field fl-ctl-field--outlined fl-ctl-field--40">
              <option>A select</option>
            </select>
            <Icon name="chevron-down" />
          </span>
          <input type="checkbox" className="fl-ctl-check fl-ctl-check--24" aria-label="A checkbox" />
          <span className="fl-ctl-switch fl-ctl-switch--24">
            <input type="checkbox" aria-label="A switch" />
            <span className="fl-ctl-switch-track" aria-hidden="true">
              <span className="fl-ctl-switch-thumb" />
            </span>
          </span>
          <input type="range" className="fl-ctl-range fl-ctl-focus-range" aria-label="A slider" defaultValue={50} />
        </div>
      </div>

      <div className="fl-ctl-sizes">
        <h3>The rules</h3>
        <ul className="fl-ctl-tip-rules">
          <li>
            <strong>At least 2 px, with 2 px of offset.</strong>
            <span className="fl-ctl-matrix-what">Thinner than that and it reads as a border; without offset it merges with one.</span>
          </li>
          <li>
            <strong>Two colors, not one.</strong>
            <span className="fl-ctl-matrix-what">A light ring under a dark one survives any background underneath, including a photograph.</span>
          </li>
          <li>
            <strong>:focus-visible, never :focus.</strong>
            <span className="fl-ctl-matrix-what">The browser already knows whether the keyboard or the mouse got there. Let it decide.</span>
          </li>
          <li>
            <strong>Never outline: none on its own.</strong>
            <span className="fl-ctl-matrix-what">If you take the outline away, put something back in its place in the same rule.</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
