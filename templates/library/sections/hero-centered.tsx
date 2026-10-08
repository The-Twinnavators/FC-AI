/**
 * Hero: centered. One bold promise in the middle with a wide product picture underneath. Good for launches and apps
 * with one clear job. Make it the app's own: replace SAMPLE; swap the media for a real screenshot (with alt text).
 */
// flowcode:sample
const SAMPLE = {
  eyebrow: "New: shared lists",
  title: "Plan the week together, in one calm place",
  lede: "Meals, chores and plans for the whole household, updated for everyone as soon as anyone changes them.",
  primary: { label: "Try it free", href: "#start" },
  secondary: { label: "Watch a 2-minute tour", href: "#tour" },
  media: "The shared weekly plan on a phone and a laptop",
};

export default function HeroCentered() {
  const d = SAMPLE;
  return (
    <section className="fl-section" aria-labelledby="hero-centered-title">
      <div className="fl-wrap">
        <div className="fl-head fl-head--center">
          <span className="fl-badge">{d.eyebrow}</span>
          <h1 id="hero-centered-title" className="fl-title fl-title--xl">
            {d.title}
          </h1>
          <p className="fl-lede">{d.lede}</p>
          <div className="fl-actions" style={{ marginTop: "var(--space-3)" }}>
            <a className="fl-btn fl-btn--primary" href={d.primary.href}>
              {d.primary.label}
            </a>
            <a className="fl-btn fl-btn--secondary" href={d.secondary.href}>
              {d.secondary.label}
            </a>
          </div>
        </div>
        <div className="fl-media fl-media--wide" role="img" aria-label={d.media}>
          {d.media}
        </div>
      </div>
    </section>
  );
}
