// daemon/src/integrations/poschi/marketing/analyse.ts
//
// Growth opportunities a repository can actually support.
//
// ── The rule that shapes everything here ─────────────────────────────────────
//
// An opportunity exists only where the code gives a reason to believe it. Not
// "products like this usually have a referral programme" — that sentence is
// true of every product and therefore says nothing about this one. Every
// opportunity below is generated from a capability state that `detect.ts`
// established from named files, and carries those files with it.
//
// The consequence is that this section is often short, and that is correct. A
// repository with no sharing, no attribution and no analytics has one honest
// opportunity — start measuring — not fifteen.
//
// ── Nothing here claims revenue ──────────────────────────────────────────────
//
// The mechanism by which an opportunity would work is written as a hypothesis
// and labelled as one. This module cannot observe a single user, so it cannot
// know whether a share button produces signups. What it CAN establish is
// whether the product could find out, which is why an unmeasurable opportunity
// is ranked below the instrumentation that would make it measurable, however
// exciting the opportunity sounds.
//
// ── Prompts only where a prompt would be honest ──────────────────────────────
//
// A Claude Code prompt names files and asks for a specific change. That is only
// possible when the surface already exists. Where it does not, this produces
// resolution instructions instead — what to learn, who should learn it, and what
// would settle it. Generating a confident engineering prompt for a feature
// nobody has designed is how a report starts costing more than it saves.

import {
  detectCapabilities, capability,
  type Capability, type CapabilityId, type DetectOptions, type SourceFile,
} from './detect.js'

export type { SourceFile, Capability, CapabilityId, CapabilityStatus, Signal } from './detect.js'

export type OpportunityType =
  | 'improve_existing'
  | 'existing_not_surfaced'
  | 'missing_capability_nearby_evidence'
  | 'measurement_gap'
  | 'discovery_content'
  | 'paid_tool'
  | 'referral_partner'
  | 'retention'
  | 'experiment'
  | 'external_research'

export type Classification =
  | 'implementation_ready'
  | 'measurement_first'
  | 'experiment_first'
  | 'external_research_first'
  | 'not_applicable'

export type Priority = 'P0' | 'P1' | 'P2' | 'P3'

/** A rating and the reason it is that number. The brief is explicit that a
 *  score must never be presented as a fact. */
export interface Score {
  /** 1 (low) to 5 (high). For the two risk dimensions, high means MORE risk. */
  value: 1 | 2 | 3 | 4 | 5
  /** What produced it: evidence where there is evidence, assumption where not. */
  basis: string
}

export const SCORE_NAMES = [
  'userValue', 'businessRelevance', 'distributionLeverage', 'feasibility',
  'fitWithSurfaces', 'effort', 'measurementReadiness', 'privacyRisk',
  'abuseRisk', 'confidence',
] as const
export type ScoreName = (typeof SCORE_NAMES)[number]

export interface Opportunity {
  id: string
  title: string
  type: OpportunityType
  capability: CapabilityId
  priority: Priority
  classification: Classification
  /** What the scan actually saw, in one sentence a reader can check. */
  observed: string
  /** Repository-relative paths that decided it. */
  evidence: string[]
  /** Who it serves and what problem it addresses. */
  serves: string
  /** How it would work, stated as a hypothesis because that is what it is. */
  hypothesis: string
  /** Instrumentation or data the opportunity needs before it can be judged. */
  requiredData: string[]
  risks: string[]
  privacy: string[]
  scores: Record<ScoreName, Score>
  /** The least that could be done next to learn whether this is worth doing. */
  cheapestNextAction: string
  successMetric: string
  guardrailMetric: string
  /** Present only when `classification` is `implementation_ready`. */
  prompt?: string
  /** Present for everything else. */
  resolution?: ResolutionInstructions
}

export interface ResolutionInstructions {
  mustLearn: string
  ownerRole: string
  questions: string[]
  expectedEvidence: string
  method: string
  safeNextStep: string
  decisionCriteria: string
}

