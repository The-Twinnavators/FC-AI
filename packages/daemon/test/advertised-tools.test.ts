/**
 * "Advertised" is only what the model is shown. A tool the step isn't shown but its role permits still goes through
 * every check when called, natively or recovered from text: the role's permission, the tool's schema, then the
 * dispatcher (path jail, scope and approvals, the edit guards). A tool the role doesn't permit is refused, shown or not.
 */
import { describe, expect, it } from "vitest";
import { runAgentLoop } from "../src/orchestrator/agentLoop.js";
import { ScriptedProvider, call } from "../src/models/scripted.js";
import { makeApp } from "./helpers.js";

async function loop(replies: Array<() => { toolCalls?: ReturnType<typeof call>[]; content?: string }>) {
  const { app } = makeApp();
  let turn = 0;
  app.router.register(new ScriptedProvider({ id: "p", kind: "scripted", label: "p", enabled: true, hosted: false }, () => (replies[turn++] ?? (() => ({ toolCalls: [call("task_complete", { summary: "done", changedPaths: [] })] })))()));
  const executed: string[] = [];
  await runAgentLoop({
    router: app.router,
    store: app.store,
    bus: app.bus,
    role: "coder",
    assignment: { providerId: "p", model: "m" },
    system: "s",
    user: "u",
    runId: "run_adv",
    maxTurns: 10,
    // Shown: reading and finishing only.
    advertisedTools: ["read_file", "task_complete"],
    executor: async (name) => {
      executed.push(name);
      if (name === "task_complete") return { ok: true, content: "ok", terminal: { kind: "complete", summary: "done", changedPaths: [] } };
      return { ok: true, content: "ok" };
    },
  });
  const rejected = app.bus.list({ runId: "run_adv", types: ["tool.rejected"] }).map((e) => e.message);
  return { executed, rejected };
}

describe("tools a step isn't shown", () => {
  it("run only when the role permits them and their arguments pass the schema, natively or recovered", async () => {
    const r = await loop([
      // Not shown, permitted, valid: reaches the dispatcher (which applies its own path, scope, approval and guard checks).
      () => ({ toolCalls: [call("create_file", { path: "src/a.ts", content: "export const a = 1;" })] }),
      // Not shown, permitted, invalid arguments: refused by the schema, never dispatched.
      () => ({ toolCalls: [call("apply_patch", { path: "src/a.ts" })] }),
      // Not permitted for the coder at all (a planner-only idea): refused.
      () => ({ toolCalls: [call("propose_plan" as never, { plan: "x" })] }),
      // Recovered from text: the same checks.
      () => ({ content: "<function=apply_patch>\n<parameter=path>\nsrc/a.ts\n</parameter>\n</function>" }),
    ]);
    expect(r.executed.filter((n) => n !== "task_complete")).toEqual(["create_file"]);
    expect(r.rejected.filter((m) => /Invalid arguments for apply_patch/.test(m))).toHaveLength(2);
    expect(r.rejected.some((m) => /Unknown tool "propose_plan"|not permitted for role coder/.test(m))).toBe(true);
  });
});
