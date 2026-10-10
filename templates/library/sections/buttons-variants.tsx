/** @flowcode-library buttons-variants - Buttons: every variant and state (Forms)
 * Use cases: action button set; destructive confirm; form submit states; disabled action; toolbar actions
 * Jobs to be done: pick the right button for an action; show an action is unavailable; warn before something destructive
 * Keywords: button, primary, secondary, destructive, disabled
 */
/**
 * Every button as one matrix: the state across the top, the kind down the side. Hover and pressed are drawn in those
 * states on purpose, so the whole set can be read without a mouse. Each button carries the verb it would really have.
 *
 * Make it the app's own: keep the kinds your screens use and delete the rest. Colors, corners and shadows come from
 * the app's tokens, so this set restyles with everything else.
 */

import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  states: [
    { id: "rest", label: "Enabled" },
    { id: "hover", label: "Hovered" },
    { id: "active", label: "Pressed" },
    { id: "disabled", label: "Disabled" },
    { id: "busy", label: "Loading" },
  ],
  kinds: [
    { id: "primary", label: "Primary", verb: "Save", className: "fl-btn fl-btn--primary", what: "The one action a screen is for" },
    { id: "secondary", label: "Secondary", verb: "Preview", className: "fl-btn fl-btn--secondary", what: "Sits beside the primary action" },
    { id: "tertiary", label: "Tertiary", verb: "Rename", className: "fl-btn fl-ctl-btn--tertiary", what: "Quiet actions in a row or toolbar" },
    { id: "destructive", label: "Destructive", verb: "Delete", className: "fl-btn fl-ctl-btn--destructive", what: "Removes something for good" },
  ],
  sizes: [
    { px: 24, mod: " fl-ctl-btn--24", note: "Dense toolbars and table rows" },
    { px: 32, mod: " fl-ctl-btn--32", note: "Compact filters and chips" },
    { px: 40, mod: " fl-ctl-btn--40", note: "Forms on a desktop screen" },
    { px: 44, mod: " fl-ctl-btn--44", note: "Comfortable to tap" },
    { px: 48, mod: " fl-ctl-btn--48", note: "Default" },
    { px: 56, mod: " fl-ctl-btn--56", note: "A screen's main action" },
  ],
};

const stateClass = (id: string) => (id === "hover" ? " is-hover" : id === "active" ? " is-active" : "");

