// daemon/src/flow-reports/analyzers/launchChecks.ts
//
// The pre-launch checklist, as measurements rather than as a list to tick.
//
// ── Why these live beside the existing analysers rather than in a section ────
//
// The checklist this implements is organised by the same nine concerns the
// report already has sections for — errors, telemetry, engineering quality,
// monetization, SEO, journeys, competitive position, compliance, security. A
// "launch readiness" section would therefore say a second time what those
// sections already say, and the standing instruction on this report is not to
// report the same thing twice.
//
// So each check is attached to the section that already owns its subject, and
// only the checks that were MISSING from those sections are here. Alt text,
// robots.txt, error boundaries, console noise, hardcoded secrets, route guards
// and row-level security are all already measured elsewhere and are absent from
// this file on purpose.
//
// ── What a check may claim ───────────────────────────────────────────────────
//
// Only what a file can show. "Loading states exist" is checkable; "the loading
// state feels fast" is not, and a checklist item that cannot be measured is
// left out rather than guessed at — the omissions are listed at the bottom of
// this file so the gap is a decision rather than an oversight.
//
// Every signal is identifier-shaped or a path, matched against code rather than
// prose. The reason is written across the compliance analyser in detail: a gate
// spelled `/\bsubscription|subscribe\b/i` matched the word UNsubscribe in a
// newsletter and put federal billing law into a report for a site that bills
// nobody.

import type { PoschiCommonFinding } from './normalize.js'
import type { Effort } from '../types.js'

export interface SourceFile { path: string; text: string }

/** Implementation, not documents describing it. */
const CODE = /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte|astro|py|rb|go|php|cs|java|kt)$/i
/** Anything served to a browser, where a tag or an asset would live. */
const MARKUP = /\.(html?|ejs|hbs|liquid|astro|vue|svelte|tsx|jsx)$/i

const codeOf = (files: SourceFile[]): SourceFile[] => files.filter((f) => CODE.test(f.path))
const markupOf = (files: SourceFile[]): SourceFile[] => files.filter((f) => MARKUP.test(f.path))

const someFile = (files: SourceFile[], p: RegExp): boolean => files.some((f) => p.test(f.text))
const filesWith = (files: SourceFile[], p: RegExp, cap = 3): string[] => {
  const out: string[] = []
  for (const f of files) {
    if (p.test(f.text)) out.push(f.path)
    if (out.length >= cap) break
  }
  return out
}
const hasPath = (files: SourceFile[], p: RegExp): string | null =>
  files.find((f) => p.test(f.path))?.path ?? null

/**
 * Two signals, close enough together to be about each other.
 *
 * ── Why the same file is not good enough ─────────────────────────────────────
 *
 * Measured against this repository: a 2,000-line trading module was reported as
 * building a token with `Math.random()`. It builds internal record ids with it,
 * and the word that made it match — "secret" — is an API credential thirteen
 * hundred lines away. Both signals were true and the finding was not.
 *
 * So a check that needs two things asks for them within a window of each other,
 * which in practice means the same function. It is the same failure this file's
 * header describes — a gate that matched a word rather than a thing the code
 * does — arrived at from the other direction.
 */
function near(text: string, anchor: RegExp, context: RegExp, window = 300): boolean {
  const scan = new RegExp(anchor.source, anchor.flags.includes('g')
    ? anchor.flags : `${anchor.flags}g`)
  for (let m = scan.exec(text); m !== null; m = scan.exec(text)) {
    const from = Math.max(0, m.index - window)
    if (context.test(text.slice(from, m.index + m[0].length + window))) return true
    // A zero-length match would spin here for ever.
    if (m.index === scan.lastIndex) scan.lastIndex += 1
  }
  return false
}

/** The files where two signals sit close enough together to be related. */
const filesWhereNear = (
  files: SourceFile[], anchor: RegExp, context: RegExp, cap = 3, window = 300,
): string[] => files.filter((f) => near(f.text, anchor, context, window))
  .map((f) => f.path).slice(0, cap)

/**
 * Is a named service actually wired in, as opposed to mentioned?
 *
 * ── Why a bare name is not evidence ──────────────────────────────────────────
 *
 * Measured, after writing the first version of this file: a project was
 * reported at high severity as taking payment with no subscription-lifecycle
 * handling, and as sending user input to an AI model without disclosing it. Its
 * only occurrences of `stripe` and `openai` were two strings inside an array of
 * package names in a build script. It integrates neither.
 *
 * A service is used when it is imported, constructed, called, or reached over
 * the network. That is what these look for and nothing else. The same mistake —
 * a gate matching a word rather than an integration — is written up at length
 * in the compliance analyser, and it is the most common way this report has
 * said something untrue.
 */
function integrated(files: SourceFile[], names: string[], extra: RegExp[] = []): boolean {
  const alt = names.join('|')
  const patterns = [
    new RegExp(String.raw`(?:from|require\(|import\()\s*['"]@?[\w./-]*(?:${alt})[\w./-]*['"]`, 'i'),
    new RegExp(String.raw`\bnew\s+(?:${alt})\s*\(`, 'i'),
    new RegExp(String.raw`\b(?:${alt})\s*\.\s*[a-z]\w*\s*\(`, 'i'),
    new RegExp(String.raw`\b(?:api|app|cdn|js|www)\.(?:${alt})\.(?:com|io|net|ai)`, 'i'),
    new RegExp(String.raw`\b(?:${alt})_[A-Z_]{3,}\b`, 'i'),
    ...extra,
  ]
  return files.some((f) => patterns.some((r) => r.test(f.text)))
}

/**
 * A thing the checklist expects, which either exists or does not.
 *
 * Absence is the finding. Where something exists the check is silent rather
 * than congratulatory — a report that lists what is fine buries what is not,
 * and the sections that do report presence (SEO's Open Graph, quality's tests)
 * already had a reason to.
 */
interface Missing {
  id: string
  area: string
  title: string
  severity: PoschiCommonFinding['severity']
  detail: string
  next: string
  /** Null where a coding prompt is the wrong answer — a decision, a purchase,
   *  a conversation with a lawyer. */
  prompt?: string | null
  /** True when the check fires. */
  absent: boolean
  /** What was looked for, named so a reader can check the call. */
  lookedFor: string
  /** Where it was found, when something partial was. */
  files?: string[]
  /**
   * What made it fire.
   *
   * Most of these are absences and that is the default. Some are the opposite —
   * source maps switched on, a weak hash, a secret in a Dockerfile — and those
   * must not be described as "nothing matching this was found in the files that
   * were read", which is what an absence prints. It is the same sentence
   * inverted, and printed over a match it is simply false.
   */
  kind?: 'absence' | 'presence'
}

/**
 * What a check costs to act on, where the check can honestly say.
 *
 * ── Why a table, and why it is short ─────────────────────────────────────────
 *
 * Every absence here cites no file, because the thing is absent — so nothing
 * downstream can tell "add four meta tags" from "build an availability system".
 * Left to a guess they came out identical, and the plan printed "a change to
 * how something is built" over work its own recommendation called minutes.
 *
 * Each entry below is a size the check's own `next` already asserts: SEO-002
 * says "is the whole job", SEO-004 says one image generates every size, TEL-002
 * says one button is enough to start. Nothing here is a new judgement — it is
 * the sentence already printed, in a field the report can read.
 *
 * An id missing from this table is unsized on purpose, and QUA-002 is the case
 * worth keeping in mind: its recommendation is "turn it on and read the errors
 * before fixing any of them — the count tells you whether this is an afternoon
 * or a project". A check that says it cannot size the work must not be given a
 * size here, and the plan says "effort not established" rather than inventing
 * one.
 */
const EFFORT: Record<string, Effort> = {
  'LX-QUA-001': 'low',  // "the cheapest documentation in a codebase"
  'LX-TEL-001': 'medium', // three or four events, instrumented end to end
  'LX-TEL-002': 'low',  // "One button that opens a form ... is enough to start"
  'LX-SEO-001': 'low',  // a robots.txt and a sitemap
  'LX-SEO-002': 'low',  // "One Organization ... block on the landing page is the whole job"
  'LX-SEO-003': 'low',  // a manifest file
  'LX-SEO-004': 'low',  // "One square image at 512px generates every size that is needed"
  'LX-SEO-005': 'low',  // "Set it from the current path"
  'LX-JRN-001': 'medium', // one identity provider, integrated
  'LX-JRN-002': 'low',  // "Say what goes here and give the button"
  'LX-JRN-003': 'low',  // "Reserve the space the content will take"
}

function toFinding(m: Missing): PoschiCommonFinding {
  const presence = m.kind === 'presence'
  return {
    id: m.id,
    area: m.area,
    title: m.title,
    severity: m.severity,
    // An absence is "nothing in the files matches", which is indicated rather
    // than verified: a thing configured outside the repository, or in a dialect
    // this does not read, is invisible to it. A presence is a line that is
    // there and can be quoted, but what it is FOR is still an inference — a
    // weak hash over a cache key is not a weak hash over a password — so
    // neither is claimed as verified.
    confidence: 'indicated',
    detail: m.detail,
    files: m.files ?? [],
    because: presence
      ? `Read from the files. Matched ${m.lookedFor}. What the match is used for is not `
        + 'something a pattern can settle, so the lines are cited rather than judged.'
      : `An absence. Looked for ${m.lookedFor}, in the files that were scanned. `
        + 'Something configured outside this repository — in a hosting dashboard, a CDN, or a '
        + 'framework convention this does not recognise — would not appear here.',
    next: m.next,
    isAbsence: !presence,
    prompt: m.prompt ?? null,
    // Omitted, not defaulted, for a check the table does not size.
    ...(EFFORT[m.id] ? { effort: EFFORT[m.id] } : {}),
  }
}

const collect = (checks: Missing[]): PoschiCommonFinding[] =>
  checks.filter((c) => c.absent).map(toFinding)

// ── 1. Errors and operational stability ─────────────────────────────────────

