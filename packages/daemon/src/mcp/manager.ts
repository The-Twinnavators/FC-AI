/**
 * MCP servers (Model Context Protocol) as extra agent tools. You add a server (a local program over stdio, or a hosted
 * one over HTTP), choose which agent roles may use it, and FlowCode connects to it when a step needs it. Its tools are
 * offered next to FlowCode's own, under names like `mcp_context7_get_library_docs`, and every call goes through the
 * same governance: logged, approved (once per project unless you said the server is trusted), time-limited, and its
 * output treated as untrusted data. Servers start with only a safe set of environment variables plus the ones you give
 * them, so FlowCode's own keys never reach them; keys you give a server are stored locally and never shown back.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import fs from "node:fs";
import path from "node:path";
import type { Store } from "../db/store.js";

export interface McpServerConfig {
  id: string;
  name: string;
  transport: "stdio" | "http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  enabled: boolean;
  /** Agent roles that may use this server's tools (coder, debugger, planner…). */
  roles: string[];
  /** "ask": the first call in a project needs your OK ("Allow for project" remembers it); "allow": trusted, no prompt. */
  approval: "ask" | "allow";
  /** Tools of this server you switched off. */
  disabledTools: string[];
  /** Where it came from: a FlowCode preset id, or "custom". */
  preset?: string;
  note?: string;
}

export interface McpToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpServerStatus {
  state: "off" | "connecting" | "ready" | "error";
  error?: string;
  tools: McpToolInfo[];
  checkedAt?: string;
}

/** Ready-made servers from the AgenticSkills MCP directory that help build prototypes (all free). */
export const MCP_PRESETS: Array<Omit<McpServerConfig, "enabled" | "disabledTools"> & { summary: string; needs?: string }> = [
  {
    id: "context7",
    name: "Context7",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@upstash/context7-mcp"],
    roles: ["coder", "debugger"],
    approval: "ask",
    preset: "context7",
    summary: "Current documentation for libraries (React, Vite, Testing Library…), so builders use today's APIs instead of guessing.",
    needs: "Node.js (installed). Uses the internet to fetch docs.",
  },
  {
    id: "markitdown",
    name: "MarkItDown",
    transport: "stdio",
    command: "uvx",
    args: ["markitdown-mcp"],
    roles: ["planner", "researcher", "coder"],
    approval: "ask",
    preset: "markitdown",
    summary: "Turns Word, PDF, PowerPoint and Excel files into clean Markdown that agents can read.",
    needs: "Python's uv (uvx). Install it from docs.astral.sh/uv, then Test again.",
  },
  {
    id: "playwright",
    name: "Playwright",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@playwright/mcp@latest", "--headless"],
    roles: ["critic", "debugger"],
    approval: "ask",
    preset: "playwright",
    summary: "Opens the running prototype in a browser and clicks through it like a person.",
    needs: "Node.js (installed). Downloads a browser the first time.",
  },
  {
    id: "figma",
    name: "Figma",
    transport: "http",
    url: "http://127.0.0.1:3845/mcp",
    roles: ["coder", "designer", "critic"],
    approval: "ask",
    preset: "figma",
    summary: "Builds screens from your Figma frames: their layout, spacing and text, the file's variables as tokens, and a screenshot to compare against. Put Figma links in the PRD or request.",
    needs: "The Figma desktop app on a plan with Dev Mode: open Figma, turn on the Dev Mode MCP server in Preferences, keep Figma open while building.",
  },
  {
    id: "github",
    name: "GitHub",
    transport: "http",
    url: "https://api.githubcopilot.com/mcp/",
    headers: { Authorization: "Bearer " },
    roles: ["documenter"],
    approval: "ask",
    preset: "github",
    summary: "Repositories, issues and pull requests: push a finished build or file issues.",
    needs: "A GitHub personal access token: paste it after \"Bearer \" in the Authorization header.",
  },
];

const SETTING = "mcp.servers";
const CONNECT_MS = 45_000;
/** npx and uvx download the server the first time it starts, which can take a minute or two. */
const FIRST_START_MS = 150_000;
const CALL_MS = 90_000;
/** Most MCP tools one step is offered: a local model loses track with dozens of tools. */
export const MAX_MCP_TOOLS_PER_STEP = 6;
const MASK = "••••";

