/**
 * One model problem a day. Once a day, while no build is running, the Researcher agent looks into one of the repeated
 * model problems (System Health → Model problems), most frequent first: what the errors say, which roles and models
 * they hit, which models are installed. It writes a short diagnosis and one suggestion. Some suggestions come with a
 * change FlowCode can make for you (give a role a different installed model); nothing changes until you click Apply.
 * Local model only; no downloads, no settings changed on its own.
 */
import type { App } from "../app.js";
import type { AgentRole, ModelAssignment } from "@flowcode/contracts";
import { detectPatterns, type Pattern } from "../knowledge/skillProposals.js";
import { untrusted } from "../orchestrator/prompts.js";
import { logDecision } from "../governance/decisionLog.js";

const KEY = "modelProblems:solver";
const DAY = 86_400_000;
/** A problem isn't looked at again for a week (unless you ask). */
const COOLDOWN = 7 * DAY;
/** Roles a suggestion may switch to another installed model. */
const SWITCHABLE: AgentRole[] = ["planner", "coder", "debugger", "critic", "researcher", "documenter", "reviewer"];

export interface SolverAction {
  kind: "switch_model";
  role: AgentRole;
  model: string;
  label: string;
}
export interface SolverSuggestion {
  patternId: string;
  title: string;
  at: string;
  agent: "researcher";
  model: string;
  diagnosis: string;
  suggestion: string;
  /** False when nothing in FlowCode can fix it (e.g. topping up a cloud account). */
  fixableInFlowCode: boolean;
  action?: SolverAction;
  status: "new" | "applied" | "dismissed";
  decidedAt?: string;
}
interface State {
  lastRunAt?: string;
  running?: boolean;
  suggestions: Record<string, SolverSuggestion>;
}

const load = (app: App) => app.store.getSetting<State>(KEY, { suggestions: {} });
const save = (app: App, s: State) => app.store.setSetting(KEY, s);

/** The next problem to look into: most frequent first, skipping ones looked at in the last week. */
export function nextProblem(patterns: Pattern[], state: State, now = Date.now()): Pattern | undefined {
  return patterns
    .filter((p) => p.needsCodeFix)
    .filter((p) => {
      const s = state.suggestions[p.id];
      return !s || now - Date.parse(s.at) > COOLDOWN;
    })
    .sort((a, b) => b.count - a.count)[0];
}

/** Keeps only a suggestion FlowCode can actually carry out: a known role and an installed, non-embedding model. */
export function checkAction(raw: unknown, installed: string[]): SolverAction | undefined {
  const a = raw as { kind?: string; role?: string; model?: string } | undefined;
  if (!a || a.kind !== "switch_model" || !a.role || !a.model) return undefined;
  if (!SWITCHABLE.includes(a.role as AgentRole)) return undefined;
  const model = installed.find((m) => m === a.model);
  if (!model || /embed/i.test(model)) return undefined;
  return { kind: "switch_model", role: a.role as AgentRole, model, label: `Give the ${a.role} ${model}` };
}

export function solverView(app: App) {
  const s = load(app);
  const nextAt = s.lastRunAt ? new Date(Date.parse(s.lastRunAt) + DAY).toISOString() : undefined;
  return { lastRunAt: s.lastRunAt, nextAt, running: !!s.running, suggestions: Object.values(s.suggestions) };
}

/** Looks into one problem now (the daily job, or "Look into one now"). */
export async function solveOne(app: App, opts: { force?: boolean } = {}): Promise<{ started: boolean; reason?: string }> {
  const state = load(app);
  if (state.running) return { started: false, reason: "Already looking into a problem." };
  if (app.orchestrator.activeRunIds().length) return { started: false, reason: "A build is running; the Researcher waits until it's idle so it doesn't slow the build down." };
  if (!opts.force && state.lastRunAt && Date.now() - Date.parse(state.lastRunAt) < DAY) return { started: false, reason: "Already looked into one problem today." };
  const patterns = detectPatterns(app);
  const p = nextProblem(patterns, state) ?? (opts.force ? patterns.filter((x) => x.needsCodeFix).sort((a, b) => b.count - a.count)[0] : undefined);
  if (!p) return { started: false, reason: "No model problems to look into." };
  state.running = true;
  state.lastRunAt = new Date().toISOString();
  save(app, state);
  void (async () => {
    try {
      const sug = await investigate(app, p);
      const s = load(app);
      s.suggestions[p.id] = sug;
      save(app, s);
      app.bus.emit({ type: "knowledge.updated", message: `The Researcher looked into "${p.title}": ${sug.suggestion.slice(0, 140)}` });
    } catch (e) {
      app.bus.emit({ type: "knowledge.updated", message: `Couldn't look into "${p.title}" today: ${(e as Error).message.slice(0, 160)}`, level: "warning" });
    } finally {
      const s = load(app);
      s.running = false;
      save(app, s);
    }
  })();
  return { started: true };
}

