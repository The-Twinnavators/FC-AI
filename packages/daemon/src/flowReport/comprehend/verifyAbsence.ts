// daemon/src/flow-reports/comprehend/verifyAbsence.ts
//
// Checking whether a thing the report calls missing is actually missing.
//
// ── The finding class that was never checked ─────────────────────────────────
//
// Most of what this report says is an absence: no error reporting, no canonical
// tag, no screen reaches this capability. Every one of them is produced by a
// pattern that searched for one spelling of a thing and did not find it — which
// is a statement about the pattern at least as much as about the repository.
//
// Measured, on POSCHI: `/\/stylist\/profile/` matched none of its 177 routes,
// because the product renamed that word to "provider" years ago. The report
// said a screen it has is a screen it lacks. Three more came from a caller that
// never passed the routes in at all, so `routes.some(...)` over an empty list
// answered "no screen reaches anything" to a question nobody had asked.
//
// The adjudicator could not catch these, and said so in its own comment: it is
// shown excerpts of the files that matched the finding's words, and an absence
// finding matched nothing, so there is nothing to show it. Absence of evidence
// in that sample is not evidence the detector was wrong. It exempted them.
//
// ── So this pass lets the model look ─────────────────────────────────────────
//
// Three steps, and the middle one is not the model:
//
//   1. The model reads the claim and says what the thing would be CALLED in a
//      codebase — provider, vendor, seller, practitioner, and so on. Naming the
//      same concept under a different word is the one thing a pattern cannot do
//      and a language model is genuinely good at.
//   2. Those terms are searched across every scanned file, deterministically,
//      here. The search is ordinary text matching with real file paths and line
//      numbers, auditable afterwards and identical between runs.
//   3. The model reads what the search actually found and says whether the
//      capability is there, citing the files that show it.
//
// The model supplies vocabulary and judgement. It never supplies evidence.
//
// ── A withdrawal has to name a real file ─────────────────────────────────────
//
// "It exists" is only accepted when the model cites a path the search actually
// returned. A model that says a capability is present and cannot point at it
// has not found anything, and the finding stands. That gate is deterministic,
// so the worst a confused model can do is fail to withdraw something.
//
// ── What it does when the model is absent ────────────────────────────────────
//
// Nothing, loudly. Every absence survives unverified and the section says so,
// because a run without the model must not look like a run that checked.

import { chatJson, chooseModel, modelStatus, DEFAULT_MODEL } from './model.js'
import type { Finding } from '../types.js'
import type { SourceFile } from './adjudicate.js'

/** What the search turned up for one term. */
export interface Hit {
  path: string
  line: number
  /** The matching line, trimmed. Shown to the model, and printed if it cites it. */
  text: string
}

export interface AbsenceCheck {
  /** True when the capability was found after all, so the finding is wrong. */
  present: boolean
  /** Terms the search ran. Recorded whatever the answer, so "we looked for X,
   *  Y and Z" is in the report rather than only in this process's memory. */
  searched: string[]
  /** Files the model cited as showing the capability. Empty when it is absent. */
  citations: string[]
  /** One sentence. Printed next to the withdrawal or the confirmation. */
  reason: string
}

export type AbsenceChecks = Map<string, AbsenceCheck>

const NAMING = `You name things.

You are given a claim that some capability is MISSING from a codebase, written
by a pattern matcher that searched for one spelling of it.

Your job is to list the words and path fragments that capability would be
called in a real codebase — including words the original claim did not think
of. A booking product might call the same person a stylist, a provider, a
vendor, a seller, a practitioner or a pro. A screen might live at /profile,
/account, /me or /settings.

Give short, distinctive, searchable strings. Single words or path fragments.
No sentences, no regular expressions, no generic words like "page" or "data"
that would match everything.

Reply with JSON only:
{ "terms": ["provider", "vendor", "/profile", "practitioner"] }
Between 3 and 10 terms.`

const JUDGING = `You decide whether a capability exists in a codebase.

You are given a claim that something is MISSING, and the results of searching
the repository for every name that thing might go by. The search results are
real: each one is a file path, a line number and the line itself.

Decide whether the search results show the capability EXISTS. Be strict about
what counts:
- Code that implements or routes to it counts.
- A mention in documentation, a to-do list, a comment or a test fixture does
  NOT count. Those describe or plan a thing; they are not the thing.
- A word appearing inside a longer, unrelated word does NOT count.

If it exists, cite the exact file paths from the search results that show it.
You may only cite paths that appear in the results given to you.

If the results do not show it, say so. "The search found nothing that
implements this" is a correct and common answer, and the safe one — saying a
capability exists when it does not hides a real gap.

Reply with JSON only:
{ "present": true, "citations": ["src/pages/ProviderProfile.tsx"], "reason": "..." }
or
{ "present": false, "citations": [], "reason": "..." }`

/** Terms that would match most of any repository, so they prove nothing. */
const TOO_BROAD = new Set([
  'page', 'pages', 'data', 'user', 'users', 'app', 'src', 'api', 'component',
  'components', 'index', 'view', 'views', 'screen', 'screens', 'type', 'types',
  'test', 'tests', 'config', 'util', 'utils', 'lib', 'main', 'id', 'name',
])

