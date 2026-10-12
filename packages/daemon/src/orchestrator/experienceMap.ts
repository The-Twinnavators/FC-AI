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
  what can go wrong, and how they recover. List the requirement IDs (R1, R2...) each workflow serves. Use only the
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

export function experienceRequest(objective: string, prd: string, plan: ScreenPlan, requirements: Requirement[]): string {
  return [
    `Product: ${plan.product}`,
    `Request: ${objective.slice(0, 800)}`,
    `Planned screens:\n${plan.screens.map((s) => `- ${s.label}: ${s.purpose}`).join("\n")}`,
    `Requirements:\n${requirements.slice(0, 120).map((r) => `${r.id} [${r.section || "Requirements"}]: ${r.text.slice(0, 200)}`).join("\n")}`,
    `PRD (people, goals, journeys, screens):\n${prd}`,
  ].join("\n\n");
}

const text = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const list = (v: unknown) => (Array.isArray(v) ? (v as unknown[]) : []);

/** The model's map, kept to the planned screens and the PRD's real requirement IDs. */
export function parseExperienceMap(raw: unknown, plan: ScreenPlan, requirementIds: string[]): ExperienceMap {
  const r = (raw ?? {}) as Record<string, unknown>;
  const screenOf = (name: unknown) => {
    const n = text(name, 60).toLowerCase().replace(/\s+(screen|page)$/, "");
    return plan.screens.find((s) => s.label.toLowerCase() === n)?.label ?? plan.screens.find((s) => n && (n.includes(s.label.toLowerCase()) || s.label.toLowerCase().includes(n)))?.label;
  };
  const ids = new Set(requirementIds);
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
      requirementIds: [...new Set(list(w.requirementIds).map((x) => text(x, 10).toUpperCase()).filter((x) => ids.has(x)))],
    });
  });
  return {
    roles: list(r.roles).map((x) => x as Record<string, unknown>).map((x) => ({ name: text(x.name, 60), goals: list(x.goals).map((g) => text(g, 160)).filter(Boolean).slice(0, 6) })).filter((x) => x.name).slice(0, 6),
    workflows: workflows.slice(0, 10),
    data: list(r.data).map((x) => x as Record<string, unknown>).map((x) => ({ entity: text(x.entity, 60), fields: list(x.fields).map((f) => text(f, 40)).filter(Boolean).slice(0, 15), screens: list(x.screens).map((s) => screenOf(s)).filter((s): s is string => !!s) })).filter((x) => x.entity).slice(0, 10),
    permissions: list(r.permissions).map((p) => text(p, 200)).filter(Boolean).slice(0, 10),
  };
}

export type CoverageStatus = "planned" | "no workflow" | "for a person to check" | "not in this release" | "unplaced";
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
    const flows = (map?.workflows ?? []).filter((w) => w.requirementIds.includes(r.id));
    const pages = [...new Set(flows.flatMap((w) => [w.entry, ...w.steps.map((s) => s.screen)]))];
    const code = its.find((i) => i.executionType === "code" && !i.later);
    const later = its.find((i) => i.later);
    const review = its.find((i) => i.executionType !== "code" && !i.later);
    const tests = its.flatMap((i) => i.tests ?? []);
    const status: CoverageStatus = later ? "not in this release" : code ? (flows.length || !map?.workflows.length ? "planned" : "no workflow") : review ? "for a person to check" : "unplaced";
    return {
      requirement: r.id,
      text: r.text.slice(0, 200),
      workflows: flows.map((w) => w.name),
      pages,
      behavior: tests.length ? tests.map((t) => `${t.behaviour} → ${t.expect}`).join("; ").slice(0, 300) : (code?.title ?? review?.title ?? ""),
      verification: code ? `${tests.length ? `acceptance tests in step "${code.title}"` : `step "${code.title}"`}${flows.length ? `; journey test for ${flows.map((w) => `"${w.name}"`).join(", ")}` : ""}` : review ? "a person checks it at review" : later ? `left out: ${later.later}` : "none",
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
    ...map.workflows.map((w) => `- "${w.name}": starts on ${w.entry}; ${w.steps.map((s) => `${s.screen}: ${s.action} → ${s.result}`).join("; ")}${w.success ? `; success: ${w.success}` : ""}`),
  ].join("\n");
}

/** The map as the design and build steps read it: the journeys they must make work end to end. */
export function experienceNote(map: ExperienceMap): string {
  if (!map.workflows.length) return "";
  return [
    "User journeys this prototype must support end to end (the screens link so each can be completed, with the same sample data throughout):",
    ...map.workflows.map((w) =>
      [
        `## ${w.name} (${w.role || "user"}; starts on ${w.entry}${w.requirementIds.length ? `; ${w.requirementIds.join(", ")}` : ""})`,
        ...w.steps.map((s, i) => `${i + 1}. ${s.screen}: ${s.action} → ${s.result}`),
        w.success ? `Success: ${w.success}` : "",
        w.failure ? `If it goes wrong: ${w.failure}${w.recovery ? ` → ${w.recovery}` : ""}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ].join("\n\n");
}
