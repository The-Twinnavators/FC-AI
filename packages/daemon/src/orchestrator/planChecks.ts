/**
 * Checks on the assembled plan, the one the person approves, for the six things the Clean Cart planning validation
 * found wrong (2026-10-18). They read the plan's own steps (titles, objectives, files, acceptance criteria and
 * assumptions), so they run on any plan, including one captured before this repair, and need no model to judge them:
 *  1. scope: nothing the scope leaves out has a page, a navigation link or a step;
 *  2. Home: an app's front page gets no marketing funnel and isn't planned as a marketing page;
 *  3. tests: exact on-screen text a test requires comes from the spec or its records;
 *  4. the save journey: search → record → save (sign in) → saved → reload → unsave, from a stated sign-in state;
 *  5. data owners: one named owner for records and one for saved state; no step assigns another;
 *  6. the Look: the plan states it as it is, and doesn't imply a design approval.
 * What these can't judge (the quality of the wording, the planner's own journeys, the Home design itself) is listed in
 * `review` for the person.
 */
import { LIBRARY_SECTIONS, type ImplementationPlan, type PlanTask } from "@flowcode/contracts";
import { picksIn, ADD_SECTIONS } from "./sectionRecipes.js";
import { CAPABILITY_KINDS, CAPABILITY_LABEL, leftOut, type PlanScope } from "./planScope.js";
import type { LookStatus } from "./lookStatus.js";
import { inPrimaryNav, type AppModel, type ModelEntity } from "./appModel.js";
import { recordProblems, tableFor, type PrdRecordTable } from "./prdRecords.js";
import { affirmed } from "./layoutRecipes.js";
import type { PlanItem } from "../quality/lrcPlan.js";

export const planChecksKey = (runId: string) => `planChecks:${runId}`;

export interface PlanCheck {
  id: number;
  /** "structural": the plan is put together right; "compliance": it keeps what the PRD requires (its records, its
   *  navigation, what it excludes, tests that agree with its data, its state, its Look). */
  kind: "structural" | "compliance";
  /** A failed hard check is a contradiction with the PRD: the plan isn't approval-ready while it stands. */
  hard: boolean;
  label: string;
  ok: boolean;
  problems: string[];
}
export interface PlanCheckContext {
  scope: PlanScope;
  /** The PRD and the app's sample records: what a test may require word for word. */
  corpus: string;
  /** Whether the plan builds an app (not a website). */
  app: boolean;
  /** Whether the app saves things (it has a saved page and a requirement about saving). */
  saves: boolean;
  look?: LookStatus;
  /** For the compliance checks: the app model, the PRD's record tables and the plan's checklist items (their tests). */
  model?: AppModel;
  tables?: PrdRecordTable[];
  items?: PlanItem[];
  /** The PRD's text (to tell what it rules out from what it asks for). */
  prd?: string;
}

