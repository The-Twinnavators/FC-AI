/**
 * Page template: lead-generation landing page. One goal: get a name and email in exchange for a free guide. The short
 * form sits above the fold beside the promise, then the page answers "what's in it", "who wrote it" and "did it help
 * anyone", and points back to the form. Suits studios, consultants, coaches and service businesses offering a free
 * guide, checklist or consultation call. The form checks its fields and keeps the request in local storage; nothing is
 * sent. Make it the app's own: replace SAMPLE with the real offer and its chapters, and ask only for the fields you
 * will actually use.
 */
import { useState, type FormEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  brand: "Fieldnote Studio",
  phone: "+1 555 0142",
  eyebrow: "Free guide · 38 pages",
  title: "Price your studio work without second-guessing every quote",
  lede: "The pricing guide we wish we'd had when we opened: day rates, package maths and the exact wording we use when a client asks for a discount.",
  points: [
    "A day-rate calculator you can fill in over a coffee",
    "Three package structures that stop scope creep",
    "Scripts for discount requests, rush jobs and late payers",
  ],
  trust: ["No spam: one email with the guide", "Unsubscribe any time", "4,200 studios have read it"],
  form: {
    title: "Get the guide",
    note: "We'll email the PDF in the next few minutes.",
    studioTypes: ["Photography", "Interior design", "Branding and print", "Architecture", "Something else"],
    button: "Send me the guide",
    done: "It's on its way. Check your inbox for an email from Fieldnote Studio; it can take five minutes.",
  },
  cover: { title: "The Small Studio Pricing Guide", edition: "2026 edition", by: "Fieldnote Studio" },
  insideTitle: "What's inside",
  chapters: [
    { title: "Find your real day rate", text: "Work back from what you need to take home, not from what the studio down the road charges." },
    { title: "Packages, not hours", text: "Three ready-made structures for small, medium and ongoing projects, with what goes in each." },
    { title: "Writing a quote that gets a yes", text: "The one-page layout we send, line by line, and why the price goes on page one." },
    { title: "Handling 'can you do it for less?'", text: "Six replies for discount requests that keep the client and the margin." },
    { title: "Deposits and payment terms", text: "How much to take up front, when to invoice, and the reminder emails that get paid." },
    { title: "Raising your prices", text: "A calm way to tell existing clients, with a template letter and a timeline." },
  ],
  author: {
    initials: "MA",
    name: "Mira Adeyemi",
    role: "Founder, Fieldnote Studio",
    bio: "Mira has run a six-person design studio for eleven years and has written more than 900 quotes. She teaches pricing workshops for the regional creative guild.",
  },
  quotes: [
    { text: "I raised my day rate by a third after chapter one. Nobody blinked.", name: "Tomas Reyes", role: "Wedding photographer" },
    { text: "The discount scripts alone paid for a year of my time back.", name: "Hana Okafor", role: "Interior designer" },
    { text: "Finally a pricing guide written by someone who has actually sent invoices.", name: "Ben Lindqvist", role: "Print studio owner" },
  ],
  closing: { title: "Your next quote could be the easy one", button: "Get the free guide" },
  footer: { copy: "© 2026 Fieldnote Studio", links: [{ label: "Privacy", href: "#privacy" }, { label: "Contact", href: "#contact" }] },
};

type Errors = Partial<Record<"name" | "email" | "type", string>>;

