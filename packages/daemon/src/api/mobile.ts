/**
 * The phone page: a small page on the local Wi-Fi (and, with Tailscale, on this PC's HTTPS tailnet address) so a phone
 * can keep up with FlowCode.
 *  - Off until turned on in Settings → Phone. Listens on its own port.
 *  - Its own random key (in the QR code's link), separate from the daemon token. With it, a phone can list pending
 *    approvals and allow or deny them, see blocked builds and why they stopped, and retry a blocked step with the
 *    troubleshooter's fix. Nothing else: no new builds, files, commands or settings.
 *  - On HTTPS the page installs as an app (PWA) and can send notifications (Web Push, see mobilePush.ts) when a build
 *    is blocked or waiting for an OK, with the page closed.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type * as C from "@flowcode/contracts";
import { approvalForYou } from "@flowcode/contracts";
import type { App } from "../app.js";
import { templatesRoot } from "../orchestrator/templates.js";
import { troubleshoot } from "../quality/troubleshoot.js";
import { addPushDevice, clearPushDevices, pushDevices, removePushDevice, tailscaleServe, tailscaleState, vapidKeys, watchForPush, type PushSubscriptionJson, type TailscaleState } from "./mobilePush.js";

const SETTING = "mobile:approvals";
const DEFAULT_PORT = 7458;

interface Config {
  enabled: boolean;
  key: string;
  port: number;
}

export interface MobileStatus {
  enabled: boolean;
  running: boolean;
  port: number;
  /** Links for the QR code: the HTTPS tailnet address first when there is one, then each local network address. */
  urls: string[];
  error?: string;
  /** HTTPS through Tailscale (needed for notifications and installing the page as an app). */
  https: TailscaleState;
  /** Phones that turned notifications on. */
  pushDevices: number;
}

const newKey = () => crypto.randomBytes(18).toString("base64url");
const sameKey = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Private IPv4 addresses of this machine, home-network ranges first. */
function lanAddresses(): string[] {
  const out: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) for (const n of list ?? []) if (n.family === "IPv4" && !n.internal) out.push(n.address);
  const rank = (ip: string) => (ip.startsWith("192.168.") ? 0 : ip.startsWith("10.") ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3);
  return out.filter((ip) => rank(ip) < 3).sort((a, b) => rank(a) - rank(b));
}

