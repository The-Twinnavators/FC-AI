/**
 * Static security triage (FR-Q3), compliance triage (FR-Q4) and SEO/metadata QA (FR-Q5).
 * Static inspection only: no exploitation, no network scanning, raw secrets never displayed.
 * Every security/compliance finding is marked "manual validation required".
 */
import fs from "node:fs";
import path from "node:path";
import { parse as parseHtml, type DefaultTreeAdapterMap } from "parse5";
import type { Finding } from "@flowcode/contracts";
import type { PathJail } from "../security/pathJail.js";
import { flattenFiles } from "../workspace/fileService.js";
import { redact, REDACTED } from "../security/redaction.js";

let seq = 0;
const mk = (category: Finding["category"], x: Omit<Finding, "id" | "category" | "source" | "manualValidationRequired"> & Partial<Finding>): Finding => ({
  id: `${category}_${++seq}`,
  category,
  source: "static",
  manualValidationRequired: category === "security" || category === "compliance",
  ...x,
});

interface Rule {
  rule: string;
  re: RegExp;
  severity: Finding["severity"];
  confidence: Finding["confidence"];
  message: string;
  impact: string;
  recommendation: string;
}

export const SECURITY_RULES: Rule[] = [
  { rule: "eval", re: /\beval\s*\(|new Function\s*\(/, severity: "serious", confidence: "high", message: "Dynamic code evaluation", impact: "Code injection if input reaches it", recommendation: "Remove eval/new Function; parse data explicitly." },
  { rule: "dangerous-html", re: /dangerouslySetInnerHTML|\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML/, severity: "serious", confidence: "medium", message: "Raw HTML injection sink", impact: "Cross-site scripting (XSS) if content is user-controlled", recommendation: "Render text nodes or sanitize with a vetted sanitizer." },
  { rule: "command-injection", re: /\b(exec|execSync|spawn)\s*\(\s*[`'"].*\$\{|shell\s*:\s*true/, severity: "serious", confidence: "medium", message: "Shell command built from interpolated input / shell:true", impact: "OS command injection", recommendation: "Use execFile/spawn with argv arrays and shell:false." },
  { rule: "sql-concat", re: /\b(SELECT\b[^;\n]*?\bFROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b[^;\n]*['"`]\s*\+\s*\w|\b(query|execute)\s*\(\s*`[^`]*\$\{/i, severity: "serious", confidence: "medium", message: "SQL built by string concatenation", impact: "SQL injection", recommendation: "Use parameterized queries." },
  { rule: "path-traversal", re: /(readFile|createReadStream|sendFile|writeFile)\w*\s*\([^)]*(req\.(params|query|body)|searchParams)/, severity: "serious", confidence: "medium", message: "Filesystem path from request input", impact: "Path traversal / arbitrary file read", recommendation: "Resolve against a fixed root and reject paths that escape it." },
  { rule: "open-redirect", re: /(res\.redirect|location\.href\s*=|window\.location\s*=|redirect\()\s*\(?\s*(req\.(query|params|body)|new URLSearchParams|searchParams\.get)/, severity: "moderate", confidence: "medium", message: "Redirect target from user input", impact: "Open redirect / phishing", recommendation: "Allow-list redirect destinations." },
  { rule: "cors-wildcard", re: /Access-Control-Allow-Origin['"]?\s*[:,]\s*['"]\*['"]|origin\s*:\s*['"]\*['"]|cors\(\s*\)/, severity: "moderate", confidence: "medium", message: "Wildcard CORS", impact: "Any origin can read responses", recommendation: "Restrict allowed origins." },
  { rule: "insecure-random", re: /Math\.random\(\).*\b(token|secret|id|key|password|nonce)/i, severity: "moderate", confidence: "low", message: "Math.random used for a security-relevant value", impact: "Predictable identifiers/tokens", recommendation: "Use crypto.randomUUID() / crypto.getRandomValues()." },
  { rule: "token-in-storage", re: /localStorage\.setItem\(\s*['"][^'"]*(token|jwt|session|auth)/i, severity: "moderate", confidence: "medium", message: "Auth token stored in localStorage", impact: "Token theft via XSS", recommendation: "Prefer httpOnly secure cookies." },
  { rule: "log-sensitive", re: /console\.(log|info|debug)\([^)]*(password|token|secret|authorization)/i, severity: "moderate", confidence: "medium", message: "Possibly logging sensitive values", impact: "Secret exposure in logs", recommendation: "Remove or redact sensitive fields before logging." },
  { rule: "jwt-no-verify", re: /jwt\.decode\(/, severity: "moderate", confidence: "low", message: "JWT decoded without verification", impact: "Forged tokens accepted", recommendation: "Use jwt.verify with a pinned algorithm." },
  { rule: "insecure-http", re: /['"]http:\/\/(?!localhost|127\.0\.0\.1|\[::1\]|www\.w3\.org)[\w.-]+/, severity: "minor", confidence: "medium", message: "Plain HTTP URL", impact: "Traffic interception", recommendation: "Use HTTPS." },
  { rule: "disabled-tls", re: /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED/, severity: "serious", confidence: "high", message: "TLS verification disabled", impact: "Man-in-the-middle", recommendation: "Keep certificate verification enabled." },
  { rule: "cookie-flags", re: /cookie\([^)]*\{(?![^}]*httpOnly)[^}]*\}/, severity: "minor", confidence: "low", message: "Cookie set without httpOnly", impact: "Cookie readable by scripts", recommendation: "Set httpOnly, secure and sameSite." },
];

export function securityTriage(jail: PathJail): Finding[] {
  seq = 0;
  const findings: Finding[] = [];
  const files = flattenFiles(jail).filter((p) => /\.(m?[jt]sx?|cjs|py|html)$/.test(p) && !/\.(test|spec)\./.test(p) && !p.startsWith("dist/"));
  for (const rel of files) {
    const lines = fs.readFileSync(path.join(jail.root, rel), "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const r of SECURITY_RULES) if (r.re.test(line)) findings.push(mk("security", { rule: r.rule, severity: r.severity, confidence: r.confidence, message: r.message, path: rel, line: i + 1, evidence: redact(line.trim()).slice(0, 160), impact: r.impact, recommendation: r.recommendation }));
      if (redact(line) !== line && !/process\.env|import\.meta\.env/.test(line) && !onlyPlainNames(line) && redact(withoutCodeValues(line)) !== withoutCodeValues(line))
        findings.push(mk("security", { rule: "hardcoded-secret", severity: "critical", confidence: "medium", message: "Possible hard-coded secret", path: rel, line: i + 1, evidence: REDACTED, impact: "Credential exposure", recommendation: "Move to environment configuration and rotate the credential." }));
    });
  }
  // Secret files present in the workspace (names only).
  for (const rel of flattenFiles(jail).filter((p) => jail.isSecretPath(p) && !/\.example$/.test(p)))
    findings.push(mk("security", { rule: "secret-file-present", severity: "moderate", confidence: "high", message: "Secret-like file in workspace (contents not read)", path: rel, impact: "Accidental commit or disclosure", recommendation: "Ensure it is git-ignored and never bundled." }));
  // Dependency risk signals from the manifest (no network calls).
  const pkgPath = path.join(jail.root, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as Record<string, Record<string, string>>;
      for (const [name, spec] of Object.entries({ ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) })) {
        if (/^(\*|latest)$/.test(spec)) findings.push(mk("security", { rule: "unpinned-dependency", severity: "minor", confidence: "high", message: `${name} uses an unbounded version (${spec})`, path: "package.json", impact: "Unreviewed upgrades / supply-chain risk", recommendation: "Pin a version range." }));
        if (/^(git|github:|https?:)/.test(spec)) findings.push(mk("security", { rule: "git-dependency", severity: "moderate", confidence: "high", message: `${name} installs from a URL/git (${spec})`, path: "package.json", impact: "Unverified code source", recommendation: "Prefer registry packages with integrity hashes." }));
      }
      const scripts = (pkg.scripts ?? {}) as Record<string, string>;
      for (const [n, c] of Object.entries(scripts)) if (/^(pre|post)?install$/.test(n)) findings.push(mk("security", { rule: "install-script", severity: "minor", confidence: "high", message: `Lifecycle script "${n}" runs on install: ${redact(c).slice(0, 80)}`, path: "package.json", impact: "Code runs during dependency install", recommendation: "Review the script content." }));
    } catch {
      /* invalid manifest handled by preflight */
    }
  }
  return findings;
}

export const COMPLIANCE_DISCLAIMER = "Compliance triage is engineering/product triage based on static signals. It is not legal advice, an audit, or a certification.";

export function complianceTriage(jail: PathJail): Finding[] {
  seq = 0;
  const findings: Finding[] = [];
  const files = flattenFiles(jail).filter((p) => /\.(m?[jt]sx?|html|md|json)$/.test(p) && !p.startsWith("dist/") && p !== "package-lock.json");
  const corpus = files.map((rel) => ({ rel, text: fs.readFileSync(path.join(jail.root, rel), "utf8") }));
  const anyMatch = (re: RegExp) => corpus.filter((c) => re.test(c.text)).map((c) => c.rel);
  const signal = (rule: string, re: RegExp, message: string, recommendation: string, severity: Finding["severity"] = "info", strip?: (text: string) => string) => {
    const hits = corpus.filter((c) => re.test(strip ? strip(c.text) : c.text)).map((c) => c.rel);
    if (hits.length) findings.push(mk("compliance", { rule, severity, confidence: "low", message, path: hits[0], evidence: `Signals in ${hits.slice(0, 4).join(", ")}`, recommendation }));
    return hits.length > 0;
  };
  const hasPolicy = anyMatch(/privacy policy|privacy notice/i).length > 0;
  const hasDeletion = anyMatch(/delete (my )?account|clear (all )?data|delete all/i).length > 0;
  // With a privacy notice and a way to delete data in place, handling personal data is noted, not a problem to fix.
  const personal = hasPolicy && hasDeletion
    ? signal("personal-data", /type=["'](email|tel)["']|\b(email|phone|address|birth(date|day)|ssn|passport)\b/i, "Handles personal data (privacy notice and data deletion are in place)", "Keep the privacy notice current when what you collect changes.")
    : signal("personal-data", /type=["'](email|tel)["']|\b(email|phone|address|birth(date|day)|ssn|passport)\b/i, "Collects or handles personal data", "Document purpose, retention and deletion; minimize fields.", "moderate");
  signal("local-storage-of-data", /localStorage|indexedDB/, "Stores user data on the device (local-first)", "Disclose local storage; provide a way to clear data.");
  signal("analytics-cookies", /gtag\(|google-analytics|mixpanel|segment\.com|posthog|document\.cookie/i, "Analytics or cookies detected", "Consent may be required before non-essential tracking.", "moderate");
  signal("payments", /stripe|paypal|braintree|card(Number|_number)|checkout/i, "Payment-related code detected", "Use a PCI-compliant provider; never store card data.", "moderate");
  // React's `children` prop ({ children }, props.children, children: ReactNode) is code, not a children's-data signal.
  signal("children", /\b(children|kids|under 13|coppa|parental consent)\b/i, "Children-related domain signals", "Children's privacy rules may apply.", "moderate", withoutChildrenProp);
  signal("health", /\b(diagnos|patient|medical|health record|hipaa|prescription)\w*/i, "Health-domain signals", "Health-data regulations may apply.", "moderate");
  signal("financial", /\b(loan|credit score|bank account|iban|routing number|investment)\b/i, "Financial-domain signals", "Financial regulations may apply.", "moderate");
  signal("employment", /\b(applicant|résumé|resume|hiring|salary|background check)\b/i, "Employment-domain signals", "Employment-data rules may apply.");
  if (personal && !hasPolicy) findings.push(mk("compliance", { rule: "privacy-notice", severity: "moderate", confidence: "low", message: "Personal data signals but no privacy notice found", recommendation: "Add a privacy notice describing collection, purpose, retention." }));
  if (personal && !hasDeletion) findings.push(mk("compliance", { rule: "data-deletion", severity: "minor", confidence: "low", message: "No account/data deletion affordance found", recommendation: "Provide a way to delete personal data." }));
  return findings;
}

export function seoTriage(jail: PathJail): Finding[] {
  seq = 0;
  const findings: Finding[] = [];
  const htmlFiles = flattenFiles(jail).filter((p) => /(^|\/)index\.html$/.test(p) && !p.startsWith("dist/"));
  const s = (x: Omit<Finding, "id" | "category" | "source" | "manualValidationRequired">) => findings.push(mk("seo", { ...x }));
  for (const rel of htmlFiles) {
    const doc = parseHtml(fs.readFileSync(path.join(jail.root, rel), "utf8")) as DefaultTreeAdapterMap["document"];
    const metas = collect(doc, "meta");
    const links = collect(doc, "link");
    const attr = (el: DefaultTreeAdapterMap["element"], n: string) => el.attrs.find((a) => a.name === n)?.value;
    const meta = (key: string) => metas.find((m) => attr(m, "name") === key || attr(m, "property") === key);
    const title = collect(doc, "title")[0];
    const titleText = title ? title.childNodes.map((c) => (c as DefaultTreeAdapterMap["textNode"]).value ?? "").join("").trim() : "";
    if (!titleText) s({ rule: "title", severity: "serious", confidence: "high", message: "Missing <title>", path: rel });
    else if (titleText.length > 60 || titleText.length < 10) s({ rule: "title-length", severity: "minor", confidence: "high", message: `Title length ${titleText.length} (aim for 10–60)`, path: rel });
    const desc = meta("description");
    if (!desc) s({ rule: "meta-description", severity: "moderate", confidence: "high", message: "Missing meta description", path: rel });
    if (!meta("viewport")) s({ rule: "viewport", severity: "serious", confidence: "high", message: "Missing viewport meta", path: rel });
    if (!links.some((l) => attr(l, "rel") === "canonical")) s({ rule: "canonical", severity: "info", confidence: "high", message: "No canonical URL (fine for local apps; needed when deployed)", path: rel });
    if (!meta("og:title") || !meta("og:description")) s({ rule: "open-graph", severity: "info", confidence: "high", message: "Open Graph title/description missing", path: rel });
    if (!meta("twitter:card")) s({ rule: "social-card", severity: "info", confidence: "high", message: "No social card meta", path: rel });
    const robots = meta("robots");
    if (robots && /noindex/.test(attr(robots, "content") ?? "")) s({ rule: "indexability", severity: "moderate", confidence: "high", message: "Page is marked noindex", path: rel });
    if (!collect(doc, "script").some((sc) => attr(sc, "type") === "application/ld+json")) s({ rule: "structured-data", severity: "info", confidence: "high", message: "No JSON-LD structured data", path: rel });
  }
  const files = flattenFiles(jail);
  if (!files.some((f) => /(^|\/)robots\.txt$/.test(f))) s({ rule: "robots-txt", severity: "info", confidence: "high", message: "No robots.txt" });
  if (!files.some((f) => /sitemap.*\.xml$/.test(f))) s({ rule: "sitemap", severity: "info", confidence: "high", message: "No sitemap.xml" });
  return findings;
}

function collect(node: DefaultTreeAdapterMap["parentNode"], tag: string, out: DefaultTreeAdapterMap["element"][] = []): DefaultTreeAdapterMap["element"][] {
  for (const c of node.childNodes ?? []) {
    if ((c as DefaultTreeAdapterMap["element"]).tagName === tag) out.push(c as DefaultTreeAdapterMap["element"]);
    if ((c as DefaultTreeAdapterMap["parentNode"]).childNodes) collect(c as DefaultTreeAdapterMap["parentNode"], tag, out);
    const content = (c as unknown as { content?: DefaultTreeAdapterMap["parentNode"] }).content;
    if (content) collect(content, tag, out);
  }
  return out;
}

/**
 * True when every string on the line is a plain name such as a storage key ("calendar.user", "fc.copilot-model"),
 * not something secret-shaped. Real keys and tokens are long, random-looking strings, so they are still flagged.
 */
export function onlyPlainNames(line: string): boolean {
  const values = [...line.matchAll(/(["'`])((?:\.|(?!\1).)*)\1/g)].map((m) => m[2]);
  if (!values.length) return false;
  return values.every((v) => v.length > 0 && v.length <= 40 && /^[a-z][a-z0-9]*(?:[._:/-][a-z0-9]+)*$/i.test(v) && !/\d{4,}/.test(v) && !/[A-Z].*\d|\d.*[A-Z]/.test(v));
}

/**
 * Blanks assigned values that are clearly code rather than a literal: a call or generic (createContext<…>(),
 * useAuth()), `new X`, a member path (this.token, props.auth) or a keyword. A real secret is a literal string or a
 * known token format, which this leaves in place for the secret scan.
 */
export function withoutCodeValues(line: string): string {
  return line.replace(/([=:]\s*)(?!["'`])(?:new\s+[A-Za-z_$][\w$.]*|(?:true|false|null|undefined)\b|[A-Za-z_$][\w$]*(?:\.[\w$]+)+|[A-Za-z_$][\w$.]*\s*(?:<[^>]*>)?(?=\s*\())/g, "$1_ ");
}

/** Removes React's `children` prop from source text: `{ children }`, `props.children`, `children: ReactNode`, `{children}`. */
export function withoutChildrenProp(text: string): string {
  return text.replace(/(?:[{.,]\s*)children\b|\bchildren\s*(?=[:,}=)?])/g, "");
}
