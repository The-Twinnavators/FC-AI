/** @flowcode-library auth-sign-in · Sign in (Sign-in and sign-up)
 * Use cases: sign in; login; member login; account access; customer portal login; admin login; returning user
 * Jobs to be done: sign in to my account; reset a forgotten password; stay signed in on my device; continue with another account
 * Keywords: auth, sign in, login, form, password
 */
/**
 * Sign in: email and password with show/hide, "remember me", a forgot-password link, inline errors, a "signing in"
 * state and a welcome-back confirmation. Optional "continue with" buttons are plain text, no logos. Use it as the
 * app's sign-in route. Nothing is sent: the sample account in SAMPLE is checked in memory. Make it the app's own:
 * replace SAMPLE with the app's name and copy, and swap the in-memory check for the app's real sign-in call.
 */
import { useId, useRef, useState, type FormEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  brand: "Kiln & Co. Studio",
  title: "Welcome back",
  lede: "Sign in to see your classes and open-studio bookings.",
  demo: { email: "sam@example.com", password: "glaze-2024" },
  alternatives: ["Continue with email link", "Continue with passkey"],
  forgotHref: "#forgot-password",
  signUpHref: "#sign-up",
  rememberKey: "studio-remembered-email",
};

type Errors = { email?: string; password?: string; form?: string };

function Alert() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v5M12 16.5v.01" />
    </svg>
  );
}

function readRemembered(key: string) {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

export default function AuthSignIn() {
  const d = SAMPLE;
  const id = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState(() => readRemembered(d.rememberKey));
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(() => readRemembered(d.rememberKey) !== "");
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "busy" | "done">("idle");
  const [note, setNote] = useState("");

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next: Errors = {};
    const value = email.trim();
    if (!value) next.email = "Enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) next.email = "That doesn't look like an email address. Check for a missing @ or dot.";
    if (!password) next.password = "Enter your password.";
    setErrors(next);
    setNote("");
    if (next.email) return emailRef.current?.focus();
    if (next.password) return passRef.current?.focus();

    setStatus("busy");
    window.setTimeout(() => {
      if (value.toLowerCase() !== d.demo.email || password !== d.demo.password) {
        setStatus("idle");
        setErrors({ form: "That email and password don't match an account. Check them and try again, or reset your password." });
        passRef.current?.focus();
        return;
      }
      try {
        if (remember) localStorage.setItem(d.rememberKey, value);
        else localStorage.removeItem(d.rememberKey);
      } catch {
        /* storage unavailable: signing in still works */
      }
      setStatus("done");
    }, 1100);
  };

  const busy = status === "busy";

  return (
    <section className="fl-section fl-section--tint fl-auth" aria-labelledby={`${id}-title`}>
      <div className="fl-card fl-auth-card">
        {status === "done" ? (
          <div className="fl-auth-done" role="status">
            <span className="fl-auth-done__icon">
              <Icon name="check" />
            </span>
            <h2 id={`${id}-title`}>You're signed in</h2>
            <p>Good to see you again. Taking you to your bookings…</p>
            <button
              type="button"
              className="fl-btn fl-btn--secondary"
              onClick={() => {
                setStatus("idle");
                setPassword("");
              }}
            >
              Sign out
            </button>
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

            <div aria-live="assertive">
              {errors.form && (
                <p className="fl-auth-alert" id={`${id}-form-err`}>
                  {errors.form}
                </p>
              )}
            </div>

            <form className="fl-form" onSubmit={submit} noValidate aria-describedby={errors.form ? `${id}-form-err` : undefined}>
              <div className="fl-field">
                <label htmlFor={`${id}-email`}>Email</label>
                <input
                  ref={emailRef}
                  id={`${id}-email`}
                  type="email"
                  className="fl-input"
                  autoComplete="email"
                  value={email}
                  disabled={busy}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email || errors.form) setErrors({ ...errors, email: undefined, form: undefined });
                  }}
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={errors.email ? `${id}-email-err` : undefined}
                />
                {errors.email && (
                  <p id={`${id}-email-err`} className="fl-auth-error">
                    <Alert />
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="fl-field">
                <div className="fl-auth-row">
                  <label htmlFor={`${id}-pass`}>Password</label>
                  <a className="fl-link" href={d.forgotHref}>
                    Forgot password?
                  </a>
                </div>
                <div className="fl-auth-pass">
                  <input
                    ref={passRef}
                    id={`${id}-pass`}
                    type={show ? "text" : "password"}
                    className="fl-input"
                    autoComplete="current-password"
                    value={password}
                    disabled={busy}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password || errors.form) setErrors({ ...errors, password: undefined, form: undefined });
                    }}
                    aria-invalid={errors.password || errors.form ? true : undefined}
                    aria-describedby={errors.password ? `${id}-pass-err` : undefined}
                  />
                  <button type="button" className="fl-auth-reveal" onClick={() => setShow((s) => !s)} aria-pressed={show} aria-controls={`${id}-pass`}>
                    {show ? "Hide" : "Show"}
                    <span className="fl-sr"> password</span>
                  </button>
                </div>
                {errors.password && (
                  <p id={`${id}-pass-err`} className="fl-auth-error">
                    <Alert />
                    {errors.password}
                  </p>
                )}
              </div>

              <label className="fl-auth-check">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} disabled={busy} />
                Remember my email on this device
              </label>

              <button type="submit" className={`fl-btn fl-btn--primary fl-auth-full${busy ? " fl-auth-btn-busy" : ""}`} disabled={busy} aria-busy={busy}>
                {busy && <span className="fl-auth-spin" aria-hidden="true" />}
                {busy ? "Signing in…" : "Sign in"}
              </button>
              <p className="fl-sr" aria-live="polite">
                {busy ? "Signing in, please wait." : ""}
              </p>
            </form>

            {d.alternatives.length > 0 && (
              <>
                <p className="fl-auth-divider">or</p>
                <div className="fl-auth-alt">
                  {d.alternatives.map((label) => (
                    <button key={label} type="button" className="fl-btn fl-btn--secondary" disabled={busy} onClick={() => setNote(`“${label}” isn't set up in this prototype yet.`)}>
                      {label}
                    </button>
                  ))}
                </div>
                <p className="fl-note" aria-live="polite" style={{ margin: 0, textAlign: "center" }}>
                  {note}
                </p>
              </>
            )}

            <p className="fl-auth-foot">
              New to the studio?{" "}
              <a className="fl-link" href={d.signUpHref}>
                Create an account
              </a>
            </p>
            <p className="fl-auth-foot" style={{ fontSize: "var(--text-xs)" }}>
              Prototype: sign in with {d.demo.email} / {d.demo.password}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
