/**
 * Model router (FR-M1, FR-M4). Holds the provider registry and role → model assignments (global,
 * project-overridable). Every request is logged with provider/model/version; only bounded transport
 * failures are retried and cancellation is terminal. Tool side effects are never replayed here — a
 * retry only re-sends the model request.
 */
import type { AgentRole, ModelAssignment, ProviderConfig } from "@flowcode/contracts";
import type { Store } from "../db/store.js";
import type { EventBus } from "../events/bus.js";
import { ProviderError, type ChatRequest, type ChatResponse, type Provider } from "./types.js";
import { classifyError } from "./errors.js";
import { OllamaProvider } from "./ollama.js";
import { OpenAICompatibleProvider } from "./openaiCompat.js";
import { AnthropicProvider } from "./anthropic.js";
import { stableStringify, sha256 } from "../util/ids.js";

export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
}

export const DEFAULT_RETRY: RetryPolicy = { maxRetries: 2, baseDelayMs: 750 };

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  { id: "ollama", kind: "ollama", label: "Ollama (local)", baseUrl: "http://127.0.0.1:11434", enabled: true, hosted: false },
  { id: "hosted-openai-compatible", kind: "openai_compatible", label: "Hosted (OpenAI-compatible)", enabled: false, hosted: true, apiKeyRef: "FLOWCODE_HOSTED_API_KEY" },
  // Claude through Anthropic's own API (prompt caching, tools, images). Off until set up on the Models page.
  { id: "hosted-anthropic", kind: "anthropic", label: "Anthropic (Claude)", baseUrl: "https://api.anthropic.com", enabled: false, hosted: true, apiKeyRef: "FLOWCODE_ANTHROPIC_API_KEY" },
];

export const DEFAULT_ROLE_MODELS: Partial<Record<AgentRole, ModelAssignment>> = {
  planner: { providerId: "ollama", model: "qwen3:14b", temperature: 0.2 },
  // Code writing and repair use a model tuned for agentic coding and tool calls. If it can't be used, the step stops
  // and says why; FlowCode never swaps in another model on its own (suggested instead: gpt-oss:20b, qwen2.5-coder:7b).
  coder: { providerId: "ollama", model: "qwen3-coder:30b", temperature: 0.1 },
  debugger: { providerId: "ollama", model: "qwen3-coder:30b", temperature: 0.1 },
  repository_analyst: { providerId: "ollama", model: "qwen3:14b", temperature: 0.1 },
  researcher: { providerId: "ollama", model: "qwen3:14b", temperature: 0.2 },
  reviewer: { providerId: "ollama", model: "qwen3:14b", temperature: 0.1 },
  designer: { providerId: "ollama", model: "qwen3:14b", temperature: 0.4 },
  critic: { providerId: "ollama", model: "qwen2.5vl:3b", temperature: 0.1 },
  documenter: { providerId: "ollama", model: "qwen3:14b", temperature: 0.2 },
  security_qa: { providerId: "ollama", model: "qwen3:14b", temperature: 0.1 },
  accessibility_qa: { providerId: "ollama", model: "qwen3:14b", temperature: 0.1 },
  compliance_triage: { providerId: "ollama", model: "qwen3:14b", temperature: 0.1 },
};

export interface ModelCallContext {
  role: AgentRole;
  projectId?: string;
  runId?: string;
  taskId?: string;
}

export class ModelRouter {
  private providers = new Map<string, Provider>();
  retry: RetryPolicy = DEFAULT_RETRY;
  /** Test hook to avoid real sleeps. */
  sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  constructor(
    private store: Store,
    private bus: EventBus,
  ) {
    for (const p of DEFAULT_PROVIDERS) if (!store.providers.get(p.id)) store.providers.upsert(p);
    for (const cfg of store.providers.list("created_at ASC")) this.providers.set(cfg.id, instantiate(cfg));
  }

  register(provider: Provider) {
    this.providers.set(provider.config.id, provider);
  }

  saveProvider(cfg: ProviderConfig) {
    this.store.providers.upsert(cfg);
    this.providers.set(cfg.id, instantiate(cfg));
  }

  provider(id: string): Provider {
    const p = this.providers.get(id);
    if (!p) throw new ProviderError("unknown", `Provider ${id} is not configured`);
    return p;
  }

  providerConfigs(): ProviderConfig[] {
    return [...this.providers.values()].map((p) => p.config);
  }

  roleAssignments(projectId?: string): Record<string, ModelAssignment> {
    const global = this.store.getSetting<Record<string, ModelAssignment>>("roleAssignments", {});
    const merged: Record<string, ModelAssignment> = { ...(DEFAULT_ROLE_MODELS as Record<string, ModelAssignment>), ...global };
    if (projectId) {
      const project = this.store.projects.get(projectId);
      Object.assign(merged, project?.settings.modelOverrides ?? {});
    }
    return merged;
  }

