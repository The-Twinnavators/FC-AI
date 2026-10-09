/** @flowcode-library nb-feedback · Neobrutal feedback (Neobrutalism kit)
 * Use cases: alerts; notifications; status badges; upload progress; system messages; booking status; dashboard notices
 * Jobs to be done: know if something worked; see the status of my booking; track an upload until it finishes; dismiss notices i have read
 * Keywords: alerts, badges, progress, notifications, status, neobrutalism
 */
/**
 * Neobrutalist feedback: alerts in four tones that can be dismissed (and brought back), status badges, and chunky
 * progress bars with a running upload. Use it for notices on a dashboard, booking status or anything that takes a while.
 * Make it the app's own: replace SAMPLE with real messages and statuses and drive the progress value from the real task.
 */
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Feedback",
  title: "Say it loud, then get out of the way",
  alerts: [
    { id: "info", tone: "info", icon: "sparkle", title: "New evening classes", text: "Tuesday and Thursday wheel classes now run until 9pm." },
    { id: "success", tone: "success", icon: "check", title: "Booking confirmed", text: "Saturday glazing workshop, 10am. We sent the details by email." },
    { id: "warning", tone: "warning", icon: "clock", title: "Two spots left", text: "Sunday hand-building is nearly full. Book soon to keep your place." },
    { id: "error", tone: "error", icon: "shield", title: "Card was declined", text: "We could not take the deposit. Check the card details and try again." },
  ],
  badges: [
    { label: "Open", tone: "success" },
    { label: "Waitlist", tone: "warning" },
    { label: "Full", tone: "error" },
    { label: "New", tone: "info" },
  ],
  bars: [
    { label: "Classes used this month", value: 3, max: 4, tone: "info" },
    { label: "Kiln load", value: 85, max: 100, tone: "warning" },
  ],
  upload: { label: "Uploading class photos", file: "spring-showcase.zip" },
};

