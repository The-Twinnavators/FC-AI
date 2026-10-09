/** @flowcode-library home-saas · SaaS homepage (Homepages)
 * Use cases: saas homepage; software product site; b2b marketing site; booking software; scheduling tool; pricing plans; free trial; product marketing
 * Jobs to be done: understand what the software does; compare plans for my budget; see how it fits my tools; start a free trial
 * Keywords: page, homepage, saas, landing, pricing, tabs, faq, signup, b2b
 */
/**
 * Page template: SaaS homepage. A whole landing page for a software product sold on a subscription, here booking and
 * scheduling software for small studios: navigation, a centred hero over a live-looking product preview, the tools it
 * connects to, a bento grid of features, a tabbed "how it works", pricing with a monthly/yearly switch, questions, a
 * trial sign-up and a footer. Suits any B2B or prosumer SaaS. Make it the app's own: replace SAMPLE with the product's
 * real plans, features and wording, and redraw the preview as the product's main screen.
 */
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Icon, Tick } from "./icons";

// flowcode:sample
const SAMPLE = {
  brand: "Slotwise",
  links: [
    { label: "Features", href: "#hp-saas-features" },
    { label: "How it works", href: "#hp-saas-how" },
    { label: "Pricing", href: "#hp-saas-pricing" },
    { label: "Questions", href: "#hp-saas-faq" },
  ],
  signIn: "Sign in",
  cta: "Start free trial",
  kicker: { tag: "New", text: "Waitlists now fill cancelled spots for you" },
  title: "The booking desk for small studios",
  lede: "Slotwise puts classes, private sessions, payments and reminders in one calendar, so your front desk runs itself while you teach.",
  secondary: "Watch a 2-minute tour",
  trust: "14-day trial · No card needed · Set up in an afternoon",
  preview: {
    url: "app.slotwise.example/calendar",
    week: "Week of 14 April",
    days: ["Mon 14", "Tue 15", "Wed 16", "Thu 17", "Fri 18"],
    times: ["7:00", "8:00", "9:00", "10:00", "11:00", "12:00", "17:00", "18:00"],
    events: [
      { day: 0, row: 0, span: 1, title: "Sunrise flow", note: "12 / 14", kind: "" },
      { day: 1, row: 1, span: 2, title: "Wheel throwing", note: "6 / 6 · full", kind: "full" },
      { day: 2, row: 0, span: 1, title: "Sunrise flow", note: "9 / 14", kind: "" },
      { day: 3, row: 2, span: 1, title: "Private: Ines", note: "Paid", kind: "alt" },
      { day: 0, row: 3, span: 2, title: "Glaze lab", note: "4 / 8", kind: "alt" },
      { day: 4, row: 1, span: 1, title: "Mat pilates", note: "11 / 12", kind: "" },
      { day: 2, row: 6, span: 2, title: "Evening wheel", note: "6 / 6 · 3 waiting", kind: "full" },
      { day: 4, row: 6, span: 1, title: "Restore", note: "7 / 14", kind: "" },
      { day: 1, row: 5, span: 1, title: "Private: Theo", note: "Deposit", kind: "alt" },
    ],
  },
  integrations: ["Card payments", "Bank transfer", "Google-style calendars", "Email", "Text messages", "Accounting export", "Zoom-style video links", "Website widget"],
  featuresTitle: "Everything the front desk does, minus the front desk",
  features: [
    { icon: "clock", title: "A calendar that books itself", text: "Clients pick a class or private slot from your live timetable. Double bookings and room clashes are blocked before they happen.", size: "big", meter: true },
    { icon: "bolt", title: "Waitlists that refill", text: "When someone cancels, the next person on the list gets the spot and a text, automatically.", size: "" },
    { icon: "shield", title: "No-show protection", text: "Take a deposit or keep a card on file, and charge a late-cancel fee with one click.", size: "" },
    { icon: "mail", title: "Reminders people read", text: "A short email the day before and a text two hours ahead. No-shows drop by about a third.", size: "wide" },
    { icon: "chart", title: "Numbers worth checking", text: "Fill rate, revenue by class and returning clients, every Monday morning.", size: "" },
  ],
  meter: [
    { label: "Sunrise flow", value: 86 },
    { label: "Wheel throwing", value: 100 },
    { label: "Glaze lab", value: 50 },
  ],
  howTitle: "From first click to paid, in three steps",
  how: [
    {
      tab: "Book",
      title: "Clients book from your site or a link",
      text: "Share one booking link on your website, social profile or in an email. Clients see only the spots that are free and pay up front if you want them to.",
      points: ["Class packs and memberships", "Private sessions with buffer time", "Works on any phone"],
      ticket: [["Class", "Wheel throwing"], ["When", "Tue 15 April, 8:00"], ["Seat", "4 of 6"], ["Paid", "$38.00"]],
    },
    {
      tab: "Remind",
      title: "Reminders go out on their own",
      text: "Pick the timing once. Slotwise sends the email and text, handles the reply to cancel, and offers the seat to the waitlist.",
      points: ["Your own wording and studio name", "Two-way text replies", "Quiet hours respected"],
      ticket: [["Sent", "Mon 14 April, 8:00"], ["To", "Ines R."], ["Message", "See you tomorrow at 8"], ["Reply", "Confirmed"]],
    },
    {
      tab: "Get paid",
      title: "Money lands, books balance",
      text: "Payments, packs and refunds sit next to each booking. At the end of the month, export one file for your accountant.",
      points: ["Payouts every two days", "Automatic receipts", "Monthly export in one click"],
      ticket: [["Week takings", "$2,412.00"], ["Refunds", "$38.00"], ["Fees", "$61.10"], ["Payout", "Thu 17 April"]],
    },
  ],
  pricingTitle: "Simple plans that grow with your timetable",
  saving: "2 months free",
  plans: [
    { name: "Solo", monthly: "$19", yearly: "$190", text: "For one teacher running their own classes.", features: ["1 teacher, 1 room", "Unlimited bookings", "Email reminders"], featured: false },
    { name: "Studio", monthly: "$49", yearly: "$490", text: "For a busy studio with a few teachers.", features: ["Up to 8 teachers", "Waitlists and text reminders", "Deposits and late-cancel fees", "Weekly reports"], featured: true },
    { name: "Collective", monthly: "$99", yearly: "$990", text: "For several rooms or locations.", features: ["Unlimited teachers", "Multiple locations", "Priority help", "Accounting export"], featured: false },
  ],
  faqTitle: "Questions studios ask us",
  faqs: [
    { q: "Can I move my current clients and class packs over?", a: "Yes. Upload a spreadsheet of clients and remaining credits, or send it to us and we will import it for you within two working days." },
    { q: "What does it cost my clients?", a: "Nothing. Card fees are 2.9% plus 30 cents per payment and come out of your payout, the same as most card readers." },
    { q: "Do I need a website?", a: "No. Your booking page lives at its own link. If you do have a website, paste one line to show the timetable on it." },
    { q: "What happens when the trial ends?", a: "You choose a plan or your account pauses. Nothing is deleted for 90 days, and we never charge without asking." },
  ],
  ctaTitle: "Try it on next week's timetable",
  ctaText: "Add your classes, share the link, and watch the bookings come in. Free for 14 days.",
  footer: {
    blurb: "Booking and payments for yoga, pottery, dance and fitness studios.",
    cols: [
      { title: "Product", links: ["Features", "Pricing", "What's new", "Booking widget"] },
      { title: "Studios", links: ["Yoga", "Pottery", "Dance", "Personal training"] },
      { title: "Help", links: ["Guides", "Moving from another tool", "Contact", "Status"] },
    ],
    base: "© 2026 Slotwise Ltd. Made for small studios.",
  },
};

