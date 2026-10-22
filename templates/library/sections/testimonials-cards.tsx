/** @flowcode-library testimonials-cards · Testimonial cards (Testimonials)
 * Catalog ID: b.testimonials-cards (block)
 * Function: The testimonial cards block (b.testimonials-cards): short customer quotes with who said them.
 * Use it as: import { TestimonialsCards } from "./testimonials-cards"; <TestimonialsCards title id? quotes={[{quote,name,role,photo?}]} />
 * Built from: c.avatar.person
 * Look: A centered heading above three bordered cards, each with a quote and a round avatar beside a bold name and a muted role.
 * Tokens: --space-5 --space-6 --color-surface --color-border --color-accent --color-text-muted
 * Use cases: customer testimonials; reviews section; social proof; client feedback; success stories; user quotes; student reviews
 * Jobs to be done: hear from people who use it; trust the product before buying; see whether people like me benefit; read honest customer feedback
 * Keywords: testimonials, reviews, quotes, social proof
 */
/**
 * Testimonials: cards. Three short quotes with who said them. Make it the app's own: use only real quotes the PRD
 * provides; with none, leave this section out rather than inventing praise.
 * Motion: the heading, then the quotes one after another, rise in once as the section comes into view; a quote card lifts a little under the pointer. With reduced motion they only fade; with animation off they are simply there.
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

export type TestimonialsCardsProps = {
  /** Anchor for the section. "stories" when left out. */
  id?: string;
  title: string;
  /** Each quote: the words, who said them, their role, and an optional photo address. */
  quotes: { quote: string; name: string; role: string; photo?: string }[];
};

export function TestimonialsCards({ id = "stories", title, quotes }: TestimonialsCardsProps) {
  const [ref, enter] = useEnterOnce<HTMLElement>();
  return (
    <section ref={ref} className={`fl-section fl-hx${enterClass(enter)}`} id={id} aria-labelledby="testimonials-cards-title" data-fl="b.testimonials-cards">
      <div className="fl-wrap">
        <div className="fl-head fl-head--center fl-hx-seq">
          <h2 id="testimonials-cards-title" className="fl-title">
            {title}
          </h2>
        </div>
        <ul className="fl-grid fl-grid--3 fl-hx-items fl-hx-lift" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {quotes.map((q) => (
            <li key={q.name} className="fl-card" style={{ gap: "var(--space-5)" }}>
              <blockquote className="fl-quote">“{q.quote}”</blockquote>
              <div className="fl-person">
                <Avatar name={q.name} size={44} src={q.photo} decorative />
                <span>
                  <strong>{q.name}</strong>
                  <span>{q.role}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE: TestimonialsCardsProps = {
  title: "What studio owners say",
  quotes: [
    { quote: "I stopped answering booking texts at 11pm. That alone was worth it.", name: "Maya Okafor", role: "Yoga studio owner" },
    { quote: "No-shows dropped in the first month. The reminders just work.", name: "Leo Brandt", role: "Barber, two chairs" },
    { quote: "My team finally sees the same calendar I do.", name: "Priya Shah", role: "Massage clinic" },
  ],
};

export default function TestimonialsCardsPreview() {
  return <TestimonialsCards {...SAMPLE} />;
}
