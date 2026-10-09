/** @flowcode-library bg-topo · Contour lines (Page backgrounds)
 * Use cases: outdoor brand site; travel site; maps or location product; adventure booking; hero background; about section
 * Jobs to be done: feel a sense of exploration; focus on the main message; enjoy an outdoorsy, natural feel
 * Keywords: background, pattern, page background, topo
 */
/**
 * Page background: contour lines (pattern). Topographic contour lines in the text colour.
 * Good for: Outdoor, maps, travel and exploration products.
 * Use it by adding the class "fl-bg-topo" to any section, or to the page's outer element. Colours come from the
 * design tokens, so it follows the app's style. Make it the app's own: keep the class, replace SAMPLE with real content.
 */
// flowcode:sample
const SAMPLE = {
  eyebrow: "Contour lines",
  title: "Plan the week together, in one calm place",
  lede: "Meals, chores and plans for the whole household, updated for everyone as soon as anyone changes them.",
  action: "Try it free",
};

export default function BgTopo() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-bg-topo" aria-labelledby="bg-topo-title" style={{ paddingBlock: "var(--space-9)" }}>
      <div className="fl-wrap fl-head fl-head--center" style={{ marginBottom: 0 }}>
        <span className="fl-eyebrow">{d.eyebrow}</span>
        <h2 id="bg-topo-title" className="fl-title">
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
