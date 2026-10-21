/** @flowcode-library away-message · Away message (Forms)
 * Catalog ID: p.away-message (pattern)
 * Function: Away message (p.away-message): set up automatic replies while you're out: a switch, first and last day (checked so the last is not before the first, or no end date), who gets the reply (everyone or only your organization), a subject and message with quick inserts for your return date and a backup contact, declining new meetings, a live preview of the reply, a status pill (Off, Scheduled, On), Save with a working state and an error with Retry, and Discard that asks before throwing away changes.
 * Use it as: import { AwayMessage } from "./away-message"; <AwayMessage title? me={{ name, email }} contacts={[{ id, name, email }]} value={{ on, start: "2026-10-24", end?: "2026-10-31" | null, audience: "everyone"|"org", subject, message, backup?: "id" | null, declineMeetings }} now?={new Date()} onSave?={async (value) => void} labels?={{ save, saving, discard, ... }} />
 * Built from: c.switch, c.text-field.outlined, c.select.outlined, c.checkbox, c.radio, c.button.primary, c.button.secondary, c.button.tertiary, c.badge.status, c.modal.danger
 * Look: A white card: the title with a status pill at the right and a switch row under it; when on, the settings slide open in two columns: on the left the dates side by side with a "No end date" box, two radio cards for who gets it, the subject, a message box with small Insert chips over it and a backup-contact dropdown, and a meetings check box; on the right a sunken preview drawn like an email (from, subject, the message with the return date filled in). Discard and Save sit at the bottom right.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-success --color-info --color-danger --space-1 --space-2 --space-3 --space-4 --space-5 --radius-sm --radius-md --radius-lg --text-xs --text-sm --text-base --text-lg --weight-medium --weight-semibold --focus-ring --duration-fast --duration-base --ease-out --ease-spring --easing --enter-distance
 * Use cases: out of office; vacation responder; automatic replies; email settings; leave planning; support agent away status; parental leave; auto-reply
 * Jobs to be done: let people know I'm away and when I'm back; point people to a backup contact; reply only to people inside my company; stop new meetings landing while I'm out; turn off the auto-reply early
 * Keywords: out of office, away, vacation, auto reply, automatic reply, responder, leave, backup contact, email settings, schedule
 */
/**
 * Away message: automatic replies while someone is out. Turning it on slides the settings open (inert while closed).
 * The pill says Off, Scheduled (starts later) or On (running now) from the dates and `now`. Insert chips put the return
 * date or the backup contact's line where the cursor is. Save checks the form (a message, and an end not before the
 * start), focuses the first problem, then calls `onSave` with a working state and an error with Retry if it throws.
 * Discard asks first when there are unsaved changes. Make it the app's own: load the person's settings into `value`,
 * their teammates into `contacts`, and save through `onSave`.
 * Adapted from Creative Tim UI (MIT, Copyright (c) 2025 Creative Tim): the settings card layout of its account
 * notification and basic-info blocks.
 */
/**
 * How to try it
 * - Flip the switch on: the settings slide open. The pill shows what is saved, so it reads Scheduled after Save.
 * - Set the last day before the first: the field says so; tick "No end date" and the error goes.
 * - Put the cursor in the message and press "Return date": a {return} placeholder goes in and the
 *   preview shows the date.
 * - Pick Maya as backup and press "Backup contact". Change the subject, then press Discard: it asks first.
 * - Press Save: the first save fails, press Retry; the pill and status update. Flip the switch off and Save.
 *
 * Dependencies: React (useId, useMemo, useRef, useState), the library's Switch, TextField, Checkbox, Radio, Button, Badge and
 * Modal ("./switches-states", "./text-fields-states", "./checkboxes-radios", "./buttons-variants", "./badges-status",
 * "./modals-dialogs") and its inline icon set ("./icons"). Nothing else: no package and nothing fetched. The styles are
 * the library's own fl- classes in templates/library/css/r4a-away-message.css.
 */
import { useId, useMemo, useRef, useState } from "react";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Checkbox, Radio } from "./checkboxes-radios";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { Switch } from "./switches-states";
import { TextField } from "./text-fields-states";

// ── p.away-message: automatic replies with dates, audience, message and a preview. ──

export type AwayContact = { id: string; name: string; email: string };
export type AwayValue = {
  on: boolean;
  /** First day away, yyyy-mm-dd. */
  start: string;
  /** Last day away, yyyy-mm-dd; null for no end date. */
  end: string | null;
  audience: "everyone" | "org";
  subject: string;
  message: string;
  backup: string | null;
  declineMeetings: boolean;
};
export type AwayMessageLabels = Partial<{ save: string; saving: string; saved: string; discard: string; retry: string }>;

