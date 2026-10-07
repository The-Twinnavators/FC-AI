/** Tool calls a model writes as text (qwen3-coder on Ollama) are read, then run with the usual checks. */
import { describe, expect, it } from "vitest";
import { parseTextToolCalls } from "../src/orchestrator/agentLoop.js";

const ALLOWED = new Set(["read_file", "create_file", "apply_patch", "task_complete"]);

describe("tool calls written as text", () => {
  it("reads Qwen3-Coder's <function=…> format, keeping text values and parsing JSON ones", () => {
    const text = `I'll create it.\n<tool_call>\n<function=create_file>\n<parameter=path>\nsrc/hello.txt\n</parameter>\n<parameter=content>\nhello flowcode\n</parameter>\n</function>\n</tool_call>`;
    expect(parseTextToolCalls(text, ALLOWED)).toMatchObject([{ name: "create_file", arguments: { path: "src/hello.txt", content: "hello flowcode" } }]);
    const patch = `<function=apply_patch><parameter=path>src/a.ts</parameter><parameter=edits>[{"find":"a","replace":"b"}]</parameter></function>`;
    expect(parseTextToolCalls(patch, ALLOWED)[0].arguments).toEqual({ path: "src/a.ts", edits: [{ find: "a", replace: "b" }] });
  });

  it("reads JSON calls in <tool_call> tags, code fences or plain prose, with the usual key names", () => {
    expect(parseTextToolCalls(`<tool_call>{"name": "read_file", "arguments": {"path": "data/values.json"}}</tool_call>`, ALLOWED)).toMatchObject([{ name: "read_file", arguments: { path: "data/values.json" } }]);
    expect(parseTextToolCalls('```json\n{"tool": "task_complete", "parameters": {"summary": "done"}}\n```', ALLOWED)).toMatchObject([{ name: "task_complete", arguments: { summary: "done" } }]);
    expect(parseTextToolCalls(`Next: {"name":"read_file","arguments":"{\\"path\\":\\"a.md\\"}"} then done.`, ALLOWED)).toMatchObject([{ name: "read_file", arguments: { path: "a.md" } }]);
  });

  it("ignores tools the role may not use, and text that isn't a call", () => {
    expect(parseTextToolCalls(`{"name": "run_command", "arguments": {"argv": ["rm", "-rf", "/"]}}`, ALLOWED)).toEqual([]);
    expect(parseTextToolCalls(`<function=delete_file><parameter=path>src/App.tsx</parameter></function>`, ALLOWED)).toEqual([]);
    expect(parseTextToolCalls("I updated the file and everything looks right.", ALLOWED)).toEqual([]);
    expect(parseTextToolCalls(`The config is {"name": "demo", "version": 1}.`, ALLOWED)).toEqual([]);
  });
});

describe("answerEveryToolCall", () => {
  it("puts every tool call's result right after it and fills in calls a guard cut short (OpenAI requires both)", async () => {
    const { answerEveryToolCall } = await import("../src/orchestrator/agentLoop.js");
    const messages = [
      { role: "system" as const, content: "s" },
      { role: "assistant" as const, content: "", toolCalls: [{ id: "a", name: "read_file", arguments: {} }, { id: "b", name: "read_file", arguments: {} }, { id: "c", name: "run_script", arguments: {} }] },
      { role: "tool" as const, content: "A", toolCallId: "a", toolName: "read_file" },
      { role: "user" as const, content: "Runtime notice" },
      { role: "tool" as const, content: "B", toolCallId: "b", toolName: "read_file" },
    ];
    answerEveryToolCall(messages);
    expect(messages.map((m) => (m.role === "tool" ? `tool:${m.toolCallId}` : m.role))).toEqual(["system", "assistant", "tool:a", "tool:b", "tool:c", "user"]);
    expect(messages[4].content).toMatch(/^Not run/);
  });
});