export function errorStabilityChecks(files: SourceFile[]): PoschiCommonFinding[] {
  const code = codeOf(files)

  // A network call is the most common thing in a front end that can fail, and
  // the failure is invisible unless something catches it.
  const callsNetwork = filesWith(code, /\b(fetch\(|axios\.|useSWR\(|useQuery\()/, 6)
  const handlesFailure = someFile(code, /\bcatch\s*[({]|\.catch\(|\bonError\b|\berror\s*:\s*\(|isError\b/)

  const cleansUp = someFile(code, /useEffect\([\s\S]{0,600}?return\s*\(?\s*\(\)\s*=>|removeEventListener|clearInterval|clearTimeout|AbortController|\.unsubscribe\(/)
  const schedules = someFile(code, /\b(setInterval|addEventListener|setTimeout)\s*\(/)

  const validatesInput = someFile(code, /\b(zod|yup|joi|valibot|superstruct|class-validator)\b|\bmaxLength\b|\bmaxlength\b|\baccept\s*=\s*['"][^'"]*\/|\bmaxSize\b|\bMAX_FILE/i)
  const takesInput = someFile(code, /<(input|textarea|form)\b|\btype\s*=\s*['"]file['"]|multipart\/form-data/i)

  return collect([
    {
      id: 'LX-ERR-001',
      area: 'When a request fails',
      title: 'Network calls are made and nothing in the code handles a failure',
      severity: callsNetwork.length > 0 ? 'high' : 'info',
      absent: callsNetwork.length > 0 && !handlesFailure,
      lookedFor: 'a catch, a .catch(), an onError handler or an isError branch beside the calls',
      files: callsNetwork,
      detail: 'Requests are made to a server and nothing was found that deals with the request '
        + 'failing. A failure then reaches the person as a screen that does not change, which is '
        + 'indistinguishable from the product being slow — so they wait, then retry, then leave. '
        + 'The cost is not the error; it is that nobody can tell an error happened.',
      next: 'Decide what each failing call should show. A message the person can act on beats a '
        + 'spinner that never stops, and beats a blank panel.',
      prompt: [
        'Add failure handling to the network calls in this application.',
        '',
        'Requests are made and nothing handles a failure, so a failed request currently looks',
        'identical to a slow one.',
        '',
        '1. Find every place the application calls a server.',
        '2. Give each one an explicit failure branch. It must produce something the person can',
        '   see — an inline message, a toast, an error state on the component — never a silent',
        '   return and never an empty screen.',
        '3. Distinguish "the request failed" from "there is nothing here". An empty list and a',
        '   broken request must not render the same way.',
        '',
        'Do not add a global catch that swallows everything into one generic banner: a person who',
        'cannot tell which action failed cannot retry the right one.',
        '',
        'Acceptance: every call has a failure path that renders; no failure path is silent.',
      ].join('\n'),
    },
    {
      id: 'LX-ERR-002',
      area: 'Work left running',
      title: 'Timers and listeners are started and nothing was found that stops them',
      severity: 'medium',
      absent: schedules && !cleansUp,
      lookedFor: 'an effect cleanup return, removeEventListener, clearInterval, clearTimeout, '
        + 'an AbortController or an unsubscribe call',
      detail: 'Intervals, timeouts or event listeners are registered and no matching teardown was '
        + 'found. Each one outlives the screen that created it, so moving quickly between screens '
        + 'leaves several copies running at once — the tab grows slower the longer it is open, '
        + 'and a response can arrive for a screen the person already left.',
      next: 'Pair every subscription with its teardown at the point it is created, rather than '
        + 'hunting them later — the ones that leak are the ones written far from their cleanup.',
      prompt: null,
    },
    {
      id: 'LX-ERR-003',
      area: 'What a person can submit',
      title: 'Input is accepted and no validation constraint was found',
      severity: 'medium',
      absent: takesInput && !validatesInput,
      lookedFor: 'a schema validator (zod, yup, joi, valibot), a maxLength, a file accept type '
        + 'or a size limit',
      detail: 'Forms or uploads accept input and nothing was found that bounds it — no length '
        + 'limit, no accepted file types, no size ceiling. Unbounded input is the cheapest way to '
        + 'break a backend: a very long string, a very large file, or a type nothing downstream '
        + 'can read.',
      next: 'Bound it on the server as well as in the form. A limit enforced only in the browser '
        + 'is a suggestion.',
      prompt: null,
    },
  ])
}

// ── 2. Product intelligence and telemetry ───────────────────────────────────

export function telemetryChecks(files: SourceFile[]): PoschiCommonFinding[] {
  const code = codeOf(files)

  // A third-party SDK, or a tracker the product wrote itself. Measured: a
  // codebase calling its own `trackPlatformEvent()` thirteen times was reported
  // as having no analytics at all, because the check only knew vendor names.
  // Erring towards "it has some" is the safe direction here — it suppresses a
  // finding rather than asserting one.
  const analytics = integrated(code, ['posthog', 'mixpanel', 'amplitude', 'plausible', 'umami'],
    [/analytics\.(track|capture|identify)\(/i, /\bgtag\(/, /googletagmanager/i,
      /\b(track|log|record|capture)[A-Z]\w*Event\w*\(/, /\btrackEvent\(|\blogEvent\(/])
  const feedback = integrated(code, ['canny', 'featurebase', 'usersnap'],
    [/\b(FeedbackWidget|BugReport(Modal|Button|Form)|feedback_?(modal|widget|form)|report_?issue)\b/i])

  return collect([
    {
      id: 'LX-TEL-001',
      area: 'Knowing what people do',
      title: 'No product analytics integration was found',
      severity: 'medium',
      absent: !analytics,
      lookedFor: 'PostHog, Mixpanel, Amplitude, Segment, Plausible, Umami, Heap or a gtag call',
      detail: 'Nothing records which features are used, where people stop, or how many come back. '
        + 'Without it every decision about what to build next is an argument between opinions, and '
        + 'the first question any investor or advisor asks — how many people use this, and what do '
        + 'they do — has no answer that can be checked.',
      next: 'Instrument the three or four events that describe the product working end to end '
        + 'before instrumenting anything else. A hundred events nobody reads is worse than four '
        + 'that get looked at weekly.',
      prompt: null,
    },
    {
      id: 'LX-TEL-002',
      area: 'Hearing from people',
      title: 'No in-product way to report a problem was found',
      severity: 'low',
      absent: !feedback,
      lookedFor: 'a feedback or bug-report surface, or an integration such as Canny, Featurebase '
        + 'or Usersnap',
      detail: 'Nothing in the product lets somebody say that it is broken. What follows is not '
        + 'silence but absence: the people who hit a problem leave rather than report it, and the '
        + 'only signal left is a number going down with no explanation attached to it.',
      next: 'One button that opens a form and attaches the current page is enough to start. The '
        + 'value is in it being one click from where the problem happened.',
      prompt: null,
    },
  ])
}

// ── 3. Engineering quality ──────────────────────────────────────────────────

export function qualityChecks(files: SourceFile[]): PoschiCommonFinding[] {
  const code = codeOf(files)
  const ts = code.filter((f) => /\.tsx?$/i.test(f.path))

  // ── Anything between `.env` and `.example` still documents the variables ──
  //
  // This matched the three exact names and nothing else, so POSCHI's
  // `.env.prod.local.example` did not count and the report said no example file
  // existed. Projects name these per environment all the time. A typed manifest
  // counts too: `vite-env.d.ts` declaring every VITE_ variable tells the next
  // person what to set as well as a sample file does, and in a TypeScript
  // project it is the more reliable of the two because the compiler checks it.
  const envExample = hasPath(files, /(^|\/)\.env\b[^/]*\.(example|sample|template)$/i)
    || hasPath(files, /(^|\/)(vite-env|env)\.d\.ts$/i)
  const readsEnv = someFile(code, /process\.env\.|import\.meta\.env\./)

  // A wildcard type on a boundary is where type safety actually stops.
  const anyTyped = filesWith(ts, /:\s*any\b|<any>|as\s+any\b/, 5)

  const strict = someFile(files.filter((f) => /tsconfig.*\.json$/i.test(f.path)),
    /"strict"\s*:\s*true/)
  const hasTsconfig = hasPath(files, /tsconfig.*\.json$/i)

  const themeTokens = someFile(files, /(^|[^-\w])(--[\w-]+-(color|colour|bg|background|fg|foreground|spacing)|theme\s*:\s*\{|tailwind\.config|designTokens|tokens\.(ts|js|json|css))/i)
  const hardcodedColour = filesWith(code, /#[0-9a-f]{6}\b|\brgba?\(\s*\d+\s*,/i, 6)

  return collect([
    {
      id: 'LX-QUA-001',
      area: 'Configuration',
      title: 'Environment variables are read and no example file documents them',
      severity: 'low',
      absent: readsEnv && !envExample,
      lookedFor: 'a .env.example, .env.sample or .env.template beside the code that reads '
        + 'process.env or import.meta.env',
      detail: 'The application reads configuration from the environment and nothing lists what it '
        + 'expects. The next person to run it — or the same person on a new machine — finds out '
        + 'which variables exist by reading the source, or by watching it fail one variable at a '
        + 'time.',
      next: 'List every variable with a placeholder value and a one-line comment. It is the '
        + 'cheapest documentation in a codebase and the one most often missing.',
      prompt: null,
    },
    {
      id: 'LX-QUA-002',
      area: 'Type safety',
      title: 'TypeScript is used without strict mode',
      severity: 'medium',
      absent: Boolean(hasTsconfig) && !strict,
      lookedFor: '"strict": true in a tsconfig',
      files: hasTsconfig ? [hasTsconfig] : [],
      detail: 'A TypeScript configuration exists and strict mode is off. Most of what makes types '
        + 'worth having — null checking, no implicit any, strict function types — lives behind '
        + 'that flag, so the cost of annotation is being paid without the benefit.',
      next: 'Turn it on and read the errors before fixing any of them. The count tells you whether '
        + 'this is an afternoon or a project.',
      prompt: null,
    },
    {
      id: 'LX-QUA-003',
      area: 'Type safety',
      title: `${anyTyped.length === 5 ? '5 or more' : anyTyped.length} file(s) use the wildcard "any" type`,
      severity: 'low',
      absent: anyTyped.length > 0,
      lookedFor: '`: any`, `<any>` and `as any` in TypeScript files',
      files: anyTyped,
      detail: '`any` switches the type checker off for whatever it touches, and it spreads: a '
        + 'value typed `any` makes everything derived from it unchecked too. A handful in glue '
        + 'code is ordinary. On anything carrying business data it means the types no longer '
        + 'describe the program.',
      next: 'Look at where these sit rather than at the count. One on a third-party shim is fine; '
        + 'one on a payment, a permission or a user record is the type system not being used.',
      prompt: null,
    },
    {
      id: 'LX-QUA-004',
      area: 'Design consistency',
      title: 'Colours are written literally in the code with no central theme',
      severity: 'low',
      absent: hardcodedColour.length > 2 && !themeTokens,
      lookedFor: 'CSS custom properties, a Tailwind config, or a tokens file, beside literal hex '
        + 'and rgb() values',
      files: hardcodedColour,
      detail: 'Colour values are written directly into components and no central set of tokens was '
        + 'found. Every future change to the palette is then a search-and-replace across the '
        + 'codebase, and the near-misses — two greys that differ by a shade — are invisible until '
        + 'somebody sees two screens side by side.',
      next: 'Define the palette once and refer to it. The work is in the first conversion; after '
        + 'that a theme change is one file.',
      prompt: null,
    },
  ])
}

// ── 4. Monetization readiness ───────────────────────────────────────────────

export function monetizationChecks(files: SourceFile[]): PoschiCommonFinding[] {
  const code = codeOf(files)

  const charges = integrated(code, ['stripe', 'paddle', 'lemonsqueezy', 'chargebee', 'recurly', 'braintree'],
    [/\bSTRIPE_(SECRET|WEBHOOK|PUBLISHABLE)/i, /\b(sk|pk)_(live|test)_/])
  const lifecycleWebhook = someFile(code, /customer\.subscription\.(deleted|updated)|invoice\.payment_failed|subscription_cancelled|payment_failed/i)

  // Identifier-shaped, and deliberately without a bare `tier`: measured, that
  // one word matched "your plan tier" in help text, "Free tier highlighted" in
  // a preview string and "Sentry offers a generous free tier" in a tutorial,
  // and reported a design-system tool at high severity for gating paid features
  // only in the browser. It gates nothing.
  //
  // `feature_flag` came off for a second reason as well as the false match: a
  // release toggle is not a paid entitlement, and treating them as the same
  // thing would report every product that ships behind flags as selling them.
  const ENTITLEMENT = /\b(isPro|is_pro|hasPlan|has_plan|planId|plan_id|entitlement|canAccess|isSubscribed|is_subscribed|subscription_tier|plan_tier)\b/
  const gatesFeatures = someFile(code, ENTITLEMENT)
  const gatesOnServer = someFile(
    code.filter((f) => /(^|\/)(api|server|functions|routes|services|actions|handlers|middleware)(\/|\.)/i.test(f.path)),
    ENTITLEMENT,
  )

  return collect([
    {
      id: 'LX-MON-001',
      area: 'Keeping access in step with payment',
      title: 'Payment is taken and nothing listens for a subscription ending or a payment failing',
      severity: 'high',
      absent: charges && !lifecycleWebhook,
      lookedFor: 'handlers for customer.subscription.deleted, customer.subscription.updated or '
        + 'invoice.payment_failed',
      detail: 'A payment processor is integrated and nothing was found that reacts to the events '
        + 'that end a subscription. Access is then granted at checkout and never revisited, so a '
        + 'cancelled or failed subscription keeps working — the product is given away, quietly, to '
        + 'exactly the people who decided to stop paying for it.',
      next: 'Handle the ending events before the starting ones are polished. Money arriving is '
        + 'noticed by somebody; money stopping is not.',
      prompt: [
        'Handle the subscription lifecycle events that end access.',
        '',
        'Checkout grants access and nothing revokes it, so a cancelled or failed subscription',
        'continues to work.',
        '',
        '1. Add handlers for the events that end or interrupt a subscription — at minimum',
        '   cancellation, and a failed renewal payment.',
        '2. Each handler updates the stored entitlement for that customer. The database is the',
        '   record of what somebody may do; the processor is the record of what they paid.',
        '3. Verify the webhook signature before acting on any event, and make each handler',
        '   idempotent — processors retry, and a retried cancellation must not double-charge or',
        '   double-revoke.',
        '4. Decide explicitly what happens to data belonging to a lapsed account: kept, hidden, or',
        '   removed after a stated period. Do not choose this silently.',
        '',
        'Acceptance: a cancellation in the processor removes access without anyone intervening; a',
        'replayed event changes nothing the first one did not.',
      ].join('\n'),
    },
    {
      id: 'LX-MON-002',
      area: 'Where a limit is enforced',
      title: 'Paid features are gated in the interface and no server-side check was found',
      severity: 'high',
      absent: gatesFeatures && !gatesOnServer,
      lookedFor: 'the same entitlement checks inside api, server, routes, services, actions, '
        + 'handlers or middleware directories',
      detail: 'Something decides what a plan may do, and that decision was only found in code that '
        + 'runs in the browser. A check in the interface hides a button; it does not stop a '
        + 'request. Anybody willing to open the developer tools has the paid product, and nothing '
        + 'in the logs distinguishes them from a customer.',
      next: 'Enforce the entitlement where the work happens. The interface check stays — it is '
        + 'what makes the limit visible — but it is a courtesy, not a control.',
      prompt: null,
    },
  ])
}

// ── 5. SEO and marketing ────────────────────────────────────────────────────

export function seoChecks(files: SourceFile[]): PoschiCommonFinding[] {
  const code = codeOf(files)
  const markup = markupOf(files)

  const llms = hasPath(files, /(^|\/)llms\.txt$/i)
  const jsonLd = someFile([...markup, ...code], /application\/ld\+json/i)
  const manifest = hasPath(files, /(^|\/)(site\.webmanifest|manifest\.json|manifest\.webmanifest)$/i)
  const appleIcon = someFile(markup, /apple-touch-icon/i) || hasPath(files, /apple-touch-icon/i)
  const favicon = hasPath(files, /(^|\/)favicon\.(ico|svg|png)$/i) || someFile(markup, /rel=["']icon["']/i)

  // A canonical that never changes is a canonical for one page.
  const canonical = someFile([...markup, ...code], /rel=["']canonical["']/i)
  // Either order: the element is often looked up first and set later, and just
  // as often set inside a hook that mentions it afterwards. Requiring one
  // direction reported a correct implementation as broken.
  const SETS_FROM_ROUTE = /setAttribute|useEffect|router|location\.pathname|usePathname|route\.path/
  const canonicalIsDynamic = code.some((file) =>
    /canonical/i.test(file.text) && SETS_FROM_ROUTE.test(file.text))

  return collect([
    {
      id: 'LX-SEO-001',
      area: 'Being read by an assistant',
      title: 'No llms.txt',
      severity: 'low',
      absent: !llms,
      lookedFor: 'a file named llms.txt at the repository root',
      detail: 'Nothing tells an AI assistant what this product is. When somebody asks one of them '
        + 'for a tool like this, the assistant reads whatever it can parse out of the rendered '
        + 'page — navigation, cookie notices, marketing copy — and summarises from that. An '
        + 'llms.txt is a short plain statement of what the product does and where its '
        + 'documentation is, and it is the difference between being described accurately and '
        + 'being described from the footer.',
      next: 'Worth doing for anything with public documentation or a public API, and not worth '
        + 'doing for a product that lives entirely behind a login.',
      prompt: [
        'Add an llms.txt at the site root describing this product for AI assistants.',
        '',
        'Follow the llms.txt convention: Markdown, a single H1 with the product name, a short',
        'blockquote summarising what it does and who it is for, then H2 sections of links with a',
        'sentence each.',
        '',
        '1. Derive the content from what this repository actually contains — the README, the',
        '   routes, the public documentation. Do not describe features it does not have.',
        '2. Link only to pages that are publicly reachable without signing in.',
        '3. Serve it at /llms.txt as text/plain or text/markdown, and do not block it in',
        '   robots.txt.',
        '',
        'Acceptance: /llms.txt returns Markdown describing this product, with every link resolving',
        'to a public page.',
      ].join('\n'),
    },
    {
      id: 'LX-SEO-002',
      area: 'How a search engine reads a page',
      title: 'No structured data',
      severity: 'low',
      absent: !jsonLd,
      lookedFor: 'a script tag of type application/ld+json',
      detail: 'No JSON-LD was found. Without it a search engine has the page text and nothing '
        + 'else, so what appears in a result is whatever it infers. With it the name, the '
        + 'description, the logo and the pricing are stated outright, and the result can carry '
        + 'them.',
      next: 'One Organization or SoftwareApplication block on the landing page is the whole job '
        + 'for most products. Validate it once and leave it alone.',
      prompt: null,
    },
    {
      id: 'LX-SEO-003',
      area: 'Installing and pinning',
      title: 'No web app manifest',
      severity: 'low',
      absent: !manifest,
      lookedFor: 'site.webmanifest, manifest.json or manifest.webmanifest',
      detail: 'No manifest was found, so the product cannot be installed to a home screen or a '
        + 'taskbar, and a phone that pins it gets a screenshot of the page as its icon. The '
        + 'manifest is what supplies the name, the icons and the colours a device uses when the '
        + 'product is not in a browser tab.',
      next: 'Only worth it if people return often enough to want it one tap away. For a marketing '
        + 'site it is decoration.',
      prompt: null,
    },
    {
      id: 'LX-SEO-004',
      area: 'How the product looks in a tab or a bookmark',
      title: 'No favicon or touch icon',
      severity: 'low',
      absent: !favicon && !appleIcon,
      lookedFor: 'favicon.ico, an icon link element, or an apple-touch-icon',
      detail: 'Neither a favicon nor a touch icon was found. The browser then shows a blank page '
        + 'glyph in the tab, in the history and in every bookmark — the smallest possible signal '
        + 'that a product is unfinished, in the place a person sees most often.',
      next: 'One square image at 512px generates every size that is needed.',
      prompt: null,
    },
    {
      id: 'LX-SEO-005',
      area: 'Which address is the real one',
      title: 'A canonical link exists and does not appear to change per page',
      severity: 'low',
      absent: canonical && !canonicalIsDynamic,
      lookedFor: 'the canonical element being updated from the route — through setAttribute, an '
        + 'effect, the router or the current pathname',
      detail: 'A canonical link is present and nothing was found that updates it as the route '
        + 'changes. Every page then declares the same address as its original, which tells a '
        + 'search engine that the whole product is one page duplicated — the opposite of what the '
        + 'tag is for, and worse than having no tag at all.',
      next: 'Set it from the current path, with tracking parameters removed. A URL with ?ref= on '
        + 'it is a different address to a crawler and the same page to a person.',
      prompt: null,
    },
  ])
}

// ── 6. Journeys and first use ───────────────────────────────────────────────

/**
 * Accessibility, as far as a file can show it.
 *
 * ── The half that is here, and the half that is not ──────────────────────────
 *
 * A source file can show that a div responds to a click with no way to be
 * reached by keyboard, that a button carries an icon and no name, that an input
 * has no label. Those are structural and they are here.
 *
 * It cannot show a contrast ratio, whether focus actually moves into a dialog
 * and stays there, whether it returns to the trigger afterwards, or what a tap
 * target measures in CSS pixels. Those are properties of a drawn page. They are
 * in NOT_STATICALLY_CHECKABLE with their reasons, so the report says what it
 * did not look at rather than leaving a reader to assume it did.
 *
 * ── Why most of these fire on presence ───────────────────────────────────────
 *
 * Most checks in this file are absences: something expected was not found. Most
 * of these are the opposite — a line that is there and can be quoted. A div
 * with an onClick is a fact about the file. What it is FOR is still an
 * inference, which is why `toFinding` calls neither kind verified.
 */
export function accessibilityChecks(files: SourceFile[]): PoschiCommonFinding[] {
  const ui = markupOf(files)

  // A div that handles a click and carries neither a role nor a tabIndex near
  // it. Either one present is enough to stay quiet: somebody has thought about
  // it, and this check is for the ones nobody has.
  //
  // A handler whose whole body stops the event is excluded. Measured against
  // this repository: `<div onClick={(e) => e.stopPropagation()}>` wrapping a
  // chip was reported as unreachable by keyboard. It is not a control — it
  // exists to keep a click from bubbling to the thing behind it — so there is
  // nothing for a keyboard to reach and nothing to fix.
  const CLICKABLE = /<(?:div|span|li|td)\b[^>]{0,400}?\bonClick\s*=/i
  const GUARD_ONLY = /onClick\s*=\s*\{\s*\(?\s*e\s*\)?\s*=>\s*e\.(?:stopPropagation|preventDefault)\(\)\s*\}/
  const clickableDiv = ui
    .filter((f) => {
      const scan = new RegExp(CLICKABLE.source, 'gi')
      for (let m = scan.exec(f.text); m !== null; m = scan.exec(f.text)) {
        const tail = f.text.slice(m.index, m.index + 160)
        if (GUARD_ONLY.test(tail)) continue
        const from = Math.max(0, m.index - 200)
        if (!/role\s*=|tabIndex\s*=/i.test(f.text.slice(from, m.index + m[0].length + 200))) return true
      }
      return false
    })
    .map((f) => f.path).slice(0, 3)

  // A button whose first child is an icon component or an svg, with no name on
  // the tag itself.
  const namelessButton = ui
    // `[A-Za-z0-9]` rather than `[A-Za-z]`: icon components are routinely named
    // with a digit — Trash2, Settings2, Code2 — and a word boundary after the
    // letters fails against the digit that follows, so the check silently never
    // fired on exactly the components it exists to catch.
    .filter((f) => /<button\b(?:(?!aria-label|aria-labelledby|title=)[^>])*>\s*\{?\s*(?:<[A-Z][A-Za-z0-9]*\b|<svg\b)/.test(f.text))
    .map((f) => f.path).slice(0, 3)

  const FIELD = /<input\b|<textarea\b|<select\b/i
  const hasFields = someFile(ui, FIELD)
  const labelsFields = someFile(ui, /<label\b|aria-label(?:ledby)?\s*=|htmlFor\s*=/i)

  const readonlyFields = filesWith(ui, /\breadOnly\b|\breadonly\b/)
  const declaresReadonly = someFile(ui, /aria-readonly/i)

  const DIALOGISH = /\b(?:Dialog|Modal|Drawer|Sheet)\b|role\s*=\s*['"]dialog['"]/
  const dialogish = filesWith(ui, DIALOGISH)
  const declaresDialog = someFile(ui, /role\s*=\s*['"]dialog['"]|aria-modal/i)
  const declaresTrigger = someFile(ui, /aria-haspopup|aria-expanded/i)

  // Focus removed with nothing put back.
  //
  // "Something put back" is wider than a ring. Measured against this
  // repository: a field styled `focus:outline-none focus:border-violet-500/50`
  // was reported as having no focus indicator. The border change IS the
  // indicator — it is visible, it is only on focus, and it is what the designer
  // chose instead of the default outline. A check that only recognises rings
  // reports working code as broken, which is the fastest way to get a whole
  // section ignored.
  const REPLACED = /focus-visible|focus:ring|focus:border|focus:shadow|focus:bg|focus:outline-(?!none)|:focus\s*\{[^}]*(?:outline|border|box-shadow|background)/i
  // Both spellings of the removal: the CSS property, and the utility class with
  // or without a `focus:` prefix. The unprefixed one removes the outline in
  // every state, which is the worse of the two and was the one being missed.
  const REMOVED = /outline\s*:\s*(?:none|0)|(?:^|[\s"'`:{])outline-none\b/i
  const killsOutline = files
    .filter((f) => REMOVED.test(f.text) && !REPLACED.test(f.text))
    .map((f) => f.path).slice(0, 3)

  const positiveTabIndex = filesWith(ui, /tab[Ii]ndex\s*=\s*\{?\s*["']?[1-9]/)

  const STATUS = /\b(?:setError|setStatus|setMessage|toast|notify|Snackbar)\b/
  const showsStatus = someFile(ui, STATUS)
  const announces = someFile(ui, /aria-live|role\s*=\s*['"](?:status|alert)['"]/i)

  const showsFieldError = hasFields && someFile(ui, /\b(?:errorMessage|fieldError|isInvalid)\b/i)
  const linksErrors = someFile(ui, /aria-describedby|aria-errormessage|aria-invalid/i)

  const IMAGE = /<img\b|<Image\b/
  const hasImages = someFile(ui, IMAGE)
  const altOnImages = someFile(ui, /<(?:img|Image)\b[^>]*\balt\s*=/i)

  return collect([
    {
      id: 'LX-A11Y-001',
      area: 'Reaching a control with a keyboard',
      title: 'Elements respond to a click without being reachable by keyboard',
      severity: 'high',
      kind: 'presence',
      absent: clickableDiv.length > 0,
      lookedFor: 'a div, span, li or td with an onClick and no role or tabIndex beside it',
      files: clickableDiv,
      detail: 'A div that handles a click is invisible to the keyboard: it is not in the tab '
        + 'order, Enter and Space do nothing on it, and a screen reader announces nothing when it '
        + 'is reached. Anybody not using a mouse cannot operate it at all.',
      next: 'Change these to <button> where the thing is an action, or <a href> where it goes '
        + 'somewhere — that brings the tab stop, the key handling and the role with it. Where '
        + 'neither is possible, add role, tabIndex={0} and a handler for Enter and Space: all '
        + 'three, because any one alone leaves it unusable.',
      prompt: [
        'Make the clickable elements in this application reachable by keyboard.',
        '',
        'Elements such as div and span carry onClick handlers with no role and no tabIndex, so',
        'they cannot be focused or activated without a mouse.',
        '',
        '1. Find every non-interactive element with a click handler.',
        '2. Where it performs an action make it a <button type="button">; where it navigates make',
        '   it an <a href>. Prefer changing the tag to adding ARIA.',
        '3. Where the tag genuinely cannot change, add all three of: an appropriate role,',
        '   tabIndex={0}, and an onKeyDown activating on Enter and Space.',
        '',
        'Do not add role="button" alone. Without a tab stop and key handling it announces a',
        'button that cannot be used, which is worse than an unlabelled div.',
        '',
        'Acceptance: every clickable element can be focused and activated from the keyboard.',
      ].join('\n'),
    },
    {
      id: 'LX-A11Y-002',
      area: 'What a control is called',
      title: 'Buttons carry an icon and no name to announce',
      severity: 'high',
      kind: 'presence',
      absent: namelessButton.length > 0,
      lookedFor: 'a <button> whose first child is an icon component or an <svg>, with no '
        + 'aria-label, aria-labelledby or title on the tag',
      files: namelessButton,
      detail: 'An icon-only button is announced as "button" and nothing else. Somebody is told a '
        + 'control exists and not what it does, which makes a row of them indistinguishable — and '
        + 'a row of icons is exactly where close, delete and save sit beside each other.',
      next: 'Give each an aria-label saying what it does rather than what it looks like: "Remove '
        + 'this response", not "trash icon".',
      prompt: [
        'Give every icon-only button in this application an accessible name.',
        '',
        '1. Find every <button> whose visible content is only an icon or an svg.',
        '2. Add aria-label describing the action in the words a person would use — "Remove this',
        '   response", "Close the importer" — not the name of the icon.',
        '3. Where an icon sits inside a button that already has visible text, mark the icon',
        '   aria-hidden="true" so it is not announced twice.',
        '',
        'Acceptance: no button is announced without a name.',
      ].join('\n'),
    },
    {
      id: 'LX-A11Y-003',
      area: 'Naming a field',
      title: 'Form fields are rendered and nothing was found that labels them',
      severity: hasFields ? 'high' : 'info',
      absent: hasFields && !labelsFields,
      lookedFor: 'a <label>, an aria-label, or an htmlFor binding one to a field',
      files: filesWith(ui, FIELD),
      detail: 'A field with no label is announced as its type and nothing more — "edit text". '
        + 'Placeholder text does not stand in for it: it is not announced by every screen reader, '
        + 'and it disappears the moment somebody types, taking the only clue with it.',
      next: 'Bind a <label for> to every field. Where the design has no room for visible text, '
        + 'aria-label carries the same information without showing it.',
      prompt: [
        'Label every form field in this application.',
        '',
        '1. Find every input, textarea and select.',
        '2. Give each a <label> bound by for/htmlFor, or an aria-label where no visible label',
        '   fits the design.',
        '3. Do not use placeholder text as the label. Keep it as an example of the expected',
        '   value, not as the name of the field.',
        '',
        'Acceptance: every field has a programmatic name.',
      ].join('\n'),
    },
    {
      id: 'LX-A11Y-004',
      area: 'Seeing where you are',
      title: 'Focus outlines are removed and nothing was found that replaces them',
      severity: 'high',
      kind: 'presence',
      absent: killsOutline.length > 0,
      lookedFor: 'outline:none or focus:outline-none in a file with no focus-visible rule and no '
        + 'focus ring utility',
      files: killsOutline,
      detail: 'Removing the outline without putting something back leaves a keyboard user unable '
        + 'to tell which control they are on. Tabbing becomes guesswork: nothing on the page '
        + 'changes as focus moves, so the only way to find out where you are is to press Enter '
        + 'and see what happens.',
      next: 'Keep the removal if the default outline clashes, and add a :focus-visible style in '
        + 'its place — which shows for the keyboard and not the mouse, usually the reason the '
        + 'outline was removed to begin with.',
      prompt: [
        'Restore a visible focus indicator everywhere one was removed in this application.',
        '',
        '1. Find every rule that removes the outline.',
        '2. Add a :focus-visible style beside it — a ring or outline clearly visible against the',
        '   background it sits on.',
        '3. Use :focus-visible rather than :focus, so the indicator appears for keyboard users',
        '   without appearing on every mouse click.',
        '',
        'Acceptance: tabbing through the application always shows which control has focus.',
      ].join('\n'),
    },
    {
      id: 'LX-A11Y-005',
      area: 'Tab order',
      title: 'A positive tabindex is set, which reorders the whole page',
      severity: 'medium',
      kind: 'presence',
      absent: positiveTabIndex.length > 0,
      lookedFor: 'tabIndex set to 1 or higher',
      files: positiveTabIndex,
      detail: 'Any tabindex above zero pulls that element to the front of the tab order for the '
        + 'entire page, ahead of everything in document order. One of them rearranges the whole '
        + 'sequence, and the result rarely matches what the page looks like.',
      next: 'Use tabIndex={0} to make something focusable in its natural place and -1 to take it '
        + 'out of the order. Where the sequence is wrong, move the element in the DOM rather than '
        + 'renumbering around it.',
      prompt: [
        'Remove the positive tabindex values from this application.',
        '',
        '1. Find every tabIndex greater than zero.',
        '2. Replace it with 0 where the element should be focusable in its natural position, or',
        '   -1 where it should be focusable only programmatically.',
        '3. Where the tab order was genuinely wrong, fix it by moving the element in the DOM.',
        '',
        'Acceptance: no element carries a tabindex above zero.',
      ].join('\n'),
    },
    {
      id: 'LX-A11Y-006',
      area: 'Dialogs',
      title: 'Dialogs are rendered and none declares itself as one',
      severity: 'medium',
      absent: dialogish.length > 0 && !declaresDialog,
      lookedFor: 'role="dialog" or aria-modal beside the dialog, modal or drawer components',
      files: dialogish,
      detail: 'Something that behaves as a dialog without saying so is announced as ordinary page '
        + 'content. Somebody is not told a dialog opened, is not placed inside it, and can tab '
        + 'straight out into the page behind while it is still covering it.',
      next: 'Add role="dialog" and aria-modal="true" to the container, and aria-labelledby '
        + 'pointing at its title so it is announced by name.',
      prompt: [
        'Declare the dialogs in this application as dialogs.',
        '',
        '1. Find every modal, drawer, sheet or dialog component.',
        '2. Give the container role="dialog" and aria-modal="true".',
        '3. Point aria-labelledby at the element holding its title, so it is announced by name',
        '   rather than as an unnamed dialog.',
        '',
        'Acceptance: every dialog declares its role and has a name.',
      ].join('\n'),
    },
    {
      id: 'LX-A11Y-007',
      area: 'Dialogs',
      title: 'Dialogs are opened by controls that do not say they open one',
      severity: 'low',
      absent: dialogish.length > 0 && !declaresTrigger,
      lookedFor: 'aria-haspopup or aria-expanded anywhere in the interface files',
      files: dialogish,
      detail: 'A control that opens a dialog is announced as a plain button, so there is no '
        + 'warning that activating it moves the context. aria-expanded also says whether the '
        + 'thing is currently open, which is otherwise invisible.',
      next: 'Put aria-haspopup="dialog" on the trigger, and aria-expanded bound to the same state '
        + 'that renders the dialog, so the two cannot disagree.',
      prompt: [
        'Mark the controls that open dialogs in this application.',
        '',
        '1. Find every control that opens a modal, drawer or dialog.',
        '2. Add aria-haspopup="dialog".',
        '3. Add aria-expanded bound to the same state that decides whether the dialog renders, so',
        '   the attribute cannot drift from what is on screen.',
        '',
        'Acceptance: every dialog trigger announces that it opens a dialog, and whether it is open.',
      ].join('\n'),
    },
    {
      id: 'LX-A11Y-008',
      area: 'Telling somebody what happened',
      title: 'Status messages are rendered with nothing that announces them',
      severity: 'medium',
      absent: showsStatus && !announces,
      lookedFor: 'aria-live, role="status" or role="alert" in the files that set messages',
      files: filesWith(ui, STATUS),
      detail: 'A message that appears without a live region is seen and not heard. Somebody using '
        + 'a screen reader gets no indication that the save succeeded or the form failed, and is '
        + 'left hunting the page for a change nobody told them about.',
      next: 'Put role="status" on the container holding these messages — polite, so it waits for '
        + 'a pause — and role="alert" only where the message must interrupt.',
      prompt: [
        'Announce status messages in this application to screen readers.',
        '',
        '1. Find the containers that render success, error and progress messages.',
        '2. Give each role="status" (equivalently aria-live="polite").',
        '3. Use role="alert" only for messages that must interrupt, such as a failure that loses',
        '   work. Overusing it makes every message an interruption.',
        '4. Make sure the container is in the DOM before the message arrives — a live region',
        '   added at the same moment as its content is often not announced at all.',
        '',
        'Acceptance: every status message is announced without the person having to find it.',
      ].join('\n'),
    },
    {
      id: 'LX-A11Y-009',
      area: 'Form errors',
      title: 'Field errors are rendered with nothing tying them to the field',
      severity: 'medium',
      absent: showsFieldError && !linksErrors,
      lookedFor: 'aria-describedby, aria-errormessage or aria-invalid on the fields',
      files: filesWith(ui, FIELD),
      detail: 'An error rendered beside a field is connected to it visually and not '
        + 'programmatically. Somebody moving through the form field by field hears the label and '
        + 'the value, and never the reason the form will not submit.',
      next: 'Point aria-describedby at the element holding the message, and set aria-invalid on '
        + 'the field while it is in error, so the state and the reason both travel with it.',
      prompt: [
        'Connect validation errors to their fields in this application.',
        '',
        '1. Give each error message element a stable id.',
        '2. Point the field aria-describedby at that id.',
        '3. Set aria-invalid="true" on the field while it is in error, and remove it when fixed.',
        '',
        'Acceptance: moving to a field in error announces both that it is invalid and why.',
      ].join('\n'),
    },
    {
      id: 'LX-A11Y-010',
      area: 'Read-only fields',
      title: 'Read-only fields do not announce that they cannot be edited',
      severity: 'low',
      absent: readonlyFields.length > 0 && !declaresReadonly,
      lookedFor: 'aria-readonly beside the fields marked readonly',
      files: readonlyFields,
      detail: 'A field marked readOnly looks uneditable and is not reliably announced as such. '
        + 'Somebody reaches it, is told it is a text field, and finds typing does nothing, with '
        + 'no explanation of why.',
      next: 'Add aria-readonly="true" alongside the readOnly attribute. Where the value is only '
        + 'being shown rather than submitted, plain text with a label is clearer than a field.',
      prompt: [
        'Announce the read-only fields in this application.',
        '',
        '1. Find every input marked readOnly.',
        '2. Add aria-readonly="true" beside it.',
        '3. Where the value is displayed rather than submitted, consider rendering it as text',
        '   with a label instead of a field nobody can type in.',
        '',
        'Acceptance: a read-only field is announced as read-only.',
      ].join('\n'),
    },
    {
      id: 'LX-A11Y-011',
      area: 'Images',
      title: 'Images are rendered and none carries alt text',
      severity: hasImages ? 'medium' : 'info',
      absent: hasImages && !altOnImages,
      lookedFor: 'an alt attribute on an <img> or <Image>',
      files: filesWith(ui, IMAGE),
      detail: 'An image with no alt attribute is announced by its file name, which is usually a '
        + 'hash. Decoration needs alt="" so it is skipped entirely; an image carrying meaning '
        + 'needs a description of the meaning, not of the picture.',
      next: 'Give every image an alt — empty for decoration, and for the rest what the image '
        + 'tells somebody who cannot see it.',
      prompt: [
        'Give the images in this application alt text.',
        '',
        '1. Find every img and Image without an alt attribute.',
        '2. Where the image is decorative, set alt="" so it is skipped rather than announced.',
        '3. Where it carries meaning, describe the meaning rather than the picture — what a',
        '   person would lose by not seeing it.',
        '',
        'Acceptance: every image either has a description or is explicitly marked decorative.',
      ].join('\n'),
    },
  ])
}

export function journeyChecks(files: SourceFile[]): PoschiCommonFinding[] {
  const code = codeOf(files)

  const oauth = someFile(code, /signInWith(OAuth|Google|Apple|Github)|provider:\s*['"](google|github|apple)|next-auth|clerk|auth0|magic[_-]?link|signInWithOtp/i)
  const signsIn = someFile(code, /\bsign[_ -]?in\b|\blog[_ -]?in\b|signInWithPassword|\bauthenticate\b/i)

  const emptyState = someFile(code, /\bempty[_-]?state\b|EmptyState|\bno (results|items|data)\b|length === 0 \?/i)
  const lists = someFile(code, /\.map\(\s*\(?\w+\)?\s*=>/)

  const skeleton = someFile(code, /\bskeleton\b|\bshimmer\b|isLoading\s*\?|\bSuspense\b|\bspinner\b/i)
  const loadsAsync = someFile(code, /\bawait\b|\.then\(|useQuery\(|useSWR\(/)

  return collect([
    {
      id: 'LX-JRN-001',
      area: 'Getting in',
      title: 'Sign-in exists with no one-click or passwordless option',
      severity: 'low',
      absent: signsIn && !oauth,
      lookedFor: 'an OAuth provider, a magic link, or a one-time code sign-in',
      detail: 'The only way in that was found is a password. Every person arriving is asked to '
        + 'invent and remember one before they have seen anything, which is the highest-friction '
        + 'moment in the product placed at its very front — and it is where most of the people '
        + 'who leave, leave.',
      next: 'One provider is enough, and the one to add is whichever the intended users already '
        + 'have an account with.',
      prompt: null,
    },
    {
      id: 'LX-JRN-002',
      area: 'The first screen of a new account',
      title: 'Lists are rendered and no empty state was found',
      severity: 'low',
      absent: lists && !emptyState,
      lookedFor: 'an empty-state component, a "no results" branch, or a length === 0 case',
      detail: 'Collections are rendered and nothing was found that handles them being empty. Every '
        + 'new account therefore begins at a blank panel, which is both the first impression of '
        + 'the product and the moment a person has least idea what to do next. An empty list and a '
        + 'failed request also look identical, so nobody can tell which they are looking at.',
      next: 'Say what goes here and give the button that puts the first one in. This is the '
        + 'cheapest activation work available.',
      prompt: null,
    },
    {
      id: 'LX-JRN-003',
      area: 'While waiting',
      title: 'Data is loaded asynchronously and no loading state was found',
      severity: 'low',
      absent: loadsAsync && !skeleton,
      lookedFor: 'a skeleton, a spinner, an isLoading branch or a Suspense boundary',
      detail: 'Screens fetch before they can render and nothing was found that fills the gap. The '
        + 'page then arrives in pieces, moving as each part lands, and a slow connection is '
        + 'indistinguishable from a broken one for as long as the wait lasts.',
      next: 'Reserve the space the content will take rather than showing a spinner in the middle '
        + 'of it. Layout that does not move is most of what makes a product feel fast.',
      prompt: null,
    },
  ])
}

// ── 7. Competitive position ─────────────────────────────────────────────────

export function competitiveChecks(files: SourceFile[]): PoschiCommonFinding[] {
  const code = codeOf(files)

  const shortcuts = someFile(code, /\b(cmdk|command[_-]?palette|hotkey|useHotkeys|keydown[\s\S]{0,120}?(metaKey|ctrlKey))\b/i)
  const exports = someFile(code, /\b(exportTo|downloadCsv|toCSV|application\/json['"]\s*,?\s*\)?\s*;?[\s\S]{0,80}download|createObjectURL|\.csv['"]|saveAs\()/i)
  const shareable = someFile(code, /\b(share[_-]?link|publicUrl|public_url|permalink|shareId|share_token|navigator\.share)\b/i)

  return collect([
    {
      id: 'LX-CMP-001',
      area: 'Working quickly',
      title: 'No keyboard shortcuts or command palette were found',
      severity: 'info',
      absent: !shortcuts,
      lookedFor: 'a command palette library, a hotkey hook, or a keydown handler reading a '
        + 'modifier key',
      detail: 'Nothing was found that lets somebody drive the product from the keyboard. For a '
        + 'tool used occasionally this costs nothing. For one used daily it is the difference '
        + 'between a product somebody tolerates and one they are fast in, and speed of that kind '
        + 'is most of what people mean when they say a newer tool feels better than the one it '
        + 'replaced.',
      next: 'Only worth building once there is a repeated action worth accelerating. Before that '
        + 'it is a shortcut to nowhere.',
      prompt: null,
    },
    {
      id: 'LX-CMP-002',
      area: 'Taking work elsewhere',
      title: 'No way to export what a person has made was found',
      severity: 'low',
      absent: !exports,
      lookedFor: 'a CSV or JSON download, a file save, or a createObjectURL download',
      detail: 'Nothing lets somebody take their own data out. That is a purchasing objection '
        + 'before it is anything else — a buyer evaluating the product asks what happens if they '
        + 'stop using it, and "nothing comes out" is an answer that ends the conversation. It is '
        + 'also the cheapest trust signal available, because offering the exit is what makes '
        + 'staying a choice.',
      next: 'One export of the main record type, in a format a spreadsheet opens, answers the '
        + 'objection.',
      prompt: null,
    },
    {
      id: 'LX-CMP-003',
      area: 'Getting found through the people who use it',
      title: 'Nothing a person makes can be shared by link',
      severity: 'info',
      absent: !shareable,
      lookedFor: 'a share link, a public URL, a permalink, a share token, or navigator.share',
      detail: 'Everything a person produces stays behind the login. The product then grows only '
        + 'through people who were told about it directly, and never through the work its users '
        + 'already do — which is the one distribution channel that costs nothing per person '
        + 'reached.',
      next: 'Depends entirely on whether the output is something anyone would want to send to '
        + 'somebody else. Where it is not, this is not a gap.',
      prompt: null,
    },
  ])
}

// ── 8. Compliance foundations ───────────────────────────────────────────────

export function complianceChecks(files: SourceFile[]): PoschiCommonFinding[] {
  const code = codeOf(files)

  const tracking = integrated(code, ['mixpanel', 'amplitude', 'hotjar', 'posthog'],
    [/googletagmanager|google-analytics|connect\.facebook\.net|\bfbq\(|clarity\.ms|\bgtag\(/i])
  const consent = someFile(code, /\b(cookie[_-]?consent|cookie[_-]?banner|consent[_-]?mode|gdpr|onetrust|cookiebot|klaro)\b/i)

  const usesAI = integrated(code, ['openai', 'anthropic', 'cohere', 'replicate', 'mistral'],
    [/generativelanguage\.googleapis\.com/i, /\b(OPENAI|ANTHROPIC)_API_KEY\b/])
  const disclosesAI = someFile(files, /\b(AI (is |may |can )?(used|processed|generated)|powered by (AI|GPT|Claude)|sent to (an )?(AI|third[- ]party) model|artificial intelligence)\b/i)

  return collect([
    {
      id: 'LX-CMP-101',
      area: 'Tracking and consent',
      title: 'Third-party tracking runs with no consent mechanism in the code',
      severity: 'medium',
      absent: tracking && !consent,
      lookedFor: 'a cookie banner, a consent-mode integration, or a consent library',
      detail: 'Analytics or advertising scripts load and nothing was found that asks permission '
        + 'first. In the UK and the EU that consent is required before the script runs, not after, '
        + 'and "we show a banner that only reports" does not meet it. This is also the single most '
        + 'visible thing a regulator or a competitor can check without access to anything.',
      next: 'Whether this applies depends on where the users are and what the scripts do. '
        + 'Strictly necessary cookies need no consent; anything measuring behaviour does.',
      prompt: null,
    },
    {
      id: 'LX-CMP-102',
      area: 'Telling people what happens to what they write',
      title: 'Input is sent to an external AI model and no disclosure was found',
      severity: 'medium',
      absent: usesAI && !disclosesAI,
      lookedFor: 'a statement in the interface or the documents that input is processed by an AI '
        + 'model or a third party',
      detail: 'The product sends content to a model run by somebody else and nothing found in the '
        + 'repository tells the person that. What they type leaves the service they chose and '
        + 'reaches one they did not, which is a disclosure obligation under several privacy '
        + 'regimes and, separately, the fastest way to lose the trust of a customer who finds out '
        + 'from somewhere other than you.',
      next: 'One sentence where the input is entered, and a paragraph in the privacy notice saying '
        + 'which provider, what is sent, and whether it is retained or used for training.',
      prompt: null,
    },
  ])
}

// ── 9. Security ─────────────────────────────────────────────────────────────

export function securityChecks(files: SourceFile[]): PoschiCommonFinding[] {
  const code = codeOf(files)
  const configs = files.filter((f) => /(vite|webpack|next|rollup|nuxt|svelte|astro)\.config\.[cm]?[jt]s$/i.test(f.path))

  const rateLimit = someFile(code, /\b(rate[_-]?limit|ratelimit|upstash|express-rate-limit|@?slowdown|throttle[_-]?request|limiter)\b/i)
  const hasAuthRoutes = someFile(code, /\b(signInWithPassword|signUp|resetPassword|forgot[_-]?password|\/auth\/|login)\b/i)

  const sourcemapsOn = someFile(configs, /sourcemap\s*:\s*true|productionBrowserSourceMaps\s*:\s*true|devtool\s*:\s*['"](source-map|eval-source-map)/i)

  const headers = someFile(files, /X-Frame-Options|Content-Security-Policy|Referrer-Policy|X-Content-Type-Options|Strict-Transport-Security|helmet\(/i)
  const servesHttp = someFile(code, /\b(express\(|fastify\(|createServer|NextResponse|new Response\()/i)

  // ── The eleven below ───────────────────────────────────────────────────────
  //
  // Each one names the thing it matched rather than a theme, for the reason
  // written at the top of this file: a gate spelled as an English word has put
  // untrue statements into this report four times, and every one of them read
  // perfectly well.
  //
  // Where a check needs two facts to be true — a WebSocket server AND no
  // authentication on it — both are required. A single-signal version of any of
  // these fires on every repository that has ever mentioned the subject.

  /** A hash that is broken for anything secret, where a secret is the subject.
   *  SHA-1 over a file to make a cache key is fine and extremely common — this
   *  analyser does it — so the file has to be about credentials as well. */
  const WEAK_HASH = /createHash\s*\(\s*['"](?:md5|sha1)['"]|(?:from|require\()\s*['"](?:md5|js-md5|sha1|crypto-js\/md5)['"]/i
  const SECRET_SUBJECT = /\b(password|passwd|pwd|secret|token|credential|api[_-]?key|session[_-]?id)\b/i
  const weakHashFiles = filesWhereNear(code, WEAK_HASH, SECRET_SUBJECT, 3, 150)

  /** A socket server, and anything that checks who opened the connection.
   *  HTTP middleware does not run on an upgrade, so a product can be fully
   *  guarded over REST and completely open over its socket. */
  const wsServer = someFile(code, /new\s+WebSocket(?:\.Server|Server)\s*\(|(?:from|require\()\s*['"](?:ws|socket\.io)['"]|io\.on\s*\(\s*['"]connection['"]|\.on\s*\(\s*['"]upgrade['"]/i)
  const wsAuth = someFile(code, /verifyClient|handshake\.auth|socket\.handshake|io\.use\s*\(|socket\.data\.user|\bwsAuth|authenticateSocket/i)

  /** The Host header used to build something that is sent out. A password-reset
   *  link built from it is a link an attacker chooses the domain of. */
  const HOST_HEADER = /req(?:uest)?\.headers\s*(?:\[\s*['"]host['"]\s*\]|\.host)\b|headers\.get\s*\(\s*['"](?:x-forwarded-)?host['"]|x-forwarded-host/i
  const BUILDS_LINK = /https?:\/\/\$\{|`https?:\/\/|sendMail|resetLink|verifyUrl|confirmUrl|callbackUrl/i
  const hostHeaderFiles = filesWhereNear(code, HOST_HEADER, BUILDS_LINK, 3, 150)

  /** A response marked cacheable by anything in front of it, in a file that
   *  also reads who is asking. A shared cache does not know that two requests
   *  with different cookies are different people. */
  const PUBLIC_CACHE = /['"]?[Cc]ache-[Cc]ontrol['"]?\s*[:,]\s*['"][^'"]*\b(?:public|s-maxage)\b/
  const READS_IDENTITY = /\b(authorization|getSession|getUser|currentUser|requireAuth|session\.user|req\.user)\b/i
  const publicCacheFiles = filesWhereNear(code, PUBLIC_CACHE, READS_IDENTITY, 3, 150)

  /** Input interpolated into a mail header rather than into the body. A newline
   *  in a name field then adds a recipient nobody chose. */
  const SENDS_MAIL = /\b(nodemailer|sendMail|sgMail|postmark|mailgun|ses\.sendEmail|resend\.emails\.send|@sendgrid)/i
  const HEADER_FROM_INPUT = /\b(?:subject|replyTo|reply_to|cc|bcc|from|to)\s*:\s*(?:[`'"][^`'"]*\$\{|(?:req|request|body|input|params|query|form)\b)/i
  const mailHeaderFiles = filesWhereNear(code, SENDS_MAIL, HEADER_FROM_INPUT, 3, 150)

  /** Math.random() where the thing being made is meant to be unguessable. It is
   *  seeded predictably and is not a secret generator; crypto.randomUUID and
   *  randomBytes are, and are no harder to call. */
  // What the value is ASSIGNED TO, rather than what the file mentions anywhere.
  //
  // Two earlier versions of this were wrong on this repository. Matching within
  // a file flagged a 2,000-line trading module that builds record ids, because
  // the word "secret" appeared thirteen hundred lines away. Matching within 300
  // characters flagged another that builds an event id nine lines below a
  // column named `api_key`. Both were Math.random doing exactly what it is for.
  //
  // The name being assigned is what actually separates them. `s?(?![a-z])`
  // rather than a closing \b because the real spelling is camelCase —
  // `inviteToken` failed a trailing boundary, so the check found nothing on
  // precisely the code it exists for — and the lookahead still keeps
  // "resetting" and "tokenizer" out.
  // Case-SENSITIVE, and the first letter is the only one allowed to vary. With
  // an /i flag `(?![a-z])` also rejects an uppercase letter — the class becomes
  // case-insensitive along with everything else — so the lookahead threw out
  // `inviteToken`, which is the exact spelling it was written to accept.
  const WEAK_TOKEN = /\b(?:[Tt]oken|[Ii]nvit(?:e|ation)|[Rr]eset|[Vv]erification|[Oo]tp|[Nn]once|[Ss]ecret|[Aa]pi[_-]?[Kk]ey|[Ss]ession[_-]?[Ii]d|[Ss]hare[_-]?[Ll]ink|[Mm]agic[_-]?[Ll]ink)s?(?![a-z])[^=:;\n]{0,40}[=:]\s*[^;\n]{0,80}Math\.random\s*\(/
  const weakTokenFiles = code.filter((f) => WEAK_TOKEN.test(f.text))
    .map((f) => f.path).slice(0, 3)

  /** A discount code path, and anything bounding how often a code can be used.
   *  Without one, a code posted publicly is a code redeemed until somebody
   *  notices the revenue. */
  const hasPromoCodes = someFile(code, /\b(coupon|promo[_-]?code|promoCode|discount[_-]?code|discountCode|voucher|referral[_-]?code)\b/i)
  const limitsRedemption = someFile(code, /\b(max_redemptions|maxRedemptions|redemption[_-]?limit|times_redeemed|timesRedeemed|usage[_-]?limit|usageLimit|redeemed_by|redeemedBy|once[_-]?per|one[_-]?per[_-]?customer)\b/i)

  /** An account created by a seed or fixture with its password written beside
   *  it. Seeds run against staging and production more often than anybody
   *  intends, and the credential is in the repository either way. */
  const seedFiles = files.filter((f) =>
    /(^|\/)(seed|seeds|fixtures?|demo[-_]?data|sample[-_]?data)[^/]*\.[\w]+$|(^|\/)(seed|seeds|fixtures)\//i.test(f.path)
    && !/__tests__|\.(test|spec)\./i.test(f.path))
  // Two shapes, because seeds are written in both. The second is SQL, where the
  // column and its value are far apart — a key/value pattern alone found
  // nothing in a `seed.sql`, which is the commonest place for this to be.
  const LITERAL_PASSWORD = /\b(?:password|passwd|pwd)\s*[:=]\s*['"][^'"\s]{4,}['"]/i
  const SQL_SEEDED_PASSWORD = /insert\s+into[\s\S]{0,200}?\b(?:password|passwd|pwd)\b[\s\S]{0,200}?values\s*\([^)]*['"][^'"]{4,}['"]/i
  const seededCredentialFiles = seedFiles
    .filter((f) => LITERAL_PASSWORD.test(f.text) || SQL_SEEDED_PASSWORD.test(f.text))
    .map((f) => f.path).slice(0, 3)

  /** A database, and anything that says how it is copied. Nothing here can see
   *  a managed provider's automatic backups, which is why the finding says so
   *  rather than asserting there are none. */
  const hasDatabase = files.some((f) => /(^|\/)(migrations?|supabase\/migrations)\//i.test(f.path))
    || someFile(code, /(?:from|require\()\s*['"](?:pg|mysql2?|prisma|@prisma\/client|drizzle-orm|knex|typeorm|mongoose)['"]/i)
  const OPS_FILE = /(^|\/)\.github\/workflows\/|(^|\/)(scripts?|ops|infra|deploy|terraform|ansible)\/|docker-compose|\.ya?ml$|Makefile|\.sh$/i
  const describesBackup = files.some((f) => OPS_FILE.test(f.path)
    && /\b(pg_dump|pgdump|mysqldump|mongodump|wal-?g|barman|litestream|restic|pitr|point[-_]?in[-_]?time|db[-_]?backup|backup[-_]?db|snapshot[-_]?db)\b/i.test(f.text))

  /** A file handed out by a permanent public URL rather than a signed one that
   *  expires. A link that never expires is a link that outlives the account it
   *  belonged to. */
  const PUBLIC_OBJECT_URL = /getPublicUrl\s*\(|\/storage\/v1\/object\/public\/|\.s3\.[\w-]*\.?amazonaws\.com\//i
  const SIGNED_URL = /createSignedUrl|getSignedUrl|presign|signedUrl|signUrl/i
  const publicObjectFiles = code.filter((f) => PUBLIC_OBJECT_URL.test(f.text))
    .map((f) => f.path).slice(0, 3)
  const signsUrls = someFile(code, SIGNED_URL)

  /** A container image built with a credential baked into a layer. Every layer
   *  is readable by anyone who can pull the image, and deleting the value in a
   *  later layer does not remove it from the earlier one. */
  const dockerFiles = files.filter((f) => /(^|\/)(Dockerfile[\w.-]*|docker-compose[\w.-]*\.ya?ml)$/i.test(f.path))
  const DOCKER_SECRET = /^\s*(?:ENV|ARG)\s+\w*(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL|DSN|CONNECTION_STRING)\w*\s*[= ]\s*["']?[^\s"'$][^\s"']*/im
  const dockerSecretFiles = dockerFiles.filter((f) => DOCKER_SECRET.test(f.text))
    .map((f) => f.path).slice(0, 3)

  return collect([
    {
      id: 'LX-SEC-001',
      area: 'Abuse of the doors',
      title: 'Authentication endpoints exist with no rate limiting in the code',
      severity: 'high',
      absent: hasAuthRoutes && !rateLimit,
      lookedFor: 'a rate limiter, a throttle, or an integration such as Upstash or '
        + 'express-rate-limit',
      detail: 'Sign-in, registration or password-reset routes were found and nothing bounds how '
        + 'often they can be called. Credential stuffing needs nothing more sophisticated than '
        + 'that, and the same gap makes password reset a way to send mail from your domain to '
        + 'anybody, at whatever rate a script can manage.',
      next: 'Rate limit by address and by account, and check whether the hosting platform already '
        + 'provides it before adding a library — many do, at the edge, where it is cheapest.',
      prompt: null,
    },
    {
      id: 'LX-SEC-002',
      area: 'What ships to the browser',
      title: 'Source maps are enabled in the production build',
      severity: 'medium',
      // A presence. It used to be declared as an absence and printed "nothing
      // matching this was found in the files that were read" over a line that
      // had been found — the same sentence inverted, and false.
      kind: 'presence',
      absent: sourcemapsOn,
      lookedFor: 'sourcemap: true, productionBrowserSourceMaps, or a source-map devtool setting '
        + 'in the build configuration',
      files: configs.map((f) => f.path).slice(0, 2),
      detail: 'The build is configured to emit source maps. Anybody opening the developer tools '
        + 'then has the original source — comments, internal names, the shape of every check the '
        + 'client performs — which turns finding a weakness from a search into a read.',
      next: 'Either switch them off for the public build, or keep generating them and upload them '
        + 'privately to whatever reports errors. The second is better: readable stack traces are '
        + 'worth having, just not by everybody.',
      prompt: null,
    },
    {
      id: 'LX-SEC-003',
      area: 'What the browser is told to enforce',
      title: 'No security response headers were found',
      severity: 'medium',
      absent: servesHttp && !headers,
      lookedFor: 'Content-Security-Policy, X-Frame-Options, Referrer-Policy, '
        + 'X-Content-Type-Options, Strict-Transport-Security, or a helmet() call',
      detail: 'Responses are produced and none of the headers that constrain what a browser will '
        + 'do with them were found. These are the cheapest defences available — a few lines that '
        + 'stop the page being framed by somebody else, stop a leaked referrer, and limit what a '
        + 'successful injection could then load.',
      next: 'Check the hosting platform first: several set some of these by default, and adding '
        + 'them twice with different values is worse than adding them once.',
      prompt: null,
    },
    {
      id: 'LX-SEC-004',
      area: 'How secrets are stored',
      title: `${weakHashFiles.length} file(s) hash something secret with MD5 or SHA-1`,
      severity: 'high',
      kind: 'presence',
      absent: weakHashFiles.length > 0,
      files: weakHashFiles,
      lookedFor: 'createHash("md5"), createHash("sha1") or an md5 package, in a file that also '
        + 'mentions a password, token, secret, credential or API key',
      detail: 'Both are fast by design and broken for this purpose: a consumer graphics card '
        + 'tries billions of candidates a second against them, so a stolen table of MD5 password '
        + 'hashes is a stolen table of passwords. Neither is a problem for a checksum, which is '
        + 'why the file also has to be about credentials before this fires.',
      next: 'For passwords use bcrypt, scrypt or Argon2 — algorithms that are deliberately slow '
        + 'and salted per user. For tokens compare with a constant-time function rather than '
        + 'hashing at all. Existing hashes have to be rehashed on next sign-in; they cannot be '
        + 'converted.',
      prompt: null,
    },
    {
      id: 'LX-SEC-005',
      area: 'Abuse of the doors',
      title: 'A WebSocket server accepts connections with no check on who opened them',
      severity: 'high',
      absent: wsServer && !wsAuth,
      lookedFor: 'verifyClient, an io.use() middleware, socket.handshake.auth, or a token read '
        + 'during the connection',
      detail: 'A socket server was found and nothing was found that establishes who is on the '
        + 'other end. HTTP middleware does not run on a protocol upgrade, so a product can be '
        + 'properly guarded over REST and completely open over its socket — and a socket usually '
        + 'carries the live data, which is the part worth taking.',
      next: 'Authenticate during the handshake, not after the first message: a connection that is '
        + 'open while it decides whether to trust you is a connection that can already be sent '
        + 'traffic. Reject rather than disconnect later.',
      prompt: null,
    },
    {
      id: 'LX-SEC-006',
      area: 'What the server trusts',
      title: `${hostHeaderFiles.length} file(s) build a link from the Host header`,
      severity: 'medium',
      kind: 'presence',
      absent: hostHeaderFiles.length > 0,
      files: hostHeaderFiles,
      lookedFor: 'req.headers.host, headers.get("host") or x-forwarded-host, in a file that also '
        + 'builds a URL or sends mail',
      detail: 'The Host header is supplied by whoever is making the request, so a link built from '
        + 'it is a link whose domain the requester chooses. Sent in a password-reset email that '
        + 'is a working reset link pointing at somebody else\'s server, and the person clicking '
        + 'it sees a message from you.',
      next: 'Build outbound links from a configured base URL rather than from the request. If the '
        + 'app genuinely serves several domains, check the header against a list of the ones it '
        + 'serves before using it.',
      prompt: null,
    },
    {
      id: 'LX-SEC-007',
      area: 'What sits in front of the server',
      title: `${publicCacheFiles.length} response(s) are publicly cacheable and read who is asking`,
      severity: 'high',
      kind: 'presence',
      absent: publicCacheFiles.length > 0,
      files: publicCacheFiles,
      lookedFor: 'a Cache-Control header containing public or s-maxage, in a file that also reads '
        + 'a session, a user or an Authorization header',
      detail: 'A shared cache — a CDN, a reverse proxy — stores one copy of a response and serves '
        + 'it to everybody who asks for the same URL. It has no idea that two requests carrying '
        + 'different cookies are different people. A page marked public that was built for one '
        + 'account is then handed to the next person who asks.',
      next: 'Mark anything that varies by user as private, no-store. Where a shared cache is '
        + 'genuinely wanted, add a Vary on the header that distinguishes them and confirm the '
        + 'CDN honours it — several ignore Vary on cookies.',
      prompt: null,
    },
    {
      id: 'LX-SEC-008',
      area: 'What the server trusts',
      title: `${mailHeaderFiles.length} file(s) put input into an email header`,
      severity: 'medium',
      kind: 'presence',
      absent: mailHeaderFiles.length > 0,
      files: mailHeaderFiles,
      lookedFor: 'a subject, to, from, replyTo, cc or bcc field built from a template expression '
        + 'or from a request, beside a mail-sending call',
      detail: 'Headers are separated by newlines, so a newline inside a value ends that header and '
        + 'begins another. A name field containing one adds a recipient, or a reply-to, that '
        + 'nobody in your code chose — and the mail still goes out signed by your domain.',
      next: 'Strip carriage returns and newlines from anything that reaches a header, or pass the '
        + 'value in the body where it belongs. Most mail libraries do not do this for you.',
      prompt: null,
    },
    {
      id: 'LX-SEC-009',
      area: 'How secrets are made',
      title: `${weakTokenFiles.length} file(s) build a token or invite with Math.random`,
      severity: 'high',
      kind: 'presence',
      absent: weakTokenFiles.length > 0,
      files: weakTokenFiles,
      lookedFor: 'Math.random(), in a file that also mentions a token, invite, reset, '
        + 'verification, OTP, nonce or share link',
      detail: 'Math.random is a fast generator for simulations and animation. It is seeded from '
        + 'predictable state and its output can be reconstructed from a few observed values, so '
        + 'an invite or reset link built from it is guessable by anybody who collects a handful '
        + 'of them.',
      next: 'Use crypto.randomUUID() or crypto.getRandomValues / randomBytes. They are in the '
        + 'standard library, are the same length of call, and are the difference between a link '
        + 'somebody can derive and one they cannot.',
      prompt: null,
    },
    {
      id: 'LX-SEC-010',
      area: 'Abuse of the doors',
      title: 'Discount codes exist with nothing limiting how often one can be used',
      severity: 'medium',
      absent: hasPromoCodes && !limitsRedemption,
      lookedFor: 'a redemption ceiling, a per-customer limit, or a record of who has already '
        + 'redeemed a code',
      detail: 'A coupon or referral code path was found and nothing was found that bounds it. A '
        + 'code shared once on a deals forum is then redeemed until somebody notices the revenue, '
        + 'and per-account limits are what stop one person taking a first-order discount '
        + 'repeatedly.',
      next: 'Decide the two limits separately — how many times a code may be used in total, and '
        + 'how many times by one account — and enforce both on the server. Where a payment '
        + 'processor owns the coupon, it may already offer these; check before building them.',
      prompt: null,
    },
    {
      id: 'LX-SEC-011',
      area: 'How secrets are stored',
      title: `${seededCredentialFiles.length} seed or fixture file(s) create an account with a written-in password`,
      severity: 'high',
      kind: 'presence',
      absent: seededCredentialFiles.length > 0,
      files: seededCredentialFiles,
      lookedFor: 'a password, passwd or pwd assigned a literal string, in a seed, fixture or '
        + 'demo-data file — test files excluded',
      detail: 'The credential is in the repository, in its history, and in every clone. Seeds are '
        + 'also run against shared environments more often than anyone intends, so the account '
        + 'tends to exist somewhere reachable — and seeded accounts are usually the ones with '
        + 'administrative rights.',
      next: 'Read the password from the environment at seed time, or generate one and print it '
        + 'once. Then check whether the account already exists anywhere deployed, because '
        + 'removing the line does not remove the account.',
      prompt: null,
    },
    {
      id: 'LX-SEC-012',
      area: 'What happens when it goes wrong',
      title: 'A database is used and nothing in the repository describes a backup',
      severity: 'high',
      absent: hasDatabase && !describesBackup,
      lookedFor: 'pg_dump, mysqldump, mongodump, wal-g, litestream, restic, a point-in-time '
        + 'setting, or a scheduled backup job — in a workflow, script, compose file or '
        + 'infrastructure directory',
      detail: 'Migrations or a database client were found and nothing was found that copies the '
        + 'data anywhere. This is the one failure with no remedy after the fact: every other '
        + 'finding in this report describes something that can be fixed once it happens.',
      next: 'A managed database usually has automatic backups already, in which case the thing to '
        + 'establish is the retention window and whether a restore has ever been attempted — an '
        + 'untested backup is a hypothesis. If it is self-hosted, this is the first thing to add.',
      prompt: null,
    },
    {
      id: 'LX-SEC-013',
      area: 'What is handed out',
      title: `${publicObjectFiles.length} file(s) hand out stored files by permanent public URL`,
      severity: 'medium',
      kind: 'presence',
      absent: publicObjectFiles.length > 0 && !signsUrls,
      files: publicObjectFiles,
      lookedFor: 'getPublicUrl, a /storage/v1/object/public/ path or a direct S3 URL, with no '
        + 'createSignedUrl or getSignedUrl anywhere in the code',
      detail: 'A public object URL works for anybody who has it, for as long as the object '
        + 'exists. It outlives the session that produced it, the account it belonged to, and any '
        + 'later decision to make the data private — and URLs leak through referrers, shared '
        + 'screenshots and browser history.',
      next: 'Sign the URLs and give them a short expiry. Where files are genuinely public — '
        + 'marketing images, avatars — this is the right call and nothing needs doing; the '
        + 'question is whether anything in that bucket is not.',
      prompt: null,
    },
    {
      id: 'LX-SEC-014',
      area: 'How secrets are stored',
      title: `${dockerSecretFiles.length} container file(s) set a secret-shaped value at build time`,
      severity: 'high',
      kind: 'presence',
      absent: dockerSecretFiles.length > 0,
      files: dockerSecretFiles,
      lookedFor: 'an ENV or ARG line naming a KEY, SECRET, TOKEN, PASSWORD, CREDENTIAL, DSN or '
        + 'connection string, with a value written beside it, in a Dockerfile or compose file',
      detail: 'A value set in an image layer is readable by anybody who can pull the image — '
        + '`docker history` prints it — and unsetting it in a later layer does not remove it from '
        + 'the earlier one. A build argument is worse: it is recorded even when it is never used '
        + 'at runtime.',
      next: 'Pass secrets at run time through the environment or a secret mount, not at build '
        + 'time. Anything already committed this way should be treated as disclosed and rotated, '
        + 'because the image may have been pushed.',
      prompt: null,
    },
  ])
}

// ── Deliberately not checked ────────────────────────────────────────────────
//
// Items from the checklist that a file cannot answer, listed so their absence
// is a decision rather than an omission. These are reported as limitations on
// the sections that own them.
//
//   Colour contrast against WCAG AA — needs computed styles, not source.
//   Cross-browser and cross-device behaviour — needs the running product.
//   Whether a build passes type checking and linting — needs the build to run,
//     and this analysis executes nothing in the repository it reads.
//   Whether tests actually pass — same reason. Their presence is reported by
//     the engineering quality section; their result is not knowable from here.
//   "Feels faster than enterprise tools", "time to value in 1-2 clicks" —
//     judgements about an experience, measured by watching somebody use it.
//   Whether LLM-written code calls methods that do not exist — decidable only
//     against the installed version of each library, which this does not read.
//
// ── Four security questions that need a running system ──
//
// Asked for by name, and not answerable here. Each needs something outside the
// repository, and the brief for this report is static analysis with no network
// access — so the honest answer is to say which and why, rather than to ship a
// check that looks at a filename and calls it evidence.
//
//   A public staging site — needs somebody to resolve and request a hostname.
//   Secrets printed in build logs — needs the run output, which lives wherever
//     the build runs and not in the repository. What IS checkable is a workflow
//     that echoes a secret, and that is not yet written.
//   Secrets inside a built container image — needs the image. The Dockerfile is
//     read, and LX-SEC-014 reports a credential written into one, but a secret
//     that arrives in a layer some other way is invisible from here.
//   A metrics or admin endpoint reachable from outside — the route is often in
//     the code, but whether it is exposed is a question about the deployment.
//
// Race conditions were asked for too and are partly approximable — a
// read-modify-write with no transaction around it has a shape — but only
// partly, and a check that finds a third of them while reading as though it
// found all of them is worse than none. Not attempted.
export const NOT_STATICALLY_CHECKABLE: string[] = [
  'Colour contrast against WCAG AA, which needs computed styles rather than source.',
  'Whether a focus indicator clears 3:1 against the colours next to it. The indicator can be '
  + 'found in the stylesheet; what it lands on cannot, because the colour behind it depends on '
  + 'the theme, the state and what is underneath at the time.',
  'Whether focus actually moves into a dialog when it opens, stays inside it, and returns to the '
  + 'control that opened it. All three are things that happen when the page runs. A file can show '
  + 'that focus handling was written; it cannot show that it works.',
  'Whether a live region is announced. The attribute is visible in the markup, but whether a '
  + 'screen reader speaks it depends on when the region entered the DOM relative to its content, '
  + 'which is a question about the running page.',
  'The real size of a tap target in CSS pixels, against the 24×24 minimum. Size comes from '
  + 'layout — padding, line height, inherited font size, the box it sits in — and is not '
  + 'decidable from the classes on an element.',
  'Whether the layout reflows at 400% zoom without clipping or sideways scrolling. That is a '
  + 'measurement of a rendered viewport.',
  'Whether a reading order matches the visual order. The DOM order is readable; the visual order '
  + 'depends on CSS that has been applied and laid out.',
  'Whether alt text is any good. Its presence is checkable and its accuracy is not — "image" and '
  + '"chart showing revenue falling in Q3" are indistinguishable to a pattern.',
  'Whether the build passes type checking and linting, and whether the tests pass: this '
  + 'analysis executes nothing in the repository, so it can report that tests exist but never '
  + 'that they succeed.',
  'Cross-browser and cross-device behaviour, which needs the running product.',
  'Whether generated code calls library methods that no longer exist, which is decidable only '
  + 'against the installed version of each dependency.',
  'Whether a staging or preview site is publicly reachable, whether a metrics or admin endpoint '
  + 'is exposed, and whether secrets appear in build logs or inside a built container image. Each '
  + 'needs a running system, or the output of whatever runs the build, rather than the '
  + 'repository. A credential written into a Dockerfile is reported; one that reaches an image '
  + 'another way is not visible here.',
  'Race conditions. A read-modify-write with no transaction around it has a recognisable shape, '
  + 'but only some of them do, and a check that found a third of them while reading as though it '
  + 'found all of them would be worse than none.',
]
