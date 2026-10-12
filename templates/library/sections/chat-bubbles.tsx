/** @flowcode-library chat-bubbles · Chat: bubbles, grouping, delivery and the message that failed (Small components)
 * Catalog ID: c.chat-bubble (component)
 * Function: The chat bubble (c.chat-bubble), one message in a thread with side, grouping, delivery status and typing; the reference sheet shows a live conversation and an assistant reply with a code block and actions (the thread and composer stay specimen markup).
 * Use it as: import { ChatBubble } from "./chat-bubbles"; <ol className="fl-ctl-chat-log" role="log" aria-live="polite"><ChatBubble variant?="mine"|"theirs"|"assistant" name at? first? status?="sending"|"sent"|"read"|"failed" typing? streaming? actions?={<Button .../>} onRetry?>message text or rich content (paragraphs, lists, code)</ChatBubble></ol>
 * Variants: c.chat-bubble.mine - your own message: right-aligned, filled with the accent color, with a delivery line (Sending, Sent, Read, or Not sent with Try again); c.chat-bubble.theirs - someone else's message: left-aligned on a sunken surface with their avatar on the first of a run; typing shows animated dots; c.chat-bubble.assistant - an AI reply: full width with no bubble fill, room for paragraphs, lists and code blocks, an actions row underneath (Copy, Regenerate, thumbs) and a working indicator while streaming
 * Built from: c.avatar, c.button, c.ai-indicator.working
 * Look: A rounded speech bubble on one side of a thread, with a name and time above the first of a run, a small avatar on their side and a delivery line under yours. An assistant reply runs full width without a bubble, with an actions row underneath.
 * Tokens: --color-accent --color-on-accent --color-surface-sunken --color-danger --color-text --color-text-muted --radius-lg --space-2 --space-3 --text-sm --text-xs
 * Use cases: a support thread; client messages; an assistant conversation; comments on a shoot; a team channel
 * Jobs to be done: follow who said what; know my message arrived; send another one; retry one that failed
 * Keywords: chat, message, bubble, thread, timestamp, delivered, read receipt, typing, retry
 */
/**
 * A conversation, with the four things a chat has to get right: whose message is whose, when one person says several
 * things in a row, whether a message actually arrived, and what happens when one does not.
 *
 * It is live. Type and send; the reply comes back after a moment, with the typing indicator in between. Consecutive
 * messages from the same person group under one name and one avatar rather than repeating both. One message is left
 * failed, with a retry, because every chat has one and almost no mock-up shows it.
 *
 * Make it the app's own: replace the people. Keep the thread as a log, so new messages are announced politely rather
 * than interrupting whatever is being read.
 */
