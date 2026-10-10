/** @flowcode-library site-photographer · Photographer portfolio (Industry sites)
 * Use cases: photographer portfolio; photo gallery; wedding photography; portrait studio; artist portfolio; image gallery; photography packages; session booking
 * Jobs to be done: browse the photographer's work; compare photography packages; check if my date is free; book a photo session
 * Keywords: page, template, photographer, portfolio, gallery, filter, lightbox, packages, booking, html5up
 */
/**
 * Page template: photographer portfolio website. A one-page site for a wedding, portrait or commercial photographer:
 * a full-height intro, two alternating statement panels, a large gallery with a category filter and a lightbox
 * (arrow keys move between photos, Escape closes), three packages and a booking enquiry form. Pictures are
 * token-coloured placeholders until real photos are added. Layout adapted from HTML5 UP "Big Picture"
 * (html5up.net, CC BY 3.0); keep the credit. The form checks its fields and keeps enquiries in local storage; nothing
 * is sent.
 * Make it the app's own: replace SAMPLE with the real photos, categories and packages; swap each placeholder for an
 * <img> with honest alt text.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  brand: "Mara Linwood",
  role: "Photography",
  links: [
    { label: "Gallery", href: "#photo-gallery" },
    { label: "Packages", href: "#photo-packages" },
    { label: "Book", href: "#photo-book" },
  ],
  intro: {
    eyebrow: "Wedding, family and portrait photographer",
    title: "Quiet pictures of loud, lovely days.",
    lede: "Based on the coast, traveling anywhere with a train station. Booking weddings for 2027 now.",
    action: { label: "See the gallery", href: "#photo-gallery" },
  },
  panels: [
    {
      side: "right",
      title: "Weddings, unhurried",
      text: "No lining people up for an hour. I follow the day as it happens and step in only when the light is too good to waste.",
    },
    {
      side: "left",
      title: "Portraits that look like you",
      text: "An hour somewhere you love, walking and talking. Most people forget the camera after ten minutes; that's when the good ones happen.",
    },
  ],
  gallery: {
    title: "Recent work",
    lede: "A few favorites from the last two seasons. Select any photo to see it larger.",
    filters: ["All", "Weddings", "Portraits", "Family", "Commercial"],
    photos: [
      { title: "First look on the harbour wall", kind: "Weddings", place: "Port Isaac", shape: "tall" },
      { title: "Grandad's speech", kind: "Weddings", place: "Hartley Barn", shape: "wide" },
      { title: "Sisters, low tide", kind: "Family", place: "Sandymouth", shape: "square" },
      { title: "The potter at work", kind: "Commercial", place: "Kiln Lane Studio", shape: "square" },
      { title: "Hana, autumn", kind: "Portraits", place: "Ashcombe Woods", shape: "tall" },
      { title: "Confetti, take three", kind: "Weddings", place: "St Clement's", shape: "square" },
      { title: "Sunday pancakes", kind: "Family", place: "At home", shape: "wide" },
      { title: "Menu shoot, Saltwater Kitchen", kind: "Commercial", place: "Falmouth", shape: "wide" },
      { title: "Theo, graduation", kind: "Portraits", place: "Old Quad", shape: "square" },
      { title: "Last dance", kind: "Weddings", place: "Penrose House", shape: "tall" },
    ],
  },
  packages: {
    title: "Packages",
    lede: "Every package includes an online gallery for a year, print rights and a planning call.",
    items: [
      { name: "Portrait hour", price: "$385", detail: "1 hour, one location", points: ["40+ edited photos", "Gallery in 7 days", "Up to 4 people"], featured: false },
      { name: "Full wedding day", price: "$3,200", detail: "Prep to first dance, up to 10 hours", points: ["600+ edited photos", "Sneak peek in 48 hours", "Second photographer", "Printed album, 30 pages"], featured: true },
      { name: "Small wedding", price: "$1,650", detail: "Ceremony and meal, up to 4 hours", points: ["250+ edited photos", "Gallery in 3 weeks", "Up to 30 guests"], featured: false },
    ],
  },
  booking: {
    title: "Check a date",
    lede: "Tell me the date and a little about your plans. I reply within two days with availability and a full price.",
    storageKey: "site-photographer-enquiries",
  },
  footer: { copyright: "© 2026 Mara Linwood Photography", social: ["Instagram", "Pinterest", "Email"] },
};

type Errors = Partial<Record<"name" | "email" | "package" | "date", string>>;

function todayIso() {
  const t = new Date();
  t.setMinutes(t.getMinutes() - t.getTimezoneOffset());
  return t.toISOString().slice(0, 10);
}

export default function SitePhotographer() {
  const d = SAMPLE;
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState("All");
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [pkg, setPkg] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState<null | { name: string; date: string }>(null);

  const shown = filter === "All" ? d.gallery.photos : d.gallery.photos.filter((p) => p.kind === filter);

  useEffect(() => {
    if (openIdx === null) return;
    closeRef.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") setOpenIdx((i) => (i === null ? i : (i + 1) % shown.length));
      else if (e.key === "ArrowLeft") setOpenIdx((i) => (i === null ? i : (i - 1 + shown.length) % shown.length));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openIdx === null, shown.length]);

  const open = (i: number, el: HTMLButtonElement) => {
    triggerRef.current = el;
    setOpenIdx(i);
  };
  function close() {
    setOpenIdx(null);
    triggerRef.current?.focus();
  }

  const choosePackage = (name: string) => {
    setPkg(name);
    document.getElementById("photo-book")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    window.setTimeout(() => document.getElementById("photo-date")?.focus({ preventScroll: true }), 300);
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? "").trim();
    const next: Errors = {};
    if (!v("name")) next.name = "Add your name, or both your names.";
    if (!/^\S+@\S+\.\S+$/.test(v("email"))) next.email = "Enter an email address so I can reply.";
    if (!v("package")) next.package = "Choose the package closest to what you need.";
    if (!v("date")) next.date = "Add the date, even if it's provisional.";
    else if (v("date") < todayIso()) next.date = "That date has passed. Pick a future date.";
    setErrors(next);
    if (Object.keys(next).length) {
      e.currentTarget.querySelector<HTMLElement>(`[name="${Object.keys(next)[0]}"]`)?.focus();
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(d.booking.storageKey) ?? "[]") as unknown[];
      localStorage.setItem(d.booking.storageKey, JSON.stringify([...saved, { ...Object.fromEntries(f), at: new Date().toISOString() }]));
    } catch {
      /* storage unavailable: the confirmation still shows */
    }
    setSent({ name: v("name"), date: v("date") });
  };

  const errText = (k: keyof Errors) =>
    errors[k] ? (
      <p id={`photo-${k}-err`} className="fl-st-err">
        {errors[k]}
      </p>
    ) : null;
  const errProps = (k: keyof Errors) => ({ "aria-invalid": errors[k] ? true : undefined, "aria-describedby": errors[k] ? `photo-${k}-err` : undefined });

  const current = openIdx === null ? null : shown[openIdx];

  return (
    <div className="fl-st fl-st-photo" id="top">
      <header className="fl-st-photo-top">
        <nav className="fl-st-photo-bar" aria-label="Main">
          <a className="fl-st-photo-brand" href="#top">
            {d.brand} <span>{d.role}</span>
          </a>
          <ul className={`fl-st-photo-links${menuOpen ? " is-open" : ""}`} id="photo-nav">
            {d.links.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setMenuOpen(false)}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <button type="button" className="fl-btn fl-btn--secondary fl-st-menubtn" aria-expanded={menuOpen} aria-controls="photo-nav" aria-label="Menu" onClick={() => setMenuOpen((o) => !o)}>
            <Icon name="menu" />
          </button>
        </nav>
      </header>

      <main>
        <section className="fl-st-photo-intro fl-st-tone-3" aria-labelledby="photo-intro-title">
          <div className="fl-st-photo-intro__box">
            <p className="fl-eyebrow">{d.intro.eyebrow}</p>
            <h1 id="photo-intro-title" className="fl-title fl-title--xl">
              {d.intro.title}
            </h1>
            <p className="fl-lede">{d.intro.lede}</p>
            <a className="fl-btn fl-btn--primary" href={d.intro.action.href}>
              {d.intro.action.label}
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14M6 13l6 6 6-6" />
              </svg>
            </a>
          </div>
        </section>

        {d.panels.map((p, i) => (
          <section key={p.title} className={`fl-st-photo-panel fl-st-photo-panel--${p.side} fl-st-tone-${i === 0 ? 5 : 2}`} aria-labelledby={`photo-panel-${i}`}>
            <div className="fl-st-photo-panel__box">
              <h2 id={`photo-panel-${i}`} className="fl-title">
                {p.title}
              </h2>
              <p className="fl-text">{p.text}</p>
            </div>
          </section>
        ))}

        <section className="fl-section" id="photo-gallery" aria-labelledby="photo-gallery-title">
          <div className="fl-wrap">
            <div className="fl-head fl-head--center">
              <h2 id="photo-gallery-title" className="fl-title">
                {d.gallery.title}
              </h2>
              <p className="fl-lede">{d.gallery.lede}</p>
              <div className="fl-st-chips" role="group" aria-label="Filter photos">
                {d.gallery.filters.map((f) => (
                  <button key={f} type="button" className="fl-st-chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                    {f}
                  </button>
                ))}
              </div>
              <p className="fl-sr" aria-live="polite">
                {shown.length} photos shown
              </p>
            </div>
            {shown.length ? (
              <ul className="fl-st-photo-grid">
                {shown.map((p, i) => (
                  <li key={p.title} className={`fl-st-photo-grid__item fl-st-photo-grid__item--${p.shape}`}>
                    <button type="button" className={`fl-st-photo-thumb fl-st-tone-${(d.gallery.photos.indexOf(p) % 6) + 1}`} onClick={(e) => open(i, e.currentTarget)} aria-haspopup="dialog">
                      <svg className="fl-st-photo-motif" viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                        <circle cx="88" cy="22" r="9" fill="currentColor" opacity="0.35" />
                        <path d="M0 80 38 40l22 22 18-14 42 32z" fill="currentColor" opacity="0.25" />
                      </svg>
                      <span className="fl-st-photo-thumb__cap">
                        <strong>{p.title}</strong>
                        <span>
                          {p.kind} · {p.place}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="fl-st-empty">
                <strong>No {filter.toLowerCase()} photos in this selection yet.</strong>
                <button type="button" className="fl-btn fl-btn--secondary" onClick={() => setFilter("All")}>
                  Show all photos
                </button>
              </div>
            )}
          </div>
        </section>

        {current && openIdx !== null ? (
          <div className="fl-st-scrim fl-st-scrim--dark" onClick={close}>
            <div className="fl-st-lightbox" role="dialog" aria-modal="true" aria-labelledby="photo-lb-title" onClick={(e) => e.stopPropagation()}>
              <div className={`fl-st-lightbox__img fl-st-tone-${(d.gallery.photos.indexOf(current) % 6) + 1}`} role="img" aria-label={`Placeholder for: ${current.title}`}>
                <svg className="fl-st-photo-motif" viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                  <circle cx="88" cy="22" r="9" fill="currentColor" opacity="0.35" />
                  <path d="M0 80 38 40l22 22 18-14 42 32z" fill="currentColor" opacity="0.25" />
                </svg>
              </div>
              <div className="fl-st-lightbox__bar">
                <div>
                  <h2 id="photo-lb-title" className="fl-title fl-title--md">
                    {current.title}
                  </h2>
                  <p className="fl-meta">
                    {current.kind} · {current.place} · {openIdx + 1} of {shown.length}
                  </p>
                </div>
                <div className="fl-actions">
                  <button type="button" className="fl-btn fl-btn--secondary" aria-label="Previous photo" onClick={() => setOpenIdx((openIdx - 1 + shown.length) % shown.length)}>
                    <span aria-hidden="true">←</span>
                  </button>
                  <button type="button" className="fl-btn fl-btn--secondary" aria-label="Next photo" onClick={() => setOpenIdx((openIdx + 1) % shown.length)}>
                    <span aria-hidden="true">→</span>
                  </button>
                  <button ref={closeRef} type="button" className="fl-btn fl-btn--primary" onClick={close}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <section className="fl-section fl-section--tint" id="photo-packages" aria-labelledby="photo-packages-title">
          <div className="fl-wrap">
            <div className="fl-head fl-head--center">
              <h2 id="photo-packages-title" className="fl-title">
                {d.packages.title}
              </h2>
              <p className="fl-lede">{d.packages.lede}</p>
            </div>
            <div className="fl-grid fl-grid--3 fl-st-photo-packages">
              {d.packages.items.map((p) => (
                <article key={p.name} className={`fl-card${p.featured ? " fl-card--featured" : ""}`}>
                  {p.featured ? <span className="fl-badge">Most booked</span> : null}
                  <h3>{p.name}</h3>
                  <p className="fl-price">
                    <strong>{p.price}</strong>
                  </p>
                  <p className="fl-meta">{p.detail}</p>
                  <ul className="fl-checks">
                    {p.points.map((pt) => (
                      <li key={pt}>
                        <span className="fl-tick" aria-hidden="true">
                          <Icon name="check" />
                        </span>
                        {pt}
                      </li>
                    ))}
                  </ul>
                  <button type="button" className={`fl-btn ${p.featured ? "fl-btn--primary" : "fl-btn--secondary"}`} onClick={() => choosePackage(p.name)}>
                    Check a date for this
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="fl-section" id="photo-book" aria-labelledby="photo-book-title">
          <div className="fl-wrap fl-wrap--narrow">
            <div className="fl-head fl-head--center">
              <h2 id="photo-book-title" className="fl-title">
                {d.booking.title}
              </h2>
              <p className="fl-lede">{d.booking.lede}</p>
            </div>
            <div className="fl-card">
              {sent ? (
                <div className="fl-form" role="status">
                  <p className="fl-done">
                    Thank you, {sent.name}. I'll check {sent.date} and reply within two days.
                  </p>
                  <button type="button" className="fl-btn fl-btn--secondary" onClick={() => setSent(null)}>
                    Ask about another date
                  </button>
                </div>
              ) : (
                <form className="fl-form" onSubmit={submit} noValidate>
                  <div className="fl-st-row2">
                    <div className="fl-field">
                      <label htmlFor="photo-name">Your name(s)</label>
                      <input id="photo-name" name="name" className="fl-input" autoComplete="name" {...errProps("name")} />
                      {errText("name")}
                    </div>
                    <div className="fl-field">
                      <label htmlFor="photo-email">Email</label>
                      <input id="photo-email" name="email" type="email" className="fl-input" autoComplete="email" {...errProps("email")} />
                      {errText("email")}
                    </div>
                  </div>
                  <div className="fl-st-row2">
                    <div className="fl-field">
                      <label htmlFor="photo-package">Package</label>
                      <select id="photo-package" name="package" className="fl-input fl-st-select" value={pkg} onChange={(e) => setPkg(e.target.value)} {...errProps("package")}>
                        <option value="" disabled>
                          Choose a package
                        </option>
                        {d.packages.items.map((p) => (
                          <option key={p.name} value={p.name}>
                            {p.name} ({p.price})
                          </option>
                        ))}
                        <option value="Something else">Something else</option>
                      </select>
                      {errText("package")}
                    </div>
                    <div className="fl-field">
                      <label htmlFor="photo-date">Date</label>
                      <input id="photo-date" name="date" type="date" min={todayIso()} className="fl-input" {...errProps("date")} />
                      {errText("date")}
                    </div>
                  </div>
                  <div className="fl-field">
                    <label htmlFor="photo-venue">Venue or location (optional)</label>
                    <input id="photo-venue" name="venue" className="fl-input" />
                  </div>
                  <div className="fl-field">
                    <label htmlFor="photo-message">Tell me about the day (optional)</label>
                    <textarea id="photo-message" name="message" className="fl-input" />
                  </div>
                  <button type="submit" className="fl-btn fl-btn--primary">
                    Send enquiry
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="fl-footer fl-st-photo-foot">
        <ul>
          {d.footer.social.map((s) => (
            <li key={s}>
              <a href="#top">{s}</a>
            </li>
          ))}
        </ul>
        <p className="fl-meta">
          {d.footer.copyright} · Design: <a href="https://html5up.net">HTML5 UP</a>
        </p>
      </footer>
    </div>
  );
}