export interface MarketingReport {
  capabilities: Capability[]
  opportunities: Opportunity[]
  /** What this section could not evaluate, and why. */
  measurementGaps: string[]
  /** Things deliberately not recommended, with the reason. */
  notRecommended: Array<{ idea: string; because: string }>
  limitations: string[]
  /** True when the scan was told the checkout may be out of date. */
  stale: boolean
}

// ── Scoring helpers ─────────────────────────────────────────────────────────

const s = (value: Score['value'], basis: string): Score => ({ value, basis })

/** Confidence follows the capability state rather than being typed in per
 *  opportunity: an opportunity resting on `unverified` cannot be confident. */
function confidenceFor(c: Capability): Score {
  switch (c.status) {
    case 'present': return s(4, `${c.found.length} signal(s) found in the repository, named above.`)
    case 'partial': return s(3, 'Some signals found and others not, so the picture is incomplete.')
    case 'missing': return s(3, 'The scan looked for each signal listed and found none.')
    case 'unverified': return s(1, c.unverifiedBecause ?? 'The scan could not establish this either way.')
  }
}

const NO_EVIDENCE_OF_HARM = 'No user data is read by this analysis, so nothing here rests on personal data.'

// ── Opportunity generation ──────────────────────────────────────────────────
//
// One function per opportunity, each returning null when the repository does
// not support it. A rule that cannot say why it fired does not belong here.

type Rule = (caps: Capability[], ctx: RuleContext) => Opportunity | null

interface RuleContext {
  /** Set by the caller from the SEO pass, so this never re-derives metadata. */
  hasLinkPreviewMeta: boolean | null
  publicRouteCount: number | null
}

const paths = (c: Capability): string[] =>
  [...new Set(c.found.flatMap((f) => f.files))].slice(0, 6)

/**
 * Sharing exists and nothing counts it.
 *
 * P0, and first, because everything else in this section is unjudgeable until
 * it is true. A share button nobody measures cannot be improved on purpose:
 * any change to it is followed by no information.
 */
const shareIsUnmeasured: Rule = (caps) => {
  const sharing = capability(caps, 'sharing')
  const analytics = capability(caps, 'growth_analytics')
  if (sharing.status === 'missing' || sharing.status === 'unverified') return null

  // Specifically a SHARE event. Asking whether any named event exists reported
  // a product with a signup event as measuring its sharing, which it was not.
  const hasShareEvent = analytics.found.some((f) => /a share happened/.test(f.label))
  if (hasShareEvent) return null

  return {
    id: 'MKT-001',
    title: 'Sharing exists and no event records that it happened',
    type: 'measurement_gap',
    capability: 'sharing',
    priority: 'P0',
    classification: 'implementation_ready',
    observed: `Share surfaces were found in ${sharing.found.reduce((n, f) => Math.max(n, f.count), 0)} `
      + 'file(s), and no named share event was found among the tracked events.',
    evidence: paths(sharing),
    serves: 'Anyone deciding whether sharing is worth investing in, which currently nobody can answer.',
    hypothesis: 'If each share action emits an aggregate event, the value of every other opportunity '
      + 'in this section becomes measurable rather than arguable. This is a prerequisite, not a growth '
      + 'mechanism: emitting the event changes no user behaviour by itself.',
    requiredData: [
      'A share event carrying the surface and the object type.',
      'No recipient, no message content, no personal identifier.',
    ],
    risks: [
      'An event that carries the shared URL can carry a private token if the URL holds one.',
    ],
    privacy: [
      'Aggregate counts only. A share event must never record who received it or what was written.',
      NO_EVIDENCE_OF_HARM,
    ],
    scores: {
      userValue: s(1, 'No user-visible change. This exists to inform the people building the product.'),
      businessRelevance: s(4, 'Every later decision about sharing depends on it.'),
      distributionLeverage: s(1, 'Measuring a loop does not widen it.'),
      feasibility: s(5, 'The tracking call already exists in this codebase; this adds call sites.'),
      fitWithSurfaces: s(5, 'The share surfaces and the tracking helper are both present.'),
      effort: s(2, 'A call at each share surface, plus a named event.'),
      measurementReadiness: s(5, 'This IS the measurement.'),
      privacyRisk: s(2, 'Low if the event carries no URL and no recipient; that is the whole design constraint.'),
      abuseRisk: s(1, 'An event emitter is not a surface anyone can abuse.'),
      confidence: confidenceFor(sharing),
    },
    cheapestNextAction: 'Add one aggregate event at the existing share surfaces and read the count after a week.',
    successMetric: 'Share events per week, by surface.',
    guardrailMetric: 'No increase in payload size or error rate at the share surfaces.',
    prompt: [
      'Opportunity MKT-001 — record that a share happened, in aggregate only.',
      '',
      'Confirmed surfaces in this repository:',
      ...paths(sharing).map((p) => `  - ${p}`),
      '',
      'Goal: each share action emits one aggregate analytics event using the tracking',
      'helper this codebase already has. Do not introduce a new analytics vendor.',
      '',
      'Requirements:',
      '- The event carries the surface name and the type of object shared. Nothing else.',
      '- It must NOT carry the share URL, any token or id inside it, the recipient,',
      '  the message text, or any personal identifier.',
      '- Preserve the existing share behaviour exactly; this adds measurement and',
      '  changes no user-visible flow.',
      '- Add tests covering: the event fires once per share, and it carries no URL.',
      '- Make it disableable: if the tracking helper is unavailable, sharing must',
      '  still work and must not throw.',
      '- No unrelated refactors.',
      '',
      'Requires owner approval before implementation.',
    ].join('\n'),
  }
}

