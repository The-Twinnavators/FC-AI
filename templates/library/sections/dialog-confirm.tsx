/** @flowcode-library dialog-confirm · Confirm dialog (classic) (Dialogs and drawers)
 * Catalog ID: c.modal@classic-confirm (component version)
 * Version of: c.modal
 * Function: A destructive confirmation (Delete this booking?) with Cancel focused first and a danger-colored confirm, then a result message with Undo.
 * Use it as: import { Modal } from "./modals-dialogs"; <Modal version="classic-confirm" title description? icon="trash" warning? cancelLabel? confirmLabel busy? busyLabel? onConfirm?() onClose contained?/>  // onConfirm may return false to stay open (a busy delete)
 * Look: A small alert dialog on a dimmed backdrop with a round danger icon beside the title, a muted sentence, a red warning line, and Cancel (focused first) next to a danger-colored confirm button.
 * Tokens: --color-surface --color-border --color-text --color-text-muted --color-danger --radius-xl --space-4 --space-6 --duration-base --easing
 * Use cases: delete confirmation; cancel booking; remove item; discard changes; destructive action; cancel subscription; archive confirmation
 * Jobs to be done: avoid deleting something by mistake; confirm i really want to cancel; undo a deletion i regret
 * Keywords: dialog, modal, confirm, delete, undo
 */
/**
 * Dialog: confirm a destructive action. This is c.modal@classic-confirm with this piece's sample content; the
 * implementation lives in the component, in ./modals-dialogs. A booking with a Delete button that opens a small alert
 * dialog asking "Delete this booking?", with Cancel (focused first, the safe choice) and a danger-coloured Delete. The
 * result shows on the page with an Undo. Make it the app's own: replace SAMPLE with the item and the words for what is
 * lost.
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "./buttons-variants";
import { Modal } from "./modals-dialogs";

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

export default function DialogConfirm() {
  const d = SAMPLE;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [result, setResult] = useState<"" | "deleted" | "kept">("");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <section className="fl-section" aria-labelledby="dialog-confirm-title">
      <div className="fl-wrap fl-wrap--narrow fl-dlg-stage">
        <h2 id="dialog-confirm-title" className="fl-title fl-title--md">
          {d.heading}
        </h2>
        {deleted ? (
          <div className="fl-dlg-empty">
            <strong>{d.emptyTitle}</strong>
            <span>{d.emptyText}</span>
          </div>
        ) : (
          <article className="fl-card">
            <h3>{d.booking.title}</h3>
            <p className="fl-text">
              {d.booking.when}
              <br />
              {d.booking.where} · {d.booking.seats}
            </p>
            <div className="fl-actions">
              <Button variant="secondary" size={40} icon="trash" aria-haspopup="dialog" onClick={() => setOpen(true)}>
                {d.trigger}
              </Button>
            </div>
          </article>
        )}
        <p className={`fl-dlg-status${result === "deleted" ? " fl-dlg-status--ok" : ""}`} role="status" aria-live="polite">
          {result === "deleted" && (
            <>
              {d.deleted}
              <button type="button" className="fl-dlg-link" onClick={() => (setDeleted(false), setResult(""))}>
                {d.undo}
              </button>
            </>
          )}
          {result === "kept" && d.kept}
        </p>
      </div>
      {open && (
        <Modal
          version="classic-confirm"
          title={d.dialogTitle}
          description={d.dialogText}
          icon="trash"
          warning={d.warning}
          cancelLabel={d.cancel}
          confirmLabel={d.confirm}
          busy={busy}
          busyLabel={d.busy}
          onConfirm={() => {
            setBusy(true);
            // A short pause stands in for the real delete call so the busy state can be seen.
            timer.current = window.setTimeout(() => {
              setBusy(false);
              setDeleted(true);
              setResult("deleted");
              setOpen(false);
            }, 700);
            return false;
          }}
          onClose={() => (setOpen(false), setResult("kept"))}
        />
      )}
    </section>
  );
}
