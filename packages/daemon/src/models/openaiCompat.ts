/**
 * Optional hosted provider adapter for any OpenAI-compatible chat endpoint (FR-M1).
 * Disabled until the user configures it AND consents to hosted transfer (§7.1, §7.2).
 * The API key is read from an environment variable named by `apiKeyRef`; it is never persisted.
 */
import type { ProviderConfig } from "@flowcode/contracts";
import { ProviderError, type ChatRequest, type ChatResponse, type ModelInfo, type Provider } from "./types.js";
import { classifyError, withTimeout } from "./errors.js";
import { newId } from "../util/ids.js";

/** Models that only accept their default temperature (OpenAI's reasoning models, e.g. the gpt-5 family). */
const FIXED_TEMPERATURE = new Set<string>();
/**
 * Models that take function tools on /chat/completions only with reasoning off (OpenAI: "Function tools with
 * reasoning_effort are not supported for gpt-5.6-sol in /v1/chat/completions… set reasoning_effort to 'none'").
 */
const TOOLS_WITHOUT_REASONING = new Set<string>();

export class OpenAICompatibleProvider implements Provider {
  constructor(readonly config: ProviderConfig) {}

  private headers(): Record<string, string> {
    const key = this.config.apiKeyRef ? process.env[this.config.apiKeyRef] : undefined;
    return { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) };
  }

  private assertEnabled() {
    if (!this.config.enabled) throw new ProviderError("unknown", `Hosted provider ${this.config.label} is disabled. Enable it in Settings and consent to hosted transfer first.`);
    if (!this.config.baseUrl) throw new ProviderError("unknown", `Hosted provider ${this.config.label} has no base URL`);
  }

  /**
   * OpenAI itself: calls with tools go through the Responses API, the only one that lets current models (gpt-5.x,
   * gpt-6.x, Codex) call tools with reasoning on. On /chat/completions they must run with reasoning off, and the
   * Calculator app's cloud coder then read files in circles on harder steps instead of planning an edit.
   */
  private useResponses(req: ChatRequest): boolean {
    return !!req.tools?.length && /(^|\/\/)api\.openai\.com(\/|$)/.test(this.config.baseUrl ?? "");
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    this.assertEnabled();
    if (this.useResponses(req)) return this.respond(req);
    const started = Date.now();
    const t = withTimeout(req.signal, req.timeoutMs ?? 300_000);
    let status: number | undefined;
    let text = "";
    try {
      const send = (withTemperature: boolean) => fetch(`${this.config.baseUrl!.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: this.headers(),
        signal: t.signal,
        body: JSON.stringify({
          model: req.model,
          ...(withTemperature ? { temperature: req.temperature ?? 0.1 } : {}),
          ...(req.tools?.length && TOOLS_WITHOUT_REASONING.has(req.model) ? { reasoning_effort: "none" } : {}),
          messages: req.messages.map((m) =>
            m.role === "tool"
              ? { role: "tool", tool_call_id: m.toolCallId, content: m.content }
              : m.toolCalls?.length
                ? { role: m.role, content: m.content || null, tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.arguments) } })) }
                : m.images?.length
                  ? { role: m.role, content: [{ type: "text", text: m.content }, ...m.images.map((i) => ({ type: "image_url", image_url: { url: `data:image/png;base64,${i}` } }))] }
                  : { role: m.role, content: m.content },
          ),
          ...(req.tools?.length ? { tools: req.tools.map((x) => ({ type: "function", function: x })) } : {}),
          ...(req.format ? { response_format: { type: "json_schema", json_schema: { name: "output", schema: req.format } } } : {}),
        }),
      });
      let res = await send(!FIXED_TEMPERATURE.has(req.model));
      status = res.status;
      text = await res.text();
      // A model that only takes its default temperature says so in a 400: send again without it, and remember.
      if (res.status === 400 && /temperature/i.test(text) && !FIXED_TEMPERATURE.has(req.model)) {
        FIXED_TEMPERATURE.add(req.model);
        res = await send(false);
        status = res.status;
        text = await res.text();
      }
      if (res.status === 400 && req.tools?.length && /reasoning_effort/i.test(text) && /'none'|"none"/.test(text) && !TOOLS_WITHOUT_REASONING.has(req.model)) {
        TOOLS_WITHOUT_REASONING.add(req.model);
        res = await send(!FIXED_TEMPERATURE.has(req.model));
        status = res.status;
        text = await res.text();
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
      const json = JSON.parse(text) as {
        model: string;
        choices: Array<{ finish_reason?: string; message: { content?: string | null; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const msg = json.choices?.[0]?.message;
      if (!msg) throw new ProviderError("invalid_response", "No choices in response");
      return {
        content: msg.content ?? "",
        toolCalls: (msg.tool_calls ?? []).map((c) => {
          let args: unknown;
          try {
            args = JSON.parse(c.function.arguments);
          } catch {
            throw new ProviderError("tool_call_invalid", `Tool call arguments for ${c.function.name} are not valid JSON`);
          }
          return { id: c.id ?? newId("tc"), name: c.function.name, arguments: args };
        }),
        model: json.model,
        doneReason: json.choices[0].finish_reason,
        usage: { promptTokens: json.usage?.prompt_tokens, completionTokens: json.usage?.completion_tokens },
        durationMs: Date.now() - started,
      };
    } catch (err) {
      throw classifyError(err, t.signal.aborted ? t.signal : req.signal, status, text);
    } finally {
      t.dispose();
    }
  }

  /** One turn through /v1/responses: the conversation as input items, tools as functions, reasoning on (medium). */
  private async respond(req: ChatRequest): Promise<ChatResponse> {
    const started = Date.now();
    const t = withTimeout(req.signal, req.timeoutMs ?? 300_000);
    let status: number | undefined;
    let text = "";
    try {
      const instructions = req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
      const input: unknown[] = [];
      for (const m of req.messages) {
        if (m.role === "system") continue;
        if (m.role === "tool") {
          input.push({ type: "function_call_output", call_id: m.toolCallId, output: m.content });
          continue;
        }
        if (m.role === "user")
          input.push({ role: "user", content: m.images?.length ? [{ type: "input_text", text: m.content }, ...m.images.map((i) => ({ type: "input_image", image_url: `data:image/png;base64,${i}` }))] : m.content });
        else {
          if (m.content) input.push({ role: "assistant", content: m.content });
          for (const c of m.toolCalls ?? []) input.push({ type: "function_call", call_id: c.id, name: c.name, arguments: JSON.stringify(c.arguments) });
        }
      }
      const res = await fetch(`${this.config.baseUrl!.replace(/\/$/, "")}/responses`, {
        method: "POST",
        headers: this.headers(),
        signal: t.signal,
        body: JSON.stringify({
          model: req.model,
          ...(instructions ? { instructions } : {}),
          input,
          tools: (req.tools ?? []).map((x) => ({ type: "function", name: x.name, description: x.description, parameters: x.parameters, strict: false })),
          reasoning: { effort: "medium" },
          store: false,
          ...(req.maxOutputTokens ? { max_output_tokens: Math.max(req.maxOutputTokens, 16_000) } : {}),
          ...(req.format ? { text: { format: { type: "json_schema", name: "output", schema: req.format, strict: false } } } : {}),
        }),
      });
      status = res.status;
      text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
      const json = JSON.parse(text) as {
        model: string;
        status?: string;
        output?: Array<{ type: string; content?: Array<{ type: string; text?: string }>; call_id?: string; id?: string; name?: string; arguments?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      const out = json.output ?? [];
      const content = out.filter((o) => o.type === "message").flatMap((o) => o.content ?? []).filter((c) => c.type === "output_text").map((c) => c.text ?? "").join("");
      const toolCalls = out
        .filter((o) => o.type === "function_call")
        .map((o) => {
          let args: unknown;
          try {
            args = JSON.parse(o.arguments ?? "{}");
          } catch {
            throw new ProviderError("tool_call_invalid", `Tool call arguments for ${o.name} are not valid JSON`);
          }
          return { id: o.call_id ?? o.id ?? newId("tc"), name: o.name ?? "", arguments: args };
        });
      return { content, toolCalls, model: json.model, doneReason: json.status, usage: { promptTokens: json.usage?.input_tokens, completionTokens: json.usage?.output_tokens }, durationMs: Date.now() - started };
    } catch (err) {
      throw classifyError(err, t.signal.aborted ? t.signal : req.signal, status, text);
    } finally {
      t.dispose();
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    if (!this.config.enabled || !this.config.baseUrl) return [];
    let res: Response;
    try {
      res = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/models`, { headers: this.headers(), signal: AbortSignal.timeout(20_000) });
    } catch (err) {
      // "fetch failed" alone says nothing: name the cause (DNS, refused, TLS, proxy, timeout).
      const e = classifyError(err);
      throw new ProviderError(e.kind, `Couldn't reach ${new URL(this.config.baseUrl).host}: ${e.causes.join(" ← ")}`, e.causes);
    }
    const json = (await res.json().catch(() => ({}))) as { data?: Array<{ id: string }>; error?: { message?: string } };
    if (!res.ok) throw new ProviderError(res.status === 401 ? "unknown" : "invalid_response", `${new URL(this.config.baseUrl).host} answered ${res.status}: ${json.error?.message?.slice(0, 200) ?? "no details"}`, [], res.status);
    return (json.data ?? []).map((m) => ({ name: m.id }));
  }

  async describe(model: string): Promise<ModelInfo | undefined> {
    // OpenAI's current models read images (style capture and the visual review need it); others don't say.
    return /^(gpt-4o|gpt-4\.1|gpt-5|o3|o4)/i.test(model) ? { name: model, capabilities: ["vision"] } : { name: model };
  }

  async health() {
    if (!this.config.enabled) return { ok: false, detail: "disabled (hosted providers are off until configured and consented)" };
    return { ok: !!this.config.baseUrl, detail: this.config.baseUrl ? `configured: ${new URL(this.config.baseUrl).host}` : "missing base URL" };
  }
}
