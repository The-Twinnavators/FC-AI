/**
 * Drawer: details from the side. A list of bookings; choosing one slides a drawer in from the right with its details
 * and a few edits (seats, paid, a note). Saving updates the list. Use it to look at or tweak one item without losing
 * the list. Make it the app's own: replace SAMPLE with the real records and fields; keep edits to what fits on one
 * screen.
 */
import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";

// flowcode:sample
const SAMPLE = {
  heading: "This week's bookings",
  lede: "Choose a booking to see its details and make changes.",
  drawerLabel: "Booking details",
  labels: { class: "Class", when: "When", contact: "Contact", seats: "Seats", paid: "Paid in full", note: "Note for the teacher" },
  paid: "Paid",
  unpaid: "Payment due",
  maxSeats: 6,
  noteMax: 160,
  errors: { seats: "Choose between 1 and 6 seats.", note: "Keep the note under 160 characters." },
  cancel: "Cancel",
  save: "Save changes",
  updated: "Changes saved for",
  emptyTitle: "No bookings this week",
  emptyText: "New bookings will appear here.",
  bookings: [
    { id: "k1", client: "Maya Lund", className: "Wheel throwing, beginners", when: "Tue 14 Oct · 18:00", contact: "maya@example.com", seats: 1, paid: true, note: "" },
    { id: "k2", client: "Joel Baptiste", className: "Glazing workshop", when: "Thu 16 Oct · 10:30", contact: "+1 555 0142", seats: 2, paid: false, note: "Bringing a friend, first time." },
    { id: "k3", client: "Priya Nair", className: "Open studio", when: "Sat 18 Oct · 14:00", contact: "priya@example.com", seats: 1, paid: true, note: "Needs a wheel near the window." },
  ],
};

type Booking = (typeof SAMPLE.bookings)[number];
type Errors = { seats?: string; note?: string };

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

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
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

export default function DrawerSide() {
  const d = SAMPLE;
  const [bookings, setBookings] = useState<Booking[]>(d.bookings);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const selected = bookings.find((b) => b.id === selectedId) ?? null;

  const close = () => {
    setSelectedId(null);
    setErrors({});
  };
  const panelRef = useModal(selected !== null, close, headingRef);

  const openBooking = (id: string) => {
    setStatus("");
    setErrors({});
    setSelectedId(id);
  };

  const save = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selected) return;
    const form = new FormData(e.currentTarget);
    const seats = Number(form.get("seats"));
    const note = String(form.get("note") ?? "").trim();
    const paid = form.get("paid") === "on";
    const next: Errors = {};
    if (!Number.isInteger(seats) || seats < 1 || seats > d.maxSeats) next.seats = d.errors.seats;
    if (note.length > d.noteMax) next.note = d.errors.note;
    setErrors(next);
    if (next.seats || next.note) {
      e.currentTarget.querySelector<HTMLElement>(`[name="${next.seats ? "seats" : "note"}"]`)?.focus();
      return;
    }
    setBookings((list) => list.map((b) => (b.id === selected.id ? { ...b, seats, note, paid } : b)));
    setStatus(`${d.updated} ${selected.client}.`);
    close();
  };

  return (
    <section className="fl-section" aria-labelledby="drawer-side-title">
      <div className="fl-wrap fl-wrap--narrow fl-dlg-stage">
        <div style={{ display: "grid", gap: "var(--space-1)" }}>
          <h2 id="drawer-side-title" className="fl-title fl-title--md" ref={headingRef} tabIndex={-1}>
            {d.heading}
          </h2>
          <p className="fl-text">{d.lede}</p>
        </div>

        {bookings.length === 0 ? (
          <div className="fl-dlg-empty">
            <strong>{d.emptyTitle}</strong>
            <span>{d.emptyText}</span>
          </div>
        ) : (
          <ul className="fl-dlg-list">
            {bookings.map((b) => (
              <li key={b.id}>
                <button type="button" className="fl-dlg-row__btn" aria-haspopup="dialog" onClick={() => openBooking(b.id)}>
                  <span className="fl-dlg-row__main">
                    <strong>{b.client}</strong>
                    <span className="fl-meta">
                      {b.className} · {b.when}
                    </span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <span className={`fl-dlg-pill${b.paid ? " fl-dlg-pill--ok" : ""}`}>{b.paid ? d.paid : d.unpaid}</span>
                    <ChevronIcon />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className={`fl-dlg-status${status ? " fl-dlg-status--ok" : ""}`} role="status" aria-live="polite">
          {status}
        </p>
      </div>

      {selected && (
        <div
          className="fl-dlg-backdrop fl-dlg-backdrop--drawer"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div ref={panelRef} className="fl-dlg-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-side-drawer-title" tabIndex={-1}>
            <div className="fl-dlg-drawer__head">
              <div style={{ display: "grid", gap: "var(--space-1)" }}>
                <span className="fl-eyebrow">{d.drawerLabel}</span>
                <h2 id="drawer-side-drawer-title" className="fl-dlg-title">
                  {selected.client}
                </h2>
              </div>
              <button type="button" className="fl-dlg-close" aria-label="Close" onClick={close}>
                <CloseIcon />
              </button>
            </div>
            <form key={selected.id} id="drawer-side-form" className="fl-dlg-drawer__body" noValidate onSubmit={save}>
              <dl className="fl-dlg-details">
                <dt>{d.labels.class}</dt>
                <dd>{selected.className}</dd>
                <dt>{d.labels.when}</dt>
                <dd>{selected.when}</dd>
                <dt>{d.labels.contact}</dt>
                <dd style={{ overflowWrap: "anywhere" }}>{selected.contact}</dd>
              </dl>
              <div className="fl-field">
                <label htmlFor="drawer-side-seats">{d.labels.seats}</label>
                <input
                  id="drawer-side-seats"
                  name="seats"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={d.maxSeats}
                  defaultValue={selected.seats}
                  className="fl-input"
                  style={{ maxWidth: "8rem" }}
                  aria-invalid={errors.seats ? true : undefined}
                  aria-describedby={errors.seats ? "drawer-side-seats-error" : undefined}
                />
                {errors.seats && (
                  <p id="drawer-side-seats-error" className="fl-dlg-error">
                    {errors.seats}
                  </p>
                )}
              </div>
              <label className="fl-dlg-check">
                <input type="checkbox" name="paid" defaultChecked={selected.paid} />
                {d.labels.paid}
              </label>
              <div className="fl-field">
                <label htmlFor="drawer-side-note">{d.labels.note}</label>
                <textarea
                  id="drawer-side-note"
                  name="note"
                  className="fl-input"
                  defaultValue={selected.note}
                  aria-invalid={errors.note ? true : undefined}
                  aria-describedby={errors.note ? "drawer-side-note-error drawer-side-note-hint" : "drawer-side-note-hint"}
                />
                <p id="drawer-side-note-hint" className="fl-note" style={{ margin: 0 }}>
                  Up to {d.noteMax} characters.
                </p>
                {errors.note && (
                  <p id="drawer-side-note-error" className="fl-dlg-error">
                    {errors.note}
                  </p>
                )}
              </div>
            </form>
            <div className="fl-dlg-drawer__foot">
              <button type="button" className="fl-btn fl-btn--secondary" onClick={close}>
                {d.cancel}
              </button>
              <button type="submit" form="drawer-side-form" className="fl-btn fl-btn--primary">
                {d.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
