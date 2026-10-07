// daemon/src/flow-reports/comprehend/adjudicate.ts
//
// Asking whether a measured finding is actually true of this repository.
//
// ── The gap this closes ──────────────────────────────────────────────────────
//
// The analysers are pattern matchers with prose attached. They are good at
// finding candidate evidence cheaply, and they cannot tell what they matched.
// The model ran twice — once to describe the product, once to reword findings
// the patterns had already produced — and neither pass was ever asked the only
// question that decides whether a report is worth reading: does this finding
// hold?
//
// So a portfolio site that bills nobody was told, at high severity, that its
// renewal terms were undisclosed under federal negative-option law. The gate
// had matched six files. Every one of them was the word UNsubscribe in
// newsletter code. Nothing in the pipeline could notice, because nothing in the
// pipeline ever looked at what the match actually was.
//
// This pass does. For each candidate finding it takes the finding, the
// description of the product, and the text around the match in the files the
// finding cites, and asks whether the evidence supports the claim.
//
// ── Biased towards keeping ───────────────────────────────────────────────────
//
// A false positive is an embarrassment. A finding deleted because a 7B model
// misread it is a security or compliance problem shipped silently, which is
// worse. So the model is told to reject only when the evidence plainly
// contradicts the claim, every failure mode keeps everything, and the ones it
// does reject are counted and explained in the report rather than vanishing.
//
// ── What it cannot do ────────────────────────────────────────────────────────
//
// It cannot add a finding, change a severity, edit prose or cite a file. It
// returns a set of ids to withdraw and a reason for each, and the caller matches
// those against what it sent. Anything else that comes back is discarded.

import { chatJson, chooseModel, modelStatus, DEFAULT_MODEL } from './model.js'
import type { ProductModel } from './understand.js'
import type { Finding } from '../types.js'

export interface Verdict {
  /** Why the evidence does not support the finding, in one sentence. Printed. */
  reason: string
}

/** A rejection per finding id. A finding absent from the map survives — which
 *  is what makes every failure path safe. */
export type Verdicts = Map<string, Verdict>

export interface SourceFile { path: string; text: string }

const SYSTEM = `You check whether software audit findings are true of one specific codebase.

For each finding you are given: what was measured, and an excerpt of the code it
was measured from. Decide whether the evidence supports the finding.

Withdraw a finding ONLY when the evidence plainly does not support it. Examples
of plainly not supported:
- The match is a different word that merely contains the searched one (a finding
  about subscriptions whose evidence is the word "unsubscribe" in a mailing list).
- The match is in configuration or tooling unrelated to the product's behaviour
  (a continuous-integration setting, a lockfile, a code comment).
- The match is a label in documentation or a design mock rather than code that runs.
- The finding describes behaviour of a feature that is not in this product at all
  (a claim about the refund flow, in a product with no refunds anywhere).
  This is NOT the same as a finding that simply reports something missing.

Keep the finding when:
- The evidence supports it, even partially.
- The finding reports an ABSENCE and the product plausibly needs the thing.
- You are unsure. Unsure means keep.

You are not judging severity, wording or importance. Only whether the claim is
true here.

Reply with JSON only. List ONLY the findings to withdraw:
{ "withdraw": [ { "id": "...", "reason": "..." } ] }
An empty list is a valid and common answer.`

/** Words that carry no signal when looking for a finding's evidence in a file. */
const STOP = new Set([
  'this', 'that', 'there', 'their', 'with', 'from', 'have', 'been', 'were', 'will',
  'would', 'could', 'should', 'when', 'what', 'which', 'nothing', 'appears', 'exists',
  'code', 'file', 'files', 'source', 'product', 'about', 'into', 'than', 'them',
  'these', 'those', 'only', 'more', 'some', 'they', 'each', 'here', 'does', 'shows',
])

/**
 * The distinctive words of a finding, used to locate its evidence in a file.
 *
 * Deliberately taken from the finding's own wording rather than from the
 * analyser's pattern: the patterns are not exported, and the point is to show
 * the model what a reader of the finding would go looking for.
 */
