/** @flowcode-library hero-gradient · Gradient hero (Heroes)
 * Catalog ID: b.hero-gradient (block)
 * Function: The gradient hero block (b.hero-gradient): a dark announcement panel with a gradient phrase in the heading; a link given a note shows it under the buttons instead of navigating.
 * Use it as: import { HeroGradient } from "./hero-gradient"; <HeroGradient id badge announcement={{text,href,note?}} before emphasis after? lede primary={{label,href,note?}} secondary?={{label,href,note?}} />
 * Built from: c.button.primary, c.button.secondary
 * Look: A dark rounded panel, dark in light and dark styles alike; a pill, a large light heading whose emphasized phrase is a gradient, a lede and two buttons.
 * Tokens: --color-accent --color-on-accent --radius-lg --space-3 --space-5 --font-display
 * Use cases: landing page hero; product launch; ai product homepage; new feature announcement; dark mode homepage; saas homepage; developer tool landing
 * Jobs to be done: hear about what's new; understand what the product does; get started right away; learn more before committing
 * Keywords: hero, dark, gradient, announcement, landing
 */
/**
 * Gradient hero: a dark panel with a "New" announcement pill, a light display heading with one phrase in a gradient,
 * a short lede and two actions. Good for a product's front page or the top of a launch page. Make it the app's own:
 * replace SAMPLE with the real announcement, headline and actions; the panel stays dark in light and dark styles.
 * Adapted from FlowCode's own UI (Branding page).
 *
 * How to try it: a link given a note keeps the page still and shows the note in the line under the buttons.
 */
import { useState, type MouseEvent } from "react";
import { Button } from "./buttons-variants";

/** A link; give it a note and a press shows the note instead of leaving the page (for previews). */
type Action = { label: string; href: string; note?: string };

export type HeroGradientProps = {
  /** Used for the heading's id, so the section can be labelled by it. */
  id: string;
  /** The pill's bold tag, such as "New". */
  badge: string;
  announcement: { text: string; href: string; note?: string };
  /** The heading is before + emphasis (in the gradient) + after. */
  before: string;
  emphasis: string;
  after?: string;
  lede: string;
  primary: Action;
  secondary?: Action;
};

export function HeroGradient({ id, badge, announcement, before, emphasis, after, lede, primary, secondary }: HeroGradientProps) {
  const [note, setNote] = useState("");
  const show = (n?: string) => (e: MouseEvent) => {
    if (!n) return;
    e.preventDefault();
    setNote(n);
  };
  return (
    <section className="fl-section" aria-labelledby={`${id}-title`} data-fl="b.hero-gradient">
      <div className="fl-wrap">
        <div className="fl-brd-hero">
          <a className="fl-brd-eyebrow" href={announcement.href} onClick={show(announcement.note)}>
            <b>{badge}</b>
            <span>{announcement.text}</span>
          </a>
          <h1 id={`${id}-title`} className="fl-brd-hero__title">
            {before} <span className="fl-brd-grad">{emphasis}</span>
            {after ? ` ${after}` : ""}
          </h1>
          <p className="fl-brd-hero__lede">{lede}</p>
          <div className="fl-actions" style={{ marginTop: 0 }}>
            <Button variant="primary" href={primary.href} icon="arrow" iconAt="end" onClick={show(primary.note)}>
              {primary.label}
            </Button>
            {secondary ? (
              <Button variant="secondary" href={secondary.href} onClick={show(secondary.note)}>
                {secondary.label}
              </Button>
            ) : null}
          </div>
          <p className="fl-brd-hero__note" role="status" aria-live="polite">
            {note}
          </p>
        </div>
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE: HeroGradientProps = {
  id: "hero-gradient",
  badge: "New",
  announcement: { text: "Book a whole term of classes in one go", href: "#news", note: "Term booking: pick a class once and every week is held for you." },
  before: "Turn a free evening into a",
  emphasis: "class you'll love",
  lede: "Find small-group workshops near you, see which seats are left and book in under a minute. No account needed to look around.",
  primary: { label: "Find a class", href: "#classes", note: "Showing classes near you…" },
  secondary: { label: "See how it works", href: "#how", note: "Three steps: choose, book, turn up." },
};

export default function HeroGradientPreview() {
  return <HeroGradient {...SAMPLE} />;
}
