/**
 * Anthropic (Claude) through its native Messages API, as a hosted provider (Models page → Cloud model → Anthropic).
 * Disabled until set up, and used only by projects that allow hosted models, like the OpenAI-compatible provider.
 * The API key is read from the environment variable named by `apiKeyRef` (FLOWCODE_ANTHROPIC_API_KEY, FlowCode's own, so
 * a key another tool put in ANTHROPIC_API_KEY is never picked up); it is never stored.
 *
 * Prompt caching: an agent step sends the same long system prompt, skills and tool list on every turn, and the
 * conversation only grows at the end. Cache breakpoints on the system prompt, the last tool and the newest message let
 * each turn reuse what the last one sent, which costs a fraction of fresh input and answers sooner.
 */
import type { ProviderConfig } from "@flowcode/contracts";
import { ProviderError, type ChatMessage, type ChatRequest, type ChatResponse, type ModelInfo, type Provider } from "./types.js";
import { classifyError, withTimeout } from "./errors.js";

const API_VERSION = "2023-06-01";
/** Models that refuse a temperature (newer reasoning models): learned from their 400 and not sent again. */
const NO_TEMPERATURE = new Set<string>();
/** The most output tokens a model allows, learned from a 400 that names it ("max_tokens: 64000 > 32000…"). */
const OUTPUT_LIMIT = new Map<string, number>();

/** The output limit an error states, if it states one (the smallest number after "max_tokens" that's under what was asked). */
export function statedOutputLimit(body: string, asked: number): number | undefined {
  if (!/max_tokens|max_output_tokens|maximum.*tokens/i.test(body)) return undefined;
  const nums = [...body.matchAll(/\b(\d{3,7})\b/g)].map((m) => Number(m[1])).filter((n) => n >= 1024 && n < asked);
  return nums.length ? Math.max(...nums) : undefined;
}

type Block =
  | { type: "text"; text: string; cache_control?: { type: "ephemeral" } }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string }; cache_control?: { type: "ephemeral" } }
  | { type: "tool_use"; id: string; name: string; input: unknown; cache_control?: { type: "ephemeral" } }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean; cache_control?: { type: "ephemeral" } };
interface Turn {
  role: "user" | "assistant";
  content: Block[];
}

/** Tool-call ids Anthropic accepts (letters, digits, _ and -); the same id always maps to the same safe id. */
export const safeToolId = (id: string) => (/^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : `t_${id.replace(/[^A-Za-z0-9_-]/g, "_")}`.slice(0, 64));

/** PNG or JPEG, from the base64 header. */
const mediaType = (b64: string) => (b64.startsWith("/9j/") ? "image/jpeg" : b64.startsWith("R0lG") ? "image/gif" : b64.startsWith("UklG") ? "image/webp" : "image/png");

/**
 * FlowCode's conversation as Anthropic turns: the system prompt apart, tool results as user turns, and turns of the same
 * role merged (Anthropic wants user and assistant to alternate, starting with a user turn).
 */
export function toAnthropic(messages: ChatMessage[]): { system: string; turns: Turn[] } {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const turns: Turn[] = [];
  const push = (role: Turn["role"], blocks: Block[]) => {
    if (!blocks.length) return;
    const last = turns[turns.length - 1];
    if (last?.role === role) last.content.push(...blocks);
    else turns.push({ role, content: blocks });
  };
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "tool") {
      push("user", [{ type: "tool_result", tool_use_id: safeToolId(m.toolCallId ?? "call"), content: m.content || "(no output)", ...(/^ERROR\b|^Not run\b/.test(m.content) ? { is_error: true } : {}) }]);
      continue;
    }
    if (m.role === "assistant") {
      push("assistant", [...(m.content.trim() ? [{ type: "text" as const, text: m.content }] : []), ...(m.toolCalls ?? []).map((c) => ({ type: "tool_use" as const, id: safeToolId(c.id), name: c.name, input: c.arguments ?? {} }))]);
      continue;
    }
    push("user", [...(m.images ?? []).map((data) => ({ type: "image" as const, source: { type: "base64" as const, media_type: mediaType(data), data } })), { type: "text" as const, text: m.content || "(empty)" }]);
  }
  if (turns[0]?.role !== "user") turns.unshift({ role: "user", content: [{ type: "text", text: "Begin." }] });
  // Results must follow their tool calls: in a user turn, tool_result blocks come before any text.
  for (const t of turns) if (t.role === "user") t.content.sort((a, b) => Number(b.type === "tool_result") - Number(a.type === "tool_result"));
  return { system, turns };
}

export class AnthropicProvider implements Provider {
  constructor(readonly config: ProviderConfig) {}

