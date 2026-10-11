/** @flowcode-library features-grid · Feature grid (Features)
 * Catalog ID: b.features-grid (block)
 * Function: The features grid block (b.features-grid): benefit cards with an icon, a title and a sentence.
 * Use it as: import { FeaturesGrid } from "./features-grid"; <FeaturesGrid title lede? eyebrow? id? items={[{icon,title,text}]} />
 * Look: A centered eyebrow, title and lede above three columns of bordered cards, each with a tinted icon square, a bold title and a muted sentence.
 * Tokens: --space-6 --space-9 --type-h3-size --color-surface --color-border --color-accent --color-text-muted
 * Use cases: feature overview; benefits section; services list; product capabilities; why choose us; agency services; platform highlights; integrations overview
 * Jobs to be done: see what the product can do; check it covers my needs; compare benefits at a glance; understand what services are offered
 * Keywords: features, benefits, services, grid
 */
/**
 * Features: icon grid. Six benefits as cards, each with an icon, a short title and one sentence. The default way to
 * explain what a product does. Make it the app's own: replace SAMPLE with the PRD's real capabilities (3 or 6 read
 * best); pick an icon from icons.tsx that fits each one.
 */
import { Icon } from "./icons";

export type FeaturesGridProps = {
  /** Anchor for the section and base of the heading's id. "features" when left out. */
  id?: string;
  eyebrow?: string;
  title: string;
  lede?: string;
  /** Each feature: an icon name from ./icons, a short title and one sentence. */
  items: { icon: string; title: string; text: string }[];
};

export function FeaturesGrid({ id = "features", eyebrow, title, lede, items }: FeaturesGridProps) {
  return (
    <section className="fl-section" id={id} aria-labelledby={`${id}-title`} data-fl="b.features-grid">
      <div className="fl-wrap">
        <div className="fl-head fl-head--center">
          {eyebrow ? <span className="fl-eyebrow">{eyebrow}</span> : null}
          <h2 id={`${id}-title`} className="fl-title">
            {title}
          </h2>
          {lede ? <p className="fl-lede">{lede}</p> : null}
        </div>
        <ul className="fl-grid fl-grid--3" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {items.map((f) => (
            <li key={f.title} className="fl-card">
              <span className="fl-icon">
                <Icon name={f.icon} />
              </span>
              <h3>{f.title}</h3>
              <p className="fl-text">{f.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE: FeaturesGridProps = {
  eyebrow: "Why it works",
  title: "Everything a busy studio needs, nothing it doesn't",
  lede: "Six things that save you an hour a day.",
  items: [
    { icon: "clock", title: "Book in seconds", text: "Clients see real availability and pick a time without a back-and-forth." },
    { icon: "bolt", title: "Automatic reminders", text: "A reminder the day before cuts no-shows without you lifting a finger." },
    { icon: "shield", title: "Deposits up front", text: "Hold a slot with a small deposit, refunded if you cancel." },
    { icon: "users", title: "Your whole team", text: "Each person keeps their own calendar; you see everyone at a glance." },
    { icon: "chart", title: "See what's busy", text: "Know your fullest days and quietest hours, week by week." },
    { icon: "globe", title: "Works anywhere", text: "Phone, tablet or laptop: the same calendar, always up to date." },
  ],
};

export default function FeaturesGridPreview() {
  return <FeaturesGrid {...SAMPLE} />;
}
