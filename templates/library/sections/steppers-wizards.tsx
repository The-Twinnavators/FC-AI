/** @flowcode-library steppers-wizards · Steppers: numbered, with a bar, and vertical (Tabs, breadcrumbs and paging)
 * Catalog ID: p.stepper (pattern)
 * Function: The step indicator (p.stepper) for multi-step flows in numbered, bar and vertical shapes; the reference sheet pairs it with working Back and Next buttons and a way to fail a step.
 * Use it as: import { Stepper } from "./steppers-wizards"; <Stepper variant?="numbered"|"bar"|"vertical" steps={[{ id, label, what }]} current?={index} defaultCurrent? version?="hinted" finished? label? failed?={index} onStep?={(index) => ...} />
 * Variants: p.stepper.numbered - a wizard where steps have names: a numbered row, finished steps ticked and reachable, steps ahead disabled; p.stepper.bar - a flow where step names do not matter: a plain progress bar with Step N of M beside it; p.stepper.vertical - steps that each need a line of explanation: a numbered list down the page with a status under each
 * Built from: c.progress.bar, c.button.primary, c.button.secondary, c.button.tertiary
 * Look: Numbered circles joined in a row (or column) with the current step accented, finished steps ticked and a failed step marked in the danger color; or a thin progress bar.
 * Tokens: --color-accent --color-border --color-danger --color-on-accent --color-surface-sunken --focus-ring --radius-lg --radius-md --space-2 --space-3 --space-4 --space-5
 * Use cases: checkout; onboarding; a long form split up; an import wizard; a booking flow; checkout steps; booking flow; onboarding wizard; multi-step form; application process; setup wizard; order progress; registration steps
 * Jobs to be done: see how many steps are left; go back to a step I finished; know which step failed; see how far along i am; move through a booking step by step; go back and change an earlier step; finish a long form in parts
 * Keywords: stepper, wizard, steps, progress, multi-step, back, next, current step, booking
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
/**
 * How to try it
 * - Press Next and Back: the panel, the bar and both step lists move together.
 * - Press a finished step to go back to it; steps ahead cannot be jumped to.
 * - Press "Make this step fail" to see the failed state on a real step.
 *
 * Dependencies: React (useState), the library's own inline icon set ("./icons"), which is a table of SVG paths rather
 * than an icon package, and the library's Button and Progress. Nothing else — no package to install and nothing fetched at run time. The styles are the library's
 * own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs in a built app exactly as
 * it runs here.
 */
import { useState } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";
import { Progress } from "./progress-indicators";

// ── p.stepper: where you are in a flow. Built from c.progress for the bar; the wizard's own buttons are c.button. ──

export type StepperVariant = "numbered" | "bar" | "vertical";
/** An alternative design of the whole indicator (p.stepper@<version>); left out = the variant's look. */
export type StepperVersion = "hinted";
export type Step = { id: string; label: string; what: string };
export type StepperProps = {
  /** numbered: named steps across the top, finished ones reachable; bar: a plain bar; vertical: a list with a line under each. */
  variant?: StepperVariant;
  steps: Step[];
  /** Index of the step the person is on. Optional with version "hinted", which then keeps its own (start at defaultCurrent). */
  current?: number;
  defaultCurrent?: number;
  /** hinted: round numbered dots with each step's `what` as a hint, in a row on wide screens and a column on phones; finished steps go back when pressed. variant is ignored. */
  version?: StepperVersion;
  /** hinted: every step shown done (the flow is complete). */
  finished?: boolean;
  /** hinted: the name screen readers give the indicator. */
  label?: string;
  /** Index of a step left in an error, if any. */
  failed?: number;
  /** Called with the index of a finished or current step that was pressed (numbered only). */
  onStep?: (index: number) => void;
  className?: string;
};

