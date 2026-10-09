/** @flowcode-library bg-dots · Dot grid (Page backgrounds)
 * Use cases: hero background; developer tool landing; docs page background; feature section; technical product page; portfolio background
 * Jobs to be done: focus on the content on a subtle backdrop; feel the product is precise and technical; read the page without visual clutter
 * Keywords: background, pattern, page background, dots
 */
/**
 * Page background: dot grid (pattern). A fine grid of dots in the text colour.
 * Good for: Tools and technical products; behind cards or diagrams.
 * Use it by adding the class "fl-bg-dots" to any section, or to the page's outer element. Colours come from the
 * design tokens, so it follows the app's style. Make it the app's own: keep the class, replace SAMPLE with real content.
 */
// flowcode:sample
const SAMPLE = {
  eyebrow: "Dot grid",
  title: "Plan the week together, in one calm place",
  lede: "Meals, chores and plans for the whole household, updated for everyone as soon as anyone changes them.",
  action: "Try it free",
};

export default function BgDots() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-bg-dots" aria-labelledby="bg-dots-title" style={{ paddingBlock: "var(--space-9)" }}>
      <div className="fl-wrap fl-head fl-head--center" style={{ marginBottom: 0 }}>
        <span className="fl-eyebrow">{d.eyebrow}</span>
        <h2 id="bg-dots-title" className="fl-title">
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
