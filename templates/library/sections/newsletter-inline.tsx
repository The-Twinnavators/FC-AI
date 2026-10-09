/** @flowcode-library newsletter-inline · Newsletter sign-up (Newsletter)
 * Use cases: newsletter signup; email subscribe; product updates signup; waitlist; blog subscribe; launch notification; mailing list
 * Jobs to be done: get updates by email; hear about the launch first; subscribe to new articles; join the waitlist
 * Keywords: newsletter, subscribe, email, updates
 */
/**
 * Newsletter: inline sign-up. One field and a button. A prototype: it checks the email, shows a confirmation and
 * keeps the address in local storage. Make it the app's own: replace SAMPLE with what people get and how often.
 */
import { useState, type FormEvent } from "react";

// flowcode:sample
const SAMPLE = {
  title: "One useful email a month",
  lede: "Booking tips and new features. No spam, unsubscribe any time.",
  action: "Subscribe",
};

export default function NewsletterInline() {
  const d = SAMPLE;
  const [done, setDone] = useState(false);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      localStorage.setItem("newsletter-email", String(new FormData(e.currentTarget).get("email") ?? ""));
    } catch {
      /* storage unavailable */
    }
    setDone(true);
  };
  return (
    <section className="fl-section fl-section--tint" aria-labelledby="newsletter-title">
      <div className="fl-wrap fl-split">
        <div className="fl-head" style={{ marginBottom: 0 }}>
          <h2 id="newsletter-title" className="fl-title fl-title--md">
            {d.title}
          </h2>
          <p className="fl-text">{d.lede}</p>
        </div>
        {done ? (
          <p className="fl-done" role="status">
            You're subscribed. See you next month.
          </p>
        ) : (
          <form className="fl-inline-form" onSubmit={submit}>
            <label htmlFor="newsletter-email" className="fl-sr">
              Email address
            </label>
            <input id="newsletter-email" name="email" type="email" required className="fl-input" placeholder="you@example.com" autoComplete="email" />
            <button type="submit" className="fl-btn fl-btn--primary">
              {d.action}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
