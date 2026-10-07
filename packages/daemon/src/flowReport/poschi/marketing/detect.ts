// daemon/src/integrations/poschi/marketing/detect.ts
//
// What a repository can already do about its own distribution.
//
// ── Why this is detection and not advice ─────────────────────────────────────
//
// A marketing report that recommends "add a referral programme" to every
// product is a template, not an analysis. The only thing that makes this
// section worth reading is that every claim about what the product has — or
// lacks — is a fact about files somebody can open. So this module does one
// thing: it decides, per capability, whether the code shows it present,
// partly present, absent, or not checkable, and names the files that decided
// it. The judgements about what to do with that live next door in analyse.ts.
//
// ── Identifier-shaped, never prose ───────────────────────────────────────────
//
// The hard-won rule in this codebase. A sibling analyser once gated a federal
// billing obligation on /subscription|subscribe/i and matched the word
// UNsubscribe in a newsletter footer, reporting a high-severity finding about
// recurring billing on a product that bills nobody. Another matched `cancel`
// against `cancel-in-progress:` in a CI workflow.
//
// So a capability is never detected from an English word. It is detected from
// the shapes code actually takes: a call `navigator.share(`, a property
// `utm_campaign`, an identifier `referralCode`, an import of a QR library, a
// URL `wa.me`. Prose in a comment or a heading does not match, which is the
// point — a product does not have a referral programme because a TODO mentions
// one.
//
// ── Four states, and `unverified` is not a polite `missing` ──────────────────
//
// `missing` says the scan looked and found nothing. `unverified` says the scan
// could not look — no router was read, the setting excluded the files, the
// evidence lives in a dashboard rather than in code. Collapsing the two would
// tell somebody they have no public pages when nobody checked, and every
// recommendation built on top of that would be wrong in the same direction.

export interface SourceFile {
  path: string
  text: string
}

export type CapabilityStatus = 'present' | 'partial' | 'missing' | 'unverified'

export interface Signal {
  /** What was looked for, in words a reader can check against the regex. */
  label: string
  /** Repository-relative paths where it was found, capped for readability. */
  files: string[]
  /** How many files matched in total, which may exceed `files.length`. */
  count: number
}

export interface Capability {
  id: CapabilityId
  /** The row heading in the capability map. */
  label: string
  status: CapabilityStatus
  /** Signals that fired, in the order they were looked for. */
  found: Signal[]
  /** Signals that did not fire. Named, because "no share buttons" is only
   *  useful if a reader knows what was searched for. */
  absent: string[]
  /** Set when `status` is `unverified`: why the scan could not decide. */
  unverifiedBecause?: string
}

export const CAPABILITY_IDS = [
  'public_discovery',
  'social_previews',
  'sharing',
  'referral_invite',
  'provider_self_promotion',
  'paid_marketing_tools',
  'retention_rebooking',
  'campaigns',
  'attribution',
  'growth_analytics',
  'consent_controls',
  'experimentation',
] as const

export type CapabilityId = (typeof CAPABILITY_IDS)[number]

// ── Matching ────────────────────────────────────────────────────────────────

/** Files whose contents are worth searching for code shapes. */
const CODE = /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte|astro)$/i
/** Markup, where share links and meta tags live. */
const MARKUP = /\.(html?|hbs|ejs|liquid)$/i

/**
 * Files that are not evidence of a shipped capability.
 *
 * Tests, mocks and build scripts name features without providing them, and the
 * brief for this section is explicit that a mock or an unfinished UI is not a
 * production feature. Measured on a real checkout, leaving these in reported a
 * share capability from `inviteContacts.test.ts` and a public profile from a
 * database-checking script in `scripts/`.
 */
const NOT_EVIDENCE = /(^|\/)(__tests__|__mocks__|scripts|fixtures|mocks|stories)\//i
const TEST_FILE = /\.(test|spec|stories)\.[cm]?[jt]sx?$/i

