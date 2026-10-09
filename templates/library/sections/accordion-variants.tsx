/** @flowcode-library accordion-variants · Accordion styles (FAQ)
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
import { useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Help",
  title: "Questions before your first class",
  modes: { single: "One at a time", multi: "Open several" },
  collapse: "Close all",
  groups: [
    {
      id: "bordered",
      label: "Bordered",
      items: [
        { q: "What should I wear?", a: "Clothes you don't mind getting clay on, and short nails if you can. We have aprons for everyone." },
        { q: "Do I need to bring anything?", a: "No. Clay, tools, glazes and firing are all included in the class price." },
        { q: "How many people are in a class?", a: "Eight at most, so the tutor can help everyone at the wheel." },
      ],
    },
    {
      id: "cards",
      label: "Separated cards",
      items: [
        { q: "When can I collect my pots?", a: "About three weeks after your class, once they've been glazed and fired. We'll text you when they're ready." },
        { q: "Can I change my booking?", a: "Yes, up to 48 hours before the class, from the link in your confirmation email." },
        { q: "Is there parking?", a: "There are six free spaces behind the studio, and a pay-and-display car park across the road." },
      ],
    },
    {
      id: "icons",
      label: "With icons",
      items: [
        { q: "Is the studio accessible?", a: "Step-free from the side door, with a height-adjustable wheel and an accessible toilet.", icon: "users" },
        { q: "What if I'm running late?", a: "Text the studio number and we'll keep your wheel. We can't extend the class, though.", icon: "clock" },
        { q: "Are the glazes food safe?", a: "Yes, every glaze on our shelves is lead-free and food safe once fired.", icon: "shield" },
      ],
    },
  ],
};

type Group = (typeof SAMPLE.groups)[number];

const Chevron = () => (
  <svg className="fl-dsp-acc__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

function Accordion({ group, multi, open, toggle }: { group: Group; multi: boolean; open: string[]; toggle: (key: string, multi: boolean) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const n = group.items.length;
    const to = e.key === "ArrowDown" ? (i + 1) % n : e.key === "ArrowUp" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    refs.current[to]?.focus();
  }
  return (
    <div className={`fl-dsp-acc fl-dsp-acc--${group.id}`}>
      {group.items.map((it, i) => {
        const key = `${group.id}-${i}`;
        const isOpen = open.includes(key);
        const icon = "icon" in it ? (it as { icon: string }).icon : null;
        return (
          <div key={key} className="fl-dsp-acc__item" data-open={isOpen}>
            <h4>
              <button
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                id={`acc-${key}-btn`}
                className="fl-dsp-acc__trigger"
                aria-expanded={isOpen}
                aria-controls={`acc-${key}-panel`}
                onClick={() => toggle(key, multi)}
                onKeyDown={(e) => onKey(e, i)}
              >
                {icon && (
                  <span className="fl-dsp-acc__lead" aria-hidden="true">
                    <Icon name={icon} />
                  </span>
                )}
                <span>{it.q}</span>
                <Chevron />
              </button>
            </h4>
            <div id={`acc-${key}-panel`} role="region" aria-labelledby={`acc-${key}-btn`} className="fl-dsp-acc__panel" hidden={!isOpen}>
              <p>{it.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AccordionVariants() {
  const d = SAMPLE;
  const [multi, setMulti] = useState(false);
  const [open, setOpen] = useState<string[]>(["bordered-0", "cards-0", "icons-0"]);

  function toggle(key: string, many: boolean) {
    const group = key.slice(0, key.lastIndexOf("-"));
    setOpen((cur) => {
      if (cur.includes(key)) return cur.filter((k) => k !== key);
      return many ? [...cur, key] : [...cur.filter((k) => !k.startsWith(`${group}-`)), key];
    });
  }
  function setMode(many: boolean) {
    setMulti(many);
    if (!many) {
      // Going back to one at a time: keep only the first open question in each style.
      setOpen((cur) => d.groups.map((g) => cur.find((k) => k.startsWith(`${g.id}-`))).filter((k): k is string => !!k));
    }
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
            <button type="button" className="fl-dsp-btn fl-dsp-btn--ghost" onClick={() => setOpen([])} disabled={open.length === 0}>
              {d.collapse}
            </button>
          </div>
        </div>
        <div className="fl-dsp-acc-grid">
          {d.groups.map((g) => (
            <div key={g.id} className="fl-dsp-acc-col">
              <h3>{g.label}</h3>
              <Accordion group={g} multi={multi} open={open} toggle={toggle} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
