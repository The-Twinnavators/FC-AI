import { formatDisplayDate } from "../lib/dates";
import type { ScheduleEvent } from "../scheduler/types";

interface Props {
  events: ScheduleEvent[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function EventList({ events, onEdit, onDelete }: Props) {
  return (
    <ul className="event-list" aria-label="Scheduled events">
      {events.map((e) => (
        <li key={e.id} className="event-card">
          <div className="event-card__body">
            <h3 className="event-card__title">{e.title}</h3>
            <time className="event-card__when" dateTime={`${e.date}T${e.time}`}>
              {formatDisplayDate(e.date, e.time)}
            </time>
            {e.notes ? <p className="event-card__notes">{e.notes}</p> : null}
          </div>
          <div className="event-card__actions">
            <button className="button button--ghost" type="button" aria-label={`Edit ${e.title}`} onClick={() => onEdit(e.id)}>
              Edit
            </button>
            <button className="button button--danger" type="button" aria-label={`Delete ${e.title}`} onClick={() => onDelete(e.id)}>
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