export function termsOf(f: Finding): string[] {
  const words = `${f.title} ${f.summary}`
    .toLowerCase()
    .replace(/[^a-z0-9_\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 5 && !STOP.has(w))
  return [...new Set(words)].slice(0, 8)
}

/**
 * The text around the best match for a finding, in one file.
 *
 * Returns null when nothing in the file relates to the finding — which is
 * itself worth knowing, and is passed to the model as such.
 */
export function excerpt(text: string, terms: string[], window = 260): string | null {
  const hay = text.toLowerCase()

  const firstOf = (needles: string[]): number => {
    let best = -1
    for (const n of needles) {
      const at = hay.indexOf(n)
      if (at >= 0 && (best === -1 || at < best)) best = at
    }
    return best
  }

  // Whole words first, then a stem — because the case this pass exists to catch
  // is precisely a near-miss. A finding about "subscription" cites a file whose
  // only relevant text is `buildUnsubscribeLink`, and the exact word is not in
  // it. Showing the model nothing would hide the very thing that makes the
  // finding wrong; showing it the stem match puts `Unsubscribe` in front of it.
  const stems = terms.filter((t) => t.length > 7).map((t) => t.slice(0, 6))
  const best = firstOf(terms) >= 0 ? firstOf(terms) : firstOf(stems)
  if (best === -1) return null
  const from = Math.max(0, best - Math.floor(window / 3))
  return text.slice(from, from + window).replace(/\s+/g, ' ').trim()
}

/** What the model sees for one finding: the claim, and the code behind it. */
function brief(f: Finding, byPath: Map<string, string>): Record<string, unknown> {
  const terms = termsOf(f)
  const paths = [...new Set(f.evidence.map((e) => e.path).filter(Boolean))] as string[]

  const evidence = paths.slice(0, 3).map((p) => {
    const text = byPath.get(p)
    if (text === undefined) return { file: p, excerpt: '(file not available)' }
    return { file: p, excerpt: excerpt(text, terms) ?? '(nothing in this file matches the finding)' }
  })

  return {
    id: f.id,
    measured: f.title,
    detail: f.summary.slice(0, 400),
    // ── From the analyser, not from the path count ──
    //
    // This read "paths.length === 0", which conflates "cites no file" with
    // "reports an absence". They are different, and the difference is a whole
    // class of finding: "Console logging appears throughout the production
    // source" counts calls across the repository and cites none of them. Told
    // that finding was an absence, the model duly withdrew it as one — "the
    // evidence list is empty, and the finding reports an absence of console
    // logging" — deleting a true finding on the strength of a label this file
    // had attached itself.
    //
    // The analyser that did the measuring already records which it is.
    reportsAnAbsence: Boolean(f.requiresManualValidation),
    evidence,
  }
}

function validate(raw: unknown, wanted: Set<string>): Verdicts {
  const out: Verdicts = new Map()
  if (!raw || typeof raw !== 'object') return out
  const list = (raw as Record<string, unknown>)['withdraw']
  if (!Array.isArray(list)) return out

  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const id = typeof r['id'] === 'string' ? r['id'] : ''
    // An id nobody sent is a finding the model imagined withdrawing.
    if (!wanted.has(id)) continue
    const reason = typeof r['reason'] === 'string' ? r['reason'].trim() : ''
    // A withdrawal with no reason cannot be printed, and an unexplained
    // deletion is the thing this pass exists to avoid. Kept instead.
    if (!reason) continue
    out.set(id, { reason })
  }
  return out
}

/**
 * How much of a section may be withdrawn at once.
 *
 * A model that rejects everything has misunderstood the task rather than found
 * nine false findings, and the failure looks identical to a clean section. Above
 * this share the whole verdict is discarded and the section stands as measured.
 */
const MAX_WITHDRAWN_SHARE = 0.6

