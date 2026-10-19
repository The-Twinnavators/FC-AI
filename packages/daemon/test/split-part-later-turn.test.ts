/**
 * A split part can't be split again. When its later turn (opening request, a full read of its largest own file, a check
 * result and the reply) doesn't fit the coding context, it isn't sent to rely on trimming: it stops before any model
 * call and waits for the person's choice, saying by how many tokens it is over.
 */
import { describe, expect, it } from "vitest";
import type { Task } from "@flowcode/contracts";
import { ScriptedProvider } from "../src/models/scripted.js";
import { ModelRouter } from "../src/models/router.js";
import { idealProbeSolver } from "./scripted-agents.js";
import { makeApp, makeProject, waitFor } from "./helpers.js";

describe("a split part whose later turn doesn't fit", () => {
  it("stops before the model with the overflow in tokens and waits for the person", async () => {
    const { app } = makeApp();
    const provider = new ScriptedProvider({ id: "scripted", kind: "scripted", label: "local", enabled: true, hosted: false }, async () => ({ content: "should not be called" }));
    app.router.register(provider);
    app.router.register(idealProbeSolver("scripted-ideal"));
    const asg = { providerId: "scripted", model: "agent" };
    const lab = await app.lab.probe({ providerId: "scripted-ideal", model: "agent" });
    app.store.capabilities.upsert({ ...lab, id: "cap_copy", providerId: "scripted", model: "agent", configHash: ModelRouter.configHash(asg) });
    for (const role of ["planner", "coder", "debugger"] as const) app.router.setRoleAssignment(role, asg);
    // An own file the opening can carry only in part, long enough that reading it in full can't fit a later turn.
    const big = Array.from({ length: 1400 }, (_, i) => `export const value${i} = "${"x".repeat(40)}";`).join("\n") + "\n";
    const { project } = makeProject(app, { "README.md": "# demo\n", "package.json": JSON.stringify({ name: "demo", version: "1.0.0", scripts: { typecheck: "tsc --noEmit" } }), "src/a.ts": big });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "demo", constraints: [], attachedKnowledgeIds: [] });
    app.store.runs.upsert({ ...app.store.runs.require(run.id), planApproved: true });
    const task = { id: "t1", runId: run.id, title: "Change a", objective: "Change src/a.ts so value1 is 2.", status: "pending", dependsOn: [], expectedPaths: ["src/a.ts"], actualPaths: [], acceptanceCriteria: [], validationPlan: { kinds: [] }, role: "coder", ordinal: 1, attempts: 0 } as unknown as Task;
    app.store.tasks.upsert(task);
    app.store.setSetting("splitPart:t1", true);
    const before = provider.calls.length;
    app.orchestrator.start(run.id);
    const blocked = await waitFor(() => {
      const t = app.store.tasks.require("t1");
      return t.status === "blocked" ? t : undefined;
    }, 20_000);
    expect(blocked.blocker?.reason).toMatch(/^"Change a" doesn't fit the coding context: a later turn needs about \d+ more tokens than agent's \d+k window leaves for it with \d+ tokens of working headroom \(\d+ of \d+\)$/);
    expect(provider.calls.length).toBe(before);
    expect(blocked.attempts).toBe(0);
    await app.orchestrator.cancel(run.id).catch(() => undefined);
  }, 30_000);
});