  private base() {
    return (this.config.baseUrl || "https://api.anthropic.com").replace(/\/$/, "").replace(/\/v1$/, "");
  }
  private headers(): Record<string, string> {
    const key = this.config.apiKeyRef ? process.env[this.config.apiKeyRef] : undefined;
    return { "content-type": "application/json", "anthropic-version": API_VERSION, ...(key ? { "x-api-key": key } : {}) };
  }
  private assertEnabled() {
    if (!this.config.enabled) throw new ProviderError("unknown", `Hosted provider ${this.config.label} is disabled. Set it up on the Models page first.`);
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    this.assertEnabled();
    const started = Date.now();
    const t = withTimeout(req.signal, req.timeoutMs ?? 300_000);
    let status: number | undefined;
    let text = "";
    try {
      const { system, turns } = toAnthropic(req.messages);
      // Structured replies: the schema goes in the system prompt and the JSON is read from the reply.
      const sys = req.format ? `${system}\n\nReply with only a JSON value that matches this JSON Schema, with no other text:\n${JSON.stringify(req.format)}` : system;
      // Cache breakpoints: the system prompt, the last tool, and the newest turn (Anthropic allows four).
      const last = turns[turns.length - 1];
      if (last?.content.length) last.content[last.content.length - 1] = { ...last.content[last.content.length - 1], cache_control: { type: "ephemeral" } };
      const tools = (req.tools ?? []).map((x, i, all) => ({ name: x.name, description: x.description, input_schema: { type: "object", ...x.parameters }, ...(i === all.length - 1 ? { cache_control: { type: "ephemeral" } } : {}) }));
      const wanted = Math.max(req.tools?.length ? 16_000 : 1024, req.maxOutputTokens ?? (req.format ? 4096 : 8192));
      const maxTokens = () => Math.min(wanted, OUTPUT_LIMIT.get(req.model) ?? wanted);
      const send = (withTemperature: boolean) =>
        fetch(`${this.base()}/v1/messages`, {
          method: "POST",
          headers: this.headers(),
          signal: t.signal,
          body: JSON.stringify({
            model: req.model,
            // FlowCode's 4,096-token cap is sized for local models. Claude writes whole files in one tool call; cut off at
            // 4,096 the call arrived without its content and was rejected again and again (No BIO & GMO build).
            max_tokens: maxTokens(),
            ...(withTemperature ? { temperature: req.temperature ?? 0.1 } : {}),
            ...(sys ? { system: [{ type: "text", text: sys, cache_control: { type: "ephemeral" } }] } : {}),
            messages: turns,
            ...(tools.length ? { tools } : {}),
          }),
        });
      let res = await send(!NO_TEMPERATURE.has(req.model));
      status = res.status;
      text = await res.text();
      if (res.status === 400 && /temperature/i.test(text) && !NO_TEMPERATURE.has(req.model)) {
        NO_TEMPERATURE.add(req.model);
        res = await send(false);
        status = res.status;
        text = await res.text();
      }
      // A model that allows fewer output tokens says how many: use that from now on.
      const limit = res.status === 400 ? statedOutputLimit(text, maxTokens()) : undefined;
      if (limit) {
        OUTPUT_LIMIT.set(req.model, limit);
        res = await send(!NO_TEMPERATURE.has(req.model));
        status = res.status;
        text = await res.text();
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${anthropicError(text)}`);
      const json = JSON.parse(text) as {
        model: string;
        stop_reason?: string;
        content: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>;
        usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
      };
      const u = json.usage ?? {};
      return {
        content: jsonOnly(json.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join(""), !!req.format),
        toolCalls: json.content.filter((b) => b.type === "tool_use").map((b) => ({ id: b.id ?? `tc_${Date.now()}`, name: b.name ?? "", arguments: b.input ?? {} })),
        model: json.model,
        doneReason: json.stop_reason,
        usage: { promptTokens: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0), completionTokens: u.output_tokens },
        durationMs: Date.now() - started,
      };
    } catch (err) {
      throw classifyError(err, t.signal.aborted ? t.signal : req.signal, status, text);
    } finally {
      t.dispose();
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    if (!this.config.enabled) return [];
    let res: Response;
    try {
      res = await fetch(`${this.base()}/v1/models?limit=100`, { headers: this.headers(), signal: AbortSignal.timeout(20_000) });
    } catch (err) {
      const e = classifyError(err);
      throw new ProviderError(e.kind, `Couldn't reach api.anthropic.com: ${e.causes.join(" ← ")}`, e.causes);
    }
    const body = await res.text();
    if (!res.ok) throw new ProviderError(res.status === 401 ? "unknown" : "invalid_response", `Anthropic answered ${res.status}: ${anthropicError(body)}`, [], res.status);
    const json = JSON.parse(body) as { data?: Array<{ id: string }> };
    return (json.data ?? []).map((m) => ({ name: m.id, capabilities: ["vision", "tools"] }));
  }

  async describe(model: string): Promise<ModelInfo | undefined> {
    // Claude models read images (style capture, the design crit) and call tools.
    return { name: model, capabilities: /claude/i.test(model) ? ["vision", "tools"] : ["tools"] };
  }

  async health() {
    if (!this.config.enabled) return { ok: false, detail: "disabled (set up Anthropic on the Models page)" };
    const key = this.config.apiKeyRef ? process.env[this.config.apiKeyRef] : undefined;
    return { ok: !!key, detail: key ? "configured: api.anthropic.com" : `the API key isn't set (${this.config.apiKeyRef})` };
  }
}

/** A JSON reply without ```json fences or a sentence around it (Claude sometimes adds them); other replies as they are. */
export function jsonOnly(text: string, wanted: boolean): string {
  if (!wanted) return text;
  const bare = text.replace(/```(?:json)?/gi, "").trim();
  const start = bare.search(/[[{]/);
  const end = Math.max(bare.lastIndexOf("}"), bare.lastIndexOf("]"));
  return start >= 0 && end > start ? bare.slice(start, end + 1) : text;
}

/** Anthropic's error message from its JSON body ({ error: { type, message } }), never the key. */
function anthropicError(body: string): string {
  try {
    const e = (JSON.parse(body) as { error?: { type?: string; message?: string } }).error;
    if (e) return `${e.type ?? "error"}: ${(e.message ?? "").slice(0, 300)}`;
  } catch {
    /* not JSON */
  }
  return body.slice(0, 300);
}