/** A tool name the model can call: letters, digits and underscores, at most 64 characters. */
export function mcpToolName(serverId: string, tool: string): string {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `mcp_${clean(serverId)}_${clean(tool)}`.slice(0, 64);
}

/** A secret shown as its last four characters only. */
const maskValue = (v: string) => (v.length <= 8 ? MASK : `${MASK}${v.slice(-4)}`);
const looksSecret = (k: string, v: string) => /key|token|secret|password|auth|bearer|cookie/i.test(k) || /^Bearer\s+\S{8,}/.test(v);

/** A server as the UI sees it: keys masked. */
export function publicServer(s: McpServerConfig): McpServerConfig {
  const mask = (rec?: Record<string, string>) => (rec ? Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, looksSecret(k, v) && v.trim() && v.trim() !== "Bearer" ? (/^Bearer\s/.test(v) ? `Bearer ${maskValue(v.slice(7))}` : maskValue(v)) : v])) : rec);
  return { ...s, env: mask(s.env), headers: mask(s.headers) };
}

/** Keeps stored secrets when the UI sends a masked value back unchanged. */
function keepSecrets(next?: Record<string, string>, prev?: Record<string, string>): Record<string, string> | undefined {
  if (!next) return next;
  return Object.fromEntries(Object.entries(next).map(([k, v]) => [k, v.includes(MASK) && prev?.[k] !== undefined ? prev[k] : v]));
}

/** Reads servers from an mcp.json ({ "mcpServers": { name: { command, args, env } | { url, headers } } }). */
export function parseMcpJson(text: string): McpServerConfig[] {
  const data = JSON.parse(text) as { mcpServers?: Record<string, Record<string, unknown>>; servers?: Record<string, Record<string, unknown>> };
  const servers = data.mcpServers ?? data.servers ?? (data as Record<string, Record<string, unknown>>);
  const out: McpServerConfig[] = [];
  for (const [name, raw] of Object.entries(servers ?? {})) {
    if (!raw || typeof raw !== "object") continue;
    const strRec = (v: unknown) => (v && typeof v === "object" ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, String(x)])) : undefined);
    const url = typeof raw.url === "string" ? raw.url : typeof raw.serverUrl === "string" ? raw.serverUrl : undefined;
    if (!url && typeof raw.command !== "string") continue;
    out.push({
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "server",
      name,
      transport: url ? "http" : "stdio",
      command: url ? undefined : String(raw.command),
      args: Array.isArray(raw.args) ? raw.args.map(String) : [],
      env: strRec(raw.env),
      url,
      headers: strRec(raw.headers),
      enabled: false,
      roles: ["coder"],
      approval: "ask",
      disabledTools: [],
      preset: "custom",
    });
  }
  return out;
}

interface Live {
  client?: Client;
  /** The last lines the server printed to stderr, for a useful error. */
  stderr?: string;
  status: McpServerStatus;
  connecting?: Promise<void>;
}

export class McpManager {
  private live = new Map<string, Live>();
  constructor(private store: Store) {}

  list(): McpServerConfig[] {
    return this.store.getSetting<McpServerConfig[]>(SETTING, []);
  }
  get(id: string): McpServerConfig | undefined {
    return this.list().find((s) => s.id === id);
  }
  status(id: string): McpServerStatus {
    return this.live.get(id)?.status ?? { state: "off", tools: [] };
  }

