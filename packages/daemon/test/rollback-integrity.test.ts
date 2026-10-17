/**
 * Undoing a step's never-accepted changes is done only when it is coherent: no later step changed the same files,
 * putting them back adds no error the step didn't start with, and its diff and diagnostics are kept first. Otherwise
 * nothing is overwritten and the step that wanted the undo waits for the person. Undoing restores the step's start,
 * which is not the same as a healthy app: errors that were there then stay, and are said to.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Task } from "@flowcode/contracts";
import { makeApp, makeProject } from "./helpers.js";

// A stand-in type checker driven by the files: c.ts importing x needs b.ts to export it; BROKEN and OLD are errors.
const CHECK = `const fs = require("fs");
const r = (f) => { try { return fs.readFileSync(f, "utf8"); } catch { return ""; } };
const out = [];
if (r("src/c.ts").includes("import { x }") && !r("src/b.ts").includes("export const x")) out.push("src/c.ts(1,10): error TS2305: Module './b' has no exported member 'x'.");
if (r("src/b.ts").includes("BROKEN")) out.push("src/b.ts(1,1): error TS2304: Cannot find name 'BROKEN'.");
if (r("src/old.ts").includes("OLD")) out.push("src/old.ts(1,1): error TS2304: Cannot find name 'OLD'.");
if (out.length) { console.log(out.join("\\n")); process.exit(1); }
`;

function setup() {
  const { app } = makeApp();
  const { project, ws } = makeProject(app, {
    "package.json": JSON.stringify({ name: "demo", version: "1.0.0", scripts: { typecheck: "tsc --noEmit" } }),
    "check.js": CHECK,
    "src/b.ts": "export const b = 1;\n",
    "src/c.ts": "export const c = 0;\n",
    "src/d.ts": "export const d = 1;\n",
    // An error that was there before any of these steps.
    "src/old.ts": "OLD\n",
  });
  const bin = path.join(ws, "node_modules", ".bin");
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, "tsc.cmd"), '@node "%~dp0\\..\\..\\check.js" %*\r\n');
  fs.writeFileSync(path.join(bin, "tsc"), '#!/bin/sh\nnode "$(dirname "$0")/../../check.js" "$@"\n', { mode: 0o755 });
  app.projects.preflight(project.id);
  const run = app.orchestrator.createRun({ projectId: project.id, objective: "g", constraints: [], attachedKnowledgeIds: [] });
  const jail = app.projects.jail(project);
  const mk = (id: string, ordinal: number, status: string, expected: string[]) => {
    const t = { id, runId: run.id, title: `Step ${id}`, objective: id, status, dependsOn: [], expectedPaths: expected, actualPaths: [], acceptanceCriteria: [], validationPlan: { kinds: [] }, role: "coder", ordinal, attempts: 1 } as unknown as Task;
    app.store.tasks.upsert(t);
    return t;
  };
  const edit = (taskId: string, rel: string, content: string) => {
    app.ops.replaceContent({ jail, projectId: project.id, runId: run.id, taskId, toolCallId: `tc_${taskId}_${rel}`, approved: true }, rel, content);
    const t = app.store.tasks.require(taskId);
    app.store.tasks.upsert({ ...t, actualPaths: [...new Set([...t.actualPaths, rel])] });
  };
  const accept = (taskId: string) => app.snapshots.createCheckpoint(run.id, `Verified "Step ${taskId}"`, true, taskId);
  const read = (rel: string) => fs.readFileSync(path.join(ws, rel), "utf8");
  const orch = app.orchestrator as unknown as { undoLaterUnaccepted: (r: unknown, t: Task, j: unknown) => Promise<string | undefined> };
  const startOver = (t: Task) => orch.undoLaterUnaccepted(app.store.runs.require(run.id), app.store.tasks.require(t.id), jail);
  const baseline = (t: Task) => app.verifier.captureStepBaseline(app.store.runs.require(run.id), t.id);
  const notes: string[] = [];
  app.bus.subscribe((e) => void (e.type === "recovery.action" && notes.push(e.message)));
  return { app, run, ws, mk, edit, accept, read, startOver, baseline, notes };
}

describe("undoing a step's unaccepted changes", () => {
  it("1. no dependent edits: the later step's changes are undone, its diff kept, and its start state (with the old error) said plainly", async () => {
    const s = setup();
    const a = s.mk("a", 1, "pending", ["src/a.ts"]);
    const b = s.mk("b", 2, "attempted", ["src/b.ts"]);
    await s.baseline(b);
    s.edit(b.id, "src/b.ts", "BROKEN\n");
    expect(await s.startOver(a)).toBeUndefined();
    expect(s.read("src/b.ts")).toBe("export const b = 1;\n");
    expect(s.app.store.tasks.require(b.id).actualPaths).toEqual([]);
    const note = s.notes.find((n) => n.startsWith('Undid "Step b"'))!;
    expect(note).toMatch(/its files are as they were when it started, with the 1 error that were there then \(still to fix; the app isn't healthy\)/);
    const art = s.app.store.db.all<{ data: string }>("SELECT data FROM artifacts WHERE run_id = ?", s.run.id).map((r) => JSON.parse(r.data) as { label: string });
    expect(art.some((x) => x.label === "Undone changes: Step b")).toBe(true);
  }, 60_000);

  it("2. a later step changed the same file: nothing is undone or overwritten, and the step starting over waits for the person", async () => {
    const s = setup();
    const a = s.mk("a", 1, "pending", ["src/a.ts"]);
    const b = s.mk("b", 2, "attempted", ["src/b.ts"]);
    const c = s.mk("c", 3, "verified", ["src/b.ts"]);
    await s.baseline(b);
    s.edit(b.id, "src/b.ts", "export const b = 2;\n");
    s.edit(c.id, "src/b.ts", "export const b = 3;\n");
    s.accept(c.id);
    const why = await s.startOver(a);
    expect(why).toMatch(/"Step b" has unaccepted changes that can't be undone safely \(src\/b\.ts: changed later by another step \(c, verified\)/);
    expect(s.read("src/b.ts")).toBe("export const b = 3;\n");
    expect(s.notes.some((n) => /^Not undoing "Step b": 1 file changed since by other work/.test(n))).toBe(true);
  }, 60_000);

  it("3. unrelated accepted changes are kept: only the unaccepted step's own file goes back", async () => {
    const s = setup();
    const a = s.mk("a", 1, "pending", ["src/a.ts"]);
    const b = s.mk("b", 2, "attempted", ["src/b.ts"]);
    const c = s.mk("c", 3, "verified", ["src/d.ts"]);
    await s.baseline(b);
    s.edit(b.id, "src/b.ts", "BROKEN\n");
    s.edit(c.id, "src/d.ts", "export const d = 2;\n");
    s.accept(c.id);
    expect(await s.startOver(a)).toBeUndefined();
    expect(s.read("src/b.ts")).toBe("export const b = 1;\n");
    expect(s.read("src/d.ts")).toBe("export const d = 2;\n");
    expect(s.app.store.tasks.require(c.id).status).toBe("verified");
  }, 60_000);

  it("4. the undo returns to the recorded baseline with no new error; one that would add errors is put back and stops", async () => {
    const s = setup();
    const a = s.mk("a", 1, "pending", ["src/a.ts"]);
    const b = s.mk("b", 2, "attempted", ["src/b.ts"]);
    const c = s.mk("c", 3, "verified", ["src/c.ts"]);
    await s.baseline(b);
    // b adds an export; c (accepted, another file) imports it: undoing b would break c.
    s.edit(b.id, "src/b.ts", "export const b = 1;\nexport const x = 2;\n");
    s.edit(c.id, "src/c.ts", "import { x } from './b';\nexport const c = x;\n");
    s.accept(c.id);
    const why = await s.startOver(a);
    expect(why).toMatch(/the undo would add 1 error \(src\/c\.ts\(1,10\): error TS2305/);
    expect(s.read("src/b.ts")).toContain("export const x = 2;");
    expect(s.app.store.snapshots.where("task_id = ?", b.id).every((x) => !x.restoredAt)).toBe(true);
    // With nothing depending on it, the same undo goes through and leaves exactly the baseline's errors.
    const s2 = setup();
    const a2 = s2.mk("a", 1, "pending", ["src/a.ts"]);
    const b2 = s2.mk("b", 2, "attempted", ["src/b.ts"]);
    await s2.baseline(b2);
    s2.edit(b2.id, "src/b.ts", "export const b = 1;\nexport const x = 2;\nBROKEN\n");
    expect(await s2.startOver(a2)).toBeUndefined();
    const after = await s2.app.verifier.captureDiagnostics(s2.app.store.runs.require(s2.run.id));
    expect(after.typecheck!.lines).toEqual(["src/old.ts(1,1): error TS2304: Cannot find name 'OLD'."]);
  }, 90_000);

  it("leaves a step that once passed and was reopened alone (its files are built on when it runs again)", async () => {
    const s = setup();
    const a = s.mk("a", 1, "pending", ["src/a.ts"]);
    const b = s.mk("b", 2, "pending", ["src/b.ts"]);
    s.edit(b.id, "src/b.ts", "export const b = 5;\n");
    s.accept(b.id);
    expect(await s.startOver(a)).toBeUndefined();
    expect(s.read("src/b.ts")).toBe("export const b = 5;\n");
  }, 60_000);
});
