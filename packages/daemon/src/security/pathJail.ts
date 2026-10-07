/**
 * Workspace path jail (FR-W2, §17.1). Every read/write path is canonicalized, resolved against the
 * workspace root, and rejected if it escapes the root lexically or via symlinks/junctions.
 */
import fs from "node:fs";
import path from "node:path";

export class PolicyError extends Error {
  readonly status = 403;
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

/** Default secret-file deny patterns, matched against the workspace-relative POSIX path. */
export const DEFAULT_SECRET_PATTERNS: RegExp[] = [
  /(^|\/)\.env(\..*)?$/i,
  /(^|\/)\.envrc$/i,
  /\.(pem|key|p12|pfx|jks|keystore|crt|cer|der|p8|ppk|asc|gpg)$/i,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i,
  /(^|\/)\.ssh\//i,
  /(^|\/)\.aws\/credentials$/i,
  /(^|\/)\.npmrc$/i,
  /(^|\/)\.pypirc$/i,
  /(^|\/)\.netrc$/i,
  /(^|\/)\.docker\/config\.json$/i,
  /(^|\/)credentials(\.json)?$/i,
  /(^|\/)secrets?(\.[a-z]+)?$/i,
  /(^|\/)service[-_]?account.*\.json$/i,
  /(^|\/)\.git-credentials$/i,
  /(^|\/)\.git\/(config|objects|refs|HEAD|index|hooks|info|modules|packed-refs)/i,
  /(^|\/)\.husky\//i,
  /(^|\/)\.git$/i,
];

const WIN_DEVICE = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³]|conin\$|conout\$)(\..*)?$/i;

export class PathJail {
  readonly root: string;
  private readonly secretPatterns: RegExp[];

  constructor(root: string, extraSecretPatterns: string[] = []) {
    const resolved = path.resolve(root);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      throw new PolicyError(`Workspace root is not a directory`, "workspace_missing");
    }
    this.root = fs.realpathSync.native(resolved);
    this.secretPatterns = [...DEFAULT_SECRET_PATTERNS, ...extraSecretPatterns.flatMap((p) => safeRegex(p))];
  }

  /** Converts an absolute path inside the root to a POSIX workspace-relative path. */
  relative(abs: string): string {
    const rel = path.relative(this.root, abs);
    return rel === "" ? "." : rel.split(path.sep).join("/");
  }

  isSecretPath(rel: string): boolean {
    const p = rel.replace(/\\/g, "/");
    return this.secretPatterns.some((re) => re.test(p));
  }

  /**
   * Resolves a workspace-relative path. Throws PolicyError on traversal, absolute paths, NUL bytes,
   * symlink escapes, or (unless allowSecret) secret files.
   */
  resolve(relPath: string, opts: { allowSecret?: boolean; mustExist?: boolean } = {}): { abs: string; rel: string } {
    if (typeof relPath !== "string" || relPath.length === 0) throw new PolicyError("Empty path", "path_invalid");
    if (relPath.includes("\0")) throw new PolicyError("NUL byte in path", "path_invalid");
    const normalizedInput = relPath.replace(/\\/g, "/");
    if (path.isAbsolute(relPath) || /^[a-zA-Z]:/.test(normalizedInput) || normalizedInput.startsWith("//")) {
      throw new PolicyError("Absolute paths are not allowed; use workspace-relative paths", "path_absolute");
    }
    // Reject Windows aliasing tricks on every platform (workspaces may be shared across OSes):
    // alternate data streams (`file:stream`), trailing dots/spaces (stripped by Win32) and device names.
    for (const seg of normalizedInput.split("/")) {
      if (seg.includes(":")) throw new PolicyError(`Invalid path segment (":" not allowed): ${relPath}`, "path_invalid");
      if (seg !== "." && seg !== ".." && /[. ]$/.test(seg)) throw new PolicyError(`Invalid path segment (trailing dot or space): ${relPath}`, "path_invalid");
      if (WIN_DEVICE.test(seg)) throw new PolicyError(`Reserved device name in path: ${relPath}`, "path_invalid");
      if (/[<>"|?*\x00-\x1f]/.test(seg)) throw new PolicyError(`Invalid character in path: ${relPath}`, "path_invalid");
    }
    const abs = path.resolve(this.root, normalizedInput);
    if (!isWithin(this.root, abs)) throw new PolicyError(`Path escapes workspace: ${relPath}`, "path_traversal");
    assertNoDanglingLinks(this.root, abs);

    // Symlink/junction check: canonicalize the deepest existing ancestor.
    const real = realpathOfExistingAncestor(abs);
    if (!isWithin(this.root, real.realAncestor)) throw new PolicyError(`Path resolves outside workspace via link: ${relPath}`, "symlink_escape");
    const finalAbs = real.rest ? path.join(real.realAncestor, real.rest) : real.realAncestor;
    if (!isWithin(this.root, finalAbs)) throw new PolicyError(`Path escapes workspace: ${relPath}`, "path_traversal");

    const rel = this.relative(finalAbs);
    if (!opts.allowSecret && this.isSecretPath(rel)) throw new PolicyError(`Access to secret-like file denied by policy: ${rel}`, "secret_denied");
    if (opts.mustExist && !fs.existsSync(finalAbs)) throw new PolicyError(`File not found: ${rel}`, "not_found");
    return { abs: finalAbs, rel };
  }
}

export function isWithin(root: string, candidate: string): boolean {
  const r = process.platform === "win32" ? root.toLowerCase() : root;
  const c = process.platform === "win32" ? candidate.toLowerCase() : candidate;
  if (c === r) return true;
  const withSep = r.endsWith(path.sep) ? r : r + path.sep;
  return c.startsWith(withSep);
}

/** A symlink whose target does not exist would be followed by a later write; reject it. */
function assertNoDanglingLinks(root: string, abs: string) {
  const rel = path.relative(root, abs);
  if (!rel) return;
  let cur = root;
  for (const seg of rel.split(path.sep)) {
    cur = path.join(cur, seg);
    let st: fs.Stats;
    try {
      st = fs.lstatSync(cur);
    } catch {
      return; // component does not exist: nothing further can be a link
    }
    if (st.isSymbolicLink()) {
      try {
        fs.realpathSync.native(cur);
      } catch {
        throw new PolicyError(`Path goes through a dangling symbolic link: ${path.relative(root, cur)}`, "symlink_escape");
      }
    }
  }
}

function realpathOfExistingAncestor(abs: string): { realAncestor: string; rest: string } {
  let current = abs;
  const rest: string[] = [];
  for (;;) {
    try {
      const real = fs.realpathSync.native(current);
      return { realAncestor: real, rest: rest.reverse().join(path.sep) };
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return { realAncestor: current, rest: rest.reverse().join(path.sep) };
      rest.push(path.basename(current));
      current = parent;
    }
  }
}

function safeRegex(p: string): RegExp[] {
  try {
    return [new RegExp(p, "i")];
  } catch {
    return [];
  }
}
