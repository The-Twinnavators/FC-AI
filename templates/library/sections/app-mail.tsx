/** @flowcode-library app-mail · Mail client (App screens)
 * Catalog ID: t.app-mail (template)
 * Function: Mail client (t.app-mail): folders with unread counts, a searchable message list with select-all, star, archive, snooze (later today, tomorrow, next week), mark read or unread and move to Trash, a reading pane with attachments, and a reply or forward composer that checks the address, attaches files (up to 10 MB each), sends with a working state and lands the message in Sent. Archive and Trash offer Undo; Delete forever asks first.
 * Use it as: import { MailClient } from "./app-mail"; <MailClient title? me={{ name, email }} mails={[{ id, folder: "inbox"|"snoozed"|"sent"|"drafts"|"archive"|"trash", from: { name, email }, to: ["you@x.com"], subject, body, at: "2026-10-21T09:12", unread?, starred?, attachments?: [{ name, size }], snoozeUntil? }]} now?={new Date()} loadFolder?={async (folder) => void} send?={async (mail) => void} onChange?={(mails) => ...} labels?={{ search, archive, snooze, ... }} />
 * Built from: c.checkbox, c.text-field.outlined, c.button.primary, c.button.secondary, c.button.tertiary, c.context-menu, c.modal.danger, c.empty-state.no-results, c.empty-state.done, c.skeleton
 * Look: A white card in three columns: a folder rail (an icon, the folder's name and an unread count; the open folder tinted with a straight accent bar), the message list (a toolbar with a select-all box, Archive, Snooze, Read and Trash, a search box, then rows with a check box, a star, the sender in bold while unread, the subject with a muted snippet, a clip for attachments and the date) and the reading pane (subject, sender with avatar and time, the body, attachment tiles, Reply and Forward). The composer slides open under the message. On a phone one column shows at a time, with a folder dropdown and a Back button.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-warning --color-danger --color-success --space-1 --space-2 --space-3 --space-4 --space-5 --radius-sm --radius-md --radius-lg --text-xs --text-sm --text-base --text-lg --weight-medium --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --easing --enter-distance --stagger
 * Use cases: email client; webmail; shared mailbox; inbox screen; CRM email tab; messaging app; customer email; internal mail
 * Jobs to be done: clear my inbox by archiving what's done; snooze a message until I can deal with it; find a message by sender or subject; reply with an attachment; get back a message I archived by mistake
 * Keywords: email, mail, inbox, folders, archive, snooze, star, reply, forward, attachments, unread, compose, webmail
 */
/**
 * Mail client: folders, a message list and a reading pane. Opening a message marks it read. Select rows (or use the box
 * at the top for all of them) and act on them together: archive, snooze, mark read or unread, or move them to Trash;
 * Archive and Trash show Undo in the bar below. In Trash, Delete forever asks first. Snoozed messages wait in Snoozed
 * with the time they come back. Reply and Forward open a composer under the message: Forward checks the address, files
 * over 10 MB are refused, Send shows a working state and an error if it fails, and the sent message shows in Sent.
 * Make it the app's own: load the account's mail into `mails`, fetch a folder in `loadFolder`, deliver through `send`,
 * and save flags, moves and snoozes through onChange.
 * Adapted from HyperUI (MIT, Copyright (c) Mark Mead): the queue rail, ticket list and reading pane of its support
 * inbox template.
 */
/**
 * How to try it
 * - Open the first message: it turns read. Press Reply, attach a file, write a line and Send: it shows in Sent.
 * - Tick two rows and press Archive: they leave the inbox and Undo brings them back.
 * - Press Snooze on a message and pick Tomorrow: it moves to Snoozed with the time it returns.
 * - Type "invoice" in the search box; type "zzz" for the empty state with Clear search.
 * - Move a message to Trash, open Trash and press Delete forever: a dialog asks first.
 * - Forward a message to "maya@": the address is flagged until it is complete. Narrow the window: one column at a time.
 *
 * Dependencies: React (useEffect, useId, useMemo, useRef, useState), the library's Button, Checkbox, TextField, Modal,
 * EmptyState, Avatar and MenuPanel ("./buttons-variants", "./checkboxes-radios", "./text-fields-states",
 * "./modals-dialogs", "./empty-states", "./avatars-variants", "./context-menu") and its inline icon set ("./icons").
 * Nothing else: no package and nothing fetched. The styles are the library's own fl- classes in
 * templates/library/css/r4a-mail.css.
 */
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { Avatar } from "./avatars-variants";
import { Button } from "./buttons-variants";
import { Checkbox } from "./checkboxes-radios";
import { MenuPanel, type MenuEntry } from "./context-menu";
import { EmptyState } from "./empty-states";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { TextField } from "./text-fields-states";

// ── t.app-mail: folders, a message list with bulk actions and snooze, a reading pane and a reply composer. ──

