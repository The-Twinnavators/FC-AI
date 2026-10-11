/** @flowcode-library hero-stats · Hero with proof (Heroes)
 * Catalog ID: b.hero-stats (block)
 * Function: The hero-with-proof block (b.hero-stats): promise and action beside two to four stat cards.
 * Use it as: import { HeroStats } from "./hero-stats"; <HeroStats id title lede primary={{label,href}} stats={[{value,label}]} />
 * Built from: c.button.primary, c.card.plain
 * Look: A tinted band; words and one button on the left, a stack of cards on the right, each with a bold number and what it counts.
 * Tokens: --space-3 --space-5 --space-6 --text-2xl --font-display --color-surface-sunken --color-border --color-text-muted
 * Use cases: landing page hero; results-driven homepage; agency homepage; fundraising page; b2b product homepage; case study intro; nonprofit impact page
 * Jobs to be done: see proof the product works; judge whether the claims are credible; get started with confidence; book a demo with the team
 * Keywords: hero, landing, results, stats
 */
/**
 * Hero: with proof. Promise, actions and three numbers that back it up, on a tinted band. Good when the product has
 * real results to show. Make it the app's own: replace SAMPLE; only use numbers the PRD actually gives.
 */
import { Button } from "./buttons-variants";
import { Card } from "./cards-variants";

export type HeroStatsProps = {
  /** Used for the heading's id, so the section can be labelled by it. */
  id: string;
  title: string;
  lede: string;
  primary: { label: string; href: string };
  /** Two to four numbers; each is a bold value and what it counts. */
  stats: { value: string; label: string }[];
};

export function HeroStats({ id, title, lede, primary, stats }: HeroStatsProps) {
  return (
    <section className="fl-section fl-section--tint" aria-labelledby={`${id}-title`} data-fl="b.hero-stats">
      <div className="fl-wrap fl-split">
        <div className="fl-head" style={{ marginBottom: 0 }}>
          <h1 id={`${id}-title`} className="fl-title fl-title--xl">
            {title}
          </h1>
          <p className="fl-lede">{lede}</p>
          <div className="fl-actions" style={{ marginTop: "var(--space-3)" }}>
            <Button variant="primary" href={primary.href}>
              {primary.label}
            </Button>
          </div>
        </div>
        <dl className="fl-grid" style={{ margin: 0 }}>
          {stats.map((s) => (
            <Card key={s.label} variant="surface" className="fl-stat">
              <dt className="fl-sr">{s.label}</dt>
              <dd style={{ margin: 0, display: "grid", gap: "var(--space-1)" }}>
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </dd>
            </Card>
          ))}
        </dl>
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE: HeroStatsProps = {
  id: "hero-stats",
  title: "Your money, finally organized",
  lede: "Every account, bill and goal in one view, with a plan that adjusts when life does.",
  primary: { label: "Get started", href: "#start" },
  stats: [
    { value: "12 min", label: "to set up" },
    { value: "3 accounts", label: "linked on average" },
    { value: "4.8 / 5", label: "from early users" },
  ],
};

export default function HeroStatsPreview() {
  return <HeroStats {...SAMPLE} />;
}
