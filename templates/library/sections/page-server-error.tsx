/**
 * Server error (500): something broke on our side. A small server illustration, an honest message, a retry button
 * that shows a "trying again" state, a reference code people can copy for support, and a support link. The retry is
 * simulated (the first try still fails, the next one works) so every state can be seen. Use it as the app's error
 * boundary or 5xx page. Make it the app's own: replace SAMPLE, and point retry at the request that failed.
 */
import { useId, useRef, useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  code: "500",
  title: "Something went wrong on our side",
  text: "Your booking details are safe. Our server tripped over this request; trying again usually fixes it.",
  reference: "ERR-7F3A-2291",
  supportHref: "#support",
  supportLabel: "Contact the studio team",
  homeHref: "#home",
  succeedOnAttempt: 2,
};

export default function PageServerError() {
  const d = SAMPLE;
  const id = useId();
  const [state, setState] = useState<"error" | "busy" | "failed" | "ok">("error");
  const [attempts, setAttempts] = useState(0);
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const retry = () => {
    const attempt = attempts + 1;
    setAttempts(attempt);
    setState("busy");
    setProgress(10);
    let p = 10;
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      p += 30;
      setProgress(Math.min(p, 100));
      if (p >= 100) {
        window.clearInterval(timer.current);
        setState(attempt >= d.succeedOnAttempt ? "ok" : "failed");
      }
    }, 400);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(d.reference);
    } catch {
      /* clipboard blocked: the code is still on screen to copy by hand */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const busy = state === "busy";

  return (
    <section className="fl-section" aria-labelledby={`${id}-title`}>
      <div className="fl-wrap fl-wrap--narrow fl-err">
        <div className="fl-err-rack" aria-hidden="true">
          <span />
          <span />
          <span />
          <b className="fl-err-rack__code">{d.code}</b>
        </div>

        {state === "ok" ? (
          <div className="fl-head fl-head--center" style={{ marginBottom: 0 }} role="status">
            <span className="fl-err-badge fl-err-badge--info">Back up</span>
            <h1 id={`${id}-title`} className="fl-title">
              That worked
            </h1>
            <p className="fl-lede">The page loaded on the second try. Sorry for the bump.</p>
            <div className="fl-actions">
              <a className="fl-btn fl-btn--primary" href={d.homeHref}>
                Continue
                <Icon name="arrow" />
              </a>
            </div>
          </div>
        ) : (
          <>
            <div className="fl-head fl-head--center" style={{ marginBottom: 0 }}>
              <span className="fl-err-badge">
                <span className="fl-err-dot" aria-hidden="true" />
                Error {d.code} · server
              </span>
              <h1 id={`${id}-title`} className="fl-title">
                {d.title}
              </h1>
              <p className="fl-lede">{d.text}</p>
            </div>

            <div className="fl-actions" style={{ justifyContent: "center" }}>
              <button type="button" className="fl-btn fl-btn--primary" onClick={retry} disabled={busy} aria-busy={busy}>
                {busy ? <span className="fl-err-spin" aria-hidden="true" /> : <RetryIcon />}
                {busy ? "Trying again…" : "Try again"}
              </button>
              <a className="fl-btn fl-btn--secondary" href={d.supportHref}>
                <Icon name="mail" />
                {d.supportLabel}
              </a>
            </div>

            {busy && (
              <div
                className="fl-err-progress"
                role="progressbar"
                aria-label="Trying again"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <span style={{ width: `${progress}%` }} />
              </div>
            )}

            <div aria-live="polite" style={{ width: "100%", maxWidth: "28rem" }}>
              {state === "failed" && (
                <p className="fl-err-status fl-err-status--bad">
                  Still not working (attempt {attempts}). Give it a moment and try once more, or send us the reference
                  below so we can look into it.
                </p>
              )}
            </div>

            <div className="fl-err-ref">
              <span>Reference</span>
              <code>{d.reference}</code>
              <button type="button" className="fl-err-copy" onClick={copy}>
                {copied ? "Copied" : "Copy"}
                <span className="fl-sr"> reference code</span>
              </button>
              <span className="fl-sr" aria-live="polite">
                {copied ? "Reference code copied." : ""}
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function RetryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" />
    </svg>
  );
}
