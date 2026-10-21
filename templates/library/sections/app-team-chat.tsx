/** @flowcode-library app-team-chat · Team chat (App screens)
 * Catalog ID: t.app-team-chat (template)
 * Function: Team chat (t.app-team-chat): a workspace's channels and direct messages with unread counts and @mention badges, a message log that marks where new messages start, emoji reactions that toggle, replies in a side thread, and a composer that suggests teammates after @ (arrow keys and Enter), sends with Enter, and shows Sending, then Retry or Delete when a send fails.
 * Use it as: import { TeamChat } from "./app-team-chat"; <TeamChat title? me="u-ana" members={[{ id, name, handle, tone?: "a"|"b"|"c"|"d"|"e", status?: "online"|"away"|"offline" }]} channels={[{ id, name, kind: "channel"|"dm", topic?, unread?: 2, mentions?: 1 }]} messages={{ [channelId]: [{ id, by, at: "2026-10-21T09:12", text: "Hi @maya", reactions?: [{ emoji: "👍", by: ["u-leo"] }], replies?: [...] }] }} startIn?="c-design" emojis?={["👍","🎉"]} send?={async (channelId, text, threadOf?) => void} onChange?={(messages) => ...} labels?={{ channels, direct, message, send, thread, ... }} />
 * Built from: c.avatar.person, c.button.primary, c.button.tertiary, c.text-field.outlined, c.empty-state.first-use
 * Look: One white card split in two: a left rail with the workspace name, Channels and Direct messages lists (a # or a small avatar, the name, bold when unread, a count pill, an accent @ pill for mentions) and, on the right, the open channel's header with its topic, a scrolling log of messages (avatar, name, time, text with tinted @mentions, reaction chips, "3 replies" link) with a thin accent rule and a New tag where unread messages begin, and a composer box with a send button. A thread opens as a third panel beside the log (over it on a phone). On a narrow card the rail folds into a channel button that slides the list open.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-danger --space-1 --space-2 --space-3 --space-4 --space-5 --radius-md --radius-lg --radius-sm --text-xs --text-sm --text-base --text-lg --weight-medium --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger
 * Use cases: team chat; workspace messaging; internal communication; project channels; Slack-style app; community chat; collaboration tool; group messaging
 * Jobs to be done: catch up on channels with unread messages; mention a teammate so they see it; react to a message without replying; reply in a thread to keep the channel tidy; retry a message that failed to send
 * Keywords: chat, channels, threads, reactions, mentions, unread, direct messages, messaging, team, workspace, composer
 */
/**
 * Team chat: channels and direct messages on the left, the open conversation on the right. Opening a channel clears
 * its unread count and leaves a New marker where the unread messages began until you switch away. Typing @ in either
 * composer opens a list of teammates (a combobox: Up and Down move, Enter or Tab picks, Escape closes). Enter sends,
 * Shift+Enter adds a line. A message shows Sending until `send` resolves, and Retry or Delete if it throws. Make it the
 * app's own: replace SAMPLE with the workspace's people, channels and history, post through `send`, and save reactions
 * and replies through onChange.
 * Adapted from HyperUI (MIT, Copyright (c) Mark Mead): the queue rail, list and reading pane of its support inbox
 * template and its textarea with actions.
 */
/**
 * How to try it
 * - #launch shows 2 unread: open it; the count clears and a New rule marks where they start. @ pills show mentions of you.
 * - Hover or Tab onto a message: React adds an emoji (arrow keys move, Escape closes); press a reaction chip to add or
 *   remove yours.
 * - Press "2 replies" (or Reply): the thread opens beside the log; reply there, then Escape closes it and focus returns.
 * - In the composer type "@ma": Maya is suggested; press Enter to pick her, then Enter to send. The new message slides in.
 * - In #design, the first message you send fails: press Retry. Narrow the window: the channel list folds into a button.
 *
 * Dependencies: React (Fragment, useEffect, useId, useMemo, useRef, useState), the library's Avatar, Button, TextField and EmptyState
 * ("./avatars-variants", "./buttons-variants", "./text-fields-states", "./empty-states")
 * and its inline icon set ("./icons"). Nothing else: no package and nothing fetched. The styles are the library's own fl-
 * classes in templates/library/css/r4a-team-chat.css.
 */