const oneLine = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).replace(/\s+\S*$/, "")}…` : t;
};

export function createMobileApprovals(app: App, decide: (id: string, input: C.ApprovalDecisionInput) => unknown, retry: (runId: string, taskId: string, guidance?: string) => unknown) {
  let server: http.Server | undefined;
  /** The port actually in use (differs from the setting only when it asks for any free port, 0). */
  let boundPort = 0;
  let error: string | undefined;
  let https: TailscaleState = { state: "missing" };
  const config = (): Config => {
    const c = app.store.getSetting<Partial<Config> | null>(SETTING, null) ?? {};
    return { enabled: !!c.enabled, key: c.key || newKey(), port: c.port ?? DEFAULT_PORT };
  };
  const save = (c: Config) => app.store.setSetting(SETTING, c);
  const port = () => (server ? boundPort : config().port);
  const refreshHttps = async () => {
    https = await tailscaleState(port()).catch((): TailscaleState => ({ state: "missing" }));
    return https;
  };
  // Push needs an https: subject; the tailnet address is the page's own origin.
  watchForPush(app, () => (https.state === "serving" && https.dnsName ? `https://${https.dnsName}` : undefined));

  const buildTitle = (runId?: string) => {
    const objective = (runId && app.store.runs.get(runId)?.objective) || "";
    return oneLine(objective.split(/\r?\n/).find((l) => l.trim())?.replace(/^#+\s*/, "") ?? "", 90);
  };
  const projectName = (id: string) => app.store.projects.get(id)?.name ?? "A project";

  const pending = () =>
    app.approvals.pending().map((a) => ({ id: a.id, project: projectName(a.projectId), build: buildTitle(a.runId), kind: a.kind, action: a.action, forYou: approvalForYou(a) ?? "", reason: a.reason, risk: a.risk, affected: a.affected?.slice(0, 4) ?? [], createdAt: a.createdAt }));

  /**
   * Blocked builds you dismissed on the phone, by build, step and reason: the same block stays hidden, but if the build
   * gets stuck again on another step or for another reason it shows up again.
   */
  const DISMISSED = "mobile.dismissedBlocked";
  const dismissed = () => new Set(app.store.getSetting<string[]>(DISMISSED, []));
  const blockKey = (b: { runId: string; taskId?: string; reason: string }) => `${b.runId}|${b.taskId ?? ""}|${b.reason}`;
  const setDismissed = (keys: Set<string>) => app.store.setSetting(DISMISSED, [...keys].slice(-200));

  /** Builds stopped on a blocked step, newest first (all of them, dismissed or not). */
  const allBlocked = () =>
    app.store.runs
      .list()
      .filter((r) => r.status === "blocked")
      .sort((a, b) => (b.completedAt ?? b.startedAt ?? "").localeCompare(a.completedAt ?? a.startedAt ?? ""))
      .map((r) => {
        const task = app.store.tasks.where("run_id = ?", r.id).find((t) => t.status === "blocked");
        return { runId: r.id, taskId: task?.id, project: projectName(r.projectId), build: buildTitle(r.id), step: task?.title ?? "", reason: oneLine(task?.blocker?.reason ?? r.statusReason ?? "", 400), at: r.completedAt ?? r.startedAt };
      });
  /** The blocked builds the phone lists: newest first, without the ones you dismissed. */
  const blocked = () => {
    const hide = dismissed();
    return allBlocked()
      .filter((b) => !hide.has(blockKey(b)))
      .slice(0, 8);
  };

  const readBody = async (req: http.IncomingMessage, max = 8000) => {
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > max) throw Object.assign(new Error("Too large"), { status: 413 });
    }
    return JSON.parse(raw || "{}") as Record<string, unknown>;
  };

  const handler = (key: string) => async (req: http.IncomingMessage, res: http.ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://phone");
    const supplied = String(req.headers["x-flowcode-key"] ?? url.searchParams.get("k") ?? "");
    const send = (status: number, body: string | Buffer, type = "application/json", extra: Record<string, string> = {}) => {
      res.writeHead(status, { "content-type": type, "cache-control": "no-store", connection: "close", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", ...extra });
      res.end(body);
    };
    const json = (status: number, v: unknown) => send(status, JSON.stringify(v));
    if (!sameKey(supplied, key)) return req.method === "GET" && url.pathname === "/" ? send(401, PAGE_LOCKED, "text/html; charset=utf-8") : json(401, { error: "This link has expired. Scan the QR code in FlowCode again." });
    try {
      if (req.method === "GET" && url.pathname === "/") return send(200, PAGE, "text/html; charset=utf-8");
      if (req.method === "GET" && url.pathname === "/manifest.webmanifest") return send(200, manifest(key), "application/manifest+json");
      if (req.method === "GET" && url.pathname === "/sw.js") return send(200, SERVICE_WORKER, "text/javascript; charset=utf-8", { "service-worker-allowed": "/" });
      if (req.method === "GET" && url.pathname === "/icon.png") {
        const file = path.join(templatesRoot(), "brand", "icon-512.png");
        return fs.existsSync(file) ? send(200, fs.readFileSync(file), "image/png") : json(404, { error: "No icon" });
      }
      if (req.method === "GET" && url.pathname === "/api/approvals") return json(200, { approvals: pending(), blocked: blocked(), at: new Date().toISOString() });
      const m = /^\/api\/approvals\/([\w-]+)$/.exec(url.pathname);
      if (req.method === "POST" && m) {
        const decision = (await readBody(req)).decision;
        if (decision !== "once" && decision !== "deny") return json(400, { error: "Choose Allow once or Deny." });
        decide(m[1], { decision, note: "Decided from phone" });
        return json(200, { ok: true });
      }
      // Why a build stopped: the same troubleshooter as the desktop's "Why it's blocked" panel.
      const ex = /^\/api\/blocked\/([\w-]+)\/explain$/.exec(url.pathname);
      if (req.method === "POST" && ex) {
        const b = blocked().find((x) => x.runId === ex[1]);
        if (!b) return json(404, { error: "That build isn't blocked any more." });
        const d = await troubleshoot(app, b.runId, b.taskId, true);
        return json(200, {
          summary: d.summary,
          explanation: d.explanation,
          causes: d.causes.map((c) => ({ title: c.title, evidence: oneLine(c.evidence, 300) })),
          fixes: d.fixes.filter((f) => f.kind === "retry_with_guidance").map((f) => ({ id: f.id, label: f.label, detail: f.detail, text: f.text ?? "" })),
        });
      }
      // Dismiss one blocked build ("all" dismisses every one listed), or bring a dismissed one back (Undo).
      const dm = /^\/api\/blocked\/([\w-]+)\/(dismiss|restore)$/.exec(url.pathname);
      if (req.method === "POST" && dm) {
        const keys = dismissed();
        const targets = allBlocked().filter((b) => dm[1] === "all" || b.runId === dm[1]);
        if (!targets.length) return json(404, { error: "That build isn't blocked any more." });
        for (const b of targets) dm[2] === "dismiss" ? keys.add(blockKey(b)) : keys.delete(blockKey(b));
        setDismissed(keys);
        return json(200, { ok: true, count: targets.length });
      }
      const rt = /^\/api\/blocked\/([\w-]+)\/retry$/.exec(url.pathname);
      if (req.method === "POST" && rt) {
        const b = blocked().find((x) => x.runId === rt[1]);
        if (!b?.taskId) return json(404, { error: "That build isn't blocked any more." });
        const guidance = (await readBody(req)).guidance;
        retry(b.runId, b.taskId, typeof guidance === "string" && guidance.trim() ? guidance.slice(0, 4000) : undefined);
        return json(200, { ok: true });
      }
      if (req.method === "GET" && url.pathname === "/api/push/key") return json(200, { key: vapidKeys(app).publicKey });
      if (req.method === "POST" && url.pathname === "/api/push/subscribe") {
        addPushDevice(app, (await readBody(req)) as unknown as PushSubscriptionJson);
        return json(200, { ok: true });
      }
      if (req.method === "POST" && url.pathname === "/api/push/unsubscribe") {
        removePushDevice(app, String((await readBody(req)).endpoint ?? ""));
        return json(200, { ok: true });
      }
      return json(404, { error: "Not found" });
    } catch (e) {
      return json((e as { status?: number }).status ?? 500, { error: (e as Error).message.slice(0, 200) });
    }
  };

  const stop = () =>
    new Promise<void>((resolve) => {
      if (!server) return resolve();
      const s = server;
      server = undefined;
      s.closeAllConnections?.();
      s.close(() => resolve());
      setTimeout(resolve, 1500);
    });

  const start = async () => {
    await stop();
    const c = config();
    save(c);
    error = undefined;
    const s = http.createServer(handler(c.key));
    await new Promise<void>((resolve) => {
      s.once("error", (e: NodeJS.ErrnoException) => {
        error = e.code === "EADDRINUSE" ? `Port ${c.port} is in use by another program.` : e.message;
        resolve();
      });
      s.listen(c.port, "0.0.0.0", () => {
        server = s;
        const addr = s.address();
        boundPort = typeof addr === "object" && addr ? addr.port : c.port;
        resolve();
      });
    });
    await refreshHttps();
  };

  const status = async (): Promise<MobileStatus> => {
    const c = config();
    if (c.enabled) await refreshHttps();
    const secure = c.enabled && https.state === "serving" && https.dnsName ? [`https://${https.dnsName}/?k=${c.key}`] : [];
    return { enabled: c.enabled, running: !!server, port: port(), urls: c.enabled ? [...secure, ...lanAddresses().map((ip) => `http://${ip}:${port()}/?k=${c.key}`)] : [], error, https, pushDevices: pushDevices(app).length };
  };

  return {
    status,
    /** Starts listening if it was left on. */
    async resume() {
      if (config().enabled) await start();
    },
    async setEnabled(on: boolean) {
      const c = config();
      save({ ...c, enabled: on });
      if (on) await start();
      else await stop();
      return status();
    },
    /** A new key: old QR codes, open phone pages and phone notifications stop working. */
    async rotate() {
      const c = config();
      save({ ...c, key: newKey() });
      clearPushDevices(app);
      if (c.enabled) await start();
      return status();
    },
    /** Puts the phone page on this PC's Tailscale HTTPS address. */
    async useTailscale() {
      if (!config().enabled) throw new Error("Turn the phone page on first.");
      https = await tailscaleServe(port());
      return status();
    },
    close: stop,
  };
}

const LOGO = `<svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="fcg" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#c4b5fd"/><stop offset="0.45" stop-color="#8b5cf6"/><stop offset="1" stop-color="#4f46e5"/></linearGradient></defs><path d="M9.5 2.5h17.2c.9 0 1.4 1 .9 1.7l-3.6 5.1c-.4.5-1 .8-1.6.8h-7.2l-1.9 4.6h8.2c.9 0 1.4 1 .8 1.7L9.6 29.3c-.8.9-2.2.1-1.8-1l2.9-8.4H6.3c-.7 0-1.2-.7-1-1.3L7.6 4c.3-.9 1-1.5 1.9-1.5Z" fill="url(#fcg)"/></svg>`;
const ICON = `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(LOGO.replace('width="28" height="28" ', ""))}">`;
const BRAND = `<div class="brand">${LOGO}<span class="brand__name">FlowCode <em>AI</em></span></div>`;

/** The installed app opens on the page with its key; the key is the only way in, so it travels in the start URL. */
const manifest = (key: string) =>
  JSON.stringify({
    name: "FlowCode",
    short_name: "FlowCode",
    description: "Approvals and blocked builds from FlowCode on your computer",
    start_url: `/?k=${key}`,
    scope: "/",
    display: "standalone",
    background_color: "#0f131c",
    theme_color: "#0f131c",
    icons: [{ src: `/icon.png?k=${key}`, sizes: "512x512", type: "image/png", purpose: "any maskable" }],
  });

/** Shows FlowCode's pushes and opens the page (with its key) when one is tapped. */
const SERVICE_WORKER = `self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
const key = new URL(self.location.href).searchParams.get("k") || "";
self.addEventListener("push", (e) => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch (err) { m = { title: "FlowCode", body: e.data ? e.data.text() : "" }; }
  const path = m.path || "/";
  const url = "/?k=" + encodeURIComponent(key) + (path.startsWith("/#") ? path.slice(1) : "");
  e.waitUntil(self.registration.showNotification(m.title || "FlowCode", { body: m.body || "", tag: m.tag || "flowcode", renotify: true, icon: "/icon.png?k=" + encodeURIComponent(key), badge: "/icon.png?k=" + encodeURIComponent(key), data: { url } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/?k=" + encodeURIComponent(key);
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ("focus" in c) { c.navigate(url).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
`;

const PAGE_LOCKED = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FlowCode</title>${ICON}
<style>.brand{display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:12px}.brand__name{font-weight:700;font-size:18px;color:#e8ebf2}.brand__name em{font-style:italic;font-weight:800;color:#a78bfa}body{margin:0;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;background:#0f131c;color:#e8ebf2;display:grid;place-items:center;min-height:100vh;padding:24px;box-sizing:border-box;text-align:center}p{max-width:30ch;color:#b9c0cd}</style></head>
<body><main>${BRAND}<h1 style="font-size:20px">This link has expired</h1><p>Open FlowCode on your computer, go to Settings → Phone and scan the QR code again.</p></main></body></html>`;

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0f131c">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="FlowCode">
<title>FlowCode</title>${ICON}
<script>(() => { const k = encodeURIComponent(new URLSearchParams(location.search).get("k") || ""); for (const [rel, href] of [["manifest", "/manifest.webmanifest?k=" + k], ["apple-touch-icon", "/icon.png?k=" + k]]) { const l = document.createElement("link"); l.rel = rel; l.href = href; document.head.appendChild(l); } })();</script>
<style>
:root{--bg:#0f131c;--card:#171d29;--line:#2a3243;--text:#e8ebf2;--muted:#b9c0cd;--accent:#7c5cff;--ok:#2fc4b2;--bad:#f87171;--wait:#a78bfa}
*{box-sizing:border-box}
[hidden]{display:none!important}
body{margin:0;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--bg);color:var(--text);padding:calc(16px + env(safe-area-inset-top)) 16px calc(24px + env(safe-area-inset-bottom))}
header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:8px;margin-bottom:4px}
.brand__name{font-weight:700;font-size:17px;letter-spacing:-.01em}
.brand__name em{font-style:italic;font-weight:800;color:#a78bfa}
.build{font-size:13px;color:var(--text);font-weight:600;margin:0;overflow-wrap:anywhere}
.build span{color:var(--muted);font-weight:500}
h1{font-size:20px;margin:0}
h2{font-size:15px;margin:24px 0 10px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em}
.state{font-size:13px;color:var(--muted)}
.state b{color:var(--ok);font-weight:600}
.state.off b{color:var(--bad)}
.tools{display:flex;gap:8px;flex-wrap:wrap}
button{font:inherit;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--text);min-height:44px;padding:0 16px;cursor:pointer}
button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
button:disabled{opacity:.6}
.small{font-size:14px;min-height:36px}
.hint{font-size:13px;color:var(--muted);margin:0 0 8px}
ul{list-style:none;margin:0;padding:0;display:grid;gap:12px}
li{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;display:grid;gap:8px}
.meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;color:var(--muted)}
.risk{font-size:12px;font-weight:700;padding:2px 8px;border-radius:4px;background:var(--wait);color:#1c0f33;text-transform:uppercase;letter-spacing:.04em}
.risk.high,.risk.stop{background:var(--bad);color:#2a0707}
.action{font-weight:600;overflow-wrap:anywhere}
.foryou{font-size:15px;line-height:1.45;margin:0 0 6px}
.reason{color:var(--muted);font-size:14px;margin:0;overflow-wrap:anywhere}
.files{font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;color:var(--muted);overflow-wrap:anywhere;margin:0}
.row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px}
.head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.ghost{background:transparent}
.x{margin-left:auto;min-height:36px;min-width:36px;padding:0;border-color:transparent;background:transparent;color:var(--muted);font-size:15px;line-height:1}
.x:hover{color:var(--text);border-color:var(--line)}
li.gone{display:flex;align-items:center;justify-content:space-between;padding:10px 16px}
.allow,.primary{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}
.deny{color:var(--bad);border-color:#5a2a2a}
.why{display:grid;gap:8px;border-top:1px solid var(--line);padding-top:10px;font-size:14px}
.why p{margin:0;overflow-wrap:anywhere}
.why .cause{color:var(--muted)}
.fix{display:grid;gap:6px;padding:10px;border:1px solid var(--line);border-radius:8px}
.fix b{font-size:14px}
.install{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:0 0 12px;font-size:14px;display:grid;gap:6px}
.install p,.install ol{margin:0;color:var(--muted)}
.install ol{padding-left:20px;display:grid;gap:4px}
.install i{font-style:normal;font-weight:600;color:var(--text)}
.install li{display:list-item;background:none;border:0;border-radius:0;padding:0}
.empty{text-align:center;color:var(--muted);padding:20px 16px;font-size:14px;margin:0}
.done{font-size:14px;color:var(--ok);margin:0}
.err{color:var(--bad);font-size:14px;margin:0}
</style></head><body>
<header><div>${BRAND}<div class="state" id="state" role="status" aria-live="polite">Checking…</div></div><div class="tools"><button class="small primary" id="install" type="button" hidden>Download the app</button><button class="small" id="notify" type="button" hidden>Turn on notifications</button><button class="small" id="sound" type="button">Sound on</button></div></header>
<div class="install" id="installHelp" hidden role="region" aria-label="How to install FlowCode on this phone"></div>
<p class="hint" id="pushHint" hidden></p>
<main>
<h2 id="approvals">Needs your OK</h2><ul id="list" aria-labelledby="approvals"></ul><p class="empty" id="empty" hidden>Nothing is waiting for your OK.</p>
<div class="head"><h2 id="blocked">Blocked builds</h2><button class="small ghost" type="button" id="dismissAll" hidden>Dismiss all</button></div><ul id="blockedList" aria-labelledby="blocked"></ul><p class="empty" id="blockedEmpty" hidden>No build is blocked.</p>
</main>
<script>
(() => {
  const key = new URLSearchParams(location.search).get("k") || "";
  const $ = (id) => document.getElementById(id);
  let known = new Set(), first = true, alerts = false, ctx;
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const chime = () => {
    try { navigator.vibrate && navigator.vibrate([180, 80, 180]); } catch {}
    if (!alerts || !ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 880; g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.45);
  };
  $("sound").onclick = () => { alerts = !alerts; if (alerts && !ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); $("sound").textContent = alerts ? "Sound off" : "Sound on"; if (alerts) chime(); };
  const api = (path, opts = {}) => fetch(path, { ...opts, headers: { "x-flowcode-key": key, "content-type": "application/json" } }).then(async (r) => { const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(b.error || "Couldn't reach FlowCode"); return b; });

  // Notifications: only on HTTPS (the Tailscale address), and on iPhone only once the page is added to the Home Screen.
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const b64 = (s) => { const p = "=".repeat((4 - (s.length % 4)) % 4); const raw = atob((s + p).split("-").join("+").split("_").join("/")); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); };
  const hint = (text) => { $("pushHint").hidden = !text; $("pushHint").textContent = text || ""; };
  const setupPush = async () => {
    if (!window.isSecureContext) { hint("Notifications need the secure (https) link. In FlowCode on your computer, turn on HTTPS with Tailscale and scan the new QR code."); return; }
    if (!("serviceWorker" in navigator)) { hint("This browser can't show notifications from web pages."); return; }
    let reg;
    try { reg = await navigator.serviceWorker.register("/sw.js?k=" + encodeURIComponent(key), { scope: "/" }); }
    catch { hint("This browser didn't allow notifications here. Open the secure link in Safari (iPhone) or Chrome (Android), add it to your Home Screen, and try again."); return; }
    if (!("PushManager" in window) || !("Notification" in window)) { hint(ios && !standalone ? "To get notifications on iPhone: tap Share, then Add to Home Screen, and open FlowCode from there." : "This browser can't receive notifications."); return; }
    const existing = await reg.pushManager.getSubscription();
    const btn = $("notify");
    btn.hidden = false;
    const on = existing && Notification.permission === "granted";
    btn.textContent = on ? "Notifications on" : "Turn on notifications";
    btn.disabled = !!on;
    if (on) api("/api/push/subscribe", { method: "POST", body: JSON.stringify(existing) }).catch(() => {});
    btn.onclick = async () => {
      btn.disabled = true;
      try {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") throw new Error("Notifications are blocked for this page. Allow them in the browser's settings.");
        const { key: pub } = await api("/api/push/key");
        const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(pub) }));
        await api("/api/push/subscribe", { method: "POST", body: JSON.stringify(sub) });
        btn.textContent = "Notifications on"; hint("You'll get a notification when a build is blocked or needs your OK, even with this closed.");
      } catch (e) { btn.disabled = false; hint(e.message); }
    };
  };
  setupPush().catch((e) => hint(e.message));

  // Download the app: Android/Chrome's install prompt; iPhone has none, so the button shows the Home Screen steps.
  let installEvent = null;
  const install = $("install"), help = $("installHelp");
  const showHelp = (html) => { help.innerHTML = html; help.hidden = false; };
  if (!standalone) install.hidden = false;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvent = e; install.hidden = false; });
  window.addEventListener("appinstalled", () => { install.hidden = true; help.hidden = true; });
  install.onclick = async () => {
    if (!help.hidden) { help.hidden = true; return; }
    if (installEvent) {
      installEvent.prompt();
      const choice = await installEvent.userChoice.catch(() => ({ outcome: "dismissed" }));
      installEvent = null;
      if (choice.outcome === "accepted") install.hidden = true;
      return;
    }
    if (!window.isSecureContext) return showHelp("<b>Installing needs the secure link.</b><p>In FlowCode on your computer, open Settings → Phone, choose <i>Use HTTPS with Tailscale</i> and scan the new QR code. Then tap Download the app again.</p>");
    if (ios) return showHelp("<b>Add FlowCode to your Home Screen</b><ol><li>Tap the Share button <span aria-hidden=\\"true\\">⬆︎</span> in Safari's toolbar.</li><li>Scroll down and tap <i>Add to Home Screen</i>, then <i>Add</i>.</li><li>Open FlowCode from your Home Screen and tap <i>Turn on notifications</i>.</li></ol>");
    showHelp("<b>Install FlowCode</b><ol><li>Open your browser's menu (⋮).</li><li>Tap <i>Install app</i> or <i>Add to Home screen</i>.</li><li>Open FlowCode from your Home Screen and tap <i>Turn on notifications</i>.</li></ol>");
  };

  const renderApprovals = (items) => {
    $("empty").hidden = items.length > 0;
    $("list").innerHTML = items.map((a) => '<li data-id="' + esc(a.id) + '"><div class="meta"><span class="risk ' + (a.risk === "high" ? "high" : "") + '">' + esc(a.risk) + ' risk</span><span>' + esc(a.project) + '</span></div>' + (a.build ? '<p class="build"><span>Build:</span> ' + esc(a.build) + '</p>' : "") + (a.forYou ? '<p class="foryou">' + esc(a.forYou) + '</p>' : "") + '<div class="action">' + esc(a.action) + '</div><p class="reason">' + esc(a.reason) + '</p>' + (a.affected.length ? '<p class="files">' + a.affected.map(esc).join("<br>") + '</p>' : "") + '<div class="row"><button class="deny" type="button" data-d="deny">Deny</button><button class="allow" type="button" data-d="once">Allow once</button></div></li>').join("");
  };
  let blockedKey = "";
  let undoUntil = 0; // keep a "Dismissed. Undo" row on screen this long before the list redraws
  const renderBlocked = (items) => {
    if (Date.now() < undoUntil) return;
    $("blockedEmpty").hidden = items.length > 0;
    $("dismissAll").hidden = items.length < 2;
    const k = items.map((b) => b.runId + b.taskId + b.reason).join("|");
    if (k === blockedKey) return; // keep an open explanation in place between checks
    blockedKey = k;
    $("blockedList").innerHTML = items.map((b) => '<li data-run="' + esc(b.runId) + '"><div class="meta"><span class="risk stop">Blocked</span><span>' + esc(b.project) + '</span><button class="x" type="button" data-dismiss aria-label="Dismiss this blocked build" title="Dismiss">✕</button></div>' + (b.build ? '<p class="build"><span>Build:</span> ' + esc(b.build) + '</p>' : "") + (b.step ? '<div class="action">' + esc(b.step) + '</div>' : "") + (b.reason ? '<p class="reason">' + esc(b.reason) + '</p>' : "") + '<div class="row"><button type="button" data-why>Why it stopped</button><button type="button" data-retry>Retry</button></div><div class="why" hidden></div></li>').join("");
  };
  const poll = async () => {
    try {
      const { approvals, blocked } = await api("/api/approvals");
      const fresh = approvals.filter((a) => !known.has(a.id));
      if (!first && fresh.length) chime();
      known = new Set(approvals.map((a) => a.id)); first = false;
      renderApprovals(approvals); renderBlocked(blocked || []);
      document.title = approvals.length ? "(" + approvals.length + ") FlowCode" : "FlowCode";
      $("state").className = "state"; $("state").innerHTML = "<b>Connected</b> · checked " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
    } catch (e) {
      $("state").className = "state off"; $("state").innerHTML = "<b>Not connected</b> · " + esc(e.message);
    }
  };
  $("list").addEventListener("click", async (ev) => {
    const btn = ev.target.closest("button[data-d]"); if (!btn) return;
    const li = btn.closest("li"); const id = li.dataset.id; const d = btn.dataset.d;
    li.querySelectorAll("button").forEach((b) => (b.disabled = true));
    try { await api("/api/approvals/" + encodeURIComponent(id), { method: "POST", body: JSON.stringify({ decision: d }) }); li.innerHTML = '<p class="done">' + (d === "deny" ? "Denied." : "Allowed.") + " FlowCode carries on.</p>"; known.delete(id); setTimeout(poll, 1200); }
    catch (e) { li.insertAdjacentHTML("beforeend", '<p class="err">' + esc(e.message) + '</p>'); li.querySelectorAll("button").forEach((b) => (b.disabled = false)); }
  });
  const retry = async (li, guidance, btn) => {
    li.querySelectorAll("button").forEach((b) => (b.disabled = true));
    try { await api("/api/blocked/" + encodeURIComponent(li.dataset.run) + "/retry", { method: "POST", body: JSON.stringify({ guidance }) }); li.innerHTML = '<p class="done">Retrying' + (guidance ? " with that fix" : "") + '. FlowCode carries on.</p>'; blockedKey = ""; setTimeout(poll, 2000); }
    catch (e) { li.insertAdjacentHTML("beforeend", '<p class="err">' + esc(e.message) + '</p>'); li.querySelectorAll("button").forEach((b) => (b.disabled = false)); }
  };
  const dismiss = async (run, li) => {
    try {
      await api("/api/blocked/" + encodeURIComponent(run) + "/dismiss", { method: "POST", body: "{}" });
      blockedKey = "";
      if (li) { li.className = "gone"; li.innerHTML = '<p class="done">Dismissed.</p><button class="small ghost" type="button" data-undo="' + esc(run) + '">Undo</button>'; undoUntil = Date.now() + 6000; setTimeout(poll, 6100); }
      else poll();
    } catch (e) { (li || $("blockedList")).insertAdjacentHTML("beforeend", '<p class="err">' + esc(e.message) + '</p>'); }
  };
  $("dismissAll").addEventListener("click", () => dismiss("all"));
  $("blockedList").addEventListener("click", async (ev) => {
    const undo = ev.target.closest("button[data-undo]");
    if (undo) { undo.disabled = true; undoUntil = 0; try { await api("/api/blocked/" + encodeURIComponent(undo.dataset.undo) + "/restore", { method: "POST", body: "{}" }); } catch {} blockedKey = ""; return poll(); }
    const li = ev.target.closest("li"); if (!li) return;
    if (ev.target.closest("button[data-dismiss]")) return dismiss(li.dataset.run, li);
    if (ev.target.closest("button[data-retry]")) return retry(li, "");
    const fix = ev.target.closest("button[data-fix]");
    if (fix) return retry(li, li._fixes[Number(fix.dataset.fix)].text);
    const why = ev.target.closest("button[data-why]"); if (!why) return;
    const box = li.querySelector(".why"); box.hidden = false; why.disabled = true;
    box.innerHTML = "<p>Looking into it… this can take a minute.</p>";
    try {
      const d = await api("/api/blocked/" + encodeURIComponent(li.dataset.run) + "/explain", { method: "POST", body: "{}" });
      li._fixes = d.fixes || [];
      box.innerHTML = '<p>' + esc(d.explanation || d.summary) + '</p>' + (d.causes || []).map((c) => '<p class="cause"><b>' + esc(c.title) + '</b> ' + esc(c.evidence) + '</p>').join("") + li._fixes.map((f, i) => '<div class="fix"><b>' + esc(f.label) + '</b><span class="reason">' + esc(f.detail) + '</span><button class="primary" type="button" data-fix="' + i + '">Retry with this fix</button></div>').join("");
    } catch (e) { box.innerHTML = '<p class="err">' + esc(e.message) + '</p>'; why.disabled = false; }
  });
  poll(); setInterval(poll, 5000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(); });
})();
</script></body></html>`;
