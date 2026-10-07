// daemon/src/flow-reports/comprehend/extract.ts
//
// One file, one question, three fields.
//
// ── Why the previous approach could not work ─────────────────────────────────
//
// The rewrite pass asked a 7B model to do four things in one generation: hold a
// repository in context, name real file paths without inventing any, obey a
// list of negative rules, and write fluent prose about a product it had just
// been told about. Measured against the groundedness check, qwen2.5:7b-instruct
// produced usable output for one finding in five and phi4 for none in five —
// and phi4 took four times as long to fail.
//
// That is not a prompting problem. A model of this size can do exactly one of
// those jobs at a time, and the one it is reliably good at is extraction:
// given a small piece of code, name the thing in it.
//
// ── So the work is split ─────────────────────────────────────────────────────
//
//   The scan and the analysers decide WHICH file matters.  (deterministic)
//   The model says what is wrong with THAT file, as JSON.  (one small job)
//   This module checks the answer against the file.        (deterministic)
//   The caller assembles the sentence and the prompt.      (deterministic)
//
// The path is never generated. It is injected into the question and copied into
// the result, so it cannot be hallucinated — the most common failure of this
// whole idea is removed by construction rather than by checking for it.
//
// The identifier IS generated, so it is verified: an identifier the model
// returns that does not literally occur in the snippet it was shown is
// discarded, and the insight with it. That check is what makes the difference
// between a report that cites code and one that describes code.

import { chatJson, chooseModel, modelStatus, DEFAULT_MODEL } from './model.js'

export interface FileInsight {
  /** Injected, never generated. Repository-relative. */
  file: string
  /** A function, constant, table or component that EXISTS in the snippet. */
  identifier: string
  /** Up to ten words locating it further. May be empty. */
  where: string
}

const SYSTEM = `You are given a short piece of code and a problem that has already
been found in the file it came from. Your only job is to point at the part of
the snippet the problem is about.

You are NOT deciding whether there is a problem. That has been decided. Do not
comment on style, naming, formatting or anything you were not asked about.

Reply with valid JSON only:
{
  "target_identifier": "<the exact name of the function, constant, component, table or route in the snippet that the problem is about>",
  "where": "<up to ten words saying where in it, e.g. 'the catch block' or 'the default export'>"
}

Rules:
- "target_identifier" must be copied character for character from the snippet.
  Do not invent a name, do not tidy it, do not shorten it.
- Choose a real, named thing. Not a keyword, not a type, not a single letter.
- If nothing in this snippet is what the problem is about, reply
  {"target_identifier": ""}. An empty answer is expected and costs nothing.
- Never mention a file path. One was not given to you and you do not need one.`

/** Something that could plausibly be a name in source, and long enough to be
 *  one. Two characters is not a name; it is a fragment of one. */
const IDENTIFIER = /^[A-Za-z_$][\w$]{2,63}$/

/** Words that appear in every snippet and identify nothing. */
const NOT_A_NAME = /^(function|const|let|var|return|import|export|default|class|string|number|boolean|true|false|null|undefined|this|type|interface|async|await|from|new|props|data|value|item|index|error|result)$/i

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/**
 * Check an answer against the code it claims to be about.
 *
 * ── Whole word, not substring ────────────────────────────────────────────────
 *
 * The first version used `snippet.includes(identifier)`, and a model returned
 * `Da` — which passed, because `Da` occurs inside `Data`. The report would then
 * have pointed at a name nobody wrote. A word boundary is the difference
 * between citing code and citing a coincidence.
 */
export function validateInsight(
  raw: unknown,
  file: string,
  snippet: string,
): FileInsight | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  const identifier = str(r['target_identifier'])
  // The model saying "nothing here" is a valid answer and a common one.
  if (!identifier) return null
  if (!IDENTIFIER.test(identifier)) return null
  if (NOT_A_NAME.test(identifier)) return null

  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!new RegExp(`\\b${escaped}\\b`).test(snippet)) return null

  // Ten words was the instruction; anything longer is the model writing prose
  // it was not asked for.
  const where = str(r['where']).split(/\s+/).slice(0, 10).join(' ')

  return { file, identifier, where }
}

