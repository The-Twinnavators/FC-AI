/**
 * "Why it stopped": every build that ends blocked, failed or cancelled gets an explanation and a look for a way
 * forward, instead of a bare status. It says who or what stopped it and why, where it got to, whether another build
 * replaced it, the troubleshooter's diagnosis of the step it stopped on, and research: similar steps that passed
 * before, related notes in Knowledge and, when the project allows external research, web results for the error.
 * Built automatically when a build stops (and on demand), and cached until the build changes.
 */
import type { Run, Task } from "@flowcode/contracts";
import type { App } from "../app.js";
import { troubleshoot, type Diagnosis } from "./troubleshoot.js";

export interface StopReport {
  runId: string;
  status: string;
  /** Plain sentence: who or what stopped it, and why. */
  stoppedBecause: string;
  progress: { done: number; total: number };
  stoppedAt?: { taskId: string; title: string; reason?: string; attempts: number };
  /** A build that carries on this one's work (a resumed original, or FlowCode's own retry). */
  carriedOnBy?: { runId: string; title: string; status: string; why: string };
  diagnosis?: Diagnosis;
  research: {
    similarSteps: Array<{ title: string; project: string; attempts: number }>;
    knowledge: Array<{ id: string; title: string; snippet: string }>;
    web: Array<{ title: string; url: string; snippet: string }>;
    webSkipped?: string;
  };
  next: Array<{ kind: "open_run" | "resume" | "troubleshoot" | "follow_up"; label: string; detail: string; runId?: string; taskId?: string; text?: string }>;
  builtAt: string;
}

const STOPPED = ["blocked", "failed", "cancelled"];
const ACTIVE = ["draft", "running", "verifying", "recovering", "awaiting_approval"];
const words = (s: string) => new Set(s.toLowerCase().match(/[a-z]{4,}/g) ?? []);
const firstLine = (s: string) => s.split("\n").map((l) => l.trim()).find(Boolean) ?? "";

function stoppedBecause(run: Run, carried?: StopReport["carriedOnBy"]): string {
  const reason = (run.statusReason ?? "").trim();
  if (run.status === "cancelled") {
    if (carried) return `This build was stopped because ${carried.why}`;
    if (/^run cancelled by user$/i.test(reason) || !reason) return "This build was stopped by request. No reason was recorded at the time.";
    return `This build was stopped: ${reason.replace(/\.$/, "")}.`;
  }
  if (run.status === "failed") return `This build failed: ${reason || "an unexpected error stopped it"}.`;
  return `This build is waiting for help: ${reason || "a step couldn't be finished after several tries"}.`;
}

/** Where the build got stuck: the blocked step, else the step that was working when it stopped. */
function stuckStep(tasks: Task[]): Task | undefined {
  return tasks.find((t) => t.status === "blocked" || t.status === "failed") ?? tasks.find((t) => t.status === "attempted" || t.status === "running") ?? tasks.find((t) => t.status === "pending" && t.attempts > 0);
}

