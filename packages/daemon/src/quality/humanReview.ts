/**
 * The human review gate. A prototype build whose checks pass is "ready for your review", never done: the person opens
 * each page and each user journey, writes notes (kept as drafts until they decide), and approves it or requests
 * changes. Submitting requests starts one follow-up build scoped to the pages and journeys they named; when it
 * finishes, the build is ready for another look. A page's approval is bound to the version they saw: if its files
 * change afterwards, the approval is withdrawn and the page needs looking at again. Sign-off is the person's click,
 * only once every page and journey is approved, and records the version and checkpoint it applies to. Nothing here is
 * ever decided automatically.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ReviewState, Run } from "@flowcode/contracts";
import type { App } from "../app.js";

/** What the review needs: the store, the projects (for the files) and the orchestrator (for a follow-up build). */
export type ReviewDeps = Pick<App, "store" | "projects" | "orchestrator">;
import { experienceKey, type ExperienceMap } from "../orchestrator/experienceMap.js";
import { screenBriefKey, type ScreenBrief } from "../orchestrator/screenBrief.js";
import { screenPlanKey, type ScreenPlan } from "../orchestrator/screenPlan.js";

export type ReviewDecision = "pending" | "approved" | "changes_requested";
/** What happened to a change request: written, being built, built (waiting for the person's look), confirmed. */
export type FeedbackStatus = "open" | "in_progress" | "addressed" | "confirmed";

export interface ReviewItem {
  id: string;
  kind: "page" | "workflow";
  name: string;
  purpose: string;
  /** The page's address in the app (#/id), or the journey's entry page. */
  route?: string;
  /** For a journey: its steps, as the person reads them. */
  steps?: string[];
  files: string[];
  decision: ReviewDecision;
  /** The note sent with the decision. */
  note: string;
  /** A note being written, not sent yet. */
  draft: string;
  decidedAt?: string;
  /** The review version the decision was made on. */
  decidedVersion?: number;
  /** Hash of the item's files when it was approved; a change withdraws the approval. */
  approvedHash?: string;
  /** Why an earlier approval no longer stands. */
  invalidated?: string;
  feedback?: FeedbackStatus;
  history: Array<{ at: string; version: number; decision: ReviewDecision; note: string }>;
}

export interface RunReview {
  runId: string;
  projectId: string;
  state: ReviewState;
  /** 1 for the build itself, +1 for each follow-up build from the review. */
  version: number;
  /** The checkpoint this version is (restore it to get back exactly what was reviewed). */
  checkpointId?: string;
  createdAt: string;
  updatedAt: string;
  items: ReviewItem[];
  rounds: Array<{ at: string; version: number; followUpRunId: string; requests: Array<{ item: string; note: string }>; outcome?: string }>;
  signedOff?: { at: string; version: number; checkpointId?: string };
}

export const humanReviewKey = (runId: string) => `humanReview:${runId}`;

const now = () => new Date().toISOString();

function hashFiles(root: string, files: string[]): string {
  const h = crypto.createHash("sha1");
  for (const f of [...files].sort()) {
    h.update(f);
    try {
      h.update(fs.readFileSync(path.join(root, f)));
    } catch {
      h.update("(missing)");
    }
  }
  return h.digest("hex").slice(0, 16);
}

