/** @flowcode-library faq-columns · FAQ columns (FAQ)
 * Use cases: faq; common questions; help page; pricing questions; support page; quick answers
 * Jobs to be done: scan all the answers at once; get an answer without contacting support; reach a person when stuck; clear up doubts before buying
 * Keywords: faq, questions, help
 */
/**
 * FAQ: two columns. Every answer visible at once, with a way to reach a person. Good when the answers are short.
 * Make it the app's own: replace SAMPLE (4 to 8 pairs) and point the contact link at a real screen.
 */
// flowcode:sample
const SAMPLE = {
  title: "Good to know",
  lede: "Can't find your answer?",
  contact: { label: "Ask us", href: "#contact" },
  items: [
    { q: "Is my data private?", a: "Yes. It's yours, encrypted, and never sold." },
    { q: "Does it work offline?", a: "You can view everything offline; changes sync when you're back." },
    { q: "Can I share with family?", a: "On the Family plan, up to six people share lists and plans." },
    { q: "How do I cancel?", a: "From Settings, in two clicks. No phone call needed." },
  ],
};

export default function FaqColumns() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--tint" aria-labelledby="faq-columns-title">
      <div className="fl-wrap fl-split fl-split--start">
        <div className="fl-head" style={{ marginBottom: 0 }}>
          <h2 id="faq-columns-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-text">
            {d.lede}{" "}
            <a className="fl-link" href={d.contact.href}>
              {d.contact.label}
            </a>
          </p>
        </div>
        <dl className="fl-grid fl-grid--2" style={{ margin: 0, gap: "var(--space-6)" }}>
          {d.items.map((item) => (
            <div key={item.q} style={{ display: "grid", gap: "var(--space-2)" }}>
              <dt>
                <strong>{item.q}</strong>
              </dt>
              <dd className="fl-text" style={{ margin: 0 }}>
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
