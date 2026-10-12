/** @flowcode-library input-textarea · Textareas (Forms)
 * Catalog ID: p.comment-box (pattern)
 * Function: The comment box pattern (p.comment-box): a textarea that opens a Bold/Italic/List toolbar with Cancel and Post, counts characters against a limit, and lists the posted comments above it.
 * Use it as: import { CommentBox } from "./input-textarea"; <CommentBox comments={[{ id, who, when, text }]} title? label? placeholder? postLabel? cancelLabel? emptyText? needText? overText? doneText? you? limit? warnAt? storageKey? onPost?={(text) => ...} />
 * Built from: c.text-field.underlined, c.button.primary, c.button.tertiary, c.avatar.person
 * Look: A card with a count in the heading, the comments (initial avatar, name, time, text) and a bordered box that is one line until focused, then grows a toolbar bar with Cancel and Post and a character count below.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-border-strong --color-accent --color-danger --color-text-muted --radius-md --space-3 --space-4 --text-sm --focus-ring
 * Use cases: comments; reviews; feedback form; booking notes; message box; discussion thread; notes field; support message
 * Jobs to be done: leave a comment; write a review; add notes to my booking; send feedback within the limit
 * Keywords: textarea, character count, auto grow, comment box, comments, limit
 */
/**
 * Comment box: the posted comments in a list and, under them, a box that is one line until you click into it. Open, it
 * shows a small formatting toolbar (bold, italic, list), Cancel and Post. An optional limit counts characters down,
 * warns near the end and refuses to post once over. An empty post is refused with a message and focus returns to the
 * box. Escape cancels; Ctrl or Cmd+Enter posts. Comments are kept in local storage on this device when a storageKey
 * is given. Make it the app's own: pass the real comments and wording, and send each post to the real thread through
 * onPost.
 */
import { useEffect, useId, useState, type FormEvent } from "react";
import { Button } from "./buttons-variants";
import { TextField } from "./text-fields-states";
import { Avatar } from "./avatars-variants";

// ── p.comment-box: comments above a growing composer. Built from c.text-field, c.button and c.avatar. ──

export type Comment = { id: string; who: string; when: string; text: string };

export type CommentBoxProps = {
  /** The comments to start with, oldest first. */
  comments?: Comment[];
  /** The heading above the list; the count follows it. */
  title?: string;
  /** The box's accessible name (hidden label). */
  label?: string;
  placeholder?: string;
  postLabel?: string;
  cancelLabel?: string;
  /** Shown instead of the list while there are no comments. */
  emptyText?: string;
  /** The error when Post is pressed with nothing written. */
  needText?: string;
  /** The error when Post is pressed over the limit. */
  overText?: string;
  /** Said (and shown) after a comment is posted. */
  doneText?: string;
  /** The name put on a comment the person posts. */
  you?: string;
  /** Maximum characters; no counter and no limit when left out. */
  limit?: number;
  /** The count turns to a warning from this many characters; 90% of the limit when left out. */
  warnAt?: number;
  /** Keep the comments in local storage on this device under this key. Left out, they live in memory. */
  storageKey?: string;
  /** Called with the trimmed text of each posted comment. */
  onPost?: (text: string) => void;
  className?: string;
};

function load(key: string | undefined, seed: Comment[]): Comment[] {
  if (!key) return seed;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as Comment[];
  } catch {
    /* storage unavailable: start from the given comments */
  }
  return seed;
}

// The composer sits inside a bordered box that draws its own border and focus ring, so the field itself is bare.
const BARE = { border: 0, boxShadow: "none", background: "transparent", resize: "none", overflow: "hidden", minHeight: "var(--control-lg)", borderRadius: "inherit" } as const;

