/**
 * Each cloud provider keeps its own model: switching from Anthropic to an OpenAI-compatible endpoint never carries the
 * Claude model name across (it did, through the older single `model` setting, and the pair reported ready).
 */
import { describe, expect, it } from "vitest";
import { ANTHROPIC_PROVIDER, CLOUD_PROVIDER, cloudCoder } from "../src/models/cloud.js";

const router = { providerConfigs: () => [] } as unknown as Parameters<typeof cloudCoder>[0];
const storeWith = (setting: unknown) => ({ getSetting: () => setting }) as unknown as Parameters<typeof cloudCoder>[1];

describe("cloud coder model per provider", () => {
  it("doesn't borrow the last-saved Claude model for the OpenAI-compatible endpoint", () => {
    const store = storeWith({ provider: CLOUD_PROVIDER, model: "claude-sonnet-5-5", models: { [ANTHROPIC_PROVIDER]: "claude-sonnet-5-5" } });
    expect(cloudCoder(router, store).model).toBe("");
  });

  it("keeps each provider's own model", () => {
    const models = { [ANTHROPIC_PROVIDER]: "claude-sonnet-5-5", [CLOUD_PROVIDER]: "gpt-5.6-sol" };
    expect(cloudCoder(router, storeWith({ provider: CLOUD_PROVIDER, model: "claude-sonnet-5-5", models })).model).toBe("gpt-5.6-sol");
    expect(cloudCoder(router, storeWith({ provider: ANTHROPIC_PROVIDER, model: "gpt-5.6-sol", models })).model).toBe("claude-sonnet-5-5");
  });

  it("still reads the single model of settings saved before the per-provider list", () => {
    expect(cloudCoder(router, storeWith({ provider: CLOUD_PROVIDER, model: "gpt-5.6-sol" })).model).toBe("gpt-5.6-sol");
  });
});
