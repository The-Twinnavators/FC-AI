/** @flowcode-library sidebar-nav-variants · Sidebar: groups, collapsing and the icon rail (Navigation)
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
 * Dependencies: React (useState), and the library's own inline icon set ("./icons"), which is a table of SVG paths rather
 * than an icon package. Nothing else — no package to install and nothing fetched at run time. The styles are the library's
 * own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs in a built app exactly as
 * it runs here.
 */
import { useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
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
  const [here, setHere] = useState("shoots");
  const [folded, setFolded] = useState(false);
  const [shut, setShut] = useState<string[]>([]);
  const [said, setSaid] = useState("");

  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-side-stage">
        <nav className={`fl-ctl-side${folded ? " is-folded" : ""}`} aria-label="Studio">
          <div className="fl-ctl-side-top">
            {folded ? null : <span className="fl-ctl-side-title">Northlight</span>}
            <button
              type="button"
              className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--icon fl-ctl-btn--32"
              aria-expanded={!folded}
              aria-label={folded ? "Open the sidebar" : "Fold the sidebar"}
              title={folded ? "Open the sidebar" : "Fold the sidebar"}
              onClick={() => {
                setFolded((v) => !v);
                setSaid(folded ? "Sidebar open" : "Sidebar folded to a rail");
              }}
            >
              <Icon name="menu" />
            </button>
          </div>

          {d.groups.map((g) => {
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
                          setSaid(`Went to ${it.label}`);
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
