/** @flowcode-library announcement-composer · Announcement composer (Forms)
 * Catalog ID: p.announcement-composer (pattern)
 * Function: Announcement composer (p.announcement-composer): write a team announcement (title and message with a character count, Normal or Important), pick who gets it (everyone, chosen teams, or people found by name and kept as removable chips) with a live reach count, choose where it shows (in-app banner, email, push), send now or schedule a future date and time, check a live preview, save a draft, confirm before it goes out, and cancel a scheduled one (confirmed first) from the list below.
 * Use it as: import { AnnouncementComposer } from "./announcement-composer"; <AnnouncementComposer title? everyone={128} teams={[{ id, label, count }]} people={[{ id, name, team? }]} sender={{ name }} now?={new Date()} history?={[{ id, title, audience, channels, at, state: "sent"|"scheduled" }]} publish?={async (announcement) => void} saveDraft?={async (draft) => void} onCancelScheduled?={(id) => ...} labels?={{ send, schedule, draft, ... }} />
 * Built from: c.text-field.outlined, c.segmented.segmented, c.checkbox, c.button.primary, c.button.secondary, c.button.tertiary, c.modal.confirm, c.modal.danger, c.badge.status, c.avatar.person
 * Look: A white card in two columns: the form on the left in labeled groups (Message, Audience, Where it shows, When) and, on the right, a sunken Preview panel with the announcement as people will see it: a banner with an icon, the title and the message, tinted warm when Important, with the sender and the reach under it. The audience switch reveals team check boxes with counts or a name search with chips; Later reveals a date and a time. A footer holds Save draft and Send or Schedule; a list of sent and scheduled announcements with status pills closes the card.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-warning --color-success --color-danger --space-1 --space-2 --space-3 --space-4 --space-5 --radius-sm --radius-md --radius-lg --text-xs --text-sm --text-base --text-lg --weight-medium --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger
 * Use cases: company announcements; team broadcast; admin messaging; school notices; community updates; release notes to users; HR communications; in-app announcements
 * Jobs to be done: tell the whole company about a change; send an update to just two teams; schedule an announcement for Monday morning; see how it will look before sending; cancel a scheduled announcement
 * Keywords: announcement, broadcast, audience, schedule, compose, notify, banner, email, push, teams, recipients, preview
 */
/**
 * Announcement composer: a form for one announcement and a live preview of it. The audience is everyone, some teams,
 * or some people (a combobox: type a name, Up and Down, Enter adds a chip, Backspace in an empty box removes the last
 * one). At least one channel is needed, and a scheduled time must be in the future. Send or Schedule checks the form,
 * says what is wrong under each field and focuses the first problem, then asks for confirmation before calling
 * `publish`. Make it the app's own: pass the organization's teams and people, deliver in `publish`, and keep the list
 * through `history` and onCancelScheduled.
 * Adapted from HyperUI (MIT, Copyright (c) Mark Mead): its marketing announcement banners (the preview) and textarea
 * with actions.
 */
/**
 * How to try it
 * - Press Send now with the form empty: each problem shows under its field and focus goes to the title.
 * - Type a title and a message: the preview fills in; pick Important and it turns warm.
 * - Switch Audience to Teams and tick Design and Sales: the reach adds up. Switch to People, type "le", press Enter.
 * - Pick Later and choose yesterday: it asks for a future time. Pick tomorrow, then Schedule and confirm.
 * - In the list below, press Cancel on a scheduled announcement and confirm: it goes back to Draft.
 *
 * Dependencies: React (useId, useMemo, useState), the library's TextField, Segmented, Checkbox, Button, Modal, Badge and
 * Avatar ("./text-fields-states", "./segmented-control", "./checkboxes-radios", "./buttons-variants",
 * "./modals-dialogs", "./badges-status", "./avatars-variants") and its inline icon set ("./icons"). Nothing else: no
 * package and nothing fetched. The styles are the library's own fl- classes in
 * templates/library/css/r4a-announcement-composer.css.
 */
