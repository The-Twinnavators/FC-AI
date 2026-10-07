/** OpenAI-compatible provider: a model that only takes its default temperature is retried without one, and remembered. */
import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { OpenAICompatibleProvider } from "../src/models/openaiCompat.js";

let server: http.Server | undefined;
afterEach(() => new Promise<void>((r) => (server ? server.close(() => r()) : r())));

describe("OpenAI-compatible temperature", () => {
  it("retries without temperature when the model only supports the default, and doesn't send it again", async () => {
    const seen: Array<Record<string, unknown>> = [];
    server = http.createServer((req, res) => {
      let raw = "";
      req.on("data", (d) => (raw += d));
      req.on("end", () => {
        const body = JSON.parse(raw) as Record<string, unknown>;
        seen.push(body);
        if ("temperature" in body) {
          res.writeHead(400, { "content-type": "application/json" });
          // The exact wording OpenAI uses for reasoning models.
          res.end(JSON.stringify({ error: { message: "Unsupported value: 'temperature' does not support 0.2 with this model. Only the default (1) value is supported.", type: "invalid_request_error", param: "temperature", code: "unsupported_value" } }));
          return;
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ model: "gpt-x", choices: [{ message: { content: "ok" } }], usage: {} }));
      });
    });
    await new Promise<void>((r) => server!.listen(0, "127.0.0.1", () => r()));
    const port = (server!.address() as { port: number }).port;
    const p = new OpenAICompatibleProvider({ id: "hosted-openai", kind: "openai_compatible", label: "OpenAI", baseUrl: `http://127.0.0.1:${port}/v1`, enabled: true, hosted: true } as never);
    const model = `reasoning-${Date.now()}`;
    const a = await p.chat({ model, temperature: 0.2, messages: [{ role: "user", content: "hi" }] } as never);
    expect(a.content).toBe("ok");
    expect(seen.map((b) => "temperature" in b)).toEqual([true, false]);
    // Remembered: the next call goes straight out without a temperature.
    await p.chat({ model, temperature: 0, messages: [{ role: "user", content: "again" }] } as never);
    expect(seen.map((b) => "temperature" in b)).toEqual([true, false, false]);
  });
});
