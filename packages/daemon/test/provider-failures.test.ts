/**
 * Reliability phase 1: provider and model failures are told apart from failures of the work. A missing model, an
 * unreachable service, an account out of credit or a failed sign-in never use up a step's repair attempts or reach
 * the debugger; the step pauses with its work kept and resumes when the service is back. A check before model work
 * finds these first and records which service answered.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ProviderConfig } from "@flowcode/contracts";
import { classifyError, isProviderFailure } from "../src/models/errors.js";
import { checkProviders } from "../src/models/preflight.js";
import { ScriptedProvider, call } from "../src/models/scripted.js";
import { ProviderError, type ChatMessage, type Provider } from "../src/models/types.js";
import { ModelRouter } from "../src/models/router.js";
import { idealProbeSolver } from "./scripted-agents.js";
import { makeApp, makeProject, waitFor } from "./helpers.js";

describe("provider failures are classified apart from the work", () => {
  it("names a missing model, an unreachable service, no credit and a refused sign-in", () => {
    const missing = classifyError(new Error(`Ollama /api/chat HTTP 404: {"error":"model 'qwen3:14b' not found"}`), undefined, 404, `{"error":"model 'qwen3:14b' not found"}`);
    expect(missing.kind).toBe("model_missing");
    const refused = classifyError(Object.assign(new Error("fetch failed"), { cause: Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:11434"), { code: "ECONNREFUSED" }) }));
    expect(refused.kind).toBe("connection_refused");
    const credit = classifyError(new Error("Your credit balance is too low to access the Anthropic API"), undefined, 400);
    expect(credit.kind).toBe("quota_exhausted");
    const auth = classifyError(new Error("invalid x-api-key"), undefined, 401);
    expect(auth.kind).toBe("auth_failed");
    for (const e of [missing, refused, credit, auth]) expect(isProviderFailure(e.kind), e.kind).toBe(true);
    // Failures of the model's output are the work's, and still count as attempts.
    for (const kind of ["invalid_response", "tool_call_invalid", "context_limit", "unknown"] as const) expect(isProviderFailure(kind)).toBe(false);
  });
});

function stub(config: Partial<ProviderConfig> & { id: string }, over: Partial<Provider>): Provider {
  return { config: { kind: "ollama", label: "Ollama (local)", enabled: true, hosted: false, ...config } as ProviderConfig, chat: async () => ({ content: "", toolCalls: [], model: "x", durationMs: 1 }), listModels: async () => [], describe: async () => undefined, health: async () => ({ ok: true, detail: "Ollama 0.40.3 at 127.0.0.1:11434" }), ...over };
}

describe("the check before model work", () => {
  it("records which service answered, each model's digest, and what it can't confirm", async () => {
    const ollama = stub({ id: "ollama" }, { listModels: async () => [{ name: "qwen3:8b", digest: "500a1f067a9f00" }, { name: "qwen3:14b", digest: "bdbd181c33f2aa" }] });
    const r = await checkProviders(() => ollama, { coder: { providerId: "ollama", model: "qwen3:8b" }, planner: { providerId: "ollama", model: "qwen3:14b" }, debugger: { providerId: "ollama", model: "qwen3:8b" } });
    expect(r.ok).toBe(true);
    expect(r.services[0]!.identity).toContain("Ollama 0.40.3 at 127.0.0.1:11434");
    expect(r.services[0]!.models.find((m) => m.model === "qwen3:8b")).toMatchObject({ status: "available", digest: "500a1f067a9f", roles: ["coder", "debugger"] });
    expect(r.services[0]!.uncertain.join(" ")).toMatch(/Which Ollama process answered can't be confirmed/);
  });

  it("finds a model that isn't installed, without downloading it", async () => {
    let pulls = 0;
    const ollama = stub({ id: "ollama" }, { listModels: async () => [{ name: "qwen3:8b" }], chat: async () => (pulls++, { content: "", toolCalls: [], model: "x", durationMs: 1 }) });
    const r = await checkProviders(() => ollama, { planner: { providerId: "ollama", model: "qwen3:14b" }, coder: { providerId: "ollama", model: "qwen3:8b" } });
    expect(r.ok).toBe(false);
    expect(r.failure).toBe("model_missing");
    expect(r.problems[0]).toMatch(/qwen3:14b \(planner\) isn't installed/);
    expect(r.problems[0]).toMatch(/doesn't download models or switch them on its own/);
    expect(pulls, "no model call, no download").toBe(0);
  });

  it("finds an unreachable service and a cloud key that's refused", async () => {
    const down = stub({ id: "ollama" }, { health: async () => ({ ok: false, detail: "connection_refused: Ollama not reachable at http://127.0.0.1:11434" }) });
    const r1 = await checkProviders(() => down, { coder: { providerId: "ollama", model: "qwen3:8b" } });
    expect(r1).toMatchObject({ ok: false, failure: "connection_refused" });
    expect(r1.problems[0]).toMatch(/isn't answering/);
    const cloud = stub({ id: "hosted-anthropic", kind: "anthropic", label: "Anthropic (Claude)", hosted: true }, { health: async () => ({ ok: true, detail: "configured: api.anthropic.com" }), listModels: async () => Promise.reject(new ProviderError("auth_failed", "Anthropic answered 401: invalid x-api-key", [], 401)) });
    const r2 = await checkProviders(() => cloud, { coder: { providerId: "hosted-anthropic", model: "claude-sonnet-5-5" } });
    expect(r2).toMatchObject({ ok: false, failure: "auth_failed" });
    // A cloud model the list doesn't name is unconfirmed, not missing (aliases), and credit can't be seen for free.
    const listed = stub({ id: "hosted-anthropic", kind: "anthropic", label: "Anthropic (Claude)", hosted: true }, { listModels: async () => [{ name: "claude-opus-5-5" }] });
    const r3 = await checkProviders(() => listed, { coder: { providerId: "hosted-anthropic", model: "claude-sonnet-5-5" } });
    expect(r3.ok).toBe(true);
    expect(r3.services[0]!.models[0]!.status).toBe("unconfirmed");
    expect(r3.services[0]!.uncertain.join(" ")).toMatch(/credit can't be checked without a paid request/);
  });
});

// One step that writes a file in two turns: create_file, then task_complete.
const PLAN = {
  goal: "Add a greeting",
  assumptions: [],
  relevantFiles: ["README.md"],
  expectedChanges: ["src/greet.ts"],
  risk: "low",
  riskNotes: [],
  validationPlan: ["final_report"],
  rollbackStrategy: "Restore snapshots",
  tasks: [{ key: "t1", title: "Create greet", objective: "Create src/greet.ts", dependsOn: [], expectedPaths: ["src/greet.ts"], acceptanceCriteria: [{ id: "a", description: "greet exists", check: { type: "file_contains", path: "src/greet.ts", text: "export function greet" } }], verification: [], role: "coder" }],
};

interface Service {
  /** Thrown on the step's turn with this number (1 = its first model call), while set. */
  failOnTurn?: { turn: number; error: () => ProviderError; times: number };
  healthy: boolean;
  installed: boolean;
}

