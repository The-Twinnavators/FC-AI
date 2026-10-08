/**
 * Pricing: three tiers. The middle plan is highlighted as the usual choice. Make it the app's own: replace SAMPLE
 * with the PRD's real plans and prices (2 or 3 plans read best); keep one plan featured.
 */
import { Tick } from "./icons";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Pricing",
  title: "Simple plans that grow with you",
  lede: "Start free. Upgrade when you need more.",
  plans: [
    { name: "Starter", price: "$0", period: "/month", text: "For trying it out.", features: ["1 calendar", "50 bookings a month", "Email reminders"], action: "Start free", featured: false },
    { name: "Studio", price: "$19", period: "/month", text: "For busy solo studios.", features: ["3 calendars", "Unlimited bookings", "Text reminders", "Online deposits"], action: "Choose Studio", featured: true },
    { name: "Team", price: "$49", period: "/month", text: "For teams of up to 10.", features: ["Unlimited calendars", "Everything in Studio", "Team roles", "Priority help"], action: "Choose Team", featured: false },
  ],
};

export default function PricingTiers() {
  const d = SAMPLE;
  return (
    <section className="fl-section" id="pricing" aria-labelledby="pricing-tiers-title">
      <div className="fl-wrap">
        <div className="fl-head fl-head--center">
          <span className="fl-eyebrow">{d.eyebrow}</span>
          <h2 id="pricing-tiers-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <ul className="fl-grid fl-grid--3" style={{ margin: 0, padding: 0, listStyle: "none", alignItems: "start" }}>
          {d.plans.map((p) => (
            <li key={p.name} className={`fl-card${p.featured ? " fl-card--featured" : ""}`} style={{ gap: "var(--space-4)" }}>
              {p.featured ? <span className="fl-badge">Most popular</span> : null}
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
              <a className={`fl-btn ${p.featured ? "fl-btn--primary" : "fl-btn--secondary"}`} href="#start">
                {p.action}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