async function investigate(app: App, p: Pattern): Promise<SolverSuggestion> {
  const roles = app.router.roleAssignments();
  const installed = await app.router
    .provider("ollama")
    .listModels()
    .then((ms) => ms.map((m) => `${m.name}${m.parameterSize ? ` (${m.parameterSize})` : ""}`))
    .catch(() => [] as string[]);
  const names = installed.map((m) => m.replace(/ \(.*\)$/, ""));
  const assignment = app.router.assignmentFor("researcher");
  const res = await app.router.chat({ role: "researcher" }, { ...assignment, temperature: 0.1 }, {
    messages: [
      {
        role: "system",
        content: `You help the owner of FlowCode, an app that builds software with local AI models, understand one recurring model problem. Read the errors and the setup, then write:
- diagnosis: 1-3 plain sentences on the most likely cause, for a non-technical reader. Base it only on the evidence.
- suggestion: one concrete thing to do.
- fixableInFlowCode: true only if the fix is giving a role a different model that is already installed. Topping up a cloud account, adding memory, closing other apps or installing a new model are things the owner does (false).
- action: only when fixableInFlowCode is true: {"kind":"switch_model","role":"<role>","model":"<an installed model, exactly as listed>"}. Otherwise omit it.
Never suggest a model that isn't in the installed list for an action. Return JSON only.`,
      },
      {
        role: "user",
        content: [
          `Problem: ${p.title}. It happened ${p.count} times in ${p.runs.length} builds in the last two weeks.`,
          `Current models by role: ${Object.entries(roles).map(([r, a]) => `${r}=${a.providerId}:${a.model}`).join(", ")}`,
          `Installed local models: ${installed.join(", ") || "(none found)"}`,
          `Errors (untrusted text):\n${untrusted("errors", p.examples.join("\n---\n"))}`,
        ].join("\n\n"),
      },
    ],
    format: {
      type: "object",
      properties: { diagnosis: { type: "string" }, suggestion: { type: "string" }, fixableInFlowCode: { type: "boolean" }, action: { type: "object", properties: { kind: { type: "string" }, role: { type: "string" }, model: { type: "string" } } } },
      required: ["diagnosis", "suggestion", "fixableInFlowCode"],
    },
    maxOutputTokens: 700,
    timeoutMs: 180_000,
  });
  const m = /\{[\s\S]*\}/.exec(res.content);
  const j = JSON.parse(m ? m[0] : res.content) as { diagnosis?: string; suggestion?: string; fixableInFlowCode?: boolean; action?: unknown };
  const action = j.fixableInFlowCode ? checkAction(j.action, names) : undefined;
  return {
    patternId: p.id,
    title: p.title,
    at: new Date().toISOString(),
    agent: "researcher",
    model: assignment.model,
    diagnosis: String(j.diagnosis ?? "").trim().slice(0, 600) || "No clear cause from the errors.",
    suggestion: String(j.suggestion ?? "").trim().slice(0, 400) || "Nothing to change in FlowCode for now.",
    fixableInFlowCode: !!action,
    ...(action ? { action } : {}),
    status: "new",
  };
}

/** Carries out a suggestion's change (only ever a role's model, to one already installed) and records it. */
export function applySuggestion(app: App, patternId: string): SolverSuggestion {
  const s = load(app);
  const sug = s.suggestions[patternId];
  if (!sug) throw new Error("No such suggestion");
  if (sug.status !== "new") throw new Error(`This suggestion was already ${sug.status}.`);
  if (sug.action?.kind === "switch_model") {
    const before: ModelAssignment | undefined = app.router.roleAssignments()[sug.action.role];
    const next: ModelAssignment = { providerId: "ollama", model: sug.action.model, temperature: before?.temperature ?? 0.1 };
    // The same rule as switching by hand: the Coder only gets a model that passed the capability lab.
    if (sug.action.role === "coder") {
      const e = app.lab.coderEligibility(next);
      if (!e.eligible) throw new Error(`Can't make ${next.model} the Coder: ${e.reason}`);
    }
    app.router.setRoleAssignment(sug.action.role, next);
    logDecision(app, { kind: "model", actor: "user", summary: `Applied the Researcher's suggestion: the ${sug.action.role} now uses ${sug.action.model} (was ${before?.model ?? "unset"})`, reason: sug.title });
  }
  sug.status = "applied";
  sug.decidedAt = new Date().toISOString();
  save(app, s);
  return sug;
}

export function dismissSuggestion(app: App, patternId: string): SolverSuggestion {
  const s = load(app);
  const sug = s.suggestions[patternId];
  if (!sug) throw new Error("No such suggestion");
  sug.status = "dismissed";
  sug.decidedAt = new Date().toISOString();
  save(app, s);
  return sug;
}

/** The daily job: checks hourly, and looks into one problem once a day when nothing is building. */
export function watchProblems(app: App): () => void {
  const tick = () => void solveOne(app).catch(() => undefined);
  const first = setTimeout(tick, 5 * 60_000);
  const t = setInterval(tick, 60 * 60_000);
  return () => {
    clearTimeout(first);
    clearInterval(t);
  };
}
