/**
 * Deterministic scripted provider used by integration tests and the mocked-agent acceptance test
 * (Phase 4). A script is a function of the conversation so far that returns the next response.
 */
import type { ProviderConfig } from "@flowcode/contracts";
import { ProviderError, type ChatRequest, type ChatResponse, type ChatMessage, type ModelInfo, type Provider, type ToolCall } from "./types.js";
import { newId } from "../util/ids.js";

export type ScriptStep = (req: ChatRequest, history: ChatMessage[]) => Partial<ChatResponse> | ProviderError | Promise<Partial<ChatResponse> | ProviderError>;

export class ScriptedProvider implements Provider {
  readonly calls: ChatRequest[] = [];
  constructor(
    readonly config: ProviderConfig,
    private script: ScriptStep,
    private models: ModelInfo[] = [{ name: "scripted-coder", capabilities: ["completion", "tools"] }],
  ) {}

  async chat(req: ChatRequest): Promise<ChatResponse> {
    if (req.signal?.aborted) throw new ProviderError("cancelled", "cancelled");
    this.calls.push(req);
    const signal = req.signal;
    const out = await new Promise<Awaited<ReturnType<ScriptStep>>>((resolve, reject) => {
      const onAbort = () => reject(new ProviderError("cancelled", "cancelled"));
      signal?.addEventListener("abort", onAbort, { once: true });
      Promise.resolve(this.script(req, req.messages)).then(
        (v) => {
          signal?.removeEventListener("abort", onAbort);
          resolve(v);
        },
        (e) => {
          signal?.removeEventListener("abort", onAbort);
          reject(e);
        },
      );
    });
    if (out instanceof ProviderError) throw out;
    return {
      content: out.content ?? "",
      toolCalls: (out.toolCalls ?? []).map((c: ToolCall) => ({ ...c, id: c.id ?? newId("tc") })),
      model: req.model,
      durationMs: 1,
      doneReason: "stop",
    };
  }

  async listModels() {
    return this.models;
  }

  async describe(model: string) {
    // A test double: any model a test assigns is "installed" (the coder check before each step asks).
    return this.models.find((m) => m.name === model) ?? { name: model, capabilities: ["completion", "tools"] };
  }

  async health() {
    return { ok: true, detail: "scripted" };
  }
}

/** Helper to build a tool call. */
export function call(name: string, args: unknown): ToolCall {
  return { id: newId("tc"), name, arguments: args };
}