  /** Adds or updates a server. Masked secrets sent back by the UI keep their stored value. */
  save(input: McpServerConfig): McpServerConfig {
    const all = this.list();
    const prev = all.find((s) => s.id === input.id);
    const id = (input.id || input.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "server";
    const next: McpServerConfig = {
      ...input,
      id,
      name: input.name.trim().slice(0, 80) || id,
      args: (input.args ?? []).map(String),
      env: keepSecrets(input.env, prev?.env),
      headers: keepSecrets(input.headers, prev?.headers),
      roles: [...new Set(input.roles ?? [])],
      disabledTools: [...new Set(input.disabledTools ?? [])],
    };
    if (next.transport === "stdio" && !next.command?.trim()) throw new Error("A local server needs a command (for example npx).");
    if (next.transport === "http" && !/^https?:\/\//.test(next.url ?? "")) throw new Error("A hosted server needs an http(s) URL.");
    this.store.setSetting(SETTING, [...all.filter((s) => s.id !== id), next]);
    // A changed command, URL or key takes effect on the next connection.
    if (prev && JSON.stringify({ ...prev, enabled: 0, roles: 0, approval: 0, disabledTools: 0 }) !== JSON.stringify({ ...next, enabled: 0, roles: 0, approval: 0, disabledTools: 0 })) void this.disconnect(id);
    if (!next.enabled) void this.disconnect(id);
    return next;
  }

  remove(id: string): void {
    void this.disconnect(id);
    this.store.setSetting(SETTING, this.list().filter((s) => s.id !== id));
  }

  async disconnect(id: string): Promise<void> {
    const l = this.live.get(id);
    this.live.delete(id);
    await l?.client?.close().catch(() => undefined);
  }

  async closeAll(): Promise<void> {
    await Promise.all([...this.live.keys()].map((id) => this.disconnect(id)));
  }

  /** Connects (once) and lists the server's tools. */
  async connect(id: string): Promise<McpServerStatus> {
    const cfg = this.get(id);
    if (!cfg) throw new Error(`No MCP server "${id}"`);
    const existing = this.live.get(id);
    if (existing?.status.state === "ready") return existing.status;
    if (existing?.connecting) {
      await existing.connecting;
      return this.status(id);
    }
    const l: Live = { status: { state: "connecting", tools: [] } };
    this.live.set(id, l);
    l.connecting = (async () => {
      const client = new Client({ name: "flowcode", version: "0.1.0" });
      const wait = cfg.transport === "stdio" && /^(npx|uvx|pnpm|bunx)(\.cmd|\.exe)?$/i.test(cfg.command ?? "") ? FIRST_START_MS : CONNECT_MS;
      try {
        await withTimeout(this.open(client, cfg, l), wait, `${cfg.name} didn't answer within ${wait / 1000} seconds${wait > CONNECT_MS ? " (the first start downloads it; try Test again)" : ""}`);
        const listed = await withTimeout(client.listTools(), CONNECT_MS, `${cfg.name} didn't list its tools in time`);
        l.client = client;
        l.status = {
          state: "ready",
          checkedAt: new Date().toISOString(),
          tools: listed.tools.map((t) => ({ name: t.name, description: (t.description ?? "").replace(/\s+/g, " ").trim().slice(0, 400), inputSchema: (t.inputSchema ?? { type: "object", properties: {} }) as Record<string, unknown> })),
        };
      } catch (err) {
        await client.close().catch(() => undefined);
        l.status = { state: "error", tools: [], error: explain(cfg, err as Error, l.stderr), checkedAt: new Date().toISOString() };
      } finally {
        l.connecting = undefined;
      }
    })();
    await l.connecting;
    return l.status;
  }

  private async open(client: Client, cfg: McpServerConfig, l: Live): Promise<void> {
    if (cfg.transport === "stdio") {
      const transport = new StdioClientTransport({ command: cfg.command!, args: cfg.args ?? [], env: { ...serverEnvironment(), ...(cfg.env ?? {}) }, stderr: "pipe" });
      transport.stderr?.on("data", (d: Buffer) => (l.stderr = ((l.stderr ?? "") + d.toString()).slice(-2000)));
      await client.connect(transport);
      return;
    }
    const url = new URL(cfg.url!);
    const requestInit = { headers: Object.fromEntries(Object.entries(cfg.headers ?? {}).filter(([, v]) => v.trim() && v.trim() !== "Bearer")) };
    try {
      await client.connect(new StreamableHTTPClientTransport(url, { requestInit }));
    } catch (err) {
      // Older hosted servers speak the SSE transport.
      if (/40[45]|405|not found|method not allowed/i.test((err as Error).message)) await client.connect(new SSEClientTransport(url, { requestInit }));
      else throw err;
    }
  }

  /** Calls one tool. Text results are joined; images and other content are described, not passed through. */
  async call(id: string, tool: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<{ ok: boolean; content: string }> {
    const st = await this.connect(id);
    if (st.state !== "ready") return { ok: false, content: `The ${this.get(id)?.name ?? id} MCP server isn't available: ${st.error ?? st.state}` };
    const client = this.live.get(id)!.client!;
    try {
      const res = await client.callTool({ name: tool, arguments: args }, undefined, { timeout: CALL_MS, signal });
      const parts = (res.content as Array<{ type: string; text?: string; mimeType?: string; resource?: { uri?: string; text?: string } }> | undefined) ?? [];
      const text = parts
        .map((p) => (p.type === "text" ? (p.text ?? "") : p.type === "resource" ? (p.resource?.text ?? `[resource ${p.resource?.uri ?? ""}]`) : `[${p.type}${p.mimeType ? ` ${p.mimeType}` : ""} not shown]`))
        .join("\n")
        .trim();
      return { ok: !res.isError, content: text || (res.isError ? "The tool reported an error without details." : "(no output)") };
    } catch (err) {
      // A dropped connection is reconnected on the next call.
      if (/closed|ECONNRESET|EPIPE|not connected/i.test((err as Error).message)) void this.disconnect(id);
      return { ok: false, content: `The MCP tool ${tool} failed: ${(err as Error).message.slice(0, 400)}` };
    }
  }

  /** Enabled servers this role may use. */
  forRole(role: string): McpServerConfig[] {
    return this.list().filter((s) => s.enabled && s.roles.includes(role));
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  let t: NodeJS.Timeout;
  return Promise.race([p, new Promise<T>((_, reject) => (t = setTimeout(() => reject(new Error(message)), ms)))]).finally(() => clearTimeout(t));
}

/**
 * What a local server starts with: the MCP library's safe defaults plus the system and network settings npx, uvx and
 * Node need (without NODE_EXTRA_CA_CERTS and the proxy settings, `npx -y` hung checking the npm registry). Nothing
 * that holds a FlowCode or provider key is passed on.
 */
const SYSTEM_ENV = ["PATHEXT", "COMSPEC", "PROGRAMFILES", "PROGRAMFILES(X86)", "PROGRAMDATA", "WINDIR", "OS", "NUMBER_OF_PROCESSORS", "ALLUSERSPROFILE", "PUBLIC", "COMMONPROGRAMFILES", "LOCALAPPDATA", "APPDATA", "TMP", "TEMP", "HOME", "LANG", "NODE_EXTRA_CA_CERTS", "NODE_USE_SYSTEM_CA", "SSL_CERT_FILE", "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "no_proxy"];
export function serverEnvironment(): Record<string, string> {
  const env: Record<string, string> = { ...getDefaultEnvironment() };
  for (const k of SYSTEM_ENV) if (process.env[k] !== undefined) env[k] = process.env[k]!;
  return env;
}

/** True when the command can be found (an absolute path, or on PATH with Windows' extensions). */
export function commandExists(cmd: string): boolean {
  if (path.isAbsolute(cmd)) return fs.existsSync(cmd);
  const exts = process.platform === "win32" ? ["", ...(process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";").map((e) => e.toLowerCase())] : [""];
  return (process.env.PATH ?? "").split(path.delimiter).some((dir) => dir && exts.some((e) => fs.existsSync(path.join(dir, cmd + e))));
}

/** A connection error in plain words, with what to do. */
function explain(cfg: McpServerConfig, err: Error, stderr?: string): string {
  const m = err.message;
  const printed = stderr?.trim().split(/\r?\n/).filter(Boolean).slice(-3).join(" ").slice(0, 300);
  if (cfg.transport === "stdio" && cfg.command && !commandExists(cfg.command)) return `"${cfg.command}" isn't installed on this computer.${cfg.preset === "markitdown" ? " Install Python's uv (docs.astral.sh/uv), then Test again." : ""}`;
  if (/connection closed/i.test(m) && printed) return `The server stopped while starting: ${printed}`;
  if (/ENOENT|not recognized|spawn .* ENOENT/i.test(m)) return `"${cfg.command}" isn't installed on this computer.${cfg.preset === "markitdown" ? " Install Python's uv (docs.astral.sh/uv), then Test again." : ""}`;
  if (/401|403|unauthori[sz]ed|forbidden/i.test(m)) return "The server refused the key. Check the token in the headers or environment.";
  if (cfg.preset === "figma" && /ECONNREFUSED|fetch failed|connect/i.test(m)) return "Figma isn't answering. Open the Figma desktop app, turn on the Dev Mode MCP server (Figma menu → Preferences), keep Figma open, then Test again.";
  if (/ENOTFOUND|EAI_AGAIN|fetch failed/i.test(m)) return "Couldn't reach the server. Check the URL and your internet connection.";
  return m.slice(0, 300);
}
