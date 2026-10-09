/** @flowcode-library bg-soft · Soft gradient (Page backgrounds)
 * Use cases: landing page background; hero background; sign in page background; marketing page; onboarding screen; pricing page background
 * Jobs to be done: feel welcomed by a calm page; focus on the main message; read the page without visual clutter
 * Keywords: background, gradient, page background, soft
 */
/**
 * Page background: soft gradient (gradient). A gentle wash of the accent colour at the top, fading into the page.
 * Good for: Calm, friendly pages: onboarding, help, settings intros.
 * Use it by adding the class "fl-bg-soft" to any section, or to the page's outer element. Colours come from the
 * design tokens, so it follows the app's style. Make it the app's own: keep the class, replace SAMPLE with real content.
 */
// flowcode:sample
const SAMPLE = {
  eyebrow: "Soft gradient",
  title: "Plan the week together, in one calm place",
  lede: "Meals, chores and plans for the whole household, updated for everyone as soon as anyone changes them.",
  action: "Try it free",
};

export default function BgSoft() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-bg-soft" aria-labelledby="bg-soft-title" style={{ paddingBlock: "var(--space-9)" }}>
      <div className="fl-wrap fl-head fl-head--center" style={{ marginBottom: 0 }}>
        <span className="fl-eyebrow">{d.eyebrow}</span>
        <h2 id="bg-soft-title" className="fl-title">
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
