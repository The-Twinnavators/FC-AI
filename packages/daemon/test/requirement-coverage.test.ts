/**
 * Requirement extraction and source-to-plan coverage (after Frameproof evaluation 2, where 51 paragraph sentences of the
 * PRD never became requirements and the plan's coverage still read complete):
 *  - paragraphs, list items, table rows and numbered sections are extracted, limits, exceptions and prohibitions
 *    included, each with its source line and headings, a list item with its lead-in, a line kept whole;
 *  - every substantive PRD passage is traced to the plan, and one that maps to nothing is reported (a hard finding);
 *  - the same requirement as a paragraph, a bullet or a hard-wrapped line survives into the plan alike;
 *  - a test's number against the PRD's stated limit (500 for 300 characters) is a contradiction.
 * The Frameproof cases use the unchanged PRD and replay the planner's captured replies from evaluation 2 (no model call).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ChatRequest, ImplementationPlan } from "@flowcode/contracts";
import { makeApp, makeProject } from "./helpers.js";
import { extractRequirements, requirementText, type Requirement } from "../src/quality/spec.js";
import { sourceCoverage, sourceCoverageReport, type SourceCoverage } from "../src/quality/sourceCoverage.js";
import { limitContradictions, type PlanCheck } from "../src/orchestrator/planChecks.js";
import type { PlanItem } from "../src/quality/lrcPlan.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const RUN2 = path.join(root, "docs/reliability/frameproof-eval-2");
const PRD = fs.readFileSync(path.join(RUN2, "Frameproof-PRD.md"), "utf8");
const REPLIES = JSON.parse(fs.readFileSync(path.join(RUN2, "v1/raw/planningReplies.json"), "utf8")) as Array<{ stage: string; request: string; reply: string }>;
const OLD_REQS = (JSON.parse(fs.readFileSync(path.join(RUN2, "v1/raw/lrcPlanRun.json"), "utf8")) as { requirements: Requirement[] }).requirements;
const json = (s: string) => JSON.parse(s.replace(/^[^{]*/, "")) as Record<string, unknown>;
const find = (reqs: Requirement[], s: string) => reqs.find((r) => requirementText(r).includes(s));

/** The omitted obligations from evaluation 2, as the PRD writes them. */
const OBLIGATIONS = {
  "300-character note limit": "Each photo can have an optional editing note of up to 300 characters.",
  "Previous/Next order": "Previous and Next follow the full 12-photo sample-data order regardless of Gallery filters.",
  "no wrap at the ends": "Do not wrap: disable Previous on photo-01 and Next on photo-12.",
  "namespaced storage": "Use a namespaced storage key.",
  "recovery from unreadable data": "If saved data cannot be read, recover to a usable Draft state and show a concise notice instead of crashing.",
  "submission dialog contents": "At five, Submit selection opens a confirmation dialog summarizing the five photos, their notes, and that submission will lock the selection.",
  "dialog cancellation": "Cancel returns to editable selection without losing changes.",
  "submitted-state locking": "Confirming submission sets Submitted status, records a timestamp, shows confirmation and the five submitted photos, and locks shortlist changes and editing notes across the app.",
  "browsing after submission": "Client may still browse Gallery and photo detail.",
  "reset dialog": "After submission, provide Start over with a confirmation dialog explaining that it clears selected photos, all notes, submission status, and timestamp.",
  "reset cancel and confirm": "Cancel preserves everything. Confirm returns to empty Draft state.",
  "reset leaves other storage": "Do not clear unrelated browser storage.",
};

