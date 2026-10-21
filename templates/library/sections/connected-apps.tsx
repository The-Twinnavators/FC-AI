/** @flowcode-library connected-apps · Connected apps (Tables and lists)
 * Catalog ID: p.connected-apps (pattern)
 * Function: Connected apps (p.connected-apps): the outside services an account can link, searchable and filtered to All, Connected or Available; Connect shows a working state and an error with Retry, and a connected app folds open to show the linked account, when it was linked and last synced, what it may do, an automatic sync switch, Sync now and Disconnect (confirmed first).
 * Use it as: import { ConnectedApps } from "./connected-apps"; <ConnectedApps title lede? apps={[{ id, name, category, text, tone?: "a"|"b"|"c"|"d"|"e", connected?: { account, since: "2026-05-02", scopes: ["Read your calendar"], lastSync?: "2026-10-21T09:40", autoSync?: true } | null }]} now?={new Date()} connect?={async (id) => ({ account, scopes })} sync?={async (id) => void} onDisconnect?={(id) => ...} onChange?={(apps) => ...} note? labels?={{ search, all, connected, available, connect, ... }} />
 * Built from: c.text-field.outlined, c.segmented.segmented, c.badge.status, c.button.primary, c.button.secondary, c.button.tertiary, c.switch, c.modal.danger, c.empty-state.no-results
 * Look: A white card with the title and a line of help, a search box beside an All / Connected / Available switch with counts, then rows of apps: a rounded tile with the app's initials, the name with a small category chip, a muted sentence, and Connect or a green Connected pill with Details at the right; Details slides open a sunken panel of label and value pairs, a ticked list of permissions, a sync switch, Sync now and Disconnect. A tinted note about trusting apps closes the card.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-secondary --color-success --color-warning --color-info --color-danger --space-1 --space-2 --space-3 --space-4 --space-5 --radius-md --radius-lg --text-xs --text-sm --text-lg --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --easing --enter-distance --stagger
 * Use cases: integrations settings; connected apps; third-party apps; linked accounts; app connections; OAuth apps; workspace integrations; account settings
 * Jobs to be done: connect another app to my account; see what a connected app can do; sync an app now; turn off automatic sync; disconnect an app I no longer trust
 * Keywords: integrations, connected apps, third-party, oauth, linked accounts, connect, disconnect, sync, permissions, scopes
 */
/**
 * Connected apps: every service the account can link, with search and an All / Connected / Available switch. Connect
 * waits on the app's own sign-in (made up here) and shows an error with Retry when it fails. A connected app's Details
 * fold open (the content is inert while closed) to show the account, dates, permissions, a sync switch, Sync now and
 * Disconnect, which asks first. Make it the app's own: replace SAMPLE with the services the product supports, start
 * the provider's sign-in in `connect`, and save changes through onChange and onDisconnect.
 * Adapted from Creative Tim UI (MIT, Copyright (c) 2025 Creative Tim): its account integrations block.
 */
/**
 * How to try it
 * - Type "cal" in the search box: only Google Calendar stays. Type "zzz": the empty state offers Clear search.
 * - Switch to Connected, then Available: the counts match the rows.
 * - Press Connect on Dropbox: it fails the first time, so press Retry; the row turns Connected.
 * - Press Details on Slack: the panel slides open. Toggle Sync automatically, press Sync now (the time updates), then
 *   Disconnect and confirm: the row goes back to Connect and focus lands on that button.
 *
 * Dependencies: React (useEffect, useId, useMemo, useRef, useState), the library's Button, TextField, Segmented,
 * Switch, Badge, Modal and EmptyState ("./buttons-variants", "./text-fields-states", "./segmented-control",
 * "./switches-states", "./badges-status", "./modals-dialogs", "./empty-states") and its inline icon set ("./icons").
 * Nothing else: no package and nothing fetched. The styles are the library's own fl- classes in
 * templates/library/css/r3c-connected-apps.css.
 */
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { EmptyState } from "./empty-states";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { Segmented } from "./segmented-control";
import { Switch } from "./switches-states";
import { TextField } from "./text-fields-states";

// ── p.connected-apps: connect, look inside, sync and disconnect outside services. ──

export type AppLink = { account: string; since: string; scopes: string[]; lastSync?: string; autoSync?: boolean };

export type ConnectedApp = {
  id: string;
  name: string;
  category: string;
  text: string;
  /** Which of the five tile tints; "a" when left out. */
  tone?: "a" | "b" | "c" | "d" | "e";
  connected?: AppLink | null;
};

export type ConnectedAppsLabels = Partial<{
  search: string;
  filter: string;
  all: string;
  connected: string;
  available: string;
  connect: string;
  connecting: string;
  retry: string;
  details: string;
  account: string;
  since: string;
  lastSync: string;
  never: string;
  scopes: string;
  autoSync: string;
  syncNow: string;
  syncing: string;
  disconnect: string;
  noResults: string;
  noResultsText: string;
  clear: string;
  failed: string;
}>;

