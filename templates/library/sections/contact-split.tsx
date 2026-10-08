/**
 * Contact: details and form. Ways to reach you on one side, a short form on the other. The form is a prototype: it
 * checks the fields and shows a confirmation, and keeps the message in local storage instead of sending it. Make it
 * the app's own: replace SAMPLE; keep only the fields the PRD needs.
 */
import { useState, type FormEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  title: "Talk to us",
  lede: "A real person replies within one working day.",
  ways: [
    { icon: "mail", label: "Email", value: "hello@example.com" },
    { icon: "phone", label: "Phone", value: "+1 555 0100" },
    { icon: "pin", label: "Studio", value: "12 Harbour Street" },
  ],
};

export default function ContactSplit() {
  const d = SAMPLE;
  const [sent, setSent] = useState(false);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      const saved = JSON.parse(localStorage.getItem("contact-messages") ?? "[]") as unknown[];
      localStorage.setItem("contact-messages", JSON.stringify([...saved, Object.fromEntries(form), { at: new Date().toISOString() }]));
    } catch {
      /* storage unavailable: the confirmation still shows */
    }
    setSent(true);
  };
  return (
    <section className="fl-section" id="contact" aria-labelledby="contact-split-title">
      <div className="fl-wrap fl-split fl-split--start">
        <div className="fl-head" style={{ marginBottom: 0 }}>
          <h2 id="contact-split-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
          <ul style={{ display: "grid", gap: "var(--space-4)", margin: "var(--space-4) 0 0", padding: 0, listStyle: "none" }}>
            {d.ways.map((w) => (
              <li key={w.label} className="fl-person">
                <span className="fl-icon">
                  <Icon name={w.icon} />
                </span>
                <span>
                  <strong>{w.label}</strong>
                  <span>{w.value}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="fl-card">
          {sent ? (
            <p className="fl-done" role="status">
              Thanks, your message is in. We'll reply soon.
            </p>
          ) : (
            <form className="fl-form" onSubmit={submit}>
              <div className="fl-field">
                <label htmlFor="contact-name">Name</label>
                <input id="contact-name" name="name" className="fl-input" required autoComplete="name" />
              </div>
              <div className="fl-field">
                <label htmlFor="contact-email">Email</label>
                <input id="contact-email" name="email" type="email" className="fl-input" required autoComplete="email" />
              </div>
              <div className="fl-field">
                <label htmlFor="contact-message">Message</label>
                <textarea id="contact-message" name="message" className="fl-input" required />
              </div>
              <button type="submit" className="fl-btn fl-btn--primary">
                Send message
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
