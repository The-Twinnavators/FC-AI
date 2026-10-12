/** @flowcode-library carousel · Carousel: several cards, a hero, or one at a time (Cards)
 * Catalog ID: c.carousel (component)
 * Function: The carousel (c.carousel): items people swipe or step through with the next one peeking, native scroll with snap points, Previous/Next and arrow keys, the position said aloud, and no automatic movement.
 * Use it as: import { Carousel } from "./carousel"; <Carousel variant?="multi"|"hero"|"full" label="Classes this week" items={[{ id, title, caption?, src?, alt?, content?, href? }]} onOpen?={(id) => ...} />  // never moves on its own
 * Variants: c.carousel.multi - a browsable row (classes, products, articles): several cards at once with the next one peeking at the edge; c.carousel.hero - a few featured things worth a big picture: one large item at a time with the next beside it; c.carousel.full - steps or slides read in order: one item across the full width with dots for the position
 * Look: A row of rounded pictures with a bold title and a muted line under each, the next one cut off at the edge; a position count on the left and round Previous and Next buttons on the right above it.
 * Tokens: --color-surface --color-surface-sunken --color-border-strong --color-accent --color-secondary --color-text-muted --surface-radius --radius-lg --pill-radius --font-display --duration-slow --focus-ring
 * Use cases: featured products; classes this week; photo gallery; onboarding steps; related articles; recently viewed; featured events
 * Jobs to be done: browse a few items quickly; see there is more to the side; step through in order
 * Keywords: carousel, slider, gallery, slideshow, swipe, featured, horizontal scroll
 */
/**
 * Carousel: a row of items people swipe or step through, with the next one peeking so they know there is more.
 * "multi" shows several cards at once; "hero" one large item with the next beside it; "full" one item across the full
 * width with a position marker. It scrolls natively (swipe, trackpad, scroll-snap); Previous and Next buttons and the
 * arrow keys step one item, and the position is said to screen readers. It never moves on its own.
 * Written for FlowCode; the behaviour follows the carousel guidance in Material 3 and the WAI-ARIA carousel pattern
 * (no code from either).
 * Make it the app's own: replace SAMPLE with your items (a picture or any content, a title and a line under it).
 */
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "./icons";

export type CarouselVariant = "multi" | "hero" | "full";
export type CarouselItem = {
  id: string;
  title: string;
  caption?: string;
  /** A picture; without one the item's content (or a tinted panel) fills it. */
  src?: string;
  alt?: string;
  content?: ReactNode;
  href?: string;
};
const FL: Record<CarouselVariant, string> = { multi: "c.carousel.multi", hero: "c.carousel.hero", full: "c.carousel.full" };

