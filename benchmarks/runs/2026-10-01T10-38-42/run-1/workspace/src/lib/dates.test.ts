import { describe, expect, it } from "vitest";
import { formatDisplayDate, todayIso } from "./dates";

describe("formatDisplayDate", () => {
  it("formats a date and time", () => {
    expect(formatDisplayDate("2026-10-14", "09:30")).toBe("Wed, Oct 14 · 09:30");
  });
  it("returns the input for invalid dates", () => {
    expect(formatDisplayDate("not-a-date")).toBe("not-a-date");
  });
});

describe("todayIso", () => {
  it("pads month and day", () => {
    expect(todayIso(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
