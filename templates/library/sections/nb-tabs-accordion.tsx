/** @flowcode-library nb-tabs-accordion · Neobrutal tabs and accordion (neobrutal) (Tabs, breadcrumbs and paging)
 * Catalog ID: c.tabs@neobrutal (component version)
 * Version of: c.tabs
 * Function: Folder-style tabs driven by arrow keys, Home and End, plus a chunky FAQ accordion with open-all and close-all.
 * Use it as: import { Tabs } from "./tabs-variants"; <Tabs version="neobrutal" tabs={[{ id, label, panel: <><h3/><p/></> }]} label="Course details" /> (also <Accordion version="neobrutal" multiple? defaultOpen?={[0]} items={[{ q, a }]} />, c.accordion@neobrutal)
 * Look: Thick-inked folder tabs that join a hard-shadowed panel, with an accent-filled open accordion header whose plus turns into a cross.
 * Tokens: --color-text --color-surface --color-accent --color-on-accent --color-secondary --radius-sm --space-2 --space-4 --space-5 --space-6 --weight-bold --text-xl --focus-ring
 * Use cases: faq; class details; plan comparison; product details; help section; tabbed content; policies
 * Jobs to be done: find answers to my questions; compare details between options; read only the part i need
 * Keywords: tabs, accordion, faq, keyboard, disclosure, neobrutalism
 */
/**
 * Neobrutalist tabs and accordion: c.tabs@neobrutal and c.accordion@neobrutal. The implementations live in the
 * components, in ./tabs-variants and ./accordion-variants. Folder-style tabs that switch with the arrow keys, Home
 * and End, and a stack of chunky questions that stay open independently. Use them for class details, plan
 * comparisons or an FAQ.
 * Make it the app's own: replace SAMPLE with the real tab content and questions.
 */
import { Tabs } from "./tabs-variants";
import { Accordion } from "./accordion-variants";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Tabs and questions",
  title: "Everything about the beginner course",
  tabsLabel: "Course details",
  tabs: [
    { id: "overview", label: "Overview", heading: "Six Thursdays at the wheel", text: "Start from a lump of clay and leave with four finished pieces. Small groups of eight, all tools included, and a glaze night at the end." },
    { id: "schedule", label: "Schedule", heading: "6pm to 8:30pm, weekly", text: "Weeks one to three are centering and pulling walls. Week four is trimming. Weeks five and six are glazing and the final firing." },
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

export default function NbTabsAccordion() {
  const d = SAMPLE;
  const tabs = d.tabs.map((t) => ({
    id: t.id,
    label: t.label,
    panel: (
      <>
        <h3>{t.heading}</h3>
        <p>{t.text}</p>
      </>
    ),
  }));
  return (
    <section className="fl-section fl-nb" aria-labelledby="nb-tabs-title">
      <div className="fl-wrap fl-wrap--narrow fl-nb-stack">
        <div className="fl-head">
          <p className="fl-nb-kicker">{d.eyebrow}</p>
          <h2 id="nb-tabs-title" className="fl-title">
            {d.title}
          </h2>
        </div>
        <Tabs version="neobrutal" tabs={tabs} label={d.tabsLabel} />
        <div className="fl-nb-group" style={{ gap: "var(--space-4)" }}>
          <h3 className="fl-title fl-title--md" style={{ margin: 0 }}>
            {d.faqTitle}
          </h3>
          <Accordion version="neobrutal" multiple defaultOpen={[0]} items={d.faq} />
        </div>
      </div>
    </section>
  );
}
