/** @flowcode-library shop-bundle-builder · Build-a-box bundle (Shop)
 * Catalog ID: b.shop-bundle-builder (block)
 * Function: A build-your-own box (b.shop-bundle-builder): pick a box size with its saving, filter products by kind (cards glide), add them with steppers until the box is full, watch the slots and a progress bar fill, and add the finished box to the bag; too many picks for a smaller box are flagged, and items, saving and total update in cents.
 * Use it as: import { ShopBundleBuilder } from "./shop-bundle-builder"; <ShopBundleBuilder title lede? boxes={[{ size: 4, percent: 15 }]} categories={[{ id, label }]} products={[{ id, name, note?, category, price(cents), art? }]} maxEach?={3} currency?="USD" onAddToBag?={async (box) => ...} />
 * Built from: c.segmented.toggle, c.quantity, c.button.primary, c.button.secondary, c.button.tertiary, c.media-frame, c.chip.filter
 * Look: A title and a pill switch of box sizes with their savings; on the left, filter chips over a grid of product cards (picture, name, a short note, price and a quantity stepper); on the right, a white card pinned in view with the box drawn as square slots that fill with pictures, a straight progress bar, the money lines with the bundle saving in green, and Add box to bag.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-danger --surface-radius --pill-radius --space-1 --space-2 --space-3 --space-4 --space-5 --radius-md --text-xs --text-sm --text-md --text-lg --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger
 * Use cases: build a box; bundle builder; mix and match; gift box; sample pack; variety pack; subscription box picker
 * Jobs to be done: pick exactly what goes in my box; see how much I save for a bigger box; know how many more to pick; add the whole box to my bag at once
 * Keywords: bundle, build a box, mix and match, gift box, variety pack, discount tiers, quantity, progress, shop
 */
/**
 * Build-a-box bundle: the "pick any 4, save 15%" shop page. The box size switch sets how many go in and the saving.
 * Each product has a stepper (up to maxEach of one product, and never past the box). The box on the right draws one
 * slot per item: picks pop into them and a slot's cross takes one out; the bar fills as the box does, and the line
 * under it says how many are left. The saving only applies to a full box. Switching to a smaller box keeps the picks
 * and says how many to remove. Filter chips narrow the grid (the cards glide, a FLIP). Add box to bag works only when
 * the box is exactly full: "Adding…", then a confirmation with Build another. Totals are worked out in cents. Make
 * it the app's own: replace SAMPLE with the shop's box sizes, savings and products, and wire onAddToBag to the bag.
 * Adapted from HyperUI (MIT License, Copyright (c) Mark Mead): its product collections and cart summaries.
 */
/**
 * How to try it
 * - Press + on three products: the slots fill and the bar grows; "1 more to go" shows. Add one more: the 15% saving
 *   appears and Add box to bag turns on.
 * - Switch to Box of 3: it says to remove one. Press the cross on a slot. Switch to Box of 6.
 * - Press a chip (Tea): the grid narrows and the cards glide. Press All.
 * - Fill the box and press Add box to bag: "Adding…", then the confirmation. Press Build another.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useRef, useState), the library's Segmented, Quantity,
 * Button and MediaFrame ("./segmented-control", "./input-quantity", "./buttons-variants", "./media-frames") and its
 * inline icon set ("./icons"). Nothing else: no package to install and nothing fetched at run time. The styles are the
 * library's own fl- classes in templates/library/css/r3h-bundle.css.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { Quantity } from "./input-quantity";
import { MediaFrame, type MediaArt } from "./media-frames";
import { Segmented } from "./segmented-control";

// ── b.shop-bundle-builder: fill a box of N products for a tiered saving, then add the box to the bag. ──

export type BundleBox = { size: number; /** Saving on a full box, in percent. */ percent: number };
export type BundleProduct = { id: string; name: string; note?: string; category: string; /** cents */ price: number; art?: MediaArt };
export type BundleResult = { size: number; items: { id: string; qty: number }[]; subtotal: number; discount: number; total: number };

export type ShopBundleBuilderProps = {
  title: string;
  lede?: string;
  boxes: BundleBox[];
  categories: { id: string; label: string }[];
  products: BundleProduct[];
  /** Most of one product in a box; 3 when left out. */
  maxEach?: number;
  currency?: string;
  locale?: string;
  onAddToBag?: (box: BundleResult) => Promise<void>;
};

function motionOff() {
  if (typeof window === "undefined") return true;
  return document.documentElement.dataset.motion === "off" || Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}
