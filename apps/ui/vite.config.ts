import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DAEMON_PORT = process.env.FLOWCODE_PORT ?? "7457";

/**
 * Where node_modules actually is. In a normal checkout that is `root`; in a git worktree (.claude/worktrees/...) the
 * worktree has none of its own and Node finds the main checkout's by walking up, so the fonts and the library's raw
 * section sources Vite serves live there too. Without this, Vite's allow list is the worktree alone and refuses them.
 */
function depsRoot(from: string): string {
  for (let dir = from; ; ) {
    if (fs.existsSync(path.join(dir, "node_modules"))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return from;
    dir = up;
  }
}
const deps = depsRoot(root);

/**
 * Dev only: the page can't load without the daemon, so the UI dev server starts it (scripts/dev-daemon.mjs, the same
 * launcher as `npm run dev:daemon`) when nothing answers on its port, at startup and again on a page load if it has
 * gone down since. A daemon started some other way is left alone; one started here stops with the dev server.
 */
function autoDaemon(): Plugin {
  let child: ChildProcess | undefined;
  let starting: Promise<void> | undefined;
  const up = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:${DAEMON_PORT}/health`, { signal: AbortSignal.timeout(1500) });
      return res.status < 500;
    } catch {
      return false;
    }
  };
  const ensure = (log: (m: string) => void) =>
    (starting ??= (async () => {
      if ((await up()) || (child && child.exitCode === null)) return;
      log(`FlowCode daemon isn't running on :${DAEMON_PORT}; starting it.`);
      child = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "scripts/dev-daemon.mjs"], { cwd: root, stdio: "inherit", windowsHide: true });
      child.on("exit", () => (child = undefined));
      // Wait (up to ~20 s) so the first page load finds it answering.
      for (let i = 0; i < 40 && !(await up()); i++) await new Promise((r) => setTimeout(r, 500));
    })().finally(() => (starting = undefined)));
  const stop = () => child?.kill();
  return {
    name: "flowcode-auto-daemon",
    apply: "serve",
    configureServer(server) {
      const log = (m: string) => server.config.logger.info(m, { timestamp: true });
      void ensure(log);
      // Page loads (not every module request) re-check, so a daemon that stopped comes back with a refresh.
      server.middlewares.use(async (req, _res, next) => {
        if (req.headers.accept?.includes("text/html")) await ensure(log);
        next();
      });
      server.httpServer?.on("close", stop);
      process.once("exit", stop);
      for (const sig of ["SIGINT", "SIGTERM"] as const) process.once(sig, () => (stop(), process.exit()));
    },
  };
}

// base "./" so the built UI loads from file:// inside Electron.
export default defineConfig({
  base: "./",
  plugins: [react(), autoDaemon()],
  server: { port: 5199, strictPort: true, host: "127.0.0.1", fs: { allow: [...new Set([root, deps])] } },
  // section-preview.html: the Component library shows each section in a page of its own.
  build: { outDir: "dist", sourcemap: true, rollupOptions: { input: { main: path.resolve(root, "apps/ui/index.html"), sectionPreview: path.resolve(root, "apps/ui/section-preview.html") } } },
});
