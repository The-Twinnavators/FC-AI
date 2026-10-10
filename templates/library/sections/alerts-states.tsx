/** @flowcode-library alerts-states · Alerts: four tones, inline, banner and toast (Alerts and states)
 * Use cases: form saved; something failed; a warning before an action; a tip; a site-wide notice
 * Jobs to be done: know something happened; understand what went wrong; get told without losing my place
 * Keywords: alert, toast, banner, notice, success, warning, error, info, dismiss
 */
/**
 * The same four tones in the three places a message can appear. Where it appears decides how it behaves: an inline
 * alert sits in the flow and stays; a banner spans the page and is dismissed; a toast arrives, says one thing and goes.
 *
 * The tone is never carried by color alone - each has its own icon and its own word - because a red box is invisible
 * to a good share of people. An error alert uses role="alert" so it is announced at once; everything quieter uses
 * role="status", which waits for a gap.
 *
 * Make it the app's own: replace the words. Keep the icon with the color, and keep errors out of toasts: a message
 * that disappears is no place for something the person has to act on.
 */
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  tones: [
    { id: "info", label: "Information", icon: "info", title: "Your plan renews on 1 July", body: "Nothing to do. We will email the invoice when it is ready." },
    { id: "success", label: "Success", icon: "check", title: "Shoot saved", body: "Riverside wedding is in your calendar for 12 June." },
    { id: "warning", label: "Warning", icon: "alert", title: "This shoot is in three days", body: "Changing the date now will email the client straight away." },
    { id: "danger", label: "Error", icon: "close", title: "We could not save that", body: "The deposit has to be a number. Nothing else was lost." },
  ],
};

export default function AlertsStates() {
  const d = SAMPLE;
  const [banner, setBanner] = useState("warning");
  const [toasts, setToasts] = useState<{ id: number; tone: string; title: string }[]>([]);
  const seq = useRef(0);

  // A toast says its piece and leaves; anything that needs acting on belongs inline.
  useEffect(() => {
    if (!toasts.length) return;
    const t = window.setTimeout(() => setToasts((v) => v.slice(1)), 3200);
    return () => window.clearTimeout(t);
  }, [toasts]);

  const toast = (tone: string, title: string) => {
    seq.current += 1;
    setToasts((v) => [...v, { id: seq.current, tone, title }].slice(-3));
  };

  const bannerTone = d.tones.find((t) => t.id === banner);

  return (
    <section className="fl-section fl-section--specimen">
      <h3>Inline</h3>
      <p className="fl-ctl-btn-what">In the flow, next to what it is about. It stays until the thing it describes changes.</p>
      <ul className="fl-ctl-alert-list">
        {d.tones.map((t) => (
          <li key={t.id}>
            <div className={`fl-ctl-alert fl-ctl-alert--${t.id}`} role={t.id === "danger" ? "alert" : "status"}>
              <span className="fl-ctl-alert-icon" aria-hidden="true">
                <Icon name={t.icon} />
              </span>
              <span className="fl-ctl-alert-text">
                <strong>{t.title}</strong>
                <span className="fl-ctl-matrix-what">{t.body}</span>
              </span>
              {t.id === "danger" ? (
                <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--32">
                  Fix it
                </button>
              ) : null}
            </div>
            <p className="fl-ctl-matrix-what">
              {t.label} &middot; {t.id === "danger" ? 'role="alert", announced at once' : 'role="status", announced in a gap'}
            </p>
          </li>
        ))}
      </ul>

      <div className="fl-ctl-sizes">
        <h3>Banner</h3>
        <p className="fl-ctl-btn-what">Across the top of the page, about the whole app rather than one field. It can be dismissed; it should not come back on the next page.</p>
        <div className="fl-ctl-alert-pick">
          {d.tones.map((t) => (
            <button key={t.id} type="button" className={`fl-btn fl-ctl-btn--tertiary fl-ctl-btn--32${banner === t.id ? " is-on" : ""}`} aria-pressed={banner === t.id} onClick={() => setBanner(t.id)}>
              {t.label}
            </button>
          ))}
          <button type="button" className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--32" aria-pressed={banner === ""} onClick={() => setBanner("")}>
            None
          </button>
        </div>
        {bannerTone ? (
          <div className={`fl-ctl-banner fl-ctl-alert--${bannerTone.id}`} role="status">
            <span className="fl-ctl-alert-icon" aria-hidden="true">
              <Icon name={bannerTone.icon} />
            </span>
            <span>
              <strong>{bannerTone.title}</strong> {bannerTone.body}
            </span>
            <button type="button" className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--icon fl-ctl-btn--32" aria-label="Dismiss this notice" onClick={() => setBanner("")}>
              <Icon name="close" />
            </button>
          </div>
        ) : (
          <p className="fl-ctl-matrix-what">Dismissed. Pick a tone to bring it back.</p>
        )}
      </div>

      <div className="fl-ctl-sizes">
        <h3>Toast</h3>
        <p className="fl-ctl-btn-what">
          Arrives in a corner, says one thing and goes after a few seconds. Only for things that need no reply: three at
          most, oldest first, and never an error.
        </p>
        <div className="fl-ctl-alert-pick">
          <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--32" onClick={() => toast("success", "Shoot saved")}>
            Save something
          </button>
          <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--32" onClick={() => toast("info", "Copied to the clipboard")}>
            Copy something
          </button>
          <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--32" onClick={() => toast("warning", "Working offline")}>
            Lose the connection
          </button>
        </div>
        <div className="fl-ctl-toast-stage">
          <ul className="fl-ctl-toasts" role="status" aria-live="polite" aria-label="Notifications">
            {toasts.map((t) => (
              <li key={t.id} className={`fl-ctl-toast fl-ctl-alert--${t.tone}`}>
                <span className="fl-ctl-alert-icon" aria-hidden="true">
                  <Icon name={t.tone === "success" ? "check" : t.tone === "warning" ? "alert" : "info"} />
                </span>
                {t.title}
                <button type="button" className="fl-ctl-toast-x" aria-label={`Dismiss: ${t.title}`} onClick={() => setToasts((v) => v.filter((x) => x.id !== t.id))}>
                  <Icon name="close" />
                </button>
              </li>
            ))}
          </ul>
          {toasts.length ? null : <p className="fl-ctl-matrix-what">Nothing showing. Press one of the buttons above.</p>}
        </div>
      </div>
    </section>
  );
}
