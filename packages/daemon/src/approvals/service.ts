/**
 * Approval service (§14.4). Approvals are durable records; waiters are in-memory promises that are
 * re-attached on resume. "Allow for project" stores a persist key on the project so identical actions
 * are approved automatically later. Agents can never resolve approvals themselves.
 */
import { autoApprovalReason, type Approval, type ApprovalKind, type ApprovalScope, type RiskLevel } from "@flowcode/contracts";
import type { Store } from "../db/store.js";
import type { EventBus } from "../events/bus.js";
import { newId, nowIso } from "../util/ids.js";
import { redact } from "../security/redaction.js";

export interface ApprovalRequest {
  projectId: string;
  runId?: string;
  taskId?: string;
  kind: ApprovalKind;
  action: string;
  reason: string;
  affected: string[];
  risk: RiskLevel;
  detail?: string;
  consequencesOfDenial: string;
  persistKey?: string;
}

export class ApprovalService {
  private waiters = new Map<string, Array<(a: Approval) => void>>();

  constructor(
    private store: Store,
    private bus: EventBus,
  ) {}

  isPersistentlyApproved(projectId: string, persistKey?: string): boolean {
    if (!persistKey) return false;
    const project = this.store.projects.get(projectId);
    return !!project?.settings.persistentApprovals.includes(persistKey);
  }

  request(req: ApprovalRequest): Approval {
    // Re-use an identical pending request (idempotent on resume).
    const existing = this.store.approvals
      .where("project_id = ? AND status = 'pending'", req.projectId)
      .find((a) => a.runId === req.runId && a.taskId === req.taskId && a.kind === req.kind && a.action === redact(req.action));
    if (existing) return existing;
    const approval: Approval = {
      id: newId("apr"),
      projectId: req.projectId,
      runId: req.runId,
      taskId: req.taskId,
      kind: req.kind,
      action: redact(req.action),
      reason: redact(req.reason),
      affected: req.affected.map((x) => redact(x)),
      risk: req.risk,
      detail: req.detail ? redact(req.detail).slice(0, 200_000) : undefined,
      consequencesOfDenial: req.consequencesOfDenial,
      status: "pending",
      persistKey: req.persistKey,
      createdAt: nowIso(),
    };
    this.store.approvals.upsert(approval);
    this.bus.emit({
      type: "approval.requested",
      projectId: req.projectId,
      runId: req.runId,
      taskId: req.taskId,
      message: `Approval needed (${req.risk} risk): ${approval.action}`,
      data: { approvalId: approval.id, kind: req.kind, risk: req.risk },
      level: "warning",
    });
    // Autonomy policy: routine requests are decided automatically and recorded as such (never silently).
    // Plan approvals are handled by the orchestrator so execution starts in the right order.
    if (req.kind !== "plan") {
      const level = this.store.projects.get(req.projectId)?.settings.autonomy ?? "supervised";
      const reason = autoApprovalReason(level, { kind: req.kind, risk: req.risk, action: approval.action, affected: approval.affected });
      if (reason) return this.decide(approval.id, "once", `auto-approved by ${level} policy: ${reason}`);
    }
    return approval;
  }

  decide(id: string, decision: ApprovalScope, note?: string): Approval {
    const a = this.store.approvals.require(id);
    if (a.status !== "pending") return a;
    const resolved: Approval = {
      ...a,
      status: decision === "deny" ? "denied" : "approved",
      decisionScope: decision,
      resolvedAt: nowIso(),
    };
    this.store.approvals.upsert(resolved);
    if (decision === "project" && a.persistKey) {
      const project = this.store.projects.require(a.projectId);
      if (!project.settings.persistentApprovals.includes(a.persistKey)) {
        project.settings.persistentApprovals.push(a.persistKey);
        this.store.projects.upsert({ ...project, updatedAt: nowIso() });
      }
    }
    this.bus.emit({
      type: "approval.resolved",
      projectId: a.projectId,
      runId: a.runId,
      taskId: a.taskId,
      message: `${resolved.status === "approved" ? "Approved" : "Denied"}${decision === "project" ? " for project" : ""}: ${a.action}${note ? ` — ${redact(note)}` : ""}`,
      data: { approvalId: id, decision },
    });
    const ws = this.waiters.get(id) ?? [];
    this.waiters.delete(id);
    for (const w of ws) w(resolved);
    return resolved;
  }

  /** Resolves when the approval is decided or the signal aborts (then resolves with current state). */
  wait(id: string, signal?: AbortSignal): Promise<Approval> {
    const current = this.store.approvals.require(id);
    if (current.status !== "pending" || signal?.aborted) return Promise.resolve(current);
    return new Promise((resolve) => {
      const list = this.waiters.get(id) ?? [];
      const done = (a: Approval) => {
        signal?.removeEventListener("abort", onAbort);
        resolve(a);
      };
      const onAbort = () => {
        const l = this.waiters.get(id);
        if (l) this.waiters.set(id, l.filter((x) => x !== done));
        resolve(this.store.approvals.require(id));
      };
      list.push(done);
      this.waiters.set(id, list);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  expireForRun(runId: string) {
    for (const a of this.store.approvals.where("run_id = ? AND status = 'pending'", runId)) {
      this.store.approvals.upsert({ ...a, status: "expired", resolvedAt: nowIso() });
      const ws = this.waiters.get(a.id) ?? [];
      this.waiters.delete(a.id);
      for (const w of ws) w({ ...a, status: "expired" });
    }
  }

  pending(projectId?: string): Approval[] {
    return projectId ? this.store.approvals.where("project_id = ? AND status = 'pending' ORDER BY created_at ASC", projectId) : this.store.approvals.where("status = 'pending' ORDER BY created_at ASC");
  }
}
