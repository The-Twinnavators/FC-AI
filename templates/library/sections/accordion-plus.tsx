/** @flowcode-library accordion-plus · Plus accordion (plus) (FAQ)
 * Catalog ID: c.accordion@plus (component version)
 * Version of: c.accordion
 * Function: Questions in their own boxes that open independently, with an accent-filled open header and a plus that turns into a cross.
 * Use it as: import { Accordion } from "./accordion-variants"; <Accordion version="plus" multiple? defaultOpen?={[0]} items={[{ q, a }]} />
 * Look: Each question is its own box and opens independently; the open header fills with the accent and its plus turns into a cross. Edges, corners and shadow follow the chosen style and surface.
 * Tokens: --surface-border --surface-radius --surface-bg --surface-shadow --edge-width --control-edge --control-radius-sm --accent-bg --color-accent --color-on-accent --color-secondary-surface --color-surface --color-text --space-4 --space-5 --text-md --text-sm --duration-fast --duration-base --focus-ring
 * Use cases: faq; policies; product details; help section
 * Jobs to be done: find answers to my questions; read only the part i need
 * Keywords: accordion, faq, disclosure
 */
/**
 * Plus accordion: c.accordion@plus with this piece's sample content; the implementation lives in the component, in
 * ./accordion-variants.
 * Construction: each question is its own box; the questions open independently, the open header fills with the
 * accent and its plus turns into a cross. Buttons with aria-expanded, so keyboards and screen readers work, and the
 * arrow keys, Home and End move between questions.
 * Look: edges, corners, fill and shadow follow the chosen style and surface, so it is flat, soft, glassy or neobrutal
 * depending on the surface style the app uses.
 * Use it for an FAQ, policies or product details.
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

export default function AccordionPlus() {
  const d = SAMPLE;
  return (
    <section className="fl-section" aria-labelledby="accordion-plus-title">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <h2 id="accordion-plus-title" className="fl-title">
            {d.title}
          </h2>
        </div>
        <Accordion version="plus" multiple defaultOpen={[0]} items={d.faq} />
      </div>
    </section>
  );
}
