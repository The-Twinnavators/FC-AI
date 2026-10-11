/** @flowcode-library modals-dialogs · Modals: confirm, destructive, form and the one you cannot dismiss (Dialogs and drawers)
 * Catalog ID: c.modal (component)
 * Function: The one dialog over the page (c.modal), with focus trapping, Escape and focus return built in; the reference sheet shows confirm, destructive, short-form and blocking dialogs.
 * Use it as: import { Modal } from "./modals-dialogs"; <Modal variant?="confirm"|"danger"|"form"|"blocking" title confirmLabel cancelLabel? onConfirm? onClose contained?>body</Modal>
 * Variants: c.modal.confirm - one decision, nothing lost either way: a dialog with Cancel and a primary verb button; c.modal.danger - names what will be destroyed: an alert dialog with a danger rule on top and a destructive button; c.modal.form - a few fields then save or cancel: a dialog that holds focus until it is done; c.modal.blocking - a choice that has to be made: an alert dialog with no close button that ignores Escape and the scrim
 * Look: A rounded card centered over a dimmed scrim, with a title and close button on top, a short body, and right-aligned Cancel and verb buttons at the bottom.
 * Tokens: --color-surface --color-text-muted --color-danger --radius-lg --shadow-lg --space-3 --space-4 --space-5 --duration-med --easing --text-sm
 * Use cases: confirm before deleting; a short form over the page; sign-in prompt; unsaved changes; a required choice
 * Jobs to be done: decide one thing without losing the page; be stopped before something destructive; get back out
 * Keywords: modal, dialog, confirm, destructive, focus trap, escape, scrim, alertdialog
 */
/**
 * A dialog over the page, in the four shapes that cover almost all of them. The differences are not decoration: a
 * confirm can be dismissed any way you like; a destructive one names what it will destroy in the button; a form one
 * holds focus until it is saved or cancelled; and a blocking one has no close button because there is no "not yet".
 *
 * Each is a real dialog: focus moves in on open and back to the button on close, Tab cycles inside it, Escape closes
 * the ones that may be closed and is ignored by the one that may not. The destructive one is an alertdialog, which is
 * announced at once rather than waiting for a gap.
 *
 * Make it the app's own: put the verb in the button - "Delete shoot", never "OK" - and make the quiet option Cancel.
 * The dialog opens over the panel below the buttons so it can be seen here (the `contained` prop); in a page it covers
 * the window, which is the default.
 */
