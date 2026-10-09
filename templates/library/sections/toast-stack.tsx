/** @flowcode-library toast-stack · Toast notifications (Alerts and states)
 * Use cases: notifications; save confirmation; undo action; background task updates; activity alerts; error notifications; upload complete
 * Jobs to be done: know my action worked; undo something i did by mistake; stay aware of updates while working; notice errors without losing my place
 * Keywords: toast, snackbar, notification, undo
 */
/**
 * Toasts: short notices that stack in the bottom-right corner after an action. They close by themselves after a few
 * seconds (the timer pauses while the pointer or keyboard focus is on one), can be closed by hand or with Escape, and
 * are announced to screen readers. One carries an "Undo". Use them to confirm an action without interrupting. Make it
 * the app's own: replace SAMPLE and call `push` wherever the app finishes an action worth confirming.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

// flowcode:sample
const SAMPLE = {
  title: "Your basket",
  lede: "Try the buttons: each one confirms with a toast.",
  basket: ["Pottery for beginners · Sat 11:00", "Life drawing · Tue 19:00", "Printmaking taster · Sun 14:00"],
  durationMs: 5000,
  toasts: {
    saved: { tone: "success", title: "Details saved", text: "Your name and phone number are up to date." },
    removed: { tone: "info", title: "Class removed", text: "" },
    failed: { tone: "error", title: "Payment didn't go through", text: "Nothing was charged. Check the card details and try again." },
    reminder: { tone: "info", title: "Reminder set", text: "We'll text you the evening before each class." },
  },
};

type Tone = "info" | "success" | "error";
type Toast = { id: number; tone: Tone; title: string; text: string; undo?: () => void };

const PATH: Record<Tone, string> = {
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01",
  success: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12.5l2.5 2.5L16 9.5",
  error: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 9l6 6M15 9l-6 6",
};

function ToastItem({ toast, duration, onClose }: { toast: Toast; duration: number; onClose: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(duration);
  const startedAt = useRef(0);

  useEffect(() => {
    if (paused) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(() => onClose(toast.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    };
  }, [paused, toast.id, onClose]);

  const onKey = (e: KeyboardEvent<HTMLLIElement>) => {
    if (e.key === "Escape") onClose(toast.id);
  };

  return (
    <li
      className={`fl-alr-toast fl-alr-tone-${toast.tone}`}
      data-paused={paused}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
      onKeyDown={onKey}
    >
      <span className="fl-alr__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={PATH[toast.tone]} />
        </svg>
      </span>
      <div className="fl-alr__body" style={{ paddingTop: 0 }}>
        <p className="fl-alr__title">{toast.title}</p>
        {toast.text && <p className="fl-alr__text">{toast.text}</p>}
        {toast.undo && (
          <button
            type="button"
            className="fl-alr-toast__undo"
            onClick={() => {
              toast.undo?.();
              onClose(toast.id);
            }}
          >
            Undo
          </button>
        )}
      </div>
      <button type="button" className="fl-alr__close" aria-label={`Close: ${toast.title}`} onClick={() => onClose(toast.id)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
      <span className="fl-alr-toast__bar" style={{ animationDuration: `${duration}ms` }} aria-hidden="true" />
    </li>
  );
}

export default function ToastStack() {
  const d = SAMPLE;
  const [basket, setBasket] = useState<string[]>(d.basket);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const close = useRef((id: number) => setToasts((t) => t.filter((x) => x.id !== id))).current;
  const push = (t: Omit<Toast, "id">) => setToasts((all) => [...all, { ...t, id: nextId.current++ }].slice(-4));

  const removeLast = () => {
    const item = basket[basket.length - 1];
    if (!item) return;
    const index = basket.length - 1;
    setBasket((b) => b.slice(0, -1));
    push({
      tone: "info",
      title: d.toasts.removed.title,
      text: item,
      undo: () => setBasket((b) => [...b.slice(0, index), item, ...b.slice(index)]),
    });
  };

  const show = (key: "saved" | "failed" | "reminder") => {
    const t = d.toasts[key];
    push({ tone: t.tone as Tone, title: t.title, text: t.text });
  };

  return (
    <section className="fl-section" aria-labelledby="toast-stack-title">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <h2 id="toast-stack-title" className="fl-title fl-title--md">
            {d.title}
          </h2>
          <p className="fl-text">{d.lede}</p>
        </div>
        <div className="fl-card" style={{ gap: "var(--space-5)" }}>
          {basket.length === 0 ? (
            <p className="fl-text">Your basket is empty. Undo the last removal to get a class back.</p>
          ) : (
            <ul className="fl-alr-log" aria-label="Classes in your basket">
              {basket.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
          <div className="fl-actions">
            <button type="button" className="fl-btn fl-btn--primary" onClick={() => show("saved")}>
              Save details
            </button>
            <button type="button" className="fl-btn fl-btn--secondary" onClick={removeLast} disabled={basket.length === 0} style={basket.length === 0 ? { opacity: "var(--disabled-opacity)", cursor: "not-allowed" } : undefined}>
              Remove last class
            </button>
            <button type="button" className="fl-btn fl-btn--secondary" onClick={() => show("reminder")}>
              Set reminder
            </button>
            <button type="button" className="fl-btn fl-btn--secondary" onClick={() => show("failed")}>
              Try a failed payment
            </button>
          </div>
        </div>
      </div>
      <div role="region" aria-label="Notifications">
        <ol className="fl-alr-toasts" aria-live="polite" aria-relevant="additions">
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} duration={d.durationMs} onClose={close} />
          ))}
        </ol>
      </div>
    </section>
  );
}
