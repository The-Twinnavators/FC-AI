/** @flowcode-library table-selectable · Selectable table (selectable) (Tables and lists)
 * Catalog ID: p.data-table@selectable (pattern version)
 * Version of: p.data-table
 * Function: A table with row checkboxes, select-all with a mixed state, and a bulk-action bar to mark done or delete, with undo.
 * Use it as: import { DataTable } from "./tables-states"; <DataTable version="selectable" caption="To-dos" columns={[{ id, label, render? }]} rows={[{ id, ... }]} selected?={ids} onSelectionChange?={setIds} bulk?={(ids, clear) => <Button …>Mark done</Button>} emptyTitle? emptyHint? />
 * Look: A framed table with a tick box on every row and a select-all that shows a mixed state; ticked rows tint, a bar above the table counts them and holds the bulk actions, finished rows are struck through and an Undo message follows each action.
 * Tokens: --color-surface --color-border --color-accent --color-text-muted --color-success --text-sm --space-3 --space-4 --focus-ring
 * Use cases: bulk actions; task list; inbox management; order processing; admin table; file manager; user management; moderation queue
 * Jobs to be done: handle many items at once; mark several tasks as done; delete items in bulk; undo a bulk change
 * Keywords: table, checkbox, select, bulk actions, undo
 */
/**
 * Table: select rows and act on many at once. This is p.data-table@selectable with this piece's sample content; the
 * implementation lives in the pattern, in ./tables-states. Row checkboxes, a select-all box (with a mixed state when
 * only some are picked) and a bar of bulk actions that appears once anything is selected, with an undo message after
 * each action. Use it for to-do lists, orders to process or messages to clear. Make it the app's own: replace SAMPLE
 * with real rows and swap the two bulk actions for the ones people need most.
 */
import { SelectableTodos } from "./tables-states";

// flowcode:sample
const SAMPLE = {
  title: "Studio to-dos",
  lede: "Tick the jobs you've handled, then mark them done or clear them in one go.",
  rows: [
    { id: "t1", task: "Order backdrop paper (gray, 2.7m)", who: "Maya", due: "Today", done: false },
    { id: "t2", task: "Edit Tom Reyes product shots", who: "Jonah", due: "Today", done: false },
    { id: "t3", task: "Send deposit reminder to Ana", who: "Maya", due: "Tomorrow", done: false },
    { id: "t4", task: "Charge camera batteries for Saturday", who: "Elif", due: "Fri 9 Oct", done: false },
    { id: "t5", task: "Book cleaner for the studio", who: "Jonah", due: "Fri 9 Oct", done: true },
    { id: "t6", task: "Back up last week's sessions", who: "Elif", due: "Sun 11 Oct", done: false },
  ],
  emptyTitle: "All clear",
  emptyText: "No to-dos left. New jobs you add will show up here.",
};

export default function TableSelectable() {
  return <SelectableTodos {...SAMPLE} />;
}
