/** Classifies arbitrary failures into typed provider errors with sanitized cause chains (FR-M3). */
import type { ProviderErrorKind } from "@flowcode/contracts";
import { ProviderError } from "./types.js";
import { redact } from "../security/redaction.js";

export function causeChain(err: unknown, depth = 0): string[] {
  if (!err || depth > 5) return [];
  const e = err as { name?: string; code?: string; message?: string; cause?: unknown };
  const label = [e.name, e.code].filter(Boolean).join(":");
  const msg = redact(String(e.message ?? err)).replace(/https?:\/\/[^\s]+/g, (u) => {
    try {
      const url = new URL(u);
      return `${url.protocol}//${url.host}${url.pathname}`;
    } catch {
      return "<url>";
    }
  });
  return [`${label ? label + ": " : ""}${msg}`.slice(0, 500), ...causeChain(e.cause, depth + 1)];
}

export function classifyError(err: unknown, signal?: AbortSignal, status?: number, body?: string): ProviderError {
  if (err instanceof ProviderError) return err;
  const chain = causeChain(err);
  const text = `${chain.join(" | ")} ${body ?? ""}`.toLowerCase();
  const codes = collectCodes(err);
  let kind: ProviderErrorKind = "unknown";
  if (signal?.aborted && !(signal.reason instanceof TimeoutMarker)) kind = "cancelled";
  else if (signal?.reason instanceof TimeoutMarker || codes.has("ETIMEDOUT") || codes.has("UND_ERR_HEADERS_TIMEOUT") || codes.has("UND_ERR_BODY_TIMEOUT") || /timed? ?out/.test(text)) kind = "timeout";
  else if (codes.has("ECONNREFUSED") || /econnrefused|connection refused/.test(text)) kind = "connection_refused";
  else if (codes.has("ECONNRESET") || codes.has("UND_ERR_SOCKET") || codes.has("EPIPE") || /socket hang up|econnreset|other side closed|forcibly closed|wsarecv|runner process has terminated|health resp|connectex|failed to respond|llama runner|runner (?:is )?not (?:ready|responding)/.test(text)) kind = "connection_reset";
  else if (codes.has("ENOTFOUND") || codes.has("EAI_AGAIN") || /getaddrinfo|enotfound/.test(text)) kind = "dns_failure";
  // Out of credits is also a 429 but never passes by waiting (No BIO & GMO build: three attempts retried "no credits
  // remaining" as a rate limit).
  else if (/insufficient_quota|credit_balance_exhausted|no credits remaining|exceeded your current quota|billing|credit balance is too low/.test(text)) kind = "quota_exhausted";
  // Anthropic answers 529 "overloaded_error" when busy: it passes with a pause, like a rate limit.
  else if (status === 429 || status === 529 || /rate limit|too many requests|overloaded_error/.test(text)) kind = "rate_limited";
  else if (/context (length|window)|too many tokens|maximum context|prompt is too long|exceeds.*context/.test(text)) kind = "context_limit";
  // The GPU ran out of memory (Calculator test 1: "CUDA error: out of memory" as an Ollama 500). Usually passes once
  // the runner frees memory, so it's retried after a pause instead of blocking the step.
  else if (/out of memory|cuda error|cudamalloc|insufficient (?:gpu |video )?memory|failed to allocate|not enough memory|model requires more system memory/.test(text)) kind = "out_of_memory";
  // Ollama parses some models' tool calls itself (qwen3-coder's XML) and answers 500 when one is malformed.
  else if (/does not support tools|tool call|tool_calls|invalid tool|function call|xml syntax error|error parsing tool|failed to parse tool/.test(text)) kind = "tool_call_invalid";
  else if ((status && status >= 400) || /invalid json|unexpected token|unexpected end of json|invalid response/.test(text)) kind = "invalid_response";
  if ((err as { name?: string })?.name === "AbortError" && kind === "unknown") kind = signal?.reason instanceof TimeoutMarker ? "timeout" : "cancelled";
  return new ProviderError(kind, chain[0] ?? "Unknown provider error", chain, status);
}

function collectCodes(err: unknown, out = new Set<string>(), depth = 0): Set<string> {
  if (!err || depth > 5) return out;
  const e = err as { code?: string; cause?: unknown; errors?: unknown[] };
  if (e.code) out.add(e.code);
  if (Array.isArray(e.errors)) e.errors.forEach((x) => collectCodes(x, out, depth + 1));
  collectCodes(e.cause, out, depth + 1);
  return out;
}

/** Abort reason used for request timeouts so they are not confused with user cancellation. */
export class TimeoutMarker extends Error {
  constructor() {
    super("request timeout");
  }
}

/** Combines a caller cancellation signal with a timeout. */
export function withTimeout(signal: AbortSignal | undefined, ms: number): { signal: AbortSignal; dispose: () => void } {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(new TimeoutMarker()), ms);
  const onAbort = () => ctrl.abort(signal?.reason ?? new Error("cancelled"));
  if (signal?.aborted) onAbort();
  else signal?.addEventListener("abort", onAbort, { once: true });
  return {
    signal: ctrl.signal,
    dispose: () => {
      clearTimeout(t);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}
