/** @flowcode-library cta-banner · Call-to-action banner (Calls to action)
 * Catalog ID: b.cta-banner (block)
 * Function: The call-to-action banner block (b.cta-banner): a closing invitation on the accent color.
 * Use it as: import { CtaBanner } from "./cta-banner"; <CtaBanner id title lede? primary={{label,href}} secondary?={{label,href}} />
 * Built from: c.button.on-accent, c.button.ghost-on-accent
 * Look: A solid accent band with centered words: a heading, a line of text and a filled button beside an outlined one.
 * Tokens: --color-accent --color-on-accent --space-3 --space-8
 * Use cases: closing call to action; sign up prompt; free trial invite; demo request; end of page invite; download prompt; join waitlist
 * Jobs to be done: get started now; sign up for a free trial; take the next step; book a demo
 * Keywords: cta, call to action, sign up, closing
 */
/**
 * Call to action: banner. A closing invitation on the accent color with one main action. Usually just above the
 * footer. Make it the app's own: replace SAMPLE; keep it to one sentence and one primary action.
 */
import { Button } from "./buttons-variants";

type Link = { label: string; href: string };

export type CtaBannerProps = {
  /** Used for the heading's id, so the section can be labelled by it. */
  id: string;
  title: string;
  lede?: string;
  primary: Link;
  secondary?: Link;
};

export function CtaBanner({ id, title, lede, primary, secondary }: CtaBannerProps) {
  return (
    <section className="fl-section fl-section--accent" aria-labelledby={`${id}-title`} data-fl="b.cta-banner">
      <div className="fl-wrap fl-head fl-head--center" style={{ marginBottom: 0 }}>
        <h2 id={`${id}-title`} className="fl-title">
          {title}
        </h2>
        {lede ? <p className="fl-lede">{lede}</p> : null}
        <div className="fl-actions" style={{ marginTop: "var(--space-3)" }}>
          <Button variant="on-accent" href={primary.href}>
            {primary.label}
          </Button>
          {secondary ? (
            <Button variant="ghost-on-accent" href={secondary.href}>
              {secondary.label}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE: CtaBannerProps = {
  id: "cta-banner",
  title: "Ready to get your evenings back?",
  lede: "Set up your calendar in ten minutes. Free for 14 days.",
  primary: { label: "Start free", href: "#start" },
  secondary: { label: "Talk to us", href: "#contact" },
};

export default function CtaBannerPreview() {
  return <CtaBanner {...SAMPLE} />;
}
