export const STORAGE_KEY = "flowcode.scheduler.v1";

export function loadEvents(storage: Pick<Storage, "getItem">): ScheduleEvent[] {
  try {
    const data = storage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

export function saveEvents(storage: Pick<Storage, "setItem">, events: ScheduleEvent[]): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(events));
}

import { ScheduleEvent } from "./types";

export function sortEvents(events: ScheduleEvent[]): ScheduleEvent[] {
  return [...events].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.time.localeCompare(b.time);
  });
}