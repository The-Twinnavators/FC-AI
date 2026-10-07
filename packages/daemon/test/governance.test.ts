/**
 * Approvals bind to the exact action the person saw; every decision (approvals, settings, run control, improvements)
 * lands in one decision log, without secret values; improvements are confirmed only after testing.
 */
import { describe, expect, it } from "vitest";
import { startServer } from "../src/api/server.js";
import { describeBody, listDecisions } from "../src/governance/decisionLog.js";
import { IMPROVEMENTS_KEY } from "../src/quality/runReview.js";
import { makeApp, makeProject } from "./helpers.js";

async function withServer<T>(fn: (call: (method: string, path: string, body?: unknown) => Promise<{ status: number; json: unknown }>, app: ReturnType<typeof makeApp>["app"]) => Promise<T>) {
  const { app } = makeApp();
  const server = await startServer(app, { port: 0, token: "t", host: "127.0.0.1" });
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`http://127.0.0.1:${server.port}${path}`, { method, headers: { authorization: "Bearer t", "content-type": "application/json" }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, json: await res.json().catch(() => null) };
  };
  try {
    return await fn(call, app);
  } finally {
    await server.close();
  }
}

describe("approvals and the decision log", () => {
  it("refuses a decision when the action shown no longer matches, and logs the real decision", async () => {
    await withServer(async (call, app) => {
      const { project } = makeProject(app, { "a.txt": "x" });
      const run = app.orchestrator.createRun({ projectId: project.id, objective: "Build", constraints: [], attachedKnowledgeIds: [] });
      const a = app.approvals.request({ projectId: project.id, runId: run.id, kind: "command", action: "npm install left-pad", reason: "needed", affected: [], risk: "medium", consequencesOfDenial: "the step stops" });
      const stale = await call("POST", `/approvals/${a.id}/decision`, { decision: "once", action: "npm install something-else" });
      expect(stale.status).toBe(409);
      expect(app.store.approvals.require(a.id).status).toBe("pending");
      const ok = await call("POST", `/approvals/${a.id}/decision`, { decision: "once", action: "npm install left-pad" });
      expect(ok.status).toBe(200);
      expect(app.store.approvals.require(a.id).status).toBe("approved");
      // Deciding twice is refused rather than silently re-applied.
      expect((await call("POST", `/approvals/${a.id}/decision`, { decision: "deny" })).status).toBe(409);
      const log = listDecisions(app, { kind: "approval" });
      expect(log).toHaveLength(1);
      expect(log[0]).toMatchObject({ actor: "user", runId: run.id, projectId: project.id, ref: `approval:${a.id}` });
      expect(log[0].summary).toMatch(/Approved once: npm install left-pad/);
      const history = await call("GET", "/approvals/history");
      expect((history.json as Array<{ id: string }>).map((x) => x.id)).toContain(a.id);
    });
  });

  it("logs settings changes by name, never secret values", async () => {
    await withServer(async (call, app) => {
      const { project } = makeProject(app, { "a.txt": "x" });
      await call("POST", `/projects/${project.id}/settings`, { allowExternalResearch: true });
      const d = listDecisions(app, { kind: "settings" })[0];
      expect(d).toMatchObject({ projectId: project.id, actor: "user" });
      expect(d.summary).toMatch(/allowExternalResearch: true/);
    });
    expect(describeBody({ apiKey: "sk-secret-123", provider: "anthropic" })).toBe("apiKey (changed); provider: anthropic");
    expect(describeBody({ note: "token sk-abc" })).not.toMatch(/sk-abc/);
  });

  it("confirms an improvement only after it was tested", async () => {
    await withServer(async (call, app) => {
      app.store.setSetting(IMPROVEMENTS_KEY, [{ id: "imp_x", key: "k", name: "Do X", status: "proposed", relatedRuns: [], evidence: [], benefit: "", change: "", target: "", owner: "", priority: "now", scope: "global", baseline: "", successMeasure: "", validation: "", approvalRequired: true, rollback: "", history: [] }]);
      expect((await call("POST", "/improvements/imp_x/status", { status: "verified" })).status).toBe(409);
      expect((await call("POST", "/improvements/imp_x/status", { status: "approved", note: "worth a try" })).status).toBe(200);
      await call("POST", "/improvements/imp_x/status", { status: "testing" });
      expect((await call("POST", "/improvements/imp_x/status", { status: "verified" })).status).toBe(200);
      const item = (await call("GET", "/improvements")).json as Array<{ status: string; history: Array<{ status: string; actor: string }> }>;
      expect(item[0].status).toBe("verified");
      expect(item[0].history.map((h) => h.status)).toEqual(["approved", "testing", "verified"]);
      expect(listDecisions(app, { kind: "improvement" })).toHaveLength(3);
    });
  });
});

describe("ideas saved for later", () => {
  it("stay pending and off the new-ideas list until built or dismissed; only ideas can be saved", async () => {
    await withServer(async (call, app) => {
      const { project } = makeProject(app, { "a.txt": "x" });
      const idea = app.approvals.request({ projectId: project.id, kind: "enhancement_idea", action: "Add dark mode", reason: "idea", affected: [], risk: "low", consequencesOfDenial: "none" });
      const cmd = app.approvals.request({ projectId: project.id, kind: "command", action: "npm test", reason: "x", affected: [], risk: "low", consequencesOfDenial: "none" });
      expect((await call("POST", `/approvals/${idea.id}/save`, { saved: true })).status).toBe(200);
      const saved = app.store.approvals.require(idea.id);
      expect(saved).toMatchObject({ status: "pending", savedForLater: true });
      expect(listDecisions(app, { kind: "approval" })[0].summary).toMatch(/Saved for later: Add dark mode/);
      expect((await call("POST", `/approvals/${cmd.id}/save`, { saved: true })).status).toBe(400);
      await call("POST", `/approvals/${idea.id}/decision`, { decision: "deny", action: "Add dark mode" });
      expect((await call("POST", `/approvals/${idea.id}/save`, { saved: false })).status).toBe(409);
    });
  });
});

describe("your own ideas", () => {
  it("are saved for later as your idea, logged, and not suggested again by FlowCode", async () => {
    await withServer(async (call, app) => {
      const { project } = makeProject(app, { "a.txt": "x" });
      const res = await call("POST", `/projects/${project.id}/ideas`, { title: "Compare two brands side by side" });
      expect(res.status).toBe(200);
      const idea = res.json as { id: string; kind: string; author: string; savedForLater: boolean; status: string; detail: string };
      expect(idea).toMatchObject({ kind: "enhancement_idea", author: "you", savedForLater: true, status: "pending", detail: "Compare two brands side by side" });
      expect(app.store.getSetting<string[]>(`ideas:${project.id}`, [])).toContain("Compare two brands side by side");
      expect(listDecisions(app, { kind: "approval" })[0].summary).toMatch(/Added your own idea: Compare two brands/);
      expect((await call("POST", `/projects/${project.id}/ideas`, { title: "x" })).status).toBe(400);
    });
  });
});
