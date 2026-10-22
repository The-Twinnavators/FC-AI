/** @flowcode-library forum-threads · Forum thread list (Tables and lists)
 * Catalog ID: p.forum-threads (pattern)
 * Function: A discussion forum's thread list (p.forum-threads): pinned threads first, then the rest sorted by latest activity, most votes or most replies; category chips with counts, an All / Solved / Unsolved filter and a search (the rows glide to their new places); upvote a thread (the count bumps); start a new thread in a validated dialog that slides in at the top; open a thread (the preview opens the forum thread and Back returns to the same row); loading rows, a load error with Retry, a no-match state that clears the filters, every change announced. Adapted from Tailblocks and Meraki UI (MIT).
 * Use it as: import { ForumThreads } from "./forum-threads"; <ForumThreads title lede? me="Signed-in name" categories={[{ id, label }]} threads?={[{ id, title, category, author, at: ISO, lastAt?: ISO, replies, votes, voted?, pinned?, solved?, excerpt? }]} load?={async () => ForumListItem[]} onOpen?={(thread) => ...} onCreate?={async ({ title, category, body }) => void} onChange?={(threads) => ...} focusThread?="id" labels?={{ newThread, search, latest, top, busiest, ... }} />
 * Built from: c.avatar.person, c.badge.status, c.chip.filter, c.select.outlined, c.text-field.outlined, c.button.primary, c.button.secondary, c.modal.form, c.empty-state, c.skeleton, p.forum-thread
 * Look: A white card: the title with a thread count and a New thread button; a search field, a Show select and a Latest / Top / Busiest switch with a sliding thumb; category chips with counts; then rows split by thin lines: a square upvote box with an arrow and count, the thread title in bold (a pin before pinned ones), a category pill and a green Solved pill, the author's small initials and when it started, a muted one-line excerpt, and at the right the reply count and the last activity.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-border-strong --color-text --color-text-muted --color-accent --color-success --surface-radius --surface-shadow --pill-radius --radius-sm --radius-md --space-1 --space-2 --space-3 --space-4 --space-5 --text-xs --text-sm --text-md --text-lg --font-display --weight-medium --weight-semibold --focus-ring --duration-instant --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger
 * Use cases: community forum; help forum; discussion board; Q&A board; support community; course discussions; member forum; product community
 * Jobs to be done: find a discussion about my problem; see which questions are solved; start a new thread; see what's active right now; upvote a useful question
 * Keywords: forum, threads, discussion, topics, categories, pinned, solved, upvote, sort, filter, search, new thread, community, Q&A
 */
/**
 * Forum thread list. Pinned threads always lead; the rest follow the chosen order. The list is a grid for the keyboard:
 * one Tab stop, Up and Down move between threads, Left and Right between a thread's upvote and its title, Home and End
 * jump to the first and last. Filtering, searching and sorting glide the rows to their new places (FLIP); a new thread
 * slides in at the top; the sort thumb slides; upvote counts bump. With motion off, everything simply changes.
 * Make it the app's own: replace SAMPLE with the forum's real categories and threads, pass onOpen to show a thread
 * (the preview opens the library's Forum thread) and onCreate to save new threads.
 * Adapted from Tailblocks (MIT License, Copyright (c) 2020 Mert Cukuren), its blog list blocks (category and date at the
 * left of each entry), and Meraki UI (MIT License, Copyright (c) 2021 Khatab Wedaa), its table, badge and modal components.
 */
