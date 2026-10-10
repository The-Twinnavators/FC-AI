/** @flowcode-library steppers-wizards - Steppers: numbered, with a bar, and vertical (Tabs, breadcrumbs and paging)
 * Use cases: checkout; onboarding; a long form split up; an import wizard; a booking flow
 * Jobs to be done: see how many steps are left; go back to a step I finished; know which step failed
 * Keywords: stepper, wizard, steps, progress, multi-step, back, next, current step
 */
/**
 * A flow broken into steps, in the three shapes that cover almost every wizard: numbered across the top, a plain bar
 * for when the step names do not matter, and a vertical list for steps with something to say under each.
 *
 * It walks. Next and Back move, finished steps can be gone back to, steps ahead cannot be jumped to, and one step is
 * left in an error so the failed state is visible rather than described.
 *
 * Make it the app's own: replace the steps. Never more than five; past that, people stop counting and start dreading.
 */
import { useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  steps: [
    { id: "who", label: "Who it is for", what: "Name and contact" },
    { id: "when", label: "When", what: "Date and hours" },
    { id: "where", label: "Where", what: "Address and access" },
    { id: "pay", label: "Payment", what: "Deposit and terms" },
  ],
};

export default function SteppersWizards() {
  const d = SAMPLE;
  const [at, setAt] = useState(1);
  const [failed, setFailed] = useState(-1);
  const last = d.steps.length - 1;
  const here = d.steps[at];

  const state = (n: number) => (n === failed ? "error" : n < at ? "done" : n === at ? "here" : "ahead");

  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-step-block">
        <p className="fl-ctl-matrix-kind">Numbered</p>
        <p className="fl-ctl-matrix-what">Every step named, finished ones ticked and still reachable. Steps ahead cannot be jumped to.</p>
        <ol className="fl-ctl-steps">
          {d.steps.map((s, n) => {
            const st = state(n);
            return (
              <li key={s.id} className={`is-${st}`}>
                <button
                  type="button"
                  className="fl-ctl-step"
                  aria-current={st === "here" ? "step" : undefined}
                  disabled={st === "ahead"}
                  onClick={() => setAt(n)}
                >
                  <span className="fl-ctl-step-mark" aria-hidden="true">
                    {st === "done" ? <Icon name="check" /> : st === "error" ? <Icon name="alert" /> : n + 1}
                  </span>
                  <span className="fl-ctl-step-text">
                    <strong>{s.label}</strong>
                    <span className="fl-ctl-matrix-what">{st === "error" ? "Something here needs fixing" : s.what}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="fl-ctl-step-panel">
        <h4>{here.label}</h4>
        <p className="fl-ctl-matrix-what">
          Step {at + 1} of {d.steps.length}. {here.what}.
        </p>
        <div className="fl-ctl-step-actions">
          <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--40" disabled={at === 0} onClick={() => setAt((n) => Math.max(0, n - 1))}>
            <Icon name="arrow" /> Back
          </button>
          <button type="button" className="fl-btn fl-btn--primary fl-ctl-btn--40" disabled={at === last} onClick={() => setAt((n) => Math.min(last, n + 1))}>
            {at === last - 1 ? "Review and pay" : "Next"} <Icon name="arrow" />
          </button>
          <button
            type="button"
            className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--40"
            onClick={() => setFailed((f) => (f === at ? -1 : at))}
          >
            {failed === at ? "Clear this step's error" : "Make this step fail"}
          </button>
        </div>
      </div>

      <div className="fl-ctl-sizes">
        <h3>Just a bar</h3>
        <p className="fl-ctl-btn-what">When the step names do not help, say how far along it is and nothing else.</p>
        <div className="fl-ctl-step-bar">
          <span className="fl-ctl-bar" role="progressbar" aria-valuenow={at + 1} aria-valuemin={1} aria-valuemax={d.steps.length} aria-label="How far through">
            <span style={{ width: `${((at + 1) / d.steps.length) * 100}%` }} />
          </span>
          <span className="fl-ctl-matrix-what" role="status" aria-live="polite">
            Step {at + 1} of {d.steps.length}
          </span>
        </div>
      </div>

      <div className="fl-ctl-sizes">
        <h3>Vertical</h3>
        <p className="fl-ctl-btn-what">For steps that each need a line of explanation, or that are read before they are done.</p>
        <ol className="fl-ctl-steps fl-ctl-steps--down">
          {d.steps.map((s, n) => {
            const st = state(n);
            return (
              <li key={s.id} className={`is-${st}`}>
                <span className="fl-ctl-step">
                  <span className="fl-ctl-step-mark" aria-hidden="true">
                    {st === "done" ? <Icon name="check" /> : st === "error" ? <Icon name="alert" /> : n + 1}
                  </span>
                  <span className="fl-ctl-step-text">
                    <strong>{s.label}</strong>
                    <span className="fl-ctl-matrix-what">{st === "done" ? "Finished" : st === "here" ? "You are here" : st === "error" ? "Needs fixing" : s.what}</span>
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
