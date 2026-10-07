/**
 * Grounded run status for the Copilot. Status questions ("what's happening?", "why did it stop?") are answered from
 * fresh structured state for the run the user means, never from earlier chat: the facts are built here, the model may
 * only reword them, and anything it adds that isn't in the facts is thrown away.
 */
import type { Project, Run, Task } from "@flowcode/contracts";
import { TERMINAL_RUN_STATUSES } from "@flowcode/contracts";
import type { App } from "../app.js";
import { checkName, checkState, latestRunChecks, verificationCompleteness, type CheckState } from "../quality/checkState.js";
import { plainBlocker, plainCheckSummary, type BlockerAction } from "../quality/blockerText.js";

export interface RunFacts {
  projectId: string;
  projectName: string;
  runId: string;
  /** How the run was picked: the page's run, the page's project (latest run), or a project the user named. */
  resolvedBy: "route" | "project" | "named";
  status: string;
  statusLabel: string;
  finished: boolean;
  startedAt?: string;
  endedAt?: string;
  /** When the run was created (ISO). */
  createdAt: string;
  steps: { verified: number; total: number; running?: string; runningAttempt?: number };
  blocked: Array<{ taskId: string; title: string; explanation: string; owner: "flowcode" | "user"; decision?: string; actions: BlockerAction[] }>;
  /** Why the run stopped, when it stopped before or outside any step (e.g. planning). */
  runReason?: string;
  checks: Array<{ kind: string; name: string; state: CheckState; note: string }>;
  verification: "complete" | "incomplete" | "not_run";
  waitingApprovals: number;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "being planned",
  running: "building",
  verifying: "running its final checks",
  recovering: "recovering from a problem",
  awaiting_approval: "waiting for your approval",
  blocked: "stopped and needs a decision",
  failed: "failed",
  cancelled: "cancelled",
  done: "finished",
  done_with_warnings: "finished with warnings",
  done_unverified: "finished, but not fully checked",
};

/** Questions about the state of a build, which must be answered from live data. */
export function isStatusQuestion(q: string): boolean {
  return /\bwhat\b.{0,12}\bhappen\w*\b.{0,30}\b(build|run|project|it)\b|\b(what'?s|what is|how'?s|how is)\b.{0,40}\b(happen\w*|going on|going|doing|status|left|progress)\b|\bwhy\b.{0,40}\b(stop\w*|stuck|block\w*|fail\w*|cancel\w*|slow)\b|\bis (it|the build|my build|the run)\b.{0,20}\b(done|stuck|finished|running|blocked|working)\b|\b(status|progress)\b.{0,30}\b(build|run|project)\b|\bwhat happened\b/i.test(q);
}

