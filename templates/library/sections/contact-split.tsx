/** @flowcode-library contact-split · Contact details and form (Contact)
 * Catalog ID: b.contact-split (block)
 * Function: A contact section with ways to reach you beside a validated name, email and message form.
 * Use it as: import { ContactSplit } from "./contact-split"; <ContactSplit title lede ways={[{icon,label,value}]} action?="Send message" doneText? />
 * Built from: c.text-field.outlined, c.button.primary
 * Look: Words and a list of icon-led contact details on the left; a bordered card with three labeled fields and a button on the right.
 * Tokens: --space-4 --space-6 --radius-lg --color-border --color-accent --color-text-muted
 * Use cases: contact page; support form; get in touch; sales inquiry; office address; booking inquiry; customer support
 * Jobs to be done: get in touch with the team; send a question to support; find the office address or phone; ask sales about a plan
 * Keywords: contact, form, email, support, address
 */
/**
 * Contact: details and form. Ways to reach you on one side, a short form on the other. The form is a prototype: it
 * checks the fields and shows a confirmation, and keeps the message in local storage instead of sending it. Make it
 * the app's own: replace SAMPLE; keep only the fields the PRD needs.
 */
import { useState, type FormEvent } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";
import { TextField } from "./text-fields-states";

export type ContactSplitProps = {
  title: string;
  lede: string;
  /** Ways to reach you; icon is a name from ./icons (mail, phone, pin...). */
  ways: { icon: string; label: string; value: string }[];
  /** The button label; "Send message" when left out. */
  action?: string;
  /** The confirmation shown after sending. */
  doneText?: string;
};

export function ContactSplit({ title, lede, ways, action = "Send message", doneText = "Thanks, your message is in. We'll reply soon." }: ContactSplitProps) {
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
    <section className="fl-section" id="contact" aria-labelledby="contact-split-title" data-fl="b.contact-split">
      <div className="fl-wrap fl-split fl-split--start">
        <div className="fl-head" style={{ marginBottom: 0 }}>
          <h2 id="contact-split-title" className="fl-title">
            {title}
          </h2>
          <p className="fl-lede">{lede}</p>
          <ul style={{ display: "grid", gap: "var(--space-4)", margin: "var(--space-4) 0 0", padding: 0, listStyle: "none" }}>
            {ways.map((w) => (
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
              {doneText}
            </p>
          ) : (
            <form className="fl-form" onSubmit={submit}>
              <div className="fl-field">
                <label htmlFor="contact-name">Name</label>
                <TextField id="contact-name" name="name" required autoComplete="name" />
              </div>
              <div className="fl-field">
                <label htmlFor="contact-email">Email</label>
                <TextField id="contact-email" name="email" type="email" required autoComplete="email" />
              </div>
              <div className="fl-field">
                <label htmlFor="contact-message">Message</label>
                <TextField id="contact-message" name="message" multiline required />
              </div>
              <Button type="submit" variant="primary">
                {action}
              </Button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE: ContactSplitProps = {
  title: "Talk to us",
  lede: "A real person replies within one working day.",
  ways: [
    { icon: "mail", label: "Email", value: "hello@example.com" },
    { icon: "phone", label: "Phone", value: "+1 555 0100" },
    { icon: "pin", label: "Studio", value: "12 Harbour Street" },
  ],
};

export default function ContactSplitPreview() {
  return <ContactSplit {...SAMPLE} />;
}
