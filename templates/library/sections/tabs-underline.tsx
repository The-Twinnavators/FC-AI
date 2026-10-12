/** @flowcode-library tabs-underline · Underline tabs (underline-slide) (Tabs, breadcrumbs and paging)
 * Catalog ID: c.tabs@underline-slide (component version)
 * Version of: c.tabs
 * Function: Accessible tabs with an underline that slides to the active tab, optional counts, and arrow, Home and End keys.
 * Use it as: import { Tabs } from "./tabs-variants"; <Tabs version="underline-slide" tabs={[{ id, label, count?, panel }]} label="Chores" countNoun?="items" />
 * Look: A flat tab row on a hairline where one accent underline slides and stretches to the open tab, with small count bubbles.
 * Tokens: --color-accent --color-border --color-text --color-text-muted --color-surface-sunken --space-1 --space-2 --space-4 --weight-medium --weight-semibold --text-sm --duration-base --easing --focus-ring
 * Use cases: section tabs; profile tabs; inbox folders; order status tabs; settings sections; project views; dashboard views
 * Jobs to be done: switch between views quickly; see how many items are in each group; find the right section of a page
 * Keywords: tabs, underline, navigation, counts
 */
/**
 * Underline tabs: c.tabs@underline-slide. The implementation lives in the component, in ./tabs-variants. Accessible
 * tabs with an underline that slides to the open tab, optional count badges, and arrow keys, Home and End to move
 * between them. Use it to split one page into a few views of the same thing.
 * Make it the app's own: replace SAMPLE with your tabs and their content; counts are optional per tab.
 */
import { Tabs } from "./tabs-variants";

// flowcode:sample
const SAMPLE = {
  tabsLabel: "Chores",
  emptyText: "Nothing here. Enjoy the free time.",
  tabs: [
    { id: "today", label: "Today", items: ["Water the plants", "Take the recycling out", "Book the boiler check"] },
    { id: "week", label: "This week", items: ["Clean the oven", "Change the bed sheets", "Pay the window cleaner", "Sort the post", "Defrost the freezer"] },
    { id: "later", label: "Later", items: ["Paint the hallway", "Clear out the shed"] },
    { id: "done", label: "Done", items: [] as string[], noCount: true },
  ],
};

export default function TabsUnderline() {
  const d = SAMPLE;
  const tabs = d.tabs.map((t) => ({
    id: t.id,
    label: t.label,
    count: "noCount" in t ? undefined : t.items.length,
    panel:
      t.items.length === 0 ? (
        <p className="fl-ctl-empty">{d.emptyText}</p>
      ) : (
        <ul className="fl-ctl-list">
          {t.items.map((x) => (
            <li key={x} className="fl-ctl-row" style={{ gridTemplateColumns: "auto minmax(0, 1fr)" }}>
              <span className="fl-ctl-led fl-ctl-tone-progress" aria-hidden="true" />
              <p className="fl-ctl-row__title">{x}</p>
            </li>
          ))}
        </ul>
      ),
  }));
  return (
    <section className="fl-section">
      <div className="fl-wrap fl-wrap--narrow">
        <Tabs version="underline-slide" tabs={tabs} label={d.tabsLabel} countNoun="items" />
      </div>
    </section>
  );
}
