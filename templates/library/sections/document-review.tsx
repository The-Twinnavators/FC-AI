/** @flowcode-library document-review · Document review (Cards)
 * Catalog ID: p.document-review (pattern)
 * Function: Document review (p.document-review): a page of text with highlighted passages and, beside it, the comment threads anchored to them; select words on the page (or use New comment and quote them) to start a thread, reply, resolve and reopen, delete a thread after a confirm; a highlight and its thread find each other both ways; Open / Resolved / All filter with counts; checks for an empty comment, a quote that isn't in the paragraph and a passage that already has a thread; loading, a load error with Retry, empty states and every change announced.
 * Use it as: import { DocumentReview } from "./document-review"; <DocumentReview title doc={{ title, meta?, paragraphs: [{ id, text, heading? }] }} me="Signed-in name" threads?={[{ id, para, quote, status: "open"|"resolved", comments: [{ id, who, at: ISO, text }] }]} load?={async () => ReviewThread[]} onChange?={(threads) => ...} labels?={{ comment, reply, resolve, reopen, ... }} />
 * Built from: c.avatar.person, c.badge.status, c.text-field.outlined, c.select.outlined, c.segmented.segmented, c.button.primary, c.button.secondary, c.button.tertiary, c.modal.danger
 * Look: A white card: the title with open and resolved counts and an Open / Resolved / All switch; at the left a sunken desk holding a white page (a heading, a meta line, paragraphs) with soft highlighted passages; at the right a column of thread cards, each with the quoted words beside a straight accent bar, a status pill, comments with round initials, a reply box, and Resolve or Reopen; the active highlight and card are stronger.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-warning --color-success --color-danger --font-display --font-sans --space-1 --space-2 --space-3 --space-4 --space-5 --radius-sm --radius-md --radius-lg --text-xs --text-sm --text-md --text-lg --weight-medium --weight-semibold --focus-ring --surface-shadow-overlay --duration-fast --duration-base --duration-slow --ease-out --easing --enter-distance
 * Use cases: document review; editorial review; proofreading; contract review; content feedback; draft comments; design brief review
 * Jobs to be done: point at the exact words I have a question about; answer a reviewer's comment where it was made; mark feedback as dealt with; see only what is still open; take back a resolved comment that needs more work
 * Keywords: document review, comments, annotations, highlights, threads, resolve, reopen, feedback, editorial, proofreading, review
 */
/**
 * Document review: comments anchored to words in a page. Each highlight is a button inside the text: pressing it
 * opens its thread and moves focus there; each thread has Show in page to go back. Selecting words with the pointer
 * offers a Comment button beside the selection; without a pointer, New comment asks for the paragraph and the words to
 * quote, and checks they are in it. Threads glide into their places when the filter changes or one is added (FLIP),
 * resolved threads fold their comments away (collapsed parts are inert), and with motion off everything simply appears.
 * Adapted from Tailblocks (MIT, Copyright (c) 2020 Mert Cukuren): its content and blog blocks, and TailGrids (MIT,
 * Copyright (c) 2025 Tailgrids): its avatar, badge, text area and alert dialog components.
 */
