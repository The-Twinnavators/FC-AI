/** Fixes for what benchmark 3 exposed, each replayed from its own failures. */
import { describe, expect, it } from "vitest";
import { fitHistory, promptChars } from "../src/orchestrator/agentLoop.js";
import { checkHint, renderHandoff, type HandoffPacket } from "../src/orchestrator/handoff.js";
import type { ChatMessage } from "../src/models/types.js";

const big = (n: number, ch = "x") => ch.repeat(n);
const exchange = (i: number, out = 6000): ChatMessage[] => [
  { role: "assistant", content: "", toolCalls: [{ id: `c${i}`, name: "apply_patch", arguments: { path: "src/App.tsx", edits: [{ find: big(2000, "f"), replace: big(2000, "r") }] } }] },
  { role: "tool", content: big(out, "o"), toolName: "apply_patch" },
];

describe("conversation fits the model's context", () => {
  it("counts the patch text the model sent, not only message text", () => {
    const m = exchange(1);
    expect(promptChars(m)).toBeGreaterThan(10_000);
  });

  it("trims in stages and keeps the system prompt, the task and the latest result", () => {
    const messages: ChatMessage[] = [{ role: "system", content: "SYSTEM" }, { role: "user", content: "TASK" }];
    for (let i = 0; i < 8; i++) messages.push(...exchange(i));
    const latest = messages[messages.length - 1].content;
    const total = fitHistory(messages, 30_000);
    expect(total).toBeLessThanOrEqual(30_000);
    expect(promptChars(messages)).toBe(total);
    expect(messages[0].content).toBe("SYSTEM");
    expect(messages[1].content).toBe("TASK");
    expect(messages[messages.length - 1].content).toBe(latest);
    // Each remaining call still has its result straight after it.
    messages.forEach((m, i) => {
      if (m.role === "tool") expect(messages[i - 1].role).toBe("assistant");
    });
  });

  it("drops whole earlier exchanges when trimming text isn't enough, and says so", () => {
    const messages: ChatMessage[] = [{ role: "system", content: "S" }, { role: "user", content: "T" }];
    for (let i = 0; i < 20; i++) messages.push(...exchange(i, 3000));
    fitHistory(messages, 12_000);
    expect(messages[2]).toMatchObject({ role: "user" });
    expect(messages[2].content).toMatch(/earlier steps? removed to fit the model's context/);
    expect(messages.length).toBeLessThan(42);
  });

  it("leaves a conversation that already fits untouched", () => {
    const messages: ChatMessage[] = [{ role: "system", content: "S" }, { role: "user", content: "T" }, ...exchange(1, 500)];
    const before = JSON.stringify(messages);
    fitHistory(messages, 100_000);
    expect(JSON.stringify(messages)).toBe(before);
  });
});

describe("the coder sees what each check tests", () => {
  it("names the exact text a file must contain (the check that blocked the behaviour fix)", () => {
    expect(checkHint({ type: "file_contains", path: "src/components/Calendar/Calendar.tsx", text: "selectedMonth" })).toMatch(/must contain the exact text `selectedMonth`.*introduce it/);
    expect(checkHint({ type: "file_not_contains", path: "src/App.tsx", text: "Your data stays on this computer." })).toMatch(/no longer contain/);
    expect(checkHint({ type: "manual", note: "x" })).toMatch(/nothing to run/);
  });

  it("lists the scripts that exist, so it doesn't invent check-footer or test:search", () => {
    const p: HandoffPacket = {
      runObjective: "o",
      task: { title: "t", objective: "o", expectedPaths: ["src/App.tsx"], acceptanceCriteria: [] },
      acceptedDecisions: [],
      constraints: [],
      completedTasks: [],
      relevantFiles: [],
      findings: [],
      openBlockers: [],
      knowledge: [],
    };
    expect(renderHandoff(p, "", ["dev", "build", "typecheck"])).toMatch(/Scripts run_script can run \(no others exist\): dev, build, typecheck/);
    expect(renderHandoff(p, "", [])).toMatch(/no package\.json scripts/);
    expect(renderHandoff(p, "")).not.toMatch(/run_script/);
  });
});
