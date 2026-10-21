/** @flowcode-library shop-wishlist · Wishlist (Shop)
 * Catalog ID: b.shop-wishlist (block)
 * Function: A shopper's saved items (b.shop-wishlist) with price drops and stock: sort them (cards glide), pick a size, move one or all to the bag (adding, failed and added states), remove with Undo, Notify me on sold-out items, and copy a share link; an empty state when nothing is saved.
 * Use it as: import { ShopWishlist } from "./shop-wishlist"; <ShopWishlist title items={[{ id, name, price(cents), was?(cents), stock: "in"|"low"|"out", sizes?: ["S","M"], saved: "2026-10-12", art?: "a"|"b"|"c"|"d"|"e" }]} bagCount?={0} shareUrl? currency?="USD" onMoveToBag?={async (item, size) => ...} onRemove?={(id) => ...} onNotify?={(id, on) => ...} />
 * Built from: c.select.outlined, c.button.primary, c.button.secondary, c.button.tertiary, c.badge.status, c.media-frame, c.empty-state
 * Look: A white card with the title and a count, a Sort select, Share list and Move all to bag, over a grid of product cards: a picture with a round heart button in the corner and a Price drop tag, the name, the price beside the struck old price, a stock line, a size select where needed and a full-width Move to bag button. A bag pill at the top right bumps when something lands in it.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-warning --color-danger --surface-radius --pill-radius --space-1 --space-2 --space-3 --space-4 --space-5 --radius-md --text-xs --text-sm --text-md --text-lg --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger
 * Use cases: wishlist; saved items; favorites; save for later; shop account; gift list; price watch
 * Jobs to be done: keep things I might buy; see what got cheaper; move what I want into my bag; get told when a sold-out item is back; share my list
 * Keywords: wishlist, saved items, favorites, move to bag, price drop, back in stock, undo, share, shop
 */
/**
 * Wishlist: what a shopper saved with the heart. Sort by when saved, price or price drops first (the cards glide to
 * their new places). Items with sizes ask for one before they can move; Move to bag shows "Adding…", then the card
 * folds away, the bag pill counts up and an Undo bar appears. A failed add keeps the card with the reason and lets you
 * try again. The heart removes (with Undo). Sold-out items swap the button for "Notify me", a toggle. Move all to bag
 * moves every item that can go and says which ones still need a size. Share list copies a link (and says so, or that
 * copying was blocked). Make it the app's own: replace SAMPLE with the shopper's saved items and wire onMoveToBag,
 * onRemove and onNotify to the shop's own data.
 * Adapted from HyperUI (MIT License, Copyright (c) Mark Mead): its product cards with a wishlist button.
 */
/**
 * How to try it
 * - Change Sort to "Price: low to high": the cards glide into order.
 * - Press Move to bag on the Rib-knit cardigan without a size: it asks for one. Pick M and press it again: the card
 *   folds away and the bag pill counts up. Press Undo.
 * - Move the Wool beanie: it fails with a reason; the card stays. Press the heart on any card, then Undo.
 * - On the sold-out Field jacket press Notify me (it turns on). Press Move all to bag. Press Share list.
 * - Remove everything: the empty state shows.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useRef, useState), the library's Select, Button, Badge and
 * MediaFrame ("./dropdowns-states", "./buttons-variants", "./badges-status", "./media-frames") and its inline icon set
 * ("./icons"). Nothing else: no package to install and nothing fetched at run time. The styles are the library's own
 * fl- classes in templates/library/css/r3h-wishlist.css.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { MediaFrame, type MediaArt } from "./media-frames";

// ── b.shop-wishlist: saved items with sort, sizes, move to bag, remove with undo and share. ──

export type WishItem = {
  id: string;
  name: string;
  /** cents */
  price: number;
  /** The price when it was saved, in cents; shows a Price drop tag when higher. */
  was?: number;
  stock: "in" | "low" | "out";
  sizes?: string[];
  /** ISO date it was saved. */
  saved: string;
  art?: MediaArt;
};
type Sort = "saved" | "low" | "high" | "drop";

