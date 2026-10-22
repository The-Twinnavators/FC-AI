/** @flowcode-library forum-thread · Forum thread with replies (Cards)
 * Catalog ID: p.forum-thread (pattern)
 * Function: A discussion thread (p.forum-thread): the question with an upvote, Follow and Share, then the replies sorted by oldest, newest or top (they glide to their new places); like a reply (the heart pops, the count bumps), quote it into your reply, mark one as the answer (it folds open under the question and can be changed), report a reply with a reason (it hides for you, with Undo), delete your own after a confirm; each reply's actions are one toolbar for the keyboard; a validated reply box whose new reply slides in; loading, a load error with Retry and an empty state, every change announced. Adapted from Tailblocks and Meraki UI (MIT).
 * Use it as: import { ForumThread } from "./forum-thread"; <ForumThread me="Signed-in name" thread?={{ id, title, category, author, at: ISO, body, votes, voted?, following?, solved?: "reply id", replies: [{ id, author, role?: "moderator"|"staff", at: ISO, text, likes, liked? }] }} load?={async () => ForumThreadData} canMarkAnswer? onBack? shareUrl? onChange?={(thread) => ...} onReply?={async (text) => void} labels?={{ back, follow, following, share, report, answer, ... }} />
 * Built from: c.avatar.person, c.badge.status, c.segmented.segmented, c.text-field.outlined, c.button.primary, c.button.secondary, c.button.tertiary, c.modal.form, c.modal.danger, c.empty-state, c.skeleton
 * Look: A white card: a back link, the category pill and the thread title, the asker's round initials, name and time, the question text, then a row of an upvote count, Follow and Share. A green-edged Answer box (a straight green bar at its left) quotes the accepted reply. Below, a reply count beside an Oldest / Newest / Top switch with a sliding thumb, then replies: initials, name, a role pill, time, the text and a small toolbar (heart and count, Quote, Mark as answer, Share, Report or Delete). A sunken reply box with a counter and Post reply closes it.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-border-strong --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-danger --surface-radius --surface-shadow --pill-radius --radius-sm --radius-md --space-1 --space-2 --space-3 --space-4 --space-5 --text-xs --text-sm --text-md --text-xl --font-display --weight-medium --weight-semibold --focus-ring --duration-instant --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance
 * Use cases: community forum; help forum; Q&A thread; support community; discussion board; product community; course discussion; member questions
 * Jobs to be done: read a question and its replies; reply to a thread; find the answer that solved it; mark the reply that answered my question; report a reply that breaks the rules; follow a thread for updates
 * Keywords: forum, thread, replies, discussion, answer, solved, accepted answer, like, upvote, report, community, Q&A
 */
/**
 * Forum thread: one question and its replies. Each reply's actions are one toolbar (arrow keys move inside it, Tab
 * leaves it), so a long thread is not a long run of Tab stops. Mark as answer is offered to the person who asked (or
 * when canMarkAnswer is set, a moderator); the answer is quoted under the question with a link to it. Reporting asks
 * for a reason and hides the reply for you only, with Undo. Sorting glides the replies to their new places (FLIP),
 * a new reply slides in, likes pop and their counts bump; with motion off everything simply changes.
 * Make it the app's own: replace SAMPLE with the real thread, pass onReply to save replies, and onChange to keep
 * likes, answers and reports.
 * Adapted from Tailblocks (MIT License, Copyright (c) 2020 Mert Cukuren), its blog and content list blocks, and Meraki
 * UI (MIT License, Copyright (c) 2021 Khatab Wedaa), its avatar, tabs and modal components.
 */
