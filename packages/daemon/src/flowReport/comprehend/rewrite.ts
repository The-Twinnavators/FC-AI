// daemon/src/flow-reports/comprehend/rewrite.ts
//
// Saying a measured finding in this product's own words.
//
// ── What this fixes ──────────────────────────────────────────────────────────
//
// Every sentence in a finding — the title, the reason, the recommendation, the
// steps — came from a fixed catalogue written in advance. The measurements
// varied per repository; the words did not. Run against three unrelated
// projects the same paragraphs came out, because a template that must fit any
// repository can only say what somebody anticipated about all of them.
//
// This takes the finding that was measured, plus the description of what the
// product is, and rewrites the prose for THAT product: its actors, its
// entities, its flows.
//
// ── The measurement is not up for rewriting ──────────────────────────────────
//
// The model receives the finding and returns prose. It cannot change a
// severity, cannot cite a file, cannot add a finding and cannot remove one:
// the caller matches what comes back to the findings it sent by id and discards
// anything else. Evidence, paths, counts and scores are untouched, and the
// analyser's own statement is still printed beside the rewrite — so a reader
// can always see what was measured next to what was said about it.
//
// That boundary is the whole reason this is safe. A model that could introduce
// a finding would make the report unfalsifiable; a model that can only
// paraphrase one cannot invent a problem, only describe a real one badly.
//
// ── Failure is silent, per finding ───────────────────────────────────────────
//
// If the model is unreachable, times out, or returns something that does not
// match, that finding keeps its catalogue prose. `onSkip` reports which of the
// four stages declined it, because "no prose" otherwise looks the same whether
// nothing is installed or the groundedness gate is working.
//
// ── Telling a model that silence is free buys a lot of silence ───────────────
//
// This prompt used to say four separate times that returning nothing was
// expected and cost nothing, and it carried a list headed "Your reply is
// REJECTED for a finding if...". The intent was a high bar. The effect was an
// escape hatch with a sign on it.
//
// Measured over 37 findings: 11 rewrites kept, 2 rejected by the groundedness
// gate, and 24 — sixty-five per cent — returned as an empty object. Every one
// of those came back in 133 to 251 milliseconds, far too fast to have generated
// anything. The model was not failing the task; it was declining it, because it
// had been told repeatedly that declining was the safe move.
//
// The bar itself was never the problem, so the requirements are unchanged and
// `grounded()` still throws out prose that names nothing real. What changed is
// that the exit is stated once and narrowly — when the evidence is empty or
// unrelated — instead of being advertised as costless in four places.

import { chatJson, chooseModel, modelStatus, DEFAULT_MODEL } from './model.js'
import type { ProductModel } from './understand.js'
import { termsOf, excerpt } from './adjudicate.js'
import type { Finding } from '../types.js'

/** The prose a rewrite may replace. Nothing structural is in here. */
export interface TailoredText {
  /**
   * What the finding means here, in ordinary words.
   *
   * ── The title is not in here, and was ─────────────────────────────────────
   *
   * The model used to rewrite the heading too, and it made it worse every time.
   * Measured: "Every link previews the same, because the tags are static"
   * became "Static Link Previews for Design System Tooling" — a label where
   * there had been a sentence that says what is wrong. The measured title is
   * the finding's claim and it now always stands as the heading.
   */
  whatItMeans: string
  /** Why it matters to THIS product, naming its own actors and flows. */
  whyItMatters: string
  /** Ordered, concrete, and about this codebase. */
  whatToDo: string[]
}

export const SYSTEM = `You rewrite software audit findings so they are about one specific product.

You are given a description of a product and a list of findings measured in its
code. For each finding, rewrite the prose so it speaks about THIS product — its
users, its data, its flows — instead of software in general.

Rules you must not break:
- Never change what was found. The measurement is fixed: same problem, same
  files, same severity. You are changing the words, not the claim.
- Never mention a file, a count or a number that is not in the finding you were
  given.
- Use ONLY the product's own vocabulary — the actors and entities you were
  given. If the finding you are rewriting uses words that do not belong to
  this product (for example it talks about bookings, providers or stylists and
  this product has none of those), drop those words entirely. Never carry a
  noun across from the finding's wording into yours.
- If a finding has nothing to do with this product's domain, say it plainly and
  briefly rather than inventing a connection.
- "whatToDo" is 2 to 4 concrete steps for this codebase. No generic advice.

You are shown the code each finding was measured from. Write the rewrite from
that code. Name what you see in it — a file, a function, a table, a route, or
one of this product's own entities — and say what happens in THIS product when
the problem bites.

Write all three fields. The evidence in front of you is what makes this
possible: you are not being asked to know anything about the product beyond
what you have been given, only to read the excerpt and say what it shows.

Aim above these sentences, which are true of every product ever written and so
say nothing about this one:
  "This could expose sensitive information if the repository is compromised."
  "This could lead to unexpected costs for heavy users."
  "Duplicate content can confuse search engines."
The difference is a named thing from the evidence. "Sensitive information could
be exposed" is the first kind; "the service-role key in
supabase/functions/sync/index.ts is compared with ===" is the second.

"whatToDo" is 2 to 4 changes to named parts of this code, not standard practice
like adding tests, setting up CI or improving documentation.

You are given ONE finding and the code it was measured in. Do not restate its
title; that is fixed and stays as written.

Always reply with all three fields, filled in:
{ "whatItMeans": "...", "whyItMatters": "...", "whatToDo": ["...", "..."] }

Do not judge whether your answer is good enough to send. Write the best rewrite
the evidence supports and send it. Something else checks it afterwards.`

