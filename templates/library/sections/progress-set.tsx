/** @flowcode-library progress-set · Progress set (track) (Alerts and states)
 * Catalog ID: c.progress@track (component version)
 * Version of: c.progress
 * Function: Four progress styles: a labelled upload bar, a segmented multi-step order bar, a stacked storage-by-type bar with legend, and a goal ring.
 * Use it as: import { Progress } from "./progress-indicators"; <Progress version="track" value={64} caption="glaze-tests.zip" valueText="64%" tone?="accent"|"success"|"danger" />
 * Look: A thicker labelled track on a sunken, bordered well with a pill-shaped accent fill (green when finished, red when cancelled), the file name on the left and the percentage on the right.
 * Tokens: --color-accent --color-success --color-danger --color-surface-sunken --color-border --color-text-muted --text-sm --space-2 --space-3 --duration-base --easing
 * Use cases: upload progress; order status; storage usage; goal tracking; quota usage; fundraising goal; delivery tracking; fitness goal
 * Jobs to be done: track my order's progress; see how much storage i have left; check progress toward my goal; follow an upload until it finishes
 * Keywords: progress, progress bar, steps, usage, storage, ring, circular, goal
 */
/**
 * Progress set: four ways to show how far along something is. A labelled bar (a photo upload), a segmented bar for a
 * multi-step order, a stacked bar for storage split by type with a legend, and a ring for a monthly goal. The labelled
 * bar is c.progress@track; the rest are c.progress steps, stacked and ring with this piece's sample content; the
 * implementation lives in the component, in ./progress-indicators. Make it the app's own: replace SAMPLE and wire each
 * value to your real upload, order status, usage or goal.
 */
import { Progress } from "./progress-indicators";

// flowcode:sample
const SAMPLE = {
  title: "Progress",
  lede: "Uploads, orders, storage and goals at a glance.",
  upload: { title: "Upload kiln photos", file: "glaze-tests-november.zip", value: 64 },
  order: {
    title: "Commission #2291",
    steps: ["Ordered", "Paid", "Thrown", "Fired", "Ready to collect"],
    current: 2,
  },
  storage: {
    title: "Studio storage",
    limitGb: 20,
    parts: [
      { label: "Photos", value: 8.4 },
      { label: "Videos", value: 5.1 },
      { label: "Documents", value: 1.9 },
      { label: "Other", value: 1.2 },
    ],
    warn: "Over 80% full. Archive old videos to free up space.",
  },
  goal: { title: "Classes this month", target: 12, value: 9 },
};

export default function ProgressSet() {
  const d = SAMPLE;
  const used = d.storage.parts.reduce((n, p) => n + p.value, 0);
  return (
    <section className="fl-section fl-section--tint" aria-labelledby="progress-set-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <h2 id="progress-set-title" className="fl-title fl-title--md">
            {d.title}
          </h2>
          <p className="fl-text">{d.lede}</p>
        </div>
        <div className="fl-dsp-prog-grid">
          <article className="fl-card fl-dsp-prog-card" aria-labelledby="prog-upload">
            <h3 id="prog-upload">{d.upload.title}</h3>
            <Progress version="track" value={d.upload.value} caption={d.upload.file} valueText={`${d.upload.value}%`} />
          </article>

          <article className="fl-card fl-dsp-prog-card" aria-labelledby="prog-order">
            <h3 id="prog-order">{d.order.title}</h3>
            <p className="fl-meta">
              Step {d.order.current + 1} of {d.order.steps.length}: <strong style={{ color: "var(--color-text)" }}>{d.order.steps[d.order.current]}</strong>
            </p>
            <Progress variant="steps" steps={d.order.steps} current={d.order.current} label="Order progress" />
          </article>

          <article className="fl-card fl-dsp-prog-card" aria-labelledby="prog-storage">
            <h3 id="prog-storage">{d.storage.title}</h3>
            <p className="fl-meta">
              <strong style={{ color: "var(--color-text)" }}>{used.toFixed(1)} GB</strong> of {d.storage.limitGb} GB used
            </p>
            <Progress variant="stacked" segments={d.storage.parts} max={d.storage.limitGb} unit="GB" />
            {used / d.storage.limitGb >= 0.8 ? <p className="fl-dsp-err">{d.storage.warn}</p> : null}
          </article>

          <article className="fl-card fl-dsp-prog-card" aria-labelledby="prog-goal">
            <h3 id="prog-goal">{d.goal.title}</h3>
            <Progress variant="ring" large value={Math.round((d.goal.value / d.goal.target) * 100)} label={d.goal.title}>
              <p className="fl-text">
                {d.goal.value} of {d.goal.target} classes
              </p>
            </Progress>
          </article>
        </div>
      </div>
    </section>
  );
}
