/** @flowcode-library newsletter-inline · Newsletter sign-up (Newsletter)
 * Catalog ID: b.newsletter-inline (block)
 * Function: An inline email sign-up band that checks the address, confirms and keeps it locally.
 * Use it as: import { NewsletterInline } from "./newsletter-inline"; <NewsletterInline title lede action?="Subscribe" doneText? />
 * Built from: c.text-field.outlined, c.button.primary
 * Look: A tinted band: words on the left, an email field with a button beside it on the right; after sending, a confirmation line replaces the form.
 * Tokens: --space-4 --color-surface-tint --color-border --color-accent --color-text-muted
 * Use cases: newsletter signup; email subscribe; product updates signup; waitlist; blog subscribe; launch notification; mailing list
 * Jobs to be done: get updates by email; hear about the launch first; subscribe to new articles; join the waitlist
 * Keywords: newsletter, subscribe, email, updates
 */
/**
 * Newsletter: inline sign-up. One field and a button. A prototype: it checks the email, shows a confirmation and
 * keeps the address in local storage. Make it the app's own: replace SAMPLE with what people get and how often.
 */
import { useState, type FormEvent } from "react";
import { Button } from "./buttons-variants";
import { TextField } from "./text-fields-states";

export type NewsletterInlineProps = {
  title: string;
  lede: string;
  /** The button label; "Subscribe" when left out. */
  action?: string;
  /** The confirmation shown after sending. */
  doneText?: string;
};

export function NewsletterInline({ title, lede, action = "Subscribe", doneText = "You're subscribed. See you next month." }: NewsletterInlineProps) {
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
    <section className="fl-section fl-section--tint" aria-labelledby="newsletter-title" data-fl="b.newsletter-inline">
      <div className="fl-wrap fl-split">
        <div className="fl-head" style={{ marginBottom: 0 }}>
          <h2 id="newsletter-title" className="fl-title fl-title--md">
            {title}
          </h2>
          <p className="fl-text">{lede}</p>
        </div>
        {done ? (
          <p className="fl-done" role="status">
            {doneText}
          </p>
        ) : (
          <form className="fl-inline-form" onSubmit={submit}>
            <label htmlFor="newsletter-email" className="fl-sr">
              Email address
            </label>
            <TextField id="newsletter-email" name="email" type="email" required placeholder="you@example.com" autoComplete="email" />
            <Button type="submit" variant="primary">
              {action}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE: NewsletterInlineProps = {
  title: "One useful email a month",
  lede: "Booking tips and new features. No spam, unsubscribe any time.",
  action: "Subscribe",
};

export default function NewsletterInlinePreview() {
  return <NewsletterInline {...SAMPLE} />;
}
