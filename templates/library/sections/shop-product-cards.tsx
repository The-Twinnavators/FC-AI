/** @flowcode-library shop-product-cards · Product cards (Shop)
 * Catalog ID: b.shop-product-cards (block)
 * Function: A strip of shop product cards (b.shop-product-cards) in three card styles with add to bag, wishlist and color choice.
 * Use it as: import { ShopProductCards } from "./shop-product-cards"; <ShopProductCards eyebrow? heading bagLabel? currency? products={[{id,name,price(cents),kind:"photo"|"row"|"minimal",tone?,note?,flag?,was?,rating?,reviews?,colours?:[{id,name,inStock}]}]}/>
 * Built from: c.button.primary, c.badge.status
 * Look: A section title with a bag-count pill over a row of product cards: tall photo with flag and heart, a side-by-side card with stars and a struck-through price, and a plain card with round color swatches; Add to bag goes from adding to added.
 * Tokens: --space-2 --space-3 --space-5 --color-accent --color-surface --color-border --color-text-muted --color-success --radius-md
 * Use cases: product grid; product listing; featured products; related products; wishlist; shop catalog; sale items
 * Jobs to be done: browse products; save items to my wishlist; add a product to my bag; pick the color i want
 * Keywords: product card, wishlist, rating, swatches, add to bag, sale, shop
 */
/**
 * Product cards: three card styles side by side. A photo-first card with a wishlist heart, a horizontal card with a
 * star rating, and a minimal card with color swatches (one color is sold out). Each "Add to bag" button goes from
 * adding to added, and the bag count updates. Use them in shop grids, "you may also like" rows or a featured strip.
 * Make it the app's own: replace SAMPLE with real products, prices and colors; keep one card style per grid.
 */
import { useEffect, useRef, useState } from "react";
import { Tick } from "./icons";
import { Button } from "./buttons-variants";
import { Badge } from "./badges-status";

const LABELS = {
  add: "Add to bag",
  adding: "Adding",
  added: "Added",
  soldOut: "Sold out",
  wishAdd: "Save to wishlist",
  wishRemove: "Remove from wishlist",
  saved: "saved to your wishlist.",
  unsaved: "removed from your wishlist.",
  addedTo: "added to your bag.",
};

export type ProductCard = {
  id: string;
  name: string;
  /** In cents. */
  price: number;
  /** photo: tall picture with a heart. row: picture beside the words, with stars. minimal: plain, with color swatches. */
  kind: "photo" | "row" | "minimal";
  /** The picture's color tone (a swatch name such as "oat", "ink", "sage"). */
  tone?: string;
  note?: string;
  /** A corner flag: "New", "Sale". */
  flag?: string;
  /** The old price in cents, struck through. */
  was?: number;
  rating?: number;
  reviews?: number;
  /** minimal: the color choices; an out-of-stock color cannot be added. */
  colours?: { id: string; name: string; inStock: boolean }[];
};

export type ShopProductCardsProps = {
  eyebrow?: string;
  heading: string;
  /** The count pill's label, e.g. "In your bag". */
  bagLabel?: string;
  /** Currency symbol before prices; "$" when left out. */
  currency?: string;
  products: ProductCard[];
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
  const d = LABELS;
  return (
    <Button
      variant="primary"
      className="fl-shop-add fl-shop-btn--block"
      data-state={state}
      busy={state === "adding"}
      disabled={disabled}
      onClick={() => {
        if (state === "idle") onAdd();
      }}
    >
      {disabled ? (
        d.soldOut
      ) : state === "adding" ? (
        d.adding
      ) : state === "added" ? (
        <>
          <Tick />
          {d.added}
        </>
      ) : (
        d.add
      )}
      <span className="fl-sr"> {label}</span>
    </Button>
  );
}

