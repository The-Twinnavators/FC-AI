/** @flowcode-library testimonial-feature · Featured quote (Testimonials)
 * Catalog ID: b.testimonial-feature (block)
 * Function: The featured quote block (b.testimonial-feature): one strong customer quote with its speaker.
 * Use it as: import { TestimonialFeature } from "./testimonial-feature"; <TestimonialFeature quote name role photo? />
 * Built from: c.avatar.person
 * Look: A tinted band with one large centered quote and, below it, a round avatar beside the speaker name and role.
 * Tokens: --space-4 --color-surface-sunken --color-accent --color-text-muted
 * Use cases: featured testimonial; customer quote; client endorsement; case study quote; founder quote; press quote
 * Jobs to be done: hear a trusted customer's opinion; feel confident about choosing this; see a real success story
 * Keywords: testimonial, quote, review
 */
/**
 * Testimonial: one big quote. A single strong quote, centered, with who said it. Good between feature sections.
 * Make it the app's own: use a real quote from the PRD, or leave the section out.
 */
import { Avatar } from "./avatars-variants";

export type TestimonialFeatureProps = {
  quote: string;
  name: string;
  /** Their job and company, e.g. "Founder, Studio Lumen". */
  role: string;
  /** Optional photo address; initials show without one. */
  photo?: string;
};

export function TestimonialFeature({ quote, name, role, photo }: TestimonialFeatureProps) {
  return (
    <section className="fl-section fl-section--tint" aria-label="What a customer says" data-fl="b.testimonial-feature">
      <figure className="fl-wrap fl-wrap--narrow fl-head fl-head--center" style={{ margin: "0 auto" }}>
        <blockquote className="fl-quote fl-quote--xl">“{quote}”</blockquote>
        <figcaption className="fl-person" style={{ marginTop: "var(--space-4)" }}>
          <Avatar name={name} size={44} src={photo} decorative />
          <span style={{ textAlign: "left" }}>
            <strong>{name}</strong>
            <span>{role}</span>
          </span>
        </figcaption>
      </figure>
    </section>
  );
}

// flowcode:sample
const SAMPLE: TestimonialFeatureProps = {
  quote: "We used to lose a day a week to scheduling. Now it takes care of itself, and our clients love how easy it is.",
  name: "Ana Ruiz",
  role: "Founder, Studio Lumen",
};

export default function TestimonialFeaturePreview() {
  return <TestimonialFeature {...SAMPLE} />;
}
