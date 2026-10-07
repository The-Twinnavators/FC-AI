/**
 * The Prototype plan view: what a spec build follows. It is the plan FlowCode stored when it wrote the build from the
 * PRD (`lrcPlan:<projectId>`, lrcPlan.ts): code items grouped into build steps, each with the PRD requirements it
 * covers and its acceptance tests, plus the items a person checks and the ones left for later or for the real app.
 * Each step shows its live status from the build's task.
 */
import type { Task } from "@flowcode/contracts";
import type { App } from "../app.js";
import { fromTask, requirementCounts, type LrcStatus } from "./launchReadiness.js";
import { planKey, stepOrder, type AcceptanceTest, type LrcPlan, type PlanItem } from "./lrcPlan.js";

export interface PlanViewItem {
  id: string;
  title: string;
  description: string;
  section: string;
  /** The PRD requirements it covers, quoted. */
  covers: Array<{ id: string; text: string }>;
  tests: AcceptanceTest[];
  files: string[];
}
export interface PlanViewStep {
  key: string;
  n: number;
  title: string;
  /** Setup steps (starter, imports, review, assembly) come with every build; feature steps come from the PRD. */
  kind: "setup" | "feature";
  status: LrcStatus;
  /** The build task's own status and what it says, once the step exists. */
  taskStatus?: Task["status"];
  evidence: string;
  runId?: string;
  taskId?: string;
  items: PlanViewItem[];
}
export interface PlanViewNote {
  id: string;
  title: string;
  description: string;
  section: string;
  covers: Array<{ id: string; text: string }>;
  /** For "later" items: why it isn't in the prototype. */
  reason?: string;
  /** True when it is left for the real app (the Launch readiness checklist lists it), not a later release. */
  realApp?: boolean;
}
export interface PlanView {
  projectId: string;
  hasPlan: boolean;
  runId?: string;
  createdAt?: string;
  requirements?: { total: number; inSteps: number; forPeople: number; later: number; filledIn: number };
  steps: PlanViewStep[];
  /** A person checks the prototype against these. */
  review: PlanViewNote[];
  /** Not for this release, or for the real app only. */
  later: PlanViewNote[];
}

const cleanDescription = (d: string) => d.replace(/ Covers [^.]*\.$/, "");

/** The stored plan as steps and notes; `taskOf` finds a step's build task (pure, so it can be tested without a store). */
export function planView(projectId: string, plan: LrcPlan | null, taskOf: (taskId: string) => Task | undefined): PlanView {
  if (!plan) return { projectId, hasPlan: false, steps: [], review: [], later: [] };
  const reqText = new Map(plan.requirements.map((r) => [r.id, r.text]));
  const covers = (i: PlanItem) => i.covers.map((id) => ({ id, text: reqText.get(id) ?? "" }));
  const order = stepOrder(plan.items);
  const steps = new Map<string, PlanViewStep>();
  for (const i of plan.items) {
    if (i.executionType !== "code" || !i.stepKey) continue;
    let step = steps.get(i.stepKey);
    if (!step) {
      const task = i.taskId ? taskOf(i.taskId) : undefined;
      const v = task ? fromTask(task) : { status: "not_started" as const, evidence: "Starts when the build reaches it" };
      step = { key: i.stepKey, n: order.get(i.stepKey) ?? steps.size + 1, title: task?.title ?? i.title, kind: i.categoryId.startsWith("spec.") ? "feature" : "setup", status: v.status, taskStatus: task?.status, evidence: v.evidence, runId: task?.runId, taskId: task?.id, items: [] };
      steps.set(i.stepKey, step);
    }
    step.items.push({ id: i.id, title: i.title, description: cleanDescription(i.description), section: i.categoryTitle, covers: covers(i), tests: i.tests ?? [], files: i.files.filter((f) => !f.endsWith("/")) });
  }
  // A step that builds several items shows them all in its title when the task doesn't exist yet.
  for (const s of steps.values()) if (!s.taskId && s.items.length > 1) s.title = s.items.map((x) => x.title).join(", ");
  const note = (i: PlanItem): PlanViewNote => ({ id: i.id, title: i.title, description: i.description, section: i.categoryTitle, covers: covers(i), ...(i.later ? { reason: i.later, realApp: /real app|real product/i.test(i.later) } : {}) });
  return {
    projectId,
    hasPlan: true,
    runId: plan.runId,
    createdAt: plan.createdAt,
    requirements: requirementCounts(plan),
    steps: [...steps.values()].sort((a, b) => a.n - b.n),
    review: plan.items.filter((i) => i.executionType !== "code" && !i.later).map(note),
    later: plan.items.filter((i) => i.later).map(note),
  };
}

/** GET /projects/:id/plan */
export function prototypePlan(app: App, projectId: string): PlanView {
  app.store.projects.require(projectId);
  return planView(projectId, app.store.getSetting<LrcPlan | null>(planKey(projectId), null), (id) => app.store.tasks.get(id));
}