/**
 * How to try it
 * - Wait for the threads to load. Press a highlight in the page: its thread lights up and takes focus. Press Show in
 *   page to go back.
 * - Reply with an empty box: it says why. Write a reply and press Reply (or Ctrl+Enter).
 * - Resolve a thread: it folds and leaves the Open filter. Switch to Resolved and Reopen it.
 * - Select a few words in the page with the mouse and press Comment; or press New comment, pick a paragraph and type
 *   words that aren't there: it says so. Quote real words: a new highlight appears.
 * - Delete a thread: it asks first.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useRef, useState), the library's Avatar, Badge, TextField,
 * Select, Segmented, Button and Modal ("./avatars-variants", "./badges-status", "./text-fields-states",
 * "./dropdowns-states", "./segmented-control", "./buttons-variants", "./modals-dialogs") and its inline icon set
 * ("./icons"). Nothing else: no package and nothing fetched. The styles are the library's own fl- classes in
 * templates/library/css/r5d-document-review.css.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { Avatar, type AvatarTone } from "./avatars-variants";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { Segmented } from "./segmented-control";
import { TextField } from "./text-fields-states";

// ── p.document-review: highlighted passages with comment threads, resolve and reopen. ──

export type ReviewComment = { id: string; who: string; at: string; text: string };
export type ReviewThread = { id: string; para: string; quote: string; status: "open" | "resolved"; comments: ReviewComment[] };
export type ReviewParagraph = { id: string; text: string; heading?: boolean };
export type ReviewDoc = { title: string; meta?: string; paragraphs: ReviewParagraph[] };

export type DocumentReviewLabels = Partial<{
  open: string;
  resolved: string;
  all: string;
  filter: string;
  counts: string;
  newComment: string;
  comment: string;
  paragraph: string;
  pickParagraph: string;
  quote: string;
  yourComment: string;
  start: string;
  cancel: string;
  reply: string;
  replyTo: string;
  resolve: string;
  reopen: string;
  remove: string;
  removeTitle: string;
  removeText: string;
  showInPage: string;
  showComments: string;
  hideComments: string;
  passageGone: string;
  added: string;
  replied: string;
  resolvedSaid: string;
  reopenedSaid: string;
  removed: string;
  loading: string;
  loadFailed: string;
  retry: string;
  empty: string;
  emptyText: string;
  noneOpen: string;
  noneResolved: string;
  required: string;
  quoteRequired: string;
  notFound: string;
  overlap: string;
  pickRequired: string;
}>;

export type DocumentReviewProps = {
  title: string;
  doc: ReviewDoc;
  /** The signed-in person; new comments and replies are theirs. */
  me: string;
  /** The threads to start with. Ignored while `load` is given. */
  threads?: ReviewThread[];
  /** Loads the threads; the column shows as loading until it settles, and a failure offers Retry. */
  load?: () => Promise<ReviewThread[]>;
  /** Gets every thread after each change. */
  onChange?: (threads: ReviewThread[]) => void;
  labels?: DocumentReviewLabels;
};

type Filter = "open" | "resolved" | "all";
type Draft = { para: string; quote: string; text: string; error: { para?: string; quote?: string; text?: string } };

const TONES: AvatarTone[] = ["a", "b", "c", "d", "e"];
const toneFor = (name: string) => TONES[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % TONES.length];

function motionOff() {
  return document.documentElement.dataset.motion === "off" || Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}
function tokenMs(name: string, fallback: number) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  return raw.endsWith("ms") ? n : raw.endsWith("s") ? n * 1000 : n;
}
const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
function when(iso: string) {
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  const a = Math.abs(s);
  if (a < 60) return "just now";
  if (a < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (a < 86400) return rtf.format(Math.round(s / 3600), "hour");
  if (a < 86400 * 30) return rtf.format(Math.round(s / 86400), "day");
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** FLIP: cards marked data-flip glide from where they were to where they are whenever `key` changes. */
function useFlip(box: RefObject<HTMLElement | null>, key: string) {
  const last = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) {
      last.current = new Map();
      return;
    }
    const nodes = Array.from(el.querySelectorAll<HTMLElement>(":scope > [data-flip]"));
    const now = new Map(nodes.map((n) => [n.dataset.flip!, n.getBoundingClientRect().top]));
    if (!motionOff() && last.current.size) {
      const ease = getComputedStyle(document.documentElement).getPropertyValue("--ease-out").trim() || "ease-out";
      for (const n of nodes) {
        const was = last.current.get(n.dataset.flip!);
        if (was === undefined) {
          n.animate([{ opacity: 0, translate: "0 var(--enter-distance, 8px)" }, { opacity: 1, translate: "0 0" }], { duration: tokenMs("--duration-base", 200), easing: ease });
        } else if (was !== now.get(n.dataset.flip!)) {
          n.animate([{ translate: `0 ${was - now.get(n.dataset.flip!)!}px` }, { translate: "0 0" }], { duration: tokenMs("--duration-slow", 320), easing: ease });
        }
      }
    }
    last.current = now;
  }, [key, box]);
}

