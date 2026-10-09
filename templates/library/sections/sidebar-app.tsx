/** @flowcode-library sidebar-app · App sidebar (Navigation)
 * Use cases: app navigation; dashboard layout; admin panel; booking app; crm; project management app; saas app shell; back office
 * Jobs to be done: move between sections of the app; find a page quickly; create a new item from anywhere; manage my account and sign out
 * Keywords: sidebar, navigation, app shell, dashboard, collapsible, search, account menu, drawer, responsive
 */
/**
 * Sidebar: the classic app sidebar. Product name at the top, a search box that filters the pages, grouped pages with
 * icons and counts, one primary "New booking" button and the signed-in person with a small menu at the bottom. It
 * collapses to icons only (names show as tooltips) and remembers that choice; on phones it becomes a top bar with a
 * menu button that opens it as a drawer. Use it as the frame of a dashboard or back-office app. Make it the app's own:
 * replace SAMPLE with the app's real pages, groups and person, and show the real screen in the main area.
 */
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  product: "Kiln Room",
  mark: "K",
  searchLabel: "Search pages",
  searchPlaceholder: "Search",
  noMatch: "No pages match",
  newLabel: "New booking",
  collapse: "Collapse sidebar",
  expand: "Expand sidebar",
  menuLabel: "Open menu",
  closeLabel: "Close menu",
  person: { initials: "AR", name: "Ada Reyes", email: "ada@kilnroom.example" },
  accountLabel: "Account",
  profile: "Profile",
  signOut: "Sign out",
  signedOutTitle: "You're signed out",
  signedOutText: "Your bookings are safe. Sign in again to pick up where you left off.",
  signIn: "Sign in again",
  groups: [
    {
      id: "workspace",
      label: "Workspace",
      items: [
        { id: "home", label: "Home", icon: "home", count: 0 },
        { id: "bookings", label: "Bookings", icon: "calendar", count: 4 },
        { id: "clients", label: "Clients", icon: "users", count: 0 },
        { id: "reports", label: "Reports", icon: "chart", count: 0 },
      ],
    },
    {
      id: "settings",
      label: "Settings",
      items: [
        { id: "team", label: "Team", icon: "team", count: 0 },
        { id: "billing", label: "Billing", icon: "card", count: 0 },
      ],
    },
  ],
  pages: {
    home: { title: "Good morning, Ada", text: "Here is how the studio looks today.", cards: [["6", "Classes today"], ["38", "Seats booked"], ["4", "Bookings to confirm"]] },
    bookings: { title: "Bookings", text: "Four new bookings are waiting for a reply.", cards: [["4", "Waiting for you"], ["21", "This week"], ["2", "Cancelled"]] },
    clients: { title: "Clients", text: "Everyone who has booked a class with you.", cards: [["214", "Active clients"], ["12", "New this month"], ["31", "Members"]] },
    reports: { title: "Reports", text: "Bookings and income over the last 30 days.", cards: [["$4,820", "Income"], ["86%", "Seats filled"], ["3.4", "Classes per client"]] },
    team: { title: "Team", text: "The people who teach and run the studio.", cards: [["5", "Teachers"], ["2", "Front desk"], ["1", "Invite pending"]] },
    billing: { title: "Billing", text: "Your plan, invoices and payment details.", cards: [["Studio", "Current plan"], ["$29", "Per month"], ["1 Nov", "Next invoice"]] },
    profile: { title: "Your profile", text: "Your name, photo and how clients reach you.", cards: [["Ada Reyes", "Owner"], ["Mon to Sat", "Teaching days"], ["Email", "Preferred contact"]] },
    new: { title: "New booking", text: "Choose a class, a time and the client to start a booking.", cards: [["1", "Pick a class"], ["2", "Pick a time"], ["3", "Add the client"]] },
  } as Record<string, { title: string; text: string; cards: string[][] }>,
};

const STORE_KEY = "fl-snv-app-collapsed";
const MOBILE = "(max-width: 767px)";
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

const GLYPHS: Record<string, string> = {
  home: "M3 11 12 4l9 7M5 10v10h5v-6h4v6h5V10",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  card: "M3 6h18v12H3zM3 10h18M7 15h4",
  team: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  plus: "M12 5v14M5 12h14",
  collapse: "M4 5h16v14H4zM9 5v14M15 10l-2 2 2 2",
  expand: "M4 5h16v14H4zM9 5v14M13 10l2 2-2 2",
  close: "M6 6l12 12M18 6 6 18",
  updown: "M8 9l4-4 4 4M8 15l4 4 4-4",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  out: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
};

