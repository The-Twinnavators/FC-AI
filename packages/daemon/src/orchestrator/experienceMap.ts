/**
 * The experience map: the PRD turned into who uses the app and the journeys they take through it, before any page is
 * designed. Each workflow has an entry point, its steps (on which screen, doing what, seeing what), the success
 * result, what goes wrong and how they recover, and the requirement IDs it serves. From it and the prototype plan,
 * FlowCode builds the coverage matrix deterministically: every requirement → its workflows → its pages → what it must
 * do → how it is verified → its status. A requirement the build means to code but no workflow carries is a scope
 * decision for the person at plan approval, never dropped quietly.
 */
import type { Requirement } from "../quality/spec.js";
import type { PlanItem } from "../quality/lrcPlan.js";
import type { ScreenPlan } from "./screenPlan.js";

export interface WorkflowStep {
  screen: string;
  action: string;
  result: string;
}
export interface Workflow {
  id: string;
  name: string;
  role: string;
  /** The screen the journey starts on. */
  entry: string;
  steps: WorkflowStep[];
  success: string;
  failure: string;
  recovery: string;
  requirementIds: string[];
  /** Who the person is when the journey starts (signed out as a visitor, signed in as a member). */
  start?: string;
  /** "flowcode": composed by FlowCode from the app model and the requirements (ensureSaveJourney), not the planner. */
  by?: "flowcode";
}
export interface ExperienceMap {
  roles: Array<{ name: string; goals: string[] }>;
  workflows: Workflow[];
  data: Array<{ entity: string; fields: string[]; screens: string[] }>;
  permissions: string[];
}

export const experienceKey = (runId: string) => `experienceMap:${runId}`;
export const coverageKey = (runId: string) => `coverage:${runId}`;
export const scopeKey = (runId: string) => `scopeDecisions:${runId}`;

export const EXPERIENCE_SYSTEM = `You map a product's experience before any screen is designed. From the PRD and its planned screens, write:
- roles: the kinds of people who use it, each with their goals, in the PRD's words;
- workflows: the journeys the prototype must support end to end. For each: a short name, the role, the entry screen,
  the steps in order (each on one planned screen: what the person does and what they then see), the success result,
  what can go wrong, and how they recover. List the requirement IDs each workflow serves, exactly as the Requirements
  list writes them: the PRD may number its own features (R1, F2, US-3...), and those are not these IDs. Use only the
  planned screens; every planned screen should appear in at least one workflow.
- data: the records the prototype shows (entity, its fields, the screens that show it);
- permissions: who may do what, only if the PRD says so (otherwise an empty list).
Don't invent features the PRD doesn't ask for. Answer with JSON only.`;

export const EXPERIENCE_SCHEMA = {
  type: "object",
  properties: {
    roles: { type: "array", items: { type: "object", properties: { name: { type: "string" }, goals: { type: "array", items: { type: "string" } } }, required: ["name", "goals"] } },
    workflows: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          role: { type: "string" },
          entry: { type: "string" },
          steps: { type: "array", items: { type: "object", properties: { screen: { type: "string" }, action: { type: "string" }, result: { type: "string" } }, required: ["screen", "action", "result"] } },
          success: { type: "string" },
          failure: { type: "string" },
          recovery: { type: "string" },
          requirementIds: { type: "array", items: { type: "string" } },
        },
        required: ["name", "role", "entry", "steps", "success", "requirementIds"],
      },
    },
    data: { type: "array", items: { type: "object", properties: { entity: { type: "string" }, fields: { type: "array", items: { type: "string" } }, screens: { type: "array", items: { type: "string" } } }, required: ["entity", "fields", "screens"] } },
    permissions: { type: "array", items: { type: "string" } },
  },
  required: ["roles", "workflows", "data", "permissions"],
};

/**
 * Requirements that hold on every page (accessibility, responsiveness, performance, privacy): no single journey carries
 * them; the checks every page gets (look check, contrast, keyboard, phone width) do.
 */
export const CROSS_CUTTING = /accessib|responsive|phone|tablet|mobile|screen size|performance|speed|load time|privacy|security|non-functional|quality attribute|usability|inclusive|localization|internationali/i;
export const isCrossCutting = (r: Pick<Requirement, "section" | "text">) => CROSS_CUTTING.test(r.section);

/**
 * Maps the IDs a planner cites to FlowCode's requirement IDs. A PRD often numbers its own features (its "R1" is FlowCode's
 * R26 when FlowCode's R1 is the document's title); a cited ID that isn't one of the valid ones is read as the PRD's own
 * numbering and becomes the requirements whose text starts with it.
 */
