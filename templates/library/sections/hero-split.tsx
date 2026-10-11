/** @flowcode-library hero-split · Split hero (Heroes)
 * Catalog ID: b.hero-split (block)
 * Function: The split hero block (b.hero-split): promise and actions on the left, a product picture on the right.
 * Use it as: import { HeroSplit } from "./hero-split"; <HeroSplit id title lede primary={{label,href}} secondary?={{label,href}} eyebrow? note? media={{alt,src?}} />
 * Built from: c.button.primary, c.button.secondary, c.media-frame
 * Look: Words stacked on the left (small label, display title, lede, two buttons, small print) beside a picture on the right.
 * Tokens: --space-3 --space-8 --type-display-size --text-lg --color-accent --color-text-muted --color-border --radius-lg
 * Use cases: landing page hero; product launch; homepage intro; saas homepage; app download page; feature announcement; service landing page
 * Jobs to be done: understand what the product does; see the product before signing up; start a free trial; decide if this is for me
 * Keywords: hero, landing, header, product
 */
/**
 * Hero: split. Promise and actions on the left, a picture of the product on the right. The default for products and
 * services. Make it the app's own: replace SAMPLE; give media a real screenshot or photo (src, with alt text); keep
 * one primary action.
 */
import { Button } from "./buttons-variants";
import { MediaFrame } from "./media-frames";

type Link = { label: string; href: string };

export type HeroSplitProps = {
  /** Used for the heading's id, so the section can be labelled by it. */
  id: string;
  title: string;
  lede: string;
  primary: Link;
  secondary?: Link;
  /** A short label above the title. */
  eyebrow?: string;
  /** Small print under the buttons. */
  note?: string;
  /** The picture on the right. Without src a labelled placeholder shows the alt text. */
  media: { alt: string; src?: string };
};

export function HeroSplit({ id, title, lede, primary, secondary, eyebrow, note, media }: HeroSplitProps) {
  return (
    <section className="fl-section" aria-labelledby={`${id}-title`} data-fl="b.hero-split">
      <div className="fl-wrap fl-split">
        <div className="fl-head" style={{ marginBottom: 0 }}>
          {eyebrow ? <span className="fl-eyebrow">{eyebrow}</span> : null}
          <h1 id={`${id}-title`} className="fl-title fl-title--xl">
            {title}
          </h1>
          <p className="fl-lede">{lede}</p>
          <div className="fl-actions" style={{ marginTop: "var(--space-3)" }}>
            <Button variant="primary" href={primary.href}>
              {primary.label}
            </Button>
            {secondary ? (
              <Button variant="secondary" href={secondary.href}>
                {secondary.label}
              </Button>
            ) : null}
          </div>
          {note ? <p className="fl-note">{note}</p> : null}
        </div>
        {media.src ? (
          <MediaFrame ratio="4-3" src={media.src} alt={media.alt} />
        ) : (
          <div className="fl-media" role="img" aria-label={media.alt}>
            {media.alt}
          </div>
        )}
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
  return <HeroSplit {...SAMPLE} />;
}