/**
 * How to try it
 * - Wait for the thread to load. Press the heart on a reply: it pops and the count goes up. Press it again.
 * - Pick Top: the replies glide into their new order. Use the arrow keys inside a reply's toolbar.
 * - Press Mark as answer on a reply: the Answer box opens under the question. Jump to it, or press Unmark.
 * - Press Report, send it without a reason (it asks for one), pick Spam and send: the reply hides, with Undo.
 * - Post an empty reply (it says why), then a real one: it slides in at the end and the count updates. Delete it.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useRef, useState, flushSync from react-dom), the library's
 * Avatar, Badge, Button, TextField, Modal, EmptyState and Skeleton ("./avatars-variants", "./badges-status",
 * "./buttons-variants", "./text-fields-states", "./modals-dialogs", "./empty-states", "./skeleton-loading") and its
 * inline icon set ("./icons"). Nothing else: no package and nothing fetched. The styles are the library's own fl-
 * classes in templates/library/css/r6c-forum-thread.css.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { flushSync } from "react-dom";
import { Avatar, type AvatarTone } from "./avatars-variants";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { EmptyState } from "./empty-states";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { Skeleton } from "./skeleton-loading";
import { TextField } from "./text-fields-states";

// ── p.forum-thread: a question, its replies, the accepted answer and a reply box. ──

export type ForumRole = "moderator" | "staff";
export type ForumReply = { id: string; author: string; role?: ForumRole; at: string; text: string; likes: number; liked?: boolean };
export type ForumThreadData = {
  id: string;
  title: string;
  category: string;
  author: string;
  at: string;
  body: string;
  votes: number;
  voted?: boolean;
  following?: boolean;
  /** The id of the reply marked as the answer. */
  solved?: string;
  replies: ForumReply[];
};
type Labels = {
  back: string; vote: string; follow: string; following: string; share: string; copied: string; copyFailed: string; answer: string; jump: string; unmark: string;
  markAnswer: string; isAnswer: string; replies: string; reply: string; sort: string; oldest: string; newest: string; top: string; like: string; quote: string; report: string;
  remove: string; author: string; moderator: string; staff: string; you: string; yourReply: string; post: string; posting: string; empty: string; emptyText: string;
  tooShort: string; tooLong: string; failed: string; loadFailed: string; retry: string; loading: string; hidden: string; show: string; undo: string;
  reportTitle: string; reportReason: string; reportNote: string; reportSend: string; reportNeed: string; reportNeedNote: string; reported: string;
  deleteTitle: string; deleteText: string; deleteConfirm: string; deleted: string; posted: string;
};
export type ForumThreadProps = {
  /** The signed-in person's name, as it appears on their replies. */
  me: string;
  thread?: ForumThreadData;
  /** Loads the thread; while it runs a skeleton shows, and a failure offers Retry. */
  load?: () => Promise<ForumThreadData>;
  /** Who may mark an answer; the person who asked when left out. */
  canMarkAnswer?: boolean;
  /** Shows a back link above the thread. */
  onBack?: () => void;
  /** The thread's address, for Share (a reply adds #its-id). */
  shareUrl?: string;
  /** Saves a reply; throw to report a failure (the text stays in the box). */
  onReply?: (text: string) => Promise<void> | void;
  onChange?: (thread: ForumThreadData) => void;
  maxLength?: number;
  labels?: Partial<Labels>;
};

const REASONS = [
  { id: "spam", label: "Spam or advertising" },
  { id: "rude", label: "Rude or harassing" },
  { id: "off", label: "Off topic" },
  { id: "other", label: "Something else" },
];

// ── Small helpers ──

const TONES: AvatarTone[] = ["a", "b", "c", "d", "e"];
const toneOf = (name: string) => TONES[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % TONES.length]!;
const rtf = typeof Intl !== "undefined" && "RelativeTimeFormat" in Intl ? new Intl.RelativeTimeFormat("en-US", { numeric: "auto" }) : null;
function ago(iso: string) {
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [["second", 60], ["minute", 60], ["hour", 24], ["day", 7], ["week", 4.35], ["month", 12], ["year", Infinity]];
  let v = s;
  for (const [unit, size] of steps) {
    if (Math.abs(v) < size) return rtf ? rtf.format(Math.round(v), unit) : new Date(iso).toLocaleDateString();
    v /= size;
  }
  return new Date(iso).toLocaleDateString();
}
const fullDate = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

