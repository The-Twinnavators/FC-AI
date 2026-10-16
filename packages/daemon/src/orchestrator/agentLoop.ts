/**
 * Agent tool loop with the action-required contract (FR-A4, §10.3). The model must either invoke an
 * allowed tool natively or return a structured blocked/approval result. Prose-only answers and
 * pseudo tool JSON in text are never treated as work; they get a bounded corrective nudge and then
 * end the loop as `no_action`.
 */
import { z } from "zod";
import { ToolArgs, TOOL_DESCRIPTIONS, ROLE_TOOLS, type AgentRole, type ModelAssignment, type ToolName, type ToolCallRecord } from "@flowcode/contracts";
import type { ModelRouter } from "../models/router.js";
import type { ChatMessage, ToolDef, ToolCall } from "../models/types.js";
import { ProviderError } from "../models/types.js";
import type { Store } from "../db/store.js";
import type { EventBus } from "../events/bus.js";
import { newId, nowIso, sha256, stableStringify } from "../util/ids.js";
import { redact, redactValue } from "../security/redaction.js";

export interface ToolExecution {
  content: string;
  ok: boolean;
  terminal?: AgentOutcome;
}

export type ToolExecutor = (name: ToolName, args: unknown, call: ToolCall, toolCallId: string) => Promise<ToolExecution>;

/**
 * A tool from outside FlowCode's own set (an MCP server's), offered for this step only. It runs its own governance
 * (approval, time limit, untrusted output); the loop logs it like any other call.
 */
export interface ExtraTool {
  def: ToolDef;
  run: (args: Record<string, unknown>, signal?: AbortSignal) => Promise<ToolExecution>;
}

import { InvestigationTracker, investigationLimits, investigationPrompt, parseInvestigationAnswer, type Overrun } from "./investigation.js";

export type AgentOutcome =
  | { kind: "complete"; summary: string; changedPaths: string[] }
  | { kind: "blocked"; reason: string; nextAction: string }
  | { kind: "approval_needed"; action: string; reason: string; risk: "low" | "medium" | "high" }
  | { kind: "no_action"; reason: string }
  | { kind: "budget_exhausted"; reason: string }
  /** The agent's answer to the investigation check: the step is too big for one go (investigation.ts). */
  | { kind: "split_required"; reason: string }
  | { kind: "cancelled" }
  | { kind: "model_error"; error: ProviderError };

export interface AgentLoopInput {
  router: ModelRouter;
  store: Store;
  bus: EventBus;
  role: AgentRole;
  assignment: ModelAssignment;
  system: string;
  user: string;
  executor: ToolExecutor;
  allowedTools?: ToolName[];
  /** MCP tools for this step (already limited to the role and the per-step maximum). */
  extraTools?: ExtraTool[];
  maxTurns?: number;
  signal?: AbortSignal;
  projectId?: string;
  runId: string;
  taskId?: string;
  /** Max chars kept per tool result in the transcript. */
  toolResultChars?: number;
  /** Max nudges for prose-only replies before giving up. */
  maxNudges?: number;
  onTranscript?: (messages: ChatMessage[]) => void;
  /**
   * Called when the model answers in prose instead of calling a tool. Returning an outcome ends the loop
   * with it, e.g. a read-only task whose acceptance checks already pass is complete, not "no action".
   */
  onProseOnly?: (text: string) => Promise<AgentOutcome | undefined>;
  /**
   * FlowCode's no-progress guards stopped this step twice already: give the reading limits three times the room for
   * this attempt (stepRecovery.ts guardStops). The "same failing call" guard stays as it is.
   */
  relaxGuards?: boolean;
  /**
   * The tools the model is shown (8GB GPU profile: the step's own set, toolSelection.ts). Tools the role allows but the
   * step isn't shown still run if called. Default: every allowed tool.
   */
  advertisedTools?: ToolName[];
  /** Reads of new content before the investigation check (runtime option; 0 or unset: 40 local, 120 cloud). */
  investigationBudget?: number;
  /** Answers "missing information" from the project (bounded), once per attempt. Undefined: nothing found. */
  supplyInfo?: (needs: string[]) => Promise<string | undefined>;
}

export interface AgentLoopResult {
  outcome: AgentOutcome;
  turns: number;
  toolCalls: number;
  invalidToolCalls: number;
  nativeToolCalls: number;
  pseudoToolText: number;
  /** Tool calls the model wrote as text that were read and run. */
  textToolCalls: number;
  transcript: ChatMessage[];
  /** Files edits were applied to in this attempt, in order (one entry per applied edit). */
  appliedEdits: string[];
}

/**
 * Edits run from one reply: each is checked before the next batch, so a long reply can't half-apply and leave the rest
 * unaccounted for (Clean Cart controlled build: one reply carried 55 apply_patch calls, hit the 4,096-token output
 * limit, 2 applied, 5 failed on text the earlier ones had changed, and the attempt ended on "the same call failed 3 times").
 */
export const MAX_EDITS_PER_REPLY = 8;

const toolSchemaCache = new Map<string, ToolDef>();
const EDIT_TOOLS = new Set<string>(["apply_patch", "replace_file", "create_file", "edit_json", "edit_yaml", "edit_toml"]);
/** Tools that only look (reading files, listing, searching). */
const READ_TOOLS = new Set(["read_file", "list_files", "search_code", "search_catalog", "get_catalog_contract"]);

