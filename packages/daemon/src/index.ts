#!/usr/bin/env node
/**
 * FlowCode local daemon entry. Runs as a separate process from the UI (ADR-0003). Prints a single
 * JSON handshake line ({"flowcode":"ready","port":…}) on stdout; the token is supplied by the parent
 * via FLOWCODE_TOKEN or generated and written to the data dir with user-only permissions.
 */
import fs from "node:fs";
import path from "node:path";
import { createApp } from "./app.js";
import { startServer } from "./api/server.js";
import { watchRunEnds } from "./quality/runReview.js";
import { watchDecisions } from "./governance/decisionLog.js";
import { applyRetention } from "./db/retention.js";

async function main() {
  const app = createApp();
  // Every run that ends gets a short review (what was asked, what was verified, what couldn't be).
  watchRunEnds(app);
  // FlowCode's own recoveries go in the decision log next to the person's decisions.
  watchDecisions(app);
  await app.orchestrator.reconcileOnStartup();
  applyRetention(app.store, app.objects, app.bus);
  setInterval(() => applyRetention(app.store, app.objects, app.bus), 6 * 3600_000).unref();
  let requestExit: (code: number) => void = () => undefined;
  const handle = await startServer(app, { port: Number(process.env.FLOWCODE_PORT ?? 0), token: process.env.FLOWCODE_TOKEN || undefined, onExitRequest: (code) => requestExit(code) });
  const handshake = { flowcode: "ready", port: handle.port, pid: process.pid };
  if (!process.env.FLOWCODE_TOKEN) {
    const file = path.join(app.dataDir, "daemon.json");
    fs.writeFileSync(file, JSON.stringify({ ...handshake, token: handle.token }), { mode: 0o600 });
  }
  process.stdout.write(`${JSON.stringify(handshake)}\n`);

  let stopping = false;
  const shutdown = async (signal: string, exitCode = 0) => {
    if (stopping) return;
    stopping = true;
    // FR-C3: app shutdown terminates every owned process and records the cleanup result.
    for (const id of [...app.store.runs.where("status IN ('running','recovering','verifying','awaiting_approval')").map((r) => r.id)]) {
      if (app.orchestrator.isActive(id)) app.bus.emit({ type: "run.status_changed", runId: id, message: `Daemon stopping (${signal}); run will be resumable`, level: "warning" });
    }
    await app.mcp.closeAll().catch(() => undefined);
    await app.processes.cleanupAll(`daemon shutdown (${signal})`);
    await handle.close();
    app.db.close();
    process.exit(exitCode);
  };
  // System page controls: 75 asks the desktop shell to restart the daemon, 76 means stopped by the user.
  requestExit = (code) => void shutdown(code === 75 ? "restart requested" : "stop requested", code);
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("disconnect", () => void shutdown("parent disconnected"));
  // When launched by the desktop shell, a closed stdin means the parent died: clean up owned processes.
  if (process.env.FLOWCODE_PARENT_STDIN === "1") {
    process.stdin.on("end", () => void shutdown("parent stdin closed"));
    process.stdin.resume();
  }
}

// Never let a stray rejection take the daemon (and the processes it owns) down silently.
process.on("unhandledRejection", (err) => process.stderr.write(`[flowcode] unhandled rejection: ${(err as Error)?.message ?? err}
`));
process.on("uncaughtException", (err) => process.stderr.write(`[flowcode] uncaught exception: ${err.message}
`));

main().catch((err) => {
  process.stderr.write(`FlowCode daemon failed to start: ${(err as Error).message}\n`);
  process.exit(1);
});
