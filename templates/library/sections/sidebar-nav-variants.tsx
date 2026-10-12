/** @flowcode-library sidebar-nav-variants · Sidebar: groups, collapsing and the icon rail (Navigation)
 * Catalog ID: p.side-nav (pattern)
 * Function: The app shell's side navigation (p.side-nav): a grouped, foldable list, plus whole-frame app, icon-rail and nested-with-pins shells with a phone drawer and a slot for the page.
 * Use it as: import { SideNav } from "./sidebar-nav-variants"; <SideNav title="Name" groups={[{ id, label, items: [{ id, label, icon, count?, disabled? }] }]} current?="item-id" collapsed? onSelect?={(item) => ...} onToggle?={(collapsed) => ...} /> (folding list); whole app shells with a page slot: <SideNav variant="app" title groups current? action?={{ id, label }} person?={{ initials, name, email? }} menu?={[{ id, label, danger? }]} disabled? storeKey? onSelect? onAction? onMenu? main?={(page) => node} /> | <SideNav variant="rail" title sections={[{ id, label, icon, text?, pages: [{ id, label, count? }] }]} current?="section/page" person? main? /> | <SideNav variant="nested" title top?={[{ id, label, icon, count? }]} projects={[{ id, label, pages: [{ id, label }] }]} current?="project/page" defaultOpen? defaultPins? storeKey? main? />; main receives { id, label, trail }
 * Variants: p.side-nav.app - the classic app frame: product name, a search that filters pages, grouped pages with counts, one primary button and the signed-in person with an account menu; folds to icons with tooltips, and becomes a top bar with a drawer on a phone; p.side-nav.rail - an app with a few big areas: a slim icon rail of sections beside a panel listing the chosen section's pages; a top bar with a drawer on a phone; p.side-nav.nested - many projects or folders: projects open into their pages, any page can be pinned to a list at the top, and what is open and pinned is remembered; a top bar with a drawer on a phone
 * Built from: c.button.tertiary, c.button.primary
 * Look: A vertical list of grouped sections with icons, the current one highlighted and a count badge where something waits; it folds to an icon rail and its groups open and shut.
 * Tokens: --color-accent --color-bg --color-border --color-danger --color-on-accent --color-surface --color-surface-sunken --color-text --color-text-muted --control-md --control-sm --duration-fast --duration-med --easing --focus-ring --radius-lg --space-1 --space-2 --space-3 --space-4 --space-5 --space-6 --text-xs
 * Use cases: app shell sidebar; admin navigation; docs chapters; project areas; collapsed rail
 * Jobs to be done: reach any area in one press; fold the sidebar away for room; see where I am
 * Keywords: sidebar, side nav, rail, collapse, groups, active, badge, aria-current
 */
/**
 * The vertical navigation an app shell keeps on the left: grouped sections, one of them current, and a badge where
 * something is waiting. It folds to an icon rail when the page needs the room, and the groups themselves open and shut.
 *
 * Both work here. Folding keeps the labels for screen readers and puts them in title attributes for the pointer, which
 * is the part that is usually dropped and is the reason collapsed rails are so often unusable.
 *
 * Make it the app's own: replace the groups. Keep one current item, marked with aria-current="page".
 */
/**
 * How to try it
 * - Press the menu button to fold the sidebar to an icon rail and back.
 * - Press a group heading to shut or open that group.
 * - Press any area: the current one is marked with aria-current, not only with color.
 * - Folded, every label is still there for the pointer and for screen readers, and counts become dots.
 *
 * Dependencies: React (useState), the library's own inline icon set ("./icons"), which is a table of SVG paths rather
 * than an icon package, and the library's Button ("./buttons-variants"). Nothing else — no package to install and nothing fetched at run time. The styles are the library's
 * own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs in a built app exactly as
 * it runs here.
 */
import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";

// ── p.side-nav: the vertical navigation. Built from c.button (the fold button, the shell's main action). ──
// The default is a grouped list that folds. Three shells draw a whole app frame (side navigation, phone top bar and
// drawer, and a slot for the page): app, rail and nested.

export type SideNavItem = { id: string; label: string; icon: string; count?: number; disabled?: boolean };
export type SideNavGroup = { id: string; label: string; items: SideNavItem[] };

/** What a shell hands to `main` so the page beside the navigation can draw itself. */
export type SideNavPage = { id: string; label: string; trail: string[] };

export type GroupedSideNavProps = {
  variant?: "grouped";
  /** Name shown at the top, and the nav's accessible name. */
  title: string;
  groups: SideNavGroup[];
  /** Id of the current item; marked with aria-current="page". */
  current?: string;
  /** Start folded to an icon rail. The fold button toggles it. */
  collapsed?: boolean;
  /** Called with the item chosen, or a message when the sidebar folds or opens. */
  onSelect?: (item: SideNavItem) => void;
  onToggle?: (collapsed: boolean) => void;
  className?: string;
};

