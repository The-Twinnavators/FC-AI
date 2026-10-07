/**
 * Edits made outside FlowCode (C5 / VUS): when a build stops, FlowCode notes each workspace file's size and modified
 * time. Before a retry, the files are compared with that note, so the person sees "You changed src/data/invoices.json
 * since the build stopped; the retry uses your version". Cheap (no file contents), and only a notice: nothing is
 * undone or blocked.
 */
import fs from "node:fs";
import path from "node:path";
import type { App } from "../app.js";

const SKIP = new Set(["node_modules", ".git", "dist", "build", "coverage", ".vite", "test-results", "playwright-report", ".flowcode", ".turbo", ".next"]);
const MAX_FILES = 6000;
const KEY = (projectId: string) => `workspaceStamp:${projectId}`;

interface Stamp {
  runId: string;
  at: string;
  files: Record<string, string>;
}

function scan(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  let n = 0;
  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (n >= MAX_FILES) return;
      if (SKIP.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile()) {
        try {
          const st = fs.statSync(full);
          out[path.relative(root, full).replace(/\\/g, "/")] = `${st.size}:${Math.round(st.mtimeMs)}`;
          n++;
        } catch {
          /* gone while scanning */
        }
      }
    }
  };
  walk(root);
  return out;
}

/** Notes the workspace as the stopped build left it. */
export function stampWorkspace(app: App, projectId: string, runId: string) {
  const project = app.store.projects.get(projectId);
  if (!project) return;
  const root = app.projects.jail(project).root;
  app.store.setSetting(KEY(projectId), { runId, at: new Date().toISOString(), files: scan(root) });
}

export interface ExternalChanges {
  since?: string;
  changed: string[];
  added: string[];
  removed: string[];
}

/** Files changed outside FlowCode since its last build on this project stopped. */
export function externalChanges(app: App, runId: string): ExternalChanges {
  const run = app.store.runs.require(runId);
  const stamp = app.store.getSetting<Stamp | null>(KEY(run.projectId), null);
  if (!stamp) return { changed: [], added: [], removed: [] };
  const now = scan(app.projects.jail(app.store.projects.require(run.projectId)).root);
  const changed: string[] = [];
  const added: string[] = [];
  for (const [f, sig] of Object.entries(now)) {
    if (!(f in stamp.files)) added.push(f);
    else if (stamp.files[f] !== sig) changed.push(f);
  }
  const removed = Object.keys(stamp.files).filter((f) => !(f in now));
  return { since: stamp.at, changed: changed.slice(0, 50), added: added.slice(0, 50), removed: removed.slice(0, 50) };
}

const STOPPED = ["blocked", "failed", "done", "done_with_warnings", "done_unverified", "cancelled"];
/** Takes the note whenever a build stops. */
export function watchStops(app: App) {
  return app.bus.subscribe((e) => {
    if (e.type !== "run.status_changed" || !e.runId || !e.projectId) return;
    const to = (e.data as { to?: string } | undefined)?.to;
    if (to && STOPPED.includes(to)) setTimeout(() => stampWorkspace(app, e.projectId!, e.runId!), 1500);
  });
}
