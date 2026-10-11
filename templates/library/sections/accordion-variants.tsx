/** @flowcode-library accordion-variants · Accordion styles (FAQ)
 * Catalog ID: c.accordion (component)
 * Function: The open-and-close question list (c.accordion) in three looks, one at a time or several open; the reference sheet shows all three side by side.
 * Use it as: import { Accordion } from "./accordion-variants"; <Accordion variant?="bordered"|"cards"|"icons" items={[{q,a,icon?}]} multiple? defaultOpen?={[0]} open?={number[]} onOpenChange? />
 * Variants: c.accordion.bordered - help and policies: one bordered box with dividers between questions; c.accordion.cards - friendly FAQs: each question is its own card with space between; c.accordion.icons - scannable topics: a round icon before each question, rows divided by rules
 * Look: Question rows with a chevron that turns when open; the answer opens in place below, and arrow keys move between questions.
 * Tokens: --color-border --color-surface --color-surface-sunken --color-accent --color-text-muted --radius-lg --space-3 --space-4 --duration-fast --focus-ring
 * Use cases: faq; help center; policies; product details; terms summary; knowledge base; support questions
 * Jobs to be done: find answers to my questions; read only the part i need; scan policies quickly
 * Keywords: accordion, faq, collapse, expand, disclosure, questions
 */
/**
 * Accordion styles: the same open-and-close questions in three looks: one bordered box, separate cards, and rows
 * with an icon each. Switch between "one at a time" and "open several". Built from buttons with aria-expanded, so
 * keyboards and screen readers work; arrow keys move between questions. Use it for help, policies or details people
 * scan. Make it the app's own: replace SAMPLE and keep the one look that suits the page.
 */
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "./icons";

// ── c.accordion: the one open-and-close list. Every FAQ is this component; the sheet below shows each look. ──

export type AccordionVariant = "bordered" | "cards" | "icons";
export type AccordionItem = { q: string; a: string; /** An icon name from ./icons; shown by the icons look. */ icon?: string };

// Written out in full (not built from the variant name) so a build finds every class it needs.
const VARIANT: Record<AccordionVariant, string> = { bordered: "fl-dsp-acc--bordered", cards: "fl-dsp-acc--cards", icons: "fl-dsp-acc--icons" };

export type AccordionProps = {
  variant?: AccordionVariant;
  items: AccordionItem[];
  /** Let several questions stay open; otherwise opening one closes the others. */
  multiple?: boolean;
  /** Indexes open at first (uncontrolled). */
  defaultOpen?: number[];
  /** Controlled: the open indexes, with onOpenChange to receive the next ones. */
  open?: number[];
  onOpenChange?: (open: number[]) => void;
  className?: string;
};

