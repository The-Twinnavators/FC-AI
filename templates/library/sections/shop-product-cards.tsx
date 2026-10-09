/** @flowcode-library shop-product-cards · Product cards (Shop)
 * Use cases: product grid; product listing; featured products; related products; wishlist; shop catalog; sale items
 * Jobs to be done: browse products; save items to my wishlist; add a product to my bag; pick the colour i want
 * Keywords: product card, wishlist, rating, swatches, add to bag, sale, shop
 */
/**
 * Product cards: three card styles side by side. A photo-first card with a wishlist heart, a horizontal card with a
 * star rating, and a minimal card with colour swatches (one colour is sold out). Each "Add to bag" button goes from
 * adding to added, and the bag count updates. Use them in shop grids, "you may also like" rows or a featured strip.
 * Make it the app's own: replace SAMPLE with real products, prices and colours; keep one card style per grid.
 */
import { useEffect, useRef, useState } from "react";
import { Tick } from "./icons";

// flowcode:sample
const SAMPLE = {
  eyebrow: "New this week",
  heading: "Fresh from the kiln",
  bagLabel: "In your bag",
  currency: "$",
  add: "Add to bag",
  adding: "Adding",
  added: "Added",
  soldOut: "Sold out",
  wishAdd: "Save to wishlist",
  wishRemove: "Remove from wishlist",
  saved: "saved to your wishlist.",
  unsaved: "removed from your wishlist.",
  addedTo: "added to your bag.",
  photo: {
    id: "carafe",
    name: "Ribbed water carafe",
    note: "Glazed stoneware · 1 litre",
    price: 4200,
    flag: "New",
    tone: "ink",
  },
  rated: {
    id: "plates",
    name: "Side plates, set of 4",
    note: "Matte white with a raw edge, dishwasher safe.",
    price: 3600,
    was: 4400,
    flag: "Sale",
    rating: 4.6,
    reviews: 128,
    tone: "oat",
  },
  swatch: {
    id: "throw",
    name: "Washed linen throw",
    price: 6800,
    colours: [
      { id: "oat", name: "Oat", inStock: true },
      { id: "sage", name: "Sage", inStock: true },
      { id: "clay", name: "Clay", inStock: true },
      { id: "charcoal", name: "Charcoal", inStock: false },
    ],
  },
};

type AddState = "idle" | "adding" | "added";

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </svg>
  );
}

function StarIcon({ on }: { on: boolean }) {
  return (
    <svg className={on ? "is-on" : undefined} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5z" />
    </svg>
  );
}

function Stars({ rating, reviews }: { rating: number; reviews: number }) {
  const full = Math.round(rating);
  return (
    <span className="fl-shop-stars">
      <span aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <StarIcon key={n} on={n <= full} />
        ))}
      </span>
      <span className="fl-sr">Rated {rating} out of 5,</span>
      <span>
        {rating} · {reviews} reviews
      </span>
    </span>
  );
}

/** Add-to-bag button with a short "adding" step, then "added" for a moment. */
function AddButton({ label, state, disabled, onAdd }: { label: string; state: AddState; disabled?: boolean; onAdd: () => void }) {
  const d = SAMPLE;
  return (
    <button
      type="button"
      className="fl-btn fl-btn--primary fl-shop-add fl-shop-btn--block"
      data-state={state}
      aria-busy={state === "adding" ? true : undefined}
      disabled={disabled}
      onClick={() => {
        if (state === "idle") onAdd();
      }}
    >
      {disabled ? (
        d.soldOut
      ) : state === "adding" ? (
        <>
          <span className="fl-shop-spin" aria-hidden="true" />
          {d.adding}
        </>
      ) : state === "added" ? (
        <>
          <Tick />
          {d.added}
        </>
      ) : (
        d.add
      )}
      <span className="fl-sr"> {label}</span>
    </button>
  );
}

