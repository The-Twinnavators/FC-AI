/**
 * A button that asks before doing something destructive, inline: the first click swaps it for the question with a
 * confirm and a cancel button. Used instead of window.confirm(), which embedded browsers block (making buttons that rely
 * on it silently do nothing).
 */
import { useState, type ReactNode } from "react";

export function ConfirmButton({
  children,
  question,
  confirmLabel = "Yes, do it",
  cancelLabel = "Keep it",
  onConfirm,
  className = "btn btn--sm btn--danger-ghost",
  disabled,
  "data-cp": cp,
}: {
  /** An anchor for the Copilot's journeys. */
  "data-cp"?: string;
  children: ReactNode;
  question: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  className?: string;
  disabled?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className={className} data-cp={cp} disabled={disabled} onClick={() => setAsking(true)}>
        {children}
      </button>
    );
  }
  return (
    <span className="confirm-inline" role="group" aria-label={question}>
      <span className="confirm-inline__q">{question}</span>
      <button
        type="button"
        className="btn btn--sm btn--danger"
        autoFocus
        onClick={() => {
          setAsking(false);
          void onConfirm();
        }}
      >
        {confirmLabel}
      </button>
      <button type="button" className="btn btn--sm" onClick={() => setAsking(false)}>
        {cancelLabel}
      </button>
    </span>
  );
}
