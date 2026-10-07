/** The native Anthropic provider: message conversion, prompt caching, tool calls, images and errors. */
import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { AnthropicProvider, safeToolId, toAnthropic } from "../src/models/anthropic.js";

type Body = Record<string, any>;
let server: http.Server | undefined;
afterEach(() => new Promise<void>((r) => (server ? server.close(() => r()) : r())));

/** A fake api.anthropic.com: records each request and answers with `reply(body, n)`. */
async function fake(reply: (body: Body, n: number) => { status?: number; json: unknown }) {
  const seen: Array<{ body: Body; headers: http.IncomingHttpHeaders }> = [];
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (d) => (raw += d));
    req.on("end", () => {
      const body = raw ? JSON.parse(raw) : {};
      seen.push({ body, headers: req.headers });
      const out = reply(body, seen.length);
      res.writeHead(out.status ?? 200, { "content-type": "application/json" });
      res.end(JSON.stringify(out.json));
    });
  });
  await new Promise<void>((r) => server!.listen(0, "127.0.0.1", () => r()));
  const port = (server!.address() as { port: number }).port;
  process.env.FLOWCODE_TEST_ANTHROPIC_KEY = "sk-ant-test-key";
  const provider = new AnthropicProvider({ id: "hosted-anthropic", kind: "anthropic", label: "Anthropic", baseUrl: `http://127.0.0.1:${port}`, enabled: true, hosted: true, apiKeyRef: "FLOWCODE_TEST_ANTHROPIC_KEY" });
  return { provider, seen };
}

