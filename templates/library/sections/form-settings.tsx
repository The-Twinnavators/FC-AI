/** @flowcode-library form-settings · Settings form (Forms)
 * Catalog ID: p.settings-form (pattern)
 * Function: The settings form (p.settings-form): grouped profile fields, notification switches and a danger zone with a type-to-confirm dialog, saved to local storage with a dirty-state save bar.
 * Use it as: import { SettingsForm } from "./form-settings"; <SettingsForm title lede? values={{ fieldOrSwitchId: string|boolean }} saved="Changes saved" deleted="..." storageKey? onSave? onDelete? groups={[{ kind: "fields", id, title, text?, avatar?: { from, note }, fields: [{ id, type: "text"|"email"|"tel"|"select"|"textarea", label, optional?, hint?, options?, maxLength?, required?, invalid?, half? }] } | { kind: "switches", id, title, text?, items: [{ id, label, hint?, locked? }] } | { kind: "danger", id, title, text?, lead, detail, action, confirmWord, confirmTitle, keepLabel }]} />
 * Built from: c.text-field.outlined, c.select.outlined, c.switch, c.button.primary, c.button.secondary, c.button.destructive
 * Look: Settings groups in two columns (what the group is about on the left, its fields or switches on the right), a bordered danger zone, and a sticky save bar that says when changes are unsaved.
 * Tokens: --color-danger --color-danger-surface --color-success --color-accent --color-border --color-surface --color-text-muted --space-4 --space-7 --radius-lg --radius-xl --surface-shadow-hover --focus-ring
 * Use cases: account settings; profile settings; notification preferences; user preferences; delete account; privacy settings; workspace settings
 * Jobs to be done: update my profile details; choose which notifications i get; delete my account safely; save changes to my settings
 * Keywords: form, settings, profile, switch, danger zone
 */
/**
 * Form: settings and profile. Grouped sections laid out in two columns (what the group is about on the left, its
 * fields on the right): profile details, notification switches and a danger zone whose delete asks for confirmation
 * in a dialog. A save bar notes unsaved changes, checks the fields and confirms the save. Settings are kept in local
 * storage on this device; nothing is sent. Use it for an account, studio or household settings page. Make it the
 * app's own: replace SAMPLE with the real groups and options, and keep the danger zone only if the PRD has one.
 */
