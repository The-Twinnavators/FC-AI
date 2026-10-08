/**
 * First-run setup: what stands between this computer and a first build, as one next step in plain words.
 *   1. Ollama is installed and running (FlowCode looks for it at its usual local address).
 *   2. A model that can use tools is downloaded.
 *   3. That model has passed the Coder capability test (only then may it write code).
 *   4. It is the coder FlowCode uses (a fresh install's default coder may not be the model you downloaded).
 * "Test and use it" runs the test and, when it passes, makes the model the coder: the person pressed the button.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { App } from "../app.js";

export type SetupStep = "start-ollama" | "install-ollama" | "pull-model" | "test-coder" | "testing" | "use-coder" | "ready";

export interface SetupStatus {
  step: SetupStep;
  ready: boolean;
  ollama: { running: boolean; installed: boolean; detail: string };
  models: Array<{ name: string; sizeGb: number; tools: boolean }>;
  coder: { model: string; installed: boolean; eligible: boolean; reason: string };
  /** The model the next step is about (to test or to use). */
  candidate?: { model: string; sizeGb: number };
  /** What to download when nothing suitable is there. */
  recommend: { model: string; sizeGb: number; why: string; lighter?: { model: string; sizeGb: number; why: string } };
  testing?: { model: string; since: string };
  lastError?: string;
  /** The Copilot's own model: until it's downloaded and Ollama runs, the Copilot answers from a fixed script. */
  assistant: { model: string; available: boolean };
}

/** Tool-using models FlowCode has worked with, best first (qwen3:14b is the verified coder). */
const PREFERRED = ["qwen3:14b", "qwen3-coder:30b", "qwen3:8b", "qwen2.5-coder:7b", "gpt-oss:20b", "llama3.1:8b", "qwen2.5:7b"];
const testing = new Map<string, string>();
let lastError: string | undefined;

/** Ollama installed but not running (Windows: its usual install folders). */
function ollamaInstalled(): boolean {
  if (process.platform !== "win32") return false;
  const candidates = [path.join(process.env.LOCALAPPDATA ?? "", "Programs", "Ollama", "ollama.exe"), path.join(process.env.ProgramFiles ?? "C:\\Program Files", "Ollama", "ollama.exe")];
  return candidates.some((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });
}

export async function setupStatus(app: App): Promise<SetupStatus> {
  const memGb = os.totalmem() / 1e9;
  const recommend: SetupStatus["recommend"] = {
    model: "qwen3:14b",
    sizeGb: 9.3,
    why: "The model FlowCode is verified with: it passes every coder test.",
    ...(memGb < 24 ? { lighter: { model: "qwen3:8b", sizeGb: 5.2, why: `Smaller and quicker; a fit if this computer struggles (it has ${Math.round(memGb)} GB of memory).` } } : {}),
  };
  const ollama = app.router.provider("ollama");
  const health = await ollama.health().catch((e: Error) => ({ ok: false, detail: e.message }));
  const coderA = app.router.roleAssignments().coder!;
  const docModel = app.router.roleAssignments().documenter?.model ?? "";
  const base = { recommend, ...(lastError ? { lastError } : {}), assistant: { model: docModel, available: false } };
  if (!health.ok) {
    const installed = ollamaInstalled();
    return { step: installed ? "start-ollama" : "install-ollama", ready: false, ollama: { running: false, installed, detail: health.detail }, models: [], coder: { model: coderA.model, installed: false, eligible: false, reason: "Ollama isn't running" }, ...base };
  }
  const tags = await ollama.listModels().catch(() => []);
  const models = await Promise.all(
    tags
      .filter((t) => !/embed/i.test(t.name))
      .map(async (t) => {
        const info = await ollama.describe(t.name).catch(() => undefined);
        return { name: t.name, sizeGb: Math.round(((t.sizeBytes ?? 0) / 1e9) * 10) / 10, tools: !!info?.capabilities?.includes("tools") };
      }),
  );
  const has = (m: string) => models.some((x) => x.name === m || x.name === `${m}:latest`);
  const coderEl = app.lab.coderEligibility(coderA);
  const coder = { model: coderA.model, installed: has(coderA.model), eligible: coderEl.eligible, reason: coderEl.reason };
  const common = { ollama: { running: true, installed: true, detail: health.detail }, models, coder, ...base, assistant: { model: docModel, available: has(docModel) } };
  if (coder.installed && coder.eligible) return { step: "ready", ready: true, ...common };

  const tools = models.filter((m) => m.tools);
  if (!tools.length) return { step: "pull-model", ready: false, ...common };
  // The model to set up: the best one FlowCode has worked with that's downloaded (qwen3:14b is the verified coder; a
  // fresh install's default coder, qwen3-coder:30b, is far slower on an 8 GB graphics card), else the configured coder,
  // else any tool-using model.
  const pick = PREFERRED.find((p) => tools.some((t) => t.name === p)) ?? (coder.installed && models.find((m) => m.name === coderA.model)?.tools ? coderA.model : tools[0]!.name);
  const candidate = { model: pick, sizeGb: models.find((m) => m.name === pick)?.sizeGb ?? 0 };
  const since = testing.get(pick);
  if (since) return { step: "testing", ready: false, candidate, testing: { model: pick, since }, ...common };
  const eligible = app.lab.coderEligibility({ ...coderA, model: pick }).eligible;
  return { step: eligible ? "use-coder" : "test-coder", ready: false, candidate, ...common };
}

/** Tests a model as the coder (queued behind any running build) and, when it passes, makes it the coder. */
export function testAndUse(app: App, model: string): { started: boolean; waiting: boolean } {
  const assignment = { ...app.router.roleAssignments().coder!, model };
  if (testing.has(model)) return { started: false, waiting: app.orchestrator.hasActiveBuild() };
  testing.set(model, new Date().toISOString());
  lastError = undefined;
  void app.lab
    .probeWhenFree(assignment, () => app.orchestrator.hasActiveBuild())
    .then(() => {
      const e = app.lab.coderEligibility(assignment);
      if (e.eligible) (app.router.setRoleAssignment("coder", assignment), app.orchestrator.switchRoleModel("coder", assignment));
      else lastError = `${model} didn't pass the coder test: ${e.reason}. Try another model.`;
    })
    .catch((err: Error) => {
      lastError = `The coder test couldn't run: ${err.message}`;
    })
    .finally(() => testing.delete(model));
  return { started: true, waiting: app.orchestrator.hasActiveBuild() };
}

/** Makes an already-tested model the coder. */
export function useAsCoder(app: App, model: string): { ok: boolean; reason?: string } {
  const assignment = { ...app.router.roleAssignments().coder!, model };
  const e = app.lab.coderEligibility(assignment);
  if (!e.eligible) return { ok: false, reason: e.reason };
  (app.router.setRoleAssignment("coder", assignment), app.orchestrator.switchRoleModel("coder", assignment));
  return { ok: true };
}