import { useId, useMemo, useState, type CSSProperties } from "react";
import { Avatar } from "./avatars-variants";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Checkbox } from "./checkboxes-radios";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { Segmented } from "./segmented-control";
import { TextField } from "./text-fields-states";

// ── p.announcement-composer: message, audience, channels and schedule, with a live preview. ──

export type AnnTeam = { id: string; label: string; count: number };
export type AnnPerson = { id: string; name: string; team?: string };
export type AnnChannel = "banner" | "email" | "push";
export type Announcement = {
  id: string;
  title: string;
  body: string;
  important: boolean;
  audience: { kind: "everyone" | "teams" | "people"; ids: string[]; label: string; reach: number };
  channels: AnnChannel[];
  /** ISO time it went out or will go out. */
  at: string;
  state: "sent" | "scheduled" | "draft";
};

export type AnnouncementComposerLabels = Partial<{ send: string; schedule: string; draft: string; sending: string; cancel: string }>;

export type AnnouncementComposerProps = {
  title?: string;
  /** How many people "Everyone" reaches. */
  everyone: number;
  teams: AnnTeam[];
  people: AnnPerson[];
  sender: { name: string };
  /** "Now" for scheduling checks and defaults; the real time when left out. */
  now?: Date;
  history?: Announcement[];
  /** Sends or schedules; throw to show an error. Waits a moment when left out. */
  publish?: (a: Announcement) => Promise<void>;
  saveDraft?: (a: Announcement) => Promise<void>;
  onCancelScheduled?: (id: string) => void;
  labels?: AnnouncementComposerLabels;
};

const TITLE_MAX = 80;
const BODY_MAX = 600;
const CHANNELS: Array<{ id: AnnChannel; label: string; text: string }> = [
  { id: "banner", label: "In-app banner", text: "At the top of the app until dismissed" },
  { id: "email", label: "Email", text: "To each person's work address" },
  { id: "push", label: "Push notification", text: "On phones with the app installed" },
];
const wait = (t: number) => new Promise<void>((r) => window.setTimeout(r, t));
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

type Errors = Partial<Record<"title" | "body" | "audience" | "channels" | "when", string>>;

