/** @flowcode-library cookie-consent · Cookie consent (Alerts and states)
 * Catalog ID: b.cookie-consent (block)
 * Function: The cookie consent block (b.cookie-consent): banner, preferences modal with a switch per category (essential always on), and the choice remembered in this browser.
 * Use it as: import { CookieConsent } from "./cookie-consent"; <CookieConsent storageKey eyebrow title intro bannerTitle bannerText dialogTitle dialogText categories={[{id,label,text,locked}]} />
 * Built from: c.button.primary, c.button.secondary, c.button.tertiary, c.card.surface, c.modal.confirm, c.switch
 * Look: A banner with Manage, Reject non-essential and Accept all (rejecting looks as easy as accepting), a Cookie settings panel showing the current choice, and a modal with a switch per cookie category.
 * Tokens: --space-3 --space-4 --color-surface --color-border --color-accent --color-text-muted --radius-lg --text-sm
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
import { useRef, useState } from "react";
import { Button } from "./buttons-variants";
import { Card } from "./cards-variants";
import { Modal } from "./modals-dialogs";
import { Switch } from "./switches-states";

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

export type CookieCategory = { id: string; label: string; text: string; locked: boolean };

export type CookieConsentProps = {
  /** localStorage key the choice is saved under. */
  storageKey: string;
  eyebrow: string;
  /** Heading of the section that shows the current choice. */
  title: string;
  intro: string;
  bannerTitle: string;
  bannerText: string;
  dialogTitle: string;
  dialogText: string;
  /** The cookie groups, one switch each; `locked: true` is always on (essential). */
  categories: CookieCategory[];
};

/** b.cookie-consent: a consent banner (Accept all, Reject non-essential, Manage), a preferences modal with a switch per category, and a "Cookie settings" button to reopen it. */
export function CookieConsent(d: CookieConsentProps) {
  const all = (value: boolean) => Object.fromEntries(d.categories.map((c) => [c.id, c.locked ? true : value]));

  const [choice, setChoice] = useState<Choice | null>(() => readChoice(d.storageKey));
  const [storageFailed, setStorageFailed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, boolean>>(() => choice?.categories ?? all(false));
  const [status, setStatus] = useState("");

  const actions = useRef<HTMLDivElement | null>(null);

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
    setDraft(choice?.categories ?? all(false));
    setDialogOpen(true);
  };

  // The banner goes away once a choice is saved, so focus lands on "Cookie settings".
  const focusSettings = () => requestAnimationFrame(() => actions.current?.querySelector("button")?.focus());

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
    <section className="fl-section fl-section--tint" aria-labelledby="cookie-consent-title" data-fl="b.cookie-consent">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="cookie-consent-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.intro}</p>
        </div>

        <Card variant="surface" style={{ gap: "var(--space-4)" }}>
          <h3>Current choice</h3>
          <p className="fl-text">{choice ? describe(choice, d.categories) : "You haven't chosen yet."}</p>
          {storageFailed && (
            <p className="fl-way-warn" role="alert">
              Your browser blocked saving this choice, so we'll keep it for this visit only and ask again next time.
            </p>
          )}
          <div className="fl-actions" ref={actions}>
            <Button variant="secondary" onClick={openDialog}>
              Cookie settings
            </Button>
            {choice && (
              <Button variant="tertiary" size={32} onClick={forget}>
                Forget my choice
              </Button>
            )}
          </div>
          <p className="fl-way-status" role="status" aria-live="polite">
            {status}
          </p>
        </Card>

        {!choice && (
          <div className="fl-way-cookie" role="region" aria-labelledby="cookie-consent-banner-title">
            <div>
              <h3 id="cookie-consent-banner-title">{d.bannerTitle}</h3>
              <p className="fl-text" style={{ fontSize: "var(--text-sm)" }}>
                {d.bannerText}
              </p>
            </div>
            <div className="fl-way-cookie__actions">
              <Button variant="tertiary" size={32} onClick={openDialog}>
                Manage
              </Button>
              {/* Reject and Accept share one style on purpose: saying no is as easy as saying yes. */}
              <Button
                variant="primary"
                onClick={() => {
                  save(all(false));
                  focusSettings();
                }}
              >
                Reject non-essential
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  save(all(true));
                  focusSettings();
                }}
              >
                Accept all
              </Button>
            </div>
          </div>
        )}

        {dialogOpen && (
          <Modal title={d.dialogTitle} description={d.dialogText} confirmLabel="Save my choices" onConfirm={() => save(draft)} onClose={() => setDialogOpen(false)}>
            <fieldset className="fl-way-switches">
              <legend className="fl-sr">Cookie categories</legend>
              {d.categories.map((c) => (
                <div key={c.id} className="fl-way-switch-row">
                  <div style={{ display: "grid", gap: "var(--space-1)" }}>
                    <strong>{c.label}</strong>
                    <span className="fl-meta">{c.text}</span>
                  </div>
                  <span className="fl-way-switch-wrap">
                    {c.locked && <span className="fl-way-locked">Always on</span>}
                    <Switch
                      on={c.locked ? true : !!draft[c.id]}
                      disabled={c.locked}
                      label={`${c.label}: ${c.text}`}
                      onToggle={(next) => setDraft((x) => ({ ...x, [c.id]: next }))}
                    />
                  </span>
                </div>
              ))}
            </fieldset>
          </Modal>
        )}
      </div>
    </section>
  );
}

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

export default function CookieConsentPreview() {
  return <CookieConsent {...SAMPLE} />;
}
