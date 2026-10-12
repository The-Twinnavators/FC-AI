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
 */
import type { ReactNode } from "react";
import { Button } from "./buttons-variants";
import { MediaFrame } from "./media-frames";
import { Badge } from "./badges-status";
import { Card } from "./cards-variants";
import { TextField } from "./text-fields-states";
import { Tick } from "./icons";

type Link = { label: string; href: string };

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
  return (
    <section className="fl-section" aria-labelledby={`${id}-title`} data-fl="b.hero-split">
      <div className="fl-wrap fl-split">
        <div className="fl-head" style={{ marginBottom: 0 }}>
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
