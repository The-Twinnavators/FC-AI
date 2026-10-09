/** @flowcode-library nb-form · Neobrutal sign-up form (Neobrutalism kit)
 * Use cases: sign up form; club membership; waitlist form; class registration; event registration; application form; contact form
 * Jobs to be done: join a club or studio; register for a class; sign up for the waitlist; tell them about myself
 * Keywords: form, sign up, validation, radio, checkbox, select, neobrutalism
 */
/**
 * Neobrutalist sign-up form: text inputs, a select, a radio group, a textarea and a terms checkbox, with chunky
 * borders, inline errors and a success panel. Use it for joining a studio, a club or a waitlist. Make it the app's own:
 * replace SAMPLE with the real fields and options and send the values to the app's own sign-up step in onSubmit.
 */
import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Join the studio",
  title: "Get your first class free",
  lede: "Tell us a little about you and we will hold a seat at your first class.",
  studios: ["North Street studio", "Riverside studio", "Either is fine"],
  levels: ["Never tried", "A few classes", "I have my own wheel"],
  notesMax: 200,
  submit: "Create my account",
  success: {
    title: "You are in!",
    text: "We sent a welcome note to {email}. Your free class is waiting at {studio}.",
    again: "Sign up someone else",
  },
};

type Values = { name: string; email: string; password: string; studio: string; level: string; notes: string; terms: boolean };
type Errors = Partial<Record<keyof Values, string>>;

const EMPTY: Values = { name: "", email: "", password: "", studio: "", level: "", notes: "", terms: false };

function validate(v: Values, max: number): Errors {
  const e: Errors = {};
  if (!v.name.trim()) e.name = "Tell us your name.";
  if (!v.email.trim()) e.email = "Add your email so we can confirm the seat.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) e.email = "That email looks incomplete, like name@example.com.";
  if (v.password.length < 8) e.password = "Use at least 8 characters.";
  if (!v.studio) e.studio = "Pick a studio.";
  if (!v.level) e.level = "Choose how much you have done.";
  if (v.notes.length > max) e.notes = `Keep it under ${max} characters.`;
  if (!v.terms) e.terms = "Please accept the studio rules to continue.";
  return e;
}

function Err({ id, text }: { id: string; text?: string }) {
  if (!text) return null;
  return (
    <p id={id} className="fl-nb-err">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5M12 16.5v.01" />
      </svg>
      {text}
    </p>
  );
}

