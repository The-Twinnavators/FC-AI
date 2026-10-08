// An empty FlowCode, for checking every empty state: a second daemon on port 7467 with its own data folder
// (.flowcode-data-empty), started fresh each time, beside your real one on 7457.
//
//   npm run dev:empty            reset the empty copy and start it
//   npm run dev:empty -- --keep  start it with what you added last time
//
// Open the address it prints. It uses 127.0.0.1 (not localhost) on purpose: the browser keeps separate saved data
// for each, so that window doesn't see your real Copilot chat or settings, and your localhost tab stays on your real
// projects. The UI dev server must be running (npm run dev:ui). Stop with Ctrl+C.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// Not 7458: that's the real FlowCode's phone page.
const PORT = process.env.FLOWCODE_EMPTY_PORT ?? "7467";
const TOKEN = "dev-token-flowcode";
const dataDir = path.join(root, ".flowcode-data-empty");
const keep = process.argv.includes("--keep");

if (PORT === "7457" || PORT === "7458") {
  console.error("The empty copy can't use port 7457 or 7458: those are your real FlowCode and its phone page.");
  process.exit(1);
}
// Only ever this folder: never the real .flowcode-data.
if (!keep && fs.existsSync(dataDir)) {
  if (path.basename(dataDir) !== ".flowcode-data-empty") throw new Error("refusing to delete an unexpected folder");
  fs.rmSync(dataDir, { recursive: true, force: true });
  console.log("Reset the empty copy (.flowcode-data-empty).");
}

const child = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", path.join(root, "scripts/dev-daemon.mjs")], {
  cwd: root,
  stdio: ["pipe", "inherit", "inherit"],
  // The launcher stops its daemon when this script goes away, however it's stopped (Ctrl+C or closing the terminal).
  env: { ...process.env, FLOWCODE_DATA_DIR: dataDir, FLOWCODE_PORT: PORT, FLOWCODE_TOKEN: TOKEN, FLOWCODE_LAUNCHER_WATCH_STDIN: "1" },
});
const stop = () => child.kill();
process.on("SIGINT", () => (stop(), process.exit(0)));
process.on("SIGTERM", () => (stop(), process.exit(0)));
child.on("exit", (code) => process.exit(code ?? 0));

// Say where to look once it answers.
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 500));
  const up = await fetch(`http://127.0.0.1:${PORT}/health`, { headers: { authorization: `Bearer ${TOKEN}` } }).then((r) => r.ok, () => false);
  if (up) {
    console.log(`\nEmpty FlowCode is running${keep ? " (kept from last time)" : ""}. Open:\n\n  http://127.0.0.1:5199/?port=${PORT}&token=${TOKEN}&temp=1\n\nYour real FlowCode stays on http://localhost:5199. Ctrl+C stops the empty one; it's remembered in that tab only.\n`);
    break;
  }
}
