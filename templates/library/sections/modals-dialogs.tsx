/** @flowcode-library modals-dialogs - Modals: confirm, destructive, form and the one you cannot dismiss (Dialogs and drawers)
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
 */
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  kinds: [
    { id: "confirm", label: "Confirm", what: "One decision, nothing lost either way", open: "Publish the gallery" },
    { id: "danger", label: "Destructive", what: "Names what goes, and cannot be undone", open: "Delete the shoot" },
    { id: "form", label: "A short form", what: "A few fields, then save or cancel", open: "Invite someone" },
    { id: "blocking", label: "Cannot be dismissed", what: "A choice that has to be made", open: "Your session expired" },
  ],
};

function Dialog({ kind, onClose, say }: { kind: string; onClose: () => void; say: (s: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const blocking = kind === "blocking";
  const danger = kind === "danger";

  useEffect(() => {
    const first = box.current?.querySelector<HTMLElement>("button, input, select, textarea, [href]");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !blocking) {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !box.current) return;
      // Focus stays inside: that is the whole difference between a dialog and a box that looks like one.
      const able = [...box.current.querySelectorAll<HTMLElement>("button, input, select, textarea, [href]")].filter((el) => !el.hasAttribute("disabled"));
      if (!able.length) return;
      const edge = e.shiftKey ? able[0] : able[able.length - 1];
      if (document.activeElement === edge) {
        e.preventDefault();
        (e.shiftKey ? able[able.length - 1] : able[0]).focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [blocking, onClose]);

  return (
    <div className="fl-ctl-dlg-stage">
      <div className="fl-ctl-scrim" onClick={() => !blocking && onClose()} />
      <div
        className={`fl-ctl-dlg${danger ? " fl-ctl-dlg--danger" : ""}`}
        role={danger || blocking ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={`dlg-${kind}-title`}
        aria-describedby={`dlg-${kind}-body`}
        ref={box}
      >
        <div className="fl-ctl-dlg-head">
          <h4 id={`dlg-${kind}-title`}>
            {kind === "confirm" ? "Publish this gallery?" : danger ? "Delete Riverside wedding?" : kind === "form" ? "Invite someone to the studio" : "You have been signed out"}
          </h4>
          {blocking ? null : (
            <button type="button" className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--icon fl-ctl-btn--32" aria-label="Close" onClick={onClose}>
              <Icon name="close" />
            </button>
          )}
        </div>

        <div className="fl-ctl-dlg-body" id={`dlg-${kind}-body`}>
          {kind === "confirm" ? <p>The client gets an email with the link. You can unpublish at any time.</p> : null}
          {danger ? <p>420 photos and the whole client conversation go with it. This cannot be undone.</p> : null}
          {kind === "form" ? (
            <div className="fl-ctl-live-form">
              <p>
                <label htmlFor="dlg-email">Their email address</label>
                <input id="dlg-email" className="fl-input fl-ctl-field fl-ctl-field--outlined fl-ctl-field--40" type="email" placeholder="you@example.com" />
              </p>
              <p>
                <label htmlFor="dlg-role">What they may do</label>
                <span className="fl-ctl-select">
                  <select id="dlg-role" className="fl-input fl-ctl-field fl-ctl-field--outlined fl-ctl-field--40">
                    <option>Look at everything</option>
                    <option>Edit shoots</option>
                    <option>Run the studio</option>
                  </select>
                  <Icon name="chevron-down" />
                </span>
              </p>
            </div>
          ) : null}
          {blocking ? <p>It has been two hours since you signed in. Sign in again to carry on; nothing you typed was lost.</p> : null}
        </div>

        <div className="fl-ctl-dlg-foot">
          {blocking ? null : (
            <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--40" onClick={onClose}>
              Cancel
            </button>
          )}
          <button
            type="button"
            className={`fl-btn fl-ctl-btn--40 ${danger ? "fl-ctl-btn--destructive" : "fl-btn--primary"}`}
            onClick={() => {
              say(kind === "confirm" ? "Gallery published" : danger ? "Shoot deleted" : kind === "form" ? "Invitation sent" : "Signed in again");
              onClose();
            }}
          >
            {kind === "confirm" ? "Publish gallery" : danger ? "Delete shoot" : kind === "form" ? "Send the invitation" : "Sign in again"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ModalsDialogs() {
  const d = SAMPLE;
  const [open, setOpen] = useState("");
  const [said, setSaid] = useState("");
  const from = useRef<HTMLButtonElement | null>(null);

  const close = () => {
    setOpen("");
    from.current?.focus();
  };

  return (
    <section className="fl-section fl-section--specimen">
      <ul className="fl-ctl-dlg-list">
        {d.kinds.map((k) => (
          <li key={k.id}>
            <p className="fl-ctl-matrix-kind">{k.label}</p>
            <p className="fl-ctl-matrix-what">{k.what}</p>
            <button
              type="button"
              className={`fl-btn fl-ctl-btn--40 ${k.id === "danger" ? "fl-ctl-btn--destructive" : "fl-btn--secondary"}`}
              onClick={(e) => {
                from.current = e.currentTarget;
                setOpen(k.id);
              }}
            >
              {k.open}
            </button>
          </li>
        ))}
      </ul>

      {open ? <Dialog kind={open} onClose={close} say={setSaid} /> : null}

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
