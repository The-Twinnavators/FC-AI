// daemon/src/integrations/poschi/security/analyse.ts
//
// An application-security read of the Poschi codebase, derived on every run.
//
// ── Why this is a detector and not a written report ──────────────────────────
//
// A security report written once is wrong within a sprint, and wrong in the
// reassuring direction: the control it praised got refactored, the endpoint it
// cleared got a second caller. Everything below is recomputed from the files
// each time, so a finding that has been fixed disappears and a control that
// regressed comes back. That is the only property that makes a security
// document worth re-reading rather than re-writing.
//
// ── Absence is the whole difficulty ──────────────────────────────────────────
//
// Nearly every security finding is an absence — no signature check, no policy,
// no constant-time compare — and an absence found by pattern matching is the
// easiest thing in this codebase to get wrong. Three rules follow:
//
//   1. A detector that cannot see the file that would settle a question says
//      so, and the finding is graded `hypothesis`, never `verified`.
//   2. Every finding carries the mitigating fact against it where one exists.
//      "Requires a valid message SID" belongs beside the finding, not in a
//      footnote, because a reader who discovers it later stops trusting the
//      rest of the document.
//   3. Severity comes from evidence and reachability, not from the absence.
//      An unauthenticated endpoint that can only act on a value the caller
//      cannot guess is not the same as one that cannot.
//
// ── What this never does ─────────────────────────────────────────────────────
//
// It reads files. It sends nothing, calls nothing, and tests no live host. It
// never prints a secret: a candidate credential is reported by type, location
// and a truncated sha256 of the matched text, and the bytes stay where they
// were found.

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export interface SourceFile {
  path: string
  text: string
}

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type Confidence = 'verified' | 'indicated' | 'hypothesis'

export interface SecurityFinding {
  id: string
  title: string
  category: string
  severity: Severity
  confidence: Confidence
  /** CWE identifier, only where the mapping is unambiguous. */
  cwe: string | null
  /** OWASP ASVS 5.0 requirement, only where the mapping is confident. */
  asvs: string | null
  components: string[]
  /** What has to be true for this to be reachable at all. */
  preconditions: string
  impact: string
  /** Quoted or counted from the files, never paraphrased into a claim. */
  evidence: string[]
  whyItMatters: string
  remediation: string
  /** How somebody proves the fix landed. */
  verification: string
  /** The fact that argues the severity DOWN. Null when there genuinely is none. */
  mitigating: string | null
  /** A Claude Code prompt, or null when repository evidence cannot honestly
   *  support one and the issue needs a person outside the code. */
  prompt: string | null
  /** Set when `prompt` is null: what has to be checked, and by whom. */
  resolution: string | null
  needsApproval: boolean
}

export interface PositiveControl {
  title: string
  evidence: string
}

export interface SecurityReport {
  ranAt: string
  findings: SecurityFinding[]
  positives: PositiveControl[]
  /** Counts by severity, computed rather than typed, so the register and the
   *  summary cannot disagree. */
  counts: Record<Severity, number>
  /** Files the detectors actually read, which is not the same as files present. */
  scanned: number
  /** Security-relevant files the general loader skips and this pass read
   *  directly. Named so a reader can tell a real absence from an unread file. */
  extraRead: string[]
  /** Questions this pass could not settle from the repository. */
  limitations: string[]
}

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info']

const sha8 = (s: string): string => createHash('sha256').update(s).digest('hex').slice(0, 8)

/** Functions declared with `verify_jwt = false`, i.e. reachable without a
 *  Supabase JWT at the gateway. Parsed rather than grepped, because the flag
 *  belongs to whichever `[functions.<name>]` block precedes it. */
export function publicFunctions(configToml: string): string[] {
  const out: string[] = []
  let current: string | null = null
  for (const line of configToml.split(/\r?\n/)) {
    const header = line.match(/^\s*\[functions\.([a-z0-9_-]+)\]/i)
    if (header) { current = header[1]!; continue }
    if (current && /^\s*verify_jwt\s*=\s*false/.test(line)) { out.push(current); current = null }
  }
  return out
}