import { Fragment, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";
import { Select } from "./dropdowns-states";
import { Switch } from "./switches-states";
import { TextField } from "./text-fields-states";

// ── p.settings-form: grouped settings (fields, switches, a danger zone) with a save bar that tracks unsaved changes. ──

export type SettingsField = {
  id: string;
  type: "text" | "email" | "tel" | "select" | "textarea";
  label: string;
  /** Adds "(optional)" beside the label. */
  optional?: boolean;
  autoComplete?: string;
  /** Help text under the field. */
  hint?: string;
  /** Select: the choices. */
  options?: { value: string; label: string }[];
  /** Textarea: most characters; a "characters left" count appears. */
  maxLength?: number;
  /** Said on save when the field is empty. Leave out for an optional field. */
  required?: string;
  /** Email: said on save when the text is not an address. */
  invalid?: string;
  /** Sit side by side with the next half-width field. */
  half?: boolean;
};
export type SettingsSwitch = { id: string; label: string; hint?: string; locked?: boolean };

export type SettingsGroup =
  | {
      kind: "fields";
      id: string;
      title: string;
      text?: string;
      fields: SettingsField[];
      /** Draws the initials of the value in this field's id, with a note beside them. */
      avatar?: { from: string; note: string };
    }
  | { kind: "switches"; id: string; title: string; text?: string; items: SettingsSwitch[] }
  | {
      kind: "danger";
      id: string;
      title: string;
      text?: string;
      /** The bold line ("Delete this account"). */
      lead: string;
      /** What will happen; repeated in the confirmation dialog. */
      detail: string;
      /** The button's words, also the confirm button's. */
      action: string;
      /** The word to type to confirm. */
      confirmWord: string;
      confirmTitle: string;
      /** The dialog's quiet button. */
      keepLabel: string;
    };

export type SettingsFormProps = {
  title: string;
  lede?: string;
  groups: SettingsGroup[];
  /** Starting values by field or switch id: strings for fields, true/false for switches. */
  values: Record<string, string | boolean>;
  /** Where the saved values are kept in local storage; leave out to keep them in memory only. */
  storageKey?: string;
  /** Said in the save bar after saving. */
  saved: string;
  /** Said after the danger zone's action is confirmed. */
  deleted: string;
  /** Called with the values when they are saved. */
  onSave?: (values: Record<string, string | boolean>) => void;
  /** Called when the danger zone's action is confirmed. */
  onDelete?: () => void;
  className?: string;
};

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

export function SettingsForm({ title, lede, groups, values: initial, storageKey, saved: savedText, deleted: deletedText, onSave, onDelete, className }: SettingsFormProps) {
  const uid = useId();
  const fid = (id: string) => `${uid}-${id}`;
  type Values = Record<string, string | boolean>;
  const load = (): Values => {
    if (storageKey) {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) return { ...initial, ...(JSON.parse(raw) as Values) };
      } catch {
        /* storage unavailable: start from the given values */
      }
    }
    return initial;
  };
  const [saved, setSaved] = useState<Values>(load);
  const [draft, setDraft] = useState<Values>(saved);
  const [tried, setTried] = useState(false);
  const [status, setStatus] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleted, setDeleted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const allFields = groups.flatMap((g) => (g.kind === "fields" ? g.fields : []));
  const danger = groups.find((g) => g.kind === "danger");
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const errors: Record<string, string> = {};
  for (const f of allFields) {
    const v = String(draft[f.id] ?? "");
    if (f.required && !v.trim()) errors[f.id] = f.required;
    else if (f.type === "email" && f.invalid && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) errors[f.id] = f.invalid;
  }
  const err = (id: string) => (tried ? errors[id] : undefined);

  const edit = (id: string, v: string | boolean) => {
    setDraft((s) => ({ ...s, [id]: v }));
    setStatus("");
  };

  const save = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTried(true);
    const bad = allFields.find((f) => errors[f.id]);
    if (bad) return document.getElementById(fid(bad.id))?.focus();
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(draft));
      } catch {
        /* storage unavailable: kept for this visit only */
      }
    }
    onSave?.(draft);
    setSaved(draft);
    setTried(false);
    setStatus(savedText);
  };
  const discard = () => {
    setDraft(saved);
    setTried(false);
    setStatus("");
  };

  const closeDialog = () => {
    setConfirmOpen(false);
    setConfirmText("");
    requestAnimationFrame(() => document.getElementById(fid("delete"))?.focus());
  };
  useEffect(() => {
    if (!confirmOpen) return;
    dialogRef.current?.querySelector<HTMLElement>("input")?.focus();
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
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* nothing stored */
      }
    }
    onDelete?.();
    setConfirmOpen(false);
    setDeleted(true);
  };

  const rootClass = ["fl-section", className ?? ""].filter(Boolean).join(" ");

  if (deleted) {
    return (
      <section className={rootClass} aria-labelledby={`${uid}-title`} data-fl="p.settings-form">
        <div className="fl-wrap fl-wrap--narrow">
          <h2 id={`${uid}-title`} className="fl-title" style={{ marginBottom: "var(--space-5)" }}>
            {title}
          </h2>
          <p className="fl-done" role="status">
            {deletedText}
          </p>
          <Button
            variant="secondary"
            style={{ marginTop: "var(--space-4)" }}
            onClick={() => {
              setDeleted(false);
              setSaved(initial);
              setDraft(initial);
            }}
          >
            Restore the sample
          </Button>
        </div>
      </section>
    );
  }

  const field = (f: SettingsField): ReactNode => {
    const v = String(draft[f.id] ?? "");
    const hintId = `${fid(f.id)}-hint`;
    const errId = `${fid(f.id)}-error`;
    const hasCount = f.type === "textarea" && f.maxLength !== undefined;
    const describe = [err(f.id) ? errId : "", f.hint || hasCount ? hintId : ""].filter(Boolean).join(" ") || undefined;
    return (
      <div className="fl-field" key={f.id}>
        <label htmlFor={fid(f.id)}>
          {f.label}
          {f.optional ? (
            <>
              {" "}
              <span className="fl-meta">(optional)</span>
            </>
          ) : null}
        </label>
        {f.type === "select" ? (
          <Select id={fid(f.id)} options={f.options ?? []} value={v} onChange={(e) => edit(f.id, e.target.value)} aria-describedby={describe} />
        ) : f.type === "textarea" ? (
          <TextField multiline id={fid(f.id)} maxLength={f.maxLength} value={v} onChange={(e) => edit(f.id, e.target.value)} invalid={!!err(f.id)} aria-describedby={describe} style={{ minHeight: "6rem" }} />
        ) : (
          <TextField id={fid(f.id)} type={f.type} autoComplete={f.autoComplete} value={v} onChange={(e) => edit(f.id, e.target.value)} invalid={!!err(f.id)} aria-describedby={describe} />
        )}
        {err(f.id) && <ErrorText id={errId}>{err(f.id)!}</ErrorText>}
        {hasCount ? (
          <p id={hintId} className="fl-frm-hint">
            {f.maxLength! - v.length} characters left
          </p>
        ) : f.hint ? (
          <p id={hintId} className="fl-frm-hint">
            {f.hint}
          </p>
        ) : null}
      </div>
    );
  };

  // Consecutive half-width fields share a row.
  const fieldRows = (fields: SettingsField[]): ReactNode[] => {
    const rows: ReactNode[] = [];
    for (let i = 0; i < fields.length; i++) {
      if (fields[i].half && fields[i + 1]?.half) {
        rows.push(
          <div key={fields[i].id} className="fl-grid fl-grid--2" style={{ gap: "var(--space-4)" }}>
            {field(fields[i])}
            {field(fields[i + 1])}
          </div>,
        );
        i++;
      } else rows.push(field(fields[i]));
    }
    return rows;
  };

  const initials = (name: string) =>
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  return (
    <section className={rootClass} aria-labelledby={`${uid}-title`} data-fl="p.settings-form">
      <div className="fl-wrap">
        <div className="fl-head">
          <h2 id={`${uid}-title`} className="fl-title">
            {title}
          </h2>
          {lede ? <p className="fl-lede">{lede}</p> : null}
        </div>

        <form className="fl-frm-settings" onSubmit={save} noValidate>
          {groups.map((g) => (
            <div key={g.id} className={`fl-frm-group${g.kind === "danger" ? " fl-frm-group--danger" : ""}`} role="group" aria-labelledby={`${fid(g.id)}-title`}>
              <div className="fl-frm-group__about">
                <h3 id={`${fid(g.id)}-title`}>{g.title}</h3>
                {g.text ? <p className="fl-frm-hint">{g.text}</p> : null}
              </div>
              {g.kind === "fields" ? (
                <div className="fl-frm-group__body">
                  {g.avatar ? (
                    <div className="fl-frm-avatar-row">
                      <span className="fl-person__avatar" aria-hidden="true">
                        {initials(String(draft[g.avatar.from] ?? ""))}
                      </span>
                      <span className="fl-meta">{g.avatar.note}</span>
                    </div>
                  ) : null}
                  {fieldRows(g.fields).map((row, i) => (
                    <Fragment key={i}>{row}</Fragment>
                  ))}
                </div>
              ) : g.kind === "switches" ? (
                <div className="fl-frm-group__body" style={{ gap: 0 }}>
                  {g.items.map((n) => (
                    <label key={n.id} className="fl-frm-switch-row">
                      <div>
                        <strong>{n.label}</strong>
                        {n.hint ? <p className="fl-frm-hint">{n.hint}</p> : null}
                      </div>
                      <Switch on={draft[n.id] === true} label={n.label} disabled={n.locked} onToggle={(next) => edit(n.id, next)} />
                    </label>
                  ))}
                </div>
              ) : (
                <div className="fl-frm-group__body">
                  <div className="fl-frm-danger">
                    <div>
                      <strong>{g.lead}</strong>
                      <p className="fl-frm-hint">{g.detail}</p>
                    </div>
                    <Button id={fid("delete")} variant="secondary" className="fl-frm-btn--danger-outline" aria-haspopup="dialog" onClick={() => setConfirmOpen(true)}>
                      {g.action}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}

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
              <Button variant="secondary" onClick={discard} disabled={!dirty}>
                Discard
              </Button>
              <Button type="submit" disabled={!dirty}>
                Save changes
              </Button>
            </span>
          </div>
        </form>
      </div>

      {confirmOpen && danger?.kind === "danger" && (
        <div
          className="fl-frm-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDialog();
          }}
        >
          <div ref={dialogRef} className="fl-frm-dialog" role="dialog" aria-modal="true" aria-labelledby={`${uid}-del-title`} aria-describedby={`${uid}-del-text`}>
            <h3 id={`${uid}-del-title`}>{danger.confirmTitle}</h3>
            <p id={`${uid}-del-text`} className="fl-text">
              {danger.detail} This can't be undone.
            </p>
            <div className="fl-field">
              <label htmlFor={`${uid}-del-confirm`}>
                Type <strong>{danger.confirmWord}</strong> to confirm
              </label>
              <TextField id={`${uid}-del-confirm`} autoComplete="off" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            </div>
            <div className="fl-actions">
              <Button variant="secondary" onClick={closeDialog}>
                {danger.keepLabel}
              </Button>
              <Button variant="destructive" disabled={confirmText.trim() !== danger.confirmWord} onClick={confirmDelete}>
                {danger.action}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// flowcode:sample
const SAMPLE: SettingsFormProps = {
  storageKey: "settings-profile",
  title: "Settings",
  lede: "Manage how the studio sees you and when we get in touch.",
  values: {
    name: "Sam Rivera",
    email: "sam@example.com",
    phone: "+1 555 0142",
    timezone: "Europe/London",
    bio: "Mostly evening pottery classes. Happy to swap slots.",
    reminders: true,
    waitlist: true,
    news: false,
    receipts: true,
  },
  groups: [
    {
      kind: "fields",
      id: "profile",
      title: "Profile",
      text: "Shown to teachers on the class register. Your email is never shared.",
      avatar: { from: "name", note: "Your initials stand in for a photo on the register." },
      fields: [
        { id: "name", type: "text", label: "Name", autoComplete: "name", half: true, required: "Your name can't be empty." },
        { id: "phone", type: "tel", label: "Phone", optional: true, autoComplete: "tel", half: true },
        {
          id: "email",
          type: "email",
          label: "Email",
          autoComplete: "email",
          required: "Enter a full email address, like name@example.com.",
          invalid: "Enter a full email address, like name@example.com.",
        },
        {
          id: "timezone",
          type: "select",
          label: "Time zone",
          hint: "Class times and reminders use this zone.",
          options: [
            { value: "Europe/London", label: "London (GMT)" },
            { value: "Europe/Berlin", label: "Berlin (CET)" },
            { value: "America/New_York", label: "New York (ET)" },
            { value: "America/Los_Angeles", label: "Los Angeles (PT)" },
            { value: "Australia/Sydney", label: "Sydney (AET)" },
          ],
        },
        { id: "bio", type: "textarea", label: "Note for teachers", optional: true, maxLength: 160 },
      ],
    },
    {
      kind: "switches",
      id: "notifications",
      title: "Notifications",
      text: "Choose which emails you get. Booking receipts are always sent for your records.",
      items: [
        { id: "reminders", label: "Class reminders", hint: "An email the evening before each class." },
        { id: "waitlist", label: "Waitlist openings", hint: "When a spot opens in a full class you're waiting on." },
        { id: "news", label: "Studio news", hint: "New courses and open days, about once a month." },
        { id: "receipts", label: "Booking receipts", hint: "Required while you have active passes.", locked: true },
      ],
    },
    {
      kind: "danger",
      id: "danger",
      title: "Danger zone",
      text: "Removing your account cancels upcoming bookings and can't be undone.",
      lead: "Delete this account",
      detail: "Your 3 upcoming bookings will be cancelled and passes refunded as credit.",
      action: "Delete account",
      confirmWord: "DELETE",
      confirmTitle: "Delete your account?",
      keepLabel: "Keep my account",
    },
  ],
  saved: "Changes saved",
  deleted: "Account deleted. In a real app you would be signed out now.",
};

export default function FormSettings() {
  return <SettingsForm {...SAMPLE} />;
}
