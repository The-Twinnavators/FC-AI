/**
 * Web search settings: the local SearXNG address (with a live status check), safe search, and the site blocklist.
 * Dark-web sites are always blocked and can't be unblocked.
 */
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { get, post, useResource } from "../api";
import { Led } from "./ui";

interface WebSettings {
  searxUrl: string;
  blockDarkWeb: true;
  blocklist: string[];
  safeSearch: 0 | 1 | 2;
}

export function WebSearchSettings() {
  const { data, reload } = useResource<WebSettings>("/web/settings");
  const [url, setUrl] = useState("");
  const [safe, setSafe] = useState<0 | 1 | 2>(1);
  const [list, setList] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; url: string; error?: string }>();
  const [saved, setSaved] = useState<string>();
  useEffect(() => {
    if (!data) return;
    setUrl(data.searxUrl);
    setSafe(data.safeSearch);
    setList(data.blocklist.join("\n"));
  }, [data]);
  const check = () => get<{ ok: boolean; url: string; error?: string }>("/web/status").then(setStatus).catch((e) => setStatus({ ok: false, url, error: (e as Error).message }));
  useEffect(() => {
    void check();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    setSaved(undefined);
    await post("/web/settings", { searxUrl: url, safeSearch: safe, blocklist: list.split(/[\n,]+/).map((d) => d.trim()).filter(Boolean) });
    reload();
    await check();
    setSaved("Saved");
  };
  return (
    <section className="section">
      <div className="section__head">
        <h2 className="section__title">Web search</h2>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }} className="muted">
          <Led status={status?.ok ? "ok" : status ? "failed" : "idle"} /> {status ? (status.ok ? "SearXNG connected" : "Not reachable") : "Checking…"}
        </span>
      </div>
      <form className="section__body" style={{ display: "grid", gap: 14 }} onSubmit={(e) => (e.preventDefault(), void save())}>
        <div className="field">
          <label className="label" htmlFor="searx-url">
            SearXNG address
          </label>
          <input id="searx-url" data-cp="search-url" className="input mono" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://127.0.0.1:8888" />
          {status && !status.ok ? <span className="muted" style={{ fontSize: 12 }}>{status.error}. Start it with Docker: docker run -d -p 8888:8080 searxng/searxng (and enable the json format).</span> : null}
        </div>
        <div className="field">
          <label className="label" htmlFor="safe-search">
            Safe search
          </label>
          <select id="safe-search" className="select" value={safe} onChange={(e) => setSafe(Number(e.target.value) as 0 | 1 | 2)}>
            <option value={0}>Off</option>
            <option value={1}>Moderate</option>
            <option value={2}>Strict</option>
          </select>
        </div>
        <p className="web-safety" style={{ margin: 0 }}>
          <ShieldCheck size={14} aria-hidden="true" /> Dark-web sites (.onion, .i2p and gateways to them) are always blocked.
        </p>
        <div className="field">
          <label className="label" htmlFor="blocklist">
            Blocked sites (one domain per line; subdomains included)
          </label>
          <textarea id="blocklist" className="textarea mono" style={{ minHeight: 110, fontSize: 12 }} value={list} onChange={(e) => setList(e.target.value)} placeholder={"example-spam.com\nsomesite.net"} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn--primary">Save</button>
          <button type="button" className="btn" onClick={() => void check()}>
            Test connection
          </button>
          {saved ? <span role="status" className="muted">{saved}</span> : null}
        </div>
      </form>
    </section>
  );
}
