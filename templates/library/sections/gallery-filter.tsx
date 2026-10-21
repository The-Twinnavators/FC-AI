/** @flowcode-library gallery-filter · Filterable gallery (Cards)
 * Catalog ID: b.gallery-filter (block)
 * Function: The filterable gallery block (b.gallery-filter): a mosaic of tall, wide and square pictures with category chips that rearrange it in place, Show more, and a full-screen lightbox with Previous/Next, arrow keys and Escape.
 * Use it as: import { GalleryFilter } from "./gallery-filter"; <GalleryFilter label="Recent work" items={[{ id, title, category, src?, alt, shape?: "square"|"tall"|"wide" }]} categories={["Weddings", "Portraits"]} allLabel?="All" pageSize?={9} moreLabel?="Show more" countLabel?="{n} photos" onOpen?={(id) => ...} />
 * Built from: c.chip.filter, c.button.secondary, c.slideshow.fullscreen
 * Look: A row of filter chips with a quiet count, then a mosaic of rounded pictures in mixed sizes; hovering or focusing one lifts its title and category into a band along its bottom edge. Changing the filter slides the pictures that stay to their new places and fades the new ones in. A picture opens full size on a solid backdrop.
 * Tokens: --color-accent --color-secondary --color-success --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --surface-radius --space-2 --space-3 --space-4 --text-xs --text-sm --duration-fast --duration-base --duration-slow --ease-out --enter-distance --stagger --stagger-max --focus-ring
 * Use cases: photo gallery; portfolio; project gallery; venue photos; event photos; menu photos; work samples; property photos
 * Jobs to be done: look through the pictures; see only one kind of work; see a picture full size; see more pictures
 * Keywords: gallery, portfolio, photos, masonry, mosaic, filter, lightbox, images
 */
/**
 * Filterable gallery: a mosaic of pictures in three shapes (square, tall and wide) under a row of category chips.
 * Choosing a category keeps the pictures that match, and they slide from where they were to where they now sit (a FLIP
 * move); new ones fade in. Show more adds the next page, which rises in with a short, capped stagger. Every picture is
 * a button that opens the lightbox (from c.slideshow) on the pictures in view, with Previous/Next, the arrow keys and
 * Escape, and focus back on the picture when it closes. With reduced motion or animation off the pictures simply
 * change. Use it on a portfolio, a venue's or a studio's page. Make it the app's own: replace SAMPLE with the real
 * pictures (src and alt text), their categories and shapes.
 * Built from c.chip.filter, c.button.secondary and c.slideshow.fullscreen.
 * Adapted from Tailblocks (MIT License, Copyright (c) 2020 Mert Cukuren): its gallery block (a mosaic of pictures with
 * a title and line that show on hover).
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "./buttons-variants";
import { Chip } from "./chips-tags";
import { Lightbox } from "./slideshow";

export type GalleryShape = "square" | "tall" | "wide";
export type GalleryItem = { id: string; title: string; category: string; src?: string; alt: string; shape?: GalleryShape };

export type GalleryFilterProps = {
  /** Names the gallery and the lightbox. */
  label: string;
  items: GalleryItem[];
  /** The chips, in order; every item's category should be one of them. */
  categories: string[];
  allLabel?: string;
  /** How many show before Show more. */
  pageSize?: number;
  moreLabel?: string;
  /** "{n} photos"; {n} is the number that match. */
  countLabel?: string;
  /** Called when a picture opens full size. */
  onOpen?: (id: string) => void;
};

// Written out in full (not built from the shape) so a build finds every class the gallery needs.
const SHAPE: Record<GalleryShape, string> = { square: "", tall: "fl-gal-item--tall", wide: "fl-gal-item--wide" };

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** A motion token in milliseconds, read from the page (so a level, reduced motion or animation off all apply). */
function tokenMs(el: Element, name: string, fallback: number) {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  if (!raw) return fallback;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? (raw.endsWith("s") && !raw.endsWith("ms") ? n * 1000 : n) : fallback;
}

