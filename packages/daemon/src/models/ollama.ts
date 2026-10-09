/** Local Ollama adapter (§8.1, §16). Native tool calls via /api/chat; models listed via /api/tags. */
import type { ProviderConfig } from "@flowcode/contracts";
import { ProviderError, type ChatRequest, type ChatResponse, type ModelInfo, type Provider, type ToolCall } from "./types.js";
import { classifyError, withTimeout } from "./errors.js";
import { newId } from "../util/ids.js";
import http from "node:http";

/**
 * POST over node:http rather than fetch: undici's default 300 s headers/body timeouts abort slow local
 * generations (a partly CPU-offloaded 14B model can take longer than that for one large file). Our own
 * timeout and cancellation still apply through `signal`.
 */
function httpPost(url: string, body: string, signal: AbortSignal): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: "POST", headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) }, signal }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8") }));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.end(body);
  });
}

interface OllamaMessage {
  role: string;
  content: string;
  images?: string[];
  tool_calls?: Array<{ function: { name: string; arguments: unknown } }>;
  tool_name?: string;
}

export class OllamaProvider implements Provider {
  private capCache = new Map<string, string[]>();
  constructor(readonly config: ProviderConfig) {}

  /** Model capabilities from /api/show (tools, vision, thinking), cached per model tag. */
  async capabilities(model: string): Promise<string[]> {
    if (!this.capCache.has(model)) {
      const d = await this.describe(model);
      this.capCache.set(model, d?.capabilities ?? []);
    }
    return this.capCache.get(model)!;
  }

  private get base(): string {
    return (this.config.baseUrl ?? "http://127.0.0.1:11434").replace(/\/$/, "");
  }

