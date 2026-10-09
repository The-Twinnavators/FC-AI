/** @flowcode-library auth-verify-code · Verify code (Sign-in and sign-up)
 * Use cases: email verification; phone verification; two-factor authentication; one-time code; otp entry; login verification; confirm sign up; magic code login
 * Jobs to be done: confirm my email address; verify my phone number; prove it is really me; finish signing in securely; get a new code sent
 * Keywords: auth, otp, verification, two-step, code input
 */
/**
 * Verify code: a six-digit one-time code in six boxes. Typing moves to the next box, pasting fills them all, Backspace
 * on an empty box moves back and the arrow keys move between boxes. A wrong code shakes and explains; the right code
 * shows a confirmation. Includes a resend link with a cooldown. Use it after sign-up, for two-step sign-in or to
 * confirm a phone number. Nothing is sent: the sample code in SAMPLE is checked in memory. Make it the app's own:
 * replace SAMPLE with the app's copy and swap the check for its real verify call.
 */
import { useEffect, useId, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  title: "Enter your code",
  lede: "We sent a 6-digit code to",
  destination: "sam@example.com",
  demoCode: "482913",
  length: 6,
  resendSeconds: 20,
  attemptsAllowed: 5,
  backHref: "#sign-in",
};

function Alert() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v5M12 16.5v.01" />
    </svg>
  );
}