function token(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function tokenMs(name: string, fallback: number) {
  const raw = token(name);
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  return raw.endsWith("ms") ? n : raw.endsWith("s") ? n * 1000 : n;
}

/** FLIP: items marked data-flip glide from where they were to where they are now whenever `key` changes. */
function useFlip(box: RefObject<HTMLElement | null>, key: string) {
  const last = useRef(new Map<string, { x: number; y: number }>());
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const origin = el.getBoundingClientRect();
    const now = new Map<string, { x: number; y: number }>();
    const nodes = Array.from(el.querySelectorAll<HTMLElement>("[data-flip]"));
    for (const n of nodes) {
      const r = n.getBoundingClientRect();
      now.set(n.dataset.flip!, { x: r.left - origin.left, y: r.top - origin.top });
    }
    if (!motionOff()) {
      for (const n of nodes) {
        const was = last.current.get(n.dataset.flip!);
        const is = now.get(n.dataset.flip!)!;
        if (!was) {
          n.animate([{ opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1 }], { duration: tokenMs("--duration-base", 200), easing: token("--ease-out") || "ease-out" });
          continue;
        }
        const dx = was.x - is.x;
        const dy = was.y - is.y;
        if (dx || dy) n.animate([{ translate: `${dx}px ${dy}px` }, { translate: "0 0" }], { duration: tokenMs("--duration-slow", 320), easing: token("--ease-out") || "ease-out" });
      }
    }
    last.current = now;
  }, [key, box]);
}

function useCountUp(value: number) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (motionOff()) {
      from.current = value;
      setShown(value);
      return;
    }
    const a = from.current;
    const ms = tokenMs("--duration-slow", 320);
    let start = -1;
    let raf = 0;
    const tick = (t: number) => {
      if (start < 0) start = t;
      const p = Math.min(1, (t - start) / ms);
      const now = Math.round(a + (value - a) * (1 - Math.pow(1 - p, 3)));
      from.current = now;
      setShown(now);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return shown;
}

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

