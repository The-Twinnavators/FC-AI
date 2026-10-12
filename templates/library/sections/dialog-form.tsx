/** @flowcode-library dialog-form · Form dialog (classic) (Dialogs and drawers)
 * Catalog ID: c.modal@classic-form (component version)
 * Version of: c.modal
 * Function: A New booking dialog with checked fields that, on save, adds the booking to a list on the page.
 * Use it as: import { Modal } from "./modals-dialogs"; <Modal version="classic-form" title description? cancelLabel? confirmLabel busy? onConfirm?(formData) onClose contained?>fields</Modal>  // fields are .fl-field label + input blocks; onConfirm returns false to stay open when a check fails
 * Look: A titled dialog with a line of context under the title, a plain close button at the top right, stacked labelled fields on the page's own form styles and Cancel next to a primary save button.
 * Tokens: --color-surface --color-border --color-text --color-danger --radius-xl --space-1 --space-4 --space-6 --duration-base --easing
 * Use cases: new booking; add item; quick create; new task; add contact; new appointment; create event; add expense
 * Jobs to be done: add a new item without leaving the page; book an appointment quickly; create an entry with the right details; fix mistakes before saving
 * Keywords: dialog, modal, form, validation
 */
/**
 * Dialog: short form. This is c.modal@classic-form with this piece's sample content; the implementation lives in the
 * component, in ./modals-dialogs. A "New booking" button opens a dialog with name, date and time; it checks each field,
 * shows errors next to them, and on save adds the booking to the list on the page. Make it the app's own: replace SAMPLE
 * with the real fields and times; keep the form to three or four fields.
 */
import { useState } from "react";
import { Button } from "./buttons-variants";
import { Modal } from "./modals-dialogs";

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
    time: "Choose a time.",
  },
  cancel: "Cancel",
  save: "Save booking",
  saved: "Booking saved for",
  emptyTitle: "No bookings yet",
  emptyText: "Use New booking to add your first one.",
  starter: [
    { id: "b1", name: "Ana Ruiz", date: "2026-11-02", time: "10:30" },
    { id: "b2", name: "Tom Okafor", date: "2026-11-05", time: "18:00" },
  ],
};

type Errors = Partial<Record<"name" | "date" | "time", string>>;

export default function DialogForm() {
  const d = SAMPLE;
  const [bookings, setBookings] = useState(d.starter);
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState("");

  const err = (key: keyof Errors) =>
    errors[key] ? (
      <p id={`dialog-form-${key}-error`} className="fl-dlg-error">
        {errors[key]}
      </p>
    ) : null;
  const bad = (key: keyof Errors) => ({ "aria-invalid": errors[key] ? true : undefined, "aria-describedby": errors[key] ? `dialog-form-${key}-error` : undefined });

  return (
    <section className="fl-section fl-section--tint" aria-labelledby="dialog-form-title">
      <div className="fl-wrap fl-wrap--narrow fl-dlg-stage">
        <div className="fl-dlg-bar">
          <div style={{ display: "grid", gap: "var(--space-1)" }}>
            <h2 id="dialog-form-title" className="fl-title fl-title--md">
              {d.heading}
            </h2>
            <p className="fl-text">{d.lede}</p>
          </div>
          <Button icon="plus" aria-haspopup="dialog" onClick={() => (setStatus(""), setErrors({}), setOpen(true))}>
            {d.add}
          </Button>
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
                    {b.date} · {b.time}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="fl-dlg-status fl-dlg-status--ok" role="status" aria-live="polite">
          {status}
        </p>
      </div>
      {open && (
        <Modal
          version="classic-form"
          title={d.dialogTitle}
          description={d.dialogText}
          cancelLabel={d.cancel}
          confirmLabel={d.save}
          onConfirm={(form) => {
            const name = String(form.get("name") ?? "").trim();
            const date = String(form.get("date") ?? "");
            const time = String(form.get("time") ?? "");
            const next: Errors = {};
            if (name.length < 2) next.name = d.errors.name;
            if (!date) next.date = d.errors.date;
            if (!time) next.time = d.errors.time;
            setErrors(next);
            if (next.name || next.date || next.time) return false;
            setBookings((list) => [...list, { id: `b${list.length + 1}`, name, date, time }]);
            setStatus(`${d.saved} ${name}.`);
          }}
          onClose={() => (setOpen(false), setErrors({}))}
        >
          <div className="fl-field">
            <label htmlFor="dialog-form-name">{d.labels.name}</label>
            <input id="dialog-form-name" name="name" className="fl-input" autoComplete="name" data-autofocus {...bad("name")} />
            {err("name")}
          </div>
          <div className="fl-dlg-grid">
            <div className="fl-field">
              <label htmlFor="dialog-form-date">{d.labels.date}</label>
              <input id="dialog-form-date" name="date" type="date" className="fl-input" {...bad("date")} />
              {err("date")}
            </div>
            <div className="fl-field">
              <label htmlFor="dialog-form-time">{d.labels.time}</label>
              <span className="fl-dlg-select">
                <select id="dialog-form-time" name="time" className="fl-input" defaultValue="" {...bad("time")}>
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
              {err("time")}
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