export default function AuthVerifyCode() {
  const d = SAMPLE;
  const id = useId();
  const boxes = useRef<Array<HTMLInputElement | null>>([]);
  const [digits, setDigits] = useState<string[]>(() => Array(d.length).fill(""));
  const [state, setState] = useState<"idle" | "busy" | "error" | "ok">("idle");
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(d.resendSeconds);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const focusBox = (i: number) => {
    const el = boxes.current[Math.max(0, Math.min(d.length - 1, i))];
    el?.focus();
    el?.select();
  };

  const locked = attempts >= d.attemptsAllowed;

  const check = (code: string[]) => {
    const value = code.join("");
    if (value.length < d.length) {
      setState("error");
      setError(`Enter all ${d.length} digits.`);
      focusBox(code.findIndex((c) => !c));
      return;
    }
    setState("busy");
    setError("");
    window.setTimeout(() => {
      if (value === d.demoCode) {
        setState("ok");
        return;
      }
      const used = attempts + 1;
      setAttempts(used);
      setState("error");
      setError(
        used >= d.attemptsAllowed
          ? "Too many wrong codes. Ask for a new code to try again."
          : `That code isn't right. Check the latest email and try again (${d.attemptsAllowed - used} ${d.attemptsAllowed - used === 1 ? "try" : "tries"} left).`,
      );
      setDigits(Array(d.length).fill(""));
      window.setTimeout(() => focusBox(0), 0);
    }, 700);
  };

  const update = (next: string[]) => {
    setDigits(next);
    if (state === "error") {
      setState("idle");
      setError("");
    }
    if (next.every(Boolean)) check(next);
  };

  const onInput = (i: number, raw: string) => {
    let only = raw.replace(/\D/g, "");
    // Typing over a filled box: keep the new digit, not the old one.
    if (only.length === 2 && digits[i]) only = only[0] === digits[i] ? only[1] : only[0];
    if (!only) {
      const next = [...digits];
      next[i] = "";
      setDigits(next);
      return;
    }
    if (only.length > 1) return fill(only, i);
    const next = [...digits];
    next[i] = only;
    if (i < d.length - 1) focusBox(i + 1);
    update(next);
  };

  const fill = (text: string, start = 0) => {
    const only = text.replace(/\D/g, "").slice(0, d.length - start);
    if (!only) return;
    const next = [...digits];
    only.split("").forEach((c, k) => (next[start + k] = c));
    focusBox(Math.min(start + only.length, d.length - 1));
    update(next);
  };

  const onPaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text");
    const only = text.replace(/\D/g, "");
    fill(only, only.length >= d.length ? 0 : i);
  };

  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      e.preventDefault();
      const next = [...digits];
      next[i - 1] = "";
      setDigits(next);
      focusBox(i - 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusBox(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusBox(i + 1);
    }
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!locked) check(digits);
  };

  const resend = () => {
    setAttempts(0);
    setCooldown(d.resendSeconds);
    setDigits(Array(d.length).fill(""));
    setState("idle");
    setError("");
    setNote(`A new code is on its way to ${d.destination}.`);
    focusBox(0);
  };

  const busy = state === "busy";
  const half = Math.ceil(d.length / 2);

  return (
    <section className="fl-section fl-section--tint fl-auth" aria-labelledby={`${id}-title`}>
      <div className="fl-card fl-auth-card">
        {state === "ok" ? (
          <div className="fl-auth-done" role="status">
            <span className="fl-auth-done__icon">
              <Icon name="shield" />
            </span>
            <h2 id={`${id}-title`}>You're verified</h2>
            <p>Thanks for confirming it's you. Your account is ready to use.</p>
            <button
              type="button"
              className="fl-btn fl-btn--secondary"
              onClick={() => {
                setDigits(Array(d.length).fill(""));
                setAttempts(0);
                setState("idle");
              }}
            >
              Start again
            </button>
          </div>
        ) : (
          <>
            <span className="fl-icon" style={{ justifySelf: "center" }}>
              <Icon name="mail" />
            </span>
            <div className="fl-auth-head fl-auth-head--center">
              <h1 id={`${id}-title`}>{d.title}</h1>
              <p>
                {d.lede} <strong style={{ color: "var(--color-text)" }}>{d.destination}</strong>. It expires in 10 minutes.
              </p>
            </div>

            <form className="fl-form" onSubmit={submit} noValidate>
              <fieldset className="fl-auth-otp" data-state={state === "error" ? "error" : undefined} aria-describedby={error ? `${id}-err` : undefined} disabled={busy || locked}>
                <legend className="fl-sr">One-time code, {d.length} digits</legend>
                <div className="fl-auth-otp__boxes">
                  {digits.map((digit, i) => (
                    <FragmentBox key={i} withDash={i === half}>
                      <input
                        ref={(el) => {
                          boxes.current[i] = el;
                        }}
                        className="fl-auth-otp__box"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete={i === 0 ? "one-time-code" : "off"}
                        maxLength={i === 0 ? d.length : 1}
                        placeholder=" "
                        value={digit}
                        aria-label={`Digit ${i + 1} of ${d.length}`}
                        aria-invalid={state === "error" ? true : undefined}
                        onChange={(e) => onInput(i, e.target.value)}
                        onKeyDown={(e) => onKey(i, e)}
                        onPaste={(e) => onPaste(i, e)}
                        onFocus={(e) => e.target.select()}
                      />
                    </FragmentBox>
                  ))}
                </div>
              </fieldset>
              <div aria-live="assertive">
                {error && (
                  <p id={`${id}-err`} className="fl-auth-error" style={{ justifyContent: "center" }}>
                    <Alert />
                    {error}
                  </p>
                )}
              </div>
              <button type="submit" className="fl-btn fl-btn--primary fl-auth-full" disabled={busy || locked} aria-busy={busy}>
                {busy && <span className="fl-auth-spin" aria-hidden="true" />}
                {busy ? "Checking…" : "Verify"}
              </button>
            </form>

            <p className="fl-auth-foot">
              Didn't get it?{" "}
              {cooldown > 0 ? (
                <span>
                  Resend in <span className="fl-auth-timer">{cooldown}s</span>
                </span>
              ) : (
                <button type="button" className="fl-link" onClick={resend} style={{ border: 0, background: "none", padding: 0, font: "inherit", fontWeight: "var(--weight-semibold)", cursor: "pointer" }}>
                  Send a new code
                </button>
              )}
            </p>
            <p className="fl-note" role="status" style={{ margin: 0, textAlign: "center" }}>
              {note}
            </p>
            <p className="fl-auth-hint">
              Prototype: the code is <code>{d.demoCode}</code>. Try pasting it.
            </p>
            <a className="fl-link" href={d.backHref} style={{ justifySelf: "center", fontSize: "var(--text-sm)" }}>
              Back to sign in
            </a>
          </>
        )}
      </div>
    </section>
  );
}

/** Puts a small dash between the two halves of the code so it's easier to read back. */
function FragmentBox({ withDash, children }: { withDash: boolean; children: ReactNode }) {
  return (
    <>
      {withDash && <span className="fl-auth-otp__dash" aria-hidden="true" />}
      {children}
    </>
  );
}