/**
 * Why a rewrite was not kept.
 *
 * Reported rather than inferred. "No prose" has four quite different causes —
 * no model, no reply, an incomplete reply, and a reply that named nothing real
 * — and they call for opposite responses: the first is an installation
 * problem, the last is the gate working as intended. Measuring which one is
 * happening is the only way to tell a broken write-up from a strict one.
 */
export type SkipReason = 'no_model' | 'no_reply' | 'incomplete' | 'ungrounded'

export interface RewriteOptions {
  model?: string
  timeoutMs?: number
  signal?: AbortSignal
  /** Called when a rewrite is declined, with the stage that declined it. */
  onSkip?: (reason: SkipReason) => void
}

/**
 * The code to show for one cited file.
 *
 * ── Why this does not reuse the adjudicator's answer ─────────────────────────
 *
 * `excerpt` looks for the finding's own words in the file and returns null when
 * it finds none. For the adjudicator that null IS the answer — a finding whose
 * cited file contains nothing resembling it is a finding worth withdrawing, and
 * it must keep seeing "(nothing in this file matches)".
 *
 * Here the question is different, and the same null was being passed straight
 * through as that sentence. Measured over 37 findings: 22 of them had EVERY
 * cited excerpt replaced by it. The model was told to name something real from
 * the code and then shown no code, thirty times out of thirty-seven — and its
 * rewrites were then rejected for naming nothing real.
 *
 * The mismatch is structural rather than a bug in either function. An analyser
 * matches a regex — a placeholder marker, a money path, a file over 800 lines —
 * and the finding's TITLE then describes that in English. "32 money path(s)
 * carry a placeholder marker" shares no word with the code that produced it, so
 * searching the file for the title's words was never going to land.
 *
 * So when the search finds nothing, the opening of the file is shown instead.
 * It is honestly labelled as the opening rather than as a match, and it gives
 * the model real imports, real declarations and a real file to write about.
 */
function excerptFor(text: string, terms: string[]): string {
  const found = excerpt(text, terms)
  if (found) return found
  if (!text.trim()) return '(this file is empty)'

  // Skip a leading licence or file-header comment: it is the least
  // characteristic part of any file and would make every fallback look alike.
  const lines = text.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i] ?? ''
    if (line.trim() && !/^\s*(\/\/|\/\*|\*|#|<!--)/.test(line)) break
    i++
  }

  const head = lines.slice(i, i + 12).join(' ').replace(/\s+/g, ' ').trim()
  return head
    ? `(no line matches the finding's wording; this is the start of the file) ${head.slice(0, 300)}`
    : '(this file is only comments or blank lines)'
}

/** What the model is shown about one finding. Deliberately small: it needs the
 *  claim and where it lives, not the catalogue prose it is replacing. */
export function describe(f: Finding, byPath: Map<string, string>): Record<string, unknown> {
  const paths = [...new Set(f.evidence.map((e) => e.path).filter(Boolean))] as string[]
  const terms = termsOf(f)
  return {
    id: f.id,
    measured: f.title,
    detail: f.summary,
    severity: f.severity,
    files: paths.slice(0, 6),
    // The code itself, which this pass never had. Without it the model could
    // only restate the finding in other words, and measured across three
    // reports that is exactly what it did — every rewrite a true sentence about
    // the problem class and nothing about the product in front of it.
    evidence: paths.slice(0, 3).map((p) => ({
      file: p,
      excerpt: excerptFor(byPath.get(p) ?? '', terms),
    })),
    currentRecommendation: f.recommendation,
  }
}

/**
 * Does this rewrite say anything the catalogue did not?
 *
 * The prose it replaces was written with care. A rewrite that names nothing
 * from this product or this codebase is not a tailoring of it, it is a blander
 * copy — and because every one comes from the same model with the same
 * instructions, a report full of them reads exactly like every other report.
 *
 * So a rewrite has to mention something real: one of the product's own actors,
 * entities or flows, or a file the finding actually cites. Where it does not,
 * the catalogue wording stands.
 */
const TOO_GENERIC = new Set([
  'user', 'users', 'admin', 'admins', 'data', 'page', 'pages', 'site', 'app',
  'application', 'system', 'service', 'services', 'product', 'content', 'account',
  'accounts', 'customer', 'customers', 'item', 'items', 'thing', 'things',
])

