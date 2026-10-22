/** @flowcode-library short-links · Short links (Tables and lists)
 * Catalog ID: p.short-links (pattern)
 * Function: Short links (p.short-links): create a short link for any web address (an optional custom name, checked for format and taken names, with a live preview), copy it with one press (Copied, or a fallback that selects it), see clicks over the last 14 days as a sparkline with a total and trend, open a day-by-day chart, change where it points, turn it off and on, and delete it after a confirm with Undo; search, an All / Active / Off filter and a sort; loading, a load error with Retry, empty and no-match states, and every change announced.
 * Use it as: import { ShortLinks } from "./short-links"; <ShortLinks title lede? domain="go.example.com" links?={[{ id, slug, target, clicks: number[] (oldest day first), created: ISO, active }]} load?={async () => ShortLink[]} copy?={async (text) => void} onChange?={(links) => ...} labels?={{ create, copy, copied, stats, edit, delete, ... }} />
 * Built from: c.text-field.outlined, c.select.outlined, c.segmented.segmented, c.switch, c.badge.status, c.button.primary, c.button.secondary, c.button.tertiary, c.modal.danger
 * Look: A white card: the title with a link count; a sunken create row (Destination, Short name with the domain in front, Create link) with the finished link previewed under it; a search box, an All / Active / Off switch and a sort; rows with the short link in a mono face, the destination under it, a small accent sparkline with the 14-day total and trend, and a compact toolbar (Copy, Stats, Edit, an on/off switch, Delete); Stats unfolds a bar chart of the last 14 days.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-danger --font-mono --space-1 --space-2 --space-3 --space-4 --space-5 --radius-sm --radius-md --radius-lg --text-xs --text-sm --text-lg --weight-medium --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --easing --enter-distance --stagger
 * Use cases: short links; link in bio; link shortener; campaign links; QR code links; marketing links; referral links
 * Jobs to be done: make a short link I can put in a post; copy a link without selecting text; see which links people actually click; point an old link at a new page; switch off a link for a campaign that ended
 * Keywords: short links, link shortener, URL, link in bio, copy link, clicks, sparkline, analytics, disable, redirect, campaign
 */
/**
 * Short links: a small link shortener's screen. Each row's actions are one toolbar: Tab reaches it once and the arrow
 * keys move between Copy, Stats, Edit, the on/off switch and Delete (roving focus). Copy uses the clipboard when the
 * page may, and otherwise selects the link so it can be copied by hand. Clicks are given per day, oldest first; the
 * sparkline and the bar chart come from the same numbers, and the chart has a table for screen readers. Rows glide
 * when sorted, filtered, added or removed (FLIP); the chart unfolds (inert while folded); with motion off they simply
 * appear.
 * Adapted from TailGrids (MIT, Copyright (c) 2025 Tailgrids): its input group, table, switch and chart components,
 * and Tailblocks (MIT, Copyright (c) 2020 Mert Cukuren): its statistic blocks.
 */
