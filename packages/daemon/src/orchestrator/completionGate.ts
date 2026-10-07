/**
 * Deterministic completion gate (FR-V2, §13.1). `Done` is computed from records — tasks, verification
 * checks and the final report artifact — and never from model prose.
 */
import { checkCouldNotRun, type RunStatus, type Task, type VerificationCheck, type VerificationKind } from "@flowcode/contracts";

export interface GateInput {
  tasks: Task[];
  checks: VerificationCheck[];
  requiredChecks: VerificationKind[];
  hasFinalReport: boolean;
  planApproved: boolean;
}

export interface GateResult {
  status: Extract<RunStatus, "done" | "done_with_warnings" | "done_unverified" | "blocked" | "failed">;
  unmet: string[];
  warnings: string[];
  /** Checks that couldn't run: the run can finish, but not as fully verified. */
  unverified: string[];
  evidence: Array<{ requirement: string; status: string; evidenceRefs: string[] }>;
}

export function evaluateCompletionGate(input: GateInput): GateResult {
  const unmet: string[] = [];
  const warnings: string[] = [];
  const unverified: string[] = [];
  const evidence: GateResult["evidence"] = [];

  if (!input.planApproved) unmet.push("Plan approval: no approved structured plan");
  evidence.push({ requirement: "plan_approval", status: input.planApproved ? "passed" : "missing", evidenceRefs: [] });

  if (input.tasks.length === 0) unmet.push("No tasks were planned");
  for (const t of input.tasks) {
    const ok = t.status === "verified" || t.status === "skipped";
    evidence.push({ requirement: `task:${t.title}`, status: t.status, evidenceRefs: t.acceptanceCriteria.flatMap((c) => c.evidenceRefs) });
    if (!ok) unmet.push(`Task "${t.title}" is ${t.status}${t.blocker ? ` — ${t.blocker.reason}` : ""}`);
    else if (t.status === "skipped") warnings.push(`Task "${t.title}" was skipped`);
    for (const c of t.acceptanceCriteria) {
      if (t.status === "verified" && c.check.type !== "manual" && !c.met) unmet.push(`Acceptance criterion not evidenced: ${c.description}`);
      if (c.check.type === "manual") warnings.push(`Manual criterion requires human review: ${c.description}`);
    }
  }

  const latest = new Map<string, VerificationCheck>();
  for (const c of input.checks) if (!c.taskId) latest.set(c.kind, c);
  for (const kind of input.requiredChecks) {
    const c = latest.get(kind);
    if (kind === "final_report") {
      evidence.push({ requirement: "final_report", status: input.hasFinalReport ? "passed" : "missing", evidenceRefs: c?.evidenceRefs ?? [] });
      if (!input.hasFinalReport) unmet.push("Final report artifact has not been generated");
      continue;
    }
    evidence.push({ requirement: kind, status: c?.status ?? "not_run", evidenceRefs: c?.evidenceRefs ?? [] });
    if (!c || c.status === "not_run" || c.status === "pending" || c.status === "running") unmet.push(`Required check "${kind}" has no evidence`);
    else if (c.status === "failed" || c.status === "blocked") unmet.push(`Required check "${kind}" ${c.status}: ${c.summary}`);
    else if (c.status === "skipped") unmet.push(`Required check "${kind}" was skipped`);
    else if (c.status === "passed_with_warnings") warnings.push(`${kind}: ${c.summary}`);
    if (c && c.evidenceRefs.length === 0 && (c.status === "passed" || c.status === "passed_with_warnings")) unmet.push(`Required check "${kind}" passed without linked evidence`);
  }
  for (const c of latest.values()) {
    if (!input.requiredChecks.includes(c.kind) && (c.status === "failed" || c.status === "passed_with_warnings")) warnings.push(`Optional check ${c.kind} ${c.status}: ${c.summary}`);
    if (checkCouldNotRun(c.status, c.summary)) unverified.push(`${c.kind} couldn't run: ${c.summary.split("\n")[0].slice(0, 200)}`);
  }

  const anyFailed = input.tasks.some((t) => t.status === "failed");
  const status: GateResult["status"] = unmet.length ? (anyFailed ? "failed" : "blocked") : unverified.length ? "done_unverified" : warnings.length ? "done_with_warnings" : "done";
  return { status, unmet, warnings, unverified, evidence };
}
