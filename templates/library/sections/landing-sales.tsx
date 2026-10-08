/**
 * Page template: long-form sales page for one product or course. A reading-width column that walks the visitor from
 * the problem to the outcome, then shows what's included week by week, the price (pay once or in three parts), the
 * guarantee and the FAQ, with the same "Enrol" action repeated. Suits online courses, coaching programmes, workshops
 * and digital products. Enrolling is a prototype: it checks the email and shows a confirmation, nothing is charged or
 * sent. Make it the app's own: replace SAMPLE with the real offer, keep the section order, and cut any section the
 * offer can't honestly fill.
 */
import { useState, type FormEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  brand: "Ledger & Loom",
  enrol: "Enrol now",
  eyebrow: "Six-week online course · Next cohort starts 9 November",
  title: "Books that balance themselves, for studios that would rather be making things",
  lede: "A calm, practical bookkeeping course for small creative studios. One hour a week, real numbers, and a system you'll still be using next year.",
  heroNote: "112 seats · 38 left",
  problemTitle: "If the end of the month feels like this, you're not alone",
  problems: [
    "Receipts live in three inboxes, a drawer and the glovebox.",
    "You find out how the quarter went when your accountant sends the bill.",
    "Tax time costs you a full weekend and at least one argument.",
    "You're not sure which clients actually make you money.",
  ],
  story: [
    "Most studios don't have a money problem. They have a habit problem: the books only get opened when something is due, so every session starts from chaos.",
    "This course swaps the yearly scramble for a fifteen-minute Friday routine. By week six you'll have clean books, a monthly profit snapshot and a tax pot that fills itself.",
  ],
  before: { title: "Before", items: ["Shoebox of receipts", "Guessing at profit", "Tax panic every spring", "Pricing by gut feel"] },
  after: { title: "After six weeks", items: ["Every receipt filed in a minute", "Profit by client, every month", "Tax set aside automatically", "Prices backed by real numbers"] },
  modulesTitle: "What's included",
  modules: [
    { week: "Week 1", title: "One inbox for money", text: "Set up a single place for receipts and invoices.", lessons: ["Choosing a bank setup that works", "The receipt-capture habit", "Clearing the backlog in one sitting"] },
    { week: "Week 2", title: "Categories that make sense", text: "A short chart of accounts written for studios.", lessons: ["Twelve categories, not sixty", "Splitting materials from overheads", "Mileage and home-office costs"] },
    { week: "Week 3", title: "The Friday fifteen", text: "The weekly routine that keeps everything current.", lessons: ["Reconciling in fifteen minutes", "Chasing unpaid invoices kindly", "What to do when you miss a week"] },
    { week: "Week 4", title: "Profit by client", text: "See which projects are worth repeating.", lessons: ["Tracking time against fees", "The client profit table", "Spotting scope creep early"] },
    { week: "Week 5", title: "The tax pot", text: "Set money aside before you can spend it.", lessons: ["Working out your percentage", "Quarterly estimates without stress", "Handing clean books to your accountant"] },
    { week: "Week 6", title: "Your monthly snapshot", text: "One page that tells you how the studio is doing.", lessons: ["Five numbers worth watching", "Setting next quarter's targets", "Keeping the habit for good"] },
  ],
  bonuses: ["Spreadsheet templates for every lesson", "Two live Q&A calls with the tutor", "Private forum for this cohort", "Lifetime access to recordings"],
  price: {
    title: "Join the November cohort",
    full: { label: "Pay once", amount: "$390", was: "$450", note: "Save $60 with a single payment" },
    split: { label: "3 payments", amount: "$140", per: "/ month", note: "Three monthly payments, $420 in total" },
    includes: ["Six weekly lessons (about 40 minutes each)", "All templates and checklists", "Two live Q&A calls", "Certificate of completion"],
    done: "You're on the list for the November cohort. We've saved your seat and will email joining details before 2 November.",
  },
  guarantee: {
    title: "The 30-day 'books or money back' promise",
    text: "Do the first three weeks. If your books aren't in better shape than when you started, email us within 30 days and we'll refund every cent. No forms, no questions.",
  },
  tutor: { initials: "RV", name: "Rosa Vint", role: "Bookkeeper for 140 small studios since 2014" },
  faqTitle: "Questions people ask before enrolling",
  faqs: [
    { q: "Do I need accounting software?", a: "No. Every lesson works with a spreadsheet. If you already use bookkeeping software, we show where each step lives in it." },
    { q: "How much time does it take each week?", a: "About an hour: a 40-minute lesson and a short task. After the course, the routine takes fifteen minutes a week." },
    { q: "What if I miss a live call?", a: "Both calls are recorded and posted within a day, and you can send questions in advance." },
    { q: "Is this tax advice?", a: "No. The course teaches bookkeeping habits. For tax decisions, take your clean books to a qualified accountant." },
  ],
  closing: { title: "Six weeks from now, Friday could be the easy day", lede: "Seats close on 6 November or when the cohort is full." },
  footer: { copy: "© 2026 Ledger & Loom", links: [{ label: "Terms", href: "#terms" }, { label: "Refund policy", href: "#refunds" }, { label: "Contact", href: "#contact" }] },
};

