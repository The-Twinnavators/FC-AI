/** @flowcode-library slideshow · Slideshow: plays with Pause, thumbnails, or full screen (Cards)
 * Catalog ID: c.slideshow (component)
 * Function: The slideshow (c.slideshow): cross-fading pictures one at a time that can play on their own with a visible Pause (holding on hover and focus, off with reduced motion), a thumbnail strip, or a gallery that opens into a full-screen lightbox. Also exports Lightbox.
 * Use it as: import { Slideshow, Lightbox } from "./slideshow"; <Slideshow variant?="autoplay"|"thumbs"|"fullscreen" label="Spring show 2026" slides={[{ id, src?, alt, caption?, credit? }]} interval?={5000} start? />; <Lightbox slides label start? onClose={() => ...} />  // autoplay always has Pause and never starts with reduced motion
 * Variants: c.slideshow.autoplay - pictures that move on by themselves (a show's highlights, a hero gallery): cross-fades every few seconds with a progress line, a Pause/Play button, and holds while hovered or focused; c.slideshow.thumbs - a product's or a place's pictures: one large picture with a strip of thumbnails below to jump to any of them; never moves on its own; c.slideshow.fullscreen - a photo gallery: a grid of square pictures, each opening full size over the page with Previous/Next, Esc to close and focus back on the picture
 * Look: A wide rounded picture that cross-fades to the next, round white Previous and Next buttons over its edges, a thin accent line filling along the bottom while it plays, and a play/pause button with the count and caption underneath; full screen it fills the window on a solid page-colored backdrop.
 * Tokens: --color-surface --color-surface-sunken --color-bg --color-accent --color-text --color-text-muted --overlay-border --surface-radius --radius-md --pill-radius --surface-shadow --duration-slow --duration-base --focus-ring
 * Use cases: photo gallery; product pictures; event highlights; portfolio images; property photos; venue gallery; before and after photos
 * Jobs to be done: look through the pictures; see a picture full size; jump to a picture I want; stop it moving
 * Keywords: slideshow, slides, gallery, lightbox, photo viewer, autoplay, thumbnails, full screen
 */
/**
 * Slideshow: pictures shown one at a time, cross-fading. "autoplay" moves on by itself every few seconds with a
 * visible Pause button and a progress line; it pauses while the pointer is over it or focus is in it, and doesn't
 * start for people who have reduced motion. "thumbs" adds a strip of small pictures to jump to any slide. "fullscreen"
 * is the lightbox: any picture opens at full size over the page, Esc closes it and focus goes back to where it was.
 * Every variant has Previous/Next, the arrow keys, a count and a caption.
 * Written for FlowCode; the behaviour follows the WAI-ARIA carousel (auto-rotating) and dialog patterns and the
 * WCAG pause, stop, hide rule (no code from them).
 * Make it the app's own: replace SAMPLE with your pictures (src and alt text) and captions.
 */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "./icons";

export type SlideshowVariant = "autoplay" | "thumbs" | "fullscreen";
export type Slide = { id: string; src?: string; alt?: string; caption?: string; credit?: string };
const FL: Record<SlideshowVariant, string> = { autoplay: "c.slideshow.autoplay", thumbs: "c.slideshow.thumbs", fullscreen: "c.slideshow.fullscreen" };

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A slide's picture, or a tinted panel when it has none (samples, loading). */
function Picture({ slide, i, thumb }: { slide: Slide; i: number; thumb?: boolean }) {
  return slide.src ? <img src={slide.src} alt={thumb ? "" : slide.alt ?? ""} loading={i === 0 ? "eager" : "lazy"} /> : <span className="fl-show-tint" data-tone={i % 4} role={thumb ? undefined : "img"} aria-label={thumb ? undefined : slide.alt} />;
}

