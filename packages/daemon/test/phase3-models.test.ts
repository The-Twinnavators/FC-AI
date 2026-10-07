/**
 * Phase 3 acceptance: a non-tool-calling model is rejected for Coder; a passing model completes the
 * read/edit/manifest/command/repair probe. Typed errors, retries and cancellation semantics.
 */
import { describe, expect, it } from "vitest";
import { classifyError } from "../src/models/errors.js";
import { ProviderError } from "../src/models/types.js";
import { ScriptedProvider } from "../src/models/scripted.js";
import { looksLikePseudoToolCall } from "../src/orchestrator/agentLoop.js";
import { makeApp } from "./helpers.js";
import { idealProbeSolver, pseudoJsonModel } from "./scripted-agents.js";

describe("typed provider errors", () => {
  it("classifies transport and protocol failures", () => {
    expect(classifyError(Object.assign(new Error("fetch failed"), { cause: { code: "ECONNREFUSED" } })).kind).toBe("connection_refused");
    expect(classifyError(Object.assign(new Error("socket hang up"), { code: "ECONNRESET" })).kind).toBe("connection_reset");
    expect(classifyError(Object.assign(new Error("getaddrinfo ENOTFOUND api.example"), { code: "ENOTFOUND" })).kind).toBe("dns_failure");
    expect(classifyError(new Error("HTTP 429 Too Many Requests"), undefined, 429).kind).toBe("rate_limited");
    expect(classifyError(new Error("prompt is too long: exceeds context window")).kind).toBe("context_limit");
    // Calculator test 1: a GPU out-of-memory 500 is retried, not a blocked step.
    const oom = classifyError(new Error('Ollama /api/chat HTTP 500: {"error":"an error was encountered while running the model: CUDA error: out of memory\\nCUDA error"}'), undefined, 500);
    expect(oom.kind).toBe("out_of_memory");
    expect(oom.retryable).toBe(true);
    expect(classifyError(new Error("registry.ollama.ai/library/gemma2:2b does not support tools")).kind).toBe("tool_call_invalid");
    expect(classifyError(new Error("Unexpected token < in JSON")).kind).toBe("invalid_response");
    const ctrl = new AbortController();
    ctrl.abort();
    expect(classifyError(Object.assign(new Error("aborted"), { name: "AbortError" }), ctrl.signal).kind).toBe("cancelled");
    const e = classifyError(new Error("Bearer sk-proj-aaaaaaaaaaaaaaaaaaaaaaaaaaaa failed at https://api.example.com/v1?key=zzz"));
    expect(e.causes.join(" ")).not.toContain("sk-proj-aaaa");
    expect(e.causes.join(" ")).not.toContain("key=zzz");
  });

  it("retries only bounded retryable transport failures; cancellation is terminal", async () => {
    const { app } = makeApp();
    app.router.sleep = async () => undefined;
    let n = 0;
    const flaky = new ScriptedProvider({ id: "flaky", kind: "scripted", label: "flaky", enabled: true, hosted: false }, () => {
      n++;
      return n < 3 ? new ProviderError("connection_reset", "reset") : { content: "ok" };
    });
    app.router.register(flaky);
    const res = await app.router.chat({ role: "planner" }, { providerId: "flaky", model: "m" }, { messages: [{ role: "user", content: "hi" }] });
    expect(res.content).toBe("ok");
    expect(n).toBe(3);
    expect(app.bus.list({ types: ["model.retry_scheduled"] })).toHaveLength(2);

    let m = 0;
    const invalid = new ScriptedProvider({ id: "invalid", kind: "scripted", label: "invalid", enabled: true, hosted: false }, () => {
      m++;
      return new ProviderError("invalid_response", "bad json");
    });
    app.router.register(invalid);
    await expect(app.router.chat({ role: "planner" }, { providerId: "invalid", model: "m" }, { messages: [] })).rejects.toMatchObject({ kind: "invalid_response" });
    expect(m).toBe(1);

    let k = 0;
    const always = new ScriptedProvider({ id: "always", kind: "scripted", label: "always", enabled: true, hosted: false }, () => {
      k++;
      return new ProviderError("timeout", "slow");
    });
    app.router.register(always);
    await expect(app.router.chat({ role: "planner" }, { providerId: "always", model: "m" }, { messages: [] })).rejects.toMatchObject({ kind: "timeout" });
    expect(k).toBe(1 + app.router.retry.maxRetries);

    const ctrl = new AbortController();
    ctrl.abort();
    let c = 0;
    const cancelled = new ScriptedProvider({ id: "c", kind: "scripted", label: "c", enabled: true, hosted: false }, () => {
      c++;
      return { content: "never" };
    });
    app.router.register(cancelled);
    await expect(app.router.chat({ role: "planner" }, { providerId: "c", model: "m" }, { messages: [], signal: ctrl.signal })).rejects.toMatchObject({ kind: "cancelled" });
    expect(c).toBe(0);
  });

  it("hosted providers require explicit consent", async () => {
    const { app } = makeApp();
    const project = app.projects.create({ name: "p" });
    await expect(app.router.chat({ role: "coder", projectId: project.id }, { providerId: "hosted-openai-compatible", model: "x" }, { messages: [] })).rejects.toThrow(/consent/);
  });
});

describe("capability lab", () => {
  it("runs tool calls written as text, but a model still has to do the work to pass", async () => {
    const { app } = makeApp();
    // This model only ever writes one read_file call as text: FlowCode reads and runs it, but the probes' work never
    // gets done, so the model fails and can't be the coder.
    app.router.register(pseudoJsonModel());
    expect(looksLikePseudoToolCall('{"name": "read_file", "arguments": {}}')).toBe(true);
    const asg = { providerId: "scripted-pseudo", model: "pseudo" };
    const rec = await app.lab.probe(asg);
    expect(rec.passed).toBe(false);
    expect(rec.nativeToolCalls).toBe(true);
    expect(rec.results.some((r) => /couldn't read|made no tool calls/.test(r.detail))).toBe(false);
    expect(app.lab.coderEligibility(asg).eligible).toBe(false);
  });

  it("rejects a model whose text tool calls can't be read, and blocks it from the Coder role", async () => {
    const { app } = makeApp();
    app.router.register(new ScriptedProvider({ id: "scripted-garbled", kind: "scripted", label: "garbled", enabled: true, hosted: false }, () => ({ content: '<tool_call>{"name": "read_file", "arguments": {path: README.md</tool_call>' })));
    const asg = { providerId: "scripted-garbled", model: "garbled" };
    const rec = await app.lab.probe(asg);
    expect(rec.passed).toBe(false);
    expect(rec.nativeToolCalls).toBe(false);
    expect(rec.results.every((r) => /couldn't read|made no tool calls/.test(r.detail))).toBe(true);
    expect(app.lab.coderEligibility(asg).eligible).toBe(false);
  });

  it("a passing model completes read/create/patch/manifest/follow-up/approval/command/repair probes", async () => {
    const { app } = makeApp();
    app.router.register(idealProbeSolver());
    const asg = { providerId: "scripted-ideal", model: "ideal" };
    const rec = await app.lab.probe(asg);
    for (const r of rec.results) expect(r, `${r.probe}: ${r.detail}`).toMatchObject({ passed: true });
    expect(rec.passed).toBe(true);
    expect(rec.results).toHaveLength(8);
    expect(app.lab.coderEligibility(asg).eligible).toBe(true);
    // Results are keyed by configuration: a different temperature has no record yet.
    expect(app.lab.coderEligibility({ ...asg, temperature: 0.9 }).eligible).toBe(false);
  });
});
