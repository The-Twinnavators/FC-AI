// Gathers what the packaged app ships in Resources (electron-builder extraResources):
//   stage/daemon     the built daemon, its production dependencies, and @flowcode/contracts
//   stage/ui         the built UI (loaded from file://)
//   stage/templates  starters, layouts and the Styles gallery
// Run after `npm run build` at the repo root. The daemon's dependencies are installed fresh for the platform this runs
// on, so build the Mac app on a Mac (the GitHub Actions workflow does).
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const desktop = path.resolve(here, "..");
const root = path.resolve(desktop, "..", "..");
const stage = path.join(desktop, "stage");

const need = (p, what) => {
  if (!fs.existsSync(p)) throw new Error(`${what} is missing (${path.relative(root, p)}): run "npm run build" at the repo root first.`);
};
need(path.join(root, "packages/daemon/dist/index.js"), "The built daemon");
need(path.join(root, "packages/contracts/dist/index.js"), "The built contracts");
need(path.join(root, "apps/ui/dist/index.html"), "The built UI");

fs.rmSync(stage, { recursive: true, force: true });
const copy = (from, to, filter) => fs.cpSync(path.join(root, from), path.join(stage, to), { recursive: true, filter });
// Tests, source maps and dependency folders stay behind.
const noJunk = (src) => !/[\\/](node_modules|\.vite|test-results)([\\/]|$)/.test(src) && !src.endsWith(".map") && !src.endsWith(".tsbuildinfo");

// Daemon: dist plus a package.json with only its runtime dependencies.
copy("packages/daemon/dist", "daemon/dist", noJunk);
const daemonPkg = JSON.parse(fs.readFileSync(path.join(root, "packages/daemon/package.json"), "utf8"));
const { "@flowcode/contracts": _contracts, ...deps } = daemonPkg.dependencies;
fs.writeFileSync(path.join(stage, "daemon/package.json"), `${JSON.stringify({ name: "flowcode-daemon", version: daemonPkg.version, private: true, type: "module", main: "dist/index.js", dependencies: deps }, null, 2)}\n`);
console.log("Installing the daemon's runtime dependencies…");
execSync("npm install --omit=dev --no-audit --no-fund --no-package-lock", { cwd: path.join(stage, "daemon"), stdio: "inherit" });

// Contracts: the workspace package, copied in where the daemon imports it from.
const contracts = path.join(stage, "daemon/node_modules/@flowcode/contracts");
fs.mkdirSync(contracts, { recursive: true });
fs.copyFileSync(path.join(root, "packages/contracts/package.json"), path.join(contracts, "package.json"));
fs.cpSync(path.join(root, "packages/contracts/dist"), path.join(contracts, "dist"), { recursive: true, filter: noJunk });

copy("apps/ui/dist", "ui", noJunk);
copy("templates", "templates", noJunk);

const size = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? size(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);
console.log(`Staged ${(size(stage) / 1e6).toFixed(0)} MB in ${path.relative(root, stage)}`);
