/** @flowcode-library landing-product-clothing · Product page: a garment (Landing pages)
 * Use cases: clothing product page; fashion ecommerce; apparel store; shoes; size and colour picker; direct-to-consumer clothing
 * Jobs to be done: find the size that fits me; see whether my size is left in the colour I want; know how it is cut before I buy; hear when my size is back
 * Keywords: landing, product, clothing, ecommerce, size, size guide, stock, variant, page template
 */
/**
 * Page template: product page for a garment. The same shape as the lamp page, but the decision is a different one,
 * and the markup carries it: size and colour are not independent, so the size row knows what is left in the colour
 * you picked; a size guide opens in a dialog with the measurements; the fit note says what the model is wearing; the
 * fabric, its care and where it was made sit next to the price rather than inside a tab; and a size that is gone
 * offers to tell you when it is back instead of being quietly disabled.
 *
 * Suits clothing, shoes and anything else bought by size. Nothing is sent: adding to the bag updates the count in
 * the header, and the back-in-stock form only says it has your address.
 *
 * Make it the app's own: replace SAMPLE with the real garment, its colours, its stock per size and its measurements,
 * and use photographs in place of the drawn shirt. Keep the stock table honest - a size shown as available and then
 * refused at checkout is the one thing this page exists to prevent.
 */
import { useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  brand: "Fenwick & Vale",
  eyebrow: "Woven in Biella, made in Portugal",
  name: "Everyday Oxford Shirt",
  tagline: "A soft, unlined oxford with a relaxed collar that stays put without a stay. Cut to wear open or buttoned.",
  price: 118,
  was: 145,
  currency: "$",
  rating: 4.6,
  reviewCount: 847,
  colors: [
    { id: "sand", label: "Sand", hex: "#d9cdb8" },
    { id: "ink", label: "Ink", hex: "#232a3a" },
    { id: "sage", label: "Sage", hex: "#8a9a82" },
  ],
  sizes: ["XS", "S", "M", "L", "XL", "XXL"],
  // What is left, per colour and size. The page is only as honest as this table.
  stock: {
    sand: { XS: 4, S: 0, M: 2, L: 9, XL: 6, XXL: 0 },
    ink: { XS: 0, S: 7, M: 11, L: 3, XL: 0, XXL: 5 },
    sage: { XS: 2, S: 5, M: 0, L: 0, XL: 8, XXL: 1 },
  } as Record<string, Record<string, number>>,
  views: [
    { id: "front", label: "Front" },
    { id: "back", label: "Back" },
    { id: "collar", label: "Collar" },
    { id: "worn", label: "On a body" },
  ],
  fit: {
    model: "The model is 6'1\" and wears a Medium.",
    note: "Relaxed through the body. If you are between sizes and want it closer, take the smaller one.",
  },
  fabric: [
    { k: "Fabric", v: "100% long-staple cotton oxford, 140 gsm" },
    { k: "Care", v: "Machine wash cold, hang to dry, warm iron" },
    { k: "Made in", v: "Portugal, from Italian cloth" },
  ],
  // Measurements in inches, laid flat.
  guide: {
    cols: ["Chest", "Waist", "Length", "Sleeve"],
    rows: [
      { size: "XS", v: [38, 36, 27, 32.5] },
      { size: "S", v: [40, 38, 28, 33] },
      { size: "M", v: [42, 40, 29, 33.5] },
      { size: "L", v: [44.5, 42.5, 30, 34] },
      { size: "XL", v: [47, 45, 30.5, 34.5] },
      { size: "XXL", v: [50, 48, 31, 35] },
    ],
  },
  returns: "Free returns and exchanges for 60 days, worn or not. Exchanges ship the same day.",
  lowStock: 3,
};

