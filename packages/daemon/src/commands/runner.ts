/**
 * Governed command runner (FR-C1–C4). argv only, shell:false, cwd locked to the workspace, scrubbed
 * environment, timeout, output cap, streaming redaction, process ownership, persisted CommandRecord,
 * and no-progress blocking on repeated identical failures.
 */
import { testFailureDigest } from "../quality/testDigest.js";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import type { CommandRecord, PreflightRecord } from "@flowcode/contracts";
import type { Store } from "../db/store.js";
import type { EventBus } from "../events/bus.js";
import type { ApprovalService } from "../approvals/service.js";
import type { ProcessManager } from "./processManager.js";
import { classifyCommand, type PolicyDecision } from "./policy.js";
import { errorFingerprint } from "./fingerprint.js";
import { StreamingRedactor, redact } from "../security/redaction.js";
import type { PathJail } from "../security/pathJail.js";
import { newId, nowIso, sha256 } from "../util/ids.js";
import { commandExists } from "../workspace/preflight.js";

export interface RunCommandInput {
  jail: PathJail;
  projectId: string;
  runId: string;
  taskId?: string;
  phase?: string;
  argv: string[];
  cwdRel?: string;
  reason: string;
  preflight?: PreflightRecord;
  timeoutMs?: number;
  outputCapBytes?: number;
  maxSameFingerprint?: number;
  extraSecretPatterns?: string[];
  signal?: AbortSignal;
  /** Wait for approval when policy says "ask" (default true). When false, returns awaiting_approval immediately. */
  waitForApproval?: boolean;
  /** Long-running server: resolve once `readyPattern` appears in output, keep the process alive (owned by run). */
  server?: { readyPattern: RegExp; readyTimeoutMs: number };
  /** Pre-approved by a parent decision (e.g. a plan approval explicitly listing this command). */
  preApproved?: boolean;
  /** Explicit override of a no-progress block, granted by the user. */
  overrideNoProgress?: boolean;
  retryOf?: string;
}

export interface RunCommandResult {
  record: CommandRecord;
  output: string;
  decision: PolicyDecision;
  serverProcId?: string;
  serverUrl?: string;
}

const SAFE_ENV_KEYS = [
  "PATH",
  "Path",
  "PATHEXT",
  "SystemRoot",
  "SYSTEMROOT",
  "windir",
  "ComSpec",
  "TEMP",
  "TMP",
  "TMPDIR",
  "HOME",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "ProgramFiles",
  "ProgramFiles(x86)",
  "CommonProgramFiles",
  "NUMBER_OF_PROCESSORS",
  "PROCESSOR_ARCHITECTURE",
  "OS",
  "LANG",
  "LC_ALL",
  "TERM",
  "SHELL",
  "USER",
  "LOGNAME",
  "PLAYWRIGHT_BROWSERS_PATH",
  "SYSTEMDRIVE",
  "SystemDrive",
  "ProgramData",
  "USERNAME",
  "COMPUTERNAME",
  // Network/TLS configuration (not credentials): without these, installs behind a corporate proxy or a
  // custom CA hang. Proxy URLs that embed credentials are redacted from all output.
  "NODE_EXTRA_CA_CERTS",
  "NODE_USE_SYSTEM_CA",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "no_proxy",
  "npm_config_proxy",
  "npm_config_https_proxy",
  "npm_config_cafile",
  "npm_config_strict_ssl",
];

export function scrubbedEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const k of SAFE_ENV_KEYS) if (process.env[k] !== undefined) env[k] = process.env[k];
  env.CI = "1";
  env.FORCE_COLOR = "0";
  env.NO_COLOR = "1";
  env.BROWSER = "none";
  env.NPM_CONFIG_FUND = "false";
  env.NPM_CONFIG_AUDIT = "false";
  env.NPM_CONFIG_UPDATE_NOTIFIER = "false";
  env.GIT_TERMINAL_PROMPT = "0";
  // Trust the operating system's certificates, as browsers do. Antivirus HTTPS scanning (Avast, Kaspersky…) and
  // company proxies sign traffic with a root that is in the OS store but not in Node's bundle; without this every
  // npm download fails its certificate check, falls back to a stale cache after retries, and installs time out.
  // The daemon may also have been started before the user set this, so it isn't left to the inherited environment.
  env.NODE_USE_SYSTEM_CA ??= "1";
  return env;
}

