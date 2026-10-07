// daemon/src/integrations/poschi/monetization/analyse.ts
//
// What the product actually does about money.
//
// ── The question this answers, and the one it cannot ─────────────────────────
//
// It answers: is there a way for money to move, and what is built around it.
// Processors, checkout calls, webhooks, price definitions, the endpoints that
// grant a subscription, and whether any of them are marked as placeholders.
//
// It does not answer how much revenue there is, whether pricing is right, or
// what customers would pay. Those need financial data and customers, and no
// amount of reading gets there.
//
// ── Why the distinction is worth a whole module ──────────────────────────────
//
// A product can have a complete monetization SURFACE — plans, a pricing page,
// a transaction history, revenue totals on an admin dashboard — and collect
// nothing at all. Every one of those reads as evidence of a working business
// model, and a report that counted them would say so. What separates the two is
// a single question: does a payment processor ever get called.
//
// So that question is asked first and answered plainly, and everything else is
// reported underneath it as surface.

import { withPrompts } from './prompts.js'

export interface SourceFile {
  path: string
  text: string
}

export type Severity = 'high' | 'medium' | 'low' | 'info'
export type Confidence = 'verified' | 'indicated' | 'hypothesis'

export interface MoneyFinding {
  id: string
  area: string
  title: string
  severity: Severity
  confidence: Confidence
  detail: string
  /** Where to look. `path:line` where a line is known. */
  files: string[]
  because: string
  next: string
  isAbsence: boolean
  /** A Claude Code prompt, where code is the right response. Null where the
   *  next step is to read something, decide something, or rotate a credential. */
  prompt?: string | null
}

export interface MonetizationReport {
  findings: MoneyFinding[]
  surfaces: {
    /** Endpoints or pages that offer, grant or list paid things. */
    named: string[]
    /** Processor packages found in the manifest. */
    processors: string[]
    /** Call sites that would move money. */
    chargeSites: Array<{ path: string; line: number; snippet: string }>
    /** Webhook handlers, which are how a processor tells a product what
     *  happened after the fact. */
    webhooks: string[]
    /** Places a price is defined in code. */
    priceSites: string[]
    /** Money paths carrying a placeholder marker. */
    placeholders: Array<{ path: string; line: number; snippet: string }>
    /** Code that sums amounts into a revenue figure. */
    revenueAggregation: string[]
  }
  /** True when a surface exists and nothing found would take payment. */
  surfaceWithoutCollection: boolean
}

/** Packages whose presence means a processor is wired in. */
const PROCESSORS = [
  'stripe', '@stripe/stripe-js', '@stripe/react-stripe-js', 'paddle', '@paddle/paddle-js',
  'lemonsqueezy', '@lemonsqueezy/lemonsqueezy.js', 'paypal', '@paypal/react-paypal-js',
  'braintree', 'square', '@square/web-sdk', 'adyen', 'razorpay', 'mollie', 'revenuecat',
]

/** Calls that actually move money, as opposed to describing it. */
const CHARGE = /(paymentIntents?\.create|checkout\.sessions?\.create|charges?\.create|createPaymentIntent|confirmCardPayment|createCheckoutSession|subscriptions?\.create\s*\(|orders\.create)/i

/** A handler a processor calls back into. */
const WEBHOOK = /(webhook|constructEvent|stripe-signature|paddle-signature)/i

/** A price, defined in code rather than fetched. */
const PRICE = /\b(price|amount|unitAmount|unit_amount|monthlyPrice|annualPrice)\s*[:=]\s*[0-9]/

/** A marker that a money path is not finished. */
const PLACEHOLDER = /\b(demo|mock|placeholder|stub|dummy|for now|not implemented|TODO|FIXME)\b/i

/** Words that make a file worth reading for money. */
const MONEY_WORDS = /(subscription|billing|invoice|payment|checkout|transaction|plan|pricing|revenue)/i

/**
 * Prose, which quotes code without being code.
 *
 * A money path is something that runs. A Markdown file that discusses one is
 * not, and it matches the same patterns far more readily — it is mostly words,
 * and the words it uses are the ones being searched for.
 *
 * Measured: run against a repository keeping its reports in `docs/`, this
 * reported "49 money path(s) carry a placeholder marker" on lines like
 * `docs/…report.md:1103 - 'src/…/ExceptionRadar.tsx:163 placeholder="e.g.
 * known, price ids land with the new processor account"'`. That is a sentence
 * about a form field. Worse, the reports it was reading were this tool's own
 * output, so each run quoted the last one back and the count grew by itself.
 *
 * Scanning is configured to skip documentation now, so in the normal case these
 * files never arrive. This is the guard for the case where somebody turns that
 * back on — reading the docs is a reasonable thing to want, and it should not
 * silently re-introduce a fault in the money findings.
 *
 * A denylist rather than a list of code extensions: an allowlist that forgets a
 * language stops reporting real placeholders in it, and that is the direction
 * this must not fail in.
 */
const PROSE_FILE = /\.(md|mdx|markdown|rst|adoc|txt)$/i

function linesOf(f: SourceFile): string[] {
  return f.text.split('\n')
}

function snippet(s: string): string {
  return s.trim().slice(0, 140)
}

export interface AnalyseMoneyOptions {
  pkg?: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } | null
  /** Same staleness gate the engineering review uses: an absence read from an
   *  old checkout is a statement about history. */
  stale?: boolean
}

