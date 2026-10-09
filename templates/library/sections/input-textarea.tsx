/** @flowcode-library input-textarea · Textareas (Forms)
 * Use cases: comments; reviews; feedback form; booking notes; message box; discussion thread; notes field; support message
 * Jobs to be done: leave a comment; write a review; add notes to my booking; send feedback within the limit
 * Keywords: textarea, character count, auto grow, comment box, comments, limit
 */
/**
 * Input: textareas. A message field that grows with what you type and counts characters, warning as you near the
 * limit and refusing to send once you're over it; and a comment box with a small formatting toolbar, Cancel and Post.
 * Posted comments appear in a list above it, kept in local storage on this device. Use it for booking notes, reviews,
 * feedback and comment threads. Make it the app's own: replace SAMPLE with the real wording and limit, and post to the
 * real thread.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from "react";

// flowcode:sample
const SAMPLE = {
  storageKey: "textarea-comments",
  message: {
    title: "Anything we should know?",
    label: "Notes for your host",
    hint: "Allergies, access needs or a late arrival. Your host reads this before you come.",
    placeholder: "We'll arrive around 9pm and have a small dog.",
    limit: 280,
    warnAt: 240,
    submit: "Save notes",
    empty: "Write a note before saving, or skip this step.",
    over: "That's over the limit. Trim it a little so your host sees all of it.",
    done: "Notes saved. Your host will see them with the booking.",
  },
  comments: {
    title: "Comments",
    label: "Add a comment",
    placeholder: "Ask a question or share a tip about this recipe…",
    post: "Post",
    cancel: "Cancel",
    empty: "No comments yet. Be the first to say how it went.",
    needText: "Write a comment before posting.",
    you: "You",
    seed: [
      { id: "c1", who: "Priya N.", when: "2 days ago", text: "Halved the chilli and it was still lovely. Kids asked for seconds." },
      { id: "c2", who: "Tom W.", when: "Yesterday", text: "Does this freeze well? Planning to batch cook on Sunday." },
    ],
  },
};

type Comment = { id: string; who: string; when: string; text: string };

function loadComments(): Comment[] {
  try {
    const raw = localStorage.getItem(SAMPLE.storageKey);
    if (raw) return JSON.parse(raw) as Comment[];
  } catch {
    /* storage unavailable: start from the sample */
  }
  return SAMPLE.comments.seed;
}

function useAutoGrow(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return ref;
}

