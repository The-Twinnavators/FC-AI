/**
 * Hero: with proof. Promise, actions and three numbers that back it up, on a tinted band. Good when the product has
 * real results to show. Make it the app's own: replace SAMPLE; only use numbers the PRD actually gives.
 */
// flowcode:sample
const SAMPLE = {
  title: "Your money, finally organised",
  lede: "Every account, bill and goal in one view, with a plan that adjusts when life does.",
  primary: { label: "Get started", href: "#start" },
  stats: [
    { value: "12 min", label: "to set up" },
    { value: "3 accounts", label: "linked on average" },
    { value: "4.8 / 5", label: "from early users" },
  ],
};

export default function HeroStats() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--tint" aria-labelledby="hero-stats-title">
      <div className="fl-wrap fl-split">
        <div className="fl-head" style={{ marginBottom: 0 }}>
          <h1 id="hero-stats-title" className="fl-title fl-title--xl">
            {d.title}
          </h1>
          <p className="fl-lede">{d.lede}</p>
          <div className="fl-actions" style={{ marginTop: "var(--space-3)" }}>
            <a className="fl-btn fl-btn--primary" href={d.primary.href}>
              {d.primary.label}
            </a>
          </div>
        </div>
        <dl className="fl-grid" style={{ margin: 0 }}>
          {d.stats.map((s) => (
            <div key={s.label} className="fl-card fl-stat">
              <dt className="fl-sr">
                {s.label}
              </dt>
              <dd style={{ margin: 0, display: "grid", gap: "var(--space-1)" }}>
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