/**
 * Every tool call in the history gets its result right after the call, as OpenAI requires: a turn cut short by a guard
 * leaves later calls unanswered, and a runtime notice can land between a call and its results (Calculator app:
 * "An assistant message with 'tool_calls' must be followed by tool messages"). Results are moved next to their call
 * and a missing one is filled in as "not run". Changes `messages` in place.
 */
export function answerEveryToolCall(messages: ChatMessage[]): void {
  const out: ChatMessage[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    // Results are placed right after their call (below); one without a call is dropped.
    if (m.role === "tool") continue;
    out.push(m);
    if (m.role !== "assistant" || !m.toolCalls?.length) continue;
    const nextAssistant = messages.findIndex((x, k) => k > i && x.role === "assistant");
    const window = messages.slice(i + 1, nextAssistant < 0 ? undefined : nextAssistant);
    for (const c of m.toolCalls) {
      const r = window.find((x) => x.role === "tool" && x.toolCallId === c.id);
      out.push(r ?? { role: "tool", toolCallId: c.id, toolName: c.name, content: "Not run: an earlier call in the same turn ended it. Call it again if you still need it." });
    }
  }
  messages.splice(0, messages.length, ...out);
}

export function toolDef(name: ToolName): ToolDef {
  let d = toolSchemaCache.get(name);
  if (!d) {
    const schema = z.toJSONSchema(ToolArgs[name], { target: "draft-7", io: "input" }) as Record<string, unknown>;
    delete schema.$schema;
    d = { name, description: TOOL_DESCRIPTIONS[name], parameters: schema };
    toolSchemaCache.set(name, d);
  }
  return d;
}

/** Detects text that imitates a tool call instead of using native tool calling. */
export function looksLikePseudoToolCall(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return (
    /"(name|tool|function|tool_name|action)"\s*:\s*"(list_files|search_code|read_file|create_file|apply_patch|edit_json|edit_yaml|edit_toml|edit_package_manifest|replace_file|move_file|delete_file|run_command|run_script|request_approval|report_blocked|task_complete)"/.test(t) ||
    /<tool_call>|<function=|\[TOOL_CALLS\]/.test(t)
  );
}

/**
 * Tool calls a model wrote as text instead of native calls (qwen3-coder on Ollama often does): JSON objects, Hermes
 * <tool_call>{…}</tool_call>, or Qwen3-Coder's <function=name><parameter=key>value</parameter></function>. Only tools
 * the role may use are returned; each still goes through the same argument validation, permissions and approvals as a
 * native call. Returns [] when the text holds no recognisable call.
 */
