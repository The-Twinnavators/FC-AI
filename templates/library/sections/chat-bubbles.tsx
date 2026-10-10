/** @flowcode-library chat-bubbles · Chat: bubbles, grouping, delivery and the message that failed (Small components)
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
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

type Msg = { id: number; who: "them" | "me"; text: string; at: string; state?: "sending" | "sent" | "read" | "failed" };

// flowcode:sample
const SAMPLE = {
  them: { name: "Ana Moreau", initials: "AM" },
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
          <span className="fl-ctl-avatar fl-ctl-avatar--40 fl-ctl-avatar--a" aria-hidden="true">
            <span>{d.them.initials}</span>
          </span>
          <span>
            <strong>{d.them.name}</strong>
            <span className="fl-ctl-matrix-what">
              <span className="fl-ctl-dot fl-ctl-dot--online" aria-hidden="true" /> Here now
            </span>
          </span>
        </div>

        <ol className="fl-ctl-chat-log" role="log" aria-live="polite" aria-label={`Conversation with ${d.them.name}`}>
          {msgs.map((m, n) => {
            const first = n === 0 || msgs[n - 1].who !== m.who;
            return (
              <li key={m.id} className={`fl-ctl-msg fl-ctl-msg--${m.who}${first ? " is-first" : ""}${m.state === "failed" ? " is-failed" : ""}`}>
                {m.who === "them" ? (
                  <span className="fl-ctl-msg-face" aria-hidden="true">
                    {first ? (
                      <span className="fl-ctl-avatar fl-ctl-avatar--24 fl-ctl-avatar--a">
                        <span>{d.them.initials}</span>
                      </span>
                    ) : null}
                  </span>
                ) : null}
                <span className="fl-ctl-msg-col">
                  {first ? (
                    <span className="fl-ctl-msg-who">
                      {m.who === "me" ? "You" : d.them.name} &middot; {m.at}
                    </span>
                  ) : null}
                  <span className="fl-ctl-bubble">{m.text}</span>
                  {m.who === "me" ? (
                    <span className="fl-ctl-msg-state">
                      {m.state === "sending" ? "Sending…" : null}
                      {m.state === "sent" ? "Sent" : null}
                      {m.state === "read" ? "Read" : null}
                      {m.state === "failed" ? (
                        <>
                          Not sent
                          <button
                            type="button"
                            className="fl-ctl-msg-retry"
                            onClick={() => setMsgs((v) => v.map((x) => (x.id === m.id ? { ...x, state: "sending" } : x)))}
                          >
                            <Icon name="refresh" /> Try again
                          </button>
                        </>
                      ) : null}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
          {typing ? (
            <li className="fl-ctl-msg fl-ctl-msg--them is-first">
              <span className="fl-ctl-msg-face" aria-hidden="true">
                <span className="fl-ctl-avatar fl-ctl-avatar--24 fl-ctl-avatar--a">
                  <span>{d.them.initials}</span>
                </span>
              </span>
              <span className="fl-ctl-msg-col">
                <span className="fl-ctl-bubble fl-ctl-bubble--typing">
                  <span className="fl-sr">{d.them.name} is typing</span>
                  <span aria-hidden="true" />
                  <span aria-hidden="true" />
                  <span aria-hidden="true" />
                </span>
              </span>
            </li>
          ) : null}
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
          <button type="submit" className="fl-btn fl-btn--primary fl-ctl-btn--icon fl-ctl-btn--40" disabled={!text.trim()} aria-label="Send">
            <Icon name="send" />
          </button>
        </form>
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