describe("Anthropic messages", () => {
  it("puts the system prompt apart, tool results in user turns after their calls, and merges same-role turns", () => {
    const { system, turns } = toAnthropic([
      { role: "system", content: "Be careful." },
      { role: "user", content: "Build it" },
      { role: "assistant", content: "", toolCalls: [{ id: "call:1", name: "read_file", arguments: { path: "a.ts" } }] },
      { role: "tool", content: "file text", toolCallId: "call:1" },
      { role: "user", content: "Runtime notice: check your work" },
      { role: "assistant", content: "Done" },
    ]);
    expect(system).toBe("Be careful.");
    expect(turns.map((t) => t.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(turns[1].content[0]).toMatchObject({ type: "tool_use", id: safeToolId("call:1"), name: "read_file", input: { path: "a.ts" } });
    expect(turns[2].content.map((b) => b.type)).toEqual(["tool_result", "text"]);
    expect(turns[2].content[0]).toMatchObject({ tool_use_id: safeToolId("call:1") });
    expect(safeToolId("call:1")).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("sends images as base64 blocks with their type", () => {
    const { turns } = toAnthropic([{ role: "user", content: "Judge this screen", images: ["iVBORw0KGgo=", "/9j/4AAQ"] }]);
    expect(turns[0].content.slice(0, 2)).toEqual([
      { type: "image", source: { type: "base64", media_type: "image/png", data: "iVBORw0KGgo=" } },
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "/9j/4AAQ" } },
    ]);
  });
});

describe("Anthropic provider", () => {
  it("calls the Messages API with the key, caches the system prompt, tools and newest turn, and reads tool calls", async () => {
    const { provider, seen } = await fake(() => ({
      json: { model: "claude-sonnet-5-5", stop_reason: "tool_use", content: [{ type: "text", text: "Reading." }, { type: "tool_use", id: "toolu_1", name: "read_file", input: { path: "src/App.tsx" } }], usage: { input_tokens: 10, cache_read_input_tokens: 900, output_tokens: 20 } },
    }));
    const res = await provider.chat({
      model: "claude-sonnet-5-5",
      messages: [{ role: "system", content: "System prompt" }, { role: "user", content: "Do the step" }],
      tools: [{ name: "list_files", description: "List", parameters: { type: "object", properties: {} } }, { name: "read_file", description: "Read", parameters: { type: "object", properties: { path: { type: "string" } } } }],
    });
    const { body, headers } = seen[0];
    expect(headers["x-api-key"]).toBe("sk-ant-test-key");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers.authorization).toBeUndefined();
    expect(body.system).toEqual([{ type: "text", text: "System prompt", cache_control: { type: "ephemeral" } }]);
    expect(body.tools[0].cache_control).toBeUndefined();
    expect(body.tools[1]).toMatchObject({ name: "read_file", input_schema: { type: "object" }, cache_control: { type: "ephemeral" } });
    expect(body.messages.at(-1).content.at(-1).cache_control).toEqual({ type: "ephemeral" });
    expect(res.content).toBe("Reading.");
    expect(res.toolCalls).toEqual([{ id: "toolu_1", name: "read_file", arguments: { path: "src/App.tsx" } }]);
    expect(res.usage).toEqual({ promptTokens: 910, completionTokens: 20 });
  });

  it("asks for JSON with the schema when a structured reply is wanted", async () => {
    const { provider, seen } = await fake(() => ({ json: { model: "m", content: [{ type: "text", text: '{"ok":true}' }] } }));
    await provider.chat({ model: "m", messages: [{ role: "user", content: "Plan" }], format: { type: "object", properties: { ok: { type: "boolean" } } } });
    expect(seen[0].body.system[0].text).toContain("JSON Schema");
  });

  it("drops the temperature for a model that refuses it, and remembers", async () => {
    const { provider, seen } = await fake((b) => ("temperature" in b ? { status: 400, json: { type: "error", error: { type: "invalid_request_error", message: "temperature is not supported for this model" } } } : { json: { model: "m", content: [{ type: "text", text: "ok" }] } }));
    expect((await provider.chat({ model: "claude-opus-5-5", messages: [{ role: "user", content: "hi" }] })).content).toBe("ok");
    await provider.chat({ model: "claude-opus-5-5", messages: [{ role: "user", content: "again" }] });
    expect(seen.map((s) => "temperature" in s.body)).toEqual([true, false, false]);
  });

  it("reports running out of credit as quota (not retried) and overload as a rate limit (retried)", async () => {
    let mode = "credit";
    const { provider } = await fake(() => (mode === "credit" ? { status: 400, json: { type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." } } } : { status: 529, json: { type: "error", error: { type: "overloaded_error", message: "Overloaded" } } }));
    const credit = await provider.chat({ model: "m", messages: [{ role: "user", content: "hi" }] }).catch((e) => e);
    expect(credit.kind).toBe("quota_exhausted");
    expect(credit.retryable).toBe(false);
    expect(String(credit.message)).not.toContain("sk-ant");
    mode = "busy";
    const busy = await provider.chat({ model: "m", messages: [{ role: "user", content: "hi" }] }).catch((e) => e);
    expect(busy.kind).toBe("rate_limited");
    expect(busy.retryable).toBe(true);
  });

  it("lists models and says Claude reads images", async () => {
    const { provider } = await fake(() => ({ json: { data: [{ id: "claude-sonnet-5-5" }, { id: "claude-haiku-4-5-20251001" }] } }));
    expect((await provider.listModels()).map((m) => m.name)).toEqual(["claude-sonnet-5-5", "claude-haiku-4-5-20251001"]);
    expect((await provider.describe("claude-sonnet-5-5"))?.capabilities).toContain("vision");
  });
});

describe("output limits", () => {
  it("gives tool calls room for whole files, and learns a model's lower limit from its error", async () => {
    const { statedOutputLimit } = await import("../src/models/anthropic.js");
    expect(statedOutputLimit("max_tokens: 16000 > 8192, which is the maximum allowed number of output tokens for claude-x", 16000)).toBe(8192);
    expect(statedOutputLimit("temperature is not supported", 16000)).toBeUndefined();
    const { provider, seen } = await fake((b) => (b.max_tokens > 8192 ? { status: 400, json: { type: "error", error: { type: "invalid_request_error", message: `max_tokens: ${b.max_tokens} > 8192, which is the maximum allowed number of output tokens for claude-small` } } } : { json: { model: "claude-small", content: [{ type: "text", text: "ok" }] } }));
    const tools = [{ name: "read_file", description: "Read", parameters: { type: "object", properties: {} } }];
    expect((await provider.chat({ model: "claude-small", messages: [{ role: "user", content: "hi" }], tools, maxOutputTokens: 4096 })).content).toBe("ok");
    await provider.chat({ model: "claude-small", messages: [{ role: "user", content: "again" }], tools, maxOutputTokens: 4096 });
    expect(seen.map((s) => s.body.max_tokens)).toEqual([16000, 8192, 8192]);
  });
});
