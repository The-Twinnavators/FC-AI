import type { ScheduleEvent } from "./types";

export const STORAGE_KEY = "flowcode.scheduler.v1";

function isEvent(value: unknown): value is ScheduleEvent {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return ["id", "title", "date", "time", "notes", "createdAt", "updatedAt"].every((k) => typeof v[k] === "string");
}

export function loadEvents(storage: Pick<Storage, "getItem">): ScheduleEvent[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isEvent) : [];
  } catch {
    return [];
  }
}

export function saveEvents(storage: Pick<Storage, "setItem">, events: ScheduleEvent[]): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(events));
}

export function sortEvents(events: ScheduleEvent[]): ScheduleEvent[] {
  return [...events].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}
