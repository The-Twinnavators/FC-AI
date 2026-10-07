/**
 * Run-owned process manager (FR-C3). Tracks every spawned child by run, PID, port and command, and
 * kills whole process trees on cancel/shutdown, recording the cleanup result.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import type { OwnedProcess } from "@flowcode/contracts";
import type { Store } from "../db/store.js";
import type { EventBus } from "../events/bus.js";
import { newId, nowIso } from "../util/ids.js";

export class ProcessManager {
  private live = new Map<string, { rec: OwnedProcess; child?: ChildProcess }>();

  constructor(
    private store: Store,
    private bus: EventBus,
  ) {}

  register(runId: string, child: ChildProcess, argv: string[], kind: OwnedProcess["kind"], commandId?: string, port?: number): OwnedProcess {
    const rec: OwnedProcess = { id: newId("proc"), runId, commandId, pid: child.pid ?? -1, port, argv, kind, state: "running", startedAt: nowIso() };
    this.store.processes.upsert(rec);
    this.live.set(rec.id, { rec, child });
    child.once("exit", () => {
      const cur = this.live.get(rec.id);
      if (cur && cur.rec.state === "running") {
        cur.rec = { ...cur.rec, state: "exited", endedAt: nowIso() };
        this.store.processes.upsert(cur.rec);
      }
      this.live.delete(rec.id);
    });
    return rec;
  }

  /** Registers an externally-launched process (e.g. Playwright browser) by pid. */
  registerPid(runId: string, pid: number, argv: string[], kind: OwnedProcess["kind"], port?: number): OwnedProcess {
    const rec: OwnedProcess = { id: newId("proc"), runId, pid, port, argv, kind, state: "running", startedAt: nowIso() };
    this.store.processes.upsert(rec);
    this.live.set(rec.id, { rec });
    return rec;
  }

  setPort(procId: string, port: number) {
    const cur = this.live.get(procId);
    if (cur) {
      cur.rec = { ...cur.rec, port };
      this.store.processes.upsert(cur.rec);
    }
  }

  markExited(procId: string) {
    const cur = this.live.get(procId);
    if (cur) {
      cur.rec = { ...cur.rec, state: "exited", endedAt: nowIso() };
      this.store.processes.upsert(cur.rec);
      this.live.delete(procId);
    }
  }

  liveForRun(runId: string): OwnedProcess[] {
    return [...this.live.values()].filter((x) => x.rec.runId === runId).map((x) => x.rec);
  }

  async killProcess(procId: string): Promise<OwnedProcess | undefined> {
    const cur = this.live.get(procId);
    if (!cur) return undefined;
    const ok = await killTree(cur.rec.pid);
    cur.rec = { ...cur.rec, state: ok ? "killed" : "kill_failed", endedAt: nowIso(), cleanupResult: ok ? "process tree terminated" : "termination failed" };
    this.store.processes.upsert(cur.rec);
    this.live.delete(procId);
    return cur.rec;
  }

  /** Kills every live process owned by the run; returns a summary that is persisted as an event. */
  async cleanupRun(runId: string, reason: string): Promise<{ total: number; killed: number; failed: number }> {
    const targets = [...this.live.values()].filter((x) => x.rec.runId === runId);
    let killed = 0;
    let failed = 0;
    for (const t of targets) {
      const r = await this.killProcess(t.rec.id);
      if (r?.state === "killed") killed++;
      else failed++;
    }
    // Also reconcile DB records left "running" by a previous daemon instance.
    for (const stale of this.store.processes.where("run_id = ? AND state = 'running'", runId)) {
      if (this.live.has(stale.id)) continue;
      // A PID from a previous session may have been reused by an unrelated program: only kill it if the
      // live process still looks like something FlowCode spawned.
      const alive = isAlive(stale.pid) && looksOwned(stale.pid, stale.kind);
      const ok = alive ? await killTree(stale.pid) : true;
      this.store.processes.upsert({ ...stale, state: ok ? "killed" : "kill_failed", endedAt: nowIso(), cleanupResult: alive ? "orphan from previous session terminated" : "already exited (or PID reused by another program; left untouched)" });
      if (alive) ok ? killed++ : failed++;
    }
    const summary = { total: targets.length, killed, failed };
    this.bus.emit({
      type: "process.cleanup",
      runId,
      message: `Process cleanup (${reason}): ${killed} stopped, ${failed} failed`,
      data: summary,
      level: failed ? "error" : "info",
    });
    return summary;
  }

  async cleanupAll(reason: string) {
    const runIds = new Set([...this.live.values()].map((x) => x.rec.runId));
    for (const r of this.store.processes.where("state = 'running'")) runIds.add(r.runId);
    for (const id of runIds) await this.cleanupRun(id, reason);
  }
}

/** Checks the image name of a live PID against the programs FlowCode spawns. */
export function looksOwned(pid: number, kind: OwnedProcess["kind"]): boolean {
  const expected = kind === "browser" ? /^(chrome|chromium|headless_shell)/i : /^(node|electron|flowcode|git|python|py|vite|esbuild|npm)/i;
  try {
    if (process.platform === "win32") {
      const out = spawnSync("tasklist.exe", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"], { shell: false, windowsHide: true, encoding: "utf8", timeout: 5000 }).stdout ?? "";
      const image = /^"([^"]+)"/.exec(out.trim())?.[1] ?? "";
      return expected.test(image);
    }
    const out = spawnSync("ps", ["-o", "comm=", "-p", String(pid)], { shell: false, encoding: "utf8", timeout: 5000 }).stdout ?? "";
    return expected.test(out.trim().split("/").pop() ?? "");
  } catch {
    return false;
  }
}

export function isAlive(pid: number): boolean {
  if (pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function killTree(pid: number): Promise<boolean> {
  if (pid <= 0) return true;
  if (!isAlive(pid)) return true;
  if (process.platform === "win32") {
    spawnSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], { shell: false, stdio: "ignore", windowsHide: true, timeout: 10_000 });
  } else {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        /* gone */
      }
    }
    await new Promise((r) => setTimeout(r, 1500));
    if (isAlive(pid)) {
      try {
        process.kill(-pid, "SIGKILL");
      } catch {
        try {
          process.kill(pid, "SIGKILL");
        } catch {
          /* gone */
        }
      }
    }
  }
  for (let i = 0; i < 20 && isAlive(pid); i++) await new Promise((r) => setTimeout(r, 100));
  return !isAlive(pid);
}

export { spawn };
