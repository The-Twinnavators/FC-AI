import type { ProviderConfig, ProviderErrorKind } from "@flowcode/contracts";

export interface ToolCall {
  id: string;
  name: string;
  arguments: unknown;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  toolName?: string;
  /** Base64 PNG/JPEG images for vision-capable models. */
  images?: string[];
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  tools?: ToolDef[];
  temperature?: number;
  /** JSON schema for structured (non-tool) output. */
  format?: Record<string, unknown>;
  signal?: AbortSignal;
  timeoutMs?: number;
  contextWindow?: number;
  /** Enable model-side reasoning for thinking-capable models (default off). */
  think?: boolean;
  /**
   * Most tokens the model may write. Structured (JSON) replies default to 4096: small models sometimes loop when
   * forced into JSON and would otherwise write until the time-out (a 10-minute plan instead of 20 seconds).
   */
  maxOutputTokens?: number;
}

export interface ChatResponse {
  content: string;
  toolCalls: ToolCall[];
  model: string;
  modelVersion?: string;
  doneReason?: string;
  usage?: { promptTokens?: number; completionTokens?: number };
  durationMs: number;
  /**
   * Where the time went, when the provider reports it (Ollama does): loading the model into memory, reading the
   * prompt, and writing the reply. The rest of durationMs is network and queueing.
   */
  timing?: { loadMs?: number; promptMs?: number; generateMs?: number };
}

export interface ModelInfo {
  name: string;
  digest?: string;
  sizeBytes?: number;
  capabilities?: string[];
  family?: string;
  parameterSize?: string;
}

export interface Provider {
  readonly config: ProviderConfig;
  chat(req: ChatRequest): Promise<ChatResponse>;
  listModels(signal?: AbortSignal): Promise<ModelInfo[]>;
  describe(model: string): Promise<ModelInfo | undefined>;
  embed?(model: string, input: string[], signal?: AbortSignal): Promise<number[][]>;
  health(): Promise<{ ok: boolean; detail: string }>;
}

/** Typed provider error with sanitized cause chain (FR-M3). */
export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    message: string,
    readonly causes: string[] = [],
    readonly status?: number,
  ) {
    super(message);
  }

  get retryable(): boolean {
    return RETRYABLE.has(this.kind);
  }
}

/** Only bounded transport failures are retryable. Cancellation is terminal (FR-M4). */
export const RETRYABLE: ReadonlySet<ProviderErrorKind> = new Set(["timeout", "connection_refused", "connection_reset", "rate_limited", "dns_failure", "out_of_memory"]);
