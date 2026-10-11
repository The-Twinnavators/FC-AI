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
 */
import { Avatar } from "./avatars-variants";

export type TestimonialsCardsProps = {
  /** Anchor for the section. "stories" when left out. */
  id?: string;
  title: string;
  /** Each quote: the words, who said them, their role, and an optional photo address. */
  quotes: { quote: string; name: string; role: string; photo?: string }[];
};

export function TestimonialsCards({ id = "stories", title, quotes }: TestimonialsCardsProps) {
  return (
    <section className="fl-section" id={id} aria-labelledby="testimonials-cards-title" data-fl="b.testimonials-cards">
      <div className="fl-wrap">
        <div className="fl-head fl-head--center">
          <h2 id="testimonials-cards-title" className="fl-title">
            {title}
          </h2>
        </div>
        <ul className="fl-grid fl-grid--3" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {quotes.map((q) => (
            <li key={q.name} className="fl-card" style={{ gap: "var(--space-5)" }}>
              <blockquote className="fl-quote">“{q.quote}”</blockquote>
              <div className="fl-person">
                <Avatar name={q.name} size={48} src={q.photo} decorative />
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