/**
 * A referral or invite path exists and nothing attributes it.
 *
 * Also P0. A referral programme with no attribution is a feature that cannot
 * be evaluated and cannot be paid out against.
 */
const referralIsUnattributed: Rule = (caps) => {
  const referral = capability(caps, 'referral_invite')
  const attribution = capability(caps, 'attribution')
  if (referral.status === 'missing' || referral.status === 'unverified') return null
  if (attribution.status === 'present') return null

  return {
    id: 'MKT-002',
    title: 'An invite or referral path exists and attribution is incomplete',
    type: 'measurement_gap',
    capability: 'referral_invite',
    priority: 'P0',
    classification: 'measurement_first',
    observed: `Referral or invite surfaces were found, and attribution is ${attribution.status}. `
      + `Not found: ${attribution.absent.join('; ') || 'some signals are missing'}.`,
    evidence: [...paths(referral), ...paths(attribution)].slice(0, 6),
    serves: 'Whoever has to decide whether the referral path is worth keeping or extending.',
    hypothesis: 'If an invite carries a non-sensitive referral parameter that is read and stored at '
      + 'signup, the product can count how many accounts arrived through an invite. Whether that '
      + 'number is large is exactly what is unknown, and is the reason to measure before building.',
    requiredData: [
      'A referral parameter preserved from the invite link through to account creation.',
      'A count of arrivals and conversions by referral source, in aggregate.',
    ],
    risks: [
      'A referral code that identifies a person turns a shareable link into personal data.',
      'Self-referral and code-guessing if a code is short or sequential.',
    ],
    privacy: [
      'The parameter must identify a campaign or a referring account opaquely, never a named person.',
      'Do not store the full referring URL, which can carry unrelated query data.',
    ],
    scores: {
      userValue: s(1, 'Invisible to users when done correctly.'),
      businessRelevance: s(4, 'Determines whether an existing feature is doing anything.'),
      distributionLeverage: s(2, 'Attribution does not create referrals; it reveals them.'),
      feasibility: s(4, 'A referral parameter is already read somewhere in this repository.'),
      fitWithSurfaces: s(4, 'The invite surfaces exist; the gap is between link and signup.'),
      effort: s(3, 'Touches the invite link, the landing route, and account creation.'),
      measurementReadiness: s(2, 'That is what is missing.'),
      privacyRisk: s(3, 'A referral code is personal data if it identifies the referrer.'),
      abuseRisk: s(3, 'Referral systems attract self-referral wherever a reward exists.'),
      confidence: confidenceFor(referral),
    },
    cheapestNextAction: 'Check whether the referral parameter already survives to account creation '
      + 'before building anything: it may only be dropped at one step.',
    successMetric: 'Accounts created with a referral source recorded, weekly.',
    guardrailMetric: 'Signup completion rate unchanged.',
    resolution: {
      mustLearn: 'Where in the existing flow the referral parameter is lost, and whether any '
        + 'reward is attached to a referral today.',
      ownerRole: 'Whoever owns signup, with the product owner for the reward question.',
      questions: [
        'Does the invite link carry a parameter today, and is it read on arrival?',
        'Is the parameter persisted across the signup steps, or dropped on the first navigation?',
        'Is anything paid or granted for a referral? If so, what stops a person referring themselves?',
      ],
      expectedEvidence: 'A trace of one invite link from creation to a created account, naming the '
        + 'step where the parameter disappears.',
      method: 'Follow one link by hand through the existing flow in a development environment.',
      safeNextStep: 'Record the finding. Do not add a reward before attribution and fraud controls exist.',
      decisionCriteria: 'If the parameter survives, this is a small measurement change. If it is '
        + 'dropped, fix that before considering any incentive.',
    },
  }
}

