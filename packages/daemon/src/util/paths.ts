import os from "node:os";
import path from "node:path";
import fs from "node:fs";

/** Root for daemon metadata, artifacts, snapshots and disposable workspaces. Never inside a user workspace. */
export function defaultDataDir(): string {
  if (process.env.FLOWCODE_DATA_DIR) return path.resolve(process.env.FLOWCODE_DATA_DIR);
  const base = process.platform === "win32" ? process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming") : path.join(os.homedir(), ".local", "share");
  return path.join(base, "FlowCode");
}

export function ensureDir(dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}
