/**
 * Project Journal: what FlowCode did on a project, what worked, what needs improvement and what to try next, assembled
 * from records that already exist (run reviews, the decision log, improvement proposals, run performance, the plan's
 * PRD brief, fix memory). It never writes a competing version of the facts, and every statement says what kind of
 * statement it is and where the evidence is.
 */
import type { App } from "../app.js";
import { runPerformance } from "../api/performance.js";
import { listDecisions } from "../governance/decisionLog.js";
import { untrusted } from "../orchestrator/prompts.js";
import { buildRunReview, getRunReview, IMPROVEMENTS_KEY, plainCause, type Improvement, type RunReview } from "./runReview.js";

export type StatementKind = "observed" | "suspected" | "interpretation" | "verified" | "open_question";

export interface Statement {
  kind: StatementKind;
  text: string;
  /** Where it comes from: "run:…", "step:…", "check:…", "decision:…", "improvement:…", "prd". */
  evidence: string[];
}

export interface JournalEntry {
  runId: string;
  createdAt: string;
  status: string;
  asked: string;
  contributions: Array<{ role: string; models: string[]; calls: number; steps: number; stepsPassed: number }>;
  worked: Statement[];
  wentWrong: Statement[];
  repaired: Statement[];
  incomplete: Statement[];
  checked: Statement[];
  notChecked: Statement[];
  time: { measured: boolean; phases: Array<{ phase: string; minutes: number }>; waitingMinutes?: number; totalMinutes?: number };
  prd: Statement[];
  next: Statement[];
  proposals: Array<{ id: string; name: string; status: string }>;
}

export interface Journal {
  projectId: string;
  projectName: string;
  entries: JournalEntry[];
}

const min = (ms?: number) => (ms === undefined ? undefined : Math.round(ms / 6000) / 10);

function reviewOf(app: App, runId: string): RunReview | undefined {
  try {
    return getRunReview(app, runId) ?? buildRunReview(app, runId);
  } catch {
    return undefined;
  }
}

