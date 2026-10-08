/**
 * Page template: online magazine or blog. A one-page front page for an independent magazine, newsletter or
 * editorial blog: a sidebar with search, sections and most-read stories (it folds behind a button on phones), a
 * featured story, section tiles that filter the feed, a latest-articles grid with save-for-later and "load more",
 * and a newsletter sign-up. Layout adapted from HTML5 UP "Editorial" (html5up.net, CC BY 3.0); keep the credit.
 * Saved stories and sign-ups stay in local storage; nothing is sent.
 * Make it the app's own: replace SAMPLE with real stories and sections, and point each article link at its page.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  brand: "The Allotment",
  strap: "Stories about growing, cooking and mending",
  featured: {
    eyebrow: "Cover story · Issue 41",
    title: "The last seed library on the high street",
    lede: "For thirty years, a retired teacher has kept 900 varieties of beans in biscuit tins above a laundrette. We spent a season with her, and the gardeners who borrow from her shelves.",
    author: "Words by Imogen Clarke",
    read: "14 min read",
    action: { label: "Read the story", href: "#mag-latest" },
  },
  sections: [
    { id: "Growing", icon: "sparkle", text: "Plots, pots and window boxes." },
    { id: "Kitchen", icon: "heart", text: "Seasonal recipes that use it all." },
    { id: "Repair", icon: "layers", text: "Fixing things instead of binning them." },
    { id: "People", icon: "users", text: "The neighbours doing it well." },
  ],
  articles: [
    { title: "What to sow in a cold April", section: "Growing", date: "12 Apr 2026", read: "6 min", excerpt: "Broad beans, chard and the hardy salads that shrug off a late frost." },
    { title: "One chicken, four dinners", section: "Kitchen", date: "10 Apr 2026", read: "8 min", excerpt: "A roast on Sunday, then stock, a pie and a broth that carries you to Thursday." },
    { title: "Darning is having a moment", section: "Repair", date: "8 Apr 2026", read: "5 min", excerpt: "Visible mending cafes are popping up in libraries. We tried three." },
    { title: "The bee-keeping postman", section: "People", date: "5 Apr 2026", read: "9 min", excerpt: "Forty hives on a delivery round and a jar of honey for every street." },
    { title: "Rhubarb, forced and unforced", section: "Kitchen", date: "2 Apr 2026", read: "4 min", excerpt: "Why the pink stalks cost more, and three ways to use the green ones." },
    { title: "Sharpening a spade properly", section: "Repair", date: "30 Mar 2026", read: "3 min", excerpt: "Ten minutes with a file saves an hour of digging. Here's how." },
    { title: "Composting in a flat", section: "Growing", date: "27 Mar 2026", read: "7 min", excerpt: "A worm bin under the sink, and why it doesn't smell." },
    { title: "The repair cafe that fixed 4,000 kettles", section: "People", date: "24 Mar 2026", read: "11 min", excerpt: "Inside a church hall where volunteers have kept a decade of appliances out of landfill." },
    { title: "Saving tomato seed in a jar", section: "Growing", date: "20 Mar 2026", read: "5 min", excerpt: "Ferment, rinse, dry: the easiest way to grow next year's plants for free." },
  ],
  mostRead: ["The last seed library on the high street", "One chicken, four dinners", "The repair cafe that fixed 4,000 kettles"],
  pageSize: 6,
  newsletter: {
    title: "The Sunday Letter",
    lede: "One email a week: the best new stories, what to sow, and a recipe. Free, and easy to leave.",
    storageKey: "site-magazine-subscribers",
  },
  savedKey: "site-magazine-saved",
  footer: { copyright: "© 2026 The Allotment Magazine. Independent and reader-funded.", links: ["About", "Write for us", "Advertise", "Contact"] },
};

function loadSaved(key: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export default function SiteMagazine() {
  const d = SAMPLE;
  const [sidebar, setSidebar] = useState(false);
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<string | null>(null);
  const [limit, setLimit] = useState(d.pageSize);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [emailErr, setEmailErr] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setSaved(loadSaved(d.savedKey));
    return () => window.clearTimeout(timer.current);
  }, [d.savedKey]);

  const toggleSave = (title: string) => {
    setSaved((s) => {
      const next = s.includes(title) ? s.filter((t) => t !== title) : [...s, title];
      try {
        localStorage.setItem(d.savedKey, JSON.stringify(next));
      } catch {
        /* storage unavailable: still saved for this visit */
      }
      return next;
    });
  };

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return d.articles.filter((a) => (!section || a.section === section) && (!q || `${a.title} ${a.excerpt} ${a.section}`.toLowerCase().includes(q)));
  }, [d.articles, query, section]);
  const shown = matches.slice(0, limit);

  const pickSection = (s: string | null) => {
    setSection(s);
    setLimit(d.pageSize);
    setSidebar(false);
  };

  const loadMore = () => {
    setLoading(true);
    timer.current = window.setTimeout(() => {
      setLimit((l) => l + d.pageSize);
      setLoading(false);
    }, 600);
  };

  const subscribe = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setEmailErr("Enter an email address like you@example.com.");
      return;
    }
    setEmailErr("");
    try {
      const list = JSON.parse(localStorage.getItem(d.newsletter.storageKey) ?? "[]") as unknown[];
      localStorage.setItem(d.newsletter.storageKey, JSON.stringify([...list, { email: email.trim(), at: new Date().toISOString() }]));
    } catch {
      /* storage unavailable: the confirmation still shows */
    }
    setSubscribed(true);
  };

  const countFor = (s: string) => d.articles.filter((a) => a.section === s).length;

  return (
    <div className="fl-st fl-st-mag" id="top">
      <div className="fl-st-mag-layout">
        <div className="fl-st-mag-main">
          <header className="fl-st-mag-head">
            <a className="fl-st-mag-brand" href="#top">
              <strong>{d.brand}</strong>
              <span>{d.strap}</span>
            </a>
            <button type="button" className="fl-btn fl-btn--secondary fl-st-mag-sidebtn" aria-expanded={sidebar} aria-controls="mag-sidebar" aria-label="Sections and search" onClick={() => setSidebar((o) => !o)}>
              <Icon name="menu" />
              <span aria-hidden="true">Sections & search</span>
            </button>
          </header>

          <main>
            <section className="fl-st-mag-banner" aria-labelledby="mag-feature-title">
              <div className="fl-st-mag-banner__text">
                <p className="fl-eyebrow">{d.featured.eyebrow}</p>
                <h1 id="mag-feature-title" className="fl-title fl-title--xl">
                  {d.featured.title}
                </h1>
                <p className="fl-lede">{d.featured.lede}</p>
                <p className="fl-meta">
                  {d.featured.author} · {d.featured.read}
                </p>
                <div className="fl-actions">
                  <a className="fl-btn fl-btn--primary" href={d.featured.action.href}>
                    {d.featured.action.label}
                  </a>
                </div>
              </div>
              <div className="fl-media fl-st-mag-banner__img" role="img" aria-label="Placeholder for the cover photograph">
                <svg viewBox="0 0 200 150" aria-hidden="true" className="fl-st-mag-jars">
                  {[20, 70, 120].map((x, i) => (
                    <g key={x} transform={`translate(${x} ${40 + (i % 2) * 14})`}>
                      <rect x="0" y="0" width="44" height="10" rx="3" fill="currentColor" opacity="0.5" />
                      <rect x="2" y="10" width="40" height="56" rx="8" fill="none" stroke="currentColor" strokeWidth="2.5" />
                      <circle cx="14" cy="44" r="4" fill="currentColor" opacity="0.4" />
                      <circle cx="26" cy="52" r="4" fill="currentColor" opacity="0.4" />
                      <circle cx="22" cy="38" r="4" fill="currentColor" opacity="0.4" />
                    </g>
                  ))}
                  <path d="M0 128h200" stroke="currentColor" strokeWidth="3" />
                </svg>
              </div>
            </section>

            <section className="fl-st-mag-block" aria-labelledby="mag-sections-title">
              <h2 id="mag-sections-title" className="fl-st-mag-rule">
                Sections
              </h2>
              <div className="fl-grid fl-grid--4">
                {d.sections.map((s) => (
                  <button key={s.id} type="button" className="fl-st-mag-section" aria-pressed={section === s.id} onClick={() => pickSection(section === s.id ? null : s.id)}>
                    <span className="fl-icon">
                      <Icon name={s.icon} />
                    </span>
                    <strong>{s.id}</strong>
                    <span className="fl-meta">{s.text}</span>
                    <span className="fl-badge">{countFor(s.id)} stories</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="fl-st-mag-block" id="mag-latest" aria-labelledby="mag-latest-title">
              <div className="fl-st-mag-rulebar">
                <h2 id="mag-latest-title" className="fl-st-mag-rule">
                  {section ? `Latest in ${section}` : "Latest stories"}
                </h2>
                {section || query ? (
                  <button
                    type="button"
                    className="fl-link fl-st-linkbtn"
                    onClick={() => {
                      setQuery("");
                      pickSection(null);
                    }}
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
              <p className="fl-meta" aria-live="polite" style={{ marginBottom: "var(--space-4)" }}>
                {matches.length} {matches.length === 1 ? "story" : "stories"}
                {query.trim() ? ` matching “${query.trim()}”` : ""}
              </p>
              {shown.length ? (
                <div className="fl-st-mag-posts">
                  {shown.map((a) => {
                    const isSaved = saved.includes(a.title);
                    return (
                      <article key={a.title} className="fl-st-mag-post">
                        <div className={`fl-st-mag-post__img fl-st-tone-${(d.articles.indexOf(a) % 6) + 1}`} aria-hidden="true" />
                        <p className="fl-eyebrow">{a.section}</p>
                        <h3>
                          <a href="#mag-latest">{a.title}</a>
                        </h3>
                        <p className="fl-text">{a.excerpt}</p>
                        <div className="fl-st-mag-post__foot">
                          <span className="fl-meta">
                            {a.date} · {a.read}
                          </span>
                          <button type="button" className="fl-st-save" aria-pressed={isSaved} onClick={() => toggleSave(a.title)}>
                            <Icon name="heart" />
                            <span>{isSaved ? "Saved" : "Save"}</span>
                            <span className="fl-sr"> “{a.title}”</span>
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="fl-st-empty">
                  <strong>No stories match that.</strong>
                  <span>Try a shorter word, or look in another section.</span>
                  <button
                    type="button"
                    className="fl-btn fl-btn--secondary"
                    onClick={() => {
                      setQuery("");
                      pickSection(null);
                    }}
                  >
                    Show all stories
                  </button>
                </div>
              )}
              {matches.length > shown.length ? (
                <div className="fl-actions" style={{ justifyContent: "center", marginTop: "var(--space-6)" }}>
                  <button type="button" className="fl-btn fl-btn--secondary" onClick={loadMore} disabled={loading} aria-busy={loading}>
                    {loading ? "Loading…" : `Load more (${matches.length - shown.length})`}
                  </button>
                </div>
              ) : null}
            </section>

            <section className="fl-st-mag-block fl-st-mag-news fl-bg-dots" aria-labelledby="mag-news-title">
              <div className="fl-head" style={{ marginBottom: "var(--space-5)" }}>
                <h2 id="mag-news-title" className="fl-title fl-title--md">
                  {d.newsletter.title}
                </h2>
                <p className="fl-text">{d.newsletter.lede}</p>
              </div>
              {subscribed ? (
                <p className="fl-done" role="status">
                  You're on the list. The next letter arrives on Sunday morning.
                </p>
              ) : (
                <form className="fl-inline-form" onSubmit={subscribe} noValidate>
                  <label htmlFor="mag-email" className="fl-sr">
                    Email address
                  </label>
                  <input
                    id="mag-email"
                    type="email"
                    className="fl-input"
                    placeholder="you@example.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={emailErr ? true : undefined}
                    aria-describedby={emailErr ? "mag-email-err" : undefined}
                  />
                  <button type="submit" className="fl-btn fl-btn--primary">
                    Subscribe
                  </button>
                  {emailErr ? (
                    <p id="mag-email-err" className="fl-st-err" style={{ flexBasis: "100%" }}>
                      {emailErr}
                    </p>
                  ) : null}
                </form>
              )}
            </section>
          </main>

          <footer className="fl-st-mag-foot">
            <ul>
              {d.footer.links.map((l) => (
                <li key={l}>
                  <a href="#top">{l}</a>
                </li>
              ))}
            </ul>
            <p className="fl-meta">
              {d.footer.copyright} · Design: <a href="https://html5up.net">HTML5 UP</a>
            </p>
          </footer>
        </div>

        <aside id="mag-sidebar" className={`fl-st-mag-side${sidebar ? " is-open" : ""}`} aria-label="Search and sections">
          <form className="fl-st-mag-search" role="search" onSubmit={(e) => e.preventDefault()}>
            <label htmlFor="mag-search" className="fl-sr">
              Search stories
            </label>
            <input
              id="mag-search"
              type="search"
              className="fl-input"
              placeholder="Search stories"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(d.pageSize);
              }}
            />
          </form>
          <nav aria-label="Sections">
            <h2 className="fl-st-mag-rule">Menu</h2>
            <ul className="fl-st-mag-menu">
              <li>
                <button type="button" aria-pressed={section === null} onClick={() => pickSection(null)}>
                  All stories <span>{d.articles.length}</span>
                </button>
              </li>
              {d.sections.map((s) => (
                <li key={s.id}>
                  <button type="button" aria-pressed={section === s.id} onClick={() => pickSection(s.id)}>
                    {s.id} <span>{countFor(s.id)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <section aria-labelledby="mag-most-title">
            <h2 id="mag-most-title" className="fl-st-mag-rule">
              Most read
            </h2>
            <ol className="fl-st-mag-most">
              {d.mostRead.map((t) => (
                <li key={t}>
                  <a href="#mag-latest">{t}</a>
                </li>
              ))}
            </ol>
          </section>
          <section aria-labelledby="mag-saved-title">
            <h2 id="mag-saved-title" className="fl-st-mag-rule">
              Saved for later
            </h2>
            {saved.length ? (
              <ul className="fl-st-mag-most">
                {saved.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            ) : (
              <p className="fl-note">Nothing saved yet. Use Save on any story to keep it here.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
