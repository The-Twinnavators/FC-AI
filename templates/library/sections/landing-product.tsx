/**
 * Page template: single product landing page for a physical product. Gallery on the left (four views you can switch),
 * the buy box on the right with rating, price, finish and shade options, quantity and "Add to bag", then details,
 * specs and shipping in tabs, and a reviews summary you can filter by star rating. Suits shops that sell one hero
 * product, makers, and direct-to-customer brands. Adding to the bag only updates the count in the header; nothing is
 * sent. Make it the app's own: replace SAMPLE with the real product, its options and prices, and use real photos in
 * place of the drawn lamp.
 */
import { useState, type KeyboardEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  brand: "Northlight Works",
  eyebrow: "Designed and assembled in our workshop",
  name: "Arc Desk Lamp",
  tagline: "A warm, glare-free reading light with a two-joint arm that stays exactly where you put it.",
  price: 148,
  currency: "$",
  rating: 4.7,
  reviewCount: 312,
  views: [
    { id: "front", label: "Front" },
    { id: "detail", label: "Shade detail" },
    { id: "room", label: "On a desk" },
    { id: "night", label: "Lit at night" },
  ],
  finishes: [
    { id: "graphite", label: "Graphite", swatch: "var(--color-text)" },
    { id: "chalk", label: "Chalk", swatch: "var(--color-surface)" },
    { id: "brass", label: "Brushed brass", swatch: "color-mix(in srgb, var(--color-accent) 70%, var(--color-surface))", extra: 20 },
  ],
  shades: [
    { id: "dome", label: "Dome shade" },
    { id: "cone", label: "Cone shade" },
  ],
  stockNote: "In stock · ships in 1–2 working days",
  perks: [
    { icon: "clock", text: "Free delivery over $100" },
    { icon: "shield", text: "Five-year warranty" },
    { icon: "arrow", text: "60-day returns" },
  ],
  details:
    "The Arc uses a single 8 W LED module behind a frosted diffuser, so the light is soft enough to read by without squinting at the page. Two friction joints and a weighted base let you angle it over a notebook, a keyboard or a sewing machine, and it stays put. A touch dimmer on the base steps through five levels and remembers the last one.",
  specs: [
    { k: "Height", v: "38–62 cm (adjustable)" },
    { k: "Reach", v: "45 cm from the base" },
    { k: "Base", v: "16 cm round, 1.4 kg steel" },
    { k: "Light", v: "8 W LED, 2700 K warm white, 600 lumens" },
    { k: "Dimming", v: "Touch dimmer, 5 levels" },
    { k: "Cable", v: "2 m braided fabric, inline USB-C power" },
    { k: "Materials", v: "Powder-coated steel, aluminium arm, glass diffuser" },
  ],
  shipping:
    "Orders placed before 2 pm ship the same day from our workshop. Delivery takes 2–4 working days. Not quite right? Send it back within 60 days in its box for a full refund; we cover return postage.",
  distribution: [
    { stars: 5, count: 241 },
    { stars: 4, count: 48 },
    { stars: 3, count: 14 },
    { stars: 2, count: 6 },
    { stars: 1, count: 3 },
  ],
  reviews: [
    { stars: 5, title: "Finally, a lamp that doesn't droop", text: "My last two lamps sagged within a month. This one holds its angle over my drawing board all day.", name: "Priya N.", finish: "Graphite" },
    { stars: 5, title: "Warm and easy on the eyes", text: "I read for an hour before bed and no more headaches. The dimmer remembering my setting is a small joy.", name: "Daniel O.", finish: "Brushed brass" },
    { stars: 4, title: "Lovely, base is heavy", text: "Beautifully made. The base is heavier than I expected, which is good for stability but tricky to move around.", name: "Elsa K.", finish: "Chalk" },
    { stars: 3, title: "Good light, short cable for my desk", text: "Light quality is excellent. I needed an extension because my socket is behind a bookcase.", name: "Marcus T.", finish: "Graphite" },
  ],
  footer: { copy: "© 2026 Northlight Works", links: [{ label: "Shipping", href: "#shipping" }, { label: "Warranty", href: "#warranty" }, { label: "Contact", href: "#contact" }] },
};

type Tab = "details" | "specs" | "shipping";

function Stars({ value }: { value: number }) {
  return (
    <span className="fl-ld-stars" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" fill={n <= Math.round(value) ? "currentColor" : "none"}>
          <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z" />
        </svg>
      ))}
    </span>
  );
}

