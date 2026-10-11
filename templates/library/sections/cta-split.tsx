/** @flowcode-library cta-split · Call-to-action card (Calls to action)
 * Catalog ID: b.cta-split (block)
 * Function: The call-to-action card block (b.cta-split): an invitation with one action and a picture, softer than the banner.
 * Use it as: import { CtaSplit } from "./cta-split"; <CtaSplit id title lede primary={{label,href}} media={{alt,src?}} />
 * Built from: c.card.plain, c.button.primary, c.media-frame
 * Look: One bordered card across the page: words and a button on the left, a wide picture on the right.
 * Tokens: --space-3 --space-7 --space-8 --color-surface --color-border --radius-lg
 * Use cases: trial invite; data import prompt; upgrade prompt; download app; demo request; promotional offer; migration invite
 * Jobs to be done: start a free trial; bring my data over easily; try the product with my own work; take the next step
 * Keywords: cta, call to action, import, trial
 */
/**
 * Call to action: split card. An invitation in a card with a picture beside it; softer than the banner. Make it the
 * app's own: replace SAMPLE and give media a real image (src, with alt text).
 */
import { Button } from "./buttons-variants";
import { Card } from "./cards-variants";
import { MediaFrame } from "./media-frames";

export type CtaSplitProps = {
  /** Used for the heading's id, so the section can be labelled by it. */
  id: string;
  title: string;
  lede: string;
  primary: { label: string; href: string };
  /** The picture beside the words. Without src a labelled placeholder shows the alt text. */
  media: { alt: string; src?: string };
};

export function CtaSplit({ id, title, lede, primary, media }: CtaSplitProps) {
  return (
    <section className="fl-section" aria-labelledby={`${id}-title`} data-fl="b.cta-split">
      <div className="fl-wrap">
        <Card variant="surface" className="fl-split" style={{ padding: "var(--space-7)" }}>
          <div className="fl-head" style={{ marginBottom: 0 }}>
            <h2 id={`${id}-title`} className="fl-title fl-title--md">
              {title}
            </h2>
            <p className="fl-text">{lede}</p>
            <div className="fl-actions" style={{ marginTop: "var(--space-3)" }}>
              <Button variant="primary" href={primary.href}>
                {primary.label}
              </Button>
            </div>
          </div>
          {media.src ? (
            <MediaFrame ratio="16-9" src={media.src} alt={media.alt} />
          ) : (
            <div className="fl-media fl-media--wide" role="img" aria-label={media.alt}>
              {media.alt}
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE: CtaSplitProps = {
  id: "cta-split",
  title: "See it with your own bookings",
  lede: "Import your calendar and see next week laid out in minutes.",
  primary: { label: "Import my calendar", href: "#start" },
  media: { alt: "Next week's bookings imported into the calendar" },
};

export default function CtaSplitPreview() {
  return <CtaSplit {...SAMPLE} />;
}
