/** "Let's solve a problem": Light and Deep Research keep the problem central, draft for the user, label AI output, gate on fit. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { AI_DISCLOSURE, OPTIONAL_STEPS, activeSteps, projectStages, DEEP_STAGES, DEEP_STEPS, FOLLOW_UP_MAX, LIGHT_AUTODRAFT, LIGHT_STAGES, LIGHT_STEPS, cautious, type Row } from "@flowcode/contracts";
import * as D from "../src/discovery/discovery.js";
import { makeApp } from "./helpers.js";

type TestApp = ReturnType<typeof makeApp>["app"];

/** A stand-in local model: answers each schema with plausible content, and claims too much where it can. */
function stubModel(app: TestApp, calls: string[] = []) {
  app.router.register({
    config: { id: "ollama", kind: "ollama", label: "stub", enabled: true, hosted: false },
    chat: async (req) => {
      const schema = req.format as { properties: Record<string, { type: string; items?: { properties?: Record<string, { enum?: string[] }> }; properties?: Record<string, unknown> }> };
      const user = String(req.messages.at(-1)?.content ?? "");
      calls.push(user);
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(schema.properties)) {
        if (v.type === "string") out[k] = k === "redirect" ? "" : k === "question" ? `How often does this happen? (${calls.length})` : `Your idea is validated and this will succeed (${k}).`;
        else if (v.type === "object") out[k] = Object.fromEntries(Object.keys(v.properties ?? {}).map((x) => [x, x === "status" ? "Ready to shape a prototype" : `${x} text`]));
        else if (v.items?.properties) {
          const cols = v.items.properties;
          out[k] = [1, 2].map((n) => Object.fromEntries(Object.entries(cols).map(([c, d]) => [c, c === "label" ? "real" : d.enum ? d.enum[0] : c === "id" ? `R${n}` : c === "pain" ? `Invoices are spread across email ${n}` : c === "traces" ? (n === 1 ? "invoices spread across email" : "a nice-to-have dashboard") : `${c} ${n}`])));
        } else out[k] = k === "suggestions" ? ["Every week", "Every month", "Every week", "Only at tax time", "Rarely"] : ["first point", "second point"];
      }
      return { content: JSON.stringify(out), toolCalls: [], model: "stub", durationMs: 1 };
    },
    listModels: async () => [],
    describe: async () => undefined,
    health: async () => ({ ok: true, detail: "stub" }),
  });
}

const PROBLEM = "Freelancers lose track of unpaid invoices.";
const draftLight = async (app: TestApp, id: string) => {
  D.saveInputs(app, id, "l_problem", { problem: PROBLEM });
  for (const s of LIGHT_AUTODRAFT) await D.generateStep(app, id, s);
};

