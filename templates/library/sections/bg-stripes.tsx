/** @flowcode-library bg-stripes · Diagonal stripes (Page backgrounds)
 * Use cases: promo section; sale banner background; highlight section; construction or coming soon page; call to action band
 * Jobs to be done: notice a highlighted section; see a clear break between sections; find out about a sale or offer
 * Keywords: background, pattern, page background, stripes
 */
/**
 * Page background: diagonal stripes (pattern). Thin diagonal stripes in the accent colour.
 * Good for: Playful sections and promotional banners.
 * Use it by adding the class "fl-bg-stripes" to any section, or to the page's outer element. Colours come from the
 * design tokens, so it follows the app's style. Make it the app's own: keep the class, replace SAMPLE with real content.
 */
// flowcode:sample
const SAMPLE = {
  eyebrow: "Diagonal stripes",
  title: "Plan the week together, in one calm place",
  lede: "Meals, chores and plans for the whole household, updated for everyone as soon as anyone changes them.",
  action: "Try it free",
};

export default function BgStripes() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-bg-stripes" aria-labelledby="bg-stripes-title" style={{ paddingBlock: "var(--space-9)" }}>
      <div className="fl-wrap fl-head fl-head--center" style={{ marginBottom: 0 }}>
        <span className="fl-eyebrow">{d.eyebrow}</span>
        <h2 id="bg-stripes-title" className="fl-title">
          {d.title}
        </h2>
        <p className="fl-lede">{d.lede}</p>
        <div className="fl-actions" style={{ marginTop: "var(--space-3)" }}>
          <a className="fl-btn fl-btn--primary" href="#start">
            {d.action}
          </a>
        </div>
      </div>
    </section>
  );
}
