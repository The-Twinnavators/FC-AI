/**
 * Decision log: who decided what, when, and why, for the decisions that change what FlowCode does. Approvals and
 * denials, settings, model choices, prompt and skill edits, recoveries, rollbacks, run control and improvement
 * proposals. Entries name what changed (setting names, model names), never secret values or file contents.
 *
 * Stored in settings ("decisions.v1"), newest last, capped. No schema change.
 */
import type { App } from "../app.js";

export type DecisionKind = "approval" | "settings" | "model" | "prompt_skill" | "recovery" | "rollback" | "run_control" | "improvement";

export interface Decision {
  id: string;
  at: string;
  kind: DecisionKind;
  actor: "user" | "flowcode";
  summary: string;
  reason?: string;
  projectId?: string;
  runId?: string;
  /** Where the change can be inspected (an approval id, a route, an event). */
  ref?: string;
  outcome?: string;
}

export const DECISIONS_KEY = "decisions.v1";
const CAP = 2000;
/** Body keys whose values are never recorded (only that they changed). */
const SECRET = /key|token|secret|password|credential|auth/i;

export function logDecision(app: App, d: Omit<Decision, "id" | "at"> & { at?: string }): Decision {
  const entry: Decision = { id: `dec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, at: d.at ?? new Date().toISOString(), ...d };
  const all = app.store.getSetting<Decision[]>(DECISIONS_KEY, []);
  all.push(entry);
  app.store.setSetting(DECISIONS_KEY, all.slice(-CAP));
  return entry;
}

export function listDecisions(app: App, filter: { projectId?: string; runId?: string; kind?: string; limit?: number } = {}): Decision[] {
  return app.store
    .getSetting<Decision[]>(DECISIONS_KEY, [])
    .filter((d) => (!filter.projectId || d.projectId === filter.projectId) && (!filter.runId || d.runId === filter.runId) && (!filter.kind || d.kind === filter.kind))
    .slice(-(filter.limit ?? 300))
    .reverse();
}

/** Names of the settings a request changes; values only for plain, non-secret scalars. */
export function describeBody(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    if (SECRET.test(k)) parts.push(`${k} (changed)`);
    else if (typeof v === "boolean" || typeof v === "number" || (typeof v === "string" && v.length <= 60 && !SECRET.test(v))) parts.push(`${k}: ${String(v)}`);
    else if (v && typeof v === "object" && !Array.isArray(v)) parts.push(`${k}: ${Object.keys(v as object).slice(0, 6).join(", ")}`);
    else parts.push(k);
  }
  return parts.join("; ").slice(0, 300);
}

/** User actions through the API that are decisions, by route. The handler's success is what gets recorded. */
const GOVERNED: Record<string, { kind: DecisionKind; summary: (p: Record<string, string>, body: unknown) => string }> = {
  "POST /settings": { kind: "settings", summary: (_p, b) => `Changed default settings (${describeBody(b)})` },
  "POST /settings/runtime": { kind: "settings", summary: (_p, b) => `Changed run options (${describeBody(b)})` },
  "POST /web/settings": { kind: "settings", summary: (_p, b) => `Changed web search settings (${describeBody(b)})` },
  "POST /projects/:id/settings": { kind: "settings", summary: (_p, b) => `Changed project settings (${describeBody(b)})` },
  "POST /models/roles": { kind: "model", summary: (_p, b) => `Changed model roles (${describeBody(b)})` },
  "POST /models/providers": { kind: "model", summary: () => "Changed a model provider" },
  "POST /models/cloud-coder": { kind: "model", summary: (_p, b) => `Changed the cloud coder (${describeBody(b)})` },
  "POST /models/cloud-coder/provider": { kind: "model", summary: (_p, b) => `Changed the cloud provider (${describeBody(b)})` },
  "POST /models/cloud-coder/key": { kind: "model", summary: () => "Saved a cloud API key (value not recorded)" },
  "POST /models/cloud-coder/key/remove": { kind: "model", summary: () => "Removed a cloud API key" },
  "POST /models/design-model": { kind: "model", summary: (_p, b) => `Changed the design model (${describeBody(b)})` },
  "POST /runs/:id/coder": { kind: "model", summary: (_p, b) => `Switched this build's coder (${describeBody(b)})` },
  "POST /prompts": { kind: "prompt_skill", summary: (_p, b) => `Saved a prompt${(b as { id?: string })?.id ? ` (${(b as { id: string }).id})` : ""}` },
  "POST /skills": { kind: "prompt_skill", summary: (_p, b) => `Saved a skill${(b as { id?: string })?.id ? ` (${(b as { id: string }).id})` : ""}` },
  "POST /skills/:id/delete": { kind: "prompt_skill", summary: (p) => `Deleted skill ${p.id}` },
  "POST /fix-memory/:id/promote": { kind: "prompt_skill", summary: (p) => `Promoted a fix to a skill (${p.id})` },
  "POST /runs/:id/tasks/:taskId/rollback": { kind: "rollback", summary: (p) => `Undid a step's changes (${p.taskId})` },
  "POST /runs/:id/tasks/:taskId/retry": { kind: "recovery", summary: (p, b) => `Retried a step (${p.taskId})${(b as { guidance?: string })?.guidance ? " with guidance" : ""}` },
  "POST /projects/:id/screens/:screenId/spec": { kind: "prompt_skill", summary: (p) => `Saved the screen spec for "${p.screenId}"` },
  "POST /runs/:id/cancel": { kind: "run_control", summary: () => "Cancelled the build" },
  "POST /runs/:id/resume": { kind: "run_control", summary: () => "Resumed the build" },
  "POST /runs/:id/pause": { kind: "run_control", summary: () => "Paused the build" },
  "POST /runs/:id/unpause": { kind: "run_control", summary: () => "Continued the build" },
};

export function governedRoute(spec: string) {
  return GOVERNED[spec];
}

/** Records FlowCode's own recoveries from the event stream. */
export function watchDecisions(app: App) {
  return app.bus.subscribe((e) => {
    if (e.type !== "recovery.action") return;
    try {
      logDecision(app, { kind: "recovery", actor: "flowcode", summary: e.message.slice(0, 300), ...(e.projectId ? { projectId: e.projectId } : {}), ...(e.runId ? { runId: e.runId } : {}), ref: `event:${e.id}` });
    } catch {
      // The log never affects the run.
    }
  });
}
