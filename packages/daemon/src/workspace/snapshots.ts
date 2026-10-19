/**
 * Snapshots and rollback (FR-F2, FR-W3). Prior content is stored content-addressed before any mutation.
 * Restore works per file, per task, or back to a checkpoint (latest safe checkpoint by default).
 */
import fs from "node:fs";
import path from "node:path";
import type { Checkpoint, Snapshot } from "@flowcode/contracts";
import type { Store } from "../db/store.js";
import type { ObjectStore } from "../db/artifacts.js";
import type { EventBus } from "../events/bus.js";
import type { PathJail } from "../security/pathJail.js";
import { replaceWith } from "./replaceFile.js";
import { newId, nowIso, sha256 } from "../util/ids.js";

export const ABSENT = "absent";

export type SnapshotRow = Snapshot & { projectId: string; seq: number };

export class SnapshotService {
  constructor(
    private store: Store,
    private objects: ObjectStore,
    private bus: EventBus,
  ) {}

  /** Captures the current state of `rel` (or its absence) before a mutation. */
  capture(args: {
    jail: PathJail;
    projectId: string;
    runId: string;
    taskId?: string;
    rel: string;
    operationId: string;
    operation: string;
    toolCallId?: string;
  }): SnapshotRow {
    const { abs } = args.jail.resolve(args.rel, { allowSecret: false });
    let contentHash = ABSENT;
    let priorContentRef: string | undefined;
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      const buf = fs.readFileSync(abs);
      priorContentRef = this.objects.put(buf);
      contentHash = priorContentRef;
    }
    const snap: SnapshotRow = {
      id: newId("snap"),
      runId: args.runId,
      taskId: args.taskId,
      projectId: args.projectId,
      relativePath: args.rel,
      contentHash,
      priorContentRef,
      operationId: args.operationId,
      toolCallId: args.toolCallId,
      operation: args.operation,
      createdAt: nowIso(),
      seq: this.store.nextSnapshotSeq(),
    };
    this.store.snapshots.upsert(snap);
    this.bus.emit({
      type: "snapshot.created",
      projectId: args.projectId,
      runId: args.runId,
      taskId: args.taskId,
      message: `Snapshot saved before ${args.operation} on ${args.rel}`,
      data: { snapshotId: snap.id, path: args.rel, operation: args.operation },
    });
    return snap;
  }

  recordPost(snap: SnapshotRow, jail: PathJail) {
    const { abs } = jail.resolve(snap.relativePath, { allowSecret: false });
    const post = fs.existsSync(abs) ? sha256(fs.readFileSync(abs)) : ABSENT;
    this.store.snapshots.upsert({ ...snap, postContentHash: post });
  }

  /** Restores a single snapshot's prior state. */
  restore(snapshotId: string, jail: PathJail): SnapshotRow {
    const snap = this.store.snapshots.require(snapshotId);
    const { abs } = jail.resolve(snap.relativePath, { allowSecret: false });
    if (snap.contentHash === ABSENT) {
      if (fs.existsSync(abs)) fs.rmSync(abs, { force: true });
    } else {
      const buf = this.objects.get(snap.priorContentRef!);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      const tmp = `${abs}.flowcode-restore.tmp`;
      fs.writeFileSync(tmp, buf);
      replaceWith(tmp, abs);
    }
    const updated = { ...snap, restoredAt: nowIso() };
    this.store.snapshots.upsert(updated);
    this.bus.emit({
      type: "snapshot.restored",
      projectId: snap.projectId,
      runId: snap.runId,
      taskId: snap.taskId,
      message: `Restored ${snap.relativePath} to its state before ${snap.operation}`,
      data: { snapshotId, path: snap.relativePath },
    });
    return updated;
  }

  /**
   * What undoing a task's changes would do, without writing anything: each file it changed and the state it goes back
   * to (its state before the task's first change), and the conflicts that make the undo unsafe: a later change to the
   * same file by another step (accepted or not), or a file that no longer matches the task's last change (edited
   * since, outside FlowCode or by a step that left no snapshot). An undo with conflicts must not run: restoring would
   * overwrite that later work.
   */
  planTaskUndo(taskId: string, jail: PathJail, statusOf: (taskId: string) => string | undefined): { files: Array<{ rel: string; first: SnapshotRow; last: SnapshotRow }>; conflicts: string[] } {
    const own = this.store.snapshots.where("task_id = ? ORDER BY seq ASC", taskId).filter((s) => !s.restoredAt);
    const byFile = new Map<string, SnapshotRow[]>();
    for (const s of own) byFile.set(s.relativePath.replace(/\\/g, "/"), [...(byFile.get(s.relativePath.replace(/\\/g, "/")) ?? []), s]);
    const files: Array<{ rel: string; first: SnapshotRow; last: SnapshotRow }> = [];
    const conflicts: string[] = [];
    for (const [rel, snaps] of byFile) {
      const first = snaps[0]!;
      const last = snaps.at(-1)!;
      files.push({ rel, first, last });
      const later = this.store.snapshots
        .where("run_id = ? AND seq > ? ORDER BY seq ASC", first.runId, first.seq)
        .filter((s) => !s.restoredAt && s.taskId !== taskId && s.relativePath.replace(/\\/g, "/") === rel);
      for (const s of later) conflicts.push(`${rel}: changed later by another step (${s.taskId ?? "no step"}, ${statusOf(s.taskId ?? "") ?? "unknown status"}) at ${s.createdAt}`);
      if (!later.length && last.postContentHash) {
        const { abs } = jail.resolve(rel, { allowSecret: false });
        const now = fs.existsSync(abs) ? sha256(fs.readFileSync(abs)) : ABSENT;
        if (now !== last.postContentHash) conflicts.push(`${rel}: no longer matches this step's last change (edited since, with no snapshot)`);
      }
    }
    return { files, conflicts };
  }

  /** Marks snapshots as not restored again (an undo put back because it wasn't coherent). */
  unmarkRestored(ids: string[]) {
    for (const id of ids) {
      const s = this.store.snapshots.get(id);
      if (s) this.store.snapshots.upsert({ ...s, restoredAt: undefined });
    }
  }

  /** Rolls back every snapshot of a task, newest first. */
  restoreTask(taskId: string, jail: PathJail): SnapshotRow[] {
    const snaps = this.store.snapshots.where("task_id = ? ORDER BY seq DESC", taskId).filter((s) => !s.restoredAt);
    return snaps.map((s) => this.restore(s.id, jail));
  }

  /** Rolls back all run snapshots taken after a checkpoint, newest first. */
  restoreCheckpoint(checkpoint: Checkpoint, jail: PathJail): SnapshotRow[] {
    const snaps = this.store.snapshots.where("run_id = ? AND seq > ? ORDER BY seq DESC", checkpoint.runId, checkpoint.snapshotSeq).filter((s) => !s.restoredAt);
    return snaps.map((s) => this.restore(s.id, jail));
  }

  createCheckpoint(runId: string, label: string, safe: boolean, taskId?: string): Checkpoint {
    const cp: Checkpoint = {
      id: newId("cp"),
      runId,
      taskId,
      label,
      safe,
      snapshotSeq: this.store.nextSnapshotSeq() - 1,
      createdAt: nowIso(),
    };
    return this.store.checkpoints.upsert(cp);
  }

  latestSafeCheckpoint(runId: string): Checkpoint | undefined {
    return this.store.checkpoints.where("run_id = ? ORDER BY created_at DESC", runId).find((c) => c.safe);
  }

  forRun(runId: string): SnapshotRow[] {
    return this.store.snapshots.where("run_id = ? ORDER BY seq ASC", runId);
  }

  priorContent(snap: SnapshotRow): string | undefined {
    return snap.priorContentRef ? this.objects.get(snap.priorContentRef).toString("utf8") : undefined;
  }
}