/**
 * Does this rewrite say anything the catalogue did not?
 *
 * ── It has to name the CODE, not the description ─────────────────────────────
 *
 * An earlier version accepted a match against the product's own nouns, and the
 * loophole was immediate: "users share links to specific screens in their
 * design system" cleared it on the phrase "design system", while saying nothing
 * that could not be said of any website. The description is what the model was
 * just told; repeating it is not evidence of having read anything.
 *
 * So the test is a file this finding cites, or the identifier the location pass
 * verified in that file. Both are things that exist in the repository and
 * nowhere else.
 *
 * ── And a finding that cites nothing is not thereby ungrounded ───────────────
 *
 * That rule had no answer for an absence. "No in-product way to report a
 * problem was found" cites no file because there is no file — that is the
 * finding — so its anchor list came out empty, `anchors.some` was false by
 * construction, and every rewrite of it was discarded however good it was.
 *
 * Measured on a real report: 14 of 40 findings had no citable anchor, and all
 * 14 lost their prose. Whole sections went with them — compliance, role
 * journeys and security QA each came back with none — and the page showed
 * catalogue wording with nothing to say a rewrite had been attempted and
 * thrown away. Absences are a large share of what these reports find, so this
 * was not an edge.
 *
 * Where there is nothing to cite, the test falls back to the finding's OWN
 * distinctive terms — `termsOf`, which already drops words under five letters
 * and the stop list. Deliberately not the product description: that is the
 * loophole the note above describes, and it stays shut. This asks something
 * narrower — that the prose engage with what THIS finding measured rather than
 * with the subject in general.
 */
function grounded(t: TailoredText, f: Finding): boolean {
  const hay = `${t.whatItMeans} ${t.whyItMatters} ${t.whatToDo.join(' ')}`.toLowerCase()

  const anchors = [
    ...(f.evidence.map((e) => e.path).filter(Boolean) as string[])
      .flatMap((p) => [p.toLowerCase(), p.split('/').pop()!.toLowerCase().replace(/\.[^.]+$/, '')]),
    ...(f.located ? [f.located.identifier.toLowerCase()] : []),
  ].filter((n) => n.length >= 4)

  // Something to cite: cite it. This is the strong test and it is unchanged.
  if (anchors.length > 0) return anchors.some((n) => hay.includes(n))

  // Nothing to cite. Two of the finding's own terms, so a single word shared by
  // coincidence does not clear it — but scaled, because a short finding does
  // not have two to give. "No licence was found" yields one distinctive term,
  // and a fixed threshold of two made it unpassable for the same reason the
  // file rule was: the bar was set above what the finding could ever supply.
  //
  // A finding with no distinctive terms at all still fails, and should: there
  // is nothing there to have written about.
  const own = termsOf(f).filter((w) => !TOO_GENERIC.has(w))
  if (own.length === 0) return false
  return own.filter((w) => hay.includes(w)).length >= Math.min(2, own.length)
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** One reply, for one finding. Nothing is keyed by id because nothing else was
 *  sent — which removes the whole class of a reply attached to the wrong one. */
function validate(raw: unknown): TailoredText | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  const whatItMeans = str(r['whatItMeans'])
  const whyItMatters = str(r['whyItMatters'])
  const whatToDo = Array.isArray(r['whatToDo'])
    ? (r['whatToDo'] as unknown[]).map(str).filter((x) => x !== '').slice(0, 5)
    : []

  // Partial prose is worse than none: half a rewrite beside half the catalogue
  // reads as two documents spliced together.
  if (!whatItMeans || !whyItMatters || whatToDo.length === 0) return null
  return { whatItMeans, whyItMatters, whatToDo }
}

/**
 * Rewrite ONE finding.
 *
 * ── Why not a section at a time ──────────────────────────────────────────────
 *
 * It was, and the batch was the problem. The SEO section handed the model nine
 * findings in one call and asked for three fields each — twenty-seven pieces of
 * prose in a single generation — and three of the nine came back usable. The
 * location pass, which asks one question about one file, works. The difference
 * is the size of the job, not the prompt.
 *
 * Returns null on any failure, and the caller keeps the analyser's wording —
 * which measured better than the rewrite in every side-by-side comparison so
 * far. Producing nothing here is a good outcome, not a degraded one.
 */
export async function rewriteFinding(
  finding: Finding,
  product: ProductModel,
  /** The scanned files, so the model can see the code it is writing about. */
  files: ReadonlyArray<{ path: string; text: string }> = [],
  o: RewriteOptions = {},
): Promise<TailoredText | null> {
  const status = await modelStatus()
  const name = chooseModel(status, o.model ?? DEFAULT_MODEL)
  if (!name) { o.onSkip?.('no_model'); return null }

  const byPath = new Map(files.map((f) => [f.path, f.text]))

  const raw = await chatJson<unknown>([
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: JSON.stringify({
        product: {
          whatItIs: product.whatItIs,
          domain: product.domain,
          entities: product.entities,
        },
        finding: describe(finding, byPath),
      }),
    },
  ], { model: name, timeoutMs: o.timeoutMs ?? 90_000, signal: o.signal })

  if (!raw) { o.onSkip?.('no_reply'); return null }
  const text = validate(raw)
  if (!text) { o.onSkip?.('incomplete'); return null }
  if (!grounded(text, finding)) { o.onSkip?.('ungrounded'); return null }
  return text
}