export type AppSideNavProps = {
  variant: "app";
  title: string;
  /** One or two letters in the brand mark; the first letter of the title when left out. */
  mark?: string;
  groups: SideNavGroup[];
  current?: string;
  /** A search box that filters the pages; on unless set to false. */
  search?: boolean;
  /** The one primary button; choosing it makes `id` the current page. */
  action?: { id: string; label: string };
  /** The signed-in person at the bottom, with a small menu. */
  person?: { initials: string; name: string; email?: string };
  menu?: { id: string; label: string; icon?: string; danger?: boolean }[];
  /** Signed out: no current page, and the main action and account menu are off. */
  disabled?: boolean;
  /** Remember the folded choice under this localStorage key. */
  storeKey?: string;
  onSelect?: (id: string) => void;
  onAction?: () => void;
  /** Called with the menu item chosen; a menu item that is not "danger" also becomes the current page. */
  onMenu?: (id: string) => void;
  main?: (page: SideNavPage) => ReactNode;
  className?: string;
};

export type RailSection = { id: string; label: string; icon: string; text?: string; pages: { id: string; label: string; count?: number }[] };
export type RailSideNavProps = {
  variant: "rail";
  title: string;
  mark?: string;
  sections: RailSection[];
  /** "section-id/page-id"; the first page when left out. */
  current?: string;
  person?: { initials: string; name: string };
  onSelect?: (key: string) => void;
  main?: (page: SideNavPage) => ReactNode;
  className?: string;
};

export type NestedProject = { id: string; label: string; pages: { id: string; label: string }[] };
export type NestedSideNavProps = {
  variant: "nested";
  title: string;
  mark?: string;
  /** Pages above the projects. */
  top?: SideNavItem[];
  projects: NestedProject[];
  projectsLabel?: string;
  /** A project page's key is "project-id/page-id"; a top page's key is its id. */
  current?: string;
  /** Ids open at first: "projects" and project ids. */
  defaultOpen?: string[];
  /** Pinned page keys at first. */
  defaultPins?: string[];
  /** Remember what is open and pinned under this localStorage key. */
  storeKey?: string;
  onSelect?: (key: string) => void;
  main?: (page: SideNavPage) => ReactNode;
  className?: string;
};

export type SideNavProps = GroupedSideNavProps | AppSideNavProps | RailSideNavProps | NestedSideNavProps;

export function SideNav(props: SideNavProps) {
  switch (props.variant) {
    case "app":
      return <AppSideNav {...props} />;
    case "rail":
      return <RailSideNav {...props} />;
    case "nested":
      return <NestedSideNav {...props} />;
    default:
      return <GroupedSideNav {...props} />;
  }
}

