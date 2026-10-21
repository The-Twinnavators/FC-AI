/** @flowcode-library notification-matrix · Notification preferences (Forms)
 * Catalog ID: p.notification-matrix (pattern)
 * Function: Notification preferences (p.notification-matrix): a grid of events (grouped as Social, Security, Product) by channels (Email, Push, Text) with a switch in every cell, a whole-column checkbox that shows some-on, security events that stay on with a lock, a dot on each changed cell, a save bar that counts unsaved changes with Discard (confirmed) and Save (working, saved and error states), and Pause all for an hour, until tomorrow or a week with Resume.
 * Use it as: import { NotificationMatrix } from "./notification-matrix"; <NotificationMatrix title lede? channels={[{ id: "email", label: "Email", icon: "mail" }]} groups={[{ id, label, events: [{ id, title, text, on: { email: true, push: false }, locked?: ["email"] }] }]} now?={new Date()} onSave?={async (prefs) => void} onPause?={(until: Date | null) => ...} note? labels?={{ save, saving, saved, discard, pause, resume, ... }} />
 * Built from: c.switch, c.checkbox, c.select.outlined, c.button.primary, c.button.secondary, c.button.tertiary, c.modal.danger
 * Look: A white card with the title and a line of help, a Pause all row with a duration select, then a table: an Activity column of event names with a muted sentence under each, and Email, Push and Text columns of switches centered under an icon, a label and a column checkbox; group names run as sunken rows between. A bar slides up along the bottom with the count of unsaved changes, Discard and Save. On a phone each event becomes a small card with its switches labeled.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-success --color-warning --color-danger --space-1 --space-2 --space-3 --space-4 --space-5 --radius-md --radius-lg --text-xs --text-sm --text-lg --weight-semibold --focus-ring --shadow-lg --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance
 * Use cases: notification settings; notification preferences; email preferences; alert settings; account settings; communication preferences; push notification settings; do not disturb
 * Jobs to be done: choose which alerts I get by email, push or text; turn off a whole channel; keep security alerts on; pause notifications for a while; save or undo my changes
 * Keywords: notifications, preferences, settings, email, push, sms, text message, matrix, switches, pause, do not disturb, alerts
 */
/**
 * Notification preferences: one switch per event and channel. Changes collect until Save (each changed cell gets a
 * dot and the bar counts them); Discard asks first. A column's checkbox turns that channel on or off for every event
 * it can, and shows "some" when mixed. Security events can be locked on. Pause all stops everything for a while right
 * away and shows when it ends. Make it the app's own: replace SAMPLE with the product's events and channels, save
 * through onSave (throw to show the error) and store the pause through onPause.
 * Adapted from Creative Tim UI (MIT, Copyright (c) 2025 Creative Tim): its account notifications block.
 */
/**
 * How to try it
 * - Turn Push on for Mentions and Text off for Comments: each cell gets a dot and the bar says "2 unsaved changes".
 *   Press Discard and confirm: both go back.
 * - Tick the Email column checkbox: every email switch turns on except the locked ones, which never change.
 * - Turn every channel off for Mentions and press Save: the sample server refuses and the error shows. Turn one back
 *   on and Save: it says Saved.
 * - Pick "Until tomorrow" and press Pause: the grid dims and can't be changed until you press Resume.
 * - On a phone width each event is a card with its switches labeled.
 *
 * Dependencies: React (useEffect, useId, useMemo, useState), the library's Switch, Checkbox, Select, Button and Modal
 * ("./switches-states", "./checkboxes-radios", "./dropdowns-states", "./buttons-variants", "./modals-dialogs") and its
 * inline icon set ("./icons"). Nothing else: no package and nothing fetched. The styles are the library's own fl-
 * classes in templates/library/css/r3c-notification-matrix.css.
 */
import { Fragment, useEffect, useId, useMemo, useState } from "react";
import { Button } from "./buttons-variants";
import { Checkbox } from "./checkboxes-radios";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { Switch } from "./switches-states";

// ── p.notification-matrix: events by channels, saved together, with a pause. ──

