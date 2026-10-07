/**
 * Run Review: a short, evidence-based record made when a run ends (done, blocked, failed or cancelled). It says what was
 * asked, what happened, what was actually verified, what couldn't be, and what the run measured. Important, recurring
 * or preventable problems become improvement proposals in the backlog; everything else is "No new improvement
 * identified". Facts only: no model self-assessment, and anything not recorded is "Not measured".
 *
 * Stored as a report_json artifact (meta.type "run_review"): no schema change. The backlog lives in settings.
 */
import { TERMINAL_RUN_STATUSES, type Run, type Task } from "@flowcode/contracts";
import type { App } from "../app.js";
import { runPerformance } from "../api/performance.js";
import { plainBlocker } from "./blockerText.js";
import { checkName, checkState, latestRunChecks, verificationCompleteness, type CheckState } from "./checkState.js";

export type FailureCategory = "request" | "planning" | "context" | "tools" | "code" | "ux_design" | "research_data" | "communication" | "verification" | "performance" | "safety_privacy";

export interface ReviewIssue {
  key: string;
  category: FailureCategory;
  what: string;
  where: string;
  evidence: string[];
  cause: { text: string; status: "suspected" | "confirmed" };
  /** Earlier runs whose review recorded the same issue. */
  recurrence: number;
}

export interface RunReview {
  version: 1;
  runId: string;
  projectId: string;
  createdAt: string;
  level: "light" | "detailed";
  requested: string;
  outcome: { status: string; finished: boolean; verifiedSteps: number; totalSteps: number; verification: "complete" | "incomplete" | "not_run" };
  checks: Array<{ kind: string; name: string; state: CheckState; note: string }>;
  worked: string[];
  limitations: string[];
  issues: ReviewIssue[];
  /** Missing fields were not measured. */
  measurements: { wallMs?: number; waitingMs?: number; modelMs?: number; modelCalls?: number; attempts?: number; restores?: number; failedCommandMs?: number; succeededCommandMs?: number; estimate?: { lowMs: number; highMs: number; actualActiveMs: number; within: boolean } };
  /** Ids in the improvement backlog; empty means "No new improvement identified". */
  proposals: string[];
}

export type ImprovementStatus = "proposed" | "awaiting_approval" | "approved" | "in_progress" | "testing" | "verified" | "rejected" | "rolled_back" | "deferred";

export interface Improvement {
  id: string;
  /** The issue key it answers; one proposal per key. */
  key: string;
  name: string;
  status: ImprovementStatus;
  relatedRuns: string[];
  /** The project each related run belongs to (for links). */
  runProjects?: Record<string, string>;
  evidence: string[];
  benefit: string;
  change: string;
  target: string;
  owner: string;
  priority: "now" | "next" | "later";
  scope: "project" | "global";
  projectId?: string;
  baseline: string;
  successMeasure: string;
  validation: string;
  approvalRequired: boolean;
  rollback: string;
  history: Array<{ at: string; status: ImprovementStatus; note: string; actor: "flowcode" | "user" }>;
}

export const IMPROVEMENTS_KEY = "improvements.v1";
/** Runs that have ended for now: finished, failed, cancelled, or stopped needing a decision (a resume replaces the review). */
const REVIEWABLE: readonly string[] = [...TERMINAL_RUN_STATUSES, "blocked"];
const REVIEW_TYPE = "run_review";

/** Why a check couldn't run, in plain words (the raw error stays in the review's details). */
export function plainCause(note: string): string {
  if (/credit|quota|billing/i.test(note)) return "the cloud model ran out of credit";
  if (/timed? ?out/i.test(note)) return "it took too long";
  if (/unreachable|ECONNREFUSED|fetch failed|not reachable/i.test(note)) return "the model couldn't be reached";
  if (/HTTP \d{3}|error/i.test(note)) return "the model returned an error";
  return note.slice(0, 100);
}