const norm = (s: string) => s.toLowerCase().replace(/["“”'‘’`]/g, "").replace(/\s+/g, " ");
const FUNNEL = new Set(["navigation", "hero", "cta", "footer"]);
const features = (p: ImplementationPlan) => p.tasks.filter((t) => /^(m|lrc)_/.test(t.key) && t.key !== "m_assemble" && t.role === "coder");

export function planChecks(plan: ImplementationPlan, ctx: PlanCheckContext): PlanCheck[] {
  const all = plan.tasks;
  const text = (t: PlanTask) => `${t.title}\n${t.objective}`;
  const checks: Array<Omit<PlanCheck, "kind" | "hard">> = [];

  // 1. Scope: no destination, screen file or library piece for a left-out capability.
  {
    const problems: string[] = [];
    for (const cap of leftOut(ctx.scope)) {
      for (const kind of CAPABILITY_KINDS[cap] ?? []) {
        const tag = `[${kind}]`;
        const where = all.filter((t) => t.objective.includes(tag)).map((t) => `"${t.title}"`);
        if (where.length) problems.push(`${CAPABILITY_LABEL[cap]} is ${ctx.scope.capabilities.find((c) => c.capability === cap)?.status}, but ${where.join(", ")} plans a ${tag} page`);
      }
    }
    const pieces = { places: "place-finder", lists: "list-builder" } as const;
    for (const [cap, piece] of Object.entries(pieces)) if (leftOut(ctx.scope).includes(cap as "places") && all.some((t) => t.expectedPaths.some((p) => p.toLowerCase().includes(piece.replace("-", ""))))) problems.push(`${CAPABILITY_LABEL[cap as "places"]} is left out, but a step writes the ${piece} piece`);
    if (ctx.scope.conflicts.length) problems.push(...ctx.scope.conflicts.map((c) => `For you to confirm: ${c}`));
    checks.push({ id: 1, label: "Scope: required behaviour, supporting data and left-out capabilities agree in every step", ok: !problems.filter((p) => !p.startsWith("For you")).length, problems });
  }

  // 2. Home: no marketing funnel in an app, and no app page planned as a marketing page.
  {
    const problems: string[] = [];
    if (ctx.app) {
      const lib = all.find((t) => t.title === ADD_SECTIONS);
      const funnel = lib ? picksIn(lib.objective).filter((p) => FUNNEL.has(LIBRARY_SECTIONS.find((s) => s.id === p.id)?.category ?? "")) : [];
      if (funnel.length) problems.push(`"${ADD_SECTIONS}" adds marketing sections to an app: ${funnel.map((p) => p.id).join(", ")}`);
      for (const t of all) if (/Page type: Marketing page\b/.test(t.objective)) problems.push(`"${t.title}" plans a page of this app as a marketing page`);
    }
    checks.push({ id: 2, label: "Home: a product-discovery page, no marketing funnel", ok: !problems.length, problems });
  }

  // 3. Tests: exact text only when the spec or its records hold it; descriptions are outcomes, not text.
  {
    const problems: string[] = [];
    const corpus = norm(ctx.corpus);
    for (const t of all) {
      for (const c of t.acceptanceCriteria) {
        if (c.check.type !== "file_contains" || !/^src\/acceptance\//.test(c.check.path)) continue;
        const want = c.check.text;
        if (!/^[\d\s.,+\-−×÷*/=%()$€£]+$/.test(want) && !corpus.includes(norm(want))) problems.push(`"${t.title}" requires "${want}" as on-screen text, which neither the PRD nor the records say`);
      }
      for (const m of t.objective.matchAll(/→ the app shows "([^"]+)"/g)) if (!corpus.includes(norm(m[1]!)) && !/^[\d\s.,+\-−×÷*/=%()$€£]+$/.test(m[1]!)) problems.push(`"${t.title}" tells the tests to look for "${m[1]}" on screen`);
    }
    checks.push({ id: 3, label: "Tests: what a person sees, not internal names or placeholder phrases", ok: !problems.length, problems: [...new Set(problems)] });
  }

  // 4. The save journey, complete and from a stated sign-in state.
  {
    const problems: string[] = [];
    if (ctx.saves) {
      const assemble = all.find((t) => t.key === "m_assemble" || t.title.startsWith("Assemble the app"));
      const journeys = (assemble?.objective ?? "").split("\n").filter((l) => /^- "/.test(l));
      const complete = journeys.find((l) => /\((signed (in|out)[^)]*)\)/i.test(l) && /\breload/i.test(l) && /\b(unsave|save again)/i.test(l) && /\bsearch/i.test(l));
      if (!journeys.length) problems.push("No user journey is planned for the assembly's end-to-end tests");
      else if (!complete) problems.push(`No journey goes search → record → save (sign in) → saved → reload → unsave from a stated sign-in state (journeys: ${journeys.map((l) => /^- "([^"]+)"/.exec(l)?.[1]).join("; ")})`);
    }
    checks.push({ id: 4, label: "Save journey: complete, with its starting sign-in state", ok: !problems.length, problems });
  }

  // 5. Data owners: named once; no step assigns saved state elsewhere; record pages aren't navigation links.
  {
    const problems: string[] = [];
    if (ctx.app) {
      const write = all.find((t) => /^Write the complete app$/.test(t.title));
      const lookup = !!write?.acceptanceCriteria.some((c) => c.check.type === "file_exists" && c.check.path === "src/app/lookup.ts");
      if (!all.some((t) => t.objective.includes("Data owners (one each"))) problems.push("The plan doesn't name the owner of the records and of the saved state");
      for (const t of features(plan)) {
        if (t.expectedPaths.some((p) => /^src\/sim(\/|$)/.test(p))) problems.push(`"${t.title}" keeps data in src/sim`);
        if (lookup && /\bsav(e|ed|es|ing)\b|persist|reload/i.test(text(t)) && t.expectedPaths.includes("src/app/store.ts")) problems.push(`"${t.title}" writes saved state into src/app/store.ts, but the saved-state owner is src/app/lookup.ts`);
      }
      const nav = write?.objective.split("\n").find((l) => /^(Primary navigation|Navigation):/.test(l)) ?? "";
      if (/\[(entry|detail|mylist)\]/.test(nav)) problems.push(`The navigation lists a record's own page: ${nav.slice(0, 200)}`);
    }
    checks.push({ id: 5, label: "Data owners: one for records, one for saved state", ok: !problems.length, problems });
  }

  // 6. The Look as it is.
  {
    const problems: string[] = [];
    const state = ctx.look?.state ?? "none";
    if (state !== "selected") {
      for (const t of all) {
        if (/Apply the direction you selected/.test(t.objective)) problems.push(`"${t.title}" says a direction was selected; none is`);
        if (/approve the prototype plan and the design/i.test(t.objective)) problems.push(`"${t.title}" implies the design is approved with the plan`);
      }
    }
    if (!plan.assumptions.some((a) => a.startsWith("Look:"))) problems.push("The plan doesn't state its Look status");
    checks.push({ id: 6, label: "Look: stated as selected, proposed or none; no implied design approval", ok: !problems.length, problems });
  }
  return [...checks.map((c) => ({ ...c, kind: "structural" as const, hard: false })), ...complianceChecks(plan, ctx)];
}

/** What only a person can judge, whatever the checks say. */
export const HUMAN_REVIEW = [
  "Whether the planner's own journeys and step wording read right (the checks prove structure, not prose)",
  "Whether the Home composition and the proposed Home directions fit the brand (a chosen full-page Home design keeps its own sections)",
  "Whether outcome tests check the right thing once written (the plan only says what to observe)",
];

const NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20 };
const quoted = (s: string) => [...s.matchAll(/['"‘“]([^'"’”]{1,60})['"’”]/g)].map((m) => m[1]!.trim());
/** Library categories and the words a PRD uses for them. */
const CATEGORY_WORDS: Record<string, RegExp> = { pricing: /\bpric(e|es|ing)\b|\bplans?\b|\btiers?\b/i, testimonials: /\btestimonials?\b/i, cta: /\b(call to action|cta|promotional)\b/i, hero: /\bheroes?\b/i, newsletter: /\bnewsletter\b/i, faq: /\bfaq\b|frequently asked/i, team: /\bteam\b/i, contact: /\bcontact\b/i, blog: /\bblog\b|\barticles?\b/i, stats: /\bstat(s|istics)\b|\bkpis?\b/i, features: /\bfeatures?\b/i, footer: /\bfooter\b/i, navigation: /\bnav(igation|bar)\b|\bheader\b/i };

/**
 * Whether the plan keeps what the PRD requires, read from the assembled plan and its app model (Frameproof planning:
 * the six structural checks passed on a plan with 14 invented photos, create pages the PRD rules out, a pricing piece
 * the PRD forbids, tests that contradicted the records, and the PRD's Look replaced by base styling).
 */
function complianceChecks(plan: ImplementationPlan, ctx: PlanCheckContext): PlanCheck[] {
  const out: PlanCheck[] = [];
  const add = (id: number, label: string, problems: string[]) => out.push({ id, kind: "compliance", hard: true, label, ok: !problems.length, problems: [...new Set(problems)] });
  const m = ctx.model;
  const views = m ? m.nav.flatMap((g) => g.items) : [];
  const corpus = norm(ctx.corpus);

  // 7. The PRD's explicit records: IDs, titles, values, order and count.
  add(7, "Required records: the PRD's explicit records, as given", m && ctx.tables ? recordProblems(m, ctx.tables) : []);

  // 8. Navigation: exactly the destinations the PRD declares.
  {
    const problems: string[] = [];
    if (m && ctx.scope.navigation.length) {
      const primary = views.filter((v) => inPrimaryNav(m, v)).map((v) => v.label);
      const want = ctx.scope.navigation.map((n) => n.toLowerCase());
      const extra = primary.filter((p) => !want.includes(p.toLowerCase()));
      const missing = ctx.scope.navigation.filter((n) => !primary.some((p) => p.toLowerCase() === n.toLowerCase()));
      if (extra.length) problems.push(`The navigation has destinations the PRD doesn't declare: ${extra.join(", ")} (the PRD's: ${ctx.scope.navigation.join(", ")})`);
      if (missing.length) problems.push(`The navigation lacks the PRD's ${missing.join(", ")}`);
    }
    add(8, "Navigation: the PRD's declared destinations only", problems);
  }

  // 9. What the PRD excludes: create pages for what it rules out adding, library pieces it rules out, remote assets.
  {
    const problems: string[] = [];
    const mentions = (line: string, e: ModelEntity) => new RegExp(`\\b(${[e.label, e.plural, e.key].map((x) => x.toLowerCase().replace(/[^a-z0-9 ]/g, "")).join("|")})\\b`, "i").test(line);
    for (const v of views.filter((x) => x.kind === "create")) {
      const e = m!.entities.find((x) => x.key === v.entity);
      const rule = e && ctx.scope.outOfScope.find((l) => /\b(upload\w*|creat\w*|add\w*|new|import\w*|multiple)\b/i.test(l) && mentions(l, e));
      if (rule) problems.push(`"${v.label}" adds ${e!.plural.toLowerCase()}, which the PRD rules out ("${rule}")`);
    }
    const lib = plan.tasks.find((t) => t.title === ADD_SECTIONS);
    if (lib && ctx.prd) {
      const yes = affirmed(ctx.prd);
      for (const p of picksIn(lib.objective)) {
        const cat = LIBRARY_SECTIONS.find((s) => s.id === p.id)?.category ?? "";
        const words = CATEGORY_WORDS[cat];
        if (words && words.test(ctx.prd) && !words.test(yes)) problems.push(`"${ADD_SECTIONS}" adds ${p.id}, which the PRD only mentions to rule out`);
      }
    }
    if (ctx.scope.noRemoteAssets && m) {
      const remote = Object.entries(m.seed).flatMap(([k, rows]) => rows.flatMap((r) => Object.entries(r).filter(([, v]) => typeof v === "string" && /^https?:\/\//i.test(v)).map(([f, v]) => `${k}.${f} ${String(v).slice(0, 60)}`)));
      if (remote.length) problems.push(`Records use remote URLs the PRD rules out at runtime: ${remote.slice(0, 4).join("; ")}${remote.length > 4 ? ` and ${remote.length - 4} more` : ""}`);
    }
    add(9, "Excluded capabilities: nothing the PRD rules out", problems);
  }

  // 10. Runtime state: every field of the state the PRD specifies, with one owner.
  {
    const problems: string[] = [];
    // Accounted for means in the owners statement, not merely quoted from the PRD somewhere in a step.
    const owners = norm([...plan.assumptions, ...plan.tasks.map((t) => t.objective)].flatMap((x) => x.split("\n")).filter((l) => l.includes("Data owners (one each")).join("\n"));
    for (const st of ctx.scope.state) {
      if (!owners.includes(norm(st.name))) problems.push(`The plan doesn't give the PRD's ${st.name} an owner`);
      for (const f of st.fields) if (!owners.includes(norm(f))) problems.push(`The owners statement doesn't account for "${f}" (${st.name})`);
    }
    add(10, "Runtime state: the PRD's state, one shared owner", problems);
  }

  // 11. Tests agree with the records: what a search finds, the filter values that exist, how many records there are.
  {
    const problems: string[] = [];
    if (m) {
      for (const i of ctx.items ?? []) {
        for (const t of i.tests ?? []) {
          const said = `"${t.behaviour} → ${t.expect}"`;
          for (const e of m.entities) {
            const rows = m.seed[e.key] ?? [];
            const titles = rows.map((r) => String(r[e.titleField] ?? ""));
            const values = new Set(rows.flatMap((r) => e.fields.filter((f) => f.type === "select").map((f) => String(r[f.key] ?? "").toLowerCase())));
            const options = new Set(e.fields.flatMap((f) => (f.options ?? []).map((o) => o.toLowerCase())));
            const search = /\b(search(es)?(\s+for)?|type|enter)\s+['"‘“]/i.test(t.behaviour) ? quoted(t.behaviour)[0] : undefined;
            if (search && titles.length > 1) {
              const found = titles.filter((x) => x.toLowerCase().includes(search.toLowerCase()));
              const named = titles.filter((x) => x && norm(t.expect).includes(norm(x)));
              const wrong = named.filter((x) => !found.includes(x));
              if (wrong.length) problems.push(`${said}: searching "${search}" doesn't find ${wrong.join(", ")} in the records`);
              if (!found.length && (options.has(search.toLowerCase()) || values.has(search.toLowerCase()))) problems.push(`${said}: "${search}" is a ${e.label.toLowerCase()} category, not a title the search matches`);
            }
            const pick = /\b(select|filter|choose|pick|tap|click)\b/i.test(t.behaviour) && /\b(filter|category|dropdown|tab|chip)\b/i.test(t.behaviour) ? quoted(t.behaviour)[0] : undefined;
            // The field the test names ("category dropdown"), or every select field when it names none.
            const named = e.fields.filter((f) => f.type === "select" && new RegExp(`\\b(${f.label}|${f.key})\\b`, "i").test(t.behaviour));
            const fieldOptions = new Set((named.length ? named : e.fields).flatMap((f) => (f.options ?? []).map((o) => o.toLowerCase())));
            if (pick && fieldOptions.size && !fieldOptions.has(pick.toLowerCase()) && !/^all$/i.test(pick)) problems.push(`${said}: "${pick}" isn't one of the ${named.length ? named.map((f) => f.label.toLowerCase()).join("/") : e.label.toLowerCase()} options (${[...fieldOptions].join(", ")})`);
            const count = new RegExp(`\\b(\\d+|${Object.keys(NUMBERS).join("|")})\\s+(?:\\w+\\s+)?(${e.plural.toLowerCase()}|${e.label.toLowerCase()}s?|records)\\b`, "i").exec(t.expect);
            if (count && rows.length) {
              const n = Number(count[1]) || NUMBERS[count[1]!.toLowerCase()]!;
              const label = new RegExp(`\\b(${e.label}|${e.plural})\\b`, "i").test(count[0]);
              if (label && n > rows.length) problems.push(`${said}: ${n} ${e.plural.toLowerCase()}, but the records have ${rows.length}`);
              if (label && pick && options.has(pick.toLowerCase())) {
                const f = e.fields.find((x) => (x.options ?? []).some((o) => o.toLowerCase() === pick.toLowerCase()))!;
                const has = rows.filter((r) => String(r[f.key] ?? "").toLowerCase() === pick.toLowerCase()).length;
                if (has !== n) problems.push(`${said}: the records have ${has} ${pick}, not ${n}`);
              }
            }
          }
        }
      }
      // Exact text a step requires must be in the PRD or the records.
      for (const t of plan.tasks) for (const c of t.acceptanceCriteria) if (c.check.type === "file_contains" && /^src\/acceptance\//.test(c.check.path) && !/^[\d\s.,+\-−×÷*/=%()$€£]+$/.test(c.check.text) && !corpus.includes(norm(c.check.text))) problems.push(`"${t.title}" requires "${c.check.text}" as on-screen text, which neither the PRD nor the records say`);
    }
    add(11, "Acceptance tests agree with the PRD's records", problems);
  }

  // 12. The Look: the PRD's own direction proposed, and no exact colour the PRD doesn't give required.
  {
    const problems: string[] = [];
    const lookLine = plan.assumptions.find((a) => a.startsWith("Look:")) ?? "";
    if (ctx.scope.look && !/PRD's own direction/.test(lookLine) && ctx.look?.state !== "selected") problems.push(`The PRD gives a visual direction${ctx.scope.look.concept ? ` ("${ctx.scope.look.concept}")` : ""}, and the plan doesn't propose it: "${lookLine.slice(0, 160)}"`);
    for (const t of plan.tasks) for (const hex of t.objective.match(/→ the app shows "[^"]*#[0-9a-f]{3,8}\b[^"]*"/gi) ?? []) if (!corpus.includes(hex.toLowerCase())) problems.push(`"${t.title}" requires an exact colour the PRD doesn't give (${hex})`);
    add(12, "Look: the PRD's visual direction, no invented exact values", problems);
  }
  return out;
}

/** The compliance findings as the plan carries them: a failing hard check makes the plan not approval-ready. */
export const hardContradictions = (checks: PlanCheck[]) => checks.filter((c) => c.hard && !c.ok);
