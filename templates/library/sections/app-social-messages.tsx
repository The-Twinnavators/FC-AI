/** @flowcode-library app-social-messages · Direct messages (App screens)
 * Catalog ID: t.app-social-messages (template)
 * Function: An app screen: a social platform's direct messages with a searchable conversation list, unread dots, pinned and muted threads, grouped message bubbles with read receipts, a link preview and a photo, and a composer that sends with Enter, assembled from catalog avatars, text fields and buttons.
 * Use it as: Copy app-social-messages.tsx (FlowCode brings the components it uses); replace SAMPLE with the platform's own people and conversations, and load and send messages, read receipts, pins and mutes through the app's own data instead of this screen's memory.
 * Built from: c.avatar.person, c.text-field.outlined, c.button.primary, c.button.secondary, c.button.tertiary
 * Look: A left rail of sections with an unread count, a searchable list of conversations with unread dots (one pinned, one muted), and the open thread: the person's header, chat bubbles grouped by day and sender with a read receipt, a shared link card and a photo, and a composer at the bottom.
 * Use cases: social network; community app; direct messages; private chat; marketplace buyer and seller chat; member messaging; creator platform inbox; team or club chat
 * Jobs to be done: read and reply to private messages; see which conversations are unread; find an old conversation; share a link or photo with someone; pin or mute a conversation
 * Keywords: app, social, messages, chat, inbox, direct messages, conversation, community
 */
/**
 * App screen: a social platform's direct messages. The same left rail as the feed (Commons, with Messages current and
 * a count of unread conversations), a conversation list with search, unread dots, the last message and its time (one
 * thread pinned to the top, one muted), and the open thread: the person's header with their avatar, name and when they
 * were last active, messages grouped by day and by sender with a read receipt under your latest, one shared link
 * preview and one photo. The composer sends: Enter sends, Shift + Enter starts a new line, and each conversation keeps
 * its own draft. Picking another conversation opens it and clears its unread dot. Up and Down arrows move through the
 * list; on narrow screens the list shows first and a conversation opens full width with a Back button. Make it the
 * app's own: replace SAMPLE with the platform's real people and conversations, and load and send messages through the
 * app's own data instead of this screen's memory.
 */
/**
 * Assembled from: side rail (inline nav, count pills) > conversation list (c.text-field.outlined search, c.avatar,
 * inline rows with unread dot, pin and mute marks) > thread header (c.button.tertiary Back, c.avatar with presence,
 * c.button.tertiary pin and mute toggles) > message log (day separators, grouped bubbles, link preview card, photo drawn
 * in SVG, read receipt) > composer (c.text-field.outlined multiline, c.button.primary Send).
 */
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";
import { Avatar, type AvatarTone } from "./avatars-variants";
import { TextField } from "./text-fields-states";

type Receipt = "sent" | "delivered" | "read";
type LinkCard = { domain: string; title: string; text: string };
type Msg = { id: string; from: "me" | "them"; day: string; time: string; text: string; link?: LinkCard; photo?: string; status?: Receipt; readAt?: string; fresh?: boolean };
type Convo = { id: string; name: string; handle: string; active: string; pinned: boolean; muted: boolean; unread: number; messages: Msg[] };

