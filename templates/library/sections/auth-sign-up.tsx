/** @flowcode-library auth-sign-up · Sign up (Sign-in and sign-up)
 * Use cases: sign up; registration; create account; join form; member registration; onboarding start; account creation; new user signup
 * Jobs to be done: create an account for myself; join the service with my email; set a strong password; get started with a new account
 * Keywords: auth, sign up, register, form, password strength
 */
/**
 * Sign up: a create-account form with name, email and a password that shows its strength and a live checklist of the
 * rules, plus a terms checkbox. Errors appear under each field when the form is sent; success shows a "check your
 * email" confirmation. Use it as the app's registration route. Nothing is sent: the account is kept in local storage.
 * Make it the app's own: replace SAMPLE with the app's name, rules and terms link, and swap the storage for its real
 * sign-up call.
 */
import { useId, useState, type FormEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  brand: "Kiln & Co. Studio",
  title: "Create your account",
  lede: "Book classes, keep track of your kiln firings and get reminders before each session.",
  takenEmails: ["sam@example.com"],
  rules: [
    { id: "length", label: "At least 10 characters" },
    { id: "number", label: "A number" },
    { id: "case", label: "Upper and lower case" },
    { id: "symbol", label: "A symbol, like ! or #" },
  ],
  strengthLabels: ["Too weak", "Weak", "Fair", "Good", "Strong"],
  termsHref: "#terms",
  privacyHref: "#privacy",
  signInHref: "#sign-in",
  storageKey: "studio-accounts",
};

type Field = "name" | "email" | "password" | "terms";
type Errors = Partial<Record<Field, string>>;

const CHECKS: Record<string, (p: string) => boolean> = {
  length: (p) => p.length >= 10,
  number: (p) => /\d/.test(p),
  case: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p),
  symbol: (p) => /[^A-Za-z0-9]/.test(p),
};

function Alert() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v5M12 16.5v.01" />
    </svg>
  );
}

function Dot() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <circle cx="12" cy="12" r="7" />
    </svg>
  );
}

