/** @flowcode-library empty-state · Empty list state (illustrated) (Alerts and states)
 * Catalog ID: c.empty-state@illustrated (component version)
 * Version of: c.empty-state
 * Function: An empty list with a small token-colored drawing, helpful text and a primary action that adds the first item.
 * Use it as: import { EmptyState } from "./empty-states"; <EmptyState version="illustrated" title="Nothing on the list yet" art?={<svg/>} headingLevel?={2|3} before? action={<Button>Add your first item</Button>}>one sentence why</EmptyState>
 * Look: A roomy dashed-border panel with a drawn list illustration, a heading, one muted sentence and a single primary action.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-border-strong --color-accent --color-on-accent --text-lg --space-4 --space-5 --space-8
 * Use cases: empty list; first run; no projects yet; empty inbox; no tasks; empty cart; onboarding start; no saved items
 * Jobs to be done: add my first item; understand what goes here; get started with the product; know what to do next
 * Keywords: empty state, list, onboarding, zero data
 */
/**
 * Empty state: what a list shows before it has anything in it. A simple drawing, a title, a line that says what the
 * list is for, and one primary action that adds the first item. This is c.empty-state@illustrated with this piece's
 * sample content; the implementation lives in the component, in ./empty-states. Make it the app's own: replace SAMPLE
 * with the real list's words and point the action at the app's own create flow.
 */
import { EmptyState as EmptyStateBlock } from "./empty-states";
import { Button } from "./buttons-variants";

// flowcode:sample
const SAMPLE = {
  title: "Your shopping list",
  empty: {
    title: "Nothing on the list yet",
    text: "Add what the house needs this week. Everyone at home sees the same list, so nobody buys milk twice.",
    action: "Add your first item",
  },
};

export default function EmptyState() {
  const d = SAMPLE;
  return (
    <section className="fl-section" aria-labelledby="empty-state-title">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-alr-empty__head">
          <h2 id="empty-state-title" className="fl-title fl-title--md">
            {d.title}
          </h2>
        </div>
        <EmptyStateBlock version="illustrated" title={d.empty.title} action={<Button size={40}>{d.empty.action}</Button>}>
          {d.empty.text}
        </EmptyStateBlock>
      </div>
    </section>
  );
}