/**
 * How to try it
 * - Wait for the list to load. Press "Baking help": the rows glide. Type "zzz" in the search for the no-match state,
 *   then Clear filters.
 * - Pick Top: the rows reorder by votes; the pinned thread stays first. Upvote a thread: the count bumps.
 * - Tab into the list and use the arrow keys, then Enter on a title to open it; Back returns to the same row.
 * - Press New thread, send it empty (it says what's missing), fill it in and send: it slides in at the top.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useRef, useState, flushSync from react-dom), the library's
 * Avatar, Badge, Chip, Select, TextField, Button, Modal, EmptyState and Skeleton, and Forum thread for the preview's
 * open thread ("./avatars-variants", "./badges-status", "./chips-tags", "./dropdowns-states", "./text-fields-states",
 * "./buttons-variants", "./modals-dialogs", "./empty-states", "./skeleton-loading", "./forum-thread") and its inline icon
 * set ("./icons"). Nothing else: no package and nothing fetched. The styles are the library's own fl- classes in
 * templates/library/css/r6c-forum-threads.css.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { flushSync } from "react-dom";
import { Avatar, type AvatarTone } from "./avatars-variants";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Chip } from "./chips-tags";
import { Select } from "./dropdowns-states";
import { EmptyState } from "./empty-states";
import { ForumThread, type ForumThreadData } from "./forum-thread";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { Skeleton } from "./skeleton-loading";
import { TextField } from "./text-fields-states";

// ── p.forum-threads: the thread list of a discussion forum. ──

export type ForumCategory = { id: string; label: string };
export type ForumListItem = {
  id: string;
  title: string;
  /** A category id. */
  category: string;
  author: string;
  at: string;
  /** The last reply's time; the start when left out. */
  lastAt?: string;
  replies: number;
  votes: number;
  voted?: boolean;
  pinned?: boolean;
  solved?: boolean;
  excerpt?: string;
};
export type ForumDraft = { title: string; category: string; body: string };
type Labels = {
  newThread: string; search: string; all: string; show: string; solved: string; unsolved: string; sort: string; latest: string; top: string; busiest: string;
  pinned: string; vote: string; replies: string; reply: string; noReplies: string; threads: string; thread: string; empty: string; emptyText: string; clear: string;
  first: string; firstText: string; loadFailed: string; retry: string; loading: string; dialogTitle: string; dialogText: string; titleLabel: string; categoryLabel: string;
  bodyLabel: string; post: string; needTitle: string; needCategory: string; needBody: string; failed: string; posted: string; started: string; active: string;
};
export type ForumThreadsProps = {
  title: string;
  lede?: string;
  /** The signed-in person: new threads are theirs. */
  me: string;
  categories: ForumCategory[];
  threads?: ForumListItem[];
  load?: () => Promise<ForumListItem[]>;
  onOpen?: (thread: ForumListItem) => void;
  /** Saves a new thread; throw to keep the dialog open with an error. */
  onCreate?: (draft: ForumDraft) => Promise<void> | void;
  onChange?: (threads: ForumListItem[]) => void;
  /** A thread id to focus on arrival, such as the one just closed, so Back lands where the person left. */
  focusThread?: string;
  labels?: Partial<Labels>;
};

// ── Helpers ──