/** The garment, drawn rather than photographed, so the piece needs no assets. */
function Shirt({ view, hex }: { view: string; hex: string }) {
  const body = (
    <>
      <path d="M60 52 L36 64 L28 104 L48 110 L52 96 L52 212 L148 212 L148 96 L152 110 L172 104 L164 64 L140 52" fill={hex} stroke="currentColor" strokeWidth={3} />
      <path d="M60 52 L100 86 L140 52" fill="none" stroke="currentColor" strokeWidth={3} />
    </>
  );
  if (view === "collar")
    return (
      <svg viewBox="0 0 200 240" aria-hidden="true">
        <path d="M40 180 L100 60 L160 180" fill={hex} stroke="currentColor" strokeWidth={4} />
        <path d="M100 60 L72 104 L100 128 L128 104 Z" fill="var(--color-surface)" stroke="currentColor" strokeWidth={4} />
        <circle cx="100" cy="150" r="5" fill="currentColor" />
      </svg>
    );
  if (view === "worn")
    return (
      <svg viewBox="0 0 200 240" aria-hidden="true">
        <circle cx="100" cy="34" r="22" fill="none" stroke="currentColor" strokeWidth={3} />
        <g transform="translate(0 18) scale(1 0.92)">{body}</g>
      </svg>
    );
  return (
    <svg viewBox="0 0 200 240" aria-hidden="true">
      {body}
      {view === "back" ? <path d="M52 96 L148 96" fill="none" stroke="currentColor" strokeWidth={3} /> : <path d="M100 86 L100 212" fill="none" stroke="currentColor" strokeWidth={3} />}
    </svg>
  );
}

