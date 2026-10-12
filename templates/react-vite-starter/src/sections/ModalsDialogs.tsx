/** @flowcode-library modals-dialogs · Modals: confirm, destructive, form and the one you cannot dismiss (Dialogs and drawers)
 * Catalog ID: c.modal (component)
 * Function: The one dialog over the page (c.modal), with focus trapping, scroll lock, Escape and focus return built in; the reference sheet shows confirm, destructive (with an icon, a warning box and a busy delete), short-form (with validation that keeps it open) and blocking dialogs.
 * Use it as: import { Modal } from "./ModalsDialogs"; <Modal variant?="confirm"|"danger"|"form"|"blocking" title description? icon? warning? confirmLabel cancelLabel? busy? busyLabel? onConfirm?(formData) onClose contained? version?="standard"|"classic-confirm"|"classic-form">body</Modal>  // version: classic-confirm = c.modal@classic-confirm, classic-form = c.modal@classic-form (they ignore variant)
 * Variants: c.modal.confirm - one decision, nothing lost either way: a dialog with Cancel and a primary verb button; c.modal.danger - names what will be destroyed: an alert dialog with a danger rule on top and a destructive button; c.modal.form - a few fields then save or cancel: a dialog that holds focus until it is done; c.modal.blocking - a choice that has to be made: an alert dialog with no close button that ignores Escape and the scrim
 * Look: A rounded card centered over a dimmed scrim, with a title and close button on top, a short body, and right-aligned Cancel and verb buttons at the bottom.
 * Tokens: --color-surface --color-text-muted --color-danger --radius-lg --shadow-lg --space-3 --space-4 --space-5 --duration-med --easing --text-sm --color-border --color-danger-surface
 * Use cases: confirm before deleting; a short form over the page; sign-in prompt; unsaved changes; a required choice; delete confirmation; cancel booking; remove item; discard changes; destructive action; cancel subscription; archive confirmation; new booking; add item; quick create; new task; add contact; new appointment; create event; add expense
 * Jobs to be done: decide one thing without losing the page; be stopped before something destructive; get back out; avoid deleting something by mistake; confirm i really want to cancel; undo a deletion i regret; add a new item without leaving the page; book an appointment quickly; create an entry with the right details; fix mistakes before saving
 * Keywords: modal, dialog, confirm, destructive, focus trap, escape, scrim, alertdialog, delete, undo, form, validation
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
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "./ButtonsVariants";
import { Select } from "./DropdownsStates";
import { Icon } from "./icons";
import { TextField } from "./TextFieldsStates";

// ── c.modal: the one dialog. Every piece's confirm, delete and short-form dialogs are this component. ──

export type ModalVariant = "confirm" | "danger" | "form" | "blocking";

// Written out in full (not built from the variant name) so a build finds every class the modal needs.
const VARIANT: Record<ModalVariant, string> = {
  confirm: "",
  danger: "fl-ctl-dlg--danger",
  form: "",
  blocking: "",
};

/**
 * The design: standard (the card with a close button on top), classic-confirm (a small alert dialog with an icon beside the
 * title and the safe choice focused first) or classic-form (a titled form dialog with a plain close button and fields on
 * the page's own form styles). The classic versions ignore `variant`.
 */
export type ModalVersion = "standard" | "classic-confirm" | "classic-form";

const FOCUSABLE = "button, input, select, textarea, [href]";