export default function LandingLead() {
  const d = SAMPLE;
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState(false);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const type = String(form.get("type") ?? "");
    const next: Errors = {};
    if (!name) next.name = "Please add your first name.";
    if (!email) next.email = "Please add your email so we can send the guide.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "That email looks incomplete, for example name@studio.com.";
    if (!type) next.type = "Choose the closest match.";
    setErrors(next);
    if (Object.keys(next).length > 0) {
      const first = Object.keys(next)[0];
      document.getElementById(`ld-lead-${first}`)?.focus();
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem("landing-lead") ?? "[]") as unknown[];
      localStorage.setItem("landing-lead", JSON.stringify([...saved, { name, email, type, at: new Date().toISOString() }]));
    } catch {
      /* storage unavailable: the confirmation still shows */
    }
    setSent(true);
  };

  const field = (key: keyof Errors) => ({
    id: `ld-lead-${key}`,
    name: key,
    className: "fl-input",
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `ld-lead-${key}-err` : undefined,
  });

  return (
    <div className="fl-ld-page">
      <header className="fl-bg-mesh">
        <div className="fl-ld-bar">
          <a className="fl-ld-brand" href="#top">
            <span className="fl-ld-brand__mark">
              <Icon name="layers" />
            </span>
            {d.brand}
          </a>
          <div className="fl-ld-bar__aside">
            <span className="fl-ld-hide-sm">Questions?</span>
            <a href={`tel:${d.phone.replace(/\s/g, "")}`}>{d.phone}</a>
          </div>
        </div>

        <div className="fl-ld-lead-hero" id="top">
          <div className="fl-wrap fl-ld-lead-grid">
            <div className="fl-ld-lead-copy">
              <span className="fl-eyebrow">{d.eyebrow}</span>
              <h1 className="fl-title fl-title--xl">{d.title}</h1>
              <p className="fl-lede">{d.lede}</p>
              <ul className="fl-checks">
                {d.points.map((p) => (
                  <li key={p}>
                    <span className="fl-tick" aria-hidden="true">
                      <Icon name="check" />
                    </span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="fl-card fl-ld-formcard" id="lead-form">
              <h2 id="ld-lead-form-title">{d.form.title}</h2>
              {sent ? (
                <p className="fl-done" role="status">
                  {d.form.done}
                </p>
              ) : (
                <form className="fl-form" onSubmit={submit} noValidate aria-labelledby="ld-lead-form-title">
                  <p className="fl-note" style={{ margin: 0 }}>
                    {d.form.note}
                  </p>
                  <div className="fl-field">
                    <label htmlFor="ld-lead-name">First name</label>
                    <input {...field("name")} autoComplete="given-name" />
                    {errors.name ? (
                      <p className="fl-ld-error" id="ld-lead-name-err">
                        {errors.name}
                      </p>
                    ) : null}
                  </div>
                  <div className="fl-field">
                    <label htmlFor="ld-lead-email">Work email</label>
                    <input {...field("email")} type="email" autoComplete="email" inputMode="email" />
                    {errors.email ? (
                      <p className="fl-ld-error" id="ld-lead-email-err">
                        {errors.email}
                      </p>
                    ) : null}
                  </div>
                  <div className="fl-field">
                    <label htmlFor="ld-lead-type">What kind of studio?</label>
                    <select {...field("type")} className="fl-input fl-ld-select" defaultValue="">
                      <option value="" disabled>
                        Choose one
                      </option>
                      {d.form.studioTypes.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                    {errors.type ? (
                      <p className="fl-ld-error" id="ld-lead-type-err">
                        {errors.type}
                      </p>
                    ) : null}
                  </div>
                  <button type="submit" className="fl-btn fl-btn--primary fl-ld-btn-block">
                    {d.form.button}
                    <Icon name="arrow" />
                  </button>
                  <p className="fl-ld-fine">By asking for the guide you agree to get one email from us. We never share your address.</p>
                </form>
              )}
            </div>
          </div>
          <div className="fl-wrap" style={{ marginTop: "var(--space-7)" }}>
            <ul className="fl-ld-trust">
              {d.trust.map((t, i) => (
                <li key={t}>
                  <Icon name={["mail", "shield", "users"][i] ?? "check"} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </header>

      <main>
        <section className="fl-section" aria-labelledby="ld-lead-inside">
          <div className="fl-wrap fl-split">
            <div className="fl-ld-cover" aria-hidden="true">
              <span>{d.cover.edition}</span>
              <strong>{d.cover.title}</strong>
              <span>{d.cover.by}</span>
            </div>
            <div>
              <div className="fl-head">
                <h2 id="ld-lead-inside" className="fl-title">
                  {d.insideTitle}
                </h2>
              </div>
              <ol className="fl-ld-chapters">
                {d.chapters.map((c) => (
                  <li key={c.title}>
                    <div>
                      <h3>{c.title}</h3>
                      <p className="fl-text">{c.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="fl-section fl-section--tint" aria-labelledby="ld-lead-proof">
          <div className="fl-wrap">
            <div className="fl-card" style={{ gridTemplateColumns: "auto minmax(0, 1fr)", gap: "var(--space-5)", alignItems: "center", marginBottom: "var(--space-7)" }}>
              <span className="fl-person__avatar" style={{ width: "4rem", height: "4rem", fontSize: "var(--text-lg)" }} aria-hidden="true">
                {d.author.initials}
              </span>
              <div style={{ display: "grid", gap: "var(--space-2)" }}>
                <h2 id="ld-lead-proof" className="fl-title fl-title--md">
                  Written by {d.author.name}
                </h2>
                <span className="fl-meta">{d.author.role}</span>
                <p className="fl-text">{d.author.bio}</p>
              </div>
            </div>
            <div className="fl-grid fl-grid--3">
              {d.quotes.map((q) => (
                <figure key={q.name} className="fl-card" style={{ margin: 0 }}>
                  <blockquote className="fl-quote" style={{ margin: 0 }}>
                    “{q.text}”
                  </blockquote>
                  <figcaption className="fl-person">
                    <span className="fl-person__avatar" aria-hidden="true">
                      {q.name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")}
                    </span>
                    <span>
                      <strong>{q.name}</strong>
                      <span>{q.role}</span>
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section className="fl-section" aria-labelledby="ld-lead-close">
          <div className="fl-wrap fl-head fl-head--center" style={{ marginBottom: 0 }}>
            <h2 id="ld-lead-close" className="fl-title">
              {d.closing.title}
            </h2>
            <div className="fl-actions">
              <a className="fl-btn fl-btn--primary" href="#lead-form">
                {d.closing.button}
              </a>
            </div>
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