/** Which run the user means: one they name, else the page's run, else the page project's latest run. */
export function resolveRun(app: App, ask: { question: string; projectId?: string; runId?: string }): { run: Run; project: Project; resolvedBy: RunFacts["resolvedBy"] } | undefined {
  const projects = app.store.projects.list("updated_at DESC", 50);
  const latest = (projectId: string) => app.store.runs.where("project_id = ? ORDER BY created_at DESC LIMIT 1", projectId)[0];
  const current = ask.runId ? app.store.runs.get(ask.runId) : undefined;
  const currentProjectId = current?.projectId ?? ask.projectId;
  // A project named in the question, other than the one on screen ("how's the calculator doing?").
  const q = ask.question.toLowerCase();
  const named = projects
    .filter((p) => p.id !== currentProjectId)
    .map((p) => ({ p, score: nameScore(p.name, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.p;
  if (named) {
    const run = latest(named.id);
    if (run) return { run, project: named, resolvedBy: "named" };
  }
  if (current) {
    const project = app.store.projects.get(current.projectId);
    if (project) return { run: current, project, resolvedBy: "route" };
  }
  if (ask.projectId) {
    const project = app.store.projects.get(ask.projectId);
    const run = project ? latest(project.id) : undefined;
    if (project && run) return { run, project, resolvedBy: "project" };
  }
  return undefined;
}

const GENERIC = new Set(["app", "the", "and", "prototype", "project", "design", "rebuild", "build", "new", "test", "my"]);

/** How clearly a question names a project: the full name, or one of its distinctive words. */
function nameScore(name: string, q: string): number {
  const n = name.toLowerCase().replace(/\s+/g, " ").trim();
  if (n.length >= 3 && q.includes(n)) return 10;
  const words = n.match(/[a-z0-9]{4,}/g)?.filter((w) => !GENERIC.has(w)) ?? [];
  return words.filter((w) => new RegExp(`\\b${w}`, "i").test(q)).length;
}

export function runFacts(app: App, run: Run, project: Project, resolvedBy: RunFacts["resolvedBy"]): RunFacts {
  const tasks = app.store.tasks.where("run_id = ? ORDER BY ordinal ASC", run.id);
  const counted = tasks.filter((t) => t.status !== "skipped" && t.status !== "invalidated");
  const running = tasks.find((t) => t.status === "running" || t.status === "awaiting_approval");
  const blocked = tasks
    .filter((t): t is Task & { blocker: NonNullable<Task["blocker"]> } => t.status === "blocked" && !!t.blocker)
    .map((t) => {
      const p = plainBlocker(t, app.store)!;
      return { taskId: t.id, title: t.title, explanation: p.explanation, owner: p.owner, ...(p.decision ? { decision: p.decision } : {}), actions: p.actions };
    });
  const recorded = latestRunChecks(app.store.checks.where("run_id = ?", run.id));
  const checks = recorded.map((c) => ({ kind: c.kind, name: checkName(c.kind), state: checkState(c), note: plainCheckSummary(c.summary).slice(0, 200) }));
  const finished = TERMINAL_RUN_STATUSES.includes(run.status);
  return {
    projectId: project.id,
    projectName: project.name.replace(/\s+/g, " ").trim(),
    runId: run.id,
    resolvedBy,
    status: run.status,
    statusLabel: STATUS_LABEL[run.status] ?? run.status.replace(/_/g, " "),
    finished,
    ...(run.startedAt ? { startedAt: run.startedAt } : {}),
    ...(run.completedAt ? { endedAt: run.completedAt } : {}),
    createdAt: run.createdAt,
    steps: { verified: counted.filter((t) => t.status === "verified").length, total: counted.length, ...(running ? { running: running.title, runningAttempt: running.attempts } : {}) },
    blocked,
    ...(!blocked.length && run.statusReason && ["blocked", "failed", "cancelled"].includes(run.status) ? { runReason: run.statusReason.split("\n")[0].slice(0, 240) } : {}),
    checks,
    verification: finished ? verificationCompleteness(recorded) : "not_run",
    waitingApprovals: app.approvals.pending().filter((a) => a.runId === run.id && a.kind !== "enhancement_idea").length,
  };
}

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

/** The facts as a short plain answer. Used as-is when the model's wording can't be trusted. */
export function factsAnswer(f: RunFacts): string {
  const lines: string[] = [];
  const named = f.resolvedBy === "named" ? ` (the latest build of ${f.projectName})` : "";
  lines.push(`${f.projectName}${named}: ${f.statusLabel}${f.finished && f.endedAt ? ` on ${when(f.endedAt)}` : ""}. ${f.steps.verified} of ${f.steps.total} steps passed their checks.`);
  if (f.steps.running) lines.push(`Working on "${f.steps.running}"${f.steps.runningAttempt && f.steps.runningAttempt > 1 ? ` (try ${f.steps.runningAttempt})` : ""}.`);
  if (f.waitingApprovals) lines.push(`${f.waitingApprovals} approval${f.waitingApprovals === 1 ? " is" : "s are"} waiting for you.`);
  for (const b of f.blocked.slice(0, 2)) lines.push(`"${b.title}" stopped: ${b.explanation}${b.decision ? ` ${b.decision}` : ""}`);
  if (f.runReason) lines.push(`It stopped because: ${f.runReason}`);
  const missing = f.checks.filter((c) => c.state === "unavailable");
  if (missing.length) lines.push(`Not verified: the ${missing.map((c) => c.name).join(", ")} couldn't run, so ${missing.length === 1 ? "that part wasn't" : "those parts weren't"} checked.`);
  const failed = f.checks.filter((c) => c.state === "failed");
  if (failed.length) lines.push(`Failing: ${failed.map((c) => c.name).join(", ")}.`);
  if (f.finished && f.verification === "complete" && !failed.length) lines.push("All its final checks ran and passed.");
  return lines.join(" ");
}

/**
 * Whether a model's wording stays within the facts: every quoted name and file it mentions must appear in them, and it
 * must not hand the person work FlowCode does (writing tests or code).
 */
export function groundedIn(answer: string, f: RunFacts, otherProjects: string[] = []): boolean {
  const facts = JSON.stringify(f).toLowerCase();
  // Quoted names: "…", “…”, or '…' when the quote isn't an apostrophe (couldn't, wasn't).
  const quoted = [...answer.matchAll(/["“]([^"”]{4,80})["”]|(?:^|[\s(])['‘]([^'’]{4,80})['’](?=[\s.,;:!?)]|$)/g)].map((m) => (m[1] ?? m[2]).toLowerCase());
  const files = answer.match(/\b[\w./-]+\.(tsx?|jsx?|css|json|md)\b/gi) ?? [];
  if ([...quoted, ...files.map((x) => x.toLowerCase())].some((s) => !facts.includes(s))) return false;
  if (/\byou(?:'ll)? (?:need|have|must|should) to (?:write|add|create|fix|edit|update) (?:the |some |a |its )?(?:acceptance )?(?:tests?|code|files?)\b/i.test(answer)) return false;
  // Another project's name means it mixed up builds.
  const lower = answer.toLowerCase();
  return !otherProjects.some((n) => n.length >= 4 && lower.includes(n.toLowerCase()) && !f.projectName.toLowerCase().includes(n.toLowerCase()));
}