export function CommentBox({
  comments: seed = [],
  title = "Comments",
  label = "Add a comment",
  placeholder = "Write a comment…",
  postLabel = "Post",
  cancelLabel = "Cancel",
  emptyText = "No comments yet.",
  needText = "Write a comment before posting.",
  overText = "That's over the limit. Trim it a little before posting.",
  doneText = "Comment posted.",
  you = "You",
  limit,
  warnAt,
  storageKey,
  onPost,
  className,
}: CommentBoxProps) {
  const uid = useId();
  const fieldId = `${uid}-draft`;
  const [list, setList] = useState<Comment[]>(() => load(storageKey, seed));
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  // The field is a c.text-field, which owns its ref, so it is found by id.
  const field = () => document.getElementById(fieldId) as HTMLTextAreaElement | null;

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(list));
    } catch {
      /* storage unavailable: keep in memory */
    }
  }, [list, storageKey]);

  const open = focused || draft.length > 0;
  const left = limit === undefined ? 0 : limit - draft.length;
  const warn = warnAt ?? (limit === undefined ? 0 : Math.floor(limit * 0.9));
  const tone = limit === undefined ? "ok" : left < 0 ? "over" : draft.length >= warn ? "warn" : "ok";

  function wrap(before: string, after: string) {
    const el = field();
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    setDraft(draft.slice(0, s) + before + draft.slice(s, e) + after + draft.slice(e));
    setFocused(true);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, e + before.length);
    });
  }

  function post(e?: FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text) {
      setError(needText);
      field()?.focus();
      return;
    }
    if (left < 0) {
      setError(overText);
      field()?.focus();
      return;
    }
    setList((l) => [...l, { id: `${Date.now()}`, who: you, when: "Just now", text }]);
    onPost?.(text);
    setDraft("");
    setError("");
    setFocused(false);
    setDone(doneText);
  }

  function cancel() {
    setDraft("");
    setError("");
    setFocused(false);
    field()?.blur();
  }

  const describe = [error ? `${uid}-err` : "", limit !== undefined ? `${uid}-count` : ""].filter(Boolean).join(" ") || undefined;

  return (
    <div className={["fl-card", "fl-in-panel", className ?? ""].filter(Boolean).join(" ")} data-fl="p.comment-box" role="region" aria-labelledby={`${uid}-title`}>
      <h3 id={`${uid}-title`}>
        {title} <span className="fl-meta">({list.length})</span>
      </h3>
      {list.length === 0 ? (
        <p className="fl-in-empty">{emptyText}</p>
      ) : (
        <ul className="fl-in-comments">
          {list.map((x) => (
            <li key={x.id} className="fl-in-comment">
              <Avatar name={x.who} size={32} decorative />
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
      <form className={`fl-in-cbox${open ? " fl-in-cbox--open" : ""}${error ? " fl-in-cbox--invalid" : ""}`} noValidate onSubmit={post}>
        <label htmlFor={fieldId} className="fl-sr">
          {label}
        </label>
        <TextField
          multiline
          autoGrow
          variant="underlined"
          id={fieldId}
          className="fl-in-cbox__field"
          style={BARE}
          rows={open ? 3 : 1}
          placeholder={placeholder}
          value={draft}
          invalid={!!error || tone === "over"}
          aria-describedby={describe}
          onFocus={() => setFocused(true)}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError("");
            if (done) setDone("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel();
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) post();
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
              <Button variant="tertiary" size={32} onClick={cancel}>
                {cancelLabel}
              </Button>
              <Button variant="primary" size={32} type="submit">
                {postLabel}
              </Button>
            </div>
          </div>
        )}
      </form>
      {(error || limit !== undefined) && (
        <div className="fl-in-countrow">
          {error ? (
            <span id={`${uid}-err`} className="fl-in-error" role="alert">
              {error}
            </span>
          ) : (
            <span />
          )}
          {limit !== undefined && (
            <span id={`${uid}-count`} className={`fl-in-count fl-in-count--${tone}`} aria-live={tone === "ok" ? "off" : "polite"}>
              {left >= 0 ? `${left} characters left` : `${-left} over the limit`}
            </span>
          )}
        </div>
      )}
      <p className={done ? "fl-done" : "fl-sr"} role="status" aria-live="polite">
        {done}
      </p>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  storageKey: "textarea-comments",
  title: "Comments",
  label: "Add a comment",
  placeholder: "Ask a question or share a tip about this recipe…",
  postLabel: "Post",
  cancelLabel: "Cancel",
  emptyText: "No comments yet. Be the first to say how it went.",
  needText: "Write a comment before posting.",
  overText: "That's over the limit. Trim it a little so everyone sees all of it.",
  doneText: "Comment posted.",
  you: "You",
  limit: 280,
  warnAt: 240,
  comments: [
    { id: "c1", who: "Priya N.", when: "2 days ago", text: "Halved the chilli and it was still lovely. Kids asked for seconds." },
    { id: "c2", who: "Tom W.", when: "Yesterday", text: "Does this freeze well? Planning to batch cook on Sunday." },
  ],
};

export default function InputTextarea() {
  return (
    <section className="fl-section">
      <div className="fl-wrap fl-wrap--narrow fl-in-stack">
        <CommentBox {...SAMPLE} />
      </div>
    </section>
  );
}
