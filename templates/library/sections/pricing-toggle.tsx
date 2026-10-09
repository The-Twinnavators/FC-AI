/** @flowcode-library pricing-toggle · Monthly or yearly pricing (Pricing)
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

// flowcode:sample
const SAMPLE = {
  title: "Pay monthly, or save with a year",
  saving: "2 months free",
  plans: [
    { name: "Personal", monthly: "$8", yearly: "$80", text: "Everything for one person.", features: ["All features", "Sync on 3 devices", "Email help"], featured: false },
    { name: "Family", monthly: "$14", yearly: "$140", text: "Up to six people, one bill.", features: ["Everything in Personal", "Shared lists", "Six accounts"], featured: true },
  ],
};

export default function PricingToggle() {
  const d = SAMPLE;
  const [yearly, setYearly] = useState(true);
  return (
    <section className="fl-section fl-section--tint" aria-labelledby="pricing-toggle-title">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head fl-head--center">
          <h2 id="pricing-toggle-title" className="fl-title">
            {d.title}
          </h2>
          <div className="fl-toggle" role="group" aria-label="Billing period">
            <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>
              Monthly
            </button>
            <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>
              Yearly · {d.saving}
            </button>
          </div>
        </div>
        <ul className="fl-grid fl-grid--2" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {d.plans.map((p) => (
            <li key={p.name} className={`fl-card${p.featured ? " fl-card--featured" : ""}`} style={{ gap: "var(--space-4)" }}>
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
              <a className={`fl-btn ${p.featured ? "fl-btn--primary" : "fl-btn--secondary"}`} href="#start">
                Choose {p.name}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