const ROW_HEIGHT_OFFSET = 2; // grid row 1 holds the day names

export default function HomeSaas() {
  const d = SAMPLE;
  const [menu, setMenu] = useState(false);
  const [tab, setTab] = useState(0);
  const [yearly, setYearly] = useState(true);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (tab + (e.key === "ArrowRight" ? 1 : d.how.length - 1)) % d.how.length;
    setTab(next);
    document.getElementById(`hp-saas-tab-${next}`)?.focus();
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) return setError("Enter your work email to start the trial.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return setError("That email doesn't look right. Check for a missing @ or dot.");
    setError("");
    try {
      localStorage.setItem("slotwise-trial", JSON.stringify({ email: value, at: new Date().toISOString() }));
    } catch {
      /* storage unavailable: the confirmation still shows */
    }
    setDone(true);
  };

  const active = d.how[tab];

  return (
    <div className="fl-hp-page" id="top">
      <header className="fl-nav">
        <nav className="fl-nav__row" aria-label="Main">
          <a className="fl-nav__brand" href="#top" style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span className="fl-icon" style={{ width: "2rem", height: "2rem" }}>
              <Icon name="clock" />
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
            <a className="fl-link fl-hp-hide-sm" href="#signin">
              {d.signIn}
            </a>
            <a className="fl-btn fl-btn--primary fl-hp-hide-sm" href="#hp-saas-trial">
              {d.cta}
            </a>
            <button type="button" className="fl-btn fl-btn--secondary fl-nav__menu" aria-expanded={menu} aria-controls="hp-saas-menu" aria-label="Menu" onClick={() => setMenu((o) => !o)}>
              <Icon name="menu" />
            </button>
          </div>
        </nav>
        <ul id="hp-saas-menu" className="fl-hp-menu" data-open={menu}>
          {[...d.links, { label: d.signIn, href: "#signin" }, { label: d.cta, href: "#hp-saas-trial" }].map((l) => (
            <li key={l.label}>
              <a href={l.href} onClick={() => setMenu(false)}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </header>

      <main>
        <section className="fl-hp-saas-hero fl-bg-grid" aria-labelledby="hp-saas-title">
          <div className="fl-wrap">
            <div className="fl-head fl-head--center">
              <a className="fl-hp-kicker" href="#hp-saas-features">
                <b>{d.kicker.tag}</b>
                {d.kicker.text}
              </a>
              <h1 id="hp-saas-title" className="fl-title fl-title--xl">
                {d.title}
              </h1>
              <p className="fl-lede">{d.lede}</p>
              <div className="fl-actions">
                <a className="fl-btn fl-btn--primary" href="#hp-saas-trial">
                  {d.cta}
                  <Icon name="arrow" />
                </a>
                <a className="fl-btn fl-btn--secondary" href="#hp-saas-how">
                  {d.secondary}
                </a>
              </div>
              <p className="fl-meta">{d.trust}</p>
            </div>
            <figure className="fl-hp-window" style={{ margin: "0 auto" }}>
              <div className="fl-hp-window__bar" aria-hidden="true">
                <span className="fl-hp-window__dot" />
                <span className="fl-hp-window__dot" />
                <span className="fl-hp-window__dot" />
                <span style={{ marginLeft: "var(--space-3)" }}>{d.preview.url}</span>
                <span>{d.preview.week}</span>
              </div>
              <div className="fl-hp-cal-wrap" tabIndex={0} aria-label="Sample week in the Slotwise calendar, scrolls sideways">
                <div className="fl-hp-cal">
                  <span className="fl-hp-cal__day" style={{ gridColumn: 1, gridRow: 1, borderLeft: 0 }} />
                  {d.preview.days.map((day, i) => (
                    <span key={day} className="fl-hp-cal__day" style={{ gridColumn: i + 2, gridRow: 1 }}>
                      {day}
                    </span>
                  ))}
                  {d.preview.times.map((t, r) => (
                    <span key={t} className="fl-hp-cal__time" style={{ gridColumn: 1, gridRow: r + ROW_HEIGHT_OFFSET }}>
                      {t}
                    </span>
                  ))}
                  {d.preview.times.flatMap((t, r) =>
                    d.preview.days.map((day, c) => <span key={`${t}-${day}`} className="fl-hp-cal__cell" style={{ gridColumn: c + 2, gridRow: r + ROW_HEIGHT_OFFSET }} />),
                  )}
                  {d.preview.events.map((ev) => (
                    <div
                      key={`${ev.day}-${ev.row}`}
                      className={`fl-hp-cal__event${ev.kind ? ` fl-hp-cal__event--${ev.kind}` : ""}`}
                      style={{ gridColumn: ev.day + 2, gridRow: `${ev.row + ROW_HEIGHT_OFFSET} / span ${ev.span}` }}
                    >
                      <strong>{ev.title}</strong>
                      <span>{ev.note}</span>
                    </div>
                  ))}
                </div>
              </div>
              <figcaption className="fl-sr">A week of classes and private sessions, with seats taken shown on each booking.</figcaption>
            </figure>
          </div>
        </section>

        <section className="fl-section" style={{ paddingBlock: "var(--space-7)", borderBlock: "1px solid var(--color-border)" }} aria-labelledby="hp-saas-int">
          <div className="fl-wrap" style={{ display: "grid", gap: "var(--space-4)", textAlign: "center" }}>
            <h2 id="hp-saas-int" className="fl-meta" style={{ margin: 0, fontWeight: "var(--weight-medium)" }}>
              Connects to the tools you already use
            </h2>
            <ul className="fl-hp-list fl-hp-integrations">
              {d.integrations.map((name) => (
                <li key={name}>
                  <Icon name="layers" />
                  {name}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="fl-section" id="hp-saas-features" aria-labelledby="hp-saas-feat-title">
          <div className="fl-wrap">
            <div className="fl-head">
              <p className="fl-eyebrow">Features</p>
              <h2 id="hp-saas-feat-title" className="fl-title">
                {d.featuresTitle}
              </h2>
            </div>
            <ul className="fl-hp-list fl-hp-bento">
              {d.features.map((f) => (
                <li key={f.title} className={`fl-card${f.size ? ` fl-hp-bento__${f.size}` : ""}`}>
                  <span className="fl-icon">
                    <Icon name={f.icon} />
                  </span>
                  <h3>{f.title}</h3>
                  <p className="fl-text">{f.text}</p>
                  {f.meter ? (
                    <div className="fl-hp-meter" aria-label="This week's fill rate by class">
                      {d.meter.map((m) => (
                        <div key={m.label}>
                          <span>{m.label}</span>
                          <i aria-hidden="true">
                            <b style={{ width: `${m.value}%` }} />
                          </i>
                          <span className="fl-meta">{m.value}%</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="fl-section fl-section--tint" id="hp-saas-how" aria-labelledby="hp-saas-how-title">
          <div className="fl-wrap">
            <div className="fl-head fl-head--center">
              <p className="fl-eyebrow">How it works</p>
              <h2 id="hp-saas-how-title" className="fl-title">
                {d.howTitle}
              </h2>
            </div>
            <div className="fl-hp-tabs" role="tablist" aria-label="How Slotwise works" onKeyDown={onTabKey} style={{ maxWidth: "32rem", marginInline: "auto" }}>
              {d.how.map((h, i) => (
                <button
                  key={h.tab}
                  id={`hp-saas-tab-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={tab === i}
                  aria-controls="hp-saas-panel"
                  tabIndex={tab === i ? 0 : -1}
                  onClick={() => setTab(i)}
                >
                  {i + 1}. {h.tab}
                </button>
              ))}
            </div>
            <div id="hp-saas-panel" role="tabpanel" aria-labelledby={`hp-saas-tab-${tab}`} className="fl-split">
              <div style={{ display: "grid", gap: "var(--space-4)" }}>
                <h3 className="fl-title fl-title--md">{active.title}</h3>
                <p className="fl-text">{active.text}</p>
                <ul className="fl-checks">
                  {active.points.map((p) => (
                    <li key={p}>
                      <Tick />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <dl className="fl-hp-ticket" style={{ margin: 0 }}>
                {active.ticket.map(([k, v]) => (
                  <div key={k} className="fl-hp-ticket__row">
                    <dt className="fl-meta">{k}</dt>
                    <dd style={{ margin: 0, fontWeight: "var(--weight-semibold)" }}>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <section className="fl-section" id="hp-saas-pricing" aria-labelledby="hp-saas-price-title">
          <div className="fl-wrap">
            <div className="fl-head fl-head--center">
              <p className="fl-eyebrow">Pricing</p>
              <h2 id="hp-saas-price-title" className="fl-title">
                {d.pricingTitle}
              </h2>
              <div className="fl-toggle" role="group" aria-label="Billing period">
                <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>
                  Monthly
                </button>
                <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>
                  Yearly · {d.saving}
                </button>
              </div>
            </div>
            <ul className="fl-hp-list fl-grid fl-grid--3" aria-live="polite">
              {d.plans.map((p) => (
                <li key={p.name} className={`fl-card${p.featured ? " fl-card--featured" : ""}`} style={{ gap: "var(--space-4)" }}>
                  {p.featured ? <span className="fl-badge">Most studios pick this</span> : null}
                  <h3>{p.name}</h3>
                  <p className="fl-price" style={{ margin: 0 }}>
                    <strong>{yearly ? p.yearly : p.monthly}</strong>
                    <span className="fl-meta">{yearly ? "/year" : "/month"}</span>
                  </p>
                  <p className="fl-text">{p.text}</p>
                  <ul className="fl-checks">
                    {p.features.map((f) => (
                      <li key={f}>
                        <Tick />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <a className={`fl-btn ${p.featured ? "fl-btn--primary" : "fl-btn--secondary"}`} href="#hp-saas-trial">
                    Try {p.name} free
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="fl-section fl-section--tint" id="hp-saas-faq" aria-labelledby="hp-saas-faq-title">
          <div className="fl-wrap fl-split fl-split--start">
            <div className="fl-head" style={{ marginBottom: 0 }}>
              <p className="fl-eyebrow">Questions</p>
              <h2 id="hp-saas-faq-title" className="fl-title">
                {d.faqTitle}
              </h2>
              <p className="fl-text">
                Something else? <a className="fl-link" href="#help">Ask the team</a>, we answer within a working day.
              </p>
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

        <section className="fl-section" id="hp-saas-trial" aria-labelledby="hp-saas-cta-title">
          <div className="fl-wrap fl-wrap--narrow fl-card fl-bg-glow" style={{ padding: "var(--space-8) var(--space-6)", textAlign: "center", justifyItems: "center" }}>
            <h2 id="hp-saas-cta-title" className="fl-title">
              {d.ctaTitle}
            </h2>
            <p className="fl-lede">{d.ctaText}</p>
            {done ? (
              <p className="fl-done" role="status">
                You're in. Check {email.trim()} for your sign-in link.
              </p>
            ) : (
              <form className="fl-inline-form" onSubmit={submit} noValidate style={{ width: "100%", maxWidth: "30rem", justifyContent: "center" }}>
                <label htmlFor="hp-saas-email" className="fl-sr">
                  Work email
                </label>
                <input
                  id="hp-saas-email"
                  className="fl-input"
                  type="email"
                  autoComplete="email"
                  placeholder="you@yourstudio.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "hp-saas-email-error" : "hp-saas-email-note"}
                />
                <button type="submit" className="fl-btn fl-btn--primary">
                  {d.cta}
                </button>
              </form>
            )}
            <div aria-live="polite">
              {error && !done ? (
                <p id="hp-saas-email-error" className="fl-hp-error">
                  {error}
                </p>
              ) : !done ? (
                <p id="hp-saas-email-note" className="fl-note">
                  We'll only email about your trial.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      <footer className="fl-footer">
        <div className="fl-wrap">
          <div className="fl-footer__cols">
            <div style={{ display: "grid", gap: "var(--space-3)", alignContent: "start" }}>
              <a className="fl-nav__brand" href="#top">
                {d.brand}
              </a>
              <p className="fl-text">{d.footer.blurb}</p>
            </div>
            {d.footer.cols.map((c) => (
              <nav key={c.title} aria-label={c.title}>
                <h4>{c.title}</h4>
                <ul>
                  {c.links.map((l) => (
                    <li key={l}>
                      <a href="#top">{l}</a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
          <div className="fl-footer__base">
            <span>{d.footer.base}</span>
            <span>
              <a href="#privacy">Privacy</a> · <a href="#terms">Terms</a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