export function ShopProductCards({ eyebrow, heading, bagLabel = "In your bag", currency = "$", products }: ShopProductCardsProps) {
  const d = LABELS;
  const [bag, setBag] = useState(0);
  const [states, setStates] = useState<Record<string, AddState>>({});
  const [wished, setWished] = useState<Record<string, boolean>>({});
  const [colour, setColour] = useState<Record<string, string>>({});
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

  const state = (id: string): AddState => states[id] ?? "idle";
  const money = (cents: number) => `${currency}${(cents / 100).toFixed(2)}`;

  return (
    <section className="fl-section" aria-labelledby="shop-product-cards-title" data-fl="b.shop-product-cards">
      <div className="fl-wrap fl-shop-stage">
        <div className="fl-shop-bar">
          <div className="fl-shop-bar__title">
            {eyebrow ? <span className="fl-eyebrow">{eyebrow}</span> : null}
            <h2 id="shop-product-cards-title" className="fl-title fl-title--md">
              {heading}
            </h2>
          </div>
          <Badge aria-live="polite">
            {bagLabel}: {bag}
          </Badge>
        </div>

        <ul className="fl-grid fl-grid--3" style={{ margin: 0, padding: 0, listStyle: "none", alignItems: "start" }}>
          {products.map((p) => {
            if (p.kind === "photo") {
              const isWished = !!wished[p.id];
              return (
                <li key={p.id} className="fl-shop-card">
                  <div className="fl-shop-card__media">
                    {p.flag ? <span className="fl-shop-flag">{p.flag}</span> : null}
                    <span className={`fl-shop-img fl-shop-img--tall fl-shop-tone--${p.tone ?? "oat"}`} aria-hidden="true" />
                    <button
                      type="button"
                      className="fl-shop-icon-btn fl-shop-heart"
                      aria-pressed={isWished}
                      aria-label={`${isWished ? d.wishRemove : d.wishAdd}: ${p.name}`}
                      onClick={() => {
                        setWished((w) => ({ ...w, [p.id]: !isWished }));
                        setStatus(`${p.name} ${isWished ? d.unsaved : d.saved}`);
                      }}
                    >
                      <HeartIcon />
                    </button>
                  </div>
                  <div className="fl-shop-card__row">
                    <h3>{p.name}</h3>
                    <span className="fl-shop-price">{money(p.price)}</span>
                  </div>
                  {p.note ? (
                    <span className="fl-meta" style={{ marginTop: "calc(-1 * var(--space-2))" }}>
                      {p.note}
                    </span>
                  ) : null}
                  <AddButton label={p.name} state={state(p.id)} onAdd={() => add(p.id, p.name)} />
                </li>
              );
            }
            if (p.kind === "row") {
              return (
                <li key={p.id} className="fl-shop-card fl-shop-card--row">
                  <div className="fl-shop-card__media">
                    <span className={`fl-shop-img fl-shop-tone--${p.tone ?? "oat"}`} aria-hidden="true" />
                  </div>
                  <div className="fl-shop-card__body">
                    {p.flag ? (
                      <span className="fl-shop-flag fl-shop-flag--sale" style={{ position: "static", justifySelf: "start" }}>
                        {p.flag}
                      </span>
                    ) : null}
                    <h3>{p.name}</h3>
                    {p.rating !== undefined ? <Stars rating={p.rating} reviews={p.reviews ?? 0} /> : null}
                    {p.note ? (
                      <p className="fl-meta" style={{ margin: 0 }}>
                        {p.note}
                      </p>
                    ) : null}
                    <span className="fl-shop-price">
                      {money(p.price)}
                      {p.was !== undefined ? (
                        <s>
                          <span className="fl-sr">was </span>
                          {money(p.was)}
                        </s>
                      ) : null}
                    </span>
                    <AddButton label={p.name} state={state(p.id)} onAdd={() => add(p.id, p.name)} />
                  </div>
                </li>
              );
            }
            const colours = p.colours ?? [];
            const chosen = colours.find((c) => c.id === colour[p.id]) ?? colours[0];
            const key = chosen ? `${p.id}-${chosen.id}` : p.id;
            return (
              <li key={p.id} className="fl-shop-card fl-shop-card--minimal">
                <span className={`fl-shop-img fl-shop-tone--${chosen?.id ?? p.tone ?? "oat"}`} aria-hidden="true" />
                <div className="fl-shop-card__row">
                  <h3>{p.name}</h3>
                  <span className="fl-shop-price">{money(p.price)}</span>
                </div>
                {chosen ? (
                  <fieldset className="fl-shop-swatches">
                    <legend>
                      Colour: <span style={{ fontWeight: "var(--weight-regular)" }}>{chosen.name}{!chosen.inStock && ` (${d.soldOut.toLowerCase()})`}</span>
                    </legend>
                    {colours.map((c) => (
                      <label key={c.id} className={`fl-shop-swatch fl-shop-tone--${c.id}${c.inStock ? "" : " fl-shop-swatch--out"}`} title={c.inStock ? c.name : `${c.name}, ${d.soldOut.toLowerCase()}`}>
                        <input
                          type="radio"
                          name={`shop-product-cards-colour-${p.id}`}
                          value={c.id}
                          checked={chosen.id === c.id}
                          onChange={() => setColour((m) => ({ ...m, [p.id]: c.id }))}
                          aria-label={c.inStock ? c.name : `${c.name}, ${d.soldOut.toLowerCase()}`}
                        />
                        <span />
                      </label>
                    ))}
                  </fieldset>
                ) : null}
                <AddButton
                  label={chosen ? `${p.name}, ${chosen.name}` : p.name}
                  state={state(key)}
                  disabled={chosen ? !chosen.inStock : false}
                  onAdd={() => add(key, chosen ? `${p.name} (${chosen.name})` : p.name)}
                />
              </li>
            );
          })}
        </ul>

        <p className="fl-shop-status fl-shop-status--ok" role="status" aria-live="polite">
          {status}
        </p>
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE: ShopProductCardsProps = {
  eyebrow: "New this week",
  heading: "Fresh from the kiln",
  bagLabel: "In your bag",
  currency: "$",
  products: [
    { id: "carafe", kind: "photo", name: "Ribbed water carafe", note: "Glazed stoneware · 1 liter", price: 4200, flag: "New", tone: "ink" },
    {
      id: "plates",
      kind: "row",
      name: "Side plates, set of 4",
      note: "Matte white with a raw edge, dishwasher safe.",
      price: 3600,
      was: 4400,
      flag: "Sale",
      rating: 4.6,
      reviews: 128,
      tone: "oat",
    },
    {
      id: "throw",
      kind: "minimal",
      name: "Washed linen throw",
      price: 6800,
      colours: [
        { id: "oat", name: "Oat", inStock: true },
        { id: "sage", name: "Sage", inStock: true },
        { id: "clay", name: "Clay", inStock: true },
        { id: "charcoal", name: "Charcoal", inStock: false },
      ],
    },
  ],
};

export default function ShopProductCardsPreview() {
  return <ShopProductCards {...SAMPLE} />;
}
