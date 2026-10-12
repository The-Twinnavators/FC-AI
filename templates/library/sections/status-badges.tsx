/** @flowcode-library status-badges · Status badges (signal chip) (Small components)
 * Catalog ID: c.badge@signal-chip (component version)
 * Version of: c.badge
 * Function: Status chips with a colored dot (done, in progress, waiting, failed, draft) and signal lights that pulse while working, on a list whose status moves on.
 * Use it as: import { Badge } from "./badges-status"; <Badge version="signal-chip" tone?="neutral"|"info"|"success"|"warning"|"danger" pulse?>In progress</Badge>
 * Look: A small square-cornered uppercase mono chip with a glowing signal light before the word; the light pulses while work is in progress.
 * Tokens: --color-success --color-accent --color-danger --color-text-muted --color-surface --color-border --font-mono --text-xs --tracking-wide --radius-sm --space-1 --space-2 --easing
 * Use cases: order status; task status; deployment status; job queue; ticket status; build progress; workflow tracker; delivery tracking
 * Jobs to be done: see where each item stands; spot what failed at a glance; know when something is still working; track progress over time
 * Keywords: status, badge, chip, signal light, indicator
 */
/**
 * Status badges: status chips with a colored dot (done, in progress, waiting, failed, draft) that glow, with a soft
 * pulse while something is working. Shown on a short list of jobs. This is c.badge@signal-chip with this piece's
 * sample content; the implementation lives in the component, in ./badges-status. Use it for orders, tasks, bookings or
 * anything with a lifecycle. Make it the app's own: replace SAMPLE with real items and statuses; keep the order of
 * the statuses as the lifecycle.
 */
import { Badge } from "./badges-status";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Studio orders",
  title: "Where every order stands",
  lede: "A dot and a word for each status, so you can scan the list in a second.",
  legendLabel: "Status key",
  statuses: [
    { id: "draft", label: "Draft", tone: "neutral" as const },
    { id: "waiting", label: "Waiting", tone: "warning" as const },
    { id: "progress", label: "In progress", tone: "info" as const },
    { id: "done", label: "Done", tone: "success" as const },
    { id: "failed", label: "Failed", tone: "danger" as const },
  ],
  items: [
    { id: "o1", title: "Framed print, 40 x 50", meta: "Order 1042 · Priya N.", status: "progress" },
    { id: "o2", title: "Portrait session, Saturday 10:00", meta: "Booking 318 · Tom R.", status: "waiting" },
    { id: "o3", title: "Gift voucher, two sessions", meta: "Order 1039 · Ana L.", status: "done" },
    { id: "o4", title: "Photo book, 24 pages", meta: "Order 1045 · Sam K.", status: "failed" },
    { id: "o5", title: "Family shoot quote", meta: "Draft · not sent yet", status: "draft" },
  ],
};

export default function StatusBadges() {
  const d = SAMPLE;
  const find = (id: string) => d.statuses.find((s) => s.id === id) ?? d.statuses[0];
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
              <Badge version="signal-chip" tone={s.tone} pulse={s.id === "progress"}>
                {s.label}
              </Badge>
            </li>
          ))}
        </ul>

        <ul className="fl-ctl-list">
          {d.items.map((it) => {
            const s = find(it.status);
            return (
              <li key={it.id} className="fl-ctl-row">
                <div className="fl-ctl-row__body">
                  <p className="fl-ctl-row__title">{it.title}</p>
                  <p className="fl-ctl-row__meta">{it.meta}</p>
                </div>
                <Badge version="signal-chip" tone={s.tone} pulse={s.id === "progress"}>
                  {s.label}
                </Badge>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
