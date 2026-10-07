/**
 * Copilot status answers come from the build the user means, right now: not from earlier chat, not from another
 * project, and never handing the person work FlowCode does itself. Checks that couldn't run are never "passed".
 */
import { describe, expect, it, vi } from "vitest";
import type { App } from "../src/app.js";
import { askCopilot, scopedHistory } from "../src/api/copilot.js";
import { getCopilotProfile, setAddress } from "../src/api/copilotProfile.js";
import { isStatusQuestion } from "../src/api/runFacts.js";
import { creditAdvice, plainBlocker, plainCheckSummary } from "../src/quality/blockerText.js";
import { checkState, verificationCompleteness } from "../src/quality/checkState.js";
import { buildRunReview, getRunReview, IMPROVEMENTS_KEY, recordRunReview, type Improvement } from "../src/quality/runReview.js";
import { troubleshoot } from "../src/quality/troubleshoot.js";
import { makeApp, makeProject } from "./helpers.js";

const now = () => new Date().toISOString();

function project(app: App, name: string) {
  const { project } = makeProject(app, { "README.md": "# demo\n" });
  app.store.projects.upsert({ ...project, name });
  return app.store.projects.require(project.id);
}
function run(app: App, projectId: string, objective: string, status: string, extra: Record<string, unknown> = {}) {
  const r = app.orchestrator.createRun({ projectId, objective, constraints: [], attachedKnowledgeIds: [] });
  app.store.runs.upsert({ ...app.store.runs.require(r.id), status: status as never, ...extra });
  return app.store.runs.require(r.id);
}
function task(app: App, runId: string, title: string, status: string, ordinal: number, blocker?: { reason: string; category: string; nextAction: string }, attempts = 1) {
  app.store.tasks.upsert({ id: `tsk_${runId.slice(-6)}_${ordinal}`, runId, title, objective: title, status: status as never, dependsOn: [], expectedPaths: [], actualPaths: [], acceptanceCriteria: [], validationPlan: { kinds: [] }, role: "coder", ordinal, attempts, ...(blocker ? { blocker: { ...blocker, evidenceRefs: [] } as never } : {}) });
}
function check(app: App, runId: string, kind: string, status: string, summary: string, taskId?: string) {
  app.store.checks.upsert({ id: `chk_${runId.slice(-6)}_${kind}_${taskId ?? ""}`, runId, kind: kind as never, required: true, status: status as never, evidenceRefs: [], summary, updatedAt: now(), ...(taskId ? { taskId } : {}) });
}
/** The two builds from the reported mix-up: No BIO & GMO (finished, visual review couldn't run) and the Calculator. */
function fixtures(app: App) {
  const bio = project(app, "No BIO & GMO");
  const calc = project(app, "Calculator app");
  const bioRun = run(app, bio.id, "Two small fixes to the No BIO & GMO app", "done", { completedAt: now() });
  task(app, bioRun.id, "Pacific Foods photo", "verified", 0);
  task(app, bioRun.id, "Hero backdrops", "verified", 1);
  check(app, bioRun.id, "tests", "passed", "npm run test exited 0");
  check(app, bioRun.id, "design_qa", "passed", "0 deterministic finding(s)");
  check(app, bioRun.id, "visual_critique", "skipped", "Critique failed: Error: HTTP 400: invalid_request_error: Your credit balance is too low to access the Anthropic API.");
  const calcRun = run(app, calc.id, "Calculator", "blocked");
  task(app, calcRun.id, "Clear, accessible calculator keypad", "blocked", 0, { reason: "Acceptance criteria not met after 3 attempts: tests failed", category: "verification", nextAction: "Review the diff and failing evidence, adjust the request or approve a revised approach, then retry the task." }, 3);
  check(app, calcRun.id, "tests", "failed", "src/acceptance/clear-accessible-calculator-keypad-respo.test.tsx doesn't exist yet: write the acceptance tests first", `tsk_${calcRun.id.slice(-6)}_0`);
  return { bio, calc, bioRun, calcRun };
}
/** The model returns whatever we give it. */
function model(app: App, answer: string | Error) {
  return vi.spyOn(app.router, "chat").mockImplementation(async () => {
    if (answer instanceof Error) throw answer;
    return { content: JSON.stringify({ answer }) } as never;
  });
}

