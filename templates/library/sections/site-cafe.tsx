/**
 * Page template: cafe or restaurant website. A one-page site for a neighbourhood cafe, bistro or small restaurant:
 * centred header, warm hero, three highlights, a tabbed menu with a vegetarian filter, opening hours (today marked),
 * how to find you, a table-booking form and a footer. Layout adapted from HTML5 UP "Arcana" (html5up.net, CC BY 3.0);
 * keep the credit. The booking form checks its fields and keeps bookings in local storage; nothing is sent.
 * Make it the app's own: replace SAMPLE with the real menu, prices, hours and address, and keep only the menu tabs and
 * booking fields the venue actually uses.
 */
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  brand: "Juniper Corner",
  tagline: "Cafe and kitchen",
  links: [
    { label: "Menu", href: "#cafe-menu" },
    { label: "Hours", href: "#cafe-visit" },
    { label: "Find us", href: "#cafe-visit" },
    { label: "Book", href: "#cafe-book" },
  ],
  hero: {
    eyebrow: "On Linden Row since 2014",
    title: "Slow coffee, proper breakfasts and a seat by the window.",
    lede: "We roast our beans on Tuesdays, bake from six every morning and cook lunch until three. Walk in, or book a table for the weekend.",
    primary: { label: "Book a table", href: "#cafe-book" },
    secondary: { label: "See the menu", href: "#cafe-menu" },
  },
  highlights: [
    { icon: "sparkle", title: "Roasted in-house", text: "Single-origin beans roasted every Tuesday in the back room, sold by the bag at the counter." },
    { icon: "clock", title: "Kitchen until 3pm", text: "Breakfast all morning, lunch from 11:30. Pastries until they run out, usually mid-afternoon." },
    { icon: "heart", title: "Dogs welcome", text: "Water bowls on the terrace and a biscuit jar for good dogs. Highchairs and a changing room inside." },
  ],
  menu: {
    title: "On the menu",
    lede: "Seasonal, cooked to order. Ask us about allergens; we keep a full list behind the counter.",
    vegLabel: "Vegetarian only",
    tabs: [
      {
        id: "breakfast",
        label: "Breakfast",
        note: "Served 7:00 to 11:30",
        items: [
          { name: "Sourdough toast & cultured butter", desc: "Two thick slices, house marmalade or seasonal jam.", price: "5.50", tags: ["V"] },
          { name: "Juniper full breakfast", desc: "Free-range eggs, smoked bacon, sausage, roast tomato, mushrooms, beans, toast.", price: "13.00", tags: [] },
          { name: "Green shakshuka", desc: "Baked eggs in spinach, leek and feta, with flatbread for dipping.", price: "11.50", tags: ["V"] },
          { name: "Bircher bowl", desc: "Overnight oats, grated apple, toasted seeds, yoghurt and berries.", price: "7.00", tags: ["V", "GF"] },
        ],
      },
      {
        id: "lunch",
        label: "Lunch",
        note: "Served 11:30 to 15:00",
        items: [
          { name: "Roast squash & lentil salad", desc: "Puy lentils, herbs, pickled shallot, tahini dressing.", price: "10.50", tags: ["VG", "GF"] },
          { name: "Chicken & tarragon pie", desc: "Short crust, buttered greens and a jug of gravy.", price: "14.50", tags: [] },
          { name: "Soup of the day", desc: "Ask at the counter. Served with bread and butter.", price: "7.50", tags: ["V"] },
          { name: "Fish finger sandwich", desc: "Hake in a crisp crumb, tartare, gem lettuce, soft white bun.", price: "12.00", tags: [] },
        ],
      },
      {
        id: "coffee",
        label: "Coffee & drinks",
        note: "Oat, soy and almond milk at no extra cost",
        items: [
          { name: "Espresso", desc: "This month: a washed Ethiopian with notes of apricot and black tea.", price: "2.60", tags: ["VG"] },
          { name: "Flat white", desc: "Double shot, silky milk.", price: "3.40", tags: ["V"] },
          { name: "Filter of the week", desc: "Brewed by the cup, ask what's on.", price: "3.80", tags: ["VG"] },
          { name: "Fresh lemonade", desc: "Made every morning with mint from the terrace.", price: "3.50", tags: ["VG"] },
        ],
      },
      {
        id: "bakes",
        label: "Bakes",
        note: "Out of the oven from 7:00",
        items: [
          { name: "Cardamom bun", desc: "Our best seller, knotted and glazed.", price: "3.60", tags: ["V"] },
          { name: "Almond croissant", desc: "Twice baked with frangipane.", price: "3.90", tags: ["V"] },
          { name: "Sausage roll", desc: "Pork, sage and onion in rough puff.", price: "4.20", tags: [] },
        ],
      },
    ],
  },
  visit: {
    title: "Visit us",
    hoursTitle: "Opening hours",
    // 0 = Sunday … 6 = Saturday
    hours: [
      { day: "Monday", n: 1, time: "7:00 – 17:00" },
      { day: "Tuesday", n: 2, time: "7:00 – 17:00" },
      { day: "Wednesday", n: 3, time: "7:00 – 17:00" },
      { day: "Thursday", n: 4, time: "7:00 – 21:00" },
      { day: "Friday", n: 5, time: "7:00 – 21:00" },
      { day: "Saturday", n: 6, time: "8:00 – 18:00" },
      { day: "Sunday", n: 0, time: "8:00 – 16:00" },
    ],
    hoursNote: "Supper club on Thursday and Friday evenings, bookings only.",
    findTitle: "Find us",
    address: ["14 Linden Row", "Eastgate, ES2 4PL"],
    transit: "Two minutes from Eastgate station. Bike racks out front, step-free entrance on Mill Lane.",
    phone: "01632 960 418",
    directions: { label: "Get directions", href: "#cafe-visit" },
  },
  booking: {
    eyebrow: "Reservations",
    title: "Book a table",
    lede: "We keep half our tables for walk-ins. For groups over eight, give us a call and we'll sort something out.",
    times: ["8:00", "9:00", "10:00", "11:30", "12:30", "13:30", "18:30", "19:30"],
    maxParty: 8,
    storageKey: "site-cafe-bookings",
  },
  footer: {
    blurb: "An independent cafe on Linden Row. Coffee, breakfast, lunch and a supper club on Thursdays and Fridays.",
    cols: [
      { title: "Visit", items: ["14 Linden Row", "Eastgate, ES2 4PL", "01632 960 418"] },
      { title: "Explore", items: ["Menu", "Supper club", "Gift cards", "Private hire"] },
    ],
    copyright: "© 2026 Juniper Corner",
  },
};