const ms = (v: string, fallback: number) => (/ms$/.test(v.trim()) ? parseFloat(v) : /s$/.test(v.trim()) ? parseFloat(v) * 1000 : fallback);
const motionOff = () => document.documentElement.dataset.motion === "off" || typeof Element.prototype.animate !== "function";
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
let moving: Animation[] = [];
/** Rows glide from where they were to where they are after a re-sort (FLIP); reduced motion skips the glide. */
function glide(list: HTMLElement | null, update: () => void) {
  if (!list || motionOff() || reducedMotion()) {
    update();
    return;
  }
  const first = new Map<string, DOMRect>();
  for (const el of Array.from(list.children) as HTMLElement[]) if (el.dataset.key) first.set(el.dataset.key, el.getBoundingClientRect());
  for (const m of moving) m.cancel();
  moving = [];
  flushSync(update);
  const css = getComputedStyle(document.documentElement);
  const slow = ms(css.getPropertyValue("--duration-slow"), 320);
  const easing = css.getPropertyValue("--ease-out").trim() || "ease-out";
  for (const el of Array.from(list.children) as HTMLElement[]) {
    const was = el.dataset.key ? first.get(el.dataset.key) : undefined;
    if (!was) continue;
    const now = el.getBoundingClientRect();
    const dy = was.top - now.top;
    if (Math.abs(dy) < 1) continue;
    moving.push(el.animate([{ translate: `0 ${dy}px` }, { translate: "0 0" }], { duration: slow, easing }));
  }
}
/** Plays a short leave animation, then runs the change. */
function leave(el: HTMLElement | null, then: () => void) {
  if (!el || motionOff()) {
    then();
    return;
  }
  const css = getComputedStyle(document.documentElement);
  const base = ms(css.getPropertyValue("--duration-base"), 200);
  const a = el.animate([{ opacity: 1 }, { opacity: 0, translate: reducedMotion() ? "0 0" : "0 -6px" }], { duration: base, easing: "ease-in", fill: "forwards" });
  // A hidden tab may never finish the animation, so a timer makes sure the change still happens.
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    then();
  };
  a.onfinish = finish;
  a.oncancel = finish;
  setTimeout(finish, base + 120);
}

/** A number that bumps when it changes (not on first paint). */
function Bump({ n, className }: { n: number; className: string }) {
  const prev = useRef(n);
  const [k, setK] = useState(0);
  useEffect(() => {
    if (prev.current !== n) {
      prev.current = n;
      setK((x) => x + 1);
    }
  }, [n]);
  return (
    <span key={k} className={`${className}${k ? " is-bump" : ""}`}>
      {n}
    </span>
  );
}

/** Line glyphs the shared icon set doesn't have, drawn the same way (24 by 24, 1.75 stroke). */
const GLYPH: Record<string, string> = {
  up: "M12 19V5M5 12l7-7 7 7",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  quote: "M7 7h4v5c0 2.5-1.5 4-4 5M14 7h4v5c0 2.5-1.5 4-4 5",
  solved: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12.5l2.5 2.5L16 9.5",
};
function Glyph({ name }: { name: keyof typeof GLYPH }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={GLYPH[name]} />
    </svg>
  );
}

/** A radio group drawn as a track with a thumb that slides to the chosen option (arrow keys move and choose). */
function SortSwitch({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useThumb(box, value);
  const move = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = options.findIndex((o) => o.value === value);
    const n = e.key === "ArrowRight" || e.key === "ArrowDown" ? i + 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? options.length - 1 : null;
    if (n === null) return;
    e.preventDefault();
    const next = options[(n + options.length) % options.length]!;
    onChange(next.value);
    box.current?.querySelector<HTMLElement>(`[data-v="${next.value}"]`)?.focus();
  };
  return (
    <div className="fl-thrd-seg" role="radiogroup" aria-label={label} ref={box} onKeyDown={move}>
      <span className="fl-thrd-thumb" aria-hidden="true" />
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" data-v={o.value} aria-checked={value === o.value} tabIndex={value === o.value ? 0 : -1} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
/** Measures the chosen option so the thumb can slide to it; no slide on the first placement. */
function useThumb(box: RefObject<HTMLElement | null>, key: string) {
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const place = () => {
      const on = el.querySelector<HTMLElement>('[aria-checked="true"], [aria-selected="true"]');
      if (!on) return;
      el.style.setProperty("--thumb-x", `${on.offsetLeft}px`);
      el.style.setProperty("--thumb-w", `${on.offsetWidth}px`);
      if (!el.dataset.ready) setTimeout(() => (el.dataset.ready = "1"), 0);
    };
    place();
    if (typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [box, key]);
}

/** Arrow keys move between a toolbar's buttons; only one of them is a Tab stop. */
function toolbarKeys(e: KeyboardEvent<HTMLElement>) {
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled)"));
  const i = items.indexOf(document.activeElement as HTMLElement);
  if (i < 0) return;
  const n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : null;
  if (n === null) return;
  e.preventDefault();
  const to = items[(n + items.length) % items.length]!;
  for (const it of items) it.tabIndex = it === to ? 0 : -1;
  to.focus();
}
function Toolbar({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // Keep exactly one Tab stop as buttons come and go.
  useLayoutEffect(() => {
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>("button:not(:disabled)") ?? []);
    if (!items.length) return;
    const current = items.find((it) => it.tabIndex === 0 && it.dataset.roved);
    for (const it of items) {
      it.dataset.roved = "1";
      it.tabIndex = it === (current ?? items[0]) ? 0 : -1;
    }
  });
  return (
    <div className="fl-thrd-tools" role="toolbar" aria-label={label} ref={ref} onKeyDown={toolbarKeys}>
      {children}
    </div>
  );
}

/** A like: the heart pops when it turns on and the count bumps. */
function LikeButton({ on, count, label, onToggle }: { on: boolean; count: number; label: string; onToggle: () => void }) {
  const [pop, setPop] = useState(0);
  return (
    <button
      type="button"
      className="fl-thrd-act fl-thrd-like"
      aria-pressed={on}
      aria-label={`${label}, ${count}`}
      onClick={() => {
        if (!on) setPop((p) => p + 1);
        onToggle();
      }}
    >
      <span key={pop} className={`fl-thrd-heart${pop ? " is-pop" : ""}`}>
        <Icon name="heart" filled={on} />
      </span>
      <Bump n={count} className="fl-thrd-n" />
    </button>
  );
}

const paragraphs = (text: string) => text.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>);

