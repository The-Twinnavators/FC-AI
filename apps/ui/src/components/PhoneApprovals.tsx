/**
 * Settings → Phone: turn on the phone page and scan its QR code. The page lists what FlowCode is waiting for (Allow
 * once / Deny) and blocked builds with why they stopped and "Retry with this fix". With HTTPS through Tailscale it also
 * installs as an app and sends notifications when a build is blocked or needs your OK, even with the page closed.
 */
import { useMemo, useState } from "react";
import qrcode from "qrcode-generator";
import { Bell, Copy, Lock, RefreshCw, Smartphone } from "lucide-react";
import { post, useResource } from "../api";

interface Status {
  enabled: boolean;
  running: boolean;
  port: number;
  urls: string[];
  error?: string;
  https: { state: "missing" | "stopped" | "ready" | "serving"; dnsName?: string; detail?: string };
  pushDevices: number;
}

/** The QR code as an SVG, drawn locally (nothing is sent anywhere). */
function Qr({ text }: { text: string }) {
  const svg = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 6, margin: 3, scalable: true });
  }, [text]);
  // Local, generated markup (only the link's characters go into the code).
  return <div className="phone-qr" role="img" aria-label="QR code that opens FlowCode's phone page" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** HTTPS through Tailscale: what's needed next, in plain steps. */
function SecureLink({ status, busy, onUse }: { status: Status; busy: boolean; onUse: () => void }) {
  const h = status.https;
  return (
    <div className="phone__https">
      <p className="phone__https-title">
        <Lock size={14} aria-hidden="true" /> <strong>Notifications on your phone</strong>
      </p>
      {h.state === "serving" ? (
        <p>
          Secure link ready at <span className="mono">https://{h.dnsName}</span>. Scan the code, add the page to your Home Screen (iPhone: Share → Add to Home Screen), open it from there and tap &ldquo;Turn on notifications&rdquo;.
          {status.pushDevices ? ` ${status.pushDevices} phone${status.pushDevices === 1 ? " has" : "s have"} notifications on.` : ""}
        </p>
      ) : h.state === "ready" ? (
        <>
          <p>Tailscale is running on this computer. Put the phone page on your private Tailscale HTTPS address so it can send notifications. Only your own devices can reach it.</p>
          <button type="button" className="btn btn--sm btn--primary" disabled={busy} onClick={onUse} data-cp="phone-https">
            <Lock size={14} aria-hidden="true" /> Use HTTPS with Tailscale
          </button>
        </>
      ) : h.state === "stopped" ? (
        <p>Tailscale is installed but not connected{h.detail ? `: ${h.detail}` : "."} Open Tailscale on this computer and sign in, then come back here.</p>
      ) : (
        <p>
          Browsers only allow notifications from secure (https) pages. Install Tailscale (free) on this computer and on your phone, and sign in to both with the same account:{" "}
          <a href="https://tailscale.com/download" target="_blank" rel="noreferrer">tailscale.com/download</a>. Then come back here.
        </p>
      )}
      {h.detail && h.state !== "stopped" ? <p className="notice notice--bad" role="alert">{h.detail}</p> : null}
    </div>
  );
}

export function PhoneApprovals() {
  const { data, reload, error } = useResource<Status>("/mobile", []);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  const [which, setWhich] = useState(0);
  const act = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setMsg(undefined);
    try {
      await fn();
      reload();
      if (done) setMsg(done);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const url = data?.urls[which] ?? data?.urls[0];
  const secure = !!url?.startsWith("https://");
  return (
    <section className="section">
      <div className="section__head">
        <h2 className="section__title">Phone</h2>
      </div>
      <div className="section__body phone">
        <p className="phone__lede">
          Keep up with FlowCode from your phone. Scan the code to open a page with what FlowCode is waiting for (Allow once, Deny) and any blocked build, with why it stopped and &ldquo;Retry with this fix&rdquo;.
        </p>
        {error ? <p className="notice notice--bad" role="alert">{error}</p> : null}
        <label className="phone__switch">
          <input type="checkbox" data-cp="phone-enable" checked={!!data?.enabled} disabled={!data || busy} onChange={(e) => void act(() => post("/mobile", { enabled: e.target.checked }))} />
          <span>
            <strong>Allow my phone to follow FlowCode</strong>
            <span>Its private link can decide approvals and retry a blocked step. It can&apos;t start builds, read files or change settings.</span>
          </span>
        </label>
        {data?.enabled && data.error ? <p className="notice notice--bad" role="alert">{data.error}</p> : null}
        {data?.enabled && !data.error && !data.urls.length ? <p className="notice" role="status">This computer isn&apos;t on a Wi-Fi, home network or Tailscale right now, so a phone can&apos;t reach it.</p> : null}
        {data?.enabled ? <SecureLink status={data} busy={busy} onUse={() => void act(() => post("/mobile/https"))} /> : null}
        {data?.enabled && url ? (
          <div className="phone__pair">
            <Qr text={url} />
            <div className="phone__steps">
              <ol>
                {secure ? <li>Turn on Tailscale on your phone.</li> : <li>Connect your phone to the same Wi-Fi as this computer.</li>}
                <li>Open the camera and point it at the code, then tap the link.</li>
                {secure ? (
                  <li>Add the page to your Home Screen, open it from there and tap &ldquo;Turn on notifications&rdquo;.</li>
                ) : (
                  <li>Tap &ldquo;Sound on&rdquo; and keep the page open; it buzzes when FlowCode needs your OK.</li>
                )}
              </ol>
              {!secure ? (
                <p className="phone__note">
                  <Smartphone size={14} aria-hidden="true" /> If Windows asks whether to allow Node.js on private networks, choose Allow, or the phone can&apos;t connect.
                </p>
              ) : (
                <p className="phone__note">
                  <Bell size={14} aria-hidden="true" /> Notifications arrive with the page closed, wherever your phone has Tailscale on.
                </p>
              )}
              {data.urls.length > 1 ? (
                <label className="phone__addr">
                  <span>Address</span>
                  <select className="input" value={which} onChange={(e) => setWhich(Number(e.target.value))}>
                    {data.urls.map((u, i) => (
                      <option key={u} value={i}>
                        {u.startsWith("https://") ? `${new URL(u).hostname} (secure)` : new URL(u).hostname}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className="phone__actions">
                <button type="button" className="btn btn--sm" onClick={() => void navigator.clipboard?.writeText(url).then(() => setMsg("Link copied. Keep it private: anyone who can reach this computer with it can decide approvals and retry blocked steps."), () => setMsg("Couldn't copy. Select the link below instead."))}>
                  <Copy size={14} aria-hidden="true" /> Copy link
                </button>
                <button type="button" className="btn btn--sm btn--ghost" disabled={busy} onClick={() => void act(() => post("/mobile/rotate"), "New link made. Scan the code again; the old link and phone notifications no longer work.")}>
                  <RefreshCw size={14} aria-hidden="true" /> Make a new link
                </button>
              </div>
              <p className="phone__url mono">{url.replace(/k=.+$/, "k=••••••")}</p>
            </div>
          </div>
        ) : null}
        {msg ? <p className="phone__msg" role="status">{msg}</p> : null}
        <p className="phone__limits">The page only works while FlowCode is running on this computer. Without HTTPS, alerts only arrive while the page is open on your phone.</p>
      </div>
    </section>
  );
}
