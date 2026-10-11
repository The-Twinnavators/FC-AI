/** @flowcode-library faq-columns · FAQ columns (FAQ)
 * Catalog ID: b.faq-columns (block)
 * Function: A two-column FAQ with every answer visible and a link to reach a person.
 * Use it as: import { FaqColumns } from "./faq-columns"; <FaqColumns title lede contact={{label,href}} items={[{q,a}]} />
 * Look: A heading and a short line with a link on the left; a two-column grid of bold questions with answers below them on the right, on a tinted band.
 * Tokens: --space-2 --space-6 --color-surface-tint --color-text --color-accent
 * Use cases: faq; common questions; help page; pricing questions; support page; quick answers
 * Jobs to be done: scan all the answers at once; get an answer without contacting support; reach a person when stuck; clear up doubts before buying
 * Keywords: faq, questions, help
 */
/**
 * FAQ: two columns. Every answer visible at once, with a way to reach a person. Good when the answers are short.
 * Make it the app's own: replace SAMPLE (4 to 8 pairs) and point the contact link at a real screen.
 */
export type FaqColumnsProps = {
  title: string;
  /** The line before the contact link, such as "Can't find your answer?" */
  lede: string;
  contact: { label: string; href: string };
  /** Short question and answer pairs, 4 to 8. */
  items: { q: string; a: string }[];
};

export function FaqColumns({ title, lede, contact, items }: FaqColumnsProps) {
  return (
    <section className="fl-section fl-section--tint" aria-labelledby="faq-columns-title" data-fl="b.faq-columns">
      <div className="fl-wrap fl-split fl-split--start">
        <div className="fl-head" style={{ marginBottom: 0 }}>
          <h2 id="faq-columns-title" className="fl-title">
            {title}
          </h2>
          <p className="fl-text">
            {lede}{" "}
            <a className="fl-link" href={contact.href}>
              {contact.label}
            </a>
          </p>
        </div>
        <dl className="fl-grid fl-grid--2" style={{ margin: 0, gap: "var(--space-6)" }}>
          {items.map((item) => (
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

// flowcode:sample
const SAMPLE: FaqColumnsProps = {
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

export default function FaqColumnsPreview() {
  return <FaqColumns {...SAMPLE} />;
}
