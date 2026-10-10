/** @flowcode-library bg-grain · Film grain (Page backgrounds)
 * Use cases: editorial site; portfolio; studio website; blog background; craft brand site; restaurant site
 * Jobs to be done: enjoy a warm, crafted feel; read comfortably on a textured page; focus on the words and pictures
 * Keywords: background, pattern, page background, grain
 */
/**
 * Page background: film grain (pattern). A subtle paper-like grain over the page color.
 * Good for: Editorial, craft and premium brands; pairs well with serif type.
 * Use it by adding the class "fl-bg-grain" to any section, or to the page's outer element. Colors come from the
 * design tokens, so it follows the app's style. Make it the app's own: keep the class, replace SAMPLE with real content.
 */
// flowcode:sample
const SAMPLE = {
  eyebrow: "Film grain",
  title: "Plan the week together, in one calm place",
  lede: "Meals, chores and plans for the whole household, updated for everyone as soon as anyone changes them.",
  action: "Try it free",
};

export default function BgGrain() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-bg-grain" aria-labelledby="bg-grain-title" style={{ paddingBlock: "var(--space-9)" }}>
      <div className="fl-wrap fl-head fl-head--center" style={{ marginBottom: 0 }}>
        <span className="fl-eyebrow">{d.eyebrow}</span>
        <h2 id="bg-grain-title" className="fl-title">
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
