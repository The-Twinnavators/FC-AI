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
      fs.renameSync(tmp, abs);
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
