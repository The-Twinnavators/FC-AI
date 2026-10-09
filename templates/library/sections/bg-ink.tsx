/** @flowcode-library bg-ink · Ink band (Page backgrounds)
 * Use cases: call to action band; stats band; promo section; newsletter section; highlight section; closing section
 * Jobs to be done: notice the key invitation; see a clear break between sections; take the next step
 * Keywords: background, gradient, page background, ink
 */
/**
 * Page background: ink band (gradient). The accent colour as a solid band with a soft highlight; text switches to the on-accent colour.
 * Good for: A closing call to action or a stats band.
 * Use it by adding the class "fl-bg-ink" to any section, or to the page's outer element. Colours come from the
 * design tokens, so it follows the app's style. Make it the app's own: keep the class, replace SAMPLE with real content.
 */
// flowcode:sample
const SAMPLE = {
  eyebrow: "Ink band",
  title: "Plan the week together, in one calm place",
  lede: "Meals, chores and plans for the whole household, updated for everyone as soon as anyone changes them.",
  action: "Try it free",
};

export default function BgInk() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-bg-ink" aria-labelledby="bg-ink-title" style={{ paddingBlock: "var(--space-9)" }}>
      <div className="fl-wrap fl-head fl-head--center" style={{ marginBottom: 0 }}>
        <span className="fl-eyebrow">{d.eyebrow}</span>
        <h2 id="bg-ink-title" className="fl-title">
          {d.title}
        </h2>
        <p className="fl-lede">{d.lede}</p>
        <div className="fl-actions" style={{ marginTop: "var(--space-3)" }}>
          <a className="fl-btn fl-btn--on-accent" href="#start">
            {d.action}
          </a>
        </div>
      </div>
    </section>
  );
}
