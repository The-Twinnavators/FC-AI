/** A page opening on a long build gets its newest events (Clean Cart: 6209 events, the first 5000 replayed, so the feed sat on yesterday's work and looked frozen). */
import { describe, expect, it } from "vitest";
import { makeApp } from "./helpers.js";

describe("event replay", () => {
  it("lists the newest events, oldest first, when asked for them", () => {
    const { app } = makeApp();
    for (let i = 0; i < 12; i++) app.bus.emit({ type: "agent.message", runId: "run_x", message: `m${i}` });
    const newest = app.bus.list({ runId: "run_x", limit: 5, newest: true }).map((e) => e.message);
    expect(newest).toEqual(["m7", "m8", "m9", "m10", "m11"]);
    expect(app.bus.list({ runId: "run_x", limit: 3 }).map((e) => e.message)).toEqual(["m0", "m1", "m2"]);
  });
});
