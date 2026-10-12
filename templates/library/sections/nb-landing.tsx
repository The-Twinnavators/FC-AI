/** @flowcode-library nb-landing · Neobrutal landing (Landing pages)
 * Catalog ID: t.landing-neobrutal (template)
 * Function: A neobrutalist-style landing page (pair it with the Neo-brutalist surface style) assembled from: b.hero-centered (booking preview as its picture) > b.features-grid > email sign-up card (inline).
 * Use it as: Copy nb-landing.tsx (FlowCode brings the blocks and components it uses); pair it with the Neo-brutalist surface style; replace SAMPLE with the real promise, features and offer, and pass the email to the app's own waitlist step.
 * Built from: b.hero-centered, b.features-grid, c.button.primary, c.button.secondary, c.card.surface, c.card.plain, c.text-field.outlined
 * Look: A centered hero over a booking preview card with a sticker tag, three feature cards and a closing email sign-up card; it looks neobrutal only when the Neo-brutalist surface style is on.
 * Use cases: landing page; playful product homepage; studio homepage; event homepage; waitlist signup; booking service landing; product launch
 * Jobs to be done: understand what the product offers; see an available booking slot; join the waitlist with my email
 * Keywords: landing, hero, features, call to action, email signup, neobrutalism
 */
/**
 * Landing page for a playful product, studio or event: a centered hero with a booking preview you can hold a slot in,
 * a row of three feature cards and a closing call to action with an email sign-up. Pair it with the Neo-brutalist
 * surface style: the components take their thick edges, hard shadows and tilted sticker from the style's tokens, so
 * this page carries no look of its own.
 * Assembled from: b.hero-centered (booking preview as its picture) > b.features-grid > email sign-up (inline). Every
 * button is c.button, the slots and the sign-up are c.card, the email field is c.text-field.
 * Make it the app's own: replace SAMPLE with the real promise, features and offer, and pass the email to the app's own
 * waitlist step.
 */
import { useState } from "react";
import type { FormEvent } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";
import { Card } from "./cards-variants";
import { TextField } from "./text-fields-states";
import { HeroCentered } from "./hero-centered";
import { FeaturesGrid } from "./features-grid";

// flowcode:sample
const SAMPLE = {
  kicker: "Open studio, every evening",
  title: "Make something lumpy and love it anyway.",
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
    <div>
      <HeroCentered
        id="nb-landing"
        kicker={{ tag: "Open", text: d.kicker, href: "#nb-landing-slots" }}
        title={d.title}
        lede={d.lede}
        primary={{ label: d.primary, href: "#nb-landing-slots" }}
        secondary={{ label: d.secondary, href: "#prices" }}
      >
        <Card variant="surface" tag={d.sticker} id="nb-landing-slots" style={{ maxWidth: "28rem", marginInline: "auto" }}>
          <h2 className="fl-title fl-title--md" style={{ margin: 0 }}>
            {d.previewTitle}
          </h2>
          <ul style={{ display: "grid", gap: "var(--space-3)", margin: 0, padding: 0, listStyle: "none" }}>
            {d.slots.map((s) => {
              const full = s.left === "Full";
              const isPicked = picked === s.time;
              return (
                <li key={s.time}>
                  <Card variant="plain" elevation={isPicked ? "raised" : undefined} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
                    <div style={{ display: "grid", gap: "var(--space-1)", textAlign: "left" }}>
                      <strong>{s.time}</strong>
                      <span>{s.left}</span>
                    </div>
                    <Button
                      variant={isPicked ? "secondary" : "primary"}
                      size={32}
                      disabled={full}
                      aria-pressed={full ? undefined : isPicked}
                      aria-label={full ? `${s.time} is full` : `Hold ${s.time}`}
                      onClick={() => setPicked(isPicked ? null : s.time)}
                    >
                      {full ? "Full" : isPicked ? "Held" : "Hold"}
                    </Button>
                  </Card>
                </li>
              );
            })}
          </ul>
          <p className="fl-meta" role="status" aria-live="polite" style={{ margin: 0 }}>
            {picked ? `${picked} is held for 15 minutes.` : ""}
          </p>
        </Card>
      </HeroCentered>

      <FeaturesGrid id="nb-landing-features" title={d.featuresTitle} items={d.features} />

      <section className="fl-section" aria-labelledby="nb-landing-cta">
        <div className="fl-wrap fl-wrap--narrow">
          <Card variant="surface" style={{ textAlign: "center", justifyItems: "center" }}>
            <h2 id="nb-landing-cta" className="fl-title fl-title--md" style={{ margin: 0 }}>
              {d.cta.title}
            </h2>
            {sent ? (
              <p className="fl-done" role="status" aria-live="polite" tabIndex={-1} ref={(el) => el?.focus()}>
                {d.cta.done.replace("{email}", sent)}
              </p>
            ) : (
              <>
                <p className="fl-text">{d.cta.text}</p>
                <form className="fl-inline-form" noValidate onSubmit={onSubmit} style={{ width: "100%", justifyContent: "center" }}>
                  <label className="fl-sr" htmlFor="nb-landing-email">
                    Email
                  </label>
                  <TextField
                    id="nb-landing-email"
                    type="email"
                    placeholder="name@example.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError("");
                    }}
                    invalid={!!error}
                    aria-describedby={error ? "nb-landing-email-err" : undefined}
                  />
                  <Button variant="primary" type="submit">
                    {d.cta.button}
                  </Button>
                </form>
                {error && (
                  <p id="nb-landing-email-err" className="fl-hp-error" role="alert">
                    {error}
                  </p>
                )}
              </>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}