export default function InputTextarea() {
  const d = SAMPLE;
  const uid = useId();

  // Message with counter
  const m = d.message;
  const [msg, setMsg] = useState("");
  const [msgError, setMsgError] = useState("");
  const [msgDone, setMsgDone] = useState(false);
  const msgRef = useAutoGrow(msg);
  const left = m.limit - msg.length;
  const tone = left < 0 ? "over" : msg.length >= m.warnAt ? "warn" : "ok";

  function saveMsg(e: FormEvent) {
    e.preventDefault();
    if (!msg.trim()) return setMsgError(m.empty);
    if (left < 0) return setMsgError(m.over);
    setMsgError("");
    setMsgDone(true);
  }

  // Comment box
  const c = d.comments;
  const [comments, setComments] = useState<Comment[]>(loadComments);
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const [cError, setCError] = useState("");
  const [announce, setAnnounce] = useState("");
  const draftRef = useAutoGrow(draft);

  useEffect(() => {
    try {
      localStorage.setItem(d.storageKey, JSON.stringify(comments));
    } catch {
      /* storage unavailable: keep in memory */
    }
  }, [comments, d.storageKey]);

  function wrap(before: string, after: string) {
    const el = draftRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const next = draft.slice(0, s) + before + draft.slice(s, e) + after + draft.slice(e);
    setDraft(next);
    setFocused(true);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, e + before.length);
    });
  }

  function post(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) {
      setCError(c.needText);
      draftRef.current?.focus();
      return;
    }
    setComments((list) => [...list, { id: `${Date.now()}`, who: c.you, when: "Just now", text: draft.trim() }]);
    setDraft("");
    setCError("");
    setFocused(false);
    setAnnounce("Comment posted.");
  }

  function cancel() {
    setDraft("");
    setCError("");
    setFocused(false);
    draftRef.current?.blur();
  }

  const open = focused || draft.length > 0;

  return (
    <section className="fl-section" aria-labelledby={`${uid}-title`}>
      <div className="fl-wrap fl-wrap--narrow fl-in-stack">
        <form className="fl-card fl-in-panel" noValidate onSubmit={saveMsg}>
          <h2 id={`${uid}-title`} className="fl-title fl-title--md">
            {m.title}
          </h2>
          <div className="fl-field">
            <label htmlFor={`${uid}-msg`}>{m.label}</label>
            <span id={`${uid}-msg-hint`} className="fl-note">
              {m.hint}
            </span>
            <textarea
              ref={msgRef}
              id={`${uid}-msg`}
              className="fl-input fl-in-grow"
              rows={3}
              placeholder={m.placeholder}
              value={msg}
              aria-invalid={!!msgError || tone === "over" || undefined}
              aria-describedby={`${uid}-msg-hint ${uid}-msg-count${msgError ? ` ${uid}-msg-err` : ""}`}
              onChange={(e) => {
                setMsg(e.target.value);
                setMsgDone(false);
                if (msgError) setMsgError("");
              }}
            />
            <div className="fl-in-countrow">
              {msgError ? (
                <span id={`${uid}-msg-err`} className="fl-in-error" role="alert">
                  {msgError}
                </span>
              ) : (
                <span />
              )}
              <span id={`${uid}-msg-count`} className={`fl-in-count fl-in-count--${tone}`} aria-live={tone === "ok" ? "off" : "polite"}>
                {left >= 0 ? `${left} characters left` : `${-left} over the limit`}
              </span>
            </div>
          </div>
          {msgDone && (
            <p className="fl-done" role="status">
              {m.done}
            </p>
          )}
          <div className="fl-actions">
            <button type="submit" className="fl-btn fl-btn--primary">
              {m.submit}
            </button>
          </div>
        </form>

        <div className="fl-card fl-in-panel" aria-labelledby={`${uid}-ctitle`} role="region">
          <h3 id={`${uid}-ctitle`}>
            {c.title} <span className="fl-meta">({comments.length})</span>
          </h3>
          {comments.length === 0 ? (
            <p className="fl-in-empty">{c.empty}</p>
          ) : (
            <ul className="fl-in-comments">
              {comments.map((x) => (
                <li key={x.id} className="fl-in-comment">
                  <span className="fl-person__avatar" aria-hidden="true">
                    {x.who.slice(0, 1)}
                  </span>
                  <div>
                    <p className="fl-in-comment__meta">
                      <strong>{x.who}</strong> <span className="fl-meta">· {x.when}</span>
                    </p>
                    <p className="fl-in-comment__text">{x.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <form className={`fl-in-cbox${open ? " fl-in-cbox--open" : ""}${cError ? " fl-in-cbox--invalid" : ""}`} noValidate onSubmit={post}>
            <label htmlFor={`${uid}-draft`} className="fl-sr">
              {c.label}
            </label>
            <textarea
              ref={draftRef}
              id={`${uid}-draft`}
              className="fl-in-cbox__field"
              rows={open ? 3 : 1}
              placeholder={c.placeholder}
              value={draft}
              aria-invalid={!!cError || undefined}
              aria-describedby={cError ? `${uid}-draft-err` : undefined}
              onFocus={() => setFocused(true)}
              onChange={(e) => {
                setDraft(e.target.value);
                if (cError) setCError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") cancel();
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) post(e);
              }}
            />
            {open && (
              <div className="fl-in-cbox__bar">
                <div className="fl-in-bgroup fl-in-bgroup--quiet" role="toolbar" aria-label="Comment formatting">
                  <button type="button" className="fl-in-glyph fl-in-glyph--bold" aria-label="Bold" title="Bold" onClick={() => wrap("**", "**")}>
                    B
                  </button>
                  <button type="button" className="fl-in-glyph fl-in-glyph--italic" aria-label="Italic" title="Italic" onClick={() => wrap("_", "_")}>
                    I
                  </button>
                  <button type="button" aria-label="Bulleted list" title="Bulleted list" onClick={() => wrap("\n- ", "")}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
                      <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
                    </svg>
                  </button>
                </div>
                <div className="fl-in-cbox__actions">
                  <button type="button" className="fl-in-textbtn" onClick={cancel}>
                    {c.cancel}
                  </button>
                  <button type="submit" className="fl-btn fl-btn--primary fl-in-btn-sm">
                    {c.post}
                  </button>
                </div>
              </div>
            )}
          </form>
          {cError && (
            <p id={`${uid}-draft-err`} className="fl-in-error" role="alert">
              {cError}
            </p>
          )}
          <p className="fl-sr" aria-live="polite">
            {announce}
          </p>
        </div>
      </div>
    </section>
  );
}