function carriedOn(app: App, run: Run): StopReport["carriedOnBy"] {
  const later = app.store.runs.where("project_id = ? ORDER BY created_at DESC LIMIT 30", run.projectId).filter((r) => r.id !== run.id);
  const title = (r: Run) => firstLine(r.objective).replace(/^#+\s*/, "").slice(0, 120);
  // FlowCode's own retry of this build, or this build was a retry and its original carried on.
  const parent = run.parentRunId ? later.find((r) => r.id === run.parentRunId) : undefined;
  if (parent && (ACTIVE.includes(parent.status) || parent.status.startsWith("done")))
    return { runId: parent.id, title: title(parent), status: parent.status, why: `the original build ("${title(parent)}") was resumed with fixes and carries on this work. Follow that build instead.` };
  const child = later.find((r) => r.parentRunId === run.id && (ACTIVE.includes(r.status) || r.status.startsWith("done")));
  if (child) return { runId: child.id, title: title(child), status: child.status, why: `a newer request ("${title(child)}") continues this work.` };
  const newer = later.find((r) => r.createdAt > run.createdAt && ACTIVE.includes(r.status));
  if (newer && run.status === "cancelled") return { runId: newer.id, title: title(newer), status: newer.status, why: `a newer build ("${title(newer)}") is working on this project now.` };
  return undefined;
}

export async function buildStopReport(app: App, runId: string, opts: { explain?: boolean; web?: boolean } = {}): Promise<StopReport | undefined> {
  const run = app.store.runs.require(runId);
  if (!STOPPED.includes(run.status)) return undefined;
  const cacheKey = `stopReport:${runId}`;
  const cached = app.store.getSetting<{ stamp: string; report: StopReport } | undefined>(cacheKey, undefined);
  const stamp = `${run.status}|${run.completedAt ?? ""}|${run.statusReason ?? ""}`;
  if (cached && cached.stamp === stamp && (!opts.explain || cached.report.diagnosis?.explanation || cached.report.diagnosis === undefined)) {
    // Refresh the "carried on by" part: the other build may have moved on.
    return { ...cached.report, carriedOnBy: carriedOn(app, run) };
  }
  const project = app.store.projects.require(run.projectId);
  const tasks = app.store.tasks.where("run_id = ? ORDER BY ordinal ASC", runId);
  const done = tasks.filter((t) => t.status === "verified").length;
  const counted = tasks.filter((t) => t.status !== "skipped").length;
  const stuck = stuckStep(tasks);
  const carried = carriedOn(app, run);

  // Diagnosis of the step it stopped on (or the run as a whole). Skipped when another build already carries on.
  let diagnosis: Diagnosis | undefined;
  if (!carried && (stuck || run.status !== "cancelled")) diagnosis = await troubleshoot(app, runId, stuck?.id, opts.explain ?? false).catch(() => undefined);

  // Research 1: similar steps that passed in other builds.
  const similarSteps: StopReport["research"]["similarSteps"] = [];
  if (stuck) {
    const mine = words(stuck.title);
    const projects = new Map(app.store.projects.list("updated_at DESC").map((p) => [p.id, p.name]));
    for (const t of app.store.tasks.where("run_id != ? AND status = 'verified' ORDER BY rowid DESC LIMIT 3000", runId)) {
      const theirs = words(t.title);
      const shared = [...mine].filter((w) => theirs.has(w)).length;
      if (mine.size && shared / mine.size >= 0.6) {
        const r = app.store.runs.get(t.runId);
        similarSteps.push({ title: t.title, project: (r && projects.get(r.projectId)) ?? "another project", attempts: t.attempts });
        if (similarSteps.length >= 3) break;
      }
    }
  }
  // Research 2: related notes and skills in Knowledge.
  const query = [stuck?.title, firstLine(stuck?.blocker?.reason ?? run.statusReason ?? "")].filter(Boolean).join(" ").slice(0, 200);
  const knowledge = query
    ? app.knowledge
        .search(query, { projectId: project.id, kinds: ["knowledge", "skill"], limit: 4 })
        .map((k) => ({ id: k.id, title: k.title, snippet: k.snippet.replace(/<[^>]+>/g, "").slice(0, 200) }))
    : [];
  // Research 3: the web, only when the project allows external research (search words leave the machine).
  const web: StopReport["research"]["web"] = [];
  let webSkipped: string | undefined;
  const errorLine = [diagnosis?.causes[0]?.evidence, stuck?.blocker?.reason, run.statusReason].map((s) => firstLine(s ?? "")).find((s) => s.length > 12);
  if (!project.settings.allowExternalResearch) webSkipped = "Web search is off for this project (Project settings → Allow external research).";
  else if (!errorLine || carried) webSkipped = carried ? "Not needed: another build carries on this work." : "No specific error to search for.";
  else if (opts.web !== false) {
    const q = `${errorLine.replace(/[A-Z]:\\[^\s]+|\/[\w./-]+/g, "").slice(0, 120)} react typescript vite`;
    for (const adapter of app.research.adapters) {
      try {
        const hits = await adapter.search(q);
        if (hits.length) {
          web.push(...hits.slice(0, 3).map((h) => ({ title: h.title, url: h.url, snippet: h.snippet.replace(/<[^>]+>/g, "").slice(0, 220) })));
          break;
        }
      } catch {
        /* try the next source */
      }
    }
    if (!web.length) webSkipped = "The web search found nothing useful for this error.";
  }

  const next: StopReport["next"] = [];
  if (carried) next.push({ kind: "open_run", runId: carried.runId, label: "Follow the build that carries on", detail: `"${carried.title}" is ${carried.status.replace(/_/g, " ")}.` });
  else {
    if (run.status === "blocked" && stuck) next.push({ kind: "troubleshoot", taskId: stuck.id, label: "Troubleshoot this step", detail: "See the cause and apply a fix: retry with guidance, re-run a check or undo the step." });
    if (run.status === "blocked") next.push({ kind: "resume", label: "Resume", detail: "Try the stuck steps again with what FlowCode has learned, keeping the finished steps." });
    if (run.status !== "blocked") next.push({ kind: "follow_up", label: "Start it again as a follow-up", detail: "A new request that keeps the finished steps and continues from here.", text: `Continue this build from where it stopped${stuck ? ` ("${stuck.title}")` : ""}. ${firstLine(run.objective).slice(0, 300)}` });
  }

  const report: StopReport = {
    runId,
    status: run.status,
    stoppedBecause: stoppedBecause(run, carried),
    progress: { done, total: counted },
    stoppedAt: stuck ? { taskId: stuck.id, title: stuck.title, reason: stuck.blocker?.reason, attempts: stuck.attempts } : undefined,
    carriedOnBy: carried,
    diagnosis,
    research: { similarSteps, knowledge, web, webSkipped },
    next,
    builtAt: new Date().toISOString(),
  };
  app.store.setSetting(cacheKey, { stamp, report });
  return report;
}

/** When a build stops, look into why straight away (in the background) and say so in its activity. */
export function watchForStops(app: App): () => void {
  return app.bus.subscribe((e) => {
    if (e.type !== "run.status_changed" || !e.runId) return;
    const to = (e.data as { to?: string } | undefined)?.to;
    if (!to || !STOPPED.includes(to)) return;
    const runId = e.runId;
    setTimeout(() => {
      void buildStopReport(app, runId, { explain: true })
        .then((r) => {
          if (!r) return;
          const found = r.carriedOnBy ? `another build carries on this work ("${r.carriedOnBy.title}")` : r.diagnosis ? r.diagnosis.summary : "no clear cause yet";
          app.bus.emit({ type: "recovery.action", projectId: app.store.runs.require(runId).projectId, runId, message: `Looked into why this build stopped: ${found}. See "Why it stopped" in Details.` });
        })
        .catch(() => undefined);
    }, 2000);
  });
}