/**
 * A line that is only a comment.
 *
 * Not a parser, and it does not need to be: the purpose is to stop a plan
 * written in a `//` comment or a JSDoc block from being read as a shipped
 * capability. A pattern inside a block comment on a line that also holds code
 * still matches, which is the safe direction — under-reporting a real feature
 * is worse than occasionally reading an inline note.
 */
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*|#(?!!)|<!--)/

function searchable(f: SourceFile): boolean {
  if (NOT_EVIDENCE.test(f.path) || TEST_FILE.test(f.path)) return false
  return CODE.test(f.path) || MARKUP.test(f.path)
}

/**
 * One thing to look for, and what would disqualify a match.
 *
 * A single identifier is rarely enough. Measured against a real checkout, a
 * bare copy-to-clipboard call reported a sharing capability from a
 * two-factor-authentication recovery-code dialog, and a QR generator reported
 * one from the TOTP enrolment screen. Neither is a way to tell anyone about
 * the product. `alsoOnLine` and `notInFile` are how a probe says what it
 * actually means.
 */
interface Probe {
  label: string
  re: RegExp
  /** Required on the same line as `re`. Use for a generic call that only means
   *  something in context — a clipboard write of a *link*. */
  alsoOnLine?: RegExp
  /** Disqualifies the whole file. Use where a shape is genuinely shared with an
   *  unrelated feature — a QR code in an authenticator flow. */
  notInFile?: RegExp
  /** Required somewhere in the file, not necessarily on the same line. Use
   *  where a match only means what the probe intends if the surrounding file is
   *  about the right subject — a plan gate on a *marketing* surface rather than
   *  on a billing screen. */
  alsoInFile?: RegExp
  /** Disqualifies a file by its path. Some concepts are named in a filename
   *  and in a component and never in a variable. */
  notInPath?: RegExp
  /** Restrict to certain paths instead of all searchable files. */
  only?: RegExp
}

/**
 * Files matching a probe, on a line that is not purely a comment.
 *
 * Returns paths rather than excerpts on purpose: an excerpt from a marketing
 * surface can carry a referral code, an email address or a customer name, and
 * this section's output goes into a PDF somebody forwards.
 */
export function filesMatching(files: SourceFile[], p: Probe): string[] {
  const out: string[] = []
  for (const f of files) {
    if (p.only ? !p.only.test(f.path) : !searchable(f)) continue
    if (p.notInPath && p.notInPath.test(f.path)) continue
    if (p.notInFile && p.notInFile.test(f.text)) continue
    if (p.alsoInFile && !p.alsoInFile.test(f.text)) continue
    for (const line of f.text.split('\n')) {
      if (COMMENT_LINE.test(line)) continue
      // Fresh lastIndex per line: a /g regex reused across lines silently
      // skips matches, and a capability would go missing on a large file.
      p.re.lastIndex = 0
      if (!p.re.test(line)) continue
      if (p.alsoOnLine) {
        p.alsoOnLine.lastIndex = 0
        if (!p.alsoOnLine.test(line)) continue
      }
      out.push(f.path)
      break
    }
  }
  return out
}

const SHOW = 4

function signal(files: SourceFile[], p: Probe): Signal {
  const hit = filesMatching(files, p)
  return { label: p.label, files: hit.slice(0, SHOW), count: hit.length }
}

/**
 * A capability from the signals that fired.
 *
 * `strong` signals are ones whose presence alone establishes the capability.
 * `supporting` ones fill in how complete it is. Nothing present at all is
 * `missing`; strong without supporting is `partial`, because a share button
 * that nothing measures and no metadata backs is a capability in name.
 */
