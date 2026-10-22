/** @flowcode-library app-frame · App frame: rail, top bar, roles, notifications (Navigation)
 * Catalog ID: p.app-frame (pattern)
 * Function: The app frame (p.app-frame): the shell of a complete web app, with the whole navigation in groups, breadcrumbs, search to any page, the role switcher, notifications from real changes and a clear page for what the prototype doesn't build. Built on the app data layer: pass the app's store (createStore from ./app-data with the app's schema and seed) and an entity key.
 * Use it as: import { AppFrame } from "./app-frame"; <AppFrame product="Ledgerline" nav={[{ label: "Workspace", items: [{ id: "overview", label: "Overview", icon: "home" }, { id: "contracts", label: "Contracts", icon: "folder", badge: 4 }, { id: "vendors", label: "Vendors", available: false }] }]} current={screen} onNavigate={go} store={store} user={{ name: "Ana Reyes" }} env?="DEV" crumbs? actions?>{page}</AppFrame>  // available:false destinations show a built-in "Not in this prototype" page
 * Built from: c.button, c.search.bar
 * Look: A full-height app: a grouped left rail (product mark, collapsible group headings, icon + label items with counts, the current one tinted) that folds to an icon strip or becomes a drawer on phones, and a top bar with breadcrumbs, an environment badge, a Go to… search, the role switcher, a notifications bell with a panel of recent activity, and the user.
 * Tokens: --color-surface --color-surface-sunken --color-bg --header-bg --color-border --color-text --color-text-muted --color-accent --radius-md --pill-radius --surface-shadow-overlay --duration-base --focus-ring
 * Use cases: admin app; internal tool; operations console; SaaS app shell; back office; dashboard app; enterprise app
 * Jobs to be done: get to any part of the app; see where I am; switch the role I am acting as; see what changed recently
 * Keywords: app shell, app frame, sidebar, left rail, navigation, top bar, breadcrumbs, role switcher, notifications, admin app, internal tool
 */
/**
 * App frame: the shell of a complete enterprise web app. A grouped left rail holds every destination (groups fold away
 * and remember it; the whole rail folds to an icon strip with names as tooltips), a top bar carries the breadcrumbs, an
 * environment badge, a search that jumps to any destination, the role switcher, the notifications bell with a panel of
 * the latest activity, and the signed-in person. The page renders in the main area, the only part that scrolls.
 * Destinations the prototype doesn't build open a clear "Not in this prototype" page with a way back. On a phone the
 * rail becomes a drawer opened from the top bar. It reads the app's store (./app-data) for the roles and the activity,
 * and puts the toasts on the page.
 *
 * Written for FlowCode. Make it the app's own: replace SAMPLE_NAV with the app's real groups and destinations (mark the
 * ones the prototype doesn't build with available: false), pass the app's store, product name and person, and render
 * each destination's screen as the children.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { StatusChip, Toaster, toast, useActivity, useRecords, useStore, type ActivityItem, type AppStore } from "./app-data";
import { sampleStore } from "./app-sample";

export type NavItem = { id: string; label: string; icon?: string; badge?: number; /** false: not built in this prototype (default true). */ available?: boolean };
export type NavGroup = { label: string; items: NavItem[] };

export interface AppFrameProps {
  product: string;
  /** A logo in place of the product's first letter. */
  logo?: ReactNode;
  nav: NavGroup[];
  /** The id of the destination on screen. */
  current: string;
  onNavigate: (id: string) => void;
  /** The breadcrumbs; "<group> / <item>" from the nav when left out. */
  crumbs?: string[];
  /** The app's store: the role switcher and the notifications read it. Both are hidden without one. */
  store?: AppStore;
  user?: { name: string; role?: string };
  /** A badge naming the environment, e.g. "DEV". */
  env?: string;
  children?: ReactNode;
  /** Extra controls in the top bar, before the bell. */
  actions?: ReactNode;
}

// ── Small helpers ──

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* not kept; it still applies on this page */
  }
};
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
const ago = (iso: string) => {
  const s = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (Math.abs(s) < 60) return rtf.format(s, "second");
  if (Math.abs(s) < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (Math.abs(s) < 86400) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86400), "day");
};
const isOn = (i: NavItem) => i.available !== false;
const focusables = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input, select, [tabindex]:not([tabindex='-1'])")].filter((el) => el.offsetParent !== null);