/** Where each thread's words sit in its paragraph; a later thread that overlaps an earlier one is left unmarked. */
function placeMarks(text: string, threads: ReviewThread[]) {
  const spots = threads
    .map((t) => ({ t, at: text.indexOf(t.quote) }))
    .filter((s) => s.at >= 0 && s.t.quote)
    .sort((a, b) => a.at - b.at);
  const out: { t: ReviewThread; at: number; end: number }[] = [];
  for (const s of spots) {
    const end = s.at + s.t.quote.length;
    if (out.length && s.at < out[out.length - 1].end) continue;
    out.push({ t: s.t, at: s.at, end });
  }
  return out;
}

export function DocumentReview({ title, doc, me, threads: initial = [], load, onChange, labels = {} }: DocumentReviewProps) {
  const l = {
    open: "Open",
    resolved: "Resolved",
    all: "All",
    filter: "Show threads",
    counts: "{open} open · {resolved} resolved",
    newComment: "New comment",
    comment: "Comment",
    paragraph: "Paragraph",
    pickParagraph: "Choose a paragraph",
    quote: "Words to comment on",
    yourComment: "Comment",
    start: "Comment",
    cancel: "Cancel",
    reply: "Reply",
    replyTo: "Reply to {who}",
    resolve: "Resolve",
    reopen: "Reopen",
    remove: "Delete thread",
    removeTitle: "Delete this thread?",
    removeText: "Its {n} comments go with it.",
    showInPage: "Show in page",
    showComments: "Show {n} comments",
    hideComments: "Hide comments",
    passageGone: "These words are no longer in the page.",
    added: "Comment added on “{quote}”.",
    replied: "Reply added.",
    resolvedSaid: "Resolved “{quote}”.",
    reopenedSaid: "Reopened “{quote}”.",
    removed: "Thread deleted.",
    loading: "Loading comments…",
    loadFailed: "Couldn't load the comments.",
    retry: "Retry",
    empty: "No comments yet",
    emptyText: "Select words in the page to comment on them.",
    noneOpen: "Nothing open. Every comment is resolved.",
    noneResolved: "Nothing resolved yet.",
    required: "Write a comment first.",
    quoteRequired: "Type the words you're commenting on.",
    notFound: "Those words aren't in that paragraph.",
    overlap: "Those words already have a thread.",
    pickRequired: "Choose a paragraph.",
    ...labels,
  };
  const id = useId();
  const [threads, setThreads] = useState<ReviewThread[]>(load ? [] : initial);
  const [phase, setPhase] = useState<"loading" | "error" | "ready">(load ? "loading" : "ready");
  const [filter, setFilter] = useState<Filter>("open");
  const [active, setActive] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, { text: string; error: string }>>({});
  const [unfolded, setUnfolded] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pick, setPick] = useState<{ para: string; quote: string; x: number; y: number } | null>(null);
  const [deleteFor, setDeleteFor] = useState<ReviewThread | null>(null);
  const [said, setSaid] = useState("");
  const pageRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const later = (fn: () => void, ms = 0) => window.setTimeout(fn, ms);

  const fetchThreads = () => {
    if (!load) return;
    setPhase("loading");
    load()
      .then((t) => {
        setThreads(t);
        setPhase("ready");
      })
      .catch(() => setPhase("error"));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(fetchThreads, []);

  const commit = (next: ReviewThread[], message: string) => {
    setThreads(next);
    onChange?.(next);
    setSaid(message);
  };

  const openN = threads.filter((t) => t.status === "open").length;
  const resolvedN = threads.length - openN;
  const shown = threads.filter((t) => filter === "all" || t.status === filter);
  const marked = phase === "ready" ? shown : [];
  useFlip(listRef, `${phase}|${filter}|${shown.map((t) => `${t.id}${t.status}`).join(",")}|${draft ? 1 : 0}`);

  const focusCard = (tid: string) =>
    later(() => {
      const el = document.getElementById(`${id}-t-${tid}`);
      el?.scrollIntoView({ block: "nearest", behavior: motionOff() ? "auto" : "smooth" });
      el?.focus({ preventScroll: true });
    }, 30);
  const focusMark = (tid: string) =>
    later(() => {
      const el = document.getElementById(`${id}-m-${tid}`);
      el?.scrollIntoView({ block: "center", behavior: motionOff() ? "auto" : "smooth" });
      el?.focus({ preventScroll: true });
    }, 30);

  const openThread = (t: ReviewThread) => {
    setActive(t.id);
    focusCard(t.id);
  };

  // Pointer selection inside one paragraph offers a Comment button beside it.
  const onPageUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return setPick(null);
    const range = sel.getRangeAt(0);
    const startP = (range.startContainer.parentElement as HTMLElement | null)?.closest<HTMLElement>("[data-para]");
    const endP = (range.endContainer.parentElement as HTMLElement | null)?.closest<HTMLElement>("[data-para]");
    const quote = sel.toString().replace(/\s+/g, " ").trim();
    if (!startP || startP !== endP || !quote || quote.length > 240 || !pageRef.current) return setPick(null);
    const r = range.getBoundingClientRect();
    const box = pageRef.current.getBoundingClientRect();
    setPick({ para: startP.dataset.para!, quote, x: Math.min(Math.max(r.left + r.width / 2 - box.left, 48), box.width - 48), y: r.bottom - box.top + 6 });
  };
  useEffect(() => {
    if (!pick) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest?.(".fl-drev-pick")) setPick(null);
    };
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setPick(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pick]);

  const startDraft = (para = "", quote = "") => {
    setPick(null);
    window.getSelection()?.removeAllRanges();
    setDraft({ para, quote, text: "", error: {} });
    if (filter === "resolved") setFilter("open");
    later(() => document.getElementById(para && quote ? `${id}-d-text` : `${id}-d-para`)?.focus(), 30);
  };
  const cancelDraft = () => {
    setDraft(null);
    later(() => document.getElementById(`${id}-new`)?.focus(), 30);
  };
  const submitDraft = (e: FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const p = doc.paragraphs.find((x) => x.id === draft.para);
    const quote = draft.quote.replace(/\s+/g, " ").trim();
    const error: Draft["error"] = {};
    if (!p) error.para = l.pickRequired;
    else if (!quote) error.quote = l.quoteRequired;
    else {
      const at = p.text.indexOf(quote);
      if (at < 0) error.quote = l.notFound;
      else if (threads.some((t) => t.status === "open" && t.para === p.id && p.text.indexOf(t.quote) >= 0 && at < p.text.indexOf(t.quote) + t.quote.length && p.text.indexOf(t.quote) < at + quote.length)) error.quote = l.overlap;
    }
    if (!draft.text.trim()) error.text = l.required;
    if (error.para || error.quote || error.text) {
      setDraft({ ...draft, error });
      document.getElementById(error.para ? `${id}-d-para` : error.quote ? `${id}-d-quote` : `${id}-d-text`)?.focus();
      return;
    }
    const t: ReviewThread = { id: `t${Date.now().toString(36)}`, para: draft.para, quote, status: "open", comments: [{ id: `c${Date.now().toString(36)}`, who: me, at: new Date().toISOString(), text: draft.text.trim() }] };
    commit([...threads, t], l.added.replace("{quote}", quote));
    setDraft(null);
    setActive(t.id);
    focusCard(t.id);
  };

  const sendReply = (t: ReviewThread) => {
    const r = replies[t.id] ?? { text: "", error: "" };
    if (!r.text.trim()) {
      setReplies({ ...replies, [t.id]: { ...r, error: l.required } });
      document.getElementById(`${id}-r-${t.id}`)?.focus();
      return;
    }
    commit(
      threads.map((x) => (x.id === t.id ? { ...x, comments: [...x.comments, { id: `c${Date.now().toString(36)}`, who: me, at: new Date().toISOString(), text: r.text.trim() }] } : x)),
      l.replied,
    );
    setReplies({ ...replies, [t.id]: { text: "", error: "" } });
  };

  const setStatus = (t: ReviewThread, status: ReviewThread["status"]) => {
    commit(
      threads.map((x) => (x.id === t.id ? { ...x, status } : x)),
      (status === "resolved" ? l.resolvedSaid : l.reopenedSaid).replace("{quote}", t.quote),
    );
    setUnfolded({ ...unfolded, [t.id]: false });
    // If the thread leaves the current filter, focus goes to its neighbor (or the filter); otherwise it stays on the card.
    const leaves = filter !== "all";
    if (!leaves) return focusCard(t.id);
    const rest = shown.filter((x) => x.id !== t.id);
    const i = shown.findIndex((x) => x.id === t.id);
    const next = rest[Math.min(i, rest.length - 1)];
    if (next) {
      setActive(next.id);
      focusCard(next.id);
    } else later(() => document.getElementById(`${id}-new`)?.focus(), 30);
  };

  const remove = () => {
    if (!deleteFor) return;
    const i = shown.findIndex((x) => x.id === deleteFor.id);
    const rest = shown.filter((x) => x.id !== deleteFor.id);
    commit(
      threads.filter((x) => x.id !== deleteFor.id),
      l.removed,
    );
    const next = rest[Math.min(i, rest.length - 1)];
    if (next) {
      setActive(next.id);
      focusCard(next.id);
    } else later(() => document.getElementById(`${id}-new`)?.focus(), 60);
  };

  const onReplyKey = (e: KeyboardEvent<HTMLTextAreaElement>, t: ReviewThread) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      sendReply(t);
    }
  };

  const renderParagraph = (p: ReviewParagraph) => {
    const spots = placeMarks(
      p.text,
      marked.filter((t) => t.para === p.id),
    );
    const parts: ReactNode[] = [];
    let at = 0;
    for (const s of spots) {
      if (s.at > at) parts.push(p.text.slice(at, s.at));
      const n = s.t.comments.length;
      parts.push(
        // A <mark> acting as a button: a real <button> can't wrap across lines inside running text.
        <mark
          key={s.t.id}
          id={`${id}-m-${s.t.id}`}
          role="button"
          tabIndex={0}
          className={["fl-drev-mark", s.t.status === "resolved" ? "is-resolved" : "", active === s.t.id ? "is-active" : ""].filter(Boolean).join(" ")}
          aria-label={`${p.text.slice(s.at, s.end)}: ${n} ${n === 1 ? "comment" : "comments"}, ${s.t.status === "open" ? l.open : l.resolved}`}
          aria-pressed={active === s.t.id}
          onClick={() => openThread(s.t)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openThread(s.t);
            }
          }}
        >
          {p.text.slice(s.at, s.end)}
        </mark>,
      );
      at = s.end;
    }
    if (at < p.text.length) parts.push(p.text.slice(at));
    return p.heading ? (
      <h4 key={p.id} data-para={p.id} className="fl-drev-h">
        {parts}
      </h4>
    ) : (
      <p key={p.id} data-para={p.id}>
        {parts}
      </p>
    );
  };

  const paraLabel = (p: ReviewParagraph, i: number) => `${i + 1}. ${p.text.length > 48 ? `${p.text.slice(0, 48)}…` : p.text}`;

  return (
    <section className="fl-drev" aria-labelledby={`${id}-title`} data-fl="p.document-review">
      <header className="fl-drev-head">
        <div className="fl-drev-heading">
          <h2 id={`${id}-title`}>{title}</h2>
          {phase === "ready" ? <p>{l.counts.replace("{open}", String(openN)).replace("{resolved}", String(resolvedN))}</p> : null}
        </div>
        <Segmented
          size="sm"
          label={l.filter}
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
          options={[
            { value: "open", label: `${l.open} ${phase === "ready" ? openN : ""}`.trim() },
            { value: "resolved", label: `${l.resolved} ${phase === "ready" ? resolvedN : ""}`.trim() },
            { value: "all", label: l.all },
          ]}
        />
      </header>

      <div className="fl-drev-body">
        <div className="fl-drev-desk">
          <article className="fl-drev-page" ref={pageRef} onMouseUp={onPageUp} aria-label={doc.title}>
            <h3 className="fl-drev-doctitle">{doc.title}</h3>
            {doc.meta ? <p className="fl-drev-docmeta">{doc.meta}</p> : null}
            {doc.paragraphs.map(renderParagraph)}
            {pick ? (
              <span className="fl-drev-pick" style={{ left: pick.x, top: pick.y }}>
                <Button size={32} icon="plus" onClick={() => startDraft(pick.para, pick.quote)}>
                  {l.comment}
                </Button>
              </span>
            ) : null}
          </article>
        </div>

        <div className="fl-drev-side">
          <div className="fl-drev-sidehead">
            <h3>{filter === "open" ? l.open : filter === "resolved" ? l.resolved : l.all}</h3>
            <Button id={`${id}-new`} variant="secondary" size={32} icon="plus" disabled={phase !== "ready" || Boolean(draft)} onClick={() => startDraft()}>
              {l.newComment}
            </Button>
          </div>

          {phase === "loading" ? (
            <div className="fl-drev-list" aria-busy="true" role="status" aria-label={l.loading}>
              {[0, 1, 2].map((i) => (
                <span key={i} className="fl-drev-skel" aria-hidden="true" />
              ))}
            </div>
          ) : phase === "error" ? (
            <div className="fl-drev-empty" role="alert">
              <Icon name="alert" />
              <p className="fl-drev-empty-title">{l.loadFailed}</p>
              <Button variant="secondary" size={40} icon="refresh" onClick={fetchThreads}>
                {l.retry}
              </Button>
            </div>
          ) : (
            <div className="fl-drev-list" ref={listRef}>
              {draft ? (
                <form className="fl-drev-card fl-drev-draft" data-flip="draft" noValidate onSubmit={submitDraft} aria-label={l.newComment} onKeyDown={(e) => e.key === "Escape" && (e.preventDefault(), cancelDraft())}>
                  <div className="fl-drev-field">
                    <label htmlFor={`${id}-d-para`}>{l.paragraph}</label>
                    <Select
                      id={`${id}-d-para`}
                      value={draft.para}
                      invalid={Boolean(draft.error.para)}
                      aria-describedby={draft.error.para ? `${id}-d-para-err` : undefined}
                      onChange={(e) => setDraft({ ...draft, para: e.currentTarget.value, error: { ...draft.error, para: undefined, quote: undefined } })}
                      options={[{ value: "", label: l.pickParagraph, disabled: true }, ...doc.paragraphs.map((p, i) => ({ value: p.id, label: paraLabel(p, i) }))]}
                    />
                    {draft.error.para ? (
                      <p id={`${id}-d-para-err`} className="fl-drev-error" role="alert">
                        <Icon name="alert" />
                        {draft.error.para}
                      </p>
                    ) : null}
                  </div>
                  <div className="fl-drev-field">
                    <label htmlFor={`${id}-d-quote`}>{l.quote}</label>
                    <TextField
                      id={`${id}-d-quote`}
                      size={40}
                      value={draft.quote}
                      invalid={Boolean(draft.error.quote)}
                      aria-describedby={draft.error.quote ? `${id}-d-quote-err` : undefined}
                      onChange={(e) => setDraft({ ...draft, quote: e.currentTarget.value, error: { ...draft.error, quote: undefined } })}
                    />
                    {draft.error.quote ? (
                      <p id={`${id}-d-quote-err`} className="fl-drev-error" role="alert">
                        <Icon name="alert" />
                        {draft.error.quote}
                      </p>
                    ) : null}
                  </div>
                  <div className="fl-drev-field">
                    <label htmlFor={`${id}-d-text`}>{l.yourComment}</label>
                    <TextField
                      id={`${id}-d-text`}
                      multiline
                      autoGrow
                      rows={2}
                      value={draft.text}
                      invalid={Boolean(draft.error.text)}
                      aria-describedby={draft.error.text ? `${id}-d-text-err` : undefined}
                      onChange={(e) => setDraft({ ...draft, text: e.currentTarget.value, error: { ...draft.error, text: undefined } })}
                    />
                    {draft.error.text ? (
                      <p id={`${id}-d-text-err`} className="fl-drev-error" role="alert">
                        <Icon name="alert" />
                        {draft.error.text}
                      </p>
                    ) : null}
                  </div>
                  <div className="fl-drev-actions">
                    <Button variant="tertiary" size={32} onClick={cancelDraft}>
                      {l.cancel}
                    </Button>
                    <Button type="submit" size={32}>
                      {l.start}
                    </Button>
                  </div>
                </form>
              ) : null}

              {!threads.length && !draft ? (
                <div className="fl-drev-empty">
                  <Icon name="mail" />
                  <p className="fl-drev-empty-title">{l.empty}</p>
                  <p>{l.emptyText}</p>
                </div>
              ) : !shown.length && !draft ? (
                <div className="fl-drev-empty">
                  <Icon name={filter === "open" ? "check" : "info"} />
                  <p className="fl-drev-empty-title">{filter === "open" ? l.noneOpen : l.noneResolved}</p>
                </div>
              ) : null}

              {shown.map((t) => {
                const p = doc.paragraphs.find((x) => x.id === t.para);
                const gone = !p || p.text.indexOf(t.quote) < 0;
                const folded = t.status === "resolved" && !unfolded[t.id];
                const r = replies[t.id] ?? { text: "", error: "" };
                return (
                  <article
                    key={t.id}
                    id={`${id}-t-${t.id}`}
                    data-flip={t.id}
                    tabIndex={-1}
                    className={["fl-drev-card", active === t.id ? "is-active" : "", t.status === "resolved" ? "is-resolved" : ""].filter(Boolean).join(" ")}
                    aria-label={`${t.quote}, ${t.status === "open" ? l.open : l.resolved}`}
                    onFocus={() => setActive(t.id)}
                    onClick={() => setActive(t.id)}
                  >
                    <div className="fl-drev-cardhead">
                      <blockquote className="fl-drev-quote">{t.quote}</blockquote>
                      <Badge tone={t.status === "open" ? "warning" : "success"}>{t.status === "open" ? l.open : l.resolved}</Badge>
                    </div>
                    {gone ? <p className="fl-drev-gone">{l.passageGone}</p> : null}

                    <div className={["fl-drev-fold", folded ? "" : "is-open"].filter(Boolean).join(" ")} inert={folded || undefined}>
                      <div>
                        <ol className="fl-drev-comments">
                          {t.comments.map((c) => (
                            <li key={c.id}>
                              <Avatar name={c.who} size={24} tone={toneFor(c.who)} decorative />
                              <div>
                                <p className="fl-drev-who">
                                  <strong>{c.who}</strong>
                                  <time dateTime={c.at}>{when(c.at)}</time>
                                </p>
                                <p className="fl-drev-text">{c.text}</p>
                              </div>
                            </li>
                          ))}
                        </ol>
                        {t.status === "open" ? (
                          <div className="fl-drev-reply">
                            <label className="fl-sr" htmlFor={`${id}-r-${t.id}`}>
                              {l.replyTo.replace("{who}", t.comments[0]?.who ?? "")}
                            </label>
                            <TextField
                              id={`${id}-r-${t.id}`}
                              multiline
                              autoGrow
                              rows={1}
                              placeholder={l.reply}
                              value={r.text}
                              invalid={Boolean(r.error)}
                              aria-describedby={r.error ? `${id}-r-${t.id}-err` : undefined}
                              onChange={(e) => setReplies({ ...replies, [t.id]: { text: e.currentTarget.value, error: "" } })}
                              onKeyDown={(e) => onReplyKey(e, t)}
                            />
                            {r.error ? (
                              <p id={`${id}-r-${t.id}-err`} className="fl-drev-error" role="alert">
                                <Icon name="alert" />
                                {r.error}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="fl-drev-actions">
                      {!gone ? (
                        <Button variant="tertiary" size={32} icon="eye" onClick={() => focusMark(t.id)}>
                          {l.showInPage}
                        </Button>
                      ) : null}
                      {t.status === "resolved" ? (
                        <Button variant="tertiary" size={32} aria-expanded={!folded} onClick={() => setUnfolded({ ...unfolded, [t.id]: folded })}>
                          {folded ? l.showComments.replace("{n}", String(t.comments.length)) : l.hideComments}
                        </Button>
                      ) : null}
                      <span className="fl-drev-spacer" />
                      <Button variant="tertiary" size={32} icon="trash" iconOnly className="fl-drev-del" onClick={() => setDeleteFor(t)}>
                        {l.remove}
                      </Button>
                      {t.status === "open" ? (
                        <>
                          <Button variant="secondary" size={32} onClick={() => sendReply(t)}>
                            {l.reply}
                          </Button>
                          <Button size={32} icon="check" onClick={() => setStatus(t, "resolved")}>
                            {l.resolve}
                          </Button>
                        </>
                      ) : (
                        <Button variant="secondary" size={32} icon="refresh" onClick={() => setStatus(t, "open")}>
                          {l.reopen}
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>

      {deleteFor ? (
        <Modal
          variant="danger"
          icon="trash"
          title={l.removeTitle}
          description={l.removeText.replace("{n}", String(deleteFor.comments.length))}
          confirmLabel={l.remove}
          onConfirm={() => remove()}
          onClose={() => setDeleteFor(null)}
        />
      ) : null}
    </section>
  );
}

const ago = (minutes: number) => new Date(Date.now() - minutes * 60000).toISOString();

// flowcode:sample
const SAMPLE = {
  title: "Review: Autumn launch post",
  me: "Ana Ruiz",
  doc: {
    title: "Meet the new Planner",
    meta: "Draft 3 · Blog · Due Friday",
    paragraphs: [
      { id: "p1", text: "Planning a week shouldn't take a whole afternoon. Today we're launching the new Planner, a calmer way to see what's coming and decide what matters." },
      { id: "p2", text: "What's new", heading: true },
      { id: "p3", text: "Every task now shows how long it will take, so you can fill a day without overfilling it. Drag a task onto the calendar and it books the time for you." },
      { id: "p4", text: "Shared lists keep everyone on the same page. Invite your team, assign owners and watch progress update in real time, with no refresh needed." },
      { id: "p5", text: "The Planner is free for teams of up to five people. Larger teams can try every paid feature for 30 days, no card required." },
    ],
  } as ReviewDoc,
  threads: [
    { id: "t1", para: "p1", quote: "a calmer way", status: "open", comments: [{ id: "c1", who: "Sam Okafor", at: ago(180), text: "Love this. Can we say calmer than what? Maybe compare to the old weekly view." }, { id: "c2", who: "Ana Ruiz", at: ago(95), text: "I'd rather not name the old view. Keeping it as is for now." }] },
    { id: "t2", para: "p3", quote: "it books the time for you", status: "open", comments: [{ id: "c3", who: "Priya Shah", at: ago(60), text: "Only if calendar sync is on. Add a short note or link to setup?" }] },
    { id: "t3", para: "p4", quote: "in real time, with no refresh needed", status: "resolved", comments: [{ id: "c4", who: "Leo Brandt", at: ago(1500), text: "Redundant. \"In real time\" already says it." }, { id: "c5", who: "Ana Ruiz", at: ago(1440), text: "Fair, will trim in the next draft." }] },
    { id: "t4", para: "p5", quote: "30 days", status: "open", comments: [{ id: "c6", who: "Priya Shah", at: ago(25), text: "Legal says the trial is 14 days now. Please double-check before we publish." }] },
  ] as ReviewThread[],
};

export default function DocumentReviewSheet() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap">
        <DocumentReview title={SAMPLE.title} doc={SAMPLE.doc} me={SAMPLE.me} load={() => new Promise((r) => window.setTimeout(() => r(SAMPLE.threads), 700))} />
      </div>
    </section>
  );
}
