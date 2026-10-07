/**
 * Secret redaction (PRD §17.2). Applied before persistence, UI events, model context, reports and exports.
 * A streaming redactor keeps a rolling buffer so secrets split across output chunks are still caught,
 * and a whole-record pass runs again before anything is stored.
 */

export const REDACTED = "[REDACTED]";

const SECRET_KEY = String.raw`(?:[A-Za-z0-9_.-]*?(?:secret|token|passwd|password|pwd|api[_-]?key|apikey|access[_-]?key|private[_-]?key|client[_-]?secret|auth|credential|session[_-]?key|signing[_-]?key)[A-Za-z0-9_.-]*)`;

interface Rule {
  name: string;
  re: RegExp;
  replace: (match: string, ...groups: string[]) => string;
}

const RULES: Rule[] = [
  {
    name: "private_key_block",
    re: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY-----|$)/g,
    replace: () => `-----BEGIN PRIVATE KEY-----${REDACTED}-----END PRIVATE KEY-----`,
  },
  {
    // The value must look like a credential (a digit or symbol in it, or 20+ characters), so ordinary words after
    // "Basic" or "Token" ("Basic Calendar App") are left alone.
    name: "bearer",
    re: /\b(Bearer|Basic|Token)\s+(?:(?=[A-Za-z]*[0-9._~+/=-])[A-Za-z0-9._~+/=-]{8,}|[A-Za-z0-9._~+/=-]{20,})/gi,
    replace: (_m, scheme) => `${scheme} ${REDACTED}`,
  },
  {
    name: "auth_header",
    re: /\b(authorization|x-api-key|api-key|cookie|set-cookie)(\s*[:=]\s*)("?)[^\r\n"]+\3/gi,
    replace: (_m, h, sep, q) => `${h}${sep}${q}${REDACTED}${q}`,
  },
  {
    name: "url_credentials",
    re: /\b([a-z][a-z0-9+.-]*:\/\/)([^\s/:@]+):([^\s/@]+)@/gi,
    replace: (_m, scheme, user) => `${scheme}${user}:${REDACTED}@`,
  },
  {
    name: "json_secret_field",
    re: new RegExp(String.raw`("${SECRET_KEY}"\s*:\s*)"(?:[^"\\]|\\.)*"`, "gi"),
    replace: (_m, prefix) => `${prefix}"${REDACTED}"`,
  },
  {
    // Quoted values may contain spaces, commas or semicolons: password="a b; c"
    name: "key_value_quoted",
    re: new RegExp(String.raw`(^|[\s;,{(]|export\s+)(${SECRET_KEY})(\s*[=:]\s*)(["'])((?:(?!\4)[^\r\n\\]|\\.){1,500})\4`, "gim"),
    replace: (_m, pre, key, sep, q) => `${pre}${key}${sep}${q}${REDACTED}${q}`,
  },
  {
    // Unquoted values after ":" that are TypeScript types or references are code, not secrets: `AuthScreen: React.FC`,
    // `password: string`, `password: password`. Redacting them showed the model "[REDACTED]" in its own source, and
    // every edit it copied from that failed (Calendar test 8 sign-in step).
    name: "key_value",
    re: new RegExp(String.raw`(^|[\s;,{(]|export\s+)(${SECRET_KEY})(\s*[=:]\s*)(["']?)([^\s"',;]{3,})\4`, "gim"),
    replace: (m, pre, key, sep, q, value) => (!q && sep.trim() === ":" && codeValue(key, value) ? m : `${pre}${key}${sep}${q}${REDACTED}${q}`),
  },
  // Common provider token formats.
  { name: "openai_key", re: /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}/g, replace: () => REDACTED },
  { name: "github_token", re: /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}/g, replace: () => REDACTED },
  { name: "aws_access_key", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, replace: () => REDACTED },
  { name: "slack_token", re: /\bxox[abposr]-[A-Za-z0-9-]{10,}/g, replace: () => REDACTED },
  { name: "google_api_key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g, replace: () => REDACTED },
  { name: "stripe_key", re: /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}/g, replace: () => REDACTED },
  { name: "npm_token", re: /\bnpm_[A-Za-z0-9]{30,}/g, replace: () => REDACTED },
  { name: "jwt", re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, replace: () => REDACTED },
];

