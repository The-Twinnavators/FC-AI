/**
 * Site: fitness / yoga studio. A one-page site for a gym, yoga or pilates studio, or any class-based fitness business:
 * centred masthead, a bold intro, a class timetable you can filter by day (and by beginner-friendly), what's included,
 * the trainers, membership prices with a monthly/annual switch, and a free-trial form that checks itself and keeps the
 * request in local storage. Layout adapted from HTML5 UP "Escape Velocity" (html5up.net, CC BY 3.0); keep the credit.
 * Make it the app's own: replace SAMPLE with the studio's real classes, people and prices; keep the timetable and trial
 * form wired to whatever booking screen the PRD describes.
 */
import { useState, type FormEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  brand: "Stillwater Studio",
  tagline: "Yoga, strength and mobility · 4 Quarry Lane, Eastbrook",
  links: [
    { label: "Timetable", href: "#fit-timetable" },
    { label: "Trainers", href: "#fit-trainers" },
    { label: "Membership", href: "#fit-membership" },
    { label: "Free trial", href: "#fit-trial" },
  ],
  intro: {
    tab: "Move well",
    title: "Strength, mobility and a little calm, under one roof.",
    lede: "Small classes of twelve or fewer, taught by people who learn your name. Come for a free trial week and try anything on the timetable.",
    primary: "Book a free trial",
    secondary: "See this week's classes",
  },
  timetable: {
    tab: "Timetable",
    title: "This week's classes",
    lede: "Pick a day. Every class is 45 to 60 minutes; mats, blocks and kettlebells are provided.",
    days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    classes: [
      { day: "Mon", time: "06:45", name: "Sunrise Flow", type: "Yoga", level: "All levels", trainer: "Maya", room: "Studio 1", spots: 4 },
      { day: "Mon", time: "12:15", name: "Lunchtime Strength", type: "Strength", level: "Beginner", trainer: "Tom", room: "Gym floor", spots: 7 },
      { day: "Mon", time: "18:30", name: "Power Vinyasa", type: "Yoga", level: "Intermediate", trainer: "Maya", room: "Studio 1", spots: 2 },
      { day: "Mon", time: "19:45", name: "Yin & Breath", type: "Yoga", level: "All levels", trainer: "Ines", room: "Studio 2", spots: 9 },
      { day: "Tue", time: "07:00", name: "Kettlebell Basics", type: "Strength", level: "Beginner", trainer: "Tom", room: "Gym floor", spots: 5 },
      { day: "Tue", time: "09:30", name: "Mat Pilates", type: "Pilates", level: "All levels", trainer: "Ines", room: "Studio 2", spots: 0 },
      { day: "Tue", time: "18:00", name: "Barbell Club", type: "Strength", level: "Intermediate", trainer: "Tom", room: "Gym floor", spots: 3 },
      { day: "Wed", time: "06:45", name: "Sunrise Flow", type: "Yoga", level: "All levels", trainer: "Maya", room: "Studio 1", spots: 6 },
      { day: "Wed", time: "12:15", name: "Mobility Reset", type: "Pilates", level: "Beginner", trainer: "Ines", room: "Studio 2", spots: 10 },
      { day: "Wed", time: "19:00", name: "Hot Vinyasa", type: "Yoga", level: "Intermediate", trainer: "Maya", room: "Studio 1", spots: 1 },
      { day: "Thu", time: "07:00", name: "Strength Circuit", type: "Strength", level: "All levels", trainer: "Tom", room: "Gym floor", spots: 8 },
      { day: "Thu", time: "18:30", name: "Reformer-style Mat", type: "Pilates", level: "Intermediate", trainer: "Ines", room: "Studio 2", spots: 4 },
      { day: "Thu", time: "20:00", name: "Restorative Yoga", type: "Yoga", level: "Beginner", trainer: "Maya", room: "Studio 1", spots: 11 },
      { day: "Fri", time: "06:45", name: "Sunrise Flow", type: "Yoga", level: "All levels", trainer: "Maya", room: "Studio 1", spots: 5 },
      { day: "Fri", time: "17:30", name: "Friday Lift", type: "Strength", level: "Intermediate", trainer: "Tom", room: "Gym floor", spots: 6 },
      { day: "Sat", time: "09:00", name: "Weekend Flow", type: "Yoga", level: "All levels", trainer: "Maya", room: "Studio 1", spots: 3 },
      { day: "Sat", time: "10:30", name: "Beginners' Course (wk 2 of 4)", type: "Yoga", level: "Beginner", trainer: "Ines", room: "Studio 2", spots: 2 },
      { day: "Sat", time: "11:00", name: "Kettlebell Basics", type: "Strength", level: "Beginner", trainer: "Tom", room: "Gym floor", spots: 9 },
      { day: "Sun", time: "10:00", name: "Long Practice (90 min)", type: "Yoga", level: "Intermediate", trainer: "Maya", room: "Studio 1", spots: 7 },
      { day: "Sun", time: "17:00", name: "Inversions Lab", type: "Yoga", level: "Intermediate", trainer: "Ines", room: "Studio 2", spots: 6 },
    ],
  },
  included: [
    { icon: "users", title: "Twelve to a class", text: "Enough energy to keep you going, small enough for real corrections." },
    { icon: "clock", title: "Book or cancel up to 2 hours before", text: "No fees for late changes on your first two each month." },
    { icon: "heart", title: "A first chat with a trainer", text: "Twenty minutes on goals, injuries and which classes to start with." },
    { icon: "shield", title: "Showers, towels and lockers", text: "Bring yourself; we wash everything else." },
  ],
  trainers: {
    tab: "Trainers",
    title: "The people who'll teach you",
    people: [
      { initials: "MO", name: "Maya Okafor", role: "Yoga lead", bio: "Twelve years teaching vinyasa and yin. Runs the beginners' course every month.", teaches: ["Vinyasa", "Yin", "Restorative"] },
      { initials: "TR", name: "Tom Reyes", role: "Strength coach", bio: "Former physio assistant who makes lifting feel approachable. Good with old injuries.", teaches: ["Kettlebells", "Barbell", "Circuits"] },
      { initials: "IH", name: "Ines Halvorsen", role: "Pilates and mobility", bio: "Teaches slow, precise classes that help desk-bound backs and runners' hips.", teaches: ["Mat Pilates", "Mobility", "Inversions"] },
    ],
  },
  membership: {
    tab: "Membership",
    title: "Simple prices, no joining fee",
    lede: "Pause any membership for up to two months a year. Annual plans are paid monthly at the lower rate.",
    plans: [
      { name: "Twice a week", monthly: 59, annual: 52, unit: "/ month", note: "8 classes a month, any type", featured: false, features: ["8 classes each month", "Book 7 days ahead", "Bring a friend once a month"] },
      { name: "Unlimited", monthly: 89, annual: 79, unit: "/ month", note: "Most members choose this", featured: true, features: ["Every class, every day", "Book 14 days ahead", "Two guest passes a month", "Quarterly progress check-in"] },
      { name: "Class pack", monthly: 120, annual: 120, unit: "/ 10 classes", note: "Valid for six months", featured: false, features: ["10 classes, any type", "Share with one other person", "Top up any time"] },
    ],
  },
  trial: {
    tab: "Free trial",
    title: "Try a week, free",
    lede: "Tell us a little about you and we'll book your first class. No card needed.",
    interests: ["Yoga", "Strength", "Pilates and mobility", "Not sure yet"],
    experience: ["New to this", "Some experience", "I train regularly"],
    contact: [
      { icon: "pin", label: "4 Quarry Lane, Eastbrook" },
      { icon: "phone", label: "01632 960 418" },
      { icon: "clock", label: "Mon–Fri 06:30–21:30 · Sat–Sun 08:30–18:00" },
    ],
  },
  footer: "© 2027 Stillwater Studio · Registered with the local fitness standards body",
};

