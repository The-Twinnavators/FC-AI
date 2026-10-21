/** @flowcode-library notification-menu · Notifications menu (Dialogs and drawers)
 * Catalog ID: p.notification-menu (pattern)
 * Function: A notifications bell (p.notification-menu) with an unread count that opens a panel of recent activity: All / Unread tabs, open a row to mark it read or flip it back, Mark all as read, Load earlier with loading, error and end states, a caught-up empty state; Escape or a press outside closes it and focus returns to the bell. Adapted from Meraki UI (MIT).
 * Use it as: Import { NotificationMenu } from "./notification-menu"; <NotificationMenu items={[{ id, who, action, target?, when, unread, href? }]} loadEarlier?={async () => olderItems} seeAll?={{ label, href }} align?="end"|"start" onChange?={(items) => ...} />  // put it at the right of the app top bar; save read state through onChange
 * Built from: c.badge.count, c.avatar.person, c.button.tertiary, c.empty-state.done, c.empty-state.first-use
 * Look: A round bell with a small red count that opens a raised panel under it: a title with Mark all as read, All / Unread tabs with a sliding underline, rows of an avatar, who did what in bold and plain words, a time and a dot for unread, then Load earlier and See all. On a phone the panel spans the screen under the bell.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-accent --color-danger --color-text --color-text-muted --focus-ring --shadow-lg --radius-md --radius-lg --space-2 --space-3 --space-4 --text-xs --text-sm --duration-fast --duration-base --ease-out --ease-spring --enter-distance
 * Use cases: notifications; activity feed; inbox bell; app top bar; mentions and replies; social app; team workspace; admin dashboard
 * Jobs to be done: see what happened since i last looked; find who replied or mentioned me; clear the unread count; look back at older activity
 * Keywords: notifications, bell, unread, activity, dropdown, popover, inbox, mark as read, top bar
 */
/**
 * Notifications menu: the bell in an app's top bar. Its count says how many are unread; pressing it opens a panel (a
 * non-modal dialog) under the bell. All and Unread tabs share one sliding underline; each row opens its item and marks
 * it read, and a small button beside it marks it read or unread again. Mark all as read clears the count. Load earlier
 * fetches older activity with a spinner, an error with Try again, and a "no more" end. Escape, a press outside, or
 * tabbing away closes it, and focus goes back to the bell. Make it the app's own: replace SAMPLE with the signed-in
 * person's notifications, give loadEarlier the app's own fetch, and save read state through onChange.
 * Adapted from Meraki UI (MIT License, Copyright (c) 2021 Khatab Wedaa), its "Notification" dropdown.
 */
/**
 * How to try it
 * - Press the bell: three are unread. Press a row to open it (it turns read); the dot button beside a row flips it back.
 * - Switch to Unread, then press Mark all as read: the tab shows the caught-up state and the count disappears.
 * - Press Load earlier twice: the first time older items arrive after a moment, the second time it fails once (Try
 *   again works), and then it says there is nothing older.
 * - Up and Down arrows move between rows; Escape closes and focus returns to the bell.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useRef, useState), and the library's own inline icon set
 * ("./icons"), which is a table of SVG paths rather than an icon package. Nothing else — no package to install and
 * nothing fetched at run time. The styles are the library's own fl- classes in templates/library/css, and the sample
 * data is in the file, so the piece runs in a built app exactly as it runs here.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Avatar } from "./avatars-variants";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { EmptyState } from "./empty-states";
import { Icon } from "./icons";

// ── p.notification-menu: a bell with a count, opening a panel of recent activity. ──

export type NotificationItem = {
  id: string;
  /** Who did it: "Sara Salah". */
  who: string;
  /** What they did, in plain words: "replied to". */
  action: string;
  /** What it was about, drawn in bold after the action: "Upload images". */
  target?: string;
  /** When, already written for people: "2m", "Yesterday". */
  when: string;
  unread: boolean;
  /** Where the row leads. */
  href?: string;
};

