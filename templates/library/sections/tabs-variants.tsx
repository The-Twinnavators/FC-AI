/** @flowcode-library tabs-variants - Tabs: underline, pills and enclosed (Tabs, breadcrumbs and paging)
 * Use cases: record detail sections; settings groups; report views; inbox filters; dashboard ranges
 * Jobs to be done: move between parts of one thing; see which part I am on; count what is in each part
 * Keywords: tabs, underline, pills, enclosed, selected, disabled, badge
 */
/**
 * Three looks for the same control, in every state, with and without counts. Tabs switch between parts of one thing;
 * if the parts are separate pages, use navigation instead.
 *
 * Make it the app's own: keep one look across the app. Counts belong on tabs that filter a list, not on every tab.
 */

// flowcode:sample
const SAMPLE = {
  looks: [
    { id: "underline", label: "Underline", what: "A rule under the chosen tab" },
    { id: "pills", label: "Pills", what: "A filled pill: good on a tinted surface" },
    { id: "enclosed", label: "Enclosed", what: "Folder tabs joined to the panel" },
  ],
  tabs: [
    { id: "all", label: "All", count: 24, state: "rest" },
    { id: "open", label: "Open", count: 6, state: "selected" },
    { id: "done", label: "Done", count: 18, state: "rest" },
    { id: "archive", label: "Archive", count: 0, state: "disabled" },
  ],
  sizes: [32, 40, 44],
};

export default function TabsVariants() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--specimen">
      <ul className="fl-ctl-tabs-list">
        {d.looks.map((l) => (
          <li key={l.id}>
            <p className="fl-ctl-matrix-kind">{l.label}</p>
            <p className="fl-ctl-matrix-what">{l.what}</p>
            <div className={`fl-ctl-tabset fl-ctl-tabset--${l.id}`} role="tablist" aria-label={`${l.label} tabs`}>
              {d.tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={t.state === "selected"}
                  disabled={t.state === "disabled"}
                  className={`fl-ctl-tab${t.state === "selected" ? " is-on" : ""}${t.id === "done" ? " is-hover" : ""}`}
                >
                  {t.label}
                  <span className="fl-ctl-tab-count">{t.count}</span>
                </button>
              ))}
            </div>
            <div className="fl-ctl-tabpanel" role="tabpanel">
              <span className="fl-ctl-matrix-what">The panel the chosen tab belongs to.</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="fl-ctl-sizes">
        <h3>Heights</h3>
        <p className="fl-ctl-btn-what">Three of the button heights. Tabs sit above content, so they rarely need to be taller than 44.</p>
        <ul className="fl-ctl-size-list">
          {d.sizes.map((px) => (
            <li key={px}>
              <span className={`fl-ctl-tabset fl-ctl-tabset--underline fl-ctl-tabset--${px}`} role="tablist" aria-label={`${px} px tabs`}>
                <button type="button" role="tab" aria-selected="true" className="fl-ctl-tab is-on">
                  Open
                </button>
                <button type="button" role="tab" aria-selected="false" className="fl-ctl-tab">
                  Done
                </button>
              </span>
              <span className="fl-ctl-btn-what">{px} px</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
