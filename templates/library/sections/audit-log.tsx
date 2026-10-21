/** @flowcode-library audit-log · Audit log (Tables and lists)
 * Catalog ID: p.audit-log (pattern)
 * Function: The audit log (p.audit-log): who did what, to what and when, newest first; narrow it by a date range (last 24 hours, 7 days, 30 days or a custom From and To, checked so From isn't after To), a person, an action and a search; open a row for the exact changes, place and request ID; sort by time, page through, refresh (loading and error states), and export what's shown as a CSV file.
 * Use it as: import { AuditLog } from "./audit-log"; <AuditLog title lede? events={[{ id, at: "2026-10-21T09:12", actor: { name, email }, action: "member.role", target, ip?, place?, requestId?, changes?: [{ field, from, to }] }]} actions={{ "member.role": { label: "Role changed", tone: "info" } }} now?={new Date()} pageSize?={10} load?={async () => events} onExport?={(rows) => ...} labels?={{ ... }} />
 * Built from: c.segmented.segmented, c.select.outlined, c.text-field.outlined, c.badge.status, c.avatar.person, c.button.secondary, c.button.tertiary, c.empty-state.no-results, c.empty-state.error
 * Look: A title with Refresh and Export CSV over a filter bar (a range switch, person and action dropdowns, search; Custom opens two date fields), then a bordered table: the time, the person with an avatar, a colored action pill, the target and the place, and a chevron that opens the row to a soft panel of before → after changes. Pages step underneath. On a phone each event becomes a card.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-danger --font-mono --space-1 --space-2 --space-3 --space-4 --space-5 --radius-md --radius-lg --text-xs --text-sm --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --easing --enter-distance --stagger
 * Use cases: audit log; security log; admin activity; compliance history; change history; access log; account events; workspace history
 * Jobs to be done: find out who changed a setting; see everything someone did this week; check what changed and from what; prove what happened for a review; hand the log to an auditor
 * Keywords: audit, log, history, events, security, compliance, filter, date range, export, csv, admin
 */
/**
 * Audit log: every change made in a workspace, newest first. The range switch picks the last 24 hours, 7 days or 30
 * days; Custom opens From and To date fields (a From after To is refused and the last good range stays). The person
 * and action dropdowns and the search box (target, IP or place) narrow it further. Each row opens to show exactly
 * what changed (before → after) with the place and request ID; the time header sorts. Refresh reloads through `load`
 * with a skeleton while it waits and an error with Retry if it fails. Export CSV saves the filtered events. Make it
 * the app's own: replace SAMPLE with the app's events and action names, and give `load` the real fetch.
 * Adapted from HyperUI (MIT License, Copyright (c) Mark Mead): its data tables, filters and pagination.
 */
/**
 * How to try it
 * - Press "7d" (last 7 days), then "Custom": two date fields open. Set From after To: the error says so and the list keeps the
 *   last good range.
 * - Pick Jordan Hale in Person, or "Role changed" in Action; type "203.0" in search. Clear filters brings everything back.
 * - Press the chevron on a row (or Enter on it): the row opens to its changes. Press Time to flip the order.
 * - Press Refresh: the sample's first try fails to show the error state; Retry loads.
 *
 * Dependencies: React (useEffect, useId, useMemo, useRef, useState), the library's Segmented, Select, TextField, Badge,
 * Avatar, Button and EmptyState ("./segmented-control", "./dropdowns-states", "./text-fields-states", "./badges-status",
 * "./avatars-variants", "./buttons-variants", "./empty-states") and its inline icon set ("./icons"). Nothing else: no
 * package to install and nothing fetched at run time. The styles are the library's own fl- classes in
 * templates/library/css/r2h-auditlog.css.
 */
import { Fragment, useId, useMemo, useRef, useState } from "react";
import { Avatar } from "./avatars-variants";
import { Badge, type BadgeTone } from "./badges-status";
import { Button } from "./buttons-variants";
import { Select } from "./dropdowns-states";
import { EmptyState } from "./empty-states";
import { Icon } from "./icons";
import { Segmented } from "./segmented-control";
import { TextField } from "./text-fields-states";

// ── p.audit-log: filter by date range, person and action; open a row for its changes. ──

