/** @flowcode-library sheet-bottom · Bottom sheet (Dialogs and drawers)
 * Use cases: mobile action menu; more options; share menu; item actions; mobile context menu; quick actions
 * Jobs to be done: share an item with someone; duplicate or archive an item; reach more actions on my phone
 * Keywords: bottom sheet, action sheet, mobile, more menu
 */
/**
 * Bottom sheet: more actions. A phone-style list where each item has a "More" button; it opens a sheet from the
 * bottom of the screen with Share, Duplicate and Archive. Use it on small screens for actions that do not fit on the
 * row. Make it the app's own: replace SAMPLE with the real items and actions; keep the list short and put the
 * destructive one last.
 */
import { useEffect, useRef, useState, type RefObject } from "react";

// flowcode:sample
const SAMPLE = {
  heading: "Household lists",
  lede: "Shared with everyone at home.",
  more: "More",
  sheetHint: "Choose what to do with this list.",
  options: {
    share: { label: "Share", hint: "Copy a link to send" },
    duplicate: { label: "Duplicate", hint: "Make a copy to edit" },
    archive: { label: "Archive", hint: "Hide it from this page" },
  },
  close: "Close",
  copied: "Link copied for",
  copyFailed: "Couldn't copy here. The link is",
  duplicated: "Made a copy:",
  archived: "Archived",
  undo: "Undo",
  copyPrefix: "Copy of",
  linkBase: "https://example.com/lists/",
  emptyTitle: "Nothing here",
  emptyText: "Archived lists stay out of the way until you need them.",
  lists: [
    { id: "groceries", title: "Weekly groceries", meta: "14 items · edited today" },
    { id: "chores", title: "Saturday chores", meta: "6 items · edited yesterday" },
    { id: "trip", title: "Camping trip packing", meta: "22 items · edited last week" },
  ],
};

type Item = { id: string; title: string; meta: string };
type Status = { text: string; undo?: { item: Item; index: number } } | null;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Traps Tab inside the panel, closes on Escape, locks page scroll and puts focus back where it came from. */
function useModal(open: boolean, onClose: () => void, fallback?: RefObject<HTMLElement | null>) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const items = () => Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
    (panel.querySelector<HTMLElement>("[data-autofocus]") ?? items()[0] ?? panel).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const list = items();
      if (list.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
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
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      if (opener && opener.isConnected) opener.focus();
      else fallback?.current?.focus();
    };
  }, [open, fallback]);
  return panelRef;
}

