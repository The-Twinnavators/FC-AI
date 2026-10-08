/**
 * Sidebar: nested groups with pins. Projects open into their pages (two levels, chevrons turn as they open) and any
 * page can be pinned to a "Pinned" list at the top with a small pin button. What is open and what is pinned are both
 * remembered. On phones it becomes a top bar with a menu button that opens it as a drawer. Use it when an app has
 * many projects, folders or spaces, each with its own pages. Make it the app's own: replace SAMPLE with the real
 * projects and pages, and show the real screen in the main area.
 */
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  product: "Kiln Room",
  mark: "K",
  menuLabel: "Open menu",
  closeLabel: "Close menu",
  pinnedLabel: "Pinned",
  pinnedEmpty: "Pin a page to keep it here.",
  projectsLabel: "Projects",
  pinnedNow: "Pinned",
  unpinnedNow: "Unpinned",
  top: [
    { id: "home", label: "Home", icon: "home", count: 0, text: "What's happening across your projects.", cards: [["3", "Projects running"], ["5", "Tasks due this week"], ["2", "Pinned pages"]] },
    { id: "inbox", label: "Inbox", icon: "inbox", count: 3, text: "Updates and mentions from the team.", cards: [["Noor", "Moved the raku firing to Saturday"], ["Theo", "Kiln 2 element ordered"], ["Ada", "Gallery list is final"]] },
  ],
  projects: [
    {
      id: "spring",
      label: "Spring open studio",
      pages: [
        { id: "overview", label: "Overview", text: "An open weekend with demos, tea and a seconds sale.", cards: [["12 Apr", "Opening day"], ["140", "Guests expected"], ["8", "Demos planned"]] },
        { id: "schedule", label: "Schedule", text: "Who is demonstrating what, and when.", cards: [["10:00", "Wheel throwing demo"], ["13:00", "Glazing talk"], ["15:30", "Raku firing"]] },
        { id: "bookings", label: "Bookings", text: "Free tickets booked so far.", cards: [["96", "Booked"], ["44", "Still open"], ["11", "Waiting list"]] },
      ],
    },
    {
      id: "kiln",
      label: "Kiln repair",
      pages: [
        { id: "overview", label: "Overview", text: "Kiln 2 needs new elements before the spring firing.", cards: [["2 weeks", "Time left"], ["Theo", "Owner"], ["On track", "Status"]] },
        { id: "tasks", label: "Tasks", text: "What has to happen, in order.", cards: [["Done", "Order elements"], ["This week", "Book the electrician"], ["Next week", "Test firing"]] },
        { id: "budget", label: "Budget", text: "Parts and labour against what we set aside.", cards: [["$640", "Set aside"], ["$410", "Spent"], ["$230", "Left"]] },
      ],
    },
    {
      id: "gallery",
      label: "Gallery night",
      pages: [
        { id: "overview", label: "Overview", text: "A one-night show of student work in June.", cards: [["14 Jun", "Show night"], ["22", "Artists"], ["60", "Pieces"]] },
        { id: "guests", label: "Guest list", text: "No invitations have gone out yet.", cards: [] },
        { id: "pieces", label: "Pieces", text: "Work chosen for the show.", cards: [["38", "Chosen"], ["22", "Still to choose"], ["6", "For sale"]] },
      ],
    },
  ],
  emptyTitle: "No guests yet",
  emptyText: "Add guests once the invitation is ready.",
  defaultOpen: ["projects", "spring"],
  defaultPins: ["spring/schedule"],
};

const STORE_KEY = "fl-snv-nested";
const MOBILE = "(max-width: 767px)";
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

const GLYPHS: Record<string, string> = {
  home: "M3 11 12 4l9 7M5 10v10h5v-6h4v6h5V10",
  inbox: "M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5",
  folder: "M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z",
  page: "M6 3h8l4 4v14H6zM14 3v4h4",
  pin: "M9 4h6M10 4v6l-3 3h10l-3-3V4M12 13v7",
  chevron: "M9 6l6 6-6 6",
  close: "M6 6l12 12M18 6 6 18",
};