/**
 * Messages go out and preference state is not visible in the code.
 *
 * P0 because it is the one item in this section with a legal edge. Stated
 * carefully: the absence of a preference identifier is not proof that consent
 * is unhandled — it may live in the mail provider. That is exactly why this
 * resolves to a question rather than to a prompt.
 */
const sendingWithoutVisibleConsent: Rule = (caps) => {
  const retention = capability(caps, 'retention_rebooking')
  const campaigns = capability(caps, 'campaigns')
  const consent = capability(caps, 'consent_controls')
  const sends = retention.found.some((f) => /reminder that is sent/.test(f.label))
    || campaigns.status === 'present'
  if (!sends) return null
  if (consent.status === 'present') return null

  return {
    id: 'MKT-003',
    title: 'Messages are sent and no stored marketing preference was found',
    type: 'measurement_gap',
    capability: 'consent_controls',
    priority: 'P0',
    classification: 'external_research_first',
    observed: `Sending was found in the code, and consent handling is ${consent.status}. `
      + `Not found: ${consent.absent.join('; ') || 'nothing at all'}.`,
    evidence: [...paths(retention), ...paths(consent)].slice(0, 6),
    serves: 'The recipients, and whoever is accountable for what the product sends.',
    hypothesis: 'Not a growth hypothesis. If preference state is not enforced in code, it is being '
      + 'enforced somewhere else or not at all, and which of those is true changes what may be sent.',
    requiredData: [
      'Where per-recipient marketing preference is stored and what enforces it before a send.',
    ],
    risks: [
      'Sending marketing to somebody who opted out, which is a legal exposure and not merely a bug.',
    ],
    privacy: [
      'This report does not read recipient records, so it cannot confirm what any individual chose.',
      'Nothing here should be resolved by exporting a recipient list into a document.',
    ],
    scores: {
      userValue: s(5, 'Being able to stop messages is the user value.'),
      businessRelevance: s(4, 'Exposure rather than upside.'),
      distributionLeverage: s(1, 'Consent controls distribute nothing.'),
      feasibility: s(3, 'Depends entirely on where preference actually lives.'),
      fitWithSurfaces: s(3, 'Sending exists; the enforcement point is unknown.'),
      effort: s(3, 'Unknowable until the first question is answered.'),
      measurementReadiness: s(2, 'Consent state is not visible to this scan.'),
      privacyRisk: s(1, 'Adding enforcement lowers risk.'),
      abuseRisk: s(1, 'None.'),
      confidence: confidenceFor(consent),
    },
    cheapestNextAction: 'Ask where marketing preference is stored. If the answer is the mail '
      + 'service, confirm the product checks it before queueing a send.',
    successMetric: 'Every send path demonstrably checks a preference before sending.',
    guardrailMetric: 'No send path bypasses the check.',
    resolution: {
      mustLearn: 'Whether marketing preference is enforced, and where.',
      ownerRole: 'Engineering owner for messaging, with whoever is accountable for compliance.',
      questions: [
        'Where is a recipient\'s marketing preference stored?',
        'Which component checks it, and does every send path go through that component?',
        'Is there an unsubscribe link in outbound marketing mail, and what does it update?',
        'Are transactional and marketing messages separated, given that only one needs consent?',
      ],
      expectedEvidence: 'A named enforcement point, and the list of send paths that pass through it.',
      method: 'Code walk from each send call backwards to the preference check. No recipient data needed.',
      safeNextStep: 'Do not add any new send path until this is answered.',
      decisionCriteria: 'If a send path exists that does not consult a preference, that is a defect '
        + 'to fix before any marketing work in this section proceeds.',
    },
  }
}