function Chevron() {
  return (
    <svg className="fl-ld-module__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function Cross() {
  return (
    <span className="fl-ld-x" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" aria-hidden="true">
        <path d="M7 7l10 10M17 7 7 17" />
      </svg>
    </span>
  );
}

function Seal() {
  return (
    <svg className="fl-ld-seal" viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <circle cx="60" cy="60" r="54" strokeDasharray="4 5" />
      <circle cx="60" cy="60" r="44" />
      <path d="M42 61l12 12 25-27" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function LandingSales() {
  const d = SAMPLE;
  const [openWeek, setOpenWeek] = useState<string | null>(d.modules[0].week);
  const [plan, setPlan] = useState<"full" | "split">("full");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [enrolled, setEnrolled] = useState(false);
  const p = d.price[plan];

  const enrol = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) return setError("Add the email you'd like your course login sent to.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return setError("That email looks incomplete, for example name@studio.com.");
    setError("");
    try {
      localStorage.setItem("landing-sales", JSON.stringify({ email: value, plan, at: new Date().toISOString() }));
    } catch {
      /* storage unavailable: the confirmation still shows */
    }
    setEnrolled(true);
  };

  return (
    <div className="fl-ld-page">
      <header className="fl-ld-bar fl-ld-bar--line" style={{ position: "sticky", top: 0, zIndex: 10 }}>
        <a className="fl-ld-brand" href="#top">
          <span className="fl-ld-brand__mark">
            <Icon name="chart" />
          </span>
          {d.brand}
        </a>
        <a className="fl-btn fl-btn--primary" href="#enrol" style={{ minHeight: "var(--control-md)" }}>
          {d.enrol}
        </a>
      </header>

      <main id="top">
        <section className="fl-section fl-bg-soft" aria-labelledby="ld-sales-title">
          <div className="fl-wrap fl-wrap--narrow fl-ld-sales-hero">
            <span className="fl-eyebrow">{d.eyebrow}</span>
            <h1 id="ld-sales-title" className="fl-title fl-title--xl">
              {d.title}
            </h1>
            <p className="fl-lede">{d.lede}</p>
            <div className="fl-actions">
              <a className="fl-btn fl-btn--primary" href="#enrol">
                {d.enrol} · {d.price.full.amount}
              </a>
              <a className="fl-btn fl-btn--secondary" href="#curriculum">
                See the six weeks
              </a>
            </div>
            <span className="fl-badge">{d.heroNote}</span>
          </div>
        </section>

        <section className="fl-section" aria-labelledby="ld-sales-problem">
          <div className="fl-wrap fl-wrap--narrow" style={{ display: "grid", gap: "var(--space-7)" }}>
            <h2 id="ld-sales-problem" className="fl-title">
              {d.problemTitle}
            </h2>
            <ul className="fl-ld-pains">
              {d.problems.map((t) => (
                <li key={t}>
                  <Cross />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <div className="fl-ld-prose">
              {d.story.map((s) => (
                <p key={s}>{s}</p>
              ))}
            </div>
            <div className="fl-ld-compare">
              {[d.before, d.after].map((col, i) => (
                <div key={col.title} className="fl-card">
                  <h3>{col.title}</h3>
                  <ul className={i === 0 ? "fl-ld-pains" : "fl-checks"}>
                    {col.items.map((it) => (
                      <li key={it}>
                        {i === 0 ? (
                          <Cross />
                        ) : (
                          <span className="fl-tick" aria-hidden="true">
                            <Icon name="check" />
                          </span>
                        )}
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="fl-section fl-section--tint" id="curriculum" aria-labelledby="ld-sales-modules">
          <div className="fl-wrap fl-wrap--narrow">
            <div className="fl-head">
              <span className="fl-eyebrow">The curriculum</span>
              <h2 id="ld-sales-modules" className="fl-title">
                {d.modulesTitle}
              </h2>
            </div>
            <ol className="fl-ld-modules">
              {d.modules.map((m) => {
                const open = openWeek === m.week;
                const id = `ld-sales-${m.week.replace(/\s/g, "-").toLowerCase()}`;
                return (
                  <li key={m.week} className="fl-ld-module">
                    <h3>
                      <button type="button" className="fl-ld-module__btn" aria-expanded={open} aria-controls={id} onClick={() => setOpenWeek(open ? null : m.week)}>
                        <span className="fl-ld-module__week">{m.week}</span>
                        <span>{m.title}</span>
                        <Chevron />
                      </button>
                    </h3>
                    {open ? (
                      <div className="fl-ld-module__panel" id={id}>
                        {m.text}
                        <ul>
                          {m.lessons.map((l) => (
                            <li key={l}>{l}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
            <div className="fl-card" style={{ marginTop: "var(--space-6)" }}>
              <h3>Also included</h3>
              <ul className="fl-checks fl-grid fl-grid--2" style={{ gap: "var(--space-3)" }}>
                {d.bonuses.map((b) => (
                  <li key={b}>
                    <span className="fl-tick" aria-hidden="true">
                      <Icon name="check" />
                    </span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="fl-section" id="enrol" aria-labelledby="ld-sales-price">
          <div className="fl-wrap fl-wrap--narrow">
            <div className="fl-ld-pricecard">
              <h2 id="ld-sales-price" className="fl-title">
                {d.price.title}
              </h2>
              <div className="fl-toggle" role="group" aria-label="Payment option">
                {(["full", "split"] as const).map((k) => (
                  <button key={k} type="button" aria-pressed={plan === k} onClick={() => setPlan(k)}>
                    {d.price[k].label}
                  </button>
                ))}
              </div>
              <div aria-live="polite" style={{ display: "grid", gap: "var(--space-2)" }}>
                <div className="fl-ld-bigprice">
                  {plan === "full" ? <s>{d.price.full.was}</s> : null}
                  <strong>{p.amount}</strong>
                  {plan === "split" ? <span className="fl-meta">{d.price.split.per}</span> : null}
                </div>
                <span className="fl-meta">{p.note}</span>
              </div>
              <ul className="fl-checks">
                {d.price.includes.map((t) => (
                  <li key={t}>
                    <span className="fl-tick" aria-hidden="true">
                      <Icon name="check" />
                    </span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              {enrolled ? (
                <p className="fl-done" role="status">
                  {d.price.done}
                </p>
              ) : (
                <form className="fl-form" style={{ width: "100%", maxWidth: "26rem", textAlign: "left" }} onSubmit={enrol} noValidate>
                  <div className="fl-field">
                    <label htmlFor="ld-sales-email">Email for your course login</label>
                    <input
                      id="ld-sales-email"
                      className="fl-input"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? "ld-sales-email-err" : undefined}
                    />
                    {error ? (
                      <p className="fl-ld-error" id="ld-sales-email-err">
                        {error}
                      </p>
                    ) : null}
                  </div>
                  <button type="submit" className="fl-btn fl-btn--primary fl-ld-btn-block">
                    Reserve my seat · {p.amount}
                    {plan === "split" ? d.price.split.per : ""}
                  </button>
                  <p className="fl-ld-fine" style={{ textAlign: "center" }}>
                    You'll confirm payment on the next screen. Covered by the 30-day promise below.
                  </p>
                </form>
              )}
            </div>
          </div>
        </section>

        <section className="fl-section fl-section--tint" aria-labelledby="ld-sales-guarantee">
          <div className="fl-wrap fl-wrap--narrow fl-ld-guarantee">
            <Seal />
            <div style={{ display: "grid", gap: "var(--space-3)" }}>
              <h2 id="ld-sales-guarantee" className="fl-title fl-title--md">
                {d.guarantee.title}
              </h2>
              <p className="fl-text">{d.guarantee.text}</p>
              <div className="fl-person">
                <span className="fl-person__avatar" aria-hidden="true">
                  {d.tutor.initials}
                </span>
                <span>
                  <strong>{d.tutor.name}</strong>
                  <span>{d.tutor.role}</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="fl-section" aria-labelledby="ld-sales-faq">
          <div className="fl-wrap fl-wrap--narrow">
            <div className="fl-head">
              <h2 id="ld-sales-faq" className="fl-title">
                {d.faqTitle}
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

        <section className="fl-section fl-section--accent" aria-labelledby="ld-sales-close">
          <div className="fl-wrap fl-head fl-head--center" style={{ marginBottom: 0 }}>
            <h2 id="ld-sales-close" className="fl-title">
              {d.closing.title}
            </h2>
            <p className="fl-lede">{d.closing.lede}</p>
            <div className="fl-actions">
              <a className="fl-btn fl-btn--on-accent" href="#enrol">
                {d.enrol}
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