describe("Copilot: grounded status answers", () => {
  it("recognises status questions", () => {
    for (const q of ["What happening with this build", "What's the build doing right now?", "What happened to the build?", "why did it stop?", "is it done yet?", "how's the calculator doing?"]) expect(isStatusQuestion(q), q).toBe(true);
    for (const q of ["Hi", "what's the difference between a promise and async/await?", "What does the vite.config.ts button do?"]) expect(isStatusQuestion(q), q).toBe(false);
  });

  it("answers about the build on screen even when earlier chat was about another build", async () => {
    const { app } = makeApp();
    const { bio, bioRun, calcRun } = fixtures(app);
    // The model repeats the stale Calculator answer: it must be rejected for naming the wrong project.
    model(app, "The Calculator app is on its third attempt at 'Clear, accessible calculator keypad'.");
    const history = [
      { role: "user" as const, content: "What happened to the build?", projectId: "x", runId: calcRun.id },
      { role: "assistant" as const, content: "The build stopped because 'Clear, accessible calculator keypad' is blocked. You'll need to write the tests first.", runId: calcRun.id },
    ];
    const a = await askCopilot(app, { question: "What happening with this build", route: `/projects/${bio.id}/runs/${bioRun.id}`, projectId: bio.id, runId: bioRun.id, history });
    expect(a.status?.runId).toBe(bioRun.id);
    expect(a.answer).toMatch(/No BIO & GMO/);
    expect(a.answer).not.toMatch(/calculator/i);
    expect(a.source).toBe("guide"); // the model's wording was thrown away
  });

  it("never reports a check that couldn't run as passed", async () => {
    const { app } = makeApp();
    const { bio, bioRun } = fixtures(app);
    model(app, new Error("offline"));
    const a = await askCopilot(app, { question: "is it done yet?", route: "/", projectId: bio.id, runId: bioRun.id, history: [] });
    expect(a.status?.verification).toBe("incomplete");
    expect(a.status?.checks.find((c) => c.kind === "visual_critique")?.state).toBe("unavailable");
    expect(a.answer).toMatch(/Not verified: the visual review couldn't run/);
    expect(a.answer).not.toMatch(/All its final checks ran and passed/);
  });

  it("resolves a project the user names, and says it did", async () => {
    const { app } = makeApp();
    const { bio, bioRun, calcRun } = fixtures(app);
    model(app, new Error("offline"));
    const a = await askCopilot(app, { question: "how's the calculator doing?", route: "/", projectId: bio.id, runId: bioRun.id, history: [] });
    expect(a.status?.runId).toBe(calcRun.id);
    expect(a.status?.resolvedBy).toBe("named");
    expect(a.answer).toMatch(/latest build of Calculator app/);
  });

  it("doesn't hand the person FlowCode's work (writing tests), even if the model says so", async () => {
    const { app } = makeApp();
    const { calc, calcRun } = fixtures(app);
    model(app, "The tests are failing because the file doesn't exist yet. You need to write the acceptance tests first.");
    const a = await askCopilot(app, { question: "why is my build stuck?", route: "/", projectId: calc.id, runId: calcRun.id, history: [] });
    expect(a.answer).not.toMatch(/you need to write/i);
    expect(a.answer).toMatch(/FlowCode tried this step after 3 tries and stopped: its tests still fail/);
    expect(a.status?.steps.verified).toBe(0);
  });

  it("keeps a model answer that stays within the facts", async () => {
    const { app } = makeApp();
    const { bio, bioRun } = fixtures(app);
    model(app, "No BIO & GMO finished: both steps passed, but the visual review couldn't run, so the look wasn't checked.");
    const a = await askCopilot(app, { question: "What's the status of the build?", route: "/", projectId: bio.id, runId: bioRun.id, history: [] });
    expect(a.source).toBe("model");
    expect(a.answer).toMatch(/visual review couldn't run/);
  });

  it("says what it doesn't know when no build is in context", async () => {
    const { app } = makeApp();
    const spy = model(app, "Your build is going great!");
    const a = await askCopilot(app, { question: "What's happening with the build?", route: "/", history: [] });
    expect(a.answer).toMatch(/don't see a build/);
    expect(spy).not.toHaveBeenCalled();
  });

  it("sends back only history from the build on screen", () => {
    const h = scopedHistory({
      projectId: "p1",
      runId: "r1",
      history: [
        { role: "user", content: "legacy question" },
        { role: "assistant", content: "legacy answer about some build" },
        { role: "user", content: "about r2", runId: "r2", projectId: "p2" },
        { role: "assistant", content: "answer about r2", runId: "r2", projectId: "p2" },
        { role: "user", content: "about r1", runId: "r1", projectId: "p1" },
        { role: "assistant", content: "answer about r1", runId: "r1", projectId: "p1" },
      ],
    });
    expect(h.map((m) => m.content)).toEqual(["legacy question", "about r1", "answer about r1"]);
  });
});

describe("blockers and checks in plain language", () => {
  it("separates FlowCode's work from the person's decision and offers only supported actions", () => {
    const p = plainBlocker({ title: "Keypad", status: "blocked", attempts: 4, blocker: { reason: "Acceptance criteria not met after 4 attempts: agent outcome: no_action (Model replied with prose only and did not invoke a tool or report a structured blocker.)", category: "verification", evidenceRefs: [], nextAction: "Review the diff…" } })!;
    expect(p.explanation).toMatch(/the model kept answering in text instead of making the change/);
    expect(p.explanation).toMatch(/won't retry on its own/);
    expect(p.owner).toBe("user");
    expect(p.actions.map((a) => a.kind)).toEqual(["retry_step", "undo_step", "edit_request", "open_details"]);
  });

  it("only says FlowCode carries on when it really has (a split step)", () => {
    const p = plainBlocker({ title: "Design", status: "skipped", attempts: 0, blocker: { reason: "Split into 4 smaller steps", category: "prerequisite", evidenceRefs: [], nextAction: "The smaller steps continue the work." } })!;
    expect(p.owner).toBe("flowcode");
    expect(p.actions).toEqual([]);
  });

  it("names the provider that ran out of credit", () => {
    const p = plainBlocker({ title: "Tokens", status: "blocked", attempts: 1, blocker: { reason: "The cloud model's account has run out of credits (claude-sonnet-5-5). Nothing is wrong with the step's work.", category: "model", evidenceRefs: [], nextAction: "" } })!;
    expect(p.explanation).toMatch(/Anthropic/);
    expect(p.actions[0].kind).toBe("switch_local_coder");
    expect(creditAdvice("hosted-anthropic/claude-sonnet-5-5")).toMatch(/Anthropic/);
    expect(creditAdvice("hosted-anthropic/claude-sonnet-5-5")).not.toMatch(/OpenAI/);
  });

  it("logs a blocker category it can't map, and says so", () => {
    const { app } = makeApp();
    const p = plainBlocker({ title: "X", status: "blocked", attempts: 2, blocker: { reason: "something new", category: "unknown", evidenceRefs: [], nextAction: "" } }, app.store)!;
    expect(p.unmapped).toBe(true);
    expect(p.explanation).toMatch(/couldn't classify/);
    expect(app.store.getSetting<unknown[]>("blockers.unmapped", [])).toHaveLength(1);
  });

  it("rewords agent instructions in check summaries", () => {
    expect(plainCheckSummary("src/acceptance/a.test.tsx doesn't exist yet: write the acceptance tests first")).toBe("the acceptance test file src/acceptance/a.test.tsx hasn't been written yet (the step writes it)");
  });

  it("tells a check that wasn't needed from one that couldn't run", () => {
    expect(checkState({ status: "skipped", summary: "No preview for this project" })).toBe("skipped");
    expect(checkState({ status: "skipped", summary: "Critique failed: Error: HTTP 400: credit balance is too low" })).toBe("unavailable");
    expect(checkState({ status: "not_run", summary: "" })).toBe("not_run");
    expect(verificationCompleteness([{ kind: "tests", status: "passed", summary: "ok" }, { kind: "visual_critique", status: "skipped", summary: "Critique failed: HTTP 400" }])).toBe("incomplete");
    expect(verificationCompleteness([{ kind: "tests", status: "passed", summary: "ok" }])).toBe("complete");
  });

  it("finds the cause when planning stopped on exhausted credit", async () => {
    const { app } = makeApp();
    const p = project(app, "No BIO & GMO");
    const r = run(app, p.id, "Why did the run stop?", "blocked", { statusReason: "Planning blocked: quota_exhausted: Error: HTTP 429: You have no credits remaining." });
    const d = await troubleshoot(app, r.id, undefined, false);
    expect(d.summary).toMatch(/ran out of credit while planning/);
    expect(d.summary).not.toMatch(/No clear cause/);
  });
});

describe("copilot address", () => {
  it("uses no form of address until the user picks one", () => {
    const { app } = makeApp();
    expect(getCopilotProfile(app).address).toBe("");
    // An old profile that saved the former default "Sir" without the user choosing it.
    app.store.setSetting("copilot:profile", { address: "Sir", entries: [] });
    expect(getCopilotProfile(app).address).toBe("");
    setAddress(app, "Sir");
    expect(getCopilotProfile(app).address).toBe("Sir");
  });
});

describe("run review", () => {
  it("records what was verified, what couldn't be, and a concrete proposal", () => {
    const { app } = makeApp();
    const { bioRun } = fixtures(app);
    const review = recordRunReview(app, bioRun.id)!;
    expect(review.outcome).toMatchObject({ status: "done", finished: true, verifiedSteps: 2, totalSteps: 2, verification: "incomplete" });
    expect(review.limitations.join(" ")).toMatch(/visual review couldn't run/);
    expect(review.issues[0]).toMatchObject({ key: "check_unavailable:visual_critique", category: "verification", cause: { status: "confirmed" } });
    const backlog = app.store.getSetting<Improvement[]>(IMPROVEMENTS_KEY, []);
    expect(backlog).toHaveLength(1);
    expect(backlog[0]).toMatchObject({ status: "proposed", approvalRequired: true, relatedRuns: [bioRun.id] });
    expect(backlog[0].successMeasure).toBeTruthy();
    expect(backlog[0].validation).toBeTruthy();
    expect(getRunReview(app, bioRun.id)?.runId).toBe(bioRun.id);
  });

  it("says no new improvement when there is nothing to fix, and counts what wasn't measured as unmeasured", () => {
    const { app } = makeApp();
    const p = project(app, "Clean");
    const r = run(app, p.id, "# Add a footer\nmore context", "done", { completedAt: now() });
    task(app, r.id, "Footer", "verified", 0);
    check(app, r.id, "tests", "passed", "ok");
    const review = recordRunReview(app, r.id)!;
    expect(review.requested).toBe("Add a footer");
    expect(review.proposals).toEqual([]);
    expect(review.level).toBe("light");
    expect(review.measurements.modelMs).toBeUndefined(); // no model calls recorded: not measured, not zero
  });

  it("marks a recurring issue and links later runs to the same proposal", () => {
    const { app } = makeApp();
    const { bio, bioRun } = fixtures(app);
    recordRunReview(app, bioRun.id);
    const again = run(app, bio.id, "Polish", "done", { completedAt: now() });
    check(app, again.id, "visual_critique", "skipped", "Critique failed: credit balance is too low");
    const review = recordRunReview(app, again.id)!;
    expect(review.issues[0].recurrence).toBe(1);
    expect(review.level).toBe("detailed");
    const backlog = app.store.getSetting<Improvement[]>(IMPROVEMENTS_KEY, []);
    expect(backlog).toHaveLength(1);
    expect(backlog[0].relatedRuns).toEqual([bioRun.id, again.id]);
  });

  it("does not review a run that hasn't ended", () => {
    const { app } = makeApp();
    const p = project(app, "Busy");
    const r = run(app, p.id, "Work", "running");
    expect(recordRunReview(app, r.id)).toBeUndefined();
    expect(buildRunReview(app, r.id).outcome.verification).toBe("not_run");
  });
});

describe("finished, but not fully checked", () => {
  const t = { id: "t1", runId: "r1", title: "Step", objective: "Step", status: "verified" as const, dependsOn: [], expectedPaths: [], actualPaths: [], acceptanceCriteria: [], validationPlan: { kinds: [] }, role: "coder" as const, ordinal: 0, attempts: 1 };
  const c = (kind: string, status: string, summary: string) => ({ id: `c_${kind}`, runId: "r1", kind: kind as never, required: false, status: status as never, evidenceRefs: ["artifact:x"], summary, updatedAt: now() });

  it("is its own status when a check couldn't run", async () => {
    const { evaluateCompletionGate } = await import("../src/orchestrator/completionGate.js");
    const gate = evaluateCompletionGate({ tasks: [t as never], checks: [c("tests", "passed", "ok"), c("visual_critique", "skipped", "Critique failed: credit balance is too low")], requiredChecks: ["tests"], hasFinalReport: true, planApproved: true });
    expect(gate.status).toBe("done_unverified");
    expect(gate.unverified[0]).toMatch(/visual_critique couldn't run/);
  });

  it("stays done when a check was skipped because it wasn't needed", async () => {
    const { evaluateCompletionGate } = await import("../src/orchestrator/completionGate.js");
    const gate = evaluateCompletionGate({ tasks: [t as never], checks: [c("tests", "passed", "ok"), c("visual_critique", "skipped", "No screens to review")], requiredChecks: ["tests"], hasFinalReport: true, planApproved: true });
    expect(gate.status).toBe("done");
  });

  it("is labelled plainly and counts as finished", async () => {
    const { statusLabel, isFinishedRun, TERMINAL_RUN_STATUSES } = await import("@flowcode/contracts");
    expect(statusLabel("done_unverified")).toBe("Ready, not fully checked");
    expect(isFinishedRun("done_unverified")).toBe(true);
    expect(TERMINAL_RUN_STATUSES).toContain("done_unverified");
  });
});

describe("run review of a stopped build", () => {
  it("is made for a build that stopped needing a decision", () => {
    const { app } = makeApp();
    const { calcRun } = fixtures(app);
    const review = recordRunReview(app, calcRun.id)!;
    expect(review.outcome.status).toBe("blocked");
    expect(review.outcome.finished).toBe(false);
    expect(review.level).toBe("detailed");
    expect(review.limitations.join(" ")).toMatch(/Clear, accessible calculator keypad/);
  });
});
