/** @flowcode-library status-badges · Status badges (Alerts and states)
 * Use cases: order status; task status; deployment status; job queue; ticket status; build progress; workflow tracker; delivery tracking
 * Jobs to be done: see where each item stands; spot what failed at a glance; know when something is still working; track progress over time
 * Keywords: status, badge, chip, signal light, indicator
 */
/**
 * Status badges: status chips with a colored dot (done, in progress, waiting, failed, draft) and signal lights that
 * glow, with a soft pulse while something is working. Shown on a short list of jobs whose status you can move on with
 * a button; each change is announced. Use it for orders, tasks, bookings or anything with a lifecycle.
 * Adapted from FlowCode's own UI (Branding page).
 * Make it the app's own: replace SAMPLE with real items and statuses; keep the order of STATUSES as the lifecycle.
 */
import { useState } from "react";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Studio orders",
  title: "Where every order stands",
  lede: "A dot and a word for each status, so you can scan the list in a second.",
  legendLabel: "Status key",
  statuses: [
    { id: "draft", label: "Draft" },
    { id: "waiting", label: "Waiting" },
    { id: "progress", label: "In progress" },
    { id: "done", label: "Done" },
    { id: "failed", label: "Failed" },
  ],
  items: [
    { id: "o1", title: "Framed print, 40 x 50", meta: "Order 1042 · Priya N.", status: "progress" },
    { id: "o2", title: "Portrait session, Saturday 10:00", meta: "Booking 318 · Tom R.", status: "waiting" },
    { id: "o3", title: "Gift voucher, two sessions", meta: "Order 1039 · Ana L.", status: "done" },
    { id: "o4", title: "Photo book, 24 pages", meta: "Order 1045 · Sam K.", status: "failed" },
    { id: "o5", title: "Family shoot quote", meta: "Draft · not sent yet", status: "draft" },
  ],
  nextLabel: "Move on",
  emptyText: "No orders yet. New ones will show here with their status.",
};

type Status = { id: string; label: string };

function Chip({ status }: { status: Status }) {
  return (
    <span className={`fl-ctl-chip fl-ctl-tone-${status.id}`}>
      <span className={`fl-ctl-led fl-ctl-tone-${status.id}${status.id === "progress" ? " fl-ctl-led--pulse" : ""}`} aria-hidden="true" />
      {status.label}
    </span>
  );
}

export default function StatusBadges() {
  const d = SAMPLE;
  const [items, setItems] = useState(d.items);
  const [said, setSaid] = useState("");
  const find = (id: string) => d.statuses.find((s) => s.id === id) ?? d.statuses[0];

  const advance = (id: string) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const i = d.statuses.findIndex((s) => s.id === it.status);
    const next = d.statuses[(i + 1) % d.statuses.length];
    setItems((list) => list.map((x) => (x.id === id ? { ...x, status: next.id } : x)));
    setSaid(`${it.title} is now ${next.label.toLowerCase()}.`);
  };

  return (
    <section className="fl-section" aria-labelledby="status-badges-title">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="status-badges-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>

        <ul className="fl-ctl-legend" aria-label={d.legendLabel}>
          {d.statuses.map((s) => (
            <li key={s.id}>
              <Chip status={s} />
            </li>
          ))}
        </ul>

        {items.length === 0 ? (
          <p className="fl-note">{d.emptyText}</p>
        ) : (
          <ul className="fl-ctl-list">
            {items.map((it) => {
              const s = find(it.status);
              return (
                <li key={it.id} className="fl-ctl-row">
                  <span
                    className={`fl-ctl-led fl-ctl-tone-${s.id}${s.id === "progress" ? " fl-ctl-led--pulse" : ""}`}
                    role="img"
                    aria-label={s.label}
                  />
                  <div className="fl-ctl-row__body">
                    <p className="fl-ctl-row__title">{it.title}</p>
                    <p className="fl-ctl-row__meta">{it.meta}</p>
                  </div>
                  <Chip status={s} />
                  <button type="button" className="fl-ctl-small-btn" onClick={() => advance(it.id)} aria-label={`${d.nextLabel}: ${it.title}`}>
                    {d.nextLabel}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="fl-sr" aria-live="polite">
          {said}
        </p>
      </div>
    </section>
  );
}
