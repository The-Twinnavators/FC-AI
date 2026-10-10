/** @flowcode-library site-real-estate · Real-estate agency website (Industry sites)
 * Use cases: real estate listings; property search; rental listings; estate agent; letting agency; home valuation; property portal; agent profiles
 * Jobs to be done: find a home in my budget; search homes to buy or rent; save homes i like; get my home valued; find a local agent
 * Keywords: page, template, real estate, property, listings, search, filters, agents, valuation, form, html5up
 */
/**
 * Page template: real-estate or letting agency website. A one-page site for a local estate agent: a hero with a
 * property search (buy or rent, area, bedrooms, budget), three proof points, listing cards with sorting and
 * save-a-home, the agents and their patches, and a free valuation form. Layout adapted from HTML5 UP "Dopetrope"
 * (html5up.net, CC BY 3.0); keep the credit. The search filters the sample listings in memory; saved homes and
 * valuation requests stay in local storage; nothing is sent.
 * Make it the app's own: replace SAMPLE with real listings, areas and agents; keep only the filters buyers really use.
 */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  brand: "Hartwell & Rowe",
  brandSub: "Estate and letting agents",
  links: [
    { label: "Buy", href: "#estate-listings" },
    { label: "Rent", href: "#estate-listings" },
    { label: "Our agents", href: "#estate-agents" },
    { label: "Valuations", href: "#estate-valuation" },
  ],
  cta: { label: "Free valuation", href: "#estate-valuation" },
  hero: {
    eyebrow: "Selling and letting in Ashford Vale since 1998",
    title: "Find the house you'll still love in ten years.",
    lede: "Family homes, flats and cottages across six neighborhoods, with agents who live round the corner.",
  },
  areas: ["Any area", "Old Town", "Riverside", "Millbrook", "Kingsmead", "Elm Park", "Southfields"],
  bedOptions: ["Any", "1+", "2+", "3+", "4+"],
  maxPrice: {
    buy: [{ label: "No max", value: 0 }, { label: "$395,000", value: 395000 }, { label: "$595,000", value: 595000 }, { label: "$795,000", value: 795000 }, { label: "$1,050,000", value: 1050000 }],
    rent: [{ label: "No max", value: 0 }, { label: "$1,300 /mo", value: 1300 }, { label: "$2,000 /mo", value: 2000 }, { label: "$2,650 /mo", value: 2650 }],
  },
  proof: [
    { icon: "chart", value: "214", label: "homes sold last year" },
    { icon: "clock", value: "23 days", label: "average time to an offer" },
    { icon: "heart", value: "4.9 / 5", label: "from 1,180 client reviews" },
  ],
  listings: [
    { id: "h1", mode: "buy", title: "Three-bed Victorian row house", area: "Old Town", address: "Chapel Street", price: 560000, beds: 3, baths: 1, sqft: 1080, status: "New", added: 3 },
    { id: "h2", mode: "buy", title: "Riverside apartment with balcony", area: "Riverside", address: "Wharf Lane", price: 385000, beds: 2, baths: 2, sqft: 780, status: "", added: 12 },
    { id: "h3", mode: "buy", title: "Detached family home and garden", area: "Kingsmead", address: "Orchard Rise", price: 915000, beds: 4, baths: 3, sqft: 1950, status: "Under contract", added: 20 },
    { id: "h4", mode: "buy", title: "Stone cottage by the green", area: "Millbrook", address: "The Green", price: 675000, beds: 3, baths: 2, sqft: 1240, status: "", added: 7 },
    { id: "h5", mode: "buy", title: "Five-bed Edwardian duplex", area: "Elm Park", address: "Beech Avenue", price: 1150000, beds: 5, baths: 3, sqft: 2400, status: "New", added: 1 },
    { id: "h6", mode: "rent", title: "One-bed apartment above the bakery", area: "Old Town", address: "Market Row", price: 1250, beds: 1, baths: 1, sqft: 520, status: "", added: 4 },
    { id: "h7", mode: "rent", title: "Two-bed modern townhouse", area: "Southfields", address: "Larch Close", price: 1900, beds: 2, baths: 2, sqft: 890, status: "New", added: 2 },
    { id: "h8", mode: "rent", title: "Family home near the schools", area: "Elm Park", address: "Hazel Road", price: 2500, beds: 4, baths: 2, sqft: 1500, status: "Lease signed", added: 15 },
    { id: "h9", mode: "rent", title: "Converted mill loft", area: "Riverside", address: "Mill Yard", price: 2175, beds: 2, baths: 1, sqft: 1010, status: "", added: 9 },
  ],
  agents: [
    { name: "Priya Raman", initials: "PR", role: "Sales, Old Town & Riverside", sold: "61 homes sold in 2025", phone: "01632 960 211" },
    { name: "Tom Okafor", initials: "TO", role: "Sales, Kingsmead & Elm Park", sold: "54 homes sold in 2025", phone: "01632 960 212" },
    { name: "Gwen Hallett", initials: "GH", role: "Lettings manager", sold: "320 homes managed", phone: "01632 960 215" },
    { name: "Daniel Marsh", initials: "DM", role: "Sales, Millbrook & Southfields", sold: "47 homes sold in 2025", phone: "01632 960 218" },
  ],
  valuation: {
    eyebrow: "Thinking of selling or letting?",
    title: "Book a free valuation",
    lede: "An agent who knows your street visits for 30 minutes and gives you a written price within 24 hours. No obligation.",
    points: ["Priced against real local sales, not an algorithm", "Advice on small fixes that add value", "Sale or let, or both side by side"],
    types: ["Terraced house", "Semi-detached house", "Detached house", "Flat or apartment", "Bungalow", "Cottage"],
    storageKey: "site-real-estate-valuations",
  },
  savedKey: "site-real-estate-saved",
  footer: {
    blurb: "An independent agency on Bridge Street, Ashford Vale. Member of the property ombudsman scheme; client money protected.",
    cols: [
      { title: "Areas", items: ["Old Town", "Riverside", "Millbrook", "Kingsmead"] },
      { title: "Company", items: ["About us", "Careers", "Fees", "Complaints"] },
      { title: "Visit", items: ["22 Bridge Street", "Ashford Vale AV1 3RT", "01632 960 200", "Mon–Sat, 9:00–17:30"] },
    ],
    copyright: "© 2026 Hartwell & Rowe Ltd",
  },
};