import { Fragment, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Avatar } from "./avatars-variants";
import { Button } from "./buttons-variants";
import { EmptyState } from "./empty-states";
import { Icon } from "./icons";
import { TextField } from "./text-fields-states";

// ── t.app-team-chat: channels, unread markers, reactions, threads and @mentions. ──

export type ChatMember = { id: string; name: string; handle: string; tone?: "a" | "b" | "c" | "d" | "e"; status?: "online" | "away" | "offline" };
export type ChatReaction = { emoji: string; by: string[] };
export type ChatMessage = {
  id: string;
  by: string;
  at: string;
  text: string;
  reactions?: ChatReaction[];
  replies?: ChatMessage[];
  /** Set while a message of yours is on its way, or after it failed. */
  state?: "sending" | "failed";
};
export type ChatChannel = { id: string; name: string; kind: "channel" | "dm"; topic?: string; unread?: number; mentions?: number };

export type TeamChatLabels = Partial<{
  channels: string;
  direct: string;
  message: string;
  send: string;
  sending: string;
  failed: string;
  retry: string;
  remove: string;
  react: string;
  reply: string;
  thread: string;
  close: string;
  newMark: string;
  empty: string;
  emptyText: string;
  switchChannel: string;
}>;

export type TeamChatProps = {
  title?: string;
  /** Your member id: your messages, your reactions and @mentions of you. */
  me: string;
  members: ChatMember[];
  channels: ChatChannel[];
  messages: Record<string, ChatMessage[]>;
  /** The channel open at first; the first one when left out. */
  startIn?: string;
  /** The quick reactions; six common ones when left out. */
  emojis?: string[];
  /** Posts a message (threadOf is the parent's id for a reply). Throw to show Retry. Waits a moment when left out. */
  send?: (channelId: string, text: string, threadOf?: string) => Promise<void>;
  onChange?: (messages: Record<string, ChatMessage[]>) => void;
  labels?: TeamChatLabels;
};

const wait = (t: number) => new Promise<void>((r) => window.setTimeout(r, t));
const LIMIT = 2000;

// Two glyphs the shared icon set lacks, drawn the same way (24 grid, 1.75 stroke, currentColor).
const GLYPHS: Record<string, string> = {
  chat: "M4 5h16v11H9l-5 4z",
  smile: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8.5 14a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01",
};
function Glyph({ name }: { name: keyof typeof GLYPHS }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={GLYPHS[name]} />
    </svg>
  );
}

// ── The composer: a textarea with @mention suggestions (WAI-ARIA combobox with a listbox popup). ──

