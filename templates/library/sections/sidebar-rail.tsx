/**
 * Sidebar: icon rail with a secondary panel, like an email or chat app. A slim rail of section icons (names show as
 * tooltips) sits next to a wider panel listing the pages of the chosen section; choosing a page opens it on the right.
 * On phones it becomes a top bar with a menu button that opens both as a drawer. Use it when an app has a handful of
 * big sections, each with its own list. Make it the app's own: replace SAMPLE with the real sections and their pages,
 * and show the real screen in the main area.
 */
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  product: "Kiln Room",
  mark: "K",
  menuLabel: "Open menu",
  closeLabel: "Close menu",
  person: { initials: "AR", name: "Ada Reyes" },
  sections: [
    {
      id: "inbox",
      label: "Inbox",
      icon: "inbox",
      text: "Messages from clients and the team.",
      pages: [
        { id: "all", label: "All messages", count: 12, text: "Every conversation, newest first.", cards: [["Maya Lund", "Can I move Tuesday's class?"], ["Joel Baptiste", "Thanks for the glaze tips"], ["Front desk", "Kiln 2 is booked Friday"]] },
        { id: "unread", label: "Unread", count: 3, text: "Messages you haven't opened yet.", cards: [["Priya Nair", "Window seat for Saturday?"], ["Sam Okafor", "Gift card question"], ["Lena Fischer", "Running ten minutes late"]] },
        { id: "starred", label: "Starred", count: 0, text: "Messages you marked to come back to.", cards: [["Joel Baptiste", "Group booking for six"]] },
        { id: "archived", label: "Archived", count: 0, text: "Older conversations you've filed away.", cards: [] },
      ],
    },
    {
      id: "calendar",
      label: "Calendar",
      icon: "calendar",
      text: "Classes, workshops and kiln firings.",
      pages: [
        { id: "today", label: "Today", count: 6, text: "Six classes, 38 seats booked.", cards: [["09:30", "Wheel throwing, beginners"], ["13:00", "Hand building"], ["18:00", "Open studio"]] },
        { id: "week", label: "This week", count: 21, text: "Everything on between Monday and Sunday.", cards: [["Tue", "Glazing workshop"], ["Thu", "Kids' clay club"], ["Sat", "Raku firing"]] },
        { id: "firings", label: "Kiln firings", count: 2, text: "When each kiln is loaded and fired.", cards: [["Kiln 1", "Bisque, Wednesday night"], ["Kiln 2", "Glaze, Friday morning"]] },
      ],
    },
    {
      id: "clients",
      label: "Clients",
      icon: "users",
      text: "Everyone who books with you.",
      pages: [
        { id: "everyone", label: "Everyone", count: 214, text: "All active clients.", cards: [["214", "Active clients"], ["12", "New this month"], ["31", "Members"]] },
        { id: "members", label: "Members", count: 31, text: "Clients on a monthly membership.", cards: [["31", "Members"], ["4", "Renewing this week"]] },
        { id: "waitlist", label: "Waiting list", count: 7, text: "Clients waiting for a seat to open.", cards: [["7", "Waiting"], ["Sat", "Busiest day"]] },
      ],
    },
    {
      id: "reports",
      label: "Reports",
      icon: "chart",
      text: "How the studio is doing.",
      pages: [
        { id: "income", label: "Income", count: 0, text: "Money in over the last 30 days.", cards: [["$4,820", "Income"], ["$312", "Gift cards"], ["$95", "Refunds"]] },
        { id: "seats", label: "Seats filled", count: 0, text: "How full each class has been.", cards: [["86%", "Average"], ["100%", "Saturday raku"], ["54%", "Monday mornings"]] },
      ],
    },
    {
      id: "settings",
      label: "Settings",
      icon: "gear",
      text: "Studio details, team and billing.",
      pages: [
        { id: "studio", label: "Studio", count: 0, text: "Name, address and opening hours.", cards: [["Kiln Room", "Studio name"], ["Mon to Sat", "Open"]] },
        { id: "team", label: "Team", count: 0, text: "Teachers and front desk.", cards: [["5", "Teachers"], ["2", "Front desk"]] },
        { id: "billing", label: "Billing", count: 0, text: "Plan, invoices and payment details.", cards: [["Studio", "Current plan"], ["1 Nov", "Next invoice"]] },
      ],
    },
  ],
  emptyTitle: "Nothing here yet",
  emptyText: "Conversations you archive will be kept here.",
};

const MOBILE = "(max-width: 767px)";
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

