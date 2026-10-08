/**
 * Testimonial: one big quote. A single strong quote, centered, with who said it. Good between feature sections.
 * Make it the app's own: use a real quote from the PRD, or leave the section out.
 */
// flowcode:sample
const SAMPLE = {
  quote: "We used to lose a day a week to scheduling. Now it takes care of itself, and our clients love how easy it is.",
  name: "Ana Ruiz",
  role: "Founder, Studio Lumen",
};

export default function TestimonialFeature() {
  const d = SAMPLE;
  const initials = d.name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  return (
    <section className="fl-section fl-section--tint" aria-label="What a customer says">
      <figure className="fl-wrap fl-wrap--narrow fl-head fl-head--center" style={{ margin: "0 auto" }}>
        <blockquote className="fl-quote fl-quote--xl">“{d.quote}”</blockquote>
        <figcaption className="fl-person" style={{ marginTop: "var(--space-4)" }}>
          <span className="fl-person__avatar" aria-hidden="true">
            {initials}
          </span>
          <span style={{ textAlign: "left" }}>
            <strong>{d.name}</strong>
            <span>{d.role}</span>
          </span>
        </figcaption>
      </figure>
    </section>
  );
}