export function parseTextToolCalls(text: string, allowed: Set<string>): ToolCall[] {
  const out: ToolCall[] = [];
  const add = (name: unknown, args: unknown) => {
    if (typeof name !== "string" || !allowed.has(name)) return;
    let a = args;
    if (typeof a === "string") {
      try {
        a = JSON.parse(a);
      } catch {
        return;
      }
    }
    if (a === undefined) a = {};
    if (a === null || typeof a !== "object" || Array.isArray(a)) return;
    out.push({ id: `text_${out.length}_${Date.now().toString(36)}`, name, arguments: a });
  };
  // Qwen3-Coder XML: <function=create_file><parameter=path>src/a.txt</parameter>…</function>
  for (const f of text.matchAll(/<function=([\w-]+)>([\s\S]*?)<\/function>/g)) {
    const args: Record<string, unknown> = {};
    for (const p of f[2].matchAll(/<parameter=([\w-]+)>\n?([\s\S]*?)\n?<\/parameter>/g)) {
      const raw = p[2];
      // Values that are JSON (arrays like edits, numbers, booleans) are parsed; everything else stays text.
      let v: unknown = raw;
      if (/^\s*[[{]|^\s*(true|false|null|-?\d+(\.\d+)?)\s*$/.test(raw)) {
        try {
          v = JSON.parse(raw);
        } catch {
          v = raw;
        }
      }
      args[p[1]] = v;
    }
    add(f[1], args);
  }
  if (out.length) return out;
  // JSON objects, in <tool_call> tags, ```json fences or bare: {"name": "...", "arguments": {...}}
  const candidates: string[] = [];
  for (const m of text.matchAll(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g)) candidates.push(m[1]);
  for (const m of text.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/g)) candidates.push(m[1]);
  if (!candidates.length) candidates.push(...balancedObjects(text));
  for (const c of candidates) {
    let v: unknown;
    try {
      v = JSON.parse(c.trim());
    } catch {
      continue;
    }
    for (const o of Array.isArray(v) ? v : [v]) {
      if (!o || typeof o !== "object") continue;
      const r = o as Record<string, unknown>;
      const fn = r.function && typeof r.function === "object" ? (r.function as Record<string, unknown>) : undefined;
      add(r.name ?? r.tool ?? r.tool_name ?? fn?.name, r.arguments ?? r.parameters ?? r.args ?? r.input ?? fn?.arguments);
    }
  }
  return out;
}

/**
 * A whole file written as a code block in the reply instead of as a tool call. In text mode qwen3-coder explains the fix
 * and then writes the corrected file in a ```tsx block (No BIO & GMO build: three attempts in a row, each "prose only",
 * the right fix never applied). When the reply names exactly one source file and has one complete code block for it,
 * that is a replace_file call, checked like any other. Fragments ("// ... rest unchanged") are not.
 */
export function codeBlockEdit(text: string, allowed: Set<string>): ToolCall | undefined {
  if (!allowed.has("replace_file")) return undefined;
  const blocks = [...text.matchAll(/```([\w.+-]*)[ \t]*([^\n`]*)\n([\s\S]*?)```/g)].filter((b) => /^(tsx?|jsx?|typescript|javascript|css|json)?$/i.test(b[1]));
  if (blocks.length !== 1) return undefined;
  const [, , info, code] = blocks[0];
  const pathRe = /\b((?:src|app|lib|public)\/[\w./-]+\.(?:tsx|ts|jsx|js|css|json))\b/g;
  const named = new Set([...`${info}\n${text.slice(0, blocks[0].index)}`.matchAll(pathRe)].map((m) => m[1]));
  if (named.size !== 1) return undefined;
  const lines = code.split("\n").length;
  if (lines < 12) return undefined;
  if (/(\/\/|\/\*|#)\s*\.{3}|\.\.\.\s*(rest|existing|unchanged|same|other)|rest of (the )?(file|code|component)|unchanged/i.test(code)) return undefined;
  const [path] = named;
  if (/\.(tsx?|jsx?)$/.test(path) && !/^\s*(import|export)\b/m.test(code)) return undefined;
  return { id: `text_block_${Date.now().toString(36)}`, name: "replace_file", arguments: { path, content: code.replace(/\n$/, ""), reason: "the corrected file, written as a code block in the reply" } };
}

/** The tools as text, for a model whose native tool calls the provider can't parse: the format to write and each tool. */
export function textToolGuide(tools: ToolDef[]): string {
  const params = (t: ToolDef) => {
    const props = (t.parameters as { properties?: Record<string, unknown>; required?: string[] }).properties ?? {};
    const req = new Set((t.parameters as { required?: string[] }).required ?? []);
    return Object.keys(props)
      .map((k) => (req.has(k) ? k : `${k}?`))
      .join(", ");
  };
  return [
    "Tools: call a tool by writing exactly this (one block per call; file content goes in as plain text, nothing escaped):",
    "<function=TOOL_NAME>\n<parameter=ARGUMENT>\nvalue\n</parameter>\n</function>",
    "Arguments that are lists or objects (like apply_patch's edits) are written as JSON. Available tools:",
    ...tools.map((t) => `- ${t.name}(${params(t)}): ${(t.description ?? "").split(/(?<=\.)\s/)[0]}`),
  ].join("\n");
}

/** Top-level {...} spans in text (brace-matched, string-aware), for finding JSON tool calls in prose. */
function balancedObjects(text: string): string[] {
  const spans: string[] = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "}" && depth > 0) {
      depth--;
      if (depth === 0 && start >= 0) spans.push(text.slice(start, i + 1));
    }
  }
  return spans;
}

export async function runAgentLoop(input: AgentLoopInput): Promise<AgentLoopResult> {
  const allowed = new Set<ToolName>(input.allowedTools ?? (ROLE_TOOLS[input.role] as ToolName[]) ?? []);
  const extras = new Map((input.extraTools ?? []).map((t) => [t.def.name, t]));
  const shown = input.advertisedTools ? input.advertisedTools.filter((t) => allowed.has(t)) : [...allowed];
  const tools = [...shown.map(toolDef), ...[...extras.values()].map((t) => t.def)];
  const callable = new Set<string>([...allowed, ...extras.keys()]);
  const messages: ChatMessage[] = [
    { role: "system", content: input.system },
    { role: "user", content: input.user },
  ];
  const maxTurns = input.maxTurns ?? 24;
  const maxChars = input.toolResultChars ?? 8000;
  const maxNudges = input.maxNudges ?? 2;
  let turns = 0;
  let toolCalls = 0;
  let invalid = 0;
  let native = 0;
  let pseudo = 0;
  let textCalls = 0;
  let badCalls = 0;
  let textMode = false;
  let nudges = 0;
  const failedCalls = new Map<string, number>();
  // Reading: new content and repeats of unchanged content are counted apart; over budget, one structured check
  // (investigation.ts) instead of ending the attempt.
  const investigation = new InvestigationTracker(investigationLimits(input.assignment.providerId.startsWith("hosted"), input.relaxGuards, input.investigationBudget));
  let check: { why: Overrun; asks: number } | undefined;
  let checksUsed = 0;
  let infoSupplied = false;
  /** Read-only turns left after "ready to implement" (0: not counting). */
  let readyGrace = 0;
  const stuck = (after: string) => `No progress: ${investigation.newSinceEdit + investigation.repeatsSinceEdit} reads in a row and no change made (${investigation.repeatsSinceEdit} of them of unchanged files), ${after}. Either the step is already done (call task_complete) or it needs an edit.`;
  let turnRead = false;
  const appliedEdits: string[] = [];
  /** This turn read something new (investigation, not looping). */
  let turnNew = false;
  let turnEdited = false;
  const result =(outcome: AgentOutcome): AgentLoopResult => {
    input.onTranscript?.(messages);
    return { outcome, turns, toolCalls, invalidToolCalls: invalid, nativeToolCalls: native, pseudoToolText: pseudo, textToolCalls: textCalls, transcript: messages, appliedEdits };
  };

  // The prompt must fit the model's context window with room left for the reply. Characters per token starts
  // cautious (code is dense) and is corrected from the token counts the model reports after each turn.
  // 16k is a local model's window. A cloud model holds far more; trimming it to 16k dropped the files it had just read
  // before every request, so gpt-5.6-sol read the same four files again each turn (Calculator app, steps 13 and 16).
  const windowTokens = input.assignment.contextWindow ?? (input.assignment.providerId.startsWith("hosted") ? 128_000 : 16384);
  // Also the cap on each reply: without one a small model can write prose for minutes (5.8 minutes, then a
  // 10-minute time-out, in a benchmark run). 4,096 tokens still fits a whole new file.
  // Cloud models (any hosted provider you bring) write whole files in one call and don't ramble, so their cap follows
  // the model: a quarter of the context, at least 16,000 (a cut-off at 4,096 lost Claude's file content). A provider
  // that allows less says so, and the provider adapter lowers it and remembers.
  const hosted = input.assignment.providerId.startsWith("hosted");
  const replyTokens = hosted ? Math.max(16_000, Math.floor(windowTokens / 4)) : Math.min(4096, Math.floor(windowTokens / 4));
  let editsSinceCheck = 0;
  const toolChars = JSON.stringify(tools).length;
  let charsPerToken = 2.8;
  let tighten = 1;
  let overflowRetried = false;
  while (turns < maxTurns) {
    if (input.signal?.aborted) return result({ kind: "cancelled" });
    turns++;
    answerEveryToolCall(messages);
    const budget = Math.floor((windowTokens - replyTokens) * charsPerToken * 0.9 * tighten);
    const sent = fitHistory(messages, budget, toolChars);
    let res;
    try {
      // In text mode the tools are described in the system prompt and their calls read from the reply (see below).
      const sendMessages = textMode ? [{ ...messages[0], content: `${messages[0].content}\n\n${textToolGuide(tools)}` }, ...messages.slice(1)] : messages;
      res = await input.router.chat({ role: input.role, projectId: input.projectId, runId: input.runId, taskId: input.taskId }, input.assignment, { messages: sendMessages, tools: textMode ? undefined : tools, signal: input.signal, maxOutputTokens: replyTokens });
    } catch (err) {
      const e = err instanceof ProviderError ? err : new ProviderError("unknown", String(err));
      if (e.kind === "cancelled") return result({ kind: "cancelled" });
      // A dropped connection on a near-full prompt is the context overflowing: trim harder and try once more.
      if (e.kind === "connection_reset" && !overflowRetried && sent > budget * 0.6) {
        overflowRetried = true;
        tighten = 0.6;
        turns--;
        input.bus.emit({ projectId: input.projectId, runId: input.runId, taskId: input.taskId, type: "recovery.action", message: `The model dropped the connection on a large prompt; trimmed the conversation to fit its context and tried again.`, data: { role: input.role, promptChars: sent } });
        continue;
      }
      // A tool call the model wrote badly enough that the provider couldn't parse it (Calendar test 8: Ollama's
      // "XML syntax error" on a qwen3-coder call) is a bad turn, not a broken model: ask for the call again.
      // Ollama's own parser for qwen3-coder's XML tool calls breaks on file content with closing tags in it (JSX's
      // "</div>"): "element <parameter> closed by </…>" (Calendar test 8, sign-in screen). From then on, don't ask the
      // provider to parse tool calls: describe the tools in the prompt and read the <function=…> calls here, where only
      // "</parameter>" ends a value.
      // Only Ollama's XML parsing errors mean this: an OpenAI "Invalid parameter" is a request problem, not a model that
      // can't call tools (Calculator app: gpt-5.6-sol was switched to text calls by mistake).
      if (e.kind === "tool_call_invalid" && !textMode && /xml syntax|closed by <?\/?|element <parameter>|<\/parameter>/i.test(e.message)) {
        textMode = true;
        turns--;
        input.bus.emit({ projectId: input.projectId, runId: input.runId, taskId: input.taskId, type: "recovery.action", message: "The provider couldn't parse this model's tool calls (file content with closing tags); FlowCode reads them itself from now on.", data: { role: input.role } });
        continue;
      }
      if (e.kind === "tool_call_invalid" && badCalls < 2) {
        badCalls++;
        input.bus.emit({ projectId: input.projectId, runId: input.runId, taskId: input.taskId, type: "recovery.action", message: `The model's tool call couldn't be read (${e.message.slice(0, 120)}); asked it to send the call again.`, data: { role: input.role } });
        messages.push({ role: "user", content: "Runtime notice: your last tool call could not be parsed, so nothing ran. Send it again as one tool call with plain arguments (no XML inside values; put long file content in the content argument as plain text)." });
        continue;
      }
      return result({ kind: "model_error", error: e });
    }
    const used = res.usage?.promptTokens;
    if (used && used > 500) charsPerToken = Math.min(4.5, Math.max(2.2, (sent / used) * 0.95));
    // The investigation check is open: only its answer counts; tool calls in this reply don't run.
    if (check) {
      const answer = parseInvestigationAnswer(res.content);
      messages.push({ role: "assistant", content: res.content || "(tool calls instead of the answer)" });
      if (!answer) {
        if (check.asks >= 2) return result({ kind: "no_action", reason: stuck("and no answer to the investigation check") });
        check.asks++;
        messages.push({ role: "user", content: "Runtime check: nothing ran. Answer the check first, with only the JSON object." });
        continue;
      }
      check = undefined;
      input.bus.emit({ projectId: input.projectId, runId: input.runId, taskId: input.taskId, type: "recovery.action", message: `Investigation check: ${answer.status.replace(/_/g, " ")}${answer.detail ? ` (${answer.detail.slice(0, 200)})` : ""}`, data: { role: input.role, investigation: answer } });
      if (answer.status === "ready_to_implement") {
        investigation.fresh();
        readyGrace = 3;
        messages.push({ role: "user", content: "Runtime: go ahead and make the change you described now. Files you've already read haven't changed." });
        continue;
      }
      if (answer.status === "missing_information") {
        const info = !infoSupplied && answer.needs.length && input.supplyInfo ? await input.supplyInfo(answer.needs).catch(() => undefined) : undefined;
        infoSupplied = true;
        if (info) {
          investigation.fresh();
          readyGrace = 3;
          messages.push({ role: "user", content: `Runtime: what FlowCode found for what you need:\n${info}\n\nNow make the change.` });
          continue;
        }
        return result({ kind: "blocked", reason: `Missing information: ${answer.detail || answer.needs.join("; ")}`, nextAction: "Add the missing information to the step's guidance, then retry it." });
      }
      if (answer.status === "ambiguous_task") return result({ kind: "blocked", reason: `Ambiguous task: ${answer.detail}`, nextAction: "Say which reading is meant in the step's guidance, then retry it." });
      if (answer.status === "broken_baseline") return result({ kind: "no_action", reason: `Broken baseline: ${answer.detail}` });
      return result({ kind: "split_required", reason: answer.detail || "the step is too big for one go" });
    }
    // Tool calls written as text are read and run like native ones (same validation, permissions and approvals).
    let calls = res.toolCalls;
    if (!calls.length && res.content.trim()) {
      const recovered = parseTextToolCalls(res.content, callable);
      const block = recovered.length ? undefined : codeBlockEdit(res.content, callable);
      if (block) recovered.push(block);
      if (recovered.length) {
        calls = recovered;
        textCalls += recovered.length;
        input.bus.emit({ projectId: input.projectId, runId: input.runId, taskId: input.taskId, type: "recovery.action", message: `Read ${recovered.length} tool call${recovered.length === 1 ? "" : "s"} the model wrote as text (${recovered.map((c) => c.name).join(", ")}); running ${recovered.length === 1 ? "it" : "them"} with the usual checks.`, data: { role: input.role } });
      }
    }
    if (res.content.trim() && !calls.length) {
      input.bus.emit({ projectId: input.projectId, runId: input.runId, taskId: input.taskId, type: "agent.message", message: `${input.role}: ${redact(res.content).slice(0, 600)}`, data: { role: input.role } });
    }
    if (!calls.length) {
      const isPseudo = looksLikePseudoToolCall(res.content);
      if (isPseudo) pseudo++;
      messages.push({ role: "assistant", content: res.content });
      if (!isPseudo && input.onProseOnly) {
        const settled = await input.onProseOnly(res.content).catch(() => undefined);
        if (settled) return result(settled);
      }
      if (nudges >= maxNudges) {
        return result({
          kind: "no_action",
          reason: isPseudo
            ? "Model wrote tool-call JSON as text instead of invoking tools natively; nothing was executed."
            : "Model replied with prose only and did not invoke a tool or report a structured blocker.",
        });
      }
      nudges++;
      messages.push({
        role: "user",
        content: isPseudo
          ? "Runtime notice: tool calls written as text are NOT executed. Invoke the tool through native tool calling. If you cannot proceed, call report_blocked."
          : "Runtime notice: describing work does not perform it. Invoke one of the available tools now, or call report_blocked / request_approval with a reason. When everything is done, call task_complete.",
      });
      continue;
    }
    native += res.toolCalls.length;
    messages.push({ role: "assistant", content: res.content, toolCalls: calls });
    // The last turn only read (and changed nothing): one more turn of reading without doing.
    investigation.turn(turnRead, turnEdited, turnNew);
    turnNew = false;
    if (readyGrace > 0 && turnRead && !turnEdited && --readyGrace === 0) return result({ kind: "no_action", reason: stuck("after saying it was ready to implement") });
    turnRead = false;
    turnEdited = false;
    // What happened to this reply's edits: applied, failed, not run (and why), or malformed.
    const truncated = /^(max_tokens|length)$/.test(res.doneReason ?? "");
    const tally = { applied: [] as string[], failed: [] as string[], notRun: [] as string[], malformed: 0 };
    const failedFiles = new Set<string>();
    let editsRun = 0;
    for (const call of calls) {
      toolCalls++;
      const name = call.name as ToolName;
      const recordId = newId("tool");
      const rec: ToolCallRecord = {
        id: recordId,
        runId: input.runId,
        taskId: input.taskId,
        agentRole: input.role,
        modelAssignment: input.assignment,
        toolName: String(call.name),
        argsRedacted: redactValue(call.arguments),
        status: "requested",
        idempotencyKey: sha256(stableStringify([input.runId, input.taskId, call.name, call.arguments, turns])).slice(0, 24),
        startedAt: nowIso(),
      };
      input.store.toolCalls.upsert(rec);
      input.bus.emit({ projectId: input.projectId, runId: input.runId, taskId: input.taskId, type: "tool.requested", message: `${input.role} requested ${call.name}${describeArgs(call.arguments)}`, data: { toolCallId: recordId, tool: call.name } });

      const reject = (msg: string) => {
        invalid++;
        tally.malformed++;
        input.store.toolCalls.upsert({ ...rec, status: "rejected", resultSummaryRedacted: redact(msg), completedAt: nowIso() });
        input.bus.emit({ projectId: input.projectId, runId: input.runId, taskId: input.taskId, type: "tool.rejected", message: `Rejected ${call.name}: ${msg}`, data: { toolCallId: recordId }, level: "warning" });
        messages.push({ role: "tool", content: `ERROR: ${msg}`, toolCallId: call.id, toolName: String(call.name) });
      };

      const extra = extras.get(String(call.name));
      if (extra) {
        let xargs: unknown = call.arguments;
        if (typeof xargs === "string") {
          try {
            xargs = JSON.parse(xargs || "{}");
          } catch {
            reject(`Invalid arguments for ${call.name}: not JSON`);
            continue;
          }
        }
        if (input.signal?.aborted) return result({ kind: "cancelled" });
        let xexec: ToolExecution;
        try {
          xexec = await extra.run((xargs ?? {}) as Record<string, unknown>, input.signal);
        } catch (err) {
          xexec = { ok: false, content: `ERROR: ${(err as Error).message}` };
        }
        const xcontent = redact(xexec.content).slice(0, maxChars) + (xexec.content.length > maxChars ? `\n[truncated ${xexec.content.length - maxChars} chars]` : "");
        input.store.toolCalls.upsert({ ...rec, status: xexec.ok ? "completed" : "failed", resultSummaryRedacted: xcontent.slice(0, 1000), completedAt: nowIso() });
        input.bus.emit({ projectId: input.projectId, runId: input.runId, taskId: input.taskId, type: "tool.completed", message: `${call.name} ${xexec.ok ? "→ ok" : "→ failed"}: ${xcontent.split("\n")[0].slice(0, 200)}`, data: { toolCallId: recordId, ok: xexec.ok, mcp: true }, level: xexec.ok ? "info" : "warning" });
        turnRead = true;
        messages.push({ role: "tool", content: xcontent, toolCallId: call.id, toolName: String(call.name) });
        continue;
      }
      if (!(name in ToolArgs)) {
        reject(`Unknown tool "${call.name}". Available: ${[...callable].join(", ")}`);
        continue;
      }
      if (!allowed.has(name)) {
        reject(`Tool "${name}" is not permitted for role ${input.role}. Agents cannot grant themselves permissions.`);
        continue;
      }
      let args = call.arguments;
      if (typeof args === "string") {
        try {
          args = JSON.parse(args);
        } catch {
          /* fall through to schema error */
        }
      }
      let parsed = ToolArgs[name].safeParse(args);
      // Local models sometimes send a list or object as JSON text ("edits": "[{\"find\": …}]"), or one edit where a
      // list goes (No BIO & GMO build: qwen3-coder's apply_patch rejected twice in a row). Decode and check again.
      if (!parsed.success) {
        const repaired = repairArgs(args);
        if (repaired) {
          const again = ToolArgs[name].safeParse(repaired);
          if (again.success) parsed = again;
        }
      }
      if (!parsed.success) {
        reject(`Invalid arguments for ${name}: ${parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ")}`);
        continue;
      }
      if (input.signal?.aborted) return result({ kind: "cancelled" });
      const editFile = EDIT_TOOLS.has(name) ? String((parsed.data as { path?: unknown }).path ?? "") : "";
      if (EDIT_TOOLS.has(name)) {
        const notRun =
          truncated && call === calls[calls.length - 1]
            ? "this reply was cut off at the output limit, so its last edit may be incomplete"
            : editsRun >= MAX_EDITS_PER_REPLY
              ? `only ${MAX_EDITS_PER_REPLY} edits run per reply, so each batch can be checked`
              : failedFiles.has(editFile)
                ? `an earlier edit to ${editFile} in this reply failed, and this one may depend on it`
                : "";
        if (notRun) {
          tally.notRun.push(editFile);
          input.store.toolCalls.upsert({ ...rec, status: "rejected", resultSummaryRedacted: `Not run: ${notRun}`, completedAt: nowIso() });
          messages.push({ role: "tool", content: `Not run: ${notRun}. Nothing was written for this call; send it again (after reading ${editFile || "the file"} if an edit before it failed).`, toolCallId: call.id, toolName: name });
          continue;
        }
        editsRun++;
      }
      let exec: ToolExecution;
      try {
        exec = await input.executor(name, parsed.data, call, recordId);
      } catch (err) {
        exec = { ok: false, content: `ERROR: ${(err as Error).message}` };
      }
      // Source code and check output keep `name = value` / `name: Type` intact: the model must see the code it edits
      // exactly, or every patch it copies from it misses (Calendar test 8: `handlePasswordReset = [REDACTED] () =>`).
      const target = (parsed.data as { path?: unknown }).path;
      const code = name === "search_code" || name === "run_script" || (typeof target === "string" && /\.(tsx?|jsx?|mjs|cjs|css|scss|html|vue|svelte)$/i.test(target));
      const content = redact(exec.content, [], { code }).slice(0, maxChars) + (exec.content.length > maxChars ? `\n[truncated ${exec.content.length - maxChars} chars]` : "");
      input.store.toolCalls.upsert({ ...rec, status: exec.ok ? "completed" : "failed", resultSummaryRedacted: content.slice(0, 1000), completedAt: nowIso() });
      input.bus.emit({
        projectId: input.projectId,
        runId: input.runId,
        taskId: input.taskId,
        type: "tool.completed",
        message: `${name} ${exec.ok ? "→ ok" : "→ failed"}: ${content.split("\n")[0].slice(0, 200)}`,
        data: { toolCallId: recordId, ok: exec.ok },
        level: exec.ok ? "info" : "warning",
      });
      if (EDIT_TOOLS.has(name)) {
        if (exec.ok) {
          tally.applied.push(editFile);
          appliedEdits.push(editFile);
        } else {
          tally.failed.push(editFile);
          failedFiles.add(editFile);
        }
      }
      // A long run of edits with no "done" claim usually means the agent is circling. Ask it to check its work.
      if (name === "task_complete") editsSinceCheck = 0;
      else if (exec.ok && EDIT_TOOLS.has(name)) editsSinceCheck++;
      let nudge = editsSinceCheck >= 8 && editsSinceCheck % 4 === 0 ? `\n\nRuntime notice: that's ${editsSinceCheck} edits without checking. Read the file you changed to confirm it's right (no repeated lines), then call task_complete; it runs this step's checks.` : "";
      // Reading without doing (Calendar test 8: the same five files read 90 times, no edit): a nudge on the third read
      // of unchanged content; over budget, the investigation check (once per attempt), then the attempt ends.
      if (!exec.ok && EDIT_TOOLS.has(name)) {
        // A failed edit sends the model back to read the file again; those reads re-sync it, they aren't looping
        // (Calculator app: missed patches on the screen, then re-reads, ended the attempt before it could rewrite it).
        investigation.forget(String((parsed.data as { path?: unknown }).path ?? ""));
      }
      if (exec.ok && EDIT_TOOLS.has(name)) {
        investigation.edited();
        turnEdited = true;
        readyGrace = 0;
      } else if (READ_TOOLS.has(name)) {
        turnRead = true;
        // Only reads of files that exist count: asking for a file the step is meant to create is not looping (the
        // "identical failing call" guard below handles a model that keeps asking for it).
        if (exec.ok) {
          // Keyed by what was read: a file's path, or a search's query. Searches have no path, so they used to share
          // one key and eight different searches counted as "the same file read 8 times" (Calendar prototype: the
          // layout step was stopped three times while it explored the PRD, before it could write anything).
          const args = parsed.data as { path?: unknown; query?: unknown; pattern?: unknown; id?: unknown; from?: unknown; to?: unknown };
          // Different parts of one long file (read_file from/to) are different reads, not rereading it.
          const range = args.from !== undefined || args.to !== undefined ? `#${String(args.from ?? "")}-${String(args.to ?? "")}` : "";
          const p = args.path !== undefined && args.path !== null && String(args.path) !== "" ? `${String(args.path)}${range}` : `${name}:${String(args.query ?? args.pattern ?? args.id ?? "")}`;
          const r = investigation.read(p, exec.content);
          if (r.kind === "new") turnNew = true;
          if (r.kind === "repeat" && r.times >= 3) nudge += `\n\nRuntime notice: you have read ${p || "this"} ${r.times} times and it hasn't changed since. Don't read it again: make the change this step asks for, or call task_complete if it's already done.`;
        }
      }
      // Many files read in one turn is investigating, not looping (Calculator app: gpt-5.6-sol reads eight files per
      // turn). A cloud coder re-reads files around its test runs as part of normal work, so its budget is larger.
      const over: Overrun | undefined = check ? undefined : investigation.over();
      if (over && checksUsed >= 1) {
        messages.push({ role: "tool", content: content + nudge, toolCallId: call.id, toolName: name });
        return result({ kind: "no_action", reason: stuck("after the investigation check") });
      }
      if (over) {
        check = { why: over, asks: 0 };
        checksUsed++;
        input.bus.emit({ projectId: input.projectId, runId: input.runId, taskId: input.taskId, type: "recovery.action", message: `Investigation budget reached (${over.replace(/_/g, " ")}: ${investigation.newSinceEdit} new reads, ${investigation.repeatsSinceEdit} repeats, ${investigation.readTurns} read-only turns); asked where the step stands`, data: { role: input.role, newReads: investigation.newSinceEdit, repeats: investigation.repeatsSinceEdit, readTurns: investigation.readTurns } });
      }
      messages.push({ role: "tool", content: content + nudge, toolCallId: call.id, toolName: name });
      if (exec.terminal) return result(exec.terminal);
      // No-progress control for tool calls (FR-C4): identical failing calls are not retried blindly.
      if (!exec.ok) {
        const key = `${name}:${stableStringify(parsed.data)}`;
        const n = (failedCalls.get(key) ?? 0) + 1;
        failedCalls.set(key, n);
        if (n >= 3) return result({ kind: "no_action", reason: `No progress: the identical ${name} call failed ${n} times (${content.split("\n")[0].slice(0, 200)})` });
        if (n === 2)
          messages.push({
            role: "user",
            content: `Runtime notice: you repeated the exact same ${name} call and it failed the same way. Do not repeat it. Change approach: re-read the file, use a larger unique find text (include the surrounding lines), or call report_blocked.`,
          });
      }
    }
    // A reply with several edits, or one cut off: say exactly what was written and what wasn't, so the next reply
    // continues from there and doesn't send applied edits again.
    if (truncated || tally.notRun.length || tally.applied.length + tally.failed.length > 1) {
      const count = (files: string[]) => [...new Set(files)].map((f) => `${f || "?"} (${files.filter((x) => x === f).length})`).join(", ");
      const summary = `${tally.applied.length} edit${tally.applied.length === 1 ? "" : "s"} applied${tally.applied.length ? ` (${count(tally.applied)})` : ""}, ${tally.failed.length} failed${tally.failed.length ? ` (${count(tally.failed)})` : ""}, ${tally.notRun.length} not run${tally.notRun.length ? ` (${count(tally.notRun)})` : ""}${tally.malformed ? `, ${tally.malformed} malformed` : ""}`;
      input.bus.emit({ projectId: input.projectId, runId: input.runId, taskId: input.taskId, type: "recovery.action", message: `Reply with ${calls.length} tool call${calls.length === 1 ? "" : "s"}${truncated ? ", cut off at the output limit" : ""}: ${summary}`, data: { role: input.role, truncated, applied: tally.applied.length, failed: tally.failed.length, notRun: tally.notRun.length, malformed: tally.malformed } });
      if (tally.notRun.length) messages.push({ role: "user", content: `Runtime notice: from your last reply, ${summary}. The applied edits are in the files now; don't send them again. Send the ones not run in your next reply (at most ${MAX_EDITS_PER_REPLY} edits a reply), against what the files say now.` });
    }
    if (check && check.asks === 0) {
      check.asks = 1;
      messages.push({ role: "user", content: investigationPrompt(check.why, investigation) });
    }
    // The reply hit the output limit, so its last tool call lost its arguments (a whole file cut off mid-way).
    if (/^(max_tokens|length)$/.test(res.doneReason ?? ""))
      messages.push({ role: "user", content: "Runtime notice: your last reply was cut off at the output limit, so its tool call arrived incomplete and nothing was written. Don't send the whole file again: make the change in smaller steps (apply_patch with a few edits at a time, or create a short new file and import it)." });
  }
  return result({ kind: "budget_exhausted", reason: `Turn budget of ${maxTurns} exhausted without completion` });
}

