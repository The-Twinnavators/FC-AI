/** @flowcode-library panels-drawers · Panels and drawers: side, bottom and inline (Dialogs and drawers)
 * Use cases: record detail beside a list; filters panel; mobile actions sheet; settings pane; help panel
 * Jobs to be done: look at one thing without losing the list; change filters and see the result; act on a row
 * Keywords: drawer, panel, side sheet, bottom sheet, slide over, detail
 */
/**
 * Three ways to show something beside what you are already looking at, and the difference between them is how they
 * arrive: a side sheet slides in over the page, a bottom sheet rises from the bottom edge, an inline panel takes
 * space from the list and covers nothing. Open each one to see it.
 *
 * Make it the app's own: keep the close button, the title, and Escape. A drawer that cannot be closed by keyboard is
 * a trap. Motion is skipped for anyone who asks for less of it.
 */
import { useEffect, useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  kinds: [
    { id: "side", label: "Side sheet", what: "Over the page, from the right. Escape closes it." },
    { id: "bottom", label: "Bottom sheet", what: "From the bottom edge: the same job on a phone." },
    { id: "inline", label: "Inline panel", what: "Takes space from the list; nothing is covered." },
  ],
  record: { title: "Riverside wedding", meta: "12 June \u00b7 Northlight Studio \u00b7 420 photos delivered" },
};

export default function PanelsDrawers() {
  const d = SAMPLE;
  const [open, setOpen] = useState<Record<string, boolean>>({ side: true, bottom: false, inline: false });
  const [status, setStatus] = useState("");

  // Escape closes whichever is open, the way a real drawer behaves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const openOne = Object.keys(open).find((k) => open[k]);
      if (openOne) {
        setOpen((o) => ({ ...o, [openOne]: false }));
        setStatus(`${d.kinds.find((k) => k.id === openOne)?.label} closed with Escape.`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, d.kinds]);

  const toggle = (id: string, label: string) => {
    setOpen((o) => ({ ...o, [id]: !o[id] }));
    setStatus(`${label} ${open[id] ? "closed" : "opened"}.`);
  };

  return (
    <section className="fl-section fl-section--specimen">
      <ul className="fl-ctl-panel-grid">
        {d.kinds.map((k) => (
          <li key={k.id}>
            <div className="fl-ctl-panel-head">
              <span>
                <span className="fl-ctl-matrix-kind">{k.label}</span>
                <span className="fl-ctl-matrix-what">{k.what}</span>
              </span>
              <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--32" aria-expanded={open[k.id]} onClick={() => toggle(k.id, k.label)}>
                {open[k.id] ? "Close" : "Open"}
              </button>
            </div>
            <div className={`fl-ctl-stage fl-ctl-stage--${k.id}`}>
              <div className="fl-ctl-stage-page" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              {k.id !== "inline" && open[k.id] ? <div className="fl-ctl-scrim" onClick={() => toggle(k.id, k.label)} aria-hidden="true" /> : null}
              <div className={`fl-ctl-panel${open[k.id] ? " is-open" : ""}`} role="group" aria-label={k.label} aria-hidden={!open[k.id]}>
                <header>
                  <strong>{d.record.title}</strong>
                  <button
                    type="button"
                    className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--icon fl-ctl-btn--32"
                    aria-label={`Close the ${k.label.toLowerCase()}`}
                    title="Close"
                    tabIndex={open[k.id] ? 0 : -1}
                    onClick={() => toggle(k.id, k.label)}
                  >
                    <Icon name="close" />
                  </button>
                </header>
                <div className="fl-ctl-panel-body">
                  <p className="fl-ctl-matrix-what">{d.record.meta}</p>
                  <p className="fl-ctl-matrix-what">The body scrolls on its own, so the header and the actions stay put.</p>
                </div>
                <footer>
                  <button type="button" className="fl-btn fl-btn--primary fl-ctl-btn--32" tabIndex={open[k.id] ? 0 : -1} onClick={() => (toggle(k.id, k.label), setStatus("Saved and closed."))}>
                    Save
                  </button>
                  <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--32" tabIndex={open[k.id] ? 0 : -1} onClick={() => toggle(k.id, k.label)}>
                    Cancel
                  </button>
                </footer>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="fl-ctl-status" role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
