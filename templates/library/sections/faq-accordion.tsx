/** @flowcode-library faq-accordion · FAQ accordion (FAQ)
 * Catalog ID: b.faq-accordion (block)
 * Function: A narrow FAQ section whose questions open in place, one at a time.
 * Use it as: import { FaqAccordion } from "./faq-accordion"; <FaqAccordion title items={[{q,a}]} /> (first answer starts open)
 * Built from: c.accordion.bordered
 * Look: A centered heading over one bordered box of questions; the first answer is open and a chevron turns on each row.
 * Tokens: --space-4 --color-border --color-surface --color-surface-sunken --color-accent --color-text-muted
 * Use cases: faq; help center; common questions; pricing questions; support page; product questions; shipping and returns; policy questions
 * Jobs to be done: get an answer without contacting support; find out how billing works; clear up doubts before buying; find the answer to my question
 * Keywords: faq, questions, help, accordion
 */
/**
 * FAQ: accordion. Questions that open in place (the catalog accordion, so arrow keys and screen readers work). Make it the app's own: replace SAMPLE with the questions people really ask (5 to 8).
 */
import { Accordion } from "./accordion-variants";

export type FaqAccordionProps = {
  title: string;
  /** Questions and answers, 5 to 8. The first one starts open. */
  items: { q: string; a: string }[];
};

export function FaqAccordion({ title, items }: FaqAccordionProps) {
  return (
    <section className="fl-section" id="help" aria-labelledby="faq-accordion-title" data-fl="b.faq-accordion">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <h2 id="faq-accordion-title" className="fl-title">
            {title}
          </h2>
        </div>
        <Accordion variant="bordered" items={items} defaultOpen={[0]} />
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE: FaqAccordionProps = {
  title: "Questions, answered",
  items: [
    { q: "Do my clients need an account?", a: "No. They pick a time, add their name and email, and they're booked." },
    { q: "Can I take deposits?", a: "Yes. Set a deposit per service; it comes off the final bill and is refunded if you cancel." },
    { q: "What happens if someone cancels?", a: "The slot opens up again straight away, and anyone on the waiting list is told." },
    { q: "Can I try it before paying?", a: "Every plan is free for 14 days. You don't need a card to start." },
    { q: "Can I export my bookings?", a: "Any time, to your calendar app or as a spreadsheet." },
  ],
};

export default function FaqAccordionPreview() {
  return <FaqAccordion {...SAMPLE} />;
}