// flowcode:sample
const SAMPLE = {
  product: "Commons",
  mark: "C",
  me: { name: "Maya Brooks", handle: "@mayabrooks" },
  nav: [
    { id: "home", label: "Home", icon: "home" },
    { id: "explore", label: "Explore", icon: "search" },
    { id: "notifications", label: "Notifications", icon: "bell" },
    { id: "messages", label: "Messages", icon: "mail" },
    { id: "profile", label: "Profile", icon: "user" },
  ],
  notificationCount: 3,
  title: "Messages",
  searchLabel: "Search messages",
  searchHint: "Search people and messages",
  noMatches: "No conversations match",
  pinned: "Pinned",
  muted: "Muted",
  you: "You",
  sentPhoto: "Sent a photo",
  sharedLink: "Shared a link",
  back: "Back to messages",
  composeLabel: "Write a message to",
  composeHint: "Write a message",
  composeKeys: "Enter to send, Shift + Enter for a new line",
  send: "Send",
  today: "Today",
  receipts: { sent: "Sent", delivered: "Delivered", read: "Read" },
  elsewhere: {
    home: "12 new posts from people you follow since this morning.",
    explore: "#LibraryOfThings is trending in your city with 4.8K posts.",
    notifications: "Priya Natarajan liked your post about the bike lane meeting, and 2 more.",
    profile: "Maya Brooks · 1,086 followers · 214 following",
  } as Record<string, string>,
  conversations: [
    {
      id: "c1",
      name: "Ana Lima",
      handle: "@analima",
      active: "now",
      pinned: true,
      muted: false,
      unread: 0,
      messages: [
        { id: "a1", from: "them", day: "Yesterday", time: "6:12 PM", text: "Did you see the agenda for Thursday's council meeting is up?" },
        {
          id: "a2",
          from: "them",
          day: "Yesterday",
          time: "6:12 PM",
          text: "Item 7 is the bike lanes.",
          link: { domain: "riverton.gov", title: "City Council agenda, Thursday, October 23", text: "Item 7: protected bike lanes on Grand Avenue. Public comment opens at 6:30 PM." },
        },
        { id: "a3", from: "me", day: "Yesterday", time: "6:30 PM", text: "Just saw it. Item 7 is the one everyone keeps asking me about." },
        { id: "a4", from: "me", day: "Yesterday", time: "6:31 PM", text: "I'll write it up for Sunday's newsletter." },
        { id: "a5", from: "them", day: "Today", time: "9:40 AM", text: "Are you covering the council vote on Thursday?" },
        { id: "a6", from: "them", day: "Today", time: "9:41 AM", text: "I can send my notes from the planning commission if that helps." },
        { id: "a7", from: "me", day: "Today", time: "9:48 AM", text: "Yes, please! Here's the sketch the neighborhood group made.", photo: "Sketch of Grand Avenue with a green protected bike lane between the sidewalk and the parked cars" },
        { id: "a8", from: "me", day: "Today", time: "9:49 AM", text: "Send your notes whenever. I'm drafting tonight.", status: "read", readAt: "9:52 AM" },
      ],
    },
    {
      id: "c2",
      name: "Diego Alvarez",
      handle: "@diegoalvarez",
      active: "5m ago",
      pinned: false,
      muted: false,
      unread: 2,
      messages: [
        { id: "d1", from: "me", day: "Today", time: "8:02 AM", text: "Is there any basil left from the rooftop beds?", status: "read", readAt: "8:10 AM" },
        { id: "d2", from: "them", day: "Today", time: "10:15 AM", text: "Saved you two plants. They're on the bench by the door." },
        { id: "d3", from: "them", day: "Today", time: "10:16 AM", text: "Grab them before Saturday or the zucchini crowd will." },
      ],
    },
    {
      id: "c3",
      name: "Marcus Reed",
      handle: "@marcusreed",
      active: "1h ago",
      pinned: false,
      muted: false,
      unread: 0,
      messages: [
        { id: "m1", from: "them", day: "Today", time: "8:30 AM", text: "The tool library list is in the shared folder." },
        { id: "m2", from: "me", day: "Today", time: "8:41 AM", text: "Perfect, I'll link it in the newsletter.", status: "delivered" },
      ],
    },
    {
      id: "c4",
      name: "Hana Sato",
      handle: "@hanasato",
      active: "2h ago",
      pinned: false,
      muted: true,
      unread: 3,
      messages: [
        { id: "h1", from: "them", day: "Yesterday", time: "8:20 PM", text: "Finished the city planning book. You can borrow it next." },
        { id: "h2", from: "them", day: "Today", time: "7:05 AM", text: "Also found a second copy of the cookbook at the swap." },
        { id: "h3", from: "them", day: "Today", time: "7:06 AM", text: "Coffee on Saturday?" },
      ],
    },
    {
      id: "c5",
      name: "Lena Fischer",
      handle: "@lenafischer",
      active: "yesterday",
      pinned: false,
      muted: false,
      unread: 0,
      messages: [
        { id: "l1", from: "me", day: "Yesterday", time: "7:02 AM", text: "The river path is flat until the bridge, then it climbs. Start slow." },
        { id: "l2", from: "them", day: "Yesterday", time: "11:48 AM", text: "Thanks for the route tips! Finished in 58 minutes." },
      ],
    },
    {
      id: "c6",
      name: "Tom Becker",
      handle: "@tombecker",
      active: "3d ago",
      pinned: false,
      muted: false,
      unread: 0,
      messages: [
        { id: "t1", from: "them", day: "Monday", time: "4:15 PM", text: "The bench for the library reading corner is finished." },
        { id: "t2", from: "me", day: "Monday", time: "5:02 PM", text: "It looks wonderful. Thank you, Tom.", status: "read", readAt: "5:20 PM" },
      ],
    },
  ] as Convo[],
};