/**
 * Ask about one file.
 *
 * Deliberately one call per file rather than a batch: a batch reintroduces the
 * problem this module exists to remove, because the model then has to keep
 * several files apart and attribute each answer to the right one.
 */
/**
 * Is this finding the kind of thing that HAS a location?
 *
 * The deterministic pre-filter, and it runs before any model call. Several
 * findings are inventories rather than problems — "1 test files", "18
 * monetization endpoints", "43 runtime dependencies" — and asking where in the
 * code they are produces an answer that is real and meaningless. Measured: the
 * pipeline pinned "1 test files" to `rgbToHex`, which is a genuine function in
 * a genuine test and has nothing to do with the count.
 *
 * Informational findings are excluded for the same reason, and absences because
 * there is nothing to point at when the finding is that something is missing.
 */
export function worthLocating(f: {
  severity: string
  title: string
  requiresManualValidation?: boolean
  evidence: Array<{ path?: string }>
}): boolean {
  if (f.severity === 'info') return false
  if (f.requiresManualValidation) return false
  if (!f.evidence.some((e) => e.path)) return false
  // A title that opens with a count is a measurement, not a defect.
  if (/^\d+[\d,]*\s/.test(f.title)) return false
  return true
}

export async function insightFor(
  file: string,
  snippet: string,
  /** The problem the analysers already found. The model is not asked to judge
   *  whether it is real — only to say which part of this snippet it concerns. */
  problem: string,
  o: { model?: string; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<FileInsight | null> {
  if (!snippet.trim() || !problem.trim()) return null

  const status = await modelStatus()
  const name = chooseModel(status, o.model ?? DEFAULT_MODEL)
  if (!name) return null

  const raw = await chatJson<unknown>([
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `Problem already found in this file:\n${problem.slice(0, 400)}\n\n`
        + `Snippet:\n${snippet.slice(0, 2_000)}`,
    },
  ], { model: name, timeoutMs: o.timeoutMs ?? 60_000, signal: o.signal })

  return validateInsight(raw, file, snippet)
}

// ── Assembly, in code ───────────────────────────────────────────────────────
//
// The model writes no part of the report and no part of any prompt. It supplies
// one validated name; the claim comes from the analyser that found it and the
// path comes from the scan. Everything a reader sees is joined together here,
// which is the only way each of those three parts is guaranteed to be what it
// says it is.
//
// This division is what the earlier version got wrong. Asked to name the
// problem as well as locate it, the model reported that a constant should be
// camelCase (it should not), that `motion` from framer-motion is "imported
// incorrectly and should be motions" (it is not), and that an object was "too
// verbose" (an opinion). Every one of those was confidently wrong, and none of
// them was a thing anybody had asked about.

/** The line a finding gains: the claim, pinned to a name in a file. */
export function insightSentence(i: FileInsight, problem: string): string {
  const claim = problem.replace(/\s+/g, ' ').replace(/\.$/, '')
  const at = i.where ? `, in ${i.where}` : ''
  return `In \`${i.file}\`, at \`${i.identifier}\`${at}: ${claim}.`
}

/**
 * A prompt that can be run without being edited first.
 *
 * Built from validated parts: a path from the scan, a name verified to occur in
 * that file, and the analyser's own statement of what is wrong.
 */
export function insightPrompt(i: FileInsight, problem: string, action: string): string {
  return [
    `Open ${i.file} and fix ${i.identifier}.`,
    '',
    `What was found: ${problem.replace(/\s+/g, ' ')}`,
    i.where ? `Where: ${i.where}.` : '',
    `What to do: ${action.replace(/\s+/g, ' ')}`,
    '',
    'Constraints:',
    `- Change ${i.identifier} and whatever it needs. Do not reformat the rest of the file.`,
    '- Keep the behaviour that is not the subject of this change.',
    '- If this area has tests, run them afterwards.',
    '',
    `Acceptance: the problem above no longer holds at ${i.identifier}, and nothing`,
    `else in ${i.file} changed.`,
  ].filter((l) => l !== '').join('\n')
}