type Errors = Partial<Record<"name" | "phone" | "date" | "time" | "party", string>>;

function todayIso() {
  const t = new Date();
  t.setMinutes(t.getMinutes() - t.getTimezoneOffset());
  return t.toISOString().slice(0, 10);
}

export default function SiteCafe() {
  const d = SAMPLE;
  const [menuOpen, setMenuOpen] = useState(false);
  const [tab, setTab] = useState(d.menu.tabs[0].id);
  const [vegOnly, setVegOnly] = useState(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [today, setToday] = useState<number | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [booked, setBooked] = useState<null | { name: string; date: string; time: string; party: string }>(null);

  useEffect(() => setToday(new Date().getDay()), []);

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = d.menu.tabs.length;
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % n;
    else if (e.key === "ArrowLeft") next = (i - 1 + n) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    else return;
    e.preventDefault();
    setTab(d.menu.tabs[next].id);
    tabRefs.current[next]?.focus();
  };

  const current = d.menu.tabs.find((t) => t.id === tab) ?? d.menu.tabs[0];
  const items = vegOnly ? current.items.filter((it) => it.tags.includes("V") || it.tags.includes("VG")) : current.items;

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? "").trim();
    const next: Errors = {};
    if (!v("name")) next.name = "Tell us whose name the table is under.";
    if (!/^[+\d][\d\s()-]{6,}$/.test(v("phone"))) next.phone = "Enter a phone number so we can reach you on the day.";
    if (!v("date")) next.date = "Pick a date.";
    else if (v("date") < todayIso()) next.date = "That date has passed. Pick today or later.";
    if (!v("time")) next.time = "Pick a time.";
    if (!v("party")) next.party = "How many people?";
    setErrors(next);
    if (Object.keys(next).length) {
      const first = e.currentTarget.querySelector<HTMLElement>(`[name="${Object.keys(next)[0]}"]`);
      first?.focus();
      return;
    }
    const booking = { name: v("name"), date: v("date"), time: v("time"), party: v("party") };
    try {
      const saved = JSON.parse(localStorage.getItem(d.booking.storageKey) ?? "[]") as unknown[];
      localStorage.setItem(d.booking.storageKey, JSON.stringify([...saved, { ...booking, phone: v("phone"), notes: v("notes"), at: new Date().toISOString() }]));
    } catch {
      /* storage unavailable: the confirmation still shows */
    }
    setBooked(booking);
  };

  const err = (k: keyof Errors) =>
    errors[k] ? (
      <p id={`cafe-${k}-err`} className="fl-st-err">
        {errors[k]}
      </p>
    ) : null;
  const errProps = (k: keyof Errors) => ({ "aria-invalid": errors[k] ? true : undefined, "aria-describedby": errors[k] ? `cafe-${k}-err` : undefined });

  return (
    <div className="fl-st fl-st-cafe" id="top">
      <header className="fl-st-cafe-top">
        <div className="fl-st-cafe-brandrow">
          <a className="fl-st-cafe-brand" href="#top">
            <span>{d.brand}</span>
            <small>{d.tagline}</small>
          </a>
          <button type="button" className="fl-btn fl-btn--secondary fl-st-menubtn" aria-expanded={menuOpen} aria-controls="cafe-nav" onClick={() => setMenuOpen((o) => !o)}>
            <Icon name="menu" />
            <span>Menu</span>
          </button>
        </div>
        <nav aria-label="Main" id="cafe-nav" className={`fl-st-cafe-nav${menuOpen ? " is-open" : ""}`}>
          <ul>
            {d.links.map((l) => (
              <li key={l.label}>
                <a href={l.href} onClick={() => setMenuOpen(false)}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main>
        <section className="fl-section fl-bg-grain fl-st-cafe-hero" aria-labelledby="cafe-hero-title">
          <div className="fl-wrap fl-st-cafe-hero__inner">
            <svg className="fl-st-cafe-cup" viewBox="0 0 160 120" aria-hidden="true">
              <path d="M62 30c-6-8 6-12 0-22M80 30c-6-8 6-12 0-22M98 30c-6-8 6-12 0-22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
              <path d="M36 44h88v22a40 40 0 0 1-40 40h-8a40 40 0 0 1-40-40z" fill="currentColor" opacity="0.18" stroke="currentColor" strokeWidth="3" />
              <path d="M124 52h8a14 14 0 0 1 0 28h-10" fill="none" stroke="currentColor" strokeWidth="3" />
              <path d="M24 112h112" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <p className="fl-eyebrow">{d.hero.eyebrow}</p>
            <h1 id="cafe-hero-title" className="fl-title fl-title--xl">
              {d.hero.title}
            </h1>
            <p className="fl-lede">{d.hero.lede}</p>
            <div className="fl-actions">
              <a className="fl-btn fl-btn--primary" href={d.hero.primary.href}>
                {d.hero.primary.label}
              </a>
              <a className="fl-btn fl-btn--secondary" href={d.hero.secondary.href}>
                {d.hero.secondary.label}
              </a>
            </div>
          </div>
        </section>

        <section className="fl-section" aria-label="Why people come back">
          <div className="fl-wrap fl-grid fl-grid--3 fl-st-cafe-highlights">
            {d.highlights.map((h) => (
              <div key={h.title} className="fl-st-cafe-highlight">
                <span className="fl-icon">
                  <Icon name={h.icon} />
                </span>
                <h2 className="fl-title fl-title--md">{h.title}</h2>
                <p className="fl-text">{h.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="fl-section fl-section--tint" id="cafe-menu" aria-labelledby="cafe-menu-title">
          <div className="fl-wrap fl-wrap--narrow">
            <div className="fl-head fl-head--center">
              <h2 id="cafe-menu-title" className="fl-title">
                {d.menu.title}
              </h2>
              <p className="fl-lede">{d.menu.lede}</p>
            </div>
            <div className="fl-st-cafe-menubar">
              <div className="fl-st-tabs" role="tablist" aria-label="Menu sections">
                {d.menu.tabs.map((t, i) => (
                  <button
                    key={t.id}
                    ref={(el) => {
                      tabRefs.current[i] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`cafe-tab-${t.id}`}
                    aria-selected={tab === t.id}
                    aria-controls="cafe-menu-panel"
                    tabIndex={tab === t.id ? 0 : -1}
                    className="fl-st-tab"
                    onClick={() => setTab(t.id)}
                    onKeyDown={(e) => onTabKey(e, i)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <label className="fl-st-check">
                <input type="checkbox" checked={vegOnly} onChange={(e) => setVegOnly(e.target.checked)} />
                {d.menu.vegLabel}
              </label>
            </div>
            <div id="cafe-menu-panel" role="tabpanel" aria-labelledby={`cafe-tab-${current.id}`} className="fl-st-cafe-panel" tabIndex={0}>
              <p className="fl-meta">{current.note}</p>
              {items.length ? (
                <ul className="fl-st-cafe-items">
                  {items.map((it) => (
                    <li key={it.name}>
                      <div className="fl-st-cafe-item__row">
                        <strong>{it.name}</strong>
                        <span className="fl-st-cafe-item__dots" aria-hidden="true" />
                        <span className="fl-st-cafe-item__price">£{it.price}</span>
                      </div>
                      <p className="fl-text">
                        {it.desc}
                        {it.tags.map((tg) => (
                          <abbr key={tg} className="fl-st-diet" title={tg === "VG" ? "Vegan" : tg === "GF" ? "Gluten free" : "Vegetarian"}>
                            {tg}
                          </abbr>
                        ))}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="fl-st-empty">
                  <strong>Nothing vegetarian in {current.label.toLowerCase()} today.</strong>
                  <span>Ask at the counter; the kitchen can usually adapt a dish.</span>
                  <button type="button" className="fl-btn fl-btn--secondary" onClick={() => setVegOnly(false)}>
                    Show everything
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="fl-section" id="cafe-visit" aria-labelledby="cafe-visit-title">
          <div className="fl-wrap">
            <div className="fl-head">
              <h2 id="cafe-visit-title" className="fl-title">
                {d.visit.title}
              </h2>
            </div>
            <div className="fl-split fl-split--start">
              <div className="fl-card">
                <h3>{d.visit.hoursTitle}</h3>
                <table className="fl-st-hours">
                  <caption className="fl-sr">{d.visit.hoursTitle}</caption>
                  <tbody>
                    {d.visit.hours.map((h) => (
                      <tr key={h.day} className={today === h.n ? "is-today" : undefined}>
                        <th scope="row">
                          {h.day}
                          {today === h.n ? <span className="fl-badge">Today</span> : null}
                        </th>
                        <td>{h.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="fl-note">{d.visit.hoursNote}</p>
              </div>
              <div className="fl-card">
                <svg className="fl-st-cafe-map" viewBox="0 0 320 160" aria-hidden="true">
                  <rect width="320" height="160" rx="12" fill="currentColor" opacity="0.06" />
                  <path d="M0 108h320M120 0v160M0 40c80 10 160 6 320-8" stroke="currentColor" strokeWidth="10" opacity="0.14" fill="none" />
                  <path d="M200 0v160" stroke="currentColor" strokeWidth="4" opacity="0.1" />
                  <circle cx="160" cy="76" r="10" className="fl-st-accent-fill" />
                  <circle cx="160" cy="76" r="22" className="fl-st-accent-fill" opacity="0.2" />
                </svg>
                <h3>{d.visit.findTitle}</h3>
                <address className="fl-st-address">
                  {d.visit.address.map((a) => (
                    <span key={a}>{a}</span>
                  ))}
                </address>
                <p className="fl-text">{d.visit.transit}</p>
                <div className="fl-actions">
                  <a className="fl-link" href={d.visit.directions.href}>
                    {d.visit.directions.label}
                  </a>
                  <span className="fl-meta">
                    <Icon name="phone" /> {d.visit.phone}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="fl-section fl-section--accent fl-st-cafe-book" id="cafe-book" aria-labelledby="cafe-book-title">
          <div className="fl-wrap fl-split fl-split--start">
            <div className="fl-head" style={{ marginBottom: 0 }}>
              <p className="fl-eyebrow">{d.booking.eyebrow}</p>
              <h2 id="cafe-book-title" className="fl-title">
                {d.booking.title}
              </h2>
              <p className="fl-lede">{d.booking.lede}</p>
            </div>
            <div className="fl-card fl-st-oncard">
              {booked ? (
                <div className="fl-form" role="status">
                  <p className="fl-done">
                    Table held for {booked.party} on {booked.date} at {booked.time}, under {booked.name}. See you then.
                  </p>
                  <button type="button" className="fl-btn fl-btn--secondary" onClick={() => setBooked(null)}>
                    Make another booking
                  </button>
                </div>
              ) : (
                <form className="fl-form" onSubmit={submit} noValidate>
                  <div className="fl-st-row2">
                    <div className="fl-field">
                      <label htmlFor="cafe-name">Name</label>
                      <input id="cafe-name" name="name" className="fl-input" autoComplete="name" {...errProps("name")} />
                      {err("name")}
                    </div>
                    <div className="fl-field">
                      <label htmlFor="cafe-phone">Phone</label>
                      <input id="cafe-phone" name="phone" type="tel" className="fl-input" autoComplete="tel" {...errProps("phone")} />
                      {err("phone")}
                    </div>
                  </div>
                  <div className="fl-st-row3">
                    <div className="fl-field">
                      <label htmlFor="cafe-date">Date</label>
                      <input id="cafe-date" name="date" type="date" min={todayIso()} className="fl-input" {...errProps("date")} />
                      {err("date")}
                    </div>
                    <div className="fl-field">
                      <label htmlFor="cafe-time">Time</label>
                      <select id="cafe-time" name="time" className="fl-input fl-st-select" defaultValue="" {...errProps("time")}>
                        <option value="" disabled>
                          Choose
                        </option>
                        {d.booking.times.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                      {err("time")}
                    </div>
                    <div className="fl-field">
                      <label htmlFor="cafe-party">Guests</label>
                      <select id="cafe-party" name="party" className="fl-input fl-st-select" defaultValue="2" {...errProps("party")}>
                        {Array.from({ length: d.booking.maxParty }, (_, i) => String(i + 1)).map((n) => (
                          <option key={n}>{n}</option>
                        ))}
                      </select>
                      {err("party")}
                    </div>
                  </div>
                  <div className="fl-field">
                    <label htmlFor="cafe-notes">Anything we should know? (optional)</label>
                    <textarea id="cafe-notes" name="notes" className="fl-input" placeholder="Allergies, a highchair, a birthday…" />
                  </div>
                  <button type="submit" className="fl-btn fl-btn--primary">
                    Request table
                  </button>
                  <p className="fl-note">We'll text to confirm within the hour during opening times.</p>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="fl-footer">
        <div className="fl-wrap">
          <div className="fl-st-cafe-footcols">
            <div style={{ display: "grid", gap: "var(--space-3)" }}>
              <a className="fl-st-cafe-brand" href="#top">
                <span>{d.brand}</span>
              </a>
              <p className="fl-text">{d.footer.blurb}</p>
            </div>
            {d.footer.cols.map((c) => (
              <div key={c.title}>
                <h4>{c.title}</h4>
                <ul>
                  {c.items.map((i) => (
                    <li key={i}>{c.title === "Explore" ? <a href="#top">{i}</a> : i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="fl-footer__base">
            <span>{d.footer.copyright}</span>
            <span>
              Design: <a href="https://html5up.net">HTML5 UP</a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
