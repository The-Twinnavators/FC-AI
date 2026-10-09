/** @flowcode-library landing-prelaunch · Pre-launch waitlist (Landing pages)
 * Use cases: waitlist; pre-launch; coming soon; early access; beta signup; launch countdown; referral waitlist
 * Jobs to be done: join the waitlist early; know when it launches; move up the waitlist by sharing; see what is coming on launch day
 * Keywords: landing, pre-launch, waitlist, countdown, coming soon, referral, page template
 */
/**
 * Page template: pre-launch / waitlist page. One screen built around a live countdown to launch day and a single email
 * field; joining shows the visitor's place in the queue and a referral link to move up. Once the launch date passes the
 * countdown turns into a "we're live" message. Suits new apps, products and services collecting early sign-ups. The
 * waitlist is a prototype: places are counted in local storage, nothing is sent. Make it the app's own: replace SAMPLE
 * (set launchAt to the real date) and say plainly what people get for joining early.
 */
import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  brand: "Tidyhome",
  badge: "Opening to the first 2,000 households",
  title: "The house runs itself. Mostly.",
  lede: "Tidyhome shares out chores, bins and bills between everyone you live with, and nudges the right person at the right time. No more fridge notes.",
  launchAt: "2027-03-01T09:00:00",
  launchedTitle: "Tidyhome is live",
  launchedText: "Waitlist invites are going out now, oldest first. Join below and we'll send yours as soon as a spot opens.",
  alreadyOnList: 1284,
  perk: "The first 2,000 households get a year of Tidyhome Plus free.",
  button: "Join the waitlist",
  referBase: "https://tidyhome.example/join?ref=",
  teasers: [
    { icon: "users", title: "Fair rotas", text: "Chores rotate automatically, weighted by how long each one takes." },
    { icon: "clock", title: "Gentle nudges", text: "Bin night reminders that go to whoever's turn it is, not the group chat." },
    { icon: "chart", title: "Split bills", text: "Add the electricity bill once; everyone sees what they owe and when." },
  ],
  footer: { copy: "© 2026 Tidyhome", links: [{ label: "Privacy", href: "#privacy" }, { label: "Press kit", href: "#press" }] },
};

const STORE = "landing-prelaunch";

type Joined = { email: string; position: number; code: string };

