/** @flowcode-library cta-split · Call-to-action card (Calls to action)
 * Use cases: trial invite; data import prompt; upgrade prompt; download app; demo request; promotional offer; migration invite
 * Jobs to be done: start a free trial; bring my data over easily; try the product with my own work; take the next step
 * Keywords: cta, call to action, import, trial
 */
/**
 * Call to action: split card. An invitation in a card with a picture beside it; softer than the banner. Make it the
 * app's own: replace SAMPLE and the media placeholder (real image, with alt text).
 */
// flowcode:sample
const SAMPLE = {
  title: "See it with your own bookings",
  lede: "Import your calendar and see next week laid out in minutes.",
  primary: { label: "Import my calendar", href: "#start" },
  media: "Next week's bookings imported into the calendar",
};

export default function CtaSplit() {
  const d = SAMPLE;
  return (
    <section className="fl-section" aria-labelledby="cta-split-title">
      <div className="fl-wrap">
        <div className="fl-card fl-split" style={{ padding: "var(--space-7)" }}>
          <div className="fl-head" style={{ marginBottom: 0 }}>
            <h2 id="cta-split-title" className="fl-title fl-title--md">
              {d.title}
            </h2>
            <p className="fl-text">{d.lede}</p>
            <div className="fl-actions" style={{ marginTop: "var(--space-3)" }}>
              <a className="fl-btn fl-btn--primary" href={d.primary.href}>
                {d.primary.label}
              </a>
            </div>
          </div>
          <div className="fl-media fl-media--wide" role="img" aria-label={d.media}>
            {d.media}
          </div>
        </div>
      </div>
    </section>
  );
}
