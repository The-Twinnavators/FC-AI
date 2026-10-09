/** @flowcode-library alert-inline · Inline alerts (Alerts and states)
 * Use cases: form errors; success message; warning notice; system status; account notices; payment failed; validation feedback; info message
 * Jobs to be done: know what went wrong and fix it; confirm my change was saved; notice something that needs my attention; dismiss a message i've read
 * Keywords: alert, message, notice, status, feedback, dismissible
 */
/**
 * Alerts: inline messages in four tones (info, success, warning, error). Each has an icon, a title, a line of text
 * and, when useful, one action; the dismissible ones close and can be brought back. Use them inside a page to explain
 * what just happened or what needs attention. Make it the app's own: replace SAMPLE with the app's real messages and
 * keep only the tones it needs; errors stay until the problem is fixed, so they are not dismissible.
 */
import { useState } from "react";

// flowcode:sample
const SAMPLE = {
  title: "Booking messages",
  lede: "What people see when something about their booking changes.",
  alerts: [
    { id: "info", tone: "info", title: "Opening hours change next week", text: "The studio opens at 10:00 from Monday 14 October while the new floor goes in.", action: "See new hours", dismissible: true },
    { id: "success", tone: "success", title: "Booking confirmed", text: "Pottery for beginners, Saturday at 11:00. A reminder will arrive the day before.", action: "Add to calendar", dismissible: true },
    { id: "warning", tone: "warning", title: "Only 2 places left", text: "The Thursday evening class is nearly full. Book soon to keep your spot.", action: "", dismissible: true },
    { id: "error", tone: "error", title: "Your card was declined", text: "The payment for your class pass did not go through. Try another card to keep the booking.", action: "Update payment", dismissible: false },
  ],
  restore: "Show messages again",
};

type Tone = "info" | "success" | "warning" | "error";
const TONE_LABEL: Record<Tone, string> = { info: "Information", success: "Success", warning: "Warning", error: "Error" };
const TONE_PATH: Record<Tone, string> = {
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01",
  success: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12.5l2.5 2.5L16 9.5",
  warning: "M12 4 2.5 20h19zM12 10v4M12 17h.01",
  error: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 9l6 6M15 9l-6 6",
};

function ToneIcon({ tone }: { tone: Tone }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={TONE_PATH[tone]} />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export default function AlertInline() {
  const d = SAMPLE;
  const [closed, setClosed] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const shown = d.alerts.filter((a) => !closed.includes(a.id));

  const dismiss = (id: string, title: string) => {
    setClosed((c) => [...c, id]);
    setStatus(`Dismissed: ${title}`);
  };
  // An error is cleared by fixing it: its action resolves it. Other actions just confirm.
  const act = (a: (typeof d.alerts)[number]) => {
    if (!a.dismissible) {
      setClosed((c) => [...c, a.id]);
      setStatus(`Fixed: ${a.title}. The booking is kept.`);
    } else setStatus(`${a.action}: done.`);
  };

  return (
    <section className="fl-section" aria-labelledby="alert-inline-title">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <h2 id="alert-inline-title" className="fl-title fl-title--md">
            {d.title}
          </h2>
          <p className="fl-text">{d.lede}</p>
        </div>
        {shown.length === 0 ? (
          <p className="fl-done">All caught up. There are no messages right now.</p>
        ) : (
          <ul className="fl-alr-stack">
            {shown.map((a) => {
              const tone = a.tone as Tone;
              return (
                <li key={a.id} className={`fl-alr fl-alr-tone-${tone}`} role={tone === "error" ? "alert" : undefined}>
                  <span className="fl-alr__icon">
                    <ToneIcon tone={tone} />
                  </span>
                  <div className="fl-alr__body">
                    <p className="fl-alr__title">
                      <span className="fl-sr">{TONE_LABEL[tone]}: </span>
                      {a.title}
                    </p>
                    <p className="fl-alr__text">{a.text}</p>
                    {a.action && (
                      <div className="fl-alr__actions">
                        <button type="button" className="fl-alr__action" onClick={() => act(a)}>
                          {a.action}
                        </button>
                      </div>
                    )}
                  </div>
                  {a.dismissible ? (
                    <button type="button" className="fl-alr__close" aria-label={`Dismiss: ${a.title}`} onClick={() => dismiss(a.id, a.title)}>
                      <CloseIcon />
                    </button>
                  ) : (
                    <span />
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="fl-alr-restore" style={{ marginTop: "var(--space-5)" }}>
          <p className="fl-meta" role="status" aria-live="polite" style={{ margin: 0 }}>
            {status}
          </p>
          {closed.length > 0 && (
            <button
              type="button"
              className="fl-btn fl-btn--secondary"
              onClick={() => {
                setClosed([]);
                setStatus("Dismissed messages are back.");
              }}
            >
              {d.restore} ({closed.length})
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
