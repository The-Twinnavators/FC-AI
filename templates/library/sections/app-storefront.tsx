/** @flowcode-library app-storefront · Shop home screen (App screens)
 * Catalog ID: t.app-storefront (template)
 * Function: A shop home screen (t.app-storefront) assembled from tabs, a text field, buttons, badges and an empty state around an inline header, promo, product grid and footer.
 * Use it as: Copy app-storefront.tsx (FlowCode brings the components it uses); replace SAMPLE with the shop's own categories, products, promo and footer, and keep the bag in the app's own store.
 * Built from: c.tabs.underline, c.text-field.outlined, c.button.primary, c.button.secondary, c.button.tertiary, c.button.on-accent, c.button.ghost-on-accent, c.badge.status, c.badge.count, c.empty-state.no-results
 * Look: A shop header with search and a bag panel, a bold accent promo banner, category tabs and a four-column product grid with add-to-bag buttons, then a footer.
 * Use cases: shop home; online store; storefront; product catalog; marketplace home; booking shop; ecommerce app
 * Jobs to be done: browse products by category; search for a product; add items to my bag; find current deals
 * Keywords: app, shop, ecommerce, storefront, product grid, cart, search, tabs
 */
/**
 * App screen: a shop's home screen. A header with the shop name, a search box and a bag button with its count (the bag
 * opens as a small panel you can edit), category tabs, a dismissible promo banner, a product grid with add-to-bag and
 * a footer. Search with no matches shows an empty state with a way back. Use it as the first screen of a small online
 * shop or a booking app that sells extras. Make it the app's own: replace SAMPLE with the shop's real categories,
 * products and promo, and keep the bag in the app's own store instead of this screen's memory.
 * Assembled from: header (inline: brand, links, c.text-field search, bag panel with c.button and c.badge) > promo
 * banner (inline, c.button) > c.tabs (one panel per category) > product grid (inline, c.badge, c.button) > c.empty-state
 * for no matches > footer (inline).
 */
import { useEffect, useState } from "react";
import { Button } from "./buttons-variants";
import { Badge } from "./badges-status";
import { TextField } from "./text-fields-states";
import { Tabs } from "./tabs-variants";
import { EmptyState } from "./empty-states";

// flowcode:sample
const SAMPLE = {
  shop: "Hearth & Clay",
  mark: "H",
  nav: ["Shop", "Workshops", "Gift cards", "Our makers"],
  menuLabel: "Open menu",
  searchLabel: "Search the shop",
  searchPlaceholder: "Search mugs, vases, linen",
  bagLabel: "Bag",
  bagTitle: "Your bag",
  bagEmpty: "Your bag is empty. Pick something you like and it will wait here.",
  bagTotal: "Subtotal",
  checkout: "Go to checkout",
  checkoutNote: "Delivery and any discount are worked out at checkout.",
  remove: "Remove",
  promo: { eyebrow: "This week", title: "Free delivery on orders over $60", text: "Every piece is wrapped by hand and posted from our studio within two working days.", action: "Shop new arrivals", close: "Hide this offer" },
  heading: "Made in small batches",
  lede: "Stoneware, glass and linen from six makers we know by name.",
  noMatchTitle: "Nothing matches",
  noMatchText: "Try a shorter word, or look through every category.",
  clear: "Clear search",
  add: "Add to bag",
  added: "In bag",
  categories: ["All", "Mugs", "Plates", "Vases", "Linen"],
  products: [
    { id: "p1", name: "Speckled morning mug", maker: "Ines Okafor", category: "Mugs", price: 28, tag: "Bestseller", hue: 18 },
    { id: "p2", name: "Tall tea mug, sea glaze", maker: "Ines Okafor", category: "Mugs", price: 32, tag: "", hue: 60 },
    { id: "p3", name: "Dinner plate, oat", maker: "Bram Lindqvist", category: "Plates", price: 36, tag: "", hue: 30 },
    { id: "p4", name: "Side plates, set of four", maker: "Bram Lindqvist", category: "Plates", price: 74, tag: "Set", hue: 45 },
    { id: "p5", name: "Bud vase, smoke glass", maker: "Noor Haddad", category: "Vases", price: 42, tag: "New", hue: 70 },
    { id: "p6", name: "Ribbed floor vase", maker: "Theo Marsh", category: "Vases", price: 118, tag: "", hue: 12 },
    { id: "p7", name: "Washed linen napkins (4)", maker: "Sol & Weft", category: "Linen", price: 38, tag: "", hue: 55 },
    { id: "p8", name: "Table runner, rust stripe", maker: "Sol & Weft", category: "Linen", price: 46, tag: "New", hue: 25 },
  ],
  footer: {
    about: "A small shop for everyday things made by hand. Studio pickup on Saturdays, 10 to 4.",
    cols: [
      { title: "Shop", links: ["New arrivals", "Mugs", "Vases", "Gift cards"] },
      { title: "Help", links: ["Delivery", "Returns", "Care guide", "Contact us"] },
    ],
    base: "© 2026 Hearth & Clay. Prices include tax.",
  },
};