async function harness() {
  const { app } = makeApp();
  app.router.sleep = async () => {};
  const service: Service = { healthy: true, installed: true };
  let turns = 0;
  const stepCalls: string[] = [];
  const provider = new ScriptedProvider({ id: "scripted", kind: "ollama", label: "Ollama (local)", enabled: true, hosted: false }, async (req, h: ChatMessage[]) => {
    if ((h[0]?.content ?? "").includes("You are the Planner")) return { content: JSON.stringify(PLAN) };
    turns++;
    stepCalls.push(req.model);
    const f = service.failOnTurn;
    if (f && f.times > 0 && turns === f.turn) {
      f.times--;
      turns--;
      return f.error();
    }
    const tools = h.filter((m) => m.role === "tool").length;
    return tools === 0 ? { toolCalls: [call("create_file", { path: "src/greet.ts", content: "export function greet(n: string) {\n  return `Hi ${n}`;\n}\n" })] } : { toolCalls: [call("task_complete", { summary: "created src/greet.ts", changedPaths: ["src/greet.ts"] })] };
  });
  provider.health = async () => (service.healthy ? { ok: true, detail: "Ollama 0.40.3 at 127.0.0.1:11434" } : { ok: false, detail: "connection_refused: Ollama not reachable at http://127.0.0.1:11434" });
  provider.listModels = async () => (service.installed ? [{ name: "agent", digest: "abc123def4567890" }] : []);
  app.router.register(provider);
  app.router.register(idealProbeSolver("scripted-ideal"));
  const asg = { providerId: "scripted", model: "agent" };
  const lab = await app.lab.probe({ providerId: "scripted-ideal", model: "agent" });
  app.store.capabilities.upsert({ ...lab, id: "cap_copy", providerId: "scripted", model: "agent", configHash: ModelRouter.configHash(asg) });
  for (const role of ["planner", "coder", "debugger"] as const) app.router.setRoleAssignment(role, asg);
  const { project, ws } = makeProject(app, { "README.md": "# demo\n" });
  const run = app.orchestrator.createRun({ projectId: project.id, objective: "Add a greeting", constraints: [], attachedKnowledgeIds: [] });
  const settled = () => waitFor(() => (!app.orchestrator.isActive(run.id) && ["done", "done_with_warnings", "blocked", "failed"].includes(app.store.runs.require(run.id).status) ? app.store.runs.require(run.id) : undefined), 30_000);
  const task = () => app.orchestrator.graph.tasks(run.id)[0]!;
  return { app, run, ws, service, stepCalls, settled, task };
}