/**
 * Does this function body show any check on who is calling it?
 *
 * Deliberately broad. The first version of this looked for `createHmac` and
 * reported square-webhook as unauthenticated — a function whose header comment
 * says "HMAC signature verification is the gate" and which reads
 * `x-square-hmacsha256-signature` and verifies it through Web Crypto. Missing a
 * control that is present is the worst error this file can make: it spends a
 * reader's trust on a finding that is not there, and the real one beside it
 * stops being believed.
 *
 * So anything that reads a signature header, reaches for a MAC primitive by any
 * route, or resolves the caller counts. A false negative here costs a finding;
 * a false positive costs the report.
 */
export function verifiesCaller(text: string): boolean {
  return /constructEvent|verify-webhook-signature|createHmac|timingSafeEqual/i.test(text)
    // Web Crypto, which is how a Deno edge function usually computes a MAC.
    || /crypto\.subtle|importKey|\bsign\s*\(\s*["']HMAC/i.test(text)
    // A signature header being read at all: x-square-hmacsha256-signature,
    // X-Twilio-Signature, stripe-signature, paypal-transmission-sig, and so on.
    || /headers\.get\(\s*["'][^"']*signature[^"']*["']\s*\)/i.test(text)
    || /headers\.get\(\s*["'][^"']*transmission[^"']*["']\s*\)/i.test(text)
    || /\bgetUser\s*\(/.test(text)
    || /Authorization["'\s]*\)/.test(text)
}

const usesServiceRole = (text: string): boolean =>
  /SUPABASE_SERVICE_ROLE_KEY/.test(text)

/**
 * RLS coverage across the migration set.
 *
 * Policy names are routinely quoted and contain spaces. A bare `[^\s]+` name
 * pattern misses those and reports a covered table as bare, which is a false
 * finding in the most alarming category this report has — so the name is
 * matched as an optionally quoted token.
 */
export function rlsCoverage(migrations: SourceFile[]): {
  tables: string[]; rlsOn: Set<string>; policies: Map<string, number>
} {
  const created = new Set<string>()
  const rlsOn = new Set<string>()
  const policies = new Map<string, number>()
  const norm = (t: string) => t.replace(/"/g, '').replace(/^public\./i, '').toLowerCase().trim()
  // SQL keywords that a loose CREATE TABLE match picks up out of prose in a
  // comment. Excluded by name rather than by making the pattern stricter,
  // because a stricter pattern starts missing real tables.
  const NOISE = /^(if|in|anywhere|rather|time\.?)$/

  for (const f of [...migrations].sort((a, b) => a.path.localeCompare(b.path))) {
    for (const m of f.text.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_."]+)/gi)) {
      const t = norm(m[1]!)
      if (t && !NOISE.test(t)) created.add(t)
    }
    for (const m of f.text.matchAll(
      /alter\s+table\s+([a-z_."]+)\s+enable\s+row\s+level\s+security/gi)) {
      rlsOn.add(norm(m[1]!))
    }
    for (const m of f.text.matchAll(
      /create\s+policy\s+(?:"[^"]*"|`[^`]*`|[^\s]+)\s+on\s+([a-z_."]+)/gi)) {
      const t = norm(m[1]!)
      policies.set(t, (policies.get(t) ?? 0) + 1)
    }
  }
  return { tables: [...created].sort(), rlsOn, policies }
}

/**
 * Candidate committed credentials.
 *
 * Returns locations and a truncated hash, never the value. A short tail is a
 * placeholder or a variable reference — `sk_live_` appears in this codebase
 * mostly inside documentation and PowerShell that names the variable — so the
 * length and character mix decide, and everything else is counted rather than
 * listed.
 */
export function secretCandidates(files: SourceFile[]): {
  material: Array<{ path: string; line: number; kind: string; sha8: string }>
  references: number
  /** Key-shaped strings inside test files, counted rather than reported. */
  inTests: number
} {
  const PATTERNS: Array<[string, RegExp]> = [
    ['stripe secret key (live)', /sk_live_([A-Za-z0-9]*)/g],
    ['stripe secret key (test)', /sk_test_([A-Za-z0-9]*)/g],
    ['stripe webhook secret', /whsec_([A-Za-z0-9]*)/g],
    ['json web token', /eyJhbGciOi([A-Za-z0-9_\-.]*)/g],
  ]
  const material: Array<{ path: string; line: number; kind: string; sha8: string }> = []
  let references = 0
  let inTests = 0

  // A token inside a test that asserts it gets redacted is a fixture, and
  // reporting it as a possible live credential sends somebody to a provider
  // dashboard to look for a key that was never issued. Counted, so the number
  // is visible, and kept out of the material list.
  const isTest = (p: string) => /(^|\/)(__tests__|__fixtures__)\//.test(p)
    || /\.(test|spec)\.[cm]?[jt]sx?$/.test(p)

  for (const f of files) {
    for (const [kind, re] of PATTERNS) {
      re.lastIndex = 0
      for (const m of f.text.matchAll(re)) {
        const tail = m[1] ?? ''
        const looksReal = tail.length >= 20 && /[a-z]/.test(tail) && /[A-Z0-9]/.test(tail)
          && !/^[xX.]+$/.test(tail)
        if (!looksReal) { references += 1; continue }
        if (isTest(f.path)) { inTests += 1; continue }
        material.push({
          path: f.path,
          line: f.text.slice(0, m.index).split('\n').length,
          kind,
          sha8: sha8(m[0]),
        })
      }
    }
  }
  return { material, references, inTests }
}

/**
 * Documentation, scripts and config the general loader skips by extension.
 *
 * Read only for the secret scan, and only under the given root. Bounded by
 * depth, count and size so a large checkout cannot turn this into a full-disk
 * walk, and node_modules is never entered.
 */
function readAuxiliaryFiles(root: string): SourceFile[] {
  const KEEP_AUX = /\.(md|ps1|sh|bash|txt|toml|ya?ml|env|example|cfg|ini|conf)$/i
  const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'android', 'out'])
  const out: SourceFile[] = []
  const walk = (dir: string, rel: string, depth: number): void => {
    if (depth > 8 || out.length >= 800) return
    let entries: string[]
    try { entries = readdirSync(dir) } catch { return }
    for (const name of entries) {
      if (SKIP.has(name)) continue
      const full = join(dir, name)
      const relPath = rel ? `${rel}/${name}` : name
      let st
      try { st = statSync(full) } catch { continue }
      if (st.isDirectory()) { walk(full, relPath, depth + 1); continue }
      if (!KEEP_AUX.test(name) || st.size > 400_000) continue
      try { out.push({ path: relPath, text: readFileSync(full, 'utf8') }) } catch { /* skipped */ }
    }
  }
  walk(root, '', 0)
  return out
}

export interface AnalyseSecurityOptions {
  /** The checkout root, used only to read security-relevant files the general
   *  loader skips by extension. Nothing outside it is touched. */
  root?: string
  now?: Date
}

/**
 * The whole pass.
 *
 * `files` is what the shared loader collected. `supabase/config.toml` is read
 * separately because the loader keeps source extensions only, and that file is
 * the sole evidence for which functions are reachable without a JWT — the
 * question the most serious finding here turns on. When it cannot be read, the
 * detector that depends on it does not guess: it drops to a limitation.
 */
export function analyseSecurity(
  files: SourceFile[],
  opts: AnalyseSecurityOptions = {},
): SecurityReport {
  const now = opts.now ?? new Date()
  const findings: SecurityFinding[] = []
  const positives: PositiveControl[] = []
  const limitations: string[] = []
  const extraRead: string[] = []

  const byPath = (re: RegExp) => files.filter((f) => re.test(f.path))
  const migrations = byPath(/^supabase\/migrations\//)
  const functions = byPath(/^supabase\/functions\/[^/]+\/index\.ts$/)

  // ── config.toml, read directly ────────────────────────────────────────────
  let configToml: string | null = null
  if (opts.root) {
    const p = join(opts.root, 'supabase', 'config.toml')
    if (existsSync(p)) {
      try {
        configToml = readFileSync(p, 'utf8')
        extraRead.push('supabase/config.toml')
      } catch { /* falls through to the limitation below */ }
    }
  }

  // ── SEC-001: a public endpoint that writes with service-role rights ───────
  if (configToml) {
    const pub = publicFunctions(configToml)
    const unverified: string[] = []
    for (const name of pub) {
      const fn = functions.find((f) => f.path === `supabase/functions/${name}/index.ts`)
      if (!fn) continue
      if (usesServiceRole(fn.text) && !verifiesCaller(fn.text)) unverified.push(name)
    }
    if (unverified.length > 0) {
      findings.push({
        id: 'SEC-001',
        title: 'Public edge function performs privileged writes with no check on the caller',
        category: 'Authentication / webhook trust',
        severity: 'high',
        confidence: 'verified',
        cwe: 'CWE-306',
        asvs: 'V13.2 (webhook and callback authentication)',
        components: unverified.map((n) => `supabase/functions/${n}/index.ts`),
        preconditions: 'The function URL is reachable, which it is by design — it is declared '
          + '`verify_jwt = false` so an external sender without a Supabase JWT can call it.',
        impact: 'A request that nobody authenticated is processed by a client built on '
          + 'SUPABASE_SERVICE_ROLE_KEY, which bypasses row-level security. Writes made this way '
          + 'are indistinguishable in the database from writes the real sender made.',
        evidence: [
          `supabase/config.toml declares ${pub.length} function(s) with verify_jwt = false.`,
          ...unverified.map((n) => `supabase/functions/${n}/index.ts constructs a service-role `
            + 'client and contains no signature, HMAC or caller check.'),
        ],
        whyItMatters: 'Every other public receiver in this codebase verifies its sender — Stripe '
          + 'and Square by HMAC, PayPal against its verify-webhook-signature endpoint. The gap is '
          + 'not a missing convention, it is one endpoint outside a convention the team already '
          + 'follows, which is the kind that survives review because the category looks covered.',
        remediation: 'Validate the sender before any write. Twilio signs each request with '
          + 'X-Twilio-Signature, an HMAC-SHA1 over the full URL and the sorted POST body keyed on '
          + 'the account auth token; compare with a timing-safe equality and reject on mismatch. '
          + 'Keep returning 200 only for requests that verified.',
        verification: 'A request with no signature, and one with a signature computed over a '
          + 'different body, are both rejected without touching the database. A correctly signed '
          + 'request still updates sms_log exactly as it does today.',
        mitigating: 'The handler acts only on a row matched by twilio_message_sid and returns 200 '
          + 'without writing when no row matches, so an attacker needs a message SID they cannot '
          + 'derive. That bounds the blast radius and is why this is graded high rather than '
          + 'critical — but it is a capability check, not authentication, and it does not bound '
          + 'the notification writes that follow once one SID is known.',
        prompt: [
          'Implement remediation for SEC-001: public edge function performs privileged',
          'writes with no check on the caller.',
          '',
          'Scope:',
          ...unverified.map((n) => `- supabase/functions/${n}/index.ts`),
          '- supabase/functions/_shared/ (add a verification helper if one does not exist)',
          '',
          'Objective:',
          '- Establish that the request came from the expected external sender before any',
          '  database write occurs.',
          '',
          'Constraints:',
          '- Do not modify unrelated functionality.',
          '- Do not log secrets, tokens, PII, payment data, or raw request bodies.',
          '- Preserve backwards compatibility: a correctly signed request must behave exactly',
          '  as it does today, including returning 200 on an unknown message SID.',
          '- Do not deploy, rotate credentials, contact vendors, or change production settings.',
          '- Do not change verify_jwt in supabase/config.toml. The file explains why these',
          '  functions are declared public; the fix belongs in the handler, not the gateway.',
          '- Stop and request clarification if the signing secret is not represented in the',
          '  repository as an environment variable.',
          '',
          'Implementation requirements:',
          '- Read the signature header the sender actually sends (for Twilio, X-Twilio-Signature).',
          '- Recompute the expected value over the exact bytes received, before parsing.',
          '- Compare with a timing-safe equality, never ===.',
          '- Reject with 403 and no body detail when verification fails.',
          '- Refuse to process at all when the signing secret is unset, matching the pattern',
          '  stripe-webhooks already uses for STRIPE_WEBHOOK_SECRET.',
          '- Log a rejection as a counter or an event name only. Never the header, the body,',
          '  the computed digest, or the phone number.',
          '',
          'Tests:',
          '- Positive: a correctly signed request updates sms_log as before.',
          '- Negative: an unsigned request is rejected and writes nothing.',
          '- Negative: a signature computed over a different body is rejected.',
          '- Negative: with the secret unset, the function refuses rather than accepting.',
          '- Regression: an unknown message SID still returns 200 and writes nothing.',
          '',
          'Acceptance criteria:',
          '- No database call is reachable before verification succeeds.',
          '- No test asserts on a real credential value.',
          '',
          'Deliverables:',
          '- Code changes',
          '- Tests',
          '- Brief implementation note',
          '- Security verification evidence',
          '- Rollback note: the change is additive; reverting the handler restores current',
          '  behaviour without a migration.',
        ].join('\n'),
        resolution: null,
        needsApproval: true,
      })
    }
  } else {
    limitations.push('supabase/config.toml could not be read, so which edge functions are '
      + 'reachable without a Supabase JWT is unknown. Every finding that would depend on it has '
      + 'been withheld rather than guessed.')
  }

  // ── SEC-002: a secret compared with === ───────────────────────────────────
  const nonConstantTime = functions.filter((f) =>
    /===\s*SERVICE_ROLE_KEY|SERVICE_ROLE_KEY\s*===/.test(f.text))
  if (nonConstantTime.length > 0) {
    findings.push({
      id: 'SEC-002',
      title: 'A service-role key is compared with ordinary string equality',
      category: 'Cryptography / secret handling',
      severity: 'low',
      confidence: 'verified',
      cwe: 'CWE-208',
      asvs: 'V11.3 (constant-time comparison of secrets)',
      components: nonConstantTime.map((f) => f.path),
      preconditions: 'The caller can submit many requests and measure response timing precisely '
        + 'enough to separate byte-by-byte differences over the network.',
      impact: 'In principle a bearer token could be recovered a byte at a time. Over public '
        + 'internet latency this is not a practical attack today.',
      evidence: nonConstantTime.map((f) =>
        `${f.path} compares a bearer token to SUPABASE_SERVICE_ROLE_KEY with ===.`),
      whyItMatters: 'It is a small change and it removes a class of bug rather than an instance. '
        + 'The same file already does the harder part correctly: it falls through to a real '
        + 'role-based authorisation check rather than treating the key as the only gate.',
      remediation: 'Compare with a timing-safe equality over fixed-length digests of both values.',
      verification: 'The comparison no longer short-circuits on the first differing byte; the '
        + 'existing authorisation tests still pass.',
      mitigating: 'Not remotely exploitable in any practical sense over a network, and the '
        + 'function performs a full authorisation check besides. Graded low deliberately.',
      prompt: [
        'Implement remediation for SEC-002: a service-role key is compared with ordinary',
        'string equality.',
        '',
        'Scope:',
        ...nonConstantTime.map((f) => `- ${f.path}`),
        '',
        'Objective:',
        '- Compare the presented bearer token to the expected secret in constant time.',
        '',
        'Constraints:',
        '- Do not modify unrelated functionality.',
        '- Do not change the surrounding authorisation logic, which is correct.',
        '- Do not log secrets, tokens, PII, or raw request bodies.',
        '- Do not deploy or rotate credentials.',
        '',
        'Implementation requirements:',
        '- Hash both values to a fixed length, then compare with a timing-safe equality.',
        '- An empty or missing bearer must still fail closed.',
        '',
        'Tests:',
        '- Positive: the correct key is still accepted.',
        '- Negative: an empty bearer, a wrong key and a prefix of the correct key are rejected.',
        '- Regression: the role-based authorisation path is unchanged.',
        '',
        'Acceptance criteria:',
        '- No === comparison against a secret remains in the named files.',
        '',
        'Deliverables:',
        '- Code changes',
        '- Tests',
        '- Brief implementation note',
        '- Rollback note',
      ].join('\n'),
      resolution: null,
      needsApproval: false,
    })
  }

  // ── SEC-003: RLS with no policy ───────────────────────────────────────────
  const { tables, rlsOn, policies } = rlsCoverage(migrations)
  const bare = tables.filter((t) => rlsOn.has(t) && !policies.has(t))
  if (tables.length > 0 && bare.length > 0) {
    findings.push({
      id: 'SEC-003',
      title: 'Tables with row-level security enabled and no policy in the migration set',
      category: 'Authorization / data access',
      severity: 'info',
      confidence: 'indicated',
      cwe: null,
      asvs: null,
      components: bare.map((t) => `table ${t}`),
      preconditions: 'None. This is an observation about the schema as the migrations define it.',
      impact: 'Row-level security with no policy denies every request that is not service-role. '
        + 'That is fail-closed and therefore safe by default — these tables are reachable only '
        + 'from server-side code holding the service key.',
      evidence: [
        `${tables.length} tables created across ${migrations.length} migrations.`,
        `${tables.filter((t) => rlsOn.has(t)).length} have row-level security enabled.`,
        `${bare.length} have no CREATE POLICY in the migration set: ${bare.join(', ')}.`,
      ],
      whyItMatters: 'It is listed so that adding a policy to one of these later is a deliberate '
        + 'act rather than an unnoticed widening. The risk is not today; it is the first policy '
        + 'written against one of these without the author realising nothing else guards it.',
      remediation: 'No change required. Record which of these are intended to be service-role '
        + 'only, so a future policy on one of them is reviewed as a change of posture.',
      verification: 'A comment or a test asserting the intended access model for each.',
      mitigating: 'Fail-closed by construction. This is not a vulnerability and is graded '
        + 'informational for that reason.',
      prompt: null,
      resolution: [
        'What must be verified outside the repository:',
        '- Whether each listed table is intended to be reachable only by server-side code.',
        '- Whether any policy exists in the deployed database that is not in the migration set,',
        '  which would mean the deployed posture differs from what these files describe.',
        '',
        'Owner role: the engineer who owns the data model, with a security reviewer.',
        '',
        'Questions to answer:',
        '- For each table listed, which roles are supposed to read it, and which to write it?',
        '- Has any policy been applied directly to production outside a migration?',
        '',
        'Expected evidence: a pg_policies listing from the deployed database, compared against',
        'this list.',
        '',
        'Safe next step: run that comparison in a non-production environment first. No code',
        'change should be made from this finding alone.',
      ].join('\n'),
      needsApproval: false,
    })
  }

  // ── SEC-004: candidate committed credentials ──────────────────────────────
  //
  // Scanned over the source files AND over the documentation and scripts the
  // shared loader leaves out. That exclusion is right for every other report —
  // a README is not product surface — and wrong for this one: a pasted key
  // lands in an ops note or a deploy script far more often than in a .ts, and
  // a scanner that cannot see those files reports "no secrets found" while
  // meaning "none where I looked".
  const extraSecretFiles = opts.root ? readAuxiliaryFiles(opts.root) : []
  if (opts.root && extraSecretFiles.length > 0) {
    extraRead.push(`${extraSecretFiles.length} documentation and script files, for the secret scan`)
  }
  const secrets = secretCandidates([...files, ...extraSecretFiles])
  if (secrets.material.length > 0) {
    findings.push({
      id: 'SEC-004',
      title: 'Strings shaped like live credentials are present in tracked files',
      category: 'Secret management',
      severity: 'medium',
      confidence: 'indicated',
      cwe: 'CWE-798',
      asvs: 'V14.1 (secret management)',
      components: [...new Set(secrets.material.map((m) => m.path))],
      preconditions: 'Anyone who can read the repository can read these strings.',
      impact: 'Depends entirely on whether the value is live, which the repository cannot say.',
      evidence: secrets.material.map((m) =>
        `${m.path}:${m.line} — ${m.kind}, sha256 prefix ${m.sha8} (value not reproduced).`),
      whyItMatters: 'A committed credential is only as harmless as somebody\'s memory that it was '
        + 'a test value.',
      remediation: 'Classify each. Rotate anything that cannot be shown to be synthetic.',
      verification: 'Each location is either removed, replaced with a fixture that is obviously '
        + 'not a credential, or documented as synthetic with the reason.',
      mitigating: null,
      prompt: null,
      resolution: [
        'What must be verified outside the repository:',
        '- Whether each string is a live credential, a revoked one, or synthetic test data.',
        '',
        'Owner role: whoever holds the account the credential belongs to.',
        '',
        'Questions to answer:',
        // "the provider dashboard" was the wording here, and it collides with a
        // role name: on a product whose users include providers, a reader takes
        // it for a screen in their own application. It means the vendor that
        // issued the key — say so.
        '- Does this value exist in the account of whichever service issued it, and is it active?',
        '- If active, what can it reach?',
        '',
        'Expected evidence: the issuing service\'s own key listing, checked by hash or last-four,',
        'never by pasting the value anywhere.',
        '',
        'Safe next step: if it is live, rotate it before anything else. Rotation is a',
        'credential action and requires the owner, not an engineering change.',
      ].join('\n'),
      needsApproval: true,
    })
  } else {
    positives.push({
      title: 'No live-looking credential material in tracked files',
      evidence: `${files.length} files scanned for Stripe secret keys, webhook secrets and JWTs. `
        + `${secrets.references} matches were placeholders or variable references and `
        + `${secrets.inTests} were fixtures inside test files; none outside a test had the length `
        + 'and character mix of real key material.',
    })
  }

  // ── Positive controls ─────────────────────────────────────────────────────
  if (tables.length > 0) {
    const on = tables.filter((t) => rlsOn.has(t)).length
    positives.push({
      title: on === tables.length
        ? 'Row-level security is enabled on every table the migrations create'
        : 'Row-level security is enabled on most tables',
      evidence: `${on} of ${tables.length} tables, across ${migrations.length} migrations. `
        + `${tables.filter((t) => policies.has(t)).length} carry at least one policy.`,
    })
  }
  // The same predicate the finding uses, so a function cannot be reported as
  // unverified in one section and as a positive control in the other.
  if (configToml) {
    const verifying = publicFunctions(configToml)
      .map((n) => functions.find((f) => f.path === `supabase/functions/${n}/index.ts`))
      .filter((f): f is SourceFile => Boolean(f) && verifiesCaller(f!.text))
    if (verifying.length > 0) {
      positives.push({
        title: 'Public webhook receivers verify their sender before acting',
        evidence: `${verifying.length} of the publicly reachable function(s) check a signature or `
          + 'resolve the caller: ' + verifying.map((f) => f.path.split('/')[2]).join(', ') + '.',
      })
    }
  }
  const redactors = files.filter((f) => /function redact\b/.test(f.text))
  if (redactors.length > 0) {
    positives.push({
      title: 'Outbound error data is redacted before it leaves',
      evidence: `${redactors.map((f) => f.path).join(', ')} strips email addresses and JWTs, with `
        + 'tests asserting both.',
    })
  }

  // ── Limitations that are always true of a static read ─────────────────────
  limitations.push(
    'This pass reads files. It made no request to any host, ran no exploit, and tested no '
      + 'deployed endpoint, so nothing here establishes how the running system behaves.',
    'Deployed database policies, cloud IAM, WAF, CDN and CORS configuration are not represented '
      + 'in the repository and were not assessed.',
    'Whether any credential-shaped string is live cannot be determined from source.',
    'Dependency vulnerability status was not assessed: it requires an advisory database this '
      + 'pass does not consult.',
  )

  const counts = SEVERITY_ORDER.reduce((acc, s) => {
    acc[s] = findings.filter((f) => f.severity === s).length
    return acc
  }, {} as Record<Severity, number>)

  const rank = (s: Severity) => SEVERITY_ORDER.indexOf(s)
  findings.sort((a, b) => rank(a.severity) - rank(b.severity) || a.id.localeCompare(b.id))

  return {
    ranAt: now.toISOString(),
    findings,
    positives,
    counts,
    scanned: files.length,
    extraRead,
    limitations,
  }
}
