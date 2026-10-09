/** @flowcode-library home-mobile-app · Mobile app homepage (Homepages)
 * Use cases: mobile app landing; app download page; app marketing site; budgeting app; feature tour; app store promotion; app reviews
 * Jobs to be done: decide whether to download the app; see how the app works; get the download link on my phone; read what users think
 * Keywords: page, homepage, mobile app, phone mockup, download, features, reviews, faq, budgeting
 */
/**
 * Page template: mobile app homepage. A whole page for a phone app, here a budgeting app for households: navigation,
 * a split hero with two phone mockups drawn in CSS, download buttons and a rating, four steps to get started, a
 * feature tour where choosing a feature changes the phone screen, numbers, reviews, questions, a "text me the link"
 * form on a strong colour band, and a footer. Suits any consumer app with an iPhone and Android version. Make it the
 * app's own: replace SAMPLE, redraw the phone screens as the app's real main screens, and point the store buttons at
 * the real listings.
 */
import { useState, type FormEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  brand: "Penny Jar",
  links: [
    { label: "How it works", href: "#hp-app-how" },
    { label: "Features", href: "#hp-app-features" },
    { label: "Reviews", href: "#hp-app-reviews" },
    { label: "Questions", href: "#hp-app-faq" },
  ],
  cta: "Get the app",
  eyebrow: "Budgeting for real households",
  title: "Know what's left to spend, every day of the month",
  lede: "Penny Jar splits your pay into simple jars for rent, food, fun and savings, then tells you in one number what you can spend today.",
  stores: [
    { small: "Download for", big: "iPhone", href: "#ios" },
    { small: "Get it for", big: "Android", href: "#android" },
  ],
  rating: { value: "4.8", count: "21,400 ratings", note: "Free to start · Premium $3.99/month" },
  home: {
    month: "April",
    leftLabel: "Safe to spend today",
    left: "$46.20",
    sub: "$1,284 left until payday on the 30th",
    jars: [
      { name: "Rent and bills", spent: 1460, budget: 1500 },
      { name: "Groceries", spent: 312, budget: 450 },
      { name: "Eating out", spent: 168, budget: 140 },
      { name: "Savings", spent: 250, budget: 400 },
    ],
  },
  steps: [
    { title: "Download", text: "Free on iPhone and Android. Sign up with your email in under a minute." },
    { title: "Add your pay", text: "Tell it when you're paid and how much. Link a bank account if you like, or log by hand." },
    { title: "Fill your jars", text: "Start from our suggested split or set your own amounts for each jar." },
    { title: "Check one number", text: "Open the app, see what's safe to spend today, and get on with your day." },
  ],
  featuresTitle: "Small habits, built in",
  features: [
    { id: "jars", title: "Jars, not spreadsheets", text: "Each jar shows what's spent and what's left. Overspend in one and the app offers to move money from another." },
    { id: "goals", title: "Savings goals that feel real", text: "Set a target for a trip or a rainy-day fund and watch the ring fill as you put money aside." },
    { id: "bills", title: "Bills you won't forget", text: "Upcoming bills appear a week ahead, so payday never comes with a surprise." },
    { id: "streak", title: "A gentle daily check-in", text: "A 20-second check-in each evening. Most people who keep a 2-week streak stay under budget." },
  ],
  goal: { name: "Lisbon in September", saved: 1140, target: 1800 },
  bills: [
    { name: "Phone plan", when: "Tue 22", amount: "$35.00" },
    { name: "Council tax", when: "Thu 24", amount: "$128.00" },
    { name: "Music streaming", when: "Sat 26", amount: "$10.99" },
    { name: "Gym", when: "Mon 28", amount: "$29.00" },
  ],
  streak: { days: ["M", "T", "W", "T", "F", "S", "S"], on: [true, true, true, true, true, false, false], count: 12 },
  stats: [
    { value: "310,000", label: "people budgeting monthly" },
    { value: "$212", label: "average extra saved a month" },
    { value: "20 sec", label: "typical daily check-in" },
  ],
  reviews: [
    { quote: "First budget I've stuck with for more than a month. The one number is the whole trick.", name: "Danielle K.", detail: "Nurse, using it 14 months" },
    { quote: "We share the grocery jar as a couple. No more 'did you already do the big shop?' texts.", name: "Sam and Arjun", detail: "Shared household" },
    { quote: "The bill reminders alone paid for premium. I haven't had a late fee since January.", name: "Hollis W.", detail: "Freelance illustrator" },
  ],
  faqs: [
    { q: "Do I have to link my bank?", a: "No. You can log spending by hand in two taps. Linking is optional and read-only; we can never move your money." },
    { q: "Is it really free?", a: "Jars, the daily number and one savings goal are free forever. Premium adds unlimited goals, shared jars and bill reminders for $3.99 a month." },
    { q: "Which phones does it run on?", a: "iPhone with iOS 16 or later and Android 10 or later. Your data syncs between both if your partner uses the other." },
    { q: "Can I share a budget with someone?", a: "Yes, with Premium. Invite one person and choose which jars you share and which stay private." },
  ],
  ctaTitle: "Send the download link to your phone",
  ctaText: "Enter your mobile number and we'll text you one link. That's the only message you'll get.",
  footer: { base: "© 2026 Penny Jar Apps Ltd. Penny Jar is a budgeting tool, not a bank.", links: ["Privacy", "Terms", "Help centre", "Press"] },
};

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

