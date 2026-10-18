/**
 * The planning-pipeline repair after the Clean Cart planning validation (2026-10-18), tested on the assembled plan:
 *  - the captured failed plan (version 2, docs/reliability/planning-validation/v2) fails the explicit plan checks on all
 *    six counts, so the checks see what the person saw;
 *  - the same run replayed through the real PRD planning path, with the planner answering exactly what it answered
 *    then (its captured app model, checklist tasks, journeys and Home brief) and the person's real revision request,
 *    gives a plan that passes them, and the revision reaches every planning stage's request;
 *  - other products (a recipe finder that asks for lists and ratings, a website, an app of records) keep what they ask
 *    for and get the same distinctions.
 * No model judges anything here: the checks read the plan's own steps.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ChatRequest, ImplementationPlan } from "@flowcode/contracts";
import { makeApp, makeProject } from "./helpers.js";
import { applyScope, dataOwners, planScope, withOwners } from "../src/orchestrator/planScope.js";
import { planChecks } from "../src/orchestrator/planChecks.js";
import { parseAppModel, appModelNote, type AppModel } from "../src/orchestrator/appModel.js";
import { testKind, testLine } from "../src/quality/lrcPlan.js";
import { ensureSaveJourney, isCompleteSaveJourney, type ExperienceMap } from "../src/orchestrator/experienceMap.js";
import { pageTypeOf } from "../src/orchestrator/pageTypes.js";
import { lookupScreenSource, lookupAppSource } from "../src/orchestrator/lookupFiles.js";
import { experienceKey } from "../src/orchestrator/experienceMap.js";
import { screenBriefKey } from "../src/orchestrator/screenBrief.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const dir = path.join(root, "docs/reliability/planning-validation");
const read = <T>(p: string) => JSON.parse(fs.readFileSync(path.join(dir, p), "utf8")) as T;
const PRD = fs.readFileSync(path.join(root, "docs/handoff/slice/clean-cart-slice-prd.md"), "utf8");
const FEEDBACK = fs.readFileSync(path.join(dir, "revision-feedback.txt"), "utf8").trim();
// Exactly as planReview.ts puts the person's request into the run's constraints.
const REVISION = `Revision requested by the person for plan version 1. Plan again so the new plan does this: ${FEEDBACK}`;
const V2 = { plan: read<ImplementationPlan>("v2/plan.json"), model: read<AppModel>("v2/raw/appModel.json"), items: read<{ items: Array<{ title: string; description: string; covers: string[]; files: string[]; tests?: unknown[]; executionType: string }> }>("v2/raw/lrcPlanRun.json").items, map: read<ExperienceMap>("v2/raw/experienceMap.json"), briefs: read<unknown[]>("v2/raw/screenBrief.json") };
const corpus = `${PRD}\n${JSON.stringify(V2.model.seed)}`;

describe("the captured failed plan (validation version 2)", () => {
  it("fails all six plan checks, for the reasons the person gave", () => {
    const checks = planChecks(V2.plan, { scope: planScope(PRD, [REVISION]), corpus, app: true, saves: true, look: { state: "none", line: "" } });
    expect(checks.filter((c) => c.kind === "structural").map((c) => [c.id, c.ok])).toEqual([[1, false], [2, false], [3, false], [4, false], [5, false], [6, false]]);
    const say = (id: number) => checks.find((c) => c.id === id)!.problems.join("\n");
    expect(say(1)).toMatch(/\[categories\] page/);
    expect(say(1)).toMatch(/\[places\] page/);
    expect(say(1)).toMatch(/\[lists\] page/);
    expect(say(2)).toMatch(/hero-centered, cta-banner, footer-simple|navbar-simple, hero-centered, cta-banner, footer-simple/);
    expect(say(2)).toMatch(/marketing page/);
    expect(say(3)).toMatch(/"Sign-in prompt appears"/);
    expect(say(3)).toMatch(/"product added to Saved list"/);
    expect(say(3)).not.toMatch(/"Oat Milk Original"/);
    expect(say(4)).toMatch(/No journey goes search → record → save/);
    expect(say(5)).toMatch(/doesn't name the owner/);
    expect(say(5)).toMatch(/writes saved state into src\/app\/store\.ts/);
    expect(say(5)).toMatch(/Product Detail \[entry\]/);
    expect(say(6)).toMatch(/says a direction was selected/);
    expect(say(6)).toMatch(/implies the design is approved/);
  });
});

describe("the scope from the Clean Cart PRD and the revision request", () => {
  it("defers what the PRD's non-goals and the request name, leaves out what nobody asked for, and keeps the declared navigation", () => {
    const s = planScope(PRD, [REVISION]);
    const by = Object.fromEntries(s.capabilities.map((c) => [c.capability, `${c.status}/${c.source}`]));
    expect(by).toEqual({ categories: "not requested/not asked for", places: "deferred/prd non-goals", lists: "deferred/prd non-goals", ratings: "deferred/prd non-goals", comments: "deferred/prd non-goals", sharing: "deferred/revision", likes: "not requested/not asked for" });
    expect(s.navigation).toEqual(["Home", "Search", "Saved"]);
    expect(s.noMarketing).toBe(true);
    expect(s.dataSections).toEqual(expect.arrayContaining(["records", "products", "stores", "sample data"]));
    expect(s.revisions).toEqual([FEEDBACK]);
  });

  it("holds the captured app model to it: only Home, Search, Saved in the navigation, the product page opened from results", () => {
    const { model, removed } = applyScope(V2.model, planScope(PRD, [REVISION]));
    expect(removed).toEqual(["Categories", "Lists", "List", "Store Finder"]);
    expect(model.lookup!.omit).toEqual(expect.arrayContaining(["places", "lists", "ratings", "comments", "sharing", "categories", "likes"]));
    expect(model.lookup!.ratings).toEqual([]);
    expect(model.lookup!.lists).toEqual([]);
    const note = appModelNote(model);
    expect(note).toMatch(/^Primary navigation: Home \[landing\], Search \[catalog\], Saved \[saved\]\.$/m);
    expect(note).toMatch(/^Opened from other pages \(not in the navigation\): Product Detail \[entry\]\.$/m);
    expect(note).not.toMatch(/ratings, comments and lists live/);
    // What gets written follows it: no ZIP code or place in the frame, no like, share, list, places or ratings on the product page.
    const entry = lookupScreenSource(model, model.nav.flatMap((g) => g.items).find((v) => v.kind === "entry")!)!;
    expect(entry).toMatch(/omit=\{\["places","lists","ratings","comments","sharing","likes"\]\}/);
    const frame = lookupAppSource(model, model.nav.flatMap((g) => g.items), {});
    expect(frame).not.toMatch(/ZipPrompt|PlaceBadge/);
    expect(frame).not.toMatch(/"id": "product-detail"/);
    const home = lookupScreenSource({ ...model, home: undefined }, model.nav[0]!.items[0]!)!;
    expect(home).not.toMatch(/ZipPrompt|CategoryIndex|Most liked/);
  });

  it("names one owner for products and one for saved state, and moves a save step off the record store", () => {
    const { model } = applyScope(V2.model, planScope(PRD, [REVISION]));
    const owners = dataOwners(model);
    expect(owners).toMatchObject({ records: "src/app/store.ts", saved: "src/app/lookup.ts" });
    const step = { key: "lrc_5", title: "Save Product Button, Saved Products List, Persistent Saved Products", objective: "save → reload", expectedPaths: ["src/screens/ProductDetailScreen.tsx", "src/app/store.ts", "src/sim/saved.ts"] };
    const { tasks, moved } = withOwners([step], owners, () => true);
    expect(tasks[0]!.expectedPaths).toEqual(["src/screens/ProductDetailScreen.tsx", "src/app/lookup.ts"]);
    expect(tasks[0]!.objective).toMatch(/Products records are owned by src\/app\/store\.ts .* what the person saved is owned by src\/app\/lookup\.ts/);
    expect(moved).toEqual(["Save Product Button, Saved Products List, Persistent Saved Products: src/app/store.ts → src/app/lookup.ts"]);
  });

  it("classifies the captured tests: records are text, descriptions are outcomes, screen names are identifiers", () => {
    const kinds = V2.items.flatMap((i) => (i.tests ?? []) as Array<{ behaviour: string; expect: string }>).map((t) => [t.expect, testKind(t, corpus)]);
    expect(Object.fromEntries(kinds)).toMatchObject({
      "Oat Milk Original": "text",
      "Sign-in prompt appears": "outcome",
      "product added to Saved list": "outcome",
      "product removed from Saved list": "outcome",
      "No results found": "outcome",
      "Product appears on Saved screen": "identifier",
      "Product Detail screen for that product": "identifier",
    });
    expect(testLine({ behaviour: "click Save when signed out", expect: "Sign-in prompt appears" }, { corpus })).toMatch(/check that Sign-in prompt appears \(an outcome .* not text to look for\)/);
  });

  it("adds the complete save journey to the captured journeys, starting signed out", () => {
    const pages = { home: "Home", search: "Search", record: "Product Detail", saved: "Saved" };
    expect(V2.map.workflows.some((w) => isCompleteSaveJourney(w, pages))).toBe(false);
    const reqs = read<{ requirements: Array<{ id: string; text: string; section: string; code: string[] }> }>("v2/raw/lrcPlanRun.json").requirements;
    const { map, added } = ensureSaveJourney(V2.map, pages, reqs, V2.model.roles, "Oat Milk Original");
    expect(added).toBe(true);
    const w = map.workflows.at(-1)!;
    expect(isCompleteSaveJourney(w, pages)).toBe(true);
    expect(w.start).toBe("signed out as Visitor (not signed in); signs in as Member (signed in as a demo account) at the Save step");
    expect(w.steps.map((s) => s.screen)).toEqual(["Home", "Search", "Product Detail", "Product Detail", "Product Detail", "Saved", "Saved", "Product Detail", "Saved"]);
    expect(w.requirementIds).toEqual(expect.arrayContaining(["R17", "R18", "R19", "R5"]));
    // The planner's own journeys stay.
    expect(map.workflows.slice(0, 4)).toEqual(V2.map.workflows);
  });
});

/** The planner, answering as it did in the validation run (its captured outputs), recording what each stage was asked. */
function replayPlanner(app: ReturnType<typeof makeApp>["app"], asked: Array<{ stage: string; user: string }>) {
  const m = V2.model;
  const structure = { shape: "lookup", product: m.product, roles: m.roles, entities: m.entities, nav: m.nav, lookup: { entries: m.lookup!.entries, places: m.lookup!.places, categoryField: m.lookup!.categoryField, placesField: m.lookup!.placesField, areas: m.lookup!.areas, placeWord: "store", carryWord: m.lookup!.carryWord, detailFields: m.lookup!.detailFields, facets: m.lookup!.facets } };
  const reply = (content: unknown) => ({ content: JSON.stringify(content), toolCalls: [], model: "replay", durationMs: 1, doneReason: "stop" as const });
  app.router.register({
    config: { id: "ollama", kind: "ollama", label: "replay", enabled: true, hosted: false },
    chat: async (req: ChatRequest) => {
      const system = String(req.messages[0]?.content ?? "");
      const user = String(req.messages[1]?.content ?? "");
      const stage = system.startsWith("You design the data and navigation") ? "app model" : system.startsWith("You write realistic sample records") ? "records" : system.startsWith("You write a look-up app's sample activity") ? "activity" : system.startsWith("You turn product requirements") ? "checklist" : system.startsWith("You map a product's experience") ? "journeys" : system.startsWith("You plan the screens of a clickable prototype") ? "briefs" : "other";
      asked.push({ stage, user });
      if (stage === "app model") return reply(structure);
      if (stage === "records") {
        const e = /Records: \d+ \w+ \((\w+)\)/.exec(user)?.[1]?.toLowerCase();
        const n = Number(/Records: (\d+)/.exec(user)?.[1] ?? 10);
        const rows = (m.seed[e ?? ""] ?? []).filter((r) => !user.includes("exactly these records") || user.includes(String(r.name)));
        const from = (asked.filter((a) => a.stage === "records" && a.user.includes(`(${/Records: \d+ \w+ \((\w+)\)/.exec(user)?.[1]})`)).length - 1) * 10;
        return reply({ records: rows.slice(from, from + n) });
      }
      if (stage === "activity") return reply({ ratings: m.lookup!.ratings, lists: m.lookup!.lists, likes: m.lookup!.likes, saves: m.lookup!.saves });
      if (stage === "checklist") {
        const ids = new Set([...user.matchAll(/^(R\d+) \[/gm)].map((x) => x[1]));
        const tasks = V2.items.filter((i) => i.executionType === "code" && i.covers.some((c) => ids.has(c))).map((i) => ({ title: i.title, goal: i.description, files: i.files, steps: [], acceptance: [], covers: i.covers.filter((c) => ids.has(c)), tests: i.tests ?? [] }));
        return reply({ tasks, other: [] });
      }
      if (stage === "journeys") return reply(V2.map);
      if (stage === "briefs") return reply({ screens: V2.briefs });
      return reply({});
    },
    listModels: async () => Object.values(app.router.roleAssignments()).map((a) => ({ name: a.model })),
    describe: async () => undefined,
    health: async () => ({ ok: true, detail: "replay" }),
  });
}

describe("the validation run replayed through the repaired PRD planning path", () => {
  const plan = async (constraints: string[]) => {
    const { app } = makeApp();
    const { project } = makeProject(app);
    const asked: Array<{ stage: string; user: string }> = [];
    replayPlanner(app, asked);
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Clean Cart: build the slice in the attached PRD as a complete working prototype: Home, search, a product's page, save it, and see it on Saved.", kind: "spec_build", buildMode: "complete", references: [{ name: "clean-cart-slice-prd.md", role: "prd", content: PRD }], constraints, attachedKnowledgeIds: [] });
    await app.orchestrator.plan(run.id);
    const r = app.store.runs.require(run.id);
    return { app, run: r, asked, plan: r.plan! };
  };

  it("sends the person's revision request to every planning stage", async () => {
    const { asked, plan } = await plan_(REVISION);
    expect(plan).toBeDefined();
    for (const stage of ["app model", "checklist", "journeys", "briefs"]) {
      const reqs = asked.filter((a) => a.stage === stage);
      expect(reqs.length, stage).toBeGreaterThan(0);
      for (const a of reqs) expect(a.user, stage).toContain("Home is a branded consumer product-discovery homepage");
    }
  }, 120_000);

  it("assembles a plan that passes all six checks with the planner's own captured answers", async () => {
    const { app, run, plan } = await plan_(REVISION);
    const checks = app.store.getSetting<Array<{ id: number; ok: boolean; problems: string[] }>>(`planChecks:${run.id}`, []);
    // The replayed plan as evidence for the report (PLANNING_REPAIR_EVIDENCE=<dir>).
    const out = process.env.PLANNING_REPAIR_EVIDENCE;
    if (out) {
      fs.mkdirSync(out, { recursive: true });
      const events = app.store.db.all<{ data: string }>("SELECT data FROM events WHERE run_id = ? AND type = 'plan.proposed' ORDER BY rowid", run.id).map((x) => (JSON.parse(x.data) as { message: string }).message);
      fs.writeFileSync(path.join(out, "replayed-plan.json"), JSON.stringify({ plan, checks, scope: app.store.getSetting(`planScope:${run.id}`, null), journeys: app.store.getSetting(experienceKey(run.id), null), briefs: app.store.getSetting(screenBriefKey(run.id), null), coverage: app.store.getSetting(`coverage:${run.id}`, null), decisions: app.store.getSetting(`scopeDecisions:${run.id}`, null), events }, null, 2));
    }
    expect(checks.filter((c) => (c as { kind?: string }).kind === "structural").map((c) => [c.id, c.ok, c.problems])).toEqual([1, 2, 3, 4, 5, 6].map((id) => [id, true, []]));
    // The compliance checks on the replayed Clean Cart plan: the PRD's records, navigation, exclusions, tests, state, Look.
    expect(checks.filter((c) => (c as { kind?: string }).kind === "compliance").filter((c) => !c.ok).map((c) => [c.id, c.problems])).toEqual([]);
    const text = plan.tasks.map((t) => `${t.title}\n${t.objective}`).join("\n");
    // 1. Scope: no Categories, Lists, List or Store Finder page; the supporting data isn't a step; the scope is stated.
    expect(text).not.toMatch(/\[(categories|places|lists|mylist)\]/);
    expect(plan.tasks.map((t) => t.title)).not.toContain("Stores: remaining requirements");
    expect(plan.assumptions.join("\n")).toMatch(/Deferred \(not in this release.*\): .*lists.*ratings.*comments.*sharing \(your revision request\)/s);
    // 2. Home: no hero, CTA banner or footer; the Home brief is the app home, its storefront part kept.
    const lib = plan.tasks.find((t) => t.title === "Add library sections")!;
    expect(lib.expectedPaths.join(" ")).not.toMatch(/Hero|Cta|Footer|Navbar/);
    expect(text).toMatch(/Page type: App home/);
    expect(app.store.getSetting<Array<{ pageType: string }>>(screenBriefKey(run.id), [])[0]?.pageType).toBe("home");
    // 3. Tests: the record name stays exact; descriptions are outcomes.
    expect(text).toMatch(/→ the app shows "Oat Milk Original"/);
    expect(text).not.toMatch(/the app shows "Sign-in prompt appears"/);
    expect(text).toMatch(/check that Sign-in prompt appears \(an outcome/);
    // 4. The complete save journey, from signed out, in the assembly's journey tests.
    const assemble = plan.tasks.find((t) => t.title.startsWith("Assemble the app"))!;
    expect(assemble.objective).toMatch(/- "Save and come back: search → Product Detail → save \(sign in\) → Saved → reload → unsave": starts on Home \(signed out as Visitor/);
    expect(app.store.getSetting<ExperienceMap>(experienceKey(run.id), { roles: [], workflows: [], data: [], permissions: [] }).workflows.at(-1)?.by).toBe("flowcode");
    // 5. Owners named; the save steps name the saved-state owner, never the record store or src/sim.
    expect(text).toMatch(/Primary navigation: Home \[landing\], Search \[catalog\], Saved \[saved\]\./);
    for (const t of plan.tasks.filter((x) => /^lrc_/.test(x.key) && /sav/i.test(x.title))) expect(t.expectedPaths).not.toContain("src/app/store.ts");
    // 6. The Look as it stands: proposed, awaiting a pick; no implied approval.
    expect(plan.assumptions.find((a) => a.startsWith("Look:"))).toMatch(/^Look: no direction is selected\. Proposed for your choice on the plan card: .*nothing about the design is approved yet\.$/);
    expect(plan.tasks.find((t) => t.title === "Review the prototype plan and the design")!.objective).toMatch(/^Wait for the person to approve the prototype plan\. Look: no direction is selected/);
  }, 120_000);

  it("gets the same scope from the PRD alone, before any revision", async () => {
    const { app, run, plan } = await plan_(undefined);
    const checks = app.store.getSetting<Array<{ id: number; ok: boolean }>>(`planChecks:${run.id}`, []);
    expect(checks.filter((c) => !c.ok).map((c) => [c.id, (c as { problems?: string[] }).problems])).toEqual([]);
    expect(plan.tasks.map((t) => t.objective).join("\n")).not.toMatch(/The person reviewed an earlier version/);
  }, 120_000);

  const plan_ = (revision: string | undefined) => plan(revision ? [revision] : []);
});

describe("other products", () => {
  const RECIPES = `# Pantry Pal: PRD\n\n## Main screens\n\n| Screen | Purpose |\n|---|---|\n| Home | Search recipes |\n| Recipe | One recipe |\n| Lists | My shopping lists |\n\n## Requirements\n\n- R1: Members keep shopping lists and add a recipe's ingredients to a list.\n- R2: Members rate a recipe with stars.\n- R3: Members save recipes to Favourites; pressing Save again removes it.\n`;

  it("keeps the capabilities a PRD asks for (a recipe finder with shopping lists and ratings)", () => {
    const s = planScope(RECIPES);
    const by = Object.fromEntries(s.capabilities.map((c) => [c.capability, c.status]));
    expect(by).toMatchObject({ lists: "in scope", ratings: "in scope", places: "not requested", comments: "not requested" });
    const model = parseAppModel({ shape: "lookup", product: "Pantry Pal", roles: ["Cook (signed in)", "Guest (not signed in)"], entities: [{ key: "recipe", label: "Recipe", plural: "Recipes", fields: [{ key: "name", label: "Name", type: "text" }, { key: "cuisine", label: "Cuisine", type: "select", options: ["Thai", "Italian"] }] }, { key: "shop", label: "Shop", plural: "Shops", fields: [{ key: "name", label: "Name", type: "text" }] }], nav: [{ label: "Pantry Pal", items: [{ id: "home", label: "Home", kind: "landing" }] }], lookup: { entries: "recipe", places: "shop", categoryField: "cuisine", areas: [{ zip: "10001", label: "Chelsea", lat: 40.75, lng: -73.99 }] }, seed: { recipe: [{ name: "Green curry", cuisine: "Thai" }], shop: [{ name: "Corner shop" }] } }).model!;
    const kept = applyScope(model, s).model;
    expect(kept.nav.flatMap((g) => g.items).map((v) => v.kind)).toEqual(expect.arrayContaining(["lists", "mylist", "saved", "entry"]));
    expect(kept.nav.flatMap((g) => g.items).map((v) => v.kind)).not.toContain("places");
    // A non-Clean-Cart save journey, from a guest's signed-out start.
    const { map } = ensureSaveJourney({ roles: [], workflows: [], data: [], permissions: [] }, { home: "Home", search: "Recipes", record: "Recipe", saved: "Favourites" }, [{ id: "R3", text: "Members save recipes to Favourites; pressing Save again removes it. A guest is asked to sign in first.", section: "Requirements", code: [] }], kept.roles, "Green curry");
    expect(map.workflows[0]!.start).toBe("signed out as Guest (not signed in); signs in as Cook (signed in) at the Save step");
  });

  it("leaves a website's marketing sections and marketing pages alone", () => {
    expect(pageTypeOf("marketing", "Home", "Our bakery", false, false)).toBe("marketing");
    expect(pageTypeOf("marketing", "Home", "Find a product", false, true)).toBe("home");
    expect(pageTypeOf(undefined, "Home", "Start here", false, true)).toBe("home");
    const site: ImplementationPlan = { goal: "Bakery site", assumptions: ["Look: no direction is selected; the build keeps the base styling, and nothing about the design is approved yet."], relevantFiles: [], expectedChanges: [], risk: "low", riskNotes: [], validationPlan: [], rollbackStrategy: "", tasks: [{ key: "fc_sections", title: "Add library sections", objective: "Copy the library sections this spec calls for into src/sections/ as starting points: hero-split (A website's opening.); cta-banner (A website closes with one invitation to act.)", dependsOn: [], expectedPaths: [], acceptanceCriteria: [], verification: [], role: "coder" }] };
    expect(planChecks(site, { scope: planScope("# Bakery\n"), corpus: "", app: false, saves: false }).find((c) => c.id === 2)!.ok).toBe(true);
  });

  it("an app of records: exact text only from its spec, outcomes and screen names never as text, one store owns everything", () => {
    const spec = "# Referrals\n\n- R1: Sending a referral shows \"Referral sent\".\n- R2: The queue shows 3 waiting referrals.";
    expect(testKind({ behaviour: "press Send", expect: "Referral sent" }, spec)).toBe("text");
    expect(testKind({ behaviour: "open the queue", expect: "3" }, spec)).toBe("text");
    expect(testKind({ behaviour: "press Send", expect: "Referral appears in queue" }, spec)).toBe("outcome");
    expect(testKind({ behaviour: "open a referral", expect: "Referral Detail screen" }, spec)).toBe("identifier");
    expect(testKind({ behaviour: "press Send", expect: "Confirmation shown" }, spec)).toBe("outcome");
    // Without the spec's words, a short description is still not text.
    expect(testKind({ behaviour: "press Save", expect: "Item added to list" })).toBe("outcome");
    expect(testKind({ behaviour: "press 1 ÷ 0 =", expect: "Can't divide by zero" })).toBe("text");
    const model = parseAppModel({ shape: "app", product: "Referrals", roles: ["Clinician"], entities: [{ key: "referral", label: "Referral", plural: "Referrals", fields: [{ key: "patient", label: "Patient", type: "text" }] }], nav: [{ label: "Referrals", items: [{ id: "referrals", label: "Referrals", kind: "list", entity: "referral" }] }], seed: { referral: [{ patient: "A" }] } }).model!;
    expect(dataOwners(model)).toMatchObject({ records: "src/app/store.ts", saved: "src/app/store.ts" });
  });

  it("a revision request alone can defer a capability, and a clash with the PRD is the person's to confirm", () => {
    const s = planScope(RECIPES, ["Revision requested by the person for plan version 1. Plan again so the new plan does this: No ratings in this release; keep the lists."]);
    expect(s.capabilities.find((c) => c.capability === "ratings")).toMatchObject({ status: "deferred", source: "revision" });
    expect(s.capabilities.find((c) => c.capability === "lists")!.status).toBe("in scope");
    expect(s.conflicts).toEqual([expect.stringMatching(/The PRD asks for ratings .* your revision request leaves it out/)]);
  });
});
