/** Project Journal: assembled from the run's records, statements labelled, questions answered for the selected run only. */
import { describe, expect, it, vi } from "vitest";
import { askJournal, journalEntry, projectJournal } from "../src/quality/journal.js";
import { makeApp, makeProject } from "./helpers.js";

function setup() {
  const { app } = makeApp();
  const { project } = makeProject(app, { "README.md": "# demo\n" });
  const run = app.orchestrator.createRun({ projectId: project.id, objective: "# Brand finder\nmore", constraints: [], attachedKnowledgeIds: [] });
  app.store.runs.upsert({ ...app.store.runs.require(run.id), status: "blocked" });
  const t = (id: string, title: string, status: string, attempts: number, blocker?: string) =>
    app.store.tasks.upsert({ id, runId: run.id, title, objective: title, status: status as never, dependsOn: [], expectedPaths: [], actualPaths: [], acceptanceCriteria: [], validationPlan: { kinds: [] }, role: "coder", ordinal: 0, attempts, ...(blocker ? { blocker: { reason: blocker, category: "verification", evidenceRefs: [], nextAction: "" } } : {}) });
  t("a", "Search screen", "verified", 1);
  t("b", "Detail screen", "verified", 3);
  t("c", "Keypad", "blocked", 4, "Acceptance criteria not met after 4 attempts: tests failed");
  app.store.checks.upsert({ id: "chk_v", runId: run.id, kind: "visual_critique", required: false, status: "skipped", evidenceRefs: [], summary: "Critique failed: credit balance is too low", updatedAt: new Date().toISOString() });
  return { app, project, run };
}

describe("project journal", () => {
  it("reports what worked, what was repaired, what went wrong and what wasn't checked, with labels and evidence", () => {
    const { app, run } = setup();
    const e = journalEntry(app, run.id);
    expect(e.asked).toBe("Brand finder");
    expect(e.worked[0]).toMatchObject({ kind: "observed", evidence: ["step:a"] });
    expect(e.repaired[0].text).toMatch(/"Detail screen" \(3 tries\)/);
    expect(e.wentWrong.map((s) => s.text).join(" ")).toMatch(/"Keypad" stopped after 4 tries/);
    expect(e.wentWrong.find((s) => /Recorded reason/.test(s.text))?.kind).toBe("suspected");
    expect(e.notChecked[0].text).toMatch(/visual review: couldn't run/);
    expect(e.contributions.find((c) => c.role === "coder")).toMatchObject({ steps: 3, stepsPassed: 2 });
    expect(e.next.some((s) => /Decide on "Keypad"/.test(s.text))).toBe(true);
  });

  it("lists the project's runs newest first", () => {
    const { app, project, run } = setup();
    expect(projectJournal(app, project.id).entries[0].runId).toBe(run.id);
  });

  it("answers from the selected run's records, and refuses a run from another project", async () => {
    const { app, project, run } = setup();
    vi.spyOn(app.router, "chat").mockRejectedValue(new Error("offline"));
    const a = await askJournal(app, project.id, run.id, "What was not verified?");
    expect(a.source).toBe("records");
    expect(a.answer).toMatch(/couldn't run/);
    await expect(askJournal(app, "prj_other", run.id, "why?")).rejects.toThrow(/another project/);
  });

  it("drops a model answer that quotes something the records don't contain", async () => {
    const { app, project, run } = setup();
    vi.spyOn(app.router, "chat").mockResolvedValue({ content: JSON.stringify({ answer: 'The "Login screen" step failed.' }) } as never);
    const a = await askJournal(app, project.id, run.id, "What caused the failure?");
    expect(a.source).toBe("records");
    expect(a.answer).toMatch(/Keypad/);
  });
});