function Star() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.6l5.8-.8z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" />
    </svg>
  );
}

type ScreenId = "home" | "jars" | "goals" | "bills" | "streak";

function Screen({ id }: { id: ScreenId }) {
  const d = SAMPLE;
  if (id === "goals") {
    const pct = Math.round((d.goal.saved / d.goal.target) * 100);
    const r = 42;
    const c = 2 * Math.PI * r;
    return (
      <>
        <div className="fl-hp-scr-top">
          <span>Goals</span>
          <span>1 of 1</span>
        </div>
        <svg className="fl-hp-scr-ring" viewBox="0 0 100 100" role="img" aria-label={`${pct}% saved`}>
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-surface-sunken)" strokeWidth="10" />
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-accent)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} transform="rotate(-90 50 50)" />
          <text x="50" y="55" textAnchor="middle" fill="var(--color-text)" style={{ font: "var(--weight-bold) var(--text-lg) var(--font-display)" }}>
            {pct}%
          </text>
        </svg>
        <div className="fl-hp-scr-card">
          <strong>{d.goal.name}</strong>
          <div className="fl-hp-scr-row">
            <span>Saved</span>
            <span>{money(d.goal.saved)}</span>
          </div>
          <div className="fl-hp-scr-row">
            <span>Target</span>
            <span>{money(d.goal.target)}</span>
          </div>
          <div className="fl-hp-scr-row">
            <span>On track for</span>
            <span>2 Sep</span>
          </div>
        </div>
      </>
    );
  }
  if (id === "bills") {
    return (
      <>
        <div className="fl-hp-scr-top">
          <span>Coming up</span>
          <span>Next 7 days</span>
        </div>
        <div className="fl-hp-scr-balance">
          <span>Due this week</span>
          <strong>$202.99</strong>
        </div>
        {d.bills.map((b) => (
          <div key={b.name} className="fl-hp-scr-card">
            <div className="fl-hp-scr-row">
              <span>
                <span className="fl-hp-scr-dot" />
                {b.name}
              </span>
              <strong>{b.amount}</strong>
            </div>
            <span style={{ color: "var(--color-text-muted)" }}>{b.when}</span>
          </div>
        ))}
      </>
    );
  }
  if (id === "streak") {
    return (
      <>
        <div className="fl-hp-scr-top">
          <span>Check-in</span>
          <span>This week</span>
        </div>
        <div className="fl-hp-scr-balance">
          <span>Current streak</span>
          <strong>{d.streak.count} days</strong>
        </div>
        <div className="fl-hp-scr-streak">
          {d.streak.days.map((day, i) => (
            <span key={i} data-on={d.streak.on[i]}>
              {day}
            </span>
          ))}
        </div>
        <div className="fl-hp-scr-card">
          <strong>Tonight's check-in</strong>
          <span style={{ color: "var(--color-text-muted)" }}>Anything you paid for in cash today?</span>
          <div className="fl-hp-scr-row">
            <span>Coffee</span>
            <span>$3.40</span>
          </div>
        </div>
      </>
    );
  }
  const jarsOnly = id === "jars";
  return (
    <>
      <div className="fl-hp-scr-top">
        <span>{d.home.month}</span>
        <span>{jarsOnly ? "Jars" : "Today"}</span>
      </div>
      {jarsOnly ? null : (
        <div className="fl-hp-scr-balance">
          <span>{d.home.leftLabel}</span>
          <strong>{d.home.left}</strong>
          <span style={{ opacity: 0.85 }}>{d.home.sub}</span>
        </div>
      )}
      {d.home.jars.map((j) => {
        const over = j.spent > j.budget;
        return (
          <div key={j.name} className="fl-hp-scr-card">
            <div className="fl-hp-scr-row">
              <span>{j.name}</span>
              <span style={over ? { color: "var(--color-danger)" } : undefined}>{over ? `${money(j.spent - j.budget)} over` : `${money(j.budget - j.spent)} left`}</span>
            </div>
            <span className="fl-hp-scr-bar">
              <b data-over={over} style={{ width: `${Math.min(100, Math.round((j.spent / j.budget) * 100))}%` }} />
            </span>
          </div>
        );
      })}
      {jarsOnly ? (
        <div className="fl-hp-scr-card" style={{ borderColor: "var(--color-accent)" }}>
          <strong>Move $28 from Savings?</strong>
          <span style={{ color: "var(--color-text-muted)" }}>Covers Eating out until payday.</span>
        </div>
      ) : null}
    </>
  );
}

