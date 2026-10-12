/** @flowcode-library hero-centered · Centered hero (Heroes)
 * Catalog ID: b.hero-centered (block)
 * Function: The centered hero block (b.hero-centered): a what's-new pill, title, lede, two actions, small print and an optional product picture as children.
 * Use it as: import { HeroCentered } from "./hero-centered"; <HeroCentered id title lede primary={{label,href}} secondary?={{label,href}} kicker?={{tag,text,href}} eyebrow? list?={string[]} actionsExtra?={ReactNode} note? background?="plain"|"grid">{product picture?}</HeroCentered>
 * Built from: c.button.primary, c.button.secondary
 * Look: Centered words over a centered product picture, with an optional faint grid behind; the pill, title, lede, buttons and small print stack in one column.
 * Tokens: --space-5 --space-7 --space-9 --type-display-size --text-lg --color-surface --color-border --color-text-muted --color-accent --color-on-accent
 * Use cases: landing page hero; product launch; app homepage; event announcement; coming soon page; campaign page; startup homepage
 * Jobs to be done: understand the main promise quickly; see what the product looks like; get started right away; learn more before committing
 * Keywords: hero, landing, launch, app
 */
/**
 * Hero: centered. One bold promise in the middle with a wide product picture underneath. Good for launches and apps
 * with one clear job. Make it the app's own: replace SAMPLE; swap the media for a real screenshot (with alt text).
 */
import type { ReactNode } from "react";
import { Button } from "./buttons-variants";
import { Badge } from "./badges-status";
import { Tick } from "./icons";

type Link = { label: string; href: string };

export type HeroCenteredProps = {
  /** Used for the heading's id, so the section can be labelled by it. */
  id: string;
  title: string;
  lede: string;
  primary: Link;
  secondary?: Link;
  kicker?: { tag: string; text: string; href: string };
  /** A short label above the title. */
  eyebrow?: string;
  /** A short checklist under the lede. */
  list?: string[];
  /** Shown in the actions row after the buttons: an offer badge, a small note. */
  actionsExtra?: ReactNode;
  /** Small print under the buttons: the trial, the price, what's not needed. */
  note?: string;
  background?: "plain" | "grid";
  /** The product picture under the words. Leave it out for a words-only hero. */
  children?: ReactNode;
};

export function HeroCentered({ id, title, lede, primary, secondary, kicker, eyebrow, list, actionsExtra, note, background = "plain", children }: HeroCenteredProps) {
  const cls = `fl-hero-centered${background === "grid" ? " fl-bg-grid" : ""}${children ? "" : " fl-hero-centered--no-media"}`;
  return (
    <section className={cls} aria-labelledby={`${id}-title`} data-fl="b.hero-centered">
      <div className="fl-wrap">
        <div className="fl-head fl-head--center">
          {kicker ? (
            <a className="fl-hero-kicker" href={kicker.href}>
              <b>{kicker.tag}</b>
              {kicker.text}
            </a>
          ) : null}
          {eyebrow ? <span className="fl-eyebrow">{eyebrow}</span> : null}
          <h1 id={`${id}-title`} className="fl-title fl-title--xl">
            {title}
          </h1>
          <p className="fl-lede">{lede}</p>
          {list?.length ? (
            <ul className="fl-checks" style={{ textAlign: "left" }}>
              {list.map((item) => (
                <li key={item}>
                  <Tick />
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="fl-actions">
            <Button variant="primary" href={primary.href} icon="arrow" iconAt="end">
              {primary.label}
            </Button>
            {secondary ? (
              <Button variant="secondary" href={secondary.href}>
                {secondary.label}
              </Button>
            ) : null}
            {actionsExtra}
          </div>
          {note ? <p className="fl-meta">{note}</p> : null}
        </div>
        {children ? <div className="fl-hero-centered__media">{children}</div> : null}
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE = {
  id: "hero-centered",
  kicker: { tag: "New", text: "Shared lists", href: "#start" },
  title: "Plan the week together, in one calm place",
  lede: "Meals, chores and plans for the whole household, updated for everyone as soon as anyone changes them.",
  primary: { label: "Try it free", href: "#start" },
  secondary: { label: "Watch a 2-minute tour", href: "#tour" },
  media: "The shared weekly plan on a phone and a laptop",
};

export default function HeroCenteredPreview() {
  const d = SAMPLE;
  return (
    <>
      <HeroCentered id={d.id} kicker={d.kicker} title={d.title} lede={d.lede} primary={d.primary} secondary={d.secondary}>
        <div className="fl-media fl-media--wide" role="img" aria-label={d.media}>
          {d.media}
        </div>
      </HeroCentered>
      {/* With an eyebrow, a checklist and an offer badge after the buttons. */}
      <HeroCentered
        id="hero-centered-list"
        eyebrow="Spring offer"
        title="Start the week with a plan"
        lede="Everything the household needs, in one place."
        list={["Free for 14 days", "No card needed", "Cancel any time"]}
        primary={{ label: "Try it free", href: "#start" }}
        actionsExtra={<Badge tone="success">20% off the first year</Badge>}
      />
    </>
  );
}
