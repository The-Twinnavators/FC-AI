/**
 * Tool calls recovered from a model's text run only when they are explicit and unambiguous, through the ordinary
 * schema, path, scope and approval checks, at most once; anything else is answered with what to send instead. When the
 * provider can't parse the model's native calls, the model is told its call was lost and how to send it from now on
 * (Clean Cart slice eval 1: Ollama answered "XML syntax error … <parameter> closed by </function>", the call was lost,
 * and the coder's next three replies were prose).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { recoverTextCalls } from "../src/orchestrator/agentLoop.js";
import { ScriptedProvider } from "../src/models/scripted.js";
import { ModelRouter } from "../src/models/router.js";
import { ProviderError } from "../src/models/types.js";
import { idealProbeSolver } from "./scripted-agents.js";
import { makeApp, makeProject, waitFor } from "./helpers.js";

const ALLOWED = new Set(["read_file", "create_file", "apply_patch", "replace_file", "task_complete"]);
const fn = (name: string, args: Record<string, string>) => `<function=${name}>\n${Object.entries(args).map(([k, v]) => `<parameter=${k}>\n${v}\n</parameter>`).join("\n")}\n</function>`;

describe("which text calls are recovered", () => {
  it("recovers a complete call in the alternate format, around prose", () => {
    const r = recoverTextCalls(`I'll write the hero now.\n${fn("create_file", { path: "src/a.tsx", content: "export const A = () => <div>Clean Cart</div>;" })}`, ALLOWED);
    expect(r.problem).toBeUndefined();
    expect(r.calls).toMatchObject([{ name: "create_file", arguments: { path: "src/a.tsx", content: "export const A = () => <div>Clean Cart</div>;" } }]);
  });

  it("runs nothing from an incomplete block, even beside a complete one", () => {
    const r = recoverTextCalls(`${fn("read_file", { path: "src/a.tsx" })}\n<function=create_file>\n<parameter=path>\nsrc/b.tsx\n</parameter>`, ALLOWED);
    expect(r.calls).toEqual([]);
    expect(r.problem).toMatch(/incomplete/);
  });

  it("doesn't run calls in prose, in a code example, as a guessed file, or for a tool the step can't use", () => {
    expect(recoverTextCalls(`Next I'd call {"name":"read_file","arguments":{"path":"a.md"}} and then decide.`, ALLOWED)).toMatchObject({ calls: [], problem: expect.stringMatching(/prose or a code example/) });
    expect(recoverTextCalls("For example:\n```\n" + fn("create_file", { path: "src/x.ts", content: "x" }) + "\n```", ALLOWED)).toMatchObject({ calls: [] });
    const file = Array.from({ length: 14 }, (_, i) => `export const v${i} = ${i};`).join("\n");
    expect(recoverTextCalls(`Here is src/screens/A.tsx fixed:\n\`\`\`tsx\nimport x from "y";\n${file}\n\`\`\``, ALLOWED)).toMatchObject({ calls: [], problem: expect.stringMatching(/whole file as a code block/) });
    expect(recoverTextCalls(fn("delete_file", { path: "src/App.tsx" }), ALLOWED)).toMatchObject({ calls: [], problem: expect.stringMatching(/delete_file isn't a tool this step can use/) });
  });

  it("keeps identical calls in one reply once, and recovers a reply that is only a JSON call", () => {
    const one = fn("read_file", { path: "src/a.tsx" });
    expect(recoverTextCalls(`${one}\n${one}`, ALLOWED).calls).toHaveLength(1);
    expect(recoverTextCalls('```json\n{"name": "task_complete", "arguments": {"summary": "done", "changedPaths": ["src/a.tsx"]}}\n```', ALLOWED).calls).toMatchObject([{ name: "task_complete" }]);
  });
});

/** A build whose coder speaks through `reply` (its n-th reply, the history so far). */
async function build(reply: (n: number, h: Array<{ role: string; content?: unknown }>) => { content?: string; throws?: string }, opts: { supervised?: boolean; until?: (app: ReturnType<typeof makeApp>["app"]) => boolean } = {}) {
  const { app } = makeApp();
  app.router.sleep = async () => {};
  const plan = {
    goal: "g",
    assumptions: [],
    relevantFiles: ["README.md"],
    expectedChanges: ["src/a.ts"],
    risk: "low",
    riskNotes: [],
    validationPlan: ["final_report"],
    rollbackStrategy: "r",
    tasks: [{ key: "t1", title: "Create a", objective: "Create src/a.ts exporting a", dependsOn: [], expectedPaths: ["src/a.ts"], acceptanceCriteria: [{ id: "a", description: "a exists", check: { type: "file_contains", path: "src/a.ts", text: "export const a" } }], verification: [], role: "coder" }],
  };
  const seen: Array<Array<{ role: string; content?: unknown }>> = [];
  let n = 0;
  const provider = new ScriptedProvider({ id: "scripted", kind: "ollama", label: "Ollama", enabled: true, hosted: false }, async (_req, h) => {
    if (String(h[0]?.content ?? "").includes("You are the Planner")) return { content: JSON.stringify(plan) };
    seen.push(h as never);
    const r = reply(++n, h as never);
    if (r.throws) throw new ProviderError("tool_call_invalid", r.throws);
    return { content: r.content ?? "" };
  });
  provider.listModels = async () => [{ name: "agent" }];
  app.router.register(provider);
  app.router.register(idealProbeSolver("scripted-ideal"));
  const asg = { providerId: "scripted", model: "agent" };
  const lab = await app.lab.probe({ providerId: "scripted-ideal", model: "agent" });
  app.store.capabilities.upsert({ ...lab, id: "cap_copy", providerId: "scripted", model: "agent", configHash: ModelRouter.configHash(asg) });
  for (const role of ["planner", "coder", "debugger"] as const) app.router.setRoleAssignment(role, asg);
  const { project, ws } = makeProject(app, { "README.md": "# demo\n" });
  app.projects.updateSettings(project.id, { autonomy: opts.supervised ? "supervised" : "assisted" });
  const notes: string[] = [];
  app.bus.subscribe((e) => void (/recovery\.action|tool\.(completed|rejected)|approval\.requested/.test(e.type) && notes.push(`${e.type} ${e.message}`)));
  const run = app.orchestrator.createRun({ projectId: project.id, objective: "g", constraints: [], attachedKnowledgeIds: [] });
  await app.orchestrator.plan(run.id);
  if (opts.supervised) app.orchestrator.approvePlan(run.id);
  if (opts.until) await waitFor(() => opts.until!(app), 60_000);
  else await waitFor(() => !app.orchestrator.isActive(run.id) && ["done", "done_with_warnings", "blocked", "failed", "awaiting_approval"].includes(app.store.runs.require(run.id).status), 60_000).catch(() => undefined);
  return { app, run, ws, seen, notes, task: app.orchestrator.graph.tasks(run.id)[0]! };
}
const lastUser = (h: Array<{ role: string; content?: unknown }>) => String([...h].reverse().find((m) => m.role === "user")?.content ?? "");