/**
 * How to try it
 * - Wait for the rows to load. Press Create link with an empty destination, then type "example": both say why.
 *   Type https://example.com/autumn and the short name "spring-sale" (taken): it says so. Use "autumn": the row
 *   appears with focus on Copy.
 * - Tab to a row's toolbar and use the arrow keys. Press Copy: it says Copied. Press Stats: the chart unfolds.
 * - Edit the destination to "ftp://x": it says why; Escape cancels. Turn a link off with its switch: it dims and
 *   shows Off.
 * - Delete a link, confirm, then Undo. Search "zzz" for the no-match state; sort by Most clicks.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useRef, useState), the library's TextField, Select,
 * Segmented, Switch, Badge, Button and Modal ("./text-fields-states", "./dropdowns-states", "./segmented-control",
 * "./switches-states", "./badges-status", "./buttons-variants", "./modals-dialogs") and its inline icon set ("./icons").
 * The browser's clipboard when allowed. Nothing else: no package and nothing fetched. The styles are the library's own
 * fl- classes in templates/library/css/r5d-short-links.css.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { Segmented } from "./segmented-control";
import { Switch } from "./switches-states";
import { TextField } from "./text-fields-states";

// ── p.short-links: create, copy, track, edit, switch off and delete short links. ──

export type ShortLink = { id: string; slug: string; target: string; clicks: number[]; created: string; active: boolean };

export type ShortLinksLabels = Partial<{
  count: string;
  destination: string;
  destinationHint: string;
  slug: string;
  slugHint: string;
  create: string;
  creating: string;
  preview: string;
  search: string;
  status: string;
  all: string;
  active: string;
  off: string;
  sortLabel: string;
  byClicks: string;
  byNewest: string;
  actions: string;
  copy: string;
  copied: string;
  copyFailed: string;
  stats: string;
  edit: string;
  save: string;
  cancel: string;
  remove: string;
  removeTitle: string;
  removeText: string;
  toggle: string;
  clicks: string;
  last14: string;
  day: string;
  created: string;
  saved: string;
  turnedOn: string;
  turnedOff: string;
  removed: string;
  undo: string;
  undone: string;
  loading: string;
  loadFailed: string;
  retry: string;
  empty: string;
  emptyText: string;
  noMatch: string;
  clear: string;
  urlRequired: string;
  urlBad: string;
  slugBad: string;
  slugTaken: string;
}>;

export type ShortLinksProps = {
  title: string;
  lede?: string;
  /** The short domain shown in front of every name. */
  domain?: string;
  /** The links to start with. Ignored while `load` is given. */
  links?: ShortLink[];
  /** Loads the links; rows show as loading until it settles, and a failure offers Retry. */
  load?: () => Promise<ShortLink[]>;
  /** Copies text; the browser clipboard when left out. A rejection shows the fallback. */
  copy?: (text: string) => Promise<void>;
  /** Gets every link after each change (and after Undo). */
  onChange?: (links: ShortLink[]) => void;
  labels?: ShortLinksLabels;
};

type Undo = { before: ShortLink[]; text: string };

function motionOff() {
  return document.documentElement.dataset.motion === "off" || Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}
function tokenMs(name: string, fallback: number) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  return raw.endsWith("ms") ? n : raw.endsWith("s") ? n * 1000 : n;
}
const sum = (a: number[]) => a.reduce((s, n) => s + n, 0);
/** Last 7 days against the 7 before, as a whole percent; null when there's nothing to compare. */
function trend(clicks: number[]) {
  const a = sum(clicks.slice(-7));
  const b = sum(clicks.slice(-14, -7));
  if (!b) return null;
  return Math.round(((a - b) / b) * 100);
}
export function checkUrl(v: string) {
  const s = v.trim();
  if (!s || /\s/.test(s)) return false;
  try {
    const u = new URL(s);
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}
const dayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const dayAt = (fromEnd: number) => {
  const d = new Date();
  d.setDate(d.getDate() - fromEnd);
  return d;
};

/** FLIP: rows marked data-flip glide from where they were to where they are whenever `key` changes. */
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
          n.animate([{ opacity: 0, translate: "0 calc(var(--enter-distance, 8px) * -1)" }, { opacity: 1, translate: "0 0" }], { duration: tokenMs("--duration-base", 200), easing: ease });
        } else if (was !== now.get(n.dataset.flip!)) {
          n.animate([{ translate: `0 ${was - now.get(n.dataset.flip!)!}px` }, { translate: "0 0" }], { duration: tokenMs("--duration-slow", 320), easing: ease });
        }
      }
    }
    last.current = now;
  }, [key, box]);
}

/** Roving focus inside a toolbar: one tab stop, arrow keys, Home and End. */
function onToolbarKey(e: KeyboardEvent<HTMLDivElement>) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)"));
  const i = items.indexOf(document.activeElement as HTMLElement);
  if (i < 0) return;
  e.preventDefault();
  const n = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
  items.forEach((el, k) => (el.tabIndex = k === n ? 0 : -1));
  items[n].focus();
}
/** Gives a new toolbar its single tab stop (the first control). */
function initToolbar(el: HTMLDivElement | null) {
  if (!el || el.dataset.rov) return;
  el.dataset.rov = "1";
  Array.from(el.querySelectorAll<HTMLElement>("button, input")).forEach((b, k) => (b.tabIndex = k === 0 ? 0 : -1));
}
/** Keeps the toolbar's one tab stop on whatever inside it last had focus. */
function onToolbarFocus(e: FocusEvent<HTMLDivElement>) {
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("button, input"));
  if (!items.includes(e.target as HTMLElement)) return;
  items.forEach((el) => (el.tabIndex = el === e.target ? 0 : -1));
}

