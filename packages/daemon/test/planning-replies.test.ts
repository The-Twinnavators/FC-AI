/**
 * The planner's replies while a run is planned are kept per run (planningReplies:<runId>) with the request that asked
 * for them, secrets redacted, so an unusable plan can be diagnosed from the model's own words. Step work isn't kept.
 */
import { describe, expect, it } from "vitest";
import type { ChatRequest } from "@flowcode/contracts";
import { planningRepliesKey, type PlanningReply } from "../src/models/router.js";
import { makeApp } from "./helpers.js";

describe("planning replies", () => {
  it("keeps the planner's planning replies with their requests, redacted; not other roles or step work", async () => {
    const { app } = makeApp();
    app.router.register({
      config: { id: "ollama", kind: "ollama", label: "stub", enabled: true, hosted: false },
      chat: async (req: ChatRequest) => ({ content: `{"tasks": [], "note": "key sk-ant-api03-${"x".repeat(40)}"} for ${String(req.messages[1]?.content).slice(0, 10)}`, toolCalls: [], model: "stub", durationMs: 5, doneReason: "stop" }),
      listModels: async () => [{ name: "m" }],
      describe: async () => undefined,
      health: async () => ({ ok: true, detail: "stub" }),
    });
    const asg = { providerId: "ollama", model: "m", temperature: 0.1 };
    const msgs = [{ role: "system" as const, content: "You turn product requirements into launch checklist tasks.\nMore." }, { role: "user" as const, content: "Requirements: R1" }];
    await app.router.chat({ role: "planner", runId: "run_a" }, asg, { messages: msgs });
    await app.router.chat({ role: "planner", runId: "run_a", taskId: "task_1" }, asg, { messages: msgs });
    await app.router.chat({ role: "coder", runId: "run_a" }, asg, { messages: msgs });
    const kept = app.store.getSetting<PlanningReply[]>(planningRepliesKey("run_a"), []);
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ stage: "You turn product requirements into launch checklist tasks.", model: "m", temperature: 0.1, request: "Requirements: R1", requestChars: 16, doneReason: "stop", durationMs: 5 });
    expect(kept[0]!.reply).toContain("for Requiremen");
    expect(kept[0]!.reply).not.toContain("sk-ant-api03");
  });
});
