/** @flowcode-library tabs-vertical · Vertical tabs: a rail of sections beside the panel (Tabs, breadcrumbs and paging)
 * Use cases: settings with many groups; account areas; a long record's sections; docs chapters; admin panels
 * Jobs to be done: move between many sections without wrapping; see every section at once; keep my place
 * Keywords: vertical tabs, rail, side tabs, settings nav, aria-orientation, selected
 */
/**
 * The same control as horizontal tabs, turned on its side. Use it when there are more sections than fit across one
 * line, or when the labels are long: a vertical rail can hold a dozen without wrapping or scrolling.
 *
 * It is a real tablist with aria-orientation="vertical", so Up and Down arrows move between tabs, Home and End jump to
 * the ends, and the panel is tied to its tab. On a narrow screen the rail lies back down into a scrolling row.
 *
 * Make it the app's own: replace the sections. Keep one panel per tab, and never more than one level of them.
 */
/**
 * How to try it
 * - Press any section in the rail, or use Up/Down, Home and End.
 * - The panel beside it changes with the tab, and the disabled section is skipped.
 * - Narrow the piece and the rail lies back down into a scrolling row.
 *
 * Dependencies: React (useRef, useState), and the library's own inline icon set ("./icons"), which is a table of SVG paths
 * rather than an icon package. Nothing else — no package to install and nothing fetched at run time. The styles are the
 * library's own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs in a built app
 * exactly as it runs here.
 */
import { useRef, useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  looks: [
    { id: "plain", label: "Plain", what: "A line down the side marks the one you are on" },
    { id: "filled", label: "Filled", what: "The chosen row is a block: easier on a busy page" },
  ],
  tabs: [
    { id: "profile", label: "Profile", icon: "users", count: 0, body: "Your name, photo and the address clients see." },
    { id: "notify", label: "Notifications", icon: "bell", count: 3, body: "What we email you about, and when we stop." },
    { id: "billing", label: "Billing and plan", icon: "chart", count: 0, body: "Your plan, your invoices and the card on file." },
    { id: "security", label: "Security", icon: "lock", count: 1, body: "Password, two-factor sign-in and signed-in devices." },
    { id: "team", label: "Team members", icon: "users", count: 0, body: "Who else can get into this studio, and what they may do." },
    { id: "archive", label: "Archived", icon: "folder", count: 0, body: "Nothing archived yet.", disabled: true },
  ],
};

function Rail({ look }: { look: string }) {
  const tabs = SAMPLE.tabs;
  const [on, setOn] = useState(tabs[0].id);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const move = (from: number, dir: number) => {
    let n = from;
    for (let i = 0; i < tabs.length; i += 1) {
      n = (n + dir + tabs.length) % tabs.length;
      if (!tabs[n].disabled) break;
    }
    setOn(tabs[n].id);
    refs.current[tabs[n].id]?.focus();
  };

  const here = tabs.find((t) => t.id === on) ?? tabs[0];

  return (
    <div className={`fl-ctl-vtabs fl-ctl-vtabs--${look}`}>
      <div className="fl-ctl-vtabs-rail" role="tablist" aria-orientation="vertical" aria-label="Settings sections">
        {tabs.map((t, n) => {
          const sel = t.id === on;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`vt-${look}-${t.id}`}
              aria-selected={sel}
              aria-controls={`vp-${look}-${t.id}`}
              aria-disabled={t.disabled || undefined}
              tabIndex={sel ? 0 : -1}
              className={`fl-ctl-vtab${sel ? " is-on" : ""}${t.disabled ? " is-off" : ""}`}
              ref={(el) => {
                refs.current[t.id] = el;
              }}
              onClick={() => !t.disabled && setOn(t.id)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  move(n, e.key === "ArrowDown" ? 1 : -1);
                } else if (e.key === "Home" || e.key === "End") {
                  e.preventDefault();
                  move(e.key === "Home" ? -1 : 0, e.key === "Home" ? 1 : -1);
                }
              }}
            >
              <Icon name={t.icon} />
              <span>{t.label}</span>
              {t.count ? <span className="fl-ctl-vtab-count">{t.count}</span> : null}
            </button>
          );
        })}
      </div>
      <div className="fl-ctl-vtabs-panel" role="tabpanel" id={`vp-${look}-${here.id}`} aria-labelledby={`vt-${look}-${here.id}`} tabIndex={0}>
        <h4>{here.label}</h4>
        <p className="fl-ctl-matrix-what">{here.body}</p>
      </div>
    </div>
  );
}

export default function TabsVertical() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--specimen">
      <ul className="fl-ctl-vtabs-list">
        {d.looks.map((l) => (
          <li key={l.id}>
            <p className="fl-ctl-matrix-kind">{l.label}</p>
            <p className="fl-ctl-matrix-what">{l.what}</p>
            <Rail look={l.id} />
          </li>
        ))}
      </ul>

      <div className="fl-ctl-sizes">
        <h3>When to turn tabs on their side</h3>
        <p className="fl-ctl-btn-what">
          Six sections or more, or labels longer than two words: a vertical rail holds them without wrapping. Fewer and
          shorter than that, keep them horizontal. Archived is disabled here to show a section that exists but is empty.
        </p>
      </div>
    </section>
  );
}
