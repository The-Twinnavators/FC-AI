import { describe, expect, it } from "vitest";
import { loadEvents, saveEvents, sortEvents, STORAGE_KEY } from "./storage";
import type { ScheduleEvent } from "./types";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

const ev = (id: string, date: string, time: string): ScheduleEvent => ({ id, title: id, date, time, notes: "", createdAt: "x", updatedAt: "x" });

describe("storage", () => {
  it("round-trips events", () => {
    const s = memoryStorage();
    saveEvents(s, [ev("a", "2026-10-01", "09:00")]);
    expect(loadEvents(s)).toHaveLength(1);
  });

  it("returns [] for corrupt JSON", () => {
    const s = memoryStorage();
    s.setItem(STORAGE_KEY, "{not json");
    expect(loadEvents(s)).toEqual([]);
  });

  it("sorts by date then time", () => {
    const sorted = sortEvents([ev("b", "2026-10-02", "08:00"), ev("a", "2026-10-01", "10:00"), ev("c", "2026-10-01", "09:00")]);
    expect(sorted.map((e) => e.id)).toEqual(["c", "a", "b"]);
  });
});