function remaining(target: number, now: number) {
  const ms = Math.max(0, target - now);
  const s = Math.floor(ms / 1000);
  return { done: ms === 0, days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

export default function LandingPrelaunch() {
  const d = SAMPLE;
  const target = new Date(d.launchAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [joined, setJoined] = useState<Joined | null>(() => {
    try {
      const raw = localStorage.getItem(STORE);
      return raw ? (JSON.parse(raw) as Joined) : null;
    } catch {
      return null;
    }
  });
  const [copied, setCopied] = useState("");

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const left = remaining(target, now);
  const cells = [
    { label: "Days", value: left.days },
    { label: "Hours", value: left.hours },
    { label: "Minutes", value: left.minutes },
    { label: "Seconds", value: left.seconds },
  ];

  const join = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) return setError("Add your email to save your place.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return setError("That email looks incomplete, for example sam@home.com.");
    setError("");
    const code = value.split("@")[0].replace(/[^a-z0-9]/gi, "").slice(0, 6).toLowerCase() + Math.floor(100 + Math.random() * 900);
    const entry: Joined = { email: value, position: d.alreadyOnList + 1, code };
    try {
      localStorage.setItem(STORE, JSON.stringify(entry));
    } catch {
      /* storage unavailable: the place still shows for this visit */
    }
    setJoined(entry);
  };

  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied("Link copied. Each friend who joins moves you up 50 places.");
    } catch {
      setCopied("Couldn't copy automatically. Select the link and copy it.");
    }
  };

  const reset = () => {
    try {
      localStorage.removeItem(STORE);
    } catch {
      /* nothing stored */
    }
    setJoined(null);
    setEmail("");
    setCopied("");
  };

  const link = joined ? d.referBase + joined.code : "";

  return (
    <div className="fl-ld-page">
      <div className="fl-ld-launch fl-bg-aurora">
        <header className="fl-ld-bar fl-ld-bar--center" style={{ width: "100%" }}>
          <a className="fl-ld-brand" href="#top">
            <span className="fl-ld-brand__mark">
              <Icon name="heart" />
            </span>
            {d.brand}
          </a>
        </header>

        <main className="fl-ld-launch__main" id="top">
          <span className="fl-ld-pill">
            <span className="fl-ld-pill__dot" aria-hidden="true" />
            {d.badge}
          </span>
          <h1 className="fl-title fl-title--xl" style={{ maxWidth: "40rem" }}>
            {left.done ? d.launchedTitle : d.title}
          </h1>
          <p className="fl-lede" style={{ marginInline: "auto" }}>
            {left.done ? d.launchedText : d.lede}
          </p>

          {left.done ? null : (
            <section aria-label="Time until launch" style={{ display: "grid", gap: "var(--space-3)", justifyItems: "center" }}>
              <dl className="fl-ld-count" aria-hidden="true">
                {cells.map((c) => (
                  <div key={c.label}>
                    <dt>{c.label}</dt>
                    <dd>{String(c.value).padStart(2, "0")}</dd>
                  </div>
                ))}
              </dl>
              <p className="fl-sr">
                Launching in {left.days} days and {left.hours} hours.
              </p>
              <span className="fl-meta">
                Launch day:{" "}
                {new Date(target).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </span>
            </section>
          )}

          {joined ? (
            <div className="fl-ld-joined">
              <span className="fl-meta" role="status">You're on the list as {joined.email}</span>
              <span className="fl-ld-joined__pos">#{joined.position.toLocaleString()}</span>
              <p className="fl-text" style={{ textAlign: "center" }}>
                {joined.position <= 2000 ? d.perk : "Share your link to move up the list."}
              </p>
              <div className="fl-ld-refer">
                <label htmlFor="ld-pre-link" className="fl-sr">
                  Your referral link
                </label>
                <input id="ld-pre-link" className="fl-input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
                <button type="button" className="fl-btn fl-btn--primary" onClick={() => copy(link)}>
                  Copy link
                </button>
              </div>
              <p className="fl-note" aria-live="polite" style={{ margin: 0, minHeight: "1.4em" }}>
                {copied}
              </p>
              <button type="button" className="fl-link" style={{ background: "none", border: 0, cursor: "pointer", font: "inherit", fontSize: "var(--text-sm)" }} onClick={reset}>
                Not you? Use a different email
              </button>
            </div>
          ) : (
            <form className="fl-ld-waitlist" onSubmit={join} noValidate>
              <label htmlFor="ld-pre-email" className="fl-sr">
                Email address
              </label>
              <div className="fl-inline-form">
                <input
                  id="ld-pre-email"
                  className="fl-input"
                  type="email"
                  autoComplete="email"
                  placeholder="you@home.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "ld-pre-err" : "ld-pre-hint"}
                />
                <button type="submit" className="fl-btn fl-btn--primary">
                  {d.button}
                </button>
              </div>
              {error ? (
                <p className="fl-ld-error" id="ld-pre-err">
                  {error}
                </p>
              ) : (
                <p className="fl-ld-fine" id="ld-pre-hint" style={{ textAlign: "center" }}>
                  {d.alreadyOnList.toLocaleString()} households are already waiting. {d.perk}
                </p>
              )}
            </form>
          )}
        </main>
      </div>

      <section className="fl-section" aria-labelledby="ld-pre-coming">
        <div className="fl-wrap">
          <h2 id="ld-pre-coming" className="fl-title fl-title--md" style={{ marginBottom: "var(--space-6)" }}>
            What's coming on launch day
          </h2>
          <div className="fl-ld-teasers">
            {d.teasers.map((t) => (
              <div key={t.title}>
                <span className="fl-icon">
                  <Icon name={t.icon} />
                </span>
                <h3>{t.title}</h3>
                <p className="fl-text">{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

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