export type NotifyChannel = { id: string; label: string; icon?: string };
export type NotifyEvent = { id: string; title: string; text?: string; on: Record<string, boolean>; locked?: string[] };
export type NotifyGroup = { id: string; label: string; events: NotifyEvent[] };
export type NotifyPrefs = Record<string, Record<string, boolean>>;

export type NotificationMatrixLabels = Partial<{
  activity: string;
  all: string;
  locked: string;
  pause: string;
  pauseFor: string;
  paused: string;
  resume: string;
  unsaved: string;
  unsavedOne: string;
  discard: string;
  discardTitle: string;
  discardText: string;
  save: string;
  saving: string;
  saved: string;
  failed: string;
}>;

export type NotificationMatrixProps = {
  title: string;
  lede?: string;
  channels: NotifyChannel[];
  groups: NotifyGroup[];
  /** "Now" for the pause end; the real time when left out. */
  now?: Date;
  /** Saves every event's channels; throw (with a message) to show the error. Waits a moment when left out. */
  onSave?: (prefs: NotifyPrefs) => Promise<void>;
  /** The pause's end, or null when resumed. */
  onPause?: (until: Date | null) => void;
  /** A closing line about delivery; left out, none is shown. */
  note?: string;
  labels?: NotificationMatrixLabels;
};

const wait = (t: number) => new Promise((r) => window.setTimeout(r, t));
const toPrefs = (groups: NotifyGroup[]): NotifyPrefs => Object.fromEntries(groups.flatMap((g) => g.events.map((e) => [e.id, { ...e.on }])));

