// daemon/src/flow-reports/analyzers/revenue.ts
//
// Ways this product could earn more, read from what it has already built.
//
// ── Why the monetization section needed this ─────────────────────────────────
//
// The analyser behind that section audits payment PLUMBING: is there a checkout,
// does anything collect, does a webhook listen, are the amounts placeholders. All
// worth knowing, and all of it answers "is the money machine wired up" rather
// than "is there more money available here". A founder reading it learns whether
// Stripe is connected, not whether they are leaving anything on the table.
//
// ── The line this must not cross ─────────────────────────────────────────────
//
// An opportunity that is not grounded in the repository is advice, and generic
// advice is what makes a report feel machine-written: every product can be told
// to add a subscription, launch an API, or start an affiliate scheme. None of
// that is analysis.
//
// So every opportunity here names the capability in THIS repository that makes
// it available, and none of them fire on an absence alone. "You already send SMS
// and email on every account's behalf, and nothing meters it" is a finding.
// "Consider usage-based pricing" is not.
//
// ── Not scored ───────────────────────────────────────────────────────────────
//
// These are opportunities, not defects, so they carry `info` and the section
// they land in reports no score. A product that has not built a second revenue
// stream is not damaged, and a number here would say that it was. The section's
// exclusion from the overall figure is enforced in `summarize.ts`, at the point
// where that figure is computed.

import type { PoschiCommonFinding } from './normalize.js'
import { readAccountShape, type AccountShape } from './dualRole.js'
import type { DerivedRole } from '../poschi/sitemap/deriveSitemap.js'

export interface SourceFile { path: string; text: string }

/**
 * Only code answers these questions.
 *
 * ── What searching everything cost ───────────────────────────────────────────
 *
 * Every signal below was first matched against the whole repository, and
 * measured across five projects almost every hit was prose or an asset. A CSS
 * icon font declaring `.ri-openai-fill` became "this product calls a model". A
 * link ending `/blob/main/LICENSE.md` became "this product pays for file
 * storage". An HTML comment reading "see the markup" became "a platform fee is
 * already taken", which SUPPRESSED a finding. A game's stylesheet saying
 * "payout" became payment rails. A pricing document arguing AGAINST usage-based
 * billing became evidence that usage was already metered.
 *
 * A document describing a thing is not the thing. What a product does is in its
 * code, its schema and its manifest, so that is where these are read.
 */
const CODE_FILE = /\.(ts|tsx|js|jsx|mjs|cjs|sql|json|prisma|py|rb|go|php|cs|java|kt)$/i

/** Rails that move money to somebody who is not the platform. Their presence is
 *  what makes a platform fee a question at all — a product that only charges
 *  its own customers has no third party to take a cut from. A bare "payout" is
 *  deliberately not here: it is an ordinary English word. */
