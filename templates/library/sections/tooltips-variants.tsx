/** @flowcode-library tooltips-variants - Tooltips: placement, delay and what belongs in one (Alerts and states)
 * Use cases: naming an icon button; a shortened cell in a table; a keyboard shortcut; a disabled control's reason
 * Jobs to be done: find out what this button does; read a name that was cut off; learn the shortcut
 * Keywords: tooltip, hint, title, hover, focus, placement, delay, aria-describedby
 */
/**
 * A tooltip names a thing. It is not a place for instructions, links or anything a person has to act on, because it
 * cannot be reached by touch and vanishes the moment the pointer leaves.
 *
 * These open on hover and on keyboard focus - the half that is usually missing - after a short delay going in and none
 * coming out, so sweeping across a toolbar does not set off a row of them. Escape shuts one.
 *
 * Make it the app's own: name the control, in two or three words. If it needs a sentence, it is not a tooltip.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  places: [
    { id: "top", label: "Above", what: "The default: closest to the pointer" },
    { id: "bottom", label: "Below", what: "When the control is near the top of the page" },
    { id: "left", label: "Left", what: "For a control at the right edge" },
    { id: "right", label: "Right", what: "For a control at the left edge" },
  ],
  bar: [
    { id: "add", icon: "plus", tip: "New shoot" },
    { id: "edit", icon: "pencil", tip: "Rename" },
    { id: "copy", icon: "copy", tip: "Duplicate" },
    { id: "down", icon: "download", tip: "Download" },
    { id: "bin", icon: "trash", tip: "Delete" },
  ],
};

function Tip({ place, tip, children, id }: { place: string; tip: string; id: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  // Slow to arrive, quick to leave: a row of icons should not flash a row of tooltips.
  const show = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), 400);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setOpen(false);
  };

  return (
    <span className={`fl-ctl-tip-wrap fl-ctl-tip-wrap--${place}`} onMouseEnter={show} onMouseLeave={hide} onFocus={() => setOpen(true)} onBlur={hide}>
      <span className="fl-ctl-tip-anchor" aria-describedby={open ? id : undefined}>
        {children}
      </span>
      <span className={`fl-ctl-tip${open ? " is-open" : ""}`} id={id} role="tooltip">
        {tip}
      </span>
    </span>
  );
}

export default function TooltipsVariants() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--specimen">
      <h3>Where it sits</h3>
      <p className="fl-ctl-btn-what">Four placements. Point at a button, or tab to it: both open the tooltip, and Escape shuts it.</p>
      <ul className="fl-ctl-tip-grid">
        {d.places.map((p) => (
          <li key={p.id}>
            <p className="fl-ctl-matrix-kind">{p.label}</p>
            <p className="fl-ctl-matrix-what">{p.what}</p>
            <Tip place={p.id} tip="New shoot" id={`tip-${p.id}`}>
              <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--icon fl-ctl-btn--40" aria-label="New shoot">
                <Icon name="plus" />
              </button>
            </Tip>
          </li>
        ))}
      </ul>

      <div className="fl-ctl-sizes">
        <h3>What tooltips are actually for</h3>
        <p className="fl-ctl-btn-what">
          A toolbar of icon buttons. Each already carries its name for screen readers in aria-label; the tooltip is the
          same name, for everyone else. Sweep across them: only the one you rest on opens.
        </p>
        <div className="fl-ctl-tip-bar">
          {d.bar.map((b) => (
            <Tip key={b.id} place="bottom" tip={b.tip} id={`tipbar-${b.id}`}>
              <button type="button" className={`fl-btn fl-ctl-btn--tertiary fl-ctl-btn--icon fl-ctl-btn--40${b.id === "bin" ? " fl-ctl-btn--destructive" : ""}`} aria-label={b.tip}>
                <Icon name={b.icon} />
              </button>
            </Tip>
          ))}
        </div>
      </div>

      <div className="fl-ctl-sizes">
        <h3>What does not belong in one</h3>
        <ul className="fl-ctl-tip-rules">
          <li>
            <strong>Anything you have to press.</strong>
            <span className="fl-ctl-matrix-what">A tooltip closes when the pointer leaves, so a link inside it cannot be reached. Use a popover.</span>
          </li>
          <li>
            <strong>Anything long.</strong>
            <span className="fl-ctl-matrix-what">More than a few words means it is help text. Put it under the field, where it stays.</span>
          </li>
          <li>
            <strong>The only copy of something important.</strong>
            <span className="fl-ctl-matrix-what">There is no tooltip on a touch screen. If it matters, it has to be on the page.</span>
          </li>
          <li>
            <strong>The reason a control is disabled.</strong>
            <span className="fl-ctl-matrix-what">A disabled button takes no pointer events, so its tooltip never opens. Say why beside it instead.</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