export async function adjudicateSection(
  sectionLabel: string,
  findings: Finding[],
  product: ProductModel,
  files: readonly SourceFile[],
  o: { model?: string; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<Verdicts> {
  if (findings.length === 0) return new Map()

  const status = await modelStatus()
  const name = chooseModel(status, o.model ?? DEFAULT_MODEL)
  if (!name) return new Map()

  const byPath = new Map(files.map((f) => [f.path, f.text]))

  const raw = await chatJson<unknown>([
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: JSON.stringify({
        product: { whatItIs: product.whatItIs, domain: product.domain },
        section: sectionLabel,
        findings: findings.map((f) => brief(f, byPath)),
      }),
    },
  ], { model: name, timeoutMs: o.timeoutMs ?? 180_000, signal: o.signal })

  const verdicts = validate(raw, new Set(findings.map((f) => f.id)))

  // ── An absence is never withdrawn by this pass ────────────────────────────
  //
  // The instructions say to keep one and the model kept withdrawing them
  // anyway, because two of the rules collide on exactly this case: a finding
  // that reports something missing IS "a finding that assumes a capability the
  // product does not have", and that bullet won every time.
  //
  // Measured on a real report, the withdrawals it produced were agreements
  // wearing a rejection: the finding "Make provider signup measurable" was
  // struck with the reason "the evidence does not support that this product can
  // currently measure provider signup funnels" — which is the finding, restated.
  // Nine findings went that way in one run.
  //
  // It is also not a judgement the model is equipped to make. An absence was
  // produced by a detector that searched the whole repository and found
  // nothing; this pass sees excerpts of the files that matched some of the
  // finding's words. Absence of evidence in that sample is not evidence the
  // detector was wrong, so the honest answer is the one the prompt already
  // asks for and this now guarantees.
  const absences = new Set(findings.filter((f) => f.requiresManualValidation).map((f) => f.id))
  for (const id of absences) verdicts.delete(id)

  // ── An observation is not withdrawn either, because it claims nothing ─────
  //
  // This pass asks one question: does the evidence support the claim? An
  // informational finding makes no claim to support. It is a count, a map, or
  // a statement about what the report cannot know — and asked to rule on one,
  // the model reaches for the only frame it has and inverts it.
  //
  // Measured on POSCHI, the same five went every run, before any of this
  // session's changes:
  //
  //   "18 monetization endpoint(s) and page(s)" — struck as "the evidence is
  //   an absence of monetization endpoints and pages, which aligns with the
  //   finding that such features are not present". The finding says eighteen
  //   exist.
  //
  //   "client: 7 of 7 stages have a surface" — struck as "the evidence does
  //   not support the absence of surfaces for client users, as every stage has
  //   a route or an endpoint behind it". The reason is the finding.
  //
  //   "Liquidity is not a question a repository can answer" — the report's own
  //   statement of what it cannot measure, deleted for lacking evidence of the
  //   thing it says cannot be evidenced.
  //
  // Nothing was gained by any of those. An observation cannot be a false
  // positive in the sense this pass guards against: it reports no fault, so
  // there is no fault to be wrong about.
  const observations = new Set(
    findings.filter((f) => f.severity === 'info' || f.type === 'observation').map((f) => f.id))
  for (const id of observations) verdicts.delete(id)

  // ── Nothing shown, nothing ruled on ──────────────────────────────────────
  //
  // This pass decides whether an excerpt supports a claim. A finding that
  // cites no file has no excerpt, so there is no excerpt to weigh and any
  // verdict about it is the model reasoning from the absence of its own input.
  // That is not a judgement about the repository.
  //
  // It is also the safe direction. Findings measured across the whole source
  // rather than at one site — a count of calls, a ratio, a vocabulary spread —
  // are exactly the ones with nothing to cite, and they are true or false for
  // reasons this pass never sees.
  const unshown = new Set(
    findings.filter((f) => f.evidence.every((e) => !e.path)).map((f) => f.id))
  for (const id of unshown) verdicts.delete(id)

  // ── A computed claim is not refutable from three examples ────────────────
  //
  // This pass works because reading the matches can refute the list: six files
  // said "subscription" and every one was the word UNsubscribe. That is a
  // pattern-match finding, and a sample of it is representative.
  //
  // A computed finding is not a list. "24 foreign key(s) have no index on the
  // referencing column" comes from parsing all 514 migrations and comparing the
  // references against the indexes; its twelve citations are examples of a fact
  // established elsewhere. Shown three of them, the model replied that "the
  // evidence provided does not clearly indicate that the foreign keys lack
  // indexes, as some of the excerpts are incomplete" — which is true, and is a
  // statement about what it was given rather than about the schema. It withdrew
  // the finding anyway.
  //
  // The analyser marks these, because only it knows how it measured.
  const derived = new Set(findings.filter((f) => f.computedFromFullParse).map((f) => f.id))
  for (const id of derived) verdicts.delete(id)

  if (verdicts.size > findings.length * MAX_WITHDRAWN_SHARE) return new Map()
  return verdicts
}
