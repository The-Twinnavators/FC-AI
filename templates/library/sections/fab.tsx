/** @flowcode-library fab · Floating action button: one main action, extended or with a menu (Forms)
 * Catalog ID: c.fab (component)
 * Function: The floating action button (c.fab): a phone screen's main action within thumb reach, in three sizes, extended with a label that folds while scrolling, or opening a short menu of related actions.
 * Use it as: import { Fab } from "./fab"; <Fab variant?="fab"|"extended"|"menu" label="New booking" icon="plus" size?="small"|"regular"|"large" onClick? actions?={[{ id, label, icon }]} onAction?={(id) => ...} scrollBox?={ref} fixed?={true} aboveNav? />  // one per screen, for its main action
 * Variants: c.fab.fab - a screen's one main action as a rounded square icon button floating in the bottom corner, in three sizes; c.fab.extended - the main action with its label beside the icon; it folds to the icon while scrolling down and comes back on the way up; c.fab.menu - a few related ways to add something: the button opens two to six labelled pill actions stacked above it, and turns into a close icon
 * Look: A raised rounded square in the accent color with a white icon, floating over the content in the bottom right corner; extended it is a wider pill with a label, and the menu stacks small white pills above it.
 * Tokens: --color-accent --color-accent-hover --color-on-accent --color-surface --color-border --radius-md --radius-lg --radius-xl --pill-radius --surface-shadow-overlay --duration-base --press-scale --focus-ring
 * Use cases: new message; add a booking; compose; add a note; upload a photo; create a task; phone app main action
 * Jobs to be done: start the screen's main task; add something new quickly; choose what kind of thing to add
 * Keywords: floating action button, fab, add button, compose, primary action, speed dial, mobile
 */
/**
 * Floating action button (FAB): the one main action on a phone screen, floating over the content in the corner a thumb
 * reaches. "fab" is an icon button in three sizes; "extended" adds its label and folds to the icon while the person
 * scrolls down (back when they scroll up); "menu" opens two to six related actions above it and closes on Escape or a
 * tap elsewhere, returning focus to the FAB. It sits above a bottom navigation bar when there is one.
 * Written for FlowCode; the behaviour follows the FAB guidance in Material 3 (no code from it).
 * Make it the app's own: replace SAMPLE with the screen's one main action (and, for a menu, the few that go with it).
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Icon } from "./icons";

export type FabVariant = "fab" | "extended" | "menu";
export type FabSize = "small" | "regular" | "large";
export type FabAction = { id: string; label: string; icon: string };
const FL: Record<FabVariant, string> = { fab: "c.fab.fab", extended: "c.fab.extended", menu: "c.fab.menu" };
const SIZE: Record<FabSize, string> = { small: "fl-mob-fab--small", regular: "", large: "fl-mob-fab--large" };

/** Whether the person is scrolling down (fold the extended FAB) in a scrolling box, or the window when none is given. */
function useScrollingDown(box?: RefObject<HTMLElement | null>): boolean {
  const [down, setDown] = useState(false);
  useEffect(() => {
    const el: HTMLElement | Window = box?.current ?? window;
    const top = () => (el instanceof Window ? el.scrollY : el.scrollTop);
    let last = top();
    const on = () => {
      const now = top();
      if (Math.abs(now - last) > 4) setDown(now > last && now > 24);
      last = now;
    };
    el.addEventListener("scroll", on, { passive: true });
    return () => el.removeEventListener("scroll", on);
  }, [box]);
  return down;
}