const GLYPHS: Record<string, string> = {
  inbox: "M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1",
  close: "M6 6l12 12M18 6 6 18",
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

export default function SidebarRail() {
  const d = SAMPLE;
  const [shown, setShown] = useState(d.sections[0].id);
  const [current, setCurrent] = useState({ section: d.sections[0].id, page: d.sections[0].pages[0].id });
  const drawer = useNavDrawer();

  const shownSection = d.sections.find((s) => s.id === shown) ?? d.sections[0];
  const currentSection = d.sections.find((s) => s.id === current.section) ?? d.sections[0];
  const page = currentSection.pages.find((p) => p.id === current.page) ?? currentSection.pages[0];

  const open = (sectionId: string, pageId: string) => (e: MouseEvent) => {
    e.preventDefault();
    setCurrent({ section: sectionId, page: pageId });
    drawer.setOpen(false);
  };

  return (
    <div className="fl-snv-frame">
      <header className="fl-snv-topbar">
        <button
          ref={drawer.menuRef}
          type="button"
          className="fl-snv-iconbtn"
          aria-label={d.menuLabel}
          aria-expanded={drawer.open}
          aria-controls="sidebar-rail-side"
          onClick={() => drawer.setOpen(true)}
        >
          <Icon name="menu" />
        </button>
        <span className="fl-snv-mark" aria-hidden="true">
          {d.mark}
        </span>
        <span className="fl-snv-topbar__title">
          <strong>{currentSection.label}</strong>
          <span>{page.label}</span>
        </span>
      </header>

      <div className={`fl-snv-backdrop${drawer.open ? " is-open" : ""}`} onClick={() => drawer.setOpen(false)} aria-hidden="true" />

      <aside
        id="sidebar-rail-side"
        ref={drawer.panelRef}
        className={`fl-snv-side fl-snv-railside${drawer.open ? " is-open" : ""}`}
        role={drawer.open ? "dialog" : undefined}
        aria-modal={drawer.open ? true : undefined}
        aria-label={drawer.open ? d.product : undefined}
        tabIndex={-1}
      >
        <nav aria-label="Main" className="fl-snv-railnav">
        <div className="fl-snv-rail">
          <span className="fl-snv-mark" role="img" aria-label={d.product}>
            {d.mark}
          </span>
          <ul className="fl-snv-list" aria-label="Sections">
            {d.sections.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="fl-snv-railbtn"
                  aria-pressed={shown === s.id}
                  aria-current={current.section === s.id ? "true" : undefined}
                  aria-controls="sidebar-rail-panel"
                  onClick={() => setShown(s.id)}
                >
                  <Glyph name={s.icon} />
                  <span className="fl-snv-tip">{s.label}</span>
                  {current.section === s.id && shown !== s.id && <span className="fl-snv-railbtn__dot" aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
          <div className="fl-snv-rail__end">
            <span className="fl-person__avatar" role="img" aria-label={`Signed in as ${d.person.name}`}>
              <span aria-hidden="true">{d.person.initials}</span>
            </span>
          </div>
        </div>

        <div id="sidebar-rail-panel" className="fl-snv-panel">
          <div className="fl-snv-panel__head">
            <h2 id="sidebar-rail-panel-title">{shownSection.label}</h2>
            <button type="button" className="fl-snv-iconbtn fl-snv-close" aria-label={d.closeLabel} onClick={() => drawer.setOpen(false)}>
              <Glyph name="close" />
            </button>
          </div>
          <p className="fl-snv-panel__text">{shownSection.text}</p>
          <ul className="fl-snv-list" aria-labelledby="sidebar-rail-panel-title">
            {shownSection.pages.map((p) => (
              <li key={p.id}>
                <a
                  href={`#${shownSection.id}-${p.id}`}
                  className="fl-snv-item"
                  aria-current={current.section === shownSection.id && current.page === p.id ? "page" : undefined}
                  onClick={open(shownSection.id, p.id)}
                >
                  <span className="fl-snv-label">{p.label}</span>
                  {p.count > 0 && <span className="fl-snv-count">{p.count}</span>}
                </a>
              </li>
            ))}
          </ul>
        </div>
        </nav>
      </aside>

      <section className="fl-snv-main" aria-labelledby="sidebar-rail-title" aria-live="polite">
        <div className="fl-snv-main__head">
          <ol className="fl-snv-crumbs" aria-label="You are here">
            <li>{currentSection.label}</li>
            <li>{page.label}</li>
          </ol>
          <h2 id="sidebar-rail-title" className="fl-title">
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
