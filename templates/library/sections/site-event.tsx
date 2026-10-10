/** @flowcode-library site-event · Conference site (Industry sites)
 * Use cases: conference website; event schedule; agenda; speaker lineup; event tickets; summit; festival; meetup
 * Jobs to be done: plan which sessions to attend; see who is speaking; buy tickets for the event; find out how to get there
 * Keywords: page, event, conference, summit, schedule, agenda, tabs, speakers, tickets, travel, faq, html5up
 */
/**
 * Site: conference / event. A one-page site for a conference, festival, summit or meetup: a full-height hero with the
 * date and venue, a statement band with the headline numbers, the schedule by day in tabs (sessions can be saved to
 * "My agenda", kept in local storage), keynote speakers in alternating spotlights plus the wider line-up, tickets with
 * a quantity picker that holds a reservation without payment, and travel and access information.
 * Layout adapted from HTML5 UP "Fractal" (html5up.net, CC BY 3.0); keep the credit.
 * Make it the app's own: replace SAMPLE with the event's real days, sessions, speakers and ticket types; connect the
 * reservation to the checkout the PRD describes.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  brand: "Fieldwork 27",
  links: [
    { label: "Schedule", href: "#ev-schedule" },
    { label: "Speakers", href: "#ev-speakers" },
    { label: "Tickets", href: "#ev-tickets" },
    { label: "Travel", href: "#ev-travel" },
  ],
  hero: {
    eyebrow: "The design research conference",
    title: "Fieldwork 2027",
    lede: "Two days of talks and workshops on learning from the people you design for. Practical, honest, and no sales pitches on stage.",
    facts: [
      { icon: "clock", label: "When", value: "13–14 May 2027" },
      { icon: "pin", label: "Where", value: "Harbourside Hall, Port Ellery" },
      { icon: "users", label: "Who", value: "600 researchers and designers" },
    ],
  },
  statement: {
    title: "Small enough to meet people. Big enough to learn something new.",
    lede: "One main stage, one studio for deep dives, and hands-on workshops that cap at twenty.",
    figures: [
      { value: "24", label: "talks" },
      { value: "6", label: "workshops" },
      { value: "31", label: "speakers" },
      { value: "2", label: "evening socials" },
    ],
  },
  schedule: {
    title: "Schedule",
    lede: "Star a session to add it to My agenda. Times are local.",
    days: [
      {
        id: "d1",
        label: "Day 1",
        date: "Thu 13 May",
        sessions: [
          { id: "d1-1", time: "08:30", title: "Registration and coffee", speaker: "", track: "Foyer", kind: "break" },
          { id: "d1-2", time: "09:30", title: "Opening keynote: Research that changes decisions", speaker: "Adaeze Morgan", track: "Main stage", kind: "talk" },
          { id: "d1-3", time: "10:30", title: "Recruiting participants who aren't the usual suspects", speaker: "Kenji Albrecht", track: "Main stage", kind: "talk" },
          { id: "d1-4", time: "10:30", title: "Workshop: Running a diary study in two weeks", speaker: "Priya Lindqvist", track: "Workshop room", kind: "talk" },
          { id: "d1-5", time: "12:30", title: "Lunch on the terrace", speaker: "", track: "Terrace", kind: "break" },
          { id: "d1-6", time: "13:30", title: "Synthesis without sticky notes", speaker: "Rosa Delacroix", track: "Studio", kind: "talk" },
          { id: "d1-7", time: "15:00", title: "Panel: Research ops in teams of one", speaker: "Four speakers", track: "Main stage", kind: "talk" },
          { id: "d1-8", time: "18:30", title: "Harbour walk and welcome drinks", speaker: "", track: "Meet at the foyer", kind: "break" },
        ],
      },
      {
        id: "d2",
        label: "Day 2",
        date: "Fri 14 May",
        sessions: [
          { id: "d2-1", time: "09:00", title: "Breakfast and unconference board", speaker: "", track: "Foyer", kind: "break" },
          { id: "d2-2", time: "09:45", title: "Keynote: What accessibility research taught me about everything else", speaker: "Tomasz Okonkwo", track: "Main stage", kind: "talk" },
          { id: "d2-3", time: "11:00", title: "Measuring the value of research to people who hold budgets", speaker: "Helen Marsh", track: "Main stage", kind: "talk" },
          { id: "d2-4", time: "11:00", title: "Workshop: Interviewing when you don't share a language", speaker: "Samira Haddad", track: "Workshop room", kind: "talk" },
          { id: "d2-5", time: "12:30", title: "Lunch", speaker: "", track: "Terrace", kind: "break" },
          { id: "d2-6", time: "14:00", title: "Field notes from rural health services", speaker: "Owen Batista", track: "Studio", kind: "talk" },
          { id: "d2-7", time: "16:00", title: "Closing keynote: Staying curious for twenty years", speaker: "Mei Fontaine", track: "Main stage", kind: "talk" },
        ],
      },
    ],
  },
  speakers: {
    title: "Speakers",
    lede: "Researchers from public services, small studios, charities and product teams.",
    keynotes: [
      { initials: "AM", name: "Adaeze Morgan", role: "Head of research, a national transport service", talk: "Research that changes decisions", bio: "Adaeze built a research team of forty inside a public body and will show the three habits that made leaders listen." },
      { initials: "TO", name: "Tomasz Okonkwo", role: "Accessibility researcher, independent", talk: "What accessibility research taught me about everything else", bio: "A decade of studies with disabled people, and why the lessons apply to every product you'll ever ship." },
      { initials: "MF", name: "Mei Fontaine", role: "Research director, a design studio", talk: "Staying curious for twenty years", bio: "On keeping your craft sharp, avoiding burnout and teaching the next generation of researchers." },
    ],
    others: [
      { initials: "KA", name: "Kenji Albrecht", role: "Recruitment lead" },
      { initials: "PL", name: "Priya Lindqvist", role: "Senior researcher" },
      { initials: "RD", name: "Rosa Delacroix", role: "Service designer" },
      { initials: "HM", name: "Helen Marsh", role: "ResearchOps manager" },
      { initials: "SH", name: "Samira Haddad", role: "Multilingual researcher" },
      { initials: "OB", name: "Owen Batista", role: "Health researcher" },
    ],
  },
  tickets: {
    title: "Tickets",
    lede: "Prices include lunch both days, the evening socials and recordings of every talk.",
    types: [
      { id: "early", name: "Early bird", price: 319, note: "Both days, in person", soldOut: true, max: 10 },
      { id: "standard", name: "Standard", price: 425, note: "Both days, in person", soldOut: false, max: 10 },
      { id: "student", name: "Student", price: 125, note: "Valid student ID at the door", soldOut: false, max: 1 },
      { id: "online", name: "Online pass", price: 79, note: "Live stream and recordings", soldOut: false, max: 10 },
    ],
  },
  travel: {
    title: "Getting there",
    cards: [
      { icon: "arrow", title: "By train", text: "Port Ellery Central is a 9-minute walk along the harbour. Direct trains from the capital every hour, about 2h 10m." },
      { icon: "globe", title: "By air or car", text: "Ellery Airport is 25 minutes by the X4 bus. Driving? The Quayside parking garage is $16 a day; there are no spaces at the hall." },
      { icon: "layers", title: "Where to stay", text: "Three hotels within ten minutes' walk hold rooms for us until 1 April. Quote FIELDWORK27 for 15% off." },
    ],
    faq: [
      { q: "Is the venue accessible?", a: "Yes. Step-free access throughout, a hearing loop on the main stage, live captions on every talk and a quiet room on the first floor." },
      { q: "Can I bring my baby or child?", a: "Babies in arms are welcome in every session. We run a free crèche for ages 2 to 8; book a place when you buy your ticket." },
      { q: "What's the refund policy?", a: "Full refund until 13 April. After that, you can transfer your ticket to a colleague for free at any time." },
    ],
  },
  footer: "© 2027 Fieldwork Conference · Code of conduct applies to everyone, everywhere at the event",
};

type Session = (typeof SAMPLE.schedule.days)[number]["sessions"][number];
const STORE = "ev-agenda";

export default function SiteEvent() {
  const d = SAMPLE;
  const [menuOpen, setMenuOpen] = useState(false);
  const tabs = [...d.schedule.days.map((x) => ({ id: x.id, label: x.label, sub: x.date })), { id: "mine", label: "My agenda", sub: "" }];
  const [tab, setTab] = useState(tabs[0].id);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [saved, setSaved] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORE) ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(saved));
    } catch {
      /* storage unavailable: the agenda lasts for this visit */
    }
  }, [saved]);

  const [ticket, setTicket] = useState("standard");
  const [qty, setQty] = useState(1);
  const [held, setHeld] = useState<{ ref: string; name: string; qty: number; total: number } | null>(null);
  const chosen = d.tickets.types.find((t) => t.id === ticket) ?? d.tickets.types[1];
  const qtyClamped = Math.min(qty, chosen.max);

  const toggleSave = (id: string) => setSaved((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let n = -1;
    if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
    if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
    if (e.key === "Home") n = 0;
    if (e.key === "End") n = tabs.length - 1;
    if (n < 0) return;
    e.preventDefault();
    setTab(tabs[n].id);
    tabRefs.current[n]?.focus();
  };

  const all: (Session & { day: string })[] = d.schedule.days.flatMap((x) => x.sessions.map((s) => ({ ...s, day: x.date })));
  const list = tab === "mine" ? all.filter((s) => saved.includes(s.id)) : all.filter((s) => s.id.startsWith(tab + "-"));
  const reserve = () => {
    const ref = `FW27-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    setHeld({ ref, name: chosen.name, qty: qtyClamped, total: chosen.price * qtyClamped });
  };

  return (
    <div className="fl-st2-page" id="top">
      <header className="fl-st2-bar">
        <nav className="fl-st2-bar__row" aria-label="Main">
          <a className="fl-st2-brand" href="#top">
            <Icon name="sparkle" />
            {d.brand}
          </a>
          <ul className="fl-st2-links" id="ev-links" data-open={menuOpen}>
            {d.links.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setMenuOpen(false)}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="fl-st2-bar__end">
            <a className="fl-btn fl-btn--primary" href="#ev-tickets">
              Get tickets
            </a>
            <button type="button" className="fl-btn fl-btn--secondary fl-st2-burger" aria-expanded={menuOpen} aria-controls="ev-links" aria-label="Menu" onClick={() => setMenuOpen((o) => !o)}>
              <Icon name="menu" />
            </button>
          </div>
        </nav>
      </header>

      <main>
        <section className="fl-st2-hero fl-bg-mesh" aria-labelledby="ev-title">
          <div className="fl-wrap fl-split">
            <div className="fl-head" style={{ marginBottom: 0, gap: "var(--space-5)" }}>
              <span className="fl-eyebrow">{d.hero.eyebrow}</span>
              <h1 id="ev-title" className="fl-title fl-title--xl">
                {d.hero.title}
              </h1>
              <p className="fl-lede">{d.hero.lede}</p>
              <ul className="fl-st2-facts">
                {d.hero.facts.map((f) => (
                  <li key={f.label}>
                    <span className="fl-icon">
                      <Icon name={f.icon} />
                    </span>
                    <span>
                      <span className="fl-st2-facts__label">{f.label}</span>
                      <span className="fl-st2-facts__value">{f.value}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="fl-actions">
                <a className="fl-btn fl-btn--primary" href="#ev-tickets">
                  Get your ticket
                </a>
                <a className="fl-btn fl-btn--secondary" href="#ev-schedule">
                  See the schedule
                </a>
              </div>
            </div>
            <svg className="fl-st2-ticketart" viewBox="0 0 320 220" aria-hidden="true">
              <rect x="34" y="36" width="260" height="150" rx="18" transform="rotate(-6 164 111)" style={{ fill: "color-mix(in srgb, var(--color-accent) 22%, var(--color-surface))" }} />
              <rect x="20" y="30" width="270" height="150" rx="18" style={{ fill: "var(--color-surface)", stroke: "var(--color-border)" }} />
              <line x1="200" y1="44" x2="200" y2="166" strokeDasharray="6 6" style={{ stroke: "var(--color-border-strong)" }} strokeWidth="2" />
              <rect x="44" y="58" width="120" height="14" rx="7" style={{ fill: "var(--color-accent)" }} />
              <rect x="44" y="86" width="90" height="10" rx="5" style={{ fill: "var(--color-text-muted)", opacity: 0.5 }} />
              <rect x="44" y="106" width="130" height="10" rx="5" style={{ fill: "var(--color-text-muted)", opacity: 0.35 }} />
              <rect x="44" y="140" width="56" height="20" rx="10" style={{ fill: "color-mix(in srgb, var(--color-success) 25%, transparent)" }} />
              <circle cx="245" cy="88" r="22" style={{ fill: "none", stroke: "var(--color-accent)" }} strokeWidth="3" />
              <path d="M235 88l7 7 13-14" style={{ fill: "none", stroke: "var(--color-accent)" }} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="222" y="128" width="46" height="10" rx="5" style={{ fill: "var(--color-text-muted)", opacity: 0.35 }} />
            </svg>
          </div>
        </section>

        <section className="fl-section fl-section--tint fl-st2-statement" aria-labelledby="ev-statement">
          <div className="fl-wrap">
            <div className="fl-head fl-head--center">
              <h2 id="ev-statement" className="fl-title fl-title--md">
                {d.statement.title}
              </h2>
              <p className="fl-lede">{d.statement.lede}</p>
            </div>
            <dl className="fl-st2-figures">
              {d.statement.figures.map((f) => (
                <div key={f.label} className="fl-stat" style={{ justifyItems: "center" }}>
                  <dt style={{ order: 2 }}>
                    <span>{f.label}</span>
                  </dt>
                  <dd style={{ margin: 0, order: 1 }}>
                    <strong>{f.value}</strong>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="fl-section" id="ev-schedule" aria-labelledby="ev-sched-title">
          <div className="fl-wrap">
            <div className="fl-head">
              <h2 id="ev-sched-title" className="fl-title">
                {d.schedule.title}
              </h2>
              <p className="fl-lede">{d.schedule.lede}</p>
            </div>
            <div className="fl-st2-tablist" role="tablist" aria-label="Schedule days">
              {tabs.map((t, i) => (
                <button
                  key={t.id}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`ev-tab-${t.id}`}
                  aria-selected={tab === t.id}
                  aria-controls="ev-panel"
                  tabIndex={tab === t.id ? 0 : -1}
                  className="fl-st2-tabbtn"
                  onClick={() => setTab(t.id)}
                  onKeyDown={(e) => onTabKey(e, i)}
                >
                  {t.label}
                  <small>{t.id === "mine" ? `${saved.length} saved` : t.sub}</small>
                </button>
              ))}
            </div>
            <div id="ev-panel" role="tabpanel" aria-labelledby={`ev-tab-${tab}`} tabIndex={0}>
              {list.length === 0 ? (
                <div className="fl-st2-empty">
                  <strong>Your agenda is empty.</strong>
                  <span>Star sessions on Day 1 or Day 2 and they'll appear here, in time order.</span>
                  <button type="button" className="fl-btn fl-btn--secondary" onClick={() => setTab("d1")}>
                    Browse Day 1
                  </button>
                </div>
              ) : (
                <ol className="fl-st2-agenda">
                  {list.map((s) => {
                    const isSaved = saved.includes(s.id);
                    return (
                      <li key={s.id} className={s.kind === "break" ? "fl-st2-slot fl-st2-slot--break" : "fl-st2-slot"}>
                        <time>
                          {tab === "mine" ? `${s.day.slice(0, 3)} ` : ""}
                          {s.time}
                        </time>
                        <div>
                          <h3>{s.title}</h3>
                          <span className="fl-meta">
                            {s.speaker ? `${s.speaker} · ` : ""}
                            {s.track}
                          </span>
                        </div>
                        {s.kind === "talk" ? (
                          <button type="button" className="fl-st2-save" aria-pressed={isSaved} aria-label={`${isSaved ? "Remove" : "Save"} “${s.title}” ${isSaved ? "from" : "to"} My agenda`} onClick={() => toggleSave(s.id)}>
                            <svg viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" aria-hidden="true">
                              <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
                            </svg>
                          </button>
                        ) : (
                          <span />
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
              <p className="fl-sr" aria-live="polite">
                {saved.length} sessions in My agenda
              </p>
            </div>
          </div>
        </section>

        <section className="fl-section fl-section--tint" id="ev-speakers" aria-labelledby="ev-spk-title">
          <div className="fl-wrap">
            <div className="fl-head fl-head--center">
              <h2 id="ev-spk-title" className="fl-title">
                {d.speakers.title}
              </h2>
              <p className="fl-lede">{d.speakers.lede}</p>
            </div>
            <div className="fl-st2-spots">
              {d.speakers.keynotes.map((k) => (
                <article key={k.name} className="fl-st2-spot">
                  <div className="fl-st2-spot__media" aria-hidden="true">
                    {k.initials}
                  </div>
                  <div className="fl-st2-spot__body">
                    <span className="fl-badge">Keynote</span>
                    <h3 className="fl-title fl-title--md">{k.name}</h3>
                    <p className="fl-meta" style={{ margin: 0 }}>
                      {k.role}
                    </p>
                    <p style={{ margin: 0, fontWeight: "var(--weight-semibold)" }}>“{k.talk}”</p>
                    <p className="fl-text">{k.bio}</p>
                  </div>
                </article>
              ))}
            </div>
            <h3 className="fl-eyebrow" style={{ margin: "var(--space-8) 0 var(--space-5)" }}>
              Also speaking
            </h3>
            <ul className="fl-grid fl-grid--3" style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {d.speakers.others.map((p) => (
                <li key={p.name} className="fl-person">
                  <span className="fl-person__avatar" aria-hidden="true">
                    {p.initials}
                  </span>
                  <span>
                    <strong>{p.name}</strong>
                    <span>{p.role}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="fl-section fl-bg-dots" id="ev-tickets" aria-labelledby="ev-tix-title">
          <div className="fl-wrap">
            <div className="fl-head fl-head--center">
              <h2 id="ev-tix-title" className="fl-title">
                {d.tickets.title}
              </h2>
              <p className="fl-lede">{d.tickets.lede}</p>
            </div>
            <div aria-live="polite">
              {held ? (
                <div className="fl-card fl-wrap--narrow" style={{ marginInline: "auto" }}>
                  <p className="fl-done" role="status">
                    Held: {held.qty} × {held.name} ({`$${held.total.toLocaleString("en-US")}`}), reference {held.ref}. We'll keep them for 15 minutes.
                  </p>
                  <p className="fl-note" style={{ margin: 0 }}>
                    This is a preview, so no payment is taken. On the live site you'd now go to a secure checkout.
                  </p>
                  <button type="button" className="fl-btn fl-btn--secondary" style={{ justifySelf: "start" }} onClick={() => setHeld(null)}>
                    Change tickets
                  </button>
                </div>
              ) : (
                <>
                  <fieldset className="fl-st2-tickets">
                    <legend className="fl-sr">Ticket type</legend>
                    {d.tickets.types.map((t) => (
                      <label key={t.id} className="fl-st2-ticket">
                        <input type="radio" name="ev-ticket" value={t.id} checked={ticket === t.id} disabled={t.soldOut} onChange={() => setTicket(t.id)} />
                        <span style={{ fontWeight: "var(--weight-semibold)" }}>{t.name}</span>
                        <strong>${t.price}</strong>
                        <span className="fl-meta">{t.note}</span>
                        {t.soldOut ? <span className="fl-st2-pill fl-st2-pill--muted">Sold out</span> : null}
                      </label>
                    ))}
                  </fieldset>
                  <div className="fl-st2-checkout">
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", flexWrap: "wrap" }}>
                      <span id="ev-qty-label" style={{ fontWeight: "var(--weight-semibold)" }}>
                        Quantity
                      </span>
                      <div className="fl-st2-stepper" role="group" aria-labelledby="ev-qty-label">
                        <button type="button" aria-label="One fewer" disabled={qtyClamped <= 1} onClick={() => setQty(Math.max(1, qtyClamped - 1))}>
                          −
                        </button>
                        <output aria-live="polite">{qtyClamped}</output>
                        <button type="button" aria-label="One more" disabled={qtyClamped >= chosen.max} onClick={() => setQty(Math.min(chosen.max, qtyClamped + 1))}>
                          +
                        </button>
                      </div>
                      {chosen.max === 1 ? <span className="fl-meta">One student ticket per person</span> : null}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-5)", flexWrap: "wrap" }}>
                      <span>
                        <span className="fl-meta">Total </span>
                        <span className="fl-st2-total">${(chosen.price * qtyClamped).toLocaleString("en-US")}</span>
                      </span>
                      <button type="button" className="fl-btn fl-btn--primary" onClick={reserve}>
                        Reserve {qtyClamped} {qtyClamped === 1 ? "ticket" : "tickets"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="fl-section" id="ev-travel" aria-labelledby="ev-travel-title">
          <div className="fl-wrap">
            <div className="fl-head">
              <h2 id="ev-travel-title" className="fl-title">
                {d.travel.title}
              </h2>
            </div>
            <div className="fl-grid fl-grid--3">
              {d.travel.cards.map((c) => (
                <article key={c.title} className="fl-card">
                  <span className="fl-icon">
                    <Icon name={c.icon} />
                  </span>
                  <h3>{c.title}</h3>
                  <p className="fl-text">{c.text}</p>
                </article>
              ))}
            </div>
            <div className="fl-faq fl-wrap--narrow" style={{ marginTop: "var(--space-8)" }}>
              {d.travel.faq.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="fl-footer">
        <div className="fl-wrap fl-footer__base" style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}>
          <span>{d.footer}</span>
          <span className="fl-st2-credit">
            Design: <a href="https://html5up.net">HTML5 UP</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
