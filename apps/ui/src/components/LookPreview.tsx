/**
 * The Look studio's live preview: realistic app screens drawn only from the look's tokens (colours, fonts, corners,
 * spacing, borders, surface, gradient), so every control changes them at once. Adapted from CSSVibes' Style Preview
 * layouts (the person's own repository: Dashboard "analytics", Pricing, Home), rewritten from computed inline colours
 * to FlowCode's token CSS. The project's name and first sentence stand in for the brand and the headline.
 */
import type { CSSProperties } from "react";

export type PreviewScreen = "home" | "dashboard" | "pricing";
export const PREVIEW_SCREENS: Array<{ id: PreviewScreen; label: string }> = [
  { id: "home", label: "Home" },
  { id: "dashboard", label: "Dashboard" },
  { id: "pricing", label: "Pricing" },
];

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "A";

export function LookPreview({ screen, tokens, brand, tagline, gradientUses }: { screen: PreviewScreen; tokens: Record<string, string>; brand: string; tagline: string; gradientUses: string[] }) {
  const vars = Object.fromEntries(Object.entries(tokens).filter(([k]) => k.startsWith("--"))) as CSSProperties;
  const cls = ["lp", gradientUses.includes("headline") ? "lp--title-gradient" : "", gradientUses.includes("panels") ? "lp--panel-gradient" : ""].filter(Boolean).join(" ");
  return (
    <div className={cls} style={vars}>
      {screen === "home" ? <HomeScreen brand={brand} tagline={tagline} /> : screen === "dashboard" ? <DashboardScreen brand={brand} /> : <PricingScreen brand={brand} />}
    </div>
  );
}

function Mark({ brand }: { brand: string }) {
  return (
    <span className="lp-brand">
      <span className="lp-brand__mark" aria-hidden="true">{initials(brand)}</span>
      {brand}
    </span>
  );
}

