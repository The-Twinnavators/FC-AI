/** @flowcode-library tooltips-variants · Tooltips: placement, delay and what belongs in one (Alerts and states)
 * Catalog ID: c.tooltip (component)
 * Function: The tooltip (c.tooltip) that names a control on hover and keyboard focus; the reference sheet shows four placements, the delay and what does not belong in one.
 * Use it as: import { Tooltip } from "./tooltips-variants"; <Tooltip tip="New shoot" place?="top"|"bottom"|"left"|"right"><button aria-label="New shoot">...</button></Tooltip>
 * Look: A small dark label of a few words that fades in beside a control after a short delay and leaves at once.
 * Tokens: --color-text --color-bg --radius-md --text-xs --duration-fast --easing --space-1 --space-2
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
/**
 * How to try it
 * - Rest on any of the four buttons, or tab to one: both open the tooltip, after a short delay going in and none coming
 *   out.
 * - Sweep across the toolbar: only the one you rest on opens.
 * - Escape shuts an open tooltip.
 *
 * Dependencies: React (ReactNode, useEffect, useRef, useState), and the library's own inline icon set ("./icons"), which is
 * a table of SVG paths rather than an icon package. Nothing else — no package to install and nothing fetched at run time.
 * The styles are the library's own fl- classes in templates/library/css, and the sample data is in the file, so the piece
 * runs in a built app exactly as it runs here.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";

// flowcode:sample
const SAMPLE = {
  places: [
    { id: "top" as const, label: "Above", what: "The default: closest to the pointer" },
    { id: "bottom" as const, label: "Below", what: "When the control is near the top of the page" },
    { id: "left" as const, label: "Left", what: "For a control at the right edge" },
    { id: "right" as const, label: "Right", what: "For a control at the left edge" },
  ],
  bar: [
    { id: "add", icon: "plus", tip: "New shoot" },
    { id: "edit", icon: "pencil", tip: "Rename" },
    { id: "copy", icon: "copy", tip: "Duplicate" },
    { id: "down", icon: "download", tip: "Download" },
    { id: "bin", icon: "trash", tip: "Delete" },
  ],
};

// ── c.tooltip: the one tooltip. Every piece's tooltips are this component; the specimen below shows each placement. ──

export type TooltipPlace = "top" | "bottom" | "left" | "right";

// Written out in full (not built from the placement) so a build finds every class the tooltip needs.
const PLACE: Record<TooltipPlace, string> = {
  top: "fl-ctl-tip-wrap--top",
  bottom: "fl-ctl-tip-wrap--bottom",
  left: "fl-ctl-tip-wrap--left",
  right: "fl-ctl-tip-wrap--right",
};

type TooltipProps = {
  /** The name, in two or three words. */
  tip: string;
  /** Where it sits; above when left out. */
  place?: TooltipPlace;
  /** The control it names. Give that control its own aria-label too. */
  children: ReactNode;
  className?: string;
};

export function Tooltip({ tip, place = "top", children, className }: TooltipProps) {
  const id = useId();
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
    <span className={`fl-ctl-tip-wrap ${PLACE[place]}${className ? ` ${className}` : ""}`} data-fl="c.tooltip" onMouseEnter={show} onMouseLeave={hide} onFocus={() => setOpen(true)} onBlur={hide}>
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
            <Tooltip place={p.id} tip="New shoot">
              <Button variant="secondary" size={40} icon="plus" iconOnly>
                New shoot
              </Button>
            </Tooltip>
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
            <Tooltip key={b.id} place="bottom" tip={b.tip}>
              <Button variant="tertiary" size={40} icon={b.icon} iconOnly className={b.id === "bin" ? "fl-ctl-btn--destructive" : undefined}>
                {b.tip}
              </Button>
            </Tooltip>
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
