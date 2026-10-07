import { useState } from "react";
import { EventForm } from "./components/EventForm";
import { EventList } from "./components/EventList";
import { useSchedule } from "./scheduler/useSchedule";

export default function App() {
  const { events, status, error, addEvent, updateEvent, deleteEvent } = useSchedule();
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = events.find((e) => e.id === editingId);

  const remove = (id: string) => {
    deleteEvent(id);
    if (id === editingId) setEditingId(null);
  };

  return (
    <div className="shell">
      <header className="shell__header">
        <h1 className="shell__title">Schedule</h1>
        <p className="shell__subtitle">Private to this device. Nothing leaves your browser.</p>
      </header>
      <main className="shell__main schedule-layout">
        <EventForm
          key={editing?.id ?? "new"}
          initial={editing ? { title: editing.title, date: editing.date, time: editing.time, notes: editing.notes } : undefined}
          onSubmit={(values) => {
            if (editing) {
              updateEvent(editing.id, values);
              setEditingId(null);
            } else addEvent(values);
          }}
          onCancel={() => setEditingId(null)}
        />
        <section className="schedule-layout__list" aria-labelledby="upcoming-heading">
          <h2 id="upcoming-heading" className="section-title">
            Upcoming
          </h2>
          {status === "loading" ? (
            <p role="status" className="state">
              Loading your schedule…
            </p>
          ) : status === "error" ? (
            <p role="alert" className="state state--error">
              {error}
            </p>
          ) : events.length === 0 ? (
            <div className="state state--empty">
              <h3 className="state__title">No events yet</h3>
              <p className="muted">Add your first event with the form. It is saved on this device only.</p>
            </div>
          ) : (
            <EventList events={events} onEdit={setEditingId} onDelete={remove} />
          )}
          {status === "ready" && error ? (
            <p role="alert" className="state state--error">
              {error}
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