/**
 * Something is shareable and a shared link has no preview.
 *
 * P1: cheap, self-contained, and it changes what every existing share already
 * produces. Deliberately not claimed to increase anything — only that a link
 * currently renders as a bare URL.
 */
const sharedLinksHaveNoPreview: Rule = (caps, ctx) => {
  const sharing = capability(caps, 'sharing')
  const previews = capability(caps, 'social_previews')
  if (sharing.status === 'missing' || sharing.status === 'unverified') return null
  if (previews.status === 'present' || previews.status === 'unverified') return null

  return {
    id: 'MKT-004',
    title: 'Links are shared and a shared link has no preview',
    type: 'improve_existing',
    capability: 'social_previews',
    priority: 'P1',
    classification: 'implementation_ready',
    observed: `Share surfaces exist, and link-preview metadata is ${previews.status}. `
      + `Not found: ${previews.absent.join('; ')}.`,
    evidence: paths(sharing),
    serves: 'Everybody who already shares a link and everybody who receives one.',
    hypothesis: 'A link pasted into a message currently renders as a bare URL. With a title, a '
      + 'description and an image it renders as a card. Whether more people open it is unknown '
      + 'until MKT-001 is in place — that is the order these two go in.',
    requiredData: ['Share events, so the effect of the change can be seen at all.'],
    risks: [
      'A preview image generated from customer content republishes that content to anyone holding the link.',
    ],
    privacy: [
      'A preview must not include a customer name, a photograph or anything from an intake form.',
      'The title and description must be safe for a link forwarded to a stranger.',
    ],
    scores: {
      userValue: s(3, 'A recognisable card instead of a bare URL.'),
      businessRelevance: s(3, 'Affects every share that already happens.'),
      distributionLeverage: s(4, 'Applies to the existing loop rather than creating a new one.'),
      feasibility: s(5, 'Static metadata on existing pages.'),
      fitWithSurfaces: s(4, 'The pages being shared already exist.'),
      effort: s(2, 'Metadata, plus a decision about the image.'),
      measurementReadiness: s(2, 'Unmeasurable until share events exist — see MKT-001.'),
      privacyRisk: s(4, 'The image is the risk: it is the one part that can leak customer content.'),
      abuseRisk: s(2, 'A preview can be used to make a link look more trustworthy than it is.'),
      confidence: confidenceFor(previews),
    },
    cheapestNextAction: 'Add title, description and canonical to the pages already being shared, '
      + 'and use a brand image rather than generated content for the first version.',
    successMetric: 'Shared links render a card, verified by pasting one into a messaging app.',
    guardrailMetric: 'No customer-identifying content appears in any preview.',
    prompt: [
      'Opportunity MKT-004 — give shared pages a link preview.',
      '',
      'Share surfaces confirmed in this repository:',
      ...paths(sharing).map((p) => `  - ${p}`),
      '',
      'Goal: the pages reachable from those share actions carry a title, a description,',
      'a canonical URL and an Open Graph image, so a shared link renders as a card.',
      '',
      'Requirements:',
      '- Use a static brand image for the preview. Do NOT generate the image from',
      '  customer content, photographs, or anything a customer submitted.',
      '- The title and description must be safe for a stranger: no customer name and',
      '  nothing submitted by a customer.',
      '- Set a canonical URL that does not carry tokens or query parameters.',
      '- Preserve existing page behaviour; this adds metadata only.',
      '- Add a test asserting the metadata is present and that the preview fields',
      '  contain no interpolated customer field.',
      '- No unrelated refactors.',
      '',
      'Requires owner approval before implementation.',
    ].join('\n'),
  }
}