function decide(
  id: CapabilityId,
  label: string,
  strong: Signal[],
  supporting: Signal[],
): Capability {
  const fired = [...strong, ...supporting].filter((s) => s.count > 0)
  const absent = [...strong, ...supporting].filter((s) => s.count === 0).map((s) => s.label)
  const anyStrong = strong.some((s) => s.count > 0)

  let status: CapabilityStatus
  if (!anyStrong && fired.length === 0) status = 'missing'
  else if (!anyStrong) status = 'partial'
  else if (absent.length === 0) status = 'present'
  else status = supporting.some((s) => s.count > 0) ? 'present' : 'partial'

  return { id, label, status, found: fired, absent }
}

function unverified(id: CapabilityId, label: string, because: string): Capability {
  return { id, label, status: 'unverified', found: [], absent: [], unverifiedBecause: because }
}

// ── The patterns ────────────────────────────────────────────────────────────
//
// Every one of these is a shape code takes. Where a bare English word would be
// ambiguous, the pattern requires the punctuation that makes it an identifier,
// a call or a URL.

/** Security flows that happen to use the same shapes as sharing. A recovery
 *  code and an authenticator QR are not ways to tell anyone about a product. */
const SECURITY_FLOW = /\b(totp|TOTP|otpauth|mfa|MFA|twoFactor|two_factor|2fa|recoveryCode|backupCode|authenticator)\b/

/** Something a person could be given, as opposed to a code or an id. */
const A_LINK = /\b(link|url|href|share|invite|referral|booking|profile|page)\b/i

/**
 * Staff and administrative invitations, which are access control rather than
 * growth: inviting a colleague into an admin console distributes no product.
 *
 * Matched on the path as well as the contents, because the first version
 * looked for the identifier `staffInvite` and let `StaffAcceptInvite.tsx`
 * through — the file names the concept in its component and its filename and
 * nowhere in a variable.
 */
const STAFF_INVITE = /\b(AdminAcceptInvite|StaffAcceptInvite|staffInvite|inviteStaff|adminInvite|teamInvite|inviteAdmin|inviteMember)\b/
const STAFF_INVITE_PATH = /(staff|admin|team|member|employee)[\w-]*invite|invite[\w-]*(staff|admin|team|member)/i

