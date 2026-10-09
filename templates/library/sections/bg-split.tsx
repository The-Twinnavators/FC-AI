/** @flowcode-library bg-split · Diagonal split (Page backgrounds)
 * Use cases: hero background; landing page section; sign in page background; feature highlight; promo section; portfolio header
 * Jobs to be done: see a clear break between sections; focus on the main message; tell the two halves of a page apart
 * Keywords: background, gradient, page background, split
 */
/**
 * Page background: diagonal split (gradient). Two tones divided on a diagonal.
 * Good for: Sections that pair a promise with a picture or a form.
 * Use it by adding the class "fl-bg-split" to any section, or to the page's outer element. Colours come from the
 * design tokens, so it follows the app's style. Make it the app's own: keep the class, replace SAMPLE with real content.
 */
// flowcode:sample
const SAMPLE = {
  eyebrow: "Diagonal split",
  title: "Plan the week together, in one calm place",
  lede: "Meals, chores and plans for the whole household, updated for everyone as soon as anyone changes them.",
  action: "Try it free",
};

export default function BgSplit() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-bg-split" aria-labelledby="bg-split-title" style={{ paddingBlock: "var(--space-9)" }}>
      <div className="fl-wrap fl-head fl-head--center" style={{ marginBottom: 0 }}>
        <span className="fl-eyebrow">{d.eyebrow}</span>
        <h2 id="bg-split-title" className="fl-title">
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
