// daemon/src/flow-reports/comprehend/brief.ts
//
// Turning a recommendation into something somebody can build.
//
// ── The gap this closes ──────────────────────────────────────────────────────
//
// The analysers end each finding with a sentence: "Add an error boundary",
// "Route the calls that matter through a logger", "Decide who receives a
// deletion request today". Every one of those is a direction rather than a
// piece of work, and the distance between them is where a report stops being
// acted on — somebody reads it, agrees, and has nowhere to start.
//
// What a reader needs before they can begin is four separate things: what
// should happen and what it is for, what the change must contain, what the
// person using it sees, and what would be wrong to do. They are different
// questions, so this asks for them separately.
//
// ── One question per call, because a bigger job comes back emptier ───────────
//
// The first version asked for intent, requirements, flow, copy and
// considerations together. A 7B model answered the three required fields and
// silently dropped the two optional ones — on every finding, including an
// account-deletion notification that plainly needs both. Tightening the
// instructions made it worse: the extra words about when to include them cost
// the intent its specificity, and "When a user deletes their account, send a
// confirmation email" flattened into "implement self-serve deletion features".
// Asking for flow and copy together then returned the flow and dropped the
// copy, one layer down.
//
// The rewrite pass in this pipeline learned the same thing and its comment says
// so: batching nine findings and three fields each returned three usable of
// nine, while the location pass, which asks one question about one file, works.
//
// So: three calls at most, each asking for one shape, and whether the last two
// run at all is decided here rather than by the model.
//
// ── Nothing here is measured, and it must not pretend to be ──────────────────
//
// The finding is the measurement. This is a proposal written by a model that
// read it, and no part of it was checked against the repository. So the brief
// may not assert that the product already does something, already has a file,
// or already behaves a particular way. It says what should happen, never what
// does — and a brief that opens "the product currently sends a confirmation
// email" is discarded rather than corrected.

import { chatJson, chooseModel, modelStatus, DEFAULT_MODEL } from './model.js'
import { termsOf } from './adjudicate.js'
import type { ProductModel } from './understand.js'
import type { Brief, Finding } from '../types.js'

const SYSTEM = `You turn an audit finding about a codebase into a brief a developer can build from.

You are given one finding and a short description of the product. Write what
should be done about it.

"intent" — two or three sentences. Say what should happen and what it is for.
Where the behaviour has a trigger, lead with it: "When a user disables or
deletes their account, immediately send a confirmation email to the address on
the account. The notification serves as both a record of the request and a
security alert in case the action was not authorised." Where the change has no
user-facing trigger — a schema change, an index, a build step — do not invent
one; say what the change is and where it applies.

"requirements" — 3 to 7 bullets. What the change must contain, concretely
enough that somebody can tick each one off. Name the specific fields, states,
timestamps or conditions. Not "handle errors properly".

"considerations" — 3 to 6 bullets. Constraints, edge cases, and at least one
thing it would be WRONG to do. Security, privacy and failure modes belong here.
Each must say something specific: "use a one-time, time-limited link rather
than restoring from an email click" is a consideration; "avoid unnecessary
complexity" is filler.

Rules:
- Never state that the product already does something, already has a file, or
  already behaves some way. You have not looked. Write what SHOULD happen.
- Where the finding says something is missing and that may be wrong, say the
  first step is to confirm it.
- Do not invent identifiers, file names, table names or SQL you were not given,
  and do not specify index types, column types or library APIs. Describe the
  change; let the developer choose how. Saying "add a unique index" where a
  plain one is meant is the kind of detail that turns a brief into bad advice.
- Be specific to THIS product and THIS finding. A brief that would suit any
  codebase is worth nothing.

Reply with JSON only:
{ "intent": "...", "requirements": ["..."], "considerations": ["..."] }`

/**
 * Sections whose subject is the code's internals rather than the product's
 * behaviour.
 *
 * ── Why this is a list and not a question for the model ──────────────────────
 *
 * The first version asked the model, as a fourth field, whether a person would
 * see anything change. It answered inconsistently between runs of the same
 * finding — the account-deletion brief had a flow on one run and neither flow
 * nor copy on the next — because a boolean tacked onto three prose fields is
 * the first thing a 7B model drops.
 *
 * The category already knows. A finding about an unindexed foreign key or a
 * wildcard type is not something anybody using the product encounters;
 * everything else this report covers describes behaviour somebody meets. Where
 * the model then has nothing to say, the length gates drop what it returns, so
 * a wrong guess here costs a call rather than a page of invention.
 */
