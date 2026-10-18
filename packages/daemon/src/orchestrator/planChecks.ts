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

export const planChecksKey = (runId: string) => `planChecks:${runId}`;

export interface PlanCheck {
  id: 1 | 2 | 3 | 4 | 5 | 6;
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
}

const norm = (s: string) => s.toLowerCase().replace(/["“”'‘’`]/g, "").replace(/\s+/g, " ");
const FUNNEL = new Set(["navigation", "hero", "cta", "footer"]);
const features = (p: ImplementationPlan) => p.tasks.filter((t) => /^(m|lrc)_/.test(t.key) && t.key !== "m_assemble" && t.role === "coder");

export function planChecks(plan: ImplementationPlan, ctx: PlanCheckContext): PlanCheck[] {
  const all = plan.tasks;
  const text = (t: PlanTask) => `${t.title}\n${t.objective}`;
  const checks: PlanCheck[] = [];

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
  return checks;
}

/** What only a person can judge, whatever the checks say. */
export const HUMAN_REVIEW = [
  "Whether the planner's own journeys and step wording read right (the checks prove structure, not prose)",
  "Whether the Home composition and the proposed Home directions fit the brand (a chosen full-page Home design keeps its own sections)",
  "Whether outcome tests check the right thing once written (the plan only says what to observe)",
];
