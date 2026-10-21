/** @flowcode-library shop-compare · Product compare tray (Shop)
 * Catalog ID: b.shop-compare (block)
 * Function: A product grid with a Compare tick on each card (b.shop-compare): up to three picks gather in a tray fixed along the bottom, and Compare opens a side-by-side table that marks the best value per row, can hide rows that match, drops a product and adds one to the bag.
 * Use it as: import { ShopCompare } from "./shop-compare"; <ShopCompare title lede? max?={3} specs={[{ key, label, unit?, better?: "high"|"low" }]} products={[{ id, name, price(cents), rating, reviews, art?, specs: { [key]: number|string|boolean } }]} currency?="USD" onAddToBag?={async (id) => ...} />
 * Built from: c.checkbox, c.button.primary, c.button.secondary, c.button.tertiary, c.media-frame, c.badge.status
 * Look: A title over a grid of product cards (picture, name, stars, price and a Compare tick). Ticking one raises an accent-colored tray fixed along the bottom of the window with three slots (thumbnails with a remove cross, dashed empty slots), Clear and Compare. The comparison is a large dialog: product columns with pictures and Add to bag, rows of specs with the best value tinted and tagged, and a "Only differences" switch.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-warning --surface-radius --pill-radius --space-1 --space-2 --space-3 --space-4 --space-5 --radius-md --text-xs --text-sm --text-md --text-lg --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --shadow-lg
 * Use cases: product comparison; compare products; electronics shop; spec comparison; choosing between models; category page
 * Jobs to be done: put two or three products side by side; see which is best on what matters to me; ignore what is the same; buy the one I pick
 * Keywords: compare, comparison, tray, specs, product table, best value, dialog, shop
 */
/**
 * Product compare tray: the way shops let you put models side by side. Tick Compare on a card; the tray rises from
 * the bottom with your picks and empty slots. A fourth tick is refused (the other boxes turn off and the tray says
 * why). Compare needs two; it opens a dialog (native <dialog>, Escape closes, focus returns) with a column per product
 * and a row per spec. The best value in a row is tinted and tagged (highest or lowest as the spec says); "Only
 * differences" hides rows where all agree. Remove drops a column (and the pick); Add to bag shows "Adding…" then
 * "In bag". Make it the app's own: replace SAMPLE with the category's products and the specs worth comparing.
 * Adapted from HyperUI (MIT License, Copyright (c) Mark Mead): its product cards and product collection grids.
 */
/**
 * How to try it
 * - Tick Compare on three cards: the tray rises and fills. Tick a fourth: the boxes are off and the tray says why.
 * - Press the cross on a slot, or Clear. With one pick, Compare says it needs two.
 * - Press Compare: the dialog shows the best value per row. Turn on Only differences. Remove a column.
 * - Press Add to bag in a column. Press Escape: the dialog closes and focus is back on Compare.
 *
 * Dependencies: React (useEffect, useId, useRef, useState), the library's Checkbox, Button and MediaFrame
 * ("./checkboxes-radios", "./buttons-variants", "./media-frames") and its inline icon set ("./icons"). Nothing else:
 * no package to install and nothing fetched at run time. The styles are the library's own fl- classes in
 * templates/library/css/r3h-compare.css.
 */
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "./buttons-variants";
import { Checkbox } from "./checkboxes-radios";
import { Icon } from "./icons";
import { MediaFrame, type MediaArt } from "./media-frames";

// ── b.shop-compare: pick up to three products into a tray and compare them in a table. ──

export type CompareSpec = { key: string; label: string; unit?: string; better?: "high" | "low" };
export type CompareProduct = {
  id: string;
  name: string;
  /** cents */
  price: number;
  rating: number;
  reviews: number;
  art?: MediaArt;
  specs: Record<string, number | string | boolean>;
};

export type ShopCompareProps = {
  title: string;
  lede?: string;
  /** Most products in one comparison; 3 when left out. */
  max?: number;
  specs: CompareSpec[];
  products: CompareProduct[];
  currency?: string;
  locale?: string;
  onAddToBag?: (id: string) => Promise<void>;
};

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));


