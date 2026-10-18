/**
 * Plan review before execution: versions of a build's plan, Request changes, and an approval bound to the exact plan
 * version and look the person reviewed.
 *
 *  - Every plan the orchestrator proposes is a version of the build's plan (1, 2, …) with a content hash; earlier
 *    versions are kept. Its approval names the version and hash.
 *  - Request changes (before any step has started): the waiting approval is superseded (it can no longer be decided),
 *    the version is kept with the person's request, the request goes to the planner (the run's constraints, which the
 *    planner already reads), and the next version needs a fresh approval. That version records how it differs.
 *  - Approving a plan: the decision must name the plan version and hash it was shown, the gate (a plan), and the look
 *    version it saw. Unconfirmed edits on the Look need an explicit choice (use them, or discard them); a warning in
 *    the log isn't enough. What the approval bound to is recorded.
 */
import { createHash } from "node:crypto";
import type { Approval, ApprovalDecisionInput, ImplementationPlan, Run } from "@flowcode/contracts";
import type { App } from "../app.js";
import { discardDraft, getDesignState, selectDraft } from "../workspace/designState.js";

export interface PlanRevisionOutcome {
  /** The version this one revises, and what the person asked for. */
  from: number;
  request: string;
  addedSteps: string[];
  removedSteps: string[];
  keptSteps: number;
  riskFrom: string;
  riskTo: string;
  scopeDecisionsFrom: number;
  scopeDecisionsTo: number;
}

export interface PlanVersion {
  version: number;
  hash: string;
  plan: ImplementationPlan;
  createdAt: string;
  status: "current" | "superseded" | "approved";
  approvalId?: string;
  /** The person's request that replaced this version (when superseded). */
  revision?: { request: string; requestedAt: string; by: "user" };
  /** How this version differs from the one it revises. */
  outcome?: PlanRevisionOutcome;
}

export interface PlanApprovalRecord {
  planVersion: number;
  planHash: string;
  look: { version: number | null; choice: "selected" | "base" | "use-edits" | "discard-edits" };
  approvedAt: string;
  by: string;
}

export class PlanReviewError extends Error {
  constructor(
    message: string,
    readonly code: "superseded" | "changed" | "wrong_gate" | "started" | "not_waiting" | "unconfirmed_look" | "look_changed" | "deadline" | "planning" | "invalid_look",
  ) {
    super(message);
  }
}

export const planVersionsKey = (runId: string) => `planVersions:${runId}`;
export const planApprovalKey = (runId: string) => `planApproval:${runId}`;
const now = () => new Date().toISOString();

export function planHash(plan: ImplementationPlan): string {
  return createHash("sha256").update(JSON.stringify(plan)).digest("hex").slice(0, 16);
}

export function planVersions(app: Pick<App, "store">, runId: string): PlanVersion[] {
  return app.store.getSetting<PlanVersion[]>(planVersionsKey(runId), []);
}

/** Records a newly proposed plan as the build's next version (with how it differs from a revised one). */
export function recordPlanVersion(app: Pick<App, "store">, runId: string, plan: ImplementationPlan): PlanVersion {
  const all = planVersions(app, runId);
  const prev = all[all.length - 1];
  const titles = (p: ImplementationPlan) => p.tasks.map((t) => t.title);
  const outcome: PlanRevisionOutcome | undefined =
    prev?.revision && prev.status === "superseded"
      ? {
          from: prev.version,
          request: prev.revision.request,
          addedSteps: titles(plan).filter((t) => !titles(prev.plan).includes(t)),
          removedSteps: titles(prev.plan).filter((t) => !titles(plan).includes(t)),
          keptSteps: titles(plan).filter((t) => titles(prev.plan).includes(t)).length,
          riskFrom: prev.plan.risk,
          riskTo: plan.risk,
          scopeDecisionsFrom: prev.plan.scopeDecisions?.length ?? 0,
          scopeDecisionsTo: plan.scopeDecisions?.length ?? 0,
        }
      : undefined;
  // Any version still marked current (re-planned without a request) stops being current.
  const next: PlanVersion = { version: (prev?.version ?? 0) + 1, hash: planHash(plan), plan, createdAt: now(), status: "current", ...(outcome ? { outcome } : {}) };
  app.store.setSetting(planVersionsKey(runId), [...all.map((v) => (v.status === "current" ? { ...v, status: "superseded" as const } : v)), next]);
  return next;
}

function update(app: Pick<App, "store">, runId: string, version: number, patch: Partial<PlanVersion>) {
  app.store.setSetting(planVersionsKey(runId), planVersions(app, runId).map((v) => (v.version === version ? { ...v, ...patch } : v)));
}

export function attachApproval(app: Pick<App, "store">, runId: string, version: number, approvalId: string) {
  update(app, runId, version, { approvalId });
}

/** The plan approval waiting for the person (not a step's review), if any. */
export function pendingPlanApproval(app: Pick<App, "store">, runId: string): Approval | undefined {
  return app.store.approvals.where("run_id = ? AND status = 'pending'", runId).find((a) => a.kind === "plan" && !a.taskId);
}

/** Whether any step of the build has started (then the plan can only change through a follow-up request). */
const started = (app: Pick<App, "store">, runId: string) => app.store.tasks.where("run_id = ?", runId).some((t) => t.status !== "pending" && t.status !== "invalidated");

/**
 * Request changes to the plan waiting for approval: before any step has started, within the same build. The waiting
 * approval is superseded, the version keeps the request, and the planner plans again with it.
 */
