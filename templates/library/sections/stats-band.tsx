/** @flowcode-library stats-band · Stats band (Stats)
 * Catalog ID: b.stats-band (block)
 * Function: The stats band block (b.stats-band): a heading and up to four big numbers on the accent color.
 * Use it as: import { StatsBand } from "./stats-band"; <StatsBand id title eyebrow? lede? tone?="accent"|"tint"|"plain" stats={[{value,label}]} />
 * Look: A solid accent band; a heading, then four bold numbers in a row (two by two on a phone) with a small label under each. The band can instead be a soft tint or plain.
 * Tokens: --color-accent --color-on-accent --space-6 --text-2xl --font-display --color-surface-sunken
 * Use cases: results section; company milestones; impact numbers; social proof metrics; about us figures; nonprofit impact; growth highlights
 * Jobs to be done: see the results in numbers; judge how established the company is; trust the product with proof; understand the scale of impact
 * Keywords: stats, numbers, results, metrics
 */
/**
 * Stats: band. Four numbers on the accent color, a strong break between sections. Make it the app's own: replace
 * SAMPLE with numbers the PRD actually gives; never invent results.
 */
export type StatsBandProps = {
  /** Used for the heading's id, so the section can be labelled by it. */
  id: string;
  title: string;
  /** A short label above the title. */
  eyebrow?: string;
  /** One sentence under the title. */
  lede?: string;
  /** The band's background: accent (default), a soft tint, or plain page color. */
  tone?: "plain" | "tint" | "accent";
  /** Up to four numbers; each is a bold value and what it counts. */
  stats: { value: string; label: string }[];
};

const TONE: Record<"plain" | "tint" | "accent", string> = {
  plain: "fl-section",
  tint: "fl-section fl-section--tint",
  accent: "fl-section fl-section--accent",
};

export function StatsBand({ id, title, eyebrow, lede, tone = "accent", stats }: StatsBandProps) {
  return (
    <section className={TONE[tone]} aria-labelledby={`${id}-title`} data-fl="b.stats-band">
      <div className="fl-wrap">
        <div className="fl-head" style={{ marginBottom: "var(--space-6)" }}>
          {eyebrow ? <span className="fl-eyebrow">{eyebrow}</span> : null}
          <h2 id={`${id}-title`} className="fl-title fl-title--md">
            {title}
          </h2>
          {lede ? <p className="fl-lede">{lede}</p> : null}
        </div>
        <dl className="fl-grid fl-grid--4" style={{ margin: 0 }}>
          {stats.map((s) => (
            <div key={s.label} className="fl-stat">
              {/* The label comes first for screen readers; the number shows first. */}
              <dt style={{ order: 2 }}>
                <span>{s.label}</span>
              </dt>
              <dd style={{ margin: 0 }}>
                <strong>{s.value}</strong>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE: StatsBandProps = {
  id: "stats-band",
  title: "Studios run calmer with it",
  stats: [
    { value: "2,400", label: "bookings a week" },
    { value: "38%", label: "fewer no-shows" },
    { value: "6 hrs", label: "saved each week" },
    { value: "98%", label: "would recommend it" },
  ],
};

export default function StatsBandPreview() {
  return (
    <>
      <StatsBand {...SAMPLE} />
      {/* The tint tone, with a label and a sentence under the title. */}
      <StatsBand {...SAMPLE} id="stats-band-tint" tone="tint" eyebrow="This year" lede="Numbers from studios using it every day." />
    </>
  );
}
