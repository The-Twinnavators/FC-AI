/** @flowcode-library features-bento · Bento features (Features)
 * Catalog ID: b.features-bento (block)
 * Function: The bento features block (b.features-bento): four to ten features in a grid of mixed tile sizes (big, wide, tall, small), each with an icon, a title and a line, some with a picture or a big number, and a More button that turns the tile over to say more.
 * Use it as: import { FeaturesBento } from "./features-bento"; <FeaturesBento label="Features" tiles={[{ id, title, text, icon?, size?: "big"|"wide"|"tall"|"small", picture?: { src?, alt }, stat?: { value, label }, more?, link?: { label, href } }]} moreLabel?="More" onOpen?={(id) => ...} />
 * Built from: c.media-frame, c.button.tertiary
 * Look: A tight grid of rounded surface tiles of different sizes packed without holes: the big tile carries a picture under its words, a wide tile a large accent number, the rest an icon in a tinted square, a bold title and a muted line; hovering lifts a tile, and More flips its words to a longer note.
 * Tokens: --color-accent --color-on-accent --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --surface-radius --surface-shadow --surface-shadow-hover --radius-md --space-1 --space-2 --space-3 --space-4 --space-5 --text-sm --text-md --text-3xl --font-display --duration-fast --duration-base --duration-slow --ease-out --ease-spring --enter-distance --stagger --stagger-max --hover-lift --focus-ring
 * Use cases: saas homepage; product features; app homepage; feature overview; platform capabilities; what's included; product tour; startup homepage
 * Jobs to be done: see everything the product does at a glance; find the feature I care about; understand what makes it different; read more about one feature
 * Keywords: bento, bento grid, features, feature grid, mixed tiles, capabilities, mosaic, product features
 */
/**
 * Bento features: the product's features as a mosaic of tiles of different sizes, so the one that matters most is
 * biggest. Tiles with more to say have a More button that turns the tile's words over to a longer note in place
 * (Escape or Back turns it back, and focus stays on the button); a tile can also end in a link. The tiles rise in once,
 * one after another, as the grid scrolls into view; with reduced motion or animation off they are simply there. On a
 * tablet the grid has two columns and on a phone one. Make it the app's own: replace SAMPLE with four to ten real
 * features, give the most important one size "big" and a real screenshot, and keep each line short; make the tile spans (big 4, wide and tall 2, small 1) add up to a multiple of four so no hole is left.
 * Built from c.media-frame and c.button.
 * Adapted from AstroWind (MIT License, Copyright (c) 2023 onWidget): its Bento widget (an asymmetric card grid packed
 * densely, each card a visual over its words).
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { MediaFrame, type MediaArt } from "./media-frames";

export type BentoTile = {
  id: string;
  title: string;
  text: string;
  /** An icon name from ./icons, drawn in a tinted square. */
  icon?: string;
  /** big: 2 x 2, wide: 2 x 1, tall: 1 x 2, small: 1 x 1 (the default). */
  size?: "big" | "wide" | "tall" | "small";
  /** A picture under the words; without src a tinted stand-in is drawn. Best on big and tall tiles. */
  picture?: { src?: string; alt: string };
  /** A large number in place of a picture. */
  stat?: { value: string; label: string };
  /** A longer note, shown when the tile is turned over with More. */
  more?: string;
  /** A link at the foot of the tile. */
  link?: { label: string; href: string };
};

export type FeaturesBentoProps = {
  /** Names the grid for screen readers. */
  label: string;
  tiles: BentoTile[];
  /** The button that turns a tile over. */
  moreLabel?: string;
  /** Called when a tile is turned over. */
  onOpen?: (id: string) => void;
};

const ARTS: MediaArt[] = ["c", "a", "d", "b", "e"];
const SIZE: Record<NonNullable<BentoTile["size"]>, string> = {
  big: "fl-bnto-tile--big",
  wide: "fl-bnto-tile--wide",
  tall: "fl-bnto-tile--tall",
  small: "",
};

const still = () =>
  typeof window === "undefined" ||
  document.documentElement.dataset.motion === "off" ||
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Entrance once: "wait" until the grid is in view, then "in". Without an observer, or with motion off, it is shown at once. */
function useEnterOnce<T extends Element>() {
  const ref = useRef<T>(null);
  const [state, setState] = useState<"idle" | "wait" | "in">("idle");
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window) || still()) return;
    // Already on screen: play now. Otherwise wait for it, but never leave it hidden (a page that isn't painting gets
    // the content after a moment either way).
    const box = el.getBoundingClientRect();
    if (box.top < innerHeight && box.bottom > 0) {
      setState("in");
      return;
    }
    setState("wait");
    const show = () => {
      setState("in");
      io.disconnect();
    };
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && show(), { threshold: 0.15 });
    io.observe(el);
    const t = setTimeout(show, 1200);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, []);
  return [ref, state] as const;
}

