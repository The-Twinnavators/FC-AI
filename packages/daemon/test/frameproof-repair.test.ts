/**
 * The bounded repair after Frameproof plan version 1 (a planning-stage PRD-compliance failure), tested on the assembled
 * plan. The PRD is the unchanged Frameproof PRD; the planner's answers are its own recorded replies from that run
 * (docs/reliability/frameproof-eval/v1/raw/planningReplies.json), replayed through the real PRD planning path:
 *  1. the PRD's explicit records survive whatever their heading: IDs, titles, categories, order and counts;
 *  2. structured select options are read, never "[object Object]"; unsupported shapes are reported;
 *  3. create pages come from what the PRD asks for and rules out, never from a kind of record; the declared navigation
 *     is the navigation;
 *  4. library picks ignore what the PRD rules out ("Do not add … pricing page");
 *  5. the runtime state the PRD specifies is accounted for with one owner;
 *  6. compliance findings (records, navigation, exclusions, tests, state, Look) are separate from structural ones, and
 *     a hard contradiction makes the plan not approval-ready;
 *  7. the PRD's own visual direction is proposed, and no exact colour it doesn't give is required.
 * Non-Frameproof cases check each rule doesn't overreach.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ChatRequest, ImplementationPlan } from "@flowcode/contracts";
import { makeApp, makeProject } from "./helpers.js";
import { appModelNote, inPrimaryNav, parseAppModel, selectOptions, type AppModel } from "../src/orchestrator/appModel.js";
import { enforceRecords, prdRecordTables, recordProblems, tableFor, tableRows } from "../src/orchestrator/prdRecords.js";
import { applyScope, planScope } from "../src/orchestrator/planScope.js";
import { planChecks, type PlanCheck } from "../src/orchestrator/planChecks.js";
import { pickSections } from "../src/orchestrator/sectionRecipes.js";
import { affirmed } from "../src/orchestrator/layoutRecipes.js";
import { testLine } from "../src/quality/lrcPlan.js";
import { seedRequest } from "../src/orchestrator/appModel.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const dir = path.join(root, "docs/reliability/frameproof-eval");
const PRD = fs.readFileSync(path.join(dir, "Frameproof-PRD.md"), "utf8");
const REPLIES = JSON.parse(fs.readFileSync(path.join(dir, "v1/raw/planningReplies.json"), "utf8")) as Array<{ stage: string; request: string; reply: string }>;
const V1 = { plan: JSON.parse(fs.readFileSync(path.join(dir, "v1/plan.json"), "utf8")) as ImplementationPlan, model: JSON.parse(fs.readFileSync(path.join(dir, "v1/raw/appModel.json"), "utf8")) as AppModel, items: JSON.parse(fs.readFileSync(path.join(dir, "v1/raw/lrcPlanRun.json"), "utf8")).items };
const json = (s: string) => JSON.parse(s.replace(/^[^{]*/, "")) as Record<string, unknown>;
const STRUCTURE = json(REPLIES[0]!.reply);
const PHOTOS = [
  ["photo-01", "Golden Hour", "Outdoor"], ["photo-02", "Window Light", "Studio"], ["photo-03", "Walking Together", "Outdoor"], ["photo-04", "Quiet Smile", "Studio"],
  ["photo-05", "Garden Steps", "Outdoor"], ["photo-06", "Soft Shadows", "Studio"], ["photo-07", "Autumn Path", "Outdoor"], ["photo-08", "Looking Back", "Outdoor"],
  ["photo-09", "Linen Backdrop", "Studio"], ["photo-10", "Under the Oak", "Outdoor"], ["photo-11", "Candid Laugh", "Studio"], ["photo-12", "Last Light", "Outdoor"],
];