export function GalleryFilter({ label, items, categories, allLabel = "All", pageSize = 9, moreLabel = "Show more", countLabel = "{n} photos", onOpen }: GalleryFilterProps) {
  const [cat, setCat] = useState<string | null>(null);
  const [shown, setShown] = useState(pageSize);
  const [open, setOpen] = useState<number | null>(null);
  const [said, setSaid] = useState("");
  const grid = useRef<HTMLUListElement>(null);
  // Where each picture sat before the last change, for the FLIP move.
  const before = useRef<Map<string, DOMRect>>(new Map());
  const firstNew = useRef<string | null>(null);

  const matching = useMemo(() => items.filter((i) => !cat || i.category === cat), [items, cat]);
  const visible = matching.slice(0, shown);
  const left = matching.length - visible.length;

  const measure = () => {
    const map = new Map<string, DOMRect>();
    grid.current?.querySelectorAll<HTMLElement>("[data-id]").forEach((el) => map.set(el.dataset.id!, el.getBoundingClientRect()));
    before.current = map;
  };

  const filter = (next: string | null) => {
    if (next === cat) return;
    measure();
    setCat(next);
    setShown(pageSize);
    const n = items.filter((i) => !next || i.category === next).length;
    setSaid(`${next ?? allLabel}: ${countLabel.replace("{n}", String(n))}.`);
  };

  const more = () => {
    measure();
    firstNew.current = matching[shown]?.id ?? null;
    setShown((s) => s + pageSize);
    setSaid(`${Math.min(pageSize, left)} more shown.`);
  };

  // FLIP: after the change, move each picture that stayed from its old place to its new one; fade in the new ones.
  useLayoutEffect(() => {
    const host = grid.current;
    if (!host) return;
    const els = [...host.querySelectorAll<HTMLElement>("[data-id]")];
    const animate = !reduced() && before.current.size > 0 && typeof host.animate === "function";
    const dur = animate ? tokenMs(host, "--duration-slow", 320) : 0;
    const stagger = animate ? tokenMs(host, "--stagger", 40) : 0;
    const cap = animate ? tokenMs(host, "--stagger-max", 200) : 0;
    const dist = animate ? tokenMs(host, "--enter-distance", 8) : 0;
    let k = 0;
    for (const el of els) {
      const id = el.dataset.id!;
      const was = before.current.get(id);
      if (animate && dur > 0) {
        const now = el.getBoundingClientRect();
        if (was) {
          const dx = was.left - now.left;
          const dy = was.top - now.top;
          if (dx || dy) el.animate([{ translate: `${dx}px ${dy}px` }, { translate: "0 0" }], { duration: dur, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
        } else {
          const delay = Math.min(k++ * stagger, cap);
          el.animate([{ opacity: 0, translate: `0 ${dist}px` }, { opacity: 1, translate: "0 0" }], { duration: dur, delay, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "backwards" });
        }
      }
    }
    before.current = new Map();
    // After Show more, focus goes to the first new picture so a keyboard user carries on from there.
    if (firstNew.current) {
      host.querySelector<HTMLElement>(`[data-id="${CSS.escape(firstNew.current)}"] button`)?.focus({ preventScroll: false });
      firstNew.current = null;
    }
  }, [cat, shown]);

  const slides = visible.map((i) => ({ id: i.id, src: i.src, alt: i.alt, caption: `${i.title} · ${i.category}` }));

  return (
    <div className="fl-gal" data-fl="b.gallery-filter">
      <div className="fl-gal-bar">
        <div className="fl-gal-chips" role="group" aria-label={`Filter ${label}`}>
          <Chip selected={cat === null} onClick={() => filter(null)}>
            {allLabel}
          </Chip>
          {categories.map((c) => (
            <Chip key={c} selected={cat === c} onClick={() => filter(c)}>
              {c}
            </Chip>
          ))}
        </div>
        <span className="fl-gal-count">{countLabel.replace("{n}", String(matching.length))}</span>
      </div>

      <ul ref={grid} className="fl-gal-grid" aria-label={label}>
        {visible.map((item, i) => (
          <li key={item.id} data-id={item.id} className={["fl-gal-item", SHAPE[item.shape ?? "square"]].filter(Boolean).join(" ")}>
            <button
              type="button"
              className="fl-gal-tile"
              aria-label={`${item.title}, ${item.category}. Open full size`}
              onClick={() => {
                setOpen(i);
                onOpen?.(item.id);
              }}
            >
              {item.src ? <img src={item.src} alt="" loading="lazy" /> : <span className="fl-gal-tint" data-tone={items.indexOf(item) % 4} aria-hidden="true" />}
              <span className="fl-gal-cap" aria-hidden="true">
                <span>{item.category}</span>
                <strong>{item.title}</strong>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {left > 0 ? (
        <div className="fl-gal-more">
          <Button variant="secondary" size={44} onClick={more}>
            {`${moreLabel} (${left})`}
          </Button>
        </div>
      ) : null}

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>
      {open !== null ? <Lightbox slides={slides} start={open} label={label} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  eyebrow: "Portfolio",
  title: "Recent work",
  lede: "Weddings, portraits and events from the last two seasons.",
  categories: ["Weddings", "Portraits", "Events"],
  items: [
    { id: "g1", title: "First look by the river", category: "Weddings", alt: "A couple facing each other on a riverside path at dawn", shape: "tall" as GalleryShape },
    { id: "g2", title: "Studio headshot, gray", category: "Portraits", alt: "A woman smiling against a plain gray backdrop" },
    { id: "g3", title: "Product launch, main hall", category: "Events", alt: "A crowded hall facing a lit stage", shape: "wide" as GalleryShape },
    { id: "g4", title: "Vineyard toasts", category: "Weddings", alt: "Guests raising glasses at long tables between vines" },
    { id: "g5", title: "Chef at the pass", category: "Portraits", alt: "A chef in whites plating food under warm lights", shape: "tall" as GalleryShape },
    { id: "g6", title: "Charity gala", category: "Events", alt: "Round tables with candles and a speaker at a lectern" },
    { id: "g7", title: "Confetti exit", category: "Weddings", alt: "A couple walking through falling paper confetti", shape: "wide" as GalleryShape },
    { id: "g8", title: "Founder portrait", category: "Portraits", alt: "A man in a denim shirt seated by a window" },
    { id: "g9", title: "Garden party", category: "Events", alt: "Guests on a lawn under strings of lights" },
    { id: "g10", title: "First dance", category: "Weddings", alt: "A couple dancing in a barn with string lights", shape: "tall" as GalleryShape },
    { id: "g11", title: "Family on the dunes", category: "Portraits", alt: "A family of four walking on sand dunes at sunset", shape: "wide" as GalleryShape },
    { id: "g12", title: "Awards night", category: "Events", alt: "A winner holding a glass award on stage" },
    { id: "g13", title: "Rings on linen", category: "Weddings", alt: "Two gold rings resting on folded white linen" },
    { id: "g14", title: "Musician at home", category: "Portraits", alt: "A cellist practicing in a sunlit living room" },
  ],
};

export default function GalleryFilterSheet() {
  const d = SAMPLE;
  return (
    <section className="fl-section" aria-labelledby="gallery-filter-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="gallery-filter-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <GalleryFilter label={d.title} items={d.items} categories={d.categories} />
      </div>
    </section>
  );
}