function Svg({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const PATHS = {
  more: "M5 12h.01M12 12h.01M19 12h.01",
  share: "M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5",
  duplicate: "M9 9h10v10H9zM5 15V5h10",
  archive: "M3 5h18v4H3zM5 9v10h14V9M10 13h4",
};

export default function SheetBottom() {
  const d = SAMPLE;
  const [items, setItems] = useState<Item[]>(d.lists);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const active = items.find((i) => i.id === activeId) ?? null;

  const close = () => setActiveId(null);
  const panelRef = useModal(active !== null, close, headingRef);

  const share = async (item: Item) => {
    const link = `${d.linkBase}${item.id}`;
    close();
    try {
      await navigator.clipboard.writeText(link);
      setStatus({ text: `${d.copied} ${item.title}.` });
    } catch {
      setStatus({ text: `${d.copyFailed} ${link}` });
    }
  };

  const duplicate = (item: Item) => {
    const copy: Item = { id: `${item.id}-${Date.now()}`, title: `${d.copyPrefix} ${item.title.toLowerCase()}`, meta: item.meta.replace(/edited .*/, "edited just now") };
    setItems((list) => {
      const at = list.findIndex((i) => i.id === item.id);
      return [...list.slice(0, at + 1), copy, ...list.slice(at + 1)];
    });
    setStatus({ text: `${d.duplicated} ${copy.title}.` });
    close();
  };

  const archive = (item: Item) => {
    const index = items.findIndex((i) => i.id === item.id);
    setItems((list) => list.filter((i) => i.id !== item.id));
    setStatus({ text: `${d.archived} ${item.title}.`, undo: { item, index } });
    close();
  };

  const undo = () => {
    const back = status?.undo;
    if (!back) return;
    setItems((list) => [...list.slice(0, back.index), back.item, ...list.slice(back.index)]);
    setStatus(null);
    headingRef.current?.focus();
  };

  return (
    <section className="fl-section fl-section--tint" aria-labelledby="sheet-bottom-title">
      <div className="fl-wrap fl-dlg-stage">
        <div className="fl-dlg-phone">
          <div style={{ display: "grid", gap: "var(--space-1)" }}>
            <h2 id="sheet-bottom-title" className="fl-title fl-title--md" ref={headingRef} tabIndex={-1}>
              {d.heading}
            </h2>
            <p className="fl-note" style={{ margin: 0 }}>
              {d.lede}
            </p>
          </div>

          {items.length === 0 ? (
            <div className="fl-dlg-empty">
              <strong>{d.emptyTitle}</strong>
              <span>{d.emptyText}</span>
            </div>
          ) : (
            <ul className="fl-dlg-list">
              {items.map((item) => (
                <li key={item.id} className="fl-dlg-row" style={{ flexWrap: "nowrap" }}>
                  <span className="fl-dlg-row__main">
                    <strong>{item.title}</strong>
                    <span className="fl-meta">{item.meta}</span>
                  </span>
                  <button type="button" className="fl-dlg-more" aria-haspopup="dialog" onClick={() => setActiveId(item.id)}>
                    <Svg d={PATHS.more} />
                    {d.more}
                    <span className="fl-sr"> for {item.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className={`fl-dlg-status${status && !status.text.startsWith(d.copyFailed) ? " fl-dlg-status--ok" : ""}`} role="status" aria-live="polite">
            {status?.text}
            {status?.undo && (
              <button type="button" className="fl-dlg-link" onClick={undo}>
                {d.undo}
              </button>
            )}
          </p>
        </div>
      </div>

      {active && (
        <div
          className="fl-dlg-backdrop fl-dlg-backdrop--sheet"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div ref={panelRef} className="fl-dlg-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-bottom-sheet-title" aria-describedby="sheet-bottom-sheet-hint" tabIndex={-1}>
            <span className="fl-dlg-handle" aria-hidden="true" />
            <div className="fl-dlg-sheet__head">
              <h2 id="sheet-bottom-sheet-title" className="fl-dlg-title" style={{ fontSize: "var(--text-lg)" }}>
                {active.title}
              </h2>
              <p id="sheet-bottom-sheet-hint" className="fl-note" style={{ margin: 0 }}>
                {d.sheetHint}
              </p>
            </div>
            <ul className="fl-dlg-options">
              <li>
                <button type="button" className="fl-dlg-option" onClick={() => void share(active)}>
                  <Svg d={PATHS.share} />
                  <span>
                    {d.options.share.label}
                    <small>{d.options.share.hint}</small>
                  </span>
                </button>
              </li>
              <li>
                <button type="button" className="fl-dlg-option" onClick={() => duplicate(active)}>
                  <Svg d={PATHS.duplicate} />
                  <span>
                    {d.options.duplicate.label}
                    <small>{d.options.duplicate.hint}</small>
                  </span>
                </button>
              </li>
              <li>
                <button type="button" className="fl-dlg-option fl-dlg-option--danger" onClick={() => archive(active)}>
                  <Svg d={PATHS.archive} />
                  <span>
                    {d.options.archive.label}
                    <small>{d.options.archive.hint}</small>
                  </span>
                </button>
              </li>
            </ul>
            <button type="button" className="fl-btn fl-btn--secondary" style={{ width: "100%" }} onClick={close}>
              {d.close}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
