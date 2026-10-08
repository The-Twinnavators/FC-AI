/**
 * Steps progress: a step indicator that marks each step done, current or upcoming, with Back and Next buttons. It
 * runs left to right on wide screens and top to bottom on phones; finished steps can be clicked to go back to them.
 * Use it above any task that takes a few screens, such as booking or checkout.
 * Make it the app's own: replace SAMPLE with your steps and put each step's real content in the panel.
 */
import { useRef, useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Book a class",
  title: "Your booking",
  steps: [
    { id: "class", label: "Class", hint: "Wheel taster", body: "Saturday wheel taster: two hours at the wheel, clay and firing included." },
    { id: "time", label: "Time", hint: "Sat 10:00", body: "Saturday 14 November, 10:00 to 12:00. Two places left." },
    { id: "details", label: "Your details", hint: "Name and email", body: "Ana Ruiz, ana@example.com. We send a reminder the day before." },
    { id: "pay", label: "Payment", hint: "£45", body: "£45 paid at the studio on the day. Free to cancel up to 48 hours before." },
  ],
  doneTitle: "You're booked in",
  doneText: "See you on Saturday at 10:00. Wear something you don't mind getting muddy.",
};

export default function StepsProgress() {
  const d = SAMPLE;
  const [step, setStep] = useState(0);
  const [finished, setFinished] = useState(false);
  const panel = useRef<HTMLDivElement | null>(null);
  const last = d.steps.length - 1;

  const go = (i: number) => {
    setStep(i);
    // Bring keyboard and screen reader users to the new step's content.
    requestAnimationFrame(() => panel.current?.focus());
  };

  const state = (i: number) => (finished || i < step ? "done" : i === step ? "current" : "upcoming");
  const current = d.steps[step];

  return (
    <section className="fl-section" aria-labelledby="steps-progress-title">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="steps-progress-title" className="fl-title">
            {d.title}
          </h2>
        </div>

        <nav aria-label="Booking progress">
          <ol className="fl-way-steps">
            {d.steps.map((s, i) => {
              const st = state(i);
              const inner = (
                <>
                  <span className="fl-way-step__dot" aria-hidden="true">
                    {st === "done" ? <Icon name="check" /> : i + 1}
                  </span>
                  <span className="fl-way-step__text">
                    <span className="fl-way-step__label">{s.label}</span>
                    <span className="fl-way-step__hint">{s.hint}</span>
                  </span>
                  <span className="fl-sr">{st === "done" ? ", done" : st === "current" ? ", current step" : ", not started"}</span>
                </>
              );
              return (
                <li key={s.id} className="fl-way-step" data-state={st} aria-current={st === "current" ? "step" : undefined}>
                  {st === "done" && !finished ? (
                    <button type="button" className="fl-way-step__btn" onClick={() => go(i)}>
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

        <div ref={panel} className="fl-card fl-way-step-panel" tabIndex={-1}>
          {finished ? (
            <>
              <p className="fl-done" role="status">
                {d.doneTitle}
              </p>
              <p className="fl-text">{d.doneText}</p>
              <div className="fl-way-step-nav">
                <span className="fl-meta">All {d.steps.length} steps done</span>
                <button
                  type="button"
                  className="fl-btn fl-btn--secondary"
                  onClick={() => {
                    setFinished(false);
                    go(0);
                  }}
                >
                  Book another class
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="fl-meta">
                Step {step + 1} of {d.steps.length}
              </p>
              <h3>{current.label}</h3>
              <p className="fl-text">{current.body}</p>
              <div className="fl-way-step-nav">
                <button type="button" className="fl-btn fl-btn--secondary" disabled={step === 0} onClick={() => go(step - 1)} style={step === 0 ? { opacity: "var(--disabled-opacity)", cursor: "not-allowed" } : undefined}>
                  Back
                </button>
                {step < last ? (
                  <button type="button" className="fl-btn fl-btn--primary" onClick={() => go(step + 1)}>
                    Next: {d.steps[step + 1].label}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="fl-btn fl-btn--primary"
                    onClick={() => {
                      setFinished(true);
                      requestAnimationFrame(() => panel.current?.focus());
                    }}
                  >
                    Confirm booking
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
