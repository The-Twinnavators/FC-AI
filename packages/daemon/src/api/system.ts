/**
 * System page data (PRD §4.1 module 10 "Settings, Permissions & Provider Connections", §7.6 observability):
 * daemon health and controls, environment & connections, the local AI engine, and the governed tool
 * catalog. Secrets are never returned — only whether they are set.
 */
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { chromium } from "playwright";
import { MUTATING_TOOLS, ROLE_TOOLS, TOOL_DESCRIPTIONS, TOOL_NAMES, type ToolName } from "@flowcode/contracts";
import type { App } from "../app.js";
import { resolveSpawn, scrubbedEnv } from "../commands/runner.js";

const STARTED = Date.now();
export const DAEMON_VERSION = "0.1.0";

function run(file: string, args: string[], timeoutMs = 8000): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile(file, args, { shell: false, timeout: timeoutMs, windowsHide: true, env: scrubbedEnv() }, (err, stdout, stderr) => resolve(err ? undefined : `${stdout}${stderr}`.trim().split(/\r?\n/)[0]));
  });
}

export async function systemHealth(app: App) {
  const dbFile = path.join(app.dataDir, "flowcode.sqlite");
  const size = fs.existsSync(dbFile) ? fs.statSync(dbFile).size : 0;
  const live = app.store.processes.where("state = 'running'");
  const ollama = await app.router.provider("ollama").health();
  const lastSeq = app.db.get<{ m: number }>("SELECT MAX(seq) AS m FROM events")?.m ?? 0;
  const indexed = app.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM search_index")?.n ?? 0;
  let browser = false;
  try {
    browser = fs.existsSync(chromium.executablePath());
  } catch {
    browser = false;
  }
  const queued = app.store.runs.where("status IN ('awaiting_approval','draft')").length;
  const active = app.orchestrator.activeRunIds();
  return {
    version: DAEMON_VERSION,
    pid: process.pid,
    uptimeMs: Date.now() - STARTED,
    node: process.versions.node,
    electron: process.versions.electron ?? null,
    activeRuns: active.length,
    queueDepth: queued,
    pendingApprovals: app.approvals.pending().length,
    subsystems: [
      { id: "orchestrator", label: "Orchestrator", status: app.orchestrator.paused ? "paused" : "running", detail: app.orchestrator.paused ? "paused — no new tasks start" : `${active.length} active run(s), ${queued} waiting` },
      { id: "runner", label: "Command runner", status: "online", detail: `${live.length} owned process(es)` },
      { id: "database", label: "Database", status: "online", detail: `SQLite · ${(size / 1024 / 1024).toFixed(1)} MB · ${app.db.appliedMigrations().length} migrations` },
      { id: "events", label: "Event stream", status: "online", detail: `${lastSeq.toLocaleString()} events recorded` },
      { id: "search", label: "Search index", status: "online", detail: `${indexed.toLocaleString()} documents (FTS5)` },
      { id: "models", label: "Local models", status: ollama.ok ? "online" : "offline", detail: ollama.detail },
      { id: "browser", label: "Browser automation", status: browser ? "online" : "missing", detail: browser ? "Playwright Chromium installed" : "Run: npx playwright install chromium" },
    ],
    log: app.bus
      .list({ types: ["process.cleanup", "model.failed", "policy.rejected", "run.status_changed", "knowledge.updated"], limit: 100_000 })
      .filter((e) => !e.runId || e.type === "process.cleanup")
      .slice(-60)
      .map((e) => ({ at: e.createdAt, level: e.level, message: e.message })),
  };
}