/** Focuses an element once React has drawn it (a plain timer can run before the new state is on the page). */
function useFocusLater() {
  const want = useRef<(() => HTMLElement | null | undefined) | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    const find = want.current;
    if (!find) return;
    const el = find();
    if (el) {
      want.current = null;
      el.focus();
    }
  });
  return (find: () => HTMLElement | null | undefined) => {
    want.current = find;
    setTick((t) => t + 1);
  };
}

export function ShopCompare({ title, lede, max = 3, specs, products, currency = "USD", locale = "en-US", onAddToBag }: ShopCompareProps) {
  const uid = useId();
  const focusLater = useFocusLater();
  const dialog = useRef<HTMLDialogElement>(null);
  const compareBtn = useRef<HTMLButtonElement | HTMLAnchorElement>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [diffOnly, setDiffOnly] = useState(false);
  const [adding, setAdding] = useState<Record<string, boolean>>({});
  const [inBag, setInBag] = useState<Record<string, boolean>>({});
  const [said, setSaid] = useState("");
  const [hint, setHint] = useState("");

  const money = (cents: number) => (cents / 100).toLocaleString(locale, { style: "currency", currency });
  const byId = (id: string) => products.find((p) => p.id === id)!;
  const full = picked.length >= max;

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const toggle = (p: CompareProduct, on: boolean) => {
    setHint("");
    if (on) {
      if (picked.length >= max) {
        setHint(`You can compare up to ${max}. Remove one first.`);
        return;
      }
      const next = [...picked, p.id];
      setPicked(next);
      setSaid(`${p.name} added to compare. ${next.length} of ${max}.${next.length >= max ? " The tray is full." : ""}`);
    } else {
      unpick(p.id);
    }
  };
  const unpick = (id: string) => {
    const next = picked.filter((x) => x !== id);
    setPicked(next);
    setHint("");
    setSaid(`${byId(id).name} removed from compare. ${next.length} of ${max}.`);
    if (open && next.length < 2) {
      setOpen(false);
      setSaid(`${byId(id).name} removed. Pick at least two to compare.`);
      focusLater(() => document.getElementById(`${uid}-pick-${id}`));
    }
  };
  const clear = () => {
    setPicked([]);
    setHint("");
    setSaid("Compare tray cleared.");
    focusLater(() => document.getElementById(`${uid}-pick-${products[0]?.id}`));
  };
  const openCompare = () => {
    if (picked.length < 2) {
      setHint("Pick at least two to compare.");
      return;
    }
    setDiffOnly(false);
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    focusLater(() => compareBtn.current);
  };
  const add = async (id: string) => {
    setAdding((a) => ({ ...a, [id]: true }));
    await (onAddToBag ? onAddToBag(id) : wait(600));
    setAdding((a) => ({ ...a, [id]: false }));
    setInBag((b) => ({ ...b, [id]: true }));
    setSaid(`${byId(id).name} added to your bag.`);
  };

  const cols = picked.map(byId);
  const fmt = (spec: CompareSpec, v: number | string | boolean | undefined) => {
    if (v === undefined) return "—";
    if (typeof v === "boolean") return v ? "Yes" : "No";
    if (typeof v === "number") return `${v.toLocaleString(locale)}${spec.unit ? ` ${spec.unit}` : ""}`;
    return v;
  };
  const rows: { key: string; label: string; cells: string[]; best: boolean[] }[] = [
    { key: "price", label: "Price", spec: { key: "price", label: "Price", better: "low" as const }, values: cols.map((c) => c.price) },
    { key: "rating", label: "Rating", spec: { key: "rating", label: "Rating", better: "high" as const }, values: cols.map((c) => c.rating) },
    ...specs.map((s) => ({ key: s.key, label: s.label, spec: s, values: cols.map((c) => c.specs[s.key]) })),
  ].map((r) => {
    const nums = r.values.filter((v): v is number => typeof v === "number");
    const target = r.spec.better && nums.length === r.values.length ? (r.spec.better === "high" ? Math.max(...nums) : Math.min(...nums)) : null;
    const allSame = new Set(r.values.map(String)).size === 1;
    return {
      key: r.key,
      label: r.label,
      cells: r.values.map((v) => (r.key === "price" ? money(v as number) : r.key === "rating" ? `${(v as number).toFixed(1)} of 5` : fmt(r.spec, v))),
      best: r.values.map((v) => target !== null && !allSame && v === target),
    };
  });
  const sameRows = rows.filter((r) => new Set(r.cells).size === 1).length;
  const shownRows = diffOnly ? rows.filter((r) => new Set(r.cells).size > 1) : rows;

  return (
    <div className="fl-cmp" data-fl="b.shop-compare">
      <div className="fl-cmp-head">
        <h3 id={`${uid}-title`}>{title}</h3>
        {lede ? <p>{lede}</p> : null}
      </div>

      <ul className="fl-cmp-grid" aria-labelledby={`${uid}-title`}>
        {products.map((p) => {
          const on = picked.includes(p.id);
          return (
            <li key={p.id} className={on ? "fl-cmp-card is-on" : "fl-cmp-card"}>
              <MediaFrame ratio="1-1" art={p.art ?? "a"} alt="" />
              <div className="fl-cmp-body">
                <strong>{p.name}</strong>
                <span className="fl-cmp-stars" aria-label={`Rated ${p.rating.toFixed(1)} of 5 from ${p.reviews} reviews`}>
                  <Icon name="star" filled />
                  {p.rating.toFixed(1)} <span aria-hidden="true">({p.reviews})</span>
                </span>
                <span className="fl-cmp-price">{money(p.price)}</span>
                <Checkbox
                  id={`${uid}-pick-${p.id}`}
                  label="Compare"
                  checked={on}
                  disabled={!on && full}
                  aria-label={`Compare ${p.name}`}
                  aria-describedby={!on && full ? `${uid}-full` : undefined}
                  onChange={(e) => toggle(p, e.target.checked)}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {picked.length > 0 ? (
        <div className="fl-cmp-tray" role="region" aria-label="Compare tray">
          <div className="fl-cmp-tray-in">
            <p className="fl-cmp-tray-title">
              <strong>Compare</strong> {picked.length} of {max}
            </p>
            <ul className="fl-cmp-slots">
              {Array.from({ length: max }, (_, i) => {
                const p = cols[i];
                return p ? (
                  <li key={p.id} className="fl-cmp-slot">
                    <MediaFrame ratio="1-1" art={p.art ?? "a"} alt="" />
                    <span>{p.name}</span>
                    <button type="button" aria-label={`Remove ${p.name} from compare`} title="Remove" onClick={() => unpick(p.id)}>
                      <Icon name="close" />
                    </button>
                  </li>
                ) : (
                  <li key={`empty${i}`} className="fl-cmp-slot is-empty" aria-hidden="true">
                    <span>Add a product</span>
                  </li>
                );
              })}
            </ul>
            <div className="fl-cmp-tray-actions">
              <p className="fl-cmp-hint" id={`${uid}-full`}>
                {hint || (full ? `Up to ${max}. Remove one to swap.` : picked.length < 2 ? "Pick one more." : "")}
              </p>
              <Button variant="ghost-on-accent" size={40} onClick={clear}>
                Clear
              </Button>
              <Button ref={compareBtn} variant="on-accent" size={40} aria-disabled={picked.length < 2 || undefined} aria-haspopup="dialog" onClick={openCompare}>
                Compare ({picked.length})
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <dialog
        ref={dialog}
        className="fl-cmp-dialog"
        aria-labelledby={`${uid}-dtitle`}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        {open ? (
          <div className="fl-cmp-panel">
            <div className="fl-cmp-dhead">
              <h3 id={`${uid}-dtitle`}>Compare {cols.length} products</h3>
              <Checkbox label={`Only differences${sameRows ? ` (hides ${sameRows})` : ""}`} checked={diffOnly} onChange={(e) => setDiffOnly(e.target.checked)} />
              <Button variant="tertiary" size={40} icon="close" iconOnly onClick={close}>
                Close
              </Button>
            </div>
            <div className="fl-cmp-scroll" tabIndex={0} role="group" aria-label="Comparison table, scrolls sideways">
              <table className="fl-cmp-table" style={{ ["--fl-cmp-cols" as string]: cols.length }}>
                <caption className="fl-sr">Products side by side</caption>
                <thead>
                  <tr>
                    <td />
                    {cols.map((p) => (
                      <th key={p.id} scope="col">
                        <MediaFrame ratio="4-3" art={p.art ?? "a"} alt="" />
                        <span className="fl-cmp-colname">{p.name}</span>
                        <span className="fl-cmp-colbtns">
                          <Button variant={inBag[p.id] ? "secondary" : "primary"} size={32} busy={adding[p.id]} icon={inBag[p.id] ? "check" : undefined} disabled={inBag[p.id]} onClick={() => void add(p.id)}>
                            {adding[p.id] ? "Adding…" : inBag[p.id] ? "In bag" : "Add to bag"}
                          </Button>
                          <Button variant="tertiary" size={32} onClick={() => unpick(p.id)} aria-label={`Remove ${p.name}`}>
                            Remove
                          </Button>
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shownRows.map((r) => (
                    <tr key={r.key}>
                      <th scope="row">{r.label}</th>
                      {r.cells.map((c, i) => (
                        <td key={cols[i].id} className={r.best[i] ? "is-best" : undefined}>
                          {c}
                          {r.best[i] ? <span className="fl-cmp-best">Best</span> : null}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {shownRows.length === 0 ? (
                    <tr>
                      <td colSpan={cols.length + 1} className="fl-cmp-same">
                        These are the same on every row.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </dialog>

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

// flowcode:sample
const SAMPLE: ShopCompareProps = {
  title: "Wireless headphones",
  lede: "Tick up to three to see them side by side.",
  specs: [
    { key: "battery", label: "Battery", unit: "h", better: "high" },
    { key: "weight", label: "Weight", unit: "g", better: "low" },
    { key: "anc", label: "Noise canceling" },
    { key: "water", label: "Water resistance" },
    { key: "fold", label: "Folds flat" },
    { key: "warranty", label: "Warranty", unit: "yr", better: "high" },
  ],
  products: [
    { id: "aria", name: "Aria Over-Ear", price: 24900, rating: 4.6, reviews: 812, art: "a", specs: { battery: 30, weight: 254, anc: true, water: "None", fold: true, warranty: 2 } },
    { id: "pulse", name: "Pulse Sport", price: 12900, rating: 4.2, reviews: 431, art: "b", specs: { battery: 40, weight: 198, anc: false, water: "IPX5", fold: false, warranty: 1 } },
    { id: "halo", name: "Halo Studio", price: 34900, rating: 4.8, reviews: 207, art: "c", specs: { battery: 24, weight: 312, anc: true, water: "None", fold: false, warranty: 3 } },
    { id: "drift", name: "Drift Lite", price: 7900, rating: 3.9, reviews: 1290, art: "d", specs: { battery: 22, weight: 176, anc: false, water: "IPX4", fold: true, warranty: 1 } },
    { id: "nova", name: "Nova ANC", price: 19900, rating: 4.4, reviews: 655, art: "e", specs: { battery: 35, weight: 240, anc: true, water: "IPX4", fold: true, warranty: 2 } },
    { id: "echo", name: "Echo Travel", price: 15900, rating: 4.1, reviews: 389, art: "a", specs: { battery: 45, weight: 228, anc: true, water: "None", fold: true, warranty: 1 } },
  ],
};

export default function ShopComparePreview() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap">
        <ShopCompare {...SAMPLE} />
      </div>
    </section>
  );
}