let nodeExeCache: string | undefined;
function nodeExe(): string {
  if (nodeExeCache) return nodeExeCache;
  // When hosted by Electron (ELECTRON_RUN_AS_NODE), process.execPath is electron; prefer a real node on PATH.
  if (!process.versions.electron) return (nodeExeCache = process.execPath);
  const dirs = (process.env.PATH ?? "").split(path.delimiter);
  for (const d of dirs) {
    const p = path.join(d, process.platform === "win32" ? "node.exe" : "node");
    if (fs.existsSync(p)) return (nodeExeCache = p);
  }
  return (nodeExeCache = process.execPath);
}

function npmCli(tool: "npm" | "npx"): string | undefined {
  const candidates = [
    path.join(path.dirname(nodeExe()), "node_modules", "npm", "bin", `${tool}-cli.js`),
    path.join(path.dirname(nodeExe()), "..", "lib", "node_modules", "npm", "bin", `${tool}-cli.js`),
  ];
  return candidates.find((c) => fs.existsSync(c));
}

/**
 * Maps a logical argv to a spawnable argv without a shell. On Windows, .cmd shims cannot be spawned
 * with shell:false, so npm/npx and local package bins are run through node directly.
 */
export function resolveSpawn(argv: string[], root: string): { file: string; args: string[] } {
  const [prog, ...rest] = argv;
  const base = prog.toLowerCase().replace(/\.cmd$/, "");
  if (base === "npm" || base === "npx") {
    if (base === "npx") {
      const tool = rest.find((a) => !a.startsWith("-"));
      const bin = tool ? localBin(root, tool) : undefined;
      if (bin) return { file: nodeExe(), args: [bin, ...rest.slice(rest.indexOf(tool!) + 1)] };
    }
    const cli = npmCli(base);
    if (cli) return { file: nodeExe(), args: [cli, ...rest] };
  }
  if (base === "node") return { file: nodeExe(), args: rest };
  const local = localBin(root, prog);
  if (local) return { file: nodeExe(), args: [local, ...rest] };
  return { file: prog, args: rest };
}

