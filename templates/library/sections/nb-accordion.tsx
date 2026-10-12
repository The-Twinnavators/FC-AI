/** @flowcode-library nb-accordion · Neobrutal accordion (neobrutal) (FAQ)
 * Catalog ID: c.accordion@neobrutal (component version)
 * Version of: c.accordion
 * Function: Chunky FAQ questions that open independently, with an accent-filled open header.
 * Use it as: import { Accordion } from "./accordion-variants"; <Accordion version="neobrutal" multiple? defaultOpen?={[0]} items={[{ q, a }]} />
 * Look: Chunky ink-bordered questions with a hard offset shadow; the open header fills with the accent and its plus turns into a cross.
 * Tokens: --color-text --color-surface --color-accent --color-on-accent --radius-sm --space-2 --space-4 --space-5 --weight-bold --focus-ring
 * Use cases: faq; policies; product details; help section
 * Jobs to be done: find answers to my questions; read only the part i need
 * Keywords: accordion, faq, disclosure, neobrutalism
 */
/**
 * Neobrutalist accordion: c.accordion@neobrutal with this piece's sample content; the implementation lives in the
 * component, in ./accordion-variants. Chunky questions with an accent-filled open header whose plus turns into a
 * cross; each stays open on its own. Use it for an FAQ, policies or product details.
 * Make it the app's own: replace SAMPLE with the real questions.
 */
import { Accordion } from "./accordion-variants";

// flowcode:sample
const SAMPLE = {
  title: "Common questions",
  faq: [
    { q: "Do I need any experience?", a: "None at all. Most people in the beginner course have never touched a wheel." },
    { q: "Can I cancel or move my place?", a: "Yes, up to 48 hours before the first class for a full refund, or move to the next course at no cost." },
    { q: "When can I take my pieces home?", a: "About ten days after the last class, once the final firing has cooled. We send a message when they are ready." },
  ],
};

export default function NbAccordion() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-nb" aria-labelledby="nb-accordion-title">
      <div className="fl-wrap fl-wrap--narrow fl-nb-stack">
        <h2 id="nb-accordion-title" className="fl-title">
          {d.title}
        </h2>
        <Accordion version="neobrutal" multiple defaultOpen={[0]} items={d.faq} />
      </div>
    </section>
  );
}
