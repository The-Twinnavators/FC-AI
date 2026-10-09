/** @flowcode-library site-coming-soon · Coming-soon page (Industry sites)
 * Use cases: coming soon; opening soon; new business launch; pre-opening; notify me; launch countdown; local business teaser; under construction
 * Jobs to be done: know when it opens; get notified on opening day; follow the opening progress
 * Keywords: page, coming soon, launch, pre-launch, countdown, notify, waitlist, email, local business, bakery, html5up
 */
/**
 * Site: coming soon. A single full-screen page for a new local business that hasn't opened yet (café, bakery, shop,
 * salon, studio): a short promise, a live countdown to opening day, a notify-me form that checks the email, spots
 * repeat sign-ups and keeps the list in local storage, a few build milestones, and social links as plain text.
 * Layout adapted from HTML5 UP "Eventually" (html5up.net, CC BY 3.0); keep the credit.
 * Make it the app's own: replace SAMPLE with the business's name, opening date and promise; send the sign-up to the
 * mailing list the PRD describes.
 */
import { useEffect, useState, type FormEvent } from "react";

// flowcode:sample
const SAMPLE = {
  brand: "Little Fern Bakery",
  opening: "2027-04-03T08:00:00",
  eyebrow: "Opening Saturday 3 April · 14 Mill Street",
  title: "Fresh bread, slow coffee and a corner to sit in.",
  promise:
    "Sourdough baked overnight, cardamom buns warm by eight, and coffee from a small roaster down the road. Twelve seats, a sunny window and no rush.",
  form: {
    label: "Email me when the doors open",
    tasting: "Invite me to the neighbours' tasting evening on Friday 2 April",
    button: "Notify me",
    privacy: "One email when we open, one for the tasting if you tick it. Then we forget your address.",
  },
  progress: [
    { label: "Keys collected and walls stripped back", done: true },
    { label: "Deck oven installed and seasoned", done: true },
    { label: "Counter, shelves and window seat built", done: true },
    { label: "Food hygiene inspection", done: false },
    { label: "First bake for the neighbours", done: false },
  ],
  social: [
    { label: "Photo diary", handle: "@littlefernbakes", href: "#notify" },
    { label: "Neighbourhood page", handle: "Little Fern, Mill Street", href: "#notify" },
    { label: "Email", handle: "hello@littlefern.example", href: "mailto:hello@littlefern.example" },
  ],
  footer: "© 2027 Little Fern Bakery",
};

const STORE = "soon-notify";

