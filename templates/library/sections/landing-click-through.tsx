/** @flowcode-library landing-click-through · Click-through page (Landing pages)
 * Catalog ID: t.landing-click-through (template)
 * Function: A click-through landing page (t.landing-click-through) that warms visitors up for one sign-up. Assembled from: header and hero (inline) > customers strip (inline) > benefit cards (c.card) > calculator (c.slider) > quote carousel (inline, c.avatar, c.button arrows) > sign-up band (inline).
 * Use it as: Copy landing-click-through.tsx (FlowCode brings the blocks and components it uses); replace SAMPLE with the product's own content; keep exactly one action and base the calculator on a figure you can stand behind.
 * Built from: c.card.surface, c.button.primary, c.button.secondary, c.button.on-accent, c.avatar-stack, c.avatar.person, c.slider.single, c.text-field.outlined
 * Look: A centered promise on a grid backdrop with a social-proof row, benefit cards, a time-saved slider, a quote carousel and a closing sign-up on an accent band.
 * Use cases: free trial signup; saas landing; app download; ad campaign landing; roi calculator; product signup; free account offer
 * Jobs to be done: decide whether to try the product; see how much time i would save; see who already uses it; start a free trial
 * Keywords: landing, click-through, saas, trial, social proof, calculator, carousel, page template
 */
/**
 * Page template: click-through landing page. It warms visitors up before one sign-up action: a centered promise with
 * social proof, the businesses already using it, three benefits, a "how much time would I save?" slider, a rotating
 * set of customer quotes, and a closing sign-up. Every button leads to that one sign-up. Suits SaaS trials, app
 * downloads and free-account offers arriving from an ad or email. The sign-up checks the email and shows a
 * confirmation; nothing is sent. Make it the app's own: replace SAMPLE, keep exactly one action, and base the
 * calculator on a figure you can stand behind.
 */
/**
 * Assembled from: header and hero on a grid backdrop (inline: the proof row sits under the button) > customers strip
 * (inline) > benefit cards (c.card) > time-saved calculator (c.slider) > quote carousel (inline; its arrows are c.button icon-only) >
 * sign-up band (inline, with its form). b.hero-centered, b.logo-cloud and b.features-grid were not used because each would change
 * the look (the header shares the hero's backdrop, the customers are plain names, the benefits sit on a tinted band).
 */
import { useState, type FormEvent } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";
import { Card } from "./cards-variants";
import { Avatar, AvatarStack } from "./avatars-variants";
import { TextField } from "./text-fields-states";
import { Slider } from "./sliders-states";

// flowcode:sample
const SAMPLE = {
  brand: "Rotawise",
  cta: "Start your free 30 days",
  eyebrow: "Staff scheduling for cafés, salons and small shops",
  title: "Write next week's rota in ten minutes, not ten texts",
  lede: "Rotawise builds the schedule around who's available, sends it to everyone's phone and handles shift swaps without you in the middle.",
  proof: { people: [{ name: "Jess Shaw", tone: "a" as const }, { name: "Ade Kole", tone: "b" as const }, { name: "Lena Moreau", tone: "c" as const }, { name: "Tom Osei", tone: "d" as const }], text: "Rated 4.8 by 2,300 small-business owners" },
  usedBy: ["Corner Crumb Bakery", "Halcyon Hair", "The Pressed Bean", "Willow & Wick", "Dockside Deli"],
  benefitsTitle: "Why owners switch",
  benefits: [
    { icon: "clock", title: "Rotas in minutes", text: "Drag shifts onto the week or copy last week and tweak. Availability and time off are already filled in." },
    { icon: "users", title: "Swaps sort themselves", text: "Staff offer and pick up shifts in the app. You get one tap to approve, or let it auto-approve." },
    { icon: "chart", title: "Wages before you post", text: "See the week's wage bill against your takings target as you build it, not when payroll lands." },
  ],
  calc: {
    title: "How much time would you get back?",
    text: "Owners tell us rotas, swaps and 'who's in tomorrow?' messages take about 25 minutes per staff member each month. Rotawise cuts that by roughly 80%.",
    minutesPerStaff: 25,
    saving: 0.8,
    min: 2,
    max: 40,
    start: 8,
  },
  quotes: [
    { text: "Sunday nights used to be rota night. Now I post it on Thursday from the counter between customers.", name: "Jess Shaw", role: "Owner, Corner Crumb Bakery" },
    { text: "The swap board alone stopped about fifteen messages a week landing on my phone.", name: "Ade Kole", role: "Manager, Halcyon Hair" },
    { text: "I finally know what a week costs before it starts. We trimmed two quiet shifts and nobody missed them.", name: "Lena Moreau", role: "Owner, The Pressed Bean" },
  ],
  final: {
    title: "Your next rota could be the last one you write by hand",
    lede: "Free for 30 days. No card needed. Cancel with one click.",
    button: "Start free trial",
    done: "You're in. We've sent a sign-in link to",
  },
  footer: { copy: "© 2026 Rotawise", links: [{ label: "Privacy", href: "#privacy" }, { label: "Terms", href: "#terms" }] },
};

