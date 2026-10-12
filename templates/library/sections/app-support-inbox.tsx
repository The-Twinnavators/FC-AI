/** @flowcode-library app-support-inbox · Support inbox (App screens)
 * Catalog ID: t.app-support-inbox (template)
 * Function: A help-desk inbox screen (t.app-support-inbox) assembled from avatars, chips, list rows, chat bubbles, badges, a text field, buttons and empty states.
 * Use it as: Copy app-support-inbox.tsx (FlowCode brings the components it uses); replace SAMPLE with the app's own conversations, canned replies and customer fields, and send replies through the app's own messaging.
 * Built from: c.avatar.person, c.text-field.outlined, c.chip.filter, c.list-row.link, c.list-row.fact, c.badge.status, c.chat-bubble.mine, c.chat-bubble.theirs, c.button.primary, c.button.secondary, c.button.tertiary, c.empty-state.first-use, c.empty-state.done, c.empty-state.no-results
 * Look: Three panes: a searchable conversation list with filter chips, the selected thread with chat bubbles and a reply box with canned replies, and a customer details column; folds to one column on phones.
 * Use cases: support inbox; help desk; customer messages; ticketing; shared inbox; customer service; live chat inbox; conversations
 * Jobs to be done: answer customer questions quickly; find a customer conversation; track which tickets are open; reply with a saved answer
 * Keywords: app, inbox, support, help desk, messages, chat, filters
 */