/**
 * The inventory.
 *
 * Every finding names a file, and the ones that matter name a line — a claim
 * about whether a product takes money has to be checkable in one click, because
 * it is the kind of claim somebody will want to disagree with.
 */
export function analyseMonetization(
  files: SourceFile[],
  opts: AnalyseMoneyOptions = {},
): MonetizationReport {
  const deps = { ...(opts.pkg?.dependencies ?? {}), ...(opts.pkg?.devDependencies ?? {}) }
  const processors = Object.keys(deps).filter(
    (d) => PROCESSORS.some((p) => d.toLowerCase() === p || d.toLowerCase().includes(p)),
  )

  const chargeSites: MonetizationReport['surfaces']['chargeSites'] = []
  const placeholders: MonetizationReport['surfaces']['placeholders'] = []
  const priceSites: string[] = []
  const webhooks: string[] = []
  const revenueAggregation: string[] = []
  const named = new Set<string>()

  for (const f of files) {
    const ls = linesOf(f)
    const moneyFile = MONEY_WORDS.test(f.path) || MONEY_WORDS.test(f.text)
    const prose = PROSE_FILE.test(f.path)

    for (let i = 0; i < ls.length; i += 1) {
      const line = ls[i]!
      if (CHARGE.test(line)) chargeSites.push({ path: f.path, line: i + 1, snippet: snippet(line) })
      if (WEBHOOK.test(line) && !webhooks.includes(f.path)) webhooks.push(f.path)
      if (PRICE.test(line) && !priceSites.includes(f.path)) priceSites.push(f.path)

      // A placeholder only counts where money is the subject, and where the
      // file is something that runs. "demo" in a component name says nothing
      // about whether the product charges, and neither does a report quoting
      // one back.
      if (moneyFile && !prose && PLACEHOLDER.test(line) && /\b(amount|price|charge|payment|subscription|transaction)\b/i.test(line)) {
        placeholders.push({ path: f.path, line: i + 1, snippet: snippet(line) })
      }

      // Endpoints and pages that offer or grant a paid thing.
      const route = /["'`](\/[\w\-/:.]*(?:subscription|billing|invoice|payment|checkout|transaction|plan)[\w\-/:.]*)["'`]/i.exec(line)
      if (route?.[1]) named.add(route[1])

      if (/\+=?\s*\(?\s*\w*\.?(amount|revenue|total)\b/i.test(line) && /reduce|sum|revenue|total/i.test(line)) {
        if (!revenueAggregation.includes(f.path)) revenueAggregation.push(f.path)
      }
    }
  }

  const collects = processors.length > 0 || chargeSites.length > 0
  const hasSurface = named.size > 0 || priceSites.length > 0
  const surfaceWithoutCollection = hasSurface && !collects

  const absenceBecause = opts.stale
    ? 'This is an absence, and the checkout is behind the deployed product, so it may exist in code '
      + 'not present here.'
    : 'This is an absence. The strongest available claim is that these files contain no such call.'

  const findings: MoneyFinding[] = []

  // ── The question everything else hangs on ─────────────────────────────────
  if (surfaceWithoutCollection) {
    findings.push({
      id: 'surface-without-collection',
      area: 'Revenue',
      title: 'A monetization surface exists and nothing here collects payment',
      severity: 'high',
      confidence: opts.stale ? 'indicated' : 'verified',
      detail: `${named.size} paid endpoint(s) or page(s) and ${priceSites.length} file(s) defining a `
        + 'price, with no payment processor in the manifest and no call that would move money. '
        + 'Plans can be offered and granted; nothing found would take a card.',
      files: [...named].slice(0, 6),
      because: `${absenceBecause} A processor could also be called from infrastructure this does not `
        + 'read — a payment link generated elsewhere, or a hosted page.',
      next: 'Confirm how money actually reaches the business today. If it is a link sent by hand, '
        + 'that is a working model and the finding closes — but it means the product’s own '
        + 'transaction records are not settlements, and no figure derived from them is revenue.',
      isAbsence: true,
    })
  } else if (collects) {
    findings.push({
      id: 'collection',
      area: 'Revenue',
      title: processors.length
        ? `Payment is wired through ${processors.join(', ')}`
        : `${chargeSites.length} call site(s) would move money`,
      severity: 'info',
      confidence: 'verified',
      detail: processors.length
        ? `Processor package(s) in the manifest, with ${chargeSites.length} charge call site(s).`
        : 'No processor package is declared, yet calls that move money are present — worth checking '
          + 'what they call.',
      files: chargeSites.slice(0, 5).map((c) => `${c.path}:${c.line}`),
      because: 'Read from the manifest and the call sites.',
      next: 'Check that every charge path has a webhook behind it, or the product learns nothing '
        + 'about a payment that fails after the fact.',
      isAbsence: false,
    })
  }

  // ── Placeholders on the money path ────────────────────────────────────────
  if (placeholders.length > 0) {
    findings.push({
      id: 'placeholder-money',
      area: 'Revenue',
      title: `${placeholders.length} money path(s) carry a placeholder marker`,
      severity: 'high',
      confidence: 'verified',
      detail: 'Code that handles a subscription, a transaction or an amount says in its own words '
        + 'that it is unfinished. This is the strongest available evidence that the flow is not '
        + 'collecting: it is not an inference from absence, it is a note the author left.',
      files: placeholders.slice(0, 6).map((p) => `${p.path}:${p.line}  ${p.snippet}`),
      because: 'The lines are quoted as found. What the author meant is not something this can '
        + 'confirm — a stale comment on finished code would read the same.',
      next: 'Read each one. A transaction written as completed with a zero amount is a record that '
        + 'says a payment happened when none did, and anything counting those is counting nothing.',
      isAbsence: false,
    })
  }

  // ── Webhooks ──────────────────────────────────────────────────────────────
  if (collects && webhooks.length === 0) {
    findings.push({
      id: 'no-webhook',
      area: 'Revenue',
      title: 'Payment is taken and nothing listens for what happens next',
      severity: 'high',
      confidence: opts.stale ? 'indicated' : 'verified',
      detail: 'No webhook handler was found. A charge that later fails, is refunded, or is disputed '
        + 'is invisible to a product that only knows what happened at the moment of checkout.',
      files: [],
      because: absenceBecause,
      next: 'Add the handler before the first refund rather than after it.',
      isAbsence: true,
    })
  }

  // ── Revenue figures built from those records ──────────────────────────────
  if (revenueAggregation.length > 0 && surfaceWithoutCollection) {
    findings.push({
      id: 'revenue-from-records',
      area: 'Reporting',
      title: 'Revenue is totalled from records that no payment created',
      severity: 'medium',
      confidence: 'indicated',
      detail: `${revenueAggregation.length} file(s) sum transaction amounts into a revenue figure, `
        + 'while nothing found collects payment. Whatever those figures show, they are the sum of '
        + 'rows the application wrote rather than money that arrived.',
      files: revenueAggregation.slice(0, 5),
      because: 'The aggregation is read directly. Whether a figure is ever shown to somebody as '
        + 'revenue depends on where it is rendered, which this does not trace.',
      next: 'Label the figure for what it is until settlement exists behind it. A dashboard number '
        + 'nobody can reconcile is worse than no number, because somebody will plan against it.',
      isAbsence: false,
    })
  }

  // ── What is built, as an inventory rather than a judgement ────────────────
  if (named.size > 0) {
    findings.push({
      id: 'surface-inventory',
      area: 'What exists',
      title: `${named.size} monetization endpoint(s) and page(s)`,
      severity: 'info',
      confidence: 'verified',
      detail: [...named].sort().join(', '),
      files: [],
      because: 'Read from route and endpoint literals.',
      next: 'This is the shape of the business model as the code expresses it. Worth checking it '
        + 'against how the business describes itself.',
      isAbsence: false,
    })
  }

  if (findings.length === 0) {
    findings.push({
      id: 'no-monetization',
      area: 'Revenue',
      title: 'No monetization of any kind in these files',
      severity: 'info',
      confidence: opts.stale ? 'indicated' : 'verified',
      detail: 'No processor, no price definition, no paid endpoint. Either the product does not '
        + 'charge, or it charges somewhere this did not read.',
      files: [],
      because: absenceBecause,
      next: 'If the business does charge, find where — and that is the code this analysis should be '
        + 'pointed at.',
      isAbsence: true,
    })
  }

  const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2, info: 3 }
  findings.sort((a, b) => rank[a.severity] - rank[b.severity])

  return {
    // Attached last, so a finding cannot be written to fit a prompt that
    // already existed.
    findings: withPrompts(findings),
    surfaces: {
      named: [...named].sort(),
      processors,
      chargeSites,
      webhooks,
      priceSites,
      placeholders,
      revenueAggregation,
    },
    surfaceWithoutCollection,
  }
}