// ── The frame ──

export function AppFrame({ product, logo, nav, current, onNavigate, crumbs, store, user, env, children, actions }: AppFrameProps) {
  const uid = useId().replace(/:/g, "");
  const key = `fl-af:${slug(product)}`;
  const frameRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);

  const all = useMemo(() => nav.flatMap((g) => g.items.map((item) => ({ item, group: g.label }))), [nav]);
  const here = all.find((x) => x.item.id === current);
  const firstOn = all.find((x) => isOn(x.item))?.item;

  // Groups folded away, and the rail as an icon strip: both remembered per product.
  const [closed, setClosed] = useState<string[]>(() => {
    try {
      const v = JSON.parse(read(`${key}:closed`) ?? "[]");
      return Array.isArray(v) ? v.map(String) : [];
    } catch {
      return [];
    }
  });
  const [icons, setIcons] = useState(() => read(`${key}:icons`) === "1");
  useEffect(() => write(`${key}:closed`, JSON.stringify(closed)), [key, closed]);
  useEffect(() => write(`${key}:icons`, icons ? "1" : "0"), [key, icons]);
  const toggleGroup = (label: string) => setClosed((c) => (c.includes(label) ? c.filter((x) => x !== label) : [...c, label]));

  // The phone drawer: focus goes in, Tab stays in, Escape or the scrim closes it and focus goes back to the menu button.
  const [drawer, setDrawer] = useState(false);
  const closeDrawer = useCallback(() => {
    setDrawer(false);
    menuRef.current?.focus();
  }, []);
  useEffect(() => {
    if (!drawer) return;
    const t = window.setTimeout(() => {
      const rail = railRef.current;
      (rail?.querySelector<HTMLElement>('[aria-current="page"]') ?? (rail ? focusables(rail)[0] : undefined))?.focus();
    }, 30);
    return () => window.clearTimeout(t);
  }, [drawer]);
  const onRailKey = (e: ReactKeyboardEvent) => {
    if (!drawer) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeDrawer();
    } else if (e.key === "Tab" && railRef.current) {
      const list = focusables(railRef.current);
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  };

  const go = (id: string) => {
    onNavigate(id);
    if (drawer) closeDrawer();
  };

  // Tooltips for the icon strip (drawn outside the scrolling list so they aren't clipped).
  const [tip, setTip] = useState<{ text: string; top: number; left: number } | null>(null);
  const showTip = (el: HTMLElement, text: string) => {
    const frame = frameRef.current;
    if (!icons || !frame || drawer) return;
    if (menuRef.current && getComputedStyle(menuRef.current).display !== "none") return; // narrow: the drawer shows names
    const f = frame.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setTip({ text, top: r.top - f.top + r.height / 2, left: r.right - f.left + 8 });
  };
  const hideTip = () => setTip(null);
  useEffect(() => {
    if (!icons) setTip(null);
  }, [icons]);

  const trail = crumbs ?? (here ? [here.group, here.item.label] : [product]);

  return (
    <div ref={frameRef} className={`fl-af-frame${icons ? " fl-af-frame--icons" : ""}${drawer ? " fl-af-frame--drawer" : ""}`}>
      <a className="fl-af-skip" href="#main">
        Skip to content
      </a>
      <div className="fl-af-scrim" aria-hidden="true" onClick={closeDrawer} />

      <nav ref={railRef} className="fl-af-rail" id={`${uid}-rail`} aria-label={`${product} navigation`} onKeyDown={onRailKey}>
        <div className="fl-af-brand">
          <span className="fl-af-mark" aria-hidden="true">
            {logo ?? product.slice(0, 1).toUpperCase()}
          </span>
          <span className="fl-af-product">{product}</span>
          <button type="button" className="fl-af-iconbtn fl-af-fold" aria-label={icons ? "Expand the menu" : "Collapse the menu to icons"} aria-pressed={icons} onClick={() => setIcons((v) => !v)} onMouseEnter={(e) => showTip(e.currentTarget, "Expand the menu")} onMouseLeave={hideTip} onFocus={(e) => showTip(e.currentTarget, "Expand the menu")} onBlur={hideTip}>
            <Icon name={icons ? "chevron-right" : "chevron-left"} />
          </button>
          <button type="button" className="fl-af-iconbtn fl-af-close" aria-label="Close the menu" onClick={closeDrawer}>
            <Icon name="close" />
          </button>
        </div>

        <div className="fl-af-groups" onScroll={hideTip}>
          {nav.map((g) => {
            const holdsHere = g.items.some((i) => i.id === current);
            const open = holdsHere || !closed.includes(g.label);
            const listId = `${uid}-g-${slug(g.label)}`;
            return (
              <div key={g.label} className={`fl-af-group${open ? "" : " fl-af-group--closed"}`}>
                <button
                  type="button"
                  className="fl-af-group-head"
                  aria-expanded={open}
                  aria-controls={listId}
                  aria-disabled={holdsHere || undefined}
                  title={holdsHere ? "Stays open: it holds the page you're on" : undefined}
                  onClick={() => !holdsHere && toggleGroup(g.label)}
                >
                  <span className="fl-af-group-label">{g.label}</span>
                  <Icon name="chevron-right" />
                </button>
                <ul className="fl-af-list" id={listId} role="list">
                  {g.items.map((i) => {
                    const on = isOn(i);
                    const name = `${i.label}${i.badge ? `, ${i.badge} waiting` : ""}${on ? "" : ", not in this prototype"}`;
                    return (
                      <li key={i.id}>
                        <button
                          type="button"
                          className={`fl-af-item${i.id === current ? " fl-af-item--current" : ""}${on ? "" : " fl-af-item--off"}`}
                          aria-current={i.id === current ? "page" : undefined}
                          aria-label={icons ? name : undefined}
                          onClick={() => go(i.id)}
                          onMouseEnter={(e) => showTip(e.currentTarget, i.label)}
                          onMouseLeave={hideTip}
                          onFocus={(e) => showTip(e.currentTarget, i.label)}
                          onBlur={hideTip}
                        >
                          <Icon name={i.icon ?? "dot"} />
                          <span className="fl-af-label">{i.label}</span>
                          {i.badge ? <span className="fl-af-count">{i.badge}</span> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </nav>
      {tip ? (
        <span className="fl-af-tip" aria-hidden="true" style={{ top: tip.top, left: tip.left }}>
          {tip.text}
        </span>
      ) : null}

      <div className="fl-af-col">
        <header className="fl-af-top">
          <button ref={menuRef} type="button" className="fl-af-iconbtn fl-af-menu" aria-label="Open the menu" aria-expanded={drawer} aria-controls={`${uid}-rail`} onClick={() => setDrawer(true)}>
            <Icon name="menu" />
          </button>
          <nav className="fl-af-crumbs" aria-label="Breadcrumb">
            <ol>
              {trail.map((c, n) => (
                <li key={`${c}-${n}`} aria-current={n === trail.length - 1 ? "page" : undefined}>
                  {c}
                </li>
              ))}
            </ol>
          </nav>
          {env ? (
            <span className="fl-af-env" title={`Environment: ${env}`}>
              <span className="fl-af-sr">Environment: </span>
              {env}
            </span>
          ) : null}
          <div className="fl-af-tools">
            <NavSearch all={all} onPick={go} uid={uid} />
            {store ? <RoleSwitch store={store} /> : null}
            {actions}
            {store ? <Bell store={store} storageKey={`${key}:seen`} /> : null}
            {user ? (
              <span className="fl-af-user">
                <span className="fl-af-avatar" aria-hidden="true">
                  {initials(user.name)}
                </span>
                <span className="fl-af-who">
                  <strong>{user.name}</strong>
                  {store || user.role ? <UserRole store={store} fallback={user.role} /> : null}
                </span>
              </span>
            ) : null}
          </div>
        </header>

        <main id="main" className="fl-af-main" tabIndex={-1}>
          {here && !isOn(here.item) ? (
            <div className="fl-af-off">
              <span className="fl-af-off-icon" aria-hidden="true">
                <Icon name={here.item.icon ?? "layers"} />
              </span>
              <h2 className="fl-af-h">{here.item.label}</h2>
              <p>
                <strong>Not in this prototype.</strong> {here.item.label} is part of the finished app; this prototype builds the screens it is testing, so this page
                is a placeholder.
              </p>
              {firstOn ? (
                <Button variant="secondary" size={40} icon="arrow-left" onClick={() => onNavigate(firstOn.id)}>
                  {`Back to ${firstOn.label}`}
                </Button>
              ) : null}
            </div>
          ) : (
            // Each destination enters (the starter's ui-screen motion; at rest when animation is off or reduced).
            <div className="ui-screen" key={current}>
              {children}
            </div>
          )}
        </main>
      </div>
      <Toaster />
    </div>
  );
}

function UserRole({ store, fallback }: { store?: AppStore; fallback?: string }) {
  return store ? <StoreRole store={store} /> : <span>{fallback}</span>;
}
function StoreRole({ store }: { store: AppStore }) {
  const { role } = useStore(store);
  return <span>{role}</span>;
}

// ── Search: find a destination by name and jump to it ──

function NavSearch({ all, onPick, uid }: { all: { item: NavItem; group: string }[]; onPick: (id: string) => void; uid: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = `${uid}-search`;
  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return all.filter((x) => x.item.label.toLowerCase().includes(t) || x.group.toLowerCase().includes(t)).slice(0, 8);
  }, [all, q]);
  const shown = open && q.trim() !== "";
  const pick = (id: string) => {
    onPick(id);
    setQ("");
    setOpen(false);
  };
  const onKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && hits.length) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % hits.length);
    } else if (e.key === "ArrowUp" && hits.length) {
      e.preventDefault();
      setActive((a) => (a - 1 + hits.length) % hits.length);
    } else if (e.key === "Enter" && shown && hits[active]) {
      e.preventDefault();
      pick(hits[active]!.item.id);
    } else if (e.key === "Escape") {
      if (shown) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      } else setQ("");
    }
  };
  return (
    <div className="fl-af-search">
      <Icon name="search" />
      <input
        className="fl-af-field fl-af-search-input"
        type="search"
        role="combobox"
        aria-label="Go to a page"
        aria-expanded={shown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={shown && hits[active] ? `${listId}-${hits[active]!.item.id}` : undefined}
        placeholder="Go to…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKey}
      />
      <ul className="fl-af-results" id={listId} role="listbox" aria-label="Pages" hidden={!shown}>
        {hits.length ? (
          hits.map((x, n) => (
            <li
              key={x.item.id}
              id={`${listId}-${x.item.id}`}
              role="option"
              aria-selected={n === active}
              className={`fl-af-result${n === active ? " fl-af-result--active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(x.item.id);
              }}
              onMouseEnter={() => setActive(n)}
            >
              <Icon name={x.item.icon ?? "dot"} />
              <span className="fl-af-result-text">
                <strong>{x.item.label}</strong>
                <span>{x.group}</span>
              </span>
              {isOn(x.item) ? null : <span className="fl-af-tag">Not built</span>}
            </li>
          ))
        ) : (
          <li className="fl-af-result fl-af-result--none" role="option" aria-selected={false} aria-disabled="true">
            No page called “{q.trim()}”
          </li>
        )}
      </ul>
    </div>
  );
}

// ── The role switcher ──

function RoleSwitch({ store }: { store: AppStore }) {
  const { role } = useStore(store);
  const roles = store.schema.roles ?? [];
  const id = useId();
  if (!roles.length) return null;
  return (
    <span className="fl-af-role">
      <label htmlFor={id}>Role</label>
      <span className="fl-af-select">
        <select
          id={id}
          className="fl-af-field"
          value={role}
          onChange={(e) => {
            store.setRole(e.target.value);
            toast(`Now working as ${e.target.value}.`, "info");
          }}
        >
          {roles.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <Icon name="chevron-down" />
      </span>
    </span>
  );
}

// ── Notifications: the store's activity since the panel was last opened ──

function Bell({ store, storageKey }: { store: AppStore; storageKey: string }) {
  const { activity } = useStore(store);
  const [seen, setSeen] = useState<string>(() => read(storageKey) ?? "");
  const [shownSince, setShownSince] = useState(seen);
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const panelId = useId();
  const unread = activity.filter((a) => a.at > seen).length;

  const markSeen = (at: string) => {
    setSeen(at);
    write(storageKey, at);
  };
  const close = useCallback((back = true) => {
    setOpen(false);
    if (back) btnRef.current?.focus();
  }, []);
  const toggle = () => {
    if (open) return close();
    setShownSince(seen);
    markSeen(new Date().toISOString());
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const away = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open, close]);

  const latest: ActivityItem[] = activity.slice(0, 8);
  return (
    <span ref={wrapRef} className="fl-af-bell">
      <button
        ref={btnRef}
        type="button"
        className="fl-af-iconbtn"
        aria-label={unread ? `Notifications, ${unread} new` : "Notifications"}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={toggle}
      >
        <Icon name="bell" />
        {unread ? (
          <span className="fl-af-dot" aria-hidden="true">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          className="fl-af-panel"
          role="dialog"
          aria-label="Notifications"
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              close();
            }
          }}
        >
          <div className="fl-af-panel-head">
            <strong>Notifications</strong>
            <Button
              variant="tertiary"
              size={32}
              disabled={!latest.some((a) => a.at > shownSince)}
              onClick={() => {
                setShownSince(new Date().toISOString());
                toast("All caught up.", "info");
              }}
            >
              Mark all read
            </Button>
          </div>
          {latest.length ? (
            <ul className="fl-af-feed">
              {latest.map((a) => (
                <li key={a.id} className={a.at > shownSince ? "fl-af-feed-new" : undefined}>
                  <span className="fl-af-avatar fl-af-avatar--sm" aria-hidden="true">
                    {initials(a.who)}
                  </span>
                  <span className="fl-af-feed-text">
                    <span>
                      <strong>{a.who}</strong> {a.text}
                      {a.reason ? <em> “{a.reason}”</em> : null}
                    </span>
                    <time dateTime={a.at}>
                      {ago(a.at)} · {a.recordId}
                    </time>
                  </span>
                  {a.at > shownSince ? <span className="fl-af-sr">(new)</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="fl-af-panel-empty">Nothing yet. Changes to records show up here.</p>
          )}
        </div>
      ) : null}
    </span>
  );
}

// flowcode:sample
const SAMPLE_NAV: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { id: "overview", label: "Overview", icon: "home" },
      { id: "contracts", label: "Contracts", icon: "folder" },
      { id: "approvals", label: "Approvals", icon: "check" },
      { id: "renewals", label: "Renewals", icon: "refresh", available: false },
    ],
  },
  {
    label: "Records",
    items: [
      { id: "vendors", label: "Vendors", icon: "users", available: false },
      { id: "documents", label: "Documents", icon: "paperclip", badge: 3, available: false },
      { id: "obligations", label: "Obligations", icon: "shield", available: false },
    ],
  },
  {
    label: "Reports",
    items: [
      { id: "expiring", label: "Expiring contracts", icon: "clock" },
      { id: "spend", label: "Spend by category", icon: "chart", available: false },
      { id: "audit", label: "Audit trail", icon: "archive" },
    ],
  },
  {
    label: "Admin",
    items: [
      { id: "people", label: "Users and roles", icon: "user", available: false },
      { id: "workflows", label: "Approval workflows", icon: "layers", available: false },
      { id: "integrations", label: "Integrations", icon: "link", available: false },
    ],
  },
  {
    label: "Utilities",
    items: [
      { id: "imports", label: "Imports", icon: "upload", available: false },
      { id: "exports", label: "Exports", icon: "download", available: false },
      { id: "settings", label: "Settings", icon: "settings", available: false },
    ],
  },
];

const CONTRACT = sampleStore.entity("contract");

/** The first status change the current role may make on a record, if any. */
function nextStep(status: string, role: string) {
  return CONTRACT.transitions?.find((t) => t.from.includes(status) && !t.needsReason && (!t.roles?.length || t.roles.includes(role)));
}

function ContractRows({ filter, empty }: { filter?: (status: string) => boolean; empty: string }) {
  const records = useRecords(sampleStore, "contract");
  const { role } = useStore(sampleStore);
  const rows = records.filter((r) => !filter || filter(String(r.status))).slice(0, 7);
  if (!rows.length) return <p className="fl-af-muted">{empty}</p>;
  return (
    <ul className="fl-af-rows">
      {rows.map((r) => {
        const t = nextStep(String(r.status), role);
        return (
          <li key={r.id}>
            <span className="fl-af-row-main">
              <strong>{String(r.name)}</strong>
              <span>
                {String(r.vendor)} · {r.id}
              </span>
            </span>
            <StatusChip entity={CONTRACT} record={r} />
            <span className="fl-af-row-act">
              {t ? (
                <Button
                  variant="tertiary"
                  size={32}
                  onClick={() => {
                    const res = sampleStore.transition("contract", r.id, t.key);
                    toast(res.message, res.ok ? "success" : "danger");
                  }}
                >
                  {t.label}
                </Button>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Overview() {
  const records = useRecords(sampleStore, "contract");
  return (
    <>
      <p className="fl-af-muted">Where the contract book stands today.</p>
      <dl className="fl-af-stats">
        {(CONTRACT.statuses ?? []).map((s) => (
          <div key={s.key}>
            <dt>{s.label}</dt>
            <dd>{records.filter((r) => r.status === s.key).length}</dd>
          </div>
        ))}
      </dl>
      <div className="fl-af-row-act">
        <Button
          variant="tertiary"
          size={32}
          icon="refresh"
          onClick={() => {
            sampleStore.reset();
            toast("Sample data reset.", "info");
          }}
        >
          Reset the sample data
        </Button>
      </div>
    </>
  );
}

function AuditTrail() {
  const items = useActivity(sampleStore, "contract").slice(0, 10);
  if (!items.length) return <p className="fl-af-muted">No changes yet. Change a contract's status and it is recorded here.</p>;
  return (
    <ul className="fl-af-rows">
      {items.map((a) => (
        <li key={a.id}>
          <span className="fl-af-row-main">
            <strong>{a.text}</strong>
            <span>
              {a.who} · {a.recordId}
            </span>
          </span>
          <time className="fl-af-muted" dateTime={a.at}>
            {ago(a.at)}
          </time>
        </li>
      ))}
    </ul>
  );
}

export default function AppFrameSheet() {
  const [current, setCurrent] = useState("contracts");
  const records = useRecords(sampleStore, "contract");
  const nav = useMemo(() => {
    const count = (s: string) => records.filter((r) => r.status === s).length;
    return SAMPLE_NAV.map((g) => ({
      ...g,
      items: g.items.map((i) => (i.id === "approvals" ? { ...i, badge: count("review") } : i.id === "expiring" ? { ...i, badge: count("expiring") } : i)),
    }));
  }, [records]);
  const label = nav.flatMap((g) => g.items).find((i) => i.id === current)?.label ?? "";

  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>App frame</h3>
        <p className="fl-ctl-btn-what">The whole app's shell: a grouped rail that folds to icons, breadcrumbs, a search that jumps to any page, the role, notifications from real changes, and a clear page for what the prototype doesn't build.</p>
        <div className="fl-af-stage">
          <AppFrame product="Ledgerline" env="DEV" nav={nav} current={current} onNavigate={setCurrent} store={sampleStore} user={{ name: "Ana Reyes" }}>
            <div className="fl-af-page">
              <h2 className="fl-af-h">{label}</h2>
              {current === "overview" ? <Overview /> : null}
              {current === "contracts" ? (
                <>
                  <p className="fl-af-muted">The latest contracts. Move one along and the bell picks it up.</p>
                  <ContractRows empty="No contracts yet." />
                </>
              ) : null}
              {current === "approvals" ? (
                <>
                  <p className="fl-af-muted">Contracts waiting for a manager. Switch the role to Manager to approve them.</p>
                  <ContractRows filter={(s) => s === "review"} empty="Nothing is waiting for approval." />
                </>
              ) : null}
              {current === "expiring" ? (
                <>
                  <p className="fl-af-muted">Contracts that end soon.</p>
                  <ContractRows filter={(s) => s === "expiring"} empty="Nothing ends soon." />
                </>
              ) : null}
              {current === "audit" ? <AuditTrail /> : null}
            </div>
          </AppFrame>
        </div>
      </div>
    </section>
  );
}
