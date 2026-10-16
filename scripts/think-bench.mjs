/**
 * Thinking on vs off on routine coding and tool-selection turns (local, read-only on FlowCode; nothing downloaded).
 * Each case is one agent turn with FlowCode-like tools; a run passes when the model calls the right tool with arguments
 * that would do the job. Records output tokens, generation and prompt time, and where the model sat (GPU/CPU) during
 * the run. Usage: node scripts/think-bench.mjs [model] [repeats] [num_ctx] [--json out.json]
 */
import fs from "node:fs";

const base = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";
const model = process.argv[2] ?? "qwen3:8b";
const repeats = Number(process.argv[3] ?? 2);
const numCtx = Number(process.argv[4] ?? 24576);
const out = process.argv.includes("--json") ? process.argv[process.argv.indexOf("--json") + 1] : undefined;

const fn = (name, description, properties, required) => ({ type: "function", function: { name, description, parameters: { type: "object", properties, required } } });
const tools = [
  fn("read_file", "Read a file in the project.", { path: { type: "string" } }, ["path"]),
  fn("search_code", "Search the project's files for text.", { query: { type: "string" } }, ["query"]),
  fn("create_file", "Create a new file with its full content.", { path: { type: "string" }, content: { type: "string" } }, ["path", "content"]),
  fn("apply_patch", "Change a file: each edit replaces the exact text in find with replace.", { path: { type: "string" }, edits: { type: "array", items: { type: "object", properties: { find: { type: "string" }, replace: { type: "string" } }, required: ["find", "replace"] } } }, ["path", "edits"]),
  fn("task_complete", "Finish the step with a summary of what changed.", { summary: { type: "string" }, changedPaths: { type: "array", items: { type: "string" } } }, ["summary"]),
];
const SYSTEM = "You are the Coder in FlowCode. Work only through the tools. Make the smallest change that does the task. Call exactly one tool per reply.";
const form = `export function SignupForm() {\n  return (\n    <form className="signup">\n      <label>Email <input name="email" /></label>\n      <button type="submit">Send</button>\n    </form>\n  );\n}\n`;
const css = `.steps {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: var(--space-4);\n}\n`;
const cases = [
  { id: "pick-read", user: "Task: find which screens the app routes to. The routes are listed in src/app/routes.ts, which you haven't read yet.", ok: (c) => c?.name === "read_file" && /src\/app\/routes\.ts$/.test(c.arguments.path ?? "") },
  { id: "pick-search", user: "Task: find where the function useCollection is defined. You don't know which file it is in.", ok: (c) => c?.name === "search_code" && /useCollection/.test(c.arguments.query ?? "") },
  { id: "small-edit", user: `Task: in src/components/SignupForm.tsx, change the submit button's label from "Send" to "Join the waitlist". The file (already read):\n\n${form}`, ok: (c) => c?.name === "apply_patch" && /SignupForm\.tsx$/.test(c.arguments.path ?? "") && (c.arguments.edits ?? []).some((e) => form.includes(e.find) && /Send/.test(e.find) && /Join the waitlist/.test(e.replace)) },
  { id: "css-rule", user: `Task: in src/styles/app.css, make .steps stack into one column at 375px wide and below (a max-width media query), keeping the existing rule. The file (already read):\n\n${css}`, ok: (c) => c?.name === "apply_patch" && /app\.css$/.test(c.arguments.path ?? "") && (c.arguments.edits ?? []).some((e) => css.includes(e.find) && /@media\s*\(max-width:\s*375px\)/.test(e.replace) && /grid-template-columns:\s*(1fr|minmax\(0,\s*1fr\))/.test(e.replace)) },
  { id: "new-file", user: "Task: create src/lib/price.ts exporting formatPrice(cents: number): string that returns dollars with two decimals and a $ sign (199 → \"$1.99\").", ok: (c) => c?.name === "create_file" && /src\/lib\/price\.ts$/.test(c.arguments.path ?? "") && /export (function|const) formatPrice/.test(c.arguments.content ?? "") && /toFixed\(2\)|\/ ?100/.test(c.arguments.content ?? "") },
  { id: "finish", user: "Task: add alt text to the hero image in src/screens/Home.tsx.\n\nYou already changed it: apply_patch on src/screens/Home.tsx → applied (alt=\"Fresh vegetables at a market stall\"). The type check passed. Nothing else is left.", ok: (c) => c?.name === "task_complete" },
];

const placement = async () => {
  const m = ((await (await fetch(`${base}/api/ps`)).json()).models ?? []).find((x) => x.name === model || x.model === model);
  return m ? { onGpu: Math.round((100 * m.size_vram) / m.size), ctx: m.context_length, sizeGB: +(m.size / 2 ** 30).toFixed(2) } : undefined;
};

const rows = [];
for (const think of [false, true]) {
  for (const c of cases) {
    for (let r = 0; r < repeats; r++) {
      const t0 = Date.now();
      let j;
      try {
        j = await (await fetch(`${base}/api/chat`, { method: "POST", body: JSON.stringify({ model, think, stream: false, keep_alive: "5m", tools, options: { num_ctx: numCtx, temperature: 0.1, num_predict: 4096 }, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: c.user }] }) })).json();
      } catch (e) {
        j = { error: String(e) };
      }
      const calls = (j.message?.tool_calls ?? []).map((t) => ({ name: t.function?.name, arguments: typeof t.function?.arguments === "string" ? JSON.parse(t.function.arguments) : (t.function?.arguments ?? {}) }));
      const row = {
        think,
        case: c.id,
        pass: c.ok(calls[0]),
        validCall: calls.length > 0 && tools.some((t) => t.function.name === calls[0].name),
        tool: calls[0]?.name ?? (j.error ? `error: ${j.error.slice(0, 80)}` : "none"),
        outTokens: j.eval_count ?? 0,
        thinkingChars: (j.message?.thinking ?? "").length,
        genS: +((j.eval_duration ?? 0) / 1e9).toFixed(1),
        promptS: +((j.prompt_eval_duration ?? 0) / 1e9).toFixed(1),
        wallS: +((Date.now() - t0) / 1000).toFixed(1),
        doneReason: j.done_reason,
        placement: await placement(),
      };
      rows.push(row);
      console.log(JSON.stringify(row));
    }
  }
}
const sum = (think) => {
  const r = rows.filter((x) => x.think === think);
  const total = (k) => r.reduce((n, x) => n + x[k], 0);
  return { runs: r.length, passed: r.filter((x) => x.pass).length, validCalls: r.filter((x) => x.validCall).length, outTokens: total("outTokens"), genS: +total("genS").toFixed(1), promptS: +total("promptS").toFixed(1), wallS: +total("wallS").toFixed(1), truncated: r.filter((x) => x.doneReason === "length").length };
};
const summary = { model, numCtx, repeats, thinkingOff: sum(false), thinkingOn: sum(true) };
console.log(JSON.stringify(summary, null, 1));
if (out) fs.writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), summary, rows }, null, 2));
