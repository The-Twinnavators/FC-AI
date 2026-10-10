/** @flowcode-library motion-presets - Motion: durations, easings and the handful of animations worth keeping (Small components)
 * Use cases: a design system's motion scale; a drawer opening; a toast arriving; a row being removed; a page change
 * Jobs to be done: pick a duration that feels right; use the same easing everywhere; switch motion off properly
 * Keywords: animation, motion, transition, duration, easing, keyframes, reduced motion, fade, slide
 */
/**
 * Motion as a scale rather than a pile of magic numbers. Four durations, four easings, and the small set of movements
 * an interface actually needs - the rest is decoration, and decoration is what makes an app feel slow.
 *
 * Play any of them against any duration and easing, side by side, so the difference can be felt rather than argued
 * about. Then switch "Respect reduced motion" on: every preset here drops to a cross-fade or to nothing, which is what
 * the setting means. It is not "remove the animation", it is "remove the movement".
 *
 * Make it the app's own: pick one easing for entering and one for leaving, and use them everywhere. Anything over
 * 400 ms is the user waiting for your animation to finish.
 */
import { useState, type CSSProperties } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  durations: [
    { id: 120, label: "120 ms", what: "A hover, a press, a tick" },
    { id: 220, label: "220 ms", what: "The default: a menu, a toast, a tab" },
    { id: 320, label: "320 ms", what: "Something large: a drawer, a sheet" },
    { id: 500, label: "500 ms", what: "Almost always too slow. Keep it for a whole page." },
  ],
  easings: [
    { id: "standard", label: "Standard", css: "cubic-bezier(.2,0,0,1)", what: "Most things, most of the time" },
    { id: "enter", label: "Entering", css: "cubic-bezier(0,0,0,1)", what: "Arriving: quick at the start, settles" },
    { id: "exit", label: "Leaving", css: "cubic-bezier(.3,0,1,1)", what: "Going: slow to start, then gone" },
    { id: "spring", label: "Overshoot", css: "cubic-bezier(.3,1.5,.6,1)", what: "One accent, never a whole page" },
  ],
  moves: [
    { id: "fade", label: "Fade", what: "The safe one. Works for anything, says nothing." },
    { id: "rise", label: "Rise", what: "Fade with a small lift: a toast, a card arriving." },
    { id: "slide", label: "Slide in", what: "From the edge it belongs to: a drawer, a panel." },
    { id: "scale", label: "Scale", what: "From the thing that opened it: a menu, a popover." },
    { id: "collapse", label: "Collapse", what: "Height to nothing: an accordion, a removed row." },
    { id: "pulse", label: "Pulse", what: "Attention, once. Repeating it is how you lose people." },
  ],
};

export default function MotionPresets() {
  const d = SAMPLE;
  const [ms, setMs] = useState(220);
  const [ease, setEase] = useState(d.easings[0]);
  const [calm, setCalm] = useState(false);
  const [run, setRun] = useState(0);

  const style = { "--fl-ctl-ms": `${calm ? 120 : ms}ms`, "--fl-ctl-ease": calm ? "linear" : ease.css } as CSSProperties;

  return (
    <section className="fl-section fl-section--specimen" style={style}>
      <div className="fl-ctl-mo-bar">
        <span className="fl-ctl-mo-pick">
          <label className="fl-sr" htmlFor="mo-ms">
            Duration
          </label>
          <span className="fl-ctl-select">
            <select id="mo-ms" className="fl-input fl-ctl-field fl-ctl-field--outlined fl-ctl-field--32" value={ms} onChange={(e) => setMs(Number(e.target.value))}>
              {d.durations.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
            <Icon name="chevron-down" />
          </span>
        </span>
        <span className="fl-ctl-mo-pick">
          <label className="fl-sr" htmlFor="mo-ease">
            Easing
          </label>
          <span className="fl-ctl-select">
            <select
              id="mo-ease"
              className="fl-input fl-ctl-field fl-ctl-field--outlined fl-ctl-field--32"
              value={ease.id}
              onChange={(e) => setEase(d.easings.find((x) => x.id === e.target.value) ?? d.easings[0])}
            >
              {d.easings.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
            <Icon name="chevron-down" />
          </span>
        </span>
        <button type="button" className="fl-btn fl-btn--primary fl-ctl-btn--32" onClick={() => setRun((n) => n + 1)}>
          <Icon name="refresh" /> Play them all
        </button>
        <label className="fl-ctl-choice fl-ctl-choice--inline">
          <span className="fl-ctl-switch fl-ctl-switch--20">
            <input type="checkbox" checked={calm} onChange={(e) => setCalm(e.target.checked)} />
            <span className="fl-ctl-switch-track" aria-hidden="true">
              <span className="fl-ctl-switch-thumb" />
            </span>
          </span>
          <span>
            <strong>Respect reduced motion</strong>
          </span>
        </label>
      </div>

      <p className="fl-ctl-matrix-what" role="status" aria-live="polite">
        {calm ? "Reduced: every preset becomes a short cross-fade, and nothing moves across the screen." : `${ms} ms, ${ease.label.toLowerCase()} — ${ease.what.toLowerCase()}.`}
      </p>

      <ul className="fl-ctl-mo-grid">
        {d.moves.map((m) => (
          <li key={m.id}>
            <p className="fl-ctl-matrix-kind">{m.label}</p>
            <p className="fl-ctl-matrix-what">{m.what}</p>
            <span className="fl-ctl-mo-stage">
              <span key={`${m.id}-${run}-${ms}-${ease.id}-${calm}`} className={`fl-ctl-mo fl-ctl-mo--${calm ? "fade" : m.id}`}>
                <Icon name="image" />
                <span>{m.label}</span>
              </span>
            </span>
            <button type="button" className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--32" onClick={() => setRun((n) => n + 1)}>
              Play
            </button>
          </li>
        ))}
      </ul>

      <div className="fl-ctl-sizes">
        <h3>Durations</h3>
        <ul className="fl-ctl-tip-rules">
          {d.durations.map((x) => (
            <li key={x.id}>
              <strong>{x.label}</strong>
              <span className="fl-ctl-matrix-what">{x.what}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="fl-ctl-sizes">
        <h3>Easings</h3>
        <ul className="fl-ctl-tip-rules">
          {d.easings.map((x) => (
            <li key={x.id}>
              <strong>
                {x.label} &middot; <code>{x.css}</code>
              </strong>
              <span className="fl-ctl-matrix-what">{x.what}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="fl-ctl-sizes">
        <h3>The rules</h3>
        <ul className="fl-ctl-tip-rules">
          <li>
            <strong>One easing in, one easing out.</strong>
            <span className="fl-ctl-matrix-what">Four easings in a design system is already two too many.</span>
          </li>
          <li>
            <strong>Move the smaller thing.</strong>
            <span className="fl-ctl-matrix-what">A menu grows from its button. A page does not slide because a menu opened.</span>
          </li>
          <li>
            <strong>Never animate what people wait for.</strong>
            <span className="fl-ctl-matrix-what">If the content is ready, show it. An entrance animation is a delay you chose.</span>
          </li>
          <li>
            <strong>prefers-reduced-motion means no movement, not no feedback.</strong>
            <span className="fl-ctl-matrix-what">Keep the fade, drop the travel. Switch it on above and watch all six turn into the same thing.</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
