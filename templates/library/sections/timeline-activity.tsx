/** @flowcode-library timeline-activity · Activity timeline (Charts and data)
 * Catalog ID: p.activity-timeline (pattern)
 * Function: The activity timeline pattern (p.activity-timeline): a filterable, day-grouped event feed with paging; the reference sheet shows studio bookings, payments, cancellations and messages.
 * Use it as: import { ActivityTimeline } from "./timeline-activity"; <ActivityTimeline title lede? kinds={{ booking: { label: "Bookings", icon: "clock", tone?: "accent"|"success"|"danger"|"muted" } }} events={[{ id, kind, who, what, at: Date, note?, quote? }]} now?={Date} hasMore? onLoadMore?={() => Promise<void>} labels?={{ all, showOlder, loadError, retry, end, empty }} />
 * Look: A card with kind filter buttons and a vertical feed grouped by day, a round icon per event kind joined by a thin line, relative times, and a Show older button with loading and retry states.
 * Tokens: --color-accent --color-success --color-danger --color-text-muted --color-border --color-surface-sunken --space-3 --space-4 --space-5 --space-6 --radius-md --text-xs --text-sm
 * Use cases: activity feed; audit log; order history; customer history; change log; recent activity; event log; notifications history
 * Jobs to be done: see what happened recently; trace the history of an order; filter events by type; look back at older activity
 * Keywords: timeline, activity, feed, history, log, events, load more
 */
/**
 * Activity timeline: a vertical feed of what happened, grouped by day, with an icon per kind of event and relative
 * times ("12 min ago"). Filter by kind; "Show older" loads earlier days. Use it on a dashboard, a customer record or
 * an order page. Make it the app's own: replace SAMPLE with your event kinds and feed, and swap the fake loader for
 * your own paging call.
 */
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  title: "Studio activity",
  lede: "Bookings, payments and messages across the studio.",
  kinds: {
    booking: { label: "Bookings", icon: "clock", tone: "" },
    payment: { label: "Payments", icon: "check", tone: "fl-dsp-tone-success" },
    cancel: { label: "Cancellations", icon: "cancel", tone: "fl-dsp-tone-danger" },
    message: { label: "Messages", icon: "mail", tone: "fl-dsp-tone-muted" },
  },
  // minutesAgo keeps the sample fresh: times are worked out from "now" when the page opens.
  pages: [
    [
      { id: "e1", kind: "booking", minutesAgo: 12, who: "Priya Nair", what: "booked Wheel throwing, Thursday 6pm", note: "2 places" },
      { id: "e2", kind: "payment", minutesAgo: 47, who: "Tom Okafor", what: "paid $96.00", note: "Life drawing, 4-week pass" },
      { id: "e3", kind: "message", minutesAgo: 130, who: "Ana Silva", what: "sent a message", quote: "Can I bring my own clay to the Saturday session?" },
      { id: "e4", kind: "cancel", minutesAgo: 1500, who: "Leo Brandt", what: "cancelled Printmaking, Friday 10am", note: "Refunded to card" },
      { id: "e5", kind: "booking", minutesAgo: 1620, who: "Mei Chen", what: "booked Open studio, Sunday", note: "1 place" },
    ],
    [
      { id: "e6", kind: "payment", minutesAgo: 2950, who: "Priya Nair", what: "paid $40.00", note: "Glaze and firing fee" },
      { id: "e7", kind: "message", minutesAgo: 3100, who: "Sam Reyes", what: "sent a message", quote: "Running ten minutes late, sorry!" },
      { id: "e8", kind: "booking", minutesAgo: 4400, who: "Jonas Weber", what: "booked Wheel throwing, Tuesday 7pm", note: "1 place" },
    ],
    [
      { id: "e9", kind: "cancel", minutesAgo: 5900, who: "Ana Silva", what: "cancelled Open studio, Monday", note: "Moved to a credit" },
      { id: "e10", kind: "payment", minutesAgo: 6100, who: "Mei Chen", what: "paid $120.00", note: "Gift card" },
    ],
  ],
  showOlder: "Show older",
  loadError: "Couldn't load older activity.",
  retry: "Try again",
  end: "That's everything from the last week.",
  empty: "Nothing of this kind yet.",
};