/**
 * Arguments with lists or objects sent as JSON text decoded, and a lone object put in a list where the tool takes a
 * list (edits, operations). Undefined when there is nothing to repair.
 */
export function repairArgs(args: unknown): Record<string, unknown> | undefined {
  if (!args || typeof args !== "object" || Array.isArray(args)) return undefined;
  let changed = false;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args as Record<string, unknown>)) {
    let value = v;
    if (typeof value === "string" && /^\s*[[{]/.test(value)) {
      try {
        value = JSON.parse(value);
        changed = true;
      } catch {
        /* not JSON: keep the text */
      }
    }
    if ((k === "edits" || k === "operations") && value && typeof value === "object" && !Array.isArray(value)) {
      value = [value];
      changed = true;
    }
    out[k] = value;
  }
  return changed ? out : undefined;
}

function describeArgs(args: unknown): string {
  if (!args || typeof args !== "object") return "";
  const a = args as Record<string, unknown>;
  if (typeof a.path === "string") return ` (${a.path})`;
  if (Array.isArray(a.argv)) return ` (${redact(a.argv.join(" "))})`;
  if (typeof a.script === "string") return ` (${a.script})`;
  if (typeof a.query === "string") return ` ("${redact(a.query).slice(0, 60)}")`;
  return "";
}

/** Characters the model reads for one message, including the arguments of the tool calls it made. */
const messageChars = (m: ChatMessage) => m.content.length + (m.toolCalls?.reduce((n, c) => n + JSON.stringify(c.arguments ?? {}).length + c.name.length, 0) ?? 0);
export const promptChars = (messages: ChatMessage[], tools: ToolDef[] = []) => messages.reduce((n, m) => n + messageChars(m), 0) + (tools.length ? JSON.stringify(tools).length : 0);

/** Shortens long string values in tool-call arguments (patch text, file content) the model already sent. */
function shrinkArgs(value: unknown): unknown {
  if (typeof value === "string") return value.length > 300 ? `${value.slice(0, 120)}… [${value.length - 120} more characters, already applied]` : value;
  if (Array.isArray(value)) return value.map(shrinkArgs);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shrinkArgs(v)]));
  return value;
}

