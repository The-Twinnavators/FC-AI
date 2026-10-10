/** @flowcode-library auth-split · Sign in, split (Sign-in and sign-up)
 * Use cases: sign in; login; member login; customer portal login; branded login; account access; returning user login
 * Jobs to be done: sign in to my account; get back to my saved work; access my member area; log in with my email and password
 * Keywords: auth, sign in, login, split, quote
 */
/**
 * Sign in, split: the sign-in form beside a picture panel drawn from the theme's accent (a soft gradient with a short
 * quote from a member). On phones the picture becomes a short banner above the form. Use it when the sign-in page
 * should also sell the place a little. Nothing is sent: the sample account in SAMPLE is checked in memory. Make it
 * the app's own: replace SAMPLE with the app's copy and a real member quote, and swap the check for its sign-in call.
 */
import { useId, useRef, useState, type FormEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  brand: "Kiln & Co. Studio",
  title: "Sign in to your studio",
  lede: "Your classes, shelf space and firing queue in one place.",
  demo: { email: "sam@example.com", password: "glaze-2024" },
  tag: "Open studio · Tue to Sun",
  quote: "I booked one Saturday taster and somehow I now have a shelf, a favorite wheel and twelve slightly wonky mugs.",
  person: { initials: "RO", name: "Rosa Okafor", role: "Member since spring" },
  forgotHref: "#forgot-password",
  signUpHref: "#sign-up",
};

type Errors = { email?: string; password?: string; form?: string };

function Alert() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v5M12 16.5v.01" />
    </svg>
  );
}

export default function AuthSplit() {
  const d = SAMPLE;
  const id = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "busy" | "done">("idle");

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next: Errors = {};
    const value = email.trim();
    if (!value) next.email = "Enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) next.email = "That doesn't look like an email address.";
    if (!password) next.password = "Enter your password.";
    setErrors(next);
    if (next.email) {
      emailRef.current?.focus();
      return;
    }
    if (next.password) {
      passRef.current?.focus();
      return;
    }
    setStatus("busy");
    window.setTimeout(() => {
      if (value.toLowerCase() === d.demo.email && password === d.demo.password) {
        setStatus("done");
      } else {
        setStatus("idle");
        setErrors({ form: "Wrong email or password. Try again, or reset your password." });
        passRef.current?.focus();
      }
    }, 1000);
  };

  const busy = status === "busy";

  return (
    <section className="fl-section" aria-labelledby={`${id}-title`}>
      <div className="fl-wrap fl-auth-split">
        <div className="fl-auth-split__form">
          {status === "done" ? (
            <div className="fl-auth-done" role="status">
              <span className="fl-auth-done__icon">
                <Icon name="check" />
              </span>
              <h2 id={`${id}-title`}>Signed in</h2>
              <p>Welcome back. Your next class is on the timetable.</p>
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
                {errors.form && <p className="fl-auth-alert">{errors.form}</p>}
              </div>
              <form className="fl-form" onSubmit={submit} noValidate>
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
                      setErrors((x) => ({ ...x, email: undefined, form: undefined }));
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
                        setErrors((x) => ({ ...x, password: undefined, form: undefined }));
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
                <button type="submit" className="fl-btn fl-btn--primary fl-auth-full" disabled={busy} aria-busy={busy}>
                  {busy && <span className="fl-auth-spin" aria-hidden="true" />}
                  {busy ? "Signing in…" : "Sign in"}
                </button>
                <p className="fl-sr" aria-live="polite">
                  {busy ? "Signing in, please wait." : ""}
                </p>
              </form>
              <p className="fl-auth-foot">
                No account yet?{" "}
                <a className="fl-link" href={d.signUpHref}>
                  Join the studio
                </a>
              </p>
              <p className="fl-auth-foot" style={{ fontSize: "var(--text-xs)" }}>
                Prototype: sign in with {d.demo.email} / {d.demo.password}
              </p>
            </>
          )}
        </div>

        <figure className="fl-auth-split__picture" style={{ margin: 0 }}>
          <span className="fl-auth-split__tag">{d.tag}</span>
          <blockquote className="fl-auth-split__quote" style={{ margin: 0 }}>
            “{d.quote}”
          </blockquote>
          <figcaption className="fl-auth-split__who">
            <span aria-hidden="true">{d.person.initials}</span>
            <span>
              <strong>{d.person.name}</strong>
              <small>{d.person.role}</small>
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
