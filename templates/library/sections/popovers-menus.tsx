/** @flowcode-library popovers-menus · Popovers: a panel on a button, and how it differs from a tooltip (Dialogs and drawers)
 * Catalog ID: c.menu (component)
 * Function: The action menu (c.menu) and the panel on a button (c.popover); the reference sheet shows a filter form, a share panel, a card on a name, an arrow-key action menu and the same menu as an icon-only row button with type-ahead.
 * Use it as: import { Menu } from "./popovers-menus"; <Menu label icon? iconOnly? align?="start"|"end" items={[{ id, label, icon?, keys?, danger?, disabled? }]} onSelect={(id) => ...} />  // iconOnly: a quiet three-dot button for a row; label then names it for screen readers  // Also import { Popover }: <Popover variant?="button"|"link" label icon? count? chevron? panelLabel wide? align?="start"|"end" onDismiss?>{(close) => body}</Popover>; align="end" lines the panel up with the trigger's right edge
 * Look: A secondary button that opens a raised list of one-press actions with icons and shortcut hints; arrow keys move, Enter chooses, Escape closes and returns focus.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-danger --color-text-muted --radius-sm --radius-md --shadow-md --space-2 --space-3
 * Also: c.popover (component)
 *   Use it as: import { Popover } from "./popovers-menus"; <Popover variant?="button"|"link" label icon? count? chevron? panelLabel wide? onDismiss?>{(close) => body}</Popover>
 *   Variants: c.popover.button - a filter, share or date panel: a secondary button (optional icon, count, arrow) that opens a small panel under it; c.popover.link - a card about a name in running text: an underlined accent word that opens a panel under it
 *   Look: A small raised panel anchored under the button or name that opened it, holding controls you can press; closes on Escape or a press outside and gives focus back.
 * Use cases: a filter panel; a date picker; a share panel; a profile card on a name; an action menu; row actions; file list actions; document list; item management; context menu; project list; record actions
 * Jobs to be done: change a few things without leaving the page; look something up in place; act on one row; rename or duplicate an item; delete something i no longer need; share a link to an item; undo a mistake quickly
 * Keywords: popover, menu, dropdown panel, flyout, anchored, placement, dismiss, aria-expanded, dropdown, actions, kebab, keyboard
 */
/**
 * A popover is a small panel anchored to the control that opened it, holding things you can press. That last part is
 * what separates it from a tooltip: a tooltip closes when the pointer leaves, so nothing in one can be reached.
 *
 * All four open from their own button, close on Escape and on a press outside, and give focus back to the button they
 * came from. The filter panel keeps its changes until you apply them, which is the one thing a popover must get right:
 * it is a small form, not a menu, and closing it by accident should not throw the work away. The menu is the other
 * kind: a list of actions, one press each, that you move through with the arrow keys.
 *
 * Make it the app's own: anchor it to the control, never to the page. If it has more than about six things in it, it
 * wants to be a drawer.
 */
/**
 * How to try it
 * - Open the filter panel, change something, then press outside: your changes go back rather than half-applying.
 * - Press Apply to keep them; the count on the button follows.
 * - Open the menu, move with the arrow keys, press Enter to choose, Escape to leave.
 * - Escape closes any of the four, and focus goes back to the button it came from.
 *
 * Dependencies: React (useEffect, useRef, useState), the library's own Button, Badge, Checkbox, Radio, TextField and Avatar,
 * and its inline icon set ("./icons"), which is a table of SVG paths rather than an icon package. Nothing else — no package
 * to install and nothing fetched at run time. The styles are the library's own fl- classes in templates/library/css, and the
 * sample data is in the file, so the piece runs in a built app exactly as it runs here.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Avatar } from "./avatars-variants";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Checkbox, Radio } from "./checkboxes-radios";
import { Icon } from "./icons";
import { TextField } from "./text-fields-states";

/** Everything a button-anchored panel has to do, in one place: Escape, a press outside, and focus back to the button. */
function useAnchored(open: boolean, close: (via: "escape" | "outside") => void) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      close("escape");
      box.current?.querySelector<HTMLElement>("[aria-expanded]")?.focus();
    };
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) close("outside");
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open, close]);
  return box;
}

// ── c.menu: a list of actions that opens from a button. Arrow keys move, Enter chooses, Escape leaves. ──

export type MenuItem = { id: string; label: string; icon?: string; keys?: string; danger?: boolean; disabled?: boolean };