/**
 * How to try it
 * - Type a message and send it: it goes sending, then sent, then read, and a reply is typed back.
 * - Send two in a row: they group under one name and one avatar.
 * - Press "Try again" on the message that failed.
 *
 * Dependencies: React (useEffect, useRef, useState), and the library's own inline icon set ("./icons"), which is a table of
 * SVG paths rather than an icon package. Nothing else — no package to install and nothing fetched at run time. The styles
 * are the library's own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs in a
 * built app exactly as it runs here.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { Avatar } from "./avatars-variants";
import { Button } from "./buttons-variants";
import { AiIndicator } from "./ai-indicators";

// ── c.chat-bubble: one message in a thread. Put these inside <ol className="fl-ctl-chat-log" role="log" aria-live="polite">. ──

export type ChatBubbleVariant = "mine" | "theirs" | "assistant";
export type ChatBubbleStatus = "sending" | "sent" | "read" | "failed";

// Written out in full (not built from the variant name) so a build finds every class the bubble needs.
const SIDE: Record<ChatBubbleVariant, string> = { mine: "fl-ctl-msg--me", theirs: "fl-ctl-msg--them", assistant: "fl-ctl-msg--ai" };
const STATE_TEXT: Record<Exclude<ChatBubbleStatus, "failed">, string> = { sending: "Sending…", sent: "Sent", read: "Read" };

export function ChatBubble({ variant = "theirs", name, at, first, status, typing, onRetry, actions, streaming, className, children }: {
  variant?: ChatBubbleVariant;
  /** Who wrote it. Shown above the first message of a run, and by the avatar on their side. */
  name: string;
  /** When it was sent, shown beside the name. */
  at?: string;
  /** The first message of a run from one person: shows the name, time and (for theirs) the avatar. */
  first?: boolean;
  /** Delivery, for your own messages: sending, sent, read, or failed (which offers a retry). */
  status?: ChatBubbleStatus;
  /** Three animated dots instead of text: they are typing. */
  typing?: boolean;
  /** Pressed on "Try again" in a failed message. */
  onRetry?: () => void;
  /** A row under the message: Copy, Regenerate, thumbs and the like. */
  actions?: ReactNode;
  /** Assistant only: the reply is still being written; shows the working indicator. */
  streaming?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const cls = ["fl-ctl-msg", SIDE[variant], first || typing ? "is-first" : "", status === "failed" ? "is-failed" : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <li className={cls} data-fl={`c.chat-bubble.${variant}`}>
      {variant === "theirs" ? (
        <span className="fl-ctl-msg-face" aria-hidden="true">
          {first || typing ? <Avatar name={name} size={24} tone="a" decorative /> : null}
        </span>
      ) : null}
      <span className="fl-ctl-msg-col">
        {first && !typing ? (
          <span className="fl-ctl-msg-who">
            {variant === "mine" ? "You" : name}
            {at ? <> &middot; {at}</> : null}
          </span>
        ) : null}
        {typing ? (
          <span className="fl-ctl-bubble fl-ctl-bubble--typing">
            <span className="fl-sr">{name} is typing</span>
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </span>
        ) : (
          <span className="fl-ctl-bubble">{children}</span>
        )}
        {actions ? (
          <span className="fl-ctl-msg-actions" role="group" aria-label="Message actions">
            {actions}
          </span>
        ) : null}
        {variant === "assistant" && streaming ? <AiIndicator variant="working" label="Writing" /> : null}
        {variant === "mine" && status ? (
          <span className="fl-ctl-msg-state">
            {status === "failed" ? (
              <>
                Not sent
                <button type="button" className="fl-ctl-msg-retry" onClick={onRetry}>
                  <Icon name="refresh" /> Try again
                </button>
              </>
            ) : (
              STATE_TEXT[status]
            )}
          </span>
        ) : null}
      </span>
    </li>
  );
}

type Msg = { id: number; who: "them" | "me"; text: string; at: string; state?: "sending" | "sent" | "read" | "failed" };

// flowcode:sample
const SAMPLE = {
  them: { name: "Ana Moreau" },
  start: [
    { id: 1, who: "them", text: "Morning! Are we still on for the 12th?", at: "9:02" },
    { id: 2, who: "them", text: "The venue just asked for a timing sheet.", at: "9:02" },
    { id: 3, who: "me", text: "Yes, all booked. I will send the timings this afternoon.", at: "9:14", state: "read" },
    { id: 4, who: "me", text: "Do they need the second shooter's name too?", at: "9:14", state: "failed" },
  ] as Msg[],
  replies: [
    "They do, yes - for the guest list.",
    "Perfect, thank you.",
    "One more thing: is parking sorted?",
    "Got it. See you on the 12th.",
  ],
};