type SampleEvent = { id: string; kind: string; minutesAgo: number; who: string; what: string; note?: string; quote?: string };

export type TimelineTone = "accent" | "success" | "danger" | "muted";
export type TimelineKind = { label: string; icon: string; tone?: TimelineTone };
export type TimelineEvent = { id: string; kind: string; who: string; what: string; at: Date; note?: string; quote?: string };

const TONE: Record<TimelineTone, string> = { accent: "", success: "fl-dsp-tone-success", danger: "fl-dsp-tone-danger", muted: "fl-dsp-tone-muted" };

function KindIcon({ name }: { name: string }) {
  if (name === "cancel")
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    );
  return <Icon name={name} />;
}

function relative(mins: number) {
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.floor(h / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

function dayLabel(date: Date, now: Date) {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((start(now) - start(date)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
}

/**
 * p.activity-timeline: a vertical feed of what happened, newest first, grouped by day, with an icon per kind of event
 * and relative times ("12 min ago"). `kinds` names each kind (label, icon, tone) and drives the filter buttons.
 * "Show older" calls `onLoadMore` (return a promise; if it rejects the error and a retry button show). Set
 * `hasMore` to false when there is nothing older. `now` is the clock the relative times count from.
 */
export function ActivityTimeline({ events, kinds, title, titleId: titleIdProp, lede, now: nowProp, hasMore = false, onLoadMore, labels, className }: {
  events: TimelineEvent[];
  kinds: Record<string, TimelineKind>;
  title: string;
  titleId?: string;
  lede?: string;
  now?: Date;
  hasMore?: boolean;
  onLoadMore?: () => void | Promise<void>;
  labels?: { all?: string; showOlder?: string; loadError?: string; retry?: string; end?: string; empty?: string };
  className?: string;
}) {
  const t = { all: "All", showOlder: "Show older", loadError: "Couldn't load older activity.", retry: "Try again", end: "That's everything.", empty: "Nothing of this kind yet.", ...labels };
  const fallbackId = useId();
  const titleId = titleIdProp ?? fallbackId;
  const [fallbackNow] = useState(() => new Date());
  const now = nowProp ?? fallbackNow;
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [filter, setFilter] = useState<string>("all");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => void (alive.current = false);
  }, []);

  const shown = events.filter((e) => filter === "all" || e.kind === filter);
  const groups: { label: string; items: TimelineEvent[] }[] = [];
  for (const e of shown) {
    const label = dayLabel(e.at, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(e);
    else groups.push({ label, items: [e] });
  }

  async function loadOlder() {
    setStatus("loading");
    try {
      await onLoadMore?.();
      if (alive.current) setStatus("idle");
    } catch {
      if (alive.current) setStatus("error");
    }
  }

  return (
    <div className={["fl-card fl-dsp-tl-card", className].filter(Boolean).join(" ")} data-fl="p.activity-timeline">
      <div className="fl-head" style={{ marginBottom: 0 }}>
        <h2 id={titleId} className="fl-title fl-title--md">
          {title}
        </h2>
        {lede ? <p className="fl-text">{lede}</p> : null}
      </div>
      <div className="fl-dsp-tl-filters" role="group" aria-label="Show activity of kind">
        <button type="button" className="fl-dsp-btn" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
          {t.all}
        </button>
        {Object.keys(kinds).map((k) => (
          <button key={k} type="button" className="fl-dsp-btn" aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {kinds[k].label}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <p className="fl-dsp-empty">{t.empty}</p>
      ) : (
        <div className="fl-dsp-tl-days">
          {groups.map((g) => (
            <div key={g.label}>
              <h3 className="fl-dsp-tl-day">{g.label}</h3>
              <ol className="fl-dsp-tl">
                {g.items.map((e) => {
                  const k = kinds[e.kind] ?? { label: e.kind, icon: "clock" };
                  const mins = Math.max(0, Math.round((now.getTime() - e.at.getTime()) / 60000));
                  return (
                    <li key={e.id} className="fl-dsp-tl__item">
                      <span className={`fl-dsp-tl__dot ${TONE[k.tone ?? "accent"]}`}>
                        <KindIcon name={k.icon} />
                      </span>
                      <div className="fl-dsp-tl__body">
                        <p className="fl-dsp-tl__line">
                          <span>
                            <span className="fl-sr">{k.label.replace(/s$/, "")}: </span>
                            <strong>{e.who}</strong> {e.what}
                          </span>
                          <time dateTime={e.at.toISOString()} title={e.at.toLocaleString()}>
                            {relative(mins)}
                          </time>
                        </p>
                        {e.note && <p className="fl-dsp-tl__note">{e.note}</p>}
                        {e.quote && <blockquote className="fl-dsp-tl__quote">{e.quote}</blockquote>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}

      <div className="fl-dsp-tl-more">
        <p className="fl-sr" aria-live="polite">
          {status === "loading" ? "Loading older activity" : status === "error" ? t.loadError : ""}
        </p>
        {status === "error" ? (
          <>
            <p className="fl-dsp-err">{t.loadError}</p>
            <button type="button" className="fl-dsp-btn" onClick={loadOlder}>
              {t.retry}
            </button>
          </>
        ) : hasMore ? (
          <button type="button" className="fl-dsp-btn" onClick={loadOlder} disabled={status === "loading"} aria-busy={status === "loading"}>
            {status === "loading" && <span className="fl-dsp-spin" aria-hidden="true" />}
            {status === "loading" ? "Loading…" : t.showOlder}
          </button>
        ) : (
          <p className="fl-dsp-status">{t.end}</p>
        )}
      </div>
    </div>
  );
}

const TONE_OF: Record<string, TimelineTone> = { "": "accent", "fl-dsp-tone-success": "success", "fl-dsp-tone-danger": "danger", "fl-dsp-tone-muted": "muted" };

export default function TimelineActivity() {
  const d = SAMPLE;
  const [now] = useState(() => new Date());
  const [loaded, setLoaded] = useState(1);
  const [failedOnce, setFailedOnce] = useState(false);

  const kinds = Object.fromEntries(Object.entries(d.kinds).map(([k, v]) => [k, { label: v.label, icon: v.icon, tone: TONE_OF[v.tone] }]));
  const events: TimelineEvent[] = d.pages.slice(0, loaded).flat().map(({ minutesAgo, ...e }: SampleEvent) => ({ ...e, at: new Date(now.getTime() - minutesAgo * 60000) }));

  // A short pause stands in for a fetch. The sample fails once on the last page so the error state can be seen; your
  // loader decides for real by throwing.
  const loadOlder = () =>
    new Promise<void>((resolve, reject) => {
      window.setTimeout(() => {
        if (loaded === d.pages.length - 1 && !failedOnce) {
          setFailedOnce(true);
          reject(new Error(d.loadError));
          return;
        }
        setLoaded((n) => n + 1);
        resolve();
      }, 900);
    });

  return (
    <section className="fl-section" aria-labelledby="timeline-activity-title">
      <div className="fl-wrap fl-wrap--narrow">
        <ActivityTimeline
          titleId="timeline-activity-title"
          title={d.title}
          lede={d.lede}
          kinds={kinds}
          events={events}
          now={now}
          hasMore={loaded < d.pages.length}
          onLoadMore={loadOlder}
          labels={{ showOlder: d.showOlder, loadError: d.loadError, retry: d.retry, end: d.end, empty: d.empty }}
        />
      </div>
    </section>
  );
}
