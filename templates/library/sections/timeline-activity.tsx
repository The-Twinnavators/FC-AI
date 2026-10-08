/**
 * Activity timeline: a vertical feed of what happened, grouped by day, with an icon per kind of event and relative
 * times ("12 min ago"). Filter by kind; "Show older" loads earlier days. Use it on a dashboard, a customer record or
 * an order page. Make it the app's own: replace SAMPLE with your event kinds and feed, and swap the fake loader for
 * your own paging call.
 */
import { useEffect, useRef, useState } from "react";
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

type Kind = keyof typeof SAMPLE.kinds;
type Event = { id: string; kind: string; minutesAgo: number; who: string; what: string; note?: string; quote?: string };

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

export default function TimelineActivity() {
  const d = SAMPLE;
  const [now] = useState(() => new Date());
  const [loaded, setLoaded] = useState(1);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [failedOnce, setFailedOnce] = useState(false);
  const [filter, setFilter] = useState<Kind | "all">("all");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const events = (d.pages.slice(0, loaded).flat() as Event[]).filter((e) => filter === "all" || e.kind === filter);
  const groups: { label: string; items: Event[] }[] = [];
  for (const e of events) {
    const label = dayLabel(new Date(now.getTime() - e.minutesAgo * 60000), now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(e);
    else groups.push({ label, items: [e] });
  }
  const more = loaded < d.pages.length;

  function loadOlder() {
    setStatus("loading");
    timer.current = window.setTimeout(() => {
      // The sample fails once on the last page so the error state can be seen; your loader decides for real.
      if (loaded === d.pages.length - 1 && !failedOnce) {
        setFailedOnce(true);
        setStatus("error");
        return;
      }
      setLoaded((n) => n + 1);
      setStatus("idle");
    }, 900);
  }

  return (
    <section className="fl-section" aria-labelledby="timeline-activity-title">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-card fl-dsp-tl-card">
          <div className="fl-head" style={{ marginBottom: 0 }}>
            <h2 id="timeline-activity-title" className="fl-title fl-title--md">
              {d.title}
            </h2>
            <p className="fl-text">{d.lede}</p>
          </div>
          <div className="fl-dsp-tl-filters" role="group" aria-label="Show activity of kind">
            <button type="button" className="fl-dsp-btn" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
              All
            </button>
            {(Object.keys(d.kinds) as Kind[]).map((k) => (
              <button key={k} type="button" className="fl-dsp-btn" aria-pressed={filter === k} onClick={() => setFilter(k)}>
                {d.kinds[k].label}
              </button>
            ))}
          </div>

          {groups.length === 0 ? (
            <p className="fl-dsp-empty">{d.empty}</p>
          ) : (
            <div className="fl-dsp-tl-days">
              {groups.map((g) => (
                <div key={g.label}>
                  <h3 className="fl-dsp-tl-day">{g.label}</h3>
                  <ol className="fl-dsp-tl">
                    {g.items.map((e) => {
                      const k = d.kinds[e.kind as Kind];
                      const at = new Date(now.getTime() - e.minutesAgo * 60000);
                      return (
                        <li key={e.id} className="fl-dsp-tl__item">
                          <span className={`fl-dsp-tl__dot ${k.tone}`}>
                            <KindIcon name={k.icon} />
                          </span>
                          <div className="fl-dsp-tl__body">
                            <p className="fl-dsp-tl__line">
                              <span>
                                <span className="fl-sr">{k.label.replace(/s$/, "")}: </span>
                                <strong>{e.who}</strong> {e.what}
                              </span>
                              <time dateTime={at.toISOString()} title={at.toLocaleString()}>
                                {relative(e.minutesAgo)}
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
              {status === "loading" ? "Loading older activity" : status === "error" ? d.loadError : ""}
            </p>
            {status === "error" ? (
              <>
                <p className="fl-dsp-err">{d.loadError}</p>
                <button type="button" className="fl-dsp-btn" onClick={loadOlder}>
                  {d.retry}
                </button>
              </>
            ) : more ? (
              <button type="button" className="fl-dsp-btn" onClick={loadOlder} disabled={status === "loading"} aria-busy={status === "loading"}>
                {status === "loading" && <span className="fl-dsp-spin" aria-hidden="true" />}
                {status === "loading" ? "Loading…" : d.showOlder}
              </button>
            ) : (
              <p className="fl-dsp-status">{d.end}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
