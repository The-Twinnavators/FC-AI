/** @flowcode-library bg-grid · Fading grid (Page backgrounds)
 * Use cases: hero background; developer tool landing; saas homepage; technical product page; launch page; feature section
 * Jobs to be done: focus on the headline; feel the product is precise and technical; notice a launch or announcement
 * Keywords: background, pattern, page background, grid
 */
/**
 * Page background: fading grid (pattern). Faint grid lines that fade out towards the edges.
 * Good for: Developer and data products; behind a hero.
 * Use it by adding the class "fl-bg-grid" to any section, or to the page's outer element. Colors come from the
 * design tokens, so it follows the app's style. Make it the app's own: keep the class, replace SAMPLE with real content.
 */
// flowcode:sample
const SAMPLE = {
  eyebrow: "Fading grid",
  title: "Plan the week together, in one calm place",
  lede: "Meals, chores and plans for the whole household, updated for everyone as soon as anyone changes them.",
  action: "Try it free",
};

export default function BgGrid() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-bg-grid" aria-labelledby="bg-grid-title" style={{ paddingBlock: "var(--space-9)" }}>
      <div className="fl-wrap fl-head fl-head--center" style={{ marginBottom: 0 }}>
        <span className="fl-eyebrow">{d.eyebrow}</span>
        <h2 id="bg-grid-title" className="fl-title">
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
