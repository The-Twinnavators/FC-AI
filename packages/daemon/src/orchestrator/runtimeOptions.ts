/**
 * Speed and self-recovery options (Settings → Speed & recovery). The fast-model tier is off by default (code is written
 * by the coder model the user chose; a smaller model only when they turn this on). Recovery defaults are on:
 * undo half-finished steps when a run gets stuck, and retry once with a clearer request.
 */
import type { Store } from "../db/store.js";

export interface RuntimeOptions {
  /**
   * Try this smaller local model first; the run's coder model only takes over after `tries` attempts don't pass.
   * On a GPU the big model doesn't fit, the small one writes 2–3× faster, so it should get the first tries.
   */
  fastModel: { enabled: boolean; model: string; tries: number };
  /** When a run gets stuck, undo the changes of the steps that didn't pass (steps that passed are kept). */
  rollbackBlocked: boolean;
  /** When a run gets stuck, rewrite the request more clearly and try once more (not in Supervised projects). */
  autoRetry: boolean;
  /**
   * Reads of new content a step may make without changing anything before it's asked where it stands (the
   * investigation check, investigation.ts). 0: automatic (40 for a local model, 120 for a cloud one).
   */
  investigationBudget: number;
  /**
   * The AI visual critic (reliability phase 4). "off" (default): no vision-model review; screenshots, functional checks
   * and the measured checks (contrast, overflow, placeholders…) still run, and the person reviews the design.
   * "advisory": the look review and design crit run and their observations are recorded for the person, but never
   * send a step back or block a build.
   */
  visualCritic: "off" | "advisory";
  /**
   * Thinking on a step's routine coding turns (its first attempt). Off by default: on six routine coding and tool-choice
   * turns qwen3:8b passed 12 of 12 either way and wrote 7.7 times the tokens with thinking on (docs/reliability). Retries
   * run as the debugger and keep the model's own reasoning setting.
   */
  routineThinking: boolean;
  /**
   * How local models are run. "8gb": the 8GB local GPU profile - one local request at a time across the app, text
   * support roles on the coder's model (qwen3:8b) instead of a model that doesn't fit the card, a fixed coding context
   * (profileContext) with no larger fallback, the tools a step needs, and the planner's app model in bounded parts.
   * "standard": as before.
   */
  gpuProfile: "standard" | "8gb";
  /** The coding context in the 8GB profile, in tokens (12k fits qwen3:8b entirely on an 8 GB card; 16k mostly). */
  profileContext: number;
  /** The model text support roles use in the 8GB profile. */
  profileSupportModel: string;
}

export const DEFAULT_RUNTIME_OPTIONS: RuntimeOptions = { fastModel: { enabled: false, model: "qwen3:8b", tries: 2 }, rollbackBlocked: true, autoRetry: true, investigationBudget: 0, visualCritic: "off", routineThinking: false, gpuProfile: "standard", profileContext: 16384, profileSupportModel: "qwen3:8b" };
const KEY = "runtimeOptions";

export function runtimeOptions(store: Store): RuntimeOptions {
  const raw = store.getSetting<Partial<RuntimeOptions>>(KEY, {});
  return { ...DEFAULT_RUNTIME_OPTIONS, ...raw, fastModel: { ...DEFAULT_RUNTIME_OPTIONS.fastModel, ...(raw.fastModel ?? {}) } };
}

export function setRuntimeOptions(store: Store, patch: Partial<RuntimeOptions>): RuntimeOptions {
  const cur = runtimeOptions(store);
  const next: RuntimeOptions = { ...cur, ...patch, fastModel: { ...cur.fastModel, ...(patch.fastModel ?? {}) } };
  store.setSetting(KEY, next);
  return next;
}

/** Marker in a run's constraints for FlowCode's own clarified retry, so it never retries a retry. */
export const AUTO_RETRY_MARK = "FlowCode retry: this request was rewritten more clearly after an earlier attempt got stuck.";
