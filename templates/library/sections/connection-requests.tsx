/** @flowcode-library connection-requests · Connection requests (Tables and lists)
 * Catalog ID: p.connection-requests (pattern)
 * Function: Connection requests (p.connection-requests): Received, Sent and Suggested tabs with counts and a sliding bar; accept or ignore a request (the row leaves, the rest glide up, focus moves to the next person, with Undo), accept all, see the mutual connections a request shares with you, withdraw a sent request after a confirm, connect with a suggestion (it moves to Sent and the count bumps) or dismiss it; rows are a keyboard grid with one Tab stop; a search across the tab; loading, a load error with Retry and an empty state for each tab, every change announced. Adapted from Meraki UI and Creative Tim UI (MIT).
 * Use it as: import { ConnectionRequests } from "./connection-requests"; <ConnectionRequests title received?={[{ id, name, headline, mutual: ["name"], note?, at: ISO }]} sent?={[...]} suggestions?={[...]} load?={async () => ({ received, sent, suggestions })} onRespond?={async (id, "accept"|"ignore") => void} onWithdraw?={async (id) => void} onConnect?={async (id) => void} onDismiss?={(id) => ...} labels?={{ received, sent, suggested, accept, ignore, ... }} />
 * Built from: c.avatar.person, c.avatar-stack, c.tabs.underline-slide, c.text-field.outlined, c.button.primary, c.button.secondary, c.button.tertiary, c.modal.danger, c.empty-state, c.skeleton
 * Look: A white card: the title with a count pill and Accept all; a Received / Sent / Suggested tab row with counts and a straight accent bar that slides under the chosen tab; a search field; rows split by thin lines with a round initials avatar, the bold name, a muted headline, a "3 mutual" link with tiny overlapping faces that folds open the names, the request's note in a sunken quote with a straight bar, the time, and Accept and Ignore at the right; suggestions are small centered cards with Connect and a round dismiss button; a sunken notice with Undo after each answer.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-border-strong --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-danger --surface-radius --surface-shadow --pill-radius --radius-sm --radius-md --space-1 --space-2 --space-3 --space-4 --space-5 --text-xs --text-sm --text-md --text-lg --font-display --weight-medium --weight-semibold --focus-ring --duration-instant --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger
 * Use cases: connection requests; friend requests; follow requests; invitations; network page; member directory; mentorship matching; team invites
 * Jobs to be done: answer the people who want to connect; see who we both know before accepting; take back a request I sent; find people I may know; undo an accept I tapped by mistake
 * Keywords: connections, friend requests, invitations, accept, ignore, withdraw, suggestions, people you may know, mutual connections, network, social, undo
 */
/**
 * Connection requests. Each tab's rows are a grid for the keyboard: one Tab stop, Up and Down move between people,
 * Left and Right between a row's buttons. Answering a request plays a short leave, the rows below glide up (FLIP),
 * focus moves to the next person (or the tab when none are left) and a notice offers Undo, which slides the row back
 * in. The tab bar slides, counts bump, mutual names fold open (grid rows, closed part inert), dialogs rise in
 * (@starting-style). With motion off everything simply changes.
 * Make it the app's own: replace SAMPLE with the real requests and pass onRespond, onWithdraw and onConnect to save.
 * Adapted from Meraki UI (MIT License, Copyright (c) 2021 Khatab Wedaa), its user card, avatar group and line tabs
 * components, and Creative Tim UI (MIT License, Copyright (c) 2025 Creative Tim), its card display block.
 */