type Product = (typeof SAMPLE.products)[number];

const BAG = "M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2";
const SEARCH = "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4";
const CLOSE = "M6 6l12 12M18 6 6 18";

function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const money = (n: number) => `$${n.toFixed(2).replace(/\.00$/, "")}`;

/** Token-coloured product art: a soft backdrop and a simple vessel shape. */
function ProductArt({ p }: { p: Product }) {
  const shape =
    p.category === "Mugs"
      ? "M30 34h34v34a8 8 0 0 1-8 8H38a8 8 0 0 1-8-8zM64 42h6a8 8 0 0 1 0 16h-6"
      : p.category === "Plates"
        ? "M50 30a24 10 0 1 0 0.1 0zM50 36a14 5 0 1 0 0.1 0z"
        : p.category === "Vases"
          ? "M42 24h16v8c8 6 12 16 12 26 0 12-8 20-20 20s-20-8-20-20c0-10 4-20 12-26z"
          : "M26 30h48v44H26zM26 42h48M26 54h48M26 66h48";
  return (
    <div className="fl-as-art" style={{ ["--fl-as-tilt" as string]: `${p.hue}deg` }}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <path d={shape} />
      </svg>
    </div>
  );
}

export default function AppStorefront() {
  const d = SAMPLE;
  const [resetKey, setResetKey] = useState(0);
  const [query, setQuery] = useState("");
  const [bag, setBag] = useState<Record<string, number>>({});
  const [bagOpen, setBagOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [promo, setPromo] = useState(true);
  const [say, setSay] = useState("");

  useEffect(() => {
    if (!bagOpen) return;
    document.getElementById("fl-as-sf-bag")?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setBagOpen(false);
        document.getElementById("fl-as-sf-bagbtn")?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [bagOpen]);

  const q = query.trim().toLowerCase();
  const count = Object.values(bag).reduce((n, v) => n + v, 0);
  const lines = d.products.filter((p) => bag[p.id]);
  const subtotal = lines.reduce((n, p) => n + p.price * bag[p.id], 0);

  function add(p: Product) {
    setBag((b) => ({ ...b, [p.id]: (b[p.id] ?? 0) + 1 }));
    setSay(`Added ${p.name} to your bag.`);
  }
  function setQty(p: Product, n: number) {
    setBag((b) => {
      const next = { ...b };
      if (n <= 0) delete next[p.id];
      else next[p.id] = n;
      return next;
    });
    setSay(n <= 0 ? `Removed ${p.name}.` : `${p.name}: ${n} in your bag.`);
  }

  /** One category's panel: the count line and either the products or the no-match state. */
  function panel(cat: string) {
    const shown = d.products.filter((p) => (cat === "All" || p.category === cat) && (!q || `${p.name} ${p.maker} ${p.category}`.toLowerCase().includes(q)));
    return (
      <div>
        <p className="fl-meta" aria-live="polite" style={{ marginBlock: "0 var(--space-4)" }}>
          {shown.length} {shown.length === 1 ? "piece" : "pieces"}
          {q ? ` for \u201c${query.trim()}\u201d` : ""}
        </p>
        {shown.length === 0 ? (
          <div className="fl-as-panel">
            <EmptyState
              variant="no-results"
              title={d.noMatchTitle}
              headingLevel={2}
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery("");
                    setResetKey((k) => k + 1);
                  }}
                >
                  {d.clear}
                </Button>
              }
            >
              {d.noMatchText}
            </EmptyState>
          </div>
        ) : (
          <ul className="fl-as-products">
            {shown.map((p) => {
              const inBag = bag[p.id] ?? 0;
              return (
                <li key={p.id} className="fl-as-product">
                  <ProductArt p={p} />
                  {p.tag && (
                    <Badge className="fl-as-product__tag">{p.tag}</Badge>
                  )}
                  <div className="fl-as-product__body">
                    <h3>{p.name}</h3>
                    <span className="fl-meta">{p.maker}</span>
                  </div>
                  <div className="fl-as-product__foot">
                    <strong>{money(p.price)}</strong>
                    <Button size={32} variant={inBag ? "secondary" : "primary"} icon={inBag ? "check" : undefined} onClick={() => add(p)} aria-label={`${d.add}: ${p.name}`}>
                      {inBag ? `${d.added} \u00b7 ${inBag}` : d.add}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="fl-as-app">
      <header className="fl-as-top fl-as-shophead">
        <div className="fl-as-brand">
          <span className="fl-as-mark" aria-hidden="true">
            {d.mark}
          </span>
          <span className="fl-as-brand__name">{d.shop}</span>
        </div>
        <nav id="fl-as-sf-nav" className="fl-as-topnav" data-open={menuOpen} aria-label={d.shop}>
          <ul>
            {d.nav.map((n, i) => (
              <li key={n}>
                <a href={`#${n.toLowerCase().replace(/\s+/g, "-")}`} aria-current={i === 0 ? "page" : undefined} onClick={() => setMenuOpen(false)}>
                  {n}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <form className="fl-as-search fl-as-shopsearch" role="search" onSubmit={(e) => e.preventDefault()}>
          <label htmlFor="fl-as-sf-q" className="fl-sr">
            {d.searchLabel}
          </label>
          <Glyph d={SEARCH} />
          <TextField id="fl-as-sf-q" type="search" placeholder={d.searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} />
        </form>
        <div className="fl-as-top__end">
          <div className="fl-as-pop-wrap">
            <Button id="fl-as-sf-bagbtn" variant="tertiary" size={40} className="fl-as-bagbtn" style={{ position: "relative" }} aria-expanded={bagOpen} aria-controls="fl-as-sf-bag" onClick={() => setBagOpen((o) => !o)}>
              <Glyph d={BAG} />
              <span className="fl-sr">
                {d.bagLabel}, {count} {count === 1 ? "item" : "items"}
              </span>
              <Badge variant="count" count={count} className="fl-as-count" />
            </Button>
            {bagOpen && (
              <div id="fl-as-sf-bag" className="fl-as-pop fl-as-bag" role="dialog" aria-modal="false" aria-labelledby="fl-as-sf-bagtitle" tabIndex={-1}>
                <div className="fl-as-panelhead">
                  <h2 id="fl-as-sf-bagtitle" className="fl-as-h2">
                    {d.bagTitle}
                  </h2>
                  <Button
                    variant="tertiary"
                    size={32}
                    icon="close"
                    iconOnly
                    onClick={() => {
                      setBagOpen(false);
                      document.getElementById("fl-as-sf-bagbtn")?.focus();
                    }}
                  >
                    Close bag
                  </Button>
                </div>
                {lines.length === 0 ? (
                  <p className="fl-text">{d.bagEmpty}</p>
                ) : (
                  <>
                    <ul className="fl-as-baglist">
                      {lines.map((p) => (
                        <li key={p.id}>
                          <div>
                            <strong>{p.name}</strong>
                            <span className="fl-meta">{money(p.price * bag[p.id])}</span>
                          </div>
                          <div className="fl-as-qty" role="group" aria-label={`Quantity of ${p.name}`}>
                            <Button variant="tertiary" size={24} onClick={() => setQty(p, bag[p.id] - 1)} aria-label={bag[p.id] === 1 ? `${d.remove} ${p.name}` : `One fewer ${p.name}`}>
                              {"\u2212"}
                            </Button>
                            <span aria-live="polite">{bag[p.id]}</span>
                            <Button variant="tertiary" size={24} onClick={() => setQty(p, bag[p.id] + 1)} aria-label={`One more ${p.name}`}>
                              +
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="fl-as-bagtotal">
                      <span>{d.bagTotal}</span>
                      <strong>{money(subtotal)}</strong>
                    </div>
                    <Button href="#checkout">{d.checkout}</Button>
                    <p className="fl-note">{d.checkoutNote}</p>
                  </>
                )}
              </div>
            )}
          </div>
          <span className="fl-as-menubtn">
            <Button variant="tertiary" size={40} icon="menu" iconOnly aria-expanded={menuOpen} aria-controls="fl-as-sf-nav" onClick={() => setMenuOpen((o) => !o)}>
              {d.menuLabel}
            </Button>
          </span>
        </div>
      </header>

      <main className="fl-as-main fl-as-shopmain">
        {promo && (
          <aside className="fl-as-promo" aria-label={d.promo.title}>
            <div className="fl-as-promo__text">
              <p className="fl-as-promo__eyebrow">{d.promo.eyebrow}</p>
              <h2 className="fl-as-promo__title">{d.promo.title}</h2>
              <p>{d.promo.text}</p>
              <Button variant="on-accent" href="#new" icon="arrow" iconAt="end">
                {d.promo.action}
              </Button>
            </div>
            <Button variant="ghost-on-accent" size={32} icon="close" iconOnly className="fl-as-promo__close" onClick={() => setPromo(false)}>
              {d.promo.close}
            </Button>
          </aside>
        )}

        <div className="fl-as-pagehead">
          <div>
            <h1 className="fl-as-h1">{d.heading}</h1>
            <p className="fl-text">{d.lede}</p>
          </div>
        </div>

        <p className="fl-sr" aria-live="polite">
          {say}
        </p>

        <Tabs key={resetKey} label="Categories" tabs={d.categories.map((c) => ({ id: c, label: c, panel: panel(c) }))} />
      </main>

      <footer className="fl-as-foot">
        <div className="fl-as-foot__cols">
          <div>
            <p className="fl-as-brand__name">{d.shop}</p>
            <p className="fl-text">{d.footer.about}</p>
          </div>
          {d.footer.cols.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <h2 className="fl-as-foot__title">{c.title}</h2>
              <ul>
                {c.links.map((l) => (
                  <li key={l}>
                    <a href={`#${l.toLowerCase().replace(/\s+/g, "-")}`}>{l}</a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className="fl-meta fl-as-foot__base">{d.footer.base}</p>
      </footer>
    </div>
  );
}