export function ShopBundleBuilder({ title, lede, boxes, categories, products, maxEach = 3, currency = "USD", locale = "en-US", onAddToBag }: ShopBundleBuilderProps) {
  const uid = useId();
  const focusLater = useFocusLater();
  const grid = useRef<HTMLUListElement>(null);
  const [size, setSize] = useState(boxes[Math.min(1, boxes.length - 1)]?.size ?? 4);
  const [cat, setCat] = useState("all");
  // Picks in the order they went in, so the slots fill left to right and a cross takes out that one.
  const [picks, setPicks] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<BundleResult | null>(null);
  const [said, setSaid] = useState("");
  const [nudge, setNudge] = useState("");

  const money = (cents: number) => (cents / 100).toLocaleString(locale, { style: "currency", currency });
  const box = boxes.find((b) => b.size === size) ?? boxes[0];
  const qty = (id: string) => picks.filter((p) => p === id).length;
  const byId = (id: string) => products.find((p) => p.id === id)!;
  const count = picks.length;
  const over = Math.max(0, count - size);
  const left = Math.max(0, size - count);
  const full = count === size;
  const subtotal = picks.reduce((n, id) => n + byId(id).price, 0);
  const discount = full ? Math.round((subtotal * box.percent) / 100) : 0;
  const total = subtotal - discount;
  const shownTotal = useCountUp(total);

  const shown = products.filter((p) => cat === "all" || p.category === cat);
  useFlip(grid, `${cat}:${shown.map((p) => p.id).join("|")}`);

  const setQty = (p: BundleProduct, n: number) => {
    const have = qty(p.id);
    setNudge("");
    if (n > have) {
      const room = size - count;
      if (room <= 0) {
        setNudge(`The box is full. Take one out or pick a bigger box.`);
        setSaid("The box is full.");
        return;
      }
      const add = Math.min(n - have, room);
      const next = [...picks, ...Array(add).fill(p.id)];
      setPicks(next);
      const rest = size - next.length;
      setSaid(`${p.name} added. ${rest === 0 ? "The box is full." : `${rest} more to go.`}`);
    } else if (n < have) {
      let drop = have - n;
      const next = [...picks];
      for (let i = next.length - 1; i >= 0 && drop > 0; i--) {
        if (next[i] === p.id) {
          next.splice(i, 1);
          drop--;
        }
      }
      setPicks(next);
      setSaid(`${p.name} taken out. ${next.length} of ${size} in the box.`);
    }
  };
  const takeSlot = (index: number) => {
    const id = picks[index];
    const next = picks.filter((_, i) => i !== index);
    setPicks(next);
    setNudge("");
    setSaid(`${byId(id).name} taken out. ${next.length} of ${size} in the box.`);
    focusLater(() => {
      const slots = document.querySelectorAll<HTMLElement>(`#${CSS.escape(`${uid}-slots`)} button`);
      return slots[Math.min(index, slots.length - 1)] ?? document.getElementById(`${uid}-add`);
    });
  };
  const changeSize = (v: string) => {
    const n = Number(v);
    setSize(n);
    setNudge("");
    const b = boxes.find((x) => x.size === n);
    setSaid(count > n ? `Box of ${n}. Remove ${count - n} to fit.` : `Box of ${n}, save ${b?.percent ?? 0}% when full. ${n - count} to go.`);
  };
  const addBox = async () => {
    if (!full) {
      setNudge(over ? `Remove ${over} to fit the box.` : `Pick ${left} more to fill the box.`);
      return;
    }
    const result: BundleResult = {
      size,
      items: Array.from(new Set(picks)).map((id) => ({ id, qty: qty(id) })),
      subtotal,
      discount,
      total,
    };
    setAdding(true);
    await (onAddToBag ? onAddToBag(result) : wait(800));
    setAdding(false);
    setAdded(result);
    setSaid(`Box of ${size} added to your bag for ${money(total)}.`);
    focusLater(() => document.getElementById(`${uid}-done`));
  };
  const again = () => {
    setAdded(null);
    setPicks([]);
    setSaid("New box started.");
    focusLater(() => document.querySelector<HTMLElement>(`#${CSS.escape(`${uid}-grid`)} button:not(:disabled)`));
  };

  const pct = Math.min(100, (count / size) * 100);

  return (
    <div className="fl-bb" data-fl="b.shop-bundle-builder">
      <div className="fl-bb-head">
        <div>
          <h3>{title}</h3>
          {lede ? <p>{lede}</p> : null}
        </div>
        <Segmented
          variant="toggle"
          label="Box size"
          value={String(size)}
          onChange={changeSize}
          options={boxes.map((b) => ({ value: String(b.size), label: `Box of ${b.size}`, note: `−${b.percent}%` }))}
        />
      </div>

      <div className="fl-bb-cols">
        <div className="fl-bb-shop">
          <div className="fl-bb-chips" role="group" aria-label="Show">
            {[{ id: "all", label: "All" }, ...categories].map((c) => (
              <button key={c.id} type="button" className="fl-bb-chip" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
                {c.label}
              </button>
            ))}
          </div>
          <ul className="fl-bb-grid" id={`${uid}-grid`} ref={grid} aria-label="Products">
            {shown.map((p) => {
              const q = qty(p.id);
              return (
                <li key={p.id} data-flip={p.id} className={q ? "fl-bb-card is-in" : "fl-bb-card"}>
                  <div className="fl-bb-pic">
                    <MediaFrame ratio="4-3" art={p.art ?? "a"} alt="" />
                    {q ? (
                      <span className="fl-bb-count" key={q}>
                        {q} in box
                      </span>
                    ) : null}
                  </div>
                  <div className="fl-bb-body">
                    <strong>{p.name}</strong>
                    {p.note ? <span className="fl-bb-note">{p.note}</span> : null}
                    <div className="fl-bb-buy">
                      <span className="fl-bb-price">{money(p.price)}</span>
                      <Quantity size="sm" label={p.name} value={q} min={0} max={Math.min(maxEach, q + Math.max(0, size - count))} disabled={Boolean(added)} onChange={(n) => setQty(p, n)} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <aside className="fl-bb-box" aria-label="Your box">
          {added ? (
            <div className="fl-bb-done" role="status">
              <span className="fl-bb-tick" aria-hidden="true">
                <Icon name="check" />
              </span>
              <h4 id={`${uid}-done`} tabIndex={-1}>
                Box added to your bag
              </h4>
              <p>
                {added.size} items for <strong>{money(added.total)}</strong>
                {added.discount ? `, you saved ${money(added.discount)}` : ""}.
              </p>
              <Button variant="secondary" size={40} onClick={again}>
                Build another
              </Button>
            </div>
          ) : (
            <>
              <div className="fl-bb-boxhead">
                <h4 id={`${uid}-boxtitle`}>Your box</h4>
                {count ? (
                  <button type="button" className="fl-bb-link" onClick={() => { setPicks([]); setNudge(""); setSaid("Box emptied."); }}>
                    Empty box
                  </button>
                ) : null}
              </div>
              <ul className="fl-bb-slots" id={`${uid}-slots`} style={{ ["--fl-bb-n" as string]: Math.max(size, count) > 4 ? 3 : 2 }} aria-label={`${count} of ${size} picked`}>
                {Array.from({ length: Math.max(size, count) }, (_, i) => {
                  const id = picks[i];
                  const extra = i >= size;
                  return id ? (
                    <li key={`${i}-${id}`} className={extra ? "fl-bb-slot is-over" : "fl-bb-slot"}>
                      <MediaFrame ratio="1-1" art={byId(id).art ?? "a"} alt="" />
                      <button type="button" aria-label={`Take out ${byId(id).name}`} title="Take out" onClick={() => takeSlot(i)}>
                        <Icon name="close" />
                      </button>
                    </li>
                  ) : (
                    <li key={`empty-${i}`} className="fl-bb-slot is-empty" aria-hidden="true">
                      {i + 1}
                    </li>
                  );
                })}
              </ul>
              <div className="fl-bb-progress" role="progressbar" aria-label="Box filled" aria-valuemin={0} aria-valuemax={size} aria-valuenow={Math.min(count, size)} aria-valuetext={`${count} of ${size}`}>
                <span style={{ transform: `scaleX(${pct / 100})` }} className={over ? "is-over" : full ? "is-full" : undefined} />
              </div>
              <p className={over ? "fl-bb-left is-over" : "fl-bb-left"}>
                {over ? `${over} too many for a box of ${size}. Take ${over === 1 ? "one" : over} out.` : full ? `Full. You save ${box.percent}%.` : count === 0 ? `Pick ${size} to save ${box.percent}%.` : `${left} more to go.`}
              </p>
              {count ? (
                <ul className="fl-bb-lines" aria-label="In the box">
                  {Array.from(new Set(picks)).map((id) => (
                    <li key={id}>
                      <span>
                        {byId(id).name} <span>× {qty(id)}</span>
                      </span>
                      <span className="fl-bb-num">{money(byId(id).price * qty(id))}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <dl className="fl-bb-money">
                <div>
                  <dt>Items</dt>
                  <dd>{money(subtotal)}</dd>
                </div>
                <div className={full ? "is-saving" : undefined}>
                  <dt>Box saving ({box.percent}%)</dt>
                  <dd>{full ? `−${money(discount)}` : "When full"}</dd>
                </div>
                <div className="fl-bb-total">
                  <dt>Total</dt>
                  <dd>
                    <span aria-hidden="true">{money(shownTotal)}</span>
                    <span className="fl-sr">{money(total)}</span>
                  </dd>
                </div>
              </dl>
              {nudge ? (
                <p className="fl-bb-nudge" role="alert">
                  <Icon name="info" />
                  {nudge}
                </p>
              ) : null}
              <Button id={`${uid}-add`} variant="primary" size={44} block icon="cart" busy={adding} aria-disabled={!full || undefined} onClick={() => void addBox()}>
                {adding ? "Adding…" : "Add box to bag"}
              </Button>
            </>
          )}
        </aside>
      </div>

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

// flowcode:sample
const SAMPLE: ShopBundleBuilderProps = {
  title: "Build a tasting box",
  lede: "Mix coffee, tea and snacks. Bigger boxes save more.",
  boxes: [
    { size: 3, percent: 10 },
    { size: 4, percent: 15 },
    { size: 6, percent: 20 },
  ],
  categories: [
    { id: "coffee", label: "Coffee" },
    { id: "tea", label: "Tea" },
    { id: "snack", label: "Snacks" },
  ],
  products: [
    { id: "ethiopia", name: "Ethiopia Guji", note: "Whole bean · 12 oz", category: "coffee", price: 1900, art: "a" },
    { id: "house", name: "House blend", note: "Ground · 12 oz", category: "coffee", price: 1500, art: "d" },
    { id: "decaf", name: "Swiss water decaf", note: "Whole bean · 12 oz", category: "coffee", price: 1700, art: "e" },
    { id: "sencha", name: "First flush sencha", note: "Loose leaf · 3 oz", category: "tea", price: 1400, art: "c" },
    { id: "chai", name: "Masala chai", note: "Loose leaf · 4 oz", category: "tea", price: 1200, art: "b" },
    { id: "shortbread", name: "Brown butter shortbread", note: "Tin of 12", category: "snack", price: 1100, art: "d" },
    { id: "almonds", name: "Smoked almonds", note: "8 oz", category: "snack", price: 900, art: "a" },
  ],
  maxEach: 3,
};

export default function ShopBundleBuilderPreview() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap">
        <ShopBundleBuilder {...SAMPLE} />
      </div>
    </section>
  );
}
