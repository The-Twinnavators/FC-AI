import { useState, type FormEvent } from "react";
import type { ScheduleInput } from "../scheduler/types";

interface Props {
  initial?: ScheduleInput;
  onSubmit: (values: ScheduleInput) => void;
  onCancel?: () => void;
}

const EMPTY: ScheduleInput = { title: "", date: "", time: "", notes: "" };

export function EventForm({ initial, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<ScheduleInput>(initial ?? EMPTY);
  const editing = Boolean(initial);

  const set = (key: keyof ScheduleInput) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({ ...values, title: values.title.trim() });
    if (!editing) setValues(EMPTY);
  };

  return (
    <form className="panel event-form" onSubmit={submit}>
      <h2 className="event-form__title">{editing ? "Edit event" : "New event"}</h2>
      <div className="field">
        <label className="field__label" htmlFor="event-title">Title</label>
        <input id="event-title" className="field__input" value={values.title} onChange={set("title")} required />
      </div>
      <div className="event-form__row">
        <div className="field">
          <label className="field__label" htmlFor="event-date">Date</label>
          <input id="event-date" className="field__input" type="date" value={values.date} onChange={set("date")} required />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="event-time">Time</label>
          <input id="event-time" className="field__input" type="time" value={values.time} onChange={set("time")} required />
        </div>
      </div>
      <div className="field">
        <label className="field__label" htmlFor="event-notes">Notes</label>
        <textarea id="event-notes" className="field__input event-form__notes" value={values.notes} onChange={set("notes")} rows={3} />
      </div>
      <div className="event-form__actions">
        <button className="button" type="submit">{editing ? "Save" : "Add event"}</button>
        {editing && onCancel ? (
          <button className="button button--ghost" type="button" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
