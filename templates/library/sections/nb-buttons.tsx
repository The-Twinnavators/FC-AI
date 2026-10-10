/** @flowcode-library nb-buttons · Neobrutal buttons (Neobrutalism kit)
 * Use cases: button styles; playful ui; bold design system; action buttons; loading buttons; icon buttons; ui kit
 * Jobs to be done: take an action with one click; see that my action is working; toggle an option on or off
 * Keywords: buttons, neobrutalism, loading, icon button, toggle, bold
 */
/**
 * Neobrutalist buttons: primary, secondary, danger, icon-only, disabled and loading, with thick ink borders and a hard
 * shadow that lifts on hover and presses flat on click. Use it as the button set for a bold, playful app. Make it the
 * app's own: replace SAMPLE with the app's real actions and wire each onClick to the real handler.
 */
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Buttons",
  title: "Press it like you mean it",
  lede: "Every button sits on a hard shadow. Hover lifts it, a click pushes it flat.",
  primary: "Book a session",
  secondary: "See the timetable",
  danger: "Cancel booking",
  dangerConfirm: "Tap again to cancel",
  favourite: "Save to favorites",
  unfavourite: "Remove from favorites",
  share: "Share this class",
  disabled: "Fully booked",
  disabledNote: "No spots left this week.",
  loadingIdle: "Pay deposit",
  loadingBusy: "Paying…",
  loadingDone: "Deposit paid",
  messages: {
    primary: "Session picked: Thursday, 6pm pottery.",
    secondary: "Opening the timetable…",
    cancelled: "Booking cancelled. Your spot is free for others.",
    saved: "Saved to favorites.",
    unsaved: "Removed from favorites.",
    shared: "Link copied to share.",
    paid: "Deposit of $15 paid. See you Thursday.",
  },
};

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  );
}

export default function NbButtons() {
  const d = SAMPLE;
  const [status, setStatus] = useState("");
  const [armed, setArmed] = useState(false);
  const [fav, setFav] = useState(false);
  const [pay, setPay] = useState<"idle" | "busy" | "done">("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function onDanger() {
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    setStatus(d.messages.cancelled);
  }

  function onPay() {
    if (pay !== "idle") return;
    setPay("busy");
    setStatus("");
    timer.current = window.setTimeout(() => {
      setPay("done");
      setStatus(d.messages.paid);
    }, 1600);
  }

  return (
    <section className="fl-section fl-nb" aria-labelledby="nb-buttons-title">
      <div className="fl-wrap fl-wrap--narrow fl-nb-stack">
        <div className="fl-head">
          <p className="fl-nb-kicker">{d.eyebrow}</p>
          <h2 id="nb-buttons-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>

        <div className="fl-nb-box" style={{ padding: "var(--space-6)", display: "grid", gap: "var(--space-6)" }}>
          <div className="fl-nb-group">
            <h3 className="fl-nb-group__label">Main actions</h3>
            <div className="fl-nb-row">
              <button type="button" className="fl-nb-btn fl-nb-btn--primary" onClick={() => setStatus(d.messages.primary)}>
                {d.primary}
                <Icon name="arrow" />
              </button>
              <button type="button" className="fl-nb-btn fl-nb-btn--secondary" onClick={() => setStatus(d.messages.secondary)}>
                <Icon name="clock" />
                {d.secondary}
              </button>
            </div>
          </div>

          <div className="fl-nb-group">
            <h3 className="fl-nb-group__label">Danger and icons</h3>
            <div className="fl-nb-row">
              <button
                type="button"
                className="fl-nb-btn fl-nb-btn--danger"
                onClick={onDanger}
                onBlur={() => setArmed(false)}
              >
                <TrashIcon />
                {armed ? d.dangerConfirm : d.danger}
              </button>
              <button
                type="button"
                className={`fl-nb-btn fl-nb-btn--icon ${fav ? "fl-nb-btn--primary" : "fl-nb-btn--plain"}`}
                aria-pressed={fav}
                aria-label={d.favourite}
                title={fav ? d.unfavourite : d.favourite}
                onClick={() => {
                  setFav(!fav);
                  setStatus(fav ? d.messages.unsaved : d.messages.saved);
                }}
              >
                <Icon name="heart" />
              </button>
              <button
                type="button"
                className="fl-nb-btn fl-nb-btn--icon fl-nb-btn--secondary"
                aria-label={d.share}
                title={d.share}
                onClick={() => setStatus(d.messages.shared)}
              >
                <ShareIcon />
              </button>
            </div>
          </div>

          <div className="fl-nb-group">
            <h3 className="fl-nb-group__label">Disabled and loading</h3>
            <div className="fl-nb-row">
              <button type="button" className="fl-nb-btn" disabled aria-describedby="nb-buttons-disabled-note">
                {d.disabled}
              </button>
              <button
                type="button"
                className={`fl-nb-btn ${pay === "done" ? "fl-nb-btn--secondary" : "fl-nb-btn--primary"}`}
                aria-busy={pay === "busy"}
                aria-disabled={pay !== "idle"}
                onClick={onPay}
              >
                {pay === "busy" && <span className="fl-nb-spin" aria-hidden="true" />}
                {pay === "done" && <Icon name="check" />}
                {pay === "idle" ? d.loadingIdle : pay === "busy" ? d.loadingBusy : d.loadingDone}
              </button>
              {pay === "done" && (
                <button type="button" className="fl-nb-btn fl-nb-btn--sm fl-nb-btn--plain" onClick={() => { setPay("idle"); setStatus(""); }}>
                  Reset
                </button>
              )}
            </div>
            <p id="nb-buttons-disabled-note" className="fl-meta" style={{ margin: 0 }}>
              {d.disabledNote}
            </p>
          </div>

          <p className="fl-nb-status" role="status" aria-live="polite">
            {status}
          </p>
        </div>
      </div>
    </section>
  );
}