const firstLine = (s: string) => s.replace(/^#+\s*/gm, "").split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";

/** Concrete proposals for issue keys FlowCode knows how to address. Unknown keys propose nothing on their own. */
const PROPOSALS: Record<string, Omit<Improvement, "id" | "key" | "status" | "relatedRuns" | "evidence" | "history" | "projectId">> = {
  "check_unavailable:visual_critique": {
    name: "Run the visual review on a local vision model when the cloud critic can't run",
    benefit: "Finished builds get a visual review instead of finishing unreviewed.",
    change: "In the run-end checks, fall back to the local critic (vision) model when the cloud critic returns a credit, quota or connection error, and record which critic ran.",
    target: "packages/daemon/src/quality/verification.ts (visual critique)",
    owner: "Verification",
    priority: "now",
    scope: "global",
    baseline: "Visual review recorded as couldn't run on the runs listed.",
    successMeasure: "On later runs without cloud credit, the visual review is passed or failed, not 'couldn't run'.",
    validation: "Next run with the cloud critic unavailable; compare the visual review state and the findings with a cloud-reviewed run.",
    approvalRequired: true,
    rollback: "Revert the fallback if local findings are mostly noise (user dismisses most of them).",
  },
  "blocked:model_credit": {
    name: "Check cloud credit before a build starts",
    benefit: "Builds don't stop part-way because a cloud model ran out of credit.",
    change: "In preflight, make one minimal request to each cloud model the build will use; if it's out of credit, say so before planning and offer the local models.",
    target: "packages/daemon/src/orchestrator (preflight)",
    owner: "Orchestrator",
    priority: "now",
    scope: "global",
    baseline: "Steps or planning blocked by exhausted credit on the runs listed.",
    successMeasure: "No later run stops mid-way on exhausted credit; the warning appears before planning instead.",
    validation: "Start a build with an exhausted key; confirm the preflight warning and that no step starts on that model.",
    approvalRequired: true,
    rollback: "Remove the preflight request if it adds noticeable start-up time or cost.",
  },
  "blocked:no_action": {
    name: "Re-prompt for a tool call as soon as the coder replies in prose",
    benefit: "Fewer steps lost to the model describing a change instead of making it.",
    change: "After the first prose-only reply in a step, send a short corrective turn with the exact tool to call before counting a failed try.",
    target: "packages/daemon/src/orchestrator/agentLoop.ts",
    owner: "Agent loop",
    priority: "next",
    scope: "global",
    baseline: "Steps blocked with 'model replied with prose only' on the runs listed.",
    successMeasure: "The share of tries ending in prose-only replies falls on later runs with the same coder model.",
    validation: "Re-run the blocked steps' fixtures with the same model; count prose-only endings before and after.",
    approvalRequired: true,
    rollback: "Revert if verified-first-try rates drop.",
  },
  "performance:rework": {
    name: "Find where a run's work is undone and redone",
    benefit: "Shorter builds, by measuring the rework that dominates run time before changing anything.",
    change: "Add the undo/redo count and failed command time per step to Run performance, and list the top steps in the review.",
    target: "packages/daemon/src/api/performance.ts",
    owner: "Run performance",
    priority: "next",
    scope: "global",
    baseline: "See the measurements in the run reviews listed (restores, failed command time).",
    successMeasure: "Rework is visible per step; later changes can be judged against it.",
    validation: "Compare the per-step figures with the event log of the runs listed.",
    approvalRequired: false,
    rollback: "Measurement only; remove if unused.",
  },
};

function issuesFor(app: App, run: Run, tasks: Task[], checks: RunReview["checks"], m: RunReview["measurements"]): ReviewIssue[] {
  const out: ReviewIssue[] = [];
  for (const c of checks.filter((x) => x.state === "unavailable")) {
    out.push({ key: `check_unavailable:${c.kind}`, category: "verification", what: `The ${c.name} couldn't run`, where: "Run-end checks", evidence: [c.note], cause: { text: c.note, status: "confirmed" }, recurrence: 0 });
  }
  for (const t of tasks.filter((x) => x.status === "blocked" && x.blocker)) {
    const r = t.blocker!.reason;
    const key = t.blocker!.category === "model" && /credit|quota/i.test(r) ? "blocked:model_credit" : /no_action|prose only/i.test(r) ? "blocked:no_action" : /budget_exhausted/i.test(r) ? "blocked:turn_budget" : `blocked:${t.blocker!.category}`;
    out.push({
      key,
      category: key === "blocked:model_credit" ? "tools" : key === "blocked:no_action" || key === "blocked:turn_budget" ? "tools" : t.blocker!.category === "verification" ? "verification" : "planning",
      what: `Step "${t.title}" stopped`,
      where: `Step ${t.ordinal + 1}`,
      evidence: [r.slice(0, 300)],
      cause: { text: r.slice(0, 300), status: key === "blocked:model_credit" ? "confirmed" : "suspected" },
      recurrence: 0,
    });
  }
  // A run stopped before any step (e.g. planning out of credit).
  if (!tasks.some((t) => t.status === "blocked") && (run.status === "blocked" || run.status === "failed") && run.statusReason) {
    const credit = /quota_exhausted|credit/i.test(run.statusReason);
    out.push({ key: credit ? "blocked:model_credit" : "blocked:run", category: credit ? "tools" : "planning", what: "The run stopped before finishing", where: "Run", evidence: [run.statusReason.slice(0, 300)], cause: { text: run.statusReason.split("\n")[0].slice(0, 300), status: credit ? "confirmed" : "suspected" }, recurrence: 0 });
  }
  // Rework: more time in failed commands than successful ones, or many restores per attempt.
  if ((m.failedCommandMs ?? 0) > (m.succeededCommandMs ?? 0) && (m.failedCommandMs ?? 0) > 10 * 60_000) {
    out.push({ key: "performance:rework", category: "performance", what: "More command time went to failed attempts than successful ones", where: "Whole run", evidence: [`failed commands ${Math.round((m.failedCommandMs ?? 0) / 60000)} min vs successful ${Math.round((m.succeededCommandMs ?? 0) / 60000)} min; ${m.restores ?? 0} undos`], cause: { text: "Not established: retries and undone work, causes per step not yet measured", status: "suspected" }, recurrence: 0 });
  }
  void app;
  return out;
}

function measure(app: App, run: Run, tasks: Task[]): RunReview["measurements"] {
  const m: RunReview["measurements"] = {};
  try {
    const p = runPerformance(app, run.id);
    m.wallMs = p.elapsedMs;
    m.waitingMs = p.waitingMs;
    if (p.model.calls) {
      m.modelMs = p.model.totalMs;
      m.modelCalls = p.model.calls;
    }
  } catch {
    // Not measured.
  }
  m.attempts = tasks.reduce((n, t) => n + (t.attempts ?? 0), 0);
  m.restores = app.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM events WHERE run_id = ? AND type = 'snapshot.restored'", run.id)?.n ?? 0;
  const cmd = app.db.all<{ status: string; ms: number }>("SELECT status, SUM((julianday(updated_at) - julianday(created_at)) * 86400000) AS ms FROM commands WHERE run_id = ? GROUP BY status", run.id);
  m.failedCommandMs = Math.round(cmd.filter((c) => c.status === "failed" || c.status === "timed_out").reduce((n, c) => n + (c.ms ?? 0), 0));
  m.succeededCommandMs = Math.round(cmd.filter((c) => c.status === "succeeded").reduce((n, c) => n + (c.ms ?? 0), 0));
  // The first time estimate shown for this run, against the active time it really took (waiting for the person excluded).
  const first = app.store.getSetting<{ at: string; lowMs: number; highMs: number } | null>(`eta:first:${run.id}`, null);
  if (first && run.completedAt) {
    const actualActiveMs = Math.max(0, Date.parse(run.completedAt) - Date.parse(first.at) - (m.waitingMs ?? 0));
    m.estimate = { lowMs: first.lowMs, highMs: first.highMs, actualActiveMs, within: actualActiveMs >= first.lowMs && actualActiveMs <= first.highMs };
  }
  return m;
}

/** Builds the review for a finished run (no storage). */
export function buildRunReview(app: App, runId: string): RunReview {
  const run = app.store.runs.require(runId);
  const finished = TERMINAL_RUN_STATUSES.includes(run.status);
  const tasks = app.store.tasks.where("run_id = ? ORDER BY ordinal ASC", runId);
  const counted = tasks.filter((t) => t.status !== "skipped" && t.status !== "invalidated");
  const verified = counted.filter((t) => t.status === "verified");
  const recorded = latestRunChecks(app.store.checks.where("run_id = ?", runId));
  const checks = recorded.map((c) => ({ kind: c.kind, name: checkName(c.kind), state: checkState(c), note: c.summary.split("\n")[0].slice(0, 200) }));
  const m = measure(app, run, tasks);

  const worked: string[] = [];
  if (verified.length) worked.push(`${verified.length} of ${counted.length} steps passed their checks`);
  const passed = checks.filter((c) => c.state === "passed" || c.state === "passed_with_warnings");
  if (passed.length) worked.push(`Checks passed: ${passed.map((c) => c.name).join(", ")}`);

  const limitations: string[] = [];
  for (const c of checks.filter((x) => x.state === "unavailable")) limitations.push(`The ${c.name} couldn't run (${plainCause(c.note)}), so that part isn't verified`);
  for (const c of checks.filter((x) => x.state === "failed")) limitations.push(`The ${c.name} failed`);
  for (const t of tasks.filter((x) => x.status === "blocked")) {
    const p = plainBlocker(t);
    if (p) limitations.push(`"${t.title}": ${p.explanation}`);
  }
  if (run.status === "cancelled") limitations.push("The run was cancelled before it finished");

  // Recurrence: earlier reviews in this project with the same issue keys.
  const issues = issuesFor(app, run, tasks, checks, m);
  const earlier = reviewsForProject(app, run.projectId).filter((r) => r.runId !== runId);
  for (const i of issues) i.recurrence = earlier.filter((r) => r.issues.some((x) => x.key === i.key)).length;

  const level: RunReview["level"] = run.status === "failed" || run.status === "blocked" || issues.some((i) => i.recurrence >= 1) ? "detailed" : "light";
  return {
    version: 1,
    runId,
    projectId: run.projectId,
    createdAt: new Date().toISOString(),
    level,
    requested: firstLine(run.objective).slice(0, 300),
    outcome: { status: run.status, finished, verifiedSteps: verified.length, totalSteps: counted.length, verification: recorded.length ? verificationCompleteness(recorded) : "not_run" },
    checks,
    worked,
    limitations,
    issues,
    measurements: m,
    proposals: [],
  };
}

/** Adds or updates backlog proposals for the review's known issues. Only proposes: nothing is applied here. */
function propose(app: App, review: RunReview): string[] {
  const backlog = app.store.getSetting<Improvement[]>(IMPROVEMENTS_KEY, []);
  const ids: string[] = [];
  const at = new Date().toISOString();
  for (const issue of review.issues) {
    const template = PROPOSALS[issue.key];
    if (!template) continue;
    let item = backlog.find((b) => b.key === issue.key && (template.scope === "global" || b.projectId === review.projectId));
    if (!item) {
      item = { ...template, id: `imp_${issue.key.replace(/[^a-z0-9]+/gi, "_")}`, key: issue.key, status: "proposed", relatedRuns: [], evidence: [], history: [{ at, status: "proposed", note: `From the review of ${review.runId}`, actor: "flowcode" }], ...(template.scope === "project" ? { projectId: review.projectId } : {}) };
      backlog.push(item);
    }
    item.runProjects = { ...(item.runProjects ?? {}), [review.runId]: review.projectId };
    if (!item.relatedRuns.includes(review.runId)) {
      item.relatedRuns.push(review.runId);
      item.evidence = [...item.evidence, `${review.runId}: ${issue.evidence[0] ?? issue.what}`].slice(-10);
    }
    ids.push(item.id);
  }
  app.store.setSetting(IMPROVEMENTS_KEY, backlog);
  return [...new Set(ids)];
}

/** Builds, stores (replacing an earlier one) and returns the review of a finished run. */
export function recordRunReview(app: App, runId: string): RunReview | undefined {
  const run = app.store.runs.get(runId);
  if (!run || !REVIEWABLE.includes(run.status)) return undefined;
  const review = buildRunReview(app, runId);
  review.proposals = propose(app, review);
  for (const old of app.artifacts.forRun(runId).filter((a) => a.meta?.type === REVIEW_TYPE)) app.store.artifacts.delete(old.id);
  app.artifacts.save({ runId, kind: "report_json", label: "Run review", mime: "application/json", meta: { type: REVIEW_TYPE, version: 1 }, content: JSON.stringify(review) });
  return review;
}

/** The stored review of a run, if there is one. */
export function getRunReview(app: App, runId: string): RunReview | undefined {
  const rec = app.artifacts.forRun(runId).filter((a) => a.meta?.type === REVIEW_TYPE).at(-1);
  if (!rec) return undefined;
  try {
    return JSON.parse(app.artifacts.read(rec.id).content.toString("utf8")) as RunReview;
  } catch {
    return undefined;
  }
}

function reviewsForProject(app: App, projectId: string): RunReview[] {
  const runs = app.store.runs.where("project_id = ? ORDER BY created_at DESC LIMIT 30", projectId);
  return runs.map((r) => getRunReview(app, r.id)).filter((r): r is RunReview => !!r);
}

/** Keeps reviews current: when a run ends, its review is made (in the background; never blocks the run). */
export function watchRunEnds(app: App) {
  return app.bus.subscribe((e) => {
    if (e.type !== "run.status_changed" || !e.runId) return;
    const to = (e.data as { to?: string } | undefined)?.to;
    if (!to || !REVIEWABLE.includes(to as Run["status"])) return;
    const runId = e.runId;
    setTimeout(() => {
      try {
        recordRunReview(app, runId);
      } catch {
        // A review must never affect the run; it can be rebuilt on demand.
      }
    }, 1500);
  });
}