function Glyph({ name }: { name: string }) {
  if (!GLYPHS[name]) return <Icon name={name} />;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={GLYPHS[name]} />
    </svg>
  );
}

/** Phone drawer: focus moves in, Tab stays inside, Escape closes, focus goes back to the menu button. */
function useNavDrawer() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (!open) {
      if (wasOpen.current) {
        wasOpen.current = false;
        menuRef.current?.focus();
      }
      return;
    }
    wasOpen.current = true;
    const panel = panelRef.current;
    if (!panel) return;
    const items = () => Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
    const frame = requestAnimationFrame(() => (items()[0] ?? panel).focus());
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const list = items();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    const mq = window.matchMedia(MOBILE);
    const onChange = () => {
      if (!mq.matches) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onChange);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onChange);
      document.body.style.overflow = overflow;
    };
  }, [open]);
  return { open, setOpen, menuRef, panelRef };
}

function readCollapsed() {
  try {
    return localStorage.getItem(STORE_KEY) === "1";
  } catch {
    return false;
  }
}

export default function SidebarApp() {
  const d = SAMPLE;
  const [page, setPage] = useState("bookings");
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [accountOpen, setAccountOpen] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const drawer = useNavDrawer();
  const searchRef = useRef<HTMLInputElement>(null);
  const meRef = useRef<HTMLButtonElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const focusSearch = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, collapsed ? "1" : "0");
    } catch {
      /* storage blocked: the choice lasts for this visit only */
    }
    if (!collapsed && focusSearch.current) {
      focusSearch.current = false;
      searchRef.current?.focus();
    }
  }, [collapsed]);

  // The account menu closes on Escape (focus back to its button) or a click anywhere else.
  useEffect(() => {
    if (!accountOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setAccountOpen(false);
        meRef.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!accountRef.current?.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [accountOpen]);

  const go = (id: string) => (e?: MouseEvent) => {
    e?.preventDefault();
    setPage(id);
    setAccountOpen(false);
    drawer.setOpen(false);
  };

  const q = query.trim().toLowerCase();
  const groups = d.groups.map((g) => ({ ...g, items: g.items.filter((i) => !q || i.label.toLowerCase().includes(q)) })).filter((g) => g.items.length > 0);
  const current = d.pages[page] ?? d.pages.home;

  return (
    <div className={`fl-snv-frame fl-snv-app${collapsed ? " is-collapsed" : ""}`}>
      <header className="fl-snv-topbar">
        <button
          ref={drawer.menuRef}
          type="button"
          className="fl-snv-iconbtn"
          aria-label={d.menuLabel}
          aria-expanded={drawer.open}
          aria-controls="sidebar-app-side"
          onClick={() => drawer.setOpen(true)}
        >
          <Icon name="menu" />
        </button>
        <span className="fl-snv-mark" aria-hidden="true">
          {d.mark}
        </span>
        <span className="fl-snv-topbar__title">
          <strong>{d.product}</strong>
          <span>{signedOut ? d.signedOutTitle : current.title}</span>
        </span>
      </header>

      <div className={`fl-snv-backdrop${drawer.open ? " is-open" : ""}`} onClick={() => drawer.setOpen(false)} aria-hidden="true" />

      <aside
        id="sidebar-app-side"
        ref={drawer.panelRef}
        className={`fl-snv-side${drawer.open ? " is-open" : ""}`}
        role={drawer.open ? "dialog" : undefined}
        aria-modal={drawer.open ? true : undefined}
        aria-label={drawer.open ? d.product : undefined}
        tabIndex={-1}
      >
        <div className="fl-snv-brand">
          <span className="fl-snv-mark" aria-hidden="true">
            {d.mark}
          </span>
          <span className="fl-snv-brand__name">{d.product}</span>
          <button
            type="button"
            className="fl-snv-iconbtn fl-snv-collapse"
            style={{ marginLeft: collapsed ? undefined : "auto", position: "relative" }}
            aria-label={collapsed ? d.expand : d.collapse}
            onClick={() => setCollapsed((c) => !c)}
          >
            <Glyph name={collapsed ? "expand" : "collapse"} />
            <span className="fl-snv-tip" aria-hidden="true">
              {collapsed ? d.expand : d.collapse}
            </span>
          </button>
          <button type="button" className="fl-snv-iconbtn fl-snv-close" aria-label={d.closeLabel} onClick={() => drawer.setOpen(false)}>
            <Glyph name="close" />
          </button>
        </div>

        <label className="fl-snv-search">
          <span className="fl-sr">{d.searchLabel}</span>
          <Glyph name="search" />
          <input ref={searchRef} className="fl-input" type="search" placeholder={d.searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button
          type="button"
          className="fl-snv-iconbtn fl-snv-search-btn"
          aria-label={d.searchLabel}
          onClick={() => {
            focusSearch.current = true;
            setCollapsed(false);
          }}
        >
          <Glyph name="search" />
          <span className="fl-snv-tip" aria-hidden="true">
            {d.searchLabel}
          </span>
        </button>

        <nav aria-label="Main" className="fl-snv-scroll">
          {groups.length === 0 ? (
            <p className="fl-snv-none" role="status">
              {d.noMatch} "{query.trim()}"
            </p>
          ) : (
            groups.map((g) => (
              <div key={g.id} className="fl-snv-group">
                <p id={`sidebar-app-${g.id}`} className="fl-snv-heading">
                  {g.label}
                </p>
                <ul className="fl-snv-list" aria-labelledby={`sidebar-app-${g.id}`}>
                  {g.items.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className="fl-snv-item"
                        aria-current={!signedOut && page === item.id ? "page" : undefined}
                        onClick={go(item.id)}
                      >
                        <Glyph name={item.icon} />
                        <span className="fl-snv-label">{item.label}</span>
                        {item.count > 0 && (
                          <span className="fl-snv-count">
                            {item.count}
                            <span className="fl-sr"> new</span>
                          </span>
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </nav>

        <div className="fl-snv-foot">
          <button type="button" className="fl-btn fl-btn--primary" onClick={() => go("new")()} disabled={signedOut}>
            <Glyph name="plus" />
            <span className="fl-snv-label" style={{ flex: "none" }}>
              {d.newLabel}
            </span>
          </button>
          <div className="fl-snv-account" ref={accountRef}>
            <button
              ref={meRef}
              type="button"
              className="fl-snv-me"
              aria-expanded={accountOpen}
              aria-controls="sidebar-app-account"
              aria-label={`${d.accountLabel}: ${d.person.name}`}
              onClick={() => setAccountOpen((o) => !o)}
              disabled={signedOut}
            >
              <span className="fl-person__avatar" aria-hidden="true">
                {d.person.initials}
              </span>
              <span className="fl-snv-me__text" aria-hidden="true">
                <strong>{d.person.name}</strong>
                <span>{d.person.email}</span>
              </span>
              <Glyph name="updown" />
            </button>
            {accountOpen && (
              <ul id="sidebar-app-account" className="fl-snv-menu" aria-label={d.accountLabel}>
                <li>
                  <a href="#profile" className="fl-snv-item" aria-current={page === "profile" ? "page" : undefined} onClick={go("profile")}>
                    <Glyph name="user" />
                    {d.profile}
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    className="fl-snv-item fl-snv-item--danger"
                    onClick={() => {
                      setAccountOpen(false);
                      setSignedOut(true);
                      drawer.setOpen(false);
                      meRef.current?.focus();
                    }}
                  >
                    <Glyph name="out" />
                    {d.signOut}
                  </button>
                </li>
              </ul>
            )}
          </div>
        </div>
      </aside>

      <section className="fl-snv-main" aria-labelledby="sidebar-app-title" aria-live="polite">
        {signedOut ? (
          <div className="fl-snv-empty">
            <h2 id="sidebar-app-title" className="fl-title fl-title--md">
              {d.signedOutTitle}
            </h2>
            <p className="fl-text">{d.signedOutText}</p>
            <button type="button" className="fl-btn fl-btn--primary" onClick={() => setSignedOut(false)}>
              {d.signIn}
            </button>
          </div>
        ) : (
          <>
            <div className="fl-snv-main__head">
              <h2 id="sidebar-app-title" className="fl-title">
                {current.title}
              </h2>
              <p className="fl-text">{current.text}</p>
            </div>
            <ul className="fl-snv-cards">
              {current.cards.map(([value, label]) => (
                <li key={label} className="fl-card">
                  <strong>{value}</strong>
                  <span className="fl-meta">{label}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
