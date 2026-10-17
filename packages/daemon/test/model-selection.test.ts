/**
 * The models a build uses are visible from its start, with where each choice came from and the limits it runs with;
 * a change to a role's default model is recorded with where the request came from, and with an unknown actor when the
 * API can't name one. Nothing here changes or substitutes a model.
 */
import { describe, expect, it } from "vitest";
import type { FlowEvent } from "@flowcode/contracts";
import { requestOrigin, logDecision, listDecisions } from "../src/governance/decisionLog.js";
import { setRuntimeOptions } from "../src/orchestrator/runtimeOptions.js";
import { codingReplyCap, codingWindowTokens } from "../src/orchestrator/orchestrator.js";
import { makeApp, makeProject } from "./helpers.js";

describe("model setting audit", () => {
  it("records who set a role's model as unknown when the API can't name them, with where the request came from", () => {
    const { app } = makeApp();
    app.router.setRoleAssignment("coder", { providerId: "ollama", model: "qwen3-coder:30b", temperature: 0.1 }, { actor: "unknown", origin: requestOrigin("http://localhost:5199") });
    expect(app.router.roleSettingMeta().coder).toMatchObject({ model: "qwen3-coder:30b", providerId: "ollama", actor: "unknown", origin: "the FlowCode UI at http://localhost:5199" });
    expect(requestOrigin(undefined)).toMatch(/no browser origin/);
    expect(requestOrigin("null")).toBe("the FlowCode desktop window");
    logDecision(app, { kind: "model", actor: "unknown", origin: requestOrigin(undefined), summary: "Set the coder model to qwen3-coder:30b (ollama)" });
    expect(listDecisions(app, { kind: "model" })[0]).toMatchObject({ actor: "unknown", origin: "no browser origin (a script or tool calling the API)" });
  });
});

describe("the models a build runs with", () => {
  it("says at the start which model each role uses, where it came from, its context and its reply cap", async () => {
    const { app } = makeApp();
    for (const role of ["planner", "coder", "debugger"] as const) app.router.setRoleAssignment(role, { providerId: "ollama", model: "qwen3-coder:30b", temperature: 0.1 }, { actor: "unknown", origin: "the FlowCode UI at http://localhost:5199" });
    const { project } = makeProject(app, { "README.md": "# demo\n" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "g", constraints: [], attachedKnowledgeIds: [] });
    const seen: FlowEvent[] = [];
    app.bus.subscribe((e) => void (e.type === "model.selection" && seen.push(e)));
    // A local model that supports a long context, as Ollama describes qwen3-coder:30b.
    app.router.provider("ollama").describe = async () => ({ name: "qwen3-coder:30b", maxContext: 262_144, sizeBytes: 18e9, capabilities: ["completion", "tools"] }) as never;
    setRuntimeOptions(app.store, { gpuProfile: "8gb", profileContext: 16384 });
    await (app.orchestrator as unknown as { recordModelSelection: (r: unknown) => Promise<void> }).recordModelSelection(app.store.runs.require(run.id));
    const rows = (seen[0]!.data as { models: Array<{ role: string; model: string; source: string; contextTokens: number; replyCapTokens: number }> }).models;
    expect(rows.map((r) => r.role)).toEqual(["planner", "coder", "debugger"]);
    expect(rows.find((r) => r.role === "coder")).toMatchObject({ model: "qwen3-coder:30b", contextTokens: 16384, replyCapTokens: 4096 });
    expect(rows.find((r) => r.role === "coder")!.source).toMatch(/^the global role setting \(Models page\), set .* by unknown via the FlowCode UI at http:\/\/localhost:5199$/);
    expect(seen[0]!.message).toMatch(/coder qwen3-coder:30b \(ollama; 16k context, replies up to 4096 tokens/);
    expect(app.store.getSetting(`runModels:${run.id}`, [])).toHaveLength(3);
    setRuntimeOptions(app.store, { gpuProfile: "standard" });
  });

  it("names a build's own choice over the global setting", () => {
    const { app } = makeApp();
    const { project } = makeProject(app, { "README.md": "# demo\n" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "g", constraints: [], attachedKnowledgeIds: [], modelAssignments: { coder: { providerId: "ollama", model: "qwen3:8b", temperature: 0.1 } } });
    expect(app.store.getSetting<Record<string, string>>(`runModelSources:${run.id}`, {}).coder).toMatch(/chosen for this build/);
  });

  it("caps a local reply at 4,096 tokens and a hosted one at 16,000 or a quarter of its window", () => {
    expect(codingReplyCap({ providerId: "ollama", model: "m", contextWindow: 24576 })).toBe(4096);
    expect(codingReplyCap({ providerId: "ollama", model: "m", contextWindow: 12288 })).toBe(3072);
    expect(codingReplyCap({ providerId: "hosted-anthropic", model: "m" })).toBe(32_000);
    expect(codingWindowTokens({ providerId: "ollama", model: "m" })).toBe(16_384);
  });
});