export function Fab({
  variant = "fab",
  label,
  icon,
  size = "regular",
  onClick,
  actions = [],
  onAction,
  scrollBox,
  fixed = true,
  aboveNav,
}: {
  variant?: FabVariant;
  /** Always required: the visible label (extended) or the name for screen readers and the tooltip. */
  label: string;
  icon: string;
  size?: FabSize;
  onClick?: () => void;
  /** menu: the related actions it opens, two to six. */
  actions?: FabAction[];
  onAction?: (id: string) => void;
  /** extended: the scrolling box it watches (the window when left out). */
  scrollBox?: RefObject<HTMLElement | null>;
  /** Pinned to the bottom corner of the window (the usual); false keeps it where it is placed. */
  fixed?: boolean;
  /** Lifts it clear of a bottom navigation bar. */
  aboveNav?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const folded = useScrollingDown(scrollBox) && variant === "extended";
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const away = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  const onMenuKey = (e: KeyboardEvent) => {
    const items = [...(menu.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      items[(at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    }
  };

  const cls = ["fl-mob-fab", SIZE[size], variant === "extended" ? "fl-mob-fab--extended" : "", folded ? "is-folded" : "", open ? "is-open" : ""].filter(Boolean).join(" ");
  return (
    <div ref={wrap} className={`fl-mob-fab-wrap${fixed ? " fl-mob-fab-wrap--fixed" : ""}${aboveNav ? " fl-mob-fab-wrap--above-nav" : ""}`} data-fl={FL[variant]} onKeyDown={variant === "menu" ? onMenuKey : undefined}>
      {variant === "menu" && open ? (
        <ul ref={menu} id={`${id}-menu`} className="fl-mob-fab-menu" role="menu" aria-label={label}>
          {actions.slice(0, 6).map((a, i) => (
            <li key={a.id} role="none" style={{ ["--i" as string]: actions.length - 1 - i }}>
              <button
                type="button"
                role="menuitem"
                className="fl-mob-fab-menu__item"
                onClick={() => {
                  onAction?.(a.id);
                  close();
                }}
              >
                <Icon name={a.icon} />
                {a.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button
        ref={button}
        type="button"
        className={cls}
        aria-label={variant === "extended" && !folded ? undefined : label}
        title={variant === "extended" && !folded ? undefined : label}
        aria-haspopup={variant === "menu" ? "menu" : undefined}
        aria-expanded={variant === "menu" ? open : undefined}
        aria-controls={variant === "menu" && open ? `${id}-menu` : undefined}
        onClick={() => (variant === "menu" ? setOpen((o) => !o) : onClick?.())}
      >
        <span className="fl-mob-fab__icon">
          <Icon name={variant === "menu" && open ? "close" : icon} />
        </span>
        {variant === "extended" ? <span className="fl-mob-fab__label">{label}</span> : null}
      </button>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  main: { label: "New note", icon: "plus" },
  extended: { label: "New booking", icon: "calendar" },
  rows: ["Mon 9:00 · Ana, haircut", "Mon 11:30 · Sam, colour", "Tue 10:00 · Lee, trim", "Tue 15:00 · Mo, haircut", "Wed 9:30 · Ivy, colour", "Wed 13:00 · Raj, trim", "Thu 10:30 · Bo, haircut", "Fri 12:00 · Zoe, colour"],
  menu: {
    label: "Add",
    actions: [
      { id: "photo", label: "Photo", icon: "image" },
      { id: "file", label: "File", icon: "paperclip" },
      { id: "note", label: "Note", icon: "pencil" },
    ] as FabAction[],
  },
};

export default function FabSheet() {
  const d = SAMPLE;
  const box = useRef<HTMLDivElement>(null);
  const [said, setSaid] = useState("Nothing pressed yet.");
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-spec">
        <h3>Three sizes</h3>
        <p className="fl-ctl-btn-what">One per screen, for its main action. Small sits beside other controls; large is for a screen that is mostly that action.</p>
        <div className="fl-mob-fab-row">
          {(["small", "regular", "large"] as FabSize[]).map((z) => (
            <span key={z} className="fl-mob-fab-row__item">
              <Fab label={`${d.main.label} (${z})`} icon={d.main.icon} size={z} fixed={false} onClick={() => setSaid(`Pressed: ${d.main.label}, ${z}.`)} />
              <span className="fl-ctl-btn-what">{z}</span>
            </span>
          ))}
        </div>
        <p className="fl-ctl-status" role="status">
          {said}
        </p>
      </div>
      <div className="fl-ctl-spec">
        <h3>Extended: folds while scrolling down</h3>
        <p className="fl-ctl-btn-what">The label says what it does; scroll the list down and it folds to the icon, scroll up and it comes back.</p>
        <div className="fl-mob-phone">
          <div ref={box} className="fl-mob-phone__screen fl-mob-phone__screen--scroll" tabIndex={0} aria-label="Bookings this week">
            <ul className="fl-mob-phone__rows">
              {d.rows.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <Fab variant="extended" label={d.extended.label} icon={d.extended.icon} scrollBox={box} fixed={false} onClick={() => setSaid(`Pressed: ${d.extended.label}.`)} />
        </div>
      </div>
      <div className="fl-ctl-spec">
        <h3>Menu: a few actions that go together</h3>
        <p className="fl-ctl-btn-what">Opens upwards; ↑ ↓ move between actions, Esc or a tap elsewhere closes it and focus goes back to the button.</p>
        <div className="fl-mob-phone">
          <Fab variant="menu" label={d.menu.label} icon="plus" actions={d.menu.actions} fixed={false} onAction={(a) => setSaid(`Chose: ${d.menu.actions.find((x) => x.id === a)?.label}.`)} />
        </div>
      </div>
    </section>
  );
}
