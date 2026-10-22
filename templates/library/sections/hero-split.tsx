/** @flowcode-library hero-split · Split hero (Heroes)
 * Catalog ID: b.hero-split (block)
 * Function: The split hero block (b.hero-split): promise and actions on the left, a product picture on the right.
 * Use it as: import { HeroSplit } from "./hero-split"; <HeroSplit id title lede primary?={{label,href}} secondary?={{label,href}} eyebrow? note? list?={string[]} actionsExtra?={ReactNode} media?={{alt,src?}} aside?={ReactNode} /> (aside, e.g. a sign-up form card, replaces the picture column)
 * Built from: c.button.primary, c.button.secondary, c.media-frame
 * Look: Words stacked on the left (small label, display title, lede, two buttons, small print; optionally a short checklist and an extra badge by the buttons) beside a picture on the right. A form card or other content can stand in for the picture.
 * Tokens: --space-3 --space-8 --type-display-size --text-lg --color-accent --color-text-muted --color-border --radius-lg
 * Use cases: landing page hero; product launch; homepage intro; saas homepage; app download page; feature announcement; service landing page
 * Jobs to be done: understand what the product does; see the product before signing up; start a free trial; decide if this is for me
 * Keywords: hero, landing, header, product
 */
/**
 * Hero: split. Promise and actions on the left, a picture of the product on the right. The default for products and
 * services. Make it the app's own: replace SAMPLE; give media a real screenshot or photo (src, with alt text); keep
 * one primary action.
 * Motion: the words rise in once, in order, and the picture or form settles beside them; with reduced motion or animation off they are simply there.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "./buttons-variants";
import { MediaFrame } from "./media-frames";
import { Badge } from "./badges-status";
import { Card } from "./cards-variants";
import { TextField } from "./text-fields-states";
import { Tick } from "./icons";

type Link = { label: string; href: string };

const still = () =>
  typeof window === "undefined" ||
  document.documentElement.dataset.motion === "off" ||
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Entrance once: "wait" until the section is in view, then "in". Already on screen plays at once; without an observer,
 * or with motion off, it is simply shown; a timeout never leaves it hidden. */
function useEnterOnce<T extends Element>() {
  const ref = useRef<T>(null);
  const [state, setState] = useState<"idle" | "wait" | "in" | "done">("idle");
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window) || still()) return;
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
  // Once it has played, drop the entrance classes, so content never depends on an animation finishing (a page that
  // isn't painting freezes animations).
  useEffect(() => {
    if (state !== "in") return;
    const t = setTimeout(() => setState("done"), 1200);
    return () => clearTimeout(t);
  }, [state]);
  return [ref, state] as const;
}

const enterClass = (state: "idle" | "wait" | "in" | "done") => (state === "wait" ? " is-waiting" : state === "in" ? " is-entering" : "");


export type HeroSplitProps = {
  /** Used for the heading's id, so the section can be labelled by it. */
  id: string;
  title: string;
  lede: string;
  /** The main action. Leave it out when the aside is the call to action (a sign-up form beside the words). */
  primary?: Link;
  secondary?: Link;
  /** A short label above the title. */
  eyebrow?: string;
  /** Small print under the buttons. */
  note?: string;
  /** The picture on the right. Without src a labelled placeholder shows the alt text. */
  media?: { alt: string; src?: string };
  /** Replaces the picture column with any content, e.g. a sign-up form card. */
  aside?: ReactNode;
  /** A short checklist under the lede. */
  list?: string[];
  /** Shown in the actions row after the buttons: an offer badge, a small note. */
  actionsExtra?: ReactNode;
};

export function HeroSplit({ id, title, lede, primary, secondary, eyebrow, note, media, aside, list, actionsExtra }: HeroSplitProps) {
  const [ref, enter] = useEnterOnce<HTMLElement>();
  return (
    <section ref={ref} className={`fl-section fl-hx${enterClass(enter)}`} aria-labelledby={`${id}-title`} data-fl="b.hero-split">
      <div className="fl-wrap fl-split">
        <div className="fl-head fl-hx-seq" style={{ marginBottom: 0 }}>
          {eyebrow ? <span className="fl-eyebrow">{eyebrow}</span> : null}
          <h1 id={`${id}-title`} className="fl-title fl-title--xl">
            {title}
          </h1>
          <p className="fl-lede">{lede}</p>
          {list?.length ? (
            <ul className="fl-checks">
              {list.map((item) => (
                <li key={item}>
                  <Tick />
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
          {primary || secondary || actionsExtra ? (
            <div className="fl-actions" style={{ marginTop: "var(--space-3)" }}>
              {primary ? (
                <Button variant="primary" href={primary.href}>
                  {primary.label}
                </Button>
              ) : null}
              {secondary ? (
                <Button variant="secondary" href={secondary.href}>
                  {secondary.label}
                </Button>
              ) : null}
              {actionsExtra}
            </div>
          ) : null}
          {note ? <p className="fl-note">{note}</p> : null}
        </div>
        {aside ? (
          aside
        ) : media?.src ? (
          <MediaFrame ratio="4-3" src={media.src} alt={media.alt} />
        ) : media ? (
          <div className="fl-media" role="img" aria-label={media.alt}>
            {media.alt}
          </div>
        ) : null}
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE: HeroSplitProps = {
  id: "hero-split",
  eyebrow: "For small studios",
  title: "Bookings that run themselves",
  lede: "Clients pick a time, pay a deposit and get reminders. You get your evenings back.",
  primary: { label: "Start free", href: "#start" },
  secondary: { label: "See how it works", href: "#how" },
  note: "Free for 14 days. No card needed.",
  media: { alt: "Screenshot of the week calendar with three bookings" },
};

export default function HeroSplitPreview() {
  return (
    <>
      <HeroSplit {...SAMPLE} />
      {/* With a checklist, an offer badge and a form card beside the words instead of a picture. */}
      <HeroSplit
        id="hero-split-form"
        title="Book your first class"
        lede="Tell us where to send your confirmation."
        list={["No card needed", "Cancel any time", "Your first class is free"]}
        primary={{ label: "Reserve a seat", href: "#reserve" }}
        actionsExtra={<Badge tone="success">Free this month</Badge>}
        aside={
          <Card variant="plain">
            <form className="fl-head" style={{ marginBottom: 0 }} onSubmit={(e) => e.preventDefault()}>
              <label htmlFor="hero-split-email" className="fl-meta">
                Your email
              </label>
              <TextField id="hero-split-email" type="email" autoComplete="email" required />
              <Button variant="primary" type="submit">
                Send my confirmation
              </Button>
            </form>
          </Card>
        }
      />
    </>
  );
}