export async function environment(app: App) {
  const nodeCli = resolveSpawn(["npm", "--version"], app.dataDir);
  const [nodeV, npmV, gitV, pyV] = await Promise.all([run(resolveSpawn(["node", "--version"], app.dataDir).file, ["--version"]), run(nodeCli.file, nodeCli.args), run("git", ["--version"]), run(process.platform === "win32" ? "python" : "python3", ["--version"])]);
  let chromiumPath: string | undefined;
  try {
    chromiumPath = chromium.executablePath();
  } catch {
    chromiumPath = undefined;
  }
  const isSet = (k: string) => !!process.env[k];
  const providers = await Promise.all(
    app.router.providerConfigs().map(async (p) => ({
      id: p.id,
      label: p.label,
      kind: p.kind,
      hosted: p.hosted,
      enabled: p.enabled,
      endpoint: p.baseUrl ?? null,
      credential: p.apiKeyRef ? { name: p.apiKeyRef, set: isSet(p.apiKeyRef) } : null,
      health: await app.router.provider(p.id).health(),
    })),
  );
  const projects = app.store.projects.list("updated_at DESC", 500);
  const roots = projects.map((p) => {
    let root: string | undefined;
    try {
      root = app.projects.workspacePath(p);
    } catch {
      root = undefined;
    }
    return { project: p.name, projectId: p.id, path: root ?? "(missing)", exists: !!root && fs.existsSync(root) };
  });
  return {
    toolchain: [
      { id: "node", label: "Node.js (for project commands)", value: nodeV ?? "not found", ok: !!nodeV },
      { id: "npm", label: "npm", value: npmV ?? "not found", ok: !!npmV },
      { id: "git", label: "Git", value: gitV ?? "not found", ok: !!gitV },
      { id: "chromium", label: "Playwright Chromium", value: chromiumPath && fs.existsSync(chromiumPath) ? "installed" : "missing", ok: !!chromiumPath && fs.existsSync(chromiumPath) },
      { id: "python", label: "Python (optional)", value: pyV ?? "not found", ok: !!pyV, optional: true },
    ],
    variables: [
      { name: "FLOWCODE_DATA_DIR", purpose: "Data directory override", set: isSet("FLOWCODE_DATA_DIR"), secret: false, value: process.env.FLOWCODE_DATA_DIR ?? null },
      { name: "FLOWCODE_HOSTED_API_KEY", purpose: "Key for the optional hosted provider", set: isSet("FLOWCODE_HOSTED_API_KEY"), secret: true, value: null },
      { name: "HTTPS_PROXY", purpose: "Proxy for installs and research", set: isSet("HTTPS_PROXY") || isSet("https_proxy"), secret: true, value: null },
      { name: "NODE_EXTRA_CA_CERTS", purpose: "Extra TLS certificate authorities", set: isSet("NODE_EXTRA_CA_CERTS"), secret: false, value: process.env.NODE_EXTRA_CA_CERTS ? path.basename(process.env.NODE_EXTRA_CA_CERTS) : null },
      { name: "PLAYWRIGHT_BROWSERS_PATH", purpose: "Browser binaries location", set: isSet("PLAYWRIGHT_BROWSERS_PATH"), secret: false, value: process.env.PLAYWRIGHT_BROWSERS_PATH ?? null },
    ],
    providers,
    searchAdapters: app.research.adapters.map((a) => ({ id: a.id, label: a.label, consent: "per job or per project" })),
    allowedDirectories: [{ project: "FlowCode data (daemon only)", projectId: null, path: app.dataDir, exists: true }, ...roots],
  };
}

export async function checkNetwork() {
  const probe = async (label: string, url: string) => {
    const started = Date.now();
    try {
      const ctrl = AbortSignal.timeout(6000);
      const res = await fetch(url, { method: "HEAD", signal: ctrl });
      return { label, url, ok: res.status < 500, detail: `HTTP ${res.status} in ${Date.now() - started}ms` };
    } catch (err) {
      return { label, url, ok: false, detail: (err as Error).message };
    }
  };
  return Promise.all([probe("npm registry (installs)", "https://registry.npmjs.org/"), probe("Wikipedia API (research adapter)", "https://en.wikipedia.org/w/api.php")]);
}

export async function aiEngine(app: App) {
  const provider = app.router.provider("ollama");
  const base = (provider.config.baseUrl ?? "http://127.0.0.1:11434").replace(/\/$/, "");
  let models: Awaited<ReturnType<typeof provider.listModels>> = [];
  try {
    models = await provider.listModels();
  } catch {
    models = [];
  }
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const usage = new Map<string, { week: number; all: number; calls: number }>();
  for (const r of app.db.all<{ data: string; created_at: string }>("SELECT data, created_at FROM events WHERE type = 'model.completed'")) {
    const d = (JSON.parse(r.data) as { data: { model?: string; usage?: { promptTokens?: number; completionTokens?: number } } }).data;
    if (!d.model) continue;
    const n = (d.usage?.promptTokens ?? 0) + (d.usage?.completionTokens ?? 0);
    const u = usage.get(d.model) ?? { week: 0, all: 0, calls: 0 };
    u.all += n;
    u.calls++;
    if (r.created_at >= weekAgo) u.week += n;
    usage.set(d.model, u);
  }
  const roles = app.router.roleAssignments();
  const rows = await Promise.all(
    models.map(async (m) => {
      let ctx: number | undefined;
      let caps: string[] = [];
      try {
        const res = await fetch(`${base}/api/show`, { method: "POST", body: JSON.stringify({ model: m.name }), signal: AbortSignal.timeout(8000) });
        const j = (await res.json()) as { capabilities?: string[]; model_info?: Record<string, unknown> };
        caps = j.capabilities ?? [];
        const key = Object.keys(j.model_info ?? {}).find((k) => k.endsWith(".context_length"));
        ctx = key ? Number(j.model_info![key]) : undefined;
      } catch {
        /* model details unavailable */
      }
      const lab = app.store.capabilities.where("provider_id = 'ollama' AND model = ? ORDER BY created_at DESC LIMIT 1", m.name)[0];
      return {
        name: m.name,
        family: m.family,
        parameterSize: m.parameterSize,
        sizeBytes: m.sizeBytes,
        contextLength: ctx,
        capabilities: caps,
        capability: lab ? { passed: lab.passed, score: `${lab.results.filter((r) => r.passed).length}/${lab.results.length}`, at: lab.createdAt } : null,
        usage: usage.get(m.name) ?? { week: 0, all: 0, calls: 0 },
        roles: Object.entries(roles)
          .filter(([, a]) => a.providerId === "ollama" && a.model === m.name)
          .map(([r]) => r),
      };
    }),
  );
  return { provider: { label: provider.config.label, endpoint: base, health: await provider.health() }, contextPerCall: 16384, models: rows };
}