const TS_TYPES = /^(string|number|boolean|any|unknown|void|null|undefined|never|object|bigint|symbol|true|false)(\[\])?[)>|&]*$/;
/** A TypeScript type (`string`, `React.FC`, `AuthUser[]`, `Promise<void>`) or the key repeated (`password: password`). */
function codeValue(key: string, value: string): boolean {
  if (TS_TYPES.test(value) || value === key) return true;
  // PascalCase or dotted PascalCase types, optionally generic or an array: React.FC, AuthState, Promise<User>.
  return /^[A-Z][A-Za-z]*(\.[A-Z][A-Za-z]*)*(<[\w.<>[\]| ]*>?)?(\[\])?[)>|&]*$/.test(value) && !/\d/.test(value);
}

/**
 * `code`: the text is source code or check output shown to the model. The unquoted `name = value` rule (meant for .env
 * and config files) is skipped there: in code it matches `handlePasswordReset = async`, `authUser: User`, and so on.
 * Key formats, private keys, bearer tokens, URL credentials and quoted secret values are still hidden.
 */
export function redact(text: string, extraPatterns: string[] = [], opts: { code?: boolean } = {}): string {
  if (!text) return text;
  let out = text;
  for (const rule of RULES) {
    if (opts.code && rule.name === "key_value") continue;
    out = out.replace(rule.re, rule.replace as (substring: string, ...args: unknown[]) => string);
  }
  for (const p of extraPatterns) {
    try {
      out = out.replace(new RegExp(p, "g"), REDACTED);
    } catch {
      /* invalid user pattern: ignore */
    }
  }
  return out;
}

/** Deep-redacts structured values: secret-named keys are blanked, strings are pattern-redacted. */
export function redactValue<T>(value: T, extraPatterns: string[] = []): T {
  const keyRe = new RegExp(`^${SECRET_KEY}$`, "i");
  const walk = (v: unknown, key?: string): unknown => {
    if (typeof v === "string") return key && keyRe.test(key) && !/^(tokens?|maxTokens|max_tokens|tokenize|authors?)$/i.test(key) ? REDACTED : redact(v, extraPatterns);
    if (Array.isArray(v)) return v.map((x) => walk(x));
    if (v && typeof v === "object") {
      const o: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) o[k] = walk(x, k);
      return o;
    }
    return v;
  };
  return walk(value) as T;
}

/**
 * Streaming redactor: holds back a tail of `window` chars so a secret straddling chunk boundaries is
 * redacted once the rest arrives. Multi-line private-key blocks are held until their END marker.
 */
export class StreamingRedactor {
  private buffer = "";
  constructor(
    private readonly extraPatterns: string[] = [],
    private readonly window = 512,
  ) {}

  push(chunk: string): string {
    this.buffer += chunk;
    const keyStart = this.buffer.search(/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/);
    if (keyStart >= 0 && !/-----END [A-Z0-9 ]*PRIVATE KEY-----/.test(this.buffer.slice(keyStart))) {
      const emit = redact(this.buffer.slice(0, keyStart), this.extraPatterns);
      this.buffer = this.buffer.slice(keyStart);
      if (this.buffer.length > 64_000) {
        // Unterminated key block: fail closed.
        this.buffer = "";
        return emit + REDACTED;
      }
      return emit;
    }
    // Emit complete lines immediately (secret patterns are line-scoped); hold back the partial last line.
    const nl = this.buffer.lastIndexOf("\n");
    let cut: number;
    if (nl >= 0) cut = nl + 1;
    else if (this.buffer.length > this.window) cut = this.buffer.length - this.window;
    else return "";
    const head = redact(this.buffer.slice(0, cut), this.extraPatterns);
    this.buffer = this.buffer.slice(cut);
    return head;
  }

  flush(): string {
    const out = redact(this.buffer, this.extraPatterns);
    this.buffer = "";
    return out;
  }
}
