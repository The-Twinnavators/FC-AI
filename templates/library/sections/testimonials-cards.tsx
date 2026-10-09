/** @flowcode-library testimonials-cards · Testimonial cards (Testimonials)
 * Use cases: customer testimonials; reviews section; social proof; client feedback; success stories; user quotes; student reviews
 * Jobs to be done: hear from people who use it; trust the product before buying; see whether people like me benefit; read honest customer feedback
 * Keywords: testimonials, reviews, quotes, social proof
 */
/**
 * Testimonials: cards. Three short quotes with who said them. Make it the app's own: use only real quotes the PRD
 * provides; with none, leave this section out rather than inventing praise.
 */
// flowcode:sample
const SAMPLE = {
  title: "What studio owners say",
  quotes: [
    { quote: "I stopped answering booking texts at 11pm. That alone was worth it.", name: "Maya Okafor", role: "Yoga studio owner" },
    { quote: "No-shows dropped in the first month. The reminders just work.", name: "Leo Brandt", role: "Barber, two chairs" },
    { quote: "My team finally sees the same calendar I do.", name: "Priya Shah", role: "Massage clinic" },
  ],
};

const initials = (name: string) => name.split(" ").map((p) => p[0]).slice(0, 2).join("");

export default function TestimonialsCards() {
  const d = SAMPLE;
  return (
    <section className="fl-section" id="stories" aria-labelledby="testimonials-cards-title">
      <div className="fl-wrap">
        <div className="fl-head fl-head--center">
          <h2 id="testimonials-cards-title" className="fl-title">
            {d.title}
          </h2>
        </div>
        <ul className="fl-grid fl-grid--3" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {d.quotes.map((q) => (
            <li key={q.name} className="fl-card" style={{ gap: "var(--space-5)" }}>
              <blockquote className="fl-quote">“{q.quote}”</blockquote>
              <div className="fl-person">
                <span className="fl-person__avatar" aria-hidden="true">
                  {initials(q.name)}
                </span>
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
