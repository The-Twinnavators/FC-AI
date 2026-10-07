/**
 * Durable event stream (PRD §7.6, §15.2). Events are redacted, persisted in SQLite with a monotonic
 * sequence (so the UI can resume after daemon restart via Last-Event-ID), and fanned out to subscribers.
 */
import { EventEmitter } from "node:events";
import type { EventType, FlowEvent } from "@flowcode/contracts";
import type { Db } from "../db/db.js";
import { newId, nowIso } from "../util/ids.js";
import { redact, redactValue } from "../security/redaction.js";

export interface EmitInput {
  type: EventType;
  message: string;
  projectId?: string;
  runId?: string;
  taskId?: string;
  data?: Record<string, unknown>;
  level?: "info" | "warning" | "error";
}

export class EventBus {
  private emitter = new EventEmitter();

  constructor(private db: Db) {
    this.emitter.setMaxListeners(1000);
  }

  emit(input: EmitInput): FlowEvent {
    const createdAt = nowIso();
    const id = newId("evt");
    const event: Omit<FlowEvent, "seq"> = {
      id,
      type: input.type,
      projectId: input.projectId,
      runId: input.runId,
      taskId: input.taskId,
      message: redact(input.message),
      data: redactValue(input.data ?? {}),
      level: input.level ?? "info",
      createdAt,
    };
    // Terminal output is high-volume; persist it too (bounded upstream by output caps) so it can be replayed.
    const res = this.db.run(
      "INSERT INTO events (id, type, project_id, run_id, task_id, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      id,
      event.type,
      event.projectId ?? null,
      event.runId ?? null,
      event.taskId ?? null,
      JSON.stringify(event),
      createdAt,
    );
    const full: FlowEvent = { ...event, seq: Number(res.lastInsertRowid) };
    this.emitter.emit("event", full);
    return full;
  }

  subscribe(fn: (e: FlowEvent) => void): () => void {
    this.emitter.on("event", fn);
    return () => this.emitter.off("event", fn);
  }

  list(opts: { runId?: string; projectId?: string; afterSeq?: number; limit?: number; types?: string[] } = {}): FlowEvent[] {
    const where: string[] = ["seq > ?"];
    const params: unknown[] = [opts.afterSeq ?? 0];
    if (opts.runId) {
      where.push("run_id = ?");
      params.push(opts.runId);
    }
    if (opts.projectId) {
      where.push("project_id = ?");
      params.push(opts.projectId);
    }
    if (opts.types?.length) {
      where.push(`type IN (${opts.types.map(() => "?").join(",")})`);
      params.push(...opts.types);
    }
    params.push(opts.limit ?? 5000);
    return this.db
      .all<{ seq: number; data: string }>(`SELECT seq, data FROM events WHERE ${where.join(" AND ")} ORDER BY seq ASC LIMIT ?`, ...params)
      .map((r) => ({ ...(JSON.parse(r.data) as FlowEvent), seq: Number(r.seq) }));
  }
}
