/** @flowcode-library shop-collection · Collection with filters (Shop)
 * Catalog ID: b.shop-collection (block)
 * Function: A filterable, sortable shop category page (b.shop-collection) with live result count and filter chips.
 * Use it as: import { ShopCollection } from "./shop-collection"; <ShopCollection eyebrow? heading lede? currency? sizes={["S","M"]} colors={[{id,name}]} products={[{id,name,price(cents),colour(a colors id),sizes,inStock,added}]}/>
 * Built from: c.button.primary, c.button.secondary, c.badge.status, c.chip.input, c.text-field.outlined, c.select.outlined, c.checkbox
 * Look: A title, then a filter sidebar (price, size, color, in stock) beside a toolbar with count and sort, removable filter chips and a grid of product tiles; filters fold into a drawer on phones and an empty state appears when nothing matches.
 * Tokens: --space-4 --space-5 --color-accent --color-surface --color-border --color-text-muted --radius-md --control-md
 * Use cases: product catalog; category page; search results; filtered listing; shop by category; online store; product browsing
 * Jobs to be done: find products that fit my size; filter products by price; sort products by what matters to me; narrow down a big range
 * Keywords: collection, category page, filters, sort, chips, product grid, drawer, shop
 */
/**
 * Collection page: a shop category with filters down the side (price range, size, color, in stock only), a sort
 * menu, a live result count, removable filter chips with "Clear all", and a product grid. On phones the filters fold
 * into a drawer behind a "Filters" button. When nothing matches, it says so and offers to clear the filters. Make it
 * the app's own: replace SAMPLE with the real products and the filters that matter for them; keep filters to a handful.
 */
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Button } from "./buttons-variants";
import { Badge } from "./badges-status";
import { Chip } from "./chips-tags";
import { TextField } from "./text-fields-states";
import { Select } from "./dropdowns-states";
import { Checkbox } from "./checkboxes-radios";

const LABELS = {
  filtersTitle: "Filters",
  price: { legend: "Price", min: "Min", max: "Max", error: "Min price must be lower than max price." },
  sizesLegend: "Size",
  coloursLegend: "Colour",
  stockLabel: "In stock only",
  sortLabel: "Sort by",
  sorts: [
    { id: "featured", name: "Featured" },
    { id: "new", name: "Newest" },
    { id: "low", name: "Price: low to high" },
    { id: "high", name: "Price: high to low" },
  ],
  clearAll: "Clear all",
  showResults: "Show",
  results: "products",
  result: "product",
  outOfStock: "Out of stock",
  emptyTitle: "No products match",
  emptyText: "Try a wider price range or fewer sizes and colors.",
  emptyAction: "Clear filters",
};

export type CollectionProduct = {
  id: string;
  name: string;
  /** In cents. */
  price: number;
  /** The id of one of the colors. */
  colour: string;
  sizes: string[];
  inStock: boolean;
  /** How recently it arrived; a bigger number sorts first under Newest. */
  added: number;
};

export type ShopCollectionProps = {
  eyebrow?: string;
  heading: string;
  lede?: string;
  /** Currency symbol before prices; "$" when left out. */
  currency?: string;
  /** The size filter's choices, e.g. ["S", "M", "L"]. */
  sizes: string[];
  /** The color filter's choices; each id also picks the picture tone. */
  colors: { id: string; name: string }[];
  products: CollectionProduct[];
};

type Filters = { min: string; max: string; sizes: string[]; colors: string[]; inStock: boolean };
const NO_FILTERS: Filters = { min: "", max: "", sizes: [], colors: [], inStock: false };

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Traps Tab inside the panel, closes on Escape, locks page scroll and puts focus back on the trigger. */
function useModal(open: boolean, onClose: () => void, returnTo: RefObject<HTMLElement | null>) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const items = () => Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
    (items()[0] ?? panel).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const list = items();
      if (list.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      returnTo.current?.focus();
    };
  }, [open, returnTo]);
  return panelRef;
}

const money = (cents: number, currency: string) => `${currency}${(cents / 100).toFixed(0)}`;

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  );
}

function SearchOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5M8.5 11h5" />
    </svg>
  );
}

