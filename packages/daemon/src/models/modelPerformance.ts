/**
 * Measured model performance on this computer, for recommendations. Speed alone isn't quality: each coder model is
 * judged on what its steps achieved (passed on the first try, passed after retries, stopped), how long steps took, and
 * its measured writing speed, all from recorded runs. Memory fit comes from Ollama's own report of loaded models.
 *
 * Recommendations only. Nothing here changes a model assignment; switching stays the person's choice, and a paid model
 * is never suggested as an automatic switch.
 */
import type { App } from "../app.js";

export interface ModelStats {
  model: string;
  /** Coder steps that ended (verified or stopped) with this model as the build's coder. */
  steps: number;
  firstTry: number;
  afterRetries: number;
  stopped: number;
  firstTryRate?: number;
  /** Median minutes from a step's first start to its end. */
  medianStepMin?: number;
  calls: number;
  /** Median writing speed (output tokens per second of generation) and reading speed (prompt tokens per second). */
  genTokPerSec?: number;
  promptTokPerSec?: number;
  medianPromptTokens?: number;
  hosted: boolean;
  /** The latest run of the capability lab's fixed probes (the same small tasks for every model): a controlled comparison. */
  probes?: { passed: number; total: number; seconds: number; at: string };
}

export interface LoadedFit {
  name: string;
  sizeGb: number;
  /** Share of the model held in GPU memory (the rest runs on the CPU, which is slower). */
  gpuShare: number;
  contextLength?: number;
}

export interface ModelPerformance {
  measuredAt: string;
  models: ModelStats[];
  loaded: LoadedFit[];
  recommendation: { text: string; model?: string; basis: string };
  /** Plain notes on what the numbers can and can't show. */
  caveats: string[];
}

const med = (a: number[]) => {
  const s = a.filter(Number.isFinite).sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : undefined;
};
const MIN_STEPS = 10;

export function modelStats(app: App): ModelStats[] {
  const runs = new Map(app.db.all<{ id: string; data: string }>("SELECT id, data FROM runs").map((r) => [r.id, (JSON.parse(r.data) as { modelAssignments?: { coder?: { model?: string; providerId?: string } } }).modelAssignments?.coder]));
  const by = new Map<string, ModelStats & { _times: number[] }>();
  const get = (model: string, hosted: boolean) => by.get(model) ?? by.set(model, { model, steps: 0, firstTry: 0, afterRetries: 0, stopped: 0, calls: 0, hosted, _times: [] }).get(model)!;

  // Step outcomes per coder model, from the step records and their start/end events.
  const starts = new Map<string, number>();
  for (const e of app.db.all<{ task_id: string; type: string; created_at: string }>("SELECT task_id, type, created_at FROM events WHERE type IN ('task.started','task.verified','task.blocked') AND task_id IS NOT NULL ORDER BY seq ASC")) {
    if (e.type === "task.started") {
      if (!starts.has(e.task_id)) starts.set(e.task_id, Date.parse(e.created_at));
      continue;
    }
    const t = app.store.tasks.get(e.task_id);
    const coder = t ? runs.get(t.runId) : undefined;
    if (!t || !coder?.model) continue;
    const s = get(coder.model, !!coder.providerId?.startsWith("hosted"));
    s.steps++;
    if (e.type === "task.blocked") s.stopped++;
    else if (t.attempts <= 1) s.firstTry++;
    else s.afterRetries++;
    const start = starts.get(e.task_id);
    if (start) {
      const ms = Date.parse(e.created_at) - start;
      if (ms > 5_000 && ms < 3 * 3_600_000) s._times.push(ms / 60_000);
    }
  }

  // Speeds from the model calls' own timing.
  const speed = new Map<string, { gen: number[]; prompt: number[]; promptTok: number[]; calls: number }>();
  for (const r of app.db.all<{ data: string }>("SELECT data FROM events WHERE type = 'model.completed'")) {
    const d = (JSON.parse(r.data) as { data?: { model?: string; usage?: { promptTokens?: number; completionTokens?: number }; timing?: { promptMs?: number; generateMs?: number } } }).data;
    if (!d?.model) continue;
    const sp = speed.get(d.model) ?? speed.set(d.model, { gen: [], prompt: [], promptTok: [], calls: 0 }).get(d.model)!;
    sp.calls++;
    if (d.timing?.generateMs && d.timing.generateMs > 500 && (d.usage?.completionTokens ?? 0) > 20) sp.gen.push(d.usage!.completionTokens! / (d.timing.generateMs / 1000));
    if (d.timing?.promptMs && d.timing.promptMs > 200 && (d.usage?.promptTokens ?? 0) > 200) sp.prompt.push(d.usage!.promptTokens! / (d.timing.promptMs / 1000));
    if (d.usage?.promptTokens) sp.promptTok.push(d.usage.promptTokens);
  }
  for (const [model, sp] of speed) {
    const s = by.get(model);
    if (!s) continue;
    s.calls = sp.calls;
    const g = med(sp.gen);
    const p = med(sp.prompt);
    const t = med(sp.promptTok);
    if (g !== undefined) s.genTokPerSec = Math.round(g * 10) / 10;
    if (p !== undefined) s.promptTokPerSec = Math.round(p);
    if (t !== undefined) s.medianPromptTokens = t;
  }
  // The capability lab's fixed probes: identical tasks per model, so these compare like with like.
  const caps = app.store.capabilities.list("created_at DESC", 500);
  for (const s of by.values()) {
    const c = caps.find((x) => x.model === s.model);
    if (c) s.probes = { passed: c.results.filter((r) => r.passed).length, total: c.results.length, seconds: Math.round(c.results.reduce((n, r) => n + r.durationMs, 0) / 1000), at: c.createdAt };
  }
  return [...by.values()]
    .map(({ _times, ...s }) => ({
      ...s,
      ...(s.steps ? { firstTryRate: Math.round((s.firstTry / s.steps) * 100) / 100 } : {}),
      ...(med(_times) !== undefined ? { medianStepMin: Math.round(med(_times)! * 10) / 10 } : {}),
    }))
    .sort((a, b) => b.steps - a.steps);
}

