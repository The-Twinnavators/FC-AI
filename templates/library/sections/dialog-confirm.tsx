/**
 * Dialog: confirm a destructive action. A booking card with a Delete button that opens a small modal asking "Delete
 * this booking?", with Cancel (focused first, the safe choice) and a danger-coloured Delete. The result shows on the
 * page with an Undo. Use it before anything that cannot be taken back. Make it the app's own: replace SAMPLE with the
 * item and the words for what is lost; keep Cancel as the first focus.
 */
import { useEffect, useRef, useState, type RefObject } from "react";

// flowcode:sample
const SAMPLE = {
  heading: "Your next booking",
  booking: { title: "Pottery taster class", when: "Saturday 14 June · 10:00", where: "Studio 2, 12 Harbour Street", seats: "2 seats" },
  trigger: "Delete booking",
  dialogTitle: "Delete this booking?",
  dialogText: "Your 2 seats on Saturday will go back to the waiting list. You can book again later if there is space.",
  warning: "This cannot be undone once you leave this page.",
  cancel: "Keep booking",
  confirm: "Delete booking",
  busy: "Deleting…",
  deleted: "Booking deleted. Your seats are back on the waiting list.",
  kept: "Nothing changed. Your booking is still on.",
  undo: "Undo",
  emptyTitle: "No upcoming bookings",
  emptyText: "When you book a class it shows up here.",
};

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

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </svg>
  );
}

export default function DialogConfirm() {
  const d = SAMPLE;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [result, setResult] = useState<"" | "deleted" | "kept">("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const timer = useRef<number | undefined>(undefined);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setResult("kept");
  };
  const panelRef = useModal(open, close, headingRef);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const confirm = () => {
    if (busy) return;
    setBusy(true);
    // A short pause stands in for the real delete call so the busy state can be seen.
    timer.current = window.setTimeout(() => {
      setBusy(false);
      setDeleted(true);
      setResult("deleted");
      setOpen(false);
    }, 700);
  };

  const undo = () => {
    setDeleted(false);
    setResult("");
    headingRef.current?.focus();
  };

  return (
    <section className="fl-section" aria-labelledby="dialog-confirm-title">
      <div className="fl-wrap fl-wrap--narrow fl-dlg-stage">
        <h2 id="dialog-confirm-title" className="fl-title fl-title--md" ref={headingRef} tabIndex={-1}>
          {d.heading}
        </h2>

        {deleted ? (
          <div className="fl-dlg-empty">
            <strong>{d.emptyTitle}</strong>
            <span>{d.emptyText}</span>
          </div>
        ) : (
          <article className="fl-card" aria-labelledby="dialog-confirm-booking">
            <h3 id="dialog-confirm-booking">{d.booking.title}</h3>
            <p className="fl-text">
              {d.booking.when}
              <br />
              {d.booking.where} · {d.booking.seats}
            </p>
            <div className="fl-actions">
              <button type="button" className="fl-btn fl-btn--secondary fl-dlg-btn--sm" aria-haspopup="dialog" onClick={() => setOpen(true)}>
                <TrashIcon />
                {d.trigger}
              </button>
            </div>
          </article>
        )}

        <p className={`fl-dlg-status${result === "deleted" ? " fl-dlg-status--ok" : ""}`} role="status" aria-live="polite">
          {result === "deleted" && (
            <>
              {d.deleted}
              <button type="button" className="fl-dlg-link" onClick={undo}>
                {d.undo}
              </button>
            </>
          )}
          {result === "kept" && d.kept}
        </p>
      </div>

      {open && (
        <div
          className="fl-dlg-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            ref={panelRef}
            className="fl-dlg-panel"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="dialog-confirm-dialog-title"
            aria-describedby="dialog-confirm-dialog-text"
            aria-busy={busy}
            tabIndex={-1}
          >
            <div className="fl-dlg-head" style={{ justifyContent: "flex-start", alignItems: "center" }}>
              <span className="fl-dlg-icon">
                <TrashIcon />
              </span>
              <h2 id="dialog-confirm-dialog-title" className="fl-dlg-title">
                {d.dialogTitle}
              </h2>
            </div>
            <p id="dialog-confirm-dialog-text" className="fl-dlg-body">
              {d.dialogText}
            </p>
            <p className="fl-dlg-warn">{d.warning}</p>
            <div className="fl-dlg-foot">
              <button type="button" className="fl-btn fl-btn--secondary" data-autofocus onClick={close} aria-disabled={busy}>
                {d.cancel}
              </button>
              <button type="button" className="fl-btn fl-dlg-btn--danger" onClick={confirm} aria-disabled={busy}>
                {busy ? d.busy : d.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