export type MailFolder = "inbox" | "snoozed" | "sent" | "drafts" | "archive" | "trash";
export type MailAttachment = { name: string; size: number };
export type Mail = {
  id: string;
  folder: MailFolder;
  from: { name: string; email: string };
  to: string[];
  subject: string;
  /** Paragraphs split by a blank line. */
  body: string;
  at: string;
  unread?: boolean;
  starred?: boolean;
  attachments?: MailAttachment[];
  /** When a snoozed message comes back (ISO). */
  snoozeUntil?: string;
};

export type MailClientLabels = Partial<{
  search: string;
  archive: string;
  snooze: string;
  read: string;
  unread: string;
  trash: string;
  restore: string;
  deleteForever: string;
  reply: string;
  forward: string;
  send: string;
  sending: string;
  discard: string;
  attach: string;
  back: string;
  undo: string;
  pick: string;
}>;

export type MailClientProps = {
  title?: string;
  me: { name: string; email: string };
  mails: Mail[];
  /** "Now" for dates and snooze times; the real time when left out. */
  now?: Date;
  /** Fetches a folder; the list shows a loading state until it resolves and an error with Retry if it throws. */
  loadFolder?: (folder: MailFolder | "starred") => Promise<void>;
  /** Delivers a reply or forward; throw to show the error. Waits a moment when left out. */
  send?: (mail: Mail) => Promise<void>;
  onChange?: (mails: Mail[]) => void;
  labels?: MailClientLabels;
};

const FOLDERS: Array<{ id: MailFolder | "starred"; label: string; icon: string }> = [
  { id: "inbox", label: "Inbox", icon: "inbox" },
  { id: "starred", label: "Starred", icon: "star" },
  { id: "snoozed", label: "Snoozed", icon: "clock" },
  { id: "sent", label: "Sent", icon: "send" },
  { id: "drafts", label: "Drafts", icon: "pencil" },
  { id: "archive", label: "Archive", icon: "archive" },
  { id: "trash", label: "Trash", icon: "trash" },
];
const MAX_FILE = 10 * 1024 * 1024;
const wait = (t: number) => new Promise<void>((r) => window.setTimeout(r, t));
const size = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// The inbox glyph the shared icon set lacks, drawn the same way.
function FolderIcon({ name }: { name: string }) {
  if (name !== "inbox") return <Icon name={name} />;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6H3v-6z" />
    </svg>
  );
}

type Draft = { mode: "reply" | "forward"; of: string; to: string; body: string; files: MailAttachment[]; error?: string; touched?: boolean };