/**
 * Providers can be promoted and have no asset to promote with.
 *
 * P2 and experiment-first: the surfaces exist, but whether anybody wants the
 * asset is a question about people, and this module has met none of them.
 */
const noShareableAsset: Rule = (caps) => {
  const promo = capability(caps, 'provider_self_promotion')
  if (promo.status === 'missing' || promo.status === 'unverified') return null
  const missingAsset = promo.absent.some((a) => /share asset/.test(a))
  if (!missingAsset) return null

  return {
    id: 'MKT-005',
    title: 'A public link exists and there is nothing to put it on',
    type: 'paid_tool',
    capability: 'provider_self_promotion',
    priority: 'P2',
    classification: 'experiment_first',
    observed: 'Public and shareable links were found; no downloadable or generated share asset was.',
    evidence: paths(promo),
    serves: 'People who promote their own page elsewhere and currently have only a raw URL.',
    hypothesis: 'If somebody can export an image carrying their own link, the link can travel to '
      + 'places a URL cannot — a printed card, a story, a profile picture. Whether anyone would use '
      + 'it is unknown; nothing in the repository indicates demand either way.',
    requiredData: [
      'How many people currently open the existing link screen, in aggregate.',
      'Whether an exported asset is ever downloaded, once one exists.',
    ],
    risks: [
      'An asset containing a photograph or somebody else\'s work needs explicit consent to exist.',
      'A generated image is a rendering surface, and rendering user text into an image invites abuse.',
    ],
    privacy: [
      'No customer content in an exported asset without explicit, recorded consent.',
    ],
    scores: {
      userValue: s(3, 'Assumed, not observed: no repository evidence shows anyone asking for this.'),
      businessRelevance: s(3, 'Plausibly a paid-plan feature, which is a pricing question not a code one.'),
      distributionLeverage: s(4, 'Moves a link into physical and social space.'),
      feasibility: s(3, 'Image generation is a real dependency and a real rendering surface.'),
      fitWithSurfaces: s(4, 'The link screen already exists to hang it off.'),
      effort: s(4, 'Templates, rendering, download, and a consent decision.'),
      measurementReadiness: s(2, 'Nothing currently counts use of the existing link screen.'),
      privacyRisk: s(3, 'Depends entirely on what goes into the image.'),
      abuseRisk: s(3, 'Arbitrary text rendered into a branded image can be used to impersonate.'),
      confidence: s(2, 'The surfaces are evidenced; the demand is assumed.'),
    },
    cheapestNextAction: 'Ask ten of them what they currently do with their link. That costs '
      + 'nothing and settles whether the asset is wanted.',
    successMetric: 'Share of eligible accounts that generate an asset within 30 days of it existing.',
    guardrailMetric: 'No support reports of an asset containing content its owner did not intend.',
    resolution: {
      mustLearn: 'Whether anyone wants an asset at all, and what they would put on it.',
      ownerRole: 'Product owner, with whoever talks to customers regularly.',
      questions: [
        'Where do people currently put their link?',
        'Have any asked for something printable or postable?',
        'Would this belong to a paid plan, and does that conflict with people needing to be found?',
      ],
      expectedEvidence: 'Notes from ten conversations, and a count of who already opens the existing '
        + 'link screen.',
      method: 'Customer interviews. No code change, no new dependency.',
      safeNextStep: 'Instrument the existing link screen first, so the question has a baseline.',
      decisionCriteria: 'Build it if people already improvise the thing by hand. Drop it if the '
        + 'existing link screen is rarely opened.',
    },
  }
}

