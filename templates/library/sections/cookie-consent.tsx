/** @flowcode-library cookie-consent · Cookie consent (Alerts and states)
 * Use cases: cookie banner; privacy consent; gdpr consent; cookie preferences; tracking consent; privacy settings
 * Jobs to be done: decide which cookies to allow; reject non-essential tracking; change my cookie choice later; protect my privacy
 * Keywords: cookies, consent, privacy, banner, dialog
 */
/**
 * Cookie consent: a banner with Accept all, Reject non-essential and Manage, where rejecting is exactly as easy as
 * accepting. Manage opens a dialog with a switch per category (essential is always on). The choice is remembered in
 * this browser and a "Cookie settings" button reopens it at any time. Use it on any site that sets optional cookies.
 * Make it the app's own: replace SAMPLE with the cookies you really use, then load each optional script only when its
 * category is on.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

// flowcode:sample
const SAMPLE = {
  storageKey: "flowcode-cookie-consent",
  eyebrow: "Privacy",
  title: "Your cookie choices",
  intro: "This page remembers what you chose. Change it whenever you like.",
  bannerTitle: "Cookies at the studio",
  bannerText: "We use essential cookies to keep your basket and bookings working. With your permission we'd also use a few to remember your settings and see which pages help people most.",
  dialogTitle: "Manage cookies",
  dialogText: "Pick which cookies we may use. Essential ones can't be turned off because the site needs them to work.",
  categories: [
    { id: "essential", label: "Essential", text: "Keep you signed in, hold your basket and remember this choice.", locked: true },
    { id: "preferences", label: "Preferences", text: "Remember your currency, language and the classes you looked at.", locked: false },
    { id: "analytics", label: "Analytics", text: "Count visits anonymously so we know which pages are useful.", locked: false },
    { id: "marketing", label: "Marketing", text: "Show you studio news on other sites. We don't sell your data.", locked: false },
  ],
};

type Choice = { categories: Record<string, boolean>; savedAt: string };

function readChoice(key: string): Choice | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Choice) : null;
  } catch {
    return null;
  }
}

const describe = (c: Choice, labels: Array<{ id: string; label: string; locked: boolean }>) => {
  const on = labels.filter((l) => !l.locked && c.categories[l.id]).map((l) => l.label.toLowerCase());
  return on.length === 0 ? "Essential cookies only" : on.length === labels.length - 1 ? "All cookies allowed" : `Essential plus ${on.join(" and ")}`;
};

export default function CookieConsent() {
  const d = SAMPLE;
  const all = (value: boolean) => Object.fromEntries(d.categories.map((c) => [c.id, c.locked ? true : value]));

  const [choice, setChoice] = useState<Choice | null>(() => readChoice(d.storageKey));
  const [storageFailed, setStorageFailed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, boolean>>(() => choice?.categories ?? all(false));
  const [status, setStatus] = useState("");

  const opener = useRef<HTMLElement | null>(null);
  const settingsBtn = useRef<HTMLButtonElement | null>(null);
  const dialog = useRef<HTMLDivElement | null>(null);

  const save = (categories: Record<string, boolean>) => {
    const next: Choice = { categories: { ...categories, essential: true }, savedAt: new Date().toISOString() };
    setChoice(next);
    try {
      localStorage.setItem(d.storageKey, JSON.stringify(next));
      setStorageFailed(false);
    } catch {
      setStorageFailed(true);
    }
    setStatus(`Saved: ${describe(next, d.categories)}.`);
  };

  const openDialog = () => {
    opener.current = document.activeElement as HTMLElement | null;
    setDraft(choice?.categories ?? all(false));
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    // Return focus to whatever opened the dialog; if the banner went away, land on "Cookie settings".
    requestAnimationFrame(() => {
      const back = opener.current && document.contains(opener.current) ? opener.current : settingsBtn.current;
      back?.focus();
    });
  };

  useEffect(() => {
    if (dialogOpen) dialog.current?.focus();
  }, [dialogOpen]);

  // Keep Tab inside the dialog and let Escape close it.
  const onDialogKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeDialog();
      return;
    }
    if (e.key !== "Tab" || !dialog.current) return;
    const f = Array.from(dialog.current.querySelectorAll<HTMLElement>("button, input:not([disabled])"));
    if (f.length === 0) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const forget = () => {
    try {
      localStorage.removeItem(d.storageKey);
    } catch {
      /* storage blocked: forgetting in memory is enough */
    }
    setChoice(null);
    setStatus("Choice cleared. The banner will ask again.");
  };

  return (
    <section className="fl-section fl-section--tint" aria-labelledby="cookie-consent-title">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="cookie-consent-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.intro}</p>
        </div>

        <div className="fl-card" style={{ gap: "var(--space-4)" }}>
          <h3>Current choice</h3>
          <p className="fl-text">{choice ? describe(choice, d.categories) : "You haven't chosen yet."}</p>
          {storageFailed && (
            <p className="fl-way-warn" role="alert">
              Your browser blocked saving this choice, so we'll keep it for this visit only and ask again next time.
            </p>
          )}
          <div className="fl-actions">
            <button ref={settingsBtn} type="button" className="fl-btn fl-btn--secondary" onClick={openDialog}>
              Cookie settings
            </button>
            {choice && (
              <button type="button" className="fl-way-btn-sm" onClick={forget}>
                Forget my choice
              </button>
            )}
          </div>
          <p className="fl-way-status" role="status" aria-live="polite">
            {status}
          </p>
        </div>

        {!choice && (
          <div className="fl-way-cookie" role="region" aria-labelledby="cookie-consent-banner-title">
            <div>
              <h3 id="cookie-consent-banner-title">{d.bannerTitle}</h3>
              <p className="fl-text" style={{ fontSize: "var(--text-sm)" }}>
                {d.bannerText}
              </p>
            </div>
            <div className="fl-way-cookie__actions">
              <button type="button" className="fl-way-btn-sm" onClick={openDialog}>
                Manage
              </button>
              {/* Reject and Accept share one style on purpose: saying no is as easy as saying yes. */}
              <button
                type="button"
                className="fl-btn fl-btn--primary"
                onClick={() => {
                  save(all(false));
                  requestAnimationFrame(() => settingsBtn.current?.focus());
                }}
              >
                Reject non-essential
              </button>
              <button
                type="button"
                className="fl-btn fl-btn--primary"
                onClick={() => {
                  save(all(true));
                  requestAnimationFrame(() => settingsBtn.current?.focus());
                }}
              >
                Accept all
              </button>
            </div>
          </div>
        )}

        {dialogOpen && (
          <div
            className="fl-way-backdrop"
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) closeDialog();
            }}
          >
            <div
              ref={dialog}
              className="fl-way-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cookie-consent-dialog-title"
              aria-describedby="cookie-consent-dialog-text"
              tabIndex={-1}
              onKeyDown={onDialogKey}
            >
              <h3 id="cookie-consent-dialog-title">{d.dialogTitle}</h3>
              <p id="cookie-consent-dialog-text" className="fl-text">
                {d.dialogText}
              </p>
              <fieldset className="fl-way-switches">
                <legend className="fl-sr">Cookie categories</legend>
                {d.categories.map((c) => (
                  <div key={c.id} className="fl-way-switch-row">
                    <label htmlFor={`cookie-consent-${c.id}`}>
                      <strong>{c.label}</strong>
                      <span id={`cookie-consent-${c.id}-text`}>{c.text}</span>
                    </label>
                    <span className="fl-way-switch-wrap">
                      {c.locked && <span className="fl-way-locked">Always on</span>}
                      <input
                        id={`cookie-consent-${c.id}`}
                        type="checkbox"
                        role="switch"
                        className="fl-way-switch"
                        checked={c.locked ? true : !!draft[c.id]}
                        disabled={c.locked}
                        aria-describedby={`cookie-consent-${c.id}-text`}
                        onChange={(e) => setDraft((x) => ({ ...x, [c.id]: e.target.checked }))}
                      />
                    </span>
                  </div>
                ))}
              </fieldset>
              <div className="fl-actions" style={{ justifyContent: "flex-end" }}>
                <button type="button" className="fl-way-btn-sm" onClick={closeDialog}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="fl-btn fl-btn--primary"
                  onClick={() => {
                    save(draft);
                    closeDialog();
                  }}
                >
                  Save my choices
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
