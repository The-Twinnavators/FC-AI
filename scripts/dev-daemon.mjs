// Development launcher: runs the daemon on a fixed port/token with a separate data dir.
// Open the UI at http://127.0.0.1:5199/?port=7457&token=dev-token-flowcode
//
// Like the desktop shell, it supervises the daemon: exit code 75 (System → Restart daemon) starts it again, 76
// (Stop daemon) ends the launcher. The daemon watches its stdin, so it also shuts down cleanly if this launcher is
// killed instead of being left behind holding the port.
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * The cloud coder's API key from the Windows user environment, read fresh on every (re)start, so a key set after the
 * app started is picked up by restarting the daemon (System → Restart daemon). It's only passed to the daemon's
 * environment; FlowCode never writes it anywhere.
 */
function userEnv(name) {
  if (process.platform !== "win32") return undefined;
  try {
    const out = execFileSync("reg", ["query", "HKCU\\Environment", "/v", name], { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    return /REG_(?:EXPAND_)?SZ\s+(.+)\s*$/m.exec(out)?.[1]?.trim() || undefined;
  } catch {
    return undefined;
  }
}

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const env = {
  ...process.env,
  FLOWCODE_DATA_DIR: process.env.FLOWCODE_DATA_DIR ?? path.join(root, ".flowcode-data"),
  FLOWCODE_PORT: process.env.FLOWCODE_PORT ?? "7457",
  FLOWCODE_TOKEN: process.env.FLOWCODE_TOKEN ?? "dev-token-flowcode",
  FLOWCODE_PARENT_STDIN: "1",
  // Trust the certificates Windows trusts: antivirus HTTPS scanning (Avast), company proxies and VPNs sign traffic
  // with their own root, which Node's built-in list rejects ("unable to verify the first certificate").
  NODE_USE_SYSTEM_CA: "1",
};
const entry = path.join(root, "packages/daemon/dist/index.js");

let child;
let stopping = false;
function start() {
  const key = userEnv("FLOWCODE_HOSTED_API_KEY") ?? process.env.FLOWCODE_HOSTED_API_KEY;
  child = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", entry], { env: { ...env, ...(key ? { FLOWCODE_HOSTED_API_KEY: key } : {}) }, stdio: ["pipe", "inherit", "inherit"], windowsHide: true });
  child.on("exit", (code) => {
    if (stopping) return process.exit(0);
    if (code === 75) {
      process.stdout.write("[dev-daemon] restart requested; starting the daemon again\n");
      return setTimeout(start, 300);
    }
    process.stdout.write(`[dev-daemon] daemon exited (${code}${code === 76 ? ", stopped from System" : ""})\n`);
    process.exit(code === 76 ? 0 : (code ?? 1));
  });
}

const stop = () => {
  stopping = true;
  // Closing stdin asks the daemon to clean up its processes and exit.
  child?.stdin?.end();
  setTimeout(() => process.exit(0), 8000).unref();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
// Started by another script (npm run dev:empty): when that script goes away, its end of our stdin closes; stop too.
if (process.env.FLOWCODE_LAUNCHER_WATCH_STDIN === "1") {
  process.stdin.on("end", stop);
  process.stdin.on("error", stop);
  process.stdin.resume();
}
start();
