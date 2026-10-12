/** @flowcode-library steps-progress · Steps progress (hinted) (Tabs, breadcrumbs and paging)
 * Catalog ID: p.stepper@hinted (pattern version)
 * Version of: p.stepper
 * Function: Step indicator marking steps done, current or upcoming, horizontal on wide screens and vertical on phones, with Back/Next buttons and a finished state.
 * Use it as: import { Stepper } from "./steppers-wizards"; <Stepper version="hinted" steps={[{ id, label, what }]} defaultCurrent?={0} current?={index} finished? label?="Progress" onStep?={(index) => ...} />
 * Look: Round numbered dots joined in a row (a column on phones), each step with a one-line hint and a tick once done.
 * Tokens: --color-accent --color-on-accent --color-border --color-surface --color-text --color-text-muted --space-2 --space-3 --weight-semibold --focus-ring
 * Use cases: checkout steps; booking flow; onboarding wizard; multi-step form; application process; setup wizard; order progress; registration steps
 * Jobs to be done: see how far along i am; move through a booking step by step; go back and change an earlier step; finish a long form in parts
 * Keywords: steps, progress, stepper, wizard, booking
 */
/**
 * Steps progress: p.stepper@hinted. The implementation lives in the pattern, in ./steppers-wizards. A step indicator
 * that marks each step done, current or upcoming, each with a one-line hint. It runs left to right on wide screens and
 * top to bottom on phones; finished steps can be pressed to go back to them. Use it above any task that takes a few
 * screens, such as booking or checkout.
 * Make it the app's own: replace SAMPLE with your steps.
 */
import { Stepper } from "./steppers-wizards";

// flowcode:sample
const SAMPLE = {
  label: "Booking progress",
  current: 2,
  steps: [
    { id: "class", label: "Class", hint: "Wheel taster" },
    { id: "time", label: "Time", hint: "Sat 10:00" },
    { id: "details", label: "Your details", hint: "Name and email" },
    { id: "pay", label: "Payment", hint: "$59" },
  ],
};

export default function StepsProgress() {
  const d = SAMPLE;
  return (
    <section className="fl-section">
      <div className="fl-wrap fl-wrap--narrow">
        <Stepper version="hinted" label={d.label} defaultCurrent={d.current} steps={d.steps.map((s) => ({ id: s.id, label: s.label, what: s.hint }))} />
      </div>
    </section>
  );
}