export function NotificationMatrix({ title, lede, channels, groups, now: nowProp, onSave, onPause, note, labels = {} }: NotificationMatrixProps) {
  const l = {
    activity: "Activity",
    all: "All {channel}",
    locked: "Always on for your security",
    pause: "Pause",
    pauseFor: "Pause all notifications",
    paused: "Paused until {when}",
    resume: "Resume",
    unsaved: "{n} unsaved changes",
    unsavedOne: "1 unsaved change",
    discard: "Discard",
    discardTitle: "Discard your changes?",
    discardText: "The switches go back to how they were saved.",
    save: "Save",
    saving: "Saving…",
    saved: "Preferences saved.",
    failed: "Couldn't save. Try again.",
    ...labels,
  };
  const id = useId();
  const events = useMemo(() => groups.flatMap((g) => g.events), [groups]);
  const [saved, setSaved] = useState<NotifyPrefs>(() => toPrefs(groups));
  const [draft, setDraft] = useState<NotifyPrefs>(() => toPrefs(groups));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [span, setSpan] = useState("1h");
  const [until, setUntil] = useState<Date | null>(null);

  const isLocked = (e: NotifyEvent, c: string) => Boolean(e.locked?.includes(c));
  const changed = events.flatMap((e) => channels.filter((c) => draft[e.id]?.[c.id] !== saved[e.id]?.[c.id]).map((c) => `${e.id}:${c.id}`));
  const dirty = changed.length > 0;

  // Leaving with unsaved changes: the browser asks first.
  useEffect(() => {
    if (!dirty) return;
    const stop = (ev: BeforeUnloadEvent) => ev.preventDefault();
    window.addEventListener("beforeunload", stop);
    return () => window.removeEventListener("beforeunload", stop);
  }, [dirty]);

  const set = (eventId: string, channel: string, on: boolean) => {
    setDraft((d) => ({ ...d, [eventId]: { ...d[eventId], [channel]: on } }));
    setError("");
  };

  const column = (c: NotifyChannel) => {
    const free = events.filter((e) => !isLocked(e, c.id));
    const onCount = free.filter((e) => draft[e.id]?.[c.id]).length;
    return { free, all: free.length > 0 && onCount === free.length, some: onCount > 0 && onCount < free.length };
  };

  const setColumn = (c: NotifyChannel, on: boolean) => {
    setDraft((d) => {
      const next = { ...d };
      for (const e of events) if (!isLocked(e, c.id)) next[e.id] = { ...next[e.id], [c.id]: on };
      return next;
    });
    setError("");
    setStatus(`${c.label} turned ${on ? "on" : "off"} for every event.`);
  };

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await (onSave ? onSave(draft) : wait(700));
      setSaved(draft);
      setStatus(l.saved);
      // The bar (and its Save button) goes away; focus waits on the heading so the keyboard isn't dropped.
      window.setTimeout(() => document.getElementById(`${id}-title`)?.focus(), 0);
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : l.failed;
      setError(msg);
      setStatus(msg);
    } finally {
      setBusy(false);
    }
  };

  const pause = () => {
    const base = nowProp ?? new Date();
    const end = new Date(base);
    if (span === "1h") end.setHours(end.getHours() + 1);
    else if (span === "tomorrow") {
      end.setDate(end.getDate() + 1);
      end.setHours(8, 0, 0, 0);
    } else end.setDate(end.getDate() + 7);
    setUntil(end);
    onPause?.(end);
    setStatus(`Notifications paused until ${when(end)}.`);
    window.setTimeout(() => document.getElementById(`${id}-resume`)?.focus(), 0);
  };
  const resume = () => {
    setUntil(null);
    onPause?.(null);
    setStatus("Notifications are back on.");
    window.setTimeout(() => document.getElementById(`${id}-span`)?.focus(), 0);
  };
  const when = (d: Date) => new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }).format(d);

  return (
    <section className={["fl-npm", dirty ? "is-dirty" : ""].filter(Boolean).join(" ")} aria-labelledby={`${id}-title`} data-fl="p.notification-matrix">
      <header className="fl-npm-head">
        <h2 id={`${id}-title`} tabIndex={-1}>
          {title}
        </h2>
        {lede ? <p>{lede}</p> : null}
      </header>

      <div className={["fl-npm-pause", until ? "is-paused" : ""].filter(Boolean).join(" ")}>
        <span className="fl-npm-pause-icon" aria-hidden="true">
          <Icon name={until ? "pause" : "bell"} />
        </span>
        {until ? (
          <>
            <p className="fl-npm-pause-text">
              <strong>{l.paused.replace("{when}", when(until))}</strong>
            </p>
            <Button id={`${id}-resume`} variant="secondary" size={32} icon="play" onClick={resume}>
              {l.resume}
            </Button>
          </>
        ) : (
          <>
            <label htmlFor={`${id}-span`} className="fl-npm-pause-text">
              {l.pauseFor}
            </label>
            <div className="fl-npm-pause-ctl">
              <Select
                id={`${id}-span`}
                value={span}
                onChange={(e) => setSpan(e.currentTarget.value)}
                options={[
                  { value: "1h", label: "For 1 hour" },
                  { value: "tomorrow", label: "Until tomorrow" },
                  { value: "week", label: "For 1 week" },
                ]}
              />
              <Button variant="secondary" size={40} icon="pause" onClick={pause}>
                {l.pause}
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="fl-npm-scroll" inert={until ? true : undefined} aria-disabled={until ? true : undefined}>
        <table className="fl-npm-table">
          <caption className="fl-sr">{title}</caption>
          <thead>
            <tr>
              <th scope="col" className="fl-npm-act">
                {l.activity}
              </th>
              {channels.map((c) => {
                const col = column(c);
                return (
                  <th scope="col" key={c.id} className="fl-npm-ch">
                    <span className="fl-npm-chhead">
                      {c.icon ? <Icon name={c.icon} /> : null}
                      {c.label}
                    </span>
                    <Checkbox size={16} checked={col.all} indeterminate={col.some} disabled={!col.free.length} aria-label={l.all.replace("{channel}", c.label.toLowerCase())} onChange={(e) => setColumn(c, e.currentTarget.checked)} />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.id}>
                <tr className="fl-npm-group">
                  <th scope="colgroup" colSpan={channels.length + 1}>
                    {g.label}
                  </th>
                </tr>
                {g.events.map((e) => (
                  <tr key={e.id} className="fl-npm-row">
                    <th scope="row" className="fl-npm-act">
                      <span className="fl-npm-title">{e.title}</span>
                      {e.text ? <span className="fl-npm-text">{e.text}</span> : null}
                    </th>
                    {channels.map((c) => {
                      const lock = isLocked(e, c.id);
                      const isChanged = changed.includes(`${e.id}:${c.id}`);
                      return (
                        <td key={c.id} data-label={c.label} className={["fl-npm-cell", isChanged ? "is-changed" : ""].filter(Boolean).join(" ")}>
                          <span className="fl-npm-cellin">
                            <Switch size={20} on={lock ? true : Boolean(draft[e.id]?.[c.id])} disabled={lock} label={`${c.label} for ${e.title}${lock ? `, ${l.locked.toLowerCase()}` : ""}`} onToggle={(on) => set(e.id, c.id, on)} />
                            {lock ? (
                              <span className="fl-npm-lock" title={l.locked} aria-hidden="true">
                                <Icon name="lock" />
                              </span>
                            ) : null}
                            {isChanged ? <span className="fl-npm-dot" aria-hidden="true" /> : null}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {note ? (
        <p className="fl-npm-note">
          <Icon name="info" />
          {note}
        </p>
      ) : null}

      {dirty || error ? (
        <div className="fl-npm-bar" role="region" aria-label="Unsaved changes">
          <p className={error ? "fl-npm-err" : undefined}>
            {error ? <Icon name="alert" /> : <span className="fl-npm-dot" aria-hidden="true" />}
            {error || (changed.length === 1 ? l.unsavedOne : l.unsaved.replace("{n}", String(changed.length)))}
          </p>
          <div className="fl-npm-barbtns">
            <Button variant="tertiary" size={40} disabled={busy || !dirty} onClick={() => setConfirming(true)}>
              {l.discard}
            </Button>
            <Button size={40} busy={busy} disabled={!dirty} onClick={() => void save()}>
              {busy ? l.saving : l.save}
            </Button>
          </div>
        </div>
      ) : null}

      <p className="fl-npm-status" role="status" aria-live="polite">
        {status}
      </p>

      {confirming ? (
        <Modal
          variant="danger"
          icon="refresh"
          title={l.discardTitle}
          description={l.discardText}
          confirmLabel={l.discard}
          onConfirm={() => {
            setDraft(saved);
            window.setTimeout(() => document.getElementById(`${id}-title`)?.focus(), 0);
            setError("");
            setStatus("Changes discarded.");
          }}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </section>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Notifications",
  lede: "Choose how we reach you. Changes apply to every project you follow.",
  now: new Date("2026-10-21T10:00:00"),
  note: "Email arrives right away. Push needs the mobile app. Text messages may cost what your carrier charges.",
  channels: [
    { id: "email", label: "Email", icon: "mail" },
    { id: "push", label: "Push", icon: "phone" },
    { id: "sms", label: "Text", icon: "send" },
  ],
  groups: [
    {
      id: "social",
      label: "Social",
      events: [
        { id: "mentions", title: "Mentions", text: "Someone mentions you in a comment.", on: { email: true, push: false, sms: true } },
        { id: "comments", title: "Comments", text: "Someone comments on your work.", on: { email: true, push: false, sms: true } },
        { id: "followers", title: "New followers", text: "Someone starts following you.", on: { email: false, push: true, sms: false } },
      ],
    },
    {
      id: "security",
      label: "Security",
      events: [
        { id: "signin", title: "New sign-in", text: "A new device or place signs in.", on: { email: true, push: true, sms: false }, locked: ["email"] },
        { id: "password", title: "Password changed", text: "Your password is updated.", on: { email: true, push: true, sms: true }, locked: ["email"] },
      ],
    },
    {
      id: "product",
      label: "Product",
      events: [{ id: "updates", title: "Product updates", text: "New features and fixes, about once a month.", on: { email: true, push: false, sms: false } }],
    },
  ] as NotifyGroup[],
};

export default function NotificationMatrixSheet() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap fl-wrap--narrow">
        <NotificationMatrix
          {...SAMPLE}
          onSave={async (prefs) => {
            await wait(700);
            // The sample server keeps at least one way to reach people about mentions.
            if (!Object.values(prefs.mentions ?? {}).some(Boolean)) throw new Error("Keep at least one channel on for Mentions.");
          }}
        />
      </div>
    </section>
  );
}