/** The slides, one at a time: fade, controls, keyboard, count and caption. Used by every variant. */
function Stage({
  slides,
  at,
  go,
  label,
  playing,
  interval,
  onToggle,
  onOpen,
  big,
}: {
  slides: Slide[];
  at: number;
  go: (i: number) => void;
  label: string;
  playing?: boolean;
  interval?: number;
  onToggle?: () => void;
  onOpen?: () => void;
  big?: boolean;
}) {
  const s = slides[at]!;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      go(at + (e.key === "ArrowRight" ? 1 : -1));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      go(e.key === "Home" ? 0 : slides.length - 1);
    }
  };
  return (
    <div className={`fl-show-stage${big ? " fl-show-stage--big" : ""}`} tabIndex={0} aria-label={`${label}: use the arrow keys to move`} onKeyDown={onKey}>
      <div className="fl-show-frame">
        {slides.map((sl, i) => (
          <div key={sl.id} className={`fl-show-slide${i === at ? " is-on" : ""}`} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${slides.length}`} aria-hidden={i !== at}>
            <Picture slide={sl} i={i} />
          </div>
        ))}
        {onOpen ? (
          <button type="button" className="fl-show-open" aria-label={`Open ${s.alt ?? `slide ${at + 1}`} full screen`} onClick={onOpen}>
            <Icon name="external" />
          </button>
        ) : null}
        <button type="button" className="fl-show-arrow fl-show-arrow--prev" aria-label="Previous slide" onClick={() => go(at - 1)}>
          <Icon name="chevron-left" />
        </button>
        <button type="button" className="fl-show-arrow fl-show-arrow--next" aria-label="Next slide" onClick={() => go(at + 1)}>
          <Icon name="chevron-right" />
        </button>
        {interval ? (
          <span className="fl-show-progress" aria-hidden="true">
            <span key={`${at}-${playing}`} className={`fl-show-progress__bar${playing ? " is-running" : ""}`} style={{ animationDuration: `${interval}ms` }} />
          </span>
        ) : null}
      </div>
      <div className="fl-show-under">
        {onToggle ? (
          <button type="button" className="fl-show-play" aria-label={playing ? "Pause the slideshow" : "Play the slideshow"} onClick={onToggle}>
            <Icon name={playing ? "pause" : "play"} />
          </button>
        ) : null}
        {/* Said aloud only when it isn't moving on its own, so a playing show doesn't talk over everything. */}
        <p className="fl-show-caption" aria-live={playing ? "off" : "polite"}>
          <span className="fl-show-count">
            {at + 1} / {slides.length}
          </span>
          {s.caption ? <span>{s.caption}</span> : null}
          {s.credit ? <span className="fl-show-credit">{s.credit}</span> : null}
        </p>
      </div>
    </div>
  );
}

/** The full-size view over the page: a modal dialog with the same controls; Esc or Close returns focus to the opener. */
export function Lightbox({ slides, start = 0, label, onClose }: { slides: Slide[]; start?: number; label: string; onClose: () => void }) {
  const [at, setAt] = useState(start);
  const box = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const go = useCallback((i: number) => setAt((i + slides.length) % slides.length), [slides.length]);
  useEffect(() => {
    opener.current = document.activeElement;
    box.current?.querySelector<HTMLElement>(".fl-show-close")?.focus();
    // The page behind doesn't scroll while it is open.
    const roots = [document.documentElement, document.body];
    const prev = roots.map((r) => r.style.overflow);
    roots.forEach((r) => (r.style.overflow = "hidden"));
    return () => {
      roots.forEach((r, i) => (r.style.overflow = prev[i]!));
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, []);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    } else if (e.key === "Tab") {
      // Focus stays inside the dialog.
      const f = [...(box.current?.querySelectorAll<HTMLElement>("button, [tabindex='0']") ?? [])];
      const i = f.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) {
        e.preventDefault();
        f[f.length - 1]?.focus();
      } else if (!e.shiftKey && i === f.length - 1) {
        e.preventDefault();
        f[0]?.focus();
      }
    }
  };
  return (
    <div className="fl-show-lightbox" role="dialog" aria-modal="true" aria-label={label} ref={box} onKeyDown={onKey}>
      <div className="fl-show-lightbox__bar">
        <p className="fl-show-lightbox__title">{label}</p>
        <button type="button" className="fl-show-close" aria-label="Close" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      <Stage slides={slides} at={at} go={go} label={label} big />
    </div>
  );
}

export function Slideshow({
  variant = "autoplay",
  slides,
  label,
  interval = 5000,
  start = 0,
}: {
  variant?: SlideshowVariant;
  slides: Slide[];
  /** Names the slideshow for screen readers and titles the full-screen view. */
  label: string;
  /** autoplay: milliseconds per slide (at least 3000). */
  interval?: number;
  start?: number;
}) {
  const [at, setAt] = useState(start);
  const [chosen, setChosen] = useState(variant === "autoplay" && !reducedMotion());
  const [held, setHeld] = useState(false);
  const [open, setOpen] = useState<number | undefined>(undefined);
  const go = useCallback((i: number) => setAt((i + slides.length) % slides.length), [slides.length]);
  const ms = Math.max(3000, interval);
  const playing = variant === "autoplay" && chosen && !held;

  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => go(at + 1), ms);
    return () => window.clearTimeout(t);
  }, [playing, at, ms, go]);

  if (variant === "fullscreen") {
    return (
      <div className="fl-show fl-show--grid" data-fl={FL.fullscreen} role="region" aria-label={label}>
        <ul className="fl-show-grid">
          {slides.map((s, i) => (
            <li key={s.id}>
              <button type="button" className="fl-show-grid__item" aria-label={`Open ${s.alt ?? `picture ${i + 1}`} full screen`} onClick={() => setOpen(i)}>
                <Picture slide={s} i={i} thumb />
              </button>
            </li>
          ))}
        </ul>
        {open !== undefined ? <Lightbox slides={slides} start={open} label={label} onClose={() => setOpen(undefined)} /> : null}
      </div>
    );
  }

  return (
    <div
      className={`fl-show fl-show--${variant}`}
      data-fl={FL[variant]}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setHeld(false)}
    >
      <Stage slides={slides} at={at} go={go} label={label} playing={playing} interval={variant === "autoplay" ? ms : undefined} onToggle={variant === "autoplay" ? () => setChosen((c) => !c) : undefined} onOpen={() => setOpen(at)} />
      {variant === "thumbs" ? (
        <ul className="fl-show-thumbs" aria-label={`${label}: pictures`}>
          {slides.map((s, i) => (
            <li key={s.id}>
              <button type="button" className="fl-show-thumb" aria-label={`Show ${s.alt ?? `slide ${i + 1}`}`} aria-current={i === at ? "true" : undefined} onClick={() => go(i)}>
                <Picture slide={s} i={i} thumb />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open !== undefined ? <Lightbox slides={slides} start={open} label={label} onClose={() => setOpen(undefined)} /> : null}
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  label: "Spring show 2026",
  slides: [
    { id: "s1", alt: "Speckled stoneware bowls stacked on a shelf", caption: "Speckled stoneware by Ana Reyes", credit: "Photo: studio" },
    { id: "s2", alt: "A potter trimming a vase on the wheel", caption: "Trimming on the wheel, Thursday open studio" },
    { id: "s3", alt: "Blue glazed mugs drying on a rack", caption: "Glaze tests from the new gas kiln" },
    { id: "s4", alt: "Visitors looking at a table of ceramics", caption: "Forty makers, one Saturday" },
    { id: "s5", alt: "A raku pot cooling in sawdust", caption: "Raku firing in the yard" },
  ] as Slide[],
};

function Note({ children }: { children: ReactNode }) {
  return <p className="fl-ctl-btn-what">{children}</p>;
}

export default function SlideshowSheet() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>Plays on its own, with Pause</h3>
        <Note>Moves every five seconds with a line counting down. It holds while your pointer is over it or focus is in it, Pause stops it, and it won't start if you have reduced motion on.</Note>
        <Slideshow slides={d.slides} label={d.label} />
      </div>
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>Thumbnails</h3>
        <Note>Never moves on its own: pick any picture from the strip, or use ← →. The corner button opens it full screen.</Note>
        <Slideshow variant="thumbs" slides={d.slides} label={`${d.label}, with thumbnails`} />
      </div>
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>Full screen from a gallery</h3>
        <Note>Any picture opens over the page; ← → step through, Esc or Close returns you to the picture you opened.</Note>
        <Slideshow variant="fullscreen" slides={d.slides} label={d.label} />
      </div>
    </section>
  );
}
