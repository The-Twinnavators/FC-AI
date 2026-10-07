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
}

export const DEFAULT_RUNTIME_OPTIONS: RuntimeOptions = { fastModel: { enabled: false, model: "qwen3:8b", tries: 2 }, rollbackBlocked: true, autoRetry: true };
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