describe("recovered calls in a build", () => {
  it("after the provider can't parse a call, says so and how to send it; the resent call runs once and the step verifies", async () => {
    const r = await build((n) => {
      if (n === 1) return { throws: "XML syntax error on line 87: element <parameter> closed by </function>" };
      if (n === 2) return { content: fn("create_file", { path: "src/a.ts", content: "export const a = 1;" }) };
      return { content: fn("task_complete", { summary: "done", changedPaths: '["src/a.ts"]' }) };
    });
    expect(lastUser(r.seen[1]!)).toMatch(/couldn't read your last tool call .* nothing ran\. From now on call tools in the text form/);
    expect(r.notes.filter((x) => /^tool\.completed create_file → ok/.test(x))).toHaveLength(1);
    expect(r.task.status).toBe("verified");
  }, 90_000);

  it("answers an incomplete call with what to send, and runs nothing from it", async () => {
    const r = await build((n) => (n === 1 ? { content: "<function=create_file>\n<parameter=path>\nsrc/a.ts\n</parameter>" } : n === 2 ? { content: fn("create_file", { path: "src/a.ts", content: "export const a = 1;" }) } : { content: fn("task_complete", { summary: "done", changedPaths: '["src/a.ts"]' }) }));
    expect(lastUser(r.seen[1]!)).toMatch(/^Runtime notice: a tool call in your reply is incomplete/);
    expect(r.notes.some((x) => /^recovery\.action Didn't run the model's text tool call/.test(x))).toBe(true);
    expect(r.notes.filter((x) => /^tool\.completed create_file/.test(x))).toHaveLength(1);
  }, 90_000);

  it("doesn't apply a replayed change twice", async () => {
    const write = fn("create_file", { path: "src/a.ts", content: "export const a = 1;", reason: "r" });
    const r = await build((n) => (n <= 2 ? { content: write } : { content: fn("task_complete", { summary: "done", changedPaths: '["src/a.ts"]' }) }));
    expect(r.notes.filter((x) => /^tool\.completed create_file/.test(x))).toHaveLength(1);
    expect(lastUser(r.seen[2]!)).toMatch(/already ran in your previous reply/);
  }, 90_000);

  it("puts a recovered call through the ordinary schema and path checks", async () => {
    const r = await build((n) => (n === 1 ? { content: fn("create_file", { path: "../outside.ts", content: "x" }) } : n === 2 ? { content: fn("create_file", { content: "no path" }) } : { content: fn("task_complete", { summary: "done", changedPaths: "[]" }) }));
    expect(r.notes.some((x) => /tool\.(rejected|completed) .*create_file/.test(x) && /outside|escape|not allowed|jail|POLICY|Invalid arguments/i.test(x))).toBe(true);
    expect(r.notes.some((x) => /Invalid arguments for create_file: path/.test(x))).toBe(true);
  }, 90_000);

  it("runs an identical change again once the file has changed in between", async () => {
    const one = fn("replace_file", { path: "src/a.ts", content: "export const a = 1;", reason: "r" });
    const two = fn("replace_file", { path: "src/a.ts", content: "export const a = 2;", reason: "r" });
    const r = await build((n) => (n === 1 ? { content: fn("create_file", { path: "src/a.ts", content: "export const a = 0;" }) } : n === 2 ? { content: one } : n === 3 ? { content: two } : n === 4 ? { content: one } : n === 5 ? { content: one } : { content: fn("task_complete", { summary: "done", changedPaths: '["src/a.ts"]' }) }));
    // 2 → 1 → 2 → 1 → 1: the fourth reply is the same call as the second, after a change, so it runs; the fifth doesn't.
    expect(r.notes.filter((x) => /^tool\.completed replace_file → ok/.test(x))).toHaveLength(3);
    expect(r.notes.filter((x) => /^recovery\.action Didn't run .*already ran in your previous reply \(replace_file\) and the file hasn't changed since/.test(x))).toHaveLength(1);
    expect(fs.readFileSync(path.join(r.ws, "src/a.ts"), "utf8")).toBe("export const a = 1;");
  }, 90_000);

  it("never records a failed change as applied: the same call is run again", async () => {
    const miss = fn("apply_patch", { path: "src/a.ts", edits: '[{"find": "not in the file", "replace": "x"}]', reason: "r" });
    const r = await build((n) => (n === 1 ? { content: fn("create_file", { path: "src/a.ts", content: "export const a = 1;" }) } : n <= 3 ? { content: miss } : { content: fn("task_complete", { summary: "done", changedPaths: '["src/a.ts"]' }) }));
    expect(r.notes.filter((x) => /^tool\.completed apply_patch → failed/.test(x))).toHaveLength(2);
    expect(r.notes.some((x) => /already ran in your previous reply/.test(x))).toBe(false);
  }, 90_000);

  it("puts a recovered call that needs approval through the gate, and doesn't report it run while it waits", async () => {
    const write = fn("create_file", { path: "src/other.ts", content: "export const o = 1;" });
    const r = await build((n) => (n <= 2 ? { content: write } : { content: fn("task_complete", { summary: "done", changedPaths: "[]" }) }), { supervised: true, until: (app) => app.approvals.pending().some((a) => /create_file/.test(a.action)) });
    expect(r.notes.some((x) => /^approval\.requested .*create_file on src\/other\.ts/.test(x))).toBe(true);
    const waiting = r.app.store.toolCalls.where("run_id = ?", r.run.id).filter((c) => c.toolName === "create_file");
    expect(waiting.map((c) => c.status)).toEqual(["requested"]);
    expect(r.notes.some((x) => /^tool\.completed create_file/.test(x))).toBe(false);
    expect(fs.existsSync(path.join(r.ws, "src/other.ts"))).toBe(false);
    // Denied: not applied, so the identical call sent again goes to the gate again (not refused as a replay).
    r.app.bus.subscribe((e) => void (e.type === "approval.requested" && setTimeout(() => r.app.approvals.pending().forEach((a) => r.app.approvals.decide(a.id, "deny")), 10)));
    r.app.approvals.pending().forEach((a) => r.app.approvals.decide(a.id, "deny"));
    await waitFor(() => !r.app.orchestrator.isActive(r.run.id), 60_000).catch(() => undefined);
    expect(r.notes.filter((x) => /^approval\.requested .*create_file on src\/other\.ts/.test(x)).length).toBeGreaterThanOrEqual(2);
    expect(r.notes.some((x) => /already ran in your previous reply/.test(x))).toBe(false);
    expect(fs.existsSync(path.join(r.ws, "src/other.ts"))).toBe(false);
  }, 120_000);
});