function localBin(root: string, tool: string): string | undefined {
  const pkgNames = [tool, tool === "tsc" ? "typescript" : tool, tool === "vite" ? "vite" : tool];
  for (const name of new Set(pkgNames)) {
    const pj = path.join(root, "node_modules", name, "package.json");
    if (!fs.existsSync(pj)) continue;
    try {
      const pkg = JSON.parse(fs.readFileSync(pj, "utf8")) as { bin?: string | Record<string, string> };
      const rel = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.[tool];
      if (rel) return path.join(root, "node_modules", name, rel);
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

export class CommandRunner {
  constructor(
    private store: Store,
    private bus: EventBus,
    private approvals: ApprovalService,
    private processes: ProcessManager,
  ) {}

  /** Count of prior failures with this fingerprint in the run after the last material change. */
  private sameFailureStreak(runId: string, argv: string[]): { count: number; fingerprint?: string; lastId?: string } {
    const prior = this.store.commands.where("run_id = ? ORDER BY created_at DESC", runId).filter((c) => c.argv.join("\u0000") === argv.join("\u0000"));
    const failures = [];
    for (const c of prior) {
      if (c.status === "succeeded") break;
      if ((c.status === "failed" || c.status === "timed_out") && c.errorFingerprint) failures.push(c);
    }
    if (!failures.length) return { count: 0 };
    const fp = failures[0].errorFingerprint;
    // A material change (any file snapshot after the last failure) resets the streak.
    const lastFailureAt = failures[0].completedAt ?? failures[0].createdAt;
    const changedSince = this.store.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM snapshots WHERE run_id = ? AND created_at > ?", runId, lastFailureAt)?.n ?? 0;
    if (changedSince > 0) return { count: 0, fingerprint: fp };
    let count = 0;
    for (const f of failures) {
      if (f.errorFingerprint === fp) count++;
      else break;
    }
    return { count, fingerprint: fp, lastId: failures[0].id };
  }

  async run(input: RunCommandInput): Promise<RunCommandResult> {
    const settingsPatterns = input.extraSecretPatterns ?? [];
    const cwdRel = input.cwdRel ?? ".";
    const cwd = cwdRel === "." ? input.jail.root : input.jail.resolve(cwdRel, { mustExist: true }).abs;
    const decision = classifyCommand(input.argv, input.jail, input.preflight);
    const record: CommandRecord = {
      id: newId("cmd"),
      runId: input.runId,
      taskId: input.taskId,
      phase: input.phase,
      argv: input.argv.map((a) => redact(a, settingsPatterns)),
      cwdRelativePath: input.jail.relative(cwd),
      policyTier: decision.tier,
      policyReasons: decision.reasons,
      status: "queued",
      retryOf: input.retryOf ?? this.store.commands.where("run_id = ? ORDER BY created_at DESC LIMIT 20", input.runId).find((c) => c.argv.join("\u0000") === input.argv.join("\u0000") && (c.status === "failed" || c.status === "timed_out"))?.id,
      createdAt: nowIso(),
    };
    const save = () => this.store.commands.upsert(record);
    save();
    const ev = { projectId: input.projectId, runId: input.runId, taskId: input.taskId };
    this.bus.emit({ ...ev, type: "command.queued", message: `Queued: ${record.argv.join(" ")} — ${input.reason}`, data: { commandId: record.id, tier: decision.tier, reasons: decision.reasons } });

    const finish = (status: CommandRecord["status"], summary: string, level: "info" | "warning" | "error" = "warning"): RunCommandResult => {
      record.status = status;
      record.completedAt = nowIso();
      save();
      this.bus.emit({ ...ev, type: status === "cancelled" ? "command.cancelled" : "command.failed", message: summary, data: { commandId: record.id, status }, level });
      return { record, output: "", decision };
    };

    if (decision.tier === "never") {
      this.bus.emit({ ...ev, type: "policy.rejected", message: `Policy rejected ${record.argv.join(" ")}: ${decision.reasons.join("; ")}`, data: { commandId: record.id }, level: "error" });
      return finish("blocked", `Blocked by policy: ${decision.reasons.join("; ")}`, "error");
    }

    // No-progress control (FR-C4).
    const streak = this.sameFailureStreak(input.runId, input.argv);
    const maxSame = input.maxSameFingerprint ?? 3;
    if (streak.count >= maxSame && !input.overrideNoProgress) {
      record.errorFingerprint = streak.fingerprint;
      // Rerunning would fail the same way, so it isn't run; but the agent still needs the errors to fix them. Without
      // them a model reads this refusal as "blocked by policy" and gives up on a step it could finish.
      const last = streak.lastId ? this.store.commands.get(streak.lastId) : undefined;
      const errors = (last?.outputPreview ?? "").trim().split("\n").filter((l) => l.trim()).slice(-25).join("\n");
      const result = finish(
        "blocked",
        `No progress: "${record.argv.join(" ")}" was not rerun: it already failed ${streak.count}× with the same errors and no file has changed since. Fix the errors below in the files they name; it runs again after a file changes.${errors ? `\n\nThe errors from the last run:\n${errors}` : ""}`,
        "error",
      );
      return { ...result, output: errors };
    }

    if (decision.tier === "ask" && !input.preApproved && !this.approvals.isPersistentlyApproved(input.projectId, decision.persistKey)) {
      record.status = "awaiting_approval";
      const approval = this.approvals.request({
        projectId: input.projectId,
        runId: input.runId,
        taskId: input.taskId,
        kind: decision.category === "install" ? "dependency_install" : "command",
        action: `Run \`${record.argv.join(" ")}\` in ${record.cwdRelativePath}`,
        reason: input.reason,
        affected: [record.argv.join(" ")],
        risk: decision.category === "install" || decision.category === "delete" || decision.category === "migration" ? "high" : "medium",
        detail: `Policy: ${decision.reasons.join("; ")}`,
        consequencesOfDenial: "The command will not run; the task will be blocked or must find another approach.",
        persistKey: decision.persistKey,
      });
      record.approvalId = approval.id;
      save();
      this.bus.emit({ ...ev, type: "command.awaiting_approval", message: `Waiting for approval: ${record.argv.join(" ")}`, data: { commandId: record.id, approvalId: approval.id } });
      if (input.waitForApproval === false) return { record, output: "", decision };
      const resolved = await this.approvals.wait(approval.id, input.signal);
      if (input.signal?.aborted) return finish("cancelled", `Cancelled while awaiting approval: ${record.argv.join(" ")}`);
      if (resolved.status !== "approved") return finish("blocked", `Approval ${resolved.status}: ${record.argv.join(" ")}`);
    }
    if (input.signal?.aborted) return finish("cancelled", "Cancelled before start");

    return this.execute(input, record, decision, cwd, settingsPatterns, ev);
  }

  private execute(
    input: RunCommandInput,
    record: CommandRecord,
    decision: PolicyDecision,
    cwd: string,
    patterns: string[],
    ev: { projectId: string; runId: string; taskId?: string },
  ): Promise<RunCommandResult> {
    const timeoutMs = input.timeoutMs ?? 300_000;
    const cap = input.outputCapBytes ?? 2_000_000;
    const { file, args } = resolveSpawn(input.argv, input.jail.root);
    if (!path.isAbsolute(file) && !commandExists(file)) {
      record.status = "failed";
      record.exitCode = -1;
      record.outputPreview = `Program not found: ${file}`;
      record.errorFingerprint = errorFingerprint(input.argv, -1, record.outputPreview, "failed");
      record.completedAt = nowIso();
      this.store.commands.upsert(record);
      this.bus.emit({ ...ev, type: "command.failed", message: `Program not found: ${file}`, data: { commandId: record.id }, level: "error" });
      return Promise.resolve({ record, output: record.outputPreview, decision });
    }
    return new Promise((resolve) => {
      const started = Date.now();
      record.status = "running";
      record.startedAt = nowIso();
      this.store.commands.upsert(record);
      this.bus.emit({ ...ev, type: "command.started", message: `Running: ${record.argv.join(" ")}`, data: { commandId: record.id } });
      const child = spawn(file, args, {
        cwd,
        shell: false,
        env: scrubbedEnv(),
        windowsHide: true,
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"],
      });
      const proc = this.processes.register(input.runId, child, input.argv, input.server ? "server" : "command", record.id);
      const redactor = new StreamingRedactor(patterns);
      let captured = "";
      let bytes = 0;
      let truncated = false;
      let pendingOut = "";
      let flushTimer: NodeJS.Timeout | undefined;
      let settled = false;
      let serverReady = false;
      let serverUrl: string | undefined;
      let rawTail = "";

      const flushOut = () => {
        flushTimer = undefined;
        if (!pendingOut) return;
        this.bus.emit({ ...ev, type: "command.output", message: pendingOut, data: { commandId: record.id } });
        pendingOut = "";
      };
      const onData = (chunk: Buffer) => {
        const raw = chunk.toString("utf8");
        rawTail = (rawTail + raw).slice(-4000);
        if (input.server && !serverReady) {
          const plain = rawTail.replace(/\x1b\[[0-9;]*m/g, "");
          const m = input.server.readyPattern.exec(plain);
          if (m) {
            serverReady = true;
            serverUrl = /https?:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+\/?/.exec(plain)?.[0];
            const port = serverUrl ? Number(new URL(serverUrl).port) : undefined;
            if (port) this.processes.setPort(proc.id, port);
          }
        }
        if (bytes >= cap) {
          truncated = true;
          return;
        }
        bytes += chunk.length;
        const safe = redactor.push(raw);
        captured += safe;
        pendingOut += safe;
        if (!flushTimer) flushTimer = setTimeout(flushOut, 120);
        if (serverReady && !settled && input.server) {
          settled = true;
          clearTimeout(timer);
          const tail = redactor.flush();
          captured += tail;
          pendingOut += tail;
          flushOut();
          record.status = "succeeded";
          record.durationMs = Date.now() - started;
          record.outputPreview = captured.slice(-8000);
          record.outputHash = sha256(captured);
          record.completedAt = nowIso();
          this.store.commands.upsert(record);
          this.bus.emit({ ...ev, type: "command.completed", message: `Server ready: ${record.argv.join(" ")}${serverUrl ? ` at ${serverUrl}` : ""}`, data: { commandId: record.id, serverUrl } });
          resolve({ record, output: captured, decision, serverProcId: proc.id, serverUrl });
        }
      };
      child.stdout!.on("data", onData);
      child.stderr!.on("data", onData);

      const timer = setTimeout(
        () => {
          if (settled) return;
          void this.processes.killProcess(proc.id);
          complete("timed_out", undefined);
        },
        input.server ? input.server.readyTimeoutMs : timeoutMs,
      );
      const onAbort = () => {
        if (settled) return;
        void this.processes.killProcess(proc.id);
        complete("cancelled", undefined);
      };
      input.signal?.addEventListener("abort", onAbort, { once: true });

      const complete = (status: CommandRecord["status"], exitCode: number | undefined) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        input.signal?.removeEventListener("abort", onAbort);
        captured += redactor.flush();
        if (truncated) captured += `\n[output truncated at ${cap} bytes]`;
        pendingOut += "";
        flushOut();
        const finalText = redact(captured, patterns);
        record.status = status;
        record.exitCode = exitCode;
        record.durationMs = Date.now() - started;
        // A failed test run keeps its failing tests' names and reasons at the top: only the last 8,000 characters
        // are stored, and a big page dump pushed every name out (Calendar prototype).
        const digest = status !== "succeeded" && /\b(test|vitest|jest)\b/.test(input.argv.join(" ")) ? testFailureDigest(finalText) : "";
        record.outputPreview = digest ? `${digest}${finalText.slice(-(8000 - Math.min(digest.length, 4000)))}` : finalText.slice(-8000);
        record.outputHash = sha256(finalText);
        record.completedAt = nowIso();
        if (status !== "succeeded") record.errorFingerprint = errorFingerprint(input.argv, exitCode, finalText, status);
        this.store.commands.upsert(record);
        const type = status === "succeeded" ? "command.completed" : status === "cancelled" ? "command.cancelled" : "command.failed";
        this.bus.emit({
          ...ev,
          type,
          message: `${status === "succeeded" ? "Succeeded" : status === "timed_out" ? "Timed out" : status === "cancelled" ? "Cancelled" : "Failed"} (${exitCode ?? "-"}) in ${record.durationMs}ms: ${record.argv.join(" ")}`,
          data: { commandId: record.id, exitCode, fingerprint: record.errorFingerprint },
          level: status === "succeeded" ? "info" : "error",
        });
        resolve({ record, output: finalText, decision });
      };
      child.on("error", (err) => {
        captured += `\n${err.message}`;
        complete("failed", -1);
      });
      // Complete on "close" so buffered stdout/stderr is captured; fall back shortly after "exit" in case a
      // grandchild keeps the pipes open.
      let exitCode: number | null | undefined;
      const finishFromExit = () => {
        if (input.server && serverReady) return; // server exit after ready is handled by process manager
        complete(exitCode === 0 && !input.server ? "succeeded" : "failed", exitCode ?? undefined);
      };
      child.on("exit", (code) => {
        exitCode = code;
        setTimeout(finishFromExit, 750);
      });
      child.on("close", (code) => {
        if (exitCode === undefined) exitCode = code;
        finishFromExit();
      });
    });
  }
}