const INTERNALS = new Set(['data_architecture', 'engineering_quality'])

/** Build scripts, tooling and configuration — code that ships to nobody. */
const TOOLING = /(^|\/)(scripts?|tools?|bin|build|config|\.github|\.husky)\//i
const TOOLING_FILE = /\.(config|rc)\.[jt]sx?$|\.(sh|ps1|bat|cmd|mjs|ya?ml|toml|ini)$/i

/**
 * Whether every file this finding cites is something only the team ever opens.
 *
 * The category alone was too coarse. `error_log` holds both "a component throws
 * and the person sees a blank page", which somebody plainly experiences, and
 * "catch blocks discard the error they caught", whose three cited files were
 * all build scripts. Told the second was user-facing, the model wrote a
 * customer an email beginning "We've noticed that an unexpected issue occurred
 * in your account" and going on to say "we're updating our codebase to handle
 * errors more effectively" — a release note about a change to a deploy script,
 * addressed to somebody booking an appointment.
 *
 * A finding citing nothing is not excluded: no paths is no evidence either way,
 * and the wrong call there costs two calls rather than a page of invention.
 */
/** How an engineer writes a task, and how a customer never describes their day. */
const ENGINEERING_VERB = /^(?:review|determine|implement|refactor|deploy|configure|migrate|identify|audit|integrate|develop|set up|roll out|unit[- ]test|write (?:a )?tests?|add (?:appropriate|error|logging|a comment)|update (?:the )?(?:code|codebase|logic|implementation)|test (?:changes|the change|thoroughly))/i
const ENGINEERING_TITLE = /\b(codebase|implementation plan|refactor|rollout|migration plan)\b/i

/**
 * Whether this "flow" is a task list for the team rather than a journey for a
 * person.
 *
 * Told to describe what a CUSTOMER moves through, the model still returns the
 * work when the change has no customer in it. The catch-block finding produced
 * "Update Error Handling in Codebase — 1. Review catch blocks throughout the
 * application. 2. Determine if errors should be handled by the user or logged.
 * 3. Add appropriate error handling logic. 4. Test changes" and put the words
 * "Save Changes" on the button at the end of it.
 *
 * Every one of those steps opens with a verb an engineer uses about code, and
 * none of them is something anybody booking an appointment does. Half is the
 * threshold because a genuine journey occasionally contains one such step —
 * "verify your email" — while a task list is made of nothing else.
 */
function isSprintBoard(title: string, steps: string[]): boolean {
  if (ENGINEERING_TITLE.test(title)) return true
  const engineering = steps.filter((s) => ENGINEERING_VERB.test(s.trim())).length
  return engineering * 2 >= steps.length
}

function toolingOnly(f: Finding): boolean {
  const paths = f.evidence.map((e) => e.path).filter(Boolean) as string[]
  if (paths.length === 0) return false
  return paths.every((p) => TOOLING.test(p) || TOOLING_FILE.test(p))
}

// ── One question per call, again ─────────────────────────────────────────────
//
// Asked for the journey and the words together, the model returned the journey
// and dropped the words — the same way it dropped both when they were the
// fourth and fifth fields of one big request. So they are two calls.
//
// Neither prompt contains a usable example of its own output. Given one, a 7B
// model copies it: shown "Secure and restore my account" as an illustration of
// a good call to action, it put those exact words on the button ending an
// account DELETION flow. An example of the register has to be described rather
// than quoted.

const FLOW = `You describe the steps a CUSTOMER moves through.

You are given a finding about a codebase and the intent of a change being made
in response to it. Describe what somebody USING the product does, in order, and
what the product does back.

The person here is a customer or an account holder. It is never the team
building the software. "Review the legal requirements", "design the interface",
"deploy to production" are project tasks, not steps — if your steps could
appear on a sprint board, they are wrong.

"title" — names the journey, in the product's own terms.
"steps" — 2 to 8 steps, alternating what the person does and what the product
does in response. Start from the moment they act.
"cta" — the words on the button or link the person clicks, written as THEY
would read them. It must fit THIS change: a button ending a deletion flow does
not say the same thing as one recovering an account. Five words at most, no
"click here", no placeholder, and nothing a developer would click.

Never say the product already does something. This is what it should do.

Reply with JSON only:
{ "title": "...", "steps": ["...", "..."], "cta": "..." }`