type Mode = "buy" | "rent";
type Errors = Partial<Record<"address" | "postcode" | "type" | "name" | "contact", string>>;

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

export default function SiteRealEstate() {
  const d = SAMPLE;
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("buy");
  const [area, setArea] = useState(d.areas[0]);
  const [beds, setBeds] = useState("Any");
  const [max, setMax] = useState(0);
  const [sort, setSort] = useState("newest");
  const [saved, setSaved] = useState<string[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    try {
      setSaved(JSON.parse(localStorage.getItem(d.savedKey) ?? "[]") as string[]);
    } catch {
      /* storage unavailable: start empty */
    }
  }, [d.savedKey]);

  const toggleSave = (id: string) =>
    setSaved((s) => {
      const next = s.includes(id) ? s.filter((x) => x !== id) : [...s, id];
      try {
        localStorage.setItem(d.savedKey, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });

  const results = useMemo(() => {
    const minBeds = beds === "Any" ? 0 : parseInt(beds, 10);
    const list = d.listings.filter((l) => l.mode === mode && (area === d.areas[0] || l.area === area) && l.beds >= minBeds && (!max || l.price <= max));
    return [...list].sort((a, b) => (sort === "low" ? a.price - b.price : sort === "high" ? b.price - a.price : a.added - b.added));
  }, [d.listings, d.areas, mode, area, beds, max, sort]);

  const reset = () => {
    setArea(d.areas[0]);
    setBeds("Any");
    setMax(0);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setMax(0);
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? "").trim();
    const next: Errors = {};
    if (!v("address")) next.address = "Add the first line of the address.";
    if (!/^\d{5}(-\d{4})?$/.test(v("postcode"))) next.postcode = "Enter a full ZIP code, like AV1 3RT.";
    if (!v("type")) next.type = "Choose the type of property.";
    if (!v("name")) next.name = "Add your name.";
    const c = v("contact");
    if (!/^\S+@\S+\.\S+$/.test(c) && !/^[+\d][\d\s()-]{6,}$/.test(c)) next.contact = "Enter an email address or a phone number.";
    setErrors(next);
    if (Object.keys(next).length) {
      e.currentTarget.querySelector<HTMLElement>(`[name="${Object.keys(next)[0]}"]`)?.focus();
      return;
    }
    try {
      const list = JSON.parse(localStorage.getItem(d.valuation.storageKey) ?? "[]") as unknown[];
      localStorage.setItem(d.valuation.storageKey, JSON.stringify([...list, { ...Object.fromEntries(f), at: new Date().toISOString() }]));
    } catch {
      /* storage unavailable: the confirmation still shows */
    }
    setDone(v("name"));
  };

  const errText = (k: keyof Errors) =>
    errors[k] ? (
      <p id={`estate-${k}-err`} className="fl-st-err">
        {errors[k]}
      </p>
    ) : null;
  const errProps = (k: keyof Errors) => ({ "aria-invalid": errors[k] ? true : undefined, "aria-describedby": errors[k] ? `estate-${k}-err` : undefined });

  return (
    <div className="fl-st fl-st-estate" id="top">
      <header className="fl-st-estate-top">
        <div className="fl-st-estate-toprow">
          <a className="fl-st-estate-brand" href="#top">
            <span className="fl-st-estate-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11 12 4l9 7M5 10v10h14V10M10 20v-6h4v6" />
              </svg>
            </span>
            <span>
              <strong>{d.brand}</strong>
              <small>{d.brandSub}</small>
            </span>
          </a>
          <nav aria-label="Main" className={`fl-st-estate-nav${menuOpen ? " is-open" : ""}`} id="estate-nav">
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
          <div className="fl-st-estate-end">
            <a className="fl-btn fl-btn--primary fl-st-hide-sm" href={d.cta.href}>
              {d.cta.label}
            </a>
            <button type="button" className="fl-btn fl-btn--secondary fl-st-menubtn" aria-expanded={menuOpen} aria-controls="estate-nav" aria-label="Menu" onClick={() => setMenuOpen((o) => !o)}>
              <Icon name="menu" />
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="fl-section fl-bg-split fl-st-estate-hero" aria-labelledby="estate-hero-title">
          <div className="fl-wrap">
            <div className="fl-head">
              <p className="fl-eyebrow">{d.hero.eyebrow}</p>
              <h1 id="estate-hero-title" className="fl-title fl-title--xl">
                {d.hero.title}
              </h1>
              <p className="fl-lede">{d.hero.lede}</p>
            </div>
            <form className="fl-st-estate-search" role="search" aria-label="Property search" onSubmit={(e) => { e.preventDefault(); document.getElementById("estate-listings")?.scrollIntoView({ block: "start" }); }}>
              <div className="fl-toggle" role="group" aria-label="Buy or rent">
                {(["buy", "rent"] as Mode[]).map((m) => (
                  <button key={m} type="button" aria-pressed={mode === m} onClick={() => switchMode(m)}>
                    {m === "buy" ? "Buy" : "Rent"}
                  </button>
                ))}
              </div>
              <div className="fl-st-estate-fields">
                <div className="fl-field">
                  <label htmlFor="estate-area">Area</label>
                  <select id="estate-area" className="fl-input fl-st-select" value={area} onChange={(e) => setArea(e.target.value)}>
                    {d.areas.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                </div>
                <div className="fl-field">
                  <label htmlFor="estate-beds">Bedrooms</label>
                  <select id="estate-beds" className="fl-input fl-st-select" value={beds} onChange={(e) => setBeds(e.target.value)}>
                    {d.bedOptions.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div className="fl-field">
                  <label htmlFor="estate-max">Max price</label>
                  <select id="estate-max" className="fl-input fl-st-select" value={max} onChange={(e) => setMax(Number(e.target.value))}>
                    {d.maxPrice[mode].map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="fl-btn fl-btn--primary">
                  Show {results.length} {results.length === 1 ? "home" : "homes"}
                </button>
              </div>
            </form>
          </div>
        </section>

        <section className="fl-st-estate-proof" aria-label="Why sell with us">
          <div className="fl-wrap fl-grid fl-grid--3">
            {d.proof.map((p) => (
              <div key={p.label} className="fl-st-estate-proofbox">
                <span className="fl-icon">
                  <Icon name={p.icon} />
                </span>
                <div className="fl-stat">
                  <strong>{p.value}</strong>
                  <span>{p.label}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="fl-section" id="estate-listings" aria-labelledby="estate-listings-title">
          <div className="fl-wrap">
            <div className="fl-st-estate-listhead">
              <div>
                <h2 id="estate-listings-title" className="fl-title">
                  {mode === "buy" ? "Homes for sale" : "Homes to rent"}
                </h2>
                <p className="fl-meta" aria-live="polite">
                  {results.length} {results.length === 1 ? "home" : "homes"}
                  {area !== d.areas[0] ? ` in ${area}` : ""}
                  {saved.length ? ` · ${saved.length} saved` : ""}
                </p>
              </div>
              <div className="fl-field fl-st-estate-sort">
                <label htmlFor="estate-sort">Sort by</label>
                <select id="estate-sort" className="fl-input fl-st-select" value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="newest">Newest first</option>
                  <option value="low">Price, low to high</option>
                  <option value="high">Price, high to low</option>
                </select>
              </div>
            </div>
            {results.length ? (
              <ul className="fl-grid fl-grid--3 fl-st-estate-list">
                {results.map((l) => {
                  const isSaved = saved.includes(l.id);
                  return (
                    <li key={l.id} className="fl-card fl-st-estate-card">
                      <div className={`fl-st-estate-card__img fl-st-tone-${(d.listings.indexOf(l) % 6) + 1}`} aria-hidden="true">
                        <svg viewBox="0 0 120 80" preserveAspectRatio="xMidYMid meet">
                          <path d="M30 70V40l30-22 30 22v30z" fill="currentColor" opacity="0.22" />
                          <path d="M52 70V52h16v18" fill="currentColor" opacity="0.35" />
                        </svg>
                      </div>
                      {l.status ? <span className={`fl-badge fl-st-estate-status${l.status === "New" ? "" : " is-muted"}`}>{l.status}</span> : null}
                      <p className="fl-st-estate-price">
                        {money(l.price)}
                        {l.mode === "rent" ? <span> /mo</span> : null}
                      </p>
                      <h3>{l.title}</h3>
                      <p className="fl-meta">
                        <Icon name="pin" /> {l.address}, {l.area}
                      </p>
                      <ul className="fl-st-estate-facts">
                        <li>{l.beds} bed</li>
                        <li>{l.baths} bath</li>
                        <li>{l.sqft.toLocaleString("en-US")} sq ft</li>
                      </ul>
                      <div className="fl-st-estate-card__foot">
                        <a className="fl-link" href="#estate-agents">
                          Arrange a viewing
                        </a>
                        <button type="button" className="fl-st-save" aria-pressed={isSaved} onClick={() => toggleSave(l.id)}>
                          <Icon name="heart" />
                          <span>{isSaved ? "Saved" : "Save"}</span>
                          <span className="fl-sr"> {l.title}</span>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="fl-st-empty">
                <strong>No homes match those filters right now.</strong>
                <span>New homes come on most weeks. Widen the search, or ask an agent to tell you first.</span>
                <button type="button" className="fl-btn fl-btn--secondary" onClick={reset}>
                  Reset filters
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="fl-section fl-section--tint" id="estate-agents" aria-labelledby="estate-agents-title">
          <div className="fl-wrap">
            <div className="fl-head">
              <h2 id="estate-agents-title" className="fl-title">
                Your local agents
              </h2>
              <p className="fl-lede">Each of us covers a few neighborhoods, so the person who values your home also shows it.</p>
            </div>
            <ul className="fl-grid fl-grid--4 fl-st-estate-agents">
              {d.agents.map((a) => (
                <li key={a.name} className="fl-card">
                  <span className="fl-person__avatar fl-st-estate-avatar" aria-hidden="true">
                    {a.initials}
                  </span>
                  <h3>{a.name}</h3>
                  <p className="fl-meta">{a.role}</p>
                  <p className="fl-text">{a.sold}</p>
                  <a className="fl-link" href={`tel:${a.phone.replace(/\s/g, "")}`}>
                    <Icon name="phone" /> {a.phone}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="fl-section" id="estate-valuation" aria-labelledby="estate-val-title">
          <div className="fl-wrap fl-split fl-split--start">
            <div className="fl-head" style={{ marginBottom: 0 }}>
              <p className="fl-eyebrow">{d.valuation.eyebrow}</p>
              <h2 id="estate-val-title" className="fl-title">
                {d.valuation.title}
              </h2>
              <p className="fl-lede">{d.valuation.lede}</p>
              <ul className="fl-checks" style={{ marginTop: "var(--space-3)" }}>
                {d.valuation.points.map((p) => (
                  <li key={p}>
                    <span className="fl-tick" aria-hidden="true">
                      <Icon name="check" />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="fl-card">
              {done ? (
                <div className="fl-form" role="status">
                  <p className="fl-done">Thanks {done}. Your local agent will be in touch today to arrange a time.</p>
                  <button type="button" className="fl-btn fl-btn--secondary" onClick={() => setDone(null)}>
                    Value another property
                  </button>
                </div>
              ) : (
                <form className="fl-form" onSubmit={submit} noValidate>
                  <div className="fl-st-row2">
                    <div className="fl-field">
                      <label htmlFor="estate-address">Address</label>
                      <input id="estate-address" name="address" className="fl-input" autoComplete="address-line1" {...errProps("address")} />
                      {errText("address")}
                    </div>
                    <div className="fl-field">
                      <label htmlFor="estate-postcode">ZIP code</label>
                      <input id="estate-postcode" name="postcode" className="fl-input" autoComplete="postal-code" {...errProps("postcode")} />
                      {errText("postcode")}
                    </div>
                  </div>
                  <div className="fl-st-row2">
                    <div className="fl-field">
                      <label htmlFor="estate-type">Property type</label>
                      <select id="estate-type" name="type" className="fl-input fl-st-select" defaultValue="" {...errProps("type")}>
                        <option value="" disabled>
                          Choose
                        </option>
                        {d.valuation.types.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                      {errText("type")}
                    </div>
                    <div className="fl-field">
                      <label htmlFor="estate-bedrooms">Bedrooms</label>
                      <select id="estate-bedrooms" name="bedrooms" className="fl-input fl-st-select" defaultValue="3">
                        {["1", "2", "3", "4", "5+"].map((b) => (
                          <option key={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <fieldset className="fl-st-fieldset">
                    <legend>I'm thinking of</legend>
                    <div className="fl-st-chips">
                      {["Selling", "Letting", "Not sure yet"].map((o, i) => (
                        <label key={o} className="fl-st-radio">
                          <input type="radio" name="plan" value={o} defaultChecked={i === 0} />
                          <span>{o}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="fl-st-row2">
                    <div className="fl-field">
                      <label htmlFor="estate-name">Your name</label>
                      <input id="estate-name" name="name" className="fl-input" autoComplete="name" {...errProps("name")} />
                      {errText("name")}
                    </div>
                    <div className="fl-field">
                      <label htmlFor="estate-contact">Email or phone</label>
                      <input id="estate-contact" name="contact" className="fl-input" {...errProps("contact")} />
                      {errText("contact")}
                    </div>
                  </div>
                  <button type="submit" className="fl-btn fl-btn--primary">
                    Request my valuation
                  </button>
                  <p className="fl-note">We only use your details to arrange the visit.</p>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="fl-footer fl-st-estate-foot">
        <div className="fl-wrap">
          <div className="fl-footer__cols">
            <div style={{ display: "grid", gap: "var(--space-3)", alignContent: "start" }}>
              <strong>{d.brand}</strong>
              <p className="fl-text">{d.footer.blurb}</p>
            </div>
            {d.footer.cols.map((c) => (
              <div key={c.title}>
                <h4>{c.title}</h4>
                <ul>
                  {c.items.map((i) => (
                    <li key={i}>{c.title === "Visit" ? i : <a href="#top">{i}</a>}</li>
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
