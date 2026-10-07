/** One problem a day: which problem is next, and which suggested changes FlowCode will carry out. */
import { describe, expect, it } from "vitest";
import { checkAction, nextProblem } from "../src/quality/problemSolver.js";

const p = (id: string, count: number, needsCodeFix = true) => ({ id, category: "model_failure" as const, title: id, count, runs: ["r1"], examples: [], lastSeen: "2026-10-06T00:00:00Z", needsCodeFix });

describe("problem solver", () => {
  it("picks the most frequent model problem not looked at in the last week", () => {
    const now = Date.parse("2026-10-07T12:00:00Z");
    const state = { suggestions: { big: { at: "2026-10-05T00:00:00Z" } } } as never;
    expect(nextProblem([p("small", 5), p("big", 60), p("mid", 20), p("skill", 99, false)], state, now)?.id).toBe("mid");
    const old = { suggestions: { big: { at: "2026-09-20T00:00:00Z" } } } as never;
    expect(nextProblem([p("small", 5), p("big", 60)], old, now)?.id).toBe("big");
  });
  it("only carries out a switch to an installed, non-embedding model for a known role", () => {
    const installed = ["qwen2.5vl:7b", "qwen3:14b", "nomic-embed-text"];
    expect(checkAction({ kind: "switch_model", role: "critic", model: "qwen2.5vl:7b" }, installed)?.model).toBe("qwen2.5vl:7b");
    expect(checkAction({ kind: "switch_model", role: "critic", model: "llava:34b" }, installed)).toBeUndefined();
    expect(checkAction({ kind: "switch_model", role: "critic", model: "nomic-embed-text" }, installed)).toBeUndefined();
    expect(checkAction({ kind: "switch_model", role: "security_qa_admin", model: "qwen3:14b" }, installed)).toBeUndefined();
    expect(checkAction({ kind: "delete_files" }, installed)).toBeUndefined();
  });
});