/** A recommendation among local coder models, from verified outcomes first and step time second. */
export function recommend(stats: ModelStats[], current?: string): ModelPerformance["recommendation"] {
  const local = stats.filter((s) => !s.hosted && s.steps >= MIN_STEPS && s.firstTryRate !== undefined);
  if (!local.length) return { text: "Not enough evidence yet to recommend a local coder model.", basis: `A model needs at least ${MIN_STEPS} finished steps on this computer before it is compared.` };
  // Fewer stops and more first-try passes matter more than speed; time breaks near-ties.
  const score = (s: ModelStats) => (s.firstTryRate ?? 0) - s.stopped / s.steps - (s.medianStepMin ?? 0) / 600;
  const best = [...local].sort((a, b) => score(b) - score(a))[0];
  const cur = local.find((s) => s.model === current);
  const basis = local.map((s) => `${s.model}: ${s.steps} steps, ${Math.round((s.firstTryRate ?? 0) * 100)}% passed first try, ${s.stopped} stopped, median ${s.medianStepMin ?? "?"} min a step${s.genTokPerSec ? `, writes ${s.genTokPerSec} tokens/s` : ""}`).join("; ");
  if (cur && cur.model === best.model) return { text: `Keep ${best.model}: it has the best measured results among the local coders with enough history.`, model: best.model, basis };
  if (local.length === 1) return { text: `Only ${best.model} has enough history to judge; other local models need more finished steps before they can be compared.`, model: best.model, basis };
  return { text: `${best.model} has the best measured results among the local coders. Consider trying it as this computer's coder.`, model: best.model, basis };
}

export async function modelPerformance(app: App): Promise<ModelPerformance> {
  const stats = modelStats(app);
  const ollama = app.router.provider("ollama") as unknown as { loaded?: () => Promise<Array<{ name: string; sizeBytes: number; vramBytes: number; contextLength?: number }>> };
  const loaded = ((await ollama.loaded?.()) ?? []).map((m) => ({ name: m.name, sizeGb: Math.round((m.sizeBytes / 1e9) * 10) / 10, gpuShare: m.sizeBytes ? Math.round((m.vramBytes / m.sizeBytes) * 100) / 100 : 0, ...(m.contextLength ? { contextLength: m.contextLength } : {}) }));
  const current = app.router.roleAssignments().coder?.model;
  return {
    measuredAt: new Date().toISOString(),
    models: stats,
    loaded,
    recommendation: recommend(stats, current),
    caveats: [
      "Results come from real builds, which differ in difficulty; a model used on harder projects can look worse than it is.",
      "Speeds are medians of recorded calls. GPU share is only known for models loaded right now.",
      "Cloud models are listed for comparison but never recommended as an automatic switch.",
    ],
  };
}
