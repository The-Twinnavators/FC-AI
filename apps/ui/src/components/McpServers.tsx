/**
 * Prompts & Skills → Tools → Connected servers: MCP servers whose tools FlowCode's agents may use. Add one from the
 * presets, paste an mcp.json or fill in a command or URL; test it; choose the roles that get it and whether it asks
 * before its first call in a project. Keys are masked by the daemon and never shown back.
 */
import { useState } from "react";
import { Plug, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { post, useResource } from "../api";

interface ToolInfo {
  name: string;
  description: string;
}
interface Status {
  state: "off" | "connecting" | "ready" | "error";
  error?: string;
  tools: ToolInfo[];
  checkedAt?: string;
}
interface Server {
  id: string;
  name: string;
  transport: "stdio" | "http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  enabled: boolean;
  roles: string[];
  approval: "ask" | "allow";
  disabledTools: string[];
  preset?: string;
  status: Status;
}
interface Preset extends Omit<Server, "enabled" | "disabledTools" | "status"> {
  summary: string;
  needs?: string;
}
interface Data {
  servers: Server[];
  presets: Preset[];
  maxToolsPerStep: number;
}

const ROLES = ["planner", "coder", "debugger", "critic", "researcher", "documenter", "reviewer"];

const pairs = (rec?: Record<string, string>) =>
  Object.entries(rec ?? {})
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
const fromPairs = (text: string) => Object.fromEntries(text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));
/** Splits "npx -y @upstash/context7-mcp" into a command and its arguments (quotes keep spaces). */
const splitCommand = (line: string) => (line.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map((x) => x.replace(/^["']|["']$/g, ""));

export function McpServers() {
  const { data, reload } = useResource<Data>("/mcp/servers");
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<Server | "new">();
  const [importing, setImporting] = useState(false);
  const [open, setOpen] = useState<string>();
  const [confirmRemove, setConfirmRemove] = useState<string>();

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
      reload();
    }
  };
  const save = (s: Partial<Server> & { name: string; transport: Server["transport"] }) => post<{ server: Server }>("/mcp/servers", s);
  const test = (id: string) => run(`test:${id}`, () => post(`/mcp/servers/${encodeURIComponent(id)}/test`));
  const update = (s: Server, patch: Partial<Server>) => run(`save:${s.id}`, () => save({ ...s, ...patch }));

  if (!data) return null;
  const added = new Set(data.servers.map((s) => s.preset ?? s.id));
  const presets = data.presets.filter((p) => !added.has(p.preset ?? p.id));

  return (
    <section className="mcp" aria-labelledby="mcp-title">
      <header className="mcp__head">
        <div>
          <h3 id="mcp-title" className="mcp__title">
            <Plug size={16} aria-hidden="true" /> Connected servers <span className="mcp__badge">MCP</span>
          </h3>
          <p className="muted mcp__lede">
            Extra tools from Model Context Protocol servers. Agents get a server's tools only for the roles you pick, at most {data.maxToolsPerStep} per step. Every call is logged and its output treated as untrusted; a server asks before its first call in each project unless you trust it.
          </p>
        </div>
        <div className="mcp__actions">
          <button type="button" className="btn btn--sm" onClick={() => (setImporting((x) => !x), setEditing(undefined))}>
            <Upload size={14} aria-hidden="true" /> Import mcp.json
          </button>
          <button type="button" className="btn btn--sm btn--primary" data-cp="mcp-add" onClick={() => (setEditing("new"), setImporting(false))}>
            <Plus size={14} aria-hidden="true" /> Add server
          </button>
        </div>
      </header>

      {error ? (
        <p className="mcp__error" role="alert">
          {error}
        </p>
      ) : null}
      {importing ? <ImportForm onCancel={() => setImporting(false)} onDone={() => (setImporting(false), reload())} /> : null}
      {/* A new server's form opens above the cards; editing one happens inside its own card. */}
      {editing === "new" ? <ServerForm onCancel={() => setEditing(undefined)} onSaved={(id) => (setEditing(undefined), reload(), void test(id))} /> : null}

      {data.servers.length ? (
        <ul className="mcp__list" aria-label="Connected MCP servers">
          {data.servers.map((s) => {
            const st = s.status;
            const testing = busy === `test:${s.id}`;
            if (editing && editing !== "new" && editing.id === s.id)
              return (
                <li key={s.id} className="mcp-server mcp-server--editing" aria-label={`Editing ${s.name}`}>
                  <ServerForm server={editing} onCancel={() => setEditing(undefined)} onSaved={(id) => (setEditing(undefined), reload(), void test(id))} />
                </li>
              );
            return (
              <li key={s.id} className={`mcp-server${s.enabled ? "" : " is-off"}`}>
                <div className="mcp-server__top">
                  <label className="mcp-switch" title={s.enabled ? "On: agents in the chosen roles can use it" : "Off: no agent uses it"}>
                    <input type="checkbox" checked={s.enabled} onChange={(e) => update(s, { enabled: e.target.checked })} aria-label={`Use ${s.name}`} />
                    <span aria-hidden="true" />
                  </label>
                  <div className="mcp-server__name">
                    <strong>{s.name}</strong>
                    <span className="mono muted mcp-server__cmd">{s.transport === "http" ? s.url : [s.command, ...(s.args ?? [])].join(" ")}</span>
                  </div>
                  <span className={`chip ${st.state === "ready" ? "chip--ok" : st.state === "error" ? "chip--bad" : ""}`}>
                    {testing || st.state === "connecting" ? "Connecting…" : st.state === "ready" ? `Ready · ${st.tools.length} tool${st.tools.length === 1 ? "" : "s"}` : st.state === "error" ? "Not working" : "Not tested"}
                  </span>
                  <button type="button" className="btn btn--sm btn--ghost" onClick={() => test(s.id)} disabled={testing}>
                    <RefreshCw size={13} aria-hidden="true" /> Test
                  </button>
                  <button type="button" className="btn btn--sm btn--ghost" onClick={() => (setEditing(s), setImporting(false))}>
                    Edit
                  </button>
                  {confirmRemove === s.id ? (
                    <span className="mcp-server__confirm">
                      Remove {s.name}?
                      <button type="button" className="btn btn--sm btn--danger" onClick={() => (setConfirmRemove(undefined), run(`del:${s.id}`, () => post(`/mcp/servers/${encodeURIComponent(s.id)}/delete`)))}>
                        Remove
                      </button>
                      <button type="button" className="btn btn--sm btn--ghost" onClick={() => setConfirmRemove(undefined)}>
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button type="button" className="btn btn--sm btn--ghost mcp-server__remove" onClick={() => setConfirmRemove(s.id)} aria-label={`Remove ${s.name}`} title="Remove">
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  )}
                </div>
                {st.state === "error" && st.error ? <p className="mcp-server__err">{st.error}</p> : null}
                <div className="mcp-server__opts">
                  <fieldset className="mcp-roles">
                    <legend>Used by</legend>
                    {ROLES.map((r) => (
                      <label key={r} className={`mcp-role${s.roles.includes(r) ? " is-on" : ""}`}>
                        <input type="checkbox" checked={s.roles.includes(r)} onChange={(e) => update(s, { roles: e.target.checked ? [...s.roles, r] : s.roles.filter((x) => x !== r) })} />
                        {r}
                      </label>
                    ))}
                  </fieldset>
                  <label className="mcp-approval">
                    <span>Before a call</span>
                    <select className="select" value={s.approval} onChange={(e) => update(s, { approval: e.target.value as Server["approval"] })}>
                      <option value="ask">Ask once per project</option>
                      <option value="allow">Trusted: don't ask</option>
                    </select>
                  </label>
                  {st.tools.length ? (
                    <button type="button" className="btn btn--sm btn--ghost" aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? undefined : s.id)}>
                      {open === s.id ? "Hide tools" : `Choose tools (${st.tools.length - s.disabledTools.filter((t) => st.tools.some((x) => x.name === t)).length} on)`}
                    </button>
                  ) : null}
                </div>
                {open === s.id ? (
                  <ul className="mcp-tools" aria-label={`${s.name} tools`}>
                    {st.tools.map((t) => {
                      const on = !s.disabledTools.includes(t.name);
                      return (
                        <li key={t.name}>
                          <label>
                            <input type="checkbox" checked={on} onChange={(e) => update(s, { disabledTools: e.target.checked ? s.disabledTools.filter((x) => x !== t.name) : [...s.disabledTools, t.name] })} />
                            <span className="mono">{t.name}</span>
                            <span className="muted">{t.description}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted mcp__empty">No servers yet. Add one of the suggestions below, or your own.</p>
      )}

      {presets.length ? (
        <div className="mcp__presets">
          <p className="label">Suggested for building prototypes</p>
          <ul className="mcp-presets">
            {presets.map((p) => (
              <li key={p.id} className="mcp-preset">
                <div className="mcp-preset__body">
                  <strong>{p.name}</strong>
                  <span>{p.summary}</span>
                  {p.needs ? <span className="muted mcp-preset__needs">Needs: {p.needs}</span> : null}
                </div>
                <button
                  type="button"
                  className="btn btn--sm"
                  disabled={busy === `add:${p.id}`}
                  onClick={() =>
                    run(`add:${p.id}`, async () => {
                      const local = p.transport === "stdio" || /^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(p.url ?? "");
                      const { server } = await save({ ...p, enabled: local, disabledTools: [] });
                      // Shown straight away as "Connecting…"; the first start can take a minute while it downloads.
                      reload();
                      if (local) void test(server.id);
                    })
                  }
                >
                  {busy === `add:${p.id}` ? "Adding…" : "Add"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function ServerForm({ server, onCancel, onSaved }: { server?: Server; onCancel: () => void; onSaved: (id: string) => void }) {
  const [name, setName] = useState(server?.name ?? "");
  const [transport, setTransport] = useState<Server["transport"]>(server?.transport ?? "stdio");
  const [command, setCommand] = useState(server ? [server.command ?? "", ...(server.args ?? [])].join(" ").trim() : "");
  const [url, setUrl] = useState(server?.url ?? "");
  const [env, setEnv] = useState(pairs(server?.env));
  const [headers, setHeaders] = useState(pairs(server?.headers));
  const [err, setErr] = useState<string>();
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(undefined);
    const [cmd, ...args] = splitCommand(command);
    try {
      const { server: saved } = await post<{ server: Server }>("/mcp/servers", {
        ...(server ?? { enabled: true, roles: ["coder"], approval: "ask", disabledTools: [], preset: "custom" }),
        id: server?.id ?? "",
        name,
        transport,
        command: transport === "stdio" ? cmd : undefined,
        args: transport === "stdio" ? args : [],
        url: transport === "http" ? url : undefined,
        env: fromPairs(env),
        headers: transport === "http" ? fromPairs(headers) : undefined,
      });
      onSaved(saved.id);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <form className="mcp-form" onSubmit={submit}>
      <div className="mcp-form__row">
        <label className="field">
          <span className="field__label">Name</span>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Context7" />
        </label>
        <label className="field">
          <span className="field__label">Runs</span>
          <select className="select" value={transport} onChange={(e) => setTransport(e.target.value as Server["transport"])}>
            <option value="stdio">On this computer (command)</option>
            <option value="http">Hosted (URL)</option>
          </select>
        </label>
      </div>
      {transport === "stdio" ? (
        <label className="field">
          <span className="field__label">Command</span>
          <input className="input mono" required value={command} onChange={(e) => setCommand(e.target.value)} placeholder="npx -y @upstash/context7-mcp" />
        </label>
      ) : (
        <label className="field">
          <span className="field__label">URL</span>
          <input className="input mono" required type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://mcp.example.com/mcp" />
        </label>
      )}
      <div className="mcp-form__row">
        <label className="field">
          <span className="field__label">Environment variables (optional, one NAME=value per line)</span>
          <textarea className="input mono" rows={3} value={env} onChange={(e) => setEnv(e.target.value)} placeholder="API_KEY=…" />
        </label>
        {transport === "http" ? (
          <label className="field">
            <span className="field__label">Headers (optional, one Name=value per line)</span>
            <textarea className="input mono" rows={3} value={headers} onChange={(e) => setHeaders(e.target.value)} placeholder="Authorization=Bearer …" />
          </label>
        ) : null}
      </div>
      <p className="muted mcp-form__note">Keys are stored on this computer only and shown masked. A masked value left as it is keeps the saved key.</p>
      {err ? (
        <p className="mcp__error" role="alert">
          {err}
        </p>
      ) : null}
      <div className="mcp-form__actions">
        <button type="button" className="btn btn--sm btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn--sm btn--primary" disabled={saving}>
          {saving ? "Saving…" : server ? "Save and test" : "Add and test"}
        </button>
      </div>
    </form>
  );
}

function ImportForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const [json, setJson] = useState("");
  const [err, setErr] = useState<string>();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(undefined);
    try {
      await post("/mcp/import", { json });
      onDone();
    } catch (e2) {
      setErr((e2 as Error).message);
    }
  };
  return (
    <form className="mcp-form" onSubmit={submit}>
      <label className="field">
        <span className="field__label">Paste an mcp.json (from a server's docs or the AgenticSkills directory)</span>
        <textarea className="input mono" rows={6} required value={json} onChange={(e) => setJson(e.target.value)} placeholder={'{\n  "mcpServers": {\n    "context7": { "command": "npx", "args": ["-y", "@upstash/context7-mcp"] }\n  }\n}'} />
      </label>
      <p className="muted mcp-form__note">Imported servers start switched off, so nothing runs until you've checked them.</p>
      {err ? (
        <p className="mcp__error" role="alert">
          {err}
        </p>
      ) : null}
      <div className="mcp-form__actions">
        <button type="button" className="btn btn--sm btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn--sm btn--primary">
          Import
        </button>
      </div>
    </form>
  );
}