export default function AuthSignUp() {
  const d = SAMPLE;
  const id = useId();
  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const [terms, setTerms] = useState(false);
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "busy" | "done">("idle");

  const met = d.rules.map((r) => (CHECKS[r.id] ? CHECKS[r.id](values.password) : false));
  const score = met.filter(Boolean).length;
  const level = values.password ? Math.max(1, score) : 0;

  const set = (field: "name" | "email" | "password", value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next: Errors = {};
    const email = values.email.trim().toLowerCase();
    if (!values.name.trim()) next.name = "Enter your name so we know who's booking.";
    if (!email) next.email = "Enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "That doesn't look like an email address.";
    else if (d.takenEmails.includes(email)) next.email = "There's already an account with this email. Sign in instead.";
    if (!values.password) next.password = "Choose a password.";
    else if (score < d.rules.length) next.password = "Your password needs to meet every rule below.";
    if (!terms) next.terms = "Agree to the terms to create your account.";
    setErrors(next);
    const first = (["name", "email", "password", "terms"] as Field[]).find((f) => next[f]);
    if (first) {
      document.getElementById(`${id}-${first}`)?.focus();
      return;
    }
    setStatus("busy");
    window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(d.storageKey) ?? "[]") as unknown[];
        localStorage.setItem(d.storageKey, JSON.stringify([...saved, { name: values.name.trim(), email, at: new Date().toISOString() }]));
      } catch {
        /* storage unavailable: the confirmation still shows */
      }
      setStatus("done");
    }, 900);
  };

  const errorText = (field: Field) =>
    errors[field] ? (
      <p id={`${id}-${field}-err`} className="fl-auth-error">
        <Alert />
        {errors[field]}
      </p>
    ) : null;
  const a11y = (field: Field, extra?: string) => ({
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": [errors[field] ? `${id}-${field}-err` : "", extra ?? ""].filter(Boolean).join(" ") || undefined,
  });

  const busy = status === "busy";
  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <section className="fl-section fl-section--tint fl-auth" aria-labelledby={`${id}-title`}>
      <div className="fl-card fl-auth-card" style={{ maxWidth: "30rem" }}>
        {status === "done" ? (
          <div className="fl-auth-done fl-auth-done--mail" role="status">
            <span className="fl-auth-done__icon">
              <Icon name="mail" />
            </span>
            <h2 id={`${id}-title`}>Welcome, {values.name.trim().split(" ")[0]}</h2>
            <p>
              Your account is ready. We sent a confirmation link to <strong>{values.email.trim()}</strong>; open it to
              turn on booking reminders.
            </p>
            <a className="fl-btn fl-btn--primary" href={d.signInHref}>
              Go to sign in
            </a>
          </div>
        ) : (
          <>
            <span className="fl-auth-brand">
              <span className="fl-auth-brand__mark">
                <Icon name="layers" />
              </span>
              {d.brand}
            </span>
            <div className="fl-auth-head">
              <h1 id={`${id}-title`}>{d.title}</h1>
              <p>{d.lede}</p>
            </div>

            <div aria-live="polite">
              {errorCount > 1 && (
                <p className="fl-auth-alert">
                  {errorCount} things need fixing before we can create your account.
                </p>
              )}
            </div>

            <form className="fl-form" onSubmit={submit} noValidate>
              <div className="fl-field">
                <label htmlFor={`${id}-name`}>Full name</label>
                <input id={`${id}-name`} className="fl-input" autoComplete="name" value={values.name} disabled={busy} onChange={(e) => set("name", e.target.value)} {...a11y("name")} />
                {errorText("name")}
              </div>

              <div className="fl-field">
                <label htmlFor={`${id}-email`}>Email</label>
                <input id={`${id}-email`} type="email" className="fl-input" autoComplete="email" value={values.email} disabled={busy} onChange={(e) => set("email", e.target.value)} {...a11y("email")} />
                {errorText("email")}
              </div>

              <div className="fl-field">
                <label htmlFor={`${id}-password`}>Password</label>
                <div className="fl-auth-pass">
                  <input
                    id={`${id}-password`}
                    type={show ? "text" : "password"}
                    className="fl-input"
                    autoComplete="new-password"
                    value={values.password}
                    disabled={busy}
                    onChange={(e) => set("password", e.target.value)}
                    {...a11y("password", `${id}-strength ${id}-rules`)}
                  />
                  <button type="button" className="fl-auth-reveal" onClick={() => setShow((s) => !s)} aria-pressed={show} aria-controls={`${id}-password`}>
                    {show ? "Hide" : "Show"}
                    <span className="fl-sr"> password</span>
                  </button>
                </div>
                {errorText("password")}
                <div className="fl-auth-meter" data-level={level}>
                  <div className="fl-auth-meter__bars" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <p className="fl-auth-meter__label" id={`${id}-strength`} aria-live="polite">
                    Strength: <strong>{values.password ? d.strengthLabels[score] : "not set"}</strong>
                  </p>
                </div>
                <ul className="fl-auth-rules" id={`${id}-rules`} aria-label="Password rules">
                  {d.rules.map((r, i) => (
                    <li key={r.id} data-met={met[i]}>
                      {met[i] ? <Icon name="check" /> : <Dot />}
                      <span>
                        {r.label}
                        <span className="fl-sr">{met[i] ? " (done)" : " (not yet)"}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="fl-field">
                <label className="fl-auth-check" style={{ fontWeight: "var(--weight-regular)" }}>
                  <input
                    id={`${id}-terms`}
                    type="checkbox"
                    checked={terms}
                    disabled={busy}
                    onChange={(e) => {
                      setTerms(e.target.checked);
                      if (errors.terms) setErrors((x) => ({ ...x, terms: undefined }));
                    }}
                    {...a11y("terms")}
                  />
                  <span>
                    I agree to the{" "}
                    <a className="fl-link" href={d.termsHref}>
                      studio terms
                    </a>{" "}
                    and{" "}
                    <a className="fl-link" href={d.privacyHref}>
                      privacy notice
                    </a>
                    .
                  </span>
                </label>
                {errorText("terms")}
              </div>

              <button type="submit" className="fl-btn fl-btn--primary fl-auth-full" disabled={busy} aria-busy={busy}>
                {busy && <span className="fl-auth-spin" aria-hidden="true" />}
                {busy ? "Creating your account…" : "Create account"}
              </button>
            </form>

            <p className="fl-auth-foot">
              Already have an account?{" "}
              <a className="fl-link" href={d.signInHref}>
                Sign in
              </a>
            </p>
          </>
        )}
      </div>
    </section>
  );
}
