/** @flowcode-library faq-accordion · FAQ accordion (FAQ)
 * Use cases: faq; help center; common questions; pricing questions; support page; product questions; shipping and returns; policy questions
 * Jobs to be done: get an answer without contacting support; find out how billing works; clear up doubts before buying; find the answer to my question
 * Keywords: faq, questions, help, accordion
 */
/**
 * FAQ: accordion. Questions that open in place (native details/summary, so it works with the keyboard and without
 * script). Make it the app's own: replace SAMPLE with the questions people really ask (5 to 8).
 */
// flowcode:sample
const SAMPLE = {
  title: "Questions, answered",
  items: [
    { q: "Do my clients need an account?", a: "No. They pick a time, add their name and email, and they're booked." },
    { q: "Can I take deposits?", a: "Yes. Set a deposit per service; it comes off the final bill and is refunded if you cancel." },
    { q: "What happens if someone cancels?", a: "The slot opens up again straight away, and anyone on the waiting list is told." },
    { q: "Can I try it before paying?", a: "Every plan is free for 14 days. You don't need a card to start." },
    { q: "Can I export my bookings?", a: "Any time, to your calendar app or as a spreadsheet." },
  ],
};

export default function FaqAccordion() {
  const d = SAMPLE;
  return (
    <section className="fl-section" id="help" aria-labelledby="faq-accordion-title">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <h2 id="faq-accordion-title" className="fl-title">
            {d.title}
          </h2>
        </div>
        <div className="fl-faq">
          {d.items.map((item, i) => (
            <details key={item.q} open={i === 0}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
