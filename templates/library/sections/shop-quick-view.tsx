/** @flowcode-library shop-quick-view · Quick view (Shop)
 * Use cases: quick view; product grid; product preview; shop catalog; fast add to cart; category browsing
 * Jobs to be done: check a product without leaving the page; pick a size and colour; add a product to my bag quickly
 * Keywords: quick view, product dialog, modal, gallery, size, colour, add to bag, shop
 */
/**
 * Quick view: a product grid where "Quick view" opens the product in a dialog without leaving the page. It has a
 * small gallery (three views), colour and size choices (sold-out sizes are greyed), a quantity stepper and "Add to
 * bag", which asks for a size if none is picked. Use it on busy shop grids so people can buy without losing their
 * place. Make it the app's own: replace SAMPLE with the real products, photos and options, and link "Full details"
 * to the product page.
 */
import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { Tick } from "./icons";

// flowcode:sample
const SAMPLE = {
  eyebrow: "The bench collection",
  heading: "Tools and wear for the studio",
  bagLabel: "In your bag",
  currency: "$",
  quickView: "Quick view",
  views: ["Front", "Side", "Detail"],
  colourLegend: "Colour",
  sizeLegend: "Size",
  qtyLabel: "Quantity",
  maxQty: 5,
  add: "Add to bag",
  details: "Full details",
  sizeError: "Choose a size to continue.",
  soldOut: "sold out",
  addedTo: "added to your bag.",
  products: [
    {
      id: "apron",
      name: "Canvas cross-back apron",
      price: 5200,
      text: "Heavy cotton canvas with two deep pockets and straps that cross at the back, so nothing pulls on your neck.",
      colours: [
        { id: "clay", name: "Clay" },
        { id: "charcoal", name: "Charcoal" },
        { id: "oat", name: "Oat" },
      ],
      sizes: [
        { id: "S", inStock: true },
        { id: "M", inStock: true },
        { id: "L", inStock: false },
      ],
    },
    {
      id: "shirt",
      name: "Linen work overshirt",
      price: 8900,
      text: "Washed linen that softens with wear. Roomy enough to layer, with a chest pocket for pencils.",
      colours: [
        { id: "oat", name: "Oat" },
        { id: "sage", name: "Sage" },
      ],
      sizes: [
        { id: "S", inStock: true },
        { id: "M", inStock: false },
        { id: "L", inStock: true },
        { id: "XL", inStock: true },
      ],
    },
    {
      id: "tee",
      name: "Heavy cotton studio tee",
      price: 3200,
      text: "A thick, boxy tee that keeps its shape through a hundred washes and plenty of clay.",
      colours: [
        { id: "charcoal", name: "Charcoal" },
        { id: "ink", name: "Ink" },
        { id: "oat", name: "Oat" },
      ],
      sizes: [
        { id: "XS", inStock: true },
        { id: "S", inStock: true },
        { id: "M", inStock: true },
        { id: "L", inStock: true },
      ],
    },
    {
      id: "hat",
      name: "Cotton bucket hat",
      price: 2600,
      text: "Soft brim, stitched in rows. Packs flat into a bag for days out sketching.",
      colours: [
        { id: "sage", name: "Sage" },
        { id: "ink", name: "Ink" },
      ],
      sizes: [
        { id: "S/M", inStock: true },
        { id: "L/XL", inStock: true },
      ],
    },
  ],
};

type Product = (typeof SAMPLE.products)[number];

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
    (panel.querySelector<HTMLElement>("[data-autofocus]") ?? items()[0] ?? panel).focus();
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

function money(cents: number) {
  return `${SAMPLE.currency}${(cents / 100).toFixed(2)}`;
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  );
}

function MinusPlus({ plus }: { plus?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <path d={plus ? "M5 12h14M12 5v14" : "M5 12h14"} />
    </svg>
  );
}

