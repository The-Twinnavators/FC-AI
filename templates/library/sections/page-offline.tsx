/** @flowcode-library page-offline · Offline (Alerts and states)
 * Use cases: offline mode; no connection; offline screen; connection lost; offline-first app; sync pending; network error
 * Jobs to be done: keep working without internet; know my changes are saved; reconnect when the network returns; see what still works offline
 * Keywords: offline, connection, retry, error, page
 */
/**
 * Offline: shown when the device loses its connection. Says so plainly, lists what still works and what has to wait,
 * shows changes saved on this device until the connection returns, and offers a retry that really checks the
 * browser's connection (and notices on its own when it comes back). Use it as the app's offline screen or banner
 * page. Make it the app's own: replace SAMPLE with what the app can genuinely do offline and its own waiting changes.
 */
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  title: "You're offline",
  text: "Check your Wi-Fi or mobile data. You can keep using the parts of the app below; we'll catch up when you're back.",
  works: ["See this week's timetable", "Open your saved class tickets", "Read studio guides you've opened before"],
  waits: ["Booking or cancelling a class", "Paying or buying a gift card", "Messaging the studio"],
  queued: [
    { label: "Note for Thursday's wheel class", when: "Saved 4 min ago" },
    { label: "Kiln shelf request", when: "Saved 12 min ago" },
  ],
  homeHref: "#home",
};

function WifiOff() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M19 13a10 10 0 0 0-2.3-1.6M2 9.5a15 15 0 0 1 4.2-2.7M22 9.5A15 15 0 0 0 10.5 5.6M12 20h.01" />
    </svg>
  );
}

function Wifi() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 9.5a15 15 0 0 1 20 0M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0M12 20h.01" />
    </svg>
  );
}

function Pause() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM10 9v6M14 9v6" />
    </svg>
  );
}

export default function PageOffline() {
  const d = SAMPLE;
  const id = useId();
  const [state, setState] = useState<"offline" | "checking" | "still" | "online">("offline");
  const [checks, setChecks] = useState(0);
  const [queue, setQueue] = useState(d.queued);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const back = () => setState((s) => (s === "online" ? s : "online"));
    const lost = () => setState("offline");
    window.addEventListener("online", back);
    window.addEventListener("offline", lost);
    return () => {
      window.removeEventListener("online", back);
      window.removeEventListener("offline", lost);
    };
  }, []);

  useEffect(() => {
    if (state === "online") {
      const t = window.setTimeout(() => setQueue([]), 1200);
      return () => window.clearTimeout(t);
    }
  }, [state]);

  const retry = () => {
    setChecks((n) => n + 1);
    setState("checking");
    window.setTimeout(() => {
      setState(navigator.onLine ? "online" : "still");
      headingRef.current?.focus();
    }, 1200);
  };

  const online = state === "online";
  const checking = state === "checking";

  return (
    <section className="fl-section" aria-labelledby={`${id}-title`}>
      <div className="fl-wrap fl-wrap--narrow fl-err">
        <span className="fl-err-cloud" data-online={online}>
          {online ? <Wifi /> : <WifiOff />}
        </span>

        <div className="fl-head fl-head--center" style={{ marginBottom: 0 }}>
          <span className={`fl-err-badge ${online ? "fl-err-badge--info" : "fl-err-badge--muted"}`}>
            <span className={`fl-err-dot${checking ? " fl-err-dot--pulse" : ""}`} aria-hidden="true" />
            {online ? "Connected" : checking ? "Checking connection" : "No connection"}
          </span>
          <h1 id={`${id}-title`} className="fl-title" ref={headingRef} tabIndex={-1} style={{ outline: "none" }}>
            {online ? "You're back online" : d.title}
          </h1>
          <p className="fl-lede">{online ? "Everything works again. Anything you saved while offline is being sent now." : d.text}</p>
        </div>

        <div className="fl-actions" style={{ justifyContent: "center" }}>
          {online ? (
            <>
              <a className="fl-btn fl-btn--primary" href={d.homeHref}>
                Carry on
                <Icon name="arrow" />
              </a>
              <button type="button" className="fl-btn fl-btn--secondary" onClick={() => { setState("offline"); setQueue(d.queued); }}>
                Show the offline page again
              </button>
            </>
          ) : (
            <button type="button" className="fl-btn fl-btn--primary" onClick={retry} disabled={checking} aria-busy={checking}>
              {checking && <span className="fl-err-spin" aria-hidden="true" />}
              {checking ? "Checking…" : "Try again"}
            </button>
          )}
        </div>

        <div aria-live="polite" style={{ width: "100%", maxWidth: "28rem" }}>
          {state === "still" && (
            <p className="fl-err-status fl-err-status--bad">
              Still no connection{checks > 1 ? ` after ${checks} tries` : ""}. Try moving closer to your router or switching
              to mobile data. We'll also notice by ourselves when it's back.
            </p>
          )}
          {online && (
            <p className="fl-err-status fl-err-status--good">
              {queue.length > 0 ? `Sending ${queue.length} saved ${queue.length === 1 ? "change" : "changes"}…` : "All saved changes sent."}
            </p>
          )}
        </div>

        {!online && (
          <div className="fl-err-works">
            <div className="fl-card">
              <h2>Still works</h2>
              <ul className="fl-err-works__ok">
                {d.works.map((w) => (
                  <li key={w}>
                    <Icon name="check" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="fl-card">
              <h2>Waits for a connection</h2>
              <ul className="fl-err-works__no">
                {d.waits.map((w) => (
                  <li key={w}>
                    <Pause />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="fl-card fl-err-queue" style={{ maxWidth: "28rem" }}>
          <h2 className="fl-meta" style={{ margin: 0, fontWeight: "var(--weight-semibold)" }}>
            Saved on this device
          </h2>
          {queue.length === 0 ? (
            <p className="fl-text" style={{ fontSize: "var(--text-sm)" }}>
              Nothing waiting to send.
            </p>
          ) : (
            <ul style={{ display: "grid", gap: "var(--space-2)", margin: 0, padding: 0, listStyle: "none" }}>
              {queue.map((q) => (
                <li key={q.label}>
                  <span>{q.label}</span>
                  <span className="fl-meta">{q.when}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
