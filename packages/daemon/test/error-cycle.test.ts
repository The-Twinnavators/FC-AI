/** The progress detector: edits that keep cycling through the same type errors end the attempt (Calendar test 7). */
import { describe, expect, it } from "vitest";
import { errorCycle } from "../src/orchestrator/tools.js";

const EVENT = ["src/components/CalendarDay.tsx(26,27): error TS2339: Property 'id' does not exist on type 'Event'."];
const UNDEFINED = ["src/components/CalendarDay.tsx(4,40): error TS2304: Cannot find name 'CalendarEvent'."];
const NEVER = ["src/components/CalendarDay.tsx(15,17): error TS2345: Argument of type '{ id: string; }[]' is not assignable to parameter of type 'SetStateAction<never[]>'."];

describe("error cycle detector", () => {
  it("stops when an earlier error set comes back after different ones", () => {
    const h: string[] = [];
    expect(errorCycle(h, EVENT)).toBe(false);
    expect(errorCycle(h, UNDEFINED)).toBe(false);
    expect(errorCycle(h, NEVER)).toBe(false);
    // Back to the DOM Event errors, on a different line: that's the loop.
    expect(errorCycle(h, ["src/components/CalendarDay.tsx(27,25): error TS2339: Property 'id' does not exist on type 'Event'."])).toBe(true);
  });

  it("allows the same errors twice in a row (one fix attempt), but not a third time", () => {
    const h: string[] = [];
    expect(errorCycle(h, EVENT)).toBe(false);
    expect(errorCycle(h, EVENT)).toBe(false);
    expect(errorCycle(h, EVENT)).toBe(true);
  });

  it("never stops while the errors keep changing and shrinking", () => {
    const h: string[] = [];
    expect(errorCycle(h, [...EVENT, ...UNDEFINED, ...NEVER])).toBe(false);
    expect(errorCycle(h, [...EVENT, ...UNDEFINED])).toBe(false);
    expect(errorCycle(h, EVENT)).toBe(false);
  });
});
