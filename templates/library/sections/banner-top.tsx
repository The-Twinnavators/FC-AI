/**
 * Top banner: a full-width announcement across the top of a page, with one link and a dismiss button. Once someone
 * closes it, it stays closed on that device (remembered in local storage). Use it for one short, time-limited notice.
 * Make it the app's own: replace SAMPLE; change `storageKey` whenever the message changes so everyone sees the new one.
 */
import { useEffect, useRef, useState } from "react";

// flowcode:sample
const SAMPLE = {
  storageKey: "banner-autumn-term-dismissed",
  tag: "New",
  message: "Autumn term bookings are open: weekly pottery, life drawing and printmaking.",
  link: { label: "See the timetable", href: "#timetable" },
  page: {
    title: "Welcome back to the studio",
    text: "This is the page under the banner. Close the banner and reload: it stays closed on this device.",
    reset: "Show the banner again",
  },
};

function readDismissed(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export default function BannerTop() {
  const d = SAMPLE;
  const [dismissed, setDismissed] = useState(() => readDismissed(d.storageKey));
  const [status, setStatus] = useState("");
  const resetRef = useRef<HTMLButtonElement>(null);
  const movedFocus = useRef(false);

  useEffect(() => {
    if (dismissed && movedFocus.current) {
      resetRef.current?.focus();
      movedFocus.current = false;
    }
  }, [dismissed]);

  const close = () => {
    try {
      localStorage.setItem(d.storageKey, "1");
    } catch {
      /* storage unavailable: it closes for this visit only */
    }
    movedFocus.current = true;
    setDismissed(true);
    setStatus("Announcement dismissed.");
  };
  const reopen = () => {
    try {
      localStorage.removeItem(d.storageKey);
    } catch {
      /* nothing to clear */
    }
    setDismissed(false);
    setStatus("Announcement shown again.");
  };

  return (
    <div>
      {!dismissed && (
        <section className="fl-alr-banner" aria-label="Announcement">
          <div className="fl-alr-banner__row">
            <p className="fl-alr-banner__msg">
              <span className="fl-alr-banner__tag">{d.tag}</span>
              <span>{d.message}</span>
              <a href={d.link.href}>{d.link.label} →</a>
            </p>
            <button type="button" className="fl-alr__close" aria-label="Dismiss announcement" onClick={close}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </section>
      )}
      <div className="fl-alr-page">
        <div className="fl-wrap fl-wrap--narrow fl-head" style={{ marginBottom: 0 }}>
          <h2 className="fl-title fl-title--md">{d.page.title}</h2>
          <p className="fl-text">{d.page.text}</p>
          <div className="fl-actions">
            {dismissed && (
              <button ref={resetRef} type="button" className="fl-btn fl-btn--secondary" onClick={reopen}>
                {d.page.reset}
              </button>
            )}
            <span className="fl-meta" role="status" aria-live="polite">
              {status}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