/**
 * Nothing can be tried, because nothing can be varied.
 *
 * P2. Deliberately not P1: a product with no experimentation is not broken, and
 * recommending an experiment platform to a small product is exactly the generic
 * advice this section exists to avoid. It is raised only as the reason several
 * other opportunities have to stay hypotheses.
 */
const nothingCanBeTested: Rule = (caps) => {
  const flags = capability(caps, 'experimentation')
  const analytics = capability(caps, 'growth_analytics')
  if (flags.status !== 'missing') return null
  if (analytics.status === 'missing' || analytics.status === 'unverified') return null

  return {
    id: 'MKT-006',
    title: 'Events are recorded and no mechanism exists to vary anything',
    type: 'experiment',
    capability: 'experimentation',
    priority: 'P2',
    classification: 'measurement_first',
    observed: 'Event tracking was found; no feature-flag or experiment identifier was.',
    evidence: paths(analytics),
    serves: 'Anyone who wants to know whether a change helped rather than assuming it did.',
    hypothesis: 'With a way to show a change to some users and not others, the opportunities above '
      + 'could be settled by measurement instead of argument. Without one, every result is a '
      + 'before-and-after across a changing population.',
    requiredData: ['A stable assignment of users to variants, and an event to compare them on.'],
    risks: [
      'An experiment framework is a permanent dependency added for a benefit that may be one decision.',
    ],
    privacy: [
      'Variant assignment must not require a new identifier for anyone not already identified.',
    ],
    scores: {
      userValue: s(1, 'None directly.'),
      businessRelevance: s(3, 'Changes how confidently any later claim can be made.'),
      distributionLeverage: s(1, 'None.'),
      feasibility: s(3, 'A flag can be a configuration value; a platform is a larger decision.'),
      fitWithSurfaces: s(2, 'Nothing in the repository is currently shaped for it.'),
      effort: s(3, 'Small if a simple flag suffices, large if a vendor is adopted.'),
      measurementReadiness: s(3, 'Events exist, which is the harder half.'),
      privacyRisk: s(2, 'Depends on whether assignment needs an identifier.'),
      abuseRisk: s(1, 'None.'),
      confidence: confidenceFor(flags),
    },
    cheapestNextAction: 'A single configuration flag for the next change worth testing. Do not adopt '
      + 'an experiment platform to answer one question.',
    successMetric: 'One change shipped with a measured comparison rather than an assumption.',
    guardrailMetric: 'No new third-party dependency added for a single experiment.',
    resolution: {
      mustLearn: 'Whether there is a queue of decisions worth testing, or only one.',
      ownerRole: 'Product owner with the engineering owner.',
      questions: [
        'How many changes in the last quarter would have been settled by a test?',
        'Is there enough traffic for a result to mean anything?',
      ],
      expectedEvidence: 'A list of decisions that were made by argument, and the weekly volume at '
        + 'the surface each one touched.',
      method: 'Review recent decisions. No code change.',
      safeNextStep: 'Answer the traffic question first: below a certain volume no test can conclude.',
      decisionCriteria: 'Adopt a platform only if several decisions per quarter need one AND the '
        + 'volume supports a result.',
    },
  }
}

const RULES: Rule[] = [
  shareIsUnmeasured,
  referralIsUnattributed,
  sendingWithoutVisibleConsent,
  sharedLinksHaveNoPreview,
  noShareableAsset,
  nothingCanBeTested,
]

const PRIORITY_ORDER: Record<Priority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 }

// ── What this section will not recommend ────────────────────────────────────
//
// Fixed, because these are refusals rather than findings: they are true of every
// product, and a reader should be able to see that the section declined them on
// purpose rather than not thinking of them.

