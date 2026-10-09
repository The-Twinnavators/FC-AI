/** @flowcode-library hero-split · Split hero (Heroes)
 * Use cases: landing page hero; product launch; homepage intro; saas homepage; app download page; feature announcement; service landing page
 * Jobs to be done: understand what the product does; see the product before signing up; start a free trial; decide if this is for me
 * Keywords: hero, landing, header, product
 */
/**
 * Hero: split. Promise and actions on the left, a picture of the product on the right. The default for products and
 * services. Make it the app's own: replace SAMPLE; swap the media placeholder for a real screenshot or photo (with
 * alt text); keep one primary action.
 */
// flowcode:sample
const SAMPLE = {
  eyebrow: "For small studios",
  title: "Bookings that run themselves",
  lede: "Clients pick a time, pay a deposit and get reminders. You get your evenings back.",
  primary: { label: "Start free", href: "#start" },
  secondary: { label: "See how it works", href: "#how" },
  note: "Free for 14 days. No card needed.",
  media: "Screenshot of the week calendar with three bookings",
};

export default function HeroSplit() {
  const d = SAMPLE;
  return (
    <section className="fl-section" aria-labelledby="hero-split-title">
      <div className="fl-wrap fl-split">
        <div className="fl-head" style={{ marginBottom: 0 }}>
          <span className="fl-eyebrow">{d.eyebrow}</span>
          <h1 id="hero-split-title" className="fl-title fl-title--xl">
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
          <p className="fl-note">{d.note}</p>
        </div>
        <div className="fl-media" role="img" aria-label={d.media}>
          {d.media}
        </div>
      </div>
    </section>
  );
}