type View = (typeof SAMPLE.nav)[number]["id"];

const TONES: AvatarTone[] = ["a", "b", "c", "d", "e"];
const toneFor = (name: string) => TONES[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % TONES.length];
const PIN = "M9 4h6l-1 5 3 3v2H7v-2l3-3zM12 14v6";
const MUTE = "M18 8a6 6 0 0 0-9.3-5M6 8c0 7-3 9-3 9h14M13.7 21a2 2 0 0 1-3.4 0M3 3l18 18";

/** A small inline glyph for the shapes the shared icon set doesn't have (pin, muted bell). */
function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const firstName = (name: string) => name.split(" ")[0];
const activeText = (c: Convo) => (c.active === "now" ? "Active now" : `Active ${c.active}`);
const preview = (m: Msg) => (m.photo && !m.text ? SAMPLE.sentPhoto : m.link && !m.text ? SAMPLE.sharedLink : m.text);
const stamp = (m: Msg) => (m.day === SAMPLE.today ? m.time : m.day);
const clock = () => new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/** The shared photo, drawn from the theme's colors: a street sketch with a protected bike lane. */
function Photo({ alt }: { alt: string }) {
  return (
    <figure className="fl-sdm-photo">
      <svg viewBox="0 0 320 200" role="img" aria-label={alt} preserveAspectRatio="xMidYMid slice">
        <rect className="fl-sdm-photo__paper" width="320" height="200" />
        <path className="fl-sdm-photo__block" d="M0 0h86v58H0zM110 0h96v46H110zM230 0h90v64H230z" />
        <path className="fl-sdm-photo__walk" d="M0 70h320v22H0z" />
        <path className="fl-sdm-photo__lane" d="M0 92h320v30H0z" />
        <path className="fl-sdm-photo__curb" d="M0 122h320v8H0z" />
        <path className="fl-sdm-photo__road" d="M0 130h320v70H0z" />
        <path className="fl-sdm-photo__dash" d="M10 166h34M74 166h34M138 166h34M202 166h34M266 166h34" />
        <g className="fl-sdm-photo__car">
          <rect x="40" y="134" width="56" height="22" rx="6" />
          <rect x="190" y="134" width="56" height="22" rx="6" />
        </g>
        <g className="fl-sdm-photo__bike">
          <circle cx="132" cy="113" r="7" />
          <circle cx="156" cy="113" r="7" />
          <path d="M132 113l9-12h10l5 12M141 101l-3-5h-4M151 101l-2-4" />
        </g>
        <g className="fl-sdm-photo__tree">
          <circle cx="40" cy="80" r="9" />
          <circle cx="164" cy="80" r="9" />
          <circle cx="280" cy="80" r="9" />
        </g>
      </svg>
      <figcaption className="fl-sr">{alt}</figcaption>
    </figure>
  );
}

/** A shared link, shown as a preview card with a small map drawn from the theme's colors. */
function LinkPreview({ link }: { link: LinkCard }) {
  return (
    <div className="fl-sdm-link">
      <svg className="fl-sdm-link__thumb" viewBox="0 0 64 64" aria-hidden="true">
        <rect className="fl-sdm-link__ground" width="64" height="64" />
        <path className="fl-sdm-link__street" d="M0 22h64M0 44h64M20 0v64M44 0v64" />
        <path className="fl-sdm-link__route" d="M8 54 20 44h24l12-22" />
        <circle className="fl-sdm-link__dot" cx="56" cy="22" r="4" />
      </svg>
      <div className="fl-sdm-link__body">
        <span className="fl-sdm-link__domain">{link.domain}</span>
        <strong>{link.title}</strong>
        <span className="fl-sdm-link__text">{link.text}</span>
      </div>
    </div>
  );
}

