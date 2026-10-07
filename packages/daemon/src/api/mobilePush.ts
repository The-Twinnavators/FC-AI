/**
 * Phone notifications for the phone page: HTTPS through Tailscale, and Web Push.
 *  - Browsers only allow notifications, service workers and home-screen apps (PWA) on HTTPS. The phone page is plain
 *    HTTP on the Wi-Fi, so FlowCode offers Tailscale: `tailscale serve` gives it a real HTTPS address
 *    (https://<this-pc>.<tailnet>.ts.net) that only the user's own devices can reach.
 *  - Web Push: FlowCode keeps its own VAPID key pair and the phones' push subscriptions, and sends a notification
 *    through the phone browser's push service when a build is blocked or needs an OK, even with the page closed.
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import webpush from "web-push";
import type { App } from "../app.js";

const VAPID = "mobile:vapid";
const SUBS = "mobile:pushSubs";

export interface PushSubscriptionJson {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export function vapidKeys(app: App): { publicKey: string; privateKey: string } {
  let k = app.store.getSetting<{ publicKey: string; privateKey: string } | null>(VAPID, null);
  if (!k) {
    k = webpush.generateVAPIDKeys();
    app.store.setSetting(VAPID, k);
  }
  return k;
}

export const pushDevices = (app: App) => app.store.getSetting<PushSubscriptionJson[]>(SUBS, []);

export function addPushDevice(app: App, sub: PushSubscriptionJson) {
  if (!/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) throw Object.assign(new Error("That isn't a push subscription."), { status: 400 });
  const list = pushDevices(app).filter((s) => s.endpoint !== sub.endpoint);
  app.store.setSetting(SUBS, [...list, { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }].slice(-10));
}

export const removePushDevice = (app: App, endpoint: string) => app.store.setSetting(SUBS, pushDevices(app).filter((s) => s.endpoint !== endpoint));
export const clearPushDevices = (app: App) => app.store.setSetting(SUBS, []);

export interface PushMessage {
  title: string;
  body: string;
  /** Where a tap opens, relative to the phone page (the page adds its key). */
  path: string;
  tag: string;
}

/** Sends to every subscribed phone; a subscription the push service says is gone is dropped. */
export async function sendPush(app: App, msg: PushMessage, subject: string): Promise<number> {
  const { publicKey, privateKey } = vapidKeys(app);
  let sent = 0;
  for (const sub of pushDevices(app)) {
    try {
      await webpush.sendNotification(sub, JSON.stringify(msg), { vapidDetails: { subject, publicKey, privateKey }, TTL: 6 * 3600, urgency: "high" });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) removePushDevice(app, sub.endpoint);
    }
  }
  return sent;
}

/**
 * Notifies subscribed phones when a step is blocked or an approval is waiting. A step blocked again with the same
 * reason within ten minutes isn't sent twice.
 */
export function watchForPush(app: App, subject: () => string | undefined) {
  const recent = new Map<string, number>();
  const once = (key: string) => {
    const now = Date.now();
    for (const [k, t] of recent) if (now - t > 10 * 60_000) recent.delete(k);
    if (recent.has(key)) return false;
    recent.set(key, now);
    return true;
  };
  const projectName = (id?: string) => (id ? (app.store.projects.get(id)?.name ?? "A project") : "FlowCode");
  return app.bus.subscribe((e) => {
    if (!pushDevices(app).length) return;
    const sub = subject();
    if (!sub) return;
    if (e.type === "task.blocked" && e.runId && once(`${e.taskId}|${e.message}`)) {
      const m = /^Task blocked(?: by [^:]+)?: (.+?) — (.+)$/s.exec(e.message);
      const step = m?.[1] ?? "A step";
      const why = (m?.[2] ?? e.message).replace(/\s+/g, " ");
      void sendPush(app, { title: `Build blocked: ${projectName(e.projectId)}`, body: `${step}: ${why.length > 150 ? `${why.slice(0, 147)}…` : why}`, path: `/#blocked`, tag: `blocked-${e.runId}` }, sub);
    }
    if (e.type === "approval.requested" && once(`approval|${e.seq}`)) {
      void sendPush(app, { title: `FlowCode needs your OK: ${projectName(e.projectId)}`, body: e.message.replace(/^Approval needed[^:]*:\s*/, "").slice(0, 160), path: `/#approvals`, tag: `approval-${e.runId ?? e.seq}` }, sub);
    }
  });
}

