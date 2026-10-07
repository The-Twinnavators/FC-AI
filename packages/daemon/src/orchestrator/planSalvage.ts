/**
 * Plan salvage. Small local models often run out of room mid-plan, so the reply stops halfway through the task list
 * and isn't valid JSON. Instead of failing (and making the user wait for another slow attempt), keep every task that
 * was written completely, fill the plan's other fields with safe defaults, and drop dependencies on tasks that were
 * cut off. Returns undefined when fewer than `minTasks` complete tasks survive.
 */
import { ImplementationPlan } from "@flowcode/contracts";

/** Complete JSON objects in an array that may be cut off: scans brackets, respecting strings. */
function completeObjects(text: string, start: number): string[] {
  const out: string[] = [];
  let depth = 0;
  let inStr = false;
  let esc = false;
  let objStart = -1;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") {
      if (depth === 0) objStart = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && objStart >= 0) {
        out.push(text.slice(objStart, i + 1));
        objStart = -1;
      }
      if (depth < 0) break;
    } else if (ch === "]" && depth === 0) break;
  }
  return out;
}

export function salvagePlan(text: string, minTasks = 2): ImplementationPlan | undefined {
  const at = text.search(/"tasks"\s*:\s*\[/);
  if (at < 0) return undefined;
  const arrayStart = text.indexOf("[", at) + 1;
  const tasks = completeObjects(text, arrayStart)
    .map((s) => {
      try {
        return JSON.parse(s) as Record<string, unknown>;
      } catch {
        return undefined;
      }
    })
    .filter((t): t is Record<string, unknown> => !!t && typeof t.key === "string" && typeof t.title === "string");
  if (tasks.length < minTasks) return undefined;
  const keys = new Set(tasks.map((t) => t.key as string));
  for (const t of tasks) t.dependsOn = Array.isArray(t.dependsOn) ? (t.dependsOn as unknown[]).filter((d) => typeof d === "string" && keys.has(d)) : [];

  // Top-level fields written before "tasks" (goal, assumptions…), when they parse.
  let head: Record<string, unknown> = {};
  const before = text.slice(text.indexOf("{"), at).replace(/,\s*$/, "");
  try {
    head = JSON.parse(`${before}}`) as Record<string, unknown>;
  } catch {
    /* defaults below */
  }
  const parsed = ImplementationPlan.safeParse({
    goal: "",
    assumptions: [],
    relevantFiles: [],
    expectedChanges: [],
    risk: "medium",
    riskNotes: [],
    validationPlan: [],
    rollbackStrategy: "Every file change is snapshotted; restore the checkpoint taken when the plan was approved.",
    ...head,
    tasks,
  });
  if (!parsed.success) return undefined;
  const plan = parsed.data;
  plan.assumptions = [...plan.assumptions, `The planner's reply was cut off; FlowCode kept the ${tasks.length} complete step(s).`];
  return plan;
}
