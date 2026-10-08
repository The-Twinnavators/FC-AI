/**
 * App screen: a shop's home screen. A header with the shop name, a search box and a bag button with its count (the bag
 * opens as a small panel you can edit), category tabs, a dismissible promo banner, a product grid with add-to-bag and
 * a footer. Search with no matches shows an empty state with a way back. Use it as the first screen of a small online
 * shop or a booking app that sells extras. Make it the app's own: replace SAMPLE with the shop's real categories,
 * products and promo, and keep the bag in the app's own store instead of this screen's memory.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "./icons";

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
  const [cat, setCat] = useState("All");
  const [query, setQuery] = useState("");
  const [bag, setBag] = useState<Record<string, number>>({});
  const [bagOpen, setBagOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [promo, setPromo] = useState(true);
  const [say, setSay] = useState("");
  const bagBtn = useRef<HTMLButtonElement>(null);
  const bagPanel = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!bagOpen) return;
    bagPanel.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setBagOpen(false);
        bagBtn.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [bagOpen]);

  const q = query.trim().toLowerCase();
  const shown = d.products.filter((p) => (cat === "All" || p.category === cat) && (!q || `${p.name} ${p.maker} ${p.category}`.toLowerCase().includes(q)));
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
  function onTabKey(e: KeyboardEvent, i: number) {
    const n = d.categories.length;
    let j = -1;
    if (e.key === "ArrowRight") j = (i + 1) % n;
    else if (e.key === "ArrowLeft") j = (i - 1 + n) % n;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = n - 1;
    if (j < 0) return;
    e.preventDefault();
    setCat(d.categories[j]);
    tabRefs.current[j]?.focus();
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
          <input id="fl-as-sf-q" className="fl-input" type="search" placeholder={d.searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} />
        </form>
        <div className="fl-as-top__end">
          <div className="fl-as-pop-wrap">
            <button ref={bagBtn} type="button" className="fl-as-iconbtn fl-as-bagbtn" aria-expanded={bagOpen} aria-controls="fl-as-sf-bag" onClick={() => setBagOpen((o) => !o)}>
              <Glyph d={BAG} />
              <span className="fl-sr">
                {d.bagLabel}, {count} {count === 1 ? "item" : "items"}
              </span>
              {count > 0 && (
                <span className="fl-as-count" aria-hidden="true">
                  {count}
                </span>
              )}
            </button>
            {bagOpen && (
              <div id="fl-as-sf-bag" ref={bagPanel} className="fl-as-pop fl-as-bag" role="dialog" aria-modal="false" aria-labelledby="fl-as-sf-bagtitle" tabIndex={-1}>
                <div className="fl-as-panelhead">
                  <h2 id="fl-as-sf-bagtitle" className="fl-as-h2">
                    {d.bagTitle}
                  </h2>
                  <button
                    type="button"
                    className="fl-as-iconbtn"
                    onClick={() => {
                      setBagOpen(false);
                      bagBtn.current?.focus();
                    }}
                  >
                    <Glyph d={CLOSE} />
                    <span className="fl-sr">Close bag</span>
                  </button>
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
                            <button type="button" onClick={() => setQty(p, bag[p.id] - 1)} aria-label={bag[p.id] === 1 ? `${d.remove} ${p.name}` : `One fewer ${p.name}`}>
                              −
                            </button>
                            <span aria-live="polite">{bag[p.id]}</span>
                            <button type="button" onClick={() => setQty(p, bag[p.id] + 1)} aria-label={`One more ${p.name}`}>
                              +
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="fl-as-bagtotal">
                      <span>{d.bagTotal}</span>
                      <strong>{money(subtotal)}</strong>
                    </div>
                    <a className="fl-btn fl-btn--primary" href="#checkout">
                      {d.checkout}
                    </a>
                    <p className="fl-note">{d.checkoutNote}</p>
                  </>
                )}
              </div>
            )}
          </div>
          <button type="button" className="fl-as-iconbtn fl-as-menubtn" aria-expanded={menuOpen} aria-controls="fl-as-sf-nav" onClick={() => setMenuOpen((o) => !o)}>
            <Icon name="menu" />
            <span className="fl-sr">{d.menuLabel}</span>
          </button>
        </div>
      </header>

      <main className="fl-as-main fl-as-shopmain">
        {promo && (
          <aside className="fl-as-promo" aria-label={d.promo.title}>
            <div className="fl-as-promo__text">
              <p className="fl-as-promo__eyebrow">{d.promo.eyebrow}</p>
              <h2 className="fl-as-promo__title">{d.promo.title}</h2>
              <p>{d.promo.text}</p>
              <a className="fl-btn fl-btn--on-accent" href="#new">
                {d.promo.action}
                <Icon name="arrow" />
              </a>
            </div>
            <button type="button" className="fl-as-iconbtn fl-as-promo__close" onClick={() => setPromo(false)}>
              <Glyph d={CLOSE} />
              <span className="fl-sr">{d.promo.close}</span>
            </button>
          </aside>
        )}

        <div className="fl-as-pagehead">
          <div>
            <h1 className="fl-as-h1">{d.heading}</h1>
            <p className="fl-text">{d.lede}</p>
          </div>
        </div>

        <div className="fl-as-tabs" role="tablist" aria-label="Categories">
          {d.categories.map((c, i) => (
            <button
              key={c}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`fl-as-sf-tab-${i}`}
              aria-selected={cat === c}
              aria-controls="fl-as-sf-grid"
              tabIndex={cat === c ? 0 : -1}
              onClick={() => setCat(c)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              {c}
            </button>
          ))}
        </div>

        <p className="fl-sr" aria-live="polite">
          {say}
        </p>

        <div id="fl-as-sf-grid" role="tabpanel" aria-labelledby={`fl-as-sf-tab-${d.categories.indexOf(cat)}`}>
          <p className="fl-meta" aria-live="polite" style={{ marginBlock: "0 var(--space-4)" }}>
            {shown.length} {shown.length === 1 ? "piece" : "pieces"}
            {q ? ` for “${query.trim()}”` : ""}
          </p>
          {shown.length === 0 ? (
            <div className="fl-as-panel fl-as-empty">
              <span className="fl-icon">
                <Glyph d={SEARCH} />
              </span>
              <h2 className="fl-as-h2">{d.noMatchTitle}</h2>
              <p className="fl-text">{d.noMatchText}</p>
              <button
                type="button"
                className="fl-btn fl-btn--secondary"
                onClick={() => {
                  setQuery("");
                  setCat("All");
                }}
              >
                {d.clear}
              </button>
            </div>
          ) : (
            <ul className="fl-as-products">
              {shown.map((p) => {
                const inBag = bag[p.id] ?? 0;
                return (
                  <li key={p.id} className="fl-as-product">
                    <ProductArt p={p} />
                    {p.tag && <span className="fl-badge fl-as-product__tag">{p.tag}</span>}
                    <div className="fl-as-product__body">
                      <h3>{p.name}</h3>
                      <span className="fl-meta">{p.maker}</span>
                    </div>
                    <div className="fl-as-product__foot">
                      <strong>{money(p.price)}</strong>
                      <button type="button" className={`fl-as-btn ${inBag ? "fl-as-btn--done" : "fl-as-btn--primary"}`} onClick={() => add(p)} aria-label={`${d.add}: ${p.name}`}>
                        {inBag ? `${d.added} · ${inBag}` : d.add}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
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
