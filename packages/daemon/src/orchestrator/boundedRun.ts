/**
 * A bounded run: the person names the steps to run, and the runner runs only those and stops on its own. It is
 * enforced in the run loop before any step starts (not by a pause that has to land in time): a step outside the bound
 * never starts, whatever else is ready. The run stops when every step in the bound is done, when one of them is stuck
 * (blocked or failed once its bounded attempts are used, or stopped for the person's choice), or when one is split
 * (its parts are new work: a later command names them). While bounded, FlowCode doesn't release other steps around a
 * stuck one. The bound is kept in the database, so a restart or Continue can't run past it; clearing it is its own
 * action.
 *
 * Frameproof main build: the design proof had to stop after its third screen and before "My Selection". Pausing
 * during a step was the only control, and a step that stopped quickly (a fit refusal) would have let the next one
 * start; when a stuck step's neighbour changes different files, the runner releases it, so a blocked Photo detail
 * would have started My Selection.
 */
import type { Task } from "@flowcode/contracts";

export interface RunBound {
  /** The steps this command may run (ids), in the order named. */
  taskIds: string[];
  titles: string[];
  declaredAt: string;
  by: "user" | "system";
  /** The last stop at the boundary. */
  stop?: { at: string; reason: string; next?: string };
}

export const runBoundKey = (runId: string) => `runBound:${runId}`;

const quote = (t: Task) => `"${t.title}"`;

/** Why a bounded command can't run these steps (undefined: it can). */
export function boundProblem(taskIds: string[], tasks: Task[]): string | undefined {
  if (!taskIds.length) return "Name at least one step to run";
  if (new Set(taskIds).size !== taskIds.length) return "A step is named twice";
  const byId = new Map(tasks.map((t) => [t.id, t]));
  for (const id of taskIds) {
    const t = byId.get(id);
    if (!t) return `There is no step ${id} in this build`;
    if (t.status === "verified") return `${quote(t)} is already done`;
    if (t.status === "skipped") return `${quote(t)} was replaced${t.blocker?.evidenceRefs.length ? " by smaller steps: name those instead" : ""}`;
    if (t.status === "running" || t.status === "awaiting_approval") return `${quote(t)} is running now`;
    // Its prerequisites must be done already or run by this command (in an order that works).
    for (const d of t.dependsOn) {
      const dep = byId.get(d);
      if (!dep || dep.status === "verified" || dep.status === "skipped") continue;
      if (!taskIds.includes(d)) return `${quote(t)} needs ${quote(dep)} first, which isn't done and isn't named`;
    }
  }
  return undefined;
}

/** Why the runner stops here instead of starting `next` (the next ready step within the bound); undefined: start it. */
export function boundaryStop(bound: RunBound, tasks: Task[], next: Task | undefined): string | undefined {
  const mine = bound.taskIds.map((id) => tasks.find((t) => t.id === id)).filter((t): t is Task => !!t);
  const stuck = mine.find((t) => t.status === "blocked" || t.status === "failed");
  if (stuck) return `${quote(stuck)} stopped (${(stuck.blocker?.reason ?? stuck.status).slice(0, 240)}), so the bounded run ends here`;
  const split = mine.find((t) => t.status === "skipped" && t.blocker?.evidenceRefs.length);
  if (split) {
    const parts = split.blocker!.evidenceRefs.map((id) => tasks.find((t) => t.id === id)).filter((t): t is Task => !!t);
    return `${quote(split)} was split into ${parts.length} smaller steps (${parts.map(quote).join(", ")}); they run when you name them`;
  }
  if (next) return undefined;
  if (mine.every((t) => t.status === "verified")) return `every step it named is done (${mine.map(quote).join(", ")})`;
  const waiting = mine.find((t) => t.status !== "verified");
  return `nothing it named can start${waiting ? ` (${quote(waiting)} is ${waiting.status})` : ""}`;
}