type Errors = Partial<Record<"name" | "email" | "interest" | "day" | "experience" | "consent", string>>;

const DAY_INDEX = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SiteFitness() {
  const d = SAMPLE;
  const [menuOpen, setMenuOpen] = useState(false);
  const [day, setDay] = useState(() => DAY_INDEX[new Date().getDay()]);
  const [beginnerOnly, setBeginnerOnly] = useState(false);
  const [annual, setAnnual] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [booked, setBooked] = useState<{ name: string; email: string; day: string } | null>(null);

  const dayClasses = d.timetable.classes.filter((c) => c.day === day);
  const shown = dayClasses.filter((c) => !beginnerOnly || c.level !== "Intermediate");

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const v = (k: string) => String(f.get(k) ?? "").trim();
    const next: Errors = {};
    if (!v("name")) next.name = "Please tell us your name.";
    if (!v("email")) next.email = "We need an email to confirm your class.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v("email"))) next.email = "That email doesn't look right. Check for a missing @ or dot.";
    if (!v("interest")) next.interest = "Choose what you'd like to try.";
    if (!v("day")) next.day = "Choose a day for your first class.";
    if (!v("experience")) next.experience = "Choose the option closest to you.";
    if (!f.get("consent")) next.consent = "Please agree so we can contact you about your trial.";
    setErrors(next);
    if (Object.keys(next).length > 0) {
      const first = form.querySelector<HTMLElement>("[aria-invalid='true']");
      first?.focus();
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem("fit-trials") ?? "[]") as unknown[];
      localStorage.setItem("fit-trials", JSON.stringify([...saved, { ...Object.fromEntries(f), at: new Date().toISOString() }]));
    } catch {
      /* storage unavailable: the confirmation still shows */
    }
    setBooked({ name: v("name").split(" ")[0], email: v("email"), day: v("day") });
  };

  const err = (k: keyof Errors) => (errors[k] ? { "aria-invalid": true as const, "aria-describedby": `fit-${k}-err` } : {});

  return (
    <div className="fl-st2-page" id="top">
      <header className="fl-st2-bar fl-st2-bar--center">
        <nav className="fl-st2-bar__row" aria-label="Main">
          <a className="fl-st2-brand" href="#top">
            {d.brand}
          </a>
          <p className="fl-st2-tagline">{d.tagline}</p>
          <ul className="fl-st2-links" id="fit-links" data-open={menuOpen}>
            {d.links.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setMenuOpen(false)}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="fl-st2-bar__end">
            <button type="button" className="fl-btn fl-btn--secondary fl-st2-burger" aria-expanded={menuOpen} aria-controls="fit-links" aria-label="Menu" onClick={() => setMenuOpen((o) => !o)}>
              <Icon name="menu" />
            </button>
          </div>
        </nav>
      </header>

      <main>
        <section className="fl-section fl-st2-ev fl-st2-ev--ink fl-bg-ink" aria-labelledby="fit-intro-title">
          <span className="fl-st2-evtab" aria-hidden="true">
            {d.intro.tab}
          </span>
          <div className="fl-wrap fl-st2-intro">
            <h1 id="fit-intro-title" className="fl-title">
              {d.intro.title}
            </h1>
            <p className="fl-lede">{d.intro.lede}</p>
            <div className="fl-actions" style={{ justifyContent: "center" }}>
              <a className="fl-btn fl-btn--on-accent" href="#fit-trial">
                {d.intro.primary}
              </a>
              <a className="fl-btn fl-btn--ghost-on-accent" href="#fit-timetable">
                {d.intro.secondary}
              </a>
            </div>
          </div>
        </section>

        <section className="fl-section fl-st2-ev" id="fit-timetable" aria-labelledby="fit-tt-title">
          <span className="fl-st2-evtab" aria-hidden="true">
            {d.timetable.tab}
          </span>
          <div className="fl-wrap">
            <div className="fl-head">
              <h2 id="fit-tt-title" className="fl-title">
                {d.timetable.title}
              </h2>
              <p className="fl-lede">{d.timetable.lede}</p>
            </div>
            <div className="fl-st2-daybar">
              <div className="fl-st2-days" role="group" aria-label="Show classes for">
                {d.timetable.days.map((dy) => (
                  <button key={dy} type="button" className="fl-st2-day" aria-pressed={day === dy} onClick={() => setDay(dy)}>
                    {dy}
                    <small>{d.timetable.classes.filter((c) => c.day === dy).length} classes</small>
                  </button>
                ))}
              </div>
              <label className="fl-st2-check">
                <input type="checkbox" checked={beginnerOnly} onChange={(e) => setBeginnerOnly(e.target.checked)} />
                Beginner-friendly only
              </label>
            </div>
            <p className="fl-sr" aria-live="polite">
              {shown.length} classes on {day}
            </p>
            {shown.length === 0 ? (
              <div className="fl-st2-empty">
                <strong>No beginner-friendly classes on {day}.</strong>
                <span>Every {day} class is intermediate. Try another day, or show all levels.</span>
                <button type="button" className="fl-btn fl-btn--secondary" onClick={() => setBeginnerOnly(false)}>
                  Show all levels
                </button>
              </div>
            ) : (
              <div className="fl-st2-tablewrap">
                <table className="fl-st2-table">
                  <caption className="fl-sr">Classes on {day}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Time</th>
                      <th scope="col">Class</th>
                      <th scope="col">Level</th>
                      <th scope="col">Trainer</th>
                      <th scope="col">Room</th>
                      <th scope="col" className="fl-st2-num">
                        Spots
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((c) => (
                      <tr key={c.day + c.time + c.name}>
                        <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: "var(--weight-semibold)" }}>{c.time}</td>
                        <th scope="row" style={{ fontWeight: "var(--weight-semibold)" }}>
                          {c.name}
                          <span className="fl-meta" style={{ display: "block", fontWeight: "var(--weight-regular)" }}>
                            {c.type}
                          </span>
                        </th>
                        <td>
                          <span className={c.level === "Intermediate" ? "fl-st2-pill" : "fl-st2-pill fl-st2-pill--calm"}>{c.level}</span>
                        </td>
                        <td>{c.trainer}</td>
                        <td>{c.room}</td>
                        <td className="fl-st2-num">{c.spots === 0 ? <span className="fl-st2-low">Full · waitlist</span> : c.spots <= 3 ? <span className="fl-st2-low">{c.spots} left</span> : `${c.spots} left`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <ul className="fl-st2-featlist" aria-label="What's included">
              {d.included.map((f) => (
                <li key={f.title}>
                  <span className="fl-icon">
                    <Icon name={f.icon} />
                  </span>
                  <div>
                    <h3>{f.title}</h3>
                    <p className="fl-text">{f.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="fl-section fl-st2-ev fl-st2-ev--tint" id="fit-trainers" aria-labelledby="fit-tr-title">
          <span className="fl-st2-evtab" aria-hidden="true">
            {d.trainers.tab}
          </span>
          <div className="fl-wrap">
            <div className="fl-head fl-head--center">
              <h2 id="fit-tr-title" className="fl-title">
                {d.trainers.title}
              </h2>
            </div>
            <ul className="fl-grid fl-grid--3" style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {d.trainers.people.map((p) => (
                <li key={p.name} className="fl-card fl-st2-trainer">
                  <div className="fl-media fl-media--round" aria-hidden="true">
                    {p.initials}
                  </div>
                  <h3>{p.name}</h3>
                  <span className="fl-badge" style={{ justifySelf: "center" }}>
                    {p.role}
                  </span>
                  <p className="fl-text">{p.bio}</p>
                  <ul className="fl-st2-choices" aria-label={`${p.name} teaches`} style={{ margin: 0, padding: 0, listStyle: "none" }}>
                    {p.teaches.map((t) => (
                      <li key={t} className="fl-st2-pill fl-st2-pill--muted">
                        {t}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="fl-section fl-st2-ev" id="fit-membership" aria-labelledby="fit-mem-title">
          <span className="fl-st2-evtab" aria-hidden="true">
            {d.membership.tab}
          </span>
          <div className="fl-wrap">
            <div className="fl-head fl-head--center">
              <h2 id="fit-mem-title" className="fl-title">
                {d.membership.title}
              </h2>
              <p className="fl-lede">{d.membership.lede}</p>
              <div className="fl-toggle" role="group" aria-label="Billing">
                <button type="button" aria-pressed={!annual} onClick={() => setAnnual(false)}>
                  Monthly
                </button>
                <button type="button" aria-pressed={annual} onClick={() => setAnnual(true)}>
                  Annual · save up to 12%
                </button>
              </div>
            </div>
            <ul className="fl-grid fl-grid--3" style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {d.membership.plans.map((p) => (
                <li key={p.name} className={p.featured ? "fl-card fl-card--featured" : "fl-card"}>
                  {p.featured ? <span className="fl-badge">{p.note}</span> : <span className="fl-meta">{p.note}</span>}
                  <h3>{p.name}</h3>
                  <p className="fl-price" style={{ margin: 0 }}>
                    <strong>£{annual ? p.annual : p.monthly}</strong>
                    <span className="fl-meta">{p.unit}</span>
                  </p>
                  <ul className="fl-checks">
                    {p.features.map((f) => (
                      <li key={f}>
                        <span className="fl-tick">
                          <Icon name="check" />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <a className={p.featured ? "fl-btn fl-btn--primary" : "fl-btn fl-btn--secondary"} href="#fit-trial" style={{ marginTop: "var(--space-3)" }}>
                    Start with a free week
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="fl-section fl-st2-ev fl-st2-ev--tint" id="fit-trial" aria-labelledby="fit-trial-title">
          <span className="fl-st2-evtab" aria-hidden="true">
            {d.trial.tab}
          </span>
          <div className="fl-wrap fl-split fl-split--start">
            <div className="fl-head" style={{ marginBottom: 0 }}>
              <h2 id="fit-trial-title" className="fl-title">
                {d.trial.title}
              </h2>
              <p className="fl-lede">{d.trial.lede}</p>
              <ul style={{ display: "grid", gap: "var(--space-4)", margin: "var(--space-4) 0 0", padding: 0, listStyle: "none" }}>
                {d.trial.contact.map((c) => (
                  <li key={c.label} className="fl-person">
                    <span className="fl-icon">
                      <Icon name={c.icon} />
                    </span>
                    <span>{c.label}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="fl-card" aria-live="polite">
              {booked ? (
                <div style={{ display: "grid", gap: "var(--space-4)" }}>
                  <p className="fl-done" role="status">
                    You're in, {booked.name}. We've saved your free week starting {booked.day}; a confirmation will go to {booked.email}.
                  </p>
                  <button type="button" className="fl-btn fl-btn--secondary" onClick={() => setBooked(null)}>
                    Book for someone else
                  </button>
                </div>
              ) : (
                <form className="fl-form" noValidate onSubmit={submit}>
                  <div className="fl-st2-row2">
                    <div className="fl-field">
                      <label htmlFor="fit-name">Name</label>
                      <input id="fit-name" name="name" className="fl-input" autoComplete="name" {...err("name")} />
                      {errors.name ? <p id="fit-name-err" className="fl-st2-err">{errors.name}</p> : null}
                    </div>
                    <div className="fl-field">
                      <label htmlFor="fit-phone">
                        Phone <span className="fl-meta">(optional)</span>
                      </label>
                      <input id="fit-phone" name="phone" type="tel" className="fl-input" autoComplete="tel" />
                    </div>
                  </div>
                  <div className="fl-field">
                    <label htmlFor="fit-email">Email</label>
                    <input id="fit-email" name="email" type="email" className="fl-input" autoComplete="email" {...err("email")} />
                    {errors.email ? <p id="fit-email-err" className="fl-st2-err">{errors.email}</p> : null}
                  </div>
                  <div className="fl-st2-row2">
                    <div className="fl-field">
                      <label htmlFor="fit-interest">I'd like to try</label>
                      <span className="fl-st2-select">
                        <select id="fit-interest" name="interest" className="fl-input" defaultValue="" {...err("interest")}>
                          <option value="">Choose one</option>
                          {d.trial.interests.map((i) => (
                            <option key={i}>{i}</option>
                          ))}
                        </select>
                      </span>
                      {errors.interest ? <p id="fit-interest-err" className="fl-st2-err">{errors.interest}</p> : null}
                    </div>
                    <div className="fl-field">
                      <label htmlFor="fit-day">First class on</label>
                      <span className="fl-st2-select">
                        <select id="fit-day" name="day" className="fl-input" defaultValue="" {...err("day")}>
                          <option value="">Choose a day</option>
                          {d.timetable.days.map((dy) => (
                            <option key={dy}>{dy}</option>
                          ))}
                        </select>
                      </span>
                      {errors.day ? <p id="fit-day-err" className="fl-st2-err">{errors.day}</p> : null}
                    </div>
                  </div>
                  <fieldset className="fl-st2-fieldset" aria-describedby={errors.experience ? "fit-experience-err" : undefined}>
                    <legend>Experience</legend>
                    <div className="fl-st2-choices">
                      {d.trial.experience.map((x) => (
                        <label key={x} className="fl-st2-choice">
                          <input type="radio" name="experience" value={x} aria-invalid={errors.experience ? true : undefined} />
                          {x}
                        </label>
                      ))}
                    </div>
                    {errors.experience ? <p id="fit-experience-err" className="fl-st2-err">{errors.experience}</p> : null}
                  </fieldset>
                  <div className="fl-field">
                    <label className="fl-st2-check" style={{ fontWeight: "var(--weight-regular)" }}>
                      <input type="checkbox" name="consent" {...err("consent")} />
                      Contact me about my trial week. Nothing else, unless I ask.
                    </label>
                    {errors.consent ? <p id="fit-consent-err" className="fl-st2-err">{errors.consent}</p> : null}
                  </div>
                  <button type="submit" className="fl-btn fl-btn--primary">
                    Book my free week
                  </button>
                  <p className="fl-note" style={{ margin: 0 }}>
                    New to exercise or recovering from an injury? Mention it at your first class and the trainer will adapt it.
                  </p>
                </form>
              )}
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
