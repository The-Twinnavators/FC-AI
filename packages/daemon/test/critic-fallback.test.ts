/** The visual review falls back to the local vision model when the cloud critic is out of credit or unreachable. */
import { describe, expect, it } from "vitest";
import { critiqueWithFallback } from "../src/quality/critique.js";

const cloud = { providerId: "hosted-anthropic", model: "claude-x" };
const local = { providerId: "ollama", model: "qwen2.5vl:3b" };
const shot = [{ name: "home", png: Buffer.from("png") }];

/** A fake router: every model can see; the cloud one throws `cloudError` (if set). */
function router(cloudError?: string) {
  const calls: string[] = [];
  return {
    calls,
    provider: () => ({ describe: async () => ({ capabilities: ["vision"] }) }),
    chat: async (_ctx: unknown, a: { model: string }) => {
      calls.push(a.model);
      if (a.model === cloud.model && cloudError) throw new Error(cloudError);
      return { content: JSON.stringify({ findings: [{ severity: "minor", message: `from ${a.model}` }] }) };
    },
  } as never as Parameters<typeof critiqueWithFallback>[0] & { calls: string[] };
}

describe("visual critique fallback", () => {
  it("uses the local critic when the cloud one is out of credit, and says so", async () => {
    const r = router("HTTP 400: Your credit balance is too low to access the Anthropic API");
    const out = await critiqueWithFallback(r, cloud, local, shot, "brief", {});
    expect(out.ran?.model).toBe(local.model);
    expect(out.fellBack).toMatch(/claude-x couldn't run/);
    expect(out.crit.findings[0]?.message).toMatch(/qwen2\.5vl/);
  });
  it("keeps the cloud review when it works", async () => {
    const r = router();
    const out = await critiqueWithFallback(r, cloud, local, shot, "brief", {});
    expect(out.ran?.model).toBe(cloud.model);
    expect(out.fellBack).toBeUndefined();
    expect((r as unknown as { calls: string[] }).calls).toEqual([cloud.model]);
  });
  it("doesn't fall back for other errors (e.g. a bad answer)", async () => {
    const r = router("Unexpected token < in JSON");
    const out = await critiqueWithFallback(r, cloud, local, shot, "brief", {});
    expect(out.ran?.model).toBe(cloud.model);
    expect(out.crit.status).toBe("skipped");
  });
});