  private async post<T>(pathName: string, body: unknown, signal?: AbortSignal, timeoutMs = 600_000): Promise<T> {
    const t = withTimeout(signal, timeoutMs);
    let status: number | undefined;
    let text = "";
    try {
      const res = await httpPost(`${this.base}${pathName}`, JSON.stringify(body), t.signal);
      status = res.status;
      text = res.text;
      if (status < 200 || status >= 300) throw new Error(`Ollama ${pathName} HTTP ${status}: ${text.slice(0, 400)}`);
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new ProviderError("invalid_response", `Ollama returned non-JSON from ${pathName}`);
      }
    } catch (err) {
      throw classifyError(err, t.signal.aborted ? t.signal : signal, status, text);
    } finally {
      t.dispose();
    }
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const started = Date.now();
    const messages: OllamaMessage[] = req.messages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.images?.length ? { images: m.images } : {}),
      ...(m.toolCalls?.length ? { tool_calls: m.toolCalls.map((c) => ({ function: { name: c.name, arguments: c.arguments } })) } : {}),
      ...(m.role === "tool" && m.toolName ? { tool_name: m.toolName } : {}),
    }));
    const body: Record<string, unknown> = {
      model: req.model,
      messages,
      stream: false,
      options: { temperature: req.temperature ?? 0.1, ...(req.contextWindow ? { num_ctx: req.contextWindow } : { num_ctx: 16384 }), ...((req.maxOutputTokens ?? (req.format ? 4096 : undefined)) ? { num_predict: req.maxOutputTokens ?? 4096 } : {}) },
      keep_alive: "15m",
    };
    if (req.tools?.length) body.tools = req.tools.map((t) => ({ type: "function", function: t }));
    if (req.format) body.format = req.format;
    // Thinking models (e.g. qwen3) are run with thinking disabled for agent turns unless requested: it is
    // slower and the runtime verifies results independently of model reasoning.
    const caps: string[] = await this.capabilities(req.model).catch(() => []);
    if (caps.includes("thinking")) body.think = req.think ?? false;
    await this.makeRoomFor(req.model, (body.options as { num_ctx: number }).num_ctx);
    const res = await this.post<{
      model: string;
      message?: OllamaMessage;
      done_reason?: string;
      prompt_eval_count?: number;
      eval_count?: number;
      // Nanoseconds.
      load_duration?: number;
      prompt_eval_duration?: number;
      eval_duration?: number;
    }>("/api/chat", body, req.signal, req.timeoutMs ?? 600_000);
    if (!res.message) throw new ProviderError("invalid_response", "Ollama response missing message");
    const toolCalls: ToolCall[] = (res.message.tool_calls ?? []).map((c) => ({
      id: newId("tc"),
      name: c.function?.name,
      arguments: typeof c.function?.arguments === "string" ? safeJson(c.function.arguments) : c.function?.arguments,
    }));
    if (toolCalls.some((c) => !c.name)) throw new ProviderError("tool_call_invalid", "Tool call without function name");
    return {
      content: res.message.content ?? "",
      toolCalls,
      model: res.model,
      doneReason: res.done_reason,
      usage: { promptTokens: res.prompt_eval_count, completionTokens: res.eval_count },
      durationMs: Date.now() - started,
      timing: { loadMs: ms(res.load_duration), promptMs: ms(res.prompt_eval_duration), generateMs: ms(res.eval_duration) },
    };
  }

  /**
   * One model in memory at a time. On a small GPU, loading a second large model while another is resident makes Ollama
   * crash mid-request ("connection reset"). So before calling a model that isn't loaded, unload the others; Ollama
   * finishes any request still using them before it lets them go.
   */
  private async makeRoomFor(model: string, numCtx?: number): Promise<void> {
    try {
      const ps = await fetch(`${this.base}/api/ps`, { signal: AbortSignal.timeout(3000) });
      if (!ps.ok) return;
      const models = ((await ps.json()) as { models?: Array<{ name?: string; model?: string; context_length?: number }> }).models ?? [];
      const loaded = models.map((m) => m.name ?? m.model ?? "").filter(Boolean);
      const same = (n: string) => n === model || n === `${model}:latest` || model === `${n}:latest`;
      // The same model at another context size is a second copy to Ollama: it loads beside the first and runs out of GPU
      // memory (No BIO & GMO build: qwen3-coder:30b at 32k failed while its 16k copy was still loaded; alone it loads fine).
      const sameSize = models.some((m) => same(m.name ?? m.model ?? "") && (!numCtx || !m.context_length || m.context_length === numCtx));
      if (!loaded.length || sameSize) return;
      await Promise.all(loaded.map((name) => fetch(`${this.base}/api/generate`, { method: "POST", body: JSON.stringify({ model: name, keep_alive: 0 }), signal: AbortSignal.timeout(10_000) }).catch(() => undefined)));
    } catch {
      /* Ollama unreachable: the request itself reports it */
    }
  }

  /** Models in memory now, as Ollama reports them: total size, the part in GPU memory, and context size. */
  async loaded(): Promise<Array<{ name: string; sizeBytes: number; vramBytes: number; contextLength?: number }>> {
    try {
      const ps = await fetch(`${this.base}/api/ps`, { signal: AbortSignal.timeout(3000) });
      if (!ps.ok) return [];
      const models = ((await ps.json()) as { models?: Array<{ name?: string; model?: string; size?: number; size_vram?: number; context_length?: number }> }).models ?? [];
      return models.map((m) => ({ name: m.name ?? m.model ?? "", sizeBytes: m.size ?? 0, vramBytes: m.size_vram ?? 0, ...(m.context_length ? { contextLength: m.context_length } : {}) }));
    } catch {
      return [];
    }
  }

  async listModels(signal?: AbortSignal): Promise<ModelInfo[]> {
    const t = withTimeout(signal, 10_000);
    try {
      const res = await fetch(`${this.base}/api/tags`, { signal: t.signal });
      const json = (await res.json()) as { models?: Array<{ name: string; digest: string; size: number; details?: { family?: string; parameter_size?: string } }> };
      return (json.models ?? []).map((m) => ({ name: m.name, digest: m.digest, sizeBytes: m.size, family: m.details?.family, parameterSize: m.details?.parameter_size }));
    } catch (err) {
      throw classifyError(err, t.signal);
    } finally {
      t.dispose();
    }
  }

  async describe(model: string): Promise<ModelInfo | undefined> {
    try {
      const res = await this.post<{ capabilities?: string[]; details?: { family?: string; parameter_size?: string }; modified_at?: string; model_info?: Record<string, unknown> }>("/api/show", { model }, undefined, 15_000);
      const maxContext = Object.entries(res.model_info ?? {}).find(([k, v]) => k.endsWith(".context_length") && typeof v === "number")?.[1] as number | undefined;
      const tags = await this.listModels().catch(() => []);
      const tag = tags.find((t) => t.name === model || t.name === `${model}:latest`);
      return { name: model, digest: tag?.digest, sizeBytes: tag?.sizeBytes, capabilities: res.capabilities, family: res.details?.family, parameterSize: res.details?.parameter_size, ...(maxContext ? { maxContext } : {}) };
    } catch {
      return undefined;
    }
  }

  async embed(model: string, input: string[], signal?: AbortSignal): Promise<number[][]> {
    const res = await this.post<{ embeddings: number[][] }>("/api/embed", { model, input }, signal, 120_000);
    return res.embeddings;
  }

  async health(): Promise<{ ok: boolean; detail: string }> {
    try {
      const t = withTimeout(undefined, 3000);
      const res = await fetch(`${this.base}/api/version`, { signal: t.signal });
      t.dispose();
      const j = (await res.json()) as { version?: string };
      return { ok: true, detail: `Ollama ${j.version ?? ""} at ${new URL(this.base).host}` };
    } catch (err) {
      const e = classifyError(err);
      return { ok: false, detail: `${e.kind}: Ollama not reachable at ${this.base}` };
    }
  }
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

/** Ollama reports durations in nanoseconds. */
function ms(ns: number | undefined): number | undefined {
  return typeof ns === "number" && ns >= 0 ? Math.round(ns / 1e6) : undefined;
}