function Lamp({ view }: { view: string }) {
  if (view === "detail") {
    return (
      <svg viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" aria-hidden="true">
        <path d="M40 120 Q100 30 160 120 Z" fill="color-mix(in srgb, currentColor 18%, transparent)" />
        <ellipse cx="100" cy="122" rx="60" ry="10" />
        <ellipse cx="100" cy="122" rx="32" ry="5" fill="currentColor" opacity="0.5" />
        <path d="M100 58 V30" />
      </svg>
    );
  }
  const lit = view === "night";
  return (
    <svg viewBox="0 0 200 240" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {lit ? <path d="M138 92 L196 230 H70 Z" fill="currentColor" opacity="0.18" stroke="none" /> : null}
      <ellipse cx="70" cy="222" rx="38" ry="8" fill="color-mix(in srgb, currentColor 25%, transparent)" />
      <path d="M70 214 L52 134 L120 70" />
      <circle cx="52" cy="134" r="5" fill="currentColor" />
      <circle cx="120" cy="70" r="5" fill="currentColor" />
      <path d="M112 64 Q140 50 162 88 L124 102 Z" fill="color-mix(in srgb, currentColor 22%, transparent)" />
      {view === "room" ? <path d="M0 230 H200" strokeWidth={2} opacity="0.5" /> : null}
    </svg>
  );
}