export function requirementIdMapper(requirements: Requirement[], valid: string[]): (cited: string) => string[] {
  const ok = new Set(valid);
  const own = new Map<string, string[]>();
  for (const r of requirements) {
    const m = /^\s*([A-Z]{1,3}-?\d{1,3})\b/i.exec(r.text);
    if (m && ok.has(r.id)) own.set(m[1]!.toUpperCase(), [...(own.get(m[1]!.toUpperCase()) ?? []), r.id]);
  }
  return (cited) => {
    const id = cited.trim().toUpperCase();
    return ok.has(id) ? [id] : own.get(id) ?? [];
  };
}

export function experienceRequest(objective: string, prd: string, plan: ScreenPlan, requirements: Requirement[], boundary = ""): string {
  return [
    `Product: ${plan.product}`,
    `Request: ${objective.slice(0, 800)}`,
    `Planned screens:\n${plan.screens.map((s) => `- ${s.label}: ${s.purpose}`).join("\n")}`,
    `Requirements:\n${requirements.slice(0, 120).map((r) => `${r.id} [${r.section || "Requirements"}]: ${r.text.slice(0, 200)}`).join("\n")}`,
    boundary,
    `PRD (people, goals, journeys, screens):\n${prd}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

const text = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const list = (v: unknown) => (Array.isArray(v) ? (v as unknown[]) : []);

/** The model's map, kept to the planned screens and the PRD's real requirement IDs. */
export function parseExperienceMap(raw: unknown, plan: ScreenPlan, requirementIds: string[], mapId?: (cited: string) => string[]): ExperienceMap {
  const r = (raw ?? {}) as Record<string, unknown>;
  const screenOf = (name: unknown) => {
    const n = text(name, 60).toLowerCase().replace(/\s+(screen|page)$/, "");
    return plan.screens.find((s) => s.label.toLowerCase() === n)?.label ?? plan.screens.find((s) => n && (n.includes(s.label.toLowerCase()) || s.label.toLowerCase().includes(n)))?.label;
  };
  const ids = new Set(requirementIds);
  const toIds = mapId ?? ((x: string) => (ids.has(x) ? [x] : []));
  const workflows: Workflow[] = [];
  list(r.workflows).forEach((w0, i) => {
    const w = w0 as Record<string, unknown>;
    const steps = list(w.steps)
      .map((x) => x as Record<string, unknown>)
      .map((x) => ({ screen: screenOf(x.screen) ?? "", action: text(x.action, 160), result: text(x.result, 160) }))
      .filter((x) => x.screen && x.action);
    const entry = screenOf(w.entry) ?? steps[0]?.screen;
    const name = text(w.name, 80);
    if (!name || !entry || !steps.length) return;
    workflows.push({
      id: `w${i + 1}`,
      name,
      role: text(w.role, 60),
      entry,
      steps: steps.slice(0, 10),
      success: text(w.success, 200),
      failure: text(w.failure, 200),
      recovery: text(w.recovery, 200),
      requirementIds: [...new Set(list(w.requirementIds).flatMap((x) => toIds(text(x, 10).toUpperCase())))],
    });
  });
  return {
    roles: list(r.roles).map((x) => x as Record<string, unknown>).map((x) => ({ name: text(x.name, 60), goals: list(x.goals).map((g) => text(g, 160)).filter(Boolean).slice(0, 6) })).filter((x) => x.name).slice(0, 6),
    workflows: workflows.slice(0, 10),
    data: list(r.data).map((x) => x as Record<string, unknown>).map((x) => ({ entity: text(x.entity, 60), fields: list(x.fields).map((f) => text(f, 40)).filter(Boolean).slice(0, 15), screens: list(x.screens).map((s) => screenOf(s)).filter((s): s is string => !!s) })).filter((x) => x.entity).slice(0, 10),
    permissions: list(r.permissions).map((p) => text(p, 200)).filter(Boolean).slice(0, 10),
  };
}

export type CoverageStatus = "planned" | "no workflow" | "for a person to check" | "supporting data" | "not in this release" | "unplaced";

/** The checklist category of requirements that describe records and sample data (planScope.ts: supporting data). */
export const SUPPORTING_DATA = "spec.supporting-data";
export interface CoverageRow {
  requirement: string;
  text: string;
  workflows: string[];
  pages: string[];
  behavior: string;
  verification: string;
  status: CoverageStatus;
}

/** The coverage matrix: every requirement, where it is carried, how it is checked, and whether anything is missing. */
export function coverageMatrix(requirements: Requirement[], items: PlanItem[], map: ExperienceMap | undefined): CoverageRow[] {
  return requirements.map((r) => {
    const its = items.filter((i) => i.covers.includes(r.id));
    // A journey carries a requirement it names, and the others built in the same plan item (one feature, several lines
    // of the PRD saying it).
    const siblings = new Set(its.flatMap((i) => i.covers));
    const flows = (map?.workflows ?? []).filter((w) => w.requirementIds.some((id) => id === r.id || siblings.has(id)));
    const everyPage = isCrossCutting(r);
    const pages = [...new Set(flows.flatMap((w) => [w.entry, ...w.steps.map((s) => s.screen)]))];
    const code = its.find((i) => i.executionType === "code" && !i.later);
    const later = its.find((i) => i.later);
    const review = its.find((i) => i.executionType !== "code" && !i.later);
    const data = its.find((i) => i.categoryId === SUPPORTING_DATA);
    const tests = its.flatMap((i) => i.tests ?? []);
    const status: CoverageStatus = later ? "not in this release" : code ? (flows.length || everyPage || !map?.workflows.length ? "planned" : "no workflow") : data ? "supporting data" : review ? "for a person to check" : "unplaced";
    return {
      requirement: r.id,
      text: r.text.slice(0, 200),
      workflows: flows.map((w) => w.name),
      pages,
      behavior: tests.length ? tests.map((t) => `${t.behaviour} → ${t.expect}`).join("; ").slice(0, 300) : (code?.title ?? review?.title ?? ""),
      verification: data && !code ? "the app model holds these records and fields; checked when the app is written from it" : code ? `${tests.length ? `acceptance tests in step "${code.title}"` : `step "${code.title}"`}${flows.length ? `; journey test for ${flows.map((w) => `"${w.name}"`).join(", ")}` : everyPage ? "; checked on every page (look check, contrast, keyboard, phone width)" : ""}` : review ? "a person checks it at review" : later ? `left out: ${later.later}` : "none",
      status,
    };
  });
}

/** Requirements the build means to code that no workflow carries, or that nothing places: decisions for the person. */
export function scopeDecisions(rows: CoverageRow[]): string[] {
  return rows
    .filter((r) => r.status === "no workflow" || r.status === "unplaced")
    .map((r) => (r.status === "unplaced" ? `${r.requirement} isn't placed in the plan: "${r.text.slice(0, 120)}". Build it, check it by hand, or leave it out of this release?` : `${r.requirement} is in the plan but no user journey covers it: "${r.text.slice(0, 120)}". Add it to a journey, or agree it is checked on its own?`));
}

export const JOURNEY_TESTS = "src/acceptance/journeys.test.tsx";

/**
 * What the assembly step adds when journeys are mapped: one test per journey that renders the whole App and clicks
 * through it the way the person would, so "every page exists" is not mistaken for "the journey works".
 */
export function journeyTestObjective(map: ExperienceMap): string {
  return [
    `Then write ${JOURNEY_TESTS}: one test per user journey below, each rendering <App /> (Testing Library, userEvent) from its entry screen and doing its steps in order through the real navigation (menu links, buttons, row links), checking after each step that the screen shows its result. Where a journey opens one record from a list, check the detail screen shows that same record (its name from the list), and that Back returns to the list. Use the app's own sample data; no mocks of the app's screens.`,
    ...map.workflows.map((w) => `- "${w.name}": starts on ${w.entry}${w.start ? ` (${w.start})` : ""}; ${w.steps.map((s) => `${s.screen}: ${s.action} → ${s.result}`).join("; ")}${w.success ? `; success: ${w.success}` : ""}`),
  ].join("\n");
}

/**
 * The release boundary as the planners read it: what this build leaves out, so no journey, page section or control is
 * planned for it (Build test 7 planned search, filter and sort sections the PRD put after the first release, and the
 * build then removed them).
 */
export function releaseBoundary(items: PlanItem[]): string {
  const later = items.filter((i) => i.later);
  if (!later.length) return "";
  return ["Not in this release (plan no journey, page section or control for these; the prototype leaves them out):", ...later.slice(0, 25).map((i) => `- ${i.title}`)].join("\n");
}

/** The map as the design and build steps read it: the journeys they must make work end to end. */
export function experienceNote(map: ExperienceMap): string {
  if (!map.workflows.length) return "";
  return [
    "User journeys this prototype must support end to end (the screens link so each can be completed, with the same sample data throughout):",
    ...map.workflows.map((w) =>
      [
        `## ${w.name} (${w.role || "user"}; starts on ${w.entry}${w.start ? `, ${w.start}` : ""}${w.requirementIds.length ? `; ${w.requirementIds.join(", ")}` : ""})`,
        ...w.steps.map((s, i) => `${i + 1}. ${s.screen}: ${s.action} → ${s.result}`),
        w.success ? `Success: ${w.success}` : "",
        w.failure ? `If it goes wrong: ${w.failure}${w.recovery ? ` → ${w.recovery}` : ""}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ].join("\n\n");
}

const SAVES = /\bsav(e|ed|es|ing)\b|\bbookmark|\bfavou?rite/i;
const PERSISTS = /\b(reload\w*|refresh\w*|still (saved|there)|kept|persist\w*|remember\w*|comes? back later)\b/i;
const UNSAVES = /\b(unsave|remove[sd]?|again removes|press(ing)? it again|toggle)\b/i;
const SIGN_IN = /\bsign(s|ed)?[ -]?in\b|\blog(s|ged)?[ -]?in\b/i;

/** The pages a save journey runs through, by the app's own labels. */
export interface SavePages {
  home?: string;
  search?: string;
  record: string;
  saved: string;
}

/** Whether a journey goes all the way: search, the record, save, the saved page, a reload, unsave, and who starts it. */
export function isCompleteSaveJourney(w: Workflow, p: SavePages): boolean {
  const on = (screen: string) => w.steps.some((s) => s.screen === screen);
  const did = (re: RegExp) => w.steps.some((s) => re.test(`${s.action} ${s.result}`));
  return !!w.start && (!p.search || on(p.search)) && on(p.record) && on(p.saved) && did(SAVES) && did(PERSISTS) && did(UNSAVES);
}

/**
 * The complete save journey, when the app saves things and the requirements ask for it: from the first page, search for a
 * real record, open it, save it (a visitor is asked to sign in first; signed in, it saves), see it on the saved page,
 * reload and still see it, then unsave it and see it gone, starting signed out when the app has visitors (Clean Cart
 * planning validation: the planner split this into four partial journeys, none starting from a stated sign-in state,
 * none with reload or unsave). FlowCode adds it to the map when no journey already does all of it; the planner's own
 * journeys stay.
 */
export function ensureSaveJourney(map: ExperienceMap, p: SavePages, requirements: Requirement[], roles: string[], sample?: string): { map: ExperienceMap; added: boolean } {
  const saving = requirements.filter((r) => SAVES.test(r.text));
  if (!saving.length || map.workflows.some((w) => isCompleteSaveJourney(w, p))) return { map, added: false };
  const visitor = roles.find((r) => /\b(visitor|guest|not signed in|signed out|anonymous)\b/i.test(r));
  const member = roles.find((r) => r !== visitor && /\b(member|signed in|account|user|shopper|customer)\b/i.test(r)) ?? roles.find((r) => r !== visitor) ?? "the person";
  const asksSignIn = !!visitor && requirements.some((r) => SIGN_IN.test(r.text) && SAVES.test(r.text));
  const thing = sample ? `"${sample}"` : "a real record from the sample data";
  const words = sample ? `part of ${thing}'s name` : "part of a real record's name";
  const steps: WorkflowStep[] = [
    ...(p.home && p.search ? [{ screen: p.home, action: `type ${words} into the search box and submit`, result: `${p.search} lists ${thing}` }] : []),
    ...(p.search ? [{ screen: p.search, action: `open ${thing} from the results`, result: `${p.record} shows ${thing} and its details` }] : []),
    ...(asksSignIn
      ? [
          { screen: p.record, action: "press Save while signed out", result: "the app asks the visitor to sign in; nothing is saved yet" },
          { screen: p.record, action: "sign in (the demo account, one tap)", result: `signed in as ${member}, still on ${thing}` },
        ]
      : []),
    { screen: p.record, action: "press Save", result: "the Save control shows it is saved" },
    { screen: p.saved, action: `open ${p.saved}`, result: `${thing} is listed` },
    { screen: p.saved, action: "reload the app (render it again: what was saved comes from this browser's storage)", result: `${thing} is still listed on ${p.saved}` },
    { screen: p.record, action: `open ${thing} from ${p.saved} and press Save again (unsave)`, result: "the Save control shows it is not saved" },
    { screen: p.saved, action: `open ${p.saved}`, result: `${thing} is no longer listed (the empty state when nothing else is saved)` },
  ];
  const covers = requirements.filter((r) => SAVES.test(r.text) || PERSISTS.test(r.text) || (UNSAVES.test(r.text) && SAVES.test(r.text)) || (asksSignIn && SIGN_IN.test(r.text)) || (p.search && /\bsearch/i.test(r.text) && /\b(home|result)/i.test(r.text)));
  const workflow: Workflow = {
    id: `w${map.workflows.length + 1}`,
    name: `Save and come back: search → ${p.record} → save${asksSignIn ? " (sign in)" : ""} → ${p.saved} → reload → unsave`,
    role: asksSignIn ? `${visitor}, then ${member}` : member,
    entry: steps[0]!.screen,
    start: asksSignIn ? `signed out as ${visitor}; signs in as ${member} at the Save step` : `signed in as ${member}`,
    steps,
    success: `${thing} is saved, survives a reload, and is gone from ${p.saved} after unsaving`,
    failure: asksSignIn ? "the visitor's Save is lost or saves without signing in" : "the saved record is gone after a reload",
    recovery: "sign in and press Save again",
    requirementIds: [...new Set(covers.map((r) => r.id))],
    by: "flowcode",
  };
  return { map: { ...map, workflows: [...map.workflows, workflow] }, added: true };
}
