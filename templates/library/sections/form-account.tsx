/**
 * Form: create an account. Stacked fields for name, email and a password (show/hide and a strength hint) plus a terms
 * checkbox. Each field checks itself when you leave it and again on submit; errors sit under the field and the first
 * one gets focus. A success panel replaces the form. Nothing is sent: the details stay in memory. Use it for sign-up,
 * joining a studio or creating a household profile. Make it the app's own: replace SAMPLE's wording and rules, and
 * drop or add fields to match what the PRD asks people for.
 */
import { useRef, useState, type FormEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Join the studio",
  title: "Create your account",
  lede: "Book classes, keep your passes in one place and get reminders before each session.",
  fields: {
    name: { label: "Full name", placeholder: "Alex Morgan", required: "Tell us your name so the teacher knows who's coming." },
    email: { label: "Email", placeholder: "alex@example.com", hint: "We send booking confirmations here.", required: "Add your email address.", invalid: "That email looks incomplete. Check for an @ and a dot." },
    password: { label: "Password", hint: "At least 8 characters. Mix in a number or symbol to make it stronger.", required: "Choose a password.", short: "Use at least 8 characters." },
    terms: { label: "I agree to the booking terms and the cancellation policy (free up to 12 hours before a class).", required: "Please accept the terms to continue." },
  },
  strength: ["Too weak", "Weak", "Fair", "Good", "Strong"],
  submit: "Create account",
  signIn: "Already have an account?",
  signInLink: "Sign in",
  successTitle: "You're in",
  successText: "Your account is ready. We've sent a welcome note to",
  successAction: "Create another",
};

type Field = "name" | "email" | "password" | "terms";
type Values = { name: string; email: string; password: string; terms: boolean };
const EMPTY: Values = { name: "", email: "", password: "", terms: false };

function scorePassword(p: string) {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[0-9]/.test(p) && /[a-zA-Z]/.test(p)) s++;
  if (/[^a-zA-Z0-9]/.test(p) || (/[a-z]/.test(p) && /[A-Z]/.test(p))) s++;
  return Math.max(1, Math.min(4, s));
}

function ErrorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5h.01" />
    </svg>
  );
}

