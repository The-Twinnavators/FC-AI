/**
 * Neobrutalist landing page: a loud hero with a booking preview, a row of three feature cards and a closing call to
 * action with an email sign-up. Use it as the front page of a playful product, studio or event. Make it the app's own:
 * replace SAMPLE with the real promise, features and offer, and pass the email to the app's own waitlist step.
 */
import { useState } from "react";
import type { FormEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  kicker: "Open studio, every evening",
  titleStart: "Make something",
  titleMark: "lumpy",
  titleEnd: "and love it anyway.",
  lede: "Drop-in pottery for people who want their hands busy and their phone away. Book a wheel by the hour, no course required.",
  primary: "Book a wheel",
  secondary: "See prices",
  sticker: "First hour free",
  previewTitle: "Tonight at North Street",
  slots: [
    { time: "6:00pm", left: "3 wheels left" },
    { time: "7:00pm", left: "1 wheel left" },
    { time: "8:00pm", left: "Full" },
  ],
  featuresTitle: "Why people keep coming back",
  features: [
    { icon: "clock", title: "Book by the hour", text: "No ten-week commitment. Come when you feel like it and pay for the time you use." },
    { icon: "users", title: "Teachers on the floor", text: "Someone is always around to fix a wobbly pot or show you a better grip." },
    { icon: "heart", title: "We fire it for you", text: "Leave your pieces on the shelf. They are glazed, fired and ready in ten days." },
  ],
  cta: {
    title: "Get your free first hour",
    text: "Leave your email and we will send a code for one free hour at either studio.",
    button: "Send my code",
    done: "Check your inbox. Your code for a free hour is on its way to {email}.",
  },
};

export default function NbLanding() {
  const d = SAMPLE;
  const [picked, setPicked] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) return setError("Add your email to get the code.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return setError("That email looks incomplete, like name@example.com.");
    setError("");
    setSent(value);
  }

  return (
    <div className="fl-nb">
      <section className="fl-section" aria-labelledby="nb-landing-title">
        <div className="fl-wrap fl-nb-hero">
          <div className="fl-nb-hero__copy">
            <p className="fl-nb-kicker">{d.kicker}</p>
            <h1 id="nb-landing-title" className="fl-nb-hero__title">
              {d.titleStart} <mark className="fl-nb-mark">{d.titleMark}</mark> {d.titleEnd}
            </h1>
            <p className="fl-nb-hero__lede">{d.lede}</p>
            <div className="fl-nb-row">
              <a className="fl-nb-btn fl-nb-btn--primary" href="#nb-landing-slots">
                {d.primary}
                <Icon name="arrow" />
              </a>
              <a className="fl-nb-btn fl-nb-btn--plain" href="#prices">
                {d.secondary}
              </a>
            </div>
          </div>

          <div className="fl-nb-box fl-nb-hero__art" id="nb-landing-slots">
            <span className="fl-nb-sticker">{d.sticker}</span>
            <h2 className="fl-title fl-title--md" style={{ margin: 0 }}>
              {d.previewTitle}
            </h2>
            <ul style={{ display: "grid", gap: "var(--space-3)", margin: 0, padding: 0, listStyle: "none" }}>
              {d.slots.map((s) => {
                const full = s.left === "Full";
                const isPicked = picked === s.time;
                return (
                  <li key={s.time} className={`fl-nb-box fl-nb-slot${isPicked ? " fl-nb-tone-success" : ""}`}>
                    <div style={{ display: "grid", gap: "var(--space-1)" }}>
                      <strong>{s.time}</strong>
                      <span>{s.left}</span>
                    </div>
                    <button
                      type="button"
                      className={`fl-nb-btn fl-nb-btn--sm ${isPicked ? "fl-nb-btn--secondary" : "fl-nb-btn--primary"}`}
                      disabled={full}
                      aria-pressed={full ? undefined : isPicked}
                      aria-label={full ? `${s.time} is full` : `Hold ${s.time}`}
                      onClick={() => setPicked(isPicked ? null : s.time)}
                    >
                      {full ? "Full" : isPicked ? "Held" : "Hold"}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="fl-nb-status" role="status" aria-live="polite">
              {picked ? `${picked} is held for 15 minutes.` : ""}
            </p>
          </div>
        </div>
      </section>

      <section className="fl-section fl-section--tint" aria-labelledby="nb-landing-features">
        <div className="fl-wrap fl-nb-stack">
          <h2 id="nb-landing-features" className="fl-title" style={{ margin: 0 }}>
            {d.featuresTitle}
          </h2>
          <ul className="fl-nb-cards">
            {d.features.map((f, i) => (
              <li key={f.title} className={`fl-nb-box fl-nb-card${i === 1 ? " fl-nb-card--accent" : ""}`}>
                <span className={`fl-nb-tile${i === 2 ? " fl-nb-tile--danger" : i === 1 ? " fl-nb-tile--success" : ""}`}>
                  <Icon name={f.icon} />
                </span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="fl-section" aria-labelledby="nb-landing-cta">
        <div className="fl-wrap fl-wrap--narrow">
          <div className="fl-nb-box fl-nb-cta">
            <h2 id="nb-landing-cta">{d.cta.title}</h2>
            {sent ? (
              <p role="status" aria-live="polite" tabIndex={-1} ref={(el) => el?.focus()} style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", fontWeight: "var(--weight-semibold)" }}>
                <span className="fl-nb-tile fl-nb-tile--success" style={{ width: "2rem", height: "2rem" }}>
                  <Icon name="check" />
                </span>
                {d.cta.done.replace("{email}", sent)}
              </p>
            ) : (
              <>
                <p>{d.cta.text}</p>
                <form className="fl-nb-inline" noValidate onSubmit={onSubmit}>
                  <div className="fl-nb-field">
                    <label className="fl-sr" htmlFor="nb-landing-email">
                      Email
                    </label>
                    <input
                      id="nb-landing-email"
                      type="email"
                      className="fl-nb-input"
                      placeholder="name@example.com"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError("");
                      }}
                      aria-invalid={!!error}
                      aria-describedby={error ? "nb-landing-email-err" : undefined}
                    />
                    {error && (
                      <p id="nb-landing-email-err" className="fl-nb-err" role="alert">
                        {error}
                      </p>
                    )}
                  </div>
                  <button type="submit" className="fl-nb-btn fl-nb-btn--primary">
                    {d.cta.button}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
