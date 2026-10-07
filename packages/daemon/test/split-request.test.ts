/** A request listing several changes can be sent as separate changes (D5). */
import { describe, expect, it } from "vitest";
import { splitRequest } from "../../../apps/ui/src/components/splitRequest";

describe("splitRequest", () => {
  it("splits numbered and bulleted lists, carrying the intro as context", () => {
    const parts = splitRequest("Two small fixes (change nothing else):\n1. Make the header blue\n2. Add an empty state to the task list\n   with a short hint");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatch(/^Make the header blue\n\nFrom a larger request: Two small fixes/);
    expect(parts[1]).toMatch(/^Add an empty state to the task list\nwith a short hint/);
    expect(splitRequest("- Strike through done tasks\n- Show a weekly summary")).toHaveLength(2);
  });
  it("leaves single changes and tiny list items alone", () => {
    expect(splitRequest("Use a warmer accent colour and larger headings")).toEqual([]);
    expect(splitRequest("1. Make the header blue")).toEqual([]);
    expect(splitRequest("- a\n- b")).toEqual([]);
  });
});