export default function ChatBubbles() {
  const d = SAMPLE;
  const [msgs, setMsgs] = useState<Msg[]>(d.start);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const seq = useRef(100);
  const reply = useRef(0);

  // Sending settles, then the other side answers: the whole round trip, so the states are seen rather than listed.
  useEffect(() => {
    const pending = msgs.find((m) => m.state === "sending");
    if (!pending) return;
    const settle = window.setTimeout(() => {
      setMsgs((v) => v.map((m) => (m.id === pending.id ? { ...m, state: "sent" } : m)));
      setTyping(true);
    }, 700);
    return () => window.clearTimeout(settle);
  }, [msgs]);

  useEffect(() => {
    if (!typing) return;
    const t = window.setTimeout(() => {
      seq.current += 1;
      const r = d.replies[reply.current % d.replies.length];
      reply.current += 1;
      setTyping(false);
      setMsgs((v) => [...v.map((m) => (m.state === "sent" ? { ...m, state: "read" as const } : m)), { id: seq.current, who: "them", text: r, at: "now" }]);
    }, 1400);
    return () => window.clearTimeout(t);
  }, [typing, d.replies]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    seq.current += 1;
    setMsgs((v) => [...v, { id: seq.current, who: "me", text: t, at: "now", state: "sending" }]);
    setText("");
  };

  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-chat">
        <div className="fl-ctl-chat-head">
          <Avatar name={d.them.name} size={40} tone="a" decorative />
          <span>
            <strong>{d.them.name}</strong>
            <span className="fl-ctl-matrix-what">
              <span className="fl-ctl-dot fl-ctl-dot--online" aria-hidden="true" /> Here now
            </span>
          </span>
        </div>

        <ol className="fl-ctl-chat-log" role="log" aria-live="polite" aria-label={`Conversation with ${d.them.name}`}>
          {msgs.map((m, n) => (
            <ChatBubble
              key={m.id}
              variant={m.who === "me" ? "mine" : "theirs"}
              name={d.them.name}
              at={m.at}
              first={n === 0 || msgs[n - 1].who !== m.who}
              status={m.state}
              onRetry={() => setMsgs((v) => v.map((x) => (x.id === m.id ? { ...x, state: "sending" } : x)))}
            >
              {m.text}
            </ChatBubble>
          ))}
          {typing ? <ChatBubble name={d.them.name} typing /> : null}
        </ol>

        <form
          className="fl-ctl-chat-send"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label className="fl-sr" htmlFor="chat-text">
            Write a message
          </label>
          <input id="chat-text" className="fl-input fl-ctl-field fl-ctl-field--outlined fl-ctl-field--40" placeholder="Write a message" value={text} onChange={(e) => setText(e.target.value)} />
          <Button type="submit" size={40} icon="send" iconOnly disabled={!text.trim()}>
            Send
          </Button>
        </form>
      </div>

      <div className="fl-ctl-sizes">
        <h3>An assistant reply</h3>
        <p className="fl-ctl-btn-what">Full width with no bubble, so paragraphs, lists and code have room. Actions sit under it; while it streams, the working indicator shows.</p>
        <ol className="fl-ctl-chat-log" role="log" aria-label="Assistant reply">
          <ChatBubble
            variant="assistant"
            name="Assistant"
            first
            actions={
              <>
                <Button variant="tertiary" size={32} icon="copy">Copy</Button>
                <Button variant="tertiary" size={32} icon="refresh">Regenerate</Button>
                <Button variant="tertiary" size={32} icon="thumbs-up" iconOnly>Good answer</Button>
                <Button variant="tertiary" size={32} icon="thumbs-down" iconOnly>Bad answer</Button>
              </>
            }
          >
            <p>Yes, the venue needs the timings by Friday. Here is the sheet as a list:</p>
            <ul>
              <li>Ceremony 14:00</li>
              <li>Portraits 15:00</li>
            </ul>
            <pre>
              <code>{"const timings = [\n  { at: \"14:00\", what: \"Ceremony\" },\n  { at: \"15:00\", what: \"Portraits\" },\n];"}</code>
            </pre>
          </ChatBubble>
          <ChatBubble variant="assistant" name="Assistant" streaming>
            <p>Checking the second shooter's details</p>
          </ChatBubble>
        </ol>
      </div>

      <div className="fl-ctl-sizes">
        <h3>What a thread has to do</h3>
        <ul className="fl-ctl-tip-rules">
          <li>
            <strong>Group what one person says in a row.</strong>
            <span className="fl-ctl-matrix-what">One name and one avatar per run, not per message. Send two in a row above and watch.</span>
          </li>
          <li>
            <strong>Say whether it arrived.</strong>
            <span className="fl-ctl-matrix-what">Sending, sent, read - and failed, with a way to try again, which is the state that gets left out.</span>
          </li>
          <li>
            <strong>Announce politely, not urgently.</strong>
            <span className="fl-ctl-matrix-what">role="log" with aria-live="polite": a new message waits for a gap rather than cutting in.</span>
          </li>
          <li>
            <strong>Do not lean on left and right alone.</strong>
            <span className="fl-ctl-matrix-what">Which side a bubble is on means nothing to a screen reader, so every run carries its name.</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
