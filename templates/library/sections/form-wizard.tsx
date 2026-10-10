/** @flowcode-library form-wizard · Multi-step form (Forms)
 * Use cases: onboarding flow; checkout steps; booking flow; application form; setup wizard; registration steps; quote request; survey
 * Jobs to be done: complete a long form step by step; review my answers before submitting; set up my account; apply without getting lost
 * Keywords: form, wizard, steps, multi-step, review
 */
/**
 * Form: three-step wizard. Details, then preferences, then a review of everything with an edit link per answer and a
 * final confirm. A step indicator shows where you are; Next checks only the current step and Back keeps what you
 * typed. The booking is kept in memory; nothing is sent. Use it when one long form would put people off: a booking,
 * an order, an onboarding. Make it the app's own: replace SAMPLE's steps, fields and choices, and keep three to five
 * steps.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Book a workshop",
  title: "Weekend pottery workshop",
  lede: "Three quick steps. We hold your place while you finish.",
  steps: ["Your details", "Preferences", "Review"],
  dates: [
    { value: "sat-14", label: "Saturday 14 June, 10:00 – 13:00" },
    { value: "sun-15", label: "Sunday 15 June, 14:00 – 17:00" },
    { value: "sat-21", label: "Saturday 21 June, 10:00 – 13:00" },
  ],
  levels: [
    { value: "new", label: "New to clay", hint: "We start with hand-building and center the wheel together." },
    { value: "some", label: "Done a class or two", hint: "Straight onto the wheel with a little guidance." },
    { value: "regular", label: "Regular potter", hint: "Bring a project; the teacher helps where you need it." },
  ],
  extras: [
    { value: "glaze", label: "Glazing session (+$15)" },
    { value: "apron", label: "Borrow an apron (free)" },
  ],
  confirm: "Confirm booking",
  successTitle: "Your place is booked",
  successText: "A confirmation is on its way to",
};

type Data = { name: string; email: string; guests: string; date: string; level: string; extras: string[]; notes: string };
const EMPTY: Data = { name: "", email: "", guests: "1", date: "", level: "", extras: [], notes: "" };
type Errors = Partial<Record<keyof Data, string>>;

function check(step: number, v: Data): Errors {
  const e: Errors = {};
  if (step === 0) {
    if (!v.name.trim()) e.name = "Add the name the booking is under.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) e.email = "Enter a full email address so we can confirm.";
    const g = Number(v.guests);
    if (!Number.isInteger(g) || g < 1 || g > 6) e.guests = "Between 1 and 6 people per booking.";
  }
  if (step === 1) {
    if (!v.date) e.date = "Pick a date that suits you.";
    if (!v.level) e.level = "Choose your experience so we can plan the session.";
  }
  return e;
}

function ErrorText({ id, children }: { id: string; children?: string }) {
  if (!children) return null;
  return (
    <p id={id} className="fl-frm-error">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5M12 16.5h.01" />
      </svg>
      {children}
    </p>
  );
}

export default function FormWizard() {
  const d = SAMPLE;
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Data>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [done, setDone] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step, done]);

  const set = <K extends keyof Data>(k: K, v: Data[K]) => {
    setData((s) => ({ ...s, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const next = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step === 2) {
      setDone(true);
      return;
    }
    const found = check(step, data);
    setErrors(found);
    const firstBad = Object.keys(found)[0];
    if (firstBad) {
      const el = document.getElementById(`wiz-${firstBad}`) ?? document.querySelector<HTMLElement>(`[name="wiz-${firstBad}"]`);
      el?.focus();
      return;
    }
    setStep((s) => s + 1);
  };
  const back = () => {
    setErrors({});
    setStep((s) => Math.max(0, s - 1));
  };
  const restart = () => {
    setData(EMPTY);
    setErrors({});
    setStep(0);
    setDone(false);
  };

  const dateLabel = d.dates.find((x) => x.value === data.date)?.label ?? "";
  const levelLabel = d.levels.find((x) => x.value === data.level)?.label ?? "";
  const extrasLabel = d.extras.filter((x) => data.extras.includes(x.value)).map((x) => x.label).join(", ") || "None";
  const review: { label: string; value: string; step: number }[] = [
    { label: "Name", value: data.name, step: 0 },
    { label: "Email", value: data.email, step: 0 },
    { label: "People", value: data.guests, step: 0 },
    { label: "Date", value: dateLabel, step: 1 },
    { label: "Experience", value: levelLabel, step: 1 },
    { label: "Extras", value: extrasLabel, step: 1 },
    { label: "Notes", value: data.notes.trim() || "None", step: 1 },
  ];
  const errCount = Object.values(errors).filter(Boolean).length;

  return (
    <section className="fl-section fl-section--tint" aria-labelledby="form-wizard-title">
      <div className="fl-wrap">
        <div className="fl-head fl-head--center">
          <span className="fl-eyebrow">{d.eyebrow}</span>
          <h2 id="form-wizard-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>

        <div className="fl-card fl-frm-card fl-frm-card--wide" style={{ padding: "var(--space-7)" }}>
          {done ? (
            <div className="fl-frm-success" role="status">
              <span className="fl-icon">
                <Icon name="check" />
              </span>
              <h3 ref={headingRef} tabIndex={-1}>
                {d.successTitle}
              </h3>
              <p className="fl-text">
                {dateLabel}, for {data.guests} {data.guests === "1" ? "person" : "people"}. {d.successText} <strong style={{ color: "var(--color-text)" }}>{data.email}</strong>.
              </p>
              <button type="button" className="fl-btn fl-btn--secondary" onClick={restart}>
                Book another
              </button>
            </div>
          ) : (
            <>
              <ol className="fl-frm-steps" aria-label="Booking steps">
                {d.steps.map((s, i) => (
                  <li key={s} data-state={i < step ? "done" : i === step ? "current" : "todo"} aria-current={i === step ? "step" : undefined}>
                    <span className="fl-frm-step-num">Step {i + 1}</span>
                    <span className="fl-frm-step-title">
                      {i < step && <Icon name="check" />}
                      {s}
                      {i < step && <span className="fl-sr">(done)</span>}
                    </span>
                  </li>
                ))}
              </ol>

              <form className="fl-form" onSubmit={next} noValidate style={{ gap: "var(--space-5)" }}>
                <div className="fl-frm-pane">
                  <h3 ref={headingRef} tabIndex={-1}>
                    <span className="fl-sr">
                      Step {step + 1} of {d.steps.length}:{" "}
                    </span>
                    {d.steps[step]}
                  </h3>
                  {errCount > 0 && (
                    <p className="fl-frm-summary" role="alert">
                      {errCount === 1 ? "One answer needs a look before you continue." : `${errCount} answers need a look before you continue.`}
                    </p>
                  )}

                  {step === 0 && (
                    <>
                      <div className="fl-field">
                        <label htmlFor="wiz-name">Full name</label>
                        <input id="wiz-name" className="fl-input" autoComplete="name" value={data.name} onChange={(e) => set("name", e.target.value)} aria-invalid={errors.name ? true : undefined} aria-describedby={errors.name ? "wiz-name-error" : undefined} />
                        <ErrorText id="wiz-name-error">{errors.name}</ErrorText>
                      </div>
                      <div className="fl-grid fl-grid--2" style={{ gap: "var(--space-4)" }}>
                        <div className="fl-field">
                          <label htmlFor="wiz-email">Email</label>
                          <input id="wiz-email" type="email" className="fl-input" autoComplete="email" value={data.email} onChange={(e) => set("email", e.target.value)} aria-invalid={errors.email ? true : undefined} aria-describedby={errors.email ? "wiz-email-error" : undefined} />
                          <ErrorText id="wiz-email-error">{errors.email}</ErrorText>
                        </div>
                        <div className="fl-field">
                          <label htmlFor="wiz-guests">People</label>
                          <input id="wiz-guests" type="number" inputMode="numeric" min={1} max={6} className="fl-input" value={data.guests} onChange={(e) => set("guests", e.target.value)} aria-invalid={errors.guests ? true : undefined} aria-describedby={errors.guests ? "wiz-guests-error" : "wiz-guests-hint"} />
                          {errors.guests ? <ErrorText id="wiz-guests-error">{errors.guests}</ErrorText> : <p id="wiz-guests-hint" className="fl-frm-hint">Up to 6</p>}
                        </div>
                      </div>
                    </>
                  )}

                  {step === 1 && (
                    <>
                      <div className="fl-field">
                        <label htmlFor="wiz-date">Date</label>
                        <span className="fl-frm-select">
                          <select id="wiz-date" className="fl-input" value={data.date} onChange={(e) => set("date", e.target.value)} aria-invalid={errors.date ? true : undefined} aria-describedby={errors.date ? "wiz-date-error" : undefined}>
                            <option value="">Choose a date</option>
                            {d.dates.map((x) => (
                              <option key={x.value} value={x.value}>
                                {x.label}
                              </option>
                            ))}
                          </select>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </span>
                        <ErrorText id="wiz-date-error">{errors.date}</ErrorText>
                      </div>
                      <fieldset className="fl-frm-choices" aria-describedby={errors.level ? "wiz-level-error" : undefined}>
                        <legend>Your experience</legend>
                        {d.levels.map((x) => (
                          <label key={x.value} className="fl-frm-option">
                            <input type="radio" name="wiz-level" value={x.value} checked={data.level === x.value} onChange={() => set("level", x.value)} aria-invalid={errors.level ? true : undefined} />
                            <span>
                              <strong>{x.label}</strong>
                              <span>{x.hint}</span>
                            </span>
                          </label>
                        ))}
                        <ErrorText id="wiz-level-error">{errors.level}</ErrorText>
                      </fieldset>
                      <fieldset className="fl-frm-choices">
                        <legend>
                          Extras <span className="fl-meta">(optional)</span>
                        </legend>
                        {d.extras.map((x) => (
                          <label key={x.value} className="fl-frm-check">
                            <input
                              type="checkbox"
                              checked={data.extras.includes(x.value)}
                              onChange={(e) => set("extras", e.target.checked ? [...data.extras, x.value] : data.extras.filter((v) => v !== x.value))}
                            />
                            <span>{x.label}</span>
                          </label>
                        ))}
                      </fieldset>
                      <div className="fl-field">
                        <label htmlFor="wiz-notes">
                          Anything we should know? <span className="fl-meta">(optional)</span>
                        </label>
                        <textarea id="wiz-notes" className="fl-input" style={{ minHeight: "5rem" }} value={data.notes} onChange={(e) => set("notes", e.target.value)} />
                      </div>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <p className="fl-text">Check the details below. You can change anything before you confirm.</p>
                      <dl className="fl-frm-review">
                        {review.map((r) => (
                          <div key={r.label}>
                            <dt>{r.label}</dt>
                            <dd>{r.value}</dd>
                            <button type="button" className="fl-frm-edit" onClick={() => setStep(r.step)}>
                              Edit<span className="fl-sr"> {r.label.toLowerCase()}</span>
                            </button>
                          </div>
                        ))}
                      </dl>
                    </>
                  )}
                </div>

                <div className="fl-frm-nav">
                  {step > 0 && (
                    <button type="button" className="fl-btn fl-btn--secondary" onClick={back}>
                      Back
                    </button>
                  )}
                  <button type="submit" className="fl-btn fl-btn--primary">
                    {step === 2 ? d.confirm : `Next: ${d.steps[step + 1]}`}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