// `satisfies` rather than an annotation: each key stays a known name, so a
// typo in a probe reference is a compile error rather than an undefined probe
// that silently detects nothing.
const P = {
  // ── Sharing ──
  webShare: { label: 'the Web Share API', re: /\bnavigator\s*\.\s*share\s*\(/ },
  clipboard: {
    label: 'a copy-link action',
    re: /\bnavigator\s*\.\s*clipboard\s*\.\s*writeText\s*\(|execCommand\s*\(\s*['"]copy['"]/,
    // Copying is generic. Copying a LINK is a share.
    alsoOnLine: A_LINK,
    notInFile: SECURITY_FLOW,
  },
  shareIntent: {
    label: 'a share link to a social or messaging app',
    re: /twitter\.com\/intent|x\.com\/intent|wa\.me\/|api\.whatsapp\.com\/send|facebook\.com\/sharer|linkedin\.com\/shar|t\.me\/share|mailto:\?|sms:\?/i,
  },
  shareComponent: {
    label: 'a named share component',
    re: /\b(ShareButton|ShareModal|ShareSheet|ShareMenu|shareUrl|shareLink|handleShare|onShare|useShare)\b/,
  },
  qr: {
    label: 'QR code generation',
    // `toDataURL` alone matched avatar cropping, so it is gone; the library
    // import or a QR component is the evidence.
    re: /\bfrom\s+['"][^'"]*qrcode[^'"]*['"]|\b(QRCode|QrCode)\s*[({<]|\bqrcode\b\s*[:(]/i,
    notInFile: SECURITY_FLOW,
  },

  // ── Referral and invite ──
  referralId: {
    label: 'a referral or ambassador identifier',
    re: /\b(referralCode|referral_code|referrerCode|referralLink|ambassadorCode|ambassadorLink|affiliateCode|affiliate_id)\b/,
  },
  inviteId: {
    label: 'a customer invite identifier',
    re: /\b(inviteCode|invite_code|inviteLink|inviteClient|inviteFriend)\b/,
    notInFile: STAFF_INVITE,
    notInPath: STAFF_INVITE_PATH,
  },
  referralRoute: {
    label: 'a referral or invite route',
    re: /['"`]\/(invite|invites|referral|referrals|join|ambassador|affiliate)(\/|['"`:])/,
  },

  // ── Attribution ──
  utm: { label: 'UTM parameters', re: /\butm_(source|medium|campaign|term|content)\b/ },
  refParam: {
    label: 'a referral parameter read from the URL',
    re: /(get|has)\s*\(\s*['"](ref|referrer|referral|via|src)['"]\s*\)|[?&](ref|utm_source)=/,
  },

  // ── Analytics and events ──
  trackCall: {
    label: 'an event-tracking call',
    re: /\b(trackEvent|logEvent|analytics\s*\.\s*(track|capture)|trackPlatformEvent|posthog\s*\.\s*capture)\s*\(/,
  },
  analyticsVendor: {
    // `segment` on its own matched animation code measuring path segments, so
    // the vendor has to be spelled the way the vendor is actually referenced.
    label: 'an analytics vendor',
    re: /\b(posthog|mixpanel|amplitude|plausible|umami|gtag|dataLayer)\b|segment\.com|window\s*\.\s*analytics|google-analytics|gtm\.js/i,
  },
  funnelEvent: {
    label: 'named funnel events',
    re: /['"`](signup|sign_up|signed_up|booking_(created|completed)|checkout_(started|completed))['"`]/,
  },
  /**
   * A share event specifically.
   *
   * Separate from the funnel events above, and the separation matters: the
   * first version asked whether ANY named event existed and a product with a
   * signup event was therefore reported as measuring its sharing. It was not.
   * Whether sharing is counted is a question about share events.
   */
  shareEvent: {
    label: 'an event recording that a share happened',
    // `share-link` was in this list and matched `bookingSource: 'share-link'`
    // — an enum naming a KIND OF LINK, not an event. It suppressed the P0 that
    // says sharing is unmeasured on a product where sharing is unmeasured.
    // Every alternative here is now a past-tense action.
    re: /['"`](share[_.-]?(clicked|completed|started|opened|sent)|link[_.-]?copied|referral[_.-]?(sent|accepted)|invite[_.-]?sent)['"`]/i,
  },

  // ── Campaigns ──
  campaignId: {
    label: 'a campaign identifier or builder',
    re: /\b(campaignId|campaign_id|createCampaign|CampaignForm|CampaignBuilder|sendCampaign|marketingCampaign)\b/,
  },

  // ── Retention and rebooking ──
  reminder: {
    // Bare `reminder` matched navigation entries and unrelated UI on 52 files.
    // A reminder that is a marketing surface is one that gets SENT.
    label: 'a reminder that is sent',
    re: /\b(sendReminder|scheduleReminder|reminderTemplate|reminderEmail|appointment_reminder|bookingReminder|reminder_sent)\b/,
  },
  rebook: {
    // Bare `reactivate` matched the account-closure screen explaining that a
    // deactivated account can be reactivated later. That is account state, not
    // a way to bring a lapsed customer back, so the customer sense is spelled
    // out and the generic verb is gone.
    label: 'return visits or customer reactivation',
    re: /\b(rebook|reBook|rebooking|bookAgain|repeatBooking|clientReactivation|customerReactivation|reactivationCampaign|winback|win_back|lapsedClient)\b/,
  },
  waitlistFav: {
    // `favorites?` alone fired on 74 files, mostly bookmark icons in a CMS.
    label: 'a waitlist or a saved favourite',
    re: /\b(waitlist|waitList|waiting_list|savedProviders|favouriteProviders?|favoriteProviders?|followProvider)\b/,
  },
  reviewRequest: {
    label: 'a review request',
    re: /\b(reviewRequest|requestReview|askForReview|review_request|leaveReview)\b/,
  },

  // ── Consent and preference ──
  unsubscribeId: {
    label: 'an unsubscribe or opt-out identifier',
    re: /\b(unsubscribe(Token|Url|Link|Id)?|unsubscribe_token|optOut|opt_out|optIn|opt_in)\b/,
  },
  prefsId: {
    label: 'a stored marketing or notification preference',
    re: /\b(marketingConsent|marketing_consent|emailPreferences|email_preferences|notificationPreferences|notification_preferences|communicationPreferences|consentGiven)\b/,
  },
  frequencyCap: {
    label: 'a frequency cap or quiet hours',
    re: /\b(frequencyCap|frequency_cap|rateLimitEmail|maxPerDay|sendWindow|quietHours)\b/,
  },

  // ── Experimentation ──
  flagVendor: {
    label: 'a feature-flag or experiment vendor',
    re: /\b(launchdarkly|statsig|growthbook|unleash|optimizely)\b|split\.io|posthog\s*\.\s*isFeatureEnabled/i,
  },
  flagId: {
    label: 'a feature-flag or experiment identifier',
    re: /\b(featureFlag|feature_flag|useFeatureFlag|isFeatureEnabled|experimentId|experiment_id|abTest|variantKey|getVariant)\b/,
  },

  // ── Provider self-promotion ──
  publicProfile: {
    // `handle` is gone: it is a prop name on half the components in a codebase.
    // `publicUrl` is gone too — it is the field Supabase storage returns for an
    // uploaded file, so it reported a public provider profile from an avatar
    // upload and from an ambassador row's stored image.
    label: 'a public profile or vanity URL',
    re: /\b(publicProfile|profileUrl|profileSlug|profile_slug|vanityUrl|publicProfileUrl)\b/,
  },
  bookingLink: {
    label: 'a shareable link to a page somebody owns',
    re: /\b(bookingLink|bookingUrl|booking_link|bookingPageUrl|scheduleLink|bookWithUrl)\b/,
  },
  embeddable: {
    label: 'an embeddable widget',
    re: /\b(embedCode|embed_code|EmbedWidget|BookingWidget)\b/,
  },
  assetExport: {
    label: 'a downloadable or generated share asset',
    re: /\b(downloadAsset|socialCard|shareCard|businessCard|posterTemplate|html2canvas|satori)\b/,
  },

  // ── Paid tiers around marketing ──
  planGate: {
    label: 'a marketing surface gated by plan or tier',
    re: /\b(plan|tier|subscriptionTier|planLevel|entitlement|feature_?access)\s*[=:.]\s*['"`]?(pro|premium|plus|business|growth|paid|enterprise)/i,
    // A plan gate is only a MARKETING plan gate when the file it sits in is
    // about a marketing surface. Without this it fired on every billing screen
    // in the product, none of which distributes anything.
    alsoInFile: /\b(share|referral|ambassador|campaign|bookingLink|booking_link|publicProfile|widget|promo)\b/i,
  },
  planId: {
    label: 'a plan or entitlement identifier',
    re: /\b(planId|plan_id|subscriptionTier|subscription_tier|entitlements?|featureAccess)\b/,
  },
} satisfies Record<string, Probe>

// ── Per-capability detection ────────────────────────────────────────────────

export interface DetectOptions {
  /**
   * Routes reachable without an account, from the router the product analysis
   * already read. Null when no router was read — not zero, because a product
   * whose router nobody parsed has an unknown number of public pages and
   * saying "none" would be a claim nobody measured.
   */
  publicRouteCount: number | null
  /** Whether the SEO pass found link-preview metadata. Consumed rather than
   *  re-derived: two sections disagreeing about Open Graph would be worse than
   *  either being wrong. */
  hasLinkPreviewMeta: boolean | null
  /** Whether the SEO pass found a canonical link. */
  hasCanonical: boolean | null
}

export function detectCapabilities(files: SourceFile[], o: DetectOptions): Capability[] {
  const s = (p: Probe) => signal(files, p)

  const sharing = decide('sharing', 'Sharing', [
    s(P.webShare), s(P.clipboard), s(P.shareIntent), s(P.shareComponent),
  ], [s(P.qr)])

  const referral = decide('referral_invite', 'Referral and invite', [
    s(P.referralId), s(P.inviteId), s(P.referralRoute),
  ], [s(P.utm)])

  const attribution = decide('attribution', 'Attribution', [
    s(P.utm), s(P.refParam),
  ], [])

  const analytics = decide('growth_analytics', 'Growth analytics', [
    s(P.trackCall), s(P.analyticsVendor),
  ], [s(P.funnelEvent), s(P.shareEvent)])

  const campaigns = decide('campaigns', 'Campaigns', [
    s(P.campaignId),
  ], [s(P.frequencyCap)])

  const retention = decide('retention_rebooking', 'Retention and return visits', [
    s(P.reminder), s(P.rebook),
  ], [s(P.waitlistFav), s(P.reviewRequest)])

  const consent = decide('consent_controls', 'Consent and preferences', [
    s(P.unsubscribeId), s(P.prefsId),
  ], [s(P.frequencyCap)])

  const experimentation = decide('experimentation', 'Experimentation', [
    s(P.flagVendor), s(P.flagId),
  ], [])

  const selfPromotion = decide('provider_self_promotion', 'Self-promotion tools', [
    s(P.publicProfile), s(P.bookingLink),
  ], [s(P.embeddable), s(P.assetExport), s(P.qr)])

  const paidTools = decide('paid_marketing_tools', 'Paid marketing tools', [
    s(P.planGate),
  ], [s(P.planId)])

  // ── The two that consume another pass rather than re-deriving ────────────

  const discovery: Capability = o.publicRouteCount === null
    ? unverified('public_discovery', 'Public discovery',
      'No router was read, so how many screens a crawler could reach without an '
      + 'account is unknown. It is not zero — nobody looked.')
    : {
      id: 'public_discovery',
      label: 'Public discovery',
      status: o.publicRouteCount > 0 ? 'present' : 'missing',
      found: o.publicRouteCount > 0
        ? [{ label: `${o.publicRouteCount} screen(s) reachable without an account`, files: [], count: o.publicRouteCount }]
        : [],
      absent: o.publicRouteCount > 0 ? [] : ['any screen reachable without an account'],
    }

  const previews: Capability = o.hasLinkPreviewMeta === null
    ? unverified('social_previews', 'SEO and social previews',
      'No HTML entry point or head configuration was read, so what a shared link '
      + 'looks like could not be established either way.')
    : {
      id: 'social_previews',
      label: 'SEO and social previews',
      status: o.hasLinkPreviewMeta && o.hasCanonical ? 'present'
        : o.hasLinkPreviewMeta || o.hasCanonical ? 'partial' : 'missing',
      found: [
        ...(o.hasLinkPreviewMeta ? [{ label: 'link-preview metadata', files: [], count: 1 }] : []),
        ...(o.hasCanonical ? [{ label: 'a canonical URL', files: [], count: 1 }] : []),
      ],
      absent: [
        ...(o.hasLinkPreviewMeta ? [] : ['link-preview metadata']),
        ...(o.hasCanonical ? [] : ['a canonical URL']),
      ],
    }

  // Ordered as the capability map prints them: discovery first, because
  // everything downstream depends on something being reachable at all.
  return [
    discovery, previews, sharing, referral, selfPromotion, paidTools,
    retention, campaigns, attribution, analytics, consent, experimentation,
  ]
}

/** One capability by id, for callers that need to reason about a specific row. */
export function capability(caps: Capability[], id: CapabilityId): Capability {
  const found = caps.find((c) => c.id === id)
  if (!found) throw new Error(`no capability ${id} was detected`)
  return found
}