describe("discovery: Light Research", () => {
  it("drafts the whole plan from the problem alone, labelling AI output and rewriting overclaiming", async () => {
    const { app } = makeApp();
    stubModel(app);
    const p = D.createProject(app, "light");
    expect(LIGHT_STEPS[0].fields.map((f) => f.id)).toEqual(["problem"]); // open ended: one question
    await draftLight(app, p.id);
    const got = D.getProject(app, p.id);
    expect(got.title).toBe("Freelancers lose track of unpaid invoices");
    expect(String(got.outputs.l_problem.data.summary)).not.toMatch(/validated|will succeed/i);
    expect(got.outputs.l_problem.data.profile).toBeTruthy();
    // The model labelled its own rows "real research": FlowCode refuses that for AI output.
    const rows = got.outputs.l_draft.data.assumptions as Row[];
    expect(rows.every((r) => r._label === "ai_hypothesis")).toBe(true);
    expect(rows.length).toBeLessThanOrEqual(5);
    expect(got.outputs.l_draft.data.concept).toBeTruthy();
    // The original problem is the user's own words, never the model's.
    expect(got.outputs.l_fit.data.original).toBe(PROBLEM);
    expect(cautious("Customers will buy this.")).toBe("Customers may buy this if the assumptions hold.");
    expect(D.summarize(got)).toMatchObject({ stepsTotal: LIGHT_STAGES.length, stepsDone: 2 });
  });

  it("reasons about the problem and asks up to three follow-ups with suggested answers that feed the draft", async () => {
    const { app } = makeApp();
    const calls: string[] = [];
    stubModel(app, calls);
    const p = D.createProject(app, "light");
    await expect(D.askFollowUp(app, p.id, "l_problem")).rejects.toThrow(/Describe the problem first/);
    D.saveInputs(app, p.id, "l_problem", { problem: PROBLEM });
    let v = await D.askFollowUp(app, p.id, "l_problem");
    const q = v.followups!.l_problem[0];
    expect(q.question).toMatch(/How often/);
    expect(q.suggestions).toEqual(["Every week", "Every month", "Only at tax time", "Rarely"]); // de-duplicated, at most 4
    expect(calls.at(-1)).toMatch(/WHO has the problem[\s\S]*CURRENT STATE[\s\S]*BEHAVIOUR/);
    await expect(D.askFollowUp(app, p.id, "l_problem")).rejects.toThrow(/Answer or skip/);
    D.answerFollowUp(app, p.id, "l_problem", 0, "Every month, at invoice time");
    await D.askFollowUp(app, p.id, "l_problem");
    D.answerFollowUp(app, p.id, "l_problem", 1, null);
    await D.askFollowUp(app, p.id, "l_problem");
    D.answerFollowUp(app, p.id, "l_problem", 2, "A spreadsheet");
    await expect(D.askFollowUp(app, p.id, "l_problem")).rejects.toThrow(/enough questions/);
    expect(D.getProject(app, p.id).followups!.l_problem).toHaveLength(FOLLOW_UP_MAX);
    await D.generateStep(app, p.id, "l_problem");
    // The answers reach the draft as the person's own words; a skipped question doesn't.
    expect(calls.at(-1)).toMatch(/Every month, at invoice time/);
    expect(calls.at(-1)).toMatch(/A spreadsheet/);
    expect(D.contextFor(D.getProject(app, p.id), "l_draft")).toMatch(/Every month, at invoice time/);
  });

  it("gates the summary, PRD and build on the approved map, and flags scope creep in the PRD", async () => {
    const { app } = makeApp();
    stubModel(app);
    const p = D.createProject(app, "light");
    await expect(D.generateStep(app, p.id, "l_problem")).rejects.toThrow(/Answer "What problem do you want to solve\?" first/);
    await draftLight(app, p.id);
    await expect(D.generateStep(app, p.id, "l_summary")).rejects.toThrow(/approve "How it helps"/);
    D.approveStep(app, p.id, "l_fit");
    await D.generateStep(app, p.id, "l_summary");
    const summary = D.summaryMarkdown(D.getProject(app, p.id));
    expect(summary).toMatch(/## 7\. Problem-to-solution map/);
    expect(summary).toMatch(/## 9\. Early assessment/);
    expect(summary).toContain(AI_DISCLOSURE);

    expect(() => D.handoff(app, p.id)).toThrow(/Approve your PRD first/);
    await D.generatePrd(app, p.id);
    const prd = D.getProject(app, p.id).prds[0];
    expect(prd.markdown).toMatch(/## 5\. Problem-to-solution traceability/);
    expect(prd.markdown).toMatch(/## 17\. Build phases/);
    expect(prd.markdown).toMatch(/Possible scope creep: a nice-to-have dashboard/);
    expect(prd.markdown).toMatch(/\| Invoices are spread across email 1 \| R1:/);
    // The UX part: brief, flow, design system, components and screen specs, after the requirements.
    expect(prd.markdown).toMatch(/## 18\. UX: Design brief/);
    expect(prd.markdown).toMatch(/## 19\. UX: User flow\n\n\| Step \| Screen \| What the user does \| What happens next \|/);
    expect(prd.markdown).toMatch(/## 20\. UX: Design system[\s\S]*the style you capture in New build replaces it/);
    expect(prd.markdown).toMatch(/## 21\. UX: Components\n\n\| Component \| Used on \| Variants and states \|/);
    expect(prd.markdown).toMatch(/## 22\. UX: Screen specs\n\n\| Screen \| Layout \| Key content and actions \| States \|/);
    D.approveDoc(app, p.id, "prd", prd.version);
    const h = D.handoff(app, p.id);
    expect(h.prd.name).toMatch(/-prd\.md$/);
    expect(h.extra.content).toMatch(/idea summary/);
    expect(h.description).toMatch(/possible scope creep/);
    expect(D.getProject(app, p.id).status).toBe("handed_off");
  });

  it("marks later work as possibly out of date when an earlier answer changes, and keeps it until regenerated", async () => {
    const { app } = makeApp();
    stubModel(app);
    const p = D.createProject(app, "light");
    await draftLight(app, p.id);
    const r = D.saveInputs(app, p.id, "l_problem", { problem: "Freelancers forget to send invoices at all." });
    expect(r.affected).toEqual(["l_draft", "l_fit"]);
    expect(r.project.outputs.l_draft.stale).toBe(true);
    expect(r.project.outputs.l_draft.data.concept).toBeTruthy();
    expect(D.keepCurrent(app, p.id, ["l_draft"]).outputs.l_draft.stale).toBe(false);
    // Editing the gate's content takes back its approval.
    D.approveStep(app, p.id, "l_fit");
    expect(D.saveOutput(app, p.id, "l_fit", { refined: "Edited by me" }).project.outputs.l_fit.approvedAt).toBeUndefined();
  });

  it("goes deeper without losing work", async () => {
    const { app } = makeApp();
    stubModel(app);
    const p = D.createProject(app, "light");
    D.saveInputs(app, p.id, "l_problem", { problem: PROBLEM });
    await D.askFollowUp(app, p.id, "l_problem");
    D.answerFollowUp(app, p.id, "l_problem", 0, "Every month");
    for (const s of LIGHT_AUTODRAFT) await D.generateStep(app, p.id, s);
    const deep = D.upgradeToDeep(app, p.id);
    expect(deep.mode).toBe("deep");
    expect(deep.currentStep).toBe("d_brief");
    expect(deep.inputs.d_problem.problem).toBe(PROBLEM);
    expect(deep.followups?.d_problem?.[0].answer).toBe("Every month");
    expect((deep.outputs.d_ledger.data.entries as Row[]).length).toBeGreaterThan(0);
    expect((deep.outputs.d_options.data.options as Row[])[0].title).toBe("Light Research first version");
    expect(deep.outputs.d_fit.stale).toBe(true);
    expect(deep.outputs.l_problem).toBeTruthy(); // the Light work is still there
  });
});

describe("discovery: Deep Research", () => {
  it("drafts the first three stages from the problem alone and keeps the user's real findings", async () => {
    const { app } = makeApp();
    stubModel(app);
    const p = D.createProject(app, "deep", undefined, OPTIONAL_STEPS);
    D.saveInputs(app, p.id, "d_problem", { problem: PROBLEM });
    for (const s of DEEP_STAGES[0].draft!) await D.generateStep(app, p.id, s);
    let proj = D.getProject(app, p.id);
    // No viewpoints chosen: FlowCode picked a sensible set and labelled them as simulated.
    expect(proj.inputs.d_perspectives.chosen).toEqual(["Potential user", "Skeptical buyer", "Subject-matter expert", "Accessibility reviewer"]);
    // Too few chosen (the field may be on another stage's page): the person's pick is kept and topped up, not refused.
    D.saveInputs(app, proj.id, "d_perspectives", { chosen: ["Subject-matter expert"] });
    await D.generateStep(app, proj.id, "d_perspectives");
    expect(D.getProject(app, proj.id).inputs.d_perspectives.chosen).toEqual(["Subject-matter expert", "Potential user", "Skeptical buyer"]);
    expect((proj.outputs.d_perspectives.data.perspectives as Row[]).every((r) => r._label === "ai_perspective")).toBe(true);
    expect(proj.outputs.d_fit.data.original).toBe(PROBLEM);

    await D.generateStep(app, p.id, "d_interviews");
    D.saveOutput(app, p.id, "d_interviews", { findings: [{ participant: "Designer, 3 clients", observation: "I check my bank app every morning", _label: "real", _user: "1" }] });
    await D.generateStep(app, p.id, "d_interviews");
    const findings = D.getProject(app, p.id).outputs.d_interviews.data.findings as Row[];
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ observation: "I check my bank app every morning", _label: "real" });

    await expect(D.generateStep(app, p.id, "d_report")).rejects.toThrow(/approve "Problem-to-solution fit"/);
    D.approveStep(app, p.id, "d_fit");
    for (const s of DEEP_STAGES[3].draft!) await D.generateStep(app, p.id, s);
    await D.generateStep(app, p.id, "d_report");
    proj = D.getProject(app, p.id);
    expect(proj.reports[0].markdown).toMatch(/## 17\. Next steps/);
    expect(proj.reports[0].markdown).toMatch(/I check my bank app every morning/);
    expect(D.exportMarkdown(proj).markdown).toMatch(/Real research findings/);
    await D.generatePrd(app, p.id);
    expect(D.getProject(app, p.id).prds[0].markdown).toMatch(/## 26\. Research and experiment plan after launch/);
  });

  it("groups every step into a stage, in plain language with no em dashes", () => {
    for (const [stages, steps] of [[LIGHT_STAGES, LIGHT_STEPS], [DEEP_STAGES, DEEP_STEPS]] as const) {
      expect(stages.flatMap((s) => s.steps).sort()).toEqual(steps.map((s) => s.id).sort());
      expect(stages.length).toBeLessThanOrEqual(6);
    }
    for (const s of [...LIGHT_STEPS, ...DEEP_STEPS]) {
      expect(JSON.stringify(s), s.id).not.toMatch(/—/);
      expect(D.stepSchema(s)).toHaveProperty("properties");
      // Only the problem itself is required; FlowCode drafts the rest.
      expect(s.fields.filter((f) => f.required).map((f) => f.id), s.id).toEqual(s.fields.some((f) => f.id === "problem") ? ["problem"] : []);
    }
  });

  it("repairs a cut-off model answer", () => {
    expect(D.parseLoose('{"summary": "Freelancers", "difficulties": ["a", "b')).toEqual({ summary: "Freelancers", difficulties: ["a", "b"] });
  });
});

describe("one flow", () => {
  it("starts with the core plan, adds research per stage, and keeps the report honest about what wasn't researched", async () => {
    const { app } = makeApp();
    stubModel(app);
    const p = D.createProject(app);
    expect(p).toMatchObject({ mode: "deep", research: [], currentStep: "d_problem" });
    // Users and evidence, and Risks and testing, have nothing until research is added; progress counts the other four.
    expect(D.summarize(p).stepsTotal).toBe(4);
    const stages = projectStages(p);
    expect(stages.find((s) => s.id === "d_users")).toMatchObject({ steps: [], addable: ["d_users", "d_journey", "d_ledger", "d_market", "d_perspectives"] });
    expect(stages.find((s) => s.id === "d_problem")!.draft).toEqual(["d_problem", "d_brief", "d_options", "d_fit"]);
    expect(D.reportMarkdown(p)).toMatch(/## 7\. Market and alternatives\n\n_Not researched\. Add it in the Users and evidence stage/);
    let v = D.setResearch(app, p.id, ["d_market", "not-a-section"]);
    expect(v.research).toEqual(["d_market"]);
    expect(D.summarize(v).stepsTotal).toBe(5);
    // Drafting a section that wasn't added adds it.
    D.saveInputs(app, p.id, "d_problem", { problem: PROBLEM });
    v = await D.generateStep(app, p.id, "d_journey");
    expect(v.research).toEqual(["d_journey", "d_market"]);
    // Older Deep projects (no research list) keep every section.
    const old = { ...v, research: undefined };
    expect(activeSteps(old).map((s) => s.id)).toEqual(DEEP_STEPS.map((s) => s.id));
  });
});

describe("virtual interviews and user testing", () => {
  it("interviews simulated participants with the plan's questions, keeps them apart from real findings, and counts test outcomes itself", async () => {
    const { app } = makeApp();
    const calls: string[] = [];
    stubModel(app, calls);
    const p = D.createProject(app, "deep", undefined, OPTIONAL_STEPS);
    await expect(D.startVirtualInterviews(app, p.id)).rejects.toThrow(/Plan the conversations first/);
    D.saveOutput(app, p.id, "d_interviews", { screening: ["Have you skipped checking labels in a hurry?"], questions: ["Tell me about the last time you had this problem.", "What did you do when you couldn't check the label?"], followUps: [] });
    let v = await D.startVirtualInterviews(app, p.id);
    expect(v.virtualInterviews!.participants.length).toBeGreaterThan(0);
    expect(calls.at(-1)).toMatch(/sceptic[\s\S]*edge case/);
    v = await D.interviewVirtualParticipant(app, p.id, 0);
    const person = v.virtualInterviews!.participants[0];
    expect(person.done).toBe(true);
    // One answer per question, in order, with the question kept beside it.
    expect(person.answers.map((a) => a.question)).toEqual(["Tell me about the last time you had this problem.", "What did you do when you couldn't check the label?"]);
    expect(calls.at(-1)).toMatch(/first person[\s\S]*Don't praise/);
    v = await D.synthesizeVirtualInterviews(app, p.id);
    expect(v.virtualInterviews!.synthesis).toBeDefined();
    // Simulated answers never become real findings.
    expect(v.outputs.d_interviews.data.findings ?? []).toEqual([]);
    expect(D.reportMarkdown(v)).toMatch(/### Virtual interviews \(AI-simulated, 1 participant\)/);

    await expect(D.startVirtualTests(app, p.id)).rejects.toThrow(/Plan the tests first/);
    D.saveOutput(app, p.id, "d_tests", { tasks: [{ task: "Find a trusted brand of pasta", expected: "Finds it in under a minute", observe: "", followUp: "" }] });
    v = await D.startVirtualTests(app, p.id);
    // The same people from the interviews.
    expect(v.virtualTests!.participants.map((x) => x.name)).toEqual(v.virtualInterviews!.participants.map((x) => x.name));
    v = await D.testWithVirtualParticipant(app, p.id, 0);
    expect(v.virtualTests!.participants[0].results[0]).toMatchObject({ task: "Find a trusted brand of pasta", outcome: "Completed" });
    v = await D.synthesizeVirtualTests(app, p.id);
    expect(v.virtualTests!.synthesis!.tasks[0]).toMatchObject({ task: "Find a trusted brand of pasta", completed: 1, struggled: 0, gaveUp: 0 });
    expect(D.reportMarkdown(v)).toMatch(/### Virtual user testing \(AI-simulated, 1 participant\)[\s\S]*Find a trusted brand of pasta \| 1 of 1/);
  });
});

describe("discovery routes", () => {
  it("has a daemon route for every discovery address the Discover page calls", () => {
    const ui = readFileSync(new URL("../../../apps/ui/src/views/DiscoverView.tsx", import.meta.url), "utf8");
    const server = readFileSync(new URL("../src/api/server.ts", import.meta.url), "utf8");
    const called = new Set([...ui.matchAll(/post(?:<[^(]*>)?\(`\/discovery\/\$\{[^}]+\}\/([a-z/]+)`/g)].map((m) => m[1]));
    expect(called.has("handoff")).toBe(true);
    for (const action of called) expect(server, `POST /discovery/:id/${action}`).toContain(`"POST /discovery/:id/${action}"`);
  });
});

describe("follow-up repeats", () => {
  it("spots a near-repeat question (two GMO questions in a row on a real project)", () => {
    const a = "What do people do today when they want to avoid GMO and bio-engineered ingredients?";
    const b = "What do people do today when they want to avoid GMO and bio-engineered ingredients but are in a hurry?";
    expect(D.similarity(a, b)).toBeGreaterThanOrEqual(0.5);
    expect(D.similarity(a, "How often do they shop for groceries each week?")).toBeLessThan(0.5);
  });

  it("never stores the same question twice, even when the model keeps repeating it", async () => {
    const { app } = makeApp();
    const calls: string[] = [];
    stubModel(app, calls);
    const p = D.createProject(app, "light");
    D.saveInputs(app, p.id, "l_problem", { problem: PROBLEM });
    for (let i = 0; i < FOLLOW_UP_MAX; i++) {
      await D.askFollowUp(app, p.id, "l_problem");
      D.answerFollowUp(app, p.id, "l_problem", i, "An answer");
    }
    const qs = D.getProject(app, p.id).followups!.l_problem.map((q) => q.question);
    for (let i = 0; i < qs.length; i++) for (let j = 0; j < i; j++) expect(D.similarity(qs[i], qs[j])).toBeLessThan(0.5);
    // The model was told which lenses are still open.
    expect(calls.some((c) => /too close to an earlier question[\s\S]*what it costs them/.test(c))).toBe(true);
  });
});