export type AuditChange = { field: string; from: string; to: string };
export type AuditEvent = {
  id: string;
  /** ISO date and time. */
  at: string;
  actor: { name: string; email: string; src?: string };
  /** A key from `actions`. */
  action: string;
  /** What it was done to, in words: "Priya Shah", "Billing plan". */
  target: string;
  ip?: string;
  place?: string;
  requestId?: string;
  changes?: AuditChange[];
};
export type AuditAction = { label: string; tone?: BadgeTone };

export type AuditLogLabels = Partial<{
  refresh: string;
  export: string;
  range: string;
  day: string;
  week: string;
  month: string;
  custom: string;
  from: string;
  to: string;
  badRange: string;
  person: string;
  everyone: string;
  action: string;
  allActions: string;
  search: string;
  time: string;
  what: string;
  target: string;
  where: string;
  details: string;
  noChanges: string;
  request: string;
  count: string;
  noMatch: string;
  noMatchText: string;
  clear: string;
  failed: string;
  failedText: string;
  retry: string;
  previous: string;
  next: string;
  page: string;
}>;

export type AuditLogProps = {
  title: string;
  lede?: string;
  events: AuditEvent[];
  actions: Record<string, AuditAction>;
  /** "Now" for the range switch; the real time when left out. */
  now?: Date;
  pageSize?: number;
  /** Fetches the events again (Refresh and Retry). Without it Refresh is hidden. */
  load?: () => Promise<AuditEvent[]>;
  /** Takes over Export CSV; without it the piece saves a .csv file itself. */
  onExport?: (rows: AuditEvent[]) => void;
  labels?: AuditLogLabels;
};

