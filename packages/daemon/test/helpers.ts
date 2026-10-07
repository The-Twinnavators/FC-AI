import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setRuntimeOptions } from "../src/orchestrator/runtimeOptions.js";
import { createApp, type App } from "../src/app.js";

export function tmpDir(prefix = "fc-test-"): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function write(root: string, rel: string, content: string) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

export function makeApp(): { app: App; dataDir: string } {
  const dataDir = tmpDir("fc-data-");
  const app = createApp({ dataDir });
  // Tests pin one model per role; the fast-model tier has its own test.
  setRuntimeOptions(app.store, { fastModel: { enabled: false, model: "" } });
  return { app, dataDir };
}

export function makeProject(app: App, files: Record<string, string> = {}) {
  const ws = tmpDir("fc-ws-");
  for (const [rel, content] of Object.entries(files)) write(ws, rel, content);
  const project = app.projects.create({ name: "Test project", workspacePath: ws });
  return { project, ws, jail: app.projects.jail(project) };
}

export async function waitFor<T>(fn: () => T | undefined | false, timeoutMs = 20_000, intervalMs = 50): Promise<T> {
  const start = Date.now();
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() - start > timeoutMs) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