export default function ButtonsVariants() {
  const d = SAMPLE;
  const [status, setStatus] = useState("");
  const [armed, setArmed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pay, setPay] = useState<"idle" | "loading" | "done">("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const say = (m: string) => setStatus(m);
  const onDelete = () => {
    if (!armed) {
      setArmed(true);
      say("Press Delete again to confirm. Nothing has been removed yet.");
      timer.current = window.setTimeout(() => (setArmed(false), say("Confirmation timed out.")), 4000);
      return;
    }
    window.clearTimeout(timer.current);
    setArmed(false);
    say("Deleted. This is a demo, so nothing really went anywhere.");
  };
  const onPay = () => {
    if (pay !== "idle") return;
    setPay("loading");
    say("Working\u2026");
    timer.current = window.setTimeout(() => (setPay("done"), say("Done. The button stays done so the state can be read.")), 1400);
  };
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-matrix-wrap">
        <table className="fl-ctl-matrix">
          <caption className="fl-sr">Each kind of button in each of its states</caption>
          <thead>
            <tr>
              <th scope="col">Variant</th>
              {d.states.map((s) => (
                <th key={s.id} scope="col">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.kinds.map((k) => (
              <tr key={k.id}>
                <th scope="row">
                  <span className="fl-ctl-matrix-kind">{k.label}</span>
                  <span className="fl-ctl-matrix-what">{k.what}</span>
                </th>
                {d.states.map((s) => {
                  const off = s.id === "disabled" || s.id === "busy";
                  return (
                    <td key={s.id} data-state={s.label}>
                      <button type="button" className={k.className + stateClass(s.id)} disabled={off} aria-busy={s.id === "busy" || undefined}>
                        {s.id === "busy" ? (
                          <>
                            <span className="fl-ctl-spinner" aria-hidden="true" /> Saving
                          </>
                        ) : (
                          k.verb
                        )}
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
        <h3>Heights</h3>
        <p className="fl-ctl-btn-what">Six steps, in pixels, so the scale means the same in every project. 44 is the smallest that stays comfortable to tap.</p>
        <ul className="fl-ctl-size-list">
          {d.sizes.map((s) => (
            <li key={s.px}>
              <button type="button" className={"fl-btn fl-btn--primary" + s.mod}>
                {s.px} px
              </button>
              <span className="fl-ctl-btn-what">{s.note}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="fl-ctl-sizes">
        <h3>With an icon</h3>
        <p className="fl-ctl-btn-what">An icon before the label says what kind of action it is; after the label, where it leads. Never both.</p>
        <div className="fl-actions">
          <button type="button" className="fl-btn fl-btn--primary">
            <Icon name="plus" /> New booking
          </button>
          <button type="button" className="fl-btn fl-btn--secondary">
            <Icon name="download" /> Export
          </button>
          <button type="button" className="fl-btn fl-ctl-btn--tertiary">
            Continue <Icon name="arrow" />
          </button>
          <button type="button" className="fl-btn fl-ctl-btn--destructive">
            <Icon name="trash" /> Delete
          </button>
        </div>
      </div>

      <div className="fl-ctl-sizes">
        <h3>Icon only</h3>
        <p className="fl-ctl-btn-what">
          Square, at the same six heights. Each one still carries its name for screen readers and a tooltip on hover,
          because an icon alone is a guess.
        </p>
        <ul className="fl-ctl-size-list">
          {d.sizes.map((s) => (
            <li key={s.px}>
              <span className="fl-ctl-icon-row">
                <button type="button" className={"fl-btn fl-btn--primary fl-ctl-btn--icon" + s.mod} aria-label="Add" title="Add">
                  <Icon name="plus" />
                </button>
                <button type="button" className={"fl-btn fl-btn--secondary fl-ctl-btn--icon" + s.mod} aria-label="Edit" title="Edit">
                  <Icon name="pencil" />
                </button>
                <button type="button" className={"fl-btn fl-ctl-btn--tertiary fl-ctl-btn--icon" + s.mod} aria-label="More actions" title="More actions">
                  <Icon name="more" />
                </button>
                <button type="button" className={"fl-btn fl-ctl-btn--destructive fl-ctl-btn--icon" + s.mod} aria-label="Delete" title="Delete">
                  <Icon name="trash" />
                </button>
              </span>
              <span className="fl-ctl-btn-what">{s.px} px</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="fl-ctl-sizes fl-ctl-try">
        <h3>Try them</h3>
        <p className="fl-ctl-btn-what">
          The matrix above draws the states; these are real. Hover lifts, pressing pushes down, a destructive action asks
          once before it acts, and a slow action goes to loading and stays done so the state can be read.
        </p>
        <div className="fl-actions">
          <button type="button" className="fl-btn fl-btn--primary" onClick={() => say("Saved.")}>
            Save
          </button>
          <button type="button" className="fl-btn fl-btn--secondary" onClick={() => say("Opened the preview.")}>
            Preview
          </button>
          <button
            type="button"
            className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--icon"
            aria-pressed={saved}
            aria-label={saved ? "Remove from saved" : "Save to your list"}
            title={saved ? "Remove from saved" : "Save to your list"}
            onClick={() => {
              setSaved((v) => !v);
              say(saved ? "Removed from your list." : "Added to your list.");
            }}
          >
            <Icon name="heart" />
          </button>
          <button type="button" className={`fl-btn fl-ctl-btn--destructive${armed ? " is-armed" : ""}`} onClick={onDelete}>
            <Icon name="trash" /> {armed ? "Press again to delete" : "Delete"}
          </button>
          <button type="button" className="fl-btn fl-btn--primary" onClick={onPay} disabled={pay !== "idle"} aria-busy={pay === "loading" || undefined}>
            {pay === "loading" ? (
              <>
                <span className="fl-ctl-spinner" aria-hidden="true" /> Paying
              </>
            ) : pay === "done" ? (
              <>
                <Icon name="check" /> Paid
              </>
            ) : (
              "Pay deposit"
            )}
          </button>
          {pay === "done" ? (
            <button type="button" className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--32" onClick={() => (setPay("idle"), say(""))}>
              Reset
            </button>
          ) : null}
        </div>
        <p className="fl-ctl-status" role="status" aria-live="polite">
          {status}
        </p>
      </div>
    </section>
  );
}
