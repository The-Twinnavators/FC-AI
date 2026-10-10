/** @flowcode-library dividers-rules · Dividers: horizontal, vertical, with a label, and when to use none (Small components)
 * Use cases: between list rows; between toolbar groups; an or between two ways to sign in; a section break
 * Jobs to be done: see where one group ends; separate a toolbar's groups; break a long page up
 * Keywords: divider, rule, separator, hr, horizontal rule, vertical rule, spacing
 */
/**
 * The smallest component there is, and the one most often used instead of spacing. A line says "these are different
 * things". Space says "these are different things" just as well and makes less noise, so the honest default is space,
 * and the line is for when space alone is not enough.
 *
 * Both are here side by side so the difference is visible rather than argued. A decorative line is aria-hidden; a line
 * that genuinely separates sections is an hr, which screen readers already announce, so it needs nothing added.
 *
 * Make it the app's own: one weight and one color for every divider in the app. Two weights reads as a mistake.
 */
import { useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  rows: ["Riverside wedding", "Harbour engagement", "Studio headshots"],
};

export default function DividersRules() {
  const d = SAMPLE;
  const [lines, setLines] = useState(true);

  return (
    <section className="fl-section fl-section--specimen">
      <h3>A line, or just space</h3>
      <p className="fl-ctl-btn-what">The same list twice. Switch the lines off and see whether anything was lost.</p>
      <label className="fl-ctl-choice fl-ctl-choice--inline">
        <span className="fl-ctl-switch fl-ctl-switch--20">
          <input type="checkbox" checked={lines} onChange={(e) => setLines(e.target.checked)} />
          <span className="fl-ctl-switch-track" aria-hidden="true">
            <span className="fl-ctl-switch-thumb" />
          </span>
        </span>
        <span>
          <strong>Draw the lines</strong>
          <span className="fl-ctl-matrix-what">{lines ? "On. Useful in a dense list where rows nearly touch." : "Off. In a roomy list, space does the whole job."}</span>
        </span>
      </label>
      <ul className={`fl-ctl-div-list${lines ? " has-rules" : ""}`}>
        {d.rows.map((r) => (
          <li key={r}>
            <strong>{r}</strong>
            <span className="fl-ctl-matrix-what">12 June &middot; 420 photos</span>
          </li>
        ))}
      </ul>

      <div className="fl-ctl-sizes">
        <h3>Horizontal</h3>
        <p className="fl-ctl-btn-what">Three weights. Pick one for the whole app: hairline inside a card, regular between sections, heavy almost never.</p>
        <div className="fl-ctl-div-weights">
          <span className="fl-ctl-matrix-what">Hairline</span>
          <hr className="fl-ctl-rule fl-ctl-rule--hair" />
          <span className="fl-ctl-matrix-what">Regular</span>
          <hr className="fl-ctl-rule" />
          <span className="fl-ctl-matrix-what">Heavy</span>
          <hr className="fl-ctl-rule fl-ctl-rule--heavy" />
          <span className="fl-ctl-matrix-what">Dashed, for something provisional</span>
          <hr className="fl-ctl-rule fl-ctl-rule--dash" />
        </div>
      </div>

      <div className="fl-ctl-sizes">
        <h3>Vertical</h3>
        <p className="fl-ctl-btn-what">Between groups in a toolbar, so a row of buttons reads as two or three sets rather than seven buttons.</p>
        <div className="fl-ctl-div-bar">
          <button type="button" className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--icon fl-ctl-btn--32" aria-label="New" title="New">
            <Icon name="plus" />
          </button>
          <button type="button" className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--icon fl-ctl-btn--32" aria-label="Rename" title="Rename">
            <Icon name="pencil" />
          </button>
          <span className="fl-ctl-vrule" aria-hidden="true" />
          <button type="button" className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--icon fl-ctl-btn--32" aria-label="Download" title="Download">
            <Icon name="download" />
          </button>
          <button type="button" className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--icon fl-ctl-btn--32" aria-label="Share" title="Share">
            <Icon name="send" />
          </button>
          <span className="fl-ctl-vrule" aria-hidden="true" />
          <button type="button" className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--icon fl-ctl-btn--32" aria-label="Delete" title="Delete">
            <Icon name="trash" />
          </button>
        </div>
      </div>

      <div className="fl-ctl-sizes">
        <h3>With a label</h3>
        <p className="fl-ctl-btn-what">A line with a word in it, for when the break itself means something. The word is real text, so it is read out.</p>
        <div className="fl-ctl-div-labelled">
          <button type="button" className="fl-btn fl-btn--primary fl-ctl-btn--44">
            Continue with email
          </button>
          <span className="fl-ctl-rule-label">
            <span>or</span>
          </span>
          <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--44">
            <Icon name="globe" /> Continue with your studio account
          </button>
        </div>
        <span className="fl-ctl-rule-label fl-ctl-rule-label--start">
          <span>Last month</span>
        </span>
        <p className="fl-ctl-matrix-what">Aligned to the start, this is how a long feed marks where one day ends and the next begins.</p>
      </div>
    </section>
  );
}
