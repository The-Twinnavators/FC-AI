/** Model recommendations use measured outcomes (not speed alone), need enough history, and never pick a cloud model. */
import { describe, expect, it } from "vitest";
import { recommend, type ModelStats } from "../src/models/modelPerformance.js";

const m = (model: string, steps: number, firstTry: number, stopped: number, medianStepMin: number, hosted = false, genTokPerSec?: number): ModelStats => ({ model, steps, firstTry, afterRetries: steps - firstTry - stopped, stopped, firstTryRate: firstTry / steps, medianStepMin, calls: 0, hosted, ...(genTokPerSec ? { genTokPerSec } : {}) });

describe("local model recommendation", () => {
  it("says there isn't enough evidence before guessing", () => {
    expect(recommend([m("a", 4, 4, 0, 2)]).text).toMatch(/Not enough evidence/);
  });

  it("prefers verified outcomes over raw writing speed", () => {
    const r = recommend([m("fast-but-flaky", 30, 9, 12, 5, false, 60), m("steady", 30, 18, 3, 9, false, 10)], "fast-but-flaky");
    expect(r.model).toBe("steady");
    expect(r.basis).toMatch(/fast-but-flaky: 30 steps, 30% passed first try, 12 stopped/);
  });

  it("never recommends a cloud model, and keeps the current one when it's best", () => {
    expect(recommend([m("cloud", 100, 90, 0, 1, true), m("local", 20, 10, 2, 8)], "local")).toMatchObject({ model: "local", text: expect.stringMatching(/^Keep local/) });
  });
});