const NOT_RECOMMENDED: Array<{ idea: string; because: string }> = [
  {
    idea: 'Posting to a social account on the user\'s behalf',
    because: 'It requires an authorisation this product does not hold, and a web page cannot '
      + 'pre-fill an Instagram post at all. Copying the link and saying where to paste it is the '
      + 'honest version.',
  },
  {
    idea: 'Importing a contact list to invite people',
    because: 'It collects personal data about people who have not met the product, to send them '
      + 'something they did not ask for.',
  },
  {
    idea: 'Incentivised reviews',
    because: 'Paying for reviews breaches the policy of every platform that hosts them, and a '
      + 'review that was bought tells a reader nothing.',
  },
  {
    idea: 'A referral reward before attribution and fraud controls exist',
    because: 'A reward with no attribution cannot be paid correctly, and a reward with no fraud '
      + 'control pays people for referring themselves.',
  },
  {
    idea: 'Buying traffic',
    because: 'Paid acquisition before conversion measurement spends money to produce a number '
      + 'nobody can interpret.',
  },
  {
    idea: 'Indexing pages that carry customer content',
    because: 'Discoverability is desirable for a public profile page and harmful for anything '
      + 'holding content a customer submitted.',
  },
]

// ── Entry point ─────────────────────────────────────────────────────────────

export interface AnalyseMarketingOptions extends DetectOptions {
  /** Passed through from the quality pass, as every sibling analyser does, so
   *  one verdict about the checkout's freshness is shared rather than three. */
  stale?: boolean
}

export function analyseMarketing(
  files: SourceFile[],
  o: AnalyseMarketingOptions,
): MarketingReport {
  const capabilities = detectCapabilities(files, o)
  const ctx: RuleContext = {
    hasLinkPreviewMeta: o.hasLinkPreviewMeta,
    publicRouteCount: o.publicRouteCount,
  }

  const opportunities = RULES
    .map((r) => r(capabilities, ctx))
    .filter((x): x is Opportunity => x !== null)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])

  // Measurement gaps are stated as what cannot be evaluated, not as findings:
  // an absent measurement is a limit on this report before it is a problem
  // with the product.
  const measurementGaps: string[] = []
  const analytics = capability(capabilities, 'growth_analytics')
  const attribution = capability(capabilities, 'attribution')
  if (!analytics.found.some((f) => /funnel events/.test(f.label))) {
    measurementGaps.push('No named funnel events were found, so no conversion rate in this section '
      + 'could be computed from the repository.')
  }
  if (!analytics.found.some((f) => /a share happened/.test(f.label))) {
    measurementGaps.push('No share event was found, so how often anything is shared is unknown and '
      + 'no change to a share surface could be evaluated.')
  }
  if (attribution.status !== 'present') {
    measurementGaps.push('Attribution is incomplete, so arrivals cannot be traced to a source and '
      + 'no channel can be compared with another.')
  }
  if (capability(capabilities, 'experimentation').status === 'missing') {
    measurementGaps.push('No experiment or feature-flag mechanism was found, so no recommendation '
      + 'here can be settled by a controlled comparison.')
  }
  for (const c of capabilities) {
    if (c.status === 'unverified') {
      measurementGaps.push(`${c.label}: ${c.unverifiedBecause}`)
    }
  }
  measurementGaps.push('Campaign sends, deliveries, opens and clicks live in an email service rather '
    + 'than in this repository, and were not read.')
  measurementGaps.push('Revenue and plan eligibility per account were not read: this section takes '
    + 'no account data of any kind.')

  const limitations = [
    'This section reports what the repository can support. It is not evidence that any change here '
    + 'would increase traffic, signups, orders or revenue — nothing in a codebase can establish that.',
    'A capability marked present was found by matching code shapes. It has not been exercised, so '
    + 'this says the mechanism exists and never that it works.',
    'Scores are judgements with their basis printed beside them, not measurements.',
  ]
  if (o.stale) {
    limitations.push('The checkout may be behind the deployed product, so a capability reported '
      + 'missing here may exist in production.')
  }

  return {
    capabilities,
    opportunities,
    measurementGaps,
    notRecommended: NOT_RECOMMENDED,
    limitations,
    stale: Boolean(o.stale),
  }
}
