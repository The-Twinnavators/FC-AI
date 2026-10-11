/**
 * How big a window a coding step gets. The numbers are the ones measured on the 8 GB card that ran the Non-GMO build:
 * qwen3:14b is 9.3 GB and qwen3:8b is 5.2 GB, and neither can hold a 32k window there.
 */
import { describe, expect, it, vi, afterEach } from "vitest";

const GB = 1_000_000_000;
const MIB = 1024 * 1024;

/** nvidia-smi prints one line of MiB per card. */
function withVram(gib: number | null) {
  vi.doMock("node:child_process", () => ({
    execFile: (_cmd: string, _args: string[], _opts: unknown, cb: (e: Error | null, r?: { stdout: string }) => void) =>
      gib === null ? cb(new Error("not found")) : cb(null, { stdout: `${Math.round((gib * 1024 * 1024 * 1024) / MIB)}\n` }),
  }));
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("node:child_process");
});

describe("the window a coding step gets", () => {
  it("gives a 32k window when the card can hold the model with it", async () => {
    withVram(24);
    const { contextForCoding } = await import("../src/models/gpuMemory.js");
    expect(await contextForCoding(9.3 * GB)).toBe(32_768);
  });

  it("drops to 24k rather than push the model onto the CPU", async () => {
    withVram(16);
    const { contextForCoding } = await import("../src/models/gpuMemory.js");
    // 9.3 GB + 32k x 250 KB = 17.5 GB, too big; 9.3 + 6.1 = 15.4 GB fits.
    expect(await contextForCoding(9.3 * GB)).toBe(24_576);
  });

  it("keeps the floor on a card too small for any of them, because a cut prompt is worse than a slow one", async () => {
    withVram(8);
    const { CONTEXT_FLOOR, contextForCoding } = await import("../src/models/gpuMemory.js");
    expect(await contextForCoding(5.2 * GB)).toBe(CONTEXT_FLOOR);
    expect(await contextForCoding(9.3 * GB)).toBe(CONTEXT_FLOOR);
  });

  it("keeps the floor when the card cannot be read", async () => {
    withVram(null);
    const { CONTEXT_FLOOR, contextForCoding } = await import("../src/models/gpuMemory.js");
    expect(await contextForCoding(5.2 * GB)).toBe(CONTEXT_FLOOR);
  });

  it("leaves the context alone when the model's size is unknown", async () => {
    withVram(24);
    const { contextForCoding } = await import("../src/models/gpuMemory.js");
    expect(await contextForCoding(undefined)).toBeUndefined();
  });
});
