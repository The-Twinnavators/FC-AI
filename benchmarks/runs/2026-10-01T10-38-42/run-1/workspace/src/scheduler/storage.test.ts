import { describe, it, expect } from "vitest";
import { STORAGE_KEY, loadEvents, saveEvents, sortEvents } from "./storage";

describe("storage", () => {
  it("round trip", () => {
    const storage = {
      getItem: (key: string) => {
        if (key === STORAGE_KEY) return "[{\"id\":\"1\",\"title\":\"Test\",\"date\":\"2023-01-01\",\"time\":\"12:00\",\"notes\":\"\",\"createdAt\":\"2023-01-01T12:00:00Z\",\"updatedAt\":\"2023-01-01T12:00:00Z\"}]";
        return null;
      },
      setItem: (key: string, value: string) => {
        // No-op
      }
    };

    const events = loadEvents(storage);
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Test");

    saveEvents(storage, events);
  });

  it("corrupt JSON returns empty array", () => {
    const storage = {
      getItem: (key: string) => {
        if (key === STORAGE_KEY) return "{invalid: JSON}";
        return null;
      },
      setItem: (key: string, value: string) => {
        // No-op
      }
    };

    const events = loadEvents(storage);
    expect(events).toHaveLength(0);
  });

  it("sortEvents orders by date then time", () => {
    const events = [
      { id: "1", title: "B", date: "2023-01-01", time: "12:00", notes: "", createdAt: "2023-01-01T12:00:00Z", updatedAt: "2023-01-01T12:00:00Z" },
      { id: "2", title: "A", date: "2023-01-01", time: "11:00", notes: "", createdAt: "2023-01-01T12:00:00Z", updatedAt: "2023-01-01T12:00:00Z" },
      { id: "3", title: "C", date: "2023-01-02", time: "10:00", notes: "", createdAt: "2023-01-01T12:00:00Z", updatedAt: "2023-01-01T12:00:00Z" }
    ];

    const sorted = sortEvents(events);
    expect(sorted[0].title).toBe("A");
    expect(sorted[1].title).toBe("B");
    expect(sorted[2].title).toBe("C");
  });
});