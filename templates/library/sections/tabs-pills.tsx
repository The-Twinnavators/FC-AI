/** @flowcode-library tabs-pills · Pill tabs (pill) (Tabs, breadcrumbs and paging)
 * Catalog ID: c.tabs@pill (component version)
 * Version of: c.tabs
 * Function: Rounded pill tabs with live counts and one tab panel, using arrow keys, Home and End with roving tabindex, where each order can be moved on to the next stage.
 * Use it as: import { Tabs } from "./tabs-variants"; <Tabs version="pill" tabs={[{ id, label, count?, panel }]} label="Order stages" countNoun?="orders" />
 * Look: Separate rounded pills in a row; the open one fills with the accent and its count bubble inverts.
 * Tokens: --color-accent --color-on-accent --color-border --color-border-strong --color-text --color-text-muted --space-1 --space-2 --radius-lg --focus-ring
 * Use cases: order queue; status tabs; order fulfilment; pipeline stages; ticket queue; task stages; filtered list views; kitchen orders
 * Jobs to be done: sort work into stages; move an order to the next stage; see how many items are waiting; focus on one group at a time
 * Keywords: tabs, pills, counts, tablist, keyboard
 */
/**
 * Pill tabs: c.tabs@pill. The implementation lives in the component, in ./tabs-variants. Rounded tabs with live
 * counts and one tab panel, operated with arrow keys, Home and End (roving tabindex). Use it to sort one list into a
 * few stages, such as orders that are new, ready or collected.
 * Make it the app's own: replace SAMPLE with your stages and items.
 */
import { Tabs } from "./tabs-variants";

// flowcode:sample
const SAMPLE = {
  tabsLabel: "Order stages",
  stages: [
    { id: "new", label: "New", empty: "No new orders. New ones show up here." },
    { id: "ready", label: "Ready to collect", empty: "Nothing is waiting on the shelf." },
    { id: "collected", label: "Collected", empty: "No orders collected yet today." },
  ],
  orders: [
    { id: "A-2041", name: "Ana Ruiz", items: "2 speckled mugs, 1 bowl", stage: "new" },
    { id: "A-2042", name: "Tom Okafor", items: "Glaze sampler set", stage: "new" },
    { id: "A-2043", name: "Mei Lin", items: "Serving platter", stage: "new" },
    { id: "A-2039", name: "Sam Patel", items: "4 espresso cups", stage: "ready" },
    { id: "A-2040", name: "Jo Byrne", items: "Plant pot, saucer", stage: "ready" },
  ],
};

export default function TabsPills() {
  const d = SAMPLE;
  const tabs = d.stages.map((s) => {
    const shown = d.orders.filter((o) => o.stage === s.id);
    return {
      id: s.id,
      label: s.label,
      count: shown.length,
      panel:
        shown.length === 0 ? (
          <div className="fl-way-empty">
            <p>{s.empty}</p>
          </div>
        ) : (
          <ul className="fl-way-list">
            {shown.map((o) => (
              <li key={o.id}>
                <div className="fl-way-list__main">
                  <p className="fl-way-list__title">
                    {o.name} <span className="fl-way-num">{o.id}</span>
                  </p>
                  <p className="fl-way-list__meta">{o.items}</p>
                </div>
              </li>
            ))}
          </ul>
        ),
    };
  });
  return (
    <section className="fl-section fl-section--tint">
      <div className="fl-wrap fl-wrap--narrow">
        <Tabs version="pill" tabs={tabs} label={d.tabsLabel} countNoun="orders" />
      </div>
    </section>
  );
}