const TONES: AvatarTone[] = ["a", "b", "c", "d", "e"];
const toneOf = (name: string) => TONES[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % TONES.length]!;
const rtf = typeof Intl !== "undefined" && "RelativeTimeFormat" in Intl ? new Intl.RelativeTimeFormat("en-US", { numeric: "auto" }) : null;
function ago(iso: string) {
  let v = (new Date(iso).getTime() - Date.now()) / 1000;
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [["second", 60], ["minute", 60], ["hour", 24], ["day", 7], ["week", 4.35], ["month", 12], ["year", Infinity]];
  for (const [unit, size] of steps) {
    if (Math.abs(v) < size) return rtf ? rtf.format(Math.round(v), unit) : new Date(iso).toLocaleDateString();
    v /= size;
  }
  return new Date(iso).toLocaleDateString();
}
const ms = (v: string, fallback: number) => (/ms$/.test(v.trim()) ? parseFloat(v) : /s$/.test(v.trim()) ? parseFloat(v) * 1000 : fallback);
const motionOff = () => document.documentElement.dataset.motion === "off" || typeof Element.prototype.animate !== "function";
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
let moving: Animation[] = [];
/** Rows that stay glide to their new places (FLIP); rows that arrive fade in. Reduced motion only fades. */
function glide(list: HTMLElement | null, update: () => void) {
  if (!list || motionOff()) {
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
  const base = ms(css.getPropertyValue("--duration-base"), 200);
  const easing = css.getPropertyValue("--ease-out").trim() || "ease-out";
  const reduced = reducedMotion();
  for (const el of Array.from(list.children) as HTMLElement[]) {
    const was = el.dataset.key ? first.get(el.dataset.key) : undefined;
    if (!was) {
      moving.push(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: base, easing }));
      continue;
    }
    if (reduced) continue;
    const dy = was.top - el.getBoundingClientRect().top;
    if (Math.abs(dy) < 1) continue;
    moving.push(el.animate([{ translate: `0 ${dy}px` }, { translate: "0 0" }], { duration: slow, easing }));
  }
}
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
const GLYPH = {
  up: "M12 19V5M5 12l7-7 7 7",
  pin: "M9 3h6l-1 6 4 4H6l4-4zM12 13v8",
  reply: "M4 5h16v11H9l-5 4z",
};
function Glyph({ name }: { name: keyof typeof GLYPH }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={GLYPH[name]} />
    </svg>
  );
}
function useThumb(box: RefObject<HTMLElement | null>, key: string) {
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const place = () => {
      const on = el.querySelector<HTMLElement>('[aria-checked="true"]');
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
function SortSwitch({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useThumb(box, value);
  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = options.findIndex((o) => o.value === value);
    const n = e.key === "ArrowRight" || e.key === "ArrowDown" ? i + 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? options.length - 1 : null;
    if (n === null) return;
    e.preventDefault();
    const next = options[(n + options.length) % options.length]!;
    onChange(next.value);
    box.current?.querySelector<HTMLElement>(`[data-v="${next.value}"]`)?.focus();
  };
  return (
    <div className="fl-forum-seg" role="radiogroup" aria-label={label} ref={box} onKeyDown={keys}>
      <span className="fl-forum-thumb" aria-hidden="true" />
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" data-v={o.value} aria-checked={value === o.value} tabIndex={value === o.value ? 0 : -1} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── The list ──

export function ForumThreads({ title, lede, me, categories, threads, load, onOpen, onCreate, onChange, focusThread, labels = {} }: ForumThreadsProps) {
  const l: Labels = {
    newThread: "New thread", search: "Search threads", all: "All", show: "Show", solved: "Solved", unsolved: "Unsolved", sort: "Sort threads", latest: "Latest", top: "Top", busiest: "Busiest",
    pinned: "Pinned", vote: "Upvote", replies: "replies", reply: "reply", noReplies: "No replies yet", threads: "threads", thread: "thread", empty: "No threads match", emptyText: "Try other words, or look in every category.", clear: "Clear filters",
    first: "No threads yet", firstText: "Start the first discussion.", loadFailed: "Couldn't load the threads.", retry: "Try again", loading: "Loading threads", dialogTitle: "Start a thread", dialogText: "Ask a question or start a discussion.",
    titleLabel: "Title", categoryLabel: "Category", bodyLabel: "Details", post: "Post thread", needTitle: "Give it a title of at least 10 characters.", needCategory: "Pick a category.", needBody: "Add at least 20 characters of detail.",
    failed: "Couldn't post the thread. Try again.", posted: "Thread posted", started: "started", active: "active",
    ...labels,
  };
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [items, setItems] = useState<ForumListItem[]>(threads ?? []);
  const [state, setState] = useState<"ready" | "loading" | "error">(threads || !load ? "ready" : "loading");
  const [cat, setCat] = useState("all");
  const [show, setShow] = useState("all");
  const [sort, setSort] = useState("latest");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [active, setActive] = useState<{ id: string; col: "vote" | "title" } | null>(focusThread ? { id: focusThread, col: "title" } : null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<ForumDraft>({ title: "", category: "", body: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof ForumDraft | "form", string>>>({});
  const [busy, setBusy] = useState(false);
  const [focusTo, setFocusTo] = useState<{ id: string; n: number } | null>(null);
  const tidFor = (id: string) => `${uid}-title-${id}`;
  useEffect(() => {
    if (!focusThread) return;
    const el = document.getElementById(tidFor(focusThread));
    el?.focus();
    el?.scrollIntoView({ block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (threads) setItems(threads);
  }, [threads]);
  const run = () => {
    if (!load) return;
    setState("loading");
    load().then(
      (t) => {
        setItems(t);
        setState("ready");
      },
      () => setState("error"),
    );
  };
  useEffect(() => {
    if (!threads && load) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (focusTo) document.getElementById(focusTo.id)?.focus();
  }, [focusTo]);

  const update = (next: ForumListItem[]) => {
    setItems(next);
    onChange?.(next);
  };
  const catLabel = (id: string) => categories.find((c) => c.id === id)?.label ?? id;
  const q = query.trim().toLowerCase();
  const inCat = (id: string) => (id === "all" ? items : items.filter((t) => t.category === id));
  const last = (t: ForumListItem) => t.lastAt ?? t.at;
  const shown = inCat(cat)
    .filter((t) => (show === "solved" ? t.solved : show === "unsolved" ? !t.solved : true))
    .filter((t) => !q || t.title.toLowerCase().includes(q) || (t.excerpt ?? "").toLowerCase().includes(q) || t.author.toLowerCase().includes(q))
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (sort === "top" ? b.votes - a.votes : sort === "busiest" ? b.replies - a.replies : 0) || last(b).localeCompare(last(a)));
  const tid = (id: string, col: "vote" | "title") => `${uid}-${col}-${id}`;
  const current = active && shown.some((t) => t.id === active.id) ? active : shown[0] ? { id: shown[0].id, col: "title" as const } : null;

  const refilter = (fn: () => void) => glide(list.current, fn);
  const clear = () => {
    refilter(() => {
      setCat("all");
      setShow("all");
      setQuery("");
    });
    document.getElementById(`${uid}-q`)?.focus();
  };
  const vote = (t: ForumListItem) => {
    const on = !t.voted;
    update(items.map((x) => (x.id === t.id ? { ...x, voted: on, votes: x.votes + (on ? 1 : -1) } : x)));
    setStatus(`${on ? "Upvoted" : "Upvote removed"}: ${t.title}. ${t.votes + (on ? 1 : -1)} votes`);
  };
  const keys = (e: KeyboardEvent<HTMLUListElement>) => {
    if (!current) return;
    const i = shown.findIndex((t) => t.id === current.id);
    let row = i;
    let col = current.col;
    if (e.key === "ArrowDown") row = Math.min(i + 1, shown.length - 1);
    else if (e.key === "ArrowUp") row = Math.max(i - 1, 0);
    else if (e.key === "Home") row = 0;
    else if (e.key === "End") row = shown.length - 1;
    else if (e.key === "ArrowLeft") col = "vote";
    else if (e.key === "ArrowRight") col = "title";
    else return;
    e.preventDefault();
    const t = shown[row]!;
    setActive({ id: t.id, col });
    document.getElementById(tid(t.id, col))?.focus();
  };

  const openNew = () => {
    setDraft({ title: "", category: cat === "all" ? "" : cat, body: "" });
    setErrors({});
    setCreating(true);
  };
  const submit = (): false => {
    const e: typeof errors = {};
    if (draft.title.trim().length < 10) e.title = l.needTitle;
    if (!draft.category) e.category = l.needCategory;
    if (draft.body.trim().length < 20) e.body = l.needBody;
    setErrors(e);
    if (Object.keys(e).length) {
      const firstBad = (["title", "category", "body"] as const).find((k) => e[k]);
      setTimeout(() => document.getElementById(`${uid}-new-${firstBad}`)?.focus(), 0);
      return false;
    }
    setBusy(true);
    Promise.resolve()
      .then(() => onCreate?.({ title: draft.title.trim(), category: draft.category, body: draft.body.trim() }))
      .then(
        () => {
          const now = new Date().toISOString();
          const t: ForumListItem = { id: `t${Date.now().toString(36)}`, title: draft.title.trim(), category: draft.category, author: me, at: now, replies: 0, votes: 0, excerpt: draft.body.trim() };
          setBusy(false);
          setCreating(false);
          refilter(() => {
            // Show it: its category (or All) and the latest order, with no search hiding it.
            if (cat !== "all" && cat !== t.category) setCat("all");
            if (show === "solved") setShow("all");
            setQuery("");
            setSort("latest");
            update([t, ...items]);
            setFresh(t.id);
            setActive({ id: t.id, col: "title" });
          });
          setStatus(`${l.posted}: ${t.title}`);
          setFocusTo({ id: tid(t.id, "title"), n: Date.now() });
        },
        () => {
          setBusy(false);
          setErrors({ form: l.failed });
        },
      );
    return false;
  };

  const body = () => {
    if (state === "loading") {
      return (
        <div className="fl-forum-skel" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="row" seed={i} />
          ))}
        </div>
      );
    }
    if (state === "error") {
      return (
        <EmptyState
          variant="error"
          title={l.loadFailed}
          action={
            <Button variant="secondary" size={40} icon="refresh" onClick={run}>
              {l.retry}
            </Button>
          }
        />
      );
    }
    return null;
  };

  return (
    <div className="fl-forum" data-fl="p.forum-threads" aria-busy={state === "loading" || undefined}>
      <header className="fl-forum-head">
        <div className="fl-forum-heading">
          <h2 id={`${uid}-h`}>
            {title} {state === "ready" ? <Bump n={items.length} className="fl-forum-total" /> : null}
          </h2>
          {lede ? <p>{lede}</p> : null}
        </div>
        <Button size={40} icon="plus" onClick={openNew} disabled={state !== "ready"}>
          {l.newThread}
        </Button>
      </header>

      <div className="fl-forum-tools" role="search">
        <div className="fl-forum-search">
          <label htmlFor={`${uid}-q`} className="fl-sr">
            {l.search}
          </label>
          <span className="fl-forum-search-icon" aria-hidden="true">
            <Icon name="search" />
          </span>
          <TextField
            id={`${uid}-q`}
            type="search"
            size={40}
            placeholder={l.search}
            value={query}
            autoComplete="off"
            onChange={(e) => {
              const v = e.target.value;
              refilter(() => setQuery(v));
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query) {
                e.preventDefault();
                refilter(() => setQuery(""));
              }
            }}
          />
        </div>
        <div className="fl-forum-show">
          <label htmlFor={`${uid}-show`} className="fl-sr">
            {l.show}
          </label>
          <Select
            id={`${uid}-show`}
            className="fl-ctl-field--40"
            value={show}
            onChange={(e) => {
              const v = e.target.value;
              refilter(() => setShow(v));
            }}
            options={[
              { value: "all", label: `${l.show}: ${l.all}` },
              { value: "solved", label: `${l.show}: ${l.solved}` },
              { value: "unsolved", label: `${l.show}: ${l.unsolved}` },
            ]}
          />
        </div>
        <SortSwitch label={l.sort} value={sort} onChange={(v) => refilter(() => setSort(v))} options={[{ value: "latest", label: l.latest }, { value: "top", label: l.top }, { value: "busiest", label: l.busiest }]} />
      </div>
      <ul className="fl-forum-chips" aria-label={l.categoryLabel}>
        {[{ id: "all", label: l.all }, ...categories].map((c) => (
          <li key={c.id}>
            <Chip variant="filter" selected={cat === c.id} onClick={() => refilter(() => setCat(c.id))}>
              {c.label} <span className="fl-forum-n">{inCat(c.id).length}</span>
            </Chip>
          </li>
        ))}
      </ul>

      {state !== "ready" ? (
        <>
          <p className="fl-sr" role="status">
            {state === "loading" ? l.loading : ""}
          </p>
          {body()}
        </>
      ) : (
        <>
          <p className="fl-sr" role="status" aria-live="polite">
            {shown.length} {shown.length === 1 ? l.thread : l.threads}
          </p>
          <ul className="fl-forum-list" ref={list} role="grid" aria-labelledby={`${uid}-h`} onKeyDown={keys}>
            {shown.map((t) => {
              const isCur = current?.id === t.id;
              return (
                <li key={t.id} data-key={t.id} role="row" className={`fl-forum-row${t.pinned ? " is-pinned" : ""}${fresh === t.id ? " is-new" : ""}`} onAnimationEnd={() => fresh === t.id && setFresh(null)}>
                  <span role="gridcell" className="fl-forum-votecell">
                    <button
                      type="button"
                      id={tid(t.id, "vote")}
                      className="fl-forum-vote"
                      aria-pressed={!!t.voted}
                      aria-label={`${l.vote}: ${t.title}, ${t.votes}`}
                      tabIndex={isCur && current?.col === "vote" ? 0 : -1}
                      onFocus={() => setActive({ id: t.id, col: "vote" })}
                      onClick={() => vote(t)}
                    >
                      <Glyph name="up" />
                      <Bump n={t.votes} className="fl-forum-votes" />
                    </button>
                  </span>
                  <span role="gridcell" className="fl-forum-main">
                    <a
                      id={tid(t.id, "title")}
                      className="fl-forum-title"
                      href={`#${t.id}`}
                      tabIndex={isCur && current?.col === "title" ? 0 : -1}
                      onFocus={() => setActive({ id: t.id, col: "title" })}
                      onClick={(e) => {
                        if (!onOpen) return;
                        e.preventDefault();
                        onOpen(t);
                      }}
                    >
                      {t.pinned ? (
                        <span className="fl-forum-pin" title={l.pinned}>
                          <Glyph name="pin" />
                          <span className="fl-sr">{l.pinned}: </span>
                        </span>
                      ) : null}
                      {t.title}
                    </a>
                    <span className="fl-forum-meta">
                      <Badge tone="info">{catLabel(t.category)}</Badge>
                      {t.solved ? (
                        <Badge tone="success" led>
                          {l.solved}
                        </Badge>
                      ) : null}
                      <span className="fl-forum-by">
                        <Avatar name={t.author} size={20} tone={toneOf(t.author)} decorative />
                        {t.author} · {l.started} {ago(t.at)}
                      </span>
                    </span>
                    {t.excerpt ? <span className="fl-forum-excerpt">{t.excerpt}</span> : null}
                  </span>
                  <span role="gridcell" className="fl-forum-stats">
                    <span className={`fl-forum-replies${t.replies ? "" : " is-none"}`}>
                      <Glyph name="reply" />
                      {t.replies ? `${t.replies} ${t.replies === 1 ? l.reply : l.replies}` : l.noReplies}
                    </span>
                    <time dateTime={last(t)}>
                      {l.active} {ago(last(t))}
                    </time>
                  </span>
                </li>
              );
            })}
          </ul>
          {shown.length === 0 && items.length > 0 ? (
            <EmptyState
              variant="no-results"
              title={l.empty}
              action={
                <Button variant="secondary" size={40} onClick={clear}>
                  {l.clear}
                </Button>
              }
            >
              {l.emptyText}
            </EmptyState>
          ) : null}
          {items.length === 0 ? (
            <EmptyState
              variant="first-use"
              icon="users"
              title={l.first}
              action={
                <Button size={40} icon="plus" onClick={openNew}>
                  {l.newThread}
                </Button>
              }
            >
              {l.firstText}
            </EmptyState>
          ) : null}
        </>
      )}

      <p className="fl-forum-status" role="status" aria-live="polite">
        {status}
      </p>

      {creating ? (
        <Modal variant="form" className="fl-forum-dlg" title={l.dialogTitle} description={l.dialogText} confirmLabel={l.post} busy={busy} busyLabel="Posting..." onConfirm={() => submit()} onClose={() => setCreating(false)}>
          <div className="fl-forum-form">
            <div className="fl-forum-field">
              <label htmlFor={`${uid}-new-title`}>{l.titleLabel}</label>
              <TextField
                id={`${uid}-new-title`}
                size={40}
                value={draft.title}
                maxLength={120}
                data-autofocus=""
                invalid={!!errors.title}
                aria-describedby={errors.title ? `${uid}-e-title` : undefined}
                onChange={(e) => {
                  setDraft({ ...draft, title: e.target.value });
                  if (errors.title) setErrors({ ...errors, title: undefined });
                }}
              />
              {errors.title ? (
                <span className="fl-forum-error" id={`${uid}-e-title`}>
                  {errors.title}
                </span>
              ) : null}
            </div>
            <div className="fl-forum-field">
              <label htmlFor={`${uid}-new-category`}>{l.categoryLabel}</label>
              <Select
                id={`${uid}-new-category`}
                className="fl-ctl-field--40"
                placeholder="Choose a category"
                value={draft.category}
                invalid={!!errors.category}
                aria-describedby={errors.category ? `${uid}-e-category` : undefined}
                onChange={(e) => {
                  setDraft({ ...draft, category: e.target.value });
                  if (errors.category) setErrors({ ...errors, category: undefined });
                }}
                options={categories.map((c) => ({ value: c.id, label: c.label }))}
              />
              {errors.category ? (
                <span className="fl-forum-error" id={`${uid}-e-category`}>
                  {errors.category}
                </span>
              ) : null}
            </div>
            <div className="fl-forum-field">
              <label htmlFor={`${uid}-new-body`}>{l.bodyLabel}</label>
              <TextField
                id={`${uid}-new-body`}
                multiline
                rows={4}
                value={draft.body}
                invalid={!!errors.body}
                aria-describedby={errors.body ? `${uid}-e-body` : undefined}
                onChange={(e) => {
                  setDraft({ ...draft, body: e.target.value });
                  if (errors.body) setErrors({ ...errors, body: undefined });
                }}
              />
              {errors.body ? (
                <span className="fl-forum-error" id={`${uid}-e-body`}>
                  {errors.body}
                </span>
              ) : null}
            </div>
            {errors.form ? (
              <p className="fl-forum-error" role="alert">
                {errors.form}
              </p>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

// flowcode:sample
const SAMPLE = (() => {
  const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
  const r = (id: string, author: string, minutesAgo: number, text: string, likes = 0) => ({ id, author, at: at(minutesAgo), text, likes });
  const threads: (ForumThreadData & { pinned?: boolean })[] = [
    {
      id: "welcome", pinned: true, title: "Welcome! Read this before you post", category: "news", author: "Lena Hoffmann", at: at(60 * 24 * 40), votes: 58,
      body: "Be kind, search before you ask, and mark the reply that solved your question so others can find it.",
      replies: [r("w1", "Dev Patel", 60 * 24 * 39, "Thanks Lena, great community already.", 12)],
    },
    {
      id: "sourdough", title: "My sourdough starter smells like nail polish. Is it ruined?", category: "baking", author: "Maya Chen", at: at(60 * 26), votes: 14, solved: "s1",
      body: "I fed it once a day for two weeks and it doubled nicely, but this morning it smells sharp, almost like acetone.",
      replies: [
        r("s1", "Dev Patel", 60 * 25, "That smell means it's hungry, not ruined. Pour off the liquid and feed it twice a day.", 9),
        r("s2", "Sam Rivera", 60 * 3, "Whole wheat flour for a feed or two perks it up faster.", 5),
      ],
    },
    {
      id: "knife", title: "Which knife should a beginner buy first?", category: "gear", author: "Jordan Blake", at: at(60 * 5), votes: 22,
      body: "I have a budget of about $80 and mostly cook vegetables and chicken. Chef's knife or santoku?",
      replies: [r("k1", "Ana Silva", 60 * 4, "A 8-inch chef's knife covers almost everything. Spend the rest on a honing rod.", 7), r("k2", "Tom Okafor", 60 * 2, "Santoku if your hands are small, honestly. Try both in a store.", 3), r("k3", "Jordan Blake", 30, "Went with the chef's knife, thanks!", 1)],
    },
    {
      id: "rice", title: "Rice keeps turning out mushy in my pot", category: "techniques", author: "Priya Raman", at: at(60 * 9), votes: 6,
      body: "I use one cup of rice to two cups of water and simmer for 20 minutes. It's always sticky and soft. What am I doing wrong?",
      replies: [],
    },
    {
      id: "meal-prep", title: "Share your Sunday meal prep routine", category: "techniques", author: "Sam Rivera", at: at(60 * 24 * 3), votes: 31,
      body: "I cook grains, roast two trays of vegetables and make one sauce. Takes about 90 minutes. What's yours?",
      replies: [r("m1", "Maya Chen", 60 * 24 * 2, "Same, plus a big batch of beans in the slow cooker.", 4), r("m2", "Leo Martins", 60 * 20, "Soup on Sunday, freeze half for Thursday.", 2)],
    },
    {
      id: "cast-iron", title: "Rust spots on a cast iron pan after one wash", category: "gear", author: "Tom Okafor", at: at(60 * 24 * 6), votes: 9, solved: "c1",
      body: "Left it in the sink overnight. Now there are orange spots. Can I fix it at home?",
      replies: [r("c1", "Lena Hoffmann", 60 * 24 * 6 - 40, "Scrub with steel wool, dry on the stove, rub in a thin coat of oil and heat until it smokes.", 11)],
    },
  ];
  return {
    title: "Community kitchen",
    lede: "Questions, tips and the occasional kitchen disaster.",
    me: "Maya Chen",
    categories: [
      { id: "news", label: "News" },
      { id: "baking", label: "Baking help" },
      { id: "techniques", label: "Techniques" },
      { id: "gear", label: "Gear" },
    ],
    threads,
  };
})();

const toItem = (t: (typeof SAMPLE.threads)[number]): ForumListItem => ({
  id: t.id,
  title: t.title,
  category: t.category,
  author: t.author,
  at: t.at,
  lastAt: t.replies.length ? t.replies[t.replies.length - 1]!.at : undefined,
  replies: t.replies.length,
  votes: t.votes,
  voted: t.voted,
  pinned: t.pinned,
  solved: !!t.solved,
  excerpt: t.body.split(/\n/)[0],
});

export default function ForumThreadsPreview() {
  const [full, setFull] = useState(SAMPLE.threads);
  const [items, setItems] = useState<ForumListItem[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const backTo = useRef<string | null>(null);
  // The first visit loads (to show the loading rows); afterwards the list follows the preview's own copy.
  useEffect(() => {
    if (items) setItems(full.map(toItem));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full]);
  const thread = full.find((t) => t.id === open);
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap">
        {thread ? (
          <ForumThread
            me={SAMPLE.me}
            thread={thread}
            shareUrl={`https://community.example/t/${thread.id}`}
            onBack={() => {
              backTo.current = thread.id;
              setOpen(null);
            }}
            onChange={(t) => setFull((all) => all.map((x) => (x.id === t.id ? { ...x, ...t } : x)))}
          />
        ) : (
            <ForumThreads
              focusThread={backTo.current ?? undefined}
              title={SAMPLE.title}
              lede={SAMPLE.lede}
              me={SAMPLE.me}
              categories={SAMPLE.categories}
              threads={items ?? undefined}
              load={() => new Promise((ok) => setTimeout(() => ok(full.map(toItem)), 700)).then((t) => (setItems(t as ForumListItem[]), t as ForumListItem[]))}
              onOpen={(t) => {
                setOpen(t.id);
                setTimeout(() => window.scrollTo({ top: 0 }), 0);
              }}
              onChange={(next) =>
                setFull((all) => [
                  ...next.filter((n) => !all.some((a) => a.id === n.id)).map((n) => ({ id: n.id, title: n.title, category: n.category, author: n.author, at: n.at, votes: n.votes, voted: n.voted, body: n.excerpt ?? "", replies: [] })),
                  ...all.map((a) => {
                    const n = next.find((x) => x.id === a.id);
                    return n ? { ...a, votes: n.votes, voted: n.voted } : a;
                  }),
                ])
              }
            />
        )}
      </div>
    </section>
  );
}