export default function FormAccount() {
  const d = SAMPLE;
  const f = d.fields;
  const [values, setValues] = useState<Values>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [showPass, setShowPass] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [doneEmail, setDoneEmail] = useState<string | null>(null);
  const refs = {
    name: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
    terms: useRef<HTMLInputElement>(null),
  };
  const successRef = useRef<HTMLHeadingElement>(null);

  const validate = (v: Values): Partial<Record<Field, string>> => {
    const e: Partial<Record<Field, string>> = {};
    if (!v.name.trim()) e.name = f.name.required;
    if (!v.email.trim()) e.email = f.email.required;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) e.email = f.email.invalid;
    if (!v.password) e.password = f.password.required;
    else if (v.password.length < 8) e.password = f.password.short;
    if (!v.terms) e.terms = f.terms.required;
    return e;
  };
  const errors = validate(values);
  const shown = (k: Field) => (touched[k] || submitted ? errors[k] : undefined);
  const level = scorePassword(values.password);

  const set = <K extends Field>(k: K, val: Values[K]) => setValues((v) => ({ ...v, [k]: val }));
  const blur = (k: Field) => setTouched((t) => ({ ...t, [k]: true }));

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    const order: Field[] = ["name", "email", "password", "terms"];
    const first = order.find((k) => errors[k]);
    if (first) {
      refs[first].current?.focus();
      return;
    }
    setDoneEmail(values.email.trim());
    requestAnimationFrame(() => successRef.current?.focus());
  };

  const reset = () => {
    setValues(EMPTY);
    setTouched({});
    setSubmitted(false);
    setShowPass(false);
    setDoneEmail(null);
    requestAnimationFrame(() => refs.name.current?.focus());
  };

  const errorCount = Object.keys(errors).length;
  const describe = (k: Field, hint?: boolean) => [hint ? `acct-${k}-hint` : "", shown(k) ? `acct-${k}-error` : ""].filter(Boolean).join(" ") || undefined;

  return (
    <section className="fl-section fl-section--tint" aria-labelledby="form-account-title">
      <div className="fl-wrap">
        <div className="fl-head fl-head--center">
          <span className="fl-eyebrow">{d.eyebrow}</span>
          <h2 id="form-account-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <div className="fl-card fl-frm-card" style={{ padding: "var(--space-7)" }}>
          {doneEmail ? (
            <div className="fl-frm-success" role="status">
              <span className="fl-icon">
                <Icon name="check" />
              </span>
              <h3 ref={successRef} tabIndex={-1}>
                {d.successTitle}
              </h3>
              <p className="fl-text">
                {d.successText} <strong style={{ color: "var(--color-text)" }}>{doneEmail}</strong>.
              </p>
              <button type="button" className="fl-btn fl-btn--secondary" onClick={reset}>
                {d.successAction}
              </button>
            </div>
          ) : (
            <form className="fl-form" onSubmit={submit} noValidate style={{ gap: "var(--space-5)" }}>
              {submitted && errorCount > 0 && (
                <p className="fl-frm-summary" role="alert">
                  {errorCount === 1 ? "One thing needs fixing before we can create your account." : `${errorCount} things need fixing before we can create your account.`}
                </p>
              )}

              <div className="fl-field">
                <label htmlFor="acct-name">{f.name.label}</label>
                <input
                  ref={refs.name}
                  id="acct-name"
                  className="fl-input"
                  autoComplete="name"
                  placeholder={f.name.placeholder}
                  value={values.name}
                  onChange={(e) => set("name", e.target.value)}
                  onBlur={() => blur("name")}
                  aria-invalid={shown("name") ? true : undefined}
                  aria-describedby={describe("name")}
                  required
                />
                {shown("name") && (
                  <p id="acct-name-error" className="fl-frm-error">
                    <ErrorIcon />
                    {shown("name")}
                  </p>
                )}
              </div>

              <div className="fl-field">
                <label htmlFor="acct-email">{f.email.label}</label>
                <input
                  ref={refs.email}
                  id="acct-email"
                  type="email"
                  className="fl-input"
                  autoComplete="email"
                  inputMode="email"
                  placeholder={f.email.placeholder}
                  value={values.email}
                  onChange={(e) => set("email", e.target.value)}
                  onBlur={() => blur("email")}
                  aria-invalid={shown("email") ? true : undefined}
                  aria-describedby={describe("email", true)}
                  required
                />
                {shown("email") ? (
                  <p id="acct-email-error" className="fl-frm-error">
                    <ErrorIcon />
                    {shown("email")}
                  </p>
                ) : (
                  <p id="acct-email-hint" className="fl-frm-hint">
                    {f.email.hint}
                  </p>
                )}
              </div>

              <div className="fl-field">
                <div className="fl-frm-label-row">
                  <label htmlFor="acct-password">{f.password.label}</label>
                  {values.password && (
                    <span className="fl-meta" id="acct-password-strength" aria-live="polite">
                      Strength: {d.strength[level]}
                    </span>
                  )}
                </div>
                <div className="fl-frm-pass">
                  <input
                    ref={refs.password}
                    id="acct-password"
                    type={showPass ? "text" : "password"}
                    className="fl-input"
                    autoComplete="new-password"
                    value={values.password}
                    onChange={(e) => set("password", e.target.value)}
                    onBlur={() => blur("password")}
                    aria-invalid={shown("password") ? true : undefined}
                    aria-describedby={[describe("password", true), values.password ? "acct-password-strength" : ""].filter(Boolean).join(" ")}
                    required
                  />
                  <button type="button" className="fl-frm-reveal" aria-controls="acct-password" aria-pressed={showPass} onClick={() => setShowPass((s) => !s)}>
                    {showPass ? "Hide" : "Show"}
                    <span className="fl-sr"> password</span>
                  </button>
                </div>
                <div className="fl-frm-strength" data-level={values.password ? level : 0} aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                {shown("password") && (
                  <p id="acct-password-error" className="fl-frm-error">
                    <ErrorIcon />
                    {shown("password")}
                  </p>
                )}
                <p id="acct-password-hint" className="fl-frm-hint">
                  {f.password.hint}
                </p>
              </div>

              <div className="fl-field">
                <label className="fl-frm-check" htmlFor="acct-terms" style={{ fontWeight: "var(--weight-regular)" }}>
                  <input
                    ref={refs.terms}
                    id="acct-terms"
                    type="checkbox"
                    checked={values.terms}
                    onChange={(e) => {
                      set("terms", e.target.checked);
                      blur("terms");
                    }}
                    aria-invalid={shown("terms") ? true : undefined}
                    aria-describedby={describe("terms")}
                  />
                  <span>{f.terms.label}</span>
                </label>
                {shown("terms") && (
                  <p id="acct-terms-error" className="fl-frm-error">
                    <ErrorIcon />
                    {shown("terms")}
                  </p>
                )}
              </div>

              <button type="submit" className="fl-btn fl-btn--primary fl-frm-full">
                {d.submit}
              </button>
              <p className="fl-note" style={{ margin: 0, textAlign: "center" }}>
                {d.signIn}{" "}
                <a className="fl-link" href="#sign-in">
                  {d.signInLink}
                </a>
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
