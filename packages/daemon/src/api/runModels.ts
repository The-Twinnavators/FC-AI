/**
 * Models and data for one build (VUS-01/B1): which model did each job, whether it ran on this computer, and exactly what
 * left it. Built only from the run's recorded model calls (model.requested events) and its assignments, never assumed.
 */
import type { App } from "../app.js";

export interface RunModelUse {
  role: string;
  model: string;
  providerId: string;
  hosted: boolean;
  calls: number;
  /** Calls that carried screenshots or other images. */
  imageCalls: number;
  /** Calls recorded before FlowCode noted images (7 Oct 2026): whether they carried screenshots isn't known. */
  unknownCalls: number;
  steps: string[];
}
export interface RunModels {
  runId: string;
  /** The models the build was set up with (before it ran). */
  assigned: Array<{ role: string; model: string; providerId: string; hosted: boolean }>;
  used: RunModelUse[];
  /** One plain sentence: everything stayed here, or what went where. */
  summary: string;
  leftThisComputer: boolean;
}

const isHosted = (providerId: string) => providerId.startsWith("hosted");

export function runModels(app: App, runId: string): RunModels {
  const run = app.store.runs.require(runId);
  const evs = app.db.all<{ task_id: string | null; data: string }>("SELECT task_id, data FROM events WHERE run_id = ? AND type = 'model.requested' ORDER BY seq ASC", runId);
  const titles = new Map(app.store.tasks.where("run_id = ?", runId).map((t) => [t.id, t.title]));
  const byKey = new Map<string, RunModelUse>();
  for (const e of evs) {
    let d: { role?: string; providerId?: string; model?: string; images?: boolean } = {};
    try {
      // The stored row is the whole event ({ message, data }); the call's details are in its data.
      const row = JSON.parse(e.data) as { data?: typeof d } & typeof d;
      d = row.data ?? row;
    } catch {
      continue;
    }
    if (!d.providerId || !d.model) continue;
    const role = d.role ?? "agent";
    const key = `${role}|${d.providerId}|${d.model}`;
    const u = byKey.get(key) ?? { role, model: d.model, providerId: d.providerId, hosted: isHosted(d.providerId), calls: 0, imageCalls: 0, unknownCalls: 0, steps: [] };
    u.calls++;
    if (d.images === undefined) u.unknownCalls++;
    else if (d.images) u.imageCalls++;
    const step = e.task_id ? titles.get(e.task_id) : undefined;
    if (step && !u.steps.includes(step)) u.steps.push(step);
    byKey.set(key, u);
  }
  const used = [...byKey.values()].sort((a, b) => Number(b.hosted) - Number(a.hosted) || b.calls - a.calls);
  const assigned = Object.entries(run.modelAssignments ?? {})
    .filter((e): e is [string, { providerId: string; model: string }] => !!e[1])
    .map(([role, a]) => ({ role, model: a.model, providerId: a.providerId, hosted: isHosted(a.providerId) }));
  const hosted = used.filter((u) => u.hosted);
  const leftThisComputer = hosted.length > 0;
  const summary = !used.length
    ? "No model calls recorded for this build yet."
    : !leftThisComputer
      ? "Everything ran on this computer. Nothing was sent to a cloud provider."
      : `Sent to the cloud: ${hosted
          .map((u) => `${u.role} (${u.model}): ${u.calls} call${u.calls === 1 ? "" : "s"}${u.imageCalls ? `, ${u.imageCalls} with screenshots` : ""}${u.unknownCalls ? ` (${u.unknownCalls === u.calls ? "whether they included screenshots" : `for ${u.unknownCalls}, whether screenshots were included`} wasn't recorded before 7 Oct)` : ""}`)
          .join("; ")}. Everything else ran on this computer.`;
  return { runId, assigned, used, summary, leftThisComputer };
}