export default function LandingProductClothing() {
  const d = SAMPLE;
  const [view, setView] = useState(d.views[0].id);
  const [color, setColor] = useState(d.colors[0].id);
  const [size, setSize] = useState("");
  const [qty, setQty] = useState(1);
  const [bag, setBag] = useState(0);
  const [guide, setGuide] = useState(false);
  const [notify, setNotify] = useState("");
  const [said, setSaid] = useState("");

  const left = (s: string) => d.stock[color]?.[s] ?? 0;
  const chosen = d.colors.find((c) => c.id === color) ?? d.colors[0];
  const inStock = size ? left(size) : 0;
  const gone = Boolean(size) && inStock === 0;

  // Changing colour can strand the size you had: say so rather than silently keeping a size you cannot have.
  const pickColor = (id: string) => {
    setColor(id);
    const was = size;
    if (was && (d.stock[id]?.[was] ?? 0) === 0) setSaid(`${d.colors.find((c) => c.id === id)?.label} has no ${was} left. Pick another size.`);
    else setSaid("");
  };

  const add = () => {
    if (!size) return setSaid("Choose a size first.");
    if (gone) return setSaid(`${size} in ${chosen.label} is sold out.`);
    setBag((n) => n + qty);
    setSaid(`${qty} × ${d.name}, ${chosen.label}, size ${size}, added to your bag.`);
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
        <a className="fl-btn fl-btn--secondary fl-ld-bag" href="#top" style={{ minHeight: "var(--control-md)" }}>
          Bag
          <span className="fl-ld-bag__count">{bag}</span>
          <span className="fl-sr">items</span>
        </a>
      </header>

      <main id="top">
        <section className="fl-section" aria-labelledby="ld-cloth-name" style={{ paddingTop: "var(--space-7)" }}>
          <div className="fl-wrap fl-ld-product">
            <div className="fl-ld-gallery">
              <div className="fl-ld-stage" role="img" aria-label={`${d.name} in ${chosen.label}, ${d.views.find((v) => v.id === view)?.label} (placeholder image)`}>
                <Shirt view={view} hex={chosen.hex} />
              </div>
              <ul className="fl-ld-thumbs" aria-label="Product views">
                {d.views.map((v) => (
                  <li key={v.id}>
                    <button type="button" className="fl-ld-thumb" aria-pressed={v.id === view} onClick={() => setView(v.id)}>
                      {v.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="fl-ld-buy">
              <span className="fl-eyebrow">{d.eyebrow}</span>
              <h1 id="ld-cloth-name" className="fl-title fl-title--xl">
                {d.name}
              </h1>
              <p className="fl-lede" style={{ margin: 0 }}>
                {d.tagline}
              </p>
              <p className="fl-ld-price">
                <strong>
                  {d.currency}
                  {d.price}
                </strong>
                <s>
                  {d.currency}
                  {d.was}
                </s>
                <span className="fl-meta">
                  {d.rating} out of 5 &middot; {d.reviewCount.toLocaleString("en-US")} reviews
                </span>
              </p>

              <fieldset className="fl-ld-opts">
                <legend>
                  Colour: <span>{chosen.label}</span>
                </legend>
                <div className="fl-ld-optrow">
                  {d.colors.map((c) => (
                    <label key={c.id} title={c.label}>
                      <input type="radio" name="cloth-color" className="fl-sr" checked={c.id === color} onChange={() => pickColor(c.id)} />
                      <span className="fl-ld-swatch" style={{ background: c.hex }} />
                      <span className="fl-sr">{c.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="fl-ld-opts">
                <legend className="fl-ld-sizehead">
                  Size{size ? <span> {size}</span> : <span> not chosen</span>}
                  <button type="button" className="fl-ld-guidelink" onClick={() => setGuide(true)}>
                    Size guide
                  </button>
                </legend>
                <div className="fl-ld-sizes">
                  {d.sizes.map((s) => {
                    const n = left(s);
                    return (
                      <label key={s} className={`fl-ld-size${n === 0 ? " is-gone" : ""}`}>
                        <input type="radio" name="cloth-size" className="fl-sr" checked={s === size} onChange={() => (setSize(s), setSaid(""))} />
                        <span>{s}</span>
                        <span className="fl-sr">{n === 0 ? ", sold out" : n <= d.lowStock ? `, only ${n} left` : ", in stock"}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="fl-ld-fine" aria-live="polite">
                  {!size
                    ? "Sizes with a line through them are sold out in this colour."
                    : gone
                      ? `${size} is sold out in ${chosen.label}.`
                      : inStock <= d.lowStock
                        ? `Only ${inStock} left in ${chosen.label}.`
                        : `In stock in ${chosen.label}.`}
                </p>
              </fieldset>

              {gone ? (
                <form
                  className="fl-ld-notify"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!notify.trim()) return;
                    setSaid(`We will email ${notify.trim()} when ${size} is back in ${chosen.label}.`);
                    setNotify("");
                  }}
                >
                  <label className="fl-sr" htmlFor="cloth-notify">
                    Email address
                  </label>
                  <div className="fl-inline-form">
                    <input id="cloth-notify" className="fl-input" type="email" autoComplete="email" placeholder="you@example.com" value={notify} onChange={(e) => setNotify(e.target.value)} />
                    <button type="submit" className="fl-btn fl-btn--secondary">
                      Tell me when it is back
                    </button>
                  </div>
                </form>
              ) : (
                <div className="fl-ld-buyrow">
                  <span className="fl-ld-qty">
                    <button type="button" className="fl-btn fl-btn--secondary" aria-label="One fewer" onClick={() => setQty((n) => Math.max(1, n - 1))}>
                      &minus;
                    </button>
                    <output aria-label="Quantity">{qty}</output>
                    <button type="button" className="fl-btn fl-btn--secondary" aria-label="One more" onClick={() => setQty((n) => Math.min(10, n + 1))}>
                      +
                    </button>
                  </span>
                  <button type="button" className="fl-btn fl-btn--primary" onClick={add}>
                    Add to bag
                  </button>
                </div>
              )}

              <p className="fl-ld-status" role="status" aria-live="polite">
                {said}
              </p>

              <div className="fl-ld-fit">
                <p>
                  <strong>Fit.</strong> {d.fit.note} {d.fit.model}
                </p>
                <dl className="fl-ld-fabric">
                  {d.fabric.map((f) => (
                    <div key={f.k}>
                      <dt>{f.k}</dt>
                      <dd>{f.v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="fl-ld-fine">
                  <Icon name="refresh" /> {d.returns}
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {guide ? (
        <div className="fl-ld-guide-scrim" onClick={() => setGuide(false)}>
          <div className="fl-ld-guide" role="dialog" aria-modal="true" aria-labelledby="cloth-guide-title" onClick={(e) => e.stopPropagation()}>
            <div className="fl-ld-guide-head">
              <h2 id="cloth-guide-title" className="fl-title">
                Size guide
              </h2>
              <button type="button" className="fl-btn fl-btn--secondary" onClick={() => setGuide(false)}>
                Close
              </button>
            </div>
            <p className="fl-ld-fine">Measured flat, in inches. Chest is across the garment at the armhole and doubled.</p>
            <div className="fl-ld-guide-wrap">
              <table className="fl-ld-guide-table">
                <caption className="fl-sr">Measurements for each size</caption>
                <thead>
                  <tr>
                    <th scope="col">Size</th>
                    {d.guide.cols.map((c) => (
                      <th key={c} scope="col">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.guide.rows.map((r) => (
                    <tr key={r.size} className={r.size === size ? "is-on" : undefined}>
                      <th scope="row">{r.size}</th>
                      {r.v.map((n, i) => (
                        <td key={i}>{n}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="fl-ld-fine">{d.fit.model}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
