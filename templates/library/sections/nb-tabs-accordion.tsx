/**
 * Neobrutalist tabs and accordion: folder-style tabs that switch with the arrow keys, Home and End, and a stack of
 * chunky questions that open one at a time or all at once. Use them for class details, plan comparisons or an FAQ.
 * Make it the app's own: replace SAMPLE with the real tab content and questions.
 */
import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Tabs and questions",
  title: "Everything about the beginner course",
  tabs: [
    { id: "overview", label: "Overview", heading: "Six Thursdays at the wheel", text: "Start from a lump of clay and leave with four finished pieces. Small groups of eight, all tools included, and a glaze night at the end." },
    { id: "schedule", label: "Schedule", heading: "6pm to 8:30pm, weekly", text: "Weeks one to three are centring and pulling walls. Week four is trimming. Weeks five and six are glazing and the final firing." },
    { id: "bring", label: "What to bring", heading: "Clothes you do not mind", text: "We supply clay, aprons and tools. Bring a towel, short nails help, and tie long hair back. Lockers are free." },
    { id: "price", label: "Price", heading: "$180 for the whole course", text: "Pay in full or in two parts. Firing and glaze costs are included. Miss a week and you can make it up on a Sunday." },
  ],
  faqTitle: "Common questions",
  faq: [
    { q: "Do I need any experience?", a: "None at all. Most people in the beginner course have never touched a wheel." },
    { q: "Can I cancel or move my place?", a: "Yes, up to 48 hours before the first class for a full refund, or move to the next course at no cost." },
    { q: "When can I take my pieces home?", a: "About ten days after the last class, once the final firing has cooled. We send a message when they are ready." },
    { q: "Is there parking nearby?", a: "There is free street parking after 6pm and a bike rack by the front door." },
  ],
};

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export default function NbTabsAccordion() {
  const d = SAMPLE;
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState<number[]>([0]);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function onTabKey(e: KeyboardEvent<HTMLButtonElement>) {
    const last = d.tabs.length - 1;
    let next = -1;
    if (e.key === "ArrowRight") next = active === last ? 0 : active + 1;
    else if (e.key === "ArrowLeft") next = active === 0 ? last : active - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next < 0) return;
    e.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  function toggle(i: number) {
    setOpen(open.includes(i) ? open.filter((n) => n !== i) : [...open, i]);
  }

  const allOpen = open.length === d.faq.length;
  const tab = d.tabs[active];

  return (
    <section className="fl-section fl-nb" aria-labelledby="nb-tabs-title">
      <div className="fl-wrap fl-wrap--narrow fl-nb-stack">
        <div className="fl-head">
          <p className="fl-nb-kicker">{d.eyebrow}</p>
          <h2 id="nb-tabs-title" className="fl-title">
            {d.title}
          </h2>
        </div>

        <div className="fl-nb-tabs">
          <div className="fl-nb-tablist" role="tablist" aria-label="Course details">
            {d.tabs.map((t, i) => (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`nb-tab-${t.id}`}
                className="fl-nb-tab"
                aria-selected={i === active}
                aria-controls={`nb-tabpanel-${t.id}`}
                tabIndex={i === active ? 0 : -1}
                onClick={() => setActive(i)}
                onKeyDown={onTabKey}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div
            className="fl-nb-box fl-nb-panel"
            role="tabpanel"
            id={`nb-tabpanel-${tab.id}`}
            aria-labelledby={`nb-tab-${tab.id}`}
            tabIndex={0}
          >
            <h3>{tab.heading}</h3>
            <p>{tab.text}</p>
          </div>
        </div>

        <div className="fl-nb-group" style={{ gap: "var(--space-4)" }}>
          <div className="fl-nb-row" style={{ justifyContent: "space-between" }}>
            <h3 className="fl-title fl-title--md" style={{ margin: 0 }}>
              {d.faqTitle}
            </h3>
            <button
              type="button"
              className="fl-nb-btn fl-nb-btn--sm fl-nb-btn--plain"
              onClick={() => setOpen(allOpen ? [] : d.faq.map((_, i) => i))}
            >
              {allOpen ? "Close all" : "Open all"}
            </button>
          </div>
          <ul className="fl-nb-acc">
            {d.faq.map((f, i) => {
              const isOpen = open.includes(i);
              return (
                <li key={f.q} className="fl-nb-box fl-nb-acc__item">
                  <h4 style={{ margin: 0 }}>
                    <button
                      type="button"
                      id={`nb-acc-btn-${i}`}
                      className="fl-nb-acc__btn"
                      aria-expanded={isOpen}
                      aria-controls={`nb-acc-panel-${i}`}
                      onClick={() => toggle(i)}
                    >
                      {f.q}
                      <span className="fl-nb-acc__sign">
                        <PlusIcon />
                      </span>
                    </button>
                  </h4>
                  <div id={`nb-acc-panel-${i}`} role="region" aria-labelledby={`nb-acc-btn-${i}`} className="fl-nb-acc__panel" hidden={!isOpen}>
                    <p>{f.a}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
