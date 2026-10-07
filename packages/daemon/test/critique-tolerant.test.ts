/** The visual review tolerates a small local model's empty or wrapped replies (Pacific Foods fix: one empty reply skipped it all). */
import { describe, expect, it } from "vitest";
import { parseLooseJson, visionCritique } from "../src/quality/critique.js";

const local = { providerId: "ollama", model: "qwen2.5vl:3b" };
const shots = [{ name: "desktop", png: Buffer.from("a") }, { name: "mobile", png: Buffer.from("b") }];

function router(replies: string[]) {
  let n = 0;
  return {
    provider: () => ({ describe: async () => ({ capabilities: ["vision"] }) }),
    chat: async () => ({ content: replies[n++] ?? "" }),
  } as never;
}

describe("tolerant visual review", () => {
  it("reads JSON wrapped in prose or a code fence", () => {
    expect(parseLooseJson<{ findings: unknown[] }>('Here you go:\n```json\n{"findings":[]}\n```').findings).toEqual([]);
    expect(() => parseLooseJson("")).toThrow(/empty/);
  });
  it("retries an empty reply once", async () => {
    const r = await visionCritique(router(["", '{"findings":[{"severity":"minor","message":"Tight spacing"}]}', '{"findings":[]}']), local, shots, "brief", {});
    expect(r.status).toBe("passed_with_warnings");
    expect(r.findings).toHaveLength(1);
    expect(r.limitation).toBeUndefined();
  });
  it("reviews the screenshots it can and says which it couldn't", async () => {
    const r = await visionCritique(router(["", "", '{"findings":[]}']), local, shots, "brief", {});
    expect(r.status).toBe("passed_with_warnings");
    expect(r.limitation).toMatch(/Reviewed 1 of 2 screenshots/);
  });
  it("is skipped only when no screenshot could be reviewed", async () => {
    const r = await visionCritique(router(["", "", "", ""]), local, shots, "brief", {});
    expect(r.status).toBe("skipped");
  });
});
