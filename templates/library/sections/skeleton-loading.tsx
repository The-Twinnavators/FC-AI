/** @flowcode-library skeleton-loading · Skeleton loading (Alerts and states)
 * Use cases: loading state; feed loading; dashboard loading; list loading; search results loading; profile loading
 * Jobs to be done: know content is on its way; wait without the page jumping around; see the page shape before data arrives
 * Keywords: skeleton, loading, placeholder, shimmer
 */
/**
 * Skeleton loading: shimmering placeholders shaped like the card list to come, then the real cards after a short
 * wait. Use it wherever content arrives after a moment, so the page keeps its shape instead of jumping.
 * Adapted from FlowCode's own UI (Branding page).
 * Make it the app's own: replace SAMPLE with real items and swap the timer for your real loading; match the
 * placeholder rows to your card layout.
 */
import { useEffect, useRef, useState } from "react";

// flowcode:sample
const SAMPLE = {
  eyebrow: "This week",
  title: "Upcoming bookings",
  loadingLabel: "Loading bookings",
  loadingText: "Fetching this week's bookings…",
  doneText: (n: number) => `${n} bookings this week.`,
  reloadLabel: "Load again",
  emptyText: "No bookings this week. Quiet days are good for editing.",
  delayMs: 1600,
  placeholders: 4,
  items: [
    { id: "b1", initials: "PN", name: "Priya Nair", what: "Portrait session · Tue 10:00", price: "$120" },
    { id: "b2", initials: "TR", name: "Tom Reyes", what: "Family shoot · Wed 15:30", price: "$220" },
    { id: "b3", initials: "AL", name: "Ana Lima", what: "Headshots, two people · Thu 09:00", price: "$160" },
    { id: "b4", initials: "SK", name: "Sam Kerr", what: "Product photos · Fri 13:00", price: "$300" },
  ],
};

export default function SkeletonLoading() {
  const d = SAMPLE;
  const [loading, setLoading] = useState(true);
  const [round, setRound] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setLoading(true);
    timer.current = window.setTimeout(() => setLoading(false), d.delayMs);
    return () => window.clearTimeout(timer.current);
  }, [round, d.delayMs]);

  const items = d.items;

  return (
    <section className="fl-section fl-section--tint" aria-labelledby="skeleton-loading-title">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-ctl-load-head">
          <div className="fl-head" style={{ marginBottom: 0 }}>
            <p className="fl-eyebrow">{d.eyebrow}</p>
            <h2 id="skeleton-loading-title" className="fl-title fl-title--md">
              {d.title}
            </h2>
          </div>
          <button type="button" className="fl-btn fl-btn--secondary" onClick={() => setRound((r) => r + 1)} disabled={loading}>
            {d.reloadLabel}
          </button>
        </div>

        <p className="fl-ctl-load-status" aria-live="polite">
          {loading ? d.loadingText : items.length ? d.doneText(items.length) : ""}
        </p>

        <div aria-busy={loading} style={{ marginTop: "var(--space-4)" }}>
          {loading ? (
            <div role="status">
              <span className="fl-sr">{d.loadingLabel}</span>
              <ul className="fl-ctl-cards" aria-hidden="true">
                {Array.from({ length: d.placeholders }, (_, i) => (
                  <li key={i} className="fl-ctl-card">
                    <span className="fl-ctl-skel fl-ctl-skel--avatar" />
                    <span className="fl-ctl-card__lines">
                      <span className="fl-ctl-skel fl-ctl-skel--title" style={{ width: `${70 - ((i * 13) % 30)}%` }} />
                      <span className="fl-ctl-skel fl-ctl-skel--sub" style={{ width: `${45 - ((i * 7) % 20)}%` }} />
                    </span>
                    <span className="fl-ctl-skel fl-ctl-skel--pill" />
                  </li>
                ))}
              </ul>
            </div>
          ) : items.length === 0 ? (
            <p className="fl-note">{d.emptyText}</p>
          ) : (
            <ul className="fl-ctl-cards">
              {items.map((it) => (
                <li key={it.id} className="fl-ctl-card fl-ctl-fade-in">
                  <span className="fl-ctl-card__avatar" aria-hidden="true">
                    {it.initials}
                  </span>
                  <div className="fl-ctl-card__lines">
                    <p className="fl-ctl-card__title">{it.name}</p>
                    <p className="fl-ctl-card__meta">{it.what}</p>
                  </div>
                  <span className="fl-ctl-card__price">{it.price}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
