/** @flowcode-library faq-accordion · FAQ accordion (FAQ)
 * Catalog ID: b.faq-accordion (block)
 * Function: A narrow FAQ section whose questions open in place, one at a time.
 * Use it as: import { FaqAccordion } from "./faq-accordion"; <FaqAccordion title eyebrow? lede? align?="start"|"center" tint? defaultOpen?={number[]} id? items={[{q,a}]} /> (first answer starts open; defaultOpen={[]} starts all closed; id is the section anchor, default "help")
 * Built from: c.accordion.bordered
 * Look: A heading (left or centered, optional label and sentence) over one bordered box of questions, optionally on a tinted band; the first answer is open by default and a chevron turns on each row.
 * Tokens: --space-4 --color-border --color-surface --color-surface-sunken --color-accent --color-text-muted
 * Use cases: faq; help center; common questions; pricing questions; support page; product questions; shipping and returns; policy questions
 * Jobs to be done: get an answer without contacting support; find out how billing works; clear up doubts before buying; find the answer to my question
 * Keywords: faq, questions, help, accordion
 */
/**
 * FAQ: accordion. Questions that open in place (the catalog accordion, so arrow keys and screen readers work). Make it the app's own: replace SAMPLE with the questions people really ask (5 to 8).
 * Motion: the heading and then the questions rise in once, one after another (capped), when the section first comes
 * into view; answers grow open and closed. With reduced motion or animation off everything is simply there.
 */
import { useEffect, useRef, useState } from "react";
import { Accordion } from "./accordion-variants";

const still = () =>
  typeof window === "undefined" ||
  document.documentElement.dataset.motion === "off" ||
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Entrance once: plays at once when already on screen, else when scrolled to; never left hidden (1.2s fallback). */
function useEnterOnce<T extends Element>() {
  const ref = useRef<T>(null);
  const [state, setState] = useState<"idle" | "wait" | "in">("idle");
  useEffect(() => {
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
  return [ref, state] as const;
}

export type FaqAccordionProps = {
  title: string;
  /** A short label above the title. */
  eyebrow?: string;
  /** One sentence under the title. */
  lede?: string;
  /** Heading alignment. Default "start". */
  align?: "start" | "center";
  /** The soft tinted band some pages use behind the section. */
  tint?: boolean;
  /** Which questions start open. Default [0] (the first); [] starts all closed. */
  defaultOpen?: number[];
  /** The section's anchor id (default "help"); the heading id follows it. */
  id?: string;
  /** Questions and answers, 5 to 8. The first one starts open. */
  items: { q: string; a: string }[];
};

export function FaqAccordion({ title, eyebrow, lede, align = "start", tint, defaultOpen = [0], id = "help", items }: FaqAccordionProps) {
  const titleId = `${id}-title`;
  const [ref, enter] = useEnterOnce<HTMLElement>();
  const motion = enter === "wait" ? " fl-acc-enter is-waiting" : enter === "in" ? " fl-acc-enter is-entering" : "";
  return (
    <section ref={ref} className={(tint ? "fl-section fl-section--tint" : "fl-section") + motion} id={id} aria-labelledby={titleId} data-fl="b.faq-accordion">
      <div className="fl-wrap fl-wrap--narrow">
        <div className={align === "center" ? "fl-head fl-head--center" : "fl-head"}>
          {eyebrow ? <span className="fl-eyebrow">{eyebrow}</span> : null}
          <h2 id={titleId} className="fl-title">
            {title}
          </h2>
          {lede ? <p className="fl-lede">{lede}</p> : null}
        </div>
        <Accordion variant="bordered" items={items} defaultOpen={defaultOpen} />
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
  return (
    <>
      <FaqAccordion {...SAMPLE} />
      {/* Centered heading with a label and sentence, on the tinted band, all closed. */}
      <FaqAccordion {...SAMPLE} id="help-tint" tint align="center" eyebrow="FAQ" lede="Short answers to what studios ask first." defaultOpen={[]} />
    </>
  );
}
