/**
 * One reply with many edits (Clean Cart controlled build: 55 apply_patch calls, cut off at the 4,096-token output limit,
 * 2 applied, 5 failed): edits run in checked batches, the last edit of a cut-off reply isn't run, edits after a failed
 * one on the same file wait, and every reply says exactly what was written so nothing is sent twice.
 */
import { describe, expect, it } from "vitest";
import { MAX_EDITS_PER_REPLY, runAgentLoop } from "../src/orchestrator/agentLoop.js";
import { call } from "../src/models/scripted.js";
import type { ChatRequest } from "../src/models/types.js";
import { makeApp } from "./helpers.js";

const patch = (file: string, n: number) => call("apply_patch", { path: file, edits: [{ find: `old ${n}`, replace: `new ${n}` }] });

async function run(replies: Array<{ calls: ReturnType<typeof call>[]; doneReason?: string }>, fails: (file: string, find: string) => boolean = () => false) {
  const { app } = makeApp();
  let i = 0;
  const seen: ChatRequest[] = [];
  app.router.register({
    config: { id: "p", kind: "scripted", label: "p", enabled: true, hosted: false },
    chat: async (req) => {
      seen.push({ ...req, messages: [...req.messages] });
      const r = replies[i++] ?? { calls: [call("task_complete", { summary: "done", changedPaths: [] })] };
      return { content: "", toolCalls: r.calls.map((c, k) => ({ ...c, id: `c${i}-${k}` })), model: "m", durationMs: 1, doneReason: r.doneReason ?? "stop" };
    },
    listModels: async () => [],
    describe: async () => undefined,
    health: async () => ({ ok: true, detail: "" }),
  });
  const ran: string[] = [];
  const res = await runAgentLoop({
    router: app.router,
    store: app.store,
    bus: app.bus,
    role: "coder",
    assignment: { providerId: "p", model: "m" },
    system: "s",
    user: "u",
    runId: "run_edits",
    maxTurns: 6,
    executor: async (name, args) => {
      const a = args as { path?: string; edits?: Array<{ find: string }> };
      if (name === "task_complete") return { ok: true, content: "ok", terminal: { kind: "complete", summary: "done", changedPaths: [] } };
      ran.push(`${a.path}:${a.edits?.[0]?.find}`);
      return fails(a.path!, a.edits![0]!.find) ? { ok: false, content: "ERROR: Patch context mismatch" } : { ok: true, content: "applied" };
    },
  });
  return { res, ran, seen, events: app.bus.list({ runId: "run_edits", types: ["recovery.action"] }).map((e) => e.message) };
}

describe("a reply with many edits", () => {
  it(`runs at most ${MAX_EDITS_PER_REPLY} and says which were applied and which weren't`, async () => {
    const { res, ran, seen, events } = await run([{ calls: Array.from({ length: 11 }, (_, n) => patch("src/a.css", n)) }]);
    expect(ran.length).toBe(MAX_EDITS_PER_REPLY);
    expect(res.appliedEdits.length).toBe(MAX_EDITS_PER_REPLY);
    expect(events.some((e) => e === `Reply with 11 tool calls: 8 edits applied (src/a.css (8)), 0 failed, 3 not run (src/a.css (3))`)).toBe(true);
    // The next request says what's in the files now and asks only for the rest.
    expect(String(seen[1]!.messages.at(-1)!.content)).toMatch(/8 edits applied .*don't send them again\. Send the ones not run/);
  });

  it("doesn't run the last edit of a reply cut off at the output limit", async () => {
    const { ran, events } = await run([{ calls: [patch("src/a.css", 1), patch("src/a.css", 2), patch("src/a.css", 3)], doneReason: "length" }]);
    expect(ran).toEqual(["src/a.css:old 1", "src/a.css:old 2"]);
    expect(events.some((e) => /^Reply with 3 tool calls, cut off at the output limit: 2 edits applied/.test(e))).toBe(true);
  });

  it("holds back later edits to a file once one fails, and keeps the other file's", async () => {
    const { ran, res, events } = await run([{ calls: [patch("src/a.css", 1), patch("src/b.tsx", 1), patch("src/a.css", 2), patch("src/b.tsx", 2)] }], (file, find) => file === "src/a.css" && find === "old 1");
    expect(ran).toEqual(["src/a.css:old 1", "src/b.tsx:old 1", "src/b.tsx:old 2"]);
    expect(res.appliedEdits).toEqual(["src/b.tsx", "src/b.tsx"]);
    expect(events.some((e) => /2 edits applied \(src\/b\.tsx \(2\)\), 1 failed \(src\/a\.css \(1\)\), 1 not run \(src\/a\.css \(1\)\)/.test(e))).toBe(true);
  });
});
