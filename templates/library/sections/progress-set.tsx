/** @flowcode-library progress-set · Progress set (Charts and data)
 * Use cases: upload progress; order status; storage usage; goal tracking; quota usage; fundraising goal; delivery tracking; fitness goal
 * Jobs to be done: track my order's progress; see how much storage i have left; check progress toward my goal; follow an upload until it finishes
 * Keywords: progress, progress bar, steps, usage, storage, ring, circular, goal
 */
/**
 * Progress set: four ways to show how far along something is. A labelled bar (a photo upload you can start and
 * cancel), a segmented bar for a multi-step order, a stacked bar for storage split by type with a legend, and a
 * ring for a monthly goal. Use whichever fits; each works on its own. Make it the app's own: replace SAMPLE and wire
 * each value to your real upload, order status, usage or goal.
 */
import { useEffect, useRef, useState } from "react";

// flowcode:sample
const SAMPLE = {
  title: "Progress",
  lede: "Uploads, orders, storage and goals at a glance.",
  upload: { title: "Upload kiln photos", file: "glaze-tests-november.zip", start: "Start upload", cancel: "Cancel", again: "Upload another", done: "Upload finished. 24 photos added to the album.", cancelled: "Upload cancelled. Nothing was saved." },
  order: {
    title: "Commission #2291",
    steps: ["Ordered", "Paid", "Thrown", "Fired", "Ready to collect"],
    current: 2,
    done: "Ready to collect from the studio.",
  },
  storage: {
    title: "Studio storage",
    limitGb: 20,
    parts: [
      { label: "Photos", gb: 8.4, cls: "fl-dsp-c1" },
      { label: "Videos", gb: 5.1, cls: "fl-dsp-c2" },
      { label: "Documents", gb: 1.9, cls: "fl-dsp-c3" },
      { label: "Other", gb: 1.2, cls: "fl-dsp-c4" },
    ],
    warnAt: 0.8,
    warn: "Over 80% full. Archive old videos to free up space.",
  },
  goal: { title: "Classes this month", target: 12, value: 9, add: "Log a class", reset: "Reset", reached: "Goal reached. Nice work this month." },
};

