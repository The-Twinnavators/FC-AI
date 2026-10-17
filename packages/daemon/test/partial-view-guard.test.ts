/**
 * replace_file over an existing file needs this attempt to have seen all of its current version (fileViews.ts): a
 * whole read, ranged reads covering every line of the same version, or a packet attachment sent whole. A change to the
 * file makes what was seen stale; an approval wait doesn't let a stale rewrite through; patches need no full read
 * (their find text is checked against the file as it is). Recovered text-form calls go through the same dispatcher.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Task } from "@flowcode/contracts";
import { createDispatcher } from "../src/orchestrator/tools.js";
import { FileViews } from "../src/orchestrator/fileViews.js";
import { makeApp, makeProject, waitFor } from "./helpers.js";

const LONG = Array.from({ length: 300 }, (_, i) => `export const v${i} = ${i};`).join("\n") + "\n";
const REWRITE = Array.from({ length: 300 }, (_, i) => `export const w${i} = ${i * 2};`).join("\n") + "\n";

function setup(opts: { attachedWhole?: Array<{ path: string; content: string }>; inScope?: boolean; manual?: boolean } = {}) {
  const { app } = makeApp();
  const { project, jail, ws } = makeProject(app, { "src/long.ts": LONG, "src/small.ts": "export const s = 1;\n" });
  app.projects.updateSettings(project.id, { autonomy: "assisted" });
  const run = app.orchestrator.createRun({ projectId: project.id, objective: "o", constraints: [], attachedKnowledgeIds: [] });
  app.store.runs.upsert({ ...app.store.runs.require(run.id), planApproved: true });
  const task = { id: "t1", runId: run.id, title: "Rework long", objective: "Rework src/long.ts", role: "coder", status: "running", attempts: 1, expectedPaths: opts.inScope === false ? [] : ["src/long.ts"], actualPaths: [], acceptanceCriteria: [], dependsOn: [], ordinal: 1, validationPlan: { kinds: [] } } as unknown as Task;
  app.store.tasks.upsert(task);
  const dispatch = createDispatcher({ project: app.store.projects.require(project.id), run: app.store.runs.require(run.id), task, jail, ops: app.ops, runner: app.runner, approvals: app.approvals, preflight: () => undefined, refreshPreflight: () => app.projects.preflight(project.id), signal: new AbortController().signal, onPathsChanged: () => undefined, onAwaitingApproval: () => undefined, phase: "implementation", attachedWhole: () => opts.attachedWhole ?? [] });
  // A rewrite asks for approval: approved at once here, unless the test decides it itself.
  if (!opts.manual) app.bus.subscribe((e) => void (e.type === "approval.requested" && setTimeout(() => app.approvals.pending().forEach((a) => app.approvals.decide(a.id, "once")), 5)));
  const read = (rel: string) => fs.readFileSync(path.join(ws, rel), "utf8");
  const replace = (content = REWRITE) => dispatch("replace_file", { path: "src/long.ts", content, reason: "rework" }, undefined, `r${Math.random()}`);
  return { app, run, ws, dispatch, read, replace };
}

describe("the partial-view rewrite guard", () => {
  it("allows a rewrite after a complete read of the current version", async () => {
    const s = setup();
    expect((await s.dispatch("read_file", { path: "src/long.ts" }, undefined, "a")).ok).toBe(true);
    const r = await s.replace();
    expect(r.ok, r.content).toBe(true);
    expect(s.read("src/long.ts")).toBe(REWRITE);
  });

  it("refuses it after a partial read, naming the unseen lines and the ways out", async () => {
    const s = setup();
    await s.dispatch("read_file", { path: "src/long.ts", from: 1, to: 100 }, undefined, "a");
    const r = await s.replace();
    expect(r.ok).toBe(false);
    expect(r.content).toBe('Not applied: replace_file rewrites all of src/long.ts, but this attempt has seen only part of src/long.ts: lines 101–301 of 301 are unseen; what you haven\'t seen would be lost. Read it first (read_file "src/long.ts", or the unseen lines with from and to), or change only what you need with apply_patch.');
    expect(s.read("src/long.ts")).toBe(LONG);
  });

  it("allows it when ranged reads together cover one version", async () => {
    const s = setup();
    await s.dispatch("read_file", { path: "src/long.ts", from: 1, to: 150 }, undefined, "a");
    expect((await s.replace()).ok).toBe(false);
    await s.dispatch("read_file", { path: "src/long.ts", from: 151, to: 301 }, undefined, "b");
    expect((await s.replace()).ok).toBe(true);
  });

  it("treats what was seen as stale once the file changes, and doesn't count a truncated attachment", async () => {
    const s = setup();
    await s.dispatch("read_file", { path: "src/long.ts" }, undefined, "a");
    fs.writeFileSync(path.join(s.ws, "src/long.ts"), LONG.replace("v5 = 5", "v5 = 55"));
    const r = await s.replace();
    expect(r.content).toMatch(/src\/long\.ts has changed since this attempt last saw it, so what was seen is stale/);
    // Attachments: sent whole counts; nothing else does.
    const whole = setup({ attachedWhole: [{ path: "src/long.ts", content: LONG }] });
    expect((await whole.replace()).ok).toBe(true);
    const none = setup();
    expect((await none.replace()).content).toMatch(/this attempt hasn't seen src\/long\.ts \(301 lines\)/);
  });

  it("doesn't let an approval wait pass a rewrite of a file that changed meanwhile", async () => {
    const s = setup({ inScope: false, manual: true });
    await s.dispatch("read_file", { path: "src/long.ts" }, undefined, "a");
    const pending = s.replace();
    const ap = await waitFor(() => s.app.approvals.pending()[0], 10_000);
    fs.writeFileSync(path.join(s.ws, "src/long.ts"), LONG.replace("v7 = 7", "v7 = 77"));
    s.app.approvals.decide(ap.id, "once");
    const r = await pending;
    expect(r.ok).toBe(false);
    // Refused against the file as it is when the write would run (the scope approval re-runs the call through the guard).
    expect(r.content).toMatch(/src\/long\.ts (changed while the approval was waiting|has changed since this attempt last saw it)/);
    expect(s.read("src/long.ts")).toBe(LONG.replace("v7 = 7", "v7 = 77"));
  });

  it("rechecks the file when an approved in-scope rewrite runs", async () => {
    const s = setup({ manual: true });
    await s.dispatch("read_file", { path: "src/long.ts" }, undefined, "a");
    const pending = s.replace();
    const ap = await waitFor(() => s.app.approvals.pending()[0], 10_000);
    expect(ap.action).not.toMatch(/outside the approved plan scope/);
    fs.writeFileSync(path.join(s.ws, "src/long.ts"), LONG.replace("v9 = 9", "v9 = 99"));
    s.app.approvals.decide(ap.id, "once");
    const r = await pending;
    expect(r.content).toBe("Not applied: src/long.ts changed while the approval was waiting. The file was NOT changed. Read it again, then send the change.");
    expect(s.read("src/long.ts")).toBe(LONG.replace("v9 = 9", "v9 = 99"));
  });

  it("needs no full read for a patch, and carries a complete view across the agent's own edit", async () => {
    const s = setup();
    const p = await s.dispatch("apply_patch", { path: "src/long.ts", edits: [{ find: "export const v3 = 3;", replace: "export const v3 = 33;" }], reason: "r" }, undefined, "p");
    expect(p.ok, p.content).toBe(true);
    const views = new FileViews();
    views.saw("a.ts", "x\ny\n");
    views.edited("a.ts", "x\ny\n", "x\nz\n");
    expect(views.missing("a.ts", "x\nz\n")).toBeUndefined();
    views.saw("b.ts", "1\n2\n3\n", 1, 1);
    views.edited("b.ts", "1\n2\n3\n", "1\n2\n4\n");
    expect(views.missing("b.ts", "1\n2\n4\n")).toMatch(/hasn't seen/);
  });
});