type Range = "day" | "week" | "month" | "custom";
const DAY = 86400000;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const csvCell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export function AuditLog({ title, lede, events, actions, now: nowProp, pageSize = 10, load, onExport, labels = {} }: AuditLogProps) {
  const l = {
    refresh: "Refresh",
    export: "Export CSV",
    range: "Date range",
    day: "24h",
    week: "7d",
    month: "30d",
    custom: "Custom",
    from: "From",
    to: "To",
    badRange: "From must be on or before To.",
    person: "Person",
    everyone: "Everyone",
    action: "Action",
    allActions: "All actions",
    search: "Search target, IP or place",
    time: "Time",
    what: "Action",
    target: "Target",
    where: "Where",
    details: "Details",
    noChanges: "No field changes recorded.",
    request: "Request",
    count: "{n} events",
    noMatch: "No events match",
    noMatchText: "Try a wider date range or clear the filters.",
    clear: "Clear filters",
    failed: "Couldn't load the log",
    failedText: "Check your connection and try again.",
    retry: "Retry",
    previous: "Previous page",
    next: "Next page",
    page: "{from}–{to} of {total}",
    ...labels,
  };
  const id = useId();
  const now = useMemo(() => nowProp ?? new Date(), [nowProp]);
  const [list, setList] = useState(events);
  const [range, setRange] = useState<Range>("month");
  const [from, setFrom] = useState(ymd(new Date(now.getTime() - 30 * DAY)));
  const [to, setTo] = useState(ymd(now));
  const [goodRange, setGoodRange] = useState({ from, to });
  const [person, setPerson] = useState("");
  const [action, setAction] = useState("");
  const [query, setQuery] = useState("");
  const [newest, setNewest] = useState(true);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string[]>([]);
  const [state, setState] = useState<"ready" | "loading" | "error">("ready");
  const [status, setStatus] = useState("");
  const tableTop = useRef<HTMLDivElement>(null);
  const refreshBtn = useRef<HTMLButtonElement>(null);

  const badRange = range === "custom" && from && to && from > to;
  const people = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of list) seen.set(e.actor.email, e.actor.name);
    return [...seen].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [list]);

  const rows = useMemo(() => {
    let start = 0;
    let end = Infinity;
    if (range === "custom") {
      const r = badRange ? goodRange : { from, to };
      start = r.from ? new Date(`${r.from}T00:00`).getTime() : 0;
      end = r.to ? new Date(`${r.to}T23:59:59`).getTime() : Infinity;
    } else start = now.getTime() - (range === "day" ? 1 : range === "week" ? 7 : 30) * DAY;
    const q = query.trim().toLowerCase();
    return list
      .filter((e) => {
        const t = new Date(e.at).getTime();
        if (t < start || t > end) return false;
        if (person && e.actor.email !== person) return false;
        if (action && e.action !== action) return false;
        if (q && ![e.target, e.ip ?? "", e.place ?? ""].some((s) => s.toLowerCase().includes(q))) return false;
        return true;
      })
      .sort((a, b) => (newest ? b.at.localeCompare(a.at) : a.at.localeCompare(b.at)));
  }, [list, range, from, to, goodRange, badRange, person, action, query, newest, now]);

  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const at = Math.min(page, pages - 1);
  const shown = rows.slice(at * pageSize, at * pageSize + pageSize);
  const filtered = range !== "month" || person !== "" || action !== "" || query.trim() !== "";

  // Any filter change goes back to the first page and closes open rows.
  const refilter = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(0);
    setOpen([]);
  };
  const setDate = (which: "from" | "to", v: string) => {
    const next = which === "from" ? { from: v, to } : { from, to: v };
    if (which === "from") setFrom(v);
    else setTo(v);
    if (!next.from || !next.to || next.from <= next.to) setGoodRange(next);
    setPage(0);
  };
  const clear = () => {
    setRange("month");
    setPerson("");
    setAction("");
    setQuery("");
    setPage(0);
    setOpen([]);
  };
  const toggle = (eid: string) => setOpen((xs) => (xs.includes(eid) ? xs.filter((x) => x !== eid) : [...xs, eid]));
  const goPage = (p: number) => {
    setPage(p);
    setOpen([]);
    setStatus(`Page ${p + 1} of ${pages}.`);
    tableTop.current?.scrollIntoView({ block: "nearest" });
  };

  const refresh = async () => {
    if (!load) return;
    // Retry vanishes with the error state, so focus waits on Refresh instead of falling to the page.
    const fromRetry = document.activeElement?.closest(".fl-al-retry");
    setState("loading");
    setStatus("Loading the log…");
    try {
      const fresh = await load();
      setList(fresh);
      setState("ready");
      setStatus(`Log updated. ${fresh.length} events.`);
    } catch {
      setState("error");
      setStatus(l.failed);
    }
    if (fromRetry) window.setTimeout(() => refreshBtn.current?.focus(), 0);
  };

  const exportCsv = () => {
    if (onExport) return onExport(rows);
    const head = ["Time", "Person", "Email", "Action", "Target", "IP", "Place", "Request", "Changes"];
    const lines = rows.map((e) =>
      [e.at, e.actor.name, e.actor.email, actions[e.action]?.label ?? e.action, e.target, e.ip ?? "", e.place ?? "", e.requestId ?? "", (e.changes ?? []).map((c) => `${c.field}: ${c.from} -> ${c.to}`).join("; ")].map(csvCell).join(","),
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `audit-log-${ymd(now)}.csv`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setStatus(`Exported ${rows.length} events.`);
  };

  const dateFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  const fullFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" });

  return (
    <section className="fl-al" aria-labelledby={`${id}-title`} data-fl="p.audit-log">
      <div className="fl-al-head">
        <div className="fl-al-heading">
          <h2 id={`${id}-title`}>{title}</h2>
          {lede ? <p>{lede}</p> : null}
        </div>
        <div className="fl-al-headtools">
          {load ? (
            <Button ref={refreshBtn} variant="secondary" size={40} icon="refresh" busy={state === "loading"} onClick={refresh}>
              {l.refresh}
            </Button>
          ) : null}
          <Button variant="secondary" size={40} icon="download" disabled={state !== "ready" || rows.length === 0} onClick={exportCsv}>
            {l.export}
          </Button>
        </div>
      </div>

      <div className="fl-al-filters" role="group" aria-label="Filters">
        <Segmented
          size="sm"
          label={`${l.range}: last 24 hours, 7 days, 30 days or custom`}
          value={range}
          onChange={(v) => refilter(setRange)(v as Range)}
          options={[
            { value: "day", label: l.day },
            { value: "week", label: l.week },
            { value: "month", label: l.month },
            { value: "custom", label: l.custom },
          ]}
        />
        <label className="fl-al-pick">
          <span className="fl-sr">{l.person}</span>
          <Select value={person} onChange={(e) => refilter(setPerson)(e.target.value)} options={[{ value: "", label: l.everyone }, ...people]} />
        </label>
        <label className="fl-al-pick">
          <span className="fl-sr">{l.action}</span>
          <Select value={action} onChange={(e) => refilter(setAction)(e.target.value)} options={[{ value: "", label: l.allActions }, ...Object.entries(actions).map(([value, a]) => ({ value, label: a.label }))]} />
        </label>
        <label className="fl-al-search">
          <span className="fl-sr">{l.search}</span>
          <Icon name="search" />
          <TextField type="search" size={40} placeholder={l.search} value={query} onChange={(e) => refilter(setQuery)(e.target.value)} />
        </label>
      </div>

      <div className={`fl-al-custom${range === "custom" ? " is-open" : ""}`} inert={range !== "custom" || undefined}>
        <div className="fl-al-custom-inner">
          <div className="fl-al-dates">
            <div className="fl-al-field">
              <label htmlFor={`${id}-from`}>{l.from}</label>
              <TextField id={`${id}-from`} type="date" size={40} value={from} max={ymd(now)} invalid={Boolean(badRange)} aria-describedby={badRange ? `${id}-range` : undefined} onChange={(e) => setDate("from", e.target.value)} />
            </div>
            <div className="fl-al-field">
              <label htmlFor={`${id}-to`}>{l.to}</label>
              <TextField id={`${id}-to`} type="date" size={40} value={to} invalid={Boolean(badRange)} aria-describedby={badRange ? `${id}-range` : undefined} onChange={(e) => setDate("to", e.target.value)} />
            </div>
          </div>
          {badRange ? (
            <p id={`${id}-range`} className="fl-al-error" role="alert">
              <Icon name="alert" />
              {l.badRange}
            </p>
          ) : null}
        </div>
      </div>

      <div className="fl-al-bar" ref={tableTop}>
        <span>{state === "ready" ? l.count.replace("{n}", String(rows.length)) : " "}</span>
        {filtered && state === "ready" ? (
          <Button variant="tertiary" size={32} onClick={clear}>
            {l.clear}
          </Button>
        ) : null}
      </div>

      {state === "error" ? (
        <EmptyState variant="error" className="fl-al-retry" title={l.failed} action={<Button variant="secondary" size={40} icon="refresh" onClick={refresh}>{l.retry}</Button>}>
          {l.failedText}
        </EmptyState>
      ) : state === "ready" && rows.length === 0 ? (
        <EmptyState variant="no-results" title={l.noMatch} action={filtered ? <Button variant="secondary" size={40} onClick={clear}>{l.clear}</Button> : undefined}>
          {l.noMatchText}
        </EmptyState>
      ) : (
        <div className="fl-al-scroll" aria-busy={state === "loading" || undefined}>
          <table className="fl-al-table">
            <caption className="fl-sr">{title}</caption>
            <thead>
              <tr>
                <th scope="col" aria-sort={newest ? "descending" : "ascending"}>
                  <button type="button" className="fl-al-sort" onClick={() => { setNewest((n) => !n); setPage(0); setStatus(newest ? "Oldest first." : "Newest first."); }}>
                    {l.time}
                    <Icon name="chevron-down" />
                  </button>
                </th>
                <th scope="col">{l.person}</th>
                <th scope="col">{l.what}</th>
                <th scope="col">{l.target}</th>
                <th scope="col">{l.where}</th>
                <th scope="col">
                  <span className="fl-sr">{l.details}</span>
                </th>
              </tr>
            </thead>
            <tbody className={newest ? "" : "is-oldest"}>
              {state === "loading"
                ? Array.from({ length: Math.min(pageSize, 6) }, (_, i) => (
                    <tr key={`sk-${i}`} className="fl-al-skel" aria-hidden="true">
                      {Array.from({ length: 6 }, (_, j) => (
                        <td key={j}>
                          <span />
                        </td>
                      ))}
                    </tr>
                  ))
                : shown.map((e, i) => {
                    const a = actions[e.action] ?? { label: e.action, tone: "neutral" as const };
                    const isOpen = open.includes(e.id);
                    const when = new Date(e.at);
                    return (
                      <Fragment key={e.id}>
                        <tr className={`fl-al-row${isOpen ? " is-open" : ""}`} style={{ ["--i" as string]: Math.min(i, 5) }}>
                          <td data-label={l.time} className="fl-al-time">
                            <time dateTime={e.at} title={fullFmt.format(when)}>
                              <strong>{dateFmt.format(when)}</strong>
                              <span>{timeFmt.format(when)}</span>
                            </time>
                          </td>
                          <th scope="row" data-label={l.person}>
                            <span className="fl-al-who">
                              <Avatar name={e.actor.name} src={e.actor.src} size={32} decorative />
                              <span>
                                <strong>{e.actor.name}</strong>
                                <span>{e.actor.email}</span>
                              </span>
                            </span>
                          </th>
                          <td data-label={l.what}>
                            <Badge tone={a.tone ?? "neutral"}>{a.label}</Badge>
                          </td>
                          <td data-label={l.target} className="fl-al-target">
                            {e.target}
                          </td>
                          <td data-label={l.where} className="fl-al-muted">
                            {e.place ?? "—"}
                            {e.ip ? <span className="fl-al-ip">{e.ip}</span> : null}
                          </td>
                          <td className="fl-al-toggle">
                            <button type="button" className="fl-al-chev" aria-expanded={isOpen} aria-controls={`${id}-d-${e.id}`} aria-label={`${l.details}: ${a.label}, ${e.target}`} onClick={() => toggle(e.id)}>
                              <Icon name="chevron-down" />
                            </button>
                          </td>
                        </tr>
                        <tr className={`fl-al-detail${isOpen ? " is-open" : ""}`}>
                          <td colSpan={6}>
                            <div className="fl-al-reveal" id={`${id}-d-${e.id}`} inert={!isOpen || undefined}>
                              <div className="fl-al-reveal-inner">
                                {e.changes?.length ? (
                                  <dl className="fl-al-changes">
                                    {e.changes.map((c) => (
                                      <div key={c.field}>
                                        <dt>{c.field}</dt>
                                        <dd>
                                          <del>{c.from || "—"}</del>
                                          <Icon name="arrow" />
                                          <ins>{c.to || "—"}</ins>
                                        </dd>
                                      </div>
                                    ))}
                                  </dl>
                                ) : (
                                  <p className="fl-al-muted">{l.noChanges}</p>
                                )}
                                <p className="fl-al-meta">
                                  <span>{fullFmt.format(when)}</span>
                                  {e.ip ? <span>IP {e.ip}</span> : null}
                                  {e.requestId ? (
                                    <span>
                                      {l.request} <code>{e.requestId}</code>
                                    </span>
                                  ) : null}
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
            </tbody>
          </table>
        </div>
      )}

      {state === "ready" && rows.length > pageSize ? (
        <nav className="fl-al-pages" aria-label="Pages">
          <Button variant="secondary" size={32} icon="chevron-left" iconOnly disabled={at === 0} onClick={() => goPage(at - 1)}>
            {l.previous}
          </Button>
          <span>
            {l.page
              .replace("{from}", String(at * pageSize + 1))
              .replace("{to}", String(Math.min(rows.length, at * pageSize + pageSize)))
              .replace("{total}", String(rows.length))}
          </span>
          <Button variant="secondary" size={32} icon="chevron-right" iconOnly disabled={at >= pages - 1} onClick={() => goPage(at + 1)}>
            {l.next}
          </Button>
        </nav>
      ) : null}

      <p className="fl-sr" role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}

const NOW = new Date("2026-10-21T10:00:00");
const PEOPLE = {
  jordan: { name: "Jordan Hale", email: "jordan@northlight.studio" },
  ana: { name: "Ana Ruiz", email: "ana@northlight.studio" },
  marcus: { name: "Marcus Lee", email: "marcus@northlight.studio" },
  priya: { name: "Priya Shah", email: "priya@northlight.studio" },
};
// [minutes ago, who, action, target, place, ip, changes]
const RAW: Array<[number, keyof typeof PEOPLE, string, string, string, string, AuditChange[]?]> = [
  [14, "ana", "member.role", "Marcus Lee", "Lisbon, PT", "185.92.14.6", [{ field: "Role", from: "Viewer", to: "Editor" }]],
  [52, "jordan", "auth.signin", "Jordan Hale", "Portland, US", "203.0.113.24"],
  [130, "priya", "project.update", "Harbor rebrand", "Austin, US", "198.51.100.7", [{ field: "Due date", from: "Nov 4", to: "Nov 12" }, { field: "Status", from: "Draft", to: "In review" }]],
  [260, "jordan", "billing.plan", "Workspace plan", "Portland, US", "203.0.113.24", [{ field: "Plan", from: "Team", to: "Business" }, { field: "Seats", from: "8", to: "12" }]],
  [700, "ana", "apikey.create", "Zapier sync", "Lisbon, PT", "185.92.14.6"],
  [1300, "marcus", "file.delete", "moodboard-v2.fig", "Toronto, CA", "192.0.2.41"],
  [1500, "jordan", "member.invite", "lena.m@northlight.studio", "Portland, US", "203.0.113.24", [{ field: "Role", from: "", to: "Editor" }]],
  [2100, "priya", "auth.failed", "Priya Shah", "Unknown", "45.83.12.200"],
  [2900, "ana", "settings.update", "Single sign-on", "Lisbon, PT", "185.92.14.6", [{ field: "Required", from: "Off", to: "On" }]],
  [3600, "marcus", "project.update", "Spring catalog", "Toronto, CA", "192.0.2.41", [{ field: "Owner", from: "Marcus Lee", to: "Priya Shah" }]],
  [4300, "jordan", "member.remove", "Tom Becker", "Portland, US", "203.0.113.24"],
  [5200, "ana", "apikey.revoke", "Old CRM import", "Lisbon, PT", "185.92.14.6"],
  [6100, "priya", "auth.signin", "Priya Shah", "Austin, US", "198.51.100.7"],
  [7400, "marcus", "file.delete", "draft-final-FINAL.pdf", "Toronto, CA", "192.0.2.41"],
  [8800, "jordan", "settings.update", "Workspace name", "Portland, US", "203.0.113.24", [{ field: "Name", from: "Northlight", to: "Northlight Studio" }]],
  [11000, "ana", "member.role", "Priya Shah", "Lisbon, PT", "185.92.14.6", [{ field: "Role", from: "Viewer", to: "Editor" }]],
  [14000, "priya", "project.update", "Harbor rebrand", "Austin, US", "198.51.100.7", [{ field: "Budget", from: "$18,000", to: "$21,500" }]],
  [17500, "jordan", "billing.card", "Visa ending 4242", "Portland, US", "203.0.113.24", [{ field: "Card", from: "Visa •• 1881", to: "Visa •• 4242" }]],
  [21000, "marcus", "auth.signin", "Marcus Lee", "Toronto, CA", "192.0.2.41"],
  [26000, "ana", "member.invite", "marcus@northlight.studio", "Lisbon, PT", "185.92.14.6", [{ field: "Role", from: "", to: "Viewer" }]],
  [31000, "jordan", "apikey.create", "Reporting dashboard", "Portland, US", "203.0.113.24"],
  [36000, "priya", "file.delete", "old-brief.docx", "Austin, US", "198.51.100.7"],
  [40000, "jordan", "settings.update", "Two-step sign-in", "Portland, US", "203.0.113.24", [{ field: "Required", from: "Off", to: "On" }]],
  [52000, "ana", "billing.plan", "Workspace plan", "Lisbon, PT", "185.92.14.6", [{ field: "Plan", from: "Starter", to: "Team" }]],
];
// flowcode:sample
const SAMPLE = {
  title: "Audit log",
  lede: "Everything people changed in Northlight Studio.",
  now: NOW,
  pageSize: 8,
  actions: {
    "auth.signin": { label: "Signed in", tone: "neutral" },
    "auth.failed": { label: "Sign-in failed", tone: "danger" },
    "member.invite": { label: "Invited", tone: "info" },
    "member.role": { label: "Role changed", tone: "info" },
    "member.remove": { label: "Removed", tone: "danger" },
    "project.update": { label: "Project edited", tone: "neutral" },
    "file.delete": { label: "File deleted", tone: "warning" },
    "settings.update": { label: "Setting changed", tone: "warning" },
    "billing.plan": { label: "Plan changed", tone: "success" },
    "billing.card": { label: "Card updated", tone: "success" },
    "apikey.create": { label: "Key created", tone: "info" },
    "apikey.revoke": { label: "Key revoked", tone: "danger" },
  } as Record<string, AuditAction>,
  events: RAW.map(([mins, who, action, target, place, ip, changes], i) => ({
    id: `ev${i + 1}`,
    at: new Date(NOW.getTime() - mins * 60000).toISOString(),
    actor: PEOPLE[who],
    action,
    target,
    place,
    ip,
    requestId: `req_${(48213 + i * 977).toString(36)}`,
    changes,
  })) as AuditEvent[],
};

export default function AuditLogSheet() {
  const tries = useRef(0);
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap">
        <AuditLog
          {...SAMPLE}
          load={async () => {
            await new Promise((r) => window.setTimeout(r, 900));
            tries.current += 1;
            // The sample's first refresh fails so the error state can be tried; Retry then works.
            if (tries.current === 1) throw new Error("Network");
            return SAMPLE.events;
          }}
        />
      </div>
    </section>
  );
}