describe("a step and a provider failure", () => {
  it("out of credit mid-step: paused with its work kept, no attempt used, no debugger, resumes after recovery", async () => {
    const h = await harness();
    // The second turn (after the file was written) fails: the account is out of credit.
    h.service.failOnTurn = { turn: 2, times: 1, error: () => new ProviderError("quota_exhausted", "Your credit balance is too low", [], 400) };
    await h.app.orchestrator.plan(h.run.id);
    h.app.orchestrator.start(h.run.id);
    await h.settled();
    const paused = h.task();
    expect(paused.status).toBe("blocked");
    expect(paused.blocker).toMatchObject({ category: "model", failureClass: "provider" });
    expect(paused.attempts, "a provider failure uses no attempt").toBe(0);
    expect(h.stepCalls.length, "no debugger attempt after the failure").toBe(2);
    expect(fs.existsSync(path.join(h.ws, "src/greet.ts")), "the step's work is kept").toBe(true);
    // Credit added: the person retries and the step finishes from where it was.
    h.app.orchestrator.retryTask(h.run.id, paused.id);
    const done = await h.settled();
    expect(done.status).toMatch(/^done/);
    expect(h.task().status).toBe("verified");
  });

  it("unreachable service: the step pauses before it starts, with no model call and no attempt", async () => {
    const h = await harness();
    await h.app.orchestrator.plan(h.run.id);
    h.service.healthy = false;
    h.app.orchestrator.start(h.run.id);
    await h.settled();
    expect(h.stepCalls.length).toBe(0);
    expect(h.task()).toMatchObject({ status: "blocked", attempts: 0, blocker: { failureClass: "provider" } });
    expect(h.task().blocker!.reason).toMatch(/connection_refused/);
    expect(h.task().blocker!.nextAction).toMatch(/Start or restart the model service/);
    h.service.healthy = true;
    h.app.orchestrator.retryTask(h.run.id, h.task().id);
    expect((await h.settled()).status).toMatch(/^done/);
  });

  it("missing model: planning stops with what to install, and nothing is downloaded", async () => {
    const h = await harness();
    h.service.installed = false;
    const planned = await h.app.orchestrator.plan(h.run.id);
    expect(planned.status).toBe("blocked");
    expect(planned.statusReason).toMatch(/agent \(.*planner.*\) isn't installed/);
    expect(h.stepCalls.length).toBe(0);
  });

  it("missing model mid-build (removed after planning): paused, not repaired", async () => {
    const h = await harness();
    await h.app.orchestrator.plan(h.run.id);
    // Removed after the step's check passed, so the step meets it on its first call.
    h.service.failOnTurn = { turn: 1, times: 1, error: () => ((h.service.installed = false), new ProviderError("model_missing", "The model agent isn't installed", [], 404)) };
    h.app.orchestrator.start(h.run.id);
    await h.settled();
    expect(h.task()).toMatchObject({ status: "blocked", attempts: 0, blocker: { failureClass: "provider" } });
    expect(h.task().blocker!.nextAction).toMatch(/Install the model yourself/);
    h.service.installed = true;
    h.app.orchestrator.retryTask(h.run.id, h.task().id);
    expect((await h.settled()).status).toMatch(/^done/);
  });

  it("a passing blip: the service answers again, so the step retries without using an attempt", async () => {
    const h = await harness();
    // Three timeouts in a row outlast the router's own two retries; then the service is fine.
    h.service.failOnTurn = { turn: 1, times: 3, error: () => new ProviderError("timeout", "request timeout") };
    await h.app.orchestrator.plan(h.run.id);
    h.app.orchestrator.start(h.run.id);
    expect((await h.settled()).status).toMatch(/^done/);
    expect(h.task()).toMatchObject({ status: "verified", attempts: 1 });
    expect(h.app.bus.list({ runId: h.run.id, types: ["recovery.action"] }).some((e) => /tries again without using an attempt/.test(e.message))).toBe(true);
    // What answered is on record for the run.
    expect(h.app.bus.list({ runId: h.run.id, types: ["provider.checked"] }).some((e) => /Ollama 0\.40\.3 at 127\.0\.0\.1:11434: agent/.test(e.message))).toBe(true);
  });
});
