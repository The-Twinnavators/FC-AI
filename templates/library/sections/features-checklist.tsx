/** @flowcode-library features-checklist · Feature checklist (Features)
 * Catalog ID: b.features-checklist (block)
 * Function: The feature checklist block (b.features-checklist): a heading beside a two-column list of what is included.
 * Use it as: import { FeaturesChecklist } from "./features-checklist"; <FeaturesChecklist title lede? items={["Unlimited bookings", ...]} />
 * Look: A tinted band with the heading at the left and a two-column list of accent ticks with short labels at the right.
 * Tokens: --space-4 --space-6 --color-surface-sunken --color-accent --color-text-muted
 * Use cases: what's included; plan features; membership benefits; package contents; service inclusions; course syllabus; subscription perks
 * Jobs to be done: see everything that's included; check a must-have feature is covered; know what i get for the price; decide whether to sign up
 * Keywords: features, included, checklist, plan
 */
/**
 * Features: checklist. A heading on one side, a two-column list of what's included on the other. Compact; good
 * below a hero or near pricing. Make it the app's own: replace SAMPLE with the real list (6 to 10 items).
 */
import { Tick } from "./icons";

export type FeaturesChecklistProps = {
  title: string;
  lede?: string;
  /** What's included, one short line each (6 to 10 read best). */
  items: string[];
};

export function FeaturesChecklist({ title, lede, items }: FeaturesChecklistProps) {
  return (
    <section className="fl-section fl-section--tint" aria-labelledby="features-checklist-title" data-fl="b.features-checklist">
      <div className="fl-wrap fl-split fl-split--start">
        <div className="fl-head" style={{ marginBottom: 0 }}>
          <h2 id="features-checklist-title" className="fl-title">
            {title}
          </h2>
          {lede ? <p className="fl-lede">{lede}</p> : null}
        </div>
        <ul className="fl-checks fl-grid--2" style={{ display: "grid", gap: "var(--space-4) var(--space-6)" }}>
          {items.map((item) => (
            <li key={item}>
              <Tick />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE: FeaturesChecklistProps = {
  title: "Included on every plan",
  lede: "No add-ons, no surprise fees.",
  items: ["Unlimited bookings", "Reminders by email and text", "Online deposits", "Team calendars", "Holiday and break blocking", "Weekly summary", "Export to your calendar", "Help from a real person"],
};

export default function FeaturesChecklistPreview() {
  return <FeaturesChecklist {...SAMPLE} />;
}
