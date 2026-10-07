/**
 * A step's changes as a standard unified diff (D13), to apply in your own repository with `git apply`. Built from the
 * run's snapshots: a file's "before" is its content when the step first touched it; its "after" is its content when
 * the next step touched it, or the file as it is now when nothing has touched it since. Steps that were undone give
 * an empty patch rather than a misleading one.
 */
import { createTwoFilesPatch } from "diff";
import type { App } from "../app.js";
import { readFile } from "../workspace/fileService.js";

const BINARY = /.(png|jpe?g|gif|webp|avif|ico|svgz|woff2?|ttf|otf|eot|mp4|webm|mp3|wav|pdf|zip)$/i;

export function stepPatch(app: App, runId: string, taskId?: string): { name: string; patch: string; files: string[]; binary: string[] } {
  const run = app.store.runs.require(runId);
  const jail = app.projects.jail(run.projectId);
  const snaps = app.snapshots
    .forRun(runId)
    .filter((s) => !s.restoredAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const mine = taskId ? snaps.filter((s) => s.taskId === taskId) : snaps;
  const first = new Map<string, (typeof snaps)[number]>();
  for (const s of mine) if (!first.has(s.relativePath)) first.set(s.relativePath, s);
  const parts: string[] = [];
  const files: string[] = [];
  // Images and fonts can't go in a text patch: they're listed for the person to copy.
  const binary: string[] = [];
  for (const [file, s] of first) {
    if (BINARY.test(file)) {
      binary.push(file);
      continue;
    }
    const before = app.snapshots.priorContent(s) ?? "";
    // The next snapshot of this file from another step holds what this step left behind.
    const later = taskId ? snaps.find((x) => x.relativePath === file && x.createdAt > s.createdAt && x.taskId !== taskId) : undefined;
    let after: string;
    if (later) after = app.snapshots.priorContent(later) ?? "";
    else {
      try {
        after = readFile(jail, file).content;
      } catch {
        after = "";
      }
    }
    if (before === after) continue;
    const a = s.contentHash === "absent" ? "/dev/null" : `a/${file}`;
    const b = after === "" && !later ? "/dev/null" : `b/${file}`;
    parts.push(createTwoFilesPatch(a, b, before, after, "", "", { context: 3 }).replace(/^=+\n/, ""));
    files.push(file);
  }
  const task = taskId ? app.store.tasks.get(taskId) : undefined;
  const slug = (task?.title ?? run.objective).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "changes";
  return { name: `${slug}.patch`, patch: parts.join("\n"), files, binary };
}
