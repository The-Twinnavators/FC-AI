/** @flowcode-library sidebar-nav-variants · Sidebar: groups, collapsing and the icon rail (Navigation)
 * Catalog ID: p.side-nav (pattern)
 * Function: The app shell's side navigation (p.side-nav): grouped, collapsible sections with a current item, count badges and an icon-rail fold, shown beside a stand-in page.
 * Use it as: import { SideNav } from "./sidebar-nav-variants"; <SideNav title="Name" groups={[{ id, label, items: [{ id, label, icon, count?, disabled? }] }]} current?="item-id" collapsed? onSelect?={(item) => ...} onToggle?={(collapsed) => ...} />
 * Built from: c.button.tertiary
 * Look: A vertical list of grouped sections with icons, the current one highlighted and a count badge where something waits; it folds to an icon rail and its groups open and shut.
 * Tokens: --color-accent --color-border --color-on-accent --color-surface --color-surface-sunken --color-text --duration-fast --duration-med --easing --focus-ring --radius-lg --space-1 --space-2 --space-3 --space-4 --space-5 --text-xs
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
import { useState } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";

// ── p.side-nav: the vertical navigation. Built from c.button (the fold button); groups and items live inside it. ──

export type SideNavItem = { id: string; label: string; icon: string; count?: number; disabled?: boolean };
export type SideNavGroup = { id: string; label: string; items: SideNavItem[] };
export type SideNavProps = {
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

export function SideNav({ title, groups, current, collapsed = false, onSelect, onToggle, className }: SideNavProps) {
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

export default function SidebarNavVariants() {
  const d = SAMPLE;
  const [said, setSaid] = useState("");

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
