/**
 * Dialog: short form. A "New booking" button opens a modal with name, date and time; it checks each field, shows
 * errors next to them, and on save adds the booking to the list on the page (kept in local storage). Use it for quick
 * adds that should not leave the page. Make it the app's own: replace SAMPLE with the real fields and times; keep the
 * form to three or four fields, or move it to its own page.
 */
import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";

// flowcode:sample
const SAMPLE = {
  heading: "Upcoming bookings",
  lede: "Book a table at the studio for a class or open session.",
  add: "New booking",
  dialogTitle: "New booking",
  dialogText: "We'll hold the table for 15 minutes after the start time.",
  labels: { name: "Name on the booking", date: "Date", time: "Time" },
  timePlaceholder: "Choose a time",
  times: ["09:00", "10:30", "12:00", "14:00", "15:30", "18:00"],
  errors: {
    name: "Enter the name the booking is for.",
    date: "Choose a date.",
    past: "Choose today or a later date.",
    time: "Choose a time.",
  },
  cancel: "Cancel",
  save: "Save booking",
  saved: "Booking saved for",
  remove: "Remove",
  removed: "Booking removed.",
  emptyTitle: "No bookings yet",
  emptyText: "Use New booking to add your first one.",
  storageKey: "flowcode-dialog-form-bookings",
  starter: [
    { id: "b1", name: "Ana Ruiz", date: "2026-11-02", time: "10:30" },
    { id: "b2", name: "Tom Okafor", date: "2026-11-05", time: "18:00" },
  ],
};

type Booking = { id: string; name: string; date: string; time: string };
type Errors = Partial<Record<"name" | "date" | "time", string>>;

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

function todayIso() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function prettyDate(iso: string) {
  const [y, m, day] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, day ?? 1);
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function load(): Booking[] {
  try {
    const raw = localStorage.getItem(SAMPLE.storageKey);
    if (raw) return JSON.parse(raw) as Booking[];
  } catch {
    /* storage unavailable: start from the sample list */
  }
  return SAMPLE.starter;
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export default function DialogForm() {
  const d = SAMPLE;
  const [bookings, setBookings] = useState<Booking[]>(load);
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const min = todayIso();

  const close = () => {
    setOpen(false);
    setErrors({});
  };
  const panelRef = useModal(open, close, headingRef);

  useEffect(() => {
    try {
      localStorage.setItem(d.storageKey, JSON.stringify(bookings));
    } catch {
      /* storage unavailable: the list still works for this visit */
    }
  }, [bookings, d.storageKey]);

  const openDialog = () => {
    setStatus("");
    setErrors({});
    setOpen(true);
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const date = String(form.get("date") ?? "");
    const time = String(form.get("time") ?? "");
    const next: Errors = {};
    if (name.length < 2) next.name = d.errors.name;
    if (!date) next.date = d.errors.date;
    else if (date < min) next.date = d.errors.past;
    if (!time) next.time = d.errors.time;
    setErrors(next);
    const firstBad = (["name", "date", "time"] as const).find((k) => next[k]);
    if (firstBad) {
      formRef.current?.querySelector<HTMLElement>(`[name="${firstBad}"]`)?.focus();
      return;
    }
    const booking: Booking = { id: `b${Date.now()}`, name, date, time };
    setBookings((list) => [...list, booking].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)));
    setStatus(`${d.saved} ${name}, ${prettyDate(date)} at ${time}.`);
    setOpen(false);
  };

  const remove = (id: string) => {
    setBookings((list) => list.filter((b) => b.id !== id));
    setStatus(d.removed);
    headingRef.current?.focus();
  };

  const field = (key: "name" | "date" | "time") => ({
    id: `dialog-form-${key}`,
    name: key,
    className: "fl-input",
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `dialog-form-${key}-error` : undefined,
  });

  const errorText = (key: "name" | "date" | "time") =>
    errors[key] ? (
      <p id={`dialog-form-${key}-error`} className="fl-dlg-error">
        {errors[key]}
      </p>
    ) : null;

  return (
    <section className="fl-section fl-section--tint" aria-labelledby="dialog-form-title">
      <div className="fl-wrap fl-wrap--narrow fl-dlg-stage">
        <div className="fl-dlg-bar">
          <div style={{ display: "grid", gap: "var(--space-1)" }}>
            <h2 id="dialog-form-title" className="fl-title fl-title--md" ref={headingRef} tabIndex={-1}>
              {d.heading}
            </h2>
            <p className="fl-text">{d.lede}</p>
          </div>
          <button type="button" className="fl-btn fl-btn--primary" aria-haspopup="dialog" onClick={openDialog}>
            <PlusIcon />
            {d.add}
          </button>
        </div>

        {bookings.length === 0 ? (
          <div className="fl-dlg-empty">
            <strong>{d.emptyTitle}</strong>
            <span>{d.emptyText}</span>
          </div>
        ) : (
          <ul className="fl-dlg-list">
            {bookings.map((b) => (
              <li key={b.id} className="fl-dlg-row">
                <span className="fl-dlg-row__main">
                  <strong>{b.name}</strong>
                  <span className="fl-meta">
                    {prettyDate(b.date)} · {b.time}
                  </span>
                </span>
                <button type="button" className="fl-btn fl-dlg-btn--ghost fl-dlg-btn--sm" onClick={() => remove(b.id)}>
                  {d.remove}
                  <span className="fl-sr"> {b.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className={`fl-dlg-status${status && status !== d.removed ? " fl-dlg-status--ok" : ""}`} role="status" aria-live="polite">
          {status}
        </p>
      </div>

      {open && (
        <div
          className="fl-dlg-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div ref={panelRef} className="fl-dlg-panel" role="dialog" aria-modal="true" aria-labelledby="dialog-form-dialog-title" aria-describedby="dialog-form-dialog-text" tabIndex={-1}>
            <div className="fl-dlg-head">
              <div style={{ display: "grid", gap: "var(--space-1)" }}>
                <h2 id="dialog-form-dialog-title" className="fl-dlg-title">
                  {d.dialogTitle}
                </h2>
                <p id="dialog-form-dialog-text" className="fl-note" style={{ margin: 0 }}>
                  {d.dialogText}
                </p>
              </div>
              <button type="button" className="fl-dlg-close" aria-label="Close" onClick={close}>
                <CloseIcon />
              </button>
            </div>
            <form ref={formRef} className="fl-form" noValidate onSubmit={submit}>
              <div className="fl-field">
                <label htmlFor="dialog-form-name">{d.labels.name}</label>
                <input {...field("name")} autoComplete="name" data-autofocus />
                {errorText("name")}
              </div>
              <div className="fl-dlg-grid">
                <div className="fl-field">
                  <label htmlFor="dialog-form-date">{d.labels.date}</label>
                  <input {...field("date")} type="date" min={min} />
                  {errorText("date")}
                </div>
                <div className="fl-field">
                  <label htmlFor="dialog-form-time">{d.labels.time}</label>
                  <span className="fl-dlg-select">
                    <select {...field("time")} defaultValue="">
                      <option value="" disabled>
                        {d.timePlaceholder}
                      </option>
                      {d.times.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </span>
                  {errorText("time")}
                </div>
              </div>
              <div className="fl-dlg-foot">
                <button type="button" className="fl-btn fl-btn--secondary" onClick={close}>
                  {d.cancel}
                </button>
                <button type="submit" className="fl-btn fl-btn--primary">
                  {d.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