function GroupedSideNav({ title, groups, current, collapsed = false, onSelect, onToggle, className }: GroupedSideNavProps) {
  const [here, setHere] = useState(current);
  const [folded, setFolded] = useState(collapsed);
  const [shut, setShut] = useState<string[]>([]);

  return (
    <nav className={`fl-ctl-side${folded ? " is-folded" : ""}${className ? ` ${className}` : ""}`} aria-label={title} data-fl="p.side-nav">
      <div className="fl-ctl-side-top">
        {folded ? null : <span className="fl-ctl-side-title">{title}</span>}
        <Button
          variant="tertiary"
          size={32}
          icon="menu"
          iconOnly
          aria-expanded={!folded}
          onClick={() => {
            setFolded(!folded);
            onToggle?.(!folded);
          }}
        >
          {folded ? "Open the sidebar" : "Fold the sidebar"}
        </Button>
      </div>

      {groups.map((g) => {
        const closed = shut.includes(g.id);
        return (
          <div className="fl-ctl-side-group" key={g.id}>
            {folded ? (
              <hr className="fl-ctl-side-rule" />
            ) : (
              <button
                type="button"
                className="fl-ctl-side-head"
                aria-expanded={!closed}
                aria-controls={`side-${g.id}`}
                onClick={() => setShut((v) => (v.includes(g.id) ? v.filter((x) => x !== g.id) : [...v, g.id]))}
              >
                <Icon name="chevron-down" />
                {g.label}
              </button>
            )}
            <ul id={`side-${g.id}`} hidden={closed && !folded}>
              {g.items.map((it) => (
                <li key={it.id}>
                  <a
                    href="#top"
                    className={`fl-ctl-side-item${it.id === here ? " is-on" : ""}${it.disabled ? " is-off" : ""}`}
                    aria-current={it.id === here ? "page" : undefined}
                    aria-disabled={it.disabled || undefined}
                    title={folded ? it.label : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      if (it.disabled) return;
                      setHere(it.id);
                      onSelect?.(it);
                    }}
                  >
                    <Icon name={it.icon} />
                    <span className={folded ? "fl-sr" : undefined}>{it.label}</span>
                    {it.count ? (
                      <span className={`fl-ctl-side-count${folded ? " is-dot" : ""}`}>
                        {folded ? <span className="fl-sr">{it.count} waiting</span> : it.count}
                      </span>
                    ) : null}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

// ── The app shells: the frame, phone top bar and drawer shared by app, rail and nested. ──

const MOBILE = "(max-width: 767px)";
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

const GLYPHS: Record<string, string> = {
  home: "M3 11 12 4l9 7M5 10v10h5v-6h4v6h5V10",
  inbox: "M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  card: "M3 6h18v12H3zM3 10h18M7 15h4",
  team: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  plus: "M12 5v14M5 12h14",
  collapse: "M4 5h16v14H4zM9 5v14M15 10l-2 2 2 2",
  expand: "M4 5h16v14H4zM9 5v14M13 10l2 2-2 2",
  close: "M6 6l12 12M18 6 6 18",
  updown: "M8 9l4-4 4 4M8 15l4 4 4-4",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  out: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
  gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1",
  folder: "M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z",
  page: "M6 3h8l4 4v14H6zM14 3v4h4",
  pin: "M9 4h6M10 4v6l-3 3h10l-3-3V4M12 13v7",
  chevron: "M9 6l6 6-6 6",
};

function Glyph({ name, className }: { name: string; className?: string }) {
  if (!GLYPHS[name]) return <Icon name={name} />;
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={GLYPHS[name]} />
    </svg>
  );
}

/** Phone drawer: focus moves in, Tab stays inside, Escape closes, focus goes back to the menu button. */
function useNavDrawer() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (!open) {
      if (wasOpen.current) {
        wasOpen.current = false;
        menuRef.current?.focus();
      }
      return;
    }
    wasOpen.current = true;
    const panel = panelRef.current;
    if (!panel) return;
    const items = () => Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
    const frame = requestAnimationFrame(() => (items()[0] ?? panel).focus());
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const list = items();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    const mq = window.matchMedia(MOBILE);
    const onChange = () => {
      if (!mq.matches) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onChange);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onChange);
      document.body.style.overflow = overflow;
    };
  }, [open]);
  return { open, setOpen, menuRef, panelRef };
}

type Drawer = ReturnType<typeof useNavDrawer>;

/** The frame every shell shares: phone top bar, backdrop, the drawer-capable aside, and the page slot. */
function SnvShell(props: {
  fl: string;
  frameClass?: string;
  asideClass?: string;
  sideId: string;
  drawer: Drawer;
  title: string;
  mark: string;
  top: [string, string];
  page: SideNavPage;
  main?: (page: SideNavPage) => ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const { drawer, page } = props;
  return (
    <div className={`fl-snv-frame${props.frameClass ? ` ${props.frameClass}` : ""}${props.className ? ` ${props.className}` : ""}`} data-fl={props.fl}>
      <header className="fl-snv-topbar">
        <button ref={drawer.menuRef} type="button" className="fl-snv-iconbtn" aria-label="Open menu" aria-expanded={drawer.open} aria-controls={props.sideId} onClick={() => drawer.setOpen(true)}>
          <Icon name="menu" />
        </button>
        <span className="fl-snv-mark" aria-hidden="true">
          {props.mark}
        </span>
        <span className="fl-snv-topbar__title">
          <strong>{props.top[0]}</strong>
          <span>{props.top[1]}</span>
        </span>
      </header>

      <div className={`fl-snv-backdrop${drawer.open ? " is-open" : ""}`} onClick={() => drawer.setOpen(false)} aria-hidden="true" />

      <aside
        id={props.sideId}
        ref={drawer.panelRef}
        className={`fl-snv-side${props.asideClass ? ` ${props.asideClass}` : ""}${drawer.open ? " is-open" : ""}`}
        role={drawer.open ? "dialog" : undefined}
        aria-modal={drawer.open ? true : undefined}
        aria-label={drawer.open ? props.title : undefined}
        tabIndex={-1}
      >
        {props.children}
      </aside>

      {props.main ? (
        <section className="fl-snv-main" aria-label={page.label} aria-live="polite">
          {props.main(page)}
        </section>
      ) : null}
    </div>
  );
}

function CloseButton({ drawer }: { drawer: Drawer }) {
  return (
    <button type="button" className="fl-snv-iconbtn fl-snv-close" aria-label="Close menu" onClick={() => drawer.setOpen(false)}>
      <Glyph name="close" />
    </button>
  );
}

const readFlag = (key?: string) => {
  if (!key) return false;
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};

// App: product, search, grouped pages with counts, one primary button and the signed-in person; folds to icons.
function AppSideNav({ title, mark, groups, current, search = true, action, person, menu = [], disabled, storeKey, onSelect, onAction, onMenu, main, className }: AppSideNavProps) {
  const uid = useId();
  const first = groups[0]?.items[0]?.id ?? "";
  const [here, setHere] = useState(current ?? first);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(() => readFlag(storeKey));
  const [accountOpen, setAccountOpen] = useState(false);
  const drawer = useNavDrawer();
  const searchRef = useRef<HTMLInputElement>(null);
  const meRef = useRef<HTMLButtonElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const focusSearch = useRef(false);
  const accountId = `${uid}-account`;

  // The host can move the current page (a page opened from elsewhere).
  useEffect(() => {
    if (current) setHere(current);
  }, [current]);

  useEffect(() => {
    if (storeKey) {
      try {
        localStorage.setItem(storeKey, collapsed ? "1" : "0");
      } catch {
        /* storage blocked: the choice lasts for this visit only */
      }
    }
    if (!collapsed && focusSearch.current) {
      focusSearch.current = false;
      searchRef.current?.focus();
    }
  }, [collapsed, storeKey]);

  // The account menu closes on Escape (focus back to its button) or a click anywhere else.
  useEffect(() => {
    if (!accountOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setAccountOpen(false);
        meRef.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!accountRef.current?.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [accountOpen]);

  const go = (id: string) => {
    setHere(id);
    setAccountOpen(false);
    drawer.setOpen(false);
  };
  const click = (id: string, after?: () => void) => (e: MouseEvent) => {
    e.preventDefault();
    go(id);
    after?.();
  };

  const q = query.trim().toLowerCase();
  const shown = groups.map((g) => ({ ...g, items: g.items.filter((i) => !q || i.label.toLowerCase().includes(q)) })).filter((g) => g.items.length > 0);
  const labelOf = (id: string) =>
    groups.flatMap((g) => g.items).find((i) => i.id === id)?.label ?? (action?.id === id ? action.label : undefined) ?? menu.find((m) => m.id === id)?.label ?? id;
  const page: SideNavPage = { id: here, label: labelOf(here), trail: [labelOf(here)] };
  const markText = mark ?? title.slice(0, 1);

  return (
    <SnvShell
      fl="p.side-nav.app"
      frameClass={`fl-snv-app${collapsed ? " is-collapsed" : ""}`}
      sideId={`${uid}-side`}
      drawer={drawer}
      title={title}
      mark={markText}
      top={[title, disabled ? "Signed out" : page.label]}
      page={page}
      main={main}
      className={className}
    >
      <div className="fl-snv-brand">
        <span className="fl-snv-mark" aria-hidden="true">
          {markText}
        </span>
        <span className="fl-snv-brand__name">{title}</span>
        <button
          type="button"
          className="fl-snv-iconbtn fl-snv-collapse"
          style={{ marginLeft: collapsed ? undefined : "auto", position: "relative" }}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed((c) => !c)}
        >
          <Glyph name={collapsed ? "expand" : "collapse"} />
          <span className="fl-snv-tip" aria-hidden="true">
            {collapsed ? "Expand sidebar" : "Collapse sidebar"}
          </span>
        </button>
        <CloseButton drawer={drawer} />
      </div>

      {search ? (
        <>
          <label className="fl-snv-search">
            <span className="fl-sr">Search pages</span>
            <Glyph name="search" />
            <input ref={searchRef} className="fl-input" type="search" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <button
            type="button"
            className="fl-snv-iconbtn fl-snv-search-btn"
            aria-label="Search pages"
            onClick={() => {
              focusSearch.current = true;
              setCollapsed(false);
            }}
          >
            <Glyph name="search" />
            <span className="fl-snv-tip" aria-hidden="true">
              Search pages
            </span>
          </button>
        </>
      ) : null}

      <nav aria-label="Main" className="fl-snv-scroll">
        {shown.length === 0 ? (
          <p className="fl-snv-none" role="status">
            No pages match "{query.trim()}"
          </p>
        ) : (
          shown.map((g) => (
            <div key={g.id} className="fl-snv-group">
              <p id={`${uid}-${g.id}`} className="fl-snv-heading">
                {g.label}
              </p>
              <ul className="fl-snv-list" aria-labelledby={`${uid}-${g.id}`}>
                {g.items.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className="fl-snv-item"
                      aria-current={!disabled && here === item.id ? "page" : undefined}
                      aria-disabled={item.disabled || undefined}
                      onClick={item.disabled ? (e) => e.preventDefault() : click(item.id, () => onSelect?.(item.id))}
                    >
                      <Glyph name={item.icon} />
                      <span className="fl-snv-label">{item.label}</span>
                      {(item.count ?? 0) > 0 && (
                        <span className="fl-snv-count">
                          {item.count}
                          <span className="fl-sr"> new</span>
                        </span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </nav>

      {action || person ? (
        <div className="fl-snv-foot">
          {action ? (
            <Button
              variant="primary"
              icon="plus"
              disabled={disabled}
              onClick={() => {
                go(action.id);
                onAction?.();
              }}
            >
              <span className="fl-snv-label" style={{ flex: "none" }}>
                {action.label}
              </span>
            </Button>
          ) : null}
          {person ? (
            <div className="fl-snv-account" ref={accountRef}>
              <button
                ref={meRef}
                type="button"
                className="fl-snv-me"
                aria-expanded={accountOpen}
                aria-controls={accountId}
                aria-label={`Account: ${person.name}`}
                onClick={() => setAccountOpen((o) => !o)}
                disabled={disabled}
              >
                <span className="fl-person__avatar" aria-hidden="true">
                  {person.initials}
                </span>
                <span className="fl-snv-me__text" aria-hidden="true">
                  <strong>{person.name}</strong>
                  {person.email ? <span>{person.email}</span> : null}
                </span>
                <Glyph name="updown" />
              </button>
              {accountOpen && (
                <ul id={accountId} className="fl-snv-menu" aria-label="Account">
                  {menu.map((m) => (
                    <li key={m.id}>
                      {m.danger ? (
                        <button
                          type="button"
                          className="fl-snv-item fl-snv-item--danger"
                          onClick={() => {
                            setAccountOpen(false);
                            drawer.setOpen(false);
                            onMenu?.(m.id);
                            meRef.current?.focus();
                          }}
                        >
                          <Glyph name={m.icon ?? "out"} />
                          {m.label}
                        </button>
                      ) : (
                        <a href={`#${m.id}`} className="fl-snv-item" aria-current={here === m.id ? "page" : undefined} onClick={click(m.id, () => onMenu?.(m.id))}>
                          <Glyph name={m.icon ?? "user"} />
                          {m.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </SnvShell>
  );
}

// Rail: slim icon rail of sections beside a panel listing the chosen section's pages.
function RailSideNav({ title, mark, sections, current, person, onSelect, main, className }: RailSideNavProps) {
  const uid = useId();
  const firstKey = sections[0] ? `${sections[0].id}/${sections[0].pages[0]?.id ?? ""}` : "";
  const [key, setKey] = useState(current ?? firstKey);
  const [shown, setShown] = useState((current ?? firstKey).split("/")[0]);
  const drawer = useNavDrawer();

  useEffect(() => {
    if (current) {
      setKey(current);
      setShown(current.split("/")[0]);
    }
  }, [current]);

  const [curSection, curPage] = key.split("/");
  const shownSection = sections.find((s) => s.id === shown) ?? sections[0];
  const currentSection = sections.find((s) => s.id === curSection) ?? sections[0];
  const page = currentSection?.pages.find((p) => p.id === curPage) ?? currentSection?.pages[0];
  const info: SideNavPage = { id: `${currentSection?.id}/${page?.id}`, label: page?.label ?? "", trail: [currentSection?.label ?? "", page?.label ?? ""] };
  const markText = mark ?? title.slice(0, 1);

  const open = (sectionId: string, pageId: string) => (e: MouseEvent) => {
    e.preventDefault();
    setKey(`${sectionId}/${pageId}`);
    drawer.setOpen(false);
    onSelect?.(`${sectionId}/${pageId}`);
  };

  return (
    <SnvShell
      fl="p.side-nav.rail"
      asideClass="fl-snv-railside"
      sideId={`${uid}-side`}
      drawer={drawer}
      title={title}
      mark={markText}
      top={[currentSection?.label ?? title, page?.label ?? ""]}
      page={info}
      main={main}
      className={className}
    >
      <nav aria-label="Main" className="fl-snv-railnav">
        <div className="fl-snv-rail">
          <span className="fl-snv-mark" role="img" aria-label={title}>
            {markText}
          </span>
          <ul className="fl-snv-list" aria-label="Sections">
            {sections.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="fl-snv-railbtn"
                  aria-pressed={shown === s.id}
                  aria-current={curSection === s.id ? "true" : undefined}
                  aria-controls={`${uid}-panel`}
                  onClick={() => setShown(s.id)}
                >
                  <Glyph name={s.icon} />
                  <span className="fl-snv-tip">{s.label}</span>
                  {curSection === s.id && shown !== s.id && <span className="fl-snv-railbtn__dot" aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
          {person ? (
            <div className="fl-snv-rail__end">
              <span className="fl-person__avatar" role="img" aria-label={`Signed in as ${person.name}`}>
                <span aria-hidden="true">{person.initials}</span>
              </span>
            </div>
          ) : null}
        </div>

        <div id={`${uid}-panel`} className="fl-snv-panel">
          <div className="fl-snv-panel__head">
            <h2 id={`${uid}-panel-title`}>{shownSection?.label}</h2>
            <CloseButton drawer={drawer} />
          </div>
          {shownSection?.text ? <p className="fl-snv-panel__text">{shownSection.text}</p> : null}
          <ul className="fl-snv-list" aria-labelledby={`${uid}-panel-title`}>
            {shownSection?.pages.map((p) => (
              <li key={p.id}>
                <a
                  href={`#${shownSection.id}-${p.id}`}
                  className="fl-snv-item"
                  aria-current={curSection === shownSection.id && curPage === p.id ? "page" : undefined}
                  onClick={open(shownSection.id, p.id)}
                >
                  <span className="fl-snv-label">{p.label}</span>
                  {(p.count ?? 0) > 0 && <span className="fl-snv-count">{p.count}</span>}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </SnvShell>
  );
}

// Nested: projects open into their pages, and any page can be pinned to a list at the top.
type Saved = { open: string[]; pins: string[] };

function readSaved(key: string | undefined, fallback: Saved): Saved {
  if (!key) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const data = JSON.parse(raw) as Partial<Saved>;
    return {
      open: Array.isArray(data.open) ? data.open.filter((x) => typeof x === "string") : fallback.open,
      pins: Array.isArray(data.pins) ? data.pins.filter((x) => typeof x === "string") : fallback.pins,
    };
  } catch {
    return fallback;
  }
}

function NestedSideNav({ title, mark, top = [], projects, projectsLabel = "Projects", current, defaultOpen = ["projects"], defaultPins = [], storeKey, onSelect, main, className }: NestedSideNavProps) {
  const uid = useId();
  // A page by its key: a top page ("home") or a project page ("project/page").
  const lookup = (key: string) => {
    const t = top.find((x) => x.id === key);
    if (t) return { project: null, label: t.label };
    const [pid, gid] = key.split("/");
    const project = projects.find((p) => p.id === pid);
    const pg = project?.pages.find((p) => p.id === gid);
    return project && pg ? { project, label: pg.label } : null;
  };
  const [saved] = useState(() => readSaved(storeKey, { open: defaultOpen, pins: defaultPins }));
  const [openIds, setOpenIds] = useState<string[]>(saved.open);
  const [pins, setPins] = useState<string[]>(() => saved.pins.filter((k) => lookup(k)?.project));
  const [here, setHere] = useState(current ?? top[0]?.id ?? (projects[0] ? `${projects[0].id}/${projects[0].pages[0]?.id}` : ""));
  const [status, setStatus] = useState("");
  const drawer = useNavDrawer();

  useEffect(() => {
    if (current) setHere(current);
  }, [current]);

  useEffect(() => {
    if (!storeKey) return;
    try {
      localStorage.setItem(storeKey, JSON.stringify({ open: openIds, pins }));
    } catch {
      /* storage blocked: the layout lasts for this visit only */
    }
  }, [openIds, pins, storeKey]);

  const toggleOpen = (id: string) => setOpenIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  const go = (key: string) => (e: MouseEvent) => {
    e.preventDefault();
    setHere(key);
    drawer.setOpen(false);
    onSelect?.(key);
  };
  const togglePin = (key: string, fromPinned = false) => {
    const found = lookup(key);
    const name = found?.project ? `${found.label} (${found.project.label})` : key;
    const pinned = pins.includes(key);
    if (pinned && fromPinned) {
      // The row disappears: put focus on the next pinned page, or on the Pinned heading.
      const i = pins.indexOf(key);
      const next = pins[i + 1] ?? pins[i - 1];
      requestAnimationFrame(() => document.getElementById(next ? `${uid}-pin-${next}` : `${uid}-pinned`)?.focus());
    }
    setPins((list) => (pinned ? list.filter((k) => k !== key) : [...list, key]));
    setStatus(`${pinned ? "Unpinned" : "Pinned"} ${name}.`);
  };

  const found = lookup(here) ?? (top[0] ? lookup(top[0].id) : null);
  const label = found?.label ?? here;
  const info: SideNavPage = { id: here, label, trail: found?.project ? [projectsLabel, found.project.label, label] : [label] };
  const projectsOpen = openIds.includes("projects");
  const markText = mark ?? title.slice(0, 1);

  return (
    <SnvShell
      fl="p.side-nav.nested"
      sideId={`${uid}-side`}
      drawer={drawer}
      title={title}
      mark={markText}
      top={[found?.project ? found.project.label : title, label]}
      page={info}
      main={main}
      className={className}
    >
      <div className="fl-snv-brand">
        <span className="fl-snv-mark" aria-hidden="true">
          {markText}
        </span>
        <span className="fl-snv-brand__name">{title}</span>
        <CloseButton drawer={drawer} />
      </div>

      <nav aria-label="Main" className="fl-snv-scroll">
        <div className="fl-snv-group">
          <p id={`${uid}-pinned`} className="fl-snv-heading" tabIndex={-1}>
            Pinned
          </p>
          {pins.length === 0 ? (
            <p className="fl-snv-pinned-hint">Pin a page to keep it here.</p>
          ) : (
            <ul className="fl-snv-list" aria-labelledby={`${uid}-pinned`}>
              {pins.map((key) => {
                const item = lookup(key);
                if (!item?.project) return null;
                return (
                  <li key={key} className="fl-snv-row">
                    <a href={`#${key}`} className="fl-snv-item" aria-current={here === key ? "page" : undefined} onClick={go(key)}>
                      <Glyph name="pin" />
                      <span className="fl-snv-label">
                        {item.label}
                        <span className="fl-meta"> · {item.project.label}</span>
                      </span>
                    </a>
                    <button
                      id={`${uid}-pin-${key}`}
                      type="button"
                      className="fl-snv-iconbtn fl-snv-pin"
                      aria-label={`Unpin ${item.label}, ${item.project.label}`}
                      onClick={() => togglePin(key, true)}
                    >
                      <Glyph name="close" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <ul className="fl-snv-tree">
          {top.map((t) => (
            <li key={t.id}>
              <a href={`#${t.id}`} className="fl-snv-item" aria-current={here === t.id ? "page" : undefined} onClick={go(t.id)}>
                <Glyph name={t.icon} />
                <span className="fl-snv-label">{t.label}</span>
                {(t.count ?? 0) > 0 && (
                  <span className="fl-snv-count">
                    {t.count}
                    <span className="fl-sr"> new</span>
                  </span>
                )}
              </a>
            </li>
          ))}
          <li>
            <button type="button" className="fl-snv-item" aria-expanded={projectsOpen} aria-controls={`${uid}-projects`} onClick={() => toggleOpen("projects")}>
              <Glyph name="chevron" className="fl-snv-chev" />
              <span className="fl-snv-label">{projectsLabel}</span>
            </button>
            <ul id={`${uid}-projects`} className="fl-snv-tree" hidden={!projectsOpen}>
              {projects.map((p) => {
                const isOpen = openIds.includes(p.id);
                const holdsCurrent = here.startsWith(`${p.id}/`);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={`fl-snv-item${holdsCurrent && !isOpen ? " fl-snv-item--holds" : ""}`}
                      aria-expanded={isOpen}
                      aria-controls={`${uid}-${p.id}`}
                      onClick={() => toggleOpen(p.id)}
                    >
                      <Glyph name="chevron" className="fl-snv-chev" />
                      <span className="fl-snv-label">{p.label}</span>
                    </button>
                    <ul id={`${uid}-${p.id}`} className="fl-snv-tree" hidden={!isOpen}>
                      {p.pages.map((pg) => {
                        const key = `${p.id}/${pg.id}`;
                        const pinned = pins.includes(key);
                        return (
                          <li key={key} className="fl-snv-row">
                            <a href={`#${key}`} className="fl-snv-item" aria-current={here === key ? "page" : undefined} onClick={go(key)}>
                              <Glyph name="page" />
                              <span className="fl-snv-label">{pg.label}</span>
                            </a>
                            <button type="button" className="fl-snv-iconbtn fl-snv-pin" aria-pressed={pinned} aria-label={`Pin ${pg.label}, ${p.label}`} onClick={() => togglePin(key)}>
                              <Glyph name="pin" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </li>
        </ul>
      </nav>
      <p className="fl-snv-status" role="status" aria-live="polite" style={{ paddingInline: "var(--space-3)" }}>
        {status}
      </p>
    </SnvShell>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Northlight",
  groups: [
    {
      id: "work",
      label: "Work",
      items: [
        { id: "shoots", label: "Shoots", icon: "image", count: 0 },
        { id: "calendar", label: "Calendar", icon: "clock", count: 0 },
        { id: "approvals", label: "Approvals", icon: "check", count: 4 },
      ],
    },
    {
      id: "people",
      label: "People",
      items: [
        { id: "clients", label: "Clients", icon: "users", count: 0 },
        { id: "messages", label: "Messages", icon: "mail", count: 12 },
      ],
    },
    {
      id: "studio",
      label: "Studio",
      items: [
        { id: "invoices", label: "Invoices", icon: "chart", count: 0 },
        { id: "settings", label: "Settings", icon: "settings", count: 0 },
        { id: "archive", label: "Archive", icon: "folder", count: 0, disabled: true },
      ],
    },
  ],
};

// The three whole-shell variants: sample navigation and the stand-in pages (a line and a few cards each).
const SHELLS = {
  app: {
    title: "Kiln Room",
    groups: [
      {
        id: "workspace",
        label: "Workspace",
        items: [
          { id: "home", label: "Home", icon: "home" },
          { id: "bookings", label: "Bookings", icon: "calendar", count: 4 },
          { id: "clients", label: "Clients", icon: "users" },
          { id: "reports", label: "Reports", icon: "chart" },
        ],
      },
      {
        id: "settings",
        label: "Settings",
        items: [
          { id: "team", label: "Team", icon: "team" },
          { id: "billing", label: "Billing", icon: "card" },
        ],
      },
    ],
    person: { initials: "AR", name: "Ada Reyes", email: "ada@kilnroom.example" },
    menu: [
      { id: "profile", label: "Profile", icon: "user" },
      { id: "sign-out", label: "Sign out", icon: "out", danger: true },
    ],
    pages: {
      home: { text: "Here is how the studio looks today.", cards: [["6", "Classes today"], ["38", "Seats booked"], ["4", "Bookings to confirm"]] },
      bookings: { text: "Four new bookings are waiting for a reply.", cards: [["4", "Waiting for you"], ["21", "This week"], ["2", "Cancelled"]] },
      clients: { text: "Everyone who has booked a class with you.", cards: [["214", "Active clients"], ["12", "New this month"], ["31", "Members"]] },
      reports: { text: "Bookings and income over the last 30 days.", cards: [["$4,820", "Income"], ["86%", "Seats filled"], ["3.4", "Classes per client"]] },
      team: { text: "The people who teach and run the studio.", cards: [["5", "Teachers"], ["2", "Front desk"]] },
      billing: { text: "Your plan, invoices and payment details.", cards: [["Studio", "Current plan"], ["$29", "Per month"]] },
      profile: { text: "Your name, photo and how clients reach you.", cards: [["Ada Reyes", "Owner"], ["Mon to Sat", "Teaching days"]] },
      new: { text: "Choose a class, a time and the client to start a booking.", cards: [["1", "Pick a class"], ["2", "Pick a time"], ["3", "Add the client"]] },
    } as Record<string, { text: string; cards: string[][] }>,
  },
  rail: {
    title: "Kiln Room",
    person: { initials: "AR", name: "Ada Reyes" },
    sections: [
      {
        id: "inbox",
        label: "Inbox",
        icon: "inbox",
        text: "Messages from clients and the team.",
        pages: [
          { id: "all", label: "All messages", count: 12 },
          { id: "unread", label: "Unread", count: 3 },
          { id: "starred", label: "Starred" },
        ],
      },
      {
        id: "calendar",
        label: "Calendar",
        icon: "calendar",
        text: "Classes, workshops and kiln firings.",
        pages: [
          { id: "today", label: "Today", count: 6 },
          { id: "week", label: "This week", count: 21 },
        ],
      },
      {
        id: "clients",
        label: "Clients",
        icon: "users",
        text: "Everyone who books with you.",
        pages: [
          { id: "everyone", label: "Everyone", count: 214 },
          { id: "waitlist", label: "Waiting list", count: 7 },
        ],
      },
      {
        id: "settings",
        label: "Settings",
        icon: "gear",
        text: "Studio details, team and billing.",
        pages: [
          { id: "studio", label: "Studio" },
          { id: "billing", label: "Billing" },
        ],
      },
    ],
  },
  nested: {
    title: "Kiln Room",
    top: [
      { id: "home", label: "Home", icon: "home" },
      { id: "inbox", label: "Inbox", icon: "inbox", count: 3 },
    ],
    projects: [
      {
        id: "spring",
        label: "Spring open studio",
        pages: [
          { id: "overview", label: "Overview" },
          { id: "schedule", label: "Schedule" },
          { id: "bookings", label: "Bookings" },
        ],
      },
      {
        id: "kiln",
        label: "Kiln repair",
        pages: [
          { id: "overview", label: "Overview" },
          { id: "tasks", label: "Tasks" },
        ],
      },
    ],
  },
};

/** A stand-in page for the shell sheets: a trail, a title, a line and a few cards. */
function ShellPage({ page, text, cards }: { page: SideNavPage; text: string; cards: string[][] }) {
  return (
    <>
      <div className="fl-snv-main__head">
        {page.trail.length > 1 ? (
          <ol className="fl-snv-crumbs" aria-label="You are here">
            {page.trail.map((t, i) => (
              <li key={t + i} aria-current={i === page.trail.length - 1 ? "page" : undefined}>
                {t}
              </li>
            ))}
          </ol>
        ) : null}
        <h2 className="fl-title">{page.label}</h2>
        <p className="fl-text">{text}</p>
      </div>
      <ul className="fl-snv-cards">
        {cards.map(([title, meta]) => (
          <li key={title + meta} className="fl-card">
            <h3>{title}</h3>
            <span className="fl-meta">{meta}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function SidebarNavVariants() {
  const d = SAMPLE;
  const [said, setSaid] = useState("");
  const [signedOut, setSignedOut] = useState(false);

  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-side-stage">
        <SideNav
          title={d.title}
          groups={d.groups}
          current="shoots"
          onSelect={(it) => setSaid(`Went to ${it.label}`)}
          onToggle={(c) => setSaid(c ? "Sidebar folded to a rail" : "Sidebar open")}
        />

        <div className="fl-ctl-side-page">
          <p className="fl-ctl-matrix-kind">The page beside it</p>
          <p className="fl-ctl-matrix-what">Folding the sidebar gives this back about 150 px, which is why apps offer it at all.</p>
          <span className="fl-spec-skel" />
          <span className="fl-spec-skel" />
          <span className="fl-spec-skel fl-ctl-skel--short" />
        </div>
      </div>

      <p className="fl-ctl-status" role="status" aria-live="polite">
        {said || "Fold the sidebar, shut a group, or pick an area."}
      </p>

      <div className="fl-ctl-sizes">
        <h3>App shell</h3>
        <p className="fl-ctl-btn-what">
          variant="app": search, grouped pages with counts, one main action and the person with an account menu. It folds to icons (names become tooltips)
          and becomes a top bar with a drawer on a phone. Sign out switches the main area to a signed-out state.
        </p>
        <SideNav
          variant="app"
          title={SHELLS.app.title}
          groups={SHELLS.app.groups}
          current="bookings"
          action={{ id: "new", label: "New booking" }}
          person={SHELLS.app.person}
          menu={SHELLS.app.menu}
          disabled={signedOut}
          storeKey="fl-snv-app-collapsed"
          onMenu={(id) => id === "sign-out" && setSignedOut(true)}
          main={(page) =>
            signedOut ? (
              <div className="fl-snv-empty">
                <h2 className="fl-title fl-title--md">You're signed out</h2>
                <p className="fl-text">Your bookings are safe. Sign in again to pick up where you left off.</p>
                <Button variant="primary" onClick={() => setSignedOut(false)}>
                  Sign in again
                </Button>
              </div>
            ) : (
              <ShellPage page={page} {...(SHELLS.app.pages[page.id] ?? SHELLS.app.pages.home)} />
            )
          }
        />
      </div>

      <div className="fl-ctl-sizes">
        <h3>Icon rail and panel</h3>
        <p className="fl-ctl-btn-what">variant="rail": a slim rail of section icons beside a panel listing the chosen section's pages. Good for an app with a few big areas.</p>
        <SideNav
          variant="rail"
          title={SHELLS.rail.title}
          sections={SHELLS.rail.sections}
          person={SHELLS.rail.person}
          main={(page) => <ShellPage page={page} text={`${page.trail[0]}: ${page.label}.`} cards={[[page.label, page.trail[0]]]} />}
        />
      </div>

      <div className="fl-ctl-sizes">
        <h3>Nested groups with pins</h3>
        <p className="fl-ctl-btn-what">variant="nested": projects open into their pages, and any page can be pinned to a list at the top. What is open and pinned is remembered.</p>
        <SideNav
          variant="nested"
          title={SHELLS.nested.title}
          top={SHELLS.nested.top}
          projects={SHELLS.nested.projects}
          current="spring/schedule"
          defaultOpen={["projects", "spring"]}
          defaultPins={["spring/schedule"]}
          storeKey="fl-snv-nested"
          main={(page) => <ShellPage page={page} text={`${page.trail.join(" / ")}.`} cards={[[page.label, page.trail[0]]]} />}
        />
      </div>

      <div className="fl-ctl-sizes">
        <h3>What folding must keep</h3>
        <p className="fl-ctl-btn-what">
          A folded rail still carries every label: visually hidden for screen readers, and in a title for the pointer. A
          count becomes a dot with the number in its label, because a two-digit badge will not fit beside an icon.
          Archive is disabled, to show an area that exists but cannot be opened.
        </p>
      </div>
    </section>
  );
}
