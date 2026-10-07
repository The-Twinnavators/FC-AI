/** File tree, read, and search within the path jail (FR-W3). Secret files are listed but never read. */
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { PathJail, PolicyError } from "../security/pathJail.js";
import { redact } from "../security/redaction.js";

export const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", ".turbo", ".cache", "coverage", "out", "__pycache__", ".venv", "venv", ".flowcode", "dist-electron", "test-results"]);
const MAX_READ_BYTES = 512 * 1024;

export interface TreeNode {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  secret?: boolean;
  children?: TreeNode[];
}

export function listTree(jail: PathJail, rel = ".", depth = 3, maxEntries = 3000): TreeNode {
  const { abs, rel: r } = rel === "." ? { abs: jail.root, rel: "." } : jail.resolve(rel, { mustExist: true });
  let count = 0;
  const walk = (dirAbs: string, dirRel: string, d: number): TreeNode[] => {
    if (d <= 0 || count > maxEntries) return [];
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirAbs, { withFileTypes: true });
    } catch {
      return [];
    }
    entries.sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1));
    const out: TreeNode[] = [];
    for (const e of entries) {
      if (count++ > maxEntries) break;
      const childRel = dirRel === "." ? e.name : `${dirRel}/${e.name}`;
      if (e.isSymbolicLink()) continue; // never follow links in listings
      if (e.isDirectory()) {
        if (IGNORED_DIRS.has(e.name)) {
          out.push({ name: e.name, path: childRel, type: "dir", children: [] });
          continue;
        }
        out.push({ name: e.name, path: childRel, type: "dir", children: walk(path.join(dirAbs, e.name), childRel, d - 1) });
      } else if (e.isFile()) {
        let size: number | undefined;
        try {
          size = fs.statSync(path.join(dirAbs, e.name)).size;
        } catch {
          /* ignore */
        }
        out.push({ name: e.name, path: childRel, type: "file", size, secret: jail.isSecretPath(childRel) || undefined });
      }
    }
    return out;
  };
  return { name: r === "." ? path.basename(jail.root) : path.basename(abs), path: r, type: "dir", children: walk(abs, r, depth) };
}

export function flattenFiles(jail: PathJail, maxFiles = 5000): string[] {
  const files: string[] = [];
  const walk = (dirAbs: string, dirRel: string) => {
    if (files.length >= maxFiles) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirAbs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const childRel = dirRel ? `${dirRel}/${e.name}` : e.name;
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) {
        if (!IGNORED_DIRS.has(e.name)) walk(path.join(dirAbs, e.name), childRel);
      } else if (e.isFile()) files.push(childRel);
      if (files.length >= maxFiles) return;
    }
  };
  walk(jail.root, "");
  return files;
}

/** Source files: shown exactly, apart from real key formats and quoted secrets (see redact's `code` mode). */
const CODE_FILE = /\.(tsx?|jsx?|mjs|cjs|css|scss|html|vue|svelte)$/i;

export function readFile(jail: PathJail, rel: string): { path: string; content: string; truncated: boolean; binary: boolean; size: number } {
  const { abs, rel: r } = jail.resolve(rel, { mustExist: true });
  const stat = fs.statSync(abs);
  if (!stat.isFile()) throw new PolicyError(`${r} is not a file`, "not_file");
  const fd = fs.openSync(abs, "r");
  const len = Math.min(stat.size, MAX_READ_BYTES);
  const buf = Buffer.alloc(len);
  fs.readSync(fd, buf, 0, len, 0);
  fs.closeSync(fd);
  const binary = buf.subarray(0, 8000).includes(0);
  return { path: r, content: binary ? "" : redact(buf.toString("utf8"), [], { code: CODE_FILE.test(r) }), truncated: stat.size > MAX_READ_BYTES, binary, size: stat.size };
}

export interface SearchHit {
  path: string;
  line: number;
  text: string;
}

export function searchWorkspace(jail: PathJail, query: string, opts: { glob?: string; maxHits?: number } = {}): SearchHit[] {
  const hits: SearchHit[] = [];
  const maxHits = opts.maxHits ?? 200;
  const q = query.toLowerCase();
  const inScope = searchScope(opts.glob);
  for (const rel of flattenFiles(jail)) {
    if (hits.length >= maxHits) break;
    if (jail.isSecretPath(rel)) continue;
    if (!inScope(rel)) continue;
    const abs = path.join(jail.root, rel);
    let content: string;
    try {
      const st = fs.statSync(abs);
      if (st.size > MAX_READ_BYTES) continue;
      const buf = fs.readFileSync(abs);
      if (buf.subarray(0, 8000).includes(0)) continue;
      content = buf.toString("utf8");
    } catch {
      continue;
    }
    if (!content.toLowerCase().includes(q)) continue;
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length && hits.length < maxHits; i++) {
      if (lines[i].toLowerCase().includes(q)) hits.push({ path: rel, line: i + 1, text: redact(lines[i].slice(0, 300), [], { code: CODE_FILE.test(rel) }) });
    }
  }
  return hits;
}

/**
 * Which files a search covers. A glob without wildcards is a folder or a file ("src/components/ui" searches everything
 * inside it); a glob without a slash ("*.tsx") matches file names at any depth, as ripgrep does. Calendar test 5: the
 * coder searched glob "src/components/ui" for AppShell, Button and Card, got "No matches" every time (a folder name
 * matched no file path), and concluded the building blocks didn't exist.
 */
export function searchScope(glob?: string): (rel: string) => boolean {
  const g = glob?.trim().replace(/\\/g, "/").replace(/^\.\//, "");
  if (!g || g === "." || g === "**" || g === "**/*") return () => true;
  if (!/[*?{[]/.test(g)) {
    const base = g.replace(/\/+$/, "");
    return (rel) => rel === base || rel.startsWith(`${base}/`);
  }
  const re = globToRegex(g);
  if (!g.includes("/")) return (rel) => re.test(rel.split("/").pop() ?? rel) || re.test(rel);
  return (rel) => re.test(rel);
}

export function globToRegex(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += ".*";
        i++;
        if (glob[i + 1] === "/") i++;
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else if (c === "{") {
      const end = glob.indexOf("}", i);
      re += `(${glob
        .slice(i + 1, end)
        .split(",")
        .map((s) => s.replace(/[.+^$()|[\]\\]/g, "\\$&"))
        .join("|")})`;
      i = end;
    } else re += c.replace(/[.+^$()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

/** Read-only git status (argv, shell:false, fixed args). */
export function gitStatus(jail: PathJail): Promise<{ available: boolean; branch?: string; changes: Array<{ status: string; path: string }> }> {
  return new Promise((resolve) => {
    if (!fs.existsSync(path.join(jail.root, ".git"))) return resolve({ available: false, changes: [] });
    execFile("git", ["status", "--porcelain=v1", "-b", "--untracked-files=all"], { cwd: jail.root, shell: false, timeout: 15000, maxBuffer: 4_000_000, env: { PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "", GIT_TERMINAL_PROMPT: "0" } }, (err, stdout) => {
      if (err) return resolve({ available: false, changes: [] });
      const lines = stdout.split(/\r?\n/).filter(Boolean);
      const branch = lines[0]?.startsWith("## ") ? lines.shift()!.slice(3) : undefined;
      resolve({ available: true, branch, changes: lines.map((l) => ({ status: l.slice(0, 2).trim(), path: l.slice(3) })) });
    });
  });
}