export function Stepper({ variant = "numbered", steps, current: controlled, defaultCurrent = 0, version, finished, label = "Progress", failed = -1, onStep, className }: StepperProps) {
  const [own, setOwn] = useState(defaultCurrent);
  const current = controlled ?? own;
  const extra = className ? ` ${className}` : "";
  const fl = `p.stepper.${variant}`;
  const state = (n: number) => (n === failed ? "error" : n < current ? "done" : n === current ? "here" : "ahead");

  if (version === "hinted") {
    const st = (n: number) => (finished || n < current ? "done" : n === current ? "current" : "upcoming");
    return (
      <nav aria-label={label} className={className} data-fl="p.stepper@hinted">
        <ol className="fl-way-steps">
          {steps.map((s, n) => {
            const t = st(n);
            const inner = (
              <>
                <span className="fl-way-step__dot" aria-hidden="true">
                  {t === "done" ? <Icon name="check" /> : n + 1}
                </span>
                <span className="fl-way-step__text">
                  <span className="fl-way-step__label">{s.label}</span>
                  <span className="fl-way-step__hint">{s.what}</span>
                </span>
                <span className="fl-sr">{t === "done" ? ", done" : t === "current" ? ", current step" : ", not started"}</span>
              </>
            );
            return (
              <li key={s.id} className="fl-way-step" data-state={t} aria-current={t === "current" ? "step" : undefined}>
                {t === "done" && !finished ? (
                  <button
                    type="button"
                    className="fl-way-step__btn"
                    onClick={() => {
                      if (controlled === undefined) setOwn(n);
                      onStep?.(n);
                    }}
                  >
                    {inner}
                  </button>
                ) : (
                  <span className="fl-way-step__static">{inner}</span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

  if (variant === "bar") {
    return (
      <div className={`fl-ctl-step-bar${extra}`} data-fl={fl}>
        <Progress value={((current + 1) / steps.length) * 100} label="How far through" thin />
        <span className="fl-ctl-matrix-what" role="status" aria-live="polite">
          Step {current + 1} of {steps.length}
        </span>
      </div>
    );
  }

  const down = variant === "vertical";
  return (
    <ol className={`fl-ctl-steps${down ? " fl-ctl-steps--down" : ""}${extra}`} data-fl={fl}>
      {steps.map((s, n) => {
        const st = state(n);
        const mark = (
          <span className="fl-ctl-step-mark" aria-hidden="true">
            {st === "done" ? <Icon name="check" /> : st === "error" ? <Icon name="alert" /> : n + 1}
          </span>
        );
        const note = down
          ? st === "done" ? "Finished" : st === "here" ? "You are here" : st === "error" ? "Needs fixing" : s.what
          : st === "error" ? "Something here needs fixing" : s.what;
        const text = (
          <span className="fl-ctl-step-text">
            <strong>{s.label}</strong>
            <span className="fl-ctl-matrix-what">{note}</span>
          </span>
        );
        return (
          <li key={s.id} className={`is-${st}`}>
            {down ? (
              <span className="fl-ctl-step">
                {mark}
                {text}
              </span>
            ) : (
              <button type="button" className="fl-ctl-step" aria-current={st === "here" ? "step" : undefined} disabled={st === "ahead"} onClick={() => onStep?.(n)}>
                {mark}
                {text}
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}

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

  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-step-block">
        <p className="fl-ctl-matrix-kind">Numbered</p>
        <p className="fl-ctl-matrix-what">Every step named, finished ones ticked and still reachable. Steps ahead cannot be jumped to.</p>
        <Stepper steps={d.steps} current={at} failed={failed} onStep={setAt} />
      </div>

      <div className="fl-ctl-step-panel">
        <h4>{here.label}</h4>
        <p className="fl-ctl-matrix-what">
          Step {at + 1} of {d.steps.length}. {here.what}.
        </p>
        <div className="fl-ctl-step-actions">
          <Button variant="secondary" size={40} icon="arrow" disabled={at === 0} onClick={() => setAt((n) => Math.max(0, n - 1))}>
            Back
          </Button>
          <Button size={40} icon="arrow" iconAt="end" disabled={at === last} onClick={() => setAt((n) => Math.min(last, n + 1))}>
            {at === last - 1 ? "Review and pay" : "Next"}
          </Button>
          <Button variant="tertiary" size={40} onClick={() => setFailed((f) => (f === at ? -1 : at))}>
            {failed === at ? "Clear this step's error" : "Make this step fail"}
          </Button>
        </div>
      </div>

      <div className="fl-ctl-sizes">
        <h3>Just a bar</h3>
        <p className="fl-ctl-btn-what">When the step names do not help, say how far along it is and nothing else.</p>
        <Stepper variant="bar" steps={d.steps} current={at} />
      </div>

      <div className="fl-ctl-sizes">
        <h3>Versions</h3>
        <p className="fl-ctl-btn-what">
          p.stepper@hinted: round numbered dots, each with a one-line hint; a row on wide screens and a column on phones. Finished steps
          can be pressed to go back. Driven here by the same Back and Next buttons.
        </p>
        <Stepper version="hinted" label="Booking progress" steps={d.steps} current={at} onStep={setAt} />
      </div>

      <div className="fl-ctl-sizes">
        <h3>Vertical</h3>
        <p className="fl-ctl-btn-what">For steps that each need a line of explanation, or that are read before they are done.</p>
        <Stepper variant="vertical" steps={d.steps} current={at} failed={failed} />
      </div>
    </section>
  );
}