export default function AppSocialMessages() {
  const d = SAMPLE;
  const [view, setView] = useState<View>("messages");
  const [convos, setConvos] = useState<Convo[]>(() => d.conversations.map((c) => ({ ...c, messages: [...c.messages] })));
  const [openId, setOpenId] = useState(d.conversations[0]!.id);
  const [pane, setPane] = useState<"list" | "thread">("list");
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState(d.notificationCount);
  const [say, setSay] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const listPane = useRef<HTMLElement>(null);
  const threadTitle = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const timers = useRef<number[]>([]);

  const open = convos.find((c) => c.id === openId)!;
  const draft = drafts[openId] ?? "";
  const unreadThreads = convos.filter((c) => c.unread > 0 && !c.muted).length;
  const q = query.trim().toLowerCase();
  const sorted = [...convos].sort((a, b) => Number(b.pinned) - Number(a.pinned));
  const shown = q ? sorted.filter((c) => c.name.toLowerCase().includes(q) || c.messages.some((m) => m.text.toLowerCase().includes(q))) : sorted;

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  // The open thread rests on its latest message. Only the thread's own box scrolls; the page never moves.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [openId, open.messages.length, view, pane]);

  // Focus follows a pane change on narrow screens, never the first paint (a live preview must open at its top).
  useEffect(() => {
    if (!moved.current) return;
    const listHidden = !listPane.current || listPane.current.offsetParent === null;
    if (pane === "thread" && listHidden) threadTitle.current?.focus();
    if (pane === "list") listPane.current?.querySelector<HTMLButtonElement>(`[data-id="${openId}"]`)?.focus();
  }, [pane]);

  function go(id: View) {
    setView(id);
    if (id === "notifications") setNotes(0);
  }

  function choose(id: string) {
    moved.current = true;
    setOpenId(id);
    setPane("thread");
    setConvos((cs) => cs.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  }

  function listKeys(e: KeyboardEvent<HTMLUListElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>(".fl-sdm-conv")];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    e.preventDefault();
    const next = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : Math.min(items.length - 1, Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)));
    items[next]?.focus();
  }

  function setReceipt(convoId: string, msgId: string, status: Receipt) {
    setConvos((cs) =>
      cs.map((c) => (c.id === convoId ? { ...c, messages: c.messages.map((m) => (m.id === msgId ? { ...m, status, readAt: status === "read" ? clock() : undefined } : m)) } : c)),
    );
  }

  function send(e?: FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const convoId = openId;
    const msg: Msg = { id: `n${Date.now()}`, from: "me", day: d.today, time: clock(), text, status: "sent", fresh: true };
    setConvos((cs) => cs.map((c) => (c.id === convoId ? { ...c, messages: [...c.messages.map((m): Msg => ({ ...m, fresh: false })), msg] } : c)));
    setDrafts((ds) => ({ ...ds, [convoId]: "" }));
    timers.current.push(window.setTimeout(() => setReceipt(convoId, msg.id, "delivered"), 900));
    if (open.active === "now") timers.current.push(window.setTimeout(() => setReceipt(convoId, msg.id, "read"), 2600));
  }

  function composeKeys(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  function toggle(kind: "pinned" | "muted") {
    const on = !open[kind];
    setConvos((cs) => cs.map((c) => (c.id === openId ? { ...c, [kind]: on } : c)));
    const who = open.name;
    setSay(kind === "pinned" ? (on ? `Pinned ${who} to the top.` : `Unpinned ${who}.`) : on ? `Muted ${who}. Their messages won't count as unread.` : `Unmuted ${who}.`);
  }

  // The thread, grouped by day, then by runs of messages from the same person.
  const days: { day: string; groups: Msg[][] }[] = [];
  for (const m of open.messages) {
    let day = days[days.length - 1];
    if (!day || day.day !== m.day) days.push((day = { day: m.day, groups: [] }));
    const run = day.groups[day.groups.length - 1];
    if (run && run[0]!.from === m.from) run.push(m);
    else day.groups.push([m]);
  }
  const lastMine = [...open.messages].reverse().find((m) => m.from === "me");
  const lastIsMine = open.messages[open.messages.length - 1]?.from === "me";

  return (
    <div className="fl-sdm-app">
      <div className="fl-sdm-layout" data-pane={pane} data-view={view}>
        <aside className="fl-sdm-side">
          <div className="fl-sdm-brand">
            <span className="fl-sdm-mark" aria-hidden="true">
              {d.mark}
            </span>
            <span className="fl-sdm-brand__name">{d.product}</span>
          </div>
          <nav aria-label={d.product}>
            <ul className="fl-sdm-nav">
              {d.nav.map((n) => {
                const count = n.id === "messages" ? unreadThreads : n.id === "notifications" ? notes : 0;
                return (
                  <li key={n.id}>
                    <button type="button" className="fl-sdm-nav__item" aria-current={view === n.id ? "page" : undefined} onClick={() => go(n.id)}>
                      <Icon name={n.icon} />
                      <span className="fl-sdm-nav__label">{n.label}</span>
                      {count > 0 && (
                        <span className="fl-sdm-count">
                          {count}
                          <span className="fl-sr"> unread</span>
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="fl-sdm-me">
            <Avatar name={d.me.name} size={32} tone={toneFor(d.me.name)} decorative />
            <span>
              <strong>{d.me.name}</strong>
              <span className="fl-sdm-meta">{d.me.handle}</span>
            </span>
          </div>
        </aside>

        {view !== "messages" ? (
          <main className="fl-sdm-elsewhere">
            <div className="fl-sdm-elsewhere__card">
              <h1 className="fl-sdm-h1">{d.nav.find((n) => n.id === view)!.label}</h1>
              <p>{d.elsewhere[view]}</p>
              <Button variant="secondary" size={32} icon="mail" onClick={() => go("messages")}>
                Back to {d.title}
              </Button>
            </div>
          </main>
        ) : (
          <>
            <section className="fl-sdm-list" ref={listPane} aria-labelledby="fl-sdm-title">
              <div className="fl-sdm-list__head">
                <h1 id="fl-sdm-title" className="fl-sdm-h1">
                  {d.title}
                </h1>
                <div className="fl-sdm-search">
                  <Icon name="search" />
                  <label htmlFor="fl-sdm-q" className="fl-sr">
                    {d.searchLabel}
                  </label>
                  <TextField id="fl-sdm-q" type="search" size={40} placeholder={d.searchHint} value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
              </div>
              {shown.length === 0 ? (
                <p className="fl-sdm-none">
                  {d.noMatches} “{query.trim()}”.
                </p>
              ) : (
                <ul className="fl-sdm-convs" aria-label="Conversations" onKeyDown={listKeys}>
                  {shown.map((c) => {
                    const last = c.messages[c.messages.length - 1]!;
                    const unread = c.unread > 0;
                    return (
                      <li key={c.id}>
                        <button type="button" className="fl-sdm-conv" data-id={c.id} data-unread={unread || undefined} data-muted={c.muted || undefined} aria-current={c.id === openId ? "true" : undefined} onClick={() => choose(c.id)}>
                          <span className="fl-sdm-face">
                            <Avatar name={c.name} size={44} tone={toneFor(c.name)} decorative />
                            {c.active === "now" && <span className="fl-sdm-presence" aria-hidden="true" />}
                          </span>
                          <span className="fl-sdm-conv__body">
                            <span className="fl-sdm-conv__top">
                              <strong>{c.name}</strong>
                              {c.pinned && (
                                <span className="fl-sdm-flag" title={d.pinned}>
                                  <Glyph d={PIN} />
                                  <span className="fl-sr">, {d.pinned}</span>
                                </span>
                              )}
                              {c.muted && (
                                <span className="fl-sdm-flag" title={d.muted}>
                                  <Glyph d={MUTE} />
                                  <span className="fl-sr">, {d.muted}</span>
                                </span>
                              )}
                              <span className="fl-sdm-conv__time">{stamp(last)}</span>
                            </span>
                            <span className="fl-sdm-conv__last">
                              {last.from === "me" && `${d.you}: `}
                              {preview(last)}
                            </span>
                          </span>
                          {unread && (
                            <span className="fl-sdm-unread">
                              <span className="fl-sr">, {c.unread} unread</span>
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="fl-sdm-thread" aria-labelledby="fl-sdm-with">
              <header className="fl-sdm-thread__head">
                <span className="fl-sdm-back">
                  <Button
                    variant="tertiary"
                    size={40}
                    icon="arrow-left"
                    iconOnly
                    onClick={() => {
                      moved.current = true;
                      setPane("list");
                    }}
                  >
                    {d.back}
                  </Button>
                </span>
                <span className="fl-sdm-face">
                  <Avatar name={open.name} size={40} tone={toneFor(open.name)} decorative />
                  {open.active === "now" && <span className="fl-sdm-presence" aria-hidden="true" />}
                </span>
                <div className="fl-sdm-who">
                  <h2 id="fl-sdm-with" ref={threadTitle} tabIndex={-1} className="fl-sdm-h2">
                    {open.name}
                  </h2>
                  <span className="fl-sdm-meta" data-online={open.active === "now" || undefined}>
                    {open.handle} · {activeText(open)}
                  </span>
                </div>
                <div className="fl-sdm-tools">
                  <button type="button" className="fl-sdm-tool" aria-pressed={open.pinned} title={open.pinned ? "Unpin" : "Pin to top"} onClick={() => toggle("pinned")}>
                    <Glyph d={PIN} />
                    <span className="fl-sr">Pin conversation</span>
                  </button>
                  <button type="button" className="fl-sdm-tool" aria-pressed={open.muted} title={open.muted ? "Unmute" : "Mute"} onClick={() => toggle("muted")}>
                    <Glyph d={MUTE} />
                    <span className="fl-sr">Mute conversation</span>
                  </button>
                </div>
              </header>
              <p className="fl-sr" aria-live="polite">
                {say}
              </p>

              <div className="fl-sdm-scroll" ref={scroller} tabIndex={0} aria-label={`Messages with ${open.name}`}>
                <div className="fl-sdm-log" role="log" aria-live="polite" aria-relevant="additions" key={open.id}>
                  {days.map((day) => (
                    <div key={day.day} className="fl-sdm-day">
                      <h3 className="fl-sdm-day__label">{day.day}</h3>
                      {day.groups.map((run) => {
                        const mine = run[0]!.from === "me";
                        const last = run[run.length - 1]!;
                        return (
                          <div key={run[0]!.id} className="fl-sdm-run" data-mine={mine || undefined}>
                            {!mine && (
                              <span className="fl-sdm-run__face">
                                <Avatar name={open.name} size={32} tone={toneFor(open.name)} decorative />
                              </span>
                            )}
                            <div className="fl-sdm-run__msgs">
                              <span className="fl-sr">{mine ? d.you : open.name}:</span>
                              {run.map((m) => (
                                <div key={m.id} className="fl-sdm-msg" data-fresh={m.fresh || undefined}>
                                  {m.photo && <Photo alt={m.photo} />}
                                  {m.text && <p className="fl-sdm-bubble">{m.text}</p>}
                                  {m.link && <LinkPreview link={m.link} />}
                                </div>
                              ))}
                              <span className="fl-sdm-run__time">
                                {last.time}
                                {mine && lastIsMine && last === lastMine && last.status && (
                                  <span className="fl-sdm-receipt" data-status={last.status}>
                                    {" · "}
                                    {last.status === "read" ? (
                                      <>
                                        <Icon name="check" />
                                        {d.receipts.read} {last.readAt}
                                      </>
                                    ) : (
                                      d.receipts[last.status]
                                    )}
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <form className="fl-sdm-composer" onSubmit={send}>
                <label htmlFor="fl-sdm-draft" className="fl-sr">
                  {d.composeLabel} {open.name}
                </label>
                <TextField
                  multiline
                  autoGrow
                  key={`${openId}-${pane}`}
                  id="fl-sdm-draft"
                  rows={1}
                  placeholder={`${d.composeHint} to ${firstName(open.name)}`}
                  aria-describedby="fl-sdm-keys"
                  value={draft}
                  onChange={(e) => setDrafts((ds) => ({ ...ds, [openId]: e.target.value }))}
                  onKeyDown={composeKeys}
                />
                <Button type="submit" size={40} icon="send" iconOnly disabled={!draft.trim()}>
                  {d.send}
                </Button>
                <span id="fl-sdm-keys" className="fl-sdm-keys">
                  {d.composeKeys}
                </span>
              </form>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
