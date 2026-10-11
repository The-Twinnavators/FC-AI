/** @flowcode-library panels-drawers · Panels and drawers: side, bottom and inline (Dialogs and drawers)
 * Catalog ID: c.drawer (component)
 * Function: The one drawer (c.drawer) that arrives beside what you are looking at, closing on its button, the scrim or Escape; the reference sheet shows the side, bottom and inline kinds.
 * Use it as: import { Drawer } from "./panels-drawers"; <Drawer side?="right"|"bottom"|"inline" open onClose={(via) => ...} title label? behind? actions?>body</Drawer>
 * Variants: c.drawer.right - record detail or settings beside a page: slides in over the page from the right edge; c.drawer.bottom - the same job on a phone: rises from the bottom edge with rounded top corners; c.drawer.inline - a detail pane next to a list: takes space from the page and covers nothing
 * Look: A white panel with a title and close button on top, a scrolling body and a footer for actions, sliding in over a dimmed scrim (or beside the content when inline).
 * Tokens: --color-surface --color-surface-sunken --color-border --radius-md --radius-lg --space-2 --space-3 --space-4 --duration-med --duration-fast --easing
 * Use cases: record detail beside a list; filters panel; mobile actions sheet; settings pane; help panel
 * Jobs to be done: look at one thing without losing the list; change filters and see the result; act on a row
 * Keywords: drawer, panel, side sheet, bottom sheet, slide over, detail
 */
/**
 * Three ways to show something beside what you are already looking at, and the difference between them is how they
 * arrive: a side sheet slides in over the page, a bottom sheet rises from the bottom edge, an inline panel takes
 * space from the list and covers nothing. Open each one to see it.
 *
 * Make it the app's own: keep the close button, the title, and Escape. A drawer that cannot be closed by keyboard is
 * a trap. Motion is skipped for anyone who asks for less of it.
 */
/**
 * How to try it
 * - Press Open on any of the three: it slides in over a scrim.
 * - Press the scrim, the close button, or Escape to shut whichever is open.
 *
 * Dependencies: React (useEffect, useRef, useState), the library's own Button, and its inline icon set ("./icons"), which is
 * a table of SVG paths rather than an icon package. Nothing else — no package to install and nothing fetched at run time.
 * The styles are the library's own fl- classes in templates/library/css, and the sample data is in the file, so the piece
 * runs in a built app exactly as it runs here.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "./buttons-variants";

// ── c.drawer: the one drawer. Every piece's side sheets, bottom sheets and detail panes are this component. ──

export type DrawerSide = "right" | "bottom" | "inline";

// Written out in full (not built from the side name) so a build finds every class the drawer needs.
const STAGE: Record<DrawerSide, string> = {
  right: "fl-ctl-stage--side",
  bottom: "fl-ctl-stage--bottom",
  inline: "fl-ctl-stage--inline",
};

export function Drawer({ side = "right", open, onClose, title, label, behind, actions, children, className }: {
  /** Where it arrives from: the right edge, the bottom edge, or inline beside the content. */
  side?: DrawerSide;
  open: boolean;
  /** Called with how it was closed, so the parent can say so. The parent flips `open`. */
  onClose: (via: "button" | "scrim" | "escape") => void;
  /** The heading in the drawer's top bar. */
  title: string;
  /** The drawer's accessible name; the title when left out. */
  label?: string;
  /** The content the drawer sits beside or over. It stays in the page and is hidden from screen readers while drawn here. */
  behind?: ReactNode;
  /** The footer: usually a primary and a secondary Button. */
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const name = label ?? title;

  // A closed drawer is out of the tab order and the accessibility tree; an open one closes on Escape.
  useEffect(() => {
    panel.current?.toggleAttribute("inert", !open);
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose("escape");
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className={["fl-ctl-stage", STAGE[side], className ?? ""].filter(Boolean).join(" ")} data-fl={`c.drawer.${side}`}>
      <div className="fl-ctl-stage-page" aria-hidden="true">
        {behind}
      </div>
      {side !== "inline" && open ? <div className="fl-ctl-scrim" onClick={() => onClose("scrim")} aria-hidden="true" /> : null}
      <div ref={panel} className={`fl-spec-panel${open ? " is-open" : ""}`} role="group" aria-label={name} aria-hidden={!open}>
        <header>
          <strong>{title}</strong>
          <Button variant="tertiary" size={32} icon="close" iconOnly onClick={() => onClose("button")}>
            {`Close the ${name.toLowerCase()}`}
          </Button>
        </header>
        <div className="fl-ctl-panel-body">{children}</div>
        {actions ? <footer>{actions}</footer> : null}
      </div>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  kinds: [
    { id: "right" as const, label: "Side sheet", what: "Over the page, from the right. Escape closes it." },
    { id: "bottom" as const, label: "Bottom sheet", what: "From the bottom edge: the same job on a phone." },
    { id: "inline" as const, label: "Inline panel", what: "Takes space from the list; nothing is covered." },
  ],
  record: { title: "Riverside wedding", meta: "12 June · Northlight Studio · 420 photos delivered" },
};

export default function PanelsDrawers() {
  const d = SAMPLE;
  const [open, setOpen] = useState<Record<string, boolean>>({ right: true, bottom: false, inline: false });
  const [status, setStatus] = useState("");

  const toggle = (id: string, label: string) => {
    setOpen((o) => ({ ...o, [id]: !o[id] }));
    setStatus(`${label} ${open[id] ? "closed" : "opened"}.`);
  };

  return (
    <section className="fl-section fl-section--specimen">
      <ul className="fl-ctl-panel-grid">
        {d.kinds.map((k) => (
          <li key={k.id}>
            <div className="fl-ctl-panel-head">
              <span>
                <span className="fl-ctl-matrix-kind">{k.label}</span>
                <span className="fl-ctl-matrix-what">{k.what}</span>
              </span>
              <Button variant="secondary" size={32} aria-expanded={open[k.id]} onClick={() => toggle(k.id, k.label)}>
                {open[k.id] ? "Close" : "Open"}
              </Button>
            </div>
            <Drawer
              side={k.id}
              open={open[k.id]}
              label={k.label}
              title={d.record.title}
              behind={
                <>
                  <span />
                  <span />
                  <span />
                </>
              }
              onClose={(via) => {
                setOpen((o) => ({ ...o, [k.id]: false }));
                setStatus(via === "escape" ? `${k.label} closed with Escape.` : `${k.label} closed.`);
              }}
              actions={
                <>
                  <Button size={32} onClick={() => (toggle(k.id, k.label), setStatus("Saved and closed."))}>
                    Save
                  </Button>
                  <Button variant="secondary" size={32} onClick={() => toggle(k.id, k.label)}>
                    Cancel
                  </Button>
                </>
              }
            >
              <p className="fl-ctl-matrix-what">{d.record.meta}</p>
              <p className="fl-ctl-matrix-what">The body scrolls on its own, so the header and the actions stay put.</p>
            </Drawer>
          </li>
        ))}
      </ul>
      <p className="fl-ctl-status" role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
