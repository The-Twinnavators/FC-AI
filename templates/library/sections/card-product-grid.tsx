/** @flowcode-library card-product-grid · Product card grid (Cards)
 * Use cases: product catalog; online shop; store front; product listing; category page; menu items; marketplace listings; merch store
 * Jobs to be done: browse products and prices; add items to my basket; compare products by rating; find something to buy
 * Keywords: shop, product, ecommerce, basket, cart, grid
 */
/**
 * Cards: product grid. Shop items with a picture, name, price, rating and an add-to-basket button that shows "Added"
 * and updates a small basket count. Use for a shop, a menu or a rental catalogue. Make it the app's own: replace
 * SAMPLE with the real products (and real photos with alt text); wire the basket to the app's own cart state.
 */
import { useState } from "react";

// flowcode:sample
const SAMPLE = {
  eyebrow: "The shop",
  title: "Made in the studio this month",
  searchLabel: "Search products",
  searchHint: "Try a name, like mug or apron",
  basketLabel: "Basket",
  products: [
    { id: "mug", name: "Speckled stoneware mug", price: "$24", rating: "4.8", reviews: 126, alt: "A cream mug with brown speckles on a wooden shelf", flag: "New", soldOut: false },
    { id: "apron", name: "Linen studio apron", price: "$48", rating: "4.6", reviews: 58, alt: "A sage green linen apron hanging on a hook", flag: "", soldOut: false },
    { id: "bowl", name: "Wide serving bowl", price: "$62", rating: "4.9", reviews: 34, alt: "A shallow white bowl filled with lemons", flag: "Last few", soldOut: false },
    { id: "vase", name: "Ribbed bud vase", price: "$30", rating: "4.7", reviews: 41, alt: "A small ribbed vase holding one dried stem", flag: "", soldOut: true },
  ],
};

function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5 10 17l9-10" />
    </svg>
  );
}

export default function CardProductGrid() {
  const d = SAMPLE;
  const [added, setAdded] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");

  const q = query.trim().toLowerCase();
  const shown = q ? d.products.filter((p) => p.name.toLowerCase().includes(q)) : d.products;

  const toggle = (id: string, name: string) => {
    const isIn = added.includes(id);
    setAdded(isIn ? added.filter((a) => a !== id) : [...added, id]);
    setStatus(isIn ? `${name} removed from your basket.` : `${name} added to your basket.`);
  };

  return (
    <section className="fl-section" aria-labelledby="card-product-grid-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <span className="fl-eyebrow">{d.eyebrow}</span>
          <h2 id="card-product-grid-title" className="fl-title">
            {d.title}
          </h2>
        </div>

        <div className="fl-crd-bar">
          <div className="fl-field">
            <label htmlFor="card-product-search">{d.searchLabel}</label>
            <input
              id="card-product-search"
              className="fl-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={d.searchHint}
              aria-controls="card-product-list"
            />
          </div>
          <span className="fl-crd-basket">
            <BagIcon />
            {d.basketLabel}
            <span className="fl-crd-count" data-zero={added.length === 0}>
              {added.length}
            </span>
            <span className="fl-sr">{added.length === 1 ? "item" : "items"}</span>
          </span>
        </div>

        <p className="fl-sr" aria-live="polite">
          {status}
        </p>

        {shown.length === 0 ? (
          <div className="fl-crd-empty" role="status">
            <strong>No products match "{query.trim()}"</strong>
            <p>Check the spelling, or clear the search to see everything.</p>
            <button type="button" className="fl-btn fl-btn--secondary" onClick={() => setQuery("")}>
              Clear search
            </button>
          </div>
        ) : (
          <ul id="card-product-list" className="fl-grid fl-grid--4 fl-crd-list">
            {shown.map((p) => {
              const isIn = added.includes(p.id);
              return (
                <li key={p.id} className="fl-card fl-crd-product">
                  <div className="fl-media fl-media--square" role="img" aria-label={p.alt}>
                    {(p.flag || p.soldOut) && <span className="fl-badge fl-crd-flag">{p.soldOut ? "Sold out" : p.flag}</span>}
                    <span aria-hidden="true">{p.alt}</span>
                  </div>
                  <h3>{p.name}</h3>
                  <div className="fl-crd-row">
                    <span className="fl-crd-price">{p.price}</span>
                    <span className="fl-crd-rating">
                      <StarIcon />
                      <span>
                        {p.rating} <span className="fl-sr">out of 5,</span> ({p.reviews}
                        <span className="fl-sr"> reviews</span>)
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="fl-crd-btn"
                    aria-pressed={p.soldOut ? undefined : isIn}
                    disabled={p.soldOut}
                    onClick={() => toggle(p.id, p.name)}
                  >
                    {p.soldOut ? (
                      "Sold out"
                    ) : isIn ? (
                      <>
                        <CheckIcon />
                        Added<span className="fl-sr">: {p.name}. Press to remove</span>
                      </>
                    ) : (
                      <>
                        <BagIcon />
                        Add to basket<span className="fl-sr">: {p.name}</span>
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
