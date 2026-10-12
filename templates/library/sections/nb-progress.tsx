/** @flowcode-library nb-progress · Neobrutal progress (neobrutal) (Alerts and states)
 * Catalog ID: c.progress@neobrutal (component version)
 * Version of: c.progress
 * Function: Chunky progress bars with captions and a striped running fill.
 * Use it as: import { Progress } from "./progress-indicators"; <Progress version="neobrutal" value={60} caption="Uploading" valueText="60%" striped? tone?="accent"|"warning" />
 * Look: Ink-bordered bars with a hard shadow, a caption and value above, and a striped running fill for work in progress.
 * Tokens: --color-text --color-surface --color-accent --color-on-accent --radius-sm --space-2 --space-4 --space-5 --weight-bold --focus-ring
 * Use cases: usage limits; uploads; capacity; goals
 * Jobs to be done: see how far along something is; know how much of my limit is left
 * Keywords: progress, upload, usage, neobrutalism
 */
/**
 * Neobrutalist progress: c.progress@neobrutal with this piece's sample content; the implementation lives in the
 * component, in ./progress-indicators. Ink-bordered bars with a caption and value, and a striped running fill for
 * work in progress. Use them for usage limits, uploads or capacity.
 * Make it the app's own: replace SAMPLE and drive each value from the real task.
 */
import { Progress } from "./progress-indicators";

// flowcode:sample
const SAMPLE = {
  title: "This month",
  bars: [
    { label: "Classes used this month", value: 3, max: 4, tone: "accent" as const },
    { label: "Kiln load", value: 85, max: 100, tone: "warning" as const },
  ],
  upload: { label: "Uploading class photos", value: 60 },
};

export default function NbProgress() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-nb" aria-labelledby="nb-progress-title">
      <div className="fl-wrap fl-wrap--narrow fl-nb-stack">
        <h2 id="nb-progress-title" className="fl-title">
          {d.title}
        </h2>
        <div className="fl-nb-box" style={{ padding: "var(--space-5)", display: "grid", gap: "var(--space-5)" }}>
          {d.bars.map((b) => (
            <Progress key={b.label} version="neobrutal" tone={b.tone} value={Math.round((b.value / b.max) * 100)} caption={b.label} valueText={`${b.value} of ${b.max}`} />
          ))}
          <Progress version="neobrutal" striped value={d.upload.value} caption={d.upload.label} valueText={`${d.upload.value}%`} />
        </div>
      </div>
    </section>
  );
}
