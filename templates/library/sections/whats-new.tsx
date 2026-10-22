/** @flowcode-library whats-new · What's new panel (Dialogs and drawers)
 * Catalog ID: p.whats-new (pattern)
 * Function: What's new panel (p.whats-new): a What's new button in the app's header with an unread count that opens a panel of recent product updates; All / Unread tabs with a sliding marker, each update with an unread dot, a New / Improved / Fixed tag, a date, a title, a short text, a picture area, Read more that unfolds the rest, Learn more, and Mark as seen (or Mark unread); Mark all as seen; seen updates leave the Unread tab with a glide; a caught-up state, loading, a load error with Retry; Escape or a click outside closes and focus returns to the button; seen updates are remembered and every change is announced.
 * Use it as: import { WhatsNew } from "./whats-new"; <WhatsNew title="What's new" items?={[{ id, kind: "new"|"improved"|"fixed", date: "2026-10-14", title, text, more?, media?: { label, icon? }, href? }]} load?={async () => Release[]} storageKey?="seen-updates" onSeen?={(ids) => ...} labels?={{ button, all, unread, markAll, markSeen, markUnread, readMore, readLess, learnMore, caughtUp, ... }} />
 * Built from: c.button.secondary, c.button.tertiary
 * Look: A header button with a sparkle icon and a small accent count bubble; under it a white panel (up to 26rem) with the title and Mark all as seen, two tabs with an accent underline that slides between them, and a scrolling list of update cards: a soft tinted picture tile with an icon, a colored tag and date, a bold title with an accent dot while unread, two lines of text, and quiet Read more / Learn more / Mark as seen actions.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-warning --color-info --color-danger --space-1 --space-2 --space-3 --space-4 --space-5 --radius-sm --radius-md --radius-lg --text-xs --text-sm --text-md --text-lg --weight-medium --weight-semibold --focus-ring --surface-shadow-hover --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger
 * Use cases: what's new; in-app changelog; release notes panel; product updates; feature announcements; new feature badge
 * Jobs to be done: tell people about new features inside the app; show how many updates someone hasn't seen; let people catch up and clear the count; point to the full write-up of a release
 * Keywords: what's new, release notes, changelog, product updates, announcements, unread, badge, mark as seen, popover, panel
 */
/**
 * What's new: a button and a non-modal panel. The tabs follow the WAI-ARIA tabs pattern (Left / Right / Home / End,
 * one tab stop). Opening moves focus to the panel's title; Escape, the close button or a click outside closes it and
 * focus goes back to the button. Updates are given newest first; which ones were seen is kept in localStorage under
 * storageKey when the browser allows it (and only for this visit when it doesn't). The panel rises in, the tab marker
 * slides, Read more unfolds (inert while folded), seen updates glide out of the Unread tab, and the count bumps when
 * it changes; with motion off it all simply changes.
 * Adapted from HyperUI (MIT, Copyright (c) Mark Mead): its badges, tabs and timeline components, and TailGrids (MIT,
 * Copyright (c) 2025 Tailgrids): its popover and card components.
 */
/**
 * How to try it
 * - The button shows 3 unread. Press it: the panel opens with its title focused while the updates load.
 * - Press Read more on the first update: the rest unfolds. Press Mark as seen: the dot goes, a tick pops and the
 *   count drops to 2 with a bump.
 * - Switch to Unread (arrow keys work on the tabs): only the unseen updates. Mark one as seen: it glides away.
 * - Press Mark all as seen: the Unread tab says you're all caught up. Press Mark unread on an update in All.
 * - Press Escape: the panel closes and focus is back on the button. Reload: the seen updates stay seen.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useRef, useState), the library's Button ("./buttons-variants")
 * and its inline icon set ("./icons"). localStorage when allowed. Nothing else: no package and nothing fetched. The
 * styles are the library's own fl- classes in templates/library/css/r6b-whats-new.css.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";

// ── p.whats-new: product updates in a panel, with an unread count. ──

export type ReleaseKind = "new" | "improved" | "fixed";
export type Release = { id: string; kind: ReleaseKind; date: string; title: string; text: string; more?: string; media?: { label: string; icon?: string }; href?: string };

export type WhatsNewLabels = Partial<{
  button: string;
  unreadCount: string;
  all: string;
  unread: string;
  markAll: string;
  markSeen: string;
  markUnread: string;
  seen: string;
  readMore: string;
  readLess: string;
  learnMore: string;
  close: string;
  caughtUp: string;
  caughtUpText: string;
  empty: string;
  loading: string;
  loadFailed: string;
  retry: string;
  saidSeen: string;
  saidUnread: string;
  saidAll: string;
  kinds: Partial<Record<ReleaseKind, string>>;
}>;

export type WhatsNewProps = {
  title?: string;
  /** Updates, newest first. Ignored while `load` is given. */
  items?: Release[];
  /** Loads the updates when the button first shows, so the count is known; the panel shows loading until then, and a failure offers Retry. */
  load?: () => Promise<Release[]>;
  /** Where seen update ids are remembered; for this visit only when left out. */
  storageKey?: string;
  /** Ids seen at the start (used when nothing is stored yet). */
  seen?: string[];
  onSeen?: (ids: string[]) => void;
  labels?: WhatsNewLabels;
};