/** The section files a page imports (src/sections/X), so a change to a part on the page counts as a change to it. */
function pageFiles(root: string, file: string): string[] {
  let src = "";
  try {
    src = fs.readFileSync(path.join(root, file), "utf8");
  } catch {
    return [file];
  }
  const parts = [...src.matchAll(/from\s+["']\.\.\/sections\/([A-Za-z0-9_-]+)["']/g)].map((m) => `src/sections/${m[1]}.tsx`).filter((f) => fs.existsSync(path.join(root, f)));
  return [file, ...parts];
}

/** Whether a run is a prototype build the person reviews (it planned pages). */
export function needsHumanReview(app: Pick<ReviewDeps, "store">, run: Run): boolean {
  return !!app.store.getSetting<ScreenPlan | null>(screenPlanKey(run.id), null)?.screens.length;
}

export function getReview(app: Pick<ReviewDeps, "store">, runId: string): RunReview | undefined {
  return app.store.getSetting<RunReview | null>(humanReviewKey(runId), null) ?? undefined;
}

function save(app: ReviewDeps, review: RunReview): RunReview {
  const next = { ...review, updatedAt: now() };
  app.store.setSetting(humanReviewKey(review.runId), next);
  const run = app.store.runs.get(review.runId);
  if (run && run.review !== next.state) app.store.runs.upsert({ ...run, review: next.state });
  return next;
}

/** Opens the review when the build's checks pass: one item per planned page and per user journey. */
export function openReview(app: ReviewDeps, run: Run): RunReview | undefined {
  const plan = app.store.getSetting<ScreenPlan | null>(screenPlanKey(run.id), null);
  if (!plan?.screens.length) return undefined;
  const root = app.projects.jail(app.store.projects.require(run.projectId)).root;
  const briefs = app.store.getSetting<ScreenBrief[]>(screenBriefKey(run.id), []);
  const map = app.store.getSetting<ExperienceMap | null>(experienceKey(run.id), null);
  const pages: ReviewItem[] = plan.screens.map((s) => {
    const b = briefs.find((x) => x.screen === s.label);
    return { id: `page:${s.id}`, kind: "page", name: s.label, purpose: b?.goal ? `${b.who ? `${b.who}: ` : ""}${b.goal}` : s.purpose, route: `#/${s.id}`, files: pageFiles(root, s.file), decision: "pending", note: "", draft: "", history: [] };
  });
  const flows: ReviewItem[] = (map?.workflows ?? []).map((w) => {
    const screens = [...new Set([w.entry, ...w.steps.map((x) => x.screen)])];
    const ids = screens.map((n) => plan.screens.find((s) => s.label === n)).filter((s) => !!s);
    return {
      id: `workflow:${w.id}`,
      kind: "workflow",
      name: w.name,
      purpose: `${w.role ? `${w.role}: ` : ""}${w.success || w.name}`,
      route: ids[0] ? `#/${ids[0].id}` : undefined,
      steps: w.steps.map((x) => `${x.screen}: ${x.action} → ${x.result}`),
      files: [...new Set(ids.flatMap((s) => pageFiles(root, s.file)))],
      decision: "pending",
      note: "",
      draft: "",
      history: [],
    };
  });
  const review: RunReview = { runId: run.id, projectId: run.projectId, state: "ready_for_review", version: 1, checkpointId: run.safeCheckpointId, createdAt: now(), updatedAt: now(), items: [...pages, ...flows], rounds: [] };
  return save(app, review);
}

/**
 * The review as it stands now: any approved page or journey whose files changed since the approval goes back to
 * waiting for the person, with the reason. Called whenever the review is read.
 */
export function refreshReview(app: ReviewDeps, runId: string): RunReview | undefined {
  const review = getReview(app, runId);
  if (!review || review.state === "signed_off") return review;
  const root = app.projects.jail(app.store.projects.require(review.projectId)).root;
  let changed = false;
  const items = review.items.map((i) => {
    if (i.decision !== "approved" || !i.approvedHash || hashFiles(root, i.files) === i.approvedHash) return i;
    changed = true;
    return { ...i, decision: "pending" as const, approvedHash: undefined, invalidated: `Changed after you approved it on version ${i.decidedVersion ?? review.version}: please look again.` };
  });
  return changed ? save(app, { ...review, items }) : review;
}

/** Saves a draft note, or decides one page or journey (a change request needs a note saying what to change). */
export function decideItem(app: ReviewDeps, runId: string, itemId: string, input: { draft?: string; decision?: ReviewDecision; note?: string }): RunReview {
  const review = refreshReview(app, runId);
  if (!review) throw new Error("This build has no review");
  if (review.state === "signed_off") throw new Error("This build is signed off; start a change from the chat instead");
  if (review.state === "updating") throw new Error("FlowCode is updating the app from your last review; you can review again when it's done");
  const item = review.items.find((i) => i.id === itemId);
  if (!item) throw new Error("No such page or journey in this review");
  const root = app.projects.jail(app.store.projects.require(review.projectId)).root;
  let next: ReviewItem = { ...item };
  if (input.draft !== undefined) next.draft = input.draft.slice(0, 4000);
  if (input.decision && input.decision !== "pending") {
    const note = (input.note ?? next.draft).trim().slice(0, 4000);
    if (input.decision === "changes_requested" && !note) throw new Error("Say what should change before requesting changes");
    next = {
      ...next,
      decision: input.decision,
      note,
      draft: "",
      decidedAt: now(),
      decidedVersion: review.version,
      approvedHash: input.decision === "approved" ? hashFiles(root, item.files) : undefined,
      invalidated: undefined,
      feedback: input.decision === "changes_requested" ? "open" : item.feedback === "addressed" ? "confirmed" : item.feedback,
      history: [...item.history, { at: now(), version: review.version, decision: input.decision, note }],
    };
  } else if (input.decision === "pending") {
    next = { ...next, decision: "pending", approvedHash: undefined };
  }
  const items = review.items.map((i) => (i.id === itemId ? next : i));
  const anyChanges = items.some((i) => i.decision === "changes_requested");
  return save(app, { ...review, items, state: anyChanges ? "changes_requested" : review.version > 1 ? "awaiting_rereview" : "ready_for_review" });
}

/** The follow-up build's request: only the pages and journeys the person asked to change, with their words. */
export function changeRequestObjective(review: RunReview): string {
  const asks = review.items.filter((i) => i.decision === "changes_requested");
  return [
    `Changes from the review of version ${review.version} of this prototype. Change only what is asked, on the pages and journeys named; keep every approved page as it is.`,
    ...asks.map((i) => `## ${i.kind === "page" ? "Page" : "User journey"}: ${i.name}${i.route ? ` (${i.route})` : ""}\nFiles: ${i.files.join(", ")}\n${i.steps?.length ? `Steps: ${i.steps.join("; ")}\n` : ""}Requested change: ${i.note}`),
  ].join("\n\n");
}

/** Sends the change requests: one follow-up build scoped to them. Every page and journey must be decided first. */
export function submitReview(app: ReviewDeps, runId: string): { review: RunReview; followUp: Run } {
  const review = refreshReview(app, runId);
  if (!review) throw new Error("This build has no review");
  if (review.state === "updating") throw new Error("A follow-up build from this review is already running");
  const undecided = review.items.filter((i) => i.decision === "pending");
  if (undecided.length) throw new Error(`Decide every page and journey first (${undecided.length} left: ${undecided.slice(0, 4).map((i) => i.name).join(", ")})`);
  const asks = review.items.filter((i) => i.decision === "changes_requested");
  if (!asks.length) throw new Error("Nothing to change: everything is approved, so sign off instead");
  const followUp = app.orchestrator.createRun({ projectId: review.projectId, objective: changeRequestObjective(review), constraints: ["Change only the files of the pages and journeys named in the request."], attachedKnowledgeIds: [], parentRunId: review.runId, kind: "iterate", origin: "you" });
  const items = review.items.map((i) => (i.decision === "changes_requested" ? { ...i, feedback: "in_progress" as const } : i));
  const next = save(app, { ...review, items, state: "updating", rounds: [...review.rounds, { at: now(), version: review.version, followUpRunId: followUp.id, requests: asks.map((i) => ({ item: i.name, note: i.note })) }] });
  void app.orchestrator.plan(followUp.id).catch(() => undefined);
  return { review: next, followUp };
}

/**
 * A follow-up build from a review finished: the reviewed build is ready for another look at the new version. The
 * pages and journeys that had change requests wait for the person again; approvals of pages whose files changed are
 * withdrawn by refreshReview. A follow-up that didn't finish sends the review back to "changes requested".
 */
export function followUpFinished(app: ReviewDeps, run: Run, finished: boolean): RunReview | undefined {
  if (!run.parentRunId) return undefined;
  const review = getReview(app, run.parentRunId);
  const round = review?.rounds.find((r) => r.followUpRunId === run.id);
  if (!review || !round || review.state !== "updating") return undefined;
  if (!finished) {
    const rounds = review.rounds.map((r) => (r === round ? { ...r, outcome: `The follow-up build stopped (${run.status}); your requests are kept` } : r));
    return save(app, { ...review, rounds, state: "changes_requested", items: review.items.map((i) => (i.feedback === "in_progress" ? { ...i, feedback: "open" as const } : i)) });
  }
  const items = review.items.map((i) => (i.decision === "changes_requested" ? { ...i, decision: "pending" as const, feedback: "addressed" as const, invalidated: undefined } : i));
  const rounds = review.rounds.map((r) => (r === round ? { ...r, outcome: "Built; waiting for your look" } : r));
  save(app, { ...review, items, rounds, state: "awaiting_rereview", version: review.version + 1, checkpointId: run.safeCheckpointId ?? review.checkpointId });
  return refreshReview(app, review.runId);
}

/** The person's sign-off: only when every page and journey is approved on the current version. */
export function signOff(app: ReviewDeps, runId: string): RunReview {
  const review = refreshReview(app, runId);
  if (!review) throw new Error("This build has no review");
  if (review.state === "signed_off") return review;
  if (review.state === "updating") throw new Error("FlowCode is still updating the app from your review");
  const open = review.items.filter((i) => i.decision !== "approved");
  if (open.length) throw new Error(`Approve every page and journey before signing off (${open.length} not approved: ${open.slice(0, 4).map((i) => i.name).join(", ")})`);
  return save(app, { ...review, state: "signed_off", signedOff: { at: now(), version: review.version, checkpointId: review.checkpointId }, items: review.items.map((i) => (i.feedback === "addressed" ? { ...i, feedback: "confirmed" as const } : i)) });
}