// ── The thread ──

export function ForumThread({ me, thread: given, load, canMarkAnswer, onBack, shareUrl, onReply, onChange, maxLength = 2000, labels = {} }: ForumThreadProps) {
  const l: Labels = {
    back: "All threads", vote: "Upvote", follow: "Follow", following: "Following", share: "Share", copied: "Link copied", copyFailed: "Couldn't copy. The link is", answer: "Answer", jump: "Go to reply",
    unmark: "Unmark", markAnswer: "Mark as answer", isAnswer: "Answer", replies: "replies", reply: "reply", sort: "Sort replies", oldest: "Oldest", newest: "Newest", top: "Top", like: "Like",
    quote: "Quote", report: "Report", remove: "Delete", author: "Asked this", moderator: "Moderator", staff: "Staff", you: "You", yourReply: "Your reply", post: "Post reply", posting: "Posting...",
    empty: "No replies yet", emptyText: "Be the first to help out.", tooShort: "Write a reply first.", tooLong: "That's over the limit. Shorten it a little.", failed: "Couldn't post your reply. Try again.",
    loadFailed: "Couldn't load this thread.", retry: "Try again", loading: "Loading the thread", hidden: "You reported this reply. It's hidden for you.", show: "Show", undo: "Undo report",
    reportTitle: "Report this reply?", reportReason: "What's wrong with it?", reportNote: "Tell the moderators more", reportSend: "Send report", reportNeed: "Pick a reason.", reportNeedNote: "Add a few words so the moderators know what to look for.",
    reported: "Reported. Thanks, a moderator will look at it.", deleteTitle: "Delete your reply?", deleteText: "It's removed from the thread for everyone. This can't be undone.", deleteConfirm: "Delete reply", deleted: "Reply deleted", posted: "Reply posted",
    ...labels,
  };
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [thread, setThread] = useState<ForumThreadData | null>(given ?? null);
  const [state, setState] = useState<"ready" | "loading" | "error">(given || !load ? "ready" : "loading");
  const [sort, setSort] = useState("oldest");
  const [hidden, setHidden] = useState<Record<string, "hidden" | "shown">>({});
  const [fresh, setFresh] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState("");
  const [posting, setPosting] = useState(false);
  const [reporting, setReporting] = useState<ForumReply | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [reportError, setReportError] = useState("");
  const [deleting, setDeleting] = useState<ForumReply | null>(null);
  const [focusTo, setFocusTo] = useState<{ id: string; sub?: string; n: number } | null>(null);
  const list = useRef<HTMLOListElement>(null);
  const latest = useRef(thread);
  latest.current = thread;
  const getBox = () => document.getElementById(`${uid}-box`) as HTMLTextAreaElement | null;

  const run = () => {
    if (!load) return;
    setState("loading");
    load().then(
      (t) => {
        setThread(t);
        setState("ready");
      },
      () => setState("error"),
    );
  };
  useEffect(() => {
    if (!given && load) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Focus lands after dialogs have closed and handed focus back.
  useEffect(() => {
    if (!focusTo) return;
    const el = document.getElementById(focusTo.id);
    ((focusTo.sub ? el?.querySelector<HTMLElement>(focusTo.sub) : null) ?? el)?.focus();
  }, [focusTo]);
  const focusLater = (id: string, sub?: string) => setFocusTo({ id, sub, n: Date.now() });

  const change = (next: ForumThreadData) => {
    setThread(next);
    onChange?.(next);
  };

  if (state === "loading") {
    return (
      <div className="fl-thrd" data-fl="p.forum-thread" aria-busy="true">
        <p className="fl-sr" role="status">
          {l.loading}
        </p>
        <div className="fl-thrd-skel">
          <Skeleton variant="text" width="30%" />
          <Skeleton variant="text" width="80%" height={28} />
          <Skeleton variant="row" />
          <Skeleton variant="text" lines={3} />
          <Skeleton variant="block" height={96} />
          <Skeleton variant="block" height={96} />
        </div>
      </div>
    );
  }
  if (state === "error" || !thread) {
    return (
      <div className="fl-thrd" data-fl="p.forum-thread">
        <EmptyState
          variant="error"
          title={l.loadFailed}
          action={
            <Button variant="secondary" size={40} icon="refresh" onClick={run}>
              {l.retry}
            </Button>
          }
        />
      </div>
    );
  }

  const asker = thread.author;
  const mayMark = canMarkAnswer ?? me === asker;
  const answer = thread.replies.find((r) => r.id === thread.solved);
  const sorted = [...thread.replies].sort((a, b) =>
    sort === "newest" ? b.at.localeCompare(a.at) : sort === "top" ? b.likes - a.likes || a.at.localeCompare(b.at) : a.at.localeCompare(b.at),
  );
  const count = thread.replies.length;
  const word = count === 1 ? l.reply : l.replies;
  const rid = (id: string) => `${uid}-r-${id}`;

  const copy = async (hash?: string) => {
    const url = `${shareUrl ?? (typeof location !== "undefined" ? location.href.split("#")[0] : "")}${hash ? `#${hash}` : ""}`;
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(url);
      setStatus(l.copied);
    } catch {
      setStatus(`${l.copyFailed} ${url}`);
    }
  };
  const vote = () => {
    const on = !thread.voted;
    change({ ...thread, voted: on, votes: thread.votes + (on ? 1 : -1) });
    setStatus(on ? `Upvoted. ${thread.votes + 1} votes` : `Upvote removed. ${thread.votes - 1} votes`);
  };
  const follow = () => {
    const on = !thread.following;
    change({ ...thread, following: on });
    setStatus(on ? "Following. You'll hear about new replies." : "Not following this thread anymore.");
  };
  const like = (r: ForumReply) => {
    const on = !r.liked;
    change({ ...thread, replies: thread.replies.map((x) => (x.id === r.id ? { ...x, liked: on, likes: x.likes + (on ? 1 : -1) } : x)) });
    setStatus(on ? `Liked ${r.author}'s reply` : `Like removed from ${r.author}'s reply`);
  };
  const mark = (r: ForumReply) => {
    const on = thread.solved !== r.id;
    change({ ...thread, solved: on ? r.id : undefined });
    setStatus(on ? `Marked ${r.author}'s reply as the answer` : "Answer unmarked");
  };
  const quote = (r: ForumReply) => {
    const first = r.text.split(/\n/)[0]!.slice(0, 160);
    const text = `> ${r.author}: ${first}${r.text.length > first.length ? "..." : ""}\n\n${draft}`;
    setDraft(text);
    setDraftError("");
    setTimeout(() => {
      const el = getBox();
      if (!el) return;
      el.focus();
      el.setSelectionRange(text.length, text.length);
      el.scrollIntoView({ block: "nearest", behavior: motionOff() || reducedMotion() ? "auto" : "smooth" });
    });
  };
  const jump = (id: string) => {
    const el = document.getElementById(rid(id));
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: motionOff() || reducedMotion() ? "auto" : "smooth" });
    el.focus({ preventScroll: true });
    el.classList.remove("is-flash");
    void el.offsetWidth;
    el.classList.add("is-flash");
  };
  const pickSort = (v: string) => glide(list.current, () => setSort(v));

  const post = async () => {
    const text = draft.trim();
    if (!text) {
      setDraftError(l.tooShort);
      getBox()?.focus();
      return;
    }
    if (text.length > maxLength) {
      setDraftError(l.tooLong);
      getBox()?.focus();
      return;
    }
    setPosting(true);
    setDraftError("");
    try {
      await onReply?.(text);
      const r: ForumReply = { id: `r${Date.now().toString(36)}`, author: me, at: new Date().toISOString(), text, likes: 0 };
      // A new reply is easiest to find at the end of the oldest-first order.
      setSort("oldest");
      change({ ...thread, replies: [...thread.replies, r] });
      setFresh(r.id);
      setDraft("");
      setStatus(`${l.posted}. ${count + 1} ${l.replies}`);
      focusLater(rid(r.id));
    } catch {
      setDraftError(l.failed);
    } finally {
      setPosting(false);
    }
  };

  const sendReport = () => {
    if (!reporting) return false;
    if (!reason) {
      setReportError(l.reportNeed);
      return false;
    }
    if (reason === "other" && note.trim().length < 3) {
      setReportError(l.reportNeedNote);
      return false;
    }
    const r = reporting;
    setHidden((h) => ({ ...h, [r.id]: "hidden" }));
    setStatus(l.reported);
    focusLater(rid(r.id), "[data-undo]");
    return undefined;
  };
  const openReport = (r: ForumReply) => {
    setReason("");
    setNote("");
    setReportError("");
    setReporting(r);
  };
  const undoReport = (r: ForumReply) => {
    setHidden((h) => {
      const next = { ...h };
      delete next[r.id];
      return next;
    });
    setStatus("Report withdrawn");
    focusLater(rid(r.id));
  };
  const remove = (r: ForumReply) => {
    const i = sorted.findIndex((x) => x.id === r.id);
    const next = sorted[i + 1] ?? sorted[i - 1];
    const el = document.getElementById(rid(r.id))?.closest("li") as HTMLElement | null;
    leave(el, () =>
      glide(list.current, () => {
        const t = latest.current!;
        change({ ...t, replies: t.replies.filter((x) => x.id !== r.id), solved: t.solved === r.id ? undefined : t.solved });
      }),
    );
    setStatus(`${l.deleted}. ${count - 1} ${count - 1 === 1 ? l.reply : l.replies}`);
    focusLater(next ? rid(next.id) : `${uid}-box`);
  };

  const len = draft.trim().length;

  return (
    <article className="fl-thrd" data-fl="p.forum-thread" aria-labelledby={`${uid}-title`}>
      {onBack ? (
        <button type="button" className="fl-thrd-back" onClick={onBack}>
          <Icon name="arrow-left" />
          {l.back}
        </button>
      ) : null}

      <header className="fl-thrd-q">
        <div className="fl-thrd-qmeta">
          <Badge tone="info">{thread.category}</Badge>
          {answer ? (
            <Badge tone="success" led>
              Solved
            </Badge>
          ) : null}
        </div>
        <h2 className="fl-thrd-title" id={`${uid}-title`}>
          {thread.title}
        </h2>
        <div className="fl-thrd-by">
          <Avatar name={asker} size={40} tone={toneOf(asker)} decorative />
          <span>
            <strong>{asker}</strong>
            <time dateTime={thread.at} title={fullDate(thread.at)}>
              {ago(thread.at)}
            </time>
          </span>
        </div>
        <div className="fl-thrd-body">{paragraphs(thread.body)}</div>
        <div className="fl-thrd-qbar">
          <button type="button" className="fl-thrd-act fl-thrd-vote" aria-pressed={!!thread.voted} aria-label={`${l.vote}, ${thread.votes}`} onClick={vote}>
            <Glyph name="up" />
            <Bump n={thread.votes} className="fl-thrd-n" />
          </button>
          <button type="button" className="fl-thrd-act" aria-pressed={!!thread.following} onClick={follow}>
            <Icon name="bell" filled={!!thread.following} />
            {thread.following ? l.following : l.follow}
          </button>
          <button type="button" className="fl-thrd-act" onClick={() => copy()}>
            <Icon name="share" />
            {l.share}
          </button>
        </div>
      </header>

      <div className={`fl-thrd-answer${answer ? " is-open" : ""}`}>
        <div className="fl-thrd-answer-body" inert={!answer}>
          <div>
            {answer ? (
              <section className="fl-thrd-answer-card" aria-labelledby={`${uid}-ans`}>
                <h3 id={`${uid}-ans`}>
                  <Glyph name="solved" />
                  {l.answer}
                  <span>· {answer.author}</span>
                </h3>
                <p>{answer.text.split(/\n/)[0]}</p>
                <div className="fl-thrd-answer-acts">
                  <button type="button" className="fl-thrd-link" onClick={() => jump(answer.id)}>
                    {l.jump}
                  </button>
                  {mayMark ? (
                    <button type="button" className="fl-thrd-link" onClick={() => mark(answer)}>
                      {l.unmark}
                    </button>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>

      <div className="fl-thrd-listhead">
        <h3 id={`${uid}-rh`}>
          <Bump n={count} className="fl-thrd-count" /> {word}
        </h3>
        {count > 1 ? <SortSwitch label={l.sort} value={sort} onChange={pickSort} options={[{ value: "oldest", label: l.oldest }, { value: "newest", label: l.newest }, { value: "top", label: l.top }]} /> : null}
      </div>

      {count === 0 ? (
        <EmptyState variant="first-use" icon="users" title={l.empty}>
          {l.emptyText}
        </EmptyState>
      ) : null}
      <ol className="fl-thrd-list" ref={list} aria-labelledby={`${uid}-rh`}>
        {sorted.map((r) => {
          const isAnswer = thread.solved === r.id;
          const mine = r.author === me;
          const h = hidden[r.id];
          return (
            <li key={r.id} data-key={r.id} className={`fl-thrd-item${fresh === r.id ? " is-new" : ""}`} onAnimationEnd={() => fresh === r.id && setFresh(null)}>
              <article className={`fl-thrd-reply${isAnswer ? " is-answer" : ""}`} id={rid(r.id)} tabIndex={-1} aria-label={`${r.author}, ${ago(r.at)}${isAnswer ? `, ${l.isAnswer}` : ""}`}>
                {h === "hidden" ? (
                  <div className="fl-thrd-hidden">
                    <Glyph name="flag" />
                    <span>{l.hidden}</span>
                    <button type="button" className="fl-thrd-link" onClick={() => setHidden((x) => ({ ...x, [r.id]: "shown" }))}>
                      {l.show}
                    </button>
                    <button type="button" className="fl-thrd-link" data-undo onClick={() => undoReport(r)}>
                      {l.undo}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="fl-thrd-by">
                      <Avatar name={r.author} size={32} tone={toneOf(r.author)} decorative />
                      <span>
                        <strong>{mine ? `${r.author} (${l.you})` : r.author}</strong>
                        {r.author === asker ? <Badge tone="neutral">{l.author}</Badge> : null}
                        {r.role ? <Badge tone="warning">{r.role === "moderator" ? l.moderator : l.staff}</Badge> : null}
                        {isAnswer ? (
                          <Badge tone="success" led>
                            {l.isAnswer}
                          </Badge>
                        ) : null}
                        <time dateTime={r.at} title={fullDate(r.at)}>
                          {ago(r.at)}
                        </time>
                      </span>
                    </div>
                    <div className="fl-thrd-text">
                      {r.text.split(/\n\s*\n/).map((p, i) => (p.startsWith("> ") ? <blockquote key={i}>{p.slice(2)}</blockquote> : <p key={i}>{p}</p>))}
                    </div>
                    <Toolbar label={`${r.author}'s reply`}>
                      <LikeButton on={!!r.liked} count={r.likes} label={l.like} onToggle={() => like(r)} />
                      <button type="button" className="fl-thrd-act" onClick={() => quote(r)}>
                        <Glyph name="quote" />
                        {l.quote}
                      </button>
                      {mayMark ? (
                        <button type="button" className="fl-thrd-act fl-thrd-mark" aria-pressed={isAnswer} onClick={() => mark(r)}>
                          <Glyph name="solved" />
                          {isAnswer ? l.unmark : l.markAnswer}
                        </button>
                      ) : null}
                      <button type="button" className="fl-thrd-act" onClick={() => copy(rid(r.id))}>
                        <Icon name="link" />
                        {l.share}
                      </button>
                      {mine ? (
                        <button type="button" className="fl-thrd-act fl-thrd-danger" onClick={() => setDeleting(r)}>
                          <Icon name="trash" />
                          {l.remove}
                        </button>
                      ) : h === "shown" ? null : (
                        <button type="button" className="fl-thrd-act" onClick={() => openReport(r)}>
                          <Glyph name="flag" />
                          {l.report}
                        </button>
                      )}
                    </Toolbar>
                  </>
                )}
              </article>
            </li>
          );
        })}
      </ol>

      <form
        className="fl-thrd-compose"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void post();
        }}
      >
        <label htmlFor={`${uid}-box`}>{l.yourReply}</label>
        <TextField
          id={`${uid}-box`}
          multiline
          autoGrow
          rows={3}
          value={draft}
          invalid={!!draftError}
          aria-describedby={`${uid}-count${draftError ? ` ${uid}-err` : ""}`}
          placeholder="Share what worked for you"
          onChange={(e) => {
            setDraft(e.target.value);
            if (draftError) setDraftError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void post();
            }
          }}
        />
        <div className="fl-thrd-compose-foot">
          <span id={`${uid}-count`} className={`fl-thrd-counter${len > maxLength ? " is-over" : ""}`}>
            {len} / {maxLength}
          </span>
          {draftError ? (
            <p className="fl-thrd-error" id={`${uid}-err`} role="alert">
              <Icon name="alert" />
              {draftError}
            </p>
          ) : null}
          <Button type="submit" size={40} icon="send" busy={posting}>
            {posting ? l.posting : l.post}
          </Button>
        </div>
      </form>

      <p className="fl-thrd-status" role="status" aria-live="polite">
        {status}
      </p>

      {reporting ? (
        <Modal
          variant="form"
          className="fl-thrd-dlg"
          title={l.reportTitle}
          description={`${reporting.author}'s reply goes to the moderators. Only you stop seeing it.`}
          confirmLabel={l.reportSend}
          onConfirm={() => sendReport()}
          onClose={() => setReporting(null)}
        >
          <fieldset className="fl-thrd-reasons" aria-describedby={reportError ? `${uid}-rerr` : undefined}>
            <legend>{l.reportReason}</legend>
            {REASONS.map((o, i) => (
              <label key={o.id} className="fl-thrd-reason">
                <input
                  type="radio"
                  name="reason"
                  value={o.id}
                  checked={reason === o.id}
                  data-autofocus={i === 0 ? "" : undefined}
                  onChange={() => {
                    setReason(o.id);
                    setReportError("");
                  }}
                />
                {o.label}
              </label>
            ))}
          </fieldset>
          <label htmlFor={`${uid}-note`} className="fl-thrd-notelabel">
            {l.reportNote} {reason === "other" ? "" : "(optional)"}
          </label>
          <TextField id={`${uid}-note`} multiline rows={2} value={note} onChange={(e) => setNote(e.target.value)} invalid={reportError === l.reportNeedNote} />
          {reportError ? (
            <p className="fl-thrd-error" id={`${uid}-rerr`} role="alert">
              <Icon name="alert" />
              {reportError}
            </p>
          ) : null}
        </Modal>
      ) : null}
      {deleting ? (
        <Modal
          variant="danger"
          className="fl-thrd-dlg"
          icon="trash"
          title={l.deleteTitle}
          description={l.deleteText}
          confirmLabel={l.deleteConfirm}
          onConfirm={() => {
            remove(deleting);
          }}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </article>
  );
}

// flowcode:sample
const SAMPLE = (() => {
  const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
  const thread: ForumThreadData = {
    id: "t-sourdough",
    title: "My sourdough starter smells like nail polish. Is it ruined?",
    category: "Baking help",
    author: "Maya Chen",
    at: at(60 * 26),
    body: "I fed it once a day for two weeks and it doubled nicely, but this morning it smells sharp, almost like acetone. There's a gray liquid on top too.\n\nShould I throw it out and start again, or can it be saved?",
    votes: 14,
    following: true,
    replies: [
      { id: "r1", author: "Dev Patel", at: at(60 * 25), text: "That smell means it's hungry, not ruined. The gray liquid is called hooch. Pour it off and feed it twice a day for a couple of days.", likes: 9 },
      { id: "r2", author: "Lena Hoffmann", role: "moderator", at: at(60 * 24), text: "Agree with Dev. Also try a warmer spot: around 75°F wakes it up quickly. Moving this to Baking help so others can find it.", likes: 4 },
      { id: "r3", author: "Sam Rivera", at: at(60 * 20), text: "If you feed it whole wheat flour for a feed or two it perks up faster. Mine came back in a day.", likes: 12, liked: true },
      { id: "r4", author: "Maya Chen", at: at(60 * 3), text: "Poured off the hooch and fed it twice. It doubled in five hours and smells like yogurt again. Thank you all!", likes: 6 },
    ],
  };
  return { me: "Maya Chen", thread, shareUrl: "https://community.example/t/sourdough-starter" };
})();

export default function ForumThreadPreview() {
  return (
    <section className="fl-section fl-section--canvas" aria-label="Forum thread">
      <div className="fl-wrap fl-wrap--narrow">
        <ForumThread me={SAMPLE.me} shareUrl={SAMPLE.shareUrl} load={() => new Promise((ok) => setTimeout(() => ok(SAMPLE.thread), 700))} onReply={() => new Promise((ok) => setTimeout(ok, 450))} />
      </div>
    </section>
  );
}