const EXAMPLES: Partial<Record<ToolName, string[]>> = {
  read_file: ["Read src/App.tsx and explain how state flows through it", "Show me the PRD in spec/ and list its requirements"],
  list_files: ["What is in the src/components folder?", "Map the structure of this repository"],
  search_code: ["Find every place that writes to localStorage", "Where is the booking form validated?"],
  create_file: ["Add a src/lib/format.ts helper for currency formatting", "Create a test file for the storage module"],
  apply_patch: ["Fix the off-by-one in the date range filter", "Rename the 'Submit' button to 'Book session'"],
  edit_json: ["Turn on strict mode in tsconfig.json"],
  edit_yaml: ["Add a lint step to the CI workflow"],
  edit_toml: ["Bump the Python package version in pyproject.toml"],
  edit_package_manifest: ["Add date-fns as a dependency", "Add a typecheck script"],
  replace_file: ["Repair the corrupted package.json"],
  copy_file: ["Put the attached stylesheet into src/styles/calendar.css"],
  move_file: ["Move the Calendar component into src/components/calendar/"],
  delete_file: ["Remove the unused legacy stylesheet"],
  run_command: ["Show git status", "List outdated packages"],
  run_script: ["Run the tests", "Build the app for production"],
  request_approval: ["(used by agents when an action needs your decision)"],
  report_blocked: ["(used by agents to stop with a precise reason instead of guessing)"],
  task_complete: ["(used by agents to claim completion — the runtime verifies it)"],
};

const POLICY: Partial<Record<ToolName, string>> = {
  list_files: "Auto — read-only; secret files listed but never read",
  search_code: "Auto — read-only; secret files skipped",
  read_file: "Auto — read-only; secret files denied",
  create_file: "Auto inside the task's scope; snapshot first; protected configs ask",
  apply_patch: "Auto inside scope; exact-match context; atomic; protected configs ask",
  edit_json: "Auto inside scope; parsed and validated before write",
  edit_yaml: "Auto inside scope; parsed and validated before write",
  edit_toml: "Auto inside scope; parsed and validated before write",
  edit_package_manifest: "Auto for dependencies/verified scripts; unverified scripts ask; manifest validated",
  replace_file: "Asks (high risk); never on protected files; snapshot first",
  copy_file: "Auto inside scope; never onto protected files; snapshot first",
  move_file: "Auto inside scope; protected files ask; snapshot first",
  delete_file: "Asks; snapshot kept for restore",
  run_command: "Policy tiers: auto (verified read-only), ask (installs, network, unknown), never (shell, push, outside workspace)",
  run_script: "Auto for verified scripts with no extra arguments; others ask",
  request_approval: "Creates an approval card",
  report_blocked: "Ends the attempt with a recorded blocker",
  task_complete: "Records a claim; the runtime verifies acceptance criteria",
};

export function toolCatalog() {
  return TOOL_NAMES.map((name) => ({
    name,
    access: MUTATING_TOOLS.has(name) ? "write" : ["run_command", "run_script"].includes(name) ? "execute" : ["request_approval", "report_blocked", "task_complete"].includes(name) ? "control" : "read",
    description: TOOL_DESCRIPTIONS[name],
    policy: POLICY[name] ?? "",
    roles: Object.entries(ROLE_TOOLS)
      .filter(([, tools]) => (tools as string[]).includes(name))
      .map(([r]) => r),
    examples: EXAMPLES[name] ?? [],
  }));
}
