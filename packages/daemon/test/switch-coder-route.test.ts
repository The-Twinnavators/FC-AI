/**
 * Switching a build between cloud and local moves its planner with its coder and debugger (Clean Cart: after the cloud
 * usage limit the build was switched to local, but its planner stayed on the cloud and would have stopped it again).
 */
import { describe, expect, it } from "vitest";
import { startServer } from "../src/api/server.js";
import { makeApp, makeProject } from "./helpers.js";

describe("switching a build to local models", () => {
  it("moves the planner, coder and debugger to the local models", async () => {
    const { app } = makeApp();
    const { project } = makeProject(app);
    const cloud = { providerId: "hosted-anthropic", model: "claude-sonnet-5-5", temperature: 0.2 };
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Clean Cart", constraints: [], attachedKnowledgeIds: [], modelAssignments: { planner: cloud, coder: cloud, debugger: cloud } });
    const server = await startServer(app, { port: 0, token: "t", host: "127.0.0.1" });
    try {
      const res = await fetch(`http://127.0.0.1:${server.port}/runs/${run.id}/coder`, { method: "POST", headers: { authorization: "Bearer t", "content-type": "application/json" }, body: JSON.stringify({ coder: "local" }) });
      expect(res.status).toBe(200);
      const after = app.store.runs.require(run.id).modelAssignments;
      const local = app.router.roleAssignments(project.id);
      expect(after.planner).toEqual(local.planner);
      expect(after.coder).toEqual(local.coder);
      expect(after.debugger).toEqual(local.debugger);
      expect(after.planner?.providerId).not.toBe("hosted-anthropic");
    } finally {
      await server.close();
    }
  });
});

describe("switching models while a step runs", () => {
  it("stops the attempt in progress and resumes the build at once on the new models", async () => {
    const { app } = makeApp();
    const { project } = makeProject(app);
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Clean Cart", constraints: [], attachedKnowledgeIds: [] });
    const orch = app.orchestrator as unknown as { active: Map<string, AbortController>; resume: (id: string) => unknown };
    const ctrl = new AbortController();
    // The work loop ends when its attempt is aborted (as execute() does).
    ctrl.signal.addEventListener("abort", () => setTimeout(() => orch.active.delete(run.id), 20));
    orch.active.set(run.id, ctrl);
    const resumed: string[] = [];
    orch.resume = (id: string) => (resumed.push(id), undefined);
    expect(await app.orchestrator.restartWithNewModels(run.id)).toBe(true);
    expect(ctrl.signal.aborted).toBe(true);
    expect(resumed).toEqual([run.id]);
    // Nothing running: nothing to restart.
    expect(await app.orchestrator.restartWithNewModels(run.id)).toBe(false);
  });
});
