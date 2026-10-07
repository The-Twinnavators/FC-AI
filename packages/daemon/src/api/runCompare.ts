/**
 * Two builds side by side (D2): what each was asked, how it ended, which models did the work and where, the time and
 * tries it took, its checks, and what it changed. Everything comes from each run's own records; nothing is scored or
 * ranked, so a person can judge (e.g. a local build against a cloud one on the same change).
 */
import type { App } from "../app.js";
import { runPerformance } from "./performance.js";
import { runModels } from "./runModels.js";
import { stepPatch } from "./stepPatch.js";

export interface RunSide {
  runId: string;
  objective: string;
  status: string;
  createdAt: string;
  models: { summary: string; leftThisComputer: boolean; coder?: string };
  time: { elapsedMs: number; modelMs: number; commandMs: number; checkMs: number; waitingMs: number };
  tries: { steps: number; retried: number; extraTries: number; commandsFailed: number; modelCallsFailed: number };
  checks: Array<{ kind: string; status: string }>;
  changes: { files: number; added: number; removed: number; paths: string[] };
}

function side(app: App, runId: string): RunSide {
  const run = app.store.runs.require(runId);
  const perf = runPerformance(app, runId);
  const models = runModels(app, runId);
  const tasks = app.store.tasks.where("run_id = ?", runId).filter((t) => t.status !== "skipped");
  const checks = app.store.checks.where("run_id = ? ORDER BY updated_at ASC", runId);
  // The latest result of each check kind.
  const latest = new Map<string, string>();
  for (const c of checks) latest.set(c.kind, c.status);
  const patch = stepPatch(app, runId);
  let added = 0;
  let removed = 0;
  for (const line of patch.patch.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) added++;
    else if (line.startsWith("-") && !line.startsWith("---")) removed++;
  }
  return {
    runId,
    objective: run.objective.replace(/^#+\s*/, "").split("\n")[0]!.slice(0, 160),
    status: run.status,
    createdAt: run.createdAt,
    models: { summary: models.summary, leftThisComputer: models.leftThisComputer, coder: run.modelAssignments.coder?.model },
    time: { elapsedMs: perf.elapsedMs, modelMs: perf.busy.modelMs, commandMs: perf.busy.commandMs + perf.busy.toolMs, checkMs: perf.busy.checkMs, waitingMs: perf.waitingMs },
    tries: {
      steps: tasks.length,
      retried: tasks.filter((t) => t.attempts > 1).length,
      extraTries: tasks.reduce((n, t) => n + Math.max(0, t.attempts - 1), 0),
      commandsFailed: perf.commands.failed,
      modelCallsFailed: perf.model.failed,
    },
    checks: [...latest].map(([kind, status]) => ({ kind, status })),
    changes: { files: patch.files.length + patch.binary.length, added, removed, paths: [...patch.files, ...patch.binary] },
  };
}

export function compareRuns(app: App, a: string, b: string) {
  const left = side(app, a);
  const right = side(app, b);
  const both = left.changes.paths.filter((p) => right.changes.paths.includes(p));
  return { a: left, b: right, sameProject: app.store.runs.require(a).projectId === app.store.runs.require(b).projectId, filesInBoth: both };
}