export type ShopWishlistProps = {
  title: string;
  items: WishItem[];
  /** Items already in the bag. */
  bagCount?: number;
  /** The link Share list copies; the page's own address when left out. */
  shareUrl?: string;
  currency?: string;
  locale?: string;
  /** Adds one to the bag; throw to show why it failed. */
  onMoveToBag?: (item: WishItem, size?: string) => Promise<void>;
  onRemove?: (id: string) => void;
  onNotify?: (id: string, on: boolean) => void;
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

/** FLIP: cards marked data-flip glide from where they were to where they are now whenever `key` changes. */
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
        if (!was) continue;
        const dx = was.x - is.x;
        const dy = was.y - is.y;
        if (dx || dy) n.animate([{ translate: `${dx}px ${dy}px` }, { translate: "0 0" }], { duration: tokenMs("--duration-slow", 320), easing: token("--ease-out") || "ease-out" });
      }
    }
    last.current = now;
  }, [key, box]);
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

export function ShopWishlist({ title, items: given, bagCount = 0, shareUrl, currency = "USD", locale = "en-US", onMoveToBag, onRemove, onNotify }: ShopWishlistProps) {
  const uid = useId();
  const focusLater = useFocusLater();
  const grid = useRef<HTMLUListElement>(null);
  const [items, setItems] = useState(given);
  const [sort, setSort] = useState<Sort>("saved");
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [needSize, setNeedSize] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [leaving, setLeaving] = useState<Record<string, boolean>>({});
  const [notify, setNotify] = useState<Record<string, boolean>>({});
  const [bag, setBag] = useState(bagCount);
  const [bump, setBump] = useState(0);
  const [undo, setUndo] = useState<{ item: WishItem; index: number; moved: boolean; size?: string } | null>(null);
  const [said, setSaid] = useState("");
  const [allBusy, setAllBusy] = useState(false);

  const money = (cents: number) => (cents / 100).toLocaleString(locale, { style: "currency", currency });

  const shown = [...items].sort((a, b) => {
    if (sort === "low") return a.price - b.price;
    if (sort === "high") return b.price - a.price;
    if (sort === "drop") return (b.was ? b.was - b.price : 0) - (a.was ? a.was - a.price : 0) || b.saved.localeCompare(a.saved);
    return b.saved.localeCompare(a.saved);
  });
  useFlip(grid, shown.map((i) => i.id).join("|"));

  useEffect(() => {
    if (!bump) return;
    const t = window.setTimeout(() => setBump(0), 600);
    return () => window.clearTimeout(t);
  }, [bump]);

  /** Folds the card away, then takes it out of the list (no fold with motion off). */
  const takeOut = (id: string, then: (item: WishItem, index: number) => void) => {
    const index = items.findIndex((i) => i.id === id);
    if (index < 0) return;
    const item = items[index];
    setLeaving((l) => ({ ...l, [id]: true }));
    window.setTimeout(
      () => {
        setItems((list) => list.filter((i) => i.id !== id));
        setLeaving((l) => ({ ...l, [id]: false }));
        then(item, index);
      },
      motionOff() ? 0 : tokenMs("--duration-base", 200),
    );
  };

  const focusUndo = () => focusLater(() => document.getElementById(`${uid}-undo`));

  const move = async (item: WishItem, quiet = false): Promise<boolean> => {
    const size = sizes[item.id];
    if (item.sizes?.length && !size) {
      setNeedSize((n) => ({ ...n, [item.id]: true }));
      return false;
    }
    setBusy((b) => ({ ...b, [item.id]: true }));
    setFailed((f) => ({ ...f, [item.id]: "" }));
    try {
      await (onMoveToBag ? onMoveToBag(item, size) : wait(600));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't add it. Try again.";
      setFailed((f) => ({ ...f, [item.id]: msg }));
      setBusy((b) => ({ ...b, [item.id]: false }));
      return false;
    }
    setBusy((b) => ({ ...b, [item.id]: false }));
    setBag((n) => n + 1);
    setBump((n) => n + 1);
    takeOut(item.id, (it, index) => {
      if (!quiet) setUndo({ item: it, index, moved: true, size });
    });
    return true;
  };

  const moveOne = async (item: WishItem) => {
    const ok = await move(item);
    if (ok) {
      setSaid(`${item.name}${sizes[item.id] ? `, size ${sizes[item.id]},` : ""} moved to your bag.`);
      focusUndo();
    } else if (item.sizes?.length && !sizes[item.id]) {
      setSaid(`Choose a size for ${item.name}.`);
      document.getElementById(`${uid}-size-${item.id}`)?.focus();
    } else {
      setSaid(`${item.name} wasn't added.`);
    }
  };

  const moveAll = async () => {
    const ready = shown.filter((i) => i.stock !== "out" && !(i.sizes?.length && !sizes[i.id]));
    const waiting = shown.filter((i) => i.stock !== "out" && i.sizes?.length && !sizes[i.id]);
    if (waiting.length) setNeedSize((n) => ({ ...n, ...Object.fromEntries(waiting.map((i) => [i.id, true])) }));
    if (!ready.length) {
      setSaid(waiting.length ? `Choose a size first for ${waiting.map((i) => i.name).join(", ")}.` : "Nothing here can move to the bag right now.");
      return;
    }
    setAllBusy(true);
    const results = await Promise.all(ready.map((i) => move(i, true)));
    setAllBusy(false);
    setUndo(null);
    const moved = results.filter(Boolean).length;
    const fails = ready.length - moved;
    setSaid(
      [`${moved === 1 ? "1 item" : `${moved} items`} moved to your bag.`, fails ? `${fails} couldn't be added.` : "", waiting.length ? `Choose a size for ${waiting.map((i) => i.name).join(", ")}.` : ""]
        .filter(Boolean)
        .join(" "),
    );
  };

  const remove = (item: WishItem) => {
    onRemove?.(item.id);
    takeOut(item.id, (it, index) => {
      setUndo({ item: it, index, moved: false });
      setSaid(`${it.name} removed from your wishlist.`);
      focusUndo();
    });
  };

  const undoLast = () => {
    if (!undo) return;
    setItems((list) => {
      const next = [...list];
      next.splice(Math.min(undo.index, next.length), 0, undo.item);
      return next;
    });
    if (undo.moved) setBag((n) => Math.max(0, n - 1));
    setSaid(`${undo.item.name} is back on your wishlist.`);
    const id = undo.item.id;
    setUndo(null);
    focusLater(() => document.getElementById(`${uid}-move-${id}`));
  };

  const share = async () => {
    const url = shareUrl ?? window.location.href;
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(url);
      setSaid("Link copied. Anyone with it can see this list.");
    } catch {
      setSaid(`Couldn't copy. The link is ${url}`);
    }
  };

  const toggleNotify = (item: WishItem) => {
    const on = !notify[item.id];
    setNotify((n) => ({ ...n, [item.id]: on }));
    onNotify?.(item.id, on);
    setSaid(on ? `We'll email you when ${item.name} is back.` : `No email for ${item.name}.`);
  };

  return (
    <div className="fl-wsh" data-fl="b.shop-wishlist">
      <div className="fl-wsh-head">
        <h3 id={`${uid}-title`}>
          {title} <span>{items.length === 1 ? "1 item" : `${items.length} items`}</span>
        </h3>
        <span className={bump ? "fl-wsh-bag is-bump" : "fl-wsh-bag"} key={bump ? `b${bag}` : "b"}>
          <Icon name="cart" />
          Bag <strong>{bag}</strong>
        </span>
      </div>

      {items.length > 0 ? (
        <div className="fl-wsh-tools">
          <label className="fl-wsh-sort">
            <span>Sort</span>
            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              options={[
                { value: "saved", label: "Recently saved" },
                { value: "drop", label: "Price drops first" },
                { value: "low", label: "Price: low to high" },
                { value: "high", label: "Price: high to low" },
              ]}
            />
          </label>
          <span className="fl-wsh-spacer" />
          <Button variant="tertiary" size={40} icon="share" onClick={() => void share()}>
            Share list
          </Button>
          <Button variant="secondary" size={40} icon="cart" busy={allBusy} onClick={() => void moveAll()}>
            {allBusy ? "Moving…" : "Move all to bag"}
          </Button>
        </div>
      ) : null}

      {undo ? (
        <div className="fl-wsh-undo">
          <span>
            <strong>{undo.item.name}</strong> {undo.moved ? "moved to your bag." : "removed."}
          </span>
          <button type="button" id={`${uid}-undo`} className="fl-wsh-link" onClick={undoLast}>
            Undo
          </button>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="fl-wsh-empty" data-fl="c.empty-state">
          <Icon name="heart" />
          <strong>Nothing saved yet</strong>
          <p>Tap the heart on anything you like and it waits here.</p>
          {undo ? null : (
            <Button variant="secondary" size={40} onClick={() => setItems(given)}>
              Browse the shop
            </Button>
          )}
        </div>
      ) : (
        <ul className="fl-wsh-grid" ref={grid} aria-labelledby={`${uid}-title`}>
          {shown.map((item, i) => {
            const drop = item.was && item.was > item.price ? item.was - item.price : 0;
            const out = item.stock === "out";
            const sizeErr = needSize[item.id] && !sizes[item.id];
            return (
              <li key={item.id} data-flip={item.id} className={leaving[item.id] ? "fl-wsh-card is-leaving" : "fl-wsh-card"} style={{ ["--fl-wsh-i" as string]: Math.min(i, 5) }}>
                <div className="fl-wsh-pic">
                  <MediaFrame ratio="4-3" art={item.art ?? "a"} alt="" />
                  {drop ? <span className="fl-wsh-tag">Price drop</span> : null}
                  <button type="button" className="fl-wsh-heart" aria-label={`Remove ${item.name} from wishlist`} title="Remove" disabled={busy[item.id]} onClick={() => remove(item)}>
                    <Icon name="heart" filled />
                  </button>
                </div>
                <div className="fl-wsh-body">
                  <strong className="fl-wsh-name">{item.name}</strong>
                  <p className="fl-wsh-price">
                    <span>{money(item.price)}</span>
                    {drop ? (
                      <>
                        <s>
                          <span className="fl-sr">was </span>
                          {money(item.was!)}
                        </s>
                        <span className="fl-wsh-save">Save {money(drop)}</span>
                      </>
                    ) : null}
                  </p>
                  <p className={`fl-wsh-stock is-${item.stock}`}>
                    <span aria-hidden="true" />
                    {item.stock === "in" ? "In stock" : item.stock === "low" ? "Only a few left" : "Sold out"}
                  </p>
                  {item.sizes?.length && !out ? (
                    <div className="fl-wsh-size">
                      <label htmlFor={`${uid}-size-${item.id}`} className="fl-sr">
                        Size for {item.name}
                      </label>
                      <Select
                        id={`${uid}-size-${item.id}`}
                        placeholder="Size"
                        value={sizes[item.id] ?? ""}
                        options={item.sizes}
                        invalid={Boolean(sizeErr)}
                        aria-describedby={sizeErr ? `${uid}-size-err-${item.id}` : undefined}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSizes((s) => ({ ...s, [item.id]: v }));
                          setNeedSize((n) => ({ ...n, [item.id]: false }));
                        }}
                      />
                      {sizeErr ? (
                        <p className="fl-wsh-err" id={`${uid}-size-err-${item.id}`}>
                          <Icon name="alert" />
                          Choose a size first.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {failed[item.id] ? (
                    <p className="fl-wsh-err" role="alert">
                      <Icon name="alert" />
                      {failed[item.id]}
                    </p>
                  ) : null}
                  {out ? (
                    <Button variant="secondary" size={40} block icon="bell" pressed={Boolean(notify[item.id])} onClick={() => toggleNotify(item)}>
                      {notify[item.id] ? "We'll email you" : "Notify me"}
                    </Button>
                  ) : (
                    <Button id={`${uid}-move-${item.id}`} variant="primary" size={40} block busy={busy[item.id]} onClick={() => void moveOne(item)}>
                      {busy[item.id] ? "Adding…" : failed[item.id] ? "Try again" : "Move to bag"}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="fl-wsh-said" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

// flowcode:sample
const SAMPLE: ShopWishlistProps = {
  title: "Your wishlist",
  bagCount: 1,
  shareUrl: "https://shop.example.com/wishlist/ana-r",
  items: [
    { id: "cardigan", name: "Rib-knit cardigan", price: 7800, was: 9800, stock: "in", sizes: ["XS", "S", "M", "L", "XL"], saved: "2026-10-18", art: "b" },
    { id: "tote", name: "Waxed canvas tote", price: 5400, stock: "low", saved: "2026-10-15", art: "d" },
    { id: "jacket", name: "Field jacket", price: 16800, stock: "out", sizes: ["S", "M", "L"], saved: "2026-10-09", art: "e" },
    { id: "beanie", name: "Wool beanie", price: 2800, stock: "in", saved: "2026-10-20", art: "c" },
    { id: "boots", name: "Leather Chelsea boots", price: 18900, was: 21000, stock: "in", sizes: ["7", "8", "9", "10", "11"], saved: "2026-09-30", art: "a" },
  ],
  onMoveToBag: async (item) => {
    await wait(700);
    if (item.id === "beanie") throw new Error("The last one just sold. Try again later.");
  },
};

export default function ShopWishlistPreview() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap">
        <ShopWishlist {...SAMPLE} />
      </div>
    </section>
  );
}
