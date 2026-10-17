/**
 * A split step's edits are kept across the split as one provisional set its parts inherit (Clean Cart slice eval 1:
 * the valid hero rewrite was undone at the split). The set is accepted only when every part is verified; when a part
 * fails, or a step before it starts over, the whole set goes back coherently or waits for the person; it is recorded
 * once and never applied twice.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Task } from "@flowcode/contracts";
import { makeApp, makeProject } from "./helpers.js";
import { createApp } from "../src/app.js";
import { provisionalKey, type ProvisionalSet } from "../src/orchestrator/provisional.js";

function setup() {
  const { app, dataDir } = makeApp();
  const { project, ws } = makeProject(app, { "src/b.ts": "export const b = 1;\n", "src/d.ts": "export const d = 1;\n", "src/e.ts": "export const e = 1;\n" });
  const run = app.orchestrator.createRun({ projectId: project.id, objective: "g", constraints: [], attachedKnowledgeIds: [] });
  const jail = app.projects.jail(project);
  const mk = (id: string, ordinal: number, status: string) => {
    const t = { id, runId: run.id, title: `Step ${id}`, objective: id, status, dependsOn: [], expectedPaths: [], actualPaths: [], acceptanceCriteria: [], validationPlan: { kinds: [] }, role: "coder", ordinal, attempts: 1 } as unknown as Task;
    app.store.tasks.upsert(t);
    return t;
  };
  const edit = (taskId: string, rel: string, content: string) => {
    app.ops.replaceContent({ jail, projectId: project.id, runId: run.id, taskId, toolCallId: `tc_${taskId}_${rel}_${content.length}`, approved: true }, rel, content);
    const t = app.store.tasks.require(taskId);
    app.store.tasks.upsert({ ...t, actualPaths: [...new Set([...t.actualPaths, rel])] });
  };
  const status = (id: string, s: string) => app.store.tasks.upsert({ ...app.store.tasks.require(id), status: s } as Task);
  const verify = (id: string) => {
    status(id, "verified");
    app.snapshots.createCheckpoint(run.id, `Verified "Step ${id}"`, true, id);
    orch.settleProvisional(app.store.runs.require(run.id), id);
  };
  const read = (rel: string) => fs.readFileSync(path.join(ws, rel), "utf8");
  const orch = app.orchestrator as unknown as {
    keepProvisional: (r: unknown, t: Task, j: unknown, p: Task[]) => ProvisionalSet | undefined;
    settleProvisional: (r: unknown, id: string) => void;
    undoBlockedStep: (r: unknown, id: string, j: unknown) => Promise<void>;
    undoLaterUnaccepted: (r: unknown, t: Task, j: unknown) => Promise<string | undefined>;
  };
  const r = () => app.store.runs.require(run.id);
  const set = (parentId: string) => app.store.getSetting<ProvisionalSet | null>(provisionalKey(parentId), null);
  const notes: string[] = [];
  app.bus.subscribe((e) => void (/recovery\.action|run\.status_changed/.test(e.type) && notes.push(e.message)));
  // A split step p (edited src/b.ts, ran out of actions), split into parts c1 and c2 after it; a step a before it.
  const a = mk("a", 1, "verified");
  const p = mk("p", 2, "attempted");
  edit(p.id, "src/b.ts", "export const b = 2; // hero from the PRD\n");
  status(p.id, "skipped");
  const c1 = mk("c1", 3, "pending");
  const c2 = mk("c2", 4, "pending");
  const split = () => orch.keepProvisional(r(), app.store.tasks.require(p.id), jail, [c1, c2]);
  return { app, dataDir, project, run, jail, a, p, c1, c2, edit, status, verify, read, orch, r, set, notes, split };
}

describe("a split step's edits across the split", () => {
  it("are kept, recorded with their boundary, inherited by the parts, and accepted only when every part is verified", () => {
    const s = setup();
    const kept = s.split()!;
    expect(s.read("src/b.ts")).toBe("export const b = 2; // hero from the PRD\n");
    expect(kept).toMatchObject({ parentId: "p", files: ["src/b.ts"], children: ["c1", "c2"], state: "provisional" });
    expect(s.app.store.checkpoints.require(kept.checkpointId).label).toBe('Provisional "Step p" (split)');
    const art = s.app.store.db.all<{ data: string }>("SELECT data FROM artifacts WHERE run_id = ?", s.run.id).map((x) => JSON.parse(x.data) as { label: string });
    expect(art.some((x) => x.label === "Provisional changes: Step p")).toBe(true);
    expect(s.app.store.getSetting<string[]>("taskFindings:c1", [])[0]).toMatch(/^Inherited from "Step p" \(split\): its changes to src\/b\.ts are in place but not accepted yet/);
    s.edit("c1", "src/d.ts", "export const d = 2;\n");
    s.verify("c1");
    expect(s.set("p")!.state).toBe("provisional");
    s.edit("c2", "src/e.ts", "export const e = 2;\n");
    s.verify("c2");
    expect(s.set("p")!.state).toBe("accepted");
    expect(s.read("src/b.ts")).toContain("hero from the PRD");
  });

  it("go back with the failed part's own edits when a part is blocked", async () => {
    const s = setup();
    s.split();
    s.edit("c1", "src/d.ts", "BROKEN\n");
    s.status("c1", "blocked");
    await s.orch.undoBlockedStep(s.r(), "c1", s.jail);
    expect(s.read("src/d.ts")).toBe("export const d = 1;\n");
    expect(s.read("src/b.ts")).toBe("export const b = 1;\n");
    expect(s.set("p")).toMatchObject({ state: "restored", reason: 'its part "Step c1" was blocked' });
  }, 60_000);

  it("on overlapping files: a failed part's edits on top go back first, then the set; a verified part on the same file keeps it all and waits for you", async () => {
    const s = setup();
    s.split();
    s.edit("c1", "src/b.ts", "export const b = 3; // on top of the hero\n");
    s.status("c1", "blocked");
    await s.orch.undoBlockedStep(s.r(), "c1", s.jail);
    expect(s.read("src/b.ts")).toBe("export const b = 1;\n");
    expect(s.set("p")!.state).toBe("restored");

    const t = setup();
    t.split();
    t.edit("c1", "src/b.ts", "export const b = 3; // accepted part\n");
    t.verify("c1");
    t.edit("c2", "src/d.ts", "BROKEN\n");
    t.status("c2", "blocked");
    await t.orch.undoBlockedStep(t.r(), "c2", t.jail);
    expect(t.read("src/d.ts")).toBe("export const d = 1;\n");
    expect(t.read("src/b.ts")).toBe("export const b = 3; // accepted part\n");
    expect(t.set("p")).toMatchObject({ state: "reconcile", reason: expect.stringMatching(/src\/b\.ts: changed later by another step \(c1, verified\)/) });
    expect(t.notes.some((n) => /^Kept "Step p"'s provisional changes .* They wait for your decision; nothing was overwritten/.test(n))).toBe(true);
  }, 60_000);

  it("across cancel and restart: recorded once, never applied twice, and not accepted because the step split", async () => {
    const s = setup();
    const first = s.split()!;
    const again = s.split()!;
    expect(again.checkpointId).toBe(first.checkpointId);
    expect(s.app.store.checkpoints.where("run_id = ?", s.run.id).filter((c) => c.label.startsWith("Provisional")).length).toBe(1);
    expect(s.app.store.snapshots.where("task_id = ?", "p").length).toBe(1);
    expect(s.app.store.getSetting<string[]>("taskFindings:c1", []).filter((f) => f.startsWith("Inherited"))).toHaveLength(1);
    // A step before it starts over: the unaccepted set goes back like any unaccepted work.
    s.status("a", "pending");
    expect(await s.orch.undoLaterUnaccepted(s.r(), s.app.store.tasks.require("a"), s.jail)).toBeUndefined();
    expect(s.read("src/b.ts")).toBe("export const b = 1;\n");
    expect(s.set("p")!.state).toBe("restored");
    // Nothing more happens to it afterwards (no second undo, no re-application).
    const undos = s.notes.filter((n) => n.startsWith('Undid "Step p"')).length;
    await s.orch.undoBlockedStep(s.r(), "c1", s.jail);
    expect(s.notes.filter((n) => n.startsWith('Undid "Step p"')).length).toBe(undos);
    expect(s.read("src/b.ts")).toBe("export const b = 1;\n");
  }, 60_000);

  it("keeps unrelated accepted work when a failed part puts the set back", async () => {
    const s = setup();
    // Step a (before the split, verified) and a step after it, accepted, on other files.
    s.edit("a", "src/e.ts", "export const e = 9; // accepted earlier\n");
    s.split();
    s.edit("c1", "src/d.ts", "BROKEN\n");
    s.status("c1", "blocked");
    await s.orch.undoBlockedStep(s.r(), "c1", s.jail);
    expect(s.read("src/b.ts")).toBe("export const b = 1;\n");
    expect(s.read("src/e.ts")).toBe("export const e = 9; // accepted earlier\n");
    expect(s.app.store.tasks.require("a").status).toBe("verified");
  }, 60_000);

  it("survives a cancel and a real daemon restart unaccepted, applied once, and still goes back as a whole", async () => {
    const s = setup();
    s.split();
    s.edit("c1", "src/d.ts", "export const d = 2; // part 1, in progress\n");
    s.status("c1", "running");
    await s.app.orchestrator.cancel(s.run.id).catch(() => undefined);
    expect(s.set("p")!.state).toBe("provisional");
    const snaps = s.app.store.snapshots.where("run_id = ?", s.run.id).length;
    // The daemon stops and starts again on the same data.
    s.app.db.close();
    const app2 = createApp({ dataDir: s.dataDir });
    await app2.orchestrator.reconcileOnStartup();
    const set2 = app2.store.getSetting<ProvisionalSet | null>(provisionalKey("p"), null)!;
    expect(set2).toMatchObject({ state: "provisional", children: ["c1", "c2"] });
    expect(app2.store.snapshots.where("run_id = ?", s.run.id).length).toBe(snaps);
    expect(s.read("src/b.ts")).toBe("export const b = 2; // hero from the PRD\n");
    // Not accepted by the restart: only every part verified accepts it. Part 1 then fails: the whole set goes back.
    const orch2 = app2.orchestrator as unknown as { undoBlockedStep: (r: unknown, id: string, j: unknown) => Promise<void> };
    app2.store.tasks.upsert({ ...app2.store.tasks.require("c1"), status: "blocked" });
    await orch2.undoBlockedStep(app2.store.runs.require(s.run.id), "c1", app2.projects.jail(s.project));
    expect(s.read("src/d.ts")).toBe("export const d = 1;\n");
    expect(s.read("src/b.ts")).toBe("export const b = 1;\n");
    expect(app2.store.getSetting<ProvisionalSet | null>(provisionalKey("p"), null)!.state).toBe("restored");
    app2.db.close();
  }, 60_000);
});
