// daemon/src/integrations/poschi/compliance/analyse.ts
//
// Where this product is exposed, read from its own code.
//
// ── This is not legal advice and the report says so on its cover ─────────────
//
// Nothing here is a legal opinion. What it does is narrower and still useful:
// it finds the SHAPES in the code that trigger a rule — a subscription with a
// renewal, an email send, a provider paid for work, a signup with no age gate —
// and says which rule attaches to that shape and what the code would need to
// show. Whether POSCHI complies is a question for a lawyer looking at the whole
// business, and several of these depend on facts no repository contains.
//
// The distinction matters because a compliance report that reads as a verdict
// gets filed instead of acted on, and because being wrong in the reassuring
// direction here is expensive in a way the other reports are not.
//
// ── Absence is weaker here than anywhere else ────────────────────────────────
//
// "No unsubscribe link in the source" can mean the mail provider adds one, and
// most do. So every finding built on an absence says what would innocently
// explain it, and the ones that cannot be settled from code are graded so.

import { withCompliancePrompts } from './prompts.js'

export interface SourceFile {
  path: string
  text: string
}

export type Severity = 'high' | 'medium' | 'low' | 'info'
export type Confidence = 'verified' | 'indicated' | 'hypothesis'

export interface ComplianceFinding {
  id: string
  /** The rule or regime this attaches to, as a reader would name it. */
  area: string
  title: string
  severity: Severity
  confidence: Confidence
  /** What was found in the code, and where. */
  detail: string
  files: string[]
  /** Why this confidence and not a stronger one. */
  because: string
  /** What to do. */
  next: string
  /** True where the finding rests on something NOT being in the files. */
  isAbsence: boolean
  prompt?: string | null
}

export interface ComplianceReport {
  findings: ComplianceFinding[]
  /** What triggered each regime: the shapes found in the code. */
  exposure: {
    subscriptions: boolean
    autoRenewal: boolean
    cancelPath: boolean
    sendsEmail: boolean
    sendsSms: boolean
    collectsPayment: boolean
    paysProviders: boolean
    hasPrivacyNotice: boolean
    hasTerms: boolean
    ageGate: boolean
    imagesWithoutAlt: number
    routeGuards: boolean
  }
  /** Printed on the cover. */
  caveat: string
}

const any = (files: readonly SourceFile[], re: RegExp): SourceFile[] =>
  files.filter((f) => re.test(f.text))

const paths = (hits: readonly SourceFile[], n = 4): string[] => hits.slice(0, n).map((f) => f.path)

export interface AnalyseComplianceOptions {
  /** From the SEO read, so the accessibility finding and the SEO report cannot
   *  disagree about the same images. */
  images?: { total: number; withAlt: number }
  /** From the sitemap derivation. */
  routeGuards?: boolean
  /** From the monetization read: whether anything actually takes payment. */
  collectsPayment?: boolean
}

/** Implementation, as opposed to documents describing it. A rule is triggered
 *  by what the product does, and a specification of a schema nobody has built
 *  is not a product that does it. */
const CODE_FILE = /\.(ts|tsx|js|jsx|mjs|cjs|sql|prisma|py|rb|go|php|cs|java|kt|vue|svelte)$/i