function Glyph({ name, className }: { name: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

type Saved = { open: string[]; pins: string[] };

function readSaved(): Saved {
  const fallback = { open: SAMPLE.defaultOpen, pins: SAMPLE.defaultPins };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return fallback;
    const data = JSON.parse(raw) as Partial<Saved>;
    return {
      open: Array.isArray(data.open) ? data.open.filter((x) => typeof x === "string") : fallback.open,
      pins: Array.isArray(data.pins) ? data.pins.filter((x) => typeof x === "string") : fallback.pins,
    };
  } catch {
    return fallback;
  }
}

/** Finds a page by its key ("home", or "project/page"). */
function lookup(key: string) {
  const d = SAMPLE;
  const top = d.top.find((t) => t.id === key);
  if (top) return { project: null, page: top };
  const [projectId, pageId] = key.split("/");
  const project = d.projects.find((p) => p.id === projectId);
  const page = project?.pages.find((p) => p.id === pageId);
  return project && page ? { project, page } : null;
}

export default function SidebarNested() {
  const d = SAMPLE;
  const [saved] = useState(readSaved);
  const [openIds, setOpenIds] = useState<string[]>(saved.open);
  const [pins, setPins] = useState<string[]>(saved.pins.filter((k) => lookup(k)?.project));
  const [current, setCurrent] = useState("spring/schedule");
  const [status, setStatus] = useState("");
  const drawer = useNavDrawer();

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ open: openIds, pins }));
    } catch {
      /* storage blocked: the layout lasts for this visit only */
    }
  }, [openIds, pins]);

  const toggleOpen = (id: string) => setOpenIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  const go = (key: string) => (e: MouseEvent) => {
    e.preventDefault();
    setCurrent(key);
    drawer.setOpen(false);
  };
  const togglePin = (key: string, fromPinned = false) => {
    const found = lookup(key);
    const name = found?.project ? `${found.page.label} (${found.project.label})` : key;
    const pinned = pins.includes(key);
    if (pinned && fromPinned) {
      // The row disappears: put focus on the next pinned page, or on the Pinned heading.
      const i = pins.indexOf(key);
      const next = pins[i + 1] ?? pins[i - 1];
      requestAnimationFrame(() => document.getElementById(next ? `sidebar-nested-pin-${next}` : "sidebar-nested-pinned")?.focus());
    }
    setPins((list) => (pinned ? list.filter((k) => k !== key) : [...list, key]));
    setStatus(`${pinned ? d.unpinnedNow : d.pinnedNow} ${name}.`);
  };

  const found = lookup(current) ?? lookup("home")!;
  const page = found.page;
  const projectsOpen = openIds.includes("projects");

  return (
    <div className="fl-snv-frame">
      <header className="fl-snv-topbar">
        <button
          ref={drawer.menuRef}
          type="button"
          className="fl-snv-iconbtn"
          aria-label={d.menuLabel}
          aria-expanded={drawer.open}
          aria-controls="sidebar-nested-side"
          onClick={() => drawer.setOpen(true)}
        >
          <Icon name="menu" />
        </button>
        <span className="fl-snv-mark" aria-hidden="true">
          {d.mark}
        </span>
        <span className="fl-snv-topbar__title">
          <strong>{found.project ? found.project.label : d.product}</strong>
          <span>{page.label}</span>
        </span>
      </header>

      <div className={`fl-snv-backdrop${drawer.open ? " is-open" : ""}`} onClick={() => drawer.setOpen(false)} aria-hidden="true" />

      <aside
        id="sidebar-nested-side"
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
          <button type="button" className="fl-snv-iconbtn fl-snv-close" aria-label={d.closeLabel} onClick={() => drawer.setOpen(false)}>
            <Glyph name="close" />
          </button>
        </div>

        <nav aria-label="Main" className="fl-snv-scroll">
          <div className="fl-snv-group">
            <p id="sidebar-nested-pinned" className="fl-snv-heading" tabIndex={-1}>
              {d.pinnedLabel}
            </p>
            {pins.length === 0 ? (
              <p className="fl-snv-pinned-hint">{d.pinnedEmpty}</p>
            ) : (
              <ul className="fl-snv-list" aria-labelledby="sidebar-nested-pinned">
                {pins.map((key) => {
                  const item = lookup(key);
                  if (!item?.project) return null;
                  return (
                    <li key={key} className="fl-snv-row">
                      <a href={`#${key}`} className="fl-snv-item" aria-current={current === key ? "page" : undefined} onClick={go(key)}>
                        <Glyph name="pin" />
                        <span className="fl-snv-label">
                          {item.page.label}
                          <span className="fl-meta"> · {item.project.label}</span>
                        </span>
                      </a>
                      <button
                        id={`sidebar-nested-pin-${key}`}
                        type="button"
                        className="fl-snv-iconbtn fl-snv-pin"
                        aria-label={`Unpin ${item.page.label}, ${item.project.label}`}
                        onClick={() => togglePin(key, true)}
                      >
                        <Glyph name="close" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <ul className="fl-snv-tree">
            {d.top.map((t) => (
              <li key={t.id}>
                <a href={`#${t.id}`} className="fl-snv-item" aria-current={current === t.id ? "page" : undefined} onClick={go(t.id)}>
                  <Glyph name={t.icon} />
                  <span className="fl-snv-label">{t.label}</span>
                  {t.count > 0 && (
                    <span className="fl-snv-count">
                      {t.count}
                      <span className="fl-sr"> new</span>
                    </span>
                  )}
                </a>
              </li>
            ))}
            <li>
              <button type="button" className="fl-snv-item" aria-expanded={projectsOpen} aria-controls="sidebar-nested-projects" onClick={() => toggleOpen("projects")}>
                <Glyph name="chevron" className="fl-snv-chev" />
                <span className="fl-snv-label">{d.projectsLabel}</span>
              </button>
              <ul id="sidebar-nested-projects" className="fl-snv-tree" hidden={!projectsOpen}>
                {d.projects.map((p) => {
                  const isOpen = openIds.includes(p.id);
                  const holdsCurrent = current.startsWith(`${p.id}/`);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        className={`fl-snv-item${holdsCurrent && !isOpen ? " fl-snv-item--holds" : ""}`}
                        aria-expanded={isOpen}
                        aria-controls={`sidebar-nested-${p.id}`}
                        onClick={() => toggleOpen(p.id)}
                      >
                        <Glyph name="chevron" className="fl-snv-chev" />
                        <span className="fl-snv-label">{p.label}</span>
                      </button>
                      <ul id={`sidebar-nested-${p.id}`} className="fl-snv-tree" hidden={!isOpen}>
                        {p.pages.map((pg) => {
                          const key = `${p.id}/${pg.id}`;
                          const pinned = pins.includes(key);
                          return (
                            <li key={key} className="fl-snv-row">
                              <a href={`#${key}`} className="fl-snv-item" aria-current={current === key ? "page" : undefined} onClick={go(key)}>
                                <Glyph name="page" />
                                <span className="fl-snv-label">{pg.label}</span>
                              </a>
                              <button
                                type="button"
                                className="fl-snv-iconbtn fl-snv-pin"
                                aria-pressed={pinned}
                                aria-label={`Pin ${pg.label}, ${p.label}`}
                                onClick={() => togglePin(key)}
                              >
                                <Glyph name="pin" />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            </li>
          </ul>
        </nav>
        <p className="fl-snv-status" role="status" aria-live="polite" style={{ paddingInline: "var(--space-3)" }}>
          {status}
        </p>
      </aside>

      <section className="fl-snv-main" aria-labelledby="sidebar-nested-title">
        <div className="fl-snv-main__head">
          <ol className="fl-snv-crumbs" aria-label="You are here">
            {found.project ? (
              <>
                <li>{d.projectsLabel}</li>
                <li>{found.project.label}</li>
                <li aria-current="page">{page.label}</li>
              </>
            ) : (
              <li aria-current="page">{page.label}</li>
            )}
          </ol>
          <h2 id="sidebar-nested-title" className="fl-title">
            {page.label}
          </h2>
          <p className="fl-text">{page.text}</p>
        </div>
        {page.cards.length === 0 ? (
          <div className="fl-snv-empty">
            <strong>{d.emptyTitle}</strong>
            <span>{d.emptyText}</span>
          </div>
        ) : (
          <ul className="fl-snv-cards">
            {page.cards.map(([title, meta]) => (
              <li key={title + meta} className="fl-card">
                <h3>{title}</h3>
                <span className="fl-meta">{meta}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