const TONE: Record<string, string> = { info: "fl-nb-tone-info", success: "fl-nb-tone-success", warning: "fl-nb-tone-warning", error: "fl-nb-tone-error" };

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export default function NbFeedback() {
  const d = SAMPLE;
  const [hidden, setHidden] = useState<string[]>([]);
  const [announce, setAnnounce] = useState("");
  const [upload, setUpload] = useState(0);
  const [running, setRunning] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => {
      setUpload((u) => {
        const next = Math.min(100, u + 7);
        if (next === 100) setRunning(false);
        return next;
      });
    }, 220);
    return () => window.clearInterval(t);
  }, [running]);

  const visible = d.alerts.filter((a) => !hidden.includes(a.id));

  function dismiss(id: string, title: string) {
    const idx = visible.findIndex((a) => a.id === id);
    setHidden([...hidden, id]);
    setAnnounce(`Dismissed: ${title}.`);
    window.setTimeout(() => {
      const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>(".fl-nb-close");
      if (buttons && buttons.length) buttons[Math.min(idx, buttons.length - 1)].focus();
      else document.getElementById("nb-feedback-restore")?.focus();
    }, 0);
  }

  function startUpload() {
    if (running) return;
    setUpload(0);
    setRunning(true);
  }

  const uploadDone = upload === 100;

  return (
    <section className="fl-section fl-nb" aria-labelledby="nb-feedback-title">
      <div className="fl-wrap fl-wrap--narrow fl-nb-stack">
        <div className="fl-head">
          <p className="fl-nb-kicker">{d.eyebrow}</p>
          <h2 id="nb-feedback-title" className="fl-title">
            {d.title}
          </h2>
        </div>

        <div className="fl-nb-group">
          <h3 className="fl-nb-group__label">Alerts</h3>
          {visible.length > 0 ? (
            <ul ref={listRef} className="fl-nb-alerts">
              {visible.map((a) => (
                <li key={a.id} className={`fl-nb-box fl-nb-alert ${TONE[a.tone]}`} role={a.tone === "error" ? "alert" : undefined}>
                  <span className="fl-nb-alert__icon" aria-hidden="true">
                    <Icon name={a.icon} />
                  </span>
                  <div className="fl-nb-alert__body">
                    <p className="fl-nb-alert__title">{a.title}</p>
                    <p className="fl-nb-alert__text">{a.text}</p>
                  </div>
                  <button type="button" className="fl-nb-close" aria-label={`Dismiss: ${a.title}`} onClick={() => dismiss(a.id, a.title)}>
                    <CloseIcon />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="fl-nb-empty">
              <p>All caught up. No notices right now.</p>
              <button
                id="nb-feedback-restore"
                type="button"
                className="fl-nb-btn fl-nb-btn--sm fl-nb-btn--plain"
                onClick={() => {
                  setHidden([]);
                  setAnnounce("Notices shown again.");
                }}
              >
                Show the notices again
              </button>
            </div>
          )}
          <p className="fl-sr" role="status" aria-live="polite">
            {announce}
          </p>
        </div>

        <div className="fl-nb-group">
          <h3 className="fl-nb-group__label">Badges</h3>
          <ul className="fl-nb-badges">
            {d.badges.map((b) => (
              <li key={b.label} className={`fl-nb-badge ${TONE[b.tone]}`}>
                <span className="fl-nb-dot" aria-hidden="true" />
                {b.label}
              </li>
            ))}
            <li className="fl-nb-badge fl-nb-badge--solid fl-nb-badge--square">12 booked</li>
          </ul>
        </div>

        <div className="fl-nb-group">
          <h3 className="fl-nb-group__label">Progress</h3>
          <div className="fl-nb-box" style={{ padding: "var(--space-5)", display: "grid", gap: "var(--space-5)" }}>
            {d.bars.map((b, i) => {
              const pct = Math.round((b.value / b.max) * 100);
              return (
                <div key={b.label} className={`fl-nb-progress ${TONE[b.tone]}`}>
                  <div className="fl-nb-progress__top">
                    <span id={`nb-feedback-bar-${i}`}>{b.label}</span>
                    <span>
                      {b.value} of {b.max}
                    </span>
                  </div>
                  <div
                    className="fl-nb-progress__track"
                    role="progressbar"
                    aria-labelledby={`nb-feedback-bar-${i}`}
                    aria-valuemin={0}
                    aria-valuemax={b.max}
                    aria-valuenow={b.value}
                  >
                    <div className="fl-nb-progress__fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}

            <div className={`fl-nb-progress ${uploadDone ? "fl-nb-tone-success" : "fl-nb-tone-info"}`}>
              <div className="fl-nb-progress__top">
                <span id="nb-feedback-upload">
                  {d.upload.label} <span className="fl-meta">{d.upload.file}</span>
                </span>
                <span>{upload}%</span>
              </div>
              <div
                className="fl-nb-progress__track"
                role="progressbar"
                aria-labelledby="nb-feedback-upload"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={upload}
                aria-busy={running}
              >
                <div
                  className={`fl-nb-progress__fill fl-nb-progress__fill--striped${upload === 0 ? " fl-nb-progress__fill--empty" : ""}`}
                  style={{ width: `${upload}%` }}
                />
              </div>
              <div className="fl-nb-row" style={{ justifyContent: "space-between", marginTop: "var(--space-2)" }}>
                <p className="fl-nb-status" role="status" aria-live="polite">
                  {uploadDone ? "Upload finished. 24 photos added." : running ? "Uploading…" : "Not started yet."}
                </p>
                <button type="button" className="fl-nb-btn fl-nb-btn--sm fl-nb-btn--primary" onClick={startUpload} aria-disabled={running}>
                  {running && <span className="fl-nb-spin" aria-hidden="true" />}
                  {uploadDone ? "Upload again" : running ? "Uploading" : "Start upload"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