function QuickView({ product, onClose, onAdd, returnTo }: { product: Product; onClose: () => void; onAdd: (text: string, qty: number) => void; returnTo: RefObject<HTMLElement | null> }) {
  const d = SAMPLE;
  const [view, setView] = useState(0);
  const [colour, setColour] = useState(product.colours[0].id);
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState(false);
  const panelRef = useModal(true, onClose, returnTo);
  const colourName = product.colours.find((c) => c.id === colour)?.name ?? "";
  const setQ = (n: number) => setQty(Math.min(d.maxQty, Math.max(1, Number.isFinite(n) ? Math.round(n) : 1)));

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!size) {
      setError(true);
      e.currentTarget.querySelector<HTMLInputElement>('input[name="shop-quick-view-size"]:not(:disabled)')?.focus();
      return;
    }
    onAdd(`${qty} × ${product.name} (${colourName}, ${size})`, qty);
  };

  return (
    <div
      className="fl-shop-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={panelRef} className="fl-shop-dialog" role="dialog" aria-modal="true" aria-labelledby="shop-quick-view-dialog-title" tabIndex={-1}>
        <button type="button" className="fl-shop-icon-btn" aria-label="Close quick view" onClick={onClose}>
          <CloseIcon />
        </button>

        <div className="fl-shop-gallery">
          <span
            className={`fl-shop-img fl-shop-img--tall fl-shop-tone--${colour} fl-shop-view--${d.views[view].toLowerCase()}`}
            role="img"
            aria-label={`${product.name} in ${colourName}, ${d.views[view].toLowerCase()} view (photo placeholder)`}
          />
          <div className="fl-shop-thumbs" role="group" aria-label="Photos">
            {d.views.map((v, i) => (
              <button key={v} type="button" className="fl-shop-thumb" aria-pressed={view === i} aria-label={`${v} view`} onClick={() => setView(i)}>
                <span className={`fl-shop-img fl-shop-tone--${colour} fl-shop-view--${v.toLowerCase()}`} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>

        <form className="fl-shop-details" noValidate onSubmit={submit}>
          <div style={{ display: "grid", gap: "var(--space-2)" }}>
            <h2 id="shop-quick-view-dialog-title" className="fl-shop-dialog-title">
              {product.name}
            </h2>
            <span className="fl-shop-price">{money(product.price)}</span>
          </div>
          <p className="fl-text">{product.text}</p>

          <fieldset className="fl-shop-swatches">
            <legend>
              {d.colourLegend}: <span style={{ fontWeight: "var(--weight-regular)" }}>{colourName}</span>
            </legend>
            {product.colours.map((c) => (
              <label key={c.id} className={`fl-shop-swatch fl-shop-tone--${c.id}`} title={c.name}>
                <input type="radio" name="shop-quick-view-colour" value={c.id} checked={colour === c.id} onChange={() => setColour(c.id)} aria-label={c.name} />
                <span />
              </label>
            ))}
          </fieldset>

          <fieldset className="fl-shop-fieldset" aria-invalid={error ? true : undefined} aria-describedby={error ? "shop-quick-view-size-error" : undefined}>
            <legend>{d.sizeLegend}</legend>
            <div className="fl-shop-pills">
              {product.sizes.map((s) => (
                <label key={s.id} className="fl-shop-pill">
                  <input
                    type="radio"
                    name="shop-quick-view-size"
                    value={s.id}
                    checked={size === s.id}
                    disabled={!s.inStock}
                    aria-label={s.inStock ? s.id : `${s.id}, ${d.soldOut}`}
                    onChange={() => {
                      setSize(s.id);
                      setError(false);
                    }}
                  />
                  <span>{s.id}</span>
                </label>
              ))}
            </div>
            {error && (
              <p id="shop-quick-view-size-error" className="fl-shop-error" role="alert">
                {d.sizeError}
              </p>
            )}
          </fieldset>

          <div className="fl-shop-buy">
            <div className="fl-shop-qty fl-shop-qty--lg" role="group" aria-label={d.qtyLabel}>
              <button type="button" aria-label="One fewer" disabled={qty <= 1} onClick={() => setQ(qty - 1)}>
                <MinusPlus />
              </button>
              <label htmlFor="shop-quick-view-qty" className="fl-sr">
                {d.qtyLabel}
              </label>
              <input id="shop-quick-view-qty" type="number" inputMode="numeric" min={1} max={d.maxQty} value={qty} onChange={(e) => setQ(Number(e.target.value))} />
              <button type="button" aria-label="One more" disabled={qty >= d.maxQty} onClick={() => setQ(qty + 1)}>
                <MinusPlus plus />
              </button>
            </div>
            <button type="submit" className="fl-btn fl-btn--primary">
              {d.add} · {money(product.price * qty)}
            </button>
          </div>
          <a className="fl-link" href={`#${product.id}`} style={{ justifySelf: "start", fontSize: "var(--text-sm)" }}>
            {d.details}
          </a>
        </form>
      </div>
    </div>
  );
}

export default function ShopQuickView() {
  const d = SAMPLE;
  const [openId, setOpenId] = useState<string | null>(null);
  const [bag, setBag] = useState(0);
  const [status, setStatus] = useState("");
  const openerRef = useRef<HTMLElement | null>(null);
  const product = d.products.find((p) => p.id === openId) ?? null;

  return (
    <section className="fl-section fl-section--tint" aria-labelledby="shop-quick-view-title">
      <div className="fl-wrap fl-shop-stage">
        <div className="fl-shop-bar">
          <div className="fl-shop-bar__title">
            <span className="fl-eyebrow">{d.eyebrow}</span>
            <h2 id="shop-quick-view-title" className="fl-title fl-title--md">
              {d.heading}
            </h2>
          </div>
          <span className="fl-badge">
            {d.bagLabel}: {bag}
          </span>
        </div>

        <ul className="fl-shop-grid">
          {d.products.map((p) => (
            <li key={p.id} className="fl-shop-tile">
              <div className="fl-shop-tile__media">
                <span className={`fl-shop-img fl-shop-img--tall fl-shop-tone--${p.colours[0].id}`} aria-hidden="true" />
                <button
                  type="button"
                  className="fl-btn fl-btn--secondary fl-shop-quick"
                  aria-haspopup="dialog"
                  onClick={(e) => {
                    openerRef.current = e.currentTarget;
                    setStatus("");
                    setOpenId(p.id);
                  }}
                >
                  <EyeIcon />
                  {d.quickView}
                  <span className="fl-sr">: {p.name}</span>
                </button>
              </div>
              <h3>{p.name}</h3>
              <span className="fl-meta">
                {p.colours.length} colours · {p.sizes.filter((s) => s.inStock).length} sizes in stock
              </span>
              <span className="fl-shop-price">{money(p.price)}</span>
            </li>
          ))}
        </ul>

        <p className={`fl-shop-status${status ? " fl-shop-status--ok" : ""}`} role="status" aria-live="polite">
          {status && <Tick />}
          {status}
        </p>
      </div>

      {product && (
        <QuickView
          key={product.id}
          product={product}
          returnTo={openerRef}
          onClose={() => setOpenId(null)}
          onAdd={(text, qty) => {
            setBag((n) => n + qty);
            setStatus(`${text} ${d.addedTo}`);
            setOpenId(null);
          }}
        />
      )}
    </section>
  );
}