export function Modal({ variant = "confirm", version = "standard", title, description, icon, warning, children, confirmLabel, cancelLabel = "Cancel", busyLabel, busy, onConfirm, onClose, contained, className }: {
  variant?: ModalVariant;
  /** Which design: "standard" (default), "classic-confirm" or "classic-form". The classic ones ignore `variant`. */
  version?: ModalVersion;
  /** The question or the name of the task. It is also the dialog's accessible name. */
  title: string;
  /** A line of context under the title, such as what happens next. Part of the dialog's accessible description. */
  description?: ReactNode;
  /** An icon name from ./icons, drawn in a round danger-tinted badge above the title. Meant for the danger variant. */
  icon?: string;
  /** A red warning box above the body, for what cannot be undone. Meant for the danger variant. */
  warning?: ReactNode;
  /** The body: a sentence, or a few fields. A form modal wraps it in a <form>, so name the fields. */
  children?: ReactNode;
  /** The verb on the main button: "Delete shoot", never "OK". */
  confirmLabel: string;
  cancelLabel?: string;
  /** While true the main button shows `busyLabel`, and Escape, the scrim and both buttons do nothing (a save in flight). */
  busy?: boolean;
  /** The main button's words while busy: "Deleting...". */
  busyLabel?: string;
  /**
   * Runs when the main button is pressed; the modal then closes itself through onClose. Return false to stay open (a
   * failed check, or a save the parent will finish and close). A form modal receives the form's FormData and runs this
   * on submit, so Enter in a field confirms.
   */
  onConfirm?: (data: FormData) => void | false;
  /** Close it: the parent stops rendering the modal. A blocking modal never calls this on Escape or the scrim. */
  onClose: () => void;
  /** Sit inside the nearest positioned box instead of covering the window (for demos and previews). */
  contained?: boolean;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  const classicConfirm = version === "classic-confirm";
  const classicForm = version === "classic-form";
  const blocking = !classicConfirm && !classicForm && variant === "blocking";
  const danger = classicConfirm || variant === "danger";
  const isForm = classicForm || variant === "form";
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  // Focus goes in on open and back to whatever had it on close; Tab stays inside; Escape closes unless blocking.
  // A destructive dialog lands on Cancel, the safe choice. Over a whole window the page behind stops scrolling.
  useEffect(() => {
    const from = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    if (!contained) document.body.style.overflow = "hidden";
    (box.current?.querySelector<HTMLElement>("[data-autofocus]") ?? box.current?.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !blocking) {
        if (busyRef.current) return;
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
      document.body.style.overflow = overflow;
      if (from && document.contains(from)) from.focus();
    };
  }, [blocking, contained]);

  const confirm = (data: FormData) => {
    if (busy) return;
    if (onConfirm?.(data) === false) return;
    onClose();
  };
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    confirm(new FormData(e.currentTarget));
  };

  // The form wraps the head, body and buttons without taking part in the layout.
  const wrap = (inner: ReactNode) =>
    isForm ? (
      <form noValidate onSubmit={submit} style={{ display: "contents" }}>
        {inner}
      </form>
    ) : (
      inner
    );

  // c.modal@classic-confirm: the original delete-confirmation dialog (an icon beside the title, Cancel focused first).
  if (classicConfirm) {
    return (
      <div className="fl-dlg-backdrop" style={contained ? { position: "absolute" } : undefined} onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
        <div
          ref={box}
          className={["fl-dlg-panel", className ?? ""].filter(Boolean).join(" ")}
          data-fl="c.modal@classic-confirm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-body`}
          aria-busy={busy || undefined}
          tabIndex={-1}
        >
          <div className="fl-dlg-head" style={{ justifyContent: "flex-start", alignItems: "center" }}>
            {icon ? (
              <span className="fl-dlg-icon">
                <Icon name={icon} />
              </span>
            ) : null}
            <h2 id={`${id}-title`} className="fl-dlg-title">
              {title}
            </h2>
          </div>
          <div id={`${id}-body`} className="fl-dlg-body">
            {description ? <p style={{ margin: 0 }}>{description}</p> : null}
            {children}
          </div>
          {warning ? <p className="fl-dlg-warn">{warning}</p> : null}
          <div className="fl-dlg-foot">
            <Button variant="secondary" data-autofocus aria-disabled={busy || undefined} onClick={() => !busy && onClose()}>
              {cancelLabel}
            </Button>
            <Button variant="destructive" className="fl-dlg-btn--danger" aria-disabled={busy || undefined} onClick={() => confirm(new FormData())}>
              {busy && busyLabel ? busyLabel : confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // c.modal@classic-form: the original short-form dialog (title and a line of context, a plain close button, a form).
  if (classicForm) {
    return (
      <div className="fl-dlg-backdrop" style={contained ? { position: "absolute" } : undefined} onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
        <div
          ref={box}
          className={["fl-dlg-panel", className ?? ""].filter(Boolean).join(" ")}
          data-fl="c.modal@classic-form"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${id}-title`}
          aria-describedby={description ? `${id}-body` : undefined}
          aria-busy={busy || undefined}
          tabIndex={-1}
        >
          <div className="fl-dlg-head">
            <div style={{ display: "grid", gap: "var(--space-1)" }}>
              <h2 id={`${id}-title`} className="fl-dlg-title">
                {title}
              </h2>
              {description ? (
                <p id={`${id}-body`} className="fl-note" style={{ margin: 0 }}>
                  {description}
                </p>
              ) : null}
            </div>
            <button type="button" className="fl-dlg-close" aria-label="Close" disabled={busy} onClick={onClose}>
              <Icon name="close" />
            </button>
          </div>
          <form className="fl-form" noValidate onSubmit={submit}>
            {children}
            <div className="fl-dlg-foot">
              <Button variant="secondary" disabled={busy} onClick={onClose}>
                {cancelLabel}
              </Button>
              <Button type="submit" aria-disabled={busy || undefined}>
                {busy && busyLabel ? busyLabel : confirmLabel}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fl-ctl-dlg-stage" style={contained ? undefined : { position: "fixed" }}>
      {/* Pointer shortcut only: Escape and the Close/Cancel buttons do the same, so the backdrop stays out of the accessibility tree. */}
      <div className="fl-ctl-scrim" aria-hidden="true" onClick={() => !blocking && !busy && onClose()} />
      <div
        className={["fl-ctl-dlg", VARIANT[variant], className ?? ""].filter(Boolean).join(" ")}
        data-fl={`c.modal.${variant}`}
        role={danger || blocking ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-body`}
        aria-busy={busy || undefined}
        ref={box}
      >
        {wrap(
          <>
          {icon ? (
            <span className="fl-dlg-icon">
              <Icon name={icon} />
            </span>
          ) : null}
          <div className="fl-ctl-dlg-head">
            <h4 id={`${id}-title`}>{title}</h4>
            {blocking ? null : (
              <Button variant="tertiary" size={32} icon="close" iconOnly disabled={busy} onClick={onClose}>
                Close
              </Button>
            )}
          </div>

          <div className="fl-ctl-dlg-body" id={`${id}-body`}>
            {description ? <p>{description}</p> : null}
            {warning ? <p className="fl-dlg-warn">{warning}</p> : null}
            {children}
          </div>

          <div className="fl-ctl-dlg-foot">
            {blocking ? null : (
              <Button variant="secondary" size={40} disabled={busy} data-autofocus={danger ? "" : undefined} onClick={onClose}>
                {cancelLabel}
              </Button>
            )}
            <Button
              variant={danger ? "destructive" : "primary"}
              size={40}
              type={isForm ? "submit" : "button"}
              aria-disabled={busy || undefined}
              onClick={isForm ? undefined : () => confirm(new FormData())}
            >
              {busy && busyLabel ? busyLabel : confirmLabel}
            </Button>
          </div>
          </>,
        )}
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

function DialogBody({ kind, error }: { kind: ModalVariant; error?: string }) {
  if (kind === "confirm") return <p>The client gets an email with the link. You can unpublish at any time.</p>;
  if (kind === "danger") return <p>420 photos and the whole client conversation go with it. This cannot be undone.</p>;
  if (kind === "blocking") return <p>It has been two hours since you signed in. Sign in again to carry on; nothing you typed was lost.</p>;
  return (
    <div className="fl-ctl-live-form">
      <p>
        <label htmlFor="dlg-email">Their email address</label>
        <TextField id="dlg-email" name="email" size={40} type="email" placeholder="you@example.com" invalid={!!error} aria-describedby={error ? "dlg-email-error" : undefined} />
        {error ? (
          <span id="dlg-email-error" className="fl-dlg-error">
            {error}
          </span>
        ) : null}
      </p>
      <p>
        <label htmlFor="dlg-role">What they may do</label>
        <Select id="dlg-role" name="role" options={SAMPLE.roles} className="fl-ctl-field--40" />
      </p>
    </div>
  );
}

export default function ModalsDialogs() {
  const d = SAMPLE;
  const [open, setOpen] = useState<"" | ModalVariant>("");
  const [said, setSaid] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ver, setVer] = useState<"" | "classic-confirm" | "classic-form">("");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // A destructive confirm shows its work: the button goes busy, then the dialog closes. A form that fails its check
  // stays open and says why. Both are the same Modal; it is the parent that decides when it is done.
  const confirm = (kind: ModalVariant) => (data: FormData) => {
    if (kind === "danger") {
      setBusy(true);
      timer.current = window.setTimeout(() => {
        setBusy(false);
        setSaid(d.dialogs.danger.done);
        setOpen("");
      }, 700);
      return false;
    }
    if (kind === "form" && !String(data.get("email") ?? "").includes("@")) {
      setError("Enter their full email address.");
      return false;
    }
    setError("");
    setSaid(d.dialogs[kind].done);
  };

  return (
    <section className="fl-section fl-section--specimen">
      {/* The buttons on the left, the panel they open into on the right. */}
      <div className="fl-ctl-spec fl-ctl-spec--wide fl-ctl-spec--bare">
        <div className="fl-ctl-dlg-split">
          <div className="fl-ctl-dlg-pick">
            <ul className="fl-ctl-dlg-list">
              {d.kinds.map((k) => (
                <li key={k.id}>
                  <p className="fl-ctl-matrix-kind">{k.label}</p>
                  <p className="fl-ctl-matrix-what">{k.what}</p>
                  <Button variant={k.id === "danger" ? "destructive" : "secondary"} size={40} onClick={() => (setVer(""), setOpen(k.id))}>
                    {k.open}
                  </Button>
                </li>
              ))}
            </ul>

            <div className="fl-ctl-sizes">
              <h3>Versions</h3>
              <p className="fl-ctl-btn-what">Two older designs, chosen with version. Open one and it appears in the panel.</p>
              <ul className="fl-ctl-dlg-list">
                <li>
                  <p className="fl-ctl-matrix-kind">c.modal@classic-confirm</p>
                  <p className="fl-ctl-matrix-what">An alert dialog with an icon beside the title; Cancel is focused first.</p>
                  <Button variant="secondary" size={40} onClick={() => (setOpen(""), setVer("classic-confirm"))}>
                    Delete booking
                  </Button>
                </li>
                <li>
                  <p className="fl-ctl-matrix-kind">c.modal@classic-form</p>
                  <p className="fl-ctl-matrix-what">A titled form dialog with a plain close button.</p>
                  <Button variant="secondary" size={40} onClick={() => (setOpen(""), setVer("classic-form"))}>
                    New booking
                  </Button>
                </li>
              </ul>
            </div>
          </div>

          {/* The stage stands in for the page a dialog covers. In an app a modal covers the whole window; here it is
              `contained`, a box of its own, so the dialog opens beside the button that opened it rather than off-screen. */}
          <div className="fl-ctl-dlg-demo">
            {ver === "classic-confirm" ? (
              <Modal
                key={ver}
                contained
                version="classic-confirm"
                title="Delete this booking?"
                description="Your 2 seats on Saturday will go back to the waiting list. You can book again later if there is space."
                icon="trash"
                warning="This cannot be undone once you leave this page."
                cancelLabel="Keep booking"
                confirmLabel="Delete booking"
                busy={busy}
                busyLabel="Deleting..."
                onConfirm={() => {
                  setBusy(true);
                  timer.current = window.setTimeout(() => {
                    setBusy(false);
                    setSaid("Booking deleted");
                    setVer("");
                  }, 700);
                  return false;
                }}
                onClose={() => setVer("")}
              />
            ) : ver === "classic-form" ? (
              <Modal
                key={ver}
                contained
                version="classic-form"
                title="New booking"
                description="We'll hold the table for 15 minutes after the start time."
                confirmLabel="Save booking"
                onConfirm={(data) => {
                  if (!String(data.get("name") ?? "").trim()) {
                    setError("Enter the name the booking is for.");
                    return false;
                  }
                  setError("");
                  setSaid("Booking saved");
                }}
                onClose={() => (setError(""), setVer(""))}
              >
                <div className="fl-field">
                  <label htmlFor="dlg-classic-name">Name on the booking</label>
                  <input id="dlg-classic-name" name="name" className="fl-input" autoComplete="name" data-autofocus aria-invalid={error ? true : undefined} aria-describedby={error ? "dlg-classic-name-error" : undefined} />
                  {error ? (
                    <p id="dlg-classic-name-error" className="fl-dlg-error">
                      {error}
                    </p>
                  ) : null}
                </div>
              </Modal>
            ) : open ? (
              <Modal
                key={open}
                contained
                variant={open}
                title={d.dialogs[open].title}
                confirmLabel={d.dialogs[open].confirm}
                icon={open === "danger" ? "trash" : undefined}
                warning={open === "danger" ? "This cannot be undone once you leave this page." : undefined}
                busy={busy}
                busyLabel="Deleting..."
                onConfirm={confirm(open)}
                onClose={() => (setError(""), setOpen(""))}
              >
                <DialogBody kind={open} error={error} />
              </Modal>
            ) : (
              <p className="fl-ctl-matrix-what">Open one of the dialogs and it appears here, over this panel.</p>
            )}
          </div>
        </div>

        <p className="fl-ctl-status" role="status" aria-live="polite">
          {said || "Open one. Tab around inside it; focus will not leave."}
        </p>
      </div>

      <div className="fl-ctl-sizes fl-ctl-spec">
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
