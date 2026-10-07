import { describe, expect, it } from "vitest";
import { isProseFromRequest } from "../src/orchestrator/orchestrator.js";

describe("plan criteria sanity", () => {
  const objective = "Apply the attached theme (new values: indigo accent, white surfaces, DM Sans). Add an 'Add event' button.";
  it("drops phrases lifted from the request prose", () => {
    expect(isProseFromRequest("indigo accent, white surfaces, DM Sans", objective, "")).toBe(true);
  });
  it("keeps short labels, code and text found in reference files", () => {
    expect(isProseFromRequest("Add event", objective, "")).toBe(false);
    expect(isProseFromRequest("--color-accent: #4f46e5", objective, "")).toBe(false);
    expect(isProseFromRequest("indigo accent, white surfaces, DM Sans", objective, "/* indigo accent, white surfaces, DM Sans */")).toBe(false);
    expect(isProseFromRequest("Members can book induction sessions online", objective, "")).toBe(false);
  });
});

describe("invented code checks", () => {
  it("drops whole rules and multi-statement snippets, keeps short tokens and reference text", async () => {
    const { isInventedCode } = await import("../src/orchestrator/orchestrator.js");
    expect(isInventedCode("body { font-family: 'San', sans-serif; }", "")).toBe(true);
    expect(isInventedCode(":root { --background: #ffffff; --text: #000000; }", "")).toBe(true);
    expect(isInventedCode("--font-display", "")).toBe(false);
    expect(isInventedCode("useSchedule", "")).toBe(false);
    expect(isInventedCode("--color-accent: #4f46e5;", "")).toBe(false);
    expect(isInventedCode(".a { color: red; }", ".a { color: red; }")).toBe(false);
  });
});