export type NotificationMenuProps = {
  items: NotificationItem[];
  /** Fetches older notifications. Resolve to [] when there are none left; reject to show the error. */
  loadEarlier?: () => Promise<NotificationItem[]>;
  seeAll?: { label: string; href: string };
  /** Which edge of the bell the panel lines up with; "end" for a bell at the right of a top bar. */
  align?: "start" | "end";
  labels?: { title?: string; open?: string; all?: string; unread?: string; markAll?: string; markRead?: string; markUnread?: string; earlier?: string; loading?: string; noMore?: string; failed?: string; retry?: string; caughtUp?: string; caughtUpText?: string; empty?: string };
  /** Called with the whole list after any change (read state, older items). */
  onChange?: (items: NotificationItem[]) => void;
};

type Tab = "all" | "unread";
type LoadState = "idle" | "loading" | "failed" | "done";

export function NotificationMenu({ items, loadEarlier, seeAll, align = "end", labels = {}, onChange }: NotificationMenuProps) {
  const l = {
    title: "Notifications",
    open: "Notifications",
    all: "All",
    unread: "Unread",
    markAll: "Mark all as read",
    markRead: "Mark as read",
    markUnread: "Mark as unread",
    earlier: "Load earlier",
    loading: "Loading…",
    noMore: "No earlier notifications",
    failed: "Couldn't load older notifications.",
    retry: "Try again",
    caughtUp: "You're all caught up",
    caughtUpText: "Nothing new since you last looked.",
    empty: "No notifications yet",
    ...labels,
  };
  const uid = useId().replace(/:/g, "");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [list, setList] = useState(items);
  const [load, setLoad] = useState<LoadState>(loadEarlier ? "idle" : "done");
  const [said, setSaid] = useState("");
  const bell = useRef<HTMLButtonElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const tabRow = useRef<HTMLDivElement>(null);

  const unread = list.filter((n) => n.unread).length;
  const shown = tab === "unread" ? list.filter((n) => n.unread) : list;

  const update = (next: NotificationItem[]) => {
    setList(next);
    onChange?.(next);
  };
  // In Unread, a row marked read leaves the list: focus moves to the row that takes its place (or the title).
  const refocus = useRef<number | null>(null);
  const setRead = (id: string, read: boolean) => {
    if (tab === "unread" && read) refocus.current = shown.findIndex((n) => n.id === id);
    update(list.map((n) => (n.id === id ? { ...n, unread: !read } : n)));
  };
  useEffect(() => {
    const at = refocus.current;
    if (at === null) return;
    refocus.current = null;
    const rows = panel.current?.querySelectorAll<HTMLElement>(".fl-ntf-open") ?? [];
    (rows[Math.min(at, rows.length - 1)] ?? panel.current?.querySelector<HTMLElement>("[data-first]"))?.focus();
  }, [list]);
  const markAll = () => {
    update(list.map((n) => ({ ...n, unread: false })));
    setSaid("All notifications marked as read.");
    // The button turns disabled under the keyboard; the panel's title keeps focus inside instead.
    panel.current?.querySelector<HTMLElement>("[data-first]")?.focus();
  };

  const close = (back = true) => {
    setOpen(false);
    if (back) bell.current?.focus();
  };

  // On open, focus goes to the panel's title; a press outside, Escape or tabbing away closes it.
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("[data-first]")?.focus();
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) close(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // One underline that moves between the two tabs.
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) {
      setInd(null);
      return;
    }
    const t = tabRow.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (t) setInd({ x: t.offsetLeft, w: t.offsetWidth });
  }, [open, tab, unread]);

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const next: Tab = e.key === "Home" ? "all" : e.key === "End" ? "unread" : tab === "all" ? "unread" : "all";
    setTab(next);
    tabRow.current?.querySelector<HTMLElement>(`[data-tab="${next}"]`)?.focus();
  };

  // Up and Down move between the rows' main buttons.
  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    const rows = [...(e.currentTarget.querySelectorAll<HTMLElement>(".fl-ntf-open"))];
    if (!rows.length) return;
    e.preventDefault();
    const at = rows.indexOf(document.activeElement as HTMLElement);
    const to = e.key === "Home" ? 0 : e.key === "End" ? rows.length - 1 : e.key === "ArrowDown" ? (at + 1) % rows.length : (at - 1 + rows.length) % rows.length;
    rows[to]?.focus();
  };

  const more = async () => {
    if (!loadEarlier || load === "loading") return;
    setLoad("loading");
    setSaid(l.loading);
    try {
      const older = await loadEarlier();
      const known = new Set(list.map((n) => n.id));
      const fresh = older.filter((n) => !known.has(n.id));
      if (fresh.length) {
        update([...list, ...fresh]);
        setSaid(`${fresh.length} earlier notifications loaded.`);
        setLoad("idle");
      } else {
        setLoad("done");
        setSaid(l.noMore);
      }
    } catch {
      setLoad("failed");
      setSaid(l.failed);
    }
  };

  const openRow = (n: NotificationItem) => {
    if (n.unread) setRead(n.id, true);
  };

  return (
    <div className={`fl-ntf fl-ntf--${align}`} ref={wrap} data-fl="p.notification-menu">
      <button
        ref={bell}
        type="button"
        className="fl-ntf-bell"
        aria-expanded={open}
        aria-controls={`${uid}-panel`}
        aria-haspopup="dialog"
        aria-label={unread ? `${l.open}, ${unread} unread` : l.open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <Icon name="bell" />
        {unread ? <Badge variant="count" count={unread} className="fl-ntf-count" /> : null}
      </button>

      {open ? (
        <div
          ref={panel}
          id={`${uid}-panel`}
          className="fl-ntf-panel"
          role="dialog"
          aria-labelledby={`${uid}-title`}
          // On a phone the panel spans the screen under the bell (see notifications.css); this is where the bell ends.
          style={{ ["--fl-ntf-top" as string]: `${Math.round((bell.current?.getBoundingClientRect().bottom ?? 56) + 8)}px` }}
          onBlur={(e) => {
            // Tabbing out of the panel (not into the bell) closes it, like any menu.
            const to = e.relatedTarget as Node | null;
            if (to && !wrap.current?.contains(to)) close(false);
          }}
        >
          <div className="fl-ntf-head">
            <h3 id={`${uid}-title`} tabIndex={-1} data-first>
              {l.title}
            </h3>
            <button type="button" className="fl-ntf-link" onClick={markAll} disabled={!unread}>
              {l.markAll}
            </button>
          </div>

          <div className="fl-ntf-tabs" role="tablist" aria-label={l.title} ref={tabRow}>
            {(["all", "unread"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                data-tab={t}
                id={`${uid}-tab-${t}`}
                aria-selected={tab === t}
                aria-controls={`${uid}-list`}
                tabIndex={tab === t ? 0 : -1}
                className="fl-ntf-tab"
                onClick={() => setTab(t)}
                onKeyDown={onTabKey}
              >
                {t === "all" ? l.all : l.unread}
                {t === "unread" && unread ? <span className="fl-ntf-tab-n">{unread}</span> : null}
              </button>
            ))}
            <span className="fl-ntf-ind" aria-hidden="true" data-ready={ind ? "" : undefined} style={ind ? { width: `${ind.w}px`, translate: `${ind.x}px 0` } : undefined} />
          </div>

          <div id={`${uid}-list`} role="tabpanel" aria-labelledby={`${uid}-tab-${tab}`} className="fl-ntf-body">
            {shown.length === 0 ? (
              tab === "unread" ? (
                <EmptyState variant="done" title={l.caughtUp}>
                  {l.caughtUpText}
                </EmptyState>
              ) : (
                <EmptyState variant="first-use" icon="bell" title={l.empty} />
              )
            ) : (
              <ul className="fl-ntf-list" onKeyDown={onListKey}>
                {shown.map((n) => {
                  const text = (
                    <>
                      <span className="fl-ntf-text">
                        <strong>{n.who}</strong> {n.action}
                        {n.target ? (
                          <>
                            {" "}
                            <strong>{n.target}</strong>
                          </>
                        ) : null}
                        <span className="fl-sr">{n.unread ? ", unread" : ""}</span>
                      </span>
                      <span className="fl-ntf-when">{n.when}</span>
                    </>
                  );
                  return (
                    <li key={n.id} className={`fl-ntf-row${n.unread ? " is-unread" : ""}`}>
                      <Avatar name={n.who} size={40} decorative />
                      {n.href ? (
                        <a className="fl-ntf-open" href={n.href} onClick={() => openRow(n)}>
                          {text}
                        </a>
                      ) : (
                        <button type="button" className="fl-ntf-open" onClick={() => openRow(n)}>
                          {text}
                        </button>
                      )}
                      <button
                        type="button"
                        className="fl-ntf-mark"
                        aria-label={`${n.unread ? l.markRead : l.markUnread}: ${n.who} ${n.action}${n.target ? ` ${n.target}` : ""}`}
                        title={n.unread ? l.markRead : l.markUnread}
                        onClick={() => setRead(n.id, n.unread)}
                      >
                        <span className="fl-ntf-dot" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="fl-ntf-foot">
            {load === "done" ? (
              <span className="fl-ntf-end">{l.noMore}</span>
            ) : load === "failed" ? (
              <span className="fl-ntf-fail">
                <Icon name="alert" />
                {l.failed}
                <Button variant="tertiary" size={32} onClick={more}>
                  {l.retry}
                </Button>
              </span>
            ) : (
              <Button variant="tertiary" size={32} icon="refresh" busy={load === "loading"} onClick={more}>
                {load === "loading" ? l.loading : l.earlier}
              </Button>
            )}
            {seeAll ? (
              <a className="fl-ntf-link" href={seeAll.href}>
                {seeAll.label}
              </a>
            ) : null}
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
  brand: "Northlight",
  seeAll: { label: "See all", href: "#notifications" },
  items: [
    { id: "n1", who: "Sara Salah", action: "replied to your comment on", target: "Upload images", when: "2m", unread: true },
    { id: "n2", who: "Marcus Lee", action: "started following you", when: "45m", unread: true },
    { id: "n3", who: "Jane Doe", action: "liked your reply on", target: "Testing with TDD", when: "1h", unread: true },
    { id: "n4", who: "Abigail Bennett", action: "mentioned you in", target: "Q4 launch plan", when: "3h", unread: false },
    { id: "n5", who: "Tom Okafor", action: "shared", target: "Brand guidelines v2", when: "Yesterday", unread: false },
  ] as NotificationItem[],
  older: [
    { id: "n6", who: "Priya Raman", action: "invited you to", target: "Design reviews", when: "Mon", unread: false },
    { id: "n7", who: "Leo Martins", action: "commented on", target: "Homepage hero", when: "Sun", unread: false },
    { id: "n8", who: "Ana Silva", action: "assigned you", target: "Fix checkout copy", when: "Oct 12", unread: false },
  ] as NotificationItem[],
};

export default function NotificationMenuPreview() {
  // The sample's "server": the first call returns older items, the next fails once, then there are none left.
  const calls = useRef(0);
  const loadEarlier = () =>
    new Promise<NotificationItem[]>((resolve, reject) => {
      const n = calls.current++;
      window.setTimeout(() => (n === 1 ? reject(new Error("offline")) : resolve(n === 0 ? SAMPLE.older : [])), 900);
    });
  return (
    <section className="fl-section" aria-label="Notifications menu">
      <div className="fl-wrap">
        <div className="fl-ntf-demo">
          <strong className="fl-ntf-demo-brand">{SAMPLE.brand}</strong>
          <NotificationMenu items={SAMPLE.items} seeAll={SAMPLE.seeAll} loadEarlier={loadEarlier} />
        </div>
      </div>
    </section>
  );
}
