/**
 * Reliability phase 4: the person has design authority. The AI visual critic is optional and advisory; measured
 * checks stay enforced, and what can't be measured is reported as uncertain, not as passed or failed.
 */
import http from "node:http";
import { describe, expect, it } from "vitest";
import { lookCheck } from "../src/quality/lookCheck.js";
import { BrowserSession } from "../src/quality/preview.js";
import { DEFAULT_RUNTIME_OPTIONS, runtimeOptions, setRuntimeOptions } from "../src/orchestrator/runtimeOptions.js";
import { makeApp } from "./helpers.js";

describe("the visual critic", () => {
  it("is off by default and can be turned on as advisory", () => {
    expect(DEFAULT_RUNTIME_OPTIONS.visualCritic).toBe("off");
    const { app } = makeApp();
    expect(runtimeOptions(app.store).visualCritic).toBe("off");
    expect(setRuntimeOptions(app.store, { visualCritic: "advisory" }).visualCritic).toBe("advisory");
  });
});

const serve = async (html: string) => {
  const server = http.createServer((_req, res) => res.writeHead(200, { "content-type": "text/html" }).end(html));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { server, url: `http://127.0.0.1:${(server.address() as { port: number }).port}/` };
};

describe.skipIf(process.env.FLOWCODE_SKIP_BROWSER === "1")("measured checks", () => {
  it("keeps measured low contrast blocking and reports text over a gradient as uncertain", async () => {
    const html = `<html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:sans-serif;background:#fff}</style></head><body><main><h1>Products</h1>
      <p style="color:#bbb">Pale grey text on white</p>
      <section style="background:linear-gradient(#123, #456);padding:12px"><p style="color:#fff">Text over a gradient</p></section>
    </main></body></html>`;
    const { server, url } = await serve(html);
    const session = await BrowserSession.launch("test-design-authority");
    try {
      const findings = (await lookCheck(session, url)).findings;
      const low = findings.find((f) => f.rule === "low-contrast");
      const unsure = findings.find((f) => f.rule === "contrast-uncertain");
      expect(low).toMatchObject({ serious: true });
      expect(low!.message).toMatch(/Pale grey text on white/);
      expect(low!.message).not.toMatch(/Text over a gradient/);
      expect(unsure).toMatchObject({ serious: false });
      expect(unsure!.message).toMatch(/"Text over a gradient".*uncertain, check it by eye/);
    } finally {
      server.close();
      await session.close();
    }
  }, 60_000);
});