export function journalEntry(app: App, runId: string): JournalEntry {
  const run = app.store.runs.require(runId);
  const tasks = app.store.tasks.where("run_id = ? ORDER BY ordinal ASC", runId);
  const review = reviewOf(app, runId);
  const backlog = app.store.getSetting<Improvement[]>(IMPROVEMENTS_KEY, []);

  // Contributions: recorded model calls per role, and the steps each role ran (never inferred beyond the records).
  const roles = new Map<string, { models: Set<string>; calls: number; steps: number; stepsPassed: number }>();
  const role = (r: string) => roles.get(r) ?? roles.set(r, { models: new Set(), calls: 0, steps: 0, stepsPassed: 0 }).get(r)!;
  for (const e of app.db.all<{ data: string }>("SELECT data FROM events WHERE run_id = ? AND type = 'model.completed'", runId)) {
    const d = (JSON.parse(e.data) as { data?: { role?: string; model?: string } }).data;
    if (!d?.role) continue;
    const r = role(d.role);
    r.calls++;
    if (d.model) r.models.add(d.model);
  }
  for (const t of tasks) {
    const r = role(t.role);
    r.steps++;
    if (t.status === "verified") r.stepsPassed++;
  }

  const worked: Statement[] = [];
  const wentWrong: Statement[] = [];
  const repaired: Statement[] = [];
  const incomplete: Statement[] = [];
  const checked: Statement[] = [];
  const notChecked: Statement[] = [];
  const prd: Statement[] = [];
  const next: Statement[] = [];

  const passedFirst = tasks.filter((t) => t.status === "verified" && t.attempts <= 1);
  const passedLater = tasks.filter((t) => t.status === "verified" && t.attempts > 1);
  if (passedFirst.length) worked.push({ kind: "observed", text: `${passedFirst.length} step${passedFirst.length === 1 ? "" : "s"} passed ${passedFirst.length === 1 ? "its" : "their"} checks on the first try.`, evidence: passedFirst.slice(0, 5).map((t) => `step:${t.id}`) });
  if (passedLater.length) repaired.push({ kind: "observed", text: `${passedLater.length} step${passedLater.length === 1 ? "" : "s"} passed after retries: ${passedLater.slice(0, 4).map((t) => `"${t.title}" (${t.attempts} tries)`).join(", ")}.`, evidence: passedLater.slice(0, 5).map((t) => `step:${t.id}`) });
  for (const t of tasks.filter((x) => x.status === "blocked" || x.status === "failed")) {
    wentWrong.push({ kind: "observed", text: `"${t.title}" stopped after ${t.attempts} ${t.attempts === 1 ? "try" : "tries"}.`, evidence: [`step:${t.id}`] });
    if (t.blocker) wentWrong.push({ kind: t.blocker.category === "model" && /credit|quota/i.test(t.blocker.reason) ? "observed" : "suspected", text: `Recorded reason: ${t.blocker.reason.split("\n")[0].slice(0, 220)}`, evidence: [`step:${t.id}`] });
  }
  for (const t of tasks.filter((x) => x.status === "pending" || x.status === "invalidated" || x.status === "attempted")) incomplete.push({ kind: "observed", text: `"${t.title}" wasn't finished.`, evidence: [`step:${t.id}`] });
  if (run.status === "cancelled") incomplete.push({ kind: "observed", text: `The run was cancelled${run.statusReason ? `: ${run.statusReason.slice(0, 160)}` : ""}.`, evidence: [`run:${run.id}`] });
  for (const d of listDecisions(app, { runId, kind: "recovery" }).slice(0, 5)) repaired.push({ kind: "observed", text: d.summary, evidence: [`decision:${d.id}`] });

  for (const c of review?.checks ?? []) {
    if (c.state === "passed" || c.state === "passed_with_warnings") checked.push({ kind: "observed", text: `${c.name}: ${c.state === "passed" ? "passed" : "passed with notes"}.`, evidence: [`check:${c.kind}`] });
    else if (c.state === "failed") wentWrong.push({ kind: "observed", text: `${c.name} failed: ${c.note.slice(0, 160)}`, evidence: [`check:${c.kind}`] });
    else notChecked.push({ kind: "observed", text: `${c.name}: ${c.state === "unavailable" ? "couldn't run" : c.state === "skipped" ? "skipped (not needed)" : "not run"}${c.state === "unavailable" ? ` (${plainCause(c.note)})` : ""}.`, evidence: [`check:${c.kind}`] });
  }

  // How clear the PRD was: the plan's own record of what it had to assume, found unclear, or asked.
  const brief = run.plan?.brief;
  for (const q of brief?.questions ?? []) prd.push({ kind: "open_question", text: `The plan asked: ${q}`, evidence: ["prd"] });
  for (const a of brief?.ambiguities ?? []) prd.push({ kind: "observed", text: `Unclear in the PRD: ${a}`, evidence: ["prd"] });
  for (const a of (brief?.assumptions ?? []).slice(0, 4)) prd.push({ kind: "interpretation", text: `FlowCode assumed: ${a}`, evidence: ["prd"] });
  for (const c of brief?.conflicts ?? []) prd.push({ kind: "observed", text: `Conflicting requirements: ${c}`, evidence: ["prd"] });

  const proposals = backlog.filter((b) => b.relatedRuns.includes(runId)).map((b) => ({ id: b.id, name: b.name, status: b.status }));
  for (const p of proposals) next.push({ kind: p.status === "verified" ? "verified" : "interpretation", text: `${p.status === "verified" ? "Confirmed improvement" : "Proposed improvement"}: ${p.name}`, evidence: [`improvement:${p.id}`] });
  for (const t of tasks.filter((x) => x.status === "blocked")) next.push({ kind: "interpretation", text: `Decide on "${t.title}": retry it, undo it, or change the request.`, evidence: [`step:${t.id}`] });
  if ((brief?.ambiguities?.length ?? 0) + (brief?.questions?.length ?? 0) > 0) next.push({ kind: "interpretation", text: "Answer the open PRD questions above before the next build.", evidence: ["prd"] });
  if (!next.length) next.push({ kind: "observed", text: "No new improvement identified.", evidence: [] });

  let time: JournalEntry["time"] = { measured: false, phases: [] };
  try {
    const p = runPerformance(app, runId);
    time = { measured: true, phases: p.phases.map((x) => ({ phase: x.phase, minutes: min(x.ms) ?? 0 })), waitingMinutes: min(p.waitingMs), totalMinutes: min(p.elapsedMs) };
  } catch {
    // Not measured.
  }

  return {
    runId,
    createdAt: run.createdAt,
    status: run.status,
    asked: run.objective.replace(/^#+\s*/gm, "").split(/\r?\n/).map((l) => l.trim()).find(Boolean)?.slice(0, 300) ?? "",
    contributions: [...roles.entries()].map(([r, v]) => ({ role: r, models: [...v.models], calls: v.calls, steps: v.steps, stepsPassed: v.stepsPassed })).sort((a, b) => b.calls - a.calls),
    worked,
    wentWrong,
    repaired,
    incomplete,
    checked,
    notChecked,
    time,
    prd,
    next,
    proposals,
  };
}

export function projectJournal(app: App, projectId: string, limit = 10): Journal {
  const project = app.store.projects.require(projectId);
  const runs = app.store.runs.where("project_id = ? ORDER BY created_at DESC LIMIT ?", projectId, limit);
  return { projectId, projectName: project.name.replace(/\s+/g, " "), entries: runs.map((r) => journalEntry(app, r.id)) };
}

/**
 * A question about one run, answered from its journal entry only (local model, low temperature). Quoted names that
 * aren't in the entry make the answer fall back to the entry's own statements.
 */
export async function askJournal(app: App, projectId: string, runId: string, question: string): Promise<{ answer: string; source: "model" | "records"; evidence: string[] }> {
  const run = app.store.runs.require(runId);
  if (run.projectId !== projectId) throw new Error("That run belongs to another project.");
  const entry = journalEntry(app, runId);
  const facts = JSON.stringify(entry);
  const fallback = () => {
    const q = question.toLowerCase();
    const pick = /long|slow|time/.test(q) ? (entry.time.measured ? [`Elapsed ${entry.time.totalMinutes} min, of which waiting for you ${entry.time.waitingMinutes} min. Phases: ${entry.time.phases.map((p) => `${p.phase} ${p.minutes} min`).join(", ")}.`] : ["Time wasn't measured for this run."]) : /fail|wrong|stop|cause/.test(q) ? entry.wentWrong.map((s) => s.text) : /verif|check/.test(q) ? [...entry.notChecked, ...entry.checked].map((s) => s.text) : /prd|unclear/.test(q) ? entry.prd.map((s) => s.text) : /contribut|agent|design/.test(q) ? entry.contributions.map((c) => `${c.role}: ${c.calls} model calls${c.steps ? `, ${c.stepsPassed}/${c.steps} steps passed` : ""} (${c.models.join(", ") || "no model recorded"})`) : entry.next.map((s) => s.text);
    return { answer: pick.length ? pick.join("\n") : "The records for this run don't cover that.", source: "records" as const, evidence: [] };
  };
  try {
    const roles = ["documenter", "planner"] as const;
    const r = roles.find((x) => !app.router.assignmentFor(x).providerId?.startsWith("hosted")) ?? "documenter";
    const base = app.router.assignmentFor(r);
    const assignment = base.providerId?.startsWith("hosted") ? { ...base, providerId: "ollama" } : base;
    const res = await app.router.chat({ role: r, projectId }, { ...assignment, temperature: 0.1 }, {
      messages: [
        { role: "system", content: "Answer a question about one FlowCode build using ONLY the JOURNAL below. Plain words, 2–5 sentences. Say what was observed versus suspected. If the journal doesn't cover it, say so. Never invent steps, causes, times or agents. Return JSON {\"answer\": string}." },
        { role: "user", content: `Question: ${question}\n\nJOURNAL:\n${untrusted("journal", facts)}` },
      ],
      format: { type: "object", properties: { answer: { type: "string" } }, required: ["answer"] },
      timeoutMs: 90_000,
    });
    const answer = (JSON.parse(res.content) as { answer?: string }).answer?.trim();
    const quoted = [...(answer ?? "").matchAll(/["“]([^"”]{4,80})["”]/g)].map((m) => m[1].toLowerCase());
    if (answer && quoted.every((q) => facts.toLowerCase().includes(q))) return { answer: answer.slice(0, 1500), source: "model", evidence: [] };
  } catch {
    // Model unavailable: answer from the records.
  }
  return fallback();
}
