/** @flowcode-library panels-drawers · Panels and drawers: side, bottom and inline (Dialogs and drawers)
 * Catalog ID: c.drawer (component)
 * Function: The one drawer (c.drawer) that arrives beside what you are looking at, closing on its button, the scrim or Escape; the reference sheet shows the side, bottom and inline kinds, and the same drawer as a full-window overlay.
 * Use it as: import { Drawer } from "./panels-drawers"; <Drawer side?="right"|"bottom"|"inline" open onClose={(via) => ...} title eyebrow? label? behind? actions? overlay? version?="standard"|"side-panel"|"action-sheet" hint? options? onSelect? closeLabel?>body</Drawer>  // version: side-panel = c.drawer@side-panel, action-sheet = c.drawer@action-sheet (both always a full-window overlay; hint/options/onSelect/closeLabel are action-sheet only)  // overlay: a full-window drawer or bottom sheet (scrim, focus trap, scroll lock, focus return); omit it for a contained demo
 * Variants: c.drawer.right - record detail or settings beside a page: slides in over the page from the right edge (with overlay, a full-height panel over the whole window); c.drawer.bottom - the same job on a phone: rises from the bottom edge with rounded top corners (with overlay, a bottom sheet with a grab handle over the whole window); c.drawer.inline - a detail pane next to a list: takes space from the page and covers nothing
 * Look: A white panel with a title and close button on top, a scrolling body and a footer for actions, sliding in over a dimmed scrim (or beside the content when inline).
 * Tokens: --color-surface --color-surface-sunken --color-border --radius-md --radius-lg --space-2 --space-3 --space-4 --duration-med --duration-fast --easing --color-border-strong --shadow-lg
 * Use cases: record detail beside a list; filters panel; mobile actions sheet; settings pane; help panel; record details; edit panel; order details; contact details; task details; ticket details; quick view; inspector panel; mobile action menu; more options; share menu; item actions; mobile context menu; quick actions
 * Jobs to be done: look at one thing without losing the list; change filters and see the result; act on a row; see the details of an item; edit an item without losing my place; check an order while scanning the list; update a record quickly; share an item with someone; duplicate or archive an item; reach more actions on my phone
 * Keywords: drawer, panel, side sheet, bottom sheet, slide over, detail, side panel, details, edit, action sheet, mobile, more menu
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
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";

// ── c.drawer: the one drawer. Every piece's side sheets, bottom sheets and detail panes are this component. ──

export type DrawerSide = "right" | "bottom" | "inline";

/**
 * The design: standard (the contained or overlay drawer), side-panel (the original record drawer: a plain close button, a
 * scrolling body, always a full-window drawer from the right) or action-sheet (the original phone sheet: a grab handle and a
 * list of actions, always a full-window sheet from the bottom).
 */
export type DrawerVersion = "standard" | "side-panel" | "action-sheet";

/** One row of an action-sheet: an icon, a label with an optional hint under it, and danger for the destructive one (put it last). */
export type DrawerOption = { id: string; label: string; hint?: string; icon?: string; danger?: boolean };

// Written out in full (not built from the side name) so a build finds every class the drawer needs.
const STAGE: Record<DrawerSide, string> = {
  right: "fl-ctl-stage--side",
  bottom: "fl-ctl-stage--bottom",
  inline: "fl-ctl-stage--inline",
};