export type ConnectedAppsProps = {
  title: string;
  lede?: string;
  apps: ConnectedApp[];
  /** "Now" for the last-synced words; the real time when left out. */
  now?: Date;
  /** Runs the provider's sign-in and resolves with what was linked; throw to show the error. Made up when left out. */
  connect?: (id: string) => Promise<{ account: string; scopes: string[] }>;
  /** Syncs one app now. Waits a moment when left out. */
  sync?: (id: string) => Promise<void>;
  onDisconnect?: (id: string) => void;
  onChange?: (apps: ConnectedApp[]) => void;
  /** A closing note about trusting apps; left out, none is shown. */
  note?: { title: string; text: string };
  labels?: ConnectedAppsLabels;
};

type Filter = "all" | "connected" | "available";
const wait = (t: number) => new Promise((r) => window.setTimeout(r, t));
const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export function ConnectedApps({ title, lede, apps, now: nowProp, connect, sync, onDisconnect, onChange, note, labels = {} }: ConnectedAppsProps) {
  const l = {
    search: "Search apps",
    filter: "Show",
    all: "All",
    connected: "Connected",
    available: "Available",
    connect: "Connect",
    connecting: "Connecting…",
    retry: "Retry",
    details: "Details",
    account: "Account",
    since: "Connected",
    lastSync: "Last synced",
    never: "Not yet",
    scopes: "It can",
    autoSync: "Sync automatically",
    syncNow: "Sync now",
    syncing: "Syncing…",
    disconnect: "Disconnect",
    noResults: "No apps match",
    noResultsText: "Try another name or show all apps.",
    clear: "Clear search",
    failed: "Couldn't reach {name}. Try again.",
    ...labels,
  };
  const id = useId();
  const [list, setList] = useState(apps);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string[]>([]);
  const [busy, setBusy] = useState<Record<string, "connect" | "sync" | undefined>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [leaving, setLeaving] = useState<ConnectedApp | null>(null);
  const [status, setStatus] = useState("");
  const [entering, setEntering] = useState(true);
  const [clock, setClock] = useState(() => nowProp ?? new Date());

  useEffect(() => {
    const t = window.setTimeout(() => setEntering(false), 900);
    return () => window.clearTimeout(t);
  }, []);

  const commit = (next: ConnectedApp[]) => {
    setList(next);
    onChange?.(next);
  };
  const patch = (appId: string, fn: (a: ConnectedApp) => ConnectedApp) => commit(list.map((a) => (a.id === appId ? fn(a) : a)));

  const counts = { all: list.length, connected: list.filter((a) => a.connected).length, available: list.filter((a) => !a.connected).length };
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((a) => (filter === "all" ? true : filter === "connected" ? a.connected : !a.connected) && (!q || `${a.name} ${a.category}`.toLowerCase().includes(q)));
  }, [list, query, filter]);

  const day = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
  const fmt = (iso: string) => day.format(new Date(iso.length === 10 ? `${iso}T12:00` : iso));
  const ago = (iso?: string) => {
    if (!iso) return l.never;
    const mins = Math.round((clock.getTime() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
    return fmt(iso);
  };

  // A busy button is disabled, which drops focus; once the work ends, focus goes to the control that now stands there.
  const refocus = (suffix: string) => window.setTimeout(() => document.getElementById(`${id}-${suffix}`)?.focus(), 30);

  const doConnect = async (a: ConnectedApp) => {
    setBusy((b) => ({ ...b, [a.id]: "connect" }));
    setErrors((e) => ({ ...e, [a.id]: "" }));
    setStatus(`Connecting ${a.name}…`);
    try {
      const got = connect ? await connect(a.id) : await wait(900).then(() => ({ account: "you@example.com", scopes: ["See your basic profile"] }));
      const today = (nowProp ?? new Date()).toISOString().slice(0, 10);
      setList((xs) => {
        const next = xs.map((x) => (x.id === a.id ? { ...x, connected: { ...got, since: today, autoSync: true } } : x));
        onChange?.(next);
        return next;
      });
      setStatus(`${a.name} connected.`);
      refocus(`${a.id}-more`);
    } catch {
      const msg = l.failed.replace("{name}", a.name);
      setErrors((e) => ({ ...e, [a.id]: msg }));
      setStatus(msg);
      refocus(`${a.id}-connect`);
    } finally {
      setBusy((b) => ({ ...b, [a.id]: undefined }));
    }
  };

  const doSync = async (a: ConnectedApp) => {
    setBusy((b) => ({ ...b, [a.id]: "sync" }));
    try {
      await (sync ? sync(a.id) : wait(800));
      const t = new Date(clock.getTime() + 1000);
      setClock(t);
      setList((xs) => {
        const next = xs.map((x) => (x.id === a.id && x.connected ? { ...x, connected: { ...x.connected, lastSync: t.toISOString() } } : x));
        onChange?.(next);
        return next;
      });
      setStatus(`${a.name} synced.`);
    } catch {
      setStatus(`Couldn't sync ${a.name}. Try again.`);
    } finally {
      setBusy((b) => ({ ...b, [a.id]: undefined }));
      refocus(`${a.id}-sync`);
    }
  };

  const disconnect = (a: ConnectedApp) => {
    patch(a.id, (x) => ({ ...x, connected: null }));
    setOpen((o) => o.filter((x) => x !== a.id));
    setStatus(`${a.name} disconnected.`);
    onDisconnect?.(a.id);
    // The Details button goes away with the connection; focus waits on the row's Connect button.
    window.setTimeout(() => document.getElementById(`${id}-${a.id}-connect`)?.focus(), 0);
  };

  const toggle = (appId: string) => setOpen((o) => (o.includes(appId) ? o.filter((x) => x !== appId) : [...o, appId]));

  return (
    <section className="fl-capp" aria-labelledby={`${id}-title`} data-fl="p.connected-apps">
      <header className="fl-capp-head">
        <h2 id={`${id}-title`}>{title}</h2>
        {lede ? <p>{lede}</p> : null}
      </header>

      <div className="fl-capp-tools">
        <span className="fl-capp-search">
          <Icon name="search" />
          <TextField id={`${id}-q`} type="search" size={40} value={query} placeholder={l.search} aria-label={l.search} aria-controls={`${id}-list`} onChange={(e) => setQuery(e.currentTarget.value)} />
        </span>
        <Segmented
          size="sm"
          label={l.filter}
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
          options={[
            { value: "all", label: `${l.all} ${counts.all}` },
            { value: "connected", label: `${l.connected} ${counts.connected}` },
            { value: "available", label: `${l.available} ${counts.available}` },
          ]}
        />
      </div>
      <p className="fl-sr" role="status" aria-live="polite">
        {shown.length === 1 ? "1 app" : `${shown.length} apps`}
      </p>

      {shown.length === 0 ? (
        <div className="fl-capp-empty">
          <EmptyState
            variant="no-results"
            title={l.noResults}
            action={
              <Button
                variant="secondary"
                size={40}
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                  window.setTimeout(() => document.getElementById(`${id}-q`)?.focus(), 0);
                }}
              >
                {l.clear}
              </Button>
            }
          >
            {l.noResultsText}
          </EmptyState>
        </div>
      ) : (
        <ul className="fl-capp-list" id={`${id}-list`} role="list">
          {shown.map((a, i) => {
            const link = a.connected;
            const isOpen = Boolean(link) && open.includes(a.id);
            const err = errors[a.id];
            const working = busy[a.id];
            return (
              <li key={a.id} className={["fl-capp-row", entering ? "is-entering" : "", isOpen ? "is-open" : "", link ? "is-linked" : ""].filter(Boolean).join(" ")} style={{ "--i": i } as CSSProperties}>
                <div className="fl-capp-main">
                  <span className="fl-capp-tile" data-tone={a.tone ?? "a"} aria-hidden="true">
                    {initials(a.name)}
                  </span>
                  <div className="fl-capp-copy">
                    <h3 className="fl-capp-name">
                      {a.name}
                      <span className="fl-capp-cat">{a.category}</span>
                    </h3>
                    <p className="fl-capp-text">{a.text}</p>
                    {err ? (
                      <p className="fl-capp-error" role="alert">
                        <Icon name="alert" />
                        {err}
                      </p>
                    ) : null}
                  </div>
                  <div className="fl-capp-actions">
                    {link ? (
                      <>
                        <Badge tone="success" led>
                          {l.connected}
                        </Badge>
                        <Button id={`${id}-${a.id}-more`} variant="tertiary" size={32} icon="chevron-down" iconAt="end" className="fl-capp-more" aria-expanded={isOpen} aria-controls={`${id}-${a.id}-panel`} aria-label={`${l.details}, ${a.name}`} onClick={() => toggle(a.id)}>
                          {l.details}
                        </Button>
                      </>
                    ) : (
                      <Button id={`${id}-${a.id}-connect`} variant={err ? "secondary" : "primary"} size={32} icon={err ? "refresh" : "link"} busy={working === "connect"} aria-label={`${err ? l.retry : l.connect} ${a.name}`} onClick={() => void doConnect(a)}>
                        {working === "connect" ? l.connecting : err ? l.retry : l.connect}
                      </Button>
                    )}
                  </div>
                </div>
                {link ? (
                  <div className="fl-capp-panel" id={`${id}-${a.id}-panel`} inert={!isOpen || undefined}>
                    <div className="fl-capp-clip">
                      <div className="fl-capp-body">
                        <dl className="fl-capp-facts">
                          <div>
                            <dt>{l.account}</dt>
                            <dd>{link.account}</dd>
                          </div>
                          <div>
                            <dt>{l.since}</dt>
                            <dd>{fmt(link.since)}</dd>
                          </div>
                          <div>
                            <dt>{l.lastSync}</dt>
                            <dd>{ago(link.lastSync)}</dd>
                          </div>
                        </dl>
                        <div className="fl-capp-scopes">
                          <p className="fl-capp-label">{l.scopes}</p>
                          <ul role="list">
                            {link.scopes.map((s) => (
                              <li key={s}>
                                <Icon name="check" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="fl-capp-foot">
                          <label className="fl-capp-switch">
                            <Switch
                              size={20}
                              on={Boolean(link.autoSync)}
                              label={`${l.autoSync}, ${a.name}`}
                              onToggle={(next) => {
                                patch(a.id, (x) => (x.connected ? { ...x, connected: { ...x.connected, autoSync: next } } : x));
                                setStatus(`${a.name}: automatic sync ${next ? "on" : "off"}.`);
                              }}
                            />
                            <span aria-hidden="true">{l.autoSync}</span>
                          </label>
                          <div className="fl-capp-btns">
                            <Button id={`${id}-${a.id}-sync`} variant="secondary" size={32} icon="refresh" busy={working === "sync"} aria-label={`${l.syncNow}, ${a.name}`} onClick={() => void doSync(a)}>
                              {working === "sync" ? l.syncing : l.syncNow}
                            </Button>
                            <Button variant="destructive" size={32} aria-label={`${l.disconnect} ${a.name}`} onClick={() => setLeaving(a)}>
                              {l.disconnect}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {note ? (
        <aside className="fl-capp-note">
          <Icon name="shield" />
          <div>
            <p className="fl-capp-label">{note.title}</p>
            <p>{note.text}</p>
          </div>
        </aside>
      ) : null}

      <p className="fl-capp-status" role="status" aria-live="polite">
        {status}
      </p>

      {leaving ? (
        <Modal
          variant="danger"
          icon="link"
          title={`Disconnect ${leaving.name}?`}
          description={`${leaving.name} stops syncing and loses access right away. You can connect it again later.`}
          confirmLabel={l.disconnect}
          onConfirm={() => disconnect(leaving)}
          onClose={() => setLeaving(null)}
        />
      ) : null}
    </section>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Connected apps",
  lede: "Link the tools your team already uses. You can disconnect any of them at any time.",
  now: new Date("2026-10-21T10:00:00"),
  note: { title: "Only connect apps you trust", text: "A connected app can do what its permissions say until you disconnect it. Review this list now and then." },
  apps: [
    { id: "slack", name: "Slack", category: "Chat", tone: "b", text: "Post project updates and approvals to a channel.", connected: { account: "northlight.slack.com", since: "2026-05-02", lastSync: "2026-10-21T09:42:00", autoSync: true, scopes: ["Post messages to #projects", "See channel names", "See your basic profile"] } },
    { id: "gcal", name: "Google Calendar", category: "Calendar", tone: "c", text: "Show shoots and deadlines on your calendar.", connected: { account: "ana@northlight.example", since: "2026-07-18", lastSync: "2026-10-20T16:05:00", autoSync: false, scopes: ["See and edit events on one calendar"] } },
    { id: "dropbox", name: "Dropbox", category: "Files", tone: "a", text: "Attach files from Dropbox to any project.", connected: null },
    { id: "github", name: "GitHub", category: "Development", tone: "e", text: "Link pull requests and issues to tasks.", connected: null },
    { id: "figma", name: "Figma", category: "Design", tone: "d", text: "Preview design files inside comments.", connected: null },
  ] as ConnectedApp[],
};

export default function ConnectedAppsSheet() {
  const accounts: Record<string, { account: string; scopes: string[] }> = {
    dropbox: { account: "ana@northlight.example", scopes: ["See files you pick", "See your basic profile"] },
    github: { account: "northlight-studio", scopes: ["See repositories", "See pull requests and issues"] },
    figma: { account: "ana@northlight.example", scopes: ["View files shared with you"] },
  };
  const failed = useRef(false);
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap fl-wrap--narrow">
        <ConnectedApps
          {...SAMPLE}
          connect={async (appId) => {
            await wait(900);
            // Dropbox fails the first time, so the error and Retry can be seen.
            if (appId === "dropbox" && !failed.current) {
              failed.current = true;
              throw new Error("Timed out");
            }
            return accounts[appId] ?? { account: "you@example.com", scopes: ["See your basic profile"] };
          }}
        />
      </div>
    </section>
  );
}
