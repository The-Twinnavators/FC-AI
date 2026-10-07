import { useCallback, useEffect, useState } from "react";
import { loadEvents, saveEvents, sortEvents } from "./storage";
import type { ScheduleEvent, ScheduleInput } from "./types";

type Status = "loading" | "ready" | "error";

export function useSchedule() {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setEvents(sortEvents(loadEvents(window.localStorage)));
      setStatus("ready");
    } catch {
      setError("Your schedule could not be loaded because browser storage is unavailable.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (status !== "ready") return;
    try {
      saveEvents(window.localStorage, events);
    } catch {
      setError("Changes could not be saved to this device.");
    }
  }, [events, status]);

  const addEvent = useCallback((input: ScheduleInput) => {
    const now = new Date().toISOString();
    setEvents((prev) => sortEvents([...prev, { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now }]));
  }, []);

  const updateEvent = useCallback((id: string, input: ScheduleInput) => {
    setEvents((prev) => sortEvents(prev.map((e) => (e.id === id ? { ...e, ...input, updatedAt: new Date().toISOString() } : e))));
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return { events, status, error, addEvent, updateEvent, deleteEvent };
}