function HomeScreen({ brand, tagline }: { brand: string; tagline: string }) {
  return (
    <div className="lp-home">
      <header className="lp-nav">
        <Mark brand={brand} />
        <nav className="lp-nav__links">
          <span>Features</span>
          <span>Pricing</span>
          <span>About</span>
        </nav>
        <span className="lp-btn lp-btn--ghost">Sign in</span>
        <span className="lp-btn lp-btn--primary">Get started</span>
      </header>
      <section className="lp-hero">
        <span className="lp-pill">New · Book in under a minute</span>
        <h1 className="lp-hero__title">{brand}</h1>
        <p className="lp-hero__sub">{tagline}</p>
        <div className="lp-row">
          <span className="lp-btn lp-btn--primary lp-btn--lg">Get started free</span>
          <span className="lp-btn lp-btn--secondary lp-btn--lg">See how it works</span>
        </div>
      </section>
      <section className="lp-panel">
        <div>
          <p className="lp-panel__k">This week</p>
          <p className="lp-panel__v">1,284 bookings</p>
        </div>
        <span className="lp-btn lp-btn--onpanel">View schedule</span>
      </section>
      <section className="lp-features">
        {[
          ["Plan in minutes", "Pick a time, invite people and get reminders without the back-and-forth."],
          ["Everything in one place", "Your schedule, members and history stay together and searchable."],
          ["Works on any device", "Fast on phones, tablets and desktops, with the same account everywhere."],
        ].map(([t, d]) => (
          <article key={t} className="lp-card">
            <span className="lp-card__icon" aria-hidden="true" />
            <h3 className="lp-card__title">{t}</h3>
            <p className="lp-muted">{d}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

const STATS = [
  { label: "Total revenue", value: "$128,430", trend: 12.5 },
  { label: "Active users", value: "43,201", trend: 8.2 },
  { label: "Conversion", value: "3.42%", trend: -2.4 },
  { label: "Avg. session", value: "12m 45s", trend: 4.1 },
];
const CHART = [45, 52, 48, 70, 65, 85, 92];
const ROWS = [
  { user: "Alex Rivera", status: "Completed", date: "May 12", amount: "$450.00" },
  { user: "Sarah Chen", status: "Pending", date: "May 11", amount: "$1,200.00" },
  { user: "Jordan Smyth", status: "Completed", date: "May 11", amount: "$85.00" },
  { user: "Maria Garcia", status: "Refunded", date: "May 10", amount: "$320.00" },
];

function DashboardScreen({ brand }: { brand: string }) {
  const points = CHART.map((v, i) => `${(i * 100) / 6},${50 - v / 2}`).join(" ");
  return (
    <div className="lp-dash">
      <aside className="lp-side">
        <Mark brand={brand} />
        {["Overview", "Analytics", "Customers", "Performance", "Settings"].map((n, i) => (
          <span key={n} className={i === 0 ? "lp-side__item is-on" : "lp-side__item"}>{n}</span>
        ))}
      </aside>
      <div className="lp-dash__main">
        <header className="lp-top">
          <span className="lp-input">Search…</span>
          <span className="lp-avatar">JD</span>
        </header>
        <div className="lp-dash__body">
          <div className="lp-dash__head">
            <div>
              <h1 className="lp-h2">Overview</h1>
              <p className="lp-muted">Here's what happened this week.</p>
            </div>
            <div className="lp-row">
              <span className="lp-btn lp-btn--secondary">Last 7 days</span>
              <span className="lp-btn lp-btn--primary">Export</span>
            </div>
          </div>
          <div className="lp-stats">
            {STATS.map((s) => (
              <div key={s.label} className="lp-card lp-stat">
                <span className="lp-stat__k">{s.label}</span>
                <span className="lp-stat__v">{s.value}</span>
                <span className={s.trend > 0 ? "lp-trend is-up" : "lp-trend is-down"}>{s.trend > 0 ? "▲" : "▼"} {Math.abs(s.trend)}%</span>
              </div>
            ))}
          </div>
          <div className="lp-dash__grid">
            <div className="lp-card">
              <h2 className="lp-card__title">Traffic</h2>
              <svg className="lp-chart" viewBox="0 0 100 55" preserveAspectRatio="none" aria-hidden="true">
                {[0, 12.5, 25, 37.5, 50].map((y) => <line key={y} x1="0" y1={y} x2="100" y2={y} />)}
                <polyline className="lp-chart__area" points={`0,50 ${points} 100,50`} />
                <polyline className="lp-chart__line" points={points} />
              </svg>
            </div>
            <div className="lp-card">
              <h2 className="lp-card__title">Activity</h2>
              <ul className="lp-list">
                {["Sarah Chen upgraded to Pro", "Alex Rivera added an API key", "Daily backup completed", "Maria Garcia asked for a refund"].map((t, i) => (
                  <li key={t}><span className="lp-dot" />{t}<span className="lp-muted lp-list__t">{["2m", "45m", "3h", "5h"][i]}</span></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="lp-card lp-table">
            <h2 className="lp-card__title">Recent transactions</h2>
            <table>
              <thead><tr><th>Customer</th><th>Status</th><th>Date</th><th>Amount</th></tr></thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.user}>
                    <td>{r.user}</td>
                    <td><span className={`lp-badge lp-badge--${r.status === "Completed" ? "ok" : r.status === "Pending" ? "warn" : "bad"}`}>{r.status}</span></td>
                    <td className="lp-muted">{r.date}</td>
                    <td>{r.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const PLANS = [
  { name: "Starter", price: "$0", note: "For trying it out", features: ["3 projects", "Community support", "Basic analytics"], cta: "Get started free" },
  { name: "Pro", price: "$29", note: "For growing teams", features: ["Unlimited projects", "Priority support", "Advanced analytics", "Custom domains"], cta: "Start free trial", popular: true },
  { name: "Enterprise", price: "$99", note: "For organisations", features: ["Unlimited everything", "Dedicated manager", "SLA guarantee", "SSO / SAML"], cta: "Contact sales" },
];

function PricingScreen({ brand }: { brand: string }) {
  return (
    <div className="lp-pricing">
      <header className="lp-nav">
        <Mark brand={brand} />
        <nav className="lp-nav__links"><span>Features</span><span className="is-on">Pricing</span><span>About</span></nav>
        <span className="lp-btn lp-btn--primary">Get started</span>
      </header>
      <section className="lp-pricing__head">
        <h1 className="lp-hero__title lp-hero__title--sm">Simple, transparent pricing</h1>
        <p className="lp-hero__sub">No hidden fees. Choose the plan that works for you.</p>
        <span className="lp-toggle"><span className="is-on">Monthly</span><span>Yearly · save 20%</span></span>
      </section>
      <section className="lp-plans">
        {PLANS.map((p) => (
          <article key={p.name} className={p.popular ? "lp-card lp-plan is-popular" : "lp-card lp-plan"}>
            {p.popular ? <span className="lp-pill lp-plan__badge">Most popular</span> : null}
            <h2 className="lp-card__title">{p.name}</h2>
            <p className="lp-muted">{p.note}</p>
            <p className="lp-plan__price">{p.price}<span className="lp-muted">/month</span></p>
            <span className={p.popular ? "lp-btn lp-btn--primary lp-btn--block" : "lp-btn lp-btn--secondary lp-btn--block"}>{p.cta}</span>
            <ul className="lp-plan__list">
              {p.features.map((f) => <li key={f}>✓ {f}</li>)}
            </ul>
          </article>
        ))}
      </section>
    </div>
  );
}