export type AwayMessageProps = {
  title?: string;
  me: { name: string; email: string };
  contacts: AwayContact[];
  value: AwayValue;
  /** "Now" for the status pill; the real time when left out. */
  now?: Date;
  /** Saves; throw to show the error with Retry. Waits a moment when left out. */
  onSave?: (value: AwayValue) => Promise<void>;
  labels?: AwayMessageLabels;
};

const wait = (t: number) => new Promise<void>((r) => window.setTimeout(r, t));
const day = (iso: string) => new Date(`${iso}T12:00`);
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MAX = 1000;

export function AwayMessage({ title = "Automatic replies", me, contacts, value, now: nowProp, onSave, labels = {} }: AwayMessageProps) {
  const l = { save: "Save", saving: "Saving…", saved: "Saved", discard: "Discard", retry: "Retry", ...labels };
  const id = useId();
  const now = useMemo(() => nowProp ?? new Date(), [nowProp]);
  const [saved, setSaved] = useState(value);
  const [v, setV] = useState(value);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [asking, setAsking] = useState(false);
  const [status, setStatus] = useState("");
  const msgRef = useRef<{ start: number; end: number } | null>(null);

  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  const set = <K extends keyof AwayValue>(k: K, x: AwayValue[K]) => {
    setV((o) => ({ ...o, [k]: x }));
    setFailed(false);
  };

  const longDate = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });
  const shortDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  const backBy = (end: string | null) => {
    if (!end) return null;
    const d = day(end);
    d.setDate(d.getDate() + 1);
    return d;
  };
  const backup = contacts.find((c) => c.id === v.backup) ?? null;

  const errs = {
    start: !v.start ? "Pick your first day away." : "",
    end: v.end !== null && (!v.end ? "Pick your last day, or tick No end date." : v.start && v.end < v.start ? "The last day can't be before the first." : "") || "",
    message: !v.message.trim() ? "Write the reply people get." : v.message.length > MAX ? `Shorten it by ${v.message.length - MAX} characters.` : "",
  };
  const show = (k: keyof typeof errs) => (tried && v.on ? errs[k] : "");

  const pill = (x: AwayValue) => {
    if (!x.on) return { tone: "neutral" as const, text: "Off" };
    const today = ymd(now);
    if (x.end && x.end < today) return { tone: "neutral" as const, text: "Ended" };
    if (x.start > today) return { tone: "info" as const, text: `Scheduled · ${shortDate.format(day(x.start))}` };
    return { tone: "success" as const, text: x.end ? `On until ${shortDate.format(day(x.end))}` : "On" };
  };
  const p = pill(saved);

  const insert = (text: string) => {
    const el = document.getElementById(`${id}-msg`) as HTMLTextAreaElement | null;
    const at = msgRef.current ?? { start: v.message.length, end: v.message.length };
    const before = v.message.slice(0, at.start);
    const glue = before && !/\s$/.test(before) ? " " : "";
    const next = before + glue + text + v.message.slice(at.end);
    set("message", next);
    const caret = at.start + glue.length + text.length;
    msgRef.current = { start: caret, end: caret };
    window.requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
    setStatus("Inserted.");
  };
  const remember = (el: HTMLTextAreaElement) => {
    msgRef.current = { start: el.selectionStart, end: el.selectionEnd };
  };

  const save = async () => {
    setTried(true);
    if (v.on) {
      const first = (["start", "end", "message"] as const).find((k) => errs[k]);
      if (first) {
        document.getElementById(`${id}-${first === "message" ? "msg" : first}`)?.focus();
        setStatus("Fix the highlighted fields to save.");
        return;
      }
    }
    setBusy(true);
    setFailed(false);
    setStatus("Saving…");
    try {
      await (onSave ? onSave(v) : wait(700));
      setSaved(v);
      setTried(false);
      const np = pill(v);
      setStatus(`${l.saved}. Automatic replies: ${np.text}.`);
    } catch {
      setFailed(true);
      setStatus("Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const filled = (text: string) => {
    const back = backBy(v.end);
    return text.replace(/\{return\}/g, back ? longDate.format(back) : "soon");
  };

  return (
    <section className="fl-ooo" aria-labelledby={`${id}-h`} data-fl="p.away-message">
      <header className="fl-ooo-head">
        <div>
          <h2 id={`${id}-h`}>{title}</h2>
          <p>Let people know you're away and when you'll be back.</p>
        </div>
        <Badge tone={p.tone} led>
          {p.text}
        </Badge>
      </header>

      <label className="fl-ooo-toggle">
        <Switch size={24} on={v.on} label="Send automatic replies" onToggle={(x) => set("on", x)} />
        <span aria-hidden="true">
          <strong>Send automatic replies</strong>
          <span>{v.on ? "People who write to you get the reply below." : "No one gets an automatic reply."}</span>
        </span>
      </label>

      <div className={v.on ? "fl-ooo-fold is-open" : "fl-ooo-fold"} inert={!v.on || undefined}>
        <div className="fl-ooo-clip">
          <div className="fl-ooo-body">
            <div className="fl-ooo-form">
              <fieldset className="fl-ooo-set">
                <legend>Dates</legend>
                <div className="fl-ooo-dates">
                  <div className="fl-ooo-field">
                    <label htmlFor={`${id}-start`}>First day</label>
                    <TextField id={`${id}-start`} type="date" size={40} value={v.start} invalid={Boolean(show("start"))} aria-describedby={show("start") ? `${id}-start-err` : undefined} onChange={(e) => set("start", e.currentTarget.value)} />
                    {show("start") ? (
                      <p id={`${id}-start-err`} className="fl-ooo-err">
                        {errs.start}
                      </p>
                    ) : null}
                  </div>
                  <div className="fl-ooo-field">
                    <label htmlFor={`${id}-end`}>Last day</label>
                    <TextField id={`${id}-end`} type="date" size={40} value={v.end ?? ""} min={v.start} disabled={v.end === null} invalid={Boolean(show("end"))} aria-describedby={show("end") ? `${id}-end-err` : undefined} onChange={(e) => set("end", e.currentTarget.value)} />
                    {show("end") ? (
                      <p id={`${id}-end-err`} className="fl-ooo-err">
                        {errs.end}
                      </p>
                    ) : null}
                  </div>
                </div>
                <Checkbox
                  size={16}
                  label="No end date"
                  checked={v.end === null}
                  onChange={(e) => {
                    const off = e.currentTarget.checked;
                    const d = day(v.start || ymd(now));
                    d.setDate(d.getDate() + 7);
                    set("end", off ? null : ymd(d));
                  }}
                />
              </fieldset>

              <fieldset className="fl-ooo-set">
                <legend>Who gets it</legend>
                <div className="fl-ooo-radios">
                  <Radio name={`${id}-aud`} label="Everyone" description="Anyone who emails you" checked={v.audience === "everyone"} onChange={() => set("audience", "everyone")} />
                  <Radio name={`${id}-aud`} label="My organization" description="Only people at your company" checked={v.audience === "org"} onChange={() => set("audience", "org")} />
                </div>
              </fieldset>

              <fieldset className="fl-ooo-set">
                <legend>Reply</legend>
                <div className="fl-ooo-field">
                  <label htmlFor={`${id}-subj`}>Subject</label>
                  <TextField id={`${id}-subj`} size={40} value={v.subject} maxLength={120} onChange={(e) => set("subject", e.currentTarget.value)} />
                </div>
                <div className="fl-ooo-field">
                  <div className="fl-ooo-labelrow">
                    <label htmlFor={`${id}-msg`}>Message</label>
                    <span className={v.message.length > MAX ? "fl-ooo-count is-over" : "fl-ooo-count"}>
                      {v.message.length}/{MAX}
                    </span>
                  </div>
                  <div className="fl-ooo-inserts" role="group" aria-label="Insert">
                    <button type="button" className="fl-ooo-chip" disabled={!v.end} onMouseDown={(e) => e.preventDefault()} onClick={() => insert("I'm back on {return}.")}>
                      <Icon name="calendar" />
                      Return date
                    </button>
                    <button type="button" className="fl-ooo-chip" disabled={!backup} onMouseDown={(e) => e.preventDefault()} onClick={() => backup && insert(`For anything urgent, contact ${backup.name} (${backup.email}).`)}>
                      <Icon name="user" />
                      Backup contact
                    </button>
                  </div>
                  <TextField
                    multiline
                    autoGrow
                    rows={5}
                    id={`${id}-msg`}
                    value={v.message}
                    invalid={Boolean(show("message"))}
                    aria-describedby={show("message") ? `${id}-msg-err` : `${id}-msg-hint`}
                    onChange={(e) => {
                      set("message", e.currentTarget.value);
                      remember(e.currentTarget);
                    }}
                    onSelect={(e) => remember(e.currentTarget)}
                    onKeyUp={(e) => remember(e.currentTarget)}
                    onClick={(e) => remember(e.currentTarget)}
                  />
                  {show("message") ? (
                    <p id={`${id}-msg-err`} className="fl-ooo-err">
                      {errs.message}
                    </p>
                  ) : (
                    <p id={`${id}-msg-hint`} className="fl-ooo-muted">
                      {"{return}"} becomes the day after your last day.
                    </p>
                  )}
                </div>
                <div className="fl-ooo-field">
                  <label htmlFor={`${id}-backup`}>Backup contact</label>
                  <span className="fl-ctl-select">
                    <select id={`${id}-backup`} className="fl-input fl-ctl-field fl-ctl-field--outlined fl-ctl-field--40" value={v.backup ?? ""} onChange={(e) => set("backup", e.currentTarget.value || null)}>
                      <option value="">No one</option>
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <Icon name="chevron-down" />
                  </span>
                </div>
              </fieldset>
              <Checkbox size={16} label="Decline new meetings" description="Invitations for days you're away get a polite no." checked={v.declineMeetings} onChange={(e) => set("declineMeetings", e.currentTarget.checked)} />
            </div>

            <aside className="fl-ooo-preview" aria-label="Preview of the reply">
              <p className="fl-ooo-label">Preview</p>
              <div className="fl-ooo-mail">
                <p className="fl-ooo-from">
                  <strong>{me.name}</strong> &lt;{me.email}&gt;
                </p>
                <p className="fl-ooo-subj">{v.subject.trim() || "Out of office"}</p>
                <div className="fl-ooo-text">
                  {filled(v.message.trim() || "Your message shows here.")
                    .split(/\n{2,}/)
                    .map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                </div>
              </div>
              <ul className="fl-ooo-facts" role="list">
                <li>
                  <Icon name="calendar" />
                  {v.start ? shortDate.format(day(v.start)) : "?"} – {v.end ? shortDate.format(day(v.end)) : "no end date"}
                </li>
                <li>
                  <Icon name="users" />
                  {v.audience === "everyone" ? "Everyone" : "Only your organization"}
                </li>
                {v.declineMeetings ? (
                  <li>
                    <Icon name="close" />
                    Declines new meetings
                  </li>
                ) : null}
              </ul>
            </aside>
          </div>
        </div>
      </div>

      {failed ? (
        <p className="fl-ooo-err fl-ooo-fail" role="alert">
          <Icon name="alert" />
          Couldn't save your automatic replies.
        </p>
      ) : null}

      <footer className="fl-ooo-foot">
        <span className="fl-ooo-muted">{dirty ? "Unsaved changes" : "All changes saved"}</span>
        <Button variant="tertiary" size={40} disabled={!dirty || busy} onClick={() => setAsking(true)}>
          {l.discard}
        </Button>
        <Button variant="primary" size={40} icon={failed ? "refresh" : "check"} busy={busy} disabled={!dirty && !failed} onClick={() => void save()}>
          {busy ? l.saving : failed ? l.retry : l.save}
        </Button>
      </footer>

      <p className="fl-sr" role="status" aria-live="polite">
        {status}
      </p>

      {asking ? (
        <Modal
          variant="danger"
          icon="trash"
          title="Discard your changes?"
          description="Your automatic replies go back to how they were last saved."
          confirmLabel={l.discard}
          cancelLabel="Keep editing"
          onConfirm={() => {
            setV(saved);
            setTried(false);
            setFailed(false);
            msgRef.current = null;
            setStatus("Changes discarded.");
          }}
          onClose={() => setAsking(false)}
        />
      ) : null}
    </section>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Automatic replies",
  me: { name: "Ana Ruiz", email: "ana@northlight.example" },
  now: new Date("2026-10-21T10:30:00"),
  contacts: [
    { id: "maya", name: "Maya Chen", email: "maya@northlight.example" },
    { id: "leo", name: "Leo Park", email: "leo@northlight.example" },
    { id: "marcus", name: "Marcus Bell", email: "marcus@northlight.example" },
  ],
  value: {
    on: false,
    start: "2026-10-24",
    end: "2026-10-31",
    audience: "everyone",
    subject: "Out of office until Nov 2",
    message: "Thanks for your email. I'm away with limited access to mail.\n\nI'll reply when I'm back.",
    backup: null,
    declineMeetings: true,
  } as AwayValue,
};

export default function AwayMessageSheet() {
  const tries = useRef(0);
  return (
    <section className="fl-section fl-section--canvas" aria-label="Away message">
      <div className="fl-wrap fl-wrap--narrow">
        <AwayMessage
          {...SAMPLE}
          onSave={async () => {
            await wait(800);
            tries.current += 1;
            // The first save fails, so the error and Retry can be seen.
            if (tries.current === 1) throw new Error("Network");
          }}
        />
      </div>
    </section>
  );
}