export default function NbForm() {
  const d = SAMPLE;
  const [v, setV] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [tried, setTried] = useState(false);
  const [done, setDone] = useState<Values | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    const next = { ...v, [key]: value };
    setV(next);
    if (tried) setErrors(validate(next, d.notesMax));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    const found = validate(v, d.notesMax);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      const el = formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`);
      el?.focus();
      return;
    }
    setDone(v);
    window.setTimeout(() => doneRef.current?.focus(), 0);
  }

  function reset() {
    setV(EMPTY);
    setErrors({});
    setTried(false);
    setDone(null);
  }

  const emailOk = tried && !errors.email && v.email.trim() !== "";
  const count = v.notes.length;
  const errCount = Object.keys(errors).length;

  return (
    <section className="fl-section fl-nb" aria-labelledby="nb-form-title">
      <div className="fl-wrap fl-wrap--narrow fl-nb-stack">
        <div className="fl-head">
          <p className="fl-nb-kicker">{d.eyebrow}</p>
          <h2 id="nb-form-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>

        {done ? (
          <div className="fl-nb-box fl-nb-done" role="status" aria-live="polite">
            <span className="fl-nb-tile fl-nb-tile--success">
              <Icon name="check" />
            </span>
            <h3 ref={doneRef} tabIndex={-1}>
              {d.success.title}
            </h3>
            <p>{d.success.text.replace("{email}", done.email.trim()).replace("{studio}", done.studio)}</p>
            <button type="button" className="fl-nb-btn fl-nb-btn--plain" onClick={reset}>
              {d.success.again}
            </button>
          </div>
        ) : (
          <form ref={formRef} className="fl-nb-box fl-nb-form" noValidate onSubmit={onSubmit}>
            <p className="fl-sr" role="status" aria-live="polite">
              {tried && errCount > 0 ? `${errCount} ${errCount === 1 ? "field needs" : "fields need"} attention.` : ""}
            </p>
            <div className="fl-nb-form__row">
              <div className="fl-nb-field">
                <label className="fl-nb-label" htmlFor="nb-form-name">
                  Full name
                </label>
                <input
                  id="nb-form-name"
                  name="name"
                  className="fl-nb-input"
                  autoComplete="name"
                  value={v.name}
                  onChange={(e) => set("name", e.target.value)}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? "nb-form-name-err" : undefined}
                />
                <Err id="nb-form-name-err" text={errors.name} />
              </div>
              <div className="fl-nb-field">
                <label className="fl-nb-label" htmlFor="nb-form-email">
                  Email
                </label>
                <input
                  id="nb-form-email"
                  name="email"
                  type="email"
                  className="fl-nb-input"
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={v.email}
                  onChange={(e) => set("email", e.target.value)}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "nb-form-email-err" : emailOk ? "nb-form-email-ok" : undefined}
                />
                <Err id="nb-form-email-err" text={errors.email} />
                {emailOk && (
                  <p id="nb-form-email-ok" className="fl-nb-err fl-nb-ok">
                    <Icon name="check" />
                    Looks good.
                  </p>
                )}
              </div>
            </div>

            <div className="fl-nb-form__row">
              <div className="fl-nb-field">
                <label className="fl-nb-label" htmlFor="nb-form-password">
                  Password
                </label>
                <input
                  id="nb-form-password"
                  name="password"
                  type="password"
                  className="fl-nb-input"
                  autoComplete="new-password"
                  value={v.password}
                  onChange={(e) => set("password", e.target.value)}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "nb-form-password-hint nb-form-password-err" : "nb-form-password-hint"}
                />
                <p id="nb-form-password-hint" className="fl-nb-hint">
                  At least 8 characters.
                </p>
                <Err id="nb-form-password-err" text={errors.password} />
              </div>
              <div className="fl-nb-field">
                <label className="fl-nb-label" htmlFor="nb-form-studio">
                  Studio
                </label>
                <select
                  id="nb-form-studio"
                  name="studio"
                  className="fl-nb-select"
                  value={v.studio}
                  onChange={(e) => set("studio", e.target.value)}
                  aria-invalid={!!errors.studio}
                  aria-describedby={errors.studio ? "nb-form-studio-err" : undefined}
                >
                  <option value="">Choose a studio</option>
                  {d.studios.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <Err id="nb-form-studio-err" text={errors.studio} />
              </div>
            </div>

            <fieldset
              className="fl-nb-fieldset"
              aria-invalid={!!errors.level}
              aria-describedby={errors.level ? "nb-form-level-err" : undefined}
            >
              <legend className="fl-nb-label">How much clay have you thrown?</legend>
              <div className="fl-nb-choices">
                {d.levels.map((l) => (
                  <label key={l} className="fl-nb-choice">
                    <input
                      type="radio"
                      name="level"
                      value={l}
                      checked={v.level === l}
                      onChange={() => set("level", l)}
                      aria-describedby={errors.level ? "nb-form-level-err" : undefined}
                    />
                    <span>{l}</span>
                  </label>
                ))}
              </div>
              <Err id="nb-form-level-err" text={errors.level} />
            </fieldset>

            <div className="fl-nb-field">
              <label className="fl-nb-label" htmlFor="nb-form-notes">
                Anything we should know? <span className="fl-meta">(optional)</span>
              </label>
              <textarea
                id="nb-form-notes"
                name="notes"
                className="fl-nb-textarea"
                value={v.notes}
                onChange={(e) => set("notes", e.target.value)}
                aria-invalid={!!errors.notes}
                aria-describedby={errors.notes ? "nb-form-notes-count nb-form-notes-err" : "nb-form-notes-count"}
              />
              <span id="nb-form-notes-count" className={`fl-nb-count${count > d.notesMax ? " fl-nb-count--over" : ""}`}>
                {count}/{d.notesMax}
              </span>
              <Err id="nb-form-notes-err" text={errors.notes} />
            </div>

            <div className="fl-nb-field">
              <label className="fl-nb-check">
                <input
                  type="checkbox"
                  name="terms"
                  checked={v.terms}
                  onChange={(e) => set("terms", e.target.checked)}
                  aria-invalid={!!errors.terms}
                  aria-describedby={errors.terms ? "nb-form-terms-err" : undefined}
                />
                <span>I have read the studio rules and agree to keep the wheels clean.</span>
              </label>
              <Err id="nb-form-terms-err" text={errors.terms} />
            </div>

            <button type="submit" className="fl-nb-btn fl-nb-btn--primary fl-nb-btn--block">
              {d.submit}
              <Icon name="arrow" />
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
