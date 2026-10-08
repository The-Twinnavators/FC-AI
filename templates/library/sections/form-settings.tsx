/**
 * Form: settings and profile. Grouped sections laid out in two columns (what the group is about on the left, its
 * fields on the right): profile details, notification switches and a danger zone whose delete asks for confirmation
 * in a dialog. A save bar notes unsaved changes, checks the fields and confirms the save. Settings are kept in local
 * storage on this device; nothing is sent. Use it for an account, studio or household settings page. Make it the
 * app's own: replace SAMPLE with the real groups and options, and keep the danger zone only if the PRD has one.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  storageKey: "settings-profile",
  title: "Settings",
  lede: "Manage how the studio sees you and when we get in touch.",
  initial: {
    name: "Sam Rivera",
    email: "sam@example.com",
    phone: "+1 555 0142",
    timezone: "Europe/London",
    bio: "Mostly evening pottery classes. Happy to swap slots.",
    notify: { reminders: true, waitlist: true, news: false, receipts: true },
  },
  timezones: [
    { value: "Europe/London", label: "London (GMT)" },
    { value: "Europe/Berlin", label: "Berlin (CET)" },
    { value: "America/New_York", label: "New York (ET)" },
    { value: "America/Los_Angeles", label: "Los Angeles (PT)" },
    { value: "Australia/Sydney", label: "Sydney (AET)" },
  ],
  groups: {
    profile: { title: "Profile", text: "Shown to teachers on the class register. Your email is never shared." },
    notifications: { title: "Notifications", text: "Choose which emails you get. Booking receipts are always sent for your records." },
    danger: { title: "Danger zone", text: "Removing your account cancels upcoming bookings and can't be undone." },
  },
  notifications: [
    { id: "reminders", label: "Class reminders", hint: "An email the evening before each class." },
    { id: "waitlist", label: "Waitlist openings", hint: "When a spot opens in a full class you're waiting on." },
    { id: "news", label: "Studio news", hint: "New courses and open days, about once a month." },
    { id: "receipts", label: "Booking receipts", hint: "Required while you have active passes.", locked: true },
  ],
  danger: { action: "Delete account", lead: "Delete this account", detail: "Your 3 upcoming bookings will be cancelled and passes refunded as credit.", confirmWord: "DELETE" },
  saved: "Changes saved",
  deleted: "Account deleted. In a real app you would be signed out now.",
};

type NotifyKey = keyof typeof SAMPLE.initial.notify;
type Settings = typeof SAMPLE.initial;

function load(): Settings {
  try {
    const raw = localStorage.getItem(SAMPLE.storageKey);
    if (raw) return { ...SAMPLE.initial, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    /* storage unavailable: start from the sample */
  }
  return SAMPLE.initial;
}

function ErrorText({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} className="fl-frm-error">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5M12 16.5h.01" />
      </svg>
      {children}
    </p>
  );
}

