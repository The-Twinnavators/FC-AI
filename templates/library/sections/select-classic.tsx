/** @flowcode-library select-classic · Classic select (classic) (Forms)
 * Catalog ID: c.select@classic (component version)
 * Version of: c.select
 * Function: A real select element drawn to match the classic combo box, for short lists.
 * Use it as: import { Select } from "./dropdowns-states"; <label htmlFor="room">Room</label><Select id="room" version="classic" options={["A","B"]} placeholder? invalid? />
 * Look: A native select drawn to match the classic combo box: bordered field, muted placeholder and a chevron 8px from the right edge.
 * Tokens: --color-surface --color-border --color-border-strong --color-accent --color-text-muted --control-radius --focus-ring
 * Use cases: room picker; size select; short option lists; settings
 * Jobs to be done: pick an option from a short list; change a setting quickly
 * Keywords: select, dropdown, native select, form
 */
/**
 * Classic native select: c.select@classic with this piece's sample content; the implementation lives in the
 * component, in ./dropdowns-states. A real select element drawn to match the classic combo box, so short lists stay
 * native. Use it for a room, a size or any short list.
 * Make it the app's own: replace SAMPLE with the real options.
 */
import { Select } from "./dropdowns-states";

// flowcode:sample
const SAMPLE = {
  title: "Where are you working?",
  label: "Room",
  placeholder: "Choose a room",
  options: ["Front studio", "Kiln room", "Garden shed", "Upstairs loft"],
};

export default function SelectClassic() {
  const d = SAMPLE;
  return (
    <section className="fl-section" aria-labelledby="select-classic-title">
      <div className="fl-wrap fl-wrap--narrow">
        <h2 id="select-classic-title" className="fl-title fl-title--md">
          {d.title}
        </h2>
        <div style={{ display: "grid", gap: "var(--space-2)", maxWidth: "22rem" }}>
          <label htmlFor="select-classic-room">{d.label}</label>
          <Select id="select-classic-room" version="classic" options={d.options} placeholder={d.placeholder} />
        </div>
      </div>
    </section>
  );
}
