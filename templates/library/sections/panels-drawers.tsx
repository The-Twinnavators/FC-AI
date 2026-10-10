/** @flowcode-library panels-drawers - Panels and drawers: side, bottom and inline (Dialogs and drawers)
 * Use cases: record detail beside a list; filters panel; mobile actions sheet; settings pane; help panel
 * Jobs to be done: look at one thing without losing the list; change filters and see the result; act on a row
 * Keywords: drawer, panel, side sheet, bottom sheet, slide over, detail
 */
/**
 * Three ways to show something beside what you are already looking at. A side drawer covers part of the page and
 * takes focus; a bottom sheet is the same thing on a phone; an inline panel takes space from the list and takes
 * nothing away. Each is drawn open, with the header, body and actions a drawer needs.
 *
 * Make it the app's own: keep the close button and the title. A drawer without a title is a panel nobody can describe.
 */
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  kinds: [
    { id: "side", label: "Side drawer", what: "Over the page, from the right. Escape closes it." },
    { id: "bottom", label: "Bottom sheet", what: "The same on a phone, from the bottom edge." },
    { id: "inline", label: "Inline panel", what: "Takes space from the list; nothing is covered." },
  ],
};

export default function PanelsDrawers() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--specimen">
      <ul className="fl-ctl-panel-grid">
        {d.kinds.map((k) => (
          <li key={k.id}>
            <p className="fl-ctl-matrix-kind">{k.label}</p>
            <p className="fl-ctl-matrix-what">{k.what}</p>
            <div className={`fl-ctl-stage fl-ctl-stage--${k.id}`}>
              <div className="fl-ctl-stage-page" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className="fl-ctl-panel" role="group" aria-label={k.label}>
                <header>
                  <strong>Riverside wedding</strong>
                  <button type="button" className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--icon fl-ctl-btn--32" aria-label="Close" title="Close">
                    <Icon name="close" />
                  </button>
                </header>
                <div className="fl-ctl-panel-body">
                  <p className="fl-ctl-matrix-what">12 June · Northlight Studio · 420 photos delivered</p>
                  <p className="fl-ctl-matrix-what">The body scrolls on its own, so the header and the actions stay put.</p>
                </div>
                <footer>
                  <button type="button" className="fl-btn fl-btn--primary fl-ctl-btn--32">
                    Save
                  </button>
                  <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--32">
                    Cancel
                  </button>
                </footer>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