export default function FormSettings() {
  const d = SAMPLE;
  const [saved, setSaved] = useState<Settings>(load);
  const [draft, setDraft] = useState<Settings>(saved);
  const [tried, setTried] = useState(false);
  const [status, setStatus] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleted, setDeleted] = useState(false);
  const deleteBtn = useRef<HTMLButtonElement>(null);
  const confirmInput = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const errors: { name?: string; email?: string } = {};
  if (!draft.name.trim()) errors.name = "Your name can't be empty.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) errors.email = "Enter a full email address, like name@example.com.";

  const edit = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setDraft((s) => ({ ...s, [k]: v }));
    setStatus("");
  };
  const toggle = (k: NotifyKey) => edit("notify", { ...draft.notify, [k]: !draft.notify[k] });

  const save = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTried(true);
    if (errors.name) return nameRef.current?.focus();
    if (errors.email) return emailRef.current?.focus();
    try {
      localStorage.setItem(d.storageKey, JSON.stringify(draft));
    } catch {
      /* storage unavailable: kept for this visit only */
    }
    setSaved(draft);
    setTried(false);
    setStatus(d.saved);
  };
  const discard = () => {
    setDraft(saved);
    setTried(false);
    setStatus("");
  };

  const closeDialog = () => {
    setConfirmOpen(false);
    setConfirmText("");
    requestAnimationFrame(() => deleteBtn.current?.focus());
  };
  useEffect(() => {
    if (!confirmOpen) return;
    confirmInput.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDialog();
      if (e.key === "Tab" && dialogRef.current) {
        const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("input, button:not(:disabled)"));
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmOpen]);

  const confirmDelete = () => {
    try {
      localStorage.removeItem(d.storageKey);
    } catch {
      /* nothing stored */
    }
    setConfirmOpen(false);
    setDeleted(true);
  };

  const err = (k: "name" | "email") => (tried ? errors[k] : undefined);

  if (deleted) {
    return (
      <section className="fl-section" aria-labelledby="form-settings-title">
        <div className="fl-wrap fl-wrap--narrow">
          <h2 id="form-settings-title" className="fl-title" style={{ marginBottom: "var(--space-5)" }}>
            {d.title}
          </h2>
          <p className="fl-done" role="status">
            {d.deleted}
          </p>
          <button
            type="button"
            className="fl-btn fl-btn--secondary"
            style={{ marginTop: "var(--space-4)" }}
            onClick={() => {
              setDeleted(false);
              setSaved(d.initial);
              setDraft(d.initial);
            }}
          >
            Restore the sample
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="fl-section" aria-labelledby="form-settings-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <h2 id="form-settings-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>

        <form className="fl-frm-settings" onSubmit={save} noValidate>
          <div className="fl-frm-group" role="group" aria-labelledby="set-profile-title">
            <div className="fl-frm-group__about">
              <h3 id="set-profile-title">{d.groups.profile.title}</h3>
              <p className="fl-frm-hint">{d.groups.profile.text}</p>
            </div>
            <div className="fl-frm-group__body">
              <div className="fl-frm-avatar-row">
                <span className="fl-person__avatar" aria-hidden="true">
                  {draft.name
                    .trim()
                    .split(/\s+/)
                    .map((w) => w[0] ?? "")
                    .join("")
                    .slice(0, 2)
                    .toUpperCase() || "?"}
                </span>
                <span className="fl-meta">Your initials stand in for a photo on the register.</span>
              </div>
              <div className="fl-grid fl-grid--2" style={{ gap: "var(--space-4)" }}>
                <div className="fl-field">
                  <label htmlFor="set-name">Name</label>
                  <input
                    ref={nameRef}
                    id="set-name"
                    className="fl-input"
                    autoComplete="name"
                    value={draft.name}
                    onChange={(e) => edit("name", e.target.value)}
                    aria-invalid={err("name") ? true : undefined}
                    aria-describedby={err("name") ? "set-name-error" : undefined}
                  />
                  {err("name") && <ErrorText id="set-name-error">{err("name")!}</ErrorText>}
                </div>
                <div className="fl-field">
                  <label htmlFor="set-phone">
                    Phone <span className="fl-meta">(optional)</span>
                  </label>
                  <input id="set-phone" type="tel" className="fl-input" autoComplete="tel" value={draft.phone} onChange={(e) => edit("phone", e.target.value)} />
                </div>
              </div>
              <div className="fl-field">
                <label htmlFor="set-email">Email</label>
                <input
                  ref={emailRef}
                  id="set-email"
                  type="email"
                  className="fl-input"
                  autoComplete="email"
                  value={draft.email}
                  onChange={(e) => edit("email", e.target.value)}
                  aria-invalid={err("email") ? true : undefined}
                  aria-describedby={err("email") ? "set-email-error" : undefined}
                />
                {err("email") && <ErrorText id="set-email-error">{err("email")!}</ErrorText>}
              </div>
              <div className="fl-field">
                <label htmlFor="set-tz">Time zone</label>
                <span className="fl-frm-select">
                  <select id="set-tz" className="fl-input" value={draft.timezone} onChange={(e) => edit("timezone", e.target.value)} aria-describedby="set-tz-hint">
                    {d.timezones.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
                <p id="set-tz-hint" className="fl-frm-hint">
                  Class times and reminders use this zone.
                </p>
              </div>
              <div className="fl-field">
                <label htmlFor="set-bio">
                  Note for teachers <span className="fl-meta">(optional)</span>
                </label>
                <textarea id="set-bio" className="fl-input" maxLength={160} value={draft.bio} onChange={(e) => edit("bio", e.target.value)} aria-describedby="set-bio-count" style={{ minHeight: "6rem" }} />
                <p id="set-bio-count" className="fl-frm-hint">
                  {160 - draft.bio.length} characters left
                </p>
              </div>
            </div>
          </div>

          <div className="fl-frm-group" role="group" aria-labelledby="set-notify-title">
            <div className="fl-frm-group__about">
              <h3 id="set-notify-title">{d.groups.notifications.title}</h3>
              <p className="fl-frm-hint">{d.groups.notifications.text}</p>
            </div>
            <div className="fl-frm-group__body" style={{ gap: 0 }}>
              {d.notifications.map((n) => {
                const k = n.id as NotifyKey;
                return (
                  <div key={n.id} className="fl-frm-switch-row">
                    <div>
                      <label id={`set-n-${n.id}-label`} htmlFor={`set-n-${n.id}`}>
                        {n.label}
                      </label>
                      <p id={`set-n-${n.id}-hint`} className="fl-frm-hint">
                        {n.hint}
                      </p>
                    </div>
                    <button
                      id={`set-n-${n.id}`}
                      type="button"
                      role="switch"
                      className="fl-frm-switch"
                      aria-checked={draft.notify[k]}
                      aria-labelledby={`set-n-${n.id}-label`}
                      aria-describedby={`set-n-${n.id}-hint`}
                      disabled={n.locked}
                      style={n.locked ? { opacity: "var(--disabled-opacity, 0.5)", cursor: "not-allowed" } : undefined}
                      onClick={() => toggle(k)}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="fl-frm-group fl-frm-group--danger" role="group" aria-labelledby="set-danger-title">
            <div className="fl-frm-group__about">
              <h3 id="set-danger-title">{d.groups.danger.title}</h3>
              <p className="fl-frm-hint">{d.groups.danger.text}</p>
            </div>
            <div className="fl-frm-group__body">
              <div className="fl-frm-danger">
                <div>
                  <strong>{d.danger.lead}</strong>
                  <p className="fl-frm-hint">{d.danger.detail}</p>
                </div>
                <button ref={deleteBtn} type="button" className="fl-btn fl-frm-btn--danger-outline" aria-haspopup="dialog" onClick={() => setConfirmOpen(true)}>
                  {d.danger.action}
                </button>
              </div>
            </div>
          </div>

          <div className="fl-frm-savebar">
            <span aria-live="polite">
              {dirty ? (
                <span className="fl-frm-dirty">You have unsaved changes</span>
              ) : status ? (
                <span className="fl-frm-saved">
                  <Icon name="check" />
                  {status}
                </span>
              ) : (
                <span className="fl-meta">All changes saved</span>
              )}
            </span>
            <span className="fl-actions">
              <button type="button" className="fl-btn fl-btn--secondary" onClick={discard} disabled={!dirty}>
                Discard
              </button>
              <button type="submit" className="fl-btn fl-btn--primary" disabled={!dirty}>
                Save changes
              </button>
            </span>
          </div>
        </form>
      </div>

      {confirmOpen && (
        <div
          className="fl-frm-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDialog();
          }}
        >
          <div ref={dialogRef} className="fl-frm-dialog" role="dialog" aria-modal="true" aria-labelledby="set-del-title" aria-describedby="set-del-text">
            <h3 id="set-del-title">Delete your account?</h3>
            <p id="set-del-text" className="fl-text">
              {d.danger.detail} This can't be undone.
            </p>
            <div className="fl-field">
              <label htmlFor="set-del-confirm">
                Type <strong>{d.danger.confirmWord}</strong> to confirm
              </label>
              <input ref={confirmInput} id="set-del-confirm" className="fl-input" autoComplete="off" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            </div>
            <div className="fl-actions">
              <button type="button" className="fl-btn fl-btn--secondary" onClick={closeDialog}>
                Keep my account
              </button>
              <button type="button" className="fl-btn fl-frm-btn--danger" disabled={confirmText.trim() !== d.danger.confirmWord} onClick={confirmDelete}>
                {d.danger.action}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