export default function LandingProduct() {
  const d = SAMPLE;
  const [view, setView] = useState(d.views[0].id);
  const [finish, setFinish] = useState(d.finishes[0].id);
  const [shade, setShade] = useState(d.shades[0].id);
  const [qty, setQty] = useState(1);
  const [bag, setBag] = useState(0);
  const [status, setStatus] = useState("");
  const [tab, setTab] = useState<Tab>("details");
  const [starFilter, setStarFilter] = useState<number | null>(null);

  const chosenFinish = d.finishes.find((f) => f.id === finish) ?? d.finishes[0];
  const unit = d.price + (chosenFinish.extra ?? 0);
  const money = (n: number) => `${d.currency}${n.toLocaleString()}`;
  const total = d.distribution.reduce((s, r) => s + r.count, 0);
  const shown = starFilter ? d.reviews.filter((r) => r.stars === starFilter) : d.reviews;
  const viewLabel = d.views.find((v) => v.id === view)?.label ?? "";

  const add = () => {
    setBag((b) => b + qty);
    const shadeLabel = d.shades.find((s) => s.id === shade)?.label.toLowerCase();
    setStatus(`Added ${qty} × ${d.name} (${chosenFinish.label}, ${shadeLabel}) to your bag.`);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "details", label: "Details" },
    { id: "specs", label: "Specifications" },
    { id: "shipping", label: "Shipping and returns" },
  ];

  const onTabKey = (e: KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = (i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
    setTab(tabs[next].id);
    document.getElementById(`ld-prod-tab-${tabs[next].id}`)?.focus();
  };

  return (
    <div className="fl-ld-page">
      <header className="fl-ld-bar fl-ld-bar--line">
        <a className="fl-ld-brand" href="#top">
          <span className="fl-ld-brand__mark">
            <Icon name="sparkle" />
          </span>
          {d.brand}
        </a>
        <a className="fl-btn fl-btn--secondary fl-ld-bag" href="#bag" style={{ minHeight: "var(--control-md)" }}>
          Bag
          <span className="fl-ld-bag__count">{bag}</span>
          <span className="fl-sr">items</span>
        </a>
      </header>

      <main id="top">
        <section className="fl-section" aria-labelledby="ld-prod-name" style={{ paddingTop: "var(--space-7)" }}>
          <div className="fl-wrap fl-ld-product">
            <div className="fl-ld-gallery">
              <div className={`fl-ld-stage fl-ld-stage--${view}`} role="img" aria-label={`${d.name}, ${viewLabel.toLowerCase()} view (placeholder image)`}>
                <Lamp view={view} />
              </div>
              <ul className="fl-ld-thumbs" aria-label="Product views">
                {d.views.map((v) => (
                  <li key={v.id}>
                    <button type="button" className="fl-ld-thumb" aria-pressed={view === v.id} onClick={() => setView(v.id)}>
                      {v.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="fl-ld-buy">
              <span className="fl-eyebrow">{d.eyebrow}</span>
              <h1 id="ld-prod-name" className="fl-title fl-title--xl">
                {d.name}
              </h1>
              <a className="fl-ld-rating" href="#reviews" style={{ textDecoration: "none" }}>
                <Stars value={d.rating} />
                <span>
                  {d.rating} out of 5 · {d.reviewCount} reviews
                </span>
              </a>
              <p className="fl-lede">{d.tagline}</p>
              <div className="fl-price" aria-live="polite">
                <strong>{money(unit)}</strong>
                {chosenFinish.extra ? <span className="fl-meta">includes {money(chosenFinish.extra)} for brass</span> : null}
              </div>

              <fieldset className="fl-ld-opts">
                <legend>
                  Finish: <span>{chosenFinish.label}</span>
                </legend>
                <div className="fl-ld-optrow">
                  {d.finishes.map((f) => (
                    <label key={f.id} title={f.label}>
                      <input className="fl-sr" type="radio" name="ld-prod-finish" value={f.id} checked={finish === f.id} onChange={() => setFinish(f.id)} />
                      <span className="fl-ld-swatch" style={{ background: f.swatch }} />
                      <span className="fl-sr">{f.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="fl-ld-opts">
                <legend>Shade</legend>
                <div className="fl-ld-optrow">
                  {d.shades.map((s) => (
                    <label key={s.id}>
                      <input className="fl-sr" type="radio" name="ld-prod-shade" value={s.id} checked={shade === s.id} onChange={() => setShade(s.id)} />
                      <span className="fl-ld-chip">{s.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="fl-ld-buyrow">
                <div className="fl-ld-qty" role="group" aria-label="Quantity">
                  <button type="button" className="fl-ld-icon-btn" aria-label="One fewer" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}>
                    −
                  </button>
                  <output aria-live="polite">{qty}</output>
                  <button type="button" className="fl-ld-icon-btn" aria-label="One more" disabled={qty >= 5} onClick={() => setQty((q) => Math.min(5, q + 1))}>
                    +
                  </button>
                </div>
                <button type="button" className="fl-btn fl-btn--primary" onClick={add}>
                  Add to bag · {money(unit * qty)}
                </button>
              </div>
              <p className="fl-note" role="status" style={{ margin: 0 }}>
                {status ? <span className="fl-done" style={{ display: "block" }}>{status}</span> : qty >= 5 ? "Five per order. Need more? Ask about trade pricing." : d.stockNote}
              </p>

              <ul className="fl-ld-trust">
                {d.perks.map((p) => (
                  <li key={p.text}>
                    <Icon name={p.icon} />
                    {p.text}
                  </li>
                ))}
              </ul>

              <div>
                <div className="fl-ld-tabs" role="tablist" aria-label="About the lamp">
                  {tabs.map((t, i) => (
                    <button
                      key={t.id}
                      id={`ld-prod-tab-${t.id}`}
                      type="button"
                      role="tab"
                      className="fl-ld-tab"
                      aria-selected={tab === t.id}
                      aria-controls="ld-prod-panel"
                      tabIndex={tab === t.id ? 0 : -1}
                      onClick={() => setTab(t.id)}
                      onKeyDown={(e) => onTabKey(e, i)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="fl-ld-tabpanel" id="ld-prod-panel" role="tabpanel" aria-labelledby={`ld-prod-tab-${tab}`} tabIndex={0}>
                  {tab === "details" ? <p style={{ margin: 0 }}>{d.details}</p> : null}
                  {tab === "specs" ? (
                    <dl className="fl-ld-specs">
                      {d.specs.map((s) => (
                        <div key={s.k} style={{ display: "contents" }}>
                          <dt>{s.k}</dt>
                          <dd>{s.v}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {tab === "shipping" ? <p style={{ margin: 0 }}>{d.shipping}</p> : null}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="fl-section fl-section--tint" id="reviews" aria-labelledby="ld-prod-reviews">
          <div className="fl-wrap fl-ld-reviews">
            <div style={{ display: "grid", gap: "var(--space-4)" }}>
              <h2 id="ld-prod-reviews" className="fl-title fl-title--md">
                What owners say
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <span className="fl-ld-avg">{d.rating}</span>
                <span style={{ display: "grid", gap: "var(--space-1)" }}>
                  <Stars value={d.rating} />
                  <span className="fl-meta">{d.reviewCount} reviews</span>
                </span>
              </div>
              <ul className="fl-ld-dist" aria-label="Filter reviews by rating">
                {d.distribution.map((r) => (
                  <li key={r.stars}>
                    <button type="button" aria-pressed={starFilter === r.stars} onClick={() => setStarFilter(starFilter === r.stars ? null : r.stars)}>
                      <span>{r.stars} stars</span>
                      <span className="fl-ld-meter" aria-hidden="true">
                        <span style={{ width: `${Math.round((r.count / total) * 100)}%` }} />
                      </span>
                      <span>{r.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {starFilter ? (
                <button type="button" className="fl-link" style={{ justifySelf: "start", background: "none", border: 0, cursor: "pointer", font: "inherit", fontSize: "var(--text-sm)" }} onClick={() => setStarFilter(null)}>
                  Show all reviews
                </button>
              ) : null}
            </div>
            <div aria-live="polite">
              <p className="fl-meta" style={{ marginTop: 0 }}>
                {starFilter ? `Showing ${starFilter}-star reviews` : "Most helpful first"}
              </p>
              {shown.length === 0 ? (
                <div className="fl-card" style={{ justifyItems: "start" }}>
                  <h3>No {starFilter}-star reviews to show here yet</h3>
                  <p className="fl-text">These are a sample of recent reviews. Try another rating or show them all.</p>
                  <button type="button" className="fl-btn fl-btn--secondary" onClick={() => setStarFilter(null)}>
                    Show all reviews
                  </button>
                </div>
              ) : (
                shown.map((r) => (
                  <article key={r.name} className="fl-ld-review">
                    <span className="fl-ld-rating">
                      <Stars value={r.stars} />
                      <span className="fl-sr">{r.stars} out of 5</span>
                    </span>
                    <h3>{r.title}</h3>
                    <p className="fl-text">{r.text}</p>
                    <span className="fl-meta">
                      {r.name} · {r.finish} · Verified buyer
                    </span>
                  </article>
                ))
              )}
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
