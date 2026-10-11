/** @flowcode-library pricing-toggle · Monthly or yearly pricing (Pricing)
 * Catalog ID: b.pricing-toggle (block)
 * Function: A pricing section with a Monthly / Yearly switch that changes every plan's price.
 * Use it as: import { PricingToggle } from "./pricing-toggle"; <PricingToggle title saving plans={[{name,monthly,yearly,text,features:string[],href?,featured?}]} /> (yearly shown first)
 * Built from: c.card.plain, c.button.primary, c.button.secondary
 * Look: A centered heading and a two-part switch over two plan cards; the price and its /month or /year update when the switch moves.
 * Tokens: --space-4 --space-6 --radius-lg --color-accent --color-border --color-text-muted
 * Use cases: pricing page; subscription plans; monthly vs yearly billing; membership pricing; saas pricing; annual discount offer
 * Jobs to be done: see how much i save yearly; pick monthly or yearly billing; choose between two plans; find the right plan for my budget
 * Keywords: pricing, plans, yearly, monthly, subscription
 */
/**
 * Pricing: monthly or yearly. Two plans with a switch that shows the yearly saving. Good for subscriptions. Make it
 * the app's own: replace SAMPLE with real plans and both prices; the switch keeps its state on the page.
 */
import { useState } from "react";
import { Tick } from "./icons";
import { Button } from "./buttons-variants";
import { Card } from "./cards-variants";

export type TogglePlan = {
  name: string;
  /** Price for a month with its currency sign, such as "$8". */
  monthly: string;
  /** Price for a year, such as "$80". */
  yearly: string;
  text: string;
  features: string[];
  /** Where the button goes; "#start" when left out. */
  href?: string;
  /** The usual choice: accent border and the primary button. */
  featured?: boolean;
};

export type PricingToggleProps = {
  title: string;
  /** What the yearly option saves, shown on its switch button: "2 months free". */
  saving: string;
  plans: TogglePlan[];
};

export function PricingToggle({ title, saving, plans }: PricingToggleProps) {
  const [yearly, setYearly] = useState(true);
  return (
    <section className="fl-section fl-section--tint" aria-labelledby="pricing-toggle-title" data-fl="b.pricing-toggle">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head fl-head--center">
          <h2 id="pricing-toggle-title" className="fl-title">
            {title}
          </h2>
          <div className="fl-toggle" role="group" aria-label="Billing period">
            <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>
              Monthly
            </button>
            <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>
              Yearly · {saving}
            </button>
          </div>
        </div>
        <ul className="fl-grid fl-grid--2" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {plans.map((p) => (
            <li key={p.name} style={{ display: "grid" }}>
              <Card variant="surface" className={p.featured ? "fl-card--featured" : undefined} style={{ gap: "var(--space-4)" }}>
                <h3>{p.name}</h3>
                <p className="fl-price" aria-live="polite">
                  <strong>{yearly ? p.yearly : p.monthly}</strong>
                  <span className="fl-meta">{yearly ? "/year" : "/month"}</span>
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
                  Choose {p.name}
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
const SAMPLE: PricingToggleProps = {
  title: "Pay monthly, or save with a year",
  saving: "2 months free",
  plans: [
    { name: "Personal", monthly: "$8", yearly: "$80", text: "Everything for one person.", features: ["All features", "Sync on 3 devices", "Email help"], featured: false },
    { name: "Family", monthly: "$14", yearly: "$140", text: "Up to six people, one bill.", features: ["Everything in Personal", "Shared lists", "Six accounts"], featured: true },
  ],
};

export default function PricingTogglePreview() {
  return <PricingToggle {...SAMPLE} />;
}
