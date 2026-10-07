/**
 * "Are you sure?" dialog for actions that remove something. The safe choice (Cancel) has focus first, so Enter or
 * Escape never removes anything by accident.
 */
import { useEffect, useId, useRef } from "react";
import { Modal } from "./Modal";

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const id = useId();
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => cancel.current?.focus(), []);
  return (
    <Modal onClose={onCancel} labelledBy={id} className="confirm-dlg">
      <h2 id={id} className="confirm-dlg__title">
        {title}
      </h2>
      <div className="confirm-dlg__body">{children}</div>
      <div className="confirm-dlg__actions">
        <button ref={cancel} type="button" className="btn" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" className="btn btn--danger" disabled={busy} onClick={onConfirm}>
          {busy ? "Removing…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
