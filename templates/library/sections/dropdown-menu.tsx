/** @flowcode-library dropdown-menu · Actions menu (classic) (Dialogs and drawers)
 * Catalog ID: c.menu@classic (component version)
 * Version of: c.menu
 * Function: A "more" button on each row that opens a keyboard-operable menu with icons, a separator and a destructive Delete, plus inline rename, duplicate, copy link and undo.
 * Use it as: import { Menu } from "./popovers-menus"; <Menu version="classic" label="Actions for X" align?="start"|"end" items={[{ id, label, icon?, keys?, danger?, disabled?, separatorBefore? }]} onSelect={(id) => ...}/>  // label names the three-dot button for screen readers; separatorBefore draws a rule above an item
 * Look: A bordered square three-dot button that opens a compact list under it with small icons, right-aligned key hints, a thin rule before the red destructive item, and a moving highlight.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-danger --color-danger-surface --color-text-muted --radius-md --space-1 --space-2 --space-3 --duration-fast --easing
 * Use cases: row actions; file list actions; document list; item management; context menu; project list; record actions
 * Jobs to be done: rename or duplicate an item; delete something i no longer need; share a link to an item; undo a mistake quickly
 * Keywords: dropdown, menu, actions, kebab, keyboard
 */
/**
 * Actions menu: a "more" button on each row that opens a menu with icons, a separator and a destructive item. This is
 * c.menu@classic with this piece's sample content; the implementation lives in the component, in ./popovers-menus. Arrow
 * keys, Home, End and the first letter move through it; Escape closes it and focus goes back to the button.
 * Make it the app's own: replace SAMPLE with your records and the actions with your own.
 */
import { useState } from "react";
import { Menu } from "./popovers-menus";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Timetable",
  title: "Classes this month",
  classes: [
    { id: "c1", name: "Saturday wheel taster", meta: "Sat 10:00 · 6 of 8 places booked" },
    { id: "c2", name: "Glazing evening", meta: "Wed 18:30 · 4 of 10 places booked" },
    { id: "c3", name: "Kids' clay club", meta: "Sun 11:00 · Full" },
  ],
  actions: [
    { id: "rename", label: "Rename", icon: "pencil", keys: "R" },
    { id: "duplicate", label: "Duplicate", icon: "duplicate", keys: "D" },
    { id: "link", label: "Copy link", icon: "link", keys: "C" },
    { id: "delete", label: "Delete class", icon: "trash", danger: true, separatorBefore: true },
  ],
  copySuffix: " (copy)",
};

export default function DropdownMenu() {
  const d = SAMPLE;
  const [list, setList] = useState(d.classes);
  const [status, setStatus] = useState("");

  const run = (action: string, id: string) => {
    const cls = list.find((c) => c.id === id);
    if (!cls) return;
    if (action === "duplicate") {
      const at = list.indexOf(cls);
      setList([...list.slice(0, at + 1), { ...cls, id: `${cls.id}-copy`, name: cls.name + d.copySuffix }, ...list.slice(at + 1)]);
      setStatus(`Duplicated ${cls.name}.`);
    } else if (action === "delete") {
      setList(list.filter((c) => c.id !== id));
      setStatus(`Deleted ${cls.name}.`);
    } else {
      setStatus(`${action === "link" ? "Link copied for" : "Rename"} ${cls.name}.`);
    }
  };

  return (
    <section className="fl-section" aria-labelledby="dropdown-menu-title">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="dropdown-menu-title" className="fl-title">
            {d.title}
          </h2>
        </div>
        <ul className="fl-way-list">
          {list.map((c) => (
            <li key={c.id}>
              <div className="fl-way-list__main">
                <p className="fl-way-list__title">{c.name}</p>
                <p className="fl-way-list__meta">{c.meta}</p>
              </div>
              <Menu version="classic" label={`Actions for ${c.name}`} items={d.actions} onSelect={(action) => run(action, c.id)} />
            </li>
          ))}
        </ul>
        <p className="fl-way-status" role="status" aria-live="polite" style={{ marginTop: "var(--space-3)" }}>
          {status}
        </p>
      </div>
    </section>
  );
}
