/**
 * FlowCode desktop shell (ADR-0001/0003). Spawns the local daemon as a separate process (Electron's
 * bundled Node via ELECTRON_RUN_AS_NODE), passes a per-launch token, and hosts the React UI in a
 * sandboxed, context-isolated renderer. Privileged work (files, processes, models) lives in the daemon.
 */
import { app, BrowserWindow, dialog, ipcMain, shell, nativeImage } from "electron";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..", "..");
// Packaged (the .dmg app): the daemon, UI and templates sit in Resources next to the app code (extraResources).
const RES = app.isPackaged ? process.resourcesPath : undefined;
const DAEMON_ENTRY = process.env.FLOWCODE_DAEMON_ENTRY ?? (RES ? path.join(RES, "daemon", "dist", "index.js") : path.join(ROOT, "packages", "daemon", "dist", "index.js"));
const UI_INDEX = RES ? path.join(RES, "ui", "index.html") : path.join(ROOT, "apps", "ui", "dist", "index.html");
const TEMPLATES = RES ? path.join(RES, "templates") : undefined;
const ICON = path.join(__dirname, "..", "assets", "icon.png");

/**
 * A Mac app opened from Finder gets a bare PATH (/usr/bin:/bin:/usr/sbin:/sbin), so the node and npm the builds need
 * (Homebrew, nvm, Volta) aren't found. Ask the login shell for the user's PATH, and add the usual places as a fallback.
 */
function userPath(): string {
  const current = process.env.PATH ?? "";
  if (process.platform !== "darwin") return current;
  let fromShell = "";
  try {
    const shellPath = process.env.SHELL || "/bin/zsh";
    fromShell = execFileSync(shellPath, ["-ilc", "printf %s \"$PATH\""], { encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    /* fall back to the usual places */
  }
  const usual = ["/opt/homebrew/bin", "/usr/local/bin", path.join(os.homedir(), ".volta", "bin")];
  return [...new Set([...fromShell.split(":"), ...current.split(":"), ...usual].filter(Boolean))].join(":");
}

/** Environment for the daemon: packaged installs keep data and the look-check browser in the app's user folder. */
function daemonEnv(token: string): NodeJS.ProcessEnv {
  const packaged: NodeJS.ProcessEnv = RES
    ? { FLOWCODE_DATA_DIR: process.env.FLOWCODE_DATA_DIR ?? app.getPath("userData"), FLOWCODE_TEMPLATES_DIR: TEMPLATES, PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH ?? path.join(app.getPath("userData"), "browsers") }
    : {};
  // NODE_USE_SYSTEM_CA: trust the certificates Windows/macOS trust (antivirus HTTPS scanning, proxies, VPNs),
  // or calls to a cloud model fail with "unable to verify the first certificate".
  return { ...process.env, ...packaged, PATH: userPath(), ELECTRON_RUN_AS_NODE: "1", FLOWCODE_TOKEN: token, FLOWCODE_PARENT_STDIN: "1", NODE_USE_SYSTEM_CA: "1" };
}

/**
 * The look check and screenshots drive a headless Chromium (Playwright). A packaged app ships without it, so the first
 * launch downloads it into the app's user folder in the background; until then those checks report they couldn't run.
 */
function ensureBrowser(env: NodeJS.ProcessEnv) {
  if (!RES) return;
  const dir = env.PLAYWRIGHT_BROWSERS_PATH!;
  if (fs.existsSync(dir) && fs.readdirSync(dir).some((d) => d.startsWith("chromium"))) return;
  const cli = path.join(RES, "daemon", "node_modules", "playwright", "cli.js");
  if (!fs.existsSync(cli)) return;
  const p = spawn(process.execPath, [cli, "install", "--only-shell", "chromium"], { env, stdio: "ignore", windowsHide: true });
  p.on("error", () => undefined);
}

let daemon: ChildProcess | undefined;
let connection: { port: number; token: string } | undefined;
let win: BrowserWindow | undefined;
let quitting = false;

function startDaemon(): Promise<{ port: number; token: string }> {
  const token = randomBytes(24).toString("hex");
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(DAEMON_ENTRY)) return reject(new Error(`Daemon not built: run "npm run build" first.`));
    const env = daemonEnv(token);
    ensureBrowser(env);
    daemon = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", DAEMON_ENTRY], {
      env,
      cwd: RES ? app.getPath("userData") : undefined,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let buf = "";
    const timer = setTimeout(() => reject(new Error("Daemon did not start within 30s")), 30_000);
    daemon.stdout!.on("data", (d: Buffer) => {
      buf += d.toString("utf8");
      const line = buf.split("\n").find((l) => l.includes('"flowcode":"ready"'));
      if (line) {
        clearTimeout(timer);
        const hs = JSON.parse(line) as { port: number };
        resolve({ port: hs.port, token });
      }
    });
    daemon.stderr!.on("data", (d: Buffer) => process.stderr.write(`[daemon] ${d}`));
    daemon.on("exit", (code) => {
      clearTimeout(timer);
      if (quitting) return;
      void onDaemonExit(code);
    });
  });
}

