/** Out of API credits is not a rate limit: it's never retried, and the step says what to do. */
import { describe, expect, it } from "vitest";
import { classifyError } from "../src/models/errors.js";

describe("provider errors", () => {
  it("tells running out of credits apart from a rate limit", () => {
    // No BIO & GMO build: "You have no credits remaining" (HTTP 429) was retried three times as a rate limit.
    const quota = classifyError(new Error("HTTP 429"), undefined, 429, '{"error":{"message":"You have no credits remaining.","type":"insufficient_quota","code":"credit_balance_exhausted"}}');
    expect(quota.kind).toBe("quota_exhausted");
    expect(quota.retryable).toBe(false);
    const limited = classifyError(new Error("HTTP 429"), undefined, 429, '{"error":{"message":"Rate limit reached for requests"}}');
    expect(limited.kind).toBe("rate_limited");
    expect(limited.retryable).toBe(true);
  });
});

describe("Ollama runner hiccups", () => {
  it("retries a runner that stopped answering instead of blocking the step", () => {
    // No BIO & GMO build: Ollama's runner health check timed out (HTTP 500) and the step was blocked at once.
    const e = classifyError(new Error('Ollama /api/chat HTTP 500: {"error":"health resp: Get \\"http://127.0.0.1:53255/health\\": dial tcp 127.0.0.1:53255: connectex: A connection attempt failed because the connected party did not properly respond after a period of time"}'), undefined, 500);
    expect(e.kind).toBe("connection_reset");
    expect(e.retryable).toBe(true);
  });
});