function Composer({ id, label, placeholder, members, sendLabel, onSend }: { id: string; label: string; placeholder: string; members: ChatMember[]; sendLabel: string; onSend: (text: string) => void }) {
  const [value, setValue] = useState("");
  const [query, setQuery] = useState<{ q: string; start: number } | null>(null);
  const [active, setActive] = useState(0);
  const fieldId = `${id}-field`;
  const listId = `${id}-people`;
  const options = useMemo(() => {
    if (!query) return [];
    const q = query.q.toLowerCase();
    return members.filter((m) => m.handle.toLowerCase().startsWith(q) || m.name.toLowerCase().startsWith(q)).slice(0, 6);
  }, [query, members]);
  const open = options.length > 0;

  const field = () => document.getElementById(fieldId) as HTMLTextAreaElement | null;
  const read = (text: string, caret: number) => {
    const m = /(^|\s)@([\w.-]*)$/.exec(text.slice(0, caret));
    setQuery(m ? { q: m[2] ?? "", start: caret - (m[2] ?? "").length - 1 } : null);
    setActive(0);
  };
  const pick = (m: ChatMember) => {
    const el = field();
    if (!query || !el) return;
    const caret = el.selectionStart ?? value.length;
    const insert = `@${m.handle} `;
    const next = value.slice(0, query.start) + insert + value.slice(caret);
    setValue(next);
    setQuery(null);
    const at = query.start + insert.length;
    window.requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(at, at);
    });
  };
  const submit = () => {
    const text = value.trim();
    if (!text || text.length > LIMIT) return;
    onSend(text);
    setValue("");
    setQuery(null);
  };
  const onKey = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        setActive((a) => (a + step + options.length) % options.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(options[active]!);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };
  const over = value.length > LIMIT;

  return (
    <form
      className="fl-tmc-composer"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className="fl-sr" htmlFor={fieldId}>
        {label}
      </label>
      <div className="fl-tmc-box">
        <TextField
          multiline
          autoGrow
          rows={1}
          id={fieldId}
          value={value}
          placeholder={placeholder}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open ? `${listId}-${options[active]?.id}` : undefined}
          aria-describedby={`${id}-hint`}
          invalid={over}
          onChange={(e) => {
            setValue(e.currentTarget.value);
            read(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length);
          }}
          onKeyDown={onKey}
          onClick={(e) => read(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
          onBlur={() => window.setTimeout(() => setQuery(null), 120)}
        />
        <Button type="submit" variant="primary" size={32} icon="send" iconOnly disabled={!value.trim() || over} className="fl-tmc-send">
          {sendLabel}
        </Button>
        <ul id={listId} role="listbox" aria-label="Teammates" className="fl-tmc-people" hidden={!open}>
          {options.map((m, i) => (
            <li
              key={m.id}
              id={`${listId}-${m.id}`}
              role="option"
              aria-selected={i === active}
              className="fl-tmc-person"
              onMouseDown={(e) => {
                e.preventDefault();
                pick(m);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <Avatar name={m.name} size={24} tone={m.tone ?? "e"} decorative />
              <span>{m.name}</span>
              <span className="fl-tmc-handle">@{m.handle}</span>
            </li>
          ))}
        </ul>
      </div>
      <p id={`${id}-hint`} className={over ? "fl-tmc-hint is-over" : "fl-tmc-hint"}>
        {over ? `${value.length - LIMIT} characters over the limit` : "Enter to send · Shift+Enter for a new line · @ to mention"}
      </p>
    </form>
  );
}

export function TeamChat({ title = "Workspace", me, members, channels: channelsProp, messages, startIn, emojis = ["👍", "🎉", "❤️", "👀", "✅", "😂"], send, onChange, labels = {} }: TeamChatProps) {
  const l = {
    channels: "Channels",
    direct: "Direct messages",
    message: "Message",
    send: "Send",
    sending: "Sending…",
    failed: "Not sent.",
    retry: "Retry",
    remove: "Delete",
    react: "Add reaction",
    reply: "Reply in thread",
    thread: "Thread",
    close: "Close thread",
    newMark: "New",
    empty: "No messages yet",
    emptyText: "Say hello to get things started.",
    switchChannel: "Switch channel",
    ...labels,
  };
  const id = useId();
  const [channels, setChannels] = useState(channelsProp);
  const [log, setLog] = useState(messages);
  const [current, setCurrent] = useState(startIn ?? channelsProp[0]?.id ?? "");
  const [divider, setDivider] = useState<string | null>(null);
  const [thread, setThread] = useState<string | null>(null);
  const [picker, setPicker] = useState<string | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const [fresh, setFresh] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const counter = useRef(0);

  const byId = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);
  const handles = useMemo(() => new Map(members.map((m) => [m.handle.toLowerCase(), m])), [members]);
  const channel = channels.find((c) => c.id === current);
  const list = log[current] ?? [];
  const parent = thread ? list.find((m) => m.id === thread) ?? null : null;

  const commit = (fn: (prev: Record<string, ChatMessage[]>) => Record<string, ChatMessage[]>) => {
    setLog((prev) => {
      const next = fn(prev);
      onChange?.(next);
      return next;
    });
  };

  // Opening a channel: mark where its unread messages begin, then clear the counts.
  const openChannel = (cid: string) => {
    const c = channels.find((x) => x.id === cid);
    const msgs = log[cid] ?? [];
    const unread = Math.min(c?.unread ?? 0, msgs.length);
    setDivider(unread ? msgs[msgs.length - unread]!.id : null);
    setChannels((cs) => cs.map((x) => (x.id === cid ? { ...x, unread: 0, mentions: 0 } : x)));
    setCurrent(cid);
    setThread(null);
    setPicker(null);
    setRailOpen(false);
    setStatus(`${c?.kind === "dm" ? "" : "#"}${c?.name ?? ""}${unread ? `, ${unread} new` : ""}`);
  };
  useEffect(() => {
    openChannel(current);
    // Only once, for the channel open at first.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the log at its newest message whenever the channel changes or a message arrives.
  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    const mark = divider ? el.querySelector<HTMLElement>(".fl-tmc-new") : null;
    el.scrollTop = mark ? Math.max(0, mark.offsetTop - el.offsetTop - 16) : el.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, list.length]);
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread, parent?.replies?.length]);

  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  const when = (iso: string) => time.format(new Date(iso));

  const render = (text: string) =>
    text.split(/(@[\w.-]+)/g).map((part, i) => {
      const who = part.startsWith("@") ? handles.get(part.slice(1).toLowerCase()) : undefined;
      if (!who) return <span key={i}>{part}</span>;
      return (
        <span key={i} className={who.id === me ? "fl-tmc-mention is-me" : "fl-tmc-mention"}>
          {part}
        </span>
      );
    });

  // Edits one message (top level, or a reply when threadOf is given) in the open channel.
  const edit = (cid: string, mid: string, fn: (m: ChatMessage) => ChatMessage | null, threadOf?: string) =>
    commit((prev) => {
      const msgs = prev[cid] ?? [];
      const apply = (xs: ChatMessage[]) =>
        xs.flatMap((m) => {
          if (m.id !== mid) return [m];
          const next = fn(m);
          return next ? [next] : [];
        });
      // The thread's own parent is a top-level message, though it is drawn inside the thread.
      const inThread = threadOf && threadOf !== mid;
      return { ...prev, [cid]: inThread ? msgs.map((m) => (m.id === threadOf ? { ...m, replies: apply(m.replies ?? []) } : m)) : apply(msgs) };
    });

  const deliver = async (cid: string, msg: ChatMessage, threadOf?: string) => {
    try {
      await (send ? send(cid, msg.text, threadOf) : wait(500));
      edit(cid, msg.id, (m) => ({ ...m, state: undefined }), threadOf);
      setStatus("Message sent.");
    } catch {
      edit(cid, msg.id, (m) => ({ ...m, state: "failed" }), threadOf);
      setStatus("Message not sent. Retry or delete it.");
    }
  };

  const post = (text: string, threadOf?: string) => {
    counter.current += 1;
    const msg: ChatMessage = { id: `${id}-m${counter.current}`, by: me, at: new Date().toISOString(), text, state: "sending" };
    const cid = current;
    commit((prev) => {
      const msgs = prev[cid] ?? [];
      return { ...prev, [cid]: threadOf ? msgs.map((m) => (m.id === threadOf ? { ...m, replies: [...(m.replies ?? []), msg] } : m)) : [...msgs, msg] };
    });
    setFresh((f) => [...f, msg.id]);
    void deliver(cid, msg, threadOf);
  };

  const retry = (msg: ChatMessage, threadOf?: string) => {
    edit(current, msg.id, (m) => ({ ...m, state: "sending" }), threadOf);
    // Retry and Delete go away while it sends; focus waits in the composer it was written in.
    document.getElementById(`${id}-${threadOf ? "thread" : "main"}-field`)?.focus();
    setStatus("Sending again…");
    void deliver(current, msg, threadOf);
  };

  const react = (mid: string, emoji: string, threadOf?: string) => {
    const host = threadOf ? list.find((m) => m.id === threadOf)?.replies : list;
    const had = (threadOf && threadOf === mid ? list : host ?? []).find((m) => m.id === mid)?.reactions?.find((r) => r.emoji === emoji)?.by.includes(me);
    setStatus(had ? `Removed ${emoji}.` : `Reacted ${emoji}.`);
    edit(
      current,
      mid,
      (m) => {
        const rs = m.reactions ?? [];
        const found = rs.find((r) => r.emoji === emoji);
        const mine = found?.by.includes(me);
        const next = found ? rs.map((r) => (r.emoji === emoji ? { ...r, by: mine ? r.by.filter((x) => x !== me) : [...r.by, me] } : r)).filter((r) => r.by.length) : [...rs, { emoji, by: [me] }];
        return { ...m, reactions: next };
      },
      threadOf,
    );
  };

  const openThread = (mid: string) => {
    setThread(mid);
    setPicker(null);
    window.setTimeout(() => document.getElementById(`${id}-thread-field`)?.focus(), 30);
  };
  const closeThread = () => {
    const from = thread;
    setThread(null);
    if (from) window.setTimeout(() => document.getElementById(`${id}-${from}-reply`)?.focus(), 0);
  };

  // A plain render function, not a component: a component defined here would remount on every render and drop focus.
  const message = (m: ChatMessage, index: number, threadOf?: string) => {
    const who = byId[m.by];
    const pickerKey = `${threadOf ?? ""}${m.id}`;
    const isNew = fresh.includes(m.id);
    const replies = m.replies?.length ?? 0;
    return (
      <Fragment key={m.id}>
        {!threadOf && divider === m.id ? (
          <div className="fl-tmc-new" role="separator" aria-label="New messages">
            <span>{l.newMark}</span>
          </div>
        ) : null}
        <article className={["fl-tmc-msg", isNew ? "is-fresh" : "", m.state ? `is-${m.state}` : "", m.by === me ? "is-mine" : ""].filter(Boolean).join(" ")} style={{ "--i": index } as CSSProperties} aria-label={`${who?.name ?? "Someone"}, ${when(m.at)}`}>
          <Avatar name={who?.name ?? "?"} size={32} tone={who?.tone ?? "e"} decorative />
          <div className="fl-tmc-body">
            <p className="fl-tmc-meta">
              <strong>{who?.name ?? "Someone"}</strong>
              <time dateTime={m.at}>{when(m.at)}</time>
            </p>
            <p className="fl-tmc-text">{render(m.text)}</p>
            {m.state === "sending" ? <p className="fl-tmc-state">{l.sending}</p> : null}
            {m.state === "failed" ? (
              <p className="fl-tmc-state is-failed">
                <Icon name="alert" />
                {l.failed}
                <button type="button" className="fl-tmc-link" onClick={() => retry(m, threadOf)}>
                  {l.retry}
                </button>
                <button
                  type="button"
                  className="fl-tmc-link"
                  onClick={() => {
                    edit(current, m.id, () => null, threadOf);
                    setStatus("Message deleted.");
                    document.getElementById(`${id}-${threadOf ? "thread" : "main"}-field`)?.focus();
                  }}
                >
                  {l.remove}
                </button>
              </p>
            ) : null}
            {m.reactions?.length ? (
              <ul className="fl-tmc-reactions" role="list" aria-label="Reactions">
                {m.reactions.map((r) => {
                  const mine = r.by.includes(me);
                  const names = r.by.map((x) => (x === me ? "you" : byId[x]?.name ?? "someone")).join(", ");
                  return (
                    <li key={r.emoji}>
                      <button type="button" className="fl-tmc-chip" aria-pressed={mine} title={names} aria-label={`${r.emoji} ${r.by.length}, ${names}. ${mine ? "Remove yours" : "Add yours"}`} onClick={() => react(m.id, r.emoji, threadOf)}>
                        <span aria-hidden="true">{r.emoji}</span>
                        <span className="fl-tmc-count">{r.by.length}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {!threadOf && replies ? (
              <button type="button" className="fl-tmc-replies" onClick={() => openThread(m.id)} aria-label={`${replies} ${replies === 1 ? "reply" : "replies"}, open thread`}>
                <Glyph name="chat" />
                {replies} {replies === 1 ? "reply" : "replies"}
              </button>
            ) : null}
          </div>
          {m.state ? null : (
            <div className="fl-tmc-tools" role="group" aria-label="Message actions">
              <span className="fl-tmc-pick-wrap">
                <button
                  type="button"
                  id={`${id}-${pickerKey}-react`}
                  className="fl-tmc-tool"
                  aria-label={l.react}
                  title={l.react}
                  aria-expanded={picker === pickerKey}
                  aria-controls={`${id}-${pickerKey}-emoji`}
                  onClick={() => {
                    setPicker(picker === pickerKey ? null : pickerKey);
                    window.setTimeout(() => document.getElementById(`${id}-${pickerKey}-emoji`)?.querySelector("button")?.focus(), 0);
                  }}
                >
                  <Glyph name="smile" />
                </button>
                {picker === pickerKey ? (
                  <div
                    id={`${id}-${pickerKey}-emoji`}
                    className="fl-tmc-emoji"
                    role="toolbar"
                    aria-label="Reactions"
                    onKeyDown={(e) => {
                      const btns = [...e.currentTarget.querySelectorAll("button")];
                      const at = btns.indexOf(document.activeElement as HTMLButtonElement);
                      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                        e.preventDefault();
                        btns[(at + (e.key === "ArrowRight" ? 1 : -1) + btns.length) % btns.length]?.focus();
                      } else if (e.key === "Home" || e.key === "End") {
                        e.preventDefault();
                        btns[e.key === "Home" ? 0 : btns.length - 1]?.focus();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        e.stopPropagation();
                        setPicker(null);
                        document.getElementById(`${id}-${pickerKey}-react`)?.focus();
                      }
                    }}
                    onBlur={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) setPicker(null);
                    }}
                  >
                    {emojis.map((em, i) => (
                      <button
                        key={em}
                        type="button"
                        tabIndex={i === 0 ? 0 : -1}
                        aria-label={`React ${em}`}
                        onClick={() => {
                          react(m.id, em, threadOf);
                          setPicker(null);
                          document.getElementById(`${id}-${pickerKey}-react`)?.focus();
                        }}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                ) : null}
              </span>
              {threadOf ? null : (
                <button type="button" id={`${id}-${m.id}-reply`} className="fl-tmc-tool" aria-label={l.reply} title={l.reply} onClick={() => openThread(m.id)}>
                  <Glyph name="chat" />
                </button>
              )}
            </div>
          )}
        </article>
      </Fragment>
    );
  };

  const group = (kind: ChatChannel["kind"]) => channels.filter((c) => c.kind === kind);
  const label = (c: ChatChannel) => (c.kind === "channel" ? `#${c.name}` : c.name);

  return (
    <section className="fl-tmc" aria-labelledby={`${id}-title`} data-fl="t.app-team-chat">
      <div className={["fl-tmc-grid", thread ? "has-thread" : ""].filter(Boolean).join(" ")}>
      <nav
        className={railOpen ? "fl-tmc-rail is-open" : "fl-tmc-rail"}
        aria-labelledby={`${id}-title`}
        onKeyDown={(e) => {
          if (e.key === "Escape" && railOpen) {
            e.preventDefault();
            setRailOpen(false);
            document.getElementById(`${id}-switch`)?.focus();
          }
        }}
      >
        <div className="fl-tmc-top">
          <h2 id={`${id}-title`} className="fl-tmc-ws">
            {title}
          </h2>
          <button type="button" id={`${id}-switch`} className="fl-tmc-switch" aria-expanded={railOpen} aria-controls={`${id}-rail`} aria-label={`${l.switchChannel}, now ${channel ? label(channel) : ""}`} onClick={() => setRailOpen((o) => !o)}>
            <span>{channel ? label(channel) : l.channels}</span>
            {channels.some((c) => c.unread) ? <span className="fl-tmc-dot" aria-hidden="true" /> : null}
            <Icon name="chevron-down" />
          </button>
        </div>
        <div className="fl-tmc-fold" id={`${id}-rail`}>
          <div className="fl-tmc-clip">
            {(["channel", "dm"] as const).map((kind) => (
              <div key={kind} className="fl-tmc-group">
                <p className="fl-tmc-label" id={`${id}-${kind}`}>
                  {kind === "channel" ? l.channels : l.direct}
                </p>
                <ul role="list" aria-labelledby={`${id}-${kind}`}>
                  {group(kind).map((c) => {
                    const dm = c.kind === "dm" ? members.find((m) => m.name === c.name) : undefined;
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          className={["fl-tmc-chan", c.id === current ? "is-current" : "", c.unread ? "is-unread" : ""].filter(Boolean).join(" ")}
                          aria-current={c.id === current ? "page" : undefined}
                          aria-label={`${label(c)}${c.unread ? `, ${c.unread} unread` : ""}${c.mentions ? `, ${c.mentions} ${c.mentions === 1 ? "mention" : "mentions"}` : ""}`}
                          onClick={() => openChannel(c.id)}
                        >
                          {dm ? <Avatar name={dm.name} size={20} tone={dm.tone ?? "e"} status={dm.status} decorative /> : <span className="fl-tmc-hash" aria-hidden="true">#</span>}
                          <span className="fl-tmc-name">{c.name}</span>
                          {c.mentions ? (
                            <span className="fl-tmc-at" aria-hidden="true">
                              @{c.mentions}
                            </span>
                          ) : c.unread ? (
                            <span className="fl-tmc-unread" aria-hidden="true">
                              {c.unread > 99 ? "99+" : c.unread}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </nav>

      <div className="fl-tmc-main">
        <header className="fl-tmc-head">
          <h3>{channel ? label(channel) : ""}</h3>
          {channel?.topic ? <p>{channel.topic}</p> : null}
        </header>
        <div className="fl-tmc-log" ref={logRef} role="log" aria-label={`Messages in ${channel ? label(channel) : ""}`} tabIndex={0}>
          {list.length === 0 ? (
            <EmptyState variant="first-use" title={l.empty}>
              {l.emptyText}
            </EmptyState>
          ) : (
            list.map((m, i) => message(m, i))
          )}
        </div>
        <Composer key={current} id={`${id}-main`} label={`${l.message} ${channel ? label(channel) : ""}`} placeholder={`${l.message} ${channel ? label(channel) : ""}`} members={members.filter((m) => m.id !== me)} sendLabel={l.send} onSend={(t) => post(t)} />
      </div>

      {parent ? (
        <aside
          className="fl-tmc-thread"
          aria-labelledby={`${id}-thread-title`}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              closeThread();
            }
          }}
        >
          <header className="fl-tmc-head fl-tmc-thead">
            <div>
              <h3 id={`${id}-thread-title`}>{l.thread}</h3>
              <p>{channel ? label(channel) : ""}</p>
            </div>
            <Button variant="tertiary" size={32} icon="close" iconOnly onClick={closeThread}>
              {l.close}
            </Button>
          </header>
          <div className="fl-tmc-log fl-tmc-tlog" ref={threadRef} role="log" aria-label="Replies" tabIndex={0}>
            {message({ ...parent, replies: undefined }, 0, parent.id)}
            <p className="fl-tmc-count-rule">
              <span>
                {parent.replies?.length ?? 0} {(parent.replies?.length ?? 0) === 1 ? "reply" : "replies"}
              </span>
            </p>
            {(parent.replies ?? []).map((r, i) => message(r, i, parent.id))}
          </div>
          <Composer key={parent.id} id={`${id}-thread`} label={`Reply to ${byId[parent.by]?.name ?? "thread"}`} placeholder="Reply…" members={members.filter((m) => m.id !== me)} sendLabel={l.send} onSend={(t) => post(t, parent.id)} />
        </aside>
      ) : null}
      </div>

      <p className="fl-sr" role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Northlight Studio",
  me: "u-ana",
  startIn: "c-general",
  members: [
    { id: "u-ana", name: "Ana Ruiz", handle: "ana", tone: "a", status: "online" },
    { id: "u-maya", name: "Maya Chen", handle: "maya", tone: "b", status: "online" },
    { id: "u-leo", name: "Leo Park", handle: "leo", tone: "c", status: "away" },
    { id: "u-sam", name: "Sam Okafor", handle: "sam", tone: "d", status: "offline" },
    { id: "u-mark", name: "Marcus Bell", handle: "marcus", tone: "e", status: "online" },
  ] as ChatMember[],
  channels: [
    { id: "c-general", name: "general", kind: "channel", topic: "Studio-wide news and questions" },
    { id: "c-launch", name: "launch", kind: "channel", topic: "Autumn site launch, Oct 28", unread: 2, mentions: 1 },
    { id: "c-design", name: "design", kind: "channel", topic: "Reviews, files and feedback" },
    { id: "d-maya", name: "Maya Chen", kind: "dm", unread: 1 },
    { id: "d-leo", name: "Leo Park", kind: "dm" },
  ] as ChatChannel[],
  messages: {
    "c-general": [
      { id: "g1", by: "u-sam", at: "2026-10-21T08:52:00", text: "Morning all. The printer on floor two is fixed.", reactions: [{ emoji: "🎉", by: ["u-maya", "u-leo"] }] },
      { id: "g2", by: "u-maya", at: "2026-10-21T09:05:00", text: "Friday lunch is at Lupa this week. Reply here if you're in.", replies: [
        { id: "g2r1", by: "u-leo", at: "2026-10-21T09:07:00", text: "In!" },
        { id: "g2r2", by: "u-mark", at: "2026-10-21T09:11:00", text: "Count me in, I'll book for eight." },
      ] },
      { id: "g3", by: "u-leo", at: "2026-10-21T09:30:00", text: "@ana the client deck is in the shared drive whenever you're ready.", reactions: [{ emoji: "👍", by: ["u-ana"] }] },
    ],
    "c-launch": [
      { id: "l1", by: "u-mark", at: "2026-10-20T16:40:00", text: "Staging is up. Please click through the checkout before tomorrow." },
      { id: "l2", by: "u-maya", at: "2026-10-21T09:12:00", text: "Found a spacing bug on the pricing page, fixing now.", reactions: [{ emoji: "👀", by: ["u-leo"] }] },
      { id: "l3", by: "u-leo", at: "2026-10-21T09:48:00", text: "@ana can you sign off the hero copy by noon?" },
    ],
    "c-design": [{ id: "d1", by: "u-maya", at: "2026-10-21T08:30:00", text: "New icon set is uploaded. Feedback welcome." }],
    "d-maya": [{ id: "m1", by: "u-maya", at: "2026-10-21T09:55:00", text: "Got five minutes for a quick call?" }],
    "d-leo": [],
  } as Record<string, ChatMessage[]>,
};

export default function TeamChatSheet() {
  const failed = useRef(false);
  return (
    <section className="fl-section fl-section--canvas" aria-label="Team chat">
      <div className="fl-wrap">
        <TeamChat
          {...SAMPLE}
          send={async (channelId) => {
            await wait(600);
            // The first message sent in #design fails, so Retry can be seen.
            if (channelId === "c-design" && !failed.current) {
              failed.current = true;
              throw new Error("Network");
            }
          }}
        />
      </div>
    </section>
  );
}
