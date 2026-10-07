/**
 * The cloud coder (Models page): one hosted, OpenAI-compatible provider and the model chosen for it. The API key lives
 * only in the daemon's environment (the variable the provider names); it is never read back or stored.
 * Design steps use it whenever it's ready, even in builds whose other steps run on local models (the user asked for
 * the cloud model for design: it judges screenshots and composes far better than the local models).
 */
import { execFileSync } from "node:child_process";
import type { ModelAssignment } from "@flowcode/contracts";
import type { Store } from "../db/store.js";
import type { ModelRouter } from "./router.js";

/**
 * Keys saved on the Models page live in the Windows user environment (HKCU\Environment). A daemon restarted by a
 * process that started before the key was saved doesn't inherit it (Anthropic key lost on restart, so the build
 * couldn't switch to Claude): read the hosted providers' key variables from there when they're missing. The values
 * stay in this process's environment only; they're never logged or returned.
 */
export function loadSavedKeys(names: string[]): string[] {
  if (process.platform !== "win32") return [];
  const loaded: string[] = [];
  for (const name of names) {
    if (!name || process.env[name] || !/^[A-Z0-9_]+$/i.test(name)) continue;
    try {
      const out = execFileSync("reg", ["query", "HKCU\\Environment", "/v", name], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
      const value = new RegExp(`^\\s*${name}\\s+REG_(?:EXPAND_)?SZ\\s+(.+?)\\s*$`, "mi").exec(out)?.[1];
      if (value) {
        process.env[name] = value;
        loaded.push(name);
      }
    } catch {
      /* not saved */
    }
  }
  return loaded;
}

export const CLOUD_PROVIDER = "hosted-openai-compatible";
export const ANTHROPIC_PROVIDER = "hosted-anthropic";
/** The cloud providers the Models page offers. */
export const CLOUD_PROVIDERS = [CLOUD_PROVIDER, ANTHROPIC_PROVIDER] as const;
export type CloudProviderId = (typeof CLOUD_PROVIDERS)[number];

/** The cloud provider chosen on the Models page (OpenAI-compatible until Anthropic is picked). */
export function cloudProviderId(store: Store): CloudProviderId {
  const p = store.getSetting<{ provider?: string } | undefined>("cloudCoder", undefined)?.provider;
  return p === ANTHROPIC_PROVIDER ? ANTHROPIC_PROVIDER : CLOUD_PROVIDER;
}

export interface CloudCoder {
  provider: CloudProviderId;
  providerLabel: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
  keyVariable: string;
  keyPresent: boolean;
  ready: boolean;
  problem: string;
  assignment: ModelAssignment;
}

export function cloudCoder(router: ModelRouter, store: Store): CloudCoder {
  const provider = cloudProviderId(store);
  const hosted = router.providerConfigs().find((p) => p.id === provider);
  const saved = store.getSetting<{ model?: string; models?: Record<string, string> } | undefined>("cloudCoder", undefined);
  // Each provider remembers its own model, so switching back and forth keeps both.
  const model = saved?.models?.[provider] ?? (provider === CLOUD_PROVIDER ? saved?.model : undefined) ?? "";
  const keyPresent = !!(hosted?.apiKeyRef && process.env[hosted.apiKeyRef]);
  const problem = !hosted ? "no hosted provider" : !hosted.baseUrl ? "no endpoint URL set" : !model ? "no model chosen" : !hosted.enabled ? "it's turned off" : !keyPresent ? `the API key isn't set (environment variable ${hosted.apiKeyRef} on the FlowCode daemon)` : "";
  return { provider, providerLabel: hosted?.label ?? provider, baseUrl: hosted?.baseUrl ?? "", model, enabled: !!hosted?.enabled, keyVariable: hosted?.apiKeyRef ?? "", keyPresent, ready: !problem, problem, assignment: { providerId: provider, model, temperature: 0.1 } };
}
