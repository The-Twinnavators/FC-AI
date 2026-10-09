/** @flowcode-library stats-band · Stats band (Stats)
 * Use cases: results section; company milestones; impact numbers; social proof metrics; about us figures; nonprofit impact; growth highlights
 * Jobs to be done: see the results in numbers; judge how established the company is; trust the product with proof; understand the scale of impact
 * Keywords: stats, numbers, results, metrics
 */
/**
 * Stats: band. Four numbers on the accent colour, a strong break between sections. Make it the app's own: replace
 * SAMPLE with numbers the PRD actually gives; never invent results.
 */
// flowcode:sample
const SAMPLE = {
  title: "Studios run calmer with it",
  stats: [
    { value: "2,400", label: "bookings a week" },
    { value: "38%", label: "fewer no-shows" },
    { value: "6 hrs", label: "saved each week" },
    { value: "98%", label: "would recommend it" },
  ],
};

export default function StatsBand() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--accent" aria-labelledby="stats-band-title">
      <div className="fl-wrap">
        <h2 id="stats-band-title" className="fl-title fl-title--md" style={{ marginBottom: "var(--space-6)" }}>
          {d.title}
        </h2>
        <dl className="fl-grid fl-grid--4" style={{ margin: 0 }}>
          {d.stats.map((s) => (
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
