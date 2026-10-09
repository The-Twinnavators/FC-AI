/** @flowcode-library features-alternating · Alternating features (Features)
 * Use cases: how it works; product tour; feature showcase; step by step guide; onboarding overview; case study story; service process
 * Jobs to be done: understand how the product works; see each feature in action; follow the process step by step; picture using it in my day
 * Keywords: features, how it works, steps, showcase
 */
/**
 * Features: alternating rows. Each feature gets a picture and a short story, alternating sides. Good for showing how
 * the product works step by step. Make it the app's own: replace SAMPLE; 2 to 4 rows; swap each media placeholder
 * for a real screenshot with alt text.
 */
import { Tick } from "./icons";

// flowcode:sample
const SAMPLE = {
  rows: [
    {
      eyebrow: "Plan",
      title: "See the whole week at once",
      text: "Drag a booking to move it. Everyone involved is told, and nothing double-books.",
      points: ["Week and day views", "Colour by service", "Holidays blocked automatically"],
      media: "The week view with bookings colour-coded by service",
    },
    {
      eyebrow: "Get paid",
      title: "Deposits without the awkward chase",
      text: "Ask for a deposit when someone books. It's taken off the final bill.",
      points: ["Card or bank transfer", "Refunds in one click", "Receipts sent for you"],
      media: "A booking confirmation showing the deposit paid",
    },
  ],
};

export default function FeaturesAlternating() {
  const d = SAMPLE;
  return (
    <section className="fl-section" aria-label="How it works">
      <div className="fl-wrap" style={{ display: "grid", gap: "var(--space-9)" }}>
        {d.rows.map((r, i) => (
          <article key={r.title} className="fl-split">
            <div className="fl-media" role="img" aria-label={r.media} style={{ order: i % 2 ? 2 : 0 }}>
              {r.media}
            </div>
            <div className="fl-head" style={{ marginBottom: 0 }}>
              <span className="fl-eyebrow">{r.eyebrow}</span>
              <h2 className="fl-title fl-title--md">{r.title}</h2>
              <p className="fl-text">{r.text}</p>
              <ul className="fl-checks" style={{ marginTop: "var(--space-2)" }}>
                {r.points.map((p) => (
                  <li key={p}>
                    <Tick />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