export function FeaturesBento({ label, tiles, moreLabel = "More", onOpen }: FeaturesBentoProps) {
  const uid = useId();
  const [open, setOpen] = useState<string | null>(null);
  const [grid, enter] = useEnterOnce<HTMLUListElement>();

  const toggle = (id: string) => {
    const next = open === id ? null : id;
    setOpen(next);
    if (next) onOpen?.(next);
  };

  const onKey = (e: KeyboardEvent<HTMLLIElement>, id: string) => {
    if (e.key === "Escape" && open === id) {
      e.preventDefault();
      setOpen(null);
      document.getElementById(`${uid}-${id}-btn`)?.focus();
    }
  };

  return (
    <div className="fl-bnto-box" data-fl="b.features-bento">
      <ul
        ref={grid}
        className={["fl-bnto", enter === "wait" ? "is-waiting" : "", enter === "in" ? "is-entering" : ""].filter(Boolean).join(" ")}
        aria-label={label}
      >
        {tiles.map((t, i) => {
          const isOpen = open === t.id;
          return (
            <li
              key={t.id}
              className={["fl-bnto-tile", SIZE[t.size ?? "small"], isOpen ? "is-open" : "", t.picture ? "has-pic" : ""].filter(Boolean).join(" ")}
              style={{ ["--i" as string]: i }}
              onKeyDown={(e) => onKey(e, t.id)}
            >
              <div className="fl-bnto-face" inert={isOpen}>
                <div className="fl-bnto-words">
                  {t.icon ? (
                    <span className="fl-bnto-icon" aria-hidden="true">
                      <Icon name={t.icon} />
                    </span>
                  ) : null}
                  <h3 className="fl-bnto-title">{t.title}</h3>
                  <p className="fl-bnto-text">{t.text}</p>
                </div>
                {t.stat ? (
                  <p className="fl-bnto-stat">
                    <strong>{t.stat.value}</strong>
                    <span>{t.stat.label}</span>
                  </p>
                ) : null}
                {t.picture ? (
                  <div className="fl-bnto-pic">
                    <MediaFrame ratio="16-9" src={t.picture.src} alt={t.picture.alt} art={ARTS[i % ARTS.length]} />
                  </div>
                ) : null}
                {t.link ? (
                  <a className="fl-bnto-link" href={t.link.href}>
                    {t.link.label}
                    <Icon name="arrow" />
                  </a>
                ) : null}
              </div>
              {t.more ? (
                <>
                  <div className="fl-bnto-back" id={`${uid}-${t.id}-more`} inert={!isOpen} aria-hidden={!isOpen}>
                    <p className="fl-bnto-back-title">{t.title}</p>
                    <p className="fl-bnto-back-text">{t.more}</p>
                  </div>
                  <Button
                    id={`${uid}-${t.id}-btn`}
                    variant="tertiary"
                    size={32}
                    icon={isOpen ? "close" : "plus"}
                    iconOnly
                    className="fl-bnto-toggle"
                    aria-expanded={isOpen}
                    aria-controls={`${uid}-${t.id}-more`}
                    aria-label={isOpen ? `Back to ${t.title}` : `${moreLabel} about ${t.title}`}
                    title={isOpen ? "Back" : moreLabel}
                    onClick={() => toggle(t.id)}
                  >
                    {isOpen ? "Back" : moreLabel}
                  </Button>
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  eyebrow: "Features",
  title: "Everything a small studio needs",
  lede: "One place for bookings, payments and the people who come back.",
  tiles: [
    {
      id: "calendar",
      size: "big" as const,
      icon: "calendar",
      title: "A calendar clients can book",
      text: "Share one link. People see open times and book in two taps.",
      more: "Set hours per room or teacher, add buffers between sessions, and block holidays once for the whole team.",
      picture: { alt: "The week view with open slots in green" },
    },
    {
      id: "deposits",
      size: "wide" as const,
      icon: "shield",
      title: "Deposits stop no-shows",
      text: "Take a deposit when someone books.",
      stat: { value: "−68%", label: "fewer no-shows" },
      more: "Choose a fixed amount or a share of the price. Refunds go back automatically if you cancel.",
    },
    {
      id: "reminders",
      icon: "bell",
      title: "Reminders",
      text: "Email and text the day before.",
      more: "Write your own wording, or keep ours. Clients can move a booking from the reminder.",
    },
    {
      id: "packs",
      icon: "layers",
      title: "Class packs",
      text: "Sell ten classes at once.",
      link: { label: "See packs", href: "#packs" },
    },
    {
      id: "insights",
      size: "tall" as const,
      icon: "chart",
      title: "Know your busy hours",
      text: "See which slots fill first and which never do.",
      picture: { alt: "A bar chart of bookings by hour" },
      more: "Weekly email with your busiest times, top classes and clients who haven't been back in a month.",
    },
    {
      id: "team",
      size: "wide" as const,
      icon: "users",
      title: "Room for the whole team",
      text: "Each teacher gets their own calendar and pay report.",
      link: { label: "Team plans", href: "#team" },
    },
    {
      id: "phone",
      icon: "phone",
      title: "Works on a phone",
      text: "Check today's list between classes.",
    },
    {
      id: "payouts",
      size: "wide" as const,
      icon: "refresh",
      title: "Paid every Friday",
      text: "Money from the week lands in your bank, with a statement per class.",
      stat: { value: "2 days", label: "from booking to bank" },
    },
    {
      id: "help",
      icon: "help",
      title: "Real help",
      text: "People answer, even on Saturdays.",
      link: { label: "Contact us", href: "#help" },
    },
  ] satisfies BentoTile[],
};

export default function FeaturesBentoPreview() {
  const d = SAMPLE;
  const [said, setSaid] = useState("");
  return (
    <section className="fl-section" aria-labelledby="features-bento-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="features-bento-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <FeaturesBento label={d.eyebrow} tiles={d.tiles} onOpen={(id) => setSaid(`Showing more about ${d.tiles.find((t) => t.id === id)?.title ?? ""}.`)} />
        <p className="fl-sr" role="status" aria-live="polite">
          {said}
        </p>
      </div>
    </section>
  );
}
