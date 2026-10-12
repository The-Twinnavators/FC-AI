/** @flowcode-library card-product-grid · Product card grid (Cards)
 * Catalog ID: p.product-grid (pattern)
 * Function: The product grid pattern (p.product-grid): shop cards with search, a working add-to-basket toggle and a basket count; the reference sheet shows four products including a sold-out one.
 * Use it as: import { ProductGrid } from "./card-product-grid"; <ProductGrid title eyebrow? searchLabel? searchHint? basketLabel? products={[{ id, name, price, rating, reviews, alt, image?, flag?, soldOut? }]} onToggle?={(id, added) => ...} />
 * Built from: c.card.surface, c.media-frame, c.badge.status, c.button.primary, c.button.secondary, c.text-field.outlined, c.empty-state.no-results
 * Look: A searchable grid of product cards, each with a square picture and tag, name, price, star rating and a full-width Add to basket button that turns green and reads Added; a basket pill with a count sits beside the search.
 * Tokens: --color-surface --color-border --color-accent --color-on-accent --color-success --color-text-muted --color-surface-sunken --space-3 --space-4 --radius-md --font-display --text-lg --hover-lift --duration-base
 * Use cases: product catalog; online shop; store front; product listing; category page; menu items; marketplace listings; merch store
 * Jobs to be done: browse products and prices; add items to my basket; compare products by rating; find something to buy
 * Keywords: shop, product, ecommerce, basket, cart, grid
 */
/**
 * Cards: product grid. Shop items with a picture, name, price, rating and an add-to-basket button that shows "Added"
 * and updates a small basket count. Use for a shop, a menu or a rental catalog. Make it the app's own: replace
 * SAMPLE with the real products (and real photos with alt text); wire the basket to the app's own cart state.
 */
import { useState } from "react";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Card } from "./cards-variants";
import { EmptyState } from "./empty-states";
import { Icon } from "./icons";
import { MediaFrame } from "./media-frames";
import { TextField } from "./text-fields-states";

// ── p.product-grid: shop items with picture, price, rating and an add-to-basket toggle, a search box and a basket count. ──

export type Product = {
  id: string;
  name: string;
  /** Formatted: "$24". */
  price: string;
  /** Out of 5, formatted: "4.8". */
  rating: string;
  reviews: number;
  /** Describes the picture (and names it when there is no image). */
  alt: string;
  /** Picture address; a gradient picture shows without one. */
  image?: string;
  /** A small tag on the picture: "New". Empty for none. */
  flag?: string;
  soldOut?: boolean;
};

export type ProductGridProps = {
  eyebrow?: string;
  title: string;
  products: Product[];
  searchLabel?: string;
  searchHint?: string;
  basketLabel?: string;
  /** Called when a product is added to or removed from the basket. */
  onToggle?: (id: string, added: boolean) => void;
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

export function ProductGrid({ eyebrow, title, products, searchLabel = "Search products", searchHint, basketLabel = "Basket", onToggle }: ProductGridProps) {
  const [added, setAdded] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");

  const q = query.trim().toLowerCase();
  const shown = q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;

  const toggle = (id: string, name: string) => {
    const isIn = added.includes(id);
    setAdded(isIn ? added.filter((a) => a !== id) : [...added, id]);
    setStatus(isIn ? `${name} removed from your basket.` : `${name} added to your basket.`);
    onToggle?.(id, !isIn);
  };

  return (
    <section className="fl-section" aria-labelledby="card-product-grid-title" data-fl="p.product-grid">
      <div className="fl-wrap">
        <div className="fl-head">
          {eyebrow ? <span className="fl-eyebrow">{eyebrow}</span> : null}
          <h2 id="card-product-grid-title" className="fl-title">
            {title}
          </h2>
        </div>

        <div className="fl-crd-bar">
          <div className="fl-field">
            <label htmlFor="card-product-search">{searchLabel}</label>
            <TextField
              id="card-product-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchHint}
              aria-controls="card-product-list"
            />
          </div>
          <span className="fl-crd-basket">
            <BagIcon />
            {basketLabel}
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
          <div role="status">
            <EmptyState
              variant="no-results"
              title={`No products match "${query.trim()}"`}
              action={
                <Button variant="secondary" onClick={() => setQuery("")}>
                  Clear search
                </Button>
              }
            >
              Check the spelling, or clear the search to see everything.
            </EmptyState>
          </div>
        ) : (
          <ul id="card-product-list" className="fl-grid fl-grid--4 fl-crd-list">
            {shown.map((p) => {
              const isIn = added.includes(p.id);
              const tag = p.soldOut ? "Sold out" : p.flag;
              return (
                <li key={p.id} style={{ display: "grid" }}>
                  <Card variant="surface" className="fl-crd-product">
                    <div style={{ position: "relative" }} {...(p.image ? {} : { role: "img", "aria-label": p.alt })}>
                      <MediaFrame ratio="1-1" src={p.image} alt={p.alt} />
                      {tag ? (
                        <Badge look="solid" tone={p.soldOut ? "neutral" : "info"} className="fl-crd-flag">
                          {tag}
                        </Badge>
                      ) : null}
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
                    <Button
                      variant="primary"
                      size={40}
                      className="fl-crd-added"
                      style={{ width: "100%" }}
                      aria-pressed={p.soldOut ? undefined : isIn}
                      disabled={p.soldOut}
                      onClick={() => toggle(p.id, p.name)}
                    >
                      {p.soldOut ? (
                        "Sold out"
                      ) : isIn ? (
                        <>
                          <Icon name="check" />
                          Added<span className="fl-sr">: {p.name}. Press to remove</span>
                        </>
                      ) : (
                        <>
                          <BagIcon />
                          Add to basket<span className="fl-sr">: {p.name}</span>
                        </>
                      )}
                    </Button>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

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

export default function CardProductGrid() {
  return <ProductGrid {...SAMPLE} />;
}