/**
 * Keeps the conversation inside the model's context window. Ollama's runner drops the connection when a prompt
 * doesn't fit (it showed up as "connection reset" and the same oversized prompt was retried until the step failed),
 * so this trims in stages until it fits: older tool output, then the patch text and file content of earlier calls,
 * then the most recent output except the last, and finally whole earlier exchanges (a call with its results).
 * The system prompt and the task (first two messages) are kept.
 */
export function fitHistory(messages: ChatMessage[], budgetChars: number, toolChars = 0): number {
  let total = messages.reduce((n, m) => n + messageChars(m), 0) + toolChars;
  const elide = (i: number, keep: number, note: string) => {
    const m = messages[i];
    if (m.role !== "tool" || m.content.length <= keep + 120) return;
    total -= m.content.length;
    m.content = `${m.content.slice(0, keep)}\n[${note}]`;
    total += m.content.length;
  };
  // 1. Older tool output.
  for (let i = 2; i < messages.length - 6 && total > budgetChars; i++) elide(i, 100, "older tool output removed to fit the model's context");
  // 2. Patch text and file content in calls already made.
  for (let i = 2; i < messages.length - 2 && total > budgetChars; i++) {
    const m = messages[i];
    if (m.role !== "assistant" || !m.toolCalls?.length) continue;
    const before = messageChars(m);
    m.toolCalls = m.toolCalls.map((c) => ({ ...c, arguments: shrinkArgs(c.arguments) }));
    total -= before - messageChars(m);
  }
  // 3. Recent tool output, except the latest result.
  for (let i = 2; i < messages.length - 1 && total > budgetChars; i++) elide(i, 1200, "output shortened to fit the model's context; read the file again if you need the rest");
  // 4. Whole earlier exchanges, oldest first, keeping each call together with its results.
  let dropped = 0;
  while (total > budgetChars && messages.length > 6) {
    let end = 3;
    while (end < messages.length - 3 && messages[end].role === "tool") end++;
    if (end >= messages.length - 3) break;
    for (const m of messages.splice(2, end - 2)) total -= messageChars(m);
    dropped++;
  }
  if (dropped) {
    const note = `[${dropped} earlier step${dropped === 1 ? "" : "s"} removed to fit the model's context. Re-read any file before patching it.]`;
    if (messages[2]?.role === "user" && messages[2].content.startsWith("[")) messages[2].content = note;
    else messages.splice(2, 0, { role: "user", content: note });
  }
  return total;
}