/**
 * App screen: support inbox. Three panes: conversations with Open / Pending / Closed filters, a search box and unread
 * dots; the selected conversation's thread with status buttons and a reply box that offers canned replies; and the
 * customer's details. On phones it folds to one column: the list first, then the thread with a "Back" button, with the
 * customer details tucked under a disclosure. Use it for a help desk, a booking app's messages or any shared inbox.
 * Make it the app's own: replace SAMPLE with the app's real conversations, canned replies and customer fields, and
 * send replies through the app's own messaging instead of keeping them on this screen.
 * Assembled from: top bar (inline, c.avatar) > list pane (c.text-field search, c.chip.filter filters, c.list-row.link
 * conversations, c.empty-state) | thread pane (c.badge status, c.chip.filter status buttons, c.chat-bubble messages,
 * c.button canned replies, c.text-field reply, c.button send) | customer pane (c.avatar, c.list-row.fact).
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "./buttons-variants";
import { Avatar } from "./avatars-variants";
import { Badge, type BadgeTone } from "./badges-status";
import { Chip } from "./chips-tags";
import { TextField } from "./text-fields-states";
import { ListRow } from "./lists-rows";
import { EmptyState } from "./empty-states";
import { ChatBubble } from "./chat-bubbles";

// flowcode:sample
const SAMPLE = {
  product: "Kiln Room",
  mark: "K",
  screen: "Inbox",
  agent: { name: "Ada Reyes" },
  searchLabel: "Search conversations",
  searchPlaceholder: "Search by name or subject",
  filters: [
    { id: "open", label: "Open" },
    { id: "pending", label: "Pending" },
    { id: "closed", label: "Closed" },
  ],
  emptyTitle: { open: "Inbox zero", pending: "Nothing waiting on customers", closed: "No closed conversations yet" } as Record<string, string>,
  emptyText: "When a conversation matches, it shows up here.",
  noMatch: "No conversations match your search.",
  noneSelected: "Pick a conversation to read it.",
  back: "Back to inbox",
  replyLabel: "Reply",
  replyPlaceholder: "Write a reply. Press Ctrl+Enter to send.",
  replyError: "Write a message before sending.",
  send: "Send reply",
  sent: "Reply sent.",
  cannedLabel: "Canned replies",
  canned: [
    { title: "Reschedule a class", text: "Happy to move you. I've freed your seat; pick any open evening on the timetable and it will carry over at no cost." },
    { title: "Refund on its way", text: "I've sent the refund to your original payment method. It usually lands in three to five working days." },
    { title: "What to bring", text: "Just bring clothes you don't mind getting clay on. Aprons, tools and clay are all included." },
  ],
  detailsTitle: "Customer",
  conversations: [
    {
      id: "c1",
      status: "open",
      unread: true,
      name: "Maya Lindqvist",
      initials: "ML",
      email: "maya.l@example.com",
      subject: "Can I move my Thursday class?",
      time: "9:41",
      customer: { since: "March 2025", plan: "Open studio member", bookings: 14, spent: "$612", location: "Riverside" },
      messages: [
        { from: "customer", at: "9:41", text: "Hi! I booked wheel throwing for this Thursday but I have to work late. Could I move to next week instead?" },
      ],
    },
    {
      id: "c2",
      status: "open",
      unread: true,
      name: "Jonah Mensah",
      initials: "JM",
      email: "jonah.m@example.com",
      subject: "Gift card not arrived",
      time: "8:15",
      customer: { since: "Last week", plan: "No membership", bookings: 0, spent: "$80", location: "Old Town" },
      messages: [
        { from: "customer", at: "8:15", text: "I bought an $80 gift card for my sister on Saturday and the email never came. Can you resend it?" },
      ],
    },
    {
      id: "c3",
      status: "open",
      unread: false,
      name: "Priya Shah",
      initials: "PS",
      email: "priya.s@example.com",
      subject: "Glaze firing date",
      time: "Yesterday",
      customer: { since: "June 2024", plan: "Six-week course", bookings: 9, spent: "$340", location: "Hillside" },
      messages: [
        { from: "customer", at: "Mon 16:02", text: "When will the bowls from last week's class be glazed and ready to collect?" },
        { from: "agent", at: "Mon 16:20", text: "They go in the kiln on Wednesday. I'll message you as soon as they're out." },
        { from: "customer", at: "Mon 16:25", text: "Perfect, thank you. Can my partner pick them up for me?" },
      ],
    },
    {
      id: "c4",
      status: "pending",
      unread: false,
      name: "Tom Okafor",
      initials: "TO",
      email: "tom.o@example.com",
      subject: "Group booking for a birthday",
      time: "Mon",
      customer: { since: "New", plan: "No membership", bookings: 0, spent: "$0", location: "Docklands" },
      messages: [
        { from: "customer", at: "Mon 11:10", text: "Could we book the studio for eight people on a Saturday afternoon in November?" },
        { from: "agent", at: "Mon 11:40", text: "We'd love to host you. Which Saturday works best, and would you like the two-hour or three-hour session?" },
      ],
    },
    {
      id: "c5",
      status: "closed",
      unread: false,
      name: "Lena Fischer",
      initials: "LF",
      email: "lena.f@example.com",
      subject: "Parking near the studio",
      time: "2 Oct",
      customer: { since: "January 2025", plan: "Open studio member", bookings: 22, spent: "$905", location: "Riverside" },
      messages: [
        { from: "customer", at: "2 Oct 10:02", text: "Is there parking close by?" },
        { from: "agent", at: "2 Oct 10:15", text: "Yes, the car park on Mill Lane is free after 6pm and on weekends, two minutes' walk away." },
      ],
    },
  ],
};

type Conversation = (typeof SAMPLE.conversations)[number];

const STATUS_TONE: Record<string, BadgeTone> = { open: "info", pending: "neutral", closed: "success" };

const SEARCH = "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4";
const BACK = "M19 12H5M11 6l-6 6 6 6";

function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function AppSupportInbox() {
  const d = SAMPLE;
  const [convos, setConvos] = useState<Conversation[]>(d.conversations);
  const [filter, setFilter] = useState("open");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>("c1");
  const [view, setView] = useState<"list" | "thread">("list");
  const [reply, setReply] = useState("");
  const [error, setError] = useState(false);
  const [say, setSay] = useState("");
  const threadEnd = useRef<HTMLDivElement>(null);
  const threadHead = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const q = query.trim().toLowerCase();
  const inFilter = convos.filter((c) => c.status === filter);
  const shown = inFilter.filter((c) => !q || `${c.name} ${c.subject}`.toLowerCase().includes(q));
  const current = convos.find((c) => c.id === selected) ?? null;
  const counts = Object.fromEntries(d.filters.map((f) => [f.id, convos.filter((c) => c.status === f.id).length]));

  useEffect(() => {
    threadEnd.current?.scrollIntoView({ block: "nearest" });
  }, [current?.messages.length]);

  function open(id: string) {
    setSelected(id);
    setConvos((cs) => cs.map((c) => (c.id === id ? { ...c, unread: false } : c)));
    setReply("");
    setError(false);
    setView("thread");
    window.setTimeout(() => threadHead.current?.focus(), 0);
  }

  function back() {
    setView("list");
    const id = selected;
    window.setTimeout(() => id && listRef.current?.querySelector<HTMLElement>('[aria-current="true"]')?.focus(), 0);
  }

  function setStatus(status: string) {
    if (!current) return;
    setConvos((cs) => cs.map((c) => (c.id === current.id ? { ...c, status } : c)));
    setSay(`Conversation with ${current.name} marked ${status}.`);
  }

  function send() {
    if (!current) return;
    const text = reply.trim();
    if (!text) {
      setError(true);
      return;
    }
    const now = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setConvos((cs) => cs.map((c) => (c.id === current.id ? { ...c, status: c.status === "closed" ? "open" : c.status, messages: [...c.messages, { from: "agent", at: now, text }] } : c)));
    setReply("");
    setError(false);
    setSay(d.sent);
  }

  return (
    <div className="fl-as-app">
      <header className="fl-as-top">
        <div className="fl-as-brand">
          <span className="fl-as-mark" aria-hidden="true">
            {d.mark}
          </span>
          <span className="fl-as-brand__name">{d.product}</span>
        </div>
        <h1 className="fl-as-top__title">{d.screen}</h1>
        <div className="fl-as-top__end">
          <Avatar name={d.agent.name} />
        </div>
      </header>

      <p className="fl-sr" aria-live="polite">
        {say}
      </p>

      <div className="fl-as-inbox" data-view={view}>
        <section className="fl-as-inbox__list" aria-label="Conversations">
          <div className="fl-as-inbox__tools">
            <div className="fl-as-search">
              <label htmlFor="fl-as-in-q" className="fl-sr">
                {d.searchLabel}
              </label>
              <Glyph d={SEARCH} />
              <TextField id="fl-as-in-q" type="search" placeholder={d.searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="fl-as-chips" role="group" aria-label="Show conversations that are">
              {d.filters.map((f) => (
                <Chip key={f.id} selected={filter === f.id} onClick={() => setFilter(f.id)}>
                  {f.label} <span className="fl-as-chip__n">{counts[f.id]}</span>
                </Chip>
              ))}
            </div>
          </div>
          {shown.length === 0 ? (
            inFilter.length === 0 ? (
              <EmptyState variant={filter === "open" ? "done" : "first-use"} icon="mail" title={d.emptyTitle[filter]}>
                {d.emptyText}
              </EmptyState>
            ) : (
              <EmptyState
                variant="no-results"
                title={d.noMatch}
                action={
                  <Button variant="tertiary" size={32} onClick={() => setQuery("")}>
                    Clear search
                  </Button>
                }
              />
            )
          ) : (
            <ul ref={listRef} className="fl-as-convos fl-ctl-rows fl-ctl-rows--links">
              {shown.map((c) => (
                <ListRow
                  key={c.id}
                  variant="link"
                  lead={<Avatar name={c.name} size={32} decorative />}
                  title={c.name}
                  meta={
                    <>
                      <span className="fl-as-convo__subject" style={{ display: "block" }}>
                        {c.subject}
                      </span>
                      <span className="fl-as-convo__preview">{c.messages[c.messages.length - 1].text}</span>
                    </>
                  }
                  aside={c.time}
                  unread={c.unread}
                  current={selected === c.id}
                  onClick={(e) => {
                    e.preventDefault();
                    open(c.id);
                  }}
                />
              ))}
            </ul>
          )}
        </section>

        <section className="fl-as-inbox__thread" aria-labelledby={current ? "fl-as-in-subject" : undefined} aria-label={current ? undefined : "Conversation"}>
          {!current ? (
            <EmptyState title={d.noneSelected} icon="mail" />
          ) : (
            <>
              <div className="fl-as-thread__head">
                <span className="fl-as-backbtn">
                  <Button variant="tertiary" size={32} onClick={back}>
                    <Glyph d={BACK} />
                    {d.back}
                  </Button>
                </span>
                <div>
                  <h2 id="fl-as-in-subject" ref={threadHead} tabIndex={-1} className="fl-as-h2">
                    {current.subject}
                  </h2>
                  <span className="fl-meta">
                    {current.name} {"\u00b7"}{" "}
                    <Badge tone={STATUS_TONE[current.status] ?? "neutral"} style={{ textTransform: "capitalize" }}>
                      {current.status}
                    </Badge>
                  </span>
                </div>
                <div className="fl-as-thread__actions" role="group" aria-label="Set status">
                  {d.filters.map((f) => (
                    <Chip key={f.id} selected={current.status === f.id} onClick={() => setStatus(f.id)}>
                      {f.label}
                    </Chip>
                  ))}
                </div>
              </div>

              <ol className="fl-as-msgs" aria-label="Messages">
                {current.messages.map((m, i) => (
                  <ChatBubble key={i} first variant={m.from === "agent" ? "mine" : "theirs"} name={m.from === "agent" ? d.agent.name : current.name} at={m.at}>
                    {m.text}
                  </ChatBubble>
                ))}
              </ol>
              <div ref={threadEnd} />

              <form
                className="fl-as-reply"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                <div className="fl-as-canned" role="group" aria-label={d.cannedLabel}>
                  <span className="fl-meta">{d.cannedLabel}:</span>
                  {d.canned.map((c) => (
                    <Button
                      key={c.title}
                      variant="secondary"
                      size={24}
                      onClick={() => {
                        setReply(c.text);
                        setError(false);
                      }}
                    >
                      {c.title}
                    </Button>
                  ))}
                </div>
                <label htmlFor="fl-as-in-reply" className="fl-sr">
                  {d.replyLabel} to {current.name}
                </label>
                <TextField
                  multiline
                  id="fl-as-in-reply"
                  rows={3}
                  placeholder={d.replyPlaceholder}
                  value={reply}
                  invalid={error}
                  aria-describedby={error ? "fl-as-in-err" : undefined}
                  onChange={(e) => {
                    setReply(e.target.value);
                    if (error) setError(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <div className="fl-as-reply__foot">
                  {error ? (
                    <p id="fl-as-in-err" className="fl-as-error">
                      {d.replyError}
                    </p>
                  ) : (
                    <span className="fl-meta">{say === d.sent ? d.sent : `Replying as ${d.agent.name}`}</span>
                  )}
                  <Button type="submit" size={40}>
                    {d.send}
                  </Button>
                </div>
              </form>
            </>
          )}
        </section>

        {current && (
          <aside className="fl-as-inbox__details" aria-label={d.detailsTitle}>
            <details open className="fl-as-disclose">
              <summary>{d.detailsTitle}</summary>
              <div className="fl-as-customer">
                <div className="fl-person">
                  <Avatar name={current.name} />
                  <div>
                    <strong>{current.name}</strong>
                    <span>{current.email}</span>
                  </div>
                </div>
                <dl className="fl-ctl-rows fl-ctl-rows--facts">
                  <ListRow variant="fact" title="Customer since">
                    {current.customer.since}
                  </ListRow>
                  <ListRow variant="fact" title="Plan">
                    {current.customer.plan}
                  </ListRow>
                  <ListRow variant="fact" title="Classes booked">
                    {current.customer.bookings}
                  </ListRow>
                  <ListRow variant="fact" title="Total spent">
                    {current.customer.spent}
                  </ListRow>
                  <ListRow variant="fact" title="Nearest studio">
                    {current.customer.location}
                  </ListRow>
                </dl>
                <a className="fl-link" href="#booking-history">
                  See {current.name.split(" ")[0]}'s bookings
                </a>
              </div>
            </details>
          </aside>
        )}
      </div>
    </div>
  );
}
