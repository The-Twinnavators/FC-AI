/**
 * Call to action: banner. A closing invitation on the accent colour with one main action. Usually just above the
 * footer. Make it the app's own: replace SAMPLE; keep it to one sentence and one primary action.
 */
// flowcode:sample
const SAMPLE = {
  title: "Ready to get your evenings back?",
  lede: "Set up your calendar in ten minutes. Free for 14 days.",
  primary: { label: "Start free", href: "#start" },
  secondary: { label: "Talk to us", href: "#contact" },
};

export default function CtaBanner() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--accent" aria-labelledby="cta-banner-title">
      <div className="fl-wrap fl-head fl-head--center" style={{ marginBottom: 0 }}>
        <h2 id="cta-banner-title" className="fl-title">
          {d.title}
        </h2>
        <p className="fl-lede">{d.lede}</p>
        <div className="fl-actions" style={{ marginTop: "var(--space-3)" }}>
          <a className="fl-btn fl-btn--on-accent" href={d.primary.href}>
            {d.primary.label}
          </a>
          <a className="fl-btn fl-btn--ghost-on-accent" href={d.secondary.href}>
            {d.secondary.label}
          </a>
        </div>
      </div>
    </section>
  );
}