/**
 * How to try it
 * - Wait for the requests to load. Press "3 mutual" on a row: the names fold open.
 * - Accept a request: the row leaves, the others glide up, focus moves to the next one. Press Undo: it comes back.
 * - Use the arrow keys in the list: Up and Down between people, Left and Right between Accept and Ignore.
 * - Open Suggested and press Connect: the Sent count bumps. Open Sent, Withdraw one and confirm.
 * - Type in the search for a name; type "zzz" for the empty state.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useRef, useState, flushSync from react-dom), the library's
 * Avatar, TextField, Button, Modal, EmptyState and Skeleton ("./avatars-variants", "./text-fields-states",
 * "./buttons-variants", "./modals-dialogs", "./empty-states", "./skeleton-loading") and its inline icon set
 * ("./icons"). Nothing else: no package and nothing fetched. The styles are the library's own fl- classes in
 * templates/library/css/r6c-connection-requests.css.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";
import { Avatar, type AvatarTone } from "./avatars-variants";
import { Button } from "./buttons-variants";
import { EmptyState } from "./empty-states";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { Skeleton } from "./skeleton-loading";
import { TextField } from "./text-fields-states";

// ── p.connection-requests: received and sent requests, and people you may know. ──

export type ConnectionPerson = { id: string; name: string; headline: string; mutual: string[]; note?: string; at: string };
type Lists = { received: ConnectionPerson[]; sent: ConnectionPerson[]; suggestions: ConnectionPerson[] };
type TabId = keyof Lists;
type Labels = {
  received: string; sent: string; suggested: string; tabs: string; search: string; accept: string; ignore: string; acceptAll: string; withdraw: string; connect: string; dismiss: string;
  mutual: string; undo: string; accepted: string; ignored: string; withdrawn: string; requested: string; dismissed: string; noReceived: string; noReceivedText: string; noSent: string;
  noSentText: string; noSuggested: string; noSuggestedText: string; noMatch: string; noMatchText: string; loadFailed: string; retry: string; loading: string; withdrawTitle: string;
  withdrawText: string; failed: string; pending: string;
};
export type ConnectionRequestsProps = {
  title: string;
  received?: ConnectionPerson[];
  sent?: ConnectionPerson[];
  suggestions?: ConnectionPerson[];
  load?: () => Promise<Lists>;
  onRespond?: (id: string, answer: "accept" | "ignore") => Promise<void> | void;
  onWithdraw?: (id: string) => Promise<void> | void;
  onConnect?: (id: string) => Promise<void> | void;
  onDismiss?: (id: string) => void;
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
/** Rows that stay glide to their new places (FLIP); new rows fade in. Reduced motion only fades. */
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
    const now = el.getBoundingClientRect();
    const dx = was.left - now.left;
    const dy = was.top - now.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    moving.push(el.animate([{ translate: `${dx}px ${dy}px` }, { translate: "0 0" }], { duration: slow, easing }));
  }
}
/** A short leave (fade and shift), then the change. */
function leave(el: HTMLElement | null, then: () => void) {
  if (!el || motionOff()) {
    then();
    return;
  }
  const base = ms(getComputedStyle(document.documentElement).getPropertyValue("--duration-base"), 200);
  const a = el.animate([{ opacity: 1 }, { opacity: 0, translate: reducedMotion() ? "0 0" : "12px 0" }], { duration: base, easing: "ease-in", fill: "forwards" });
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

/** "3 mutual" with tiny faces; opens the names. */
function Mutual({ names, label, id }: { names: string[]; label: string; id: string }) {
  const [open, setOpen] = useState(false);
  if (!names.length) return null;
  return (
    <div className="fl-conx-mutual">
      <button type="button" className="fl-conx-mutualbtn" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <span className="fl-conx-faces" aria-hidden="true">
          {names.slice(0, 3).map((n) => (
            <Avatar key={n} name={n} size={20} tone={toneOf(n)} decorative />
          ))}
        </span>
        {names.length} {label}
        <Icon name="chevron-down" />
      </button>
      <div className={`fl-conx-fold${open ? " is-open" : ""}`} id={id} inert={!open}>
        <div>
          <p>{names.join(", ")}</p>
        </div>
      </div>
    </div>
  );
}

// ── The requests ──

export function ConnectionRequests({ title, received, sent, suggestions, load, onRespond, onWithdraw, onConnect, onDismiss, labels = {} }: ConnectionRequestsProps) {
  const l: Labels = {
    received: "Received", sent: "Sent", suggested: "Suggested", tabs: "Requests", search: "Search people", accept: "Accept", ignore: "Ignore", acceptAll: "Accept all", withdraw: "Withdraw",
    connect: "Connect", dismiss: "Not now", mutual: "mutual", undo: "Undo", accepted: "You're now connected with", ignored: "Ignored the request from", withdrawn: "Request withdrawn:",
    requested: "Request sent to", dismissed: "Hidden from suggestions:", noReceived: "You're all caught up", noReceivedText: "New requests show up here.", noSent: "No pending requests",
    noSentText: "Requests you send wait here until they're answered.", noSuggested: "No suggestions right now", noSuggestedText: "Check back after you connect with more people.",
    noMatch: "Nobody matches", noMatchText: "Try another name.", loadFailed: "Couldn't load your requests.", retry: "Try again", loading: "Loading requests", withdrawTitle: "Withdraw your request to",
    withdrawText: "They won't see it anymore. You can send a new one later.", failed: "Couldn't save that. Try again.", pending: "Sent",
    ...labels,
  };
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const given = received && sent && suggestions;
  const [lists, setLists] = useState<Lists>({ received: received ?? [], sent: sent ?? [], suggestions: suggestions ?? [] });
  const [state, setState] = useState<"ready" | "loading" | "error">(given || !load ? "ready" : "loading");
  const [tab, setTab] = useState<TabId>("received");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<{ id: string; col: number } | null>(null);
  const [undo, setUndo] = useState<{ text: string; restore: Lists } | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<ConnectionPerson | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [focusTo, setFocusTo] = useState<{ id: string; n: number } | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const latest = useRef(lists);
  latest.current = lists;

  const run = () => {
    if (!load) return;
    setState("loading");
    load().then(
      (d) => {
        setLists(d);
        setState("ready");
      },
      () => setState("error"),
    );
  };
  useEffect(() => {
    if (!given && load) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (focusTo) document.getElementById(focusTo.id)?.focus();
  }, [focusTo]);
  const focusLater = (id: string) => setFocusTo({ id, n: Date.now() });

  useLayoutEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const place = () => {
      const on = el.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!on) return;
      el.style.setProperty("--bar-x", `${on.offsetLeft}px`);
      el.style.setProperty("--bar-w", `${on.offsetWidth}px`);
      if (!el.dataset.ready) setTimeout(() => (el.dataset.ready = "1"), 0);
    };
    place();
    if (typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tab, state]);

  const q = query.trim().toLowerCase();
  const shown = lists[tab].filter((p) => !q || p.name.toLowerCase().includes(q) || p.headline.toLowerCase().includes(q));
  const bid = (id: string, col: number) => `${uid}-${tab}-${id}-${col}`;
  const current = active && shown.some((p) => p.id === active.id) ? active : shown[0] ? { id: shown[0].id, col: 0 } : null;
  const TABS: { id: TabId; label: string }[] = [
    { id: "received", label: l.received },
    { id: "sent", label: l.sent },
    { id: "suggestions", label: l.suggested },
  ];

  const tabKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : null;
    if (n === null) return;
    e.preventDefault();
    const t = TABS[(n + TABS.length) % TABS.length]!;
    setTab(t.id);
    setActive(null);
    document.getElementById(`${uid}-tab-${t.id}`)?.focus();
  };
  const listKeys = (e: KeyboardEvent<HTMLUListElement>) => {
    if (!current) return;
    const i = shown.findIndex((p) => p.id === current.id);
    const cols = (id: string) => (document.getElementById(`${uid}-row-${tab}-${id}`)?.querySelectorAll("[data-act]").length ?? 1) - 1;
    let row = i;
    let col = current.col;
    // Suggestions sit in a grid of cards: Left and Right also step between cards.
    if (e.key === "ArrowDown") row = Math.min(i + 1, shown.length - 1);
    else if (e.key === "ArrowUp") row = Math.max(i - 1, 0);
    else if (e.key === "Home") row = 0;
    else if (e.key === "End") row = shown.length - 1;
    else if (e.key === "ArrowRight") col = Math.min(col + 1, cols(current.id));
    else if (e.key === "ArrowLeft") col = Math.max(col - 1, 0);
    else return;
    e.preventDefault();
    const p = shown[row]!;
    col = Math.min(col, cols(p.id));
    setActive({ id: p.id, col });
    document.getElementById(bid(p.id, col))?.focus();
  };

  /** Removes a person from a tab with a leave and a glide, then moves focus to the next one (or the tab). */
  const takeOut = (p: ConnectionPerson, from: TabId, change: (l: Lists) => Lists, text: string, undoable: boolean) => {
    const before = latest.current;
    const i = shown.findIndex((x) => x.id === p.id);
    const next = shown[i + 1] ?? shown[i - 1];
    const el = document.getElementById(`${uid}-row-${from}-${p.id}`)?.closest("li") as HTMLElement | null;
    leave(el, () => glide(list.current, () => setLists(change(latest.current))));
    setStatus(text);
    setUndo(undoable ? { text, restore: before } : null);
    if (next) {
      setActive({ id: next.id, col: 0 });
      focusLater(bid(next.id, 0));
    } else focusLater(`${uid}-tab-${from}`);
  };
  const respond = async (p: ConnectionPerson, answer: "accept" | "ignore") => {
    try {
      await onRespond?.(p.id, answer);
      takeOut(p, "received", (x) => ({ ...x, received: x.received.filter((r) => r.id !== p.id) }), `${answer === "accept" ? l.accepted : l.ignored} ${p.name}`, true);
    } catch {
      setStatus(l.failed);
    }
  };
  const acceptAll = async () => {
    const all = lists.received;
    try {
      for (const p of all) await onRespond?.(p.id, "accept");
      const before = latest.current;
      glide(list.current, () => setLists((x) => ({ ...x, received: [] })));
      const text = `${l.accepted} ${all.length} people`;
      setStatus(text);
      setUndo({ text, restore: before });
      focusLater(`${uid}-tab-received`);
    } catch {
      setStatus(l.failed);
    }
  };
  const connect = async (p: ConnectionPerson) => {
    try {
      await onConnect?.(p.id);
      takeOut(p, "suggestions", (x) => ({ ...x, suggestions: x.suggestions.filter((s) => s.id !== p.id), sent: [{ ...p, at: new Date().toISOString(), note: undefined }, ...x.sent] }), `${l.requested} ${p.name}`, true);
    } catch {
      setStatus(l.failed);
    }
  };
  const dismiss = (p: ConnectionPerson) => {
    onDismiss?.(p.id);
    takeOut(p, "suggestions", (x) => ({ ...x, suggestions: x.suggestions.filter((s) => s.id !== p.id) }), `${l.dismissed} ${p.name}`, true);
  };
  const withdraw = (): false => {
    const p = withdrawing;
    if (!p) return false;
    setBusy(true);
    Promise.resolve()
      .then(() => onWithdraw?.(p.id))
      .then(
        () => {
          setBusy(false);
          setWithdrawing(null);
          takeOut(p, "sent", (x) => ({ ...x, sent: x.sent.filter((s) => s.id !== p.id) }), `${l.withdrawn} ${p.name}`, false);
        },
        () => {
          setBusy(false);
          setWithdrawing(null);
          setStatus(l.failed);
        },
      );
    return false;
  };
  const doUndo = () => {
    if (!undo) return;
    const back = undo.restore;
    const added = (Object.keys(back) as TabId[]).flatMap((k) => back[k].filter((p) => !lists[k].some((x) => x.id === p.id)).map((p) => ({ k, id: p.id })));
    glide(list.current, () => setLists(back));
    const mine = added.find((a) => a.k === tab);
    if (mine) {
      setFresh(mine.id);
      setActive({ id: mine.id, col: 0 });
      focusLater(bid(mine.id, 0));
    }
    setStatus(`${l.undo}: ${undo.text}`);
    setUndo(null);
  };

  const counts = { received: lists.received.length, sent: lists.sent.length, suggestions: lists.suggestions.length };
  const empty = {
    received: [l.noReceived, l.noReceivedText],
    sent: [l.noSent, l.noSentText],
    suggestions: [l.noSuggested, l.noSuggestedText],
  }[tab];

  const btn = (p: ConnectionPerson, col: number) => ({
    id: bid(p.id, col),
    "data-act": "",
    tabIndex: current?.id === p.id && current.col === col ? 0 : -1,
    onFocus: () => setActive({ id: p.id, col }),
  });

  return (
    <div className="fl-conx" data-fl="p.connection-requests" aria-busy={state === "loading" || undefined}>
      <header className="fl-conx-head">
        <h2 id={`${uid}-h`}>
          {title}
          {state === "ready" && counts.received ? <Bump n={counts.received} className="fl-conx-total" /> : null}
        </h2>
        {tab === "received" && counts.received > 1 && state === "ready" ? (
          <Button variant="secondary" size={40} icon="check" onClick={acceptAll}>
            {l.acceptAll}
          </Button>
        ) : null}
      </header>

      <div className="fl-conx-tabs" role="tablist" aria-label={l.tabs} ref={tabsRef} onKeyDown={tabKeys}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${uid}-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`${uid}-panel`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => {
              setTab(t.id);
              setActive(null);
            }}
          >
            {t.label}
            {state === "ready" ? <Bump n={counts[t.id]} className="fl-conx-tabn" /> : null}
          </button>
        ))}
        <span className="fl-conx-bar" aria-hidden="true" />
      </div>

      <div className="fl-conx-panel" role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${tab}`}>
        <div className="fl-conx-search" role="search">
          <label htmlFor={`${uid}-q`} className="fl-sr">
            {l.search}
          </label>
          <span className="fl-conx-search-icon" aria-hidden="true">
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
              glide(list.current, () => setQuery(v));
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query) {
                e.preventDefault();
                setQuery("");
              }
            }}
          />
        </div>

        {undo ? (
          <div className="fl-conx-undo">
            <Icon name="check" />
            <span>{undo.text}</span>
            <button type="button" className="fl-conx-link" onClick={doUndo}>
              {l.undo}
            </button>
            <button type="button" className="fl-conx-x" aria-label="Close" onClick={() => setUndo(null)}>
              <Icon name="close" />
            </button>
          </div>
        ) : null}

        {state === "loading" ? (
          <div className="fl-conx-skel">
            <Skeleton variant="row" />
            <Skeleton variant="row" seed={1} />
            <Skeleton variant="row" seed={2} />
          </div>
        ) : state === "error" ? (
          <EmptyState
            variant="error"
            title={l.loadFailed}
            action={
              <Button variant="secondary" size={40} icon="refresh" onClick={run}>
                {l.retry}
              </Button>
            }
          />
        ) : (
          <>
            <p className="fl-sr" role="status" aria-live="polite">
              {shown.length} {shown.length === 1 ? "person" : "people"}
            </p>
            <ul className={`fl-conx-list${tab === "suggestions" ? " is-cards" : ""}`} ref={list} role="grid" aria-labelledby={`${uid}-tab-${tab}`} onKeyDown={listKeys} key={tab}>
              {shown.map((p, i) => (
                <li key={p.id} data-key={p.id} role="row" className={fresh === p.id ? "is-new" : undefined} style={{ "--i": i } as CSSProperties} onAnimationEnd={(e) => e.target === e.currentTarget && fresh === p.id && setFresh(null)}>
                  <div className="fl-conx-row" id={`${uid}-row-${tab}-${p.id}`} role="gridcell">
                    <Avatar name={p.name} size={tab === "suggestions" ? 64 : 48} tone={toneOf(p.name)} decorative />
                    <div className="fl-conx-who">
                      <strong>{p.name}</strong>
                      <span className="fl-conx-headline">{p.headline}</span>
                      <Mutual names={p.mutual} label={l.mutual} id={`${uid}-mut-${tab}-${p.id}`} />
                      {p.note && tab !== "suggestions" ? <blockquote className="fl-conx-note">{p.note}</blockquote> : null}
                      {tab !== "suggestions" ? (
                        <time className="fl-conx-time" dateTime={p.at}>
                          {tab === "sent" ? `${l.pending} ` : ""}
                          {ago(p.at)}
                        </time>
                      ) : null}
                    </div>
                    <div className="fl-conx-acts">
                      {tab === "received" ? (
                        <>
                          <Button size={32} {...btn(p, 0)} onClick={() => respond(p, "accept")} aria-label={`${l.accept} ${p.name}`}>
                            {l.accept}
                          </Button>
                          <Button variant="tertiary" size={32} {...btn(p, 1)} onClick={() => respond(p, "ignore")} aria-label={`${l.ignore} ${p.name}`}>
                            {l.ignore}
                          </Button>
                        </>
                      ) : tab === "sent" ? (
                        <Button variant="secondary" size={32} {...btn(p, 0)} onClick={() => setWithdrawing(p)} aria-label={`${l.withdraw}: ${p.name}`}>
                          {l.withdraw}
                        </Button>
                      ) : (
                        <>
                          <Button size={32} icon="plus" {...btn(p, 0)} onClick={() => connect(p)} aria-label={`${l.connect} with ${p.name}`}>
                            {l.connect}
                          </Button>
                          <button type="button" className="fl-conx-x fl-conx-dismiss" {...btn(p, 1)} aria-label={`${l.dismiss}: ${p.name}`} title={l.dismiss} onClick={() => dismiss(p)}>
                            <Icon name="close" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {shown.length === 0 ? (
              q && lists[tab].length ? (
                <EmptyState
                  variant="no-results"
                  title={l.noMatch}
                  action={
                    <Button variant="secondary" size={40} onClick={() => (setQuery(""), document.getElementById(`${uid}-q`)?.focus())}>
                      Clear search
                    </Button>
                  }
                >
                  {l.noMatchText}
                </EmptyState>
              ) : (
                <EmptyState variant="done" icon="users" title={empty[0]!}>
                  {empty[1]}
                </EmptyState>
              )
            ) : null}
          </>
        )}
      </div>

      <p className="fl-conx-status" role="status" aria-live="polite">
        {state === "loading" ? l.loading : status}
      </p>

      {withdrawing ? (
        <Modal variant="danger" className="fl-conx-dlg" icon="close" title={`${l.withdrawTitle} ${withdrawing.name}?`} description={l.withdrawText} confirmLabel={l.withdraw} busy={busy} busyLabel="Withdrawing..." onConfirm={() => withdraw()} onClose={() => setWithdrawing(null)} />
      ) : null}
    </div>
  );
}

// flowcode:sample
const SAMPLE = (() => {
  const at = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3_600_000).toISOString();
  return {
    title: "Connections",
    received: [
      { id: "c1", name: "Grace Kim", headline: "Pastry chef at Little Oven", mutual: ["Maya Chen", "Dev Patel", "Sam Rivera"], note: "Loved your sourdough thread. Would be great to swap starters sometime!", at: at(2) },
      { id: "c2", name: "Omar Haddad", headline: "Organizer, Eastside Night Runners", mutual: ["Rosa Delgado"], at: at(20) },
      { id: "c3", name: "Hannah Weiss", headline: "Product designer", mutual: ["Ana Silva", "Priya Raman"], note: "We met at the design meetup last week.", at: at(50) },
      { id: "c4", name: "Luis Moreno", headline: "Trail crew volunteer", mutual: [], at: at(24 * 5) },
    ],
    sent: [
      { id: "s1", name: "Ivy Chen", headline: "Food photographer", mutual: ["Maya Chen"], at: at(24 * 3) },
      { id: "s2", name: "Ben Carter", headline: "Community manager at Greenleaf", mutual: [], at: at(24 * 8) },
    ],
    suggestions: [
      { id: "g1", name: "Nora Lind", headline: "Baker and teacher", mutual: ["Grace Kim", "Dev Patel"], at: at(0) },
      { id: "g2", name: "Kofi Mensah", headline: "Runs the Saturday market", mutual: ["Omar Haddad"], at: at(0) },
      { id: "g3", name: "Elena Popescu", headline: "Cookbook editor", mutual: ["Sam Rivera", "Maya Chen", "Ivy Chen", "Leo Martins"], at: at(0) },
      { id: "g4", name: "Ravi Iyer", headline: "Coffee roaster", mutual: [], at: at(0) },
    ],
  };
})();

export default function ConnectionRequestsPreview() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap fl-wrap--narrow">
        <ConnectionRequests
          title={SAMPLE.title}
          load={() => new Promise((ok) => setTimeout(() => ok({ received: SAMPLE.received, sent: SAMPLE.sent, suggestions: SAMPLE.suggestions }), 700))}
          onWithdraw={() => new Promise((ok) => setTimeout(ok, 300))}
        />
      </div>
    </section>
  );
}
