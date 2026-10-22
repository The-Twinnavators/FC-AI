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
 * Motion: the quote, then the person, rise in once as the section comes into view. With reduced motion they only fade; with animation off they are simply there.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Avatar } from "./avatars-variants";


const still = () =>
  typeof window === "undefined" ||
  document.documentElement.dataset.motion === "off" ||
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Entrance once: "wait" until the section is in view, then "in". Already on screen plays at once; without an observer,
 * or with motion off, it is simply shown; a timeout never leaves it hidden. */
function useEnterOnce<T extends Element>() {
  const ref = useRef<T>(null);
  const [state, setState] = useState<"idle" | "wait" | "in" | "done">("idle");
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window) || still()) return;
    const box = el.getBoundingClientRect();
    if (box.top < innerHeight && box.bottom > 0) {
      setState("in");
      return;
    }
    setState("wait");
    const show = () => {
      setState("in");
      io.disconnect();
    };
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && show(), { threshold: 0.15 });
    io.observe(el);
    const t = setTimeout(show, 1200);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, []);
  // Once it has played, drop the entrance classes, so content never depends on an animation finishing.
  useEffect(() => {
    if (state !== "in") return;
    const t = setTimeout(() => setState("done"), 1200);
    return () => clearTimeout(t);
  }, [state]);
  return [ref, state] as const;
}

const enterClass = (state: "idle" | "wait" | "in" | "done") => (state === "wait" ? " is-waiting" : state === "in" ? " is-entering" : "");

export type TestimonialFeatureProps = {
  quote: string;
  name: string;
  /** Their job and company, e.g. "Founder, Studio Lumen". */
  role: string;
  /** Optional photo address; initials show without one. */
  photo?: string;
};

export function TestimonialFeature({ quote, name, role, photo }: TestimonialFeatureProps) {
  const [ref, enter] = useEnterOnce<HTMLElement>();
  return (
    <section ref={ref} className={`fl-section fl-section--tint fl-hx${enterClass(enter)}`} aria-label="What a customer says" data-fl="b.testimonial-feature">
      <figure className="fl-wrap fl-wrap--narrow fl-head fl-head--center fl-hx-seq" style={{ margin: "0 auto" }}>
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