describe("extraction from the unchanged Frameproof PRD", () => {
  const reqs = extractRequirements(PRD, 600);

  it("keeps every omitted obligation, whole, with its source line and section", () => {
    for (const [what, text] of Object.entries(OBLIGATIONS)) {
      const r = find(reqs, text);
      expect(r, what).toBeDefined();
      expect(PRD.split(/\r?\n/)[r!.source!.line - 1]!.trim(), what).toBe(text);
      expect(r!.source!.path[0], what).toBe("Frameproof — Client Photo Proofing Prototype");
    }
    expect(find(reqs, OBLIGATIONS["300-character note limit"])!.source!.path.at(-1)).toBe("R6 — Editing notes");
    // Sentences on one line stay together, so the second keeps its context.
    expect(find(reqs, "With fewer than five, explain how many more are needed. Mouse or keyboard interaction must not submit.")).toBeDefined();
    // A list item keeps the lead-in that gives it its meaning.
    expect(requirementText(find(reqs, "Shortlisted photo IDs")!)).toBe("Keep one shared source of truth for: Shortlisted photo IDs.");
    // Prohibitions, exceptions and numbered items too.
    expect(find(reqs, "Do not add a marketing landing page, pricing page, photographer dashboard, or account settings.")).toBeDefined();
    expect(find(reqs, "Client may still browse Gallery and photo detail.")).toBeDefined();
    expect(find(reqs, "Primary navigation has exactly two destinations")).toBeDefined();
  });

  it("leaves no substantive line out (only bare lead-ins, carried by their lists and tables)", () => {
    const lines = new Set(reqs.map((r) => r.source!.line));
    const left = PRD.split(/\r?\n/).map((l, i) => ({ t: l.trim(), n: i + 1 })).filter(({ t, n }) => t && !/^#|^\|/.test(t) && !lines.has(n));
    expect(left.map((x) => x.t)).toEqual(["Use these exact records:", "Keep one shared source of truth for:", "Accessibility:", "Do not implement:"]);
  });
});

describe("formatting equivalence (a non-Frameproof product)", () => {
  const SENTENCES = ["Each comment can be up to 140 characters.", "Do not show deleted comments to other readers.", "If the draft cannot be saved, keep it in the editor and show a notice.", "Pinned comments stay first regardless of sorting."];
  const as = {
    bullets: `# Thread\n\n## Comments\n\n${SENTENCES.map((s) => `- ${s}`).join("\n")}\n`,
    paragraphs: `# Thread\n\n## Comments\n\n${SENTENCES.join("\n")}\n`,
    numbered: `# Thread\n\n## Comments\n\n${SENTENCES.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n`,
    wrapped: `# Thread\n\n## Comments\n\n${SENTENCES.map((s) => s.replace(/^(\S+ \S+ \S+) /, "$1\n")).join("\n")}\n`,
  };

  it("extracts the same requirements however they are written", () => {
    for (const [form, md] of Object.entries(as)) expect(extractRequirements(md).map((r) => r.text), form).toEqual(SENTENCES);
  });

  it("carries each into a build step of the assembled plan, and maps every passage", async () => {
    for (const [form, md] of Object.entries(as)) {
      const { plan, coverage } = await planOf(md, () => ({ tasks: [], other: [] }));
      const steps = plan.tasks.map((t) => t.objective).join("\n");
      for (const s of SENTENCES) expect(steps, `${form}: ${s}`).toContain(s);
      expect(coverage.unmapped, form).toEqual([]);
    }
  }, 120_000);
});

describe("unmapped passages are reported, never counted as covered", () => {
  it("finds a substantive passage nothing in the plan carries", () => {
    const md = "# App\n\n## Rules\n\nUse a namespaced storage key.\nIf saved data cannot be read, recover to a usable Draft state.\n";
    const reqs = extractRequirements(md);
    const items = [{ id: "a", title: "Storage", covers: [reqs[0]!.id], executionType: "code" } as unknown as PlanItem];
    const c = sourceCoverage(md, reqs, items);
    expect(c.unmapped.map((p) => [p.line, p.text])).toEqual([[6, "If saved data cannot be read, recover to a usable Draft state."]]);
    expect(sourceCoverageReport(c)).toMatch(/\| 6 \| Rules \| If saved data cannot be read, recover to a usable Draft state\. \| R2 \| unmapped \|/);
  });
});

describe("stated limits against tests", () => {
  const reqs = extractRequirements(PRD, 600);
  it("catches 500 for the PRD's 300 characters, and agrees with the right numbers", () => {
    expect(limitContradictions("type 20 characters in editing note field → character count shows '20/500'", reqs)).toEqual(["expects a limit of 500 characters; the PRD says 300"]);
    expect(limitContradictions("type 20 characters in editing note field → character count shows '20/300'", reqs)).toEqual([]);
    expect(limitContradictions("try to select a 6th photo → error: maximum 6 photos", reqs)).toEqual(["says the limit is 6 photos; the PRD says 5"]);
    expect(limitContradictions("select 5 photos → selection count shows 5/5", reqs)).toEqual([]);
    // Another product.
    const other = extractRequirements("# Notes app\n\nA reply can be at most 280 characters.\nAttach at most 3 files.\n");
    expect(limitContradictions("type a reply → counter shows 12/140 characters", other)).toEqual(["expects a limit of 140 characters; the PRD says 280"]);
    expect(limitContradictions("attach files → up to 5 files allowed", other)).toEqual(["says the limit is 5 files; the PRD says 3"]);
  });
});

/** The assembled plan for a PRD with a scripted planner (no model call): its plan, checks and source coverage. */
async function planOf(md: string, batch: (user: string) => unknown, more: (system: string, user: string) => unknown = () => ({})) {
  const { app } = makeApp();
  const { project } = makeProject(app);
  app.router.register({
    config: { id: "ollama", kind: "ollama", label: "replay", enabled: true, hosted: false },
    chat: async (req: ChatRequest) => {
      const system = String(req.messages[0]?.content ?? "");
      const user = String(req.messages[1]?.content ?? "");
      const content = system.startsWith("You turn product requirements") ? batch(user) : more(system, user);
      return { content: typeof content === "string" ? content : JSON.stringify(content), toolCalls: [], model: "replay", durationMs: 1, doneReason: "stop" as const };
    },
    listModels: async () => Object.values(app.router.roleAssignments()).map((a) => ({ name: a.model })),
    describe: async () => undefined,
    health: async () => ({ ok: true, detail: "replay" }),
  });
  const run = app.orchestrator.createRun({ projectId: project.id, objective: "Build the attached PRD as a complete working prototype.", kind: "spec_build", buildMode: "sketch", references: [{ name: "prd.md", role: "prd", content: md }], constraints: [], attachedKnowledgeIds: [] });
  await app.orchestrator.plan(run.id);
  const r = app.store.runs.require(run.id);
  if (!r.plan) throw new Error(`no plan: ${r.status} ${r.statusReason}`);
  return { app, run: r, plan: r.plan as ImplementationPlan, checks: app.store.getSetting<PlanCheck[]>(`planChecks:${run.id}`, []), coverage: app.store.getSetting<SourceCoverage>(`sourceCoverage:${run.id}`, { passages: [], unmapped: [], counts: {} as SourceCoverage["counts"] }) };
}

describe("Frameproof evaluation 2 replayed with the repaired extraction (captured replies, no model call)", () => {
  /** The captured planner: each checklist batch gets every task it wrote, its requirement IDs moved to today's by their text. */
  const replay = (current: Requirement[]) => {
    const idOf = new Map(OLD_REQS.map((o) => [o.id, current.find((c) => c.text === o.text)?.id]));
    const tasks = REPLIES.filter((r) => r.stage.startsWith("You turn product requirements")).flatMap((r) => (json(r.reply).tasks as Array<Record<string, unknown>>) ?? []).map((t) => ({ ...t, covers: ((t.covers as string[]) ?? []).map((c) => idOf.get(c)).filter(Boolean) }));
    const seeds = { Galleries: REPLIES.filter((r) => r.stage.startsWith("You write realistic sample records") && r.request.includes("Galleries")), Photos: REPLIES.filter((r) => r.stage.startsWith("You write realistic sample records") && r.request.includes("Photos")) };
    const stage = (s: string) => REPLIES.find((r) => r.stage.startsWith(s))?.reply ?? "{}";
    return {
      batch: () => ({ tasks, other: [] }),
      more: (system: string, user: string) => (system.startsWith("You design the data and navigation") ? stage("You design the data") : system.startsWith("You write realistic sample records") ? ((user.includes("Galleries") ? seeds.Galleries : seeds.Photos).shift()?.reply ?? { records: [] }) : system.startsWith("You map a product's experience") ? stage("You map a product's experience") : system.startsWith("You plan the screens") ? stage("You plan the screens") : {}),
    };
  };

  it("carries every omitted obligation into a build step, maps every passage, and flags the 500-character test", async () => {
    const current = extractRequirements(PRD, 600);
    const r = replay(current);
    const { plan, checks, coverage } = await planOfComplete(PRD, r.batch, r.more);
    const steps = plan.tasks.filter((t) => /^lrc_/.test(t.key));
    for (const [what, text] of Object.entries(OBLIGATIONS)) {
      const p = coverage.passages.find((x) => x.text === text)!;
      expect(p.status, what).toBe("in a build step");
      expect(steps.some((t) => t.objective.includes(text)), what).toBe(true);
    }
    expect(coverage.unmapped).toEqual([]);
    const failing = Object.fromEntries(checks.filter((c) => !c.ok).map((c) => [c.id, c.problems.join("\n")]));
    expect(Object.keys(failing)).toEqual(["11"]);
    expect(failing[11]).toMatch(/20\/500.*expects a limit of 500 characters; the PRD says 300/);
    expect(failing[11]).toMatch(/"Nature" isn't one of the category options/);
    expect(failing[11]).toMatch(/"Outdoor" is a photo category, not a title the search matches/);
    expect(plan.riskNotes[0]).toMatch(/^Not approval-ready: 1 contradiction with the PRD/);
    expect(plan.assumptions.join("\n")).toMatch(/requirements extracted from the PRD; of its \d+ substantive passages, \d+ are in build steps.*and none maps to nothing/);
    const out = process.env.REQUIREMENT_COVERAGE_EVIDENCE;
    if (out) {
      fs.mkdirSync(out, { recursive: true });
      fs.writeFileSync(path.join(out, "COVERAGE.md"), `# Frameproof: source-to-plan coverage (evaluation 2's captured replies, repaired extraction)\n\n${sourceCoverageReport(coverage)}\n`);
      fs.writeFileSync(path.join(out, "replayed-plan.json"), JSON.stringify({ plan, checks, coverage }, null, 2));
    }
  }, 180_000);
});

/** As planOf, as a complete app (the Frameproof build mode). */
async function planOfComplete(md: string, batch: (user: string) => unknown, more: (system: string, user: string) => unknown) {
  const { app } = makeApp();
  const { project } = makeProject(app);
  app.router.register({
    config: { id: "ollama", kind: "ollama", label: "replay", enabled: true, hosted: false },
    chat: async (req: ChatRequest) => {
      const system = String(req.messages[0]?.content ?? "");
      const user = String(req.messages[1]?.content ?? "");
      const content = system.startsWith("You turn product requirements") ? batch(user) : more(system, user);
      return { content: typeof content === "string" ? content : JSON.stringify(content), toolCalls: [], model: "replay", durationMs: 1, doneReason: "stop" as const };
    },
    listModels: async () => Object.values(app.router.roleAssignments()).map((a) => ({ name: a.model })),
    describe: async () => undefined,
    health: async () => ({ ok: true, detail: "replay" }),
  });
  const run = app.orchestrator.createRun({ projectId: project.id, objective: "Frameproof: build the attached PRD as a complete working prototype.", kind: "spec_build", buildMode: "complete", references: [{ name: "Frameproof-PRD.md", role: "prd", content: md }], constraints: [], attachedKnowledgeIds: [] });
  await app.orchestrator.plan(run.id);
  const r = app.store.runs.require(run.id);
  if (!r.plan) throw new Error(`no plan: ${r.status} ${r.statusReason}`);
  return { plan: r.plan as ImplementationPlan, checks: app.store.getSetting<PlanCheck[]>(`planChecks:${run.id}`, []), coverage: app.store.getSetting<SourceCoverage>(`sourceCoverage:${run.id}`, { passages: [], unmapped: [], counts: {} as SourceCoverage["counts"] }) };
}