// ───────────────────────── Tailscale ─────────────────────────

export interface TailscaleState {
  /** missing: not installed · stopped: installed but not signed in or not running · ready: running · serving: the phone page is on HTTPS. */
  state: "missing" | "stopped" | "ready" | "serving";
  /** This PC's name on the tailnet, e.g. desk.tail1234.ts.net. */
  dnsName?: string;
  detail?: string;
}

function tailscaleCli(): string | undefined {
  const places =
    process.platform === "win32"
      ? [path.join(process.env.ProgramFiles ?? "C:\\Program Files", "Tailscale", "tailscale.exe")]
      : process.platform === "darwin"
        ? ["/Applications/Tailscale.app/Contents/MacOS/Tailscale", "/opt/homebrew/bin/tailscale", "/usr/local/bin/tailscale"]
        : ["/usr/bin/tailscale", "/usr/local/bin/tailscale", "/usr/sbin/tailscale"];
  const found = places.find((p) => fs.existsSync(p));
  if (found) return found;
  const exe = process.platform === "win32" ? "tailscale.exe" : "tailscale";
  return (process.env.PATH ?? "").split(path.delimiter).map((d) => path.join(d, exe)).find((p) => fs.existsSync(p));
}

const run = (cli: string, args: string[], timeout = 15_000) =>
  new Promise<{ ok: boolean; out: string }>((resolve) =>
    execFile(cli, args, { timeout, windowsHide: true, encoding: "utf8" }, (err, stdout, stderr) => resolve({ ok: !err, out: `${stdout ?? ""}${stderr ?? ""}`.trim() })),
  );

export async function tailscaleState(port: number): Promise<TailscaleState> {
  const cli = tailscaleCli();
  if (!cli) return { state: "missing" };
  const st = await run(cli, ["status", "--json"]);
  let dnsName: string | undefined;
  let backend = "";
  try {
    const j = JSON.parse(st.out) as { BackendState?: string; Self?: { DNSName?: string } };
    backend = j.BackendState ?? "";
    dnsName = j.Self?.DNSName?.replace(/\.$/, "") || undefined;
  } catch {
    return { state: "stopped", detail: st.out.slice(0, 200) || "Tailscale isn't running." };
  }
  if (backend !== "Running" || !dnsName) return { state: "stopped", dnsName, detail: backend === "NeedsLogin" ? "Sign in to Tailscale on this PC." : `Tailscale is ${backend || "not running"}.` };
  const serve = await run(cli, ["serve", "status", "--json"]);
  const serving = serve.ok && new RegExp(`127\\.0\\.0\\.1:${port}|localhost:${port}`).test(serve.out);
  return { state: serving ? "serving" : "ready", dnsName };
}

/** Puts the phone page on this PC's Tailscale HTTPS address (tailnet only; not Funnel, so not the open internet). */
export async function tailscaleServe(port: number): Promise<TailscaleState> {
  const cli = tailscaleCli();
  if (!cli) return { state: "missing" };
  const r = await run(cli, ["serve", "--bg", "--https=443", `http://127.0.0.1:${port}`], 60_000);
  const after = await tailscaleState(port);
  if (after.state === "serving") return after;
  const hint = /HTTPS|certificate|cert/i.test(r.out) ? " Turn on HTTPS certificates for your tailnet in the Tailscale admin console (DNS → HTTPS Certificates), then try again." : "";
  return { ...after, detail: `${r.out.slice(0, 240)}${hint}`.trim() };
}
