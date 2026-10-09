/** @flowcode-library announcement-bar · Announcements (Alerts and states)
 * Use cases: announcement banner; promo bar; product update; launch news; sale announcement; site notice; whats new
 * Jobs to be done: hear about what is new; learn about a current offer; dismiss news i have seen
 * Keywords: announcement, banner, pill, notice, dismiss, news
 */
/**
 * Announcements: three ways to tell people about something new. A slim top bar with a link and a close button (stays
 * closed on this device), a small pill above a page heading, and a notice that floats at the bottom of the screen
 * with one action. Use one at a time for news, a launch or a change. Make it the app's own: replace SAMPLE, and change
 * `storageKey` whenever the top bar's message changes so everyone sees the new one.
 */
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  storageKey: "announce-gift-cards-v1",
  bar: { text: "Gift cards are here: give a class for any occasion.", link: { label: "Buy a gift card", href: "#gift-cards" } },
  pill: { tag: "New", text: "Saturday family sessions", href: "#family" },
  heading: "Make something with your hands this weekend",
  text: "Small classes, all materials included, and a kiln that fires every Friday.",
  primary: { label: "Book a class", href: "#book" },
  restore: "Show the top bar again",
  float: {
    open: "Preview the bottom notice",
    text: "The studio is closed on 25–26 December. Bookings reopen on the 27th.",
    action: "See holiday hours",
    actionHref: "#hours",
    closed: "Notice closed.",
  },
};

function readClosed(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function writeClosed(key: string, closed: boolean) {
  try {
    if (closed) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    /* storage blocked: it just won't be remembered */
  }
}

const Close = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export default function AnnouncementBar() {
  const d = SAMPLE;
  const [barClosed, setBarClosed] = useState(() => readClosed(d.storageKey));
  const [floatOpen, setFloatOpen] = useState(false);
  const [status, setStatus] = useState("");
  const floatTrigger = useRef<HTMLButtonElement>(null);
  const restoreBtn = useRef<HTMLButtonElement>(null);
  const floatClose = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (floatOpen) floatClose.current?.focus();
  }, [floatOpen]);

  function closeBar() {
    setBarClosed(true);
    writeClosed(d.storageKey, true);
    setStatus("Announcement closed.");
    window.setTimeout(() => restoreBtn.current?.focus(), 0);
  }
  function openBar() {
    setBarClosed(false);
    writeClosed(d.storageKey, false);
    setStatus("");
  }
  function closeFloat() {
    setFloatOpen(false);
    setStatus(d.float.closed);
    floatTrigger.current?.focus();
  }

  return (
    <section className="fl-section" aria-label="Announcements">
      <div className="fl-wrap fl-dsp-ann-demo">
        <div className="fl-dsp-ann-frame">
          {!barClosed && (
            <div className="fl-dsp-ann" role="region" aria-label="Announcement">
              <div className="fl-dsp-ann__row">
                <p className="fl-dsp-ann__msg">
                  {d.bar.text}
                  <a href={d.bar.link.href}>{d.bar.link.label} →</a>
                </p>
                <button type="button" className="fl-dsp-x" onClick={closeBar} aria-label="Close announcement">
                  <Close />
                </button>
              </div>
            </div>
          )}
          <div className="fl-dsp-ann-frame__body">
            <a className="fl-dsp-pill" href={d.pill.href}>
              <b>{d.pill.tag}</b>
              {d.pill.text}
              <Icon name="arrow" />
            </a>
            <h2 className="fl-title">{d.heading}</h2>
            <p className="fl-lede">{d.text}</p>
            <div className="fl-actions">
              <a className="fl-btn fl-btn--primary" href={d.primary.href}>
                {d.primary.label}
              </a>
              <button ref={floatTrigger} type="button" className="fl-btn fl-btn--secondary" onClick={() => setFloatOpen(true)} disabled={floatOpen}>
                {d.float.open}
              </button>
            </div>
            {barClosed && (
              <button ref={restoreBtn} type="button" className="fl-dsp-btn fl-dsp-btn--ghost" onClick={openBar}>
                {d.restore}
              </button>
            )}
          </div>
        </div>
        <p className="fl-sr" aria-live="polite">
          {status}
        </p>
      </div>

      {floatOpen && (
        <div
          className="fl-dsp-float"
          role="region"
          aria-label="Notice"
          onKeyDown={(e) => {
            if (e.key === "Escape") closeFloat();
          }}
        >
          <span className="fl-icon" aria-hidden="true">
            <Icon name="clock" />
          </span>
          <p>{d.float.text}</p>
          <div className="fl-dsp-float__acts">
            <a className="fl-dsp-btn fl-dsp-btn--primary" href={d.float.actionHref}>
              {d.float.action}
            </a>
            <button ref={floatClose} type="button" className="fl-dsp-x" onClick={closeFloat} aria-label="Close notice">
              <Close />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