describe("1. the PRD's explicit records", () => {
  it("are found under any heading: the Gallery as one record, the 12 photos as exact rows in order", () => {
    const tables = prdRecordTables(PRD);
    expect(tables.map((t) => [t.heading, t.shape, t.records.length, t.exact])).toEqual([["Gallery", "fields", 1, true], ["Photo records", "rows", 12, true]]);
    expect(tables[1]!.records.map((r) => [r.ID, r.Title, r.Category])).toEqual(PHOTOS);
    // The same table under another heading and a non-Frameproof product: still found, still exact.
    const other = "# Shelf\n\n## What we stock\nUse these exact records:\n\n| SKU | Name | Aisle |\n|---|---|---|\n| B-1 | Rye loaf | Bakery |\n| B-2 | Oat milk | Dairy |\n";
    expect(prdRecordTables(other).map((t) => [t.heading, t.records.length, t.exact])).toEqual([["What we stock", 2, true]]);
    // A screens table is not records.
    expect(prdRecordTables("# X\n\n## Main screens\n\n| Screen | Purpose |\n|---|---|\n| Home | Start |\n")).toEqual([]);
  });

  it("survive into the app model with their IDs, values, order and count; invented ones and remote URLs don't", () => {
    const parsed = parseAppModel({ ...STRUCTURE, seed: {} }).model!;
    const tables = prdRecordTables(PRD);
    const photo = parsed.entities.find((e) => e.key === "photo")!;
    const gallery = parsed.entities.find((e) => e.key === "gallery")!;
    // The model's own (invented) records, as v1's sample-record replies wrote them.
    const invented = (json(REPLIES[3]!.reply).records as Array<Record<string, unknown>>);
    const photos = enforceRecords(photo, invented, tableRows(photo, tableFor(photo, parsed.entities, tables)!), true);
    const galleries = enforceRecords(gallery, json(REPLIES[1]!.reply).records as Array<Record<string, unknown>>, tableRows(gallery, tableFor(gallery, parsed.entities, tables)!), true);
    const model = parseAppModel({ ...STRUCTURE, seed: { photo: photos.rows, gallery: galleries.rows } }).model!;
    const scoped = applyScope(model, planScope(PRD), [], tables).model;
    expect(scoped.seed.photo!.map((r) => [r.id, r.title, r.category])).toEqual(PHOTOS);
    expect(scoped.seed.photo!.filter((r) => r.category === "Outdoor")).toHaveLength(7);
    expect(scoped.seed.photo!.filter((r) => r.category === "Studio")).toHaveLength(5);
    expect(scoped.seed.gallery).toEqual([expect.objectContaining({ id: "gallery-autumn", title: "Autumn Portrait Session", photographer: "Rowan Studio", client: "Maya Chen", requiredSelectionCount: 5 })]);
    expect(JSON.stringify(scoped.seed)).not.toMatch(/https?:\/\/|Mountain Sunrise|Spring Blossom/);
    expect(recordProblems(scoped, tables)).toEqual([]);
    expect(photos.notes.at(-1)).toMatch(/^10 photos the PRD doesn't list left out/);
  });
});

describe("2. select options", () => {
  it("reads strings and structured options, maps record values to labels, and reports what it can't read", () => {
    expect(selectOptions(["Outdoor", "Studio"]).labels).toEqual(["Outdoor", "Studio"]);
    const o = selectOptions([{ key: "outdoor", label: "Outdoor" }, { value: "studio", name: "Studio" }, 3, { foo: { bar: 1 } }]);
    expect(o.labels).toEqual(["Outdoor", "Studio", "3"]);
    expect(o.keys.get("outdoor")).toBe("Outdoor");
    expect(o.unsupported).toEqual(['{"foo":{"bar":1}}']);
    const parsed = parseAppModel({ ...STRUCTURE, seed: { photo: [{ title: "Golden Hour", category: "outdoor", orientation: "portrait" }] } });
    const photo = parsed.model!.entities.find((e) => e.key === "photo")!;
    expect(photo.fields.find((f) => f.key === "category")!.options).toEqual(["Outdoor", "Studio"]);
    expect(parsed.model!.seed.photo![0]).toMatchObject({ category: "Outdoor", orientation: "Portrait" });
    expect(seedRequest("Frameproof", photo, 10)).not.toContain("[object Object]");
    const bad = parseAppModel({ shape: "app", product: "X", roles: ["a"], entities: [{ key: "thing", label: "Thing", plural: "Things", fields: [{ key: "name", label: "Name", type: "text" }, { key: "kind", label: "Kind", type: "select", options: [{ foo: 1 }] }] }], nav: [{ label: "X", items: [{ id: "things", label: "Things", kind: "list", entity: "thing" }] }], seed: {} });
    expect(bad.problems.join("\n")).toMatch(/Field "Kind" of Thing: options in a shape FlowCode doesn't read \(\{"foo":1\}\); the field is plain text instead/);
    expect(bad.model!.entities[0]!.fields[1]!.type).toBe("text");
  });
});

describe("3. pages and navigation", () => {
  it("Frameproof: Gallery and My Selection only; no create page; the photo page opened from the grid", () => {
    const scope = planScope(PRD);
    expect(scope.navigation).toEqual(["Gallery", "My Selection"]);
    const { model, removed, changed } = applyScope(parseAppModel({ ...STRUCTURE, seed: {} }).model!, scope, [], prdRecordTables(PRD));
    const views = model.nav.flatMap((g) => g.items);
    expect(views.map((v) => `${v.label} [${v.kind}${v.entity ? `:${v.entity}` : ""}]`)).toEqual(["Gallery [list:photo]", "My Selection [custom]", "Photo detail [detail:photo]"]);
    expect(views.filter((v) => inPrimaryNav(model, v)).map((v) => v.label)).toEqual(["Gallery", "My Selection"]);
    expect(removed).toEqual(["Gallery detail"]);
    expect(changed.join("\n")).toMatch(/My Selection: the page of the PRD's Client selection state/);
    expect(appModelNote(model)).toMatch(/^Primary navigation: Gallery \[list\], My Selection \[custom\]\.$/m);
  });

  it("other apps: a create page the PRD asks for is added; one it rules out is removed; no declared navigation keeps every page", () => {
    const base = { shape: "app", product: "Referrals", roles: ["Clinician"], entities: [{ key: "referral", label: "Referral", plural: "Referrals", fields: [{ key: "patient", label: "Patient", type: "text" }] }, { key: "document", label: "Document", plural: "Documents", fields: [{ key: "name", label: "Name", type: "text" }] }], nav: [{ label: "Work", items: [{ id: "referrals", label: "Referrals", kind: "list", entity: "referral" }, { id: "documents", label: "Documents", kind: "list", entity: "document" }, { id: "new-document", label: "New document", kind: "create", entity: "document" }] }], seed: {} };
    const prd = "# Referrals\n\n## Requirements\n- Clinicians create a referral for a patient.\n\n## Out of scope\n- Document upload.\n";
    const { model } = applyScope(parseAppModel(base).model!, planScope(prd));
    const views = model.nav.flatMap((g) => g.items).map((v) => `${v.label} [${v.kind}]`);
    expect(views).toContain("New referral [create]");
    expect(views).not.toContain("New document [create]");
    expect(model.nav.flatMap((g) => g.items).filter((v) => inPrimaryNav(model, v)).map((v) => v.label)).toEqual(["Referrals", "New referral", "Documents"]);
  });
});

describe("4. library picks", () => {
  it("ignore what a PRD rules out, in Frameproof and elsewhere, and still pick what one asks for", () => {
    expect(pickSections(PRD).map((p) => p.id)).not.toContain("pricing-tiers");
    expect(pickSections("A website for a bakery. Avoid testimonials and pricing tables.").map((p) => p.id)).not.toEqual(expect.arrayContaining(["pricing-tiers"]));
    expect(pickSections("A website for a gym. Do not add a newsletter sign-up or a FAQ.").map((p) => p.id)).toEqual(expect.not.arrayContaining(["newsletter-inline", "faq-accordion"]));
    expect(pickSections("A website for a gym with pricing: Basic, Plus and Pro plans.").map((p) => p.id)).toContain("pricing-tiers");
    expect(pickSections("Landing page. 2,400 bookings a week, 38% fewer no-shows, 4.8 stars from 900 reviews.").map((p) => p.id)).toContain("hero-stats");
    expect(affirmed("## Out of scope\n- Pricing pages.\n## Goals\nShow the menu. Do not show prices.")).toBe("## Goals\nShow the menu.");
  });
});

/** The planner answering as it did in Frameproof v1 (its recorded replies), recording what each stage was asked. */
function replay(app: ReturnType<typeof makeApp>["app"], asked: Array<{ stage: string; user: string }>) {
  const by = (s: string) => REPLIES.filter((r) => r.stage.startsWith(s));
  const seeds = { Galleries: by("You write realistic sample records").filter((r) => r.request.includes("Galleries")), Photos: by("You write realistic sample records").filter((r) => r.request.includes("Photos")) };
  // Every checklist task the model wrote, so each batch keeps the ones covering its requirements (parseBatch).
  const batches = by("You turn product requirements").flatMap((r) => {
    try {
      return [json(r.reply)];
    } catch {
      return [];
    }
  });
  const allTasks = { tasks: batches.flatMap((b) => (b.tasks as unknown[]) ?? []), other: batches.flatMap((b) => (b.other as unknown[]) ?? []) };
  const reply = (content: unknown) => ({ content: typeof content === "string" ? content : JSON.stringify(content), toolCalls: [], model: "replay", durationMs: 1, doneReason: "stop" as const });
  app.router.register({
    config: { id: "ollama", kind: "ollama", label: "replay", enabled: true, hosted: false },
    chat: async (req: ChatRequest) => {
      const system = String(req.messages[0]?.content ?? "");
      const user = String(req.messages[1]?.content ?? "");
      asked.push({ stage: system.split("\n")[0]!.slice(0, 50), user });
      if (system.startsWith("You design the data and navigation")) return reply(REPLIES[0]!.reply);
      if (system.startsWith("You write realistic sample records")) {
        const queue = user.includes("Galleries") ? seeds.Galleries : seeds.Photos;
        return reply(queue.shift()?.reply ?? { records: [] });
      }
      if (system.startsWith("You turn product requirements")) return reply(allTasks);
      if (system.startsWith("You map a product's experience")) return reply(by("You map a product's experience")[0]!.reply);
      return reply({});
    },
    listModels: async () => Object.values(app.router.roleAssignments()).map((a) => ({ name: a.model })),
    describe: async () => undefined,
    health: async () => ({ ok: true, detail: "replay" }),
  });
}

describe("5–7. the assembled Frameproof plan, replayed from the planner's recorded replies", () => {
  const assemble = async () => {
    const { app } = makeApp();
    const { project } = makeProject(app);
    const asked: Array<{ stage: string; user: string }> = [];
    replay(app, asked);
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Frameproof: build the attached PRD as a complete working prototype.", kind: "spec_build", buildMode: "complete", references: [{ name: "Frameproof-PRD.md", role: "prd", content: PRD }], constraints: [], attachedKnowledgeIds: [] });
    await app.orchestrator.plan(run.id);
    const r = app.store.runs.require(run.id);
    if (!r.plan) throw new Error(`no plan: ${r.status} ${r.statusReason} | ${app.store.db.all<{ data: string }>("SELECT data FROM events WHERE run_id = ? ORDER BY rowid", run.id).map((x) => (JSON.parse(x.data) as { message: string }).message).slice(-6).join(" || ")}`);
    const model = app.store.getSetting<AppModel | null>(`appModel:${run.id}`, null)!;
    const checks = app.store.getSetting<PlanCheck[]>(`planChecks:${run.id}`, []);
    const out = process.env.FRAMEPROOF_REPAIR_EVIDENCE;
    if (out) {
      fs.mkdirSync(out, { recursive: true });
      const events = app.store.db.all<{ data: string }>("SELECT data FROM events WHERE run_id = ? AND type = 'plan.proposed' ORDER BY rowid", run.id).map((x) => (JSON.parse(x.data) as { message: string }).message);
      fs.writeFileSync(path.join(out, "replayed-plan.json"), JSON.stringify({ plan: r.plan, model, checks, coverage: app.store.getSetting(`coverage:${run.id}`, null), decisions: app.store.getSetting(`scopeDecisions:${run.id}`, null), events }, null, 2));
    }
    return { run: r, plan: r.plan!, model, checks, asked };
  };

  it("keeps the records, navigation, exclusions, state and Look; and surfaces the model's contradicting tests as not approval-ready", async () => {
    const { plan, model, checks, asked } = await assemble();
    const text = plan.tasks.map((t) => `${t.title}\n${t.objective}`).join("\n");
    // 1. The 12 photos and the one gallery, as given.
    expect(model.seed.photo!.map((r) => [r.id, r.title, r.category])).toEqual(PHOTOS);
    expect(model.seed.gallery!.map((r) => r.id)).toEqual(["gallery-autumn"]);
    expect(asked.filter((a) => a.stage.startsWith("You write realistic sample records") && a.user.includes("Photos"))[0]!.user).toMatch(/Write exactly these records from the PRD's sample data.*Golden Hour, Window Light/s);
    // 2. No "[object Object]" anywhere the plan or a request says.
    expect(JSON.stringify(plan) + asked.map((a) => a.user).join("")).not.toContain("[object Object]");
    // 3. Navigation and pages.
    expect(text).toMatch(/Primary navigation: Gallery \[list\], My Selection \[custom\]\./);
    // ("New photo appears in the correct order" is the model's own test wording about a replacement photo, not a page.)
    expect(text).not.toMatch(/\[create\]/);
    expect(model.nav.flatMap((g) => g.items).some((v) => v.kind === "create")).toBe(false);
    // 4. No pricing piece.
    expect(plan.tasks.find((t) => t.title === "Add library sections")?.objective ?? "").not.toMatch(/pricing/);
    // 5. The selection state, one owner, every field named.
    expect(plan.assumptions.join("\n")).toMatch(/The PRD's Client selection state \(Shortlisted photo IDs; Editing note per photo; Selection status: Draft or Submitted; Submission timestamp, when submitted\) is one shared state owned by src\/app\/store\.ts/);
    // 7. The PRD's Look proposed, balanced motion, expressive off; no invented colour required.
    expect(plan.assumptions.find((a) => a.startsWith("Look:"))).toMatch(/The PRD's own direction is proposed for your review: "Editorial contact sheet": Warm off-white background; Near-black text; Muted cobalt accent.*balanced motion, expressive effects off/);
    expect(text).not.toMatch(/the app shows "[^"]*#[0-9a-f]{3,8}/i);
    expect(text).toMatch(/check that it uses the selected Look's colour \(an outcome; the PRD gives no exact value, so #3a6ea5 is not a requirement\)/);
    // 6. Compliance separate from structure; the model's wrong tests are hard contradictions, so not approval-ready.
    const failing = checks.filter((c) => !c.ok).map((c) => [c.kind, c.id]);
    expect(failing).toEqual([["compliance", 11]]);
    const tests = checks.find((c) => c.id === 11)!.problems.join("\n");
    expect(tests).toMatch(/searching "Window Light" doesn't find Last Light/);
    expect(tests).toMatch(/"Indoor" isn't one of the category options \(outdoor, studio\)/);
    expect(tests).not.toMatch(/"clear search and select 'Outdoor'/);
    expect(tests).toMatch(/14 galleries, but the records have 1/);
    expect(tests).toMatch(/"Outdoor" is a photo category, not a title the search matches/);
    expect(plan.risk).toBe("high");
    expect(plan.riskNotes[0]).toBe("Not approval-ready: 1 contradiction with the PRD (Acceptance tests agree with the PRD's records)");
    expect(plan.compliance!.filter((c) => c.kind === "compliance").map((c) => c.id)).toEqual([7, 8, 9, 10, 11, 12, 13]);
  }, 120_000);

  it("returns no explicit requirement to the person as a decision (v1 returned 38)", async () => {
    const { plan } = await assemble();
    expect(plan.scopeDecisions ?? []).toEqual([]);
    // R49 ("must not rely on color alone") had no test in v1: it stays a requirement its step must test, not a question.
    expect(plan.tasks.map((t) => t.objective).join("\n")).toMatch(/Selection status must not rely on color alone[\s\S]*|at least one test of what the user does and sees/);
  }, 120_000);
});

describe("the captured v1 plan", () => {
  it("fails the compliance checks it should have failed, while its structural checks pass", () => {
    const tables = prdRecordTables(PRD);
    const checks = planChecks(V1.plan, { scope: planScope(PRD), corpus: `${PRD}\n${JSON.stringify(V1.model.seed)}`, app: true, saves: false, look: { state: "none", line: "" }, model: V1.model, tables, items: V1.items, prd: PRD });
    expect(checks.filter((c) => c.kind === "structural").every((c) => c.ok)).toBe(true);
    const failed = Object.fromEntries(checks.filter((c) => !c.ok).map((c) => [c.id, c.problems.join("\n")]));
    expect(Object.keys(failed).map(Number)).toEqual([7, 8, 9, 10, 11, 12]);
    expect(failed[7]).toMatch(/Photos: 14 records; the PRD gives exactly 12/);
    expect(failed[8]).toMatch(/destinations the PRD doesn't declare: New gallery, New photo/);
    expect(failed[9]).toMatch(/"New photo" adds photos, which the PRD rules out \("Photo upload or download\."\)/);
    expect(failed[9]).toMatch(/adds pricing-tiers, which the PRD only mentions to rule out/);
    expect(failed[9]).toMatch(/remote URLs the PRD rules out.*https:\/\/example\.com/);
    expect(failed[10]).toMatch(/doesn't give the PRD's Client selection state an owner/);
    expect(failed[12]).toMatch(/"Editorial contact sheet"/);
  });

  it("an invented colour in a test is not a requirement", () => {
    expect(testLine({ behaviour: "verify selected state uses cobalt accent", expect: "background-color: #3a6ea5" }, { corpus: PRD })).toBe("- verify selected state uses cobalt accent → check that it uses the selected Look's colour (an outcome; the PRD gives no exact value, so #3a6ea5 is not a requirement)");
    expect(testLine({ behaviour: "open the brand page", expect: "#ff6600" }, { corpus: "Brand colour: #FF6600" })).toBe('- open the brand page → the app shows "#ff6600"');
  });
});
