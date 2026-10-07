/** Deterministic scripted models used by Phase 3/4 acceptance tests. */
import { ScriptedProvider, call } from "../src/models/scripted.js";
import type { ChatMessage, ChatRequest } from "../src/models/types.js";

const toolMsgs = (h: ChatMessage[]) => h.filter((m) => m.role === "tool");
const lastTool = (h: ChatMessage[]) => toolMsgs(h).at(-1)?.content ?? "";
const userText = (h: ChatMessage[]) => h.find((m) => m.role === "user")?.content ?? "";

/** A model that solves every capability probe correctly using native tool calls. */
export function idealProbeSolver(id = "scripted-ideal") {
  return new ScriptedProvider({ id, kind: "scripted", label: "Scripted ideal coder", enabled: true, hosted: false }, (_req: ChatRequest, h) => {
    const u = userText(h);
    const n = toolMsgs(h).length;
    if (u.includes("codeword")) return n === 0 ? { toolCalls: [call("read_file", { path: "notes/codeword.txt" })] } : { toolCalls: [call("task_complete", { summary: `The codeword is ${/codeword is (\w+)/.exec(lastTool(h))?.[1]}` })] };
    if (u.includes("src/hello.txt")) return n === 0 ? { toolCalls: [call("create_file", { path: "src/hello.txt", content: "hello flowcode\n" })] } : { toolCalls: [call("task_complete", { summary: "created" })] };
    if (u.includes("src/math.js"))
      return n === 0
        ? { toolCalls: [call("read_file", { path: "src/math.js" })] }
        : n === 1
          ? { toolCalls: [call("apply_patch", { path: "src/math.js", edits: [{ find: "export function add(a, b) {\n  return a - b;", replace: "export function add(a, b) {\n  return a + b;" }] })] }
          : { toolCalls: [call("task_complete", { summary: "fixed add" })] };
    if (u.includes('"typecheck"'))
      return n === 0
        ? { toolCalls: [call("edit_package_manifest", { operations: [{ op: "set_script", name: "typecheck", command: "tsc --noEmit" }, { op: "add_dependency", name: "typescript", version: "^5.6.0", dev: true }] })] }
        : { toolCalls: [call("task_complete", { summary: "manifest updated" })] };
    if (u.includes("data/values.json")) {
      if (n === 0) return { toolCalls: [call("read_file", { path: "data/values.json" })] };
      if (n === 1) {
        const nums = (/\[([\d,\s]+)\]/.exec(lastTool(h))?.[1] ?? "").split(",").map(Number);
        return { toolCalls: [call("create_file", { path: "data/sum.txt", content: String(nums.reduce((a, b) => a + b, 0)) })] };
      }
      return { toolCalls: [call("task_complete", { summary: "sum written" })] };
    }
    if (u.includes("legacy/old-config.txt")) return { toolCalls: [call("delete_file", { path: "legacy/old-config.txt", reason: "obsolete" })] };
    if (u.includes("report the outcome accurately")) return n === 0 ? { toolCalls: [call("run_script", { script: "test", reason: "run tests" })] } : { toolCalls: [call("report_blocked", { reason: "Test sum failed: expected 4 to be 5", nextAction: "Fix sum or the test expectation" })] };
    if (u.includes("src/greet.js")) {
      const seq = ["run", "read", "patch", "run", "done"][n];
      if (seq === "run") return { toolCalls: [call("run_script", { script: "test", reason: "check" })] };
      if (seq === "read") return { toolCalls: [call("read_file", { path: "src/greet.js" })] };
      if (seq === "patch") return { toolCalls: [call("apply_patch", { path: "src/greet.js", edits: [{ find: "nme", replace: "name" }] })] };
      return { toolCalls: [call("task_complete", { summary: "repaired" })] };
    }
    return { toolCalls: [call("report_blocked", { reason: "unknown probe", nextAction: "none" })] };
  });
}

/** A model that writes tool calls as JSON text (the classic local-model failure). */
export function pseudoJsonModel(id = "scripted-pseudo") {
  return new ScriptedProvider({ id, kind: "scripted", label: "Scripted pseudo-JSON", enabled: true, hosted: false }, () => ({ content: '```json\n{"name": "read_file", "arguments": {"path": "README.md"}}\n```' }));
}
