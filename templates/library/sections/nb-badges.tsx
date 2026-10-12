/** @flowcode-library nb-badges · Neobrutal badges (neobrutal) (Small components)
 * Catalog ID: c.badge@neobrutal (component version)
 * Version of: c.badge
 * Function: Loud status pills with an ink border, a hard shadow and a dot.
 * Use it as: import { Badge } from "./badges-status"; <Badge version="neobrutal" tone?="success"|"warning"|"danger"|"info" look?="soft"|"solid">Open</Badge>
 * Look: Uppercase pills with a thick ink border, a hard shadow and a status dot; solid fills with the accent.
 * Tokens: --color-text --color-surface --color-accent --color-on-accent --radius-sm --space-2 --space-4 --space-5 --weight-bold --focus-ring
 * Use cases: availability; order status; counts; labels
 * Jobs to be done: see the state of an item at a glance; spot what needs my attention
 * Keywords: badge, status, pill, neobrutalism
 */
/**
 * Neobrutalist badges: c.badge@neobrutal with this piece's sample content; the implementation lives in the component,
 * in ./badges-status. Uppercase pills with a thick ink border, a hard shadow and a status dot. Use them for class
 * availability, order states or counts.
 * Make it the app's own: replace SAMPLE with the real statuses.
 */
import { Badge } from "./badges-status";

// flowcode:sample
const SAMPLE = {
  title: "Class status",
  badges: [
    { label: "Open", tone: "success" as const },
    { label: "Waitlist", tone: "warning" as const },
    { label: "Full", tone: "danger" as const },
    { label: "New", tone: "info" as const },
  ],
  count: "12 booked",
};

export default function NbBadges() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-nb" aria-labelledby="nb-badges-title">
      <div className="fl-wrap fl-wrap--narrow fl-nb-stack">
        <h2 id="nb-badges-title" className="fl-title">
          {d.title}
        </h2>
        <div className="fl-nb-badges">
          {d.badges.map((b) => (
            <Badge key={b.label} version="neobrutal" tone={b.tone}>
              {b.label}
            </Badge>
          ))}
          <Badge version="neobrutal" look="solid">
            {d.count}
          </Badge>
        </div>
      </div>
    </section>
  );
}