// Over the whole window (overlay): the dialog classes, again written out in full.
const OVERLAY_BACKDROP: Record<"right" | "bottom", string> = {
  right: "fl-dlg-backdrop fl-dlg-backdrop--drawer",
  bottom: "fl-dlg-backdrop fl-dlg-backdrop--sheet",
};
const OVERLAY_PANEL: Record<"right" | "bottom", string> = {
  right: "fl-dlg-drawer",
  bottom: "fl-dlg-sheet",
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Drawer({ side: sideProp = "right", version = "standard", open, onClose, title, eyebrow, hint, options, onSelect, closeLabel = "Close", label, behind, actions, overlay: overlayProp, children, className }: {
  /** Where it arrives from: the right edge, the bottom edge, or inline beside the content. The versions fix it themselves. */
  side?: DrawerSide;
  /** Which design: "standard" (default), "side-panel" or "action-sheet". The two versions are always a full-window overlay. */
  version?: DrawerVersion;
  /** action-sheet only: a line of context under the title, such as "Choose what to do with this list." */
  hint?: ReactNode;
  /** action-sheet only: the actions, each a row with an icon, a label and an optional hint. */
  options?: DrawerOption[];
  /** action-sheet only: called with the chosen option's id; the parent closes the sheet. */
  onSelect?: (id: string) => void;
  /** action-sheet only: the words on the full-width button at the bottom. */
  closeLabel?: string;
  open: boolean;
  /** Called with how it was closed, so the parent can say so. The parent flips `open`. */
  onClose: (via: "button" | "scrim" | "escape") => void;
  /** The heading in the drawer's top bar. */
  title: string;
  /** overlay only: a small label above the title, such as "Booking details". */
  eyebrow?: string;
  /** The drawer's accessible name; the title when left out. */
  label?: string;
  /** The content the drawer sits beside or over. It stays in the page and is hidden from screen readers while drawn here. */
  behind?: ReactNode;
  /** The footer: usually a primary and a secondary Button. */
  actions?: ReactNode;
  /**
   * A real app drawer over the whole window instead of a contained demo: a scrim over the page, a focus trap, the page
   * behind stops scrolling, and focus goes back to what opened it. Not drawn at all while closed. Needs side right or
   * bottom (inline has nothing to cover). Put the page itself outside the Drawer; `behind` is not used.
   */
  overlay?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const name = label ?? title;
  const id = useId();
  const side: DrawerSide = version === "side-panel" ? "right" : version === "action-sheet" ? "bottom" : sideProp;
  const overlay = overlayProp || version !== "standard";
  const over = overlay && side !== "inline";
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Overlay: focus goes in, Tab stays inside, Escape closes, the page stops scrolling, and focus returns on close.
  useEffect(() => {
    const box = panel.current;
    if (!over || !open || !box) return;
    const from = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const able = () => [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
    (box.querySelector<HTMLElement>("[data-autofocus]") ?? able()[0] ?? box).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current("escape");
        return;
      }
      if (e.key !== "Tab") return;
      const list = able();
      if (!list.length) {
        e.preventDefault();
        box.focus();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const at = document.activeElement;
      if (e.shiftKey && (at === first || !box.contains(at))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (at === last || !box.contains(at))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      if (from && from.isConnected) from.focus();
    };
  }, [over, open]);

  // A closed drawer is out of the tab order and the accessibility tree; an open one closes on Escape.
  useEffect(() => {
    if (over) return;
    panel.current?.toggleAttribute("inert", !open);
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose("escape");
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, over]);

  if (over) {
    if (!open) return null;
    const kind = side === "bottom" ? "bottom" : "right";
    if (version === "side-panel") {
      return (
        <div
          className={[OVERLAY_BACKDROP.right, className ?? ""].filter(Boolean).join(" ")}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose("scrim");
          }}
        >
          <div ref={panel} className={OVERLAY_PANEL.right} data-fl="c.drawer@side-panel" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} tabIndex={-1}>
            <div className="fl-dlg-drawer__head">
              <div style={{ display: "grid", gap: "var(--space-1)" }}>
                {eyebrow ? <span className="fl-eyebrow">{eyebrow}</span> : null}
                <h2 id={`${id}-title`} className="fl-dlg-title">
                  {title}
                </h2>
              </div>
              <button type="button" className="fl-dlg-close" aria-label="Close" onClick={() => onClose("button")}>
                <Icon name="close" />
              </button>
            </div>
            <div className="fl-dlg-drawer__body">{children}</div>
            {actions ? <div className="fl-dlg-drawer__foot">{actions}</div> : null}
          </div>
        </div>
      );
    }
    if (version === "action-sheet") {
      return (
        <div
          className={[OVERLAY_BACKDROP.bottom, className ?? ""].filter(Boolean).join(" ")}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose("scrim");
          }}
        >
          <div
            ref={panel}
            className={OVERLAY_PANEL.bottom}
            data-fl="c.drawer@action-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-title`}
            aria-describedby={hint ? `${id}-hint` : undefined}
            tabIndex={-1}
          >
            <span className="fl-dlg-handle" aria-hidden="true" />
            <div className="fl-dlg-sheet__head">
              <h2 id={`${id}-title`} className="fl-dlg-title" style={{ fontSize: "var(--text-lg)" }}>
                {title}
              </h2>
              {hint ? (
                <p id={`${id}-hint`} className="fl-note" style={{ margin: 0 }}>
                  {hint}
                </p>
              ) : null}
            </div>
            {options?.length ? (
              <ul className="fl-dlg-options">
                {options.map((o) => (
                  <li key={o.id}>
                    <button type="button" className={o.danger ? "fl-dlg-option fl-dlg-option--danger" : "fl-dlg-option"} onClick={() => onSelect?.(o.id)}>
                      {o.icon ? <Icon name={o.icon} /> : null}
                      <span>
                        {o.label}
                        {o.hint ? <small>{o.hint}</small> : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {children}
            <Button variant="secondary" block onClick={() => onClose("button")}>
              {closeLabel}
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div
        className={[OVERLAY_BACKDROP[kind], className ?? ""].filter(Boolean).join(" ")}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose("scrim");
        }}
      >
        <div ref={panel} className={OVERLAY_PANEL[kind]} data-fl={`c.drawer.${side}`} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} tabIndex={-1}>
          {kind === "bottom" ? <span className="fl-dlg-handle" aria-hidden="true" /> : null}
          <div className={kind === "bottom" ? "fl-dlg-sheet__head" : "fl-dlg-drawer__head"}>
            <div style={{ display: "grid", gap: "var(--space-1)" }}>
              {eyebrow ? <span className="fl-eyebrow">{eyebrow}</span> : null}
              <h2 id={`${id}-title`} className="fl-dlg-title">
                {title}
              </h2>
            </div>
            <Button variant="tertiary" size={32} icon="close" iconOnly onClick={() => onClose("button")}>
              {`Close the ${name.toLowerCase()}`}
            </Button>
          </div>
          {kind === "bottom" ? children : <div className="fl-dlg-drawer__body">{children}</div>}
          {actions ? <div className={kind === "bottom" ? "fl-dlg-foot" : "fl-dlg-drawer__foot"}>{actions}</div> : null}
        </div>
      </div>
    );
  }

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
  const [over, setOver] = useState<"" | "right" | "bottom">("");
  const [ver, setVer] = useState<"" | "side-panel" | "action-sheet">("");

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
      <div className="fl-ctl-sizes">
        <h3>Over the whole page</h3>
        <p className="fl-ctl-btn-what">
          In an app a drawer usually covers the window, not a box. Add overlay and it does: a scrim over the page, Tab stays
          inside, the page behind stops scrolling, Escape or the scrim closes it, and focus goes back to the button.
        </p>
        <div className="fl-ctl-tip-bar">
          <Button variant="secondary" size={40} aria-haspopup="dialog" onClick={() => setOver("right")}>
            Open a side drawer over the page
          </Button>
          <Button variant="secondary" size={40} aria-haspopup="dialog" onClick={() => setOver("bottom")}>
            Open a bottom sheet over the page
          </Button>
        </div>
        <Drawer
          overlay
          side={over || "right"}
          open={over !== ""}
          eyebrow="Booking details"
          title={d.record.title}
          onClose={(via) => {
            setOver("");
            setStatus(via === "escape" ? "Closed with Escape." : "Closed.");
          }}
          actions={
            <>
              <Button variant="secondary" size={40} onClick={() => (setOver(""), setStatus("Closed."))}>
                Cancel
              </Button>
              <Button size={40} onClick={() => (setOver(""), setStatus("Saved and closed."))}>
                Save changes
              </Button>
            </>
          }
        >
          <p className="fl-ctl-matrix-what">{d.record.meta}</p>
          <p className="fl-ctl-matrix-what">This one covers the window. Tab around: focus cannot leave it.</p>
        </Drawer>
      </div>
      <div className="fl-ctl-sizes">
        <h3>Versions</h3>
        <p className="fl-ctl-btn-what">Two older designs, chosen with version. Both cover the whole window; Escape, the scrim or the close button shuts them.</p>
        <div className="fl-ctl-tip-bar">
          <Button variant="secondary" size={40} aria-haspopup="dialog" onClick={() => setVer("side-panel")}>
            c.drawer@side-panel
          </Button>
          <Button variant="secondary" size={40} aria-haspopup="dialog" onClick={() => setVer("action-sheet")}>
            c.drawer@action-sheet
          </Button>
        </div>
        <Drawer
          version="side-panel"
          open={ver === "side-panel"}
          eyebrow="Booking details"
          title={d.record.title}
          onClose={(via) => {
            setVer("");
            setStatus(via === "escape" ? "Closed with Escape." : "Closed.");
          }}
          actions={
            <>
              <Button variant="secondary" onClick={() => setVer("")}>
                Cancel
              </Button>
              <Button onClick={() => (setVer(""), setStatus("Saved and closed."))}>Save changes</Button>
            </>
          }
        >
          <p className="fl-ctl-matrix-what">{d.record.meta}</p>
        </Drawer>
        <Drawer
          version="action-sheet"
          open={ver === "action-sheet"}
          title="Weekly groceries"
          hint="Choose what to do with this list."
          options={[
            { id: "share", label: "Share", hint: "Copy a link to send", icon: "send" },
            { id: "duplicate", label: "Duplicate", hint: "Make a copy to edit", icon: "copy" },
            { id: "archive", label: "Archive", hint: "Hide it from this page", icon: "folder", danger: true },
          ]}
          onSelect={(id) => (setVer(""), setStatus(`Chose ${id}.`))}
          onClose={() => setVer("")}
        />
      </div>
      <p className="fl-ctl-status" role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