export default function LandingClickThrough() {
  const d = SAMPLE;
  const [staff, setStaff] = useState(d.calc.start);
  const [quote, setQuote] = useState(0);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const savedHours = (staff * d.calc.minutesPerStaff * d.calc.saving) / 60;
  const yearHours = Math.round(savedHours * 12);
  const q = d.quotes[quote];
  const go = (step: number) => setQuote((i) => (i + step + d.quotes.length) % d.quotes.length);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) return setError("Add your work email to start the trial.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return setError("That email looks incomplete, for example jo@yourcafe.com.");
    setError("");
    try {
      localStorage.setItem("landing-click-through", JSON.stringify({ email: value, staff, at: new Date().toISOString() }));
    } catch {
      /* storage unavailable: the confirmation still shows */
    }
    setDone(true);
  };

  return (
    <div className="fl-ld-page">
      <div className="fl-bg-grid">
        <header className="fl-ld-bar">
          <a className="fl-ld-brand" href="#top">
            <span className="fl-ld-brand__mark">
              <Icon name="clock" />
            </span>
            {d.brand}
          </a>
          <Button variant="secondary" size={40} href="#start">
            {d.cta}
          </Button>
        </header>

        <section className="fl-ld-ct-hero" id="top" aria-labelledby="ld-ct-title">
          <span className="fl-eyebrow">{d.eyebrow}</span>
          <h1 id="ld-ct-title" className="fl-title fl-title--xl" style={{ maxWidth: "46rem" }}>
            {d.title}
          </h1>
          <p className="fl-lede">{d.lede}</p>
          <Button variant="primary" href="#start" icon="arrow" iconAt="end">
            {d.cta}
          </Button>
          <div className="fl-ld-proof">
            <AvatarStack people={d.proof.people} size={40} />
            <span>{d.proof.text}</span>
          </div>
        </section>
      </div>

      <main>
        <section className="fl-section" aria-label="Businesses using Rotawise" style={{ paddingBlock: "var(--space-7)" }}>
          <div className="fl-wrap" style={{ display: "grid", gap: "var(--space-5)", textAlign: "center" }}>
            <p className="fl-meta" style={{ margin: 0 }}>
              Running the rota at 2,300 small businesses, including
            </p>
            <ul className="fl-ld-names">
              {d.usedBy.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="fl-section fl-section--tint" aria-labelledby="ld-ct-benefits">
          <div className="fl-wrap">
            <div className="fl-head fl-head--center">
              <h2 id="ld-ct-benefits" className="fl-title">
                {d.benefitsTitle}
              </h2>
            </div>
            <div className="fl-grid fl-grid--3">
              {d.benefits.map((b) => (
                <Card key={b.title} variant="surface">
                  <span className="fl-icon">
                    <Icon name={b.icon} />
                  </span>
                  <h3>{b.title}</h3>
                  <p className="fl-text">{b.text}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="fl-section" aria-labelledby="ld-ct-calc">
          <div className="fl-wrap fl-ld-calc">
            <div style={{ display: "grid", gap: "var(--space-4)" }}>
              <h2 id="ld-ct-calc" className="fl-title fl-title--md">
                {d.calc.title}
              </h2>
              <p className="fl-text">{d.calc.text}</p>
              <div className="fl-field">
                <span style={{ fontWeight: "var(--weight-semibold)", fontSize: "var(--text-sm)" }}>People on your rota</span>
                <Slider label="People on your rota" min={d.calc.min} max={d.calc.max} value={staff} onChange={setStaff} scale format={(n) => `${n} people`} />
              </div>
            </div>
            <div className="fl-ld-result" aria-live="polite">
              <span className="fl-meta">You'd get back about</span>
              <strong>{savedHours.toFixed(1)} hours</strong>
              <span>a month, or {yearHours} hours a year.</span>
              <Button variant="primary" href="#start" style={{ justifySelf: "start", marginTop: "var(--space-3)" }}>
                {d.cta}
              </Button>
            </div>
          </div>
        </section>

        <section className="fl-section fl-section--tint" aria-labelledby="ld-ct-quotes" aria-roledescription="carousel">
          <div className="fl-wrap fl-wrap--narrow fl-ld-carousel">
            <h2 id="ld-ct-quotes" className="fl-eyebrow">
              From owners like you
            </h2>
            <figure style={{ margin: 0, display: "grid", gap: "var(--space-5)", justifyItems: "center" }} aria-live="polite">
              <blockquote className="fl-quote fl-quote--xl" style={{ margin: 0 }}>
                “{q.text}”
              </blockquote>
              <figcaption className="fl-person">
                <Avatar name={q.name} size={48} decorative />
                <span style={{ textAlign: "left" }}>
                  <strong>{q.name}</strong>
                  <span>{q.role}</span>
                </span>
              </figcaption>
            </figure>
            <div className="fl-ld-carousel__nav">
              <Button variant="secondary" size={40} icon="arrow-left" iconOnly aria-label="Previous quote" onClick={() => go(-1)} />
              <ul className="fl-ld-dots">
                {d.quotes.map((x, i) => (
                  <li key={x.name}>
                    <button type="button" aria-label={`Quote ${i + 1} of ${d.quotes.length}`} aria-current={i === quote ? "true" : undefined} onClick={() => setQuote(i)} />
                  </li>
                ))}
              </ul>
              <Button variant="secondary" size={40} icon="arrow" iconOnly aria-label="Next quote" onClick={() => go(1)} />
            </div>
          </div>
        </section>

        <section className="fl-section fl-bg-ink" id="start" aria-labelledby="ld-ct-final">
          <div className="fl-wrap fl-ld-final">
            <h2 id="ld-ct-final" className="fl-title">
              {d.final.title}
            </h2>
            <p className="fl-lede">{d.final.lede}</p>
            {done ? (
              <p className="fl-done" role="status">
                {d.final.done} {email.trim()}. Open it on any device to set up your first week.
              </p>
            ) : (
              <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--space-3)", width: "100%" }}>
                <div className="fl-inline-form">
                  <label htmlFor="ld-ct-email" className="fl-sr">
                    Work email
                  </label>
                  <TextField
                    id="ld-ct-email"
                    type="email"
                    autoComplete="email"
                    placeholder="Your work email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? "ld-ct-err" : undefined}
                  />
                  <Button variant="on-accent" type="submit">
                    {d.final.button}
                  </Button>
                </div>
                {error ? (
                  <p className="fl-ld-error" id="ld-ct-err">
                    {error}
                  </p>
                ) : null}
              </form>
            )}
          </div>
        </section>
      </main>

      <footer className="fl-ld-foot">
        <span>{d.footer.copy}</span>
        <ul>
          {d.footer.links.map((l) => (
            <li key={l.href}>
              <a href={l.href}>{l.label}</a>
            </li>
          ))}
        </ul>
      </footer>
    </div>
  );
}
