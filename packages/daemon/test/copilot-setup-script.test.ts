/** Before any model can run, the Copilot answers setup questions from a script (no model needed). */
import { describe, expect, it } from "vitest";
import { scripted, setupGreeting, setupReply, type SetupState } from "../../../apps/ui/src/components/copilotSetup";

const base: SetupState = {
  step: "install-ollama",
  ollama: { running: false, installed: false },
  models: [],
  coder: { model: "qwen3-coder:30b" },
  recommend: { model: "qwen3:14b", sizeGb: 9.3, why: "Verified.", lighter: { model: "qwen3:8b", sizeGb: 5.2, why: "Lighter." } },
  assistant: { model: "qwen3:14b", available: false },
};

describe("scripted setup assistant", () => {
  it("is used only while the Copilot has no model", () => {
    expect(scripted(base)).toBe(true);
    expect(scripted({ ...base, ollama: { running: true, installed: true }, assistant: { model: "qwen3:14b", available: true } })).toBe(false);
    expect(scripted({ ...base, ollama: { running: true, installed: true }, assistant: { model: "qwen3:14b", available: false } })).toBe(true);
  });
  it("greets with the next step and quick replies", () => {
    const g = setupGreeting(base);
    expect(g.text).toMatch(/install Ollama/i);
    expect(g.chips).toContain("What is Ollama?");
  });
  it("answers the usual questions and follows the step", () => {
    expect(setupReply("what is ollama", base).text).toMatch(/free program/);
    expect(setupReply("does it cost money?", base).text).toMatch(/Nothing/);
    const pull = { ...base, step: "pull-model" as const, ollama: { running: true, installed: true } };
    expect(setupReply("what do I do next", pull).text).toMatch(/ollama pull qwen3:14b/);
    expect(setupReply("which model?", pull).text).toMatch(/qwen3:8b/);
    expect(setupReply("how do I open a terminal", pull).text).toMatch(/PowerShell/);
    expect(setupReply("write me a poem", pull).text).toMatch(/sticking to setup/);
  });
});
