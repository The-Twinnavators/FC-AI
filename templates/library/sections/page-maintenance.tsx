/** @flowcode-library page-maintenance · Planned maintenance (Alerts and states)
 * Use cases: maintenance page; planned downtime; scheduled outage; service status; system upgrade notice; outage notice; back soon
 * Jobs to be done: know when the service is back; see which features are affected; get notified when it returns; plan around the downtime
 * Keywords: maintenance, downtime, status, page, notify
 */
/**
 * Planned maintenance: tells people the app is down on purpose, when it started, when it should be back (with a live
 * countdown) and which parts are affected, in a status list they can filter. A "tell me when it's back" form keeps
 * the email in local storage instead of sending it. Use it as the page shown during a planned outage. Make it the
 * app's own: replace SAMPLE with the real window and the app's real services.
 */
import { useEffect, useId, useState, type FormEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  title: "We're tidying up the booking system",
  text: "Planned maintenance tonight while the studio is closed. Classes already booked are not affected.",
  startedMinutesAgo: 25,
  backInMinutes: 95,
  services: [
    { name: "Class bookings", detail: "New bookings and changes", state: "maintenance" },
    { name: "Payments", detail: "Card payments and gift cards", state: "maintenance" },
    { name: "Member accounts", detail: "Sign in and profile", state: "down" },
    { name: "Timetable", detail: "Read-only, still visible", state: "up" },
    { name: "Studio phone line", detail: "Open until 9 pm", state: "up" },
  ],
  stateLabels: { up: "Working", maintenance: "In maintenance", down: "Unavailable" } as Record<string, string>,
  storageKey: "studio-maintenance-notify",
};

const fmtTime = (date: Date) => date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export default function PageMaintenance() {
  const d = SAMPLE;
  const id = useId();
  const [start] = useState(() => new Date(Date.now() - d.startedMinutesAgo * 60000));
  const [end] = useState(() => new Date(Date.now() + d.backInMinutes * 60000));
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState<"all" | "affected">("all");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, []);

  const left = Math.max(0, Math.round((end.getTime() - now) / 60000));
  const leftLabel = left === 0 ? "Any minute" : left >= 60 ? `${Math.floor(left / 60)} h ${left % 60} min` : `${left} min`;
  const shown = d.services.filter((s) => filter === "all" || s.state !== "up");
  const affected = d.services.filter((s) => s.state !== "up").length;

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) return setError("Enter your email address.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return setError("That doesn't look like an email address.");
    try {
      const list = JSON.parse(localStorage.getItem(d.storageKey) ?? "[]") as string[];
      localStorage.setItem(d.storageKey, JSON.stringify([...new Set([...list, value])]));
    } catch {
      /* storage unavailable: the confirmation still shows */
    }
    setError("");
    setSaved(true);
  };

  return (
    <section className="fl-section fl-section--tint" aria-labelledby={`${id}-title`}>
      <div className="fl-wrap fl-err-layout">
        <div style={{ display: "grid", gap: "var(--space-6)" }}>
          <div className="fl-head">
            <span className="fl-err-badge fl-err-badge--info" style={{ justifySelf: "start" }}>
              <span className="fl-err-dot fl-err-dot--pulse" aria-hidden="true" />
              Planned maintenance
            </span>
            <h1 id={`${id}-title`} className="fl-title">
              {d.title}
            </h1>
            <p className="fl-lede">{d.text}</p>
          </div>

          <dl className="fl-err-when">
            <div>
              <dt>Started</dt>
              <dd>{fmtTime(start)}</dd>
            </div>
            <div>
              <dt>Back by</dt>
              <dd>{fmtTime(end)}</dd>
            </div>
            <div>
              <dt>Time left</dt>
              <dd aria-live="polite">{leftLabel}</dd>
            </div>
          </dl>

          <div className="fl-card fl-err-subscribe">
            <h2 className="fl-title fl-title--md" style={{ fontSize: "var(--text-lg)" }}>
              Tell me when it's back
            </h2>
            <div aria-live="polite">
              {saved && (
                <p className="fl-done" style={{ margin: 0 }}>
                  Done. We'll email {email.trim()} once bookings reopen.
                </p>
              )}
            </div>
            {!saved && (
              <form className="fl-form" onSubmit={submit} noValidate>
                <div className="fl-field">
                  <label htmlFor={`${id}-email`}>Email</label>
                  <div className="fl-inline-form">
                    <input
                      id={`${id}-email`}
                      type="email"
                      className="fl-input"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError("");
                      }}
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? `${id}-err` : `${id}-hint`}
                    />
                    <button type="submit" className="fl-btn fl-btn--primary">
                      <Icon name="mail" />
                      Notify me
                    </button>
                  </div>
                  {error ? (
                    <p id={`${id}-err`} className="fl-err-field-error">
                      {error}
                    </p>
                  ) : (
                    <p id={`${id}-hint`} className="fl-note" style={{ margin: 0 }}>
                      One email, then we forget your address.
                    </p>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>

        <div className="fl-card" style={{ gap: "var(--space-4)" }}>
          <div className="fl-err-row">
            <h2 className="fl-title fl-title--md" style={{ fontSize: "var(--text-lg)" }} id={`${id}-status`}>
              Service status
            </h2>
            <div className="fl-toggle" role="group" aria-label="Show services">
              <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
                All {d.services.length}
              </button>
              <button type="button" aria-pressed={filter === "affected"} onClick={() => setFilter("affected")}>
                Affected {affected}
              </button>
            </div>
          </div>
          {shown.length === 0 ? (
            <p className="fl-err-status fl-err-status--good">Everything is working.</p>
          ) : (
            <ul className="fl-err-list" aria-labelledby={`${id}-status`}>
              {shown.map((s) => (
                <li key={s.name}>
                  <span>
                    <strong>{s.name}</strong>
                    <small>{s.detail}</small>
                  </span>
                  <span className="fl-err-pill" data-state={s.state}>
                    <span className="fl-err-dot" aria-hidden="true" />
                    {d.stateLabels[s.state] ?? s.state}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="fl-meta fl-err-meta">
            <Icon name="clock" />
            Times are shown in your time zone.
          </p>
        </div>
      </div>
    </section>
  );
}