const COPY = `You write the message ONE PERSON receives at the moment something
happens to their account.

You are given a finding about a codebase and the intent of a change being made
in response to it. Somewhere inside that change the product has to say
something to somebody. Find that moment, and write what it says.

"moment" — one short sentence naming exactly when this text appears, from the
reader's side: the instant it lands in front of them. Decide this FIRST. Every
word that follows depends on it.

"title" — what the text is, plainly. A confirmation email. An on-screen notice.
An empty state. Not a subject line, and no placeholders.

"lines" — the text itself. If it is an email, the first line is the subject and
the rest is the body: greeting, what happened, what it means, what to do,
close. Anything the product fills in goes in square brackets: [First Name],
[Date], [Support Email].

This is NEVER an announcement. You are not telling an audience that a feature
has shipped, or describing what the product can now do, or explaining the
company's legal obligations to a customer. These openings are all wrong:
"We are excited to announce", "We've made some important updates", "You can
now", "As part of our commitment to". Every one of them addresses a mailing
list. This addresses one person to whom something has just happened.

Do not thank them for using the service. Do not tell them the change helps the
company comply with anything. Do not sell.

Short — five to eight lines. The register of a bank notice: plain, calm,
specific about what happened and what they can do about it. Never say the
product already does something.

Reply with JSON only:
{ "moment": "...", "title": "...", "lines": ["...", "..."] }`

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length > 0 ? t.slice(0, max) : null
}

const list = (v: unknown, max: number, cap: number): string[] =>
  (Array.isArray(v) ? v : [])
    .map((x) => str(x, cap))
    .filter((x): x is string => x !== null)
    .slice(0, max)

/**
 * Claims about the present tense, which this pass is not entitled to make.
 *
 * It has read a finding and a product description; it has read no code. A brief
 * that opens "the product currently sends a confirmation email" states
 * something nobody checked, in a document whose whole value is that its claims
 * are checkable.
 */
const ASSERTS_PRESENT = /\b(currently|already)\s+(has|have|does|sends?|stores?|supports?|implements?|provides?)\b|\bthe (code|codebase|product|application) (has|already|contains|implements)\b/i

/**
 * Whether the brief is about this finding.
 *
 * The same test the rewrite pass uses: a model that names nothing from the
 * finding has written something generic, and generic advice attached to a
 * specific finding is worse than no advice, because it looks specific.
 */
function grounded(f: Finding, b: Brief): boolean {
  const own = termsOf(f)
  if (own.length === 0) return true
  const text = [b.intent, ...b.requirements, ...b.considerations].join(' ').toLowerCase()
  const matched = own.filter((t) => text.includes(t)).length
  return matched >= Math.min(2, own.length)
}

export type SkipReason = 'no_model' | 'no_reply' | 'incomplete' | 'ungrounded' | 'asserts_present'

export interface BriefOptions {
  model?: string
  timeoutMs?: number
  signal?: AbortSignal
  onSkip?: (reason: SkipReason) => void
}

/**
 * The second call: what a person moves through, and the words they read.
 *
 * Failure here costs the flow and the copy, never the brief. A recommendation
 * with requirements and considerations is already worth printing; one that
 * stops halfway through a sentence is not.
 */