export default function ShopProductCards() {
  const d = SAMPLE;
  const [bag, setBag] = useState(0);
  const [states, setStates] = useState<Record<string, AddState>>({});
  const [wished, setWished] = useState(false);
  const [colour, setColour] = useState(d.swatch.colours[0].id);
  const [status, setStatus] = useState("");
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const add = (id: string, label: string) => {
    setStates((s) => ({ ...s, [id]: "adding" }));
    timers.current.push(
      window.setTimeout(() => {
        setStates((s) => ({ ...s, [id]: "added" }));
        setBag((n) => n + 1);
        setStatus(`${label} ${d.addedTo}`);
        timers.current.push(window.setTimeout(() => setStates((s) => ({ ...s, [id]: "idle" })), 1800));
      }, 700),
    );
  };

  const chosen = d.swatch.colours.find((c) => c.id === colour) ?? d.swatch.colours[0];
  const state = (id: string): AddState => states[id] ?? "idle";
  const money = (cents: number) => `${d.currency}${(cents / 100).toFixed(2)}`;

  return (
    <section className="fl-section" aria-labelledby="shop-product-cards-title">
      <div className="fl-wrap fl-shop-stage">
        <div className="fl-shop-bar">
          <div className="fl-shop-bar__title">
            <span className="fl-eyebrow">{d.eyebrow}</span>
            <h2 id="shop-product-cards-title" className="fl-title fl-title--md">
              {d.heading}
            </h2>
          </div>
          <span className="fl-badge" aria-live="polite">
            {d.bagLabel}: {bag}
          </span>
        </div>

        <ul className="fl-grid fl-grid--3" style={{ margin: 0, padding: 0, listStyle: "none", alignItems: "start" }}>
          <li className="fl-shop-card">
            <div className="fl-shop-card__media">
              <span className="fl-shop-flag">{d.photo.flag}</span>
              <span className={`fl-shop-img fl-shop-img--tall fl-shop-tone--${d.photo.tone}`} aria-hidden="true" />
              <button
                type="button"
                className="fl-shop-icon-btn fl-shop-heart"
                aria-pressed={wished}
                aria-label={`${wished ? d.wishRemove : d.wishAdd}: ${d.photo.name}`}
                onClick={() => {
                  setWished((w) => !w);
                  setStatus(`${d.photo.name} ${wished ? d.unsaved : d.saved}`);
                }}
              >
                <HeartIcon />
              </button>
            </div>
            <div className="fl-shop-card__row">
              <h3>{d.photo.name}</h3>
              <span className="fl-shop-price">{money(d.photo.price)}</span>
            </div>
            <span className="fl-meta" style={{ marginTop: "calc(-1 * var(--space-2))" }}>
              {d.photo.note}
            </span>
            <AddButton label={d.photo.name} state={state(d.photo.id)} onAdd={() => add(d.photo.id, d.photo.name)} />
          </li>

          <li className="fl-shop-card fl-shop-card--row">
            <div className="fl-shop-card__media">
              <span className={`fl-shop-img fl-shop-tone--${d.rated.tone}`} aria-hidden="true" />
            </div>
            <div className="fl-shop-card__body">
              <span className="fl-shop-flag fl-shop-flag--sale" style={{ position: "static", justifySelf: "start" }}>
                {d.rated.flag}
              </span>
              <h3>{d.rated.name}</h3>
              <Stars rating={d.rated.rating} reviews={d.rated.reviews} />
              <p className="fl-meta" style={{ margin: 0 }}>
                {d.rated.note}
              </p>
              <span className="fl-shop-price">
                {money(d.rated.price)}
                <s>
                  <span className="fl-sr">was </span>
                  {money(d.rated.was)}
                </s>
              </span>
              <AddButton label={d.rated.name} state={state(d.rated.id)} onAdd={() => add(d.rated.id, d.rated.name)} />
            </div>
          </li>

          <li className="fl-shop-card fl-shop-card--minimal">
            <span className={`fl-shop-img fl-shop-tone--${chosen.id}`} aria-hidden="true" />
            <div className="fl-shop-card__row">
              <h3>{d.swatch.name}</h3>
              <span className="fl-shop-price">{money(d.swatch.price)}</span>
            </div>
            <fieldset className="fl-shop-swatches">
              <legend>
                Colour: <span style={{ fontWeight: "var(--weight-regular)" }}>{chosen.name}{!chosen.inStock && ` (${d.soldOut.toLowerCase()})`}</span>
              </legend>
              {d.swatch.colours.map((c) => (
                <label key={c.id} className={`fl-shop-swatch fl-shop-tone--${c.id}${c.inStock ? "" : " fl-shop-swatch--out"}`} title={c.inStock ? c.name : `${c.name}, ${d.soldOut.toLowerCase()}`}>
                  <input
                    type="radio"
                    name="shop-product-cards-colour"
                    value={c.id}
                    checked={colour === c.id}
                    onChange={() => setColour(c.id)}
                    aria-label={c.inStock ? c.name : `${c.name}, ${d.soldOut.toLowerCase()}`}
                  />
                  <span />
                </label>
              ))}
            </fieldset>
            <AddButton
              label={`${d.swatch.name}, ${chosen.name}`}
              state={state(`${d.swatch.id}-${chosen.id}`)}
              disabled={!chosen.inStock}
              onAdd={() => add(`${d.swatch.id}-${chosen.id}`, `${d.swatch.name} (${chosen.name})`)}
            />
          </li>
        </ul>

        <p className="fl-shop-status fl-shop-status--ok" role="status" aria-live="polite">
          {status}
        </p>
      </div>
    </section>
  );
}
