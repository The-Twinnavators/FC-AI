/** @flowcode-library sheet-bottom · Bottom sheet (action sheet) (Dialogs and drawers)
 * Catalog ID: c.drawer@action-sheet (component version)
 * Version of: c.drawer
 * Function: A phone-style More menu that opens a bottom sheet with Share, Duplicate and Archive.
 * Use it as: import { Drawer } from "./panels-drawers"; <Drawer version="action-sheet" open onClose={(via) => ...} title hint? options={[{ id, label, hint?, icon?, danger? }]} onSelect={(id) => ...} closeLabel?/>  // always a full-window sheet from the bottom; put the destructive option last
 * Look: A phone-style sheet rising from the bottom edge with a grab handle, a title and hint, a list of icon actions each with a small hint (the destructive one in red), and a full-width Close button.
 * Tokens: --color-surface --color-border --color-border-strong --color-danger --radius-xl --space-3 --space-4 --duration-slow --easing
 * Use cases: mobile action menu; more options; share menu; item actions; mobile context menu; quick actions
 * Jobs to be done: share an item with someone; duplicate or archive an item; reach more actions on my phone
 * Keywords: bottom sheet, action sheet, mobile, more menu
 */
/**
 * Bottom sheet: more actions. This is c.drawer@action-sheet with this piece's sample content; the implementation lives
 * in the component, in ./panels-drawers. A phone-style list where each item has a "More" button; it opens a sheet from
 * the bottom of the screen with Share, Duplicate and Archive. Make it the app's own: replace SAMPLE with the real items
 * and actions; keep the list short and put the destructive one last.
 */
import { useState } from "react";
import { Icon } from "./icons";
import { Drawer } from "./panels-drawers";

// flowcode:sample
const SAMPLE = {
  heading: "Household lists",
  lede: "Shared with everyone at home.",
  more: "More",
  sheetHint: "Choose what to do with this list.",
  options: [
    { id: "share", label: "Share", hint: "Copy a link to send", icon: "share" },
    { id: "duplicate", label: "Duplicate", hint: "Make a copy to edit", icon: "duplicate" },
    { id: "archive", label: "Archive", hint: "Hide it from this page", icon: "archive", danger: true },
  ],
  close: "Close",
  done: { share: "Link copied for", duplicate: "Made a copy of", archive: "Archived" },
  lists: [
    { id: "groceries", title: "Weekly groceries", meta: "14 items · edited today" },
    { id: "chores", title: "Saturday chores", meta: "6 items · edited yesterday" },
    { id: "trip", title: "Camping trip packing", meta: "22 items · edited last week" },
  ],
};

export default function SheetBottom() {
  const d = SAMPLE;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const active = d.lists.find((i) => i.id === activeId) ?? null;

  return (
    <section className="fl-section fl-section--tint" aria-labelledby="sheet-bottom-title">
      <div className="fl-wrap fl-dlg-stage">
        <div className="fl-dlg-phone">
          <div style={{ display: "grid", gap: "var(--space-1)" }}>
            <h2 id="sheet-bottom-title" className="fl-title fl-title--md">
              {d.heading}
            </h2>
            <p className="fl-note" style={{ margin: 0 }}>
              {d.lede}
            </p>
          </div>
          <ul className="fl-dlg-list">
            {d.lists.map((item) => (
              <li key={item.id} className="fl-dlg-row" style={{ flexWrap: "nowrap" }}>
                <span className="fl-dlg-row__main">
                  <strong>{item.title}</strong>
                  <span className="fl-meta">{item.meta}</span>
                </span>
                <button type="button" className="fl-dlg-more" aria-haspopup="dialog" onClick={() => setActiveId(item.id)}>
                  <Icon name="more" />
                  {d.more}
                  <span className="fl-sr"> for {item.title}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="fl-dlg-status fl-dlg-status--ok" role="status" aria-live="polite">
            {status}
          </p>
        </div>
      </div>
      <Drawer
        version="action-sheet"
        open={active !== null}
        title={active?.title ?? ""}
        hint={d.sheetHint}
        options={d.options}
        closeLabel={d.close}
        onSelect={(id) => {
          setStatus(`${d.done[id as keyof typeof d.done]} ${active?.title ?? ""}.`);
          setActiveId(null);
        }}
        onClose={() => setActiveId(null)}
      />
    </section>
  );
}
