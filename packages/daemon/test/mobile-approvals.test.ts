/** Phone approvals: a key-protected page on the local network that lists pending approvals and decides them. */
import { describe, expect, it } from "vitest";
import { createMobileApprovals } from "../src/api/mobile.js";
import { makeApp, makeProject } from "./helpers.js";

describe("phone approvals", () => {
  it("is off until turned on, needs its key, lists pending approvals and decides them", async () => {
    const { app } = makeApp();
    const { project } = makeProject(app, { "a.txt": "x" });
    const decided: Array<{ id: string; decision: string }> = [];
    // Any free port: Windows reserves some fixed ranges.
    app.store.setSetting("mobile:approvals", { enabled: false, key: "", port: 0 });
    const retried: Array<{ runId: string; taskId: string; guidance?: string }> = [];
    const mobile = createMobileApprovals(
      app,
      (id, input) => {
        decided.push({ id, decision: input.decision });
        return app.approvals.decide(id, input.decision, input.note);
      },
      (runId, taskId, guidance) => retried.push({ runId, taskId, guidance }),
    );
    expect(await mobile.status()).toMatchObject({ enabled: false, running: false, urls: [], pushDevices: 0 });
    const on = await mobile.setEnabled(true);
    try {
      expect(on).toMatchObject({ enabled: true, running: true });
      const port = on.port;
      expect(port).toBeGreaterThan(0);
      const key = new URL(`http://x/?${on.urls[0]?.split("?")[1] ?? `k=${(app.store.getSetting("mobile:approvals", null) as { key: string }).key}`}`).searchParams.get("k")!;
      const base = `http://127.0.0.1:${port}`;
      // Wrong or missing key: nothing.
      expect((await fetch(`${base}/api/approvals?k=wrong`)).status).toBe(401);
      expect(await (await fetch(`${base}/?k=nope`)).text()).toMatch(/This link has expired/);
      // The page and the list with the key.
      const page = await (await fetch(`${base}/?k=${key}`)).text();
      expect(page).toMatch(/<title>FlowCode<\/title><link rel="icon" href="data:image\/svg\+xml,/);
      expect(page).toMatch(/<span class="brand__name">FlowCode <em>AI<\/em><\/span>/);
      const run = app.orchestrator.createRun({ projectId: project.id, objective: "Build the first version of the Basic Calendar App described in the attached PRD.\n\nMore detail here.", constraints: [], attachedKnowledgeIds: [] });
      const a = app.approvals.request({ projectId: project.id, runId: run.id, kind: "file_operation", action: "apply_patch on src/App.tsx (outside the approved plan scope)", reason: "Task wants to modify files not listed in the plan", affected: ["src/App.tsx"], risk: "medium", consequencesOfDenial: "The change is not made." });
      const list = (await (await fetch(`${base}/api/approvals`, { headers: { "x-flowcode-key": key } })).json()) as { approvals: Array<{ id: string; project: string; build: string }> };
      expect(list.approvals).toEqual([expect.objectContaining({ id: a.id, project: project.name, build: "Build the first version of the Basic Calendar App described in the attached PRD." })]);
      // Only Allow once or Deny.
      expect((await fetch(`${base}/api/approvals/${a.id}`, { method: "POST", headers: { "x-flowcode-key": key }, body: JSON.stringify({ decision: "project" }) })).status).toBe(400);
      expect((await fetch(`${base}/api/approvals/${a.id}`, { method: "POST", headers: { "x-flowcode-key": key }, body: JSON.stringify({ decision: "once" }) })).status).toBe(200);
      expect(decided).toEqual([{ id: a.id, decision: "once" }]);
      expect(app.approvals.pending()).toEqual([]);
      // Installs as an app: the manifest opens the page with its key; the service worker shows pushes.
      const man = (await (await fetch(`${base}/manifest.webmanifest?k=${key}`)).json()) as { start_url: string; display: string };
      expect(man).toMatchObject({ start_url: `/?k=${key}`, display: "standalone" });
      expect(await (await fetch(`${base}/sw.js?k=${key}`)).text()).toMatch(/showNotification/);
      expect((await fetch(`${base}/manifest.webmanifest?k=wrong`)).status).toBe(401);
      // Blocked builds are listed; retry needs a blocked step.
      app.store.runs.upsert({ ...app.store.runs.require(run.id), status: "blocked", statusReason: 'Task "App layout" is blocked' });
      const withBlocked = (await (await fetch(`${base}/api/approvals`, { headers: { "x-flowcode-key": key } })).json()) as { blocked: Array<{ runId: string; project: string }> };
      expect(withBlocked.blocked).toEqual([expect.objectContaining({ runId: run.id, project: project.name })]);
      expect((await fetch(`${base}/api/blocked/${run.id}/retry`, { method: "POST", headers: { "x-flowcode-key": key }, body: "{}" })).status).toBe(404);
      // Dismissed builds leave the list, Undo brings them back, and a new block on the same build shows again.
      const listed = async () => ((await (await fetch(`${base}/api/approvals`, { headers: { "x-flowcode-key": key } })).json()) as { blocked: Array<{ runId: string }> }).blocked.map((b) => b.runId);
      const act = (what: string) => fetch(`${base}/api/blocked/${run.id}/${what}`, { method: "POST", headers: { "x-flowcode-key": key }, body: "{}" });
      expect((await act("dismiss")).status).toBe(200);
      expect(await listed()).toEqual([]);
      expect((await act("restore")).status).toBe(200);
      expect(await listed()).toEqual([run.id]);
      await act("dismiss");
      app.store.runs.upsert({ ...app.store.runs.require(run.id), statusReason: 'Task "Screens" is blocked' });
      expect(await listed()).toEqual([run.id]);
      app.store.runs.upsert({ ...app.store.runs.require(run.id), statusReason: 'Task "App layout" is blocked' });
      expect(retried).toEqual([]);
      // Push: FlowCode's public key, and a phone's subscription kept (a fake one is refused).
      const { key: pub } = (await (await fetch(`${base}/api/push/key`, { headers: { "x-flowcode-key": key } })).json()) as { key: string };
      expect(pub.length).toBeGreaterThan(40);
      expect((await fetch(`${base}/api/push/subscribe`, { method: "POST", headers: { "x-flowcode-key": key }, body: JSON.stringify({ endpoint: "http://evil", keys: {} }) })).status).toBe(400);
      const sub = { endpoint: "https://push.example.com/abc", keys: { p256dh: "BNc", auth: "xyz" } };
      expect((await fetch(`${base}/api/push/subscribe`, { method: "POST", headers: { "x-flowcode-key": key }, body: JSON.stringify(sub) })).status).toBe(200);
      expect((await mobile.status()).pushDevices).toBe(1);
      // A new key retires the old link and its phones' notifications.
      const after = await mobile.rotate();
      expect((await fetch(`http://127.0.0.1:${after.port}/api/approvals`, { headers: { "x-flowcode-key": key } })).status).toBe(401);
      expect(after.pushDevices).toBe(0);
    } finally {
      await mobile.setEnabled(false);
    }
    expect((await mobile.status()).running).toBe(false);
  });
});
