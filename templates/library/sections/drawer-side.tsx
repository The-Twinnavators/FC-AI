/** @flowcode-library drawer-side · Side drawer (side panel) (Dialogs and drawers)
 * Catalog ID: c.drawer@side-panel (component version)
 * Version of: c.drawer
 * Function: Choosing a list item slides in a drawer from the right with its details and edits.
 * Use it as: import { Drawer } from "./panels-drawers"; <Drawer version="side-panel" open onClose={(via) => ...} title eyebrow? actions?>details and fields</Drawer>  // always a full-window drawer from the right; put a <form id> in the body and a submit Button with form="id" in actions
 * Look: A full-height panel sliding in from the right over a dimmed page, with a small eyebrow and title, a plain close button, a scrolling body of details and fields, and a tinted footer for Cancel and Save.
 * Tokens: --color-surface --color-surface-sunken --color-border --space-3 --space-5 --duration-slow --easing
 * Use cases: record details; edit panel; order details; contact details; task details; ticket details; quick view; inspector panel
 * Jobs to be done: see the details of an item; edit an item without losing my place; check an order while scanning the list; update a record quickly
 * Keywords: drawer, side panel, details, edit
 */
/**
 * Drawer: details from the side. This is c.drawer@side-panel with this piece's sample content; the implementation lives
 * in the component, in ./panels-drawers. A list of bookings; choosing one slides a drawer in from the right with its
 * details and a few edits (seats, paid, a note). Saving updates the list. Make it the app's own: replace SAMPLE with the
 * real records and fields; keep edits to what fits on one screen.
 */
import { useState, type FormEvent } from "react";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { Drawer } from "./panels-drawers";

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
  bookings: [
    { id: "k1", client: "Maya Lund", className: "Wheel throwing, beginners", when: "Tue 14 Oct · 18:00", contact: "maya@example.com", seats: 1, paid: true, note: "" },
    { id: "k2", client: "Joel Baptiste", className: "Glazing workshop", when: "Thu 16 Oct · 10:30", contact: "+1 555 0142", seats: 2, paid: false, note: "Bringing a friend, first time." },
    { id: "k3", client: "Priya Nair", className: "Open studio", when: "Sat 18 Oct · 14:00", contact: "priya@example.com", seats: 1, paid: true, note: "Needs a wheel near the window." },
  ],
};

export default function DrawerSide() {
  const d = SAMPLE;
  const [bookings, setBookings] = useState(d.bookings);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ seats?: string; note?: string }>({});
  const [status, setStatus] = useState("");
  const selected = bookings.find((b) => b.id === selectedId) ?? null;
  const close = () => (setSelectedId(null), setErrors({}));

  const save = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selected) return;
    const form = new FormData(e.currentTarget);
    const seats = Number(form.get("seats"));
    const note = String(form.get("note") ?? "").trim();
    const next: typeof errors = {};
    if (!Number.isInteger(seats) || seats < 1 || seats > d.maxSeats) next.seats = d.errors.seats;
    if (note.length > d.noteMax) next.note = d.errors.note;
    setErrors(next);
    if (next.seats || next.note) return;
    setBookings((list) => list.map((b) => (b.id === selected.id ? { ...b, seats, note, paid: form.get("paid") === "on" } : b)));
    setStatus(`${d.updated} ${selected.client}.`);
    close();
  };

  return (
    <section className="fl-section" aria-labelledby="drawer-side-title">
      <div className="fl-wrap fl-wrap--narrow fl-dlg-stage">
        <div style={{ display: "grid", gap: "var(--space-1)" }}>
          <h2 id="drawer-side-title" className="fl-title fl-title--md">
            {d.heading}
          </h2>
          <p className="fl-text">{d.lede}</p>
        </div>
        <ul className="fl-dlg-list">
          {bookings.map((b) => (
            <li key={b.id}>
              <button type="button" className="fl-dlg-row__btn" aria-haspopup="dialog" onClick={() => (setStatus(""), setErrors({}), setSelectedId(b.id))}>
                <span className="fl-dlg-row__main">
                  <strong>{b.client}</strong>
                  <span className="fl-meta">
                    {b.className} · {b.when}
                  </span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <span className={`fl-dlg-pill${b.paid ? " fl-dlg-pill--ok" : ""}`}>{b.paid ? d.paid : d.unpaid}</span>
                  <Icon name="chevron-right" />
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className={`fl-dlg-status${status ? " fl-dlg-status--ok" : ""}`} role="status" aria-live="polite">
          {status}
        </p>
      </div>
      <Drawer
        version="side-panel"
        open={selected !== null}
        eyebrow={d.drawerLabel}
        title={selected?.client ?? ""}
        onClose={close}
        actions={
          <>
            <Button variant="secondary" onClick={close}>
              {d.cancel}
            </Button>
            <Button type="submit" form="drawer-side-form">
              {d.save}
            </Button>
          </>
        }
      >
        {selected && (
          <form key={selected.id} id="drawer-side-form" noValidate onSubmit={save} style={{ display: "contents" }}>
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
                aria-describedby={errors.note ? "drawer-side-note-error" : undefined}
              />
              {errors.note && (
                <p id="drawer-side-note-error" className="fl-dlg-error">
                  {errors.note}
                </p>
              )}
            </div>
          </form>
        )}
      </Drawer>
    </section>
  );
}