function FilterFields({ prefix, f, set, priceError, counts, currency, sizes, colors }: { prefix: string; f: Filters; set: (next: Filters) => void; priceError: boolean; counts: Record<string, number> } & Pick<ShopCollectionProps, "sizes" | "colors"> & { currency: string }) {
  const d = LABELS;
  return (
    <div className="fl-shop-filters">
      <fieldset className="fl-shop-fieldset">
        <legend>{d.price.legend}</legend>
        <div className="fl-shop-range">
          <div className="fl-field">
            <label htmlFor={`${prefix}-min`}>
              {d.price.min} ({currency})
            </label>
            <TextField
              id={`${prefix}-min`}
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="0"
              value={f.min}
              onChange={(e) => set({ ...f, min: e.target.value })}
              invalid={priceError}
              aria-describedby={priceError ? `${prefix}-price-error` : undefined}
            />
          </div>
          <span aria-hidden="true">–</span>
          <div className="fl-field">
            <label htmlFor={`${prefix}-max`}>
              {d.price.max} ({currency})
            </label>
            <TextField
              id={`${prefix}-max`}
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="100"
              value={f.max}
              onChange={(e) => set({ ...f, max: e.target.value })}
              invalid={priceError}
              aria-describedby={priceError ? `${prefix}-price-error` : undefined}
            />
          </div>
        </div>
        {priceError && (
          <p id={`${prefix}-price-error`} className="fl-shop-error">
            {d.price.error}
          </p>
        )}
      </fieldset>

      <fieldset className="fl-shop-fieldset">
        <legend>{d.sizesLegend}</legend>
        <div className="fl-shop-pills">
          {sizes.map((s) => (
            <label key={s} className="fl-shop-pill">
              <input type="checkbox" checked={f.sizes.includes(s)} onChange={() => set({ ...f, sizes: toggle(f.sizes, s) })} />
              <span>{s}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="fl-shop-fieldset">
        <legend>{d.coloursLegend}</legend>
        <ul className="fl-shop-list">
          {colors.map((c) => (
            <li key={c.id}>
              <label className="fl-shop-check">
                <input type="checkbox" checked={f.colors.includes(c.id)} onChange={() => set({ ...f, colors: toggle(f.colors, c.id) })} />
                <span className={`fl-shop-swatch-dot fl-shop-tone--${c.id}`} aria-hidden="true" />
                {c.name}
                <small>
                  {counts[c.id] ?? 0}
                  <span className="fl-sr"> products</span>
                </small>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div>
        <Checkbox label={d.stockLabel} checked={f.inStock} onChange={() => set({ ...f, inStock: !f.inStock })} />
      </div>
    </div>
  );
}

export function ShopCollection({ eyebrow, heading, lede, currency = "$", sizes, colors, products }: ShopCollectionProps) {
  const d = LABELS;
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState(d.sorts[0].id);
  const [drawer, setDrawer] = useState(false);
  const filterBtnRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const panelRef = useModal(drawer, () => setDrawer(false), filterBtnRef);

  // The drawer only exists on phones: close it if the screen grows past the sidebar breakpoint.
  useEffect(() => {
    if (!drawer || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 861px)");
    const onChange = () => mq.matches && setDrawer(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [drawer]);

  const min = f.min === "" ? null : Number(f.min) * 100;
  const max = f.max === "" ? null : Number(f.max) * 100;
  const priceError = min !== null && max !== null && min > max;

  const results = useMemo(() => {
    const list = products.filter((p) => {
      if (!priceError && min !== null && p.price < min) return false;
      if (!priceError && max !== null && p.price > max) return false;
      if (f.sizes.length && !p.sizes.some((s) => f.sizes.includes(s))) return false;
      if (f.colors.length && !f.colors.includes(p.colour)) return false;
      if (f.inStock && !p.inStock) return false;
      return true;
    });
    if (sort === "low") return [...list].sort((a, b) => a.price - b.price);
    if (sort === "high") return [...list].sort((a, b) => b.price - a.price);
    if (sort === "new") return [...list].sort((a, b) => b.added - a.added);
    return list;
  }, [products, f, sort, min, max, priceError]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    products.forEach((p) => (c[p.colour] = (c[p.colour] ?? 0) + 1));
    return c;
  }, [products]);

  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (!priceError && (min !== null || max !== null)) {
    const label = min !== null && max !== null ? `${money(min, currency)}–${money(max, currency)}` : min !== null ? `From ${money(min, currency)}` : `Up to ${money(max ?? 0, currency)}`;
    chips.push({ key: "price", label, clear: () => setF((x) => ({ ...x, min: "", max: "" })) });
  }
  f.sizes.forEach((s) => chips.push({ key: `size-${s}`, label: `Size ${s}`, clear: () => setF((x) => ({ ...x, sizes: x.sizes.filter((v) => v !== s) })) }));
  f.colors.forEach((c) =>
    chips.push({ key: `colour-${c}`, label: colors.find((x) => x.id === c)?.name ?? c, clear: () => setF((x) => ({ ...x, colors: x.colors.filter((v) => v !== c) })) }),
  );
  if (f.inStock) chips.push({ key: "stock", label: d.stockLabel, clear: () => setF((x) => ({ ...x, inStock: false })) });

  const clearAll = () => {
    setF(NO_FILTERS);
    headingRef.current?.focus();
  };
  const countText = `${results.length} ${results.length === 1 ? d.result : d.results}`;

  return (
    <section className="fl-section" aria-labelledby="shop-collection-title" data-fl="b.shop-collection">
      <div className="fl-wrap fl-shop-stage">
        <div className="fl-shop-bar__title">
          {eyebrow ? <span className="fl-eyebrow">{eyebrow}</span> : null}
          <h2 id="shop-collection-title" className="fl-title fl-title--md" ref={headingRef} tabIndex={-1} style={{ outline: "none" }}>
            {heading}
          </h2>
          {lede ? <p className="fl-text">{lede}</p> : null}
        </div>

        <div className="fl-shop-collection">
          <aside className="fl-shop-aside" aria-labelledby="shop-collection-filters">
            <h3 id="shop-collection-filters" className="fl-sr">
              {d.filtersTitle}
            </h3>
            <FilterFields prefix="shop-collection-side" f={f} set={setF} priceError={priceError} counts={counts} currency={currency} sizes={sizes} colors={colors} />
          </aside>

          <div style={{ display: "grid", gap: "var(--space-5)", minWidth: 0 }}>
            <div className="fl-shop-toolbar">
              <p className="fl-meta" role="status" aria-live="polite" style={{ margin: 0 }}>
                <strong style={{ color: "var(--color-text)" }}>{results.length}</strong> {results.length === 1 ? d.result : d.results}
              </p>
              <div className="fl-shop-toolbar__end">
                <Button
                  variant="secondary"
                  size={40}
                  className="fl-shop-btn--sm fl-shop-filter-btn"
                  aria-haspopup="dialog"
                  aria-expanded={drawer}
                  onClick={(e) => {
                    filterBtnRef.current = e.currentTarget;
                    setDrawer(true);
                  }}
                >
                  <SlidersIcon />
                  {d.filtersTitle}
                  {chips.length > 0 && <Badge>{chips.length}</Badge>}
                </Button>
                <div className="fl-shop-sort">
                  <label htmlFor="shop-collection-sort">{d.sortLabel}</label>
                  <Select
                    id="shop-collection-sort"
                    options={d.sorts.map((s) => s.name)}
                    value={d.sorts.find((s) => s.id === sort)?.name}
                    onChange={(e) => setSort(d.sorts.find((s) => s.name === e.target.value)?.id ?? d.sorts[0].id)}
                  />
                </div>
              </div>
            </div>

            {chips.length > 0 && (
              <ul id="shop-collection-chips" className="fl-shop-chips" aria-label="Active filters">
                {chips.map((c) => (
                  <li key={c.key}>
                    <Chip
                      variant="input"
                      removeLabel={`Remove filter: ${c.label}`}
                      onRemove={() => {
                        c.clear();
                        // Keep focus in the chip row (or on the heading once the last chip goes).
                        window.setTimeout(() => (document.querySelector<HTMLElement>("#shop-collection-chips .fl-ctl-chip-x") ?? headingRef.current)?.focus(), 0);
                      }}
                    >
                      {c.label}
                    </Chip>
                  </li>
                ))}
                <li>
                  <button type="button" className="fl-shop-link" onClick={clearAll}>
                    {d.clearAll}
                  </button>
                </li>
              </ul>
            )}

            {results.length === 0 ? (
              <div className="fl-shop-empty">
                <span className="fl-icon">
                  <SearchOffIcon />
                </span>
                <strong>{d.emptyTitle}</strong>
                <span>{d.emptyText}</span>
                <Button variant="primary" onClick={clearAll}>
                  {d.emptyAction}
                </Button>
              </div>
            ) : (
              <ul className="fl-shop-grid">
                {results.map((p) => (
                  <li key={p.id} className="fl-shop-tile">
                    <div className="fl-shop-tile__media">
                      {!p.inStock && <span className="fl-shop-flag">{d.outOfStock}</span>}
                      <span className={`fl-shop-img fl-shop-img--tall fl-shop-tone--${p.colour}`} aria-hidden="true" />
                    </div>
                    <h3>
                      <a className="fl-link" href={`#${p.id}`} style={{ color: "var(--color-text)" }}>
                        {p.name}
                      </a>
                    </h3>
                    <span className="fl-meta">
                      {colors.find((c) => c.id === p.colour)?.name} · {p.sizes.join(", ")}
                    </span>
                    <span className="fl-shop-price">{money(p.price, currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {drawer && (
        <div
          className="fl-shop-backdrop fl-shop-backdrop--drawer fl-shop-backdrop--left"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDrawer(false);
          }}
        >
          <div ref={panelRef} className="fl-shop-drawer" role="dialog" aria-modal="true" aria-labelledby="shop-collection-drawer-title" tabIndex={-1}>
            <div className="fl-shop-drawer__head">
              <h2 id="shop-collection-drawer-title" className="fl-shop-dialog-title">
                {d.filtersTitle}
              </h2>
              <button type="button" className="fl-shop-icon-btn" aria-label="Close filters" onClick={() => setDrawer(false)}>
                <CloseIcon />
              </button>
            </div>
            <div className="fl-shop-drawer__body">
              <FilterFields prefix="shop-collection-drawer" f={f} set={setF} priceError={priceError} counts={counts} currency={currency} sizes={sizes} colors={colors} />
            </div>
            <div className="fl-shop-drawer__foot" style={{ gridTemplateColumns: "auto 1fr" }}>
              <Button variant="secondary" onClick={() => setF(NO_FILTERS)} disabled={chips.length === 0 && !priceError}>
                {d.clearAll}
              </Button>
              <Button variant="primary" onClick={() => setDrawer(false)}>
                {d.showResults} {countText}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// flowcode:sample
const SAMPLE: ShopCollectionProps = {
  eyebrow: "Shop",
  heading: "Studio wear",
  lede: "Aprons, overshirts and tees made for clay, paint and long afternoons at the bench.",
  currency: "$",
  sizes: ["XS", "S", "M", "L", "XL"],
  colors: [
    { id: "oat", name: "Oat" },
    { id: "clay", name: "Clay" },
    { id: "sage", name: "Sage" },
    { id: "charcoal", name: "Charcoal" },
    { id: "ink", name: "Ink" },
  ],
  products: [
    { id: "p1", name: "Canvas cross-back apron", price: 5200, colour: "clay", sizes: ["S", "M", "L"], inStock: true, added: 3 },
    { id: "p2", name: "Linen work overshirt", price: 8900, colour: "oat", sizes: ["S", "M", "L", "XL"], inStock: true, added: 8 },
    { id: "p3", name: "Heavy cotton studio tee", price: 3200, colour: "charcoal", sizes: ["XS", "S", "M", "L", "XL"], inStock: true, added: 5 },
    { id: "p4", name: "Waxed half apron", price: 4400, colour: "ink", sizes: ["M", "L"], inStock: false, added: 1 },
    { id: "p5", name: "Garment-dyed tee", price: 3400, colour: "sage", sizes: ["S", "M", "L"], inStock: true, added: 9 },
    { id: "p6", name: "Quilted bench vest", price: 9800, colour: "charcoal", sizes: ["M", "L", "XL"], inStock: true, added: 7 },
    { id: "p7", name: "Cotton bucket hat", price: 2600, colour: "oat", sizes: ["S", "M"], inStock: false, added: 4 },
    { id: "p8", name: "Ripstop painter trousers", price: 7600, colour: "sage", sizes: ["XS", "S", "M", "L"], inStock: true, added: 6 },
    { id: "p9", name: "Bib apron with pockets", price: 5800, colour: "ink", sizes: ["S", "M", "L", "XL"], inStock: true, added: 2 },
  ],
};

export default function ShopCollectionPreview() {
  return <ShopCollection {...SAMPLE} />;
}
