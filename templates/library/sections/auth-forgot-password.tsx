/**
 * Forgot password: ask for an email, then show a "check your email" screen with what to do next and a resend button
 * that waits out a short cooldown. Use it as the route behind "Forgot password?". Nothing is sent: the "link" is only
 * pretended. Make it the app's own: replace SAMPLE with the app's copy and cooldown, and call its real reset endpoint.
 */
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  brand: "Kiln & Co. Studio",
  title: "Reset your password",
  lede: "Enter the email you signed up with and we'll send you a link to choose a new password.",
  cooldownSeconds: 30,
  linkValidMinutes: 30,
  signInHref: "#sign-in",
  helpHref: "#help",
};

function Alert() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v5M12 16.5v.01" />
    </svg>
  );
}

export default function AuthForgotPassword() {
  const d = SAMPLE;
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [stage, setStage] = useState<"ask" | "busy" | "sent">("ask");
  const [cooldown, setCooldown] = useState(0);
  const [sends, setSends] = useState(0);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (stage === "sent") headingRef.current?.focus();
  }, [stage]);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) setError("Enter your email address.");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) setError("That doesn't look like an email address. Check for a missing @ or dot.");
    else {
      setError("");
      setStage("busy");
      window.setTimeout(() => {
        setStage("sent");
        setSends(1);
        setCooldown(d.cooldownSeconds);
      }, 900);
      return;
    }
    inputRef.current?.focus();
  };

  const resend = () => {
    if (cooldown > 0) return;
    setSends((n) => n + 1);
    setCooldown(d.cooldownSeconds);
    setStatus(`We sent another link to ${email.trim()}.`);
  };

  return (
    <section className="fl-section fl-section--tint fl-auth" aria-labelledby={`${id}-title`}>
      <div className="fl-card fl-auth-card">
        {stage === "sent" ? (
          <div className="fl-auth-done fl-auth-done--mail">
            <span className="fl-auth-done__icon">
              <Icon name="mail" />
            </span>
            <h2 id={`${id}-title`} ref={headingRef} tabIndex={-1} style={{ outline: "none" }}>
              Check your email
            </h2>
            <p>If there's an account for this address, a reset link is on its way to</p>
            <p className="fl-auth-mailbox">{email.trim()}</p>
            <ol className="fl-auth-steps">
              <li>Open the email from {d.brand}. It can take a minute to arrive.</li>
              <li>Select “Choose a new password”. The link works for {d.linkValidMinutes} minutes.</li>
              <li>Not there? Look in spam or promotions.</li>
            </ol>
            <div className="fl-actions" style={{ justifyContent: "center" }}>
              <button type="button" className="fl-btn fl-btn--primary" onClick={resend} disabled={cooldown > 0} aria-describedby={`${id}-timer`}>
                Resend link
              </button>
              <button
                type="button"
                className="fl-btn fl-btn--secondary"
                onClick={() => {
                  setStage("ask");
                  setStatus("");
                  window.setTimeout(() => inputRef.current?.focus(), 0);
                }}
              >
                Use a different email
              </button>
            </div>
            <p className="fl-note" id={`${id}-timer`} style={{ margin: 0 }}>
              {cooldown > 0 ? (
                <>
                  You can resend in <span className="fl-auth-timer">{Math.floor(cooldown / 60)}:{String(cooldown % 60).padStart(2, "0")}</span>
                </>
              ) : (
                "Didn't get it? You can resend now."
              )}
            </p>
            <div role="status" style={{ width: "100%" }}>
              {status && (
                <p className="fl-done" style={{ margin: 0 }}>
                  {status} {sends > 2 ? "Still nothing? Contact us and we'll help." : ""}
                </p>
              )}
            </div>
            <a className="fl-link" href={d.signInHref}>
              Back to sign in
            </a>
          </div>
        ) : (
          <>
            <span className="fl-auth-brand">
              <span className="fl-auth-brand__mark">
                <Icon name="lock" />
              </span>
              {d.brand}
            </span>
            <div className="fl-auth-head">
              <h1 id={`${id}-title`}>{d.title}</h1>
              <p>{d.lede}</p>
            </div>
            <form className="fl-form" onSubmit={submit} noValidate>
              <div className="fl-field">
                <label htmlFor={`${id}-email`}>Email</label>
                <input
                  ref={inputRef}
                  id={`${id}-email`}
                  type="email"
                  className="fl-input"
                  autoComplete="email"
                  value={email}
                  disabled={stage === "busy"}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError("");
                  }}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `${id}-err` : undefined}
                />
                {error && (
                  <p id={`${id}-err`} className="fl-auth-error">
                    <Alert />
                    {error}
                  </p>
                )}
              </div>
              <button type="submit" className="fl-btn fl-btn--primary fl-auth-full" disabled={stage === "busy"} aria-busy={stage === "busy"}>
                {stage === "busy" && <span className="fl-auth-spin" aria-hidden="true" />}
                {stage === "busy" ? "Sending link…" : "Send reset link"}
              </button>
            </form>
            <p className="fl-auth-foot">
              Remembered it?{" "}
              <a className="fl-link" href={d.signInHref}>
                Back to sign in
              </a>
              {" · "}
              <a className="fl-link" href={d.helpHref}>
                Get help
              </a>
            </p>
          </>
        )}
      </div>
    </section>
  );
}
