/**
 * Local model speed by context size (read-only on FlowCode; local calls only, nothing downloaded). For each num_ctx:
 * one short generation, then /api/ps for how much of the model sits in GPU memory. Usage:
 * node scripts/ollama-speed.mjs [model] [ctx,ctx,...] [--json out.json]
 */
import fs from "node:fs";

const base = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";
const model = process.argv[2] ?? "qwen3:8b";
const sizes = (process.argv[3] ?? "8192,16384,24576,32768").split(",").map(Number);
const out = process.argv.includes("--json") ? process.argv[process.argv.indexOf("--json") + 1] : undefined;
const prompt = "Write a TypeScript function that groups an array of products by category and returns a Map. Then explain it in three sentences.";
const rows = [];
for (const num_ctx of sizes) {
  const t0 = Date.now();
  const res = await fetch(`${base}/api/generate`, { method: "POST", body: JSON.stringify({ model, prompt, think: false, stream: false, keep_alive: "1m", options: { num_ctx, num_predict: 256, temperature: 0 } }) });
  const j = await res.json();
  const ps = (await (await fetch(`${base}/api/ps`)).json()).models?.find((m) => m.name === model || m.model === model) ?? {};
  const gb = (b) => +(b / 1024 ** 3).toFixed(2);
  rows.push({
    num_ctx,
    wallS: +((Date.now() - t0) / 1000).toFixed(1),
    loadS: +(j.load_duration / 1e9).toFixed(1),
    genTokens: j.eval_count,
    genTokPerS: +(j.eval_count / (j.eval_duration / 1e9)).toFixed(1),
    promptTokPerS: +(j.prompt_eval_count / (j.prompt_eval_duration / 1e9)).toFixed(0),
    sizeGB: gb(ps.size ?? 0),
    vramGB: gb(ps.size_vram ?? 0),
    onGpu: ps.size ? `${Math.round((100 * (ps.size_vram ?? 0)) / ps.size)}%` : "?",
    contextLength: ps.context_length,
  });
  console.log(JSON.stringify(rows.at(-1)));
  // Unload so the next size loads fresh.
  await fetch(`${base}/api/generate`, { method: "POST", body: JSON.stringify({ model, keep_alive: 0 }) });
  await new Promise((r) => setTimeout(r, 1500));
}
if (out) fs.writeFileSync(out, JSON.stringify({ model, at: new Date().toISOString(), rows }, null, 2));