export default function ProgressSet() {
  const d = SAMPLE;

  // Upload
  const [up, setUp] = useState(0);
  const [upState, setUpState] = useState<"idle" | "running" | "done" | "cancelled">("idle");
  const tick = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearInterval(tick.current), []);
  function startUpload() {
    setUp(0);
    setUpState("running");
    window.clearInterval(tick.current);
    tick.current = window.setInterval(() => {
      setUp((v) => {
        const next = Math.min(100, v + 7 + Math.round(Math.random() * 6));
        if (next >= 100) {
          window.clearInterval(tick.current);
          setUpState("done");
        }
        return next;
      });
    }, 220);
  }
  function cancelUpload() {
    window.clearInterval(tick.current);
    setUpState("cancelled");
  }

  // Order steps
  const [step, setStep] = useState(d.order.current);
  const last = d.order.steps.length - 1;

  // Storage
  const used = d.storage.parts.reduce((s, p) => s + p.gb, 0);
  const usedPct = used / d.storage.limitGb;

  // Goal ring
  const [goal, setGoal] = useState(d.goal.value);
  const pct = Math.min(1, goal / d.goal.target);
  const r = 52;
  const circ = 2 * Math.PI * r;

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
          {/* Labelled bar */}
          <article className="fl-card fl-dsp-prog-card" aria-labelledby="prog-upload">
            <h3 id="prog-upload">{d.upload.title}</h3>
            <div className="fl-dsp-bar-row">
              <div className="fl-dsp-bar-row__top">
                <span id="prog-upload-file">{d.upload.file}</span>
                <span>{upState === "idle" ? "Not started" : `${up}%`}</span>
              </div>
              <div className="fl-dsp-track" role="progressbar" aria-labelledby="prog-upload-file" aria-valuemin={0} aria-valuemax={100} aria-valuenow={up}>
                <div className={`fl-dsp-fill${upState === "done" ? " fl-dsp-fill--success" : upState === "cancelled" ? " fl-dsp-fill--danger" : ""}`} style={{ width: `${up}%` }} />
              </div>
            </div>
            <p className="fl-dsp-status" aria-live="polite">
              {upState === "done" && <span className="fl-dsp-ok">{d.upload.done}</span>}
              {upState === "cancelled" && <span className="fl-dsp-err">{d.upload.cancelled}</span>}
            </p>
            <div className="fl-actions">
              {upState === "running" ? (
                <button type="button" className="fl-dsp-btn" onClick={cancelUpload}>
                  {d.upload.cancel}
                </button>
              ) : (
                <button type="button" className="fl-dsp-btn fl-dsp-btn--primary" onClick={startUpload}>
                  {upState === "idle" ? d.upload.start : d.upload.again}
                </button>
              )}
            </div>
          </article>

          {/* Segmented steps */}
          <article className="fl-card fl-dsp-prog-card" aria-labelledby="prog-order">
            <h3 id="prog-order">{d.order.title}</h3>
            <p className="fl-meta" aria-live="polite">
              Step {step + 1} of {d.order.steps.length}: <strong style={{ color: "var(--color-text)" }}>{d.order.steps[step]}</strong>
            </p>
            <ol className="fl-dsp-steps" aria-label="Order progress">
              {d.order.steps.map((s, i) => (
                <li key={s} data-state={i < step || step === last ? "done" : i === step ? "current" : "todo"} aria-current={i === step ? "step" : undefined}>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            {step === last && <p className="fl-done">{d.order.done}</p>}
            <div className="fl-actions">
              <button type="button" className="fl-dsp-btn" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                Back a step
              </button>
              <button type="button" className="fl-dsp-btn fl-dsp-btn--primary" onClick={() => setStep((s) => Math.min(last, s + 1))} disabled={step === last}>
                Next step
              </button>
            </div>
          </article>

          {/* Stacked usage */}
          <article className="fl-card fl-dsp-prog-card" aria-labelledby="prog-storage">
            <h3 id="prog-storage">{d.storage.title}</h3>
            <p className="fl-meta">
              <strong style={{ color: "var(--color-text)" }}>{used.toFixed(1)} GB</strong> of {d.storage.limitGb} GB used
            </p>
            <div className="fl-dsp-track" role="img" aria-label={`${used.toFixed(1)} of ${d.storage.limitGb} GB used: ${d.storage.parts.map((p) => `${p.label} ${p.gb} GB`).join(", ")}`} style={{ height: "0.875rem" }}>
              {d.storage.parts.map((p) => (
                <div key={p.label} className={`fl-dsp-seg ${p.cls}`} style={{ width: `${(p.gb / d.storage.limitGb) * 100}%` }} />
              ))}
            </div>
            <ul className="fl-dsp-legend">
              {d.storage.parts.map((p) => (
                <li key={p.label}>
                  <i className={p.cls} aria-hidden="true" />
                  {p.label} <span>{p.gb} GB</span>
                </li>
              ))}
              <li>
                <i aria-hidden="true" style={{ background: "var(--color-surface-sunken)", border: "1px solid var(--color-border)" }} />
                Free <span>{(d.storage.limitGb - used).toFixed(1)} GB</span>
              </li>
            </ul>
            {usedPct >= d.storage.warnAt && <p className="fl-dsp-err">{d.storage.warn}</p>}
          </article>

          {/* Ring */}
          <article className="fl-card fl-dsp-prog-card" aria-labelledby="prog-goal">
            <h3 id="prog-goal">{d.goal.title}</h3>
            <div className="fl-dsp-ring">
              <div className="fl-dsp-ring__wrap" role="progressbar" aria-labelledby="prog-goal" aria-valuemin={0} aria-valuemax={d.goal.target} aria-valuenow={goal} aria-valuetext={`${goal} of ${d.goal.target} classes`}>
                <svg viewBox="0 0 120 120" aria-hidden="true">
                  <circle className="fl-dsp-ring__bg" cx="60" cy="60" r={r} />
                  <circle className="fl-dsp-ring__fg" cx="60" cy="60" r={r} strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} />
                </svg>
                <strong>{Math.round(pct * 100)}%</strong>
              </div>
              <div className="fl-dsp-ring__text">
                <p className="fl-text" aria-live="polite">
                  {goal} of {d.goal.target} classes
                </p>
                {goal >= d.goal.target && <p className="fl-dsp-ok" style={{ margin: 0, fontWeight: "var(--weight-semibold)" }}>{d.goal.reached}</p>}
                <div className="fl-actions">
                  <button type="button" className="fl-dsp-btn fl-dsp-btn--primary" onClick={() => setGoal((g) => g + 1)} disabled={goal >= d.goal.target}>
                    {d.goal.add}
                  </button>
                  <button type="button" className="fl-dsp-btn" onClick={() => setGoal(0)} disabled={goal === 0}>
                    {d.goal.reset}
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