export function AnnouncementComposer({ title: heading = "New announcement", everyone, teams, people, sender, now: nowProp, history = [], publish, saveDraft, onCancelScheduled, labels = {} }: AnnouncementComposerProps) {
  const l = { send: "Send now", schedule: "Schedule", draft: "Save draft", sending: "Sending…", cancel: "Cancel", ...labels };
  const id = useId();
  const now = useMemo(() => nowProp ?? new Date(), [nowProp]);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [important, setImportant] = useState(false);
  const [kind, setKind] = useState<Announcement["audience"]["kind"]>("everyone");
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [personIds, setPersonIds] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [channels, setChannels] = useState<AnnChannel[]>(["banner", "email"]);
  const [timing, setTiming] = useState<"now" | "later">("now");
  const [date, setDate] = useState(ymd(tomorrow));
  const [time, setTime] = useState("09:00");
  const [tried, setTried] = useState(false);
  const [confirm, setConfirm] = useState<Announcement | null>(null);
  const [busy, setBusy] = useState<"publish" | "draft" | null>(null);
  const [failure, setFailure] = useState("");
  const [list, setList] = useState(history);
  const [cancelling, setCancelling] = useState<Announcement | null>(null);
  const [status, setStatus] = useState("");

  const reach = kind === "everyone" ? everyone : kind === "teams" ? teams.filter((t) => teamIds.includes(t.id)).reduce((s, t) => s + t.count, 0) : personIds.length;
  const audienceLabel =
    kind === "everyone" ? "Everyone" : kind === "teams" ? teams.filter((t) => teamIds.includes(t.id)).map((t) => t.label).join(", ") || "No teams yet" : people.filter((p) => personIds.includes(p.id)).map((p) => p.name).join(", ") || "No one yet";
  const when = timing === "now" ? null : new Date(`${date}T${time || "00:00"}`);
  const fmt = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return people.filter((p) => !personIds.includes(p.id) && p.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(s))).slice(0, 6);
  }, [q, people, personIds]);
  const listOpen = matches.length > 0;

  const check = (): Errors => {
    const e: Errors = {};
    if (!title.trim()) e.title = "Add a title.";
    else if (title.length > TITLE_MAX) e.title = `Keep the title under ${TITLE_MAX} characters.`;
    if (!body.trim()) e.body = "Write the message.";
    else if (body.length > BODY_MAX) e.body = `Shorten the message by ${body.length - BODY_MAX} characters.`;
    if (kind !== "everyone" && reach === 0) e.audience = kind === "teams" ? "Pick at least one team." : "Add at least one person.";
    if (!channels.length) e.channels = "Pick at least one place to show it.";
    if (timing === "later") {
      if (!date || !time || Number.isNaN(when?.getTime())) e.when = "Pick a date and a time.";
      else if (when && when.getTime() <= now.getTime()) e.when = "Pick a time in the future.";
    }
    return e;
  };
  const live: Errors = tried ? check() : {};

  const build = (state: Announcement["state"]): Announcement => ({
    id: `${id}-${Date.now()}`,
    title: title.trim(),
    body: body.trim(),
    important,
    audience: { kind, ids: kind === "teams" ? teamIds : kind === "people" ? personIds : [], label: audienceLabel, reach },
    channels,
    at: (when ?? now).toISOString(),
    state,
  });

  const submit = () => {
    setTried(true);
    const e = check();
    const first = (["title", "body", "audience", "channels", "when"] as const).find((k) => e[k]);
    if (first) {
      const target = { title: `${id}-title`, body: `${id}-body`, audience: kind === "people" ? `${id}-people` : `${id}-aud`, channels: `${id}-ch-banner`, when: `${id}-date` }[first];
      const el = document.getElementById(target);
      (el?.querySelector<HTMLElement>("input") ?? el)?.focus();
      setStatus(`${Object.keys(e).length === 1 ? "1 thing" : `${Object.keys(e).length} things`} to fix before sending.`);
      return;
    }
    setFailure("");
    setConfirm(build(timing === "now" ? "sent" : "scheduled"));
  };

  const reset = () => {
    setTitle("");
    setBody("");
    setImportant(false);
    setKind("everyone");
    setTeamIds([]);
    setPersonIds([]);
    setTiming("now");
    setTried(false);
  };

  const doPublish = async (a: Announcement) => {
    setBusy("publish");
    setStatus(a.state === "sent" ? "Sending…" : "Scheduling…");
    try {
      await (publish ? publish(a) : wait(900));
      setList((xs) => [a, ...xs]);
      reset();
      setStatus(a.state === "sent" ? `Sent to ${a.audience.reach} people.` : `Scheduled for ${fmt.format(new Date(a.at))}.`);
      window.setTimeout(() => document.getElementById(`${id}-title`)?.focus(), 30);
    } catch {
      setFailure("Couldn't send the announcement. Nothing went out; try again.");
      setStatus("Couldn't send.");
    } finally {
      setBusy(null);
    }
  };

  const doDraft = async () => {
    if (!title.trim() && !body.trim()) {
      setStatus("Write something before saving a draft.");
      document.getElementById(`${id}-title`)?.focus();
      return;
    }
    setBusy("draft");
    try {
      const a = build("draft");
      await (saveDraft ? saveDraft(a) : wait(500));
      setList((xs) => [a, ...xs.filter((x) => !(x.state === "draft" && x.title === a.title))]);
      setStatus("Draft saved.");
    } catch {
      setStatus("Couldn't save the draft.");
    } finally {
      setBusy(null);
    }
  };

  const addPerson = (p: AnnPerson) => {
    setPersonIds((xs) => [...xs, p.id]);
    setQ("");
    setActive(0);
    setStatus(`${p.name} added.`);
  };

  // Problems show once Send has been pressed, and clear as each one is fixed.
  const shownErr = (k: keyof Errors) => live[k];

  return (
    <section className="fl-anc" aria-labelledby={`${id}-h`} data-fl="p.announcement-composer">
      <div className="fl-anc-grid">
      <form
        className="fl-anc-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <h2 id={`${id}-h`} className="fl-anc-h">
          {heading}
        </h2>

        <fieldset className="fl-anc-group">
          <legend>Message</legend>
          <div className="fl-anc-field">
            <div className="fl-anc-labelrow">
              <label htmlFor={`${id}-title`}>Title</label>
              <span className={title.length > TITLE_MAX ? "fl-anc-count is-over" : "fl-anc-count"}>
                {title.length}/{TITLE_MAX}
              </span>
            </div>
            <TextField id={`${id}-title`} size={40} value={title} invalid={Boolean(shownErr("title"))} aria-describedby={shownErr("title") ? `${id}-title-err` : undefined} placeholder="Office closed on Friday" onChange={(e) => setTitle(e.currentTarget.value)} />
            {shownErr("title") ? (
              <p id={`${id}-title-err`} className="fl-anc-err">
                {live.title}
              </p>
            ) : null}
          </div>
          <div className="fl-anc-field">
            <div className="fl-anc-labelrow">
              <label htmlFor={`${id}-body`}>Message</label>
              <span className={body.length > BODY_MAX ? "fl-anc-count is-over" : "fl-anc-count"} aria-live="polite">
                {body.length}/{BODY_MAX}
              </span>
            </div>
            <TextField multiline autoGrow rows={4} id={`${id}-body`} value={body} invalid={Boolean(shownErr("body"))} aria-describedby={shownErr("body") ? `${id}-body-err` : undefined} onChange={(e) => setBody(e.currentTarget.value)} />
            {shownErr("body") ? (
              <p id={`${id}-body-err`} className="fl-anc-err">
                {live.body}
              </p>
            ) : null}
          </div>
          <Segmented size="sm" label="Importance" value={important ? "important" : "normal"} onChange={(v) => setImportant(v === "important")} options={[{ value: "normal", label: "Normal" }, { value: "important", label: "Important" }]} />
        </fieldset>

        <fieldset className="fl-anc-group">
          <legend>Audience</legend>
          <div id={`${id}-aud`}>
            <Segmented
              size="sm"
              label="Audience"
              value={kind}
              onChange={(v) => setKind(v as Announcement["audience"]["kind"])}
              options={[
                { value: "everyone", label: "Everyone" },
                { value: "teams", label: "Teams" },
                { value: "people", label: "People" },
              ]}
            />
          </div>
          {kind === "teams" ? (
            <ul className="fl-anc-teams" role="list" aria-label="Teams">
              {teams.map((t, i) => (
                <li key={t.id} style={{ "--i": i } as CSSProperties}>
                  <Checkbox
                    label={t.label}
                    description={`${t.count} people`}
                    checked={teamIds.includes(t.id)}
                    onChange={() => setTeamIds((xs) => (xs.includes(t.id) ? xs.filter((x) => x !== t.id) : [...xs, t.id]))}
                  />
                </li>
              ))}
            </ul>
          ) : null}
          {kind === "people" ? (
            <div className="fl-anc-people">
              <label htmlFor={`${id}-people`} className="fl-sr">
                Add people
              </label>
              <div className="fl-anc-chips">
                {people
                  .filter((p) => personIds.includes(p.id))
                  .map((p) => (
                    <span key={p.id} className="fl-anc-chip">
                      <Avatar name={p.name} size={20} tone="b" decorative />
                      {p.name}
                      <button
                        type="button"
                        aria-label={`Remove ${p.name}`}
                        onClick={() => {
                          setPersonIds((xs) => xs.filter((x) => x !== p.id));
                          setStatus(`${p.name} removed.`);
                          document.getElementById(`${id}-people`)?.focus();
                        }}
                      >
                        <Icon name="close" />
                      </button>
                    </span>
                  ))}
                <input
                  id={`${id}-people`}
                  className="fl-anc-pinput"
                  value={q}
                  placeholder={personIds.length ? "Add more…" : "Type a name"}
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={listOpen}
                  aria-controls={`${id}-plist`}
                  aria-activedescendant={listOpen ? `${id}-p-${matches[active]?.id}` : undefined}
                  aria-invalid={Boolean(shownErr("audience")) || undefined}
                  aria-describedby={shownErr("audience") ? `${id}-aud-err` : undefined}
                  autoComplete="off"
                  onChange={(e) => {
                    setQ(e.currentTarget.value);
                    setActive(0);
                  }}
                  onKeyDown={(e) => {
                    if (listOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                      e.preventDefault();
                      setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length);
                    } else if (listOpen && e.key === "Enter") {
                      e.preventDefault();
                      addPerson(matches[active]!);
                    } else if (e.key === "Escape" && q) {
                      e.preventDefault();
                      setQ("");
                    } else if (e.key === "Backspace" && !q && personIds.length) {
                      const last = people.find((p) => p.id === personIds[personIds.length - 1]);
                      setPersonIds((xs) => xs.slice(0, -1));
                      if (last) setStatus(`${last.name} removed.`);
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                    }
                  }}
                />
              </div>
              <ul id={`${id}-plist`} role="listbox" aria-label="People" className="fl-anc-plist" hidden={!listOpen}>
                {matches.map((p, i) => (
                  <li
                    key={p.id}
                    id={`${id}-p-${p.id}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addPerson(p);
                    }}
                    onMouseEnter={() => setActive(i)}
                  >
                    <Avatar name={p.name} size={24} tone="b" decorative />
                    <span>{p.name}</span>
                    {p.team ? <span className="fl-anc-muted">{p.team}</span> : null}
                  </li>
                ))}
              </ul>
              {q.trim() && !listOpen ? <p className="fl-anc-muted">No one by that name.</p> : null}
            </div>
          ) : null}
          {shownErr("audience") ? (
            <p id={`${id}-aud-err`} className="fl-anc-err">
              {live.audience}
            </p>
          ) : null}
          <p className="fl-anc-reach" aria-live="polite">
            <Icon name="users" />
            Reaches <strong>{reach}</strong> {reach === 1 ? "person" : "people"}
          </p>
        </fieldset>

        <fieldset className="fl-anc-group" aria-describedby={shownErr("channels") ? `${id}-ch-err` : undefined}>
          <legend>Where it shows</legend>
          <div className="fl-anc-channels">
            {CHANNELS.map((c) => (
              <Checkbox key={c.id} id={`${id}-ch-${c.id}`} label={c.label} description={c.text} checked={channels.includes(c.id)} onChange={() => setChannels((xs) => (xs.includes(c.id) ? xs.filter((x) => x !== c.id) : [...xs, c.id]))} />
            ))}
          </div>
          {shownErr("channels") ? (
            <p id={`${id}-ch-err`} className="fl-anc-err">
              {live.channels}
            </p>
          ) : null}
        </fieldset>

        <fieldset className="fl-anc-group">
          <legend>When</legend>
          <Segmented size="sm" label="When" value={timing} onChange={(v) => setTiming(v as "now" | "later")} options={[{ value: "now", label: "Send now" }, { value: "later", label: "Later" }]} />
          <div className={timing === "later" ? "fl-anc-fold is-open" : "fl-anc-fold"} inert={timing !== "later" || undefined}>
            <div className="fl-anc-clip">
              <div className="fl-anc-when">
                <div className="fl-anc-field">
                  <label htmlFor={`${id}-date`}>Date</label>
                  <TextField id={`${id}-date`} type="date" size={40} min={ymd(now)} value={date} invalid={Boolean(shownErr("when"))} aria-describedby={shownErr("when") ? `${id}-when-err` : `${id}-tz`} onChange={(e) => setDate(e.currentTarget.value)} />
                </div>
                <div className="fl-anc-field">
                  <label htmlFor={`${id}-time`}>Time</label>
                  <TextField id={`${id}-time`} type="time" size={40} step={900} value={time} invalid={Boolean(shownErr("when"))} aria-describedby={shownErr("when") ? `${id}-when-err` : `${id}-tz`} onChange={(e) => setTime(e.currentTarget.value)} />
                </div>
              </div>
              {shownErr("when") ? (
                <p id={`${id}-when-err`} className="fl-anc-err">
                  {live.when}
                </p>
              ) : (
                <p id={`${id}-tz`} className="fl-anc-muted">
                  Your time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, " ")}
                </p>
              )}
            </div>
          </div>
        </fieldset>

        {failure ? (
          <p className="fl-anc-err fl-anc-fail" role="alert">
            <Icon name="alert" />
            {failure}
          </p>
        ) : null}

        <div className="fl-anc-actions">
          <Button variant="secondary" size={40} busy={busy === "draft"} disabled={busy === "publish"} onClick={() => void doDraft()}>
            {l.draft}
          </Button>
          <Button type="submit" variant="primary" size={40} icon={timing === "now" ? "send" : "calendar"} busy={busy === "publish"} disabled={busy === "draft"}>
            {busy === "publish" ? l.sending : timing === "now" ? l.send : l.schedule}
          </Button>
        </div>
      </form>

      <aside className="fl-anc-side" aria-label="Preview">
        <p className="fl-anc-label">Preview</p>
        <div className={important ? "fl-anc-preview is-important" : "fl-anc-preview"}>
          <span className="fl-anc-picon" aria-hidden="true">
            <Icon name={important ? "alert" : "bell"} />
          </span>
          <div className="fl-anc-pcopy">
            {important ? <span className="fl-anc-ptag">Important</span> : null}
            <p className="fl-anc-ptitle">{title.trim() || "Your title"}</p>
            <p className="fl-anc-pbody">{body.trim() || "Your message shows here."}</p>
          </div>
        </div>
        <dl className="fl-anc-facts">
          <div>
            <dt>From</dt>
            <dd>{sender.name}</dd>
          </div>
          <div>
            <dt>To</dt>
            <dd>
              {audienceLabel} · {reach}
            </dd>
          </div>
          <div>
            <dt>Shows as</dt>
            <dd>{channels.map((c) => CHANNELS.find((x) => x.id === c)?.label).join(", ") || "Nowhere yet"}</dd>
          </div>
          <div>
            <dt>Goes out</dt>
            <dd>{timing === "now" ? "Right away" : when && !Number.isNaN(when.getTime()) ? fmt.format(when) : "Pick a time"}</dd>
          </div>
        </dl>
      </aside>

      <div className="fl-anc-history">
        <h3 className="fl-anc-label" id={`${id}-hist`} tabIndex={-1}>
          Recent
        </h3>
        {list.length ? (
          <ul role="list" aria-labelledby={`${id}-hist`}>
            {list.map((a) => (
              <li key={a.id} className="fl-anc-item">
                <div className="fl-anc-itemcopy">
                  <p className="fl-anc-ititle">{a.title || "Untitled"}</p>
                  <p className="fl-anc-muted">
                    {a.audience.label} · {a.state === "draft" ? "Not sent" : fmt.format(new Date(a.at))}
                  </p>
                </div>
                <Badge tone={a.state === "sent" ? "success" : a.state === "scheduled" ? "info" : "neutral"} led>
                  {a.state === "sent" ? "Sent" : a.state === "scheduled" ? "Scheduled" : "Draft"}
                </Badge>
                {a.state === "scheduled" ? (
                  <Button id={`${id}-cancel-${a.id}`} variant="tertiary" size={32} aria-label={`Cancel ${a.title}`} onClick={() => setCancelling(a)}>
                    {l.cancel}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="fl-anc-muted">Announcements you send show up here.</p>
        )}
      </div>
      </div>

      <p className="fl-sr" role="status" aria-live="polite">
        {status}
      </p>

      {confirm ? (
        <Modal
          variant="confirm"
          icon={confirm.state === "sent" ? "send" : "calendar"}
          title={confirm.state === "sent" ? `Send to ${confirm.audience.reach} ${confirm.audience.reach === 1 ? "person" : "people"} now?` : `Schedule for ${fmt.format(new Date(confirm.at))}?`}
          description={`"${confirm.title}" goes to ${confirm.audience.label} by ${confirm.channels.map((c) => CHANNELS.find((x) => x.id === c)?.label.toLowerCase()).join(", ")}.${confirm.state === "sent" ? " It can't be unsent." : ""}`}
          confirmLabel={confirm.state === "sent" ? l.send : l.schedule}
          onConfirm={() => {
            void doPublish(confirm);
          }}
          onClose={() => setConfirm(null)}
        />
      ) : null}
      {cancelling ? (
        <Modal
          variant="danger"
          icon="calendar"
          title={`Cancel "${cancelling.title}"?`}
          description="It won't go out. It stays in the list as a draft."
          confirmLabel="Cancel announcement"
          cancelLabel="Keep it"
          onConfirm={() => {
            const a = cancelling;
            setList((xs) => xs.map((x) => (x.id === a.id ? { ...x, state: "draft" } : x)));
            onCancelScheduled?.(a.id);
            setStatus(`"${a.title}" cancelled.`);
            // Its Cancel button is gone; focus waits on the list's heading.
            window.setTimeout(() => document.getElementById(`${id}-hist`)?.focus(), 30);
          }}
          onClose={() => setCancelling(null)}
        />
      ) : null}
    </section>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "New announcement",
  everyone: 128,
  sender: { name: "Ana Ruiz, People team" },
  now: new Date("2026-10-21T10:30:00"),
  teams: [
    { id: "design", label: "Design", count: 14 },
    { id: "engineering", label: "Engineering", count: 42 },
    { id: "sales", label: "Sales", count: 23 },
    { id: "support", label: "Support", count: 18 },
  ],
  people: [
    { id: "p1", name: "Leo Park", team: "Design" },
    { id: "p2", name: "Leah Brooks", team: "Sales" },
    { id: "p3", name: "Maya Chen", team: "Design" },
    { id: "p4", name: "Marcus Bell", team: "Engineering" },
    { id: "p5", name: "Sam Okafor", team: "Support" },
    { id: "p6", name: "Priya Nair", team: "Engineering" },
  ],
  history: [
    { id: "h1", title: "Open enrollment starts Nov 1", body: "", important: false, audience: { kind: "everyone", ids: [], label: "Everyone", reach: 128 }, channels: ["banner", "email"], at: "2026-10-28T09:00:00", state: "scheduled" },
    { id: "h2", title: "New expense tool is live", body: "", important: false, audience: { kind: "teams", ids: ["sales"], label: "Sales", reach: 23 }, channels: ["email"], at: "2026-10-17T14:00:00", state: "sent" },
  ] as Announcement[],
};

export default function AnnouncementComposerSheet() {
  return (
    <section className="fl-section fl-section--canvas" aria-label="Announcement composer">
      <div className="fl-wrap">
        <AnnouncementComposer {...SAMPLE} />
      </div>
    </section>
  );
}
