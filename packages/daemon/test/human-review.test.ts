/**
 * The human review gate: a prototype build whose checks pass waits for the person, page by page and journey by
 * journey; change requests become one scoped follow-up build; approvals are bound to what was seen; sign-off is only
 * possible when everything is approved, and is never automatic.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runStatusLabel } from "@flowcode/contracts";
import { changeRequestObjective, decideItem, followUpFinished, getReview, openReview, refreshReview, signOff, submitReview } from "../src/quality/humanReview.js";
import { makeApp, makeProject } from "./helpers.js";

function setup() {
  const { app } = makeApp();
  const { project, ws } = makeProject(app, {
    "src/screens/ClassesScreen.tsx": 'import Hero from "../sections/Hero";\nexport default function ClassesScreen() { return <Hero />; }\n',
    "src/sections/Hero.tsx": "export default function Hero() { return null; }\n",
    "src/screens/ClassDetailScreen.tsx": "export default function ClassDetailScreen() { return null; }\n",
  });
  const run = app.orchestrator.createRun({ projectId: project.id, objective: "Classes app", constraints: [], attachedKnowledgeIds: [] });
  app.store.setSetting(`screenPlan:${run.id}`, {
    product: "Classes",
    screens: [
      { id: "classes", label: "Classes", component: "ClassesScreen", file: "src/screens/ClassesScreen.tsx", purpose: "Browse classes" },
      { id: "class-detail", label: "Class detail", component: "ClassDetailScreen", file: "src/screens/ClassDetailScreen.tsx", purpose: "One class" },
    ],
  });
  app.store.setSetting(`experienceMap:${run.id}`, { roles: [], data: [], permissions: [], workflows: [{ id: "w1", name: "Book a class", role: "Member", entry: "Classes", steps: [{ screen: "Classes", action: "Pick yoga", result: "Sees yoga" }, { screen: "Class detail", action: "Book", result: "Booked" }], success: "Booked", failure: "", recovery: "", requirementIds: [] }] });
  const done = app.store.runs.upsert({ ...app.store.runs.require(run.id), status: "done" });
  return { app, ws, run: done };
}

describe("the human review gate", () => {
  it("opens with every page and journey waiting for the person; the build reads as ready for review, not ready", () => {
    const { app, run } = setup();
    const review = openReview(app, run)!;
    expect(review.state).toBe("ready_for_review");
    expect(review.items.map((i) => [i.kind, i.name, i.decision])).toEqual([["page", "Classes", "pending"], ["page", "Class detail", "pending"], ["workflow", "Book a class", "pending"]]);
    // A page's files include the parts it imports, so a change to a part on the page counts.
    expect(review.items[0]!.files).toEqual(["src/screens/ClassesScreen.tsx", "src/sections/Hero.tsx"]);
    expect(review.items[2]!.route).toBe("#/classes");
    const saved = app.store.runs.require(run.id);
    expect(saved.review).toBe("ready_for_review");
    expect(runStatusLabel(saved)).toBe("Ready for your review");
  });

  it("keeps drafts, needs a note to request changes, and won't sign off or submit with anything undecided", () => {
    const { app, run } = setup();
    openReview(app, run);
    expect(decideItem(app, run.id, "page:classes", { draft: "Hero is too tall" }).items[0]!.draft).toBe("Hero is too tall");
    expect(() => decideItem(app, run.id, "page:class-detail", { decision: "changes_requested", note: " " })).toThrow(/Say what should change/);
    expect(() => signOff(app, run.id)).toThrow(/Approve every page and journey/);
    expect(() => submitReview(app, run.id)).toThrow(/Decide every page and journey first/);
    // The draft becomes the note when the decision is made without one.
    const r = decideItem(app, run.id, "page:classes", { decision: "changes_requested" });
    expect(r.items[0]).toEqual(expect.objectContaining({ decision: "changes_requested", note: "Hero is too tall", draft: "", feedback: "open", decidedVersion: 1 }));
    expect(r.state).toBe("changes_requested");
  });

  it("withdraws an approval when the page's files change afterwards", () => {
    const { app, run, ws } = setup();
    openReview(app, run);
    decideItem(app, run.id, "page:classes", { decision: "approved" });
    expect(refreshReview(app, run.id)!.items[0]!.decision).toBe("approved");
    fs.writeFileSync(path.join(ws, "src/sections/Hero.tsx"), "export default function Hero() { return <h1>New</h1>; }\n");
    const r = refreshReview(app, run.id)!;
    expect(r.items[0]!.decision).toBe("pending");
    expect(r.items[0]!.invalidated).toMatch(/Changed after you approved it on version 1/);
  });

  it("change requests become one follow-up build scoped to them; when it finishes the build is ready for another look", () => {
    const { app, run } = setup();
    openReview(app, run);
    decideItem(app, run.id, "page:classes", { decision: "approved" });
    decideItem(app, run.id, "page:class-detail", { decision: "changes_requested", note: "Show the teacher's name" });
    decideItem(app, run.id, "workflow:w1", { decision: "approved" });
    const objective = changeRequestObjective(getReview(app, run.id)!);
    expect(objective).toContain("## Page: Class detail (#/class-detail)");
    expect(objective).toContain("Requested change: Show the teacher's name");
    expect(objective).not.toContain("## Page: Classes ");
    const { review, followUp } = submitReview(app, run.id);
    expect(review.state).toBe("updating");
    expect(followUp.parentRunId).toBe(run.id);
    expect(() => decideItem(app, run.id, "page:classes", { draft: "x" })).toThrow(/updating the app/);
    // The follow-up finishes: version 2, the requested page waits for the person again, marked addressed.
    const back = followUpFinished(app, { ...app.store.runs.require(followUp.id), status: "done" }, true)!;
    expect(back.state).toBe("awaiting_rereview");
    expect(back.version).toBe(2);
    expect(back.items[1]).toEqual(expect.objectContaining({ decision: "pending", feedback: "addressed" }));
    expect(back.items[0]!.decision).toBe("approved");
    expect(runStatusLabel(app.store.runs.require(run.id))).toBe("Ready for another look");
    // Approving it confirms the change; sign-off then records the version it applies to.
    expect(decideItem(app, run.id, "page:class-detail", { decision: "approved" }).items[1]!.feedback).toBe("confirmed");
    const signed = signOff(app, run.id);
    expect(signed.state).toBe("signed_off");
    expect(signed.signedOff?.version).toBe(2);
    expect(app.store.runs.require(run.id).review).toBe("signed_off");
  });

  it("a follow-up that stops sends the review back to its change requests", () => {
    const { app, run } = setup();
    openReview(app, run);
    for (const id of ["page:classes", "workflow:w1"]) decideItem(app, run.id, id, { decision: "approved" });
    decideItem(app, run.id, "page:class-detail", { decision: "changes_requested", note: "Bigger photo" });
    const { followUp } = submitReview(app, run.id);
    const back = followUpFinished(app, { ...app.store.runs.require(followUp.id), status: "failed" }, false)!;
    expect(back.state).toBe("changes_requested");
    expect(back.items[1]).toEqual(expect.objectContaining({ decision: "changes_requested", feedback: "open" }));
  });
});

describe("run review learning", () => {
  it("records review revisions, catalog gaps and coverage gaps as issues with proposals, never as changes", async () => {
    const { buildRunReview } = await import("../src/quality/runReview.js");
    const { app, run } = setup();
    openReview(app, run);
    for (const id of ["page:classes", "workflow:w1"]) decideItem(app, run.id, id, { decision: "approved" });
    decideItem(app, run.id, "page:class-detail", { decision: "changes_requested", note: "Show the teacher" });
    submitReview(app, run.id);
    app.store.setSetting(`composition:${run.id}`, { entries: [], gaps: [{ page: "Classes", section: "Savings dial", reason: "no part" }] });
    app.store.setSetting(`coverage:${run.id}`, [{ requirement: "R2", text: "Cancel", workflows: [], pages: [], behavior: "", verification: "", status: "no workflow" }]);
    const keys = buildRunReview(app, run.id).issues.map((i) => i.key);
    expect(keys).toEqual(expect.arrayContaining(["review:revisions", "catalog:gap", "coverage:gap"]));
  });
});