function Sparkline({ clicks, label }: { clicks: number[]; label: string }) {
  const max = Math.max(1, ...clicks);
  const pts = clicks.map((c, i) => [(i / Math.max(1, clicks.length - 1)) * 100, 26 - (c / max) * 22] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return (
    <svg className="fl-slnk-spark" viewBox="0 0 100 28" preserveAspectRatio="none" role="img" aria-label={label}>
      <path d={`${line} L100 28 L0 28 Z`} className="fl-slnk-spark-area" />
      <path d={line} className="fl-slnk-spark-line" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function ShortLinks({ title, lede, domain = "go.example.com", links: initial = [], load, copy, onChange, labels = {} }: ShortLinksProps) {
  const l = {
    count: "{n} links",
    destination: "Destination",
    destinationHint: "https://",
    slug: "Short name",
    slugHint: "Optional",
    create: "Create link",
    creating: "Creating…",
    preview: "Your link",
    search: "Search links",
    status: "Show",
    all: "All",
    active: "Active",
    off: "Off",
    sortLabel: "Sort links",
    byClicks: "Most clicks",
    byNewest: "Newest",
    actions: "Actions for {link}",
    copy: "Copy",
    copied: "Copied",
    copyFailed: "Couldn't copy. The link is selected; press Ctrl+C.",
    stats: "Stats",
    edit: "Edit",
    save: "Save",
    cancel: "Cancel",
    remove: "Delete",
    removeTitle: "Delete {link}?",
    removeText: "Anyone who opens it will get a not-found page. Its click history goes too.",
    toggle: "Active: {link}",
    clicks: "{n} clicks",
    last14: "Clicks over the last 14 days",
    day: "Day",
    created: "Created {link}.",
    saved: "{link} now points to {url}.",
    turnedOn: "{link} is on.",
    turnedOff: "{link} is off.",
    removed: "Deleted {link}.",
    undo: "Undo",
    undone: "Undone.",
    loading: "Loading links…",
    loadFailed: "Couldn't load the links.",
    retry: "Retry",
    empty: "No links yet",
    emptyText: "Paste a web address above to make your first short link.",
    noMatch: "No links match “{q}”",
    clear: "Clear search",
    urlRequired: "Paste the address the link should open.",
    urlBad: "Use a full web address starting with http:// or https://.",
    slugBad: "Use 3 to 32 lowercase letters, numbers or dashes.",
    slugTaken: "That short name is taken.",
    ...labels,
  };
  const id = useId();
  const [links, setLinks] = useState<ShortLink[]>(load ? [] : initial);
  const [phase, setPhase] = useState<"loading" | "error" | "ready">(load ? "loading" : "ready");
  const [form, setForm] = useState({ target: "", slug: "" });
  const [errs, setErrs] = useState<{ target?: string; slug?: string }>({});
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "off">("all");
  const [sort, setSort] = useState<"clicks" | "newest">("newest");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<{ id: string; value: string; error: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [copyErr, setCopyErr] = useState<string | null>(null);
  const [deleteFor, setDeleteFor] = useState<ShortLink | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [said, setSaid] = useState("");
  const listRef = useRef<HTMLUListElement>(null);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms = 0) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const fetchLinks = () => {
    if (!load) return;
    setPhase("loading");
    load()
      .then((t) => {
        setLinks(t);
        setPhase("ready");
      })
      .catch(() => setPhase("error"));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(fetchLinks, []);

  const short = (s: string) => `${domain}/${s}`;
  const commit = (next: ShortLink[], message: string, undoable?: ShortLink[]) => {
    setLinks(next);
    onChange?.(next);
    setSaid(message);
    if (undoable) {
      setUndo({ before: undoable, text: message });
      later(() => document.getElementById(`${id}-undo`)?.focus(), 60);
    } else setUndo(null);
  };

  const makeSlug = () => {
    const abc = "abcdefghijkmnpqrstuvwxyz23456789";
    let s = "";
    do s = Array.from({ length: 6 }, () => abc[Math.floor(Math.random() * abc.length)]).join("");
    while (links.some((x) => x.slug === s));
    return s;
  };

  const create = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const target = form.target.trim();
    const slug = form.slug.trim().toLowerCase();
    const next: typeof errs = {};
    if (!target) next.target = l.urlRequired;
    else if (!checkUrl(target)) next.target = l.urlBad;
    if (slug && !/^[a-z0-9-]{3,32}$/.test(slug)) next.slug = l.slugBad;
    else if (slug && links.some((x) => x.slug === slug)) next.slug = l.slugTaken;
    setErrs(next);
    if (next.target || next.slug) {
      document.getElementById(next.target ? `${id}-target` : `${id}-slug`)?.focus();
      return;
    }
    setBusy(true);
    later(() => {
      const link: ShortLink = { id: `l${Date.now().toString(36)}`, slug: slug || makeSlug(), target, clicks: Array(14).fill(0), created: new Date().toISOString(), active: true };
      commit([link, ...links], l.created.replace("{link}", short(link.slug)));
      setBusy(false);
      setForm({ target: "", slug: "" });
      setQuery("");
      setStatus("all");
      later(() => document.getElementById(`${id}-copy-${link.id}`)?.focus(), 30);
    }, 450);
  };

  const doCopy = (link: ShortLink) => {
    const text = `https://${short(link.slug)}`;
    const run = copy ?? ((t: string) => (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject(new Error("no clipboard"))));
    run(text)
      .then(() => {
        setCopyErr(null);
        setCopied(link.id);
        setSaid(`${l.copied}: ${text}`);
        later(() => setCopied((c) => (c === link.id ? null : c)), 2000);
      })
      .catch(() => {
        setCopied(null);
        setCopyErr(link.id);
        setSaid(l.copyFailed);
        const el = document.getElementById(`${id}-short-${link.id}`);
        if (el) {
          const r = document.createRange();
          r.selectNodeContents(el);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(r);
        }
      });
  };

  const saveEdit = () => {
    if (!editing) return;
    const v = editing.value.trim();
    const error = !v ? l.urlRequired : !checkUrl(v) ? l.urlBad : "";
    if (error) {
      setEditing({ ...editing, error });
      document.getElementById(`${id}-edit`)?.focus();
      return;
    }
    const link = links.find((x) => x.id === editing.id)!;
    setEditing(null);
    if (v !== link.target) commit(links.map((x) => (x.id === link.id ? { ...x, target: v } : x)), l.saved.replace("{link}", short(link.slug)).replace("{url}", v));
    later(() => document.getElementById(`${id}-editbtn-${link.id}`)?.focus(), 30);
  };
  const cancelEdit = () => {
    const was = editing?.id;
    setEditing(null);
    if (was) later(() => document.getElementById(`${id}-editbtn-${was}`)?.focus(), 30);
  };

  const toggle = (link: ShortLink, on: boolean) => commit(links.map((x) => (x.id === link.id ? { ...x, active: on } : x)), (on ? l.turnedOn : l.turnedOff).replace("{link}", short(link.slug)));

  const remove = () => {
    if (!deleteFor) return;
    commit(
      links.filter((x) => x.id !== deleteFor.id),
      l.removed.replace("{link}", short(deleteFor.slug)),
      links,
    );
  };
  const doUndo = () => {
    if (!undo) return;
    setLinks(undo.before);
    onChange?.(undo.before);
    setUndo(null);
    setSaid(l.undone);
    later(() => document.getElementById(`${id}-search`)?.focus(), 30);
  };
  useEffect(() => {
    if (!undo) return;
    const t = window.setTimeout(() => setUndo(null), 10000);
    return () => window.clearTimeout(t);
  }, [undo]);

  const q = query.trim().toLowerCase();
  const shown = links
    .filter((x) => status === "all" || (status === "active" ? x.active : !x.active))
    .filter((x) => !q || x.slug.includes(q) || x.target.toLowerCase().includes(q))
    .sort((a, b) => (sort === "clicks" ? sum(b.clicks) - sum(a.clicks) : b.created.localeCompare(a.created)));
  useFlip(listRef, `${phase}|${shown.map((x) => x.id).join(",")}`);

  const slugPreview = form.slug.trim().toLowerCase() || "…";

  return (
    <section className="fl-slnk" aria-labelledby={`${id}-title`} data-fl="p.short-links">
      <header className="fl-slnk-head">
        <div className="fl-slnk-heading">
          <h2 id={`${id}-title`}>{title}</h2>
          {lede ? <p>{lede}</p> : null}
        </div>
        {phase === "ready" ? <span className="fl-slnk-count">{links.length === 1 ? "1 link" : l.count.replace("{n}", String(links.length))}</span> : null}
      </header>

      <form className="fl-slnk-create" noValidate onSubmit={create} aria-label={l.create}>
        <div className="fl-slnk-field fl-slnk-field--target">
          <label htmlFor={`${id}-target`}>{l.destination}</label>
          <TextField
            id={`${id}-target`}
            type="url"
            inputMode="url"
            size={40}
            placeholder="https://example.com/page"
            value={form.target}
            invalid={Boolean(errs.target)}
            aria-describedby={errs.target ? `${id}-target-err` : undefined}
            onChange={(e) => {
              setForm({ ...form, target: e.currentTarget.value });
              if (errs.target) setErrs({ ...errs, target: undefined });
            }}
          />
          {errs.target ? (
            <p id={`${id}-target-err`} className="fl-slnk-error" role="alert">
              <Icon name="alert" />
              {errs.target}
            </p>
          ) : null}
        </div>
        <div className="fl-slnk-field">
          <label htmlFor={`${id}-slug`}>
            {l.slug} <span className="fl-slnk-opt">{l.slugHint}</span>
          </label>
          <span className="fl-slnk-prefix">
            <span aria-hidden="true">{domain}/</span>
            <TextField
              id={`${id}-slug`}
              size={40}
              placeholder="spring"
              autoCapitalize="none"
              spellCheck={false}
              value={form.slug}
              invalid={Boolean(errs.slug)}
              aria-describedby={errs.slug ? `${id}-slug-err` : `${id}-preview`}
              onChange={(e) => {
                setForm({ ...form, slug: e.currentTarget.value });
                if (errs.slug) setErrs({ ...errs, slug: undefined });
              }}
            />
          </span>
          {errs.slug ? (
            <p id={`${id}-slug-err`} className="fl-slnk-error" role="alert">
              <Icon name="alert" />
              {errs.slug}
            </p>
          ) : null}
        </div>
        <Button type="submit" size={40} icon="link" busy={busy} className="fl-slnk-go">
          {busy ? l.creating : l.create}
        </Button>
        <p id={`${id}-preview`} className="fl-slnk-preview">
          {l.preview}: <code>{form.slug.trim() ? short(slugPreview) : `${domain}/ + 6 letters`}</code>
        </p>
      </form>

      <div className="fl-slnk-tools">
        <span className="fl-slnk-search">
          <Icon name="search" />
          <TextField id={`${id}-search`} type="search" size={40} aria-label={l.search} placeholder={l.search} value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
        </span>
        <Segmented
          size="sm"
          label={l.status}
          value={status}
          onChange={(v) => setStatus(v as "all" | "active" | "off")}
          options={[
            { value: "all", label: l.all },
            { value: "active", label: l.active },
            { value: "off", label: l.off },
          ]}
        />
        <span className="fl-slnk-sort">
          <label className="fl-sr" htmlFor={`${id}-sort`}>
            {l.sortLabel}
          </label>
          <Select
            id={`${id}-sort`}
            value={sort}
            onChange={(e) => setSort(e.currentTarget.value as "clicks" | "newest")}
            options={[
              { value: "newest", label: l.byNewest },
              { value: "clicks", label: l.byClicks },
            ]}
          />
        </span>
      </div>

      {phase === "loading" ? (
        <ul className="fl-slnk-list" aria-busy="true" aria-label={l.loading}>
          {[0, 1, 2].map((i) => (
            <li key={i} className="fl-slnk-skel" aria-hidden="true" />
          ))}
        </ul>
      ) : phase === "error" ? (
        <div className="fl-slnk-empty" role="alert">
          <Icon name="alert" />
          <p className="fl-slnk-empty-title">{l.loadFailed}</p>
          <Button variant="secondary" size={40} icon="refresh" onClick={fetchLinks}>
            {l.retry}
          </Button>
        </div>
      ) : !links.length ? (
        <div className="fl-slnk-empty">
          <Icon name="link" />
          <p className="fl-slnk-empty-title">{l.empty}</p>
          <p>{l.emptyText}</p>
        </div>
      ) : !shown.length ? (
        <div className="fl-slnk-empty">
          <Icon name="search" />
          <p className="fl-slnk-empty-title">{q ? l.noMatch.replace("{q}", query.trim()) : status === "off" ? "No links are off." : "No active links."}</p>
          <Button variant="tertiary" size={32} onClick={() => {
              setQuery("");
              setStatus("all");
              document.getElementById(`${id}-search`)?.focus();
            }}>
            {l.clear}
          </Button>
        </div>
      ) : (
        <ul className="fl-slnk-list" ref={listRef} aria-label={title}>
          {shown.map((x) => {
            const total = sum(x.clicks);
            const tr = trend(x.clicks);
            const isOpen = Boolean(open[x.id]);
            const isEditing = editing?.id === x.id;
            const max = Math.max(1, ...x.clicks);
            const name = short(x.slug);
            return (
              <li key={x.id} data-flip={x.id} className={["fl-slnk-row", x.active ? "" : "is-off"].filter(Boolean).join(" ")}>
                <div className="fl-slnk-main">
                  <div className="fl-slnk-link">
                    <span className="fl-slnk-short" id={`${id}-short-${x.id}`}>
                      {name}
                    </span>
                    {!x.active ? <Badge tone="neutral">{l.off}</Badge> : null}
                  </div>
                  {isEditing ? (
                    <div className="fl-slnk-edit">
                      <label className="fl-sr" htmlFor={`${id}-edit`}>
                        {l.destination}
                      </label>
                      <TextField
                        id={`${id}-edit`}
                        type="url"
                        size={32}
                        autoFocus
                        value={editing.value}
                        invalid={Boolean(editing.error)}
                        aria-describedby={editing.error ? `${id}-edit-err` : undefined}
                        onChange={(e) => setEditing({ ...editing, value: e.currentTarget.value, error: "" })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            saveEdit();
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            cancelEdit();
                          }
                        }}
                      />
                      <Button size={32} onClick={saveEdit}>
                        {l.save}
                      </Button>
                      <Button variant="tertiary" size={32} onClick={cancelEdit}>
                        {l.cancel}
                      </Button>
                      {editing.error ? (
                        <p id={`${id}-edit-err`} className="fl-slnk-error" role="alert">
                          <Icon name="alert" />
                          {editing.error}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <span className="fl-slnk-target" title={x.target}>
                      <Icon name="arrow" />
                      {x.target}
                    </span>
                  )}
                  {copyErr === x.id ? <p className="fl-slnk-error">{l.copyFailed}</p> : null}
                </div>

                <div className="fl-slnk-metric">
                  <Sparkline clicks={x.clicks} label={`${l.last14}: ${total}`} />
                  <span className="fl-slnk-total">
                    <strong>{total.toLocaleString("en-US")}</strong> {total === 1 ? "click" : "clicks"}
                    {tr !== null ? <span className={["fl-slnk-trend", tr < 0 ? "is-down" : ""].filter(Boolean).join(" ")}>{tr >= 0 ? `+${tr}%` : `${tr}%`}</span> : null}
                  </span>
                </div>

                <div className="fl-slnk-bar" role="toolbar" ref={initToolbar} aria-label={l.actions.replace("{link}", name)} onKeyDown={onToolbarKey} onFocus={onToolbarFocus}>
                  <Button id={`${id}-copy-${x.id}`} variant="secondary" size={32} icon={copied === x.id ? "check" : "copy"} className={copied === x.id ? "is-copied" : undefined} onClick={() => doCopy(x)}>
                    {copied === x.id ? l.copied : l.copy}
                  </Button>
                  <Button variant="tertiary" size={32} icon="chart" iconOnly aria-expanded={isOpen} aria-controls={`${id}-stats-${x.id}`} onClick={() => setOpen({ ...open, [x.id]: !isOpen })}>
                    {l.stats}
                  </Button>
                  <Button id={`${id}-editbtn-${x.id}`} variant="tertiary" size={32} icon="pencil" iconOnly onClick={() => setEditing({ id: x.id, value: x.target, error: "" })}>
                    {l.edit}
                  </Button>
                  <span className="fl-slnk-switch">
                    <Switch size={20} on={x.active} label={l.toggle.replace("{link}", name)} onToggle={(on) => toggle(x, on)} />
                  </span>
                  <Button variant="tertiary" size={32} icon="trash" iconOnly className="fl-slnk-del" onClick={() => setDeleteFor(x)}>
                    {l.remove}
                  </Button>
                </div>

                <div id={`${id}-stats-${x.id}`} className={["fl-slnk-stats", isOpen ? "is-open" : ""].filter(Boolean).join(" ")} inert={!isOpen || undefined}>
                  <div>
                    <p className="fl-slnk-stats-title">{l.last14}</p>
                    <div className="fl-slnk-chart" aria-hidden="true">
                      {x.clicks.map((c, i) => (
                        <span key={i} className="fl-slnk-col" style={{ ["--h" as string]: `${(c / max) * 100}%`, ["--i" as string]: i }} title={`${dayFmt.format(dayAt(x.clicks.length - 1 - i))}: ${c}`}>
                          <span />
                        </span>
                      ))}
                    </div>
                    <div className="fl-slnk-axis" aria-hidden="true">
                      <span>{dayFmt.format(dayAt(x.clicks.length - 1))}</span>
                      <span>{dayFmt.format(dayAt(0))}</span>
                    </div>
                    <div className="fl-sr">
                    <table>
                      <caption>
                        {l.last14}, {name}
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">{l.day}</th>
                          <th scope="col">{l.clicks.replace("{n} ", "")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {x.clicks.map((c, i) => (
                          <tr key={i}>
                            <td>{dayFmt.format(dayAt(x.clicks.length - 1 - i))}</td>
                            <td>{c}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className={["fl-slnk-undo", undo ? "is-open" : ""].filter(Boolean).join(" ")} inert={!undo || undefined}>
        <div>
          <p>{undo?.text}</p>
          <Button id={`${id}-undo`} variant="secondary" size={32} icon="refresh" onClick={doUndo}>
            {l.undo}
          </Button>
        </div>
      </div>

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>

      {deleteFor ? (
        <Modal
          variant="danger"
          icon="trash"
          title={l.removeTitle.replace("{link}", short(deleteFor.slug))}
          description={l.removeText}
          confirmLabel={l.remove}
          onConfirm={() => remove()}
          onClose={() => setDeleteFor(null)}
        />
      ) : null}
    </section>
  );
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

// flowcode:sample
const SAMPLE = {
  title: "Short links",
  lede: "Links for posts, bios and print, and how often people open them.",
  domain: "go.planner.example",
  links: [
    { id: "l1", slug: "autumn", target: "https://planner.example/blog/meet-the-new-planner?utm_source=social", clicks: [12, 18, 15, 22, 30, 41, 38, 52, 61, 58, 70, 66, 81, 94], created: daysAgo(14), active: true },
    { id: "l2", slug: "spring-sale", target: "https://planner.example/pricing?promo=spring", clicks: [40, 36, 31, 28, 22, 19, 15, 12, 10, 8, 6, 5, 3, 2], created: daysAgo(40), active: false },
    { id: "l3", slug: "bio", target: "https://planner.example/start", clicks: [20, 24, 19, 26, 22, 25, 28, 23, 27, 30, 26, 29, 31, 28], created: daysAgo(90), active: true },
    { id: "l4", slug: "webinar", target: "https://planner.example/events/planning-week", clicks: [0, 0, 0, 0, 0, 0, 0, 2, 5, 9, 14, 11, 18, 25], created: daysAgo(6), active: true },
  ] as ShortLink[],
};

export default function ShortLinksSheet() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap fl-wrap--narrow">
        <ShortLinks title={SAMPLE.title} lede={SAMPLE.lede} domain={SAMPLE.domain} load={() => new Promise((r) => window.setTimeout(() => r(SAMPLE.links), 700))} />
      </div>
    </section>
  );
}