/** Daemon lifecycle from the System page: 75 = restart requested, 76 = stopped by the user. */
async function onDaemonExit(code: number | null) {
  const restart = async () => {
    try {
      connection = await startDaemon();
      win?.webContents.reload();
    } catch (err) {
      dialog.showErrorBox("FlowCode could not restart the daemon", (err as Error).message);
      app.quit();
    }
  };
  if (code === 75) return restart();
  const stoppedByUser = code === 76;
  const choice = await dialog.showMessageBox({
    type: stoppedByUser ? "info" : "error",
    title: "FlowCode daemon stopped",
    message: stoppedByUser ? "The FlowCode daemon is stopped." : `The local daemon exited unexpectedly (code ${code}).`,
    detail: "Owned processes were cleaned up. Interrupted runs are resumable after the daemon starts again.",
    buttons: ["Start daemon", "Quit FlowCode"],
    defaultId: 0,
    cancelId: 1,
  });
  if (choice.response === 0) return restart();
  quitting = true;
  app.quit();
}

async function stopDaemon() {
  if (!daemon || daemon.exitCode !== null) return;
  // Graceful: closing stdin tells the daemon to clean up owned processes and exit.
  daemon.stdin?.end();
  await new Promise<void>((resolve) => {
    const t = setTimeout(() => {
      daemon?.kill();
      resolve();
    }, 8000);
    daemon!.once("exit", () => {
      clearTimeout(t);
      resolve();
    });
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 980,
    minHeight: 640,
    title: "FlowCode",
    backgroundColor: "#0e0f12",
    icon: fs.existsSync(ICON) ? nativeImage.createFromPath(ICON) : undefined,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
    },
  });
  // Smoke mode (CI / verification): report load status and quit.
  if (process.env.FLOWCODE_SMOKE === "1") {
    win.webContents.once("did-finish-load", async () => {
      await new Promise((r) => setTimeout(r, 2500));
      const title = await win!.webContents.executeJavaScript(
        `document.title + " | " + (document.querySelector(".hero__title")?.textContent ?? "") + " | bridge=" + Boolean(window.flowcode && window.flowcode.token)`,
      );
      process.stdout.write(`SMOKE window loaded: ${title}\n`);
      app.quit();
    });
  }
  const devUrl = process.env.FLOWCODE_UI_URL;
  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(UI_INDEX);

  // The renderer may never navigate away from the app; links open externally or as artifact windows.
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("file://") && !(devUrl && url.startsWith(devUrl))) e.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^http:\/\/127\.0\.0\.1:\d+\/artifacts\//.test(url)) return { action: "allow", overrideBrowserWindowOptions: { autoHideMenuBar: true, backgroundColor: "#0e0f12", webPreferences: { sandbox: true, contextIsolation: true } } };
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
}

ipcMain.on("flowcode:connection", (e) => {
  e.returnValue = connection ?? null;
});

ipcMain.handle("flowcode:select-folder", async () => {
  const res = await dialog.showOpenDialog(win!, { title: "Open a local folder as a FlowCode workspace", properties: ["openDirectory", "createDirectory"] });
  return res.canceled ? null : (res.filePaths[0] ?? null);
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(async () => {
    try {
      connection = await startDaemon();
    } catch (err) {
      dialog.showErrorBox("FlowCode could not start", (err as Error).message);
      app.quit();
      return;
    }
    createWindow();
  });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", (e) => {
    if (quitting) return;
    quitting = true;
    e.preventDefault();
    void stopDaemon().finally(() => app.exit(0));
  });
}