export function analyseCompliance(
  files: readonly SourceFile[],
  opts: AnalyseComplianceOptions = {},
): ComplianceReport {
  const findings: ComplianceFinding[] = []

  // ── An obligation has to be triggered by the thing it is about ────────────
  //
  // These gates decide whether a rule applies at all, so a loose one does not
  // produce a vague finding — it produces a confident finding about a product
  // that does not exist. Measured against a portfolio site with no paid plans:
  //
  //   subscription  `/\bsubscription|subscribe\b/i`  matched six files, every
  //                 one of them the word UNsubscribe in newsletter code. The
  //                 alternation puts `\b` only before `subscription` and only
  //                 after `subscribe`, so `unsubscribe` matched. That fired a
  //                 high-severity finding about negative-option billing on a
  //                 site that bills nobody.
  //   cancel        `/\bcancel…?\b/i` matched four: `cancel-in-progress:` in a
  //                 GitHub Actions workflow, and the word "Cancel" as a button
  //                 label in two markdown documents.
  //
  // Both are identifier-shaped now, and read from code rather than from prose:
  // a recurring charge names itself — `subscription_id`, `billing_cycle`,
  // `cancel_at_period_end` — and a document describing one is not one.
  const code = files.filter((f) => CODE_FILE.test(f.path))
  const subscription = any(code, /\b(subscription_id|subscriptionId|stripe_subscription\w*|billing_cycle|billingCycle|cancel_at_period_end|current_period_end|auto_?renew(al|s|ing)?|price_id|priceId|plan_id|planId|subscription_status|subscriptionStatus)\b/i)
  const renewal = any(code, /\b(autoRenew|auto_renew|billingCycle|billing_cycle|recurringBilling|current_period_end)\b/i)
  const cancel = any(code, /\bcancel(_?subscription|_?membership|_?plan|_at_period_end)\b/i)
  const email = any(files, /\b(sendEmail|nodemailer|sendgrid|resend|mailer|email-templates)\b/i)
  const sms = any(files, /\b(twilio|sendSms|smsClient|messagebird)\b/i)
  const unsubscribe = any(files, /\b(unsubscribe|opt[_-]?out|listUnsubscribe)\b/i)
  const payouts = any(files, /\b(payout|stripeConnect|transfer|1099|providerEarnings)\b/i)
  const privacy = any(files, /\b(PrivacyModal|privacy[_-]?policy|privacyPolicy)\b/i)
  const terms = any(files, /\b(TermsModal|terms[_-]?of[_-]?service|termsOfService|AboutModal)\b/i)
  const ageGate = any(code, /\b(dateOfBirth|date_of_birth|dob|ageVerification|over18|minimumAge)\b/i)
  const dataExport = any(code, /\b(exportData|downloadMyData|dataPortability|gdprExport)\b/i)
  const deleteAccount = any(code, /\b(deleteAccount|closeAccount|deactivateAccount|eraseUser)\b/i)

  /**
   * Whether this product has accounts at all.
   *
   * Two obligations below are about people the product holds data on — the
   * right to see and delete it, and whether any of them are children. Neither
   * question exists for something with no users, and both were being asked of
   * every repository regardless. A static site was told that nothing in its
   * signup establishes a user is an adult, on the strength of having no signup.
   */
  const accounts = any(code, /\b(signUp|sign_up|createUser|registerUser|createAccount|auth\.users|auth\.signUp|signInWithPassword|signInWithOAuth)\b/i)

  const images = opts.images ?? { total: 0, withAlt: 0 }
  const withoutAlt = Math.max(0, images.total - images.withAlt)

  // ── Subscriptions: ROSCA and the FTC negative-option rule ──
  if (subscription.length > 0) {
    findings.push({
      id: 'auto-renewal-disclosure',
      area: 'Subscriptions — ROSCA / negative option',
      title: 'A subscription exists; nothing in the code shows the renewal terms being disclosed',
      severity: 'high',
      confidence: 'indicated',
      detail: `Subscription handling appears in ${subscription.length} file(s). Federal law on `
        + 'negative-option billing requires the renewal terms, the price and the cancellation '
        + 'method to be disclosed clearly BEFORE payment, plus express informed consent. Nothing '
        + 'in the source shows that disclosure as a distinct, recorded step.',
      files: paths(subscription),
      because: 'A disclosure can live in copy on a page this analysis cannot interpret, and consent '
        + 'may be recorded outside the application. This is the shape that attracts the rule, not '
        + 'a finding that the rule is broken.',
      next: 'Have somebody confirm three things: the terms are shown before payment, consent is '
        + 'recorded with a timestamp, and the record can be produced later. If consent is not '
        + 'stored, that is the gap.',
      isAbsence: true,
    })

    findings.push({
      id: 'cancel-as-easy',
      area: 'Subscriptions — ROSCA / negative option',
      title: cancel.length > 0
        ? 'A cancellation path exists — confirm it is as easy as signing up'
        : 'No cancellation path appears in the code',
      severity: cancel.length > 0 ? 'medium' : 'high',
      confidence: cancel.length > 0 ? 'verified' : 'indicated',
      detail: cancel.length > 0
        ? `Cancellation appears in ${cancel.length} file(s). The rule is not that cancellation `
          + 'exists but that it is at least as simple as enrolment: same channel, no retention '
          + 'maze, no phone-only exit for something bought in an app.'
        : 'Nothing in the source cancels a subscription. If a customer must email or call to stop '
          + 'paying for something they started in an app, that is the exposure.',
      files: paths(cancel),
      because: cancel.length > 0
        ? 'The endpoint is in the code. How many steps a person actually walks through is a '
          + 'property of the interface, not of the endpoint.'
        : 'Absence in these files. A cancellation handled by support would not appear here.',
      next: 'Count the clicks from signed-in to cancelled and compare with the clicks to subscribe. '
        + 'If cancelling is longer, that is the finding, and it is a design change rather than a '
        + 'legal one.',
      isAbsence: cancel.length === 0,
    })
  }

  // ── Email and SMS ──
  if (email.length > 0) {
    findings.push({
      id: 'can-spam-unsubscribe',
      area: 'Email — CAN-SPAM',
      title: unsubscribe.length > 0
        ? 'Email is sent and an unsubscribe mechanism appears in the code'
        : 'Email is sent and no unsubscribe mechanism appears in the code',
      severity: unsubscribe.length > 0 ? 'info' : 'high',
      confidence: 'indicated',
      detail: unsubscribe.length > 0
        ? 'Both sending and opt-out appear in the source. CAN-SPAM also requires a physical '
          + 'postal address in commercial mail and that opt-outs are honoured within ten business '
          + 'days — neither is visible from code alone.'
        : `Email sending appears in ${email.length} file(s) with no opt-out mechanism in the `
          + 'source. Commercial email requires a working unsubscribe, a physical postal address, '
          + 'and honouring an opt-out within ten business days.',
      files: paths(email),
      because: 'Most mail providers inject an unsubscribe header, so absence here does not mean '
        + 'absence in the delivered mail. Whether transactional and marketing mail are separated '
        + 'is also not visible from code.',
      next: 'Send one of each kind of mail to yourself and read the footer. That settles it faster '
        + 'than any amount of reading the source.',
      isAbsence: unsubscribe.length === 0,
    })
  }

  if (sms.length > 0) {
    findings.push({
      id: 'tcpa-consent',
      area: 'SMS — TCPA',
      title: 'SMS is sent; consent capture is not visible in the code',
      severity: 'high',
      confidence: 'indicated',
      detail: `SMS sending appears in ${sms.length} file(s). TCPA liability is per message and `
        + 'statutory, which makes it the most expensive small mistake in this report. Prior '
        + 'express consent must be recorded, and STOP must work.',
      files: paths(sms),
      because: 'Consent may be captured in an interface this cannot interpret, or by the SMS '
        + 'provider. The absence of a stored consent record is what would matter.',
      next: 'Confirm that consent is stored per number with a timestamp and the wording shown, and '
        + 'that STOP is honoured automatically.',
      isAbsence: true,
    })
  }

  // ── Provider classification: the one specific to a marketplace ──
  findings.push({
    id: 'worker-classification',
    area: 'Providers — classification and 1099 reporting',
    title: 'Providers are paid for work arranged by the platform',
    severity: 'high',
    confidence: 'hypothesis',
    detail: 'This is a marketplace where providers deliver services to clients the platform '
      + 'introduced. Two federal exposures follow and neither is visible in code: whether '
      + 'providers are correctly classified as independent contractors, and whether payments to '
      + 'them require information reporting. The more the platform controls pricing, scheduling '
      + 'and standards, the weaker the contractor position becomes.'
      + (payouts.length > 0 ? ` Payout handling appears in ${payouts.length} file(s).` : ''),
    files: paths(payouts),
    because: 'Classification turns on how the business actually operates, not on what the code '
      + 'does. No repository can answer it. It is here because the cost of getting it wrong is '
      + 'the largest single number in this report.',
    next: 'Take this one to counsel before the platform sets prices, mandates availability or '
      + 'enforces service standards — each of those moves the answer.',
    isAbsence: false,
  })

  // ── Accessibility ──
  if (images.total > 0) {
    findings.push({
      id: 'ada-accessibility',
      area: 'Accessibility — ADA / WCAG',
      title: withoutAlt === 0
        ? `All ${images.total} images carry alt text`
        : `${withoutAlt} of ${images.total} images carry no alt text`,
      severity: withoutAlt === 0 ? 'info' : 'medium',
      confidence: 'verified',
      detail: withoutAlt === 0
        ? 'Images are the part of accessibility this analysis can check and they pass. Keyboard '
          + 'navigation, focus order, contrast and form labelling are not checked here and are '
          + 'where most claims actually originate.'
        : 'Alt text is the most commonly cited failure in web accessibility demand letters, and '
          + 'the cheapest to fix. It is also only one criterion of many.',
      files: [],
      because: 'Counted from the source. A full WCAG conformance review needs a person and a '
        + 'screen reader, and this checks one criterion.',
      next: withoutAlt === 0
        ? 'Commission a WCAG 2.1 AA review of the flow that completes what the product exists '
          + 'to do. That is the journey a claim would name.'
        : 'Add alt text, then commission a proper review — fixing images alone does not make a '
          + 'product accessible or a claim go away.',
      isAbsence: false,
    })
  }

  // ── Privacy ──
  findings.push({
    id: 'privacy-notice',
    area: 'Privacy — state privacy laws and FTC Act §5',
    title: privacy.length > 0
      ? 'A privacy notice exists in the product'
      : 'No privacy notice appears in the code',
    severity: privacy.length > 0 ? 'low' : 'high',
    confidence: 'verified',
    detail: privacy.length > 0
      ? 'A privacy surface is present. What it SAYS is the part that matters: a notice that '
        + 'describes practices the product does not follow is itself an FTC Act deception '
        + 'exposure, and it must name the categories collected and the rights available.'
      : 'Nothing in the source presents a privacy notice. Several state privacy laws require one, '
        + 'and operating without it is the easiest possible finding for a regulator.',
    files: paths(privacy),
    because: 'Read from the files. Whether the text matches actual practice is not something code '
      + 'can check, and that mismatch is the usual cause of enforcement.',
    next: 'Have somebody read the notice beside the data model and confirm every category the '
      + 'product stores is described, including anything one user records about another.',
    isAbsence: privacy.length === 0,
  })

  // Only where there are accounts to hold data about. Asked of a site with no
  // users, this is a finding about nobody.
  if (accounts.length > 0 && (deleteAccount.length === 0 || dataExport.length === 0)) {
    findings.push({
      id: 'data-rights',
      area: 'Privacy — access and deletion rights',
      title: 'No self-serve data export or account deletion appears in the code',
      severity: 'medium',
      confidence: 'indicated',
      // The sentence that used to close this named one product's material —
      // photographs, measurements, notes about a person's body — and was
      // printed for every project analysed, including ones that hold none of it.
      detail: 'State privacy laws give consumers rights to access and delete their data, with '
        + 'deadlines. Handling those by hand is viable at small scale and becomes the thing that '
        + 'misses a deadline, because the first request arrives without warning. How sensitive '
        + 'the data is decides how much this matters, and that is a question about what this '
        + 'product stores rather than about its code.',
      files: [],
      because: 'Absence in these files. A request handled through support would not appear in the '
        + 'source, and at current scale that may be entirely adequate.',
      next: 'Decide who receives a deletion request today and how long it takes. If the answer is '
        + '"nobody has had one", write the runbook before the first arrives.',
      isAbsence: true,
    })
  }

  // ── Minors ──
  //
  // Only where somebody signs up. "Nothing in signup establishes that a user is
  // an adult" was being said of products with no signup, where it is true only
  // in the way that any statement about a thing that does not exist is true.
  if (accounts.length > 0) {
    findings.push({
      id: 'age-gate',
      area: 'Minors — COPPA and state rules',
      title: ageGate.length > 0
        ? 'Age or date of birth appears in signup'
        : 'Nothing in signup establishes that a user is an adult',
      severity: ageGate.length > 0 ? 'info' : 'medium',
      confidence: 'indicated',
      // What was here speculated about one product's customers — that styling
      // services are plausibly bought for teenagers, that photographs sharpen
      // it — and said so about every project analysed.
      detail: ageGate.length > 0
        ? 'An age signal exists in the code. What it is used for — refusing signup, or only being '
          + 'stored — is the question.'
        : 'No age check appears at signup. A product that knowingly collects a child\'s personal '
          + 'information without verifiable parental consent is inside COPPA, and several states '
          + 'set their own thresholds on top. Whether any of that reaches this product depends on '
          + 'who actually uses it.',
      files: paths(ageGate),
      because: 'Read from the files. Whether minors actually use the product is a business fact, '
        + 'and it decides whether this matters at all.',
      next: 'Decide the minimum age and state it in the terms, then enforce it at signup. If minors '
        + 'are intended users, this needs counsel rather than a checkbox.',
      isAbsence: ageGate.length === 0,
    })
  }

  // ── Payments ──
  if (opts.collectsPayment) {
    findings.push({
      id: 'pci-scope',
      area: 'Payments — PCI DSS',
      title: 'Payment is taken; confirm card data never reaches this application',
      severity: 'high',
      confidence: 'hypothesis',
      detail: 'Once money moves, PCI scope follows. The only comfortable position is that card '
        + 'data never touches this server — a hosted field or a redirect — which keeps the '
        + 'assessment burden at its smallest.',
      files: [],
      because: 'Whether card data transits this application depends on the integration chosen, '
        + 'which is not yet visible in the source.',
      next: 'Choose an integration where the card never reaches your server, and write down which '
        + 'SAQ applies before building rather than after.',
      isAbsence: false,
    })
  }

  // ── Access control ──
  if (opts.routeGuards === false) {
    findings.push({
      id: 'access-control',
      area: 'Security — safeguards and breach exposure',
      title: 'No route-level access control, in a product holding personal data',
      severity: 'high',
      confidence: 'verified',
      detail: 'The router applies no guards, so every screen relies on checks inside components. '
        + 'That is a valid pattern and an unverifiable one: nothing enforces that a new screen '
        + 'gets its check. The data behind those screens is whatever this product stores about '
        + 'the people who use it.',
      files: [],
      because: 'Read from the router. Component-level checks may be complete today; nothing makes '
        + 'them complete tomorrow.',
      next: 'Add a guard at the route layer so a new screen is private by default and public by '
        + 'decision. Breach notification duties attach per state and per record.',
      isAbsence: false,
    })
  }

  // ── Terms ──
  if (terms.length === 0) {
    findings.push({
      id: 'terms',
      area: 'Contract — terms of service',
      title: 'No terms of service appear in the code',
      severity: 'medium',
      confidence: 'indicated',
      // "between two people the platform introduced" described a marketplace,
      // and was printed for projects that are not one.
      detail: 'Terms are what limit liability, set the cancellation and refund rules, and say who '
        + 'is responsible when something goes wrong. Without them, the default answers are the '
        + 'ones a court supplies.',
      files: [],
      because: 'Absence in these files. Terms served as a static page outside the application '
        + 'would not appear here.',
      next: 'Confirm terms exist and that acceptance is recorded per user with a version and a '
        + 'timestamp. Acceptance nobody can produce later is acceptance that did not happen.',
      isAbsence: true,
    })
  }

  return {
    findings: withCompliancePrompts(findings),
    exposure: {
      subscriptions: subscription.length > 0,
      autoRenewal: renewal.length > 0,
      cancelPath: cancel.length > 0,
      sendsEmail: email.length > 0,
      sendsSms: sms.length > 0,
      collectsPayment: !!opts.collectsPayment,
      paysProviders: payouts.length > 0,
      hasPrivacyNotice: privacy.length > 0,
      hasTerms: terms.length > 0,
      ageGate: ageGate.length > 0,
      imagesWithoutAlt: withoutAlt,
      routeGuards: opts.routeGuards ?? false,
    },
    caveat: 'This is not legal advice and nobody here is a lawyer. It finds the shapes in the code '
      + 'that attract a federal rule and says what the code would need to show. Whether POSCHI '
      + 'complies depends on how the business actually operates, and several findings below turn '
      + 'entirely on facts no repository contains.',
  }
}
