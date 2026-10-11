/** @flowcode-library pricing-tiers · Three pricing tiers (Pricing)
 * Catalog ID: b.pricing-tiers (block)
 * Function: A pricing section of plan cards side by side with one plan featured.
 * Use it as: import { PricingTiers } from "./pricing-tiers"; <PricingTiers eyebrow? title lede plans={[{name,price,period,text,features:string[],action,href?,featured?}]} popularLabel? />
 * Built from: c.card.plain, c.badge.status, c.button.primary, c.button.secondary
 * Look: A centered heading over a row of bordered plan cards; the featured one has an accent border and a Most popular pill, a big price, a tick list and a full button.
 * Tokens: --space-4 --space-6 --radius-lg --color-accent --color-border --color-text-muted
 * Use cases: pricing page; subscription plans; plan comparison; membership tiers; saas pricing; service packages; course pricing
 * Jobs to be done: find the right plan for my budget; compare plans side by side; see what the popular plan includes; choose a plan and sign up
 * Keywords: pricing, plans, subscription, tiers
 */
/**
 * Pricing: three tiers. The middle plan is highlighted as the usual choice. Make it the app's own: replace SAMPLE
 * with the PRD's real plans and prices (2 or 3 plans read best); keep one plan featured.
 */
import { Tick } from "./icons";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Card } from "./cards-variants";

export type PricingPlan = {
  name: string;
  /** The amount with its currency sign, such as "$19". */
  price: string;
  /** What the price is per, such as "/month". */
  period: string;
  text: string;
  features: string[];
  /** The button label, such as "Choose Studio". */
  action: string;
  /** Where the button goes; "#start" when left out. */
  href?: string;
  /** Mark one plan as the usual choice: accent border, a pill, the primary button. */
  featured?: boolean;
};

export type PricingTiersProps = {
  eyebrow?: string;
  title: string;
  lede: string;
  plans: PricingPlan[];
  /** The pill on the featured plan; "Most popular" when left out. */
  popularLabel?: string;
};

export function PricingTiers({ eyebrow, title, lede, plans, popularLabel = "Most popular" }: PricingTiersProps) {
  return (
    <section className="fl-section" id="pricing" aria-labelledby="pricing-tiers-title" data-fl="b.pricing-tiers">
      <div className="fl-wrap">
        <div className="fl-head fl-head--center">
          {eyebrow ? <span className="fl-eyebrow">{eyebrow}</span> : null}
          <h2 id="pricing-tiers-title" className="fl-title">
            {title}
          </h2>
          <p className="fl-lede">{lede}</p>
        </div>
        <ul className="fl-grid fl-grid--3" style={{ margin: 0, padding: 0, listStyle: "none", alignItems: "start" }}>
          {plans.map((p) => (
            <li key={p.name} style={{ display: "grid" }}>
              <Card variant="surface" className={p.featured ? "fl-card--featured" : undefined} style={{ gap: "var(--space-4)" }}>
                {p.featured ? (
                  <Badge look="soft" tone="info" className="fl-badge">
                    {popularLabel}
                  </Badge>
                ) : null}
                <h3>{p.name}</h3>
                <p className="fl-price">
                  <strong>{p.price}</strong>
                  <span className="fl-meta">{p.period}</span>
                </p>
                <p className="fl-text">{p.text}</p>
                <ul className="fl-checks">
                  {p.features.map((f) => (
                    <li key={f}>
                      <Tick />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button variant={p.featured ? "primary" : "secondary"} href={p.href ?? "#start"}>
                  {p.action}
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE: PricingTiersProps = {
  eyebrow: "Pricing",
  title: "Simple plans that grow with you",
  lede: "Start free. Upgrade when you need more.",
  plans: [
    { name: "Starter", price: "$0", period: "/month", text: "For trying it out.", features: ["1 calendar", "50 bookings a month", "Email reminders"], action: "Start free", featured: false },
    { name: "Studio", price: "$19", period: "/month", text: "For busy solo studios.", features: ["3 calendars", "Unlimited bookings", "Text reminders", "Online deposits"], action: "Choose Studio", featured: true },
    { name: "Team", price: "$49", period: "/month", text: "For teams of up to 10.", features: ["Unlimited calendars", "Everything in Studio", "Team roles", "Priority help"], action: "Choose Team", featured: false },
  ],
};

export default function PricingTiersPreview() {
  return <PricingTiers {...SAMPLE} />;
}