const PAYOUT_RAILS = /transfer_data|destination\s*:\s*['"`]acct_|connected[_ ]?account|stripe[- ]?connect|on_?behalf_?of|\/v1\/accounts/i

/** A cut of that money. Absence is the opportunity — and a false positive here
 *  hides a finding rather than inventing one, so it stays broad. `markup` was
 *  removed: in a web codebase it means HTML far more often than a margin. */
const PLATFORM_FEE = /application_fee|applicationFee|platform_fee|platformFee|take[_ ]?rate|takeRate|\bcommission\b|fee_?(amount|percent|bps)/i

/**
 * Services that bill their customer per use, recognised two ways.
 *
 * `packages` is matched against declared dependencies and real imports; a
 * dependency is a commitment where a word is not. That alone proved too narrow:
 * a codebase whose integrations live in edge functions calls these providers
 * over REST, so nothing appears in any manifest. Measured against a product
 * that demonstrably sends both email and text messages, package matching found
 * neither, while `api.resend.com` appeared in thirteen files and
 * `api.twilio.com` in one.
 *
 * So `endpoints` matches the provider's own host. It is as specific as a
 * dependency and survives any language or runtime — and unlike a bare product
 * name, an icon font cannot contain it.
 */
interface MeteredService {
  service: string
  packages: RegExp
  endpoints: RegExp
}

const METERED: MeteredService[] = [
  {
    service: 'text messages',
    packages: /^(twilio|@twilio\/.+|vonage|@vonage\/.+|messagebird)$/i,
    endpoints: /api\.twilio\.com|rest\.nexmo\.com|api\.vonage\.com|rest\.messagebird\.com/i,
  },
  {
    service: 'transactional email',
    packages: /^(resend|@sendgrid\/.+|postmark|postmark-js|mailgun|mailgun\.js|@aws-sdk\/client-ses)$/i,
    endpoints: /api\.resend\.com|api\.sendgrid\.com|api\.postmarkapp\.com|api\.mailgun\.net|email\.[a-z0-9-]+\.amazonaws\.com/i,
  },
  {
    service: 'model calls',
    packages: /^(openai|@anthropic-ai\/.+|@google\/generative-ai|@google\/genai|ollama|cohere-ai|replicate|@mistralai\/.+)$/i,
    endpoints: /api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.cohere\.ai|api\.replicate\.com|bedrock-runtime\./i,
  },
  {
    service: 'file storage',
    packages: /^(cloudinary|cloudinary-core|uploadthing|@uploadthing\/.+|@aws-sdk\/client-s3|@vercel\/blob|@uploadcare\/.+|imagekit)$/i,
    endpoints: /api\.cloudinary\.com|res\.cloudinary\.com|s3[.-][a-z0-9-]*\.?amazonaws\.com|\.blob\.core\.windows\.net|storage\.from\(/i,
  },
]

/**
 * Metering that exists for BILLING, not for abuse — and written as an
 * identifier rather than as English.
 *
 * A rate limiter protects the service; an allowance is a product decision about
 * what a plan includes. Matching `rate_limit` would read an admin throttle page
 * as evidence that usage is already priced.
 *
 * The prose version of this was worse than useless, because a false positive
 * here SUPPRESSES the finding. In one repository it matched "a mobile visitor
 * on a metered connection" in a media-query hook, an affiliate's "Monthly
 * Quota" of signups, and "$0.05 per message overage" inside a pricing memo that
 * was proposing the idea rather than implementing it. On that evidence a
 * product that sends text messages and email with no allowance anywhere was
 * recorded as already metering them.
 *
 * Requiring the identifier form fixes all four: a field is `monthly_quota`, a
 * label is "Monthly Quota", and prose is neither.
 *
 * A bare `usage_limit` and `credits_remaining` came off for the same reason.
 * Both are real fields and neither is about this: one caps how many times a
 * discount code can be redeemed, the other counts prepaid services a customer
 * bought. Neither says a plan includes an amount of anything.
 */
const ALLOWANCE = /\b(overage_\w+|\w+_overage|included_(messages|minutes|credits|units)|(message|sms|email|api|model|token)_(allowance|quota|limit)|monthly_(allowance|quota)|usage_records?)\b|(usage_type|billing_scheme)\s*:\s*['"`]metered/i

/** A recurring charge of any kind. */
const SUBSCRIPTION = /\bsubscriptions?\b|\bbilling_cycle\b|\brecurring\b|\bstripe_price\b|price_id|\bplan_id\b/i

/** A term longer than a month, which is the cheapest retention lever there is. */
const ANNUAL_TERM = /\bannual(ly)?\b|\byearly\b|per[_ ]year|\/\s*yr\b|12\s*months|interval\s*:\s*['"`]year/i

const uniq = (xs: string[]): string[] => [...new Set(xs)]

/** Paths of files matching a pattern, capped so evidence stays readable. */
function hits(files: SourceFile[], p: RegExp, cap = 3): string[] {
  const out: string[] = []
  for (const f of files) {
    if (p.test(f.text)) out.push(f.path)
    if (out.length >= cap) break
  }
  return out
}

const present = (files: SourceFile[], p: RegExp): boolean => files.some((f) => p.test(f.text))

/**
 * What this product actually depends on: declared runtime dependencies, plus
 * anything imported by name.
 *
 * `devDependencies` are left out. A build tool is not a per-use cost the
 * product carries in production, and counting them would report a test-time
 * mock of a paid service as a paid service.
 */
function packagesUsed(files: SourceFile[]): Map<string, string> {
  const found = new Map<string, string>()

  for (const f of files) {
    if (!/(^|\/)package\.json$/i.test(f.path)) continue
    try {
      const deps = JSON.parse(f.text)?.dependencies
      if (deps && typeof deps === 'object') {
        for (const name of Object.keys(deps)) if (!found.has(name)) found.set(name, f.path)
      }
    } catch { /* an unparseable manifest says nothing, and must not throw */ }
  }

  // An import is as good as a declaration, and catches a workspace that keeps
  // its manifest somewhere the scan did not reach.
  const IMPORT = /(?:from|require\(|import\()\s*['"]([@\w][\w@/.-]*)['"]/g
  for (const f of files) {
    if (!CODE_FILE.test(f.path)) continue
    for (const m of f.text.matchAll(IMPORT)) {
      const name = m[1]!
      if (name.startsWith('.') || name.startsWith('/')) continue
      // `@scope/pkg/sub` and `pkg/sub` both resolve to their package.
      const pkg = name.startsWith('@') ? name.split('/').slice(0, 2).join('/') : name.split('/')[0]!
      if (!found.has(pkg)) found.set(pkg, f.path)
    }
  }

  return found
}

export interface RevenuePicture {
  shape: AccountShape
  /** Per-use services the platform pays for, named as a reader would say them. */
  meteredServices: string[]
  meteredFiles: string[]
  hasAllowance: boolean
  hasPayoutRails: boolean
  payoutFiles: string[]
  hasPlatformFee: boolean
  hasSubscription: boolean
  hasAnnualTerm: boolean
}

export function readRevenuePicture(
  files: SourceFile[],
  roles: Record<string, DerivedRole>,
): RevenuePicture {
  // Every signal below reads code, schema and manifests only. See CODE_FILE.
  const code = files.filter((f) => CODE_FILE.test(f.path))

  const packages = packagesUsed(files)
  const meteredServices: string[] = []
  const meteredFiles: string[] = []
  for (const { service, packages: pkg, endpoints } of METERED) {
    const declared = [...packages].filter(([name]) => pkg.test(name)).map(([, where]) => where)
    const called = hits(code, endpoints, 2)
    if (declared.length === 0 && called.length === 0) continue
    meteredServices.push(service)
    meteredFiles.push(...declared, ...called)
  }

  return {
    shape: readAccountShape(files, roles),
    meteredServices,
    meteredFiles: uniq(meteredFiles).slice(0, 4),
    hasAllowance: present(code, ALLOWANCE),
    hasPayoutRails: present(code, PAYOUT_RAILS),
    payoutFiles: hits(code, PAYOUT_RAILS),
    hasPlatformFee: present(code, PLATFORM_FEE),
    hasSubscription: present(code, SUBSCRIPTION),
    hasAnnualTerm: present(code, ANNUAL_TERM),
  }
}

/**
 * The opportunities, each grounded in something already built.
 *
 * All `info`: an opportunity is not damage, and the reader decides what is worth
 * pursuing. They are ordered by how much of the work already exists.
 */
export function revenueOpportunities(p: RevenuePicture): PoschiCommonFinding[] {
  const out: PoschiCommonFinding[] = []
  const { shape } = p

  // ── An audience that pays nothing ─────────────────────────────────────────
  if (shape.paidRole && shape.freeRoles.length > 0) {
    const paid = shape.paidRole
    const free = shape.freeRoles.join(' and ')
    out.push({
      id: 'REV-001',
      area: 'Who pays',
      title: `Only ${paid} accounts pay; ${free} accounts are free`,
      severity: 'info',
      confidence: 'verified',
      detail:
        `The plan and checkout screens sit in the ${paid} area and nowhere else, so every `
        + `${free} account uses the product without ever being charged. That is a reasonable `
        + `way to start — the free side is usually what makes the paid side worth paying for — `
        + `and it also means one whole audience is a revenue stream that has never been tried. `
        + `The question worth answering is what a ${free} would pay for that the product `
        + `already does: the things they come back for are built, and pricing them is a `
        + `packaging decision rather than a build.`,
      // Routes rather than files, and the evidence field carries file paths, so
      // the routes are named in the rationale instead of being dropped.
      files: [],
      because:
        `Read from the router: ${paid} has the billing screens `
        + `(${shape.billingRoutes.slice(0, 2).join(', ')}) and ${free} has none. This says `
        + `nothing about whether charging them is a good idea, only that it has not been built.`,
      next:
        `Look at what the ${free} side returns for most often and decide whether any of it is `
        + `worth paying for. A paid ${free} tier, a one-off charge for something premium, or `
        + `leaving it free on purpose are all answers — the one to avoid is never having asked.`,
      isAbsence: true,
      prompt: null,
    })
  }

  // ── Money moves and the platform takes none of it ─────────────────────────
  if (p.hasPayoutRails && !p.hasPlatformFee) {
    out.push({
      id: 'REV-002',
      area: 'Taking a cut',
      title: 'The platform moves money between people and takes none of it',
      severity: 'info',
      confidence: 'indicated',
      detail:
        'Payments are routed to somebody other than the platform, which means the product '
        + 'carries the cost and the risk of moving that money — the integration, the disputes, '
        + 'the support when it goes wrong — while the whole amount passes through. No platform '
        + 'fee, commission or markup appears anywhere in the code. Every payment that already '
        + 'works is a payment a percentage could be taken from, and that revenue scales with '
        + 'the product being used rather than with accounts being sold.',
      files: p.payoutFiles,
      because:
        'Read from the payment code: the rails that pay a third party are present and no fee, '
        + 'commission or markup is applied to them. A fee configured in a payment '
        + 'provider\'s dashboard rather than in code would not be visible here.',
      next:
        'Decide whether a percentage of each payment is part of the model. If it already is '
        + 'and it is set outside the code, that is worth recording somewhere the next person '
        + 'will find it.',
      isAbsence: true,
      prompt: null,
    })
  }

  // ── Per-use costs, absorbed ───────────────────────────────────────────────
  if (p.meteredServices.length > 0 && !p.hasAllowance) {
    const list = p.meteredServices.length === 1
      ? p.meteredServices[0]!
      : `${p.meteredServices.slice(0, -1).join(', ')} and ${p.meteredServices.at(-1)}`
    out.push({
      id: 'REV-003',
      area: 'What each account costs to run',
      // Phrased so it stays grammatical whether one service was found or four.
      // "file storage are paid for per use" was the first version.
      title: `No plan includes an allowance for ${list}`,
      severity: 'info',
      confidence: 'indicated',
      detail:
        `This product depends on services billed per use — ${list} — and `
        + 'no allowance, included quantity or overage appears anywhere. Two things follow. The '
        + 'first is a cost that rises with use whether or not the account causing it pays more, '
        + 'so the heaviest accounts are the least profitable. The second is that an allowance is '
        + 'the most natural upgrade prompt a product can have — it arrives exactly when somebody '
        + 'is getting value, rather than as a marketing message.',
      files: p.meteredFiles,
      because:
        'Read from the declared dependencies and imports, not from the words appearing '
        + 'somewhere — and from the absence of any allowance, included quantity or overage '
        + 'beside them. Limits set in the billing account of the service being used, or a plan '
        + 'allowance held outside the code, would not appear here.',
      next:
        'Measure what the busiest accounts cost to serve before pricing anything. If the spread '
        + 'is wide, an included quantity per plan turns that cost into a reason to upgrade; if '
        + 'it is narrow, this is not worth the complexity.',
      isAbsence: true,
      prompt: null,
    })
  }

  // ── Monthly only ──────────────────────────────────────────────────────────
  if (p.hasSubscription && !p.hasAnnualTerm) {
    out.push({
      id: 'REV-004',
      area: 'How often people are charged',
      title: 'Subscriptions renew monthly with no longer term offered',
      severity: 'info',
      confidence: 'indicated',
      detail:
        'A recurring charge exists and nothing in the code offers a yearly one. An annual term '
        + 'is the cheapest lever on this list: it is a price field and a checkout option rather '
        + 'than a feature, it collects twelve months of revenue at once, and it removes eleven '
        + 'opportunities a year for somebody to reconsider. The usual shape is a discount worth '
        + 'about two months, which customers read as good value and the business takes as '
        + 'cash now.',
      files: [],
      because:
        'An absence. A recurring charge is present in the code and no yearly interval, annual '
        + 'price or equivalent appears beside it. A term configured only in the payment '
        + 'provider would not be visible here.',
      next:
        'Add an annual option beside the existing one before building anything larger. It is '
        + 'the smallest change on this list and the one with the most certain effect.',
      isAbsence: true,
      prompt: null,
    })
  }

  return out
}