export function Menu({ label, icon, iconOnly, align = "start", items, onSelect, menuLabel, className }: {
  /** The words on the button that opens the menu. With iconOnly they name the button for screen readers instead. */
  label: string;
  /** An icon name from ./icons, before the label. With iconOnly it is the whole button; "more" (three dots) when left out. */
  icon?: string;
  /** A quiet icon-only trigger, for a menu on each row of a list. */
  iconOnly?: boolean;
  /** Which edge of the button the list lines up with; end for a button at the right of a row. */
  align?: "start" | "end";
  items: MenuItem[];
  /** Called with the chosen item's id; the menu closes and focus returns to the button. */
  onSelect: (id: string) => void;
  /** The menu's accessible name; the button label when left out. */
  menuLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  const box = useAnchored(open, () => setOpen(false));
  const typed = useRef("");
  const typedTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(typedTimer.current), []);

  // Real focus follows the highlighted item, so a screen reader announces it.
  useEffect(() => {
    if (open) list.current?.querySelectorAll<HTMLElement>('[role="menuitem"]')[active]?.focus();
  }, [open, active]);

  const enabled = (from: number, dir: 1 | -1) => {
    for (let n = 1; n <= items.length; n++) {
      const at = (from + dir * n + items.length * n) % items.length;
      if (!items[at].disabled) return at;
    }
    return from;
  };
  const openAt = (at: number) => {
    setActive(at);
    setOpen(true);
  };
  const run = (item: MenuItem) => {
    if (item.disabled) return;
    setOpen(false);
    box.current?.querySelector<HTMLElement>("[aria-haspopup]")?.focus();
    onSelect(item.id);
  };

  return (
    <div className={["fl-ctl-pop-wrap", className ?? ""].filter(Boolean).join(" ")} ref={box} data-fl="c.menu">
      <Button
        variant={iconOnly ? "tertiary" : "secondary"}
        size={iconOnly ? 32 : 40}
        icon={iconOnly ? (icon ?? "more") : icon}
        iconOnly={iconOnly}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openAt(enabled(-1, 1)))}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            openAt(e.key === "ArrowDown" ? enabled(-1, 1) : enabled(0, -1));
          }
        }}
      >
        {label}
        {iconOnly ? null : <Icon name="chevron-down" />}
      </Button>
      {open ? (
        <ul
          ref={list}
          className="fl-ctl-menu fl-ctl-menu--actions"
          style={{ position: "absolute", zIndex: 10, top: "calc(100% + var(--space-2))", ...(align === "end" ? { right: 0 } : { left: 0 }), minWidth: "14rem" }}
          role="menu"
          aria-label={menuLabel ?? label}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setActive(enabled(active, e.key === "ArrowDown" ? 1 : -1));
            } else if (e.key === "Home" || e.key === "End") {
              e.preventDefault();
              setActive(e.key === "Home" ? enabled(-1, 1) : enabled(0, -1));
            } else if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              run(items[active]);
            } else if (e.key === "Tab") {
              setOpen(false);
            } else if (e.key.length === 1 && /\S/.test(e.key) && !e.ctrlKey && !e.metaKey) {
              // Type-ahead: the first letters you type jump to the item that starts with them.
              window.clearTimeout(typedTimer.current);
              typed.current += e.key.toLowerCase();
              typedTimer.current = window.setTimeout(() => (typed.current = ""), 600);
              const starts = (n: number) => !items[n].disabled && items[n].label.toLowerCase().startsWith(typed.current);
              const order = items.map((_, n) => (active + (typed.current.length === 1 ? 1 : 0) + n) % items.length);
              const next = order.find(starts) ?? -1;
              if (next >= 0) {
                e.preventDefault();
                setActive(next);
              }
            }
          }}
        >
          {items.map((a, n) => (
            <li
              key={a.id}
              role="menuitem"
              aria-disabled={a.disabled || undefined}
              tabIndex={-1}
              className={`${a.danger ? "is-danger" : ""}${a.disabled ? " is-disabled" : ""}${n === active ? " is-hover" : ""}`}
              onMouseEnter={() => !a.disabled && setActive(n)}
              onClick={() => run(a)}
            >
              {a.icon ? <Icon name={a.icon} /> : null}
              {a.label}
              {a.keys ? <kbd className="fl-ctl-menu-keys">{a.keys}</kbd> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ── c.popover: a panel with several things in it, anchored to the button or name that opened it. ──

export type PopoverVariant = "button" | "link";

// Written out in full (not built from the variant name) so a build finds every class the popover needs.
const TRIGGER: Record<PopoverVariant, string> = { button: "", link: "fl-ctl-pop-name" };

export function Popover({ variant = "button", label, icon, count, chevron = true, panelLabel, wide, align = "start", onDismiss, children, className }: {
  /** button: a Button that opens the panel. link: the name in running text that opens a card. */
  variant?: PopoverVariant;
  /** The words on the button, or the name itself. */
  label: string;
  /** button only: an icon name from ./icons, before the label. */
  icon?: string;
  /** button only: a small count after the label, such as how many filters are on. 0 shows nothing. */
  count?: number;
  /** button only: the down arrow at the end. On by default. */
  chevron?: boolean;
  /** The panel's accessible name. */
  panelLabel: string;
  /** A 20rem panel instead of 16rem. */
  wide?: boolean;
  /** Which edge of the trigger the panel lines up with: start (left) by default; end opens it flush with the right edge so it stays on the page. */
  align?: "start" | "end";
  /** Called when it closes by Escape or a press outside (not by `close`), so a form can put its draft back. */
  onDismiss?: () => void;
  /** The panel's content. A function receives `close`, for an Apply or Copy button. */
  children: ReactNode | ((close: () => void) => ReactNode);
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  const box = useAnchored(open, () => {
    dismissRef.current?.();
    setOpen(false);
  });
  const close = () => setOpen(false);
  const toggle = () => setOpen((v) => !v);

  return (
    <div className={["fl-ctl-pop-wrap", className ?? ""].filter(Boolean).join(" ")} ref={box} data-fl={`c.popover.${variant}`}>
      {variant === "link" ? (
        <button type="button" className={TRIGGER.link} aria-expanded={open} aria-haspopup="dialog" onClick={toggle}>
          {label}
        </button>
      ) : (
        <Button variant="secondary" size={40} icon={icon} aria-expanded={open} aria-haspopup="dialog" onClick={toggle}>
          {label}
          {count ? (
            <Badge variant="status" tone="info" look="soft">
              {count}
            </Badge>
          ) : null}
          {chevron ? <Icon name="chevron-down" /> : null}
        </Button>
      )}
      {open ? (
        <div className={`fl-ctl-pop${wide ? " fl-ctl-pop--wide" : ""}`} role="dialog" aria-label={panelLabel} style={align === "end" ? { left: "auto", right: 0 } : undefined}>
          {typeof children === "function" ? children(close) : children}
        </div>
      ) : null}
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  filters: [
    { id: "enquiry", label: "Enquiry" },
    { id: "booked", label: "Booked" },
    { id: "shot", label: "Shot" },
    { id: "delivered", label: "Delivered" },
  ],
  share: ["Anyone with the link", "Only the client", "Only me"],
  actions: [
    { id: "edit", label: "Edit shoot", icon: "pencil", keys: "E" },
    { id: "duplicate", label: "Duplicate", icon: "copy", keys: "D" },
    { id: "export", label: "Export photos", icon: "download", disabled: true },
    { id: "delete", label: "Delete shoot", icon: "trash", danger: true },
  ],
};

function FilterPopover({ say }: { say: (s: string) => void }) {
  const [draft, setDraft] = useState<string[]>(["booked"]);
  const [applied, setApplied] = useState<string[]>(["booked"]);

  return (
    <Popover label="Status" icon="filter" count={applied.length} panelLabel="Filter by status" onDismiss={() => setDraft(applied)}>
      {(close) => (
        <>
          <ul className="fl-ctl-choice-list">
            {SAMPLE.filters.map((f) => (
              <li key={f.id}>
                <Checkbox
                  size={16}
                  label={f.label}
                  checked={draft.includes(f.id)}
                  onChange={() => setDraft((v) => (v.includes(f.id) ? v.filter((x) => x !== f.id) : [...v, f.id]))}
                />
              </li>
            ))}
          </ul>
          <div className="fl-ctl-pop-foot">
            <Button variant="tertiary" size={32} onClick={() => setDraft([])}>
              Clear
            </Button>
            <Button
              size={32}
              onClick={() => {
                setApplied(draft);
                close();
                say(draft.length ? `Filtered to ${draft.length} status${draft.length === 1 ? "" : "es"}` : "Filter cleared");
              }}
            >
              Apply
            </Button>
          </div>
        </>
      )}
    </Popover>
  );
}

function SharePopover({ say }: { say: (s: string) => void }) {
  const [who, setWho] = useState(SAMPLE.share[1]);

  return (
    <Popover label="Share" icon="send" chevron={false} wide panelLabel="Share this gallery">
      {(close) => (
        <>
          <p className="fl-ctl-matrix-kind">Who can open it</p>
          <ul className="fl-ctl-choice-list">
            {SAMPLE.share.map((s) => (
              <li key={s}>
                <Radio size={16} name="share-who" label={s} checked={who === s} onChange={() => setWho(s)} />
              </li>
            ))}
          </ul>
          <div className="fl-ctl-pop-link">
            <TextField size={32} readOnly value="northlight.example/g/riverside" aria-label="Link to this gallery" />
            <Button
              size={32}
              icon="copy"
              onClick={() => {
                close();
                say(`Link copied — ${who.toLowerCase()}`);
              }}
            >
              Copy
            </Button>
          </div>
        </>
      )}
    </Popover>
  );
}

function CardPopover() {
  return (
    <Popover variant="link" label="Ana Moreau" panelLabel="About Ana Moreau">
      <div className="fl-ctl-pop-person">
        <Avatar name="Ana Moreau" size={40} decorative />
        <span>
          <strong>Ana Moreau</strong>
          <span className="fl-ctl-matrix-what">Second photographer &middot; here since 2021</span>
        </span>
      </div>
      <p className="fl-ctl-matrix-what">On four shoots this month. Last signed in an hour ago.</p>
      <div className="fl-ctl-pop-foot">
        <Button variant="secondary" size={32} icon="mail">
          Message
        </Button>
      </div>
    </Popover>
  );
}

export default function PopoversMenus() {
  const [said, setSaid] = useState("");
  return (
    <section className="fl-section fl-section--specimen">
      <ul className="fl-ctl-pop-list">
        <li>
          <p className="fl-ctl-matrix-kind">A small form</p>
          <p className="fl-ctl-matrix-what">Change several things, then apply. Pressing outside puts your changes back rather than keeping half of them.</p>
          <FilterPopover say={setSaid} />
        </li>
        <li>
          <p className="fl-ctl-matrix-kind">A panel with one job</p>
          <p className="fl-ctl-matrix-what">A choice and the thing it produces, side by side.</p>
          <SharePopover say={setSaid} />
        </li>
        <li>
          <p className="fl-ctl-matrix-kind">On a name</p>
          <p className="fl-ctl-matrix-what">A card about whatever you pressed. Anchored to the word, not the page.</p>
          <CardPopover />
        </li>
        <li>
          <p className="fl-ctl-matrix-kind">Aligned to the right edge</p>
          <p className="fl-ctl-matrix-what">align=&quot;end&quot; opens the panel flush with the trigger&apos;s right edge, for a button at the end of a bar.</p>
          <Popover label="Sort" icon="filter" align="end" panelLabel="Sort the gallery">
            {(close) => (
              <>
                <p className="fl-ctl-matrix-what">Newest first, oldest first, or by client.</p>
                <div className="fl-ctl-pop-foot">
                  <Button size={32} onClick={() => (setSaid("Sorted."), close())}>Done</Button>
                </div>
              </>
            )}
          </Popover>
        </li>
        <li>
          <p className="fl-ctl-matrix-kind">An action menu</p>
          <p className="fl-ctl-matrix-what">One press per action, and it closes. Arrow keys move, Enter chooses.</p>
          <Menu label="Shoot actions" icon="more" items={SAMPLE.actions} onSelect={(id) => setSaid(`Chose ${SAMPLE.actions.find((a) => a.id === id)?.label}`)} />
        </li>
        <li>
          <p className="fl-ctl-matrix-kind">A menu on a row</p>
          <p className="fl-ctl-matrix-what">An icon-only button for a list, lined up to its right edge. Type a letter to jump to an item.</p>
          <Menu iconOnly align="end" label="Actions for Riverside wedding" items={SAMPLE.actions} onSelect={(id) => setSaid(`Chose ${SAMPLE.actions.find((a) => a.id === id)?.label} on the row`)} />
        </li>
      </ul>

      <p className="fl-ctl-status" role="status" aria-live="polite">
        {said || "Open one, then press Escape, or press outside it."}
      </p>

      <div className="fl-ctl-sizes">
        <h3>Popover, tooltip or menu</h3>
        <ul className="fl-ctl-tip-rules">
          <li>
            <strong>Tooltip</strong>
            <span className="fl-ctl-matrix-what">Names a control. Nothing inside it can be pressed. Opens on hover and on focus.</span>
          </li>
          <li>
            <strong>Menu</strong>
            <span className="fl-ctl-matrix-what">A list of actions, one press each, and it closes. Arrow keys move through it.</span>
          </li>
          <li>
            <strong>Popover</strong>
            <span className="fl-ctl-matrix-what">A panel with several things in it. Opens on press only, and stays until you are done.</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
