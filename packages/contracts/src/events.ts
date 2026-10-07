/** PRD §15.2 event types. Every run, phase, task, model request, tool call, command, approval, snapshot and verification emits one. */
import { z } from "zod";

export const EVENT_TYPES = [
  "run.created",
  "run.status_changed",
  "preflight.started",
  "preflight.completed",
  "preflight.blocked",
  "plan.proposed",
  "plan.approved",
  "phase.started",
  "phase.completed",
  "task.started",
  "task.verified",
  "task.blocked",
  "task.invalidated",
  "model.requested",
  "model.completed",
  "skill.applied",
  "model.failed",
  "model.retry_scheduled",
  "tool.requested",
  "tool.completed",
  "tool.rejected",
  "command.queued",
  "command.awaiting_approval",
  "command.started",
  "command.output",
  "command.completed",
  "command.failed",
  "command.cancelled",
  "approval.requested",
  "approval.resolved",
  "snapshot.created",
  "snapshot.restored",
  "verification.started",
  "verification.completed",
  "preview.ready",
  "screenshot.captured",
  "report.ready",
  "run.done",
  "process.cleanup",
  "policy.rejected",
  "knowledge.updated",
  "agent.message",
  "model.tier",
  "recovery.action",
  // Design research: inspiration from Dribbble, Behance and real products, studied before the screens are designed.
  "research.started",
  "research.completed",
] as const;

export const EventType = z.enum(EVENT_TYPES);
export type EventType = z.infer<typeof EventType>;

export const FlowEvent = z.object({
  seq: z.number().int(),
  id: z.string(),
  type: EventType,
  projectId: z.string().optional(),
  runId: z.string().optional(),
  taskId: z.string().optional(),
  /** Plain-language summary for the Activity stream (PRD §14.3). Always redacted. */
  message: z.string(),
  /** Structured, redacted payload. */
  data: z.record(z.string(), z.unknown()).default({}),
  level: z.enum(["info", "warning", "error"]).default("info"),
  createdAt: z.string(),
});
export type FlowEvent = z.infer<typeof FlowEvent>;

/** Event categories that the UI renders in different panels. */
export function eventPanel(type: EventType): "activity" | "terminal" | "approvals" | "diagnostics" {
  if (type === "command.output") return "terminal";
  if (type.startsWith("approval.")) return "approvals";
  if (type === "model.failed" || type === "model.retry_scheduled" || type === "policy.rejected" || type === "process.cleanup") return "diagnostics";
  return "activity";
}
