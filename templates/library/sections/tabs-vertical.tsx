/** @flowcode-library tabs-vertical · Vertical tabs: a rail of sections beside the panel (Tabs, breadcrumbs and paging)
 * Catalog ID: c.tabs (component)
 * Function: The vertical orientation of the one tabs control (c.tabs): a rail of sections beside the panel, with Up/Down, Home and End keys, in plain and filled looks.
 * Use it as: The vertical reference sheet for c.tabs: import { Tabs } from "./tabs-variants"; <Tabs orientation="vertical" variant?="plain"|"filled" tabs={[...]} label="Settings sections" />
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
 * Dependencies: the Tabs component from "./tabs-variants" (React and the library's inline icon set). Nothing else — no
 * package to install and nothing fetched at run time. The styles are the library's own fl- classes in
 * templates/library/css, and the sample data is in the file, so the piece runs in a built app exactly as it runs here.
 */
import { Tabs } from "./tabs-variants";

// flowcode:sample
const SAMPLE = {
  looks: [
    { id: "plain" as const, label: "Plain", what: "A line down the side marks the one you are on" },
    { id: "filled" as const, label: "Filled", what: "The chosen row is a block: easier on a busy page" },
  ],
  tabs: [
    { id: "profile", label: "Profile", icon: "users", count: 0, panel: "Your name, photo and the address clients see." },
    { id: "notify", label: "Notifications", icon: "bell", count: 3, panel: "What we email you about, and when we stop." },
    { id: "billing", label: "Billing and plan", icon: "chart", count: 0, panel: "Your plan, your invoices and the card on file." },
    { id: "security", label: "Security", icon: "lock", count: 1, panel: "Password, two-factor sign-in and signed-in devices." },
    { id: "team", label: "Team members", icon: "users", count: 0, panel: "Who else can get into this studio, and what they may do." },
    { id: "archive", label: "Archived", icon: "folder", count: 0, panel: "Nothing archived yet.", disabled: true },
  ],
};

export default function TabsVertical() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-spec fl-ctl-spec--wide fl-ctl-spec--bare">
        <ul className="fl-ctl-vtabs-list">
          {d.looks.map((l) => (
            <li key={l.id} className="fl-ctl-spec">
              <p className="fl-ctl-matrix-kind">{l.label}</p>
              <p className="fl-ctl-matrix-what">{l.what}</p>
              <Tabs orientation="vertical" variant={l.id} tabs={d.tabs} label="Settings sections" />
            </li>
          ))}
        </ul>
      </div>

      <div className="fl-ctl-sizes fl-ctl-spec">
        <h3>When to turn tabs on their side</h3>
        <p className="fl-ctl-btn-what">
          Six sections or more, or labels longer than two words: a vertical rail holds them without wrapping. Fewer and
          shorter than that, keep them horizontal. Archived is disabled here to show a section that exists but is empty.
        </p>
      </div>
    </section>
  );
}