/**
 * How to try it
 * - Open any of the four. Focus moves into the dialog and back to the button that opened it.
 * - Tab around inside one: focus cannot leave it.
 * - Escape closes three of them and is ignored by the fourth, which is the point of that one.
 * - The scrim closes the ones that may be closed.
 *
 * Dependencies: React (useEffect, useId, useRef, useState), the library's own Button, TextField and Select, and its inline
 * icon set ("./icons"), which is a table of SVG paths rather than an icon package. Nothing else — no package to install and
 * nothing fetched at run time. The styles are the library's own fl- classes in templates/library/css, and the sample data
 * is in the file, so the piece runs in a built app exactly as it runs here.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "./buttons-variants";
import { Select } from "./dropdowns-states";
import { TextField } from "./text-fields-states";

// ── c.modal: the one dialog. Every piece's confirm, delete and short-form dialogs are this component. ──

export type ModalVariant = "confirm" | "danger" | "form" | "blocking";

// Written out in full (not built from the variant name) so a build finds every class the modal needs.
const VARIANT: Record<ModalVariant, string> = {
  confirm: "",
  danger: "fl-ctl-dlg--danger",
  form: "",
  blocking: "",
};

const FOCUSABLE = "button, input, select, textarea, [href]";

export function Modal({ variant = "confirm", title, children, confirmLabel, cancelLabel = "Cancel", onConfirm, onClose, contained, className }: {
  variant?: ModalVariant;
  /** The question or the name of the task. It is also the dialog's accessible name. */
  title: string;
  /** The body: a sentence, or a few fields. */
  children?: ReactNode;
  /** The verb on the main button: "Delete shoot", never "OK". */
  confirmLabel: string;
  cancelLabel?: string;
  /** Runs when the main button is pressed; the modal then closes itself through onClose. */
  onConfirm?: () => void;
  /** Close it: the parent stops rendering the modal. A blocking modal never calls this on Escape or the scrim. */
  onClose: () => void;
  /** Sit inside the nearest positioned box instead of covering the window (for demos and previews). */
  contained?: boolean;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  const blocking = variant === "blocking";
  const danger = variant === "danger";
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Focus goes in on open and back to whatever had it on close; Tab stays inside; Escape closes unless blocking.
  useEffect(() => {
    const from = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !blocking) {
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !box.current) return;
      // Focus stays inside: that is the whole difference between a dialog and a box that looks like one.
      const able = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute("disabled"));
      if (!able.length) return;
      const edge = e.shiftKey ? able[0] : able[able.length - 1];
      if (document.activeElement === edge) {
        e.preventDefault();
        (e.shiftKey ? able[able.length - 1] : able[0]).focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (from && document.contains(from)) from.focus();
    };
  }, [blocking]);

  return (
    <div className="fl-ctl-dlg-stage" style={contained ? undefined : { position: "fixed" }}>
      <div className="fl-ctl-scrim" onClick={() => !blocking && onClose()} />
      <div
        className={["fl-ctl-dlg", VARIANT[variant], className ?? ""].filter(Boolean).join(" ")}
        data-fl={`c.modal.${variant}`}
        role={danger || blocking ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-body`}
        ref={box}
      >
        <div className="fl-ctl-dlg-head">
          <h4 id={`${id}-title`}>{title}</h4>
          {blocking ? null : (
            <Button variant="tertiary" size={32} icon="close" iconOnly onClick={onClose}>
              Close
            </Button>
          )}
        </div>

        <div className="fl-ctl-dlg-body" id={`${id}-body`}>
          {children}
        </div>

        <div className="fl-ctl-dlg-foot">
          {blocking ? null : (
            <Button variant="secondary" size={40} onClick={onClose}>
              {cancelLabel}
            </Button>
          )}
          <Button
            variant={danger ? "destructive" : "primary"}
            size={40}
            onClick={() => {
              onConfirm?.();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  kinds: [
    { id: "confirm" as const, label: "Confirm", what: "One decision, nothing lost either way", open: "Publish the gallery" },
    { id: "danger" as const, label: "Destructive", what: "Names what goes, and cannot be undone", open: "Delete the shoot" },
    { id: "form" as const, label: "A short form", what: "A few fields, then save or cancel", open: "Invite someone" },
    { id: "blocking" as const, label: "Cannot be dismissed", what: "A choice that has to be made", open: "Your session expired" },
  ],
  dialogs: {
    confirm: { title: "Publish this gallery?", confirm: "Publish gallery", done: "Gallery published" },
    danger: { title: "Delete Riverside wedding?", confirm: "Delete shoot", done: "Shoot deleted" },
    form: { title: "Invite someone to the studio", confirm: "Send the invitation", done: "Invitation sent" },
    blocking: { title: "You have been signed out", confirm: "Sign in again", done: "Signed in again" },
  },
  roles: ["Look at everything", "Edit shoots", "Run the studio"],
};

function DialogBody({ kind }: { kind: ModalVariant }) {
  if (kind === "confirm") return <p>The client gets an email with the link. You can unpublish at any time.</p>;
  if (kind === "danger") return <p>420 photos and the whole client conversation go with it. This cannot be undone.</p>;
  if (kind === "blocking") return <p>It has been two hours since you signed in. Sign in again to carry on; nothing you typed was lost.</p>;
  return (
    <div className="fl-ctl-live-form">
      <p>
        <label htmlFor="dlg-email">Their email address</label>
        <TextField id="dlg-email" size={40} type="email" placeholder="you@example.com" />
      </p>
      <p>
        <label htmlFor="dlg-role">What they may do</label>
        <Select id="dlg-role" options={SAMPLE.roles} className="fl-ctl-field--40" />
      </p>
    </div>
  );
}

export default function ModalsDialogs() {
  const d = SAMPLE;
  const [open, setOpen] = useState<"" | ModalVariant>("");
  const [said, setSaid] = useState("");

  return (
    <section className="fl-section fl-section--specimen">
      <ul className="fl-ctl-dlg-list">
        {d.kinds.map((k) => (
          <li key={k.id}>
            <p className="fl-ctl-matrix-kind">{k.label}</p>
            <p className="fl-ctl-matrix-what">{k.what}</p>
            <Button variant={k.id === "danger" ? "destructive" : "secondary"} size={40} onClick={() => setOpen(k.id)}>
              {k.open}
            </Button>
          </li>
        ))}
      </ul>

      {/* The stage stands in for the page a dialog covers. In an app a modal covers the whole window; here it is
          `contained`, a box of its own, so the dialog opens beside the button that opened it rather than off-screen. */}
      <div className="fl-ctl-dlg-demo">
        {open ? (
          <Modal
            key={open}
            contained
            variant={open}
            title={d.dialogs[open].title}
            confirmLabel={d.dialogs[open].confirm}
            onConfirm={() => setSaid(d.dialogs[open].done)}
            onClose={() => setOpen("")}
          >
            <DialogBody kind={open} />
          </Modal>
        ) : (
          <p className="fl-ctl-matrix-what">Open one of the four above and it appears here, over this panel.</p>
        )}
      </div>

      <p className="fl-ctl-status" role="status" aria-live="polite">
        {said || "Open one. Tab around inside it; focus will not leave."}
      </p>

      <div className="fl-ctl-sizes">
        <h3>What makes it a dialog rather than a box</h3>
        <ul className="fl-ctl-tip-rules">
          <li>
            <strong>Focus goes in, and comes back.</strong>
            <span className="fl-ctl-matrix-what">The first control takes focus on open; the button that opened it takes focus back on close.</span>
          </li>
          <li>
            <strong>Tab cannot leave.</strong>
            <span className="fl-ctl-matrix-what">Otherwise a keyboard lands on the page behind, which is still there and still scrolling.</span>
          </li>
          <li>
            <strong>Escape closes it, except when it must not.</strong>
            <span className="fl-ctl-matrix-what">Only a choice that genuinely has no "not yet" earns the right to ignore Escape. Try it on the last one.</span>
          </li>
          <li>
            <strong>The button says the verb.</strong>
            <span className="fl-ctl-matrix-what">"Delete shoot", not "OK". People read the buttons before the sentence.</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