export default function HomeMobileApp() {
  const d = SAMPLE;
  const [menu, setMenu] = useState(false);
  const [feature, setFeature] = useState(d.features[0].id);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const digits = phone.replace(/[^\d]/g, "");
    if (!digits) return setError("Enter your mobile number.");
    if (digits.length < 10 || digits.length > 15) return setError("That number looks too short or too long. Include the area code.");
    setError("");
    try {
      localStorage.setItem("pennyjar-link", JSON.stringify({ phone: digits, at: new Date().toISOString() }));
    } catch {
      /* storage unavailable: the confirmation still shows */
    }
    setSent(true);
  };

  const current = d.features.find((f) => f.id === feature) ?? d.features[0];

  return (
    <div className="fl-hp-page" id="top">
      <header className="fl-nav">
        <nav className="fl-nav__row" aria-label="Main">
          <a className="fl-nav__brand" href="#top" style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span className="fl-icon" style={{ width: "2rem", height: "2rem", borderRadius: "var(--radius-md)" }}>
              <Icon name="heart" />
            </span>
            {d.brand}
          </a>
          <ul className="fl-nav__links">
            {d.links.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
          </ul>
          <div className="fl-nav__end">
            <a className="fl-btn fl-btn--primary fl-hp-hide-sm" href="#hp-app-get">
              {d.cta}
            </a>
            <button type="button" className="fl-btn fl-btn--secondary fl-nav__menu" aria-expanded={menu} aria-controls="hp-app-menu" aria-label="Menu" onClick={() => setMenu((o) => !o)}>
              <Icon name="menu" />
            </button>
          </div>
        </nav>
        <ul id="hp-app-menu" className="fl-hp-menu" data-open={menu}>
          {[...d.links, { label: d.cta, href: "#hp-app-get" }].map((l) => (
            <li key={l.label}>
              <a href={l.href} onClick={() => setMenu(false)}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </header>

      <main>
        <section className="fl-hp-app-hero fl-bg-soft" aria-labelledby="hp-app-title">
          <div className="fl-wrap fl-split">
            <div style={{ display: "grid", gap: "var(--space-5)" }}>
              <p className="fl-eyebrow">{d.eyebrow}</p>
              <h1 id="hp-app-title" className="fl-title fl-title--xl">
                {d.title}
              </h1>
              <p className="fl-lede">{d.lede}</p>
              <div className="fl-hp-stores">
                {d.stores.map((s) => (
                  <a key={s.big} className="fl-hp-store" href={s.href}>
                    <PhoneIcon />
                    <span>
                      <small>{s.small}</small>
                      <strong>{s.big}</strong>
                    </span>
                  </a>
                ))}
              </div>
              <div className="fl-hp-rating">
                <span className="fl-hp-stars" role="img" aria-label={`Rated ${d.rating.value} out of 5`}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} />
                  ))}
                </span>
                <span>
                  <strong style={{ color: "var(--color-text)" }}>{d.rating.value}</strong> from {d.rating.count}
                </span>
                <span>· {d.rating.note}</span>
              </div>
            </div>
            <div className="fl-hp-phones" role="img" aria-label="The Penny Jar app showing today's safe-to-spend amount and a savings goal">
              <div className="fl-hp-phone fl-hp-phone--back" aria-hidden="true">
                <div className="fl-hp-phone__screen">
                  <Screen id="goals" />
                </div>
              </div>
              <div className="fl-hp-phone fl-hp-phone--front" aria-hidden="true">
                <div className="fl-hp-phone__screen">
                  <Screen id="home" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="fl-section" id="hp-app-how" aria-labelledby="hp-app-how-title">
          <div className="fl-wrap">
            <div className="fl-head fl-head--center">
              <p className="fl-eyebrow">How it works</p>
              <h2 id="hp-app-how-title" className="fl-title">
                Set up in five minutes, then just check in
              </h2>
            </div>
            <ol className="fl-hp-list fl-hp-steps">
              {d.steps.map((s) => (
                <li key={s.title}>
                  <h3>{s.title}</h3>
                  <p className="fl-text">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="fl-section fl-section--tint" id="hp-app-features" aria-labelledby="hp-app-feat-title">
          <div className="fl-wrap fl-split">
            <div style={{ display: "grid", gap: "var(--space-5)" }}>
              <div className="fl-head" style={{ marginBottom: 0 }}>
                <p className="fl-eyebrow">Features</p>
                <h2 id="hp-app-feat-title" className="fl-title">
                  {d.featuresTitle}
                </h2>
                <p className="fl-text">Choose a feature to see it on the phone.</p>
              </div>
              <ul className="fl-hp-list fl-hp-pick">
                {d.features.map((f) => (
                  <li key={f.id}>
                    <button type="button" aria-pressed={feature === f.id} aria-controls="hp-app-stage" onClick={() => setFeature(f.id)}>
                      <span className="fl-icon" aria-hidden="true">
                        <Icon name={f.id === "jars" ? "layers" : f.id === "goals" ? "sparkle" : f.id === "bills" ? "clock" : "check"} />
                      </span>
                      <span>
                        <strong>{f.title}</strong>
                        <span className="fl-text">{f.text}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div id="hp-app-stage" className="fl-hp-pick-stage" aria-live="polite">
              <div className="fl-hp-phone" role="img" aria-label={`Phone screen: ${current.title}`}>
                <div className="fl-hp-phone__screen" aria-hidden="true">
                  <Screen id={current.id as ScreenId} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="fl-section" aria-label="Penny Jar in numbers" style={{ paddingBlock: "var(--space-8)" }}>
          <dl className="fl-wrap fl-grid fl-grid--3" style={{ margin: "0 auto", textAlign: "center" }}>
            {d.stats.map((s) => (
              <div key={s.label} className="fl-stat">
                <dt className="fl-sr">{s.label}</dt>
                <dd style={{ margin: 0, display: "grid", gap: "var(--space-1)" }}>
                  <strong style={{ color: "var(--color-accent)" }}>{s.value}</strong>
                  <span aria-hidden="true">{s.label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="fl-section fl-section--tint" id="hp-app-reviews" aria-labelledby="hp-app-rev-title">
          <div className="fl-wrap">
            <div className="fl-head fl-head--center">
              <p className="fl-eyebrow">Reviews</p>
              <h2 id="hp-app-rev-title" className="fl-title">
                People who finally stuck with a budget
              </h2>
            </div>
            <ul className="fl-hp-list fl-grid fl-grid--3">
              {d.reviews.map((r) => (
                <li key={r.name} className="fl-card">
                  <span className="fl-hp-stars" role="img" aria-label="5 out of 5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star key={i} />
                    ))}
                  </span>
                  <blockquote className="fl-quote" style={{ fontSize: "var(--text-md)" }}>
                    “{r.quote}”
                  </blockquote>
                  <p className="fl-meta" style={{ margin: 0 }}>
                    <strong style={{ color: "var(--color-text)" }}>{r.name}</strong> · {r.detail}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="fl-section" id="hp-app-faq" aria-labelledby="hp-app-faq-title">
          <div className="fl-wrap fl-wrap--narrow">
            <div className="fl-head fl-head--center">
              <h2 id="hp-app-faq-title" className="fl-title">
                Questions before you download
              </h2>
            </div>
            <div className="fl-faq">
              {d.faqs.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="fl-section fl-bg-ink" id="hp-app-get" aria-labelledby="hp-app-cta-title">
          <div className="fl-wrap fl-wrap--narrow" style={{ display: "grid", gap: "var(--space-5)", justifyItems: "center", textAlign: "center" }}>
            <h2 id="hp-app-cta-title" className="fl-title">
              {d.ctaTitle}
            </h2>
            <p className="fl-lede">{d.ctaText}</p>
            {sent ? (
              <p className="fl-done" role="status" style={{ background: "var(--color-surface)" }}>
                Link sent. Open the text on your phone to install Penny Jar.
              </p>
            ) : (
              <form className="fl-inline-form" onSubmit={submit} noValidate style={{ width: "100%", maxWidth: "30rem", justifyContent: "center" }}>
                <label htmlFor="hp-app-phone" className="fl-sr">
                  Mobile number
                </label>
                <input
                  id="hp-app-phone"
                  className="fl-input"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(555) 014-2290"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "hp-app-phone-err" : undefined}
                />
                <button type="submit" className="fl-btn fl-btn--on-accent">
                  Text me the link
                </button>
              </form>
            )}
            <div aria-live="polite">
              {error && !sent ? (
                <p id="hp-app-phone-err" className="fl-hp-error" style={{ padding: "var(--space-2) var(--space-3)", borderRadius: "var(--radius-sm)", background: "var(--color-danger-surface)" }}>
                  {error}
                </p>
              ) : null}
            </div>
            <div className="fl-hp-stores" style={{ justifyContent: "center" }}>
              {d.stores.map((s) => (
                <a key={s.big} className="fl-hp-store" href={s.href} style={{ background: "var(--color-on-accent)", color: "var(--color-accent)" }}>
                  <PhoneIcon />
                  <span>
                    <small>{s.small}</small>
                    <strong>{s.big}</strong>
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="fl-footer">
        <div className="fl-wrap" style={{ display: "grid", gap: "var(--space-4)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "var(--space-4)", alignItems: "center" }}>
            <a className="fl-nav__brand" href="#top">
              {d.brand}
            </a>
            <nav aria-label="Footer">
              <ul style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-5)" }}>
                {d.footer.links.map((l) => (
                  <li key={l}>
                    <a href="#top">{l}</a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <p className="fl-meta" style={{ margin: 0 }}>
            {d.footer.base}
          </p>
        </div>
      </footer>
    </div>
  );
}
