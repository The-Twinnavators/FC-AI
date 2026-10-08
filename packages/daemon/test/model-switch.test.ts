import { describe, expect, it } from "vitest";
import { makeApp, makeProject } from "./helpers.js";

const local = (model: string) => ({ providerId: "ollama", model, temperature: 0.1 });

describe("switching a model on the Models page", () => {
  it("reaches builds still going, from their next model call, and says so in their activity", () => {
    const { app } = makeApp();
    const { project } = makeProject(app);
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "A money app for kids", constraints: [], attachedKnowledgeIds: [], modelAssignments: { coder: local("qwen3:14b") } });
    const done = app.orchestrator.createRun({ projectId: project.id, objective: "An older build", constraints: [], attachedKnowledgeIds: [], modelAssignments: { coder: local("qwen3:14b") } });
    app.store.runs.upsert({ ...app.store.runs.require(done.id), status: "done" });
    const seen: string[] = [];
    app.bus.subscribe((e) => (e.type === "model.switched" ? seen.push(e.message) : undefined));

    const switched = app.orchestrator.switchRoleModel("coder", local("qwen3-coder:30b"));

    expect(switched).toEqual([run.id]);
    expect(app.store.runs.require(run.id).modelAssignments.coder?.model).toBe("qwen3-coder:30b");
    expect(app.store.runs.require(done.id).modelAssignments.coder?.model).toBe("qwen3:14b");
    expect(seen[0]).toMatch(/switched the coder to qwen3-coder:30b.*was qwen3:14b/);
  });

  it("leaves a build that chose the cloud for this change, and a project with its own model for the role", () => {
    const { app } = makeApp();
    const { project } = makeProject(app);
    const cloud = app.orchestrator.createRun({ projectId: project.id, objective: "Cloud change", constraints: [], attachedKnowledgeIds: [], modelAssignments: { coder: { providerId: "hosted-openai", model: "claude-sonnet-5-5" } } });
    const { project: pinned } = makeProject(app);
    app.projects.updateSettings(pinned.id, { modelOverrides: { coder: local("qwen2.5-coder:7b") } });
    const own = app.orchestrator.createRun({ projectId: pinned.id, objective: "Pinned", constraints: [], attachedKnowledgeIds: [] });

    expect(app.orchestrator.switchRoleModel("coder", local("qwen3-coder:30b"))).toEqual([]);
    expect(app.store.runs.require(cloud.id).modelAssignments.coder?.model).toBe("claude-sonnet-5-5");
    expect(app.store.runs.require(own.id).modelAssignments.coder?.model).toBe("qwen2.5-coder:7b");
  });
});
