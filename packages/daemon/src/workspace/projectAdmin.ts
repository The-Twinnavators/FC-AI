/**
 * Project administration: rename, edit a request before it runs, and delete a project.
 * Deleting removes every FlowCode record for the project (runs, tasks, checks, approvals, events, knowledge,
 * checklist state). Workspace files are only removed when FlowCode created the workspace itself (under its
 * data directory) AND the user asked for it; a folder the user selected is never deleted.
 */
import fs from "node:fs";
import path from "node:path";
import { TERMINAL_RUN_STATUSES } from "@flowcode/contracts";
import type { App } from "../app.js";
import { PolicyError } from "../security/pathJail.js";

export function renameProject(app: App, projectId: string, name: string) {
  const p = app.store.projects.require(projectId);
  return app.store.projects.upsert({ ...p, name, updatedAt: new Date().toISOString() });
}

/** True when the workspace lives under FlowCode's own managed workspaces folder. */
export function isManagedWorkspace(app: App, projectId: string): boolean {
  try {
    const abs = path.resolve(app.projects.workspacePath(app.store.projects.require(projectId)));
    const root = path.resolve(app.dataDir, "workspaces");
    return abs.toLowerCase().startsWith(root.toLowerCase() + path.sep);
  } catch {
    return false;
  }
}

/**
 * Edits a request that has not started executing (draft, or plan awaiting approval) and plans it again.
 * Once work has started, the right move is a follow-up request instead, so that history stays truthful.
 */
export async function editRequest(app: App, runId: string, objective: string) {
  const run = app.store.runs.require(runId);
  if (app.orchestrator.isActive(runId) || app.orchestrator.isProbing(runId)) throw new PolicyError("This request is running. Cancel it first, or send a follow-up request.", "run_active");
  const started = app.store.tasks.where("run_id = ?", runId).some((t) => t.status !== "pending" && t.status !== "invalidated");
  if (started || TERMINAL_RUN_STATUSES.includes(run.status)) throw new PolicyError("Work on this request has already started. Send a follow-up request with the change instead.", "run_started");
  app.store.runs.upsert({ ...run, objective, planApproved: false, status: "draft", updatedAt: new Date().toISOString() } as typeof run);
  return app.orchestrator.plan(runId);
}

export function deleteProject(app: App, projectId: string, opts: { deleteFiles?: boolean } = {}) {
  const project = app.store.projects.require(projectId);
  const runs = app.store.runs.where("project_id = ?", projectId);
  const active = runs.find((r) => app.orchestrator.isActive(r.id) || app.orchestrator.isProbing(r.id));
  if (active) throw new PolicyError("A build in this project is still running. Cancel it first.", "run_active");

  const managed = isManagedWorkspace(app, projectId);
  let workspace: string | undefined;
  try {
    workspace = app.projects.workspacePath(project);
  } catch {
    workspace = undefined;
  }

  const { store } = app;
  const db = store.db;
  for (const r of runs) {
    for (const repo of [store.tasks, store.commands, store.toolCalls, store.checks, store.checkpoints, store.processes, store.artifacts, store.snapshots]) {
      for (const row of (repo as typeof store.tasks).where("run_id = ?", r.id)) repo.delete(row.id);
    }
    db.run("DELETE FROM task_edges WHERE run_id = ?", r.id);
    db.run("DELETE FROM settings WHERE key = ?", `runRefs:${r.id}`);
    store.runs.delete(r.id);
  }
  for (const repo of [store.approvals, store.preflights, store.knowledge, store.research]) {
    for (const row of (repo as typeof store.approvals).where("project_id = ?", projectId)) repo.delete(row.id);
  }
  db.run("DELETE FROM events WHERE project_id = ?", projectId);
  db.run("DELETE FROM search_index WHERE project_id = ?", projectId);
  for (const k of [`lrc:${projectId}`, `lrc2:${projectId}`]) db.run("DELETE FROM settings WHERE key = ?", k);
  const refs = store.getSetting<Record<string, string>>("workspaceRefs", {});
  delete refs[project.workspaceRef];
  store.setSetting("workspaceRefs", refs);
  store.projects.delete(projectId);

  let filesDeleted = false;
  if (opts.deleteFiles && managed && workspace && fs.existsSync(workspace)) {
    fs.rmSync(workspace, { recursive: true, force: true });
    filesDeleted = true;
  }
  return { deleted: true, filesDeleted, keptFolder: !filesDeleted && workspace ? (managed ? "managed workspace kept" : "your folder was not touched") : undefined };
}