export function requestPlanChanges(app: App, runId: string, input: { request: string; planVersion: number; planHash: string }): { supersededApprovalId: string; revisedVersion: number } {
  const run = app.store.runs.require(runId);
  const approval = pendingPlanApproval(app, runId);
  if (!approval) throw new PlanReviewError("No plan is waiting for your approval in this build.", "not_waiting");
  checkVersion(approval, input.planVersion, input.planHash, runId, app);
  if (started(app, runId)) throw new PlanReviewError("Work on this build has already started, so its plan can't be revised here.", "started");
  if (app.orchestrator.isActive(runId)) throw new PlanReviewError("FlowCode is still planning this build.", "planning");
  if (app.orchestrator.runDeadline(runId)?.expired) throw new PlanReviewError("This build's deadline has passed; it can't be planned again.", "deadline");
  const request = input.request.trim();
  app.store.approvals.upsert({ ...approval, status: "superseded", resolvedAt: now() });
  update(app, runId, approval.planVersion ?? 1, { status: "superseded", revision: { request, requestedAt: now(), by: "user" } });
  app.store.runs.upsert({
    ...run,
    planApproved: false,
    status: "draft",
    statusReason: `Revising the plan (version ${approval.planVersion ?? 1}) as you asked`,
    constraints: [...run.constraints, `Revision requested by the person for plan version ${approval.planVersion ?? 1}. Plan again so the new plan does this: ${request}`],
  } as Run);
  app.bus.emit({ type: "approval.resolved", projectId: run.projectId, runId, message: `Changes requested to plan version ${approval.planVersion ?? 1}: ${request.slice(0, 300)}`, data: { approvalId: approval.id, decision: "request_changes", planVersion: approval.planVersion } });
  void app.orchestrator.plan(runId).catch(() => undefined);
  return { supersededApprovalId: approval.id, revisedVersion: approval.planVersion ?? 1 };
}

function checkVersion(approval: Approval, planVersion: number | undefined, hash: string | undefined, runId: string, app: Pick<App, "store">) {
  if (approval.planVersion === undefined) return; // an approval made before plan versions existed
  const current = planVersions(app, runId).find((v) => v.status === "current");
  if (planVersion === undefined || planVersion !== approval.planVersion) throw new PlanReviewError(`You reviewed plan version ${planVersion ?? "?"}; the plan waiting is version ${approval.planVersion}. Review it again.`, "superseded");
  if (hash !== approval.planHash || (current && current.hash !== approval.planHash)) throw new PlanReviewError("This plan changed since you reviewed it. Review it again.", "changed");
}

/**
 * Approves the plan waiting for approval, bound to the version, hash, gate and look the person reviewed. Unconfirmed
 * look edits need an explicit choice. Returns what the approval bound to.
 */
export function approvePlanVersion(app: App, approval: Approval, input: ApprovalDecisionInput): PlanApprovalRecord {
  if (approval.kind !== "plan" || approval.taskId) throw new PlanReviewError("This isn't a plan approval.", "wrong_gate");
  if (input.kind !== undefined && input.kind !== "plan") throw new PlanReviewError(`This decision was meant for a ${input.kind} approval, not this plan.`, "wrong_gate");
  if (approval.status === "superseded") {
    const current = planVersions(app, approval.runId!).find((v) => v.status === "current");
    throw new PlanReviewError(`Plan version ${approval.planVersion} was replaced${current ? ` by version ${current.version}` : ""} after you asked for changes. Review the new version.`, "superseded");
  }
  checkVersion(approval, input.planVersion, input.planHash, approval.runId!, app);
  let jail;
  try {
    jail = app.projects.jail(approval.projectId);
  } catch {
    jail = undefined;
  }
  const design = getDesignState(app.store, approval.projectId, jail);
  const seen = design.selected?.version ?? 0;
  if (approval.planVersion !== undefined && input.lookVersion !== undefined && input.lookVersion !== seen) throw new PlanReviewError(`The look changed since you reviewed it (version ${input.lookVersion} → ${seen}). Review it again.`, "look_changed");
  let choice: PlanApprovalRecord["look"]["choice"] = design.selected ? "selected" : "base";
  if (design.draft) {
    if (!input.look) throw new PlanReviewError("The Look has edits you haven't confirmed. Choose: use them, discard them, or go back to editing.", "unconfirmed_look");
    if (input.look === "use-edits") {
      try {
        selectDraft(app.store, approval.projectId, jail);
      } catch (err) {
        throw new PlanReviewError(`Your look edits can't be used: ${(err as Error).message}`, "invalid_look");
      }
    } else discardDraft(app.store, approval.projectId, jail);
    choice = input.look;
  }
  const after = getDesignState(app.store, approval.projectId, jail);
  app.orchestrator.approvePlan(approval.runId!, "user");
  const record: PlanApprovalRecord = { planVersion: approval.planVersion ?? 1, planHash: approval.planHash ?? "", look: { version: after.selected?.version ?? null, choice }, approvedAt: now(), by: "user" };
  app.store.setSetting(planApprovalKey(approval.runId!), record);
  if (approval.planVersion !== undefined) update(app, approval.runId!, approval.planVersion, { status: "approved" });
  const run = app.store.runs.require(approval.runId!);
  app.bus.emit({
    type: "plan.approved",
    projectId: run.projectId,
    runId: run.id,
    message: `Approved plan version ${record.planVersion} with ${record.look.version ? `look version ${record.look.version}` : "the base styling (no brand direction)"}${choice === "use-edits" ? " (your edits, confirmed now)" : choice === "discard-edits" ? " (unconfirmed edits discarded)" : ""}`,
    data: { planApproval: record },
  });
  return record;
}