  setRoleAssignment(role: AgentRole, a: ModelAssignment) {
    const global = this.store.getSetting<Record<string, ModelAssignment>>("roleAssignments", {});
    global[role] = a;
    this.store.setSetting("roleAssignments", global);
  }

  assignmentFor(role: AgentRole, projectId?: string): ModelAssignment {
    const a = this.roleAssignments(projectId)[role];
    if (!a) throw new ProviderError("unknown", `No model assigned to role ${role}`);
    return a;
  }

  /** Stable hash of the parts of a configuration that affect behavior; capability records are keyed by it. */
  static configHash(a: ModelAssignment): string {
    return sha256(stableStringify({ p: a.providerId, m: a.model, t: a.temperature ?? null, c: a.contextWindow ?? null, r: a.reasoning ?? false })).slice(0, 16);
  }

  async chat(ctx: ModelCallContext, assignment: ModelAssignment, req: Omit<ChatRequest, "model">): Promise<ChatResponse> {
    const provider = this.provider(assignment.providerId);
    if (provider.config.hosted) {
      const project = ctx.projectId ? this.store.projects.get(ctx.projectId) : undefined;
      if (!provider.config.enabled || (ctx.projectId && !project?.settings.allowHostedModels)) {
        throw new ProviderError("unknown", `Hosted provider ${provider.config.label} requires explicit consent (project setting "allow hosted models").`);
      }
    }
    const ev = { projectId: ctx.projectId, runId: ctx.runId, taskId: ctx.taskId };
    const meta = { role: ctx.role, providerId: assignment.providerId, model: assignment.model, version: assignment.version };
    let attempt = 0;
    for (;;) {
      this.bus.emit({ ...ev, type: "model.requested", message: `${ctx.role} → ${assignment.model}${attempt ? ` (retry ${attempt})` : ""}`, data: { ...meta, attempt, messages: req.messages.length, tools: req.tools?.length ?? 0, images: req.messages.some((m) => (m as { images?: string[] }).images?.length) } });
      try {
        const res = await provider.chat({ ...req, model: assignment.model, temperature: req.temperature ?? assignment.temperature, contextWindow: assignment.contextWindow, think: req.think ?? assignment.reasoning });
        this.bus.emit({
          ...ev,
          type: "model.completed",
          message: `${ctx.role} ← ${assignment.model}: ${res.toolCalls.length ? `${res.toolCalls.length} tool call(s): ${res.toolCalls.map((c) => c.name).join(", ")}` : "text response"} in ${res.durationMs}ms`,
          // Timing and prompt size feed the Performance view: where model time goes, and how big each request was.
          data: { ...meta, durationMs: res.durationMs, usage: res.usage, timing: res.timing, promptChars: promptSize(req), toolCalls: res.toolCalls.map((c) => c.name) },
        });
        return res;
      } catch (raw) {
        const err = classifyError(raw, req.signal);
        const canRetry = err.retryable && attempt < this.retry.maxRetries && !req.signal?.aborted;
        this.bus.emit({ ...ev, type: "model.failed", message: `${ctx.role} model error (${err.kind}): ${err.message}`, data: { ...meta, kind: err.kind, causes: err.causes, retry: canRetry }, level: canRetry ? "warning" : "error" });
        if (!canRetry) throw err;
        attempt++;
        const delay = this.retry.baseDelayMs * 2 ** (attempt - 1) * (err.kind === "rate_limited" || err.kind === "out_of_memory" ? 4 : 1);
        this.bus.emit({ ...ev, type: "model.retry_scheduled", message: `Retrying ${assignment.model} in ${delay}ms after ${err.kind}`, data: { ...meta, attempt, delay, kind: err.kind } });
        await this.sleep(delay);
        if (req.signal?.aborted) throw new ProviderError("cancelled", "Cancelled during retry backoff");
      }
    }
  }
}

function instantiate(cfg: ProviderConfig): Provider {
  switch (cfg.kind) {
    case "ollama":
      return new OllamaProvider(cfg);
    case "openai_compatible":
      return new OpenAICompatibleProvider(cfg);
    case "anthropic":
      return new AnthropicProvider(cfg);
    default:
      return new OllamaProvider({ ...cfg, enabled: false });
  }
}

/** Characters sent to the model: every message plus the tool definitions (a size measure that works for any provider). */
function promptSize(req: Omit<ChatRequest, "model">): number {
  return req.messages.reduce((n, m) => n + (m.content?.length ?? 0), 0) + (req.tools?.length ? JSON.stringify(req.tools).length : 0);
}