export function MailClient({ title = "Mail", me, mails, now: nowProp, loadFolder, send, onChange, labels = {} }: MailClientProps) {
  const l = {
    search: "Search mail",
    archive: "Archive",
    snooze: "Snooze",
    read: "Mark read",
    unread: "Mark unread",
    trash: "Move to Trash",
    restore: "Move to Inbox",
    deleteForever: "Delete forever",
    reply: "Reply",
    forward: "Forward",
    send: "Send",
    sending: "Sending…",
    discard: "Discard",
    attach: "Attach",
    back: "Back",
    undo: "Undo",
    pick: "Select",
    ...labels,
  };
  const id = useId();
  const now = useMemo(() => nowProp ?? new Date(), [nowProp]);
  const [list, setList] = useState(mails);
  const [folder, setFolder] = useState<MailFolder | "starred">("inbox");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [load, setLoad] = useState<"idle" | "loading" | "error">("idle");
  const [snoozeFor, setSnoozeFor] = useState<{ ids: string[]; from: string } | null>(null);
  const [undo, setUndo] = useState<{ text: string; before: Mail[] } | null>(null);
  const [forever, setForever] = useState<string[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const counter = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const commit = (next: Mail[]) => {
    setList(next);
    onChange?.(next);
  };
  const patch = (ids: string[], fn: (m: Mail) => Mail) => commit(list.map((m) => (ids.includes(m.id) ? fn(m) : m)));

  const inFolder = (m: Mail, f: MailFolder | "starred") => (f === "starred" ? m.starred && m.folder !== "trash" : m.folder === f);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list
      .filter((m) => inFolder(m, folder) && (!q || `${m.from.name} ${m.from.email} ${m.subject} ${m.body}`.toLowerCase().includes(q)))
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [list, folder, query]);
  const open = list.find((m) => m.id === openId) ?? null;
  const unreadIn = (f: MailFolder | "starred") => list.filter((m) => inFolder(m, f) && m.unread).length;
  const visiblePicked = picked.filter((p) => shown.some((m) => m.id === p));
  const all = shown.length > 0 && visiblePicked.length === shown.length;

  const day = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  const full = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const short = (iso: string) => {
    const d = new Date(iso);
    return d.toDateString() === now.toDateString() ? time.format(d) : day.format(d);
  };

  const goFolder = async (f: MailFolder | "starred") => {
    setFolder(f);
    setPicked([]);
    setOpenId(null);
    setDraft(null);
    setQuery("");
    const name = FOLDERS.find((x) => x.id === f)?.label ?? f;
    if (!loadFolder) {
      setStatus(`${name}.`);
      return;
    }
    setLoad("loading");
    try {
      await loadFolder(f);
      setLoad("idle");
      setStatus(`${name} loaded.`);
    } catch {
      setLoad("error");
      setStatus(`Couldn't load ${name}.`);
    }
  };

  const openMail = (m: Mail) => {
    setOpenId(m.id);
    setDraft(null);
    if (m.unread) patch([m.id], (x) => ({ ...x, unread: false }));
    window.setTimeout(() => document.getElementById(`${id}-subject`)?.focus(), 30);
  };
  const backToList = () => {
    const from = openId;
    setOpenId(null);
    setDraft(null);
    window.setTimeout(() => (document.getElementById(`${id}-row-${from}`) ?? document.getElementById(`${id}-q`))?.focus(), 30);
  };

  const move = (ids: string[], to: MailFolder, verb: string) => {
    if (!ids.length) return;
    const before = list;
    commit(list.map((m) => (ids.includes(m.id) ? { ...m, folder: to, snoozeUntil: undefined } : m)));
    setPicked((p) => p.filter((x) => !ids.includes(x)));
    if (openId && ids.includes(openId)) setOpenId(null);
    const text = `${ids.length === 1 ? "1 message" : `${ids.length} messages`} ${verb}.`;
    setUndo({ text, before });
    setStatus(text);
  };
  const markRead = (ids: string[], unread: boolean) => {
    patch(ids, (m) => ({ ...m, unread }));
    setStatus(`${ids.length === 1 ? "1 message" : `${ids.length} messages`} marked ${unread ? "unread" : "read"}.`);
  };

  // Snooze choices, worked out from "now".
  const at = (days: number, hour: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d;
  };
  const nextMonday = () => {
    const add = ((8 - now.getDay()) % 7) || 7;
    return at(add, 8);
  };
  const later = now.getHours() < 17 ? at(0, 18) : at(1, 13);
  const snoozeOptions = [
    { id: "later", label: `${now.getHours() < 17 ? "Later today" : "Tomorrow afternoon"} · ${time.format(later)}`, when: later },
    { id: "tomorrow", label: `Tomorrow · ${time.format(at(1, 8))}`, when: at(1, 8) },
    { id: "week", label: `Next week · ${day.format(nextMonday())}`, when: nextMonday() },
  ];
  const snooze = (ids: string[], when: Date) => {
    const before = list;
    commit(list.map((m) => (ids.includes(m.id) ? { ...m, folder: "snoozed", snoozeUntil: when.toISOString() } : m)));
    setPicked((p) => p.filter((x) => !ids.includes(x)));
    if (openId && ids.includes(openId)) setOpenId(null);
    const text = `Snoozed until ${full.format(when)}.`;
    setUndo({ text, before });
    setStatus(text);
  };

  // Reply and forward.
  const startDraft = (mode: Draft["mode"], m: Mail) => {
    setDraft({ mode, of: m.id, to: mode === "reply" ? m.from.email : "", body: "", files: [] });
    window.setTimeout(() => document.getElementById(mode === "reply" ? `${id}-body` : `${id}-to`)?.focus(), 60);
  };
  const toError = draft && draft.mode === "forward" && draft.touched && !EMAIL.test(draft.to.trim()) ? (draft.to.trim() ? "Enter a full email address, like name@example.com." : "Add who it goes to.") : "";
  const doSend = async () => {
    if (!draft || !open) return;
    if (draft.mode === "forward" && !EMAIL.test(draft.to.trim())) {
      setDraft({ ...draft, touched: true });
      document.getElementById(`${id}-to`)?.focus();
      return;
    }
    if (!draft.body.trim() && draft.mode === "reply") {
      setDraft({ ...draft, error: "Write a message before sending." });
      document.getElementById(`${id}-body`)?.focus();
      return;
    }
    counter.current += 1;
    const mail: Mail = {
      id: `${id}-sent-${counter.current}`,
      folder: "sent",
      from: me,
      to: [draft.to.trim()],
      subject: `${draft.mode === "reply" ? "Re" : "Fwd"}: ${open.subject.replace(/^(Re|Fwd): /, "")}`,
      body: draft.mode === "forward" ? `${draft.body}\n\n---------- Forwarded message ----------\n${open.from.name} <${open.from.email}>\n\n${open.body}`.trim() : draft.body,
      at: new Date(Math.max(Date.now(), now.getTime())).toISOString(),
      attachments: draft.files.length ? draft.files : undefined,
    };
    setSending(true);
    setDraft({ ...draft, error: undefined });
    setStatus("Sending…");
    try {
      await (send ? send(mail) : wait(700));
      setList((xs) => {
        const next = [...xs, mail];
        onChange?.(next);
        return next;
      });
      setDraft(null);
      setStatus(`Sent to ${mail.to[0]}.`);
      window.setTimeout(() => document.getElementById(`${id}-reply`)?.focus(), 30);
    } catch {
      setDraft((d) => (d ? { ...d, error: "Couldn't send. Check your connection and try again." } : d));
      setStatus("Couldn't send.");
    } finally {
      setSending(false);
    }
  };
  const addFiles = (files: FileList | null) => {
    if (!draft || !files?.length) return;
    const ok: MailAttachment[] = [];
    const big: string[] = [];
    [...files].forEach((f) => (f.size > MAX_FILE ? big.push(f.name) : ok.push({ name: f.name, size: f.size })));
    setDraft({ ...draft, files: [...draft.files, ...ok], error: big.length ? `${big.join(", ")} ${big.length === 1 ? "is" : "are"} over 10 MB.` : undefined });
    setStatus(ok.length ? `${ok.length === 1 ? "1 file" : `${ok.length} files`} attached.` : "");
  };

  // Undo stays offered for eight seconds.
  useEffect(() => {
    if (!undo) return;
    const t = window.setTimeout(() => setUndo(null), 8000);
    return () => window.clearTimeout(t);
  }, [undo]);

  const toolbarIds = visiblePicked;
  const snoozeItems: MenuEntry[] = snoozeOptions.map((o) => ({ id: o.id, label: o.label, icon: "clock" }));
  const folderName = FOLDERS.find((f) => f.id === folder)?.label ?? "";

  // A render function rather than a component, so the open menu keeps its focus across renders.
  const snoozeMenu = (from: string, ids: string[]) =>
    snoozeFor && snoozeFor.from === from ? (
      <MenuPanel
        id={`${id}-${from}-menu`}
        labelledBy={`${id}-${from}`}
        label={l.snooze}
        items={snoozeItems}
        fit
        focusAt="first"
        className="fl-mbx-menu"
        onPick={(entry) => {
          const o = snoozeOptions.find((x) => x.id === entry.id);
          if (o) snooze(ids, o.when);
          setSnoozeFor(null);
          // The snoozed rows (and this menu's button with them) leave the list; focus waits in the search box.
          window.setTimeout(() => document.getElementById(`${id}-q`)?.focus(), 80);
        }}
        onClose={(how) => {
          setSnoozeFor(null);
          if (how !== "outside") document.getElementById(`${id}-${from}`)?.focus();
        }}
      />
    ) : null;

  return (
    <section className="fl-mbx" aria-labelledby={`${id}-title`} data-fl="t.app-mail">
      <div className={["fl-mbx-grid", open ? "is-reading" : ""].filter(Boolean).join(" ")}>
        <nav className="fl-mbx-rail" aria-labelledby={`${id}-title`}>
          <h2 id={`${id}-title`} className="fl-mbx-title">
            {title}
          </h2>
          <ul role="list">
            {FOLDERS.map((f) => {
              const n = f.id === "inbox" || f.id === "starred" || f.id === "snoozed" ? unreadIn(f.id) : 0;
              return (
                <li key={f.id}>
                  <button type="button" className={folder === f.id ? "fl-mbx-folder is-current" : "fl-mbx-folder"} aria-current={folder === f.id ? "page" : undefined} onClick={() => void goFolder(f.id)}>
                    <FolderIcon name={f.icon} />
                    <span className="fl-mbx-fname">{f.label}</span>
                    {n ? (
                      <span className="fl-mbx-n">
                        {n}
                        <span className="fl-sr"> unread</span>
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <label className="fl-mbx-pickfolder">
            <span className="fl-sr">Folder</span>
            <span className="fl-ctl-select">
              <select className="fl-input fl-ctl-field fl-ctl-field--outlined fl-ctl-field--40" value={folder} onChange={(e) => void goFolder(e.currentTarget.value as MailFolder)}>
                {FOLDERS.map((f) => {
                  const n = f.id === "inbox" || f.id === "starred" || f.id === "snoozed" ? unreadIn(f.id) : 0;
                  return (
                    <option key={f.id} value={f.id}>
                      {f.label}
                      {n ? ` (${n})` : ""}
                    </option>
                  );
                })}
              </select>
              <Icon name="chevron-down" />
            </span>
          </label>
        </nav>

        <div className="fl-mbx-listcol">
          <div className="fl-mbx-search">
            <Icon name="search" />
            <TextField id={`${id}-q`} type="search" size={40} value={query} placeholder={l.search} aria-label={l.search} aria-controls={`${id}-list`} onChange={(e) => setQuery(e.currentTarget.value)} />
          </div>
          <div className="fl-mbx-bar" role="toolbar" aria-label="Selected messages" aria-controls={`${id}-list`}>
            <Checkbox size={18} aria-label={all ? "Clear selection" : "Select all"} checked={all} indeterminate={!all && visiblePicked.length > 0} disabled={!shown.length} onChange={() => setPicked(all ? [] : shown.map((m) => m.id))} />
            <span className="fl-mbx-picked" aria-hidden={!toolbarIds.length}>
              {toolbarIds.length ? `${toolbarIds.length} selected` : folderName}
            </span>
            <div className="fl-mbx-acts">
              {folder === "trash" ? (
                <>
                  <Button variant="tertiary" size={32} icon="refresh" iconOnly disabled={!toolbarIds.length} onClick={() => move(toolbarIds, "inbox", "moved to Inbox")}>
                    {l.restore}
                  </Button>
                  <Button variant="tertiary" size={32} icon="trash" iconOnly disabled={!toolbarIds.length} onClick={() => setForever(toolbarIds)}>
                    {l.deleteForever}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="tertiary" size={32} icon="archive" iconOnly disabled={!toolbarIds.length || folder === "archive"} onClick={() => move(toolbarIds, "archive", "archived")}>
                    {l.archive}
                  </Button>
                  <span className="fl-mbx-menuwrap">
                    <Button
                      id={`${id}-bulk`}
                      variant="tertiary"
                      size={32}
                      icon="clock"
                      iconOnly
                      disabled={!toolbarIds.length}
                      aria-haspopup="menu"
                      aria-expanded={snoozeFor?.from === "bulk"}
                      onClick={() => setSnoozeFor(snoozeFor?.from === "bulk" ? null : { from: "bulk", ids: toolbarIds })}
                    >
                      {l.snooze}
                    </Button>
                    {snoozeMenu("bulk", toolbarIds)}
                  </span>
                  <Button variant="tertiary" size={32} icon="mail" iconOnly disabled={!toolbarIds.length} onClick={() => markRead(toolbarIds, !list.filter((m) => toolbarIds.includes(m.id)).some((m) => m.unread))}>
                    {list.filter((m) => toolbarIds.includes(m.id)).some((m) => m.unread) ? l.read : l.unread}
                  </Button>
                  <Button variant="tertiary" size={32} icon="trash" iconOnly disabled={!toolbarIds.length} onClick={() => move(toolbarIds, "trash", "moved to Trash")}>
                    {l.trash}
                  </Button>
                </>
              )}
            </div>
          </div>

          {load === "loading" ? (
            <ul className="fl-mbx-list" role="list" aria-busy="true" aria-label="Loading messages">
              {[0, 1, 2, 3].map((i) => (
                <li key={i} className="fl-mbx-skel" aria-hidden="true">
                  <span />
                  <span />
                </li>
              ))}
            </ul>
          ) : load === "error" ? (
            <div className="fl-mbx-empty">
              <EmptyState
                variant="error"
                title="Couldn't load this folder"
                action={
                  <Button variant="secondary" size={40} icon="refresh" onClick={() => void goFolder(folder)}>
                    Retry
                  </Button>
                }
              >
                Check your connection and try again.
              </EmptyState>
            </div>
          ) : shown.length === 0 ? (
            <div className="fl-mbx-empty">
              {query ? (
                <EmptyState
                  variant="no-results"
                  title="No messages match"
                  action={
                    <Button
                      variant="secondary"
                      size={40}
                      onClick={() => {
                        setQuery("");
                        document.getElementById(`${id}-q`)?.focus();
                      }}
                    >
                      Clear search
                    </Button>
                  }
                >
                  Try a name, a subject or a word from the message.
                </EmptyState>
              ) : (
                <EmptyState variant="done" title={`Nothing in ${folderName}`}>
                  {folder === "inbox" ? "You're all caught up." : "Messages you move here show up in this list."}
                </EmptyState>
              )}
            </div>
          ) : (
            <ul className="fl-mbx-list" id={`${id}-list`} role="list" aria-label={folderName}>
              {shown.map((m, i) => (
                <li key={m.id} className={["fl-mbx-row", m.unread ? "is-unread" : "", m.id === openId ? "is-open" : "", picked.includes(m.id) ? "is-picked" : ""].filter(Boolean).join(" ")} style={{ "--i": i } as CSSProperties}>
                  <Checkbox size={16} aria-label={`${l.pick} ${m.subject}`} checked={picked.includes(m.id)} onChange={() => setPicked((p) => (p.includes(m.id) ? p.filter((x) => x !== m.id) : [...p, m.id]))} />
                  <button type="button" className="fl-mbx-star" aria-pressed={Boolean(m.starred)} aria-label={`Star ${m.subject}`} onClick={() => patch([m.id], (x) => ({ ...x, starred: !x.starred }))}>
                    <Icon name="star" filled={m.starred} />
                  </button>
                  <button type="button" id={`${id}-row-${m.id}`} className="fl-mbx-open" aria-current={m.id === openId ? "true" : undefined} onClick={() => openMail(m)}>
                    <span className="fl-mbx-from">
                      {folder === "sent" ? `To: ${m.to.join(", ")}` : m.from.name}
                      {m.unread ? <span className="fl-sr">, unread</span> : null}
                    </span>
                    <span className="fl-mbx-date">
                      {m.attachments?.length ? <Icon name="paperclip" label="Has attachments" /> : null}
                      <time dateTime={m.at}>{short(m.at)}</time>
                    </span>
                    <span className="fl-mbx-subj">{m.subject}</span>
                    <span className="fl-mbx-snip">{m.snoozeUntil ? `Back ${full.format(new Date(m.snoozeUntil))}` : m.body.replace(/\s+/g, " ")}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {undo ? (
            <div className="fl-mbx-undo">
              <span>{undo.text}</span>
              <button
                type="button"
                className="fl-mbx-undobtn"
                onClick={() => {
                  commit(undo.before);
                  setUndo(null);
                  setStatus("Undone.");
                }}
              >
                {l.undo}
              </button>
            </div>
          ) : null}
        </div>

        <div className="fl-mbx-read">
          {open ? (
            <article className="fl-mbx-mail" aria-labelledby={`${id}-subject`} onKeyDown={(e) => e.key === "Escape" && !draft && !snoozeFor && !forever && backToList()}>
              <div className="fl-mbx-readbar">
                <Button variant="tertiary" size={32} icon="arrow-left" className="fl-mbx-back" onClick={backToList}>
                  {l.back}
                </Button>
                <div className="fl-mbx-acts">
                  {open.folder === "trash" ? (
                    <>
                      <Button variant="tertiary" size={32} icon="refresh" iconOnly onClick={() => move([open.id], "inbox", "moved to Inbox")}>
                        {l.restore}
                      </Button>
                      <Button variant="tertiary" size={32} icon="trash" iconOnly onClick={() => setForever([open.id])}>
                        {l.deleteForever}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="tertiary" size={32} icon="archive" iconOnly disabled={open.folder === "archive" || open.folder === "sent"} onClick={() => move([open.id], "archive", "archived")}>
                        {l.archive}
                      </Button>
                      <span className="fl-mbx-menuwrap">
                        <Button
                          id={`${id}-one`}
                          variant="tertiary"
                          size={32}
                          icon="clock"
                          iconOnly
                          disabled={open.folder === "sent"}
                          aria-haspopup="menu"
                          aria-expanded={snoozeFor?.from === "one"}
                          onClick={() => setSnoozeFor(snoozeFor?.from === "one" ? null : { from: "one", ids: [open.id] })}
                        >
                          {l.snooze}
                        </Button>
                        {snoozeMenu("one", [open.id])}
                      </span>
                      <Button
                        variant="tertiary"
                        size={32}
                        icon="mail"
                        iconOnly
                        onClick={() => {
                          markRead([open.id], true);
                          backToList();
                        }}
                      >
                        {l.unread}
                      </Button>
                      <Button variant="tertiary" size={32} icon="trash" iconOnly onClick={() => move([open.id], "trash", "moved to Trash")}>
                        {l.trash}
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <h3 id={`${id}-subject`} className="fl-mbx-h" tabIndex={-1}>
                {open.subject}
              </h3>
              <div className="fl-mbx-who">
                <Avatar name={open.from.name} size={40} tone="b" decorative />
                <div>
                  <p className="fl-mbx-name">
                    {open.from.name} <span>&lt;{open.from.email}&gt;</span>
                  </p>
                  <p className="fl-mbx-to">To: {open.to.join(", ")}</p>
                </div>
                <time dateTime={open.at}>{full.format(new Date(open.at))}</time>
              </div>
              {open.snoozeUntil ? (
                <p className="fl-mbx-note">
                  <Icon name="clock" />
                  Snoozed until {full.format(new Date(open.snoozeUntil))}
                </p>
              ) : null}
              <div className="fl-mbx-text">
                {open.body.split(/\n{2,}/).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              {open.attachments?.length ? (
                <ul className="fl-mbx-files" role="list" aria-label="Attachments">
                  {open.attachments.map((a) => (
                    <li key={a.name}>
                      <span className="fl-mbx-ext" aria-hidden="true">
                        {a.name.split(".").pop()?.slice(0, 4).toUpperCase()}
                      </span>
                      <span className="fl-mbx-fileinfo">
                        <span>{a.name}</span>
                        <span>{size(a.size)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="fl-mbx-replyrow">
                <Button id={`${id}-reply`} variant="secondary" size={40} icon="arrow-left" aria-expanded={draft?.mode === "reply"} aria-controls={`${id}-compose`} onClick={() => startDraft("reply", open)} disabled={open.folder === "sent"}>
                  {l.reply}
                </Button>
                <Button variant="secondary" size={40} icon="share" aria-expanded={draft?.mode === "forward"} aria-controls={`${id}-compose`} onClick={() => startDraft("forward", open)}>
                  {l.forward}
                </Button>
              </div>

              <div className={draft ? "fl-mbx-fold is-open" : "fl-mbx-fold"} id={`${id}-compose`} inert={!draft || undefined}>
                <div className="fl-mbx-clip">
                  {draft ? (
                    <form
                      className="fl-mbx-compose"
                      aria-label={draft.mode === "reply" ? "Reply" : "Forward"}
                      noValidate
                      onSubmit={(e) => {
                        e.preventDefault();
                        void doSend();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape" && !sending) {
                          e.stopPropagation();
                          if (!draft.body.trim() && !draft.files.length) {
                            setDraft(null);
                            document.getElementById(`${id}-reply`)?.focus();
                          }
                        }
                      }}
                    >
                      <div className="fl-mbx-field">
                        <label htmlFor={`${id}-to`}>To</label>
                        <TextField
                          id={`${id}-to`}
                          type="email"
                          size={40}
                          value={draft.to}
                          readOnly={draft.mode === "reply"}
                          invalid={Boolean(toError)}
                          aria-describedby={toError ? `${id}-to-err` : undefined}
                          placeholder="name@example.com"
                          onChange={(e) => setDraft({ ...draft, to: e.currentTarget.value })}
                          onBlur={() => setDraft((d) => (d ? { ...d, touched: true } : d))}
                        />
                        {toError ? (
                          <p id={`${id}-to-err`} className="fl-mbx-err">
                            {toError}
                          </p>
                        ) : null}
                      </div>
                      <div className="fl-mbx-field">
                        <label htmlFor={`${id}-body`}>Message</label>
                        <TextField multiline autoGrow rows={4} id={`${id}-body`} value={draft.body} aria-describedby={draft.error ? `${id}-send-err` : undefined} onChange={(e) => setDraft({ ...draft, body: e.currentTarget.value, error: undefined })} />
                      </div>
                      {draft.files.length ? (
                        <ul className="fl-mbx-files is-draft" role="list" aria-label="Attached files">
                          {draft.files.map((a, i) => (
                            <li key={`${a.name}-${i}`}>
                              <span className="fl-mbx-ext" aria-hidden="true">
                                {a.name.split(".").pop()?.slice(0, 4).toUpperCase()}
                              </span>
                              <span className="fl-mbx-fileinfo">
                                <span>{a.name}</span>
                                <span>{size(a.size)}</span>
                              </span>
                              <Button
                                variant="tertiary"
                                size={24}
                                icon="close"
                                iconOnly
                                onClick={() => {
                                  setDraft({ ...draft, files: draft.files.filter((_, j) => j !== i) });
                                  setStatus(`${a.name} removed.`);
                                  document.getElementById(`${id}-attach`)?.focus();
                                }}
                              >
                                {`Remove ${a.name}`}
                              </Button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {draft.error ? (
                        <p id={`${id}-send-err`} className="fl-mbx-err" role="alert">
                          <Icon name="alert" />
                          {draft.error}
                        </p>
                      ) : null}
                      <div className="fl-mbx-composebar">
                        <input ref={fileRef} type="file" multiple hidden onChange={(e) => {
                          addFiles(e.currentTarget.files);
                          e.currentTarget.value = "";
                        }} />
                        <Button id={`${id}-attach`} variant="tertiary" size={40} icon="paperclip" onClick={() => fileRef.current?.click()}>
                          {l.attach}
                        </Button>
                        <span className="fl-mbx-spacer" />
                        <Button
                          variant="tertiary"
                          size={40}
                          disabled={sending}
                          onClick={() => {
                            if (draft.body.trim() || draft.files.length) setForever(["draft"]);
                            else {
                              setDraft(null);
                              document.getElementById(`${id}-reply`)?.focus();
                            }
                          }}
                        >
                          {l.discard}
                        </Button>
                        <Button type="submit" variant="primary" size={40} icon="send" busy={sending}>
                          {sending ? l.sending : l.send}
                        </Button>
                      </div>
                    </form>
                  ) : null}
                </div>
              </div>
            </article>
          ) : (
            <div className="fl-mbx-none">
              <FolderIcon name="inbox" />
              <p>Pick a message to read it.</p>
            </div>
          )}
        </div>
      </div>

      <p className="fl-sr" role="status" aria-live="polite">
        {status}
      </p>

      {forever ? (
        forever[0] === "draft" ? (
          <Modal
            variant="danger"
            icon="trash"
            title="Discard this draft?"
            description="What you wrote and the files you attached will be lost."
            confirmLabel={l.discard}
            onConfirm={() => {
              setDraft(null);
              setStatus("Draft discarded.");
              window.setTimeout(() => document.getElementById(`${id}-reply`)?.focus(), 30);
            }}
            onClose={() => setForever(null)}
          />
        ) : (
          <Modal
            variant="danger"
            icon="trash"
            title={forever.length === 1 ? "Delete this message forever?" : `Delete ${forever.length} messages forever?`}
            description="They can't be brought back after this."
            confirmLabel={l.deleteForever}
            onConfirm={() => {
              const ids = forever;
              commit(list.filter((m) => !ids.includes(m.id)));
              setPicked((p) => p.filter((x) => !ids.includes(x)));
              if (openId && ids.includes(openId)) setOpenId(null);
              setUndo(null);
              setStatus(`${ids.length === 1 ? "1 message" : `${ids.length} messages`} deleted.`);
              window.setTimeout(() => document.getElementById(`${id}-q`)?.focus(), 30);
            }}
            onClose={() => setForever(null)}
          />
        )
      ) : null}
    </section>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Mail",
  me: { name: "Ana Ruiz", email: "ana@northlight.example" },
  now: new Date("2026-10-21T10:30:00"),
  mails: [
    { id: "m1", folder: "inbox", unread: true, from: { name: "Maya Chen", email: "maya@northlight.example" }, to: ["ana@northlight.example"], subject: "Homepage hero: two options", at: "2026-10-21T09:58:00", body: "Hi Ana,\n\nI've put two hero options in the shared folder. The first keeps the photo; the second leads with the headline.\n\nCould you pick one by Thursday? Happy to talk it through.\n\nMaya", attachments: [{ name: "hero-options.pdf", size: 2_480_000 }] },
    { id: "m2", folder: "inbox", unread: true, starred: true, from: { name: "Dana Whitfield", email: "dana@harborfoods.example" }, to: ["ana@northlight.example"], subject: "Invoice 2026-118 paid", at: "2026-10-21T08:41:00", body: "Hello,\n\nWe've paid invoice 2026-118 today. The receipt is attached for your records.\n\nThanks for the quick turnaround on the menus.\n\nDana", attachments: [{ name: "receipt-2026-118.pdf", size: 184_000 }] },
    { id: "m3", folder: "inbox", from: { name: "Leo Park", email: "leo@northlight.example" }, to: ["ana@northlight.example"], subject: "Shoot schedule for Friday", at: "2026-10-20T17:12:00", body: "We start at 9 at the Pier Street studio. Call sheet attached; parking is in the side lot.\n\nLeo", attachments: [{ name: "call-sheet.docx", size: 96_000 }] },
    { id: "m4", folder: "inbox", from: { name: "Calendar", email: "calendar@northlight.example" }, to: ["ana@northlight.example"], subject: "Reminder: studio review at 2 PM", at: "2026-10-20T08:00:00", body: "Studio review today at 2 PM in the big room. Bring the autumn launch board." },
    { id: "m5", folder: "inbox", from: { name: "Sam Okafor", email: "sam@northlight.example" }, to: ["ana@northlight.example"], subject: "New laptop is ready", at: "2026-10-18T15:30:00", body: "Your new laptop is set up. Pick it up from IT whenever suits you this week." },
    { id: "m6", folder: "snoozed", from: { name: "Priya Nair", email: "priya@lumen.example" }, to: ["ana@northlight.example"], subject: "Proposal follow-up", at: "2026-10-17T11:20:00", snoozeUntil: "2026-10-22T08:00:00", body: "Just checking whether you had a chance to look at the proposal. No rush." },
    { id: "m7", folder: "sent", from: { name: "Ana Ruiz", email: "ana@northlight.example" }, to: ["dana@harborfoods.example"], subject: "Menus: final files", at: "2026-10-16T16:45:00", body: "Hi Dana,\n\nFinal print files are attached. Let me know if the printer needs anything else.\n\nAna", attachments: [{ name: "menus-final.zip", size: 8_400_000 }] },
    { id: "m8", folder: "archive", from: { name: "Marcus Bell", email: "marcus@northlight.example" }, to: ["ana@northlight.example"], subject: "Staging is live", at: "2026-10-14T10:05:00", body: "Staging is up for the autumn site. Please click through before the 20th." },
  ] as Mail[],
};

export default function MailClientSheet() {
  return (
    <section className="fl-section fl-section--canvas" aria-label="Mail client">
      <div className="fl-wrap">
        <MailClient {...SAMPLE} loadFolder={() => wait(450)} />
      </div>
    </section>
  );
}