const Chevron = () => (
  <svg className="fl-dsp-acc__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export function Accordion({ variant = "bordered", items, multiple, defaultOpen = [], open: controlled, onOpenChange, className }: AccordionProps) {
  const uid = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [inner, setInner] = useState<number[]>(defaultOpen);
  const open = controlled ?? inner;
  const set = (next: number[]) => {
    if (controlled === undefined) setInner(next);
    onOpenChange?.(next);
  };
  const toggle = (i: number) => set(open.includes(i) ? open.filter((k) => k !== i) : multiple ? [...open, i] : [i]);
  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const n = items.length;
    const to = e.key === "ArrowDown" ? (i + 1) % n : e.key === "ArrowUp" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    refs.current[to]?.focus();
  }
  return (
    <div className={["fl-dsp-acc", VARIANT[variant], className ?? ""].filter(Boolean).join(" ")} data-fl={`c.accordion.${variant}`}>
      {items.map((it, i) => {
        const isOpen = open.includes(i);
        const key = `${uid}-${i}`;
        return (
          <div key={key} className="fl-dsp-acc__item" data-open={isOpen}>
            <h4>
              <button
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                id={`${key}-btn`}
                className="fl-dsp-acc__trigger"
                aria-expanded={isOpen}
                aria-controls={`${key}-panel`}
                onClick={() => toggle(i)}
                onKeyDown={(e) => onKey(e, i)}
              >
                {it.icon && (
                  <span className="fl-dsp-acc__lead" aria-hidden="true">
                    <Icon name={it.icon} />
                  </span>
                )}
                <span>{it.q}</span>
                <Chevron />
              </button>
            </h4>
            <div id={`${key}-panel`} role="region" aria-labelledby={`${key}-btn`} className="fl-dsp-acc__panel" hidden={!isOpen}>
              <p>{it.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  eyebrow: "Help",
  title: "Questions before your first class",
  modes: { single: "One at a time", multi: "Open several" },
  collapse: "Close all",
  groups: [
    {
      id: "bordered" as const,
      label: "Bordered",
      items: [
        { q: "What should I wear?", a: "Clothes you don't mind getting clay on, and short nails if you can. We have aprons for everyone." },
        { q: "Do I need to bring anything?", a: "No. Clay, tools, glazes and firing are all included in the class price." },
        { q: "How many people are in a class?", a: "Eight at most, so the tutor can help everyone at the wheel." },
      ],
    },
    {
      id: "cards" as const,
      label: "Separated cards",
      items: [
        { q: "When can I collect my pots?", a: "About three weeks after your class, once they've been glazed and fired. We'll text you when they're ready." },
        { q: "Can I change my booking?", a: "Yes, up to 48 hours before the class, from the link in your confirmation email." },
        { q: "Is there parking?", a: "There are six free spaces behind the studio, and a pay-and-display car park across the road." },
      ],
    },
    {
      id: "icons" as const,
      label: "With icons",
      items: [
        { q: "Is the studio accessible?", a: "Step-free from the side door, with a height-adjustable wheel and an accessible toilet.", icon: "users" },
        { q: "What if I'm running late?", a: "Text the studio number and we'll keep your wheel. We can't extend the class, though.", icon: "clock" },
        { q: "Are the glazes food safe?", a: "Yes, every glaze on our shelves is lead-free and food safe once fired.", icon: "shield" },
      ],
    },
  ],
};

export default function AccordionVariants() {
  const d = SAMPLE;
  const [multi, setMulti] = useState(false);
  const [open, setOpen] = useState<Record<string, number[]>>({ bordered: [0], cards: [0], icons: [0] });
  const count = Object.values(open).reduce((n, l) => n + l.length, 0);

  function setMode(many: boolean) {
    setMulti(many);
    // Going back to one at a time: keep only the first open question in each style.
    if (!many) setOpen((cur) => Object.fromEntries(Object.entries(cur).map(([k, l]) => [k, l.slice(0, 1)])));
  }

  return (
    <section className="fl-section" aria-labelledby="accordion-variants-title">
      <div className="fl-wrap">
        <div className="fl-dsp-acc-modes">
          <div className="fl-head" style={{ marginBottom: 0 }}>
            <span className="fl-eyebrow">{d.eyebrow}</span>
            <h2 id="accordion-variants-title" className="fl-title fl-title--md">
              {d.title}
            </h2>
          </div>
          <div className="fl-actions">
            <div className="fl-toggle" role="group" aria-label="How questions open">
              <button type="button" aria-pressed={!multi} onClick={() => setMode(false)}>
                {d.modes.single}
              </button>
              <button type="button" aria-pressed={multi} onClick={() => setMode(true)}>
                {d.modes.multi}
              </button>
            </div>
            <button type="button" className="fl-dsp-btn fl-dsp-btn--ghost" onClick={() => setOpen({ bordered: [], cards: [], icons: [] })} disabled={count === 0}>
              {d.collapse}
            </button>
          </div>
        </div>
        <div className="fl-dsp-acc-grid">
          {d.groups.map((g) => (
            <div key={g.id} className="fl-dsp-acc-col">
              <h3>{g.label}</h3>
              <Accordion variant={g.id} items={g.items} multiple={multi} open={open[g.id]} onOpenChange={(l) => setOpen((cur) => ({ ...cur, [g.id]: l }))} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