/** A term has to be distinctive enough that finding it means something. */
function usable(term: unknown): term is string {
  if (typeof term !== 'string') return false
  const t = term.trim()
  if (t.length < 3 || t.length > 40) return false
  if (TOO_BROAD.has(t.toLowerCase().replace(/^\//, ''))) return false
  // A model asked for search strings sometimes returns a regular expression
  // anyway. Searching for its literal characters finds nothing and reads as
  // evidence of absence, which is the error this whole pass exists to avoid.
  return !/[*+?()\[\]{}|\\^$]/.test(t)
}

/** Files whose content describes a product rather than implementing one. */
const NOT_IMPLEMENTATION = /\.(md|mdx|txt|rst|html?|ya?ml|json|lock)$/i
const TOOLING_DIR = /(^|\/)(docs?|documentation|\.github|__mocks__|fixtures?)\//i

/** Something declared, which is what distinguishes a file that does the thing
 *  from a file that mentions it. Imports are skipped: every file starts with a
 *  wall of them and none of them is what this file is for. */
const DECLARATION = /^\s*(?:export\s+)?(?:async\s+)?(?:function|const|class|interface|type|enum|serve\(|create\s+(?:table|or\s+replace|policy|index))/i

/**
 * The line in this file that best shows what it is for.
 *
 * ── Why the FIRST declaration is the wrong one ───────────────────────────────
 *
 * Taking it gave the model `const EMAIL_RE = /^[^\s@]+@.../` for
 * DeleteAccountPage.tsx and `const STRIPE_SECRET_KEY = Deno.env.get(...)` for
 * the delete-account function. Both true, both incidental, and shown a file
 * named for deletion whose code is an email regex the model answered — fairly —
 * that these were "files named for those concepts but do not contain the actual
 * implementation".
 *
 * What settles it is the declaration that carries the searched word:
 * `export default function DeleteAccountPage()`. So the term is looked for
 * first, and the generic openings are only a fallback.
 */
function declarationIn(text: string, needle: string): { line: number; text: string } | null {
  const lines = text.split('\n')
  const usable = (l: string) => !/^\s*(import|from|\/\/|\*|\/\*|#)/.test(l) && l.trim().length > 0
  const window = Math.min(lines.length, 600)

  const pick = (test: (l: string) => boolean): { line: number; text: string } | null => {
    for (let i = 0; i < window; i++) {
      const line = lines[i]!
      if (!usable(line) || !test(line)) continue
      return { line: i + 1, text: line.trim().slice(0, 160) }
    }
    return null
  }

  const has = (l: string) => l.toLowerCase().includes(needle)
  return pick((l) => DECLARATION.test(l) && has(l))
    ?? pick((l) => /export\s+default/.test(l))
    ?? pick(has)
    ?? pick((l) => DECLARATION.test(l))
    ?? pick(() => true)
}

/**
 * Where these terms appear, in the files that were actually scanned.
 *
 * Deterministic, and deliberately the only source of evidence in this module.
 * Implementation files first and capped per term, because the model reads a
 * fixed budget of results and twenty markdown hits would crowd out the one
 * component that answers the question.
 */
export function search(files: SourceFile[], terms: string[], perTerm = 6): Hit[] {
  const out: Hit[] = []
  const ordered = [
    ...files.filter((f) => !NOT_IMPLEMENTATION.test(f.path) && !TOOLING_DIR.test(f.path)),
    ...files.filter((f) => NOT_IMPLEMENTATION.test(f.path) || TOOLING_DIR.test(f.path)),
  ]
  for (const term of terms) {
    const needle = term.toLowerCase()
    // ── The filename is the strongest hit there is ──
    //
    // A model asked to name a missing capability reaches for ordinary words —
    // "delete", "export", "profile" — and a line containing "delete" is worth
    // almost nothing, while a FILE called DeleteAccountPage.tsx settles the
    // question. Searching content only, with a small per-term cap taken in file
    // order, returned six comments and let the model conclude that POSCHI has
    // no account deletion. It has a page, a component and an edge function.
    //
    // So paths are matched too, and they are collected first, which makes a
    // generic term useful instead of actively misleading.
    const named = ordered
      .filter((f) => f.path.toLowerCase().replace(/[-_/]/g, '').includes(needle.replace(/[-_/]/g, '')))
      .slice(0, perTerm)
    for (const file of named) {
      // ── A filename with no code under it proves nothing ──
      //
      // This used to emit "(the file is named for this: DeleteAccountPage.tsx)"
      // and nothing else. The model is told — correctly — that a mention is not
      // an implementation, so it applied that rule to the placeholder and
      // answered "the only relevant files are named for these actions but
      // contain no actual code to perform them". It had been shown no code
      // because none was sent.
      const decl = declarationIn(file.text, needle)
      out.push({
        path: file.path,
        line: decl?.line ?? 1,
        text: decl
          ? `${decl.text}   ← in a file named for this`
          : `(a file named for this, which this pass could read nothing from)`,
      })
    }

    let found = 0
    for (const file of ordered) {
      if (found >= perTerm) break
      const lines = file.text.split('\n')
      for (let i = 0; i < lines.length && found < perTerm; i++) {
        const line = lines[i]!
        if (!line.toLowerCase().includes(needle)) continue
        // A mention inside a comment is not an implementation, and six of them
        // crowd out the one declaration that would have answered the question.
        if (/^\s*(\/\/|\*|\/\*|#)/.test(line)) continue
        out.push({ path: file.path, line: i + 1, text: line.trim().slice(0, 160) })
        found++
      }
    }
  }
  // One entry per file and line, so a term that is a substring of another does
  // not make the same line look like two independent pieces of evidence.
  const seen = new Set<string>()
  return out.filter((h) => {
    const key = `${h.path}:${h.line}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

interface Options {
  model?: string
  signal?: AbortSignal
  timeoutMs?: number
  /** Called for each finding checked, so the run log shows the work. */
  onChecked?: (id: string, check: AbsenceCheck) => void
}

async function namesFor(f: Finding, model: string, o: Options): Promise<string[]> {
  const raw = await chatJson<{ terms?: unknown }>([
    { role: 'system', content: NAMING },
    {
      role: 'user',
      content: JSON.stringify({ claim: f.title, detail: f.summary.slice(0, 600) }),
    },
  ], { model, temperature: 0, numCtx: 4096, timeoutMs: o.timeoutMs ?? 30_000, signal: o.signal })

  const proposed = Array.isArray(raw?.terms) ? raw.terms.filter(usable) : []
  return [...new Set(proposed.map((t) => t.trim()))].slice(0, 10)
}

/**
 * One absence, checked against the repository.
 *
 * Returns null when nothing could be established — no terms, no model, no
 * answer. Null keeps the finding, which is the safe direction: this pass exists
 * to remove claims that are wrong, never to remove claims it could not read.
 */
async function checkOne(
  f: Finding, files: SourceFile[], model: string, o: Options,
): Promise<AbsenceCheck | null> {
  const terms = await namesFor(f, model, o)
  if (terms.length === 0) return null

  const hits = search(files, terms)
  if (hits.length === 0) {
    // The strongest form of the finding: named several ways, searched, absent.
    return {
      present: false,
      searched: terms,
      citations: [],
      reason: `Searched every scanned file for ${terms.length} names this could go by `
        + `(${terms.join(', ')}). Nothing matched.`,
    }
  }

  const verdict = await chatJson<{ present?: unknown; citations?: unknown; reason?: unknown }>([
    { role: 'system', content: JUDGING },
    {
      role: 'user',
      content: JSON.stringify({
        claim: f.title,
        detail: f.summary.slice(0, 500),
        searched: terms,
        results: hits.slice(0, 40),
      }),
    },
  ], { model, temperature: 0, numCtx: 8192, timeoutMs: o.timeoutMs ?? 45_000, signal: o.signal })

  if (!verdict || typeof verdict.reason !== 'string') return null

  // ── The gate ──
  //
  // A claim that the capability exists is accepted only when the model points
  // at a path the search actually returned. Anything else — a plausible
  // filename it invented, a path from its training, an empty list — is a model
  // that found nothing, and the finding stands.
  const real = new Set(hits.map((h) => h.path))
  const cited = Array.isArray(verdict.citations)
    ? verdict.citations.filter((c): c is string => typeof c === 'string' && real.has(c))
    : []

  if (verdict.present === true && cited.length === 0) return null

  return {
    present: verdict.present === true,
    searched: terms,
    citations: cited,
    reason: verdict.reason.slice(0, 400),
  }
}

/**
 * Every absence in a section, checked.
 *
 * Sequential on purpose. This is a local model on the user's machine, already
 * serving the rewrite and adjudication passes in the same run, and firing forty
 * concurrent requests at it turns a slow report into a failed one.
 */
export async function verifyAbsences(
  findings: Finding[],
  files: SourceFile[],
  o: Options = {},
): Promise<AbsenceChecks> {
  const out: AbsenceChecks = new Map()
  const absences = findings.filter((f) => f.requiresManualValidation)
  if (absences.length === 0) return out

  const status = await modelStatus()
  const model = o.model ?? (status.available ? chooseModel(status, DEFAULT_MODEL) : null)
  // No model means no check. Every absence survives, and the caller says so.
  if (!model) return out

  for (const f of absences) {
    if (o.signal?.aborted) break
    try {
      const check = await checkOne(f, files, model, o)
      if (!check) continue
      out.set(f.id, check)
      o.onChecked?.(f.id, check)
    } catch {
      // One finding that could not be checked is one finding that keeps its
      // place. It must not cost the other thirty-nine theirs.
    }
  }
  return out
}

/** The ids to withdraw: absences the search showed are present after all. */
export function withdrawnBy(checks: AbsenceChecks): Map<string, string> {
  const out = new Map<string, string>()
  for (const [id, c] of checks) {
    if (!c.present) continue
    out.set(id, `${c.reason} Found in ${c.citations.slice(0, 3).join(', ')}.`)
  }
  return out
}
