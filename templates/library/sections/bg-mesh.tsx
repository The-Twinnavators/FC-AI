/** @flowcode-library bg-mesh · Mesh gradient (Page backgrounds)
 * Use cases: hero background; landing page background; launch page; creative portfolio; product announcement; event page
 * Jobs to be done: feel the brand's personality; notice a launch or announcement; focus on the main message
 * Keywords: background, gradient, page background, mesh
 */
/**
 * Page background: mesh gradient (gradient). Soft colour blooms in the corners from the accent, success and focus colours.
 * Good for: Hero sections and landing pages that should feel lively.
 * Use it by adding the class "fl-bg-mesh" to any section, or to the page's outer element. Colours come from the
 * design tokens, so it follows the app's style. Make it the app's own: keep the class, replace SAMPLE with real content.
 */
// flowcode:sample
const SAMPLE = {
  eyebrow: "Mesh gradient",
  title: "Plan the week together, in one calm place",
  lede: "Meals, chores and plans for the whole household, updated for everyone as soon as anyone changes them.",
  action: "Try it free",
};

export default function BgMesh() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-bg-mesh" aria-labelledby="bg-mesh-title" style={{ paddingBlock: "var(--space-9)" }}>
      <div className="fl-wrap fl-head fl-head--center" style={{ marginBottom: 0 }}>
        <span className="fl-eyebrow">{d.eyebrow}</span>
        <h2 id="bg-mesh-title" className="fl-title">
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