function motionOff() {
  return document.documentElement.dataset.motion === "off" || Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}
function tokenMs(name: string, fallback: number) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  return raw.endsWith("ms") ? n : raw.endsWith("s") ? n * 1000 : n;
}
/** FLIP: rows marked data-flip glide from where they were to where they are whenever `key` changes; leavers fade. */
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
        if (was === undefined) n.animate([{ opacity: 0, translate: "0 var(--enter-distance, 8px)" }, { opacity: 1, translate: "0 0" }], { duration: tokenMs("--duration-base", 200), easing: ease });
        else if (was !== now.get(n.dataset.flip!)) n.animate([{ translate: `0 ${was - now.get(n.dataset.flip!)!}px` }, { translate: "0 0" }], { duration: tokenMs("--duration-slow", 320), easing: ease });
      }
    }
    last.current = now;
  }, [key, box]);
}

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtDate = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
};

function readSeen(key: string | undefined, fallback: string[]) {
  if (!key) return fallback;
  try {
    const v = JSON.parse(window.localStorage.getItem(key) ?? "null");
    return Array.isArray(v) ? (v as string[]) : fallback;
  } catch {
    return fallback;
  }
}

export function WhatsNew({ title = "What's new", items: initial = [], load, storageKey, seen: seenAtStart = [], onSeen, labels = {} }: WhatsNewProps) {
  const l = {
    button: "What's new",
    unreadCount: "{n} unread",
    all: "All",
    unread: "Unread",
    markAll: "Mark all as seen",
    markSeen: "Mark as seen",
    markUnread: "Mark unread",
    seen: "Seen",
    readMore: "Read more",
    readLess: "Show less",
    learnMore: "Learn more",
    close: "Close",
    caughtUp: "You're all caught up",
    caughtUpText: "New updates will show up here.",
    empty: "No updates yet",
    loading: "Loading updates…",
    loadFailed: "Couldn't load the updates.",
    retry: "Retry",
    saidSeen: "Marked “{t}” as seen. {n} unread.",
    saidUnread: "Marked “{t}” unread. {n} unread.",
    saidAll: "All updates marked as seen.",
    ...labels,
    kinds: { new: "New", improved: "Improved", fixed: "Fixed", ...labels.kinds },
  };
  const id = useId();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Release[]>(load ? [] : initial);
  const [phase, setPhase] = useState<"idle" | "loading" | "error" | "ready">(load ? "idle" : "ready");
  const [seen, setSeen] = useState<string[]>(seenAtStart);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [more, setMore] = useState<Record<string, boolean>>({});
  const [popped, setPopped] = useState<string | null>(null);
  const [said, setSaid] = useState("");
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState({ x: 0, w: 0 });

  useEffect(() => setSeen(readSeen(storageKey, seenAtStart)), [storageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // The count is known before the panel opens: the ids come with the items, or with the first load.
  const fetchItems = () => {
    if (!load) return;
    setPhase("loading");
    load()
      .then((t) => {
        setItems(t);
        setPhase("ready");
      })
      .catch(() => setPhase("error"));
  };
  useEffect(fetchItems, []); // eslint-disable-line react-hooks/exhaustive-deps

  const unreadIds = items.filter((x) => !seen.includes(x.id)).map((x) => x.id);
  const unread = unreadIds.length;

  const persist = (next: string[]) => {
    setSeen(next);
    onSeen?.(next);
    if (storageKey) {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* storage blocked: remembered for this visit only */
      }
    }
  };
  const markSeen = (x: Release, on: boolean) => {
    const next = on ? [...new Set([...seen, x.id])] : seen.filter((s) => s !== x.id);
    persist(next);
    const left = items.filter((i) => !next.includes(i.id)).length;
    setSaid((on ? l.saidSeen : l.saidUnread).replace("{t}", x.title).replace("{n}", String(left)));
    if (on) setPopped(x.id);
    // A row that leaves the Unread tab takes its button with it: focus the next row's action, or the tab.
    if (on && tab === "unread") {
      const order = shown.map((s) => s.id);
      const i = order.indexOf(x.id);
      const nextId = order[i + 1] ?? order[i - 1];
      window.setTimeout(() => (document.getElementById(nextId ? `${id}-seen-${nextId}` : `${id}-tab-unread`) as HTMLElement | null)?.focus(), 30);
    }
  };
  const markAll = () => {
    persist([...new Set([...seen, ...items.map((x) => x.id)])]);
    setSaid(l.saidAll);
    window.setTimeout(() => document.getElementById(`${id}-tab-${tab}`)?.focus(), 30);
  };

  const close = (focusBack = true) => {
    setOpen(false);
    if (focusBack) window.setTimeout(() => trigger.current?.focus(), 0);
  };
  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => document.getElementById(`${id}-title`)?.focus(), 20);
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = tab === "unread" ? items.filter((x) => !seen.includes(x.id)) : items;
  useFlip(listRef, `${open}|${phase}|${tab}|${shown.map((x) => x.id).join(",")}`);

  // The tab marker slides to the chosen tab.
  useLayoutEffect(() => {
    const el = tabsRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (el) setInd({ x: el.offsetLeft, w: el.offsetWidth });
  }, [tab, open, unread, phase]);

  const onTabsKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const order: ("all" | "unread")[] = ["all", "unread"];
    const i = order.indexOf(tab);
    let n = i;
    if (e.key === "ArrowRight") n = (i + 1) % 2;
    else if (e.key === "ArrowLeft") n = (i + 1) % 2;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = 1;
    else return;
    e.preventDefault();
    setTab(order[n]);
    document.getElementById(`${id}-tab-${order[n]}`)?.focus();
  };

  return (
    <div className="fl-wnew" ref={wrap} data-fl="p.whats-new" onKeyDown={(e) => e.key === "Escape" && open && (e.stopPropagation(), close())}>
      <button
        ref={trigger}
        type="button"
        className="fl-wnew-trigger"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        aria-label={unread ? `${l.button}, ${l.unreadCount.replace("{n}", String(unread))}` : l.button}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <Icon name="sparkle" />
        <span className="fl-wnew-trigger-label">{l.button}</span>
        {unread ? (
          <span className="fl-wnew-count" key={unread} aria-hidden="true">
            {unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div id={`${id}-panel`} className="fl-wnew-panel" role="dialog" aria-modal="false" aria-labelledby={`${id}-title`}>
          <header className="fl-wnew-head">
            <h2 id={`${id}-title`} tabIndex={-1}>
              {title}
            </h2>
            <Button variant="tertiary" size={32} icon="check" disabled={!unread || phase !== "ready"} onClick={markAll}>
              {l.markAll}
            </Button>
            <Button variant="tertiary" size={32} icon="close" iconOnly onClick={() => close()}>
              {l.close}
            </Button>
          </header>

          <div className="fl-wnew-tabs" role="tablist" aria-label={title} ref={tabsRef} onKeyDown={onTabsKey} style={{ ["--ind-x" as string]: `${ind.x}px`, ["--ind-w" as string]: `${ind.w}px` }}>
            {(["all", "unread"] as const).map((t) => (
              <button
                key={t}
                id={`${id}-tab-${t}`}
                type="button"
                role="tab"
                aria-selected={tab === t}
                aria-controls={`${id}-list`}
                tabIndex={tab === t ? 0 : -1}
                onClick={() => setTab(t)}
              >
                {t === "all" ? l.all : l.unread}
                {t === "unread" && unread ? <span className="fl-wnew-tabcount">{unread}</span> : null}
              </button>
            ))}
            <i className="fl-wnew-ind" aria-hidden="true" />
          </div>

          <div id={`${id}-list`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`} className="fl-wnew-body">
            {phase === "loading" || phase === "idle" ? (
              <ul className="fl-wnew-list" aria-busy="true" aria-label={l.loading}>
                {[0, 1].map((i) => (
                  <li key={i} className="fl-wnew-skel" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </li>
                ))}
              </ul>
            ) : phase === "error" ? (
              <div className="fl-wnew-empty" role="alert">
                <Icon name="alert" />
                <p className="fl-wnew-empty-title">{l.loadFailed}</p>
                <Button variant="secondary" size={32} icon="refresh" onClick={fetchItems}>
                  {l.retry}
                </Button>
              </div>
            ) : !shown.length ? (
              <div className="fl-wnew-empty">
                <span className="fl-wnew-done" aria-hidden="true">
                  <Icon name="check" />
                </span>
                <p className="fl-wnew-empty-title">{items.length ? l.caughtUp : l.empty}</p>
                <p>{l.caughtUpText}</p>
              </div>
            ) : (
              <ul className="fl-wnew-list" ref={listRef}>
                {shown.map((x, i) => {
                  const isSeen = seen.includes(x.id);
                  const isMore = Boolean(more[x.id]);
                  return (
                    <li key={x.id} data-flip={x.id} className={["fl-wnew-item", isSeen ? "is-seen" : ""].filter(Boolean).join(" ")} style={{ ["--i" as string]: i }}>
                      {x.media ? (
                        <div className={`fl-wnew-media fl-wnew-media--${x.kind}`} role="img" aria-label={x.media.label}>
                          <Icon name={x.media.icon ?? "image"} />
                        </div>
                      ) : null}
                      <p className="fl-wnew-meta">
                        <span className={`fl-wnew-kind fl-wnew-kind--${x.kind}`}>{l.kinds[x.kind]}</span>
                        <time dateTime={x.date}>{fmtDate(x.date)}</time>
                      </p>
                      <h3 className="fl-wnew-title">
                        {!isSeen ? <span className="fl-wnew-dot" aria-label={l.unread} role="img" /> : null}
                        {x.title}
                      </h3>
                      <p className="fl-wnew-text">{x.text}</p>
                      {x.more ? (
                        <div id={`${id}-more-${x.id}`} className={["fl-wnew-more", isMore ? "is-open" : ""].filter(Boolean).join(" ")} inert={!isMore || undefined}>
                          <div>
                            <p>{x.more}</p>
                          </div>
                        </div>
                      ) : null}
                      <div className="fl-wnew-actions">
                        {x.more ? (
                          <Button variant="tertiary" size={32} icon="chevron-down" aria-expanded={isMore} aria-controls={`${id}-more-${x.id}`} className="fl-wnew-morebtn" onClick={() => setMore({ ...more, [x.id]: !isMore })}>
                            {isMore ? l.readLess : l.readMore}
                          </Button>
                        ) : null}
                        {x.href ? (
                          <Button variant="tertiary" size={32} icon="external" iconAt="end" href={x.href} onClick={() => !isSeen && markSeen(x, true)}>
                            {l.learnMore}
                          </Button>
                        ) : null}
                        <Button
                          id={`${id}-seen-${x.id}`}
                          variant="tertiary"
                          size={32}
                          icon={isSeen ? "refresh" : "check"}
                          className={["fl-wnew-seenbtn", popped === x.id && isSeen ? "is-popped" : ""].filter(Boolean).join(" ")}
                          onClick={() => markSeen(x, !isSeen)}
                        >
                          {isSeen ? l.markUnread : l.markSeen}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  app: "Northwind",
  title: "What's new",
  storageKey: "fl-sample-whats-new",
  items: [
    {
      id: "r42",
      kind: "new",
      date: "2026-10-16",
      title: "Recurring tasks",
      text: "Set a task to repeat daily, weekly or on the first Monday of the month.",
      more: "Open a task, choose Repeat and pick a pattern. Each copy keeps its checklist and assignee, and you can stop the series from any copy.",
      media: { label: "A task with a Repeat weekly label", icon: "refresh" },
      href: "#recurring-tasks",
    },
    {
      id: "r41",
      kind: "improved",
      date: "2026-10-09",
      title: "Faster search",
      text: "Results now show as you type, with matches in comments and files.",
      media: { label: "Search results with highlighted matches", icon: "search" },
      href: "#search",
    },
    {
      id: "r40",
      kind: "fixed",
      date: "2026-10-02",
      title: "Calendar time zones",
      text: "Events created while traveling now keep the time you picked.",
      more: "If an event moved before this fix, open it once and save to set it back. Shared calendars update for everyone.",
    },
    {
      id: "r39",
      kind: "new",
      date: "2026-09-24",
      title: "Board templates",
      text: "Start a board from a template for launches, hiring or content plans.",
      media: { label: "Three board templates side by side", icon: "layers" },
    },
  ] as Release[],
  seen: ["r39"],
};

export default function WhatsNewSheet() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-wnew-demo">
          <strong>{SAMPLE.app}</strong>
          <WhatsNew title={SAMPLE.title} storageKey={SAMPLE.storageKey} seen={SAMPLE.seen} load={() => new Promise((r) => window.setTimeout(() => r(SAMPLE.items), 700))} />
        </div>
      </div>
    </section>
  );
}