async function surfaceOf(
  f: Finding, intent: string, model: string, o: BriefOptions,
): Promise<Pick<Brief, 'flow' | 'copy'>> {
  const out: Pick<Brief, 'flow' | 'copy'> = {}
  const ask = (system: string) => chatJson<Record<string, unknown>>([
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify({ finding: f.title, intent }) },
  ], { model, temperature: 0, numCtx: 4096, timeoutMs: o.timeoutMs ?? 45_000, signal: o.signal })

  const flow = await ask(FLOW)
  if (flow) {
    const title = str(flow['title'], 120)
    const steps = list(flow['steps'], 8, 300)
    // A flow of one step is not a flow, and a heading over a single line makes
    // the document look padded.
    if (title && steps.length >= 2 && !isSprintBoard(title, steps)) {
      const cta = str(flow['cta'], 60)
      out.flow = cta ? { title, steps, cta } : { title, steps }
    }
  }

  if (o.signal?.aborted) return out

  const copy = await ask(COPY)
  if (copy) {
    const title = str(copy['title'], 120)
    const lines = list(copy['lines'], 14, 400)
    // ── Announcements are thrown away, not trimmed ──
    //
    // The model's pull towards writing a release note is strong: the finding
    // and the intent both describe building something, so it writes the email
    // telling customers it was built. Three prompt revisions reduced it and did
    // not remove it. A first line reading "We've made some important updates to
    // your account settings" is not draft copy for a confirmation email, and
    // printing it under one would be worse than printing nothing.
    const opening = lines.slice(0, 3).join(' ')
    if (title && lines.length >= 2 && !ANNOUNCEMENT.test(opening)) {
      const moment = str(copy['moment'], 200)
      out.copy = moment ? { title, moment, lines } : { title, lines }
    }
  }
  return out
}

/**
 * Openings that address a mailing list rather than the person it happened to.
 *
 * Written out rather than cleverly. The first version contained `we(\ve| have)`,
 * where `\v` is a vertical tab — so "We've made some important updates", the
 * single most common thing this model produces, sailed straight through the
 * guard that existed to catch it.
 */
const ANNOUNCEMENT = new RegExp(
  '\\b(?:'
  + "we(?:'|’)?(?:re|ve| are| have)\\s+"
  + '(?:excited|pleased|thrilled|happy|delighted|made|added|introduced|launched|updated)'
  + '|introducing\\b'
  + '|you can now\\b'
  + '|as part of our (?:ongoing )?commitment'
  + '|new features?:'
  // Nobody using a product is told about its source. Copy that says this is
  // addressed to the wrong reader whatever sentence it opened with.
  + '|our (?:codebase|repository|source code)'
  + '|(?:updating|improving|refactoring) our (?:code|codebase|system)'
  + ')', 'i')

/**
 * One finding, as a brief.
 *
 * Returns null rather than a partial brief. Half of this shape reads as a
 * document somebody abandoned, and the one-line recommendation it would sit
 * beneath is already a complete answer at its own level of detail.
 */
export async function briefFor(
  f: Finding,
  product: ProductModel | null,
  o: BriefOptions = {},
): Promise<Brief | null> {
  const status = await modelStatus()
  const name = chooseModel(status, o.model ?? DEFAULT_MODEL)
  if (!name) { o.onSkip?.('no_model'); return null }

  const raw = await chatJson<Record<string, unknown>>([
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: JSON.stringify({
        product: product ? {
          whatItIs: product.whatItIs,
          domain: product.domain,
          actors: product.actors?.slice(0, 4),
        } : null,
        finding: {
          title: f.title,
          detail: f.summary.slice(0, 600),
          whyItMatters: f.impact.slice(0, 400),
          theDirection: f.recommendation.slice(0, 400),
          reportsSomethingMissing: Boolean(f.requiresManualValidation),
        },
      }),
    },
  ], { model: name, temperature: 0, numCtx: 8192, timeoutMs: o.timeoutMs ?? 60_000, signal: o.signal })

  if (!raw) { o.onSkip?.('no_reply'); return null }

  const intent = str(raw['intent'], 900)
  const requirements = list(raw['requirements'], 7, 400)
  const considerations = list(raw['considerations'], 6, 400)

  // Two of the three are the minimum this is worth printing at. Without
  // requirements it is a restatement of the recommendation in more words.
  if (!intent || requirements.length < 2 || considerations.length < 1) {
    o.onSkip?.('incomplete')
    return null
  }

  const brief: Brief = { intent, requirements, considerations }

  if (ASSERTS_PRESENT.test(brief.intent)) { o.onSkip?.('asserts_present'); return null }
  if (!grounded(f, brief)) { o.onSkip?.('ungrounded'); return null }

  // Only where somebody sees something change. A database index has no flow and
  // no copy, and a model asked for them anyway will produce some.
  if (!INTERNALS.has(f.category) && !toolingOnly(f) && !o.signal?.aborted) {
    try {
      Object.assign(brief, await surfaceOf(f, brief.intent, name, o))
    } catch {
      // The brief stands without them. They are the part a reader can most
      // easily supply themselves.
    }
  }

  return brief
}