function remaining(target: number) {
  const ms = Math.max(0, target - Date.now());
  const s = Math.floor(ms / 1000);
  return { done: ms === 0, days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

export default function SiteComingSoon() {
  const d = SAMPLE;
  const target = new Date(d.opening).getTime();
  const [left, setLeft] = useState(() => remaining(target));
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "already">("idle");

  useEffect(() => {
    const id = window.setInterval(() => setLeft(remaining(target)), 1000);
    return () => window.clearInterval(id);
  }, [target]);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value) return setError("Enter your email so we can tell you when we open.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return setError("That email doesn't look right. Check for a missing @ or dot.");
    setError("");
    const tasting = new FormData(e.currentTarget).get("tasting") === "on";
    setState("saving");
    window.setTimeout(() => {
      let list: { email: string }[] = [];
      try {
        list = JSON.parse(localStorage.getItem(STORE) ?? "[]") as { email: string }[];
      } catch {
        list = [];
      }
      if (list.some((x) => x.email === value)) {
        setState("already");
        return;
      }
      try {
        localStorage.setItem(STORE, JSON.stringify([...list, { email: value, tasting, at: new Date().toISOString() }]));
      } catch {
        /* storage unavailable: the confirmation still shows */
      }
      setState("done");
    }, 600);
  };

  const pad = (n: number) => String(n).padStart(2, "0");
  const openDate = new Date(d.opening).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="fl-st2-page fl-st2-soon fl-bg-aurora" id="top">
      <header>
        <a className="fl-st2-brand" href="#top">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 21V9M12 13c-3 0-6-2-6-6 3 0 6 2 6 6zM12 11c0-4 3-6 6-6 0 4-3 6-6 6z" />
          </svg>
          {d.brand}
        </a>
      </header>

      <main className="fl-st2-soon__main">
        <div className="fl-head" style={{ marginBottom: 0 }}>
          <span className="fl-eyebrow">{d.eyebrow}</span>
          <h1 className="fl-title fl-title--xl">{d.title}</h1>
          <p className="fl-lede">{d.promise}</p>
        </div>

        {left.done ? (
          <p className="fl-done" role="status">
            We're open! Come and say hello at 14 Mill Street, from 08:00 every day except Monday.
          </p>
        ) : (
          <div role="timer" aria-label={`Time until opening on ${openDate}`}>
            <dl className="fl-st2-count">
              <div>
                <dt>Days</dt>
                <dd>{left.days}</dd>
              </div>
              <div>
                <dt>Hours</dt>
                <dd>{pad(left.hours)}</dd>
              </div>
              <div>
                <dt>Minutes</dt>
                <dd>{pad(left.minutes)}</dd>
              </div>
              <div>
                <dt>Seconds</dt>
                <dd>{pad(left.seconds)}</dd>
              </div>
            </dl>
          </div>
        )}

        <section className="fl-st2-glass" id="notify" aria-labelledby="soon-form-title">
          <div aria-live="polite">
            {state === "done" ? (
              <div style={{ display: "grid", gap: "var(--space-3)" }}>
                <p className="fl-done" role="status" style={{ margin: 0 }}>
                  You're on the list. We'll email {email.trim()} the week we open.
                </p>
                <button type="button" className="fl-btn fl-btn--secondary" style={{ justifySelf: "start" }} onClick={() => { setEmail(""); setState("idle"); }}>
                  Add another email
                </button>
              </div>
            ) : (
              <form className="fl-form" noValidate onSubmit={submit}>
                <h2 id="soon-form-title" className="fl-title fl-title--md" style={{ fontSize: "var(--text-lg)" }}>
                  {d.form.label}
                </h2>
                <div className="fl-inline-form">
                  <label htmlFor="soon-email" className="fl-sr">
                    Email address
                  </label>
                  <input
                    id="soon-email"
                    type="email"
                    className="fl-input"
                    placeholder="you@example.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (state === "already") setState("idle");
                    }}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? "soon-email-err" : "soon-privacy"}
                  />
                  <button type="submit" className="fl-btn fl-btn--primary" disabled={state === "saving"} aria-busy={state === "saving"}>
                    {state === "saving" ? "Adding you…" : d.form.button}
                  </button>
                </div>
                {error ? (
                  <p id="soon-email-err" className="fl-st2-err">
                    {error}
                  </p>
                ) : null}
                {state === "already" ? (
                  <p className="fl-st2-impactline" role="status" style={{ background: "var(--color-surface-sunken)" }}>
                    That email is already on the list, so there's nothing more to do. See you on opening day.
                  </p>
                ) : null}
                <label className="fl-st2-check">
                  <input type="checkbox" name="tasting" />
                  {d.form.tasting}
                </label>
                <p id="soon-privacy" className="fl-note" style={{ margin: 0 }}>
                  {d.form.privacy}
                </p>
              </form>
            )}
          </div>
        </section>

        <section aria-labelledby="soon-progress-title" style={{ display: "grid", gap: "var(--space-3)" }}>
          <h2 id="soon-progress-title" className="fl-eyebrow" style={{ margin: 0 }}>
            How the fit-out is going · {d.progress.filter((p) => p.done).length} of {d.progress.length} done
          </h2>
          <ol className="fl-st2-steps">
            {d.progress.map((p) => (
              <li key={p.label} className={p.done ? undefined : "fl-st2-todo"}>
                {p.done ? (
                  <span className="fl-tick">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12.5 10 17l9-10" />
                    </svg>
                  </span>
                ) : (
                  <span className="fl-st2-ring" aria-hidden="true" />
                )}
                <span>
                  {p.label}
                  <span className="fl-sr">{p.done ? " (done)" : " (still to do)"}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="fl-st2-soonfoot">
        <ul className="fl-st2-social" aria-label="Follow along">
          {d.social.map((s) => (
            <li key={s.label}>
              <a href={s.href}>
                {s.label}
                <span>{s.handle}</span>
              </a>
            </li>
          ))}
        </ul>
        <p style={{ margin: 0 }} className="fl-st2-credit">
          {d.footer} · Design: <a href="https://html5up.net">HTML5 UP</a>
        </p>
      </footer>
    </div>
  );
}
