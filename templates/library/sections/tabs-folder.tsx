/** @flowcode-library tabs-folder · Folder tabs (folder) (Tabs, breadcrumbs and paging)
 * Catalog ID: c.tabs@folder (component version)
 * Version of: c.tabs
 * Function: Folder tabs joined to their panel, switched with the arrow keys, Home and End, shown with the plus accordion below.
 * Use it as: import { Tabs } from "./tabs-variants"; <Tabs version="folder" tabs={[{ id, label, panel: <><h3/><p/></> }]} label="Course details" />
 * Built from: c.accordion@plus
 * Look: Folder tabs that join the panel below; the open tab shares the panel's surface and opens into it. Edges, corners, fill and shadow follow the chosen style and surface.
 * Tokens: --surface-border --surface-radius --surface-radius-sm --surface-bg --surface-shadow --surface-blur --edge-width --color-surface --color-surface-sunken --color-secondary-surface --color-accent --color-text --color-text-muted --control-lg --control-pad-lg --space-2 --space-3 --space-6 --text-sm --text-xl --focus-ring
 * Use cases: class details; plan comparison; product details; tabbed content; policies
 * Jobs to be done: read only the part i need; compare details between options
 * Keywords: tabs, folder tabs, keyboard, disclosure
 */
/**
 * Folder tabs and a plus accordion: c.tabs@folder and c.accordion@plus with this piece's sample content. The
 * implementations live in the components, in ./tabs-variants and ./accordion-variants.
 * Construction: folder tabs that join the panel below (the open tab shares the panel's surface and opens into it),
 * switched with the arrow keys, Home and End; then a stack of questions, each its own box, that open independently -
 * the open header fills with the accent and its plus turns into a cross.
 * Look: edges, corners, fill and shadow follow the chosen style and surface, so the same piece is flat, soft, glassy or
 * neobrutal depending on the surface style the app uses.
 * Use them for class details, plan comparisons or an FAQ.
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

export default function TabsFolder() {
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
    <section className="fl-section" aria-labelledby="tabs-folder-title">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="tabs-folder-title" className="fl-title">
            {d.title}
          </h2>
        </div>
        <Tabs version="folder" tabs={tabs} label={d.tabsLabel} />
        <h3 className="fl-title fl-title--md" style={{ margin: "var(--space-8) 0 var(--space-4)" }}>
          {d.faqTitle}
        </h3>
        <Accordion version="plus" multiple defaultOpen={[0]} items={d.faq} />
      </div>
    </section>
  );
}