export function Carousel({ variant = "multi", label, items, onOpen }: { variant?: CarouselVariant; label: string; items: CarouselItem[]; onOpen?: (id: string) => void }) {
  const id = useId().replace(/:/g, "");
  const track = useRef<HTMLUListElement>(null);
  const [at, setAt] = useState(0);
  const [ends, setEnds] = useState({ start: true, end: items.length <= 1 });

  // Which item is first in view, and whether the track is at either end, from the scroll position.
  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const kids = [...el.children] as HTMLElement[];
    const left = el.scrollLeft;
    let i = kids.findIndex((k) => k.offsetLeft - kids[0]!.offsetLeft >= left - 4);
    if (i < 0) i = kids.length - 1;
    setAt(i);
    setEnds({ start: left <= 2, end: left + el.clientWidth >= el.scrollWidth - 2 });
  }, []);
  useEffect(() => {
    measure();
    const el = track.current;
    el?.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      el?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const go = (i: number) => {
    const el = track.current;
    const kids = el ? ([...el.children] as HTMLElement[]) : [];
    const target = kids[Math.max(0, Math.min(kids.length - 1, i))];
    if (!el || !target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: target.offsetLeft - kids[0]!.offsetLeft, behavior: reduce ? "auto" : "smooth" });
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      go(at + (e.key === "ArrowRight" ? 1 : -1));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      go(e.key === "Home" ? 0 : items.length - 1);
    }
  };

  return (
    <section className={`fl-car fl-car--${variant}`} aria-roledescription="carousel" aria-label={label} data-fl={FL[variant]}>
      <div className="fl-car-bar">
        <p className="fl-car-pos" aria-live="polite">
          {at + 1} of {items.length}
        </p>
        <div className="fl-car-btns">
          <button type="button" className="fl-car-btn" aria-label="Previous" aria-controls={`${id}-track`} disabled={ends.start} onClick={() => go(at - 1)}>
            <Icon name="chevron-left" />
          </button>
          <button type="button" className="fl-car-btn" aria-label="Next" aria-controls={`${id}-track`} disabled={ends.end} onClick={() => go(at + 1)}>
            <Icon name="chevron-right" />
          </button>
        </div>
      </div>
      <ul ref={track} id={`${id}-track`} className="fl-car-track" tabIndex={0} aria-label={`${label}: use the arrow keys to move`} onKeyDown={onKey}>
        {items.map((it, i) => {
          const body = (
            <>
              <span className="fl-car-media">{it.src ? <img src={it.src} alt={it.alt ?? ""} loading="lazy" /> : it.content ?? <span className="fl-car-tint" data-tone={i % 4} aria-hidden="true" />}</span>
              <span className="fl-car-text">
                <span className="fl-car-title">{it.title}</span>
                {it.caption ? <span className="fl-car-caption">{it.caption}</span> : null}
              </span>
            </>
          );
          return (
            <li key={it.id} className="fl-car-item" role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${items.length}: ${it.title}`}>
              {it.href ? (
                <a className="fl-car-card" href={it.href} tabIndex={-1} onClick={() => onOpen?.(it.id)}>
                  {body}
                </a>
              ) : onOpen ? (
                <button type="button" className="fl-car-card" tabIndex={-1} onClick={() => onOpen(it.id)}>
                  {body}
                </button>
              ) : (
                <div className="fl-car-card">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      {variant === "full" ? (
        <div className="fl-car-dots" aria-hidden="true">
          {items.map((it, i) => (
            <span key={it.id} className={`fl-car-dot${i === at ? " is-on" : ""}`} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

// flowcode:sample
const SAMPLE = {
  multi: {
    label: "Classes this week",
    items: [
      { id: "wheel", title: "Wheel throwing", caption: "Tue · 6 places" },
      { id: "glaze", title: "Glazing basics", caption: "Wed · 3 places" },
      { id: "hand", title: "Hand building", caption: "Thu · full" },
      { id: "kids", title: "Kids' clay club", caption: "Sat · 8 places" },
      { id: "raku", title: "Raku firing", caption: "Sun · 2 places" },
      { id: "date", title: "Date night", caption: "Fri · 4 places" },
    ],
  },
  hero: {
    label: "Featured",
    items: [
      { id: "show", title: "Spring show: 40 makers", caption: "Saturday 12 April, 10:00 to 16:00" },
      { id: "kiln", title: "New gas kiln", caption: "Book a firing slot from May" },
      { id: "open", title: "Open studio evenings", caption: "Every Thursday, members free" },
    ],
  },
  full: {
    label: "How it works",
    items: [
      { id: "1", title: "1. Pick a class", caption: "Every class lists its level and places left." },
      { id: "2", title: "2. Book a place", caption: "Pay on the day or online." },
      { id: "3", title: "3. Come and make", caption: "Aprons, clay and tools are ready for you." },
    ],
  },
};

export default function CarouselSheet() {
  const d = SAMPLE;
  const [opened, setOpened] = useState("");
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>Multi: several cards, the next peeking</h3>
        <p className="fl-ctl-btn-what">Swipe, scroll, use the buttons, or focus the row and press ← →. It never moves on its own.</p>
        <Carousel label={d.multi.label} items={d.multi.items} onOpen={(i) => setOpened(d.multi.items.find((x) => x.id === i)?.title ?? "")} />
        <p className="fl-ctl-status" role="status">
          {opened ? `Opened: ${opened}.` : "Open a card to see where it goes."}
        </p>
      </div>
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>Hero: one large item at a time</h3>
        <p className="fl-ctl-btn-what">For a few things worth a big picture; the next one shows at the edge.</p>
        <Carousel variant="hero" label={d.hero.label} items={d.hero.items} />
      </div>
      <div className="fl-ctl-spec">
        <h3>Full: one across the width</h3>
        <p className="fl-ctl-btn-what">Steps or slides read in order, with dots for where you are.</p>
        <Carousel variant="full" label={d.full.label} items={d.full.items} />
      </div>
    </section>
  );
}
