/** @flowcode-library tabs-variants · Horizontal tabs: underline, pills and enclosed (Tabs, breadcrumbs and paging)
 * Use cases: record detail sections; settings groups; report views; inbox filters; dashboard ranges
 * Jobs to be done: move between parts of one thing; see which part I am on; count what is in each part
 * Keywords: tabs, underline, pills, enclosed, selected, disabled, badge
 */
/**
 * Three looks for one control, and all three work: click a tab or use the arrow keys, and the panel below changes.
 * Tabs switch between parts of one thing. If the parts are separate pages, that is navigation, not tabs.
 *
 * Make it the app's own: keep one look across the app, and keep the counts only on tabs that filter a list.
 */
/**
 * How to try it
 * - Press any tab, or focus one and use the arrow keys: the panel below it changes.
 * - Only one tab in each set is in the tab order; the arrows move between them.
 *
 * Dependencies: React (useState). Nothing else — no package to install and nothing fetched at run time. The styles are the
 * library's own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs in a built app
 * exactly as it runs here.
 */
import { useState } from "react";

// flowcode:sample
const SAMPLE = {
  looks: [
    { id: "underline", label: "Underline", what: "A rule under the selected tab" },
    { id: "pills", label: "Pills", what: "A filled pill: good on a tinted surface" },
    { id: "enclosed", label: "Enclosed", what: "Folder tabs joined to the panel" },
  ],
  tabs: [
    { id: "all", label: "All", count: 24, body: "Every booking, newest first." },
    { id: "open", label: "Open", count: 6, body: "Six bookings still waiting on someone." },
    { id: "done", label: "Done", count: 18, body: "Eighteen finished and delivered." },
    { id: "archive", label: "Archive", count: 0, body: "Nothing archived yet.", disabled: true },
  ],
  sizes: [32, 40, 44],
};

function TabSet({ look, size = "" }: { look: { id: string; label: string }; size?: string }) {
  const d = SAMPLE;
  const [on, setOn] = useState("open");
  const usable = d.tabs.filter((t) => !t.disabled);
  const move = (dir: number) => {
    const i = usable.findIndex((t) => t.id === on);
    setOn(usable[(i + dir + usable.length) % usable.length]!.id);
  };
  const current = d.tabs.find((t) => t.id === on);
  return (
    <>
      <div
        className={`fl-ctl-tabset fl-ctl-tabset--${look.id} ${size}`}
        role="tablist"
        aria-label={`${look.label} tabs`}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") (e.preventDefault(), move(1));
          if (e.key === "ArrowLeft") (e.preventDefault(), move(-1));
        }}
      >
        {d.tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${look.id}-${t.id}`}
            aria-selected={on === t.id}
            aria-controls={`panel-${look.id}`}
            tabIndex={on === t.id ? 0 : -1}
            disabled={t.disabled}
            className={`fl-spec-tab${on === t.id ? " is-on" : ""}`}
            onClick={() => setOn(t.id)}
          >
            {t.label}
            <span className="fl-ctl-tab-count">{t.count}</span>
          </button>
        ))}
      </div>
      <div className="fl-ctl-tabpanel" role="tabpanel" id={`panel-${look.id}`} aria-labelledby={`tab-${look.id}-${on}`} tabIndex={0}>
        <span className="fl-ctl-matrix-what">{current?.body}</span>
      </div>
    </>
  );
}

export default function TabsVariants() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--specimen">
      <ul className="fl-ctl-tabs-list">
        {d.looks.map((l) => (
          <li key={l.id}>
            <p className="fl-ctl-matrix-kind">{l.label}</p>
            <p className="fl-ctl-matrix-what">{l.what} \u00b7 click a tab, or use the arrow keys.</p>
            <TabSet look={l} />
          </li>
        ))}
      </ul>

      <div className="fl-ctl-sizes">
        <h3>Heights</h3>
        <p className="fl-ctl-btn-what">Three of the button heights. Tabs sit above content, so they rarely need to be taller than 44.</p>
        <ul className="fl-ctl-size-list">
          {d.sizes.map((px) => (
            <li key={px}>
              <span className="fl-ctl-tab-sample">
                <TabSet look={{ id: "underline", label: `${px} px` }} size={`fl-ctl-tabset--${px}`} />
              </span>
              <span className="fl-ctl-btn-what">{px} px</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
