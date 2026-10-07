// daemon/src/integrations/poschi/instrumentation/contract.ts
//
// What FlowAgent asked POSCHI to emit, as data.
//
// ── Why this lives in code and not only in the document ─────────────────────
//
// `docs/poschi/poschi-usability-instrumentation.md` is the request: the events,
// the funnels they feed, and the two product entities that do not exist yet.
// The audit has to check that same list, and a list transcribed by hand drifts
// from the one that was sent — at which point the audit reports a product
// failing to meet a contract nobody agreed to.
//
// So the names live here once, and a test asserts every one of them still
// appears in the document.

/** A stage of a funnel, and the event that would make it measurable. */
export interface ExpectedEvent {
  /**
   * The event name POSCHI would emit, or null where the request deliberately
   * asked for none.
   *
   * Null is not an oversight. The instrumentation request says not to emit an
   * event for a step that does not exist, and inventing a name here would have
   * the audit report POSCHI as failing to send something nobody ever asked them
   * for. A test against the document catches exactly that, and did.
   */
  event: string | null
  /** What it marks, in the words the report uses. */
  stage: string
  /**
   * Set where the event cannot be emitted because the thing it describes does
   * not exist in the product yet. The instrumentation request calls these out
   * separately: they are not missing tracking, they are missing features, and
   * telling a team to "add the event" would be advice they cannot follow.
   */
  blockedBy?: string
}

export interface ExpectedFunnel {
  /** The `resource` the digest would carry it under. */
  resource: string
  name: string
  events: ExpectedEvent[]
}

export const EXPECTED_FUNNELS: ExpectedFunnel[] = [
  {
    resource: 'provider_signup_funnel',
    name: 'Provider signup',
    events: [
      { event: 'provider_signup_started', stage: 'Signup started' },
      { event: 'provider_email_submitted', stage: 'Email submitted' },
      { event: 'provider_otp_verified', stage: 'Email code verified' },
      { event: 'provider_account_created', stage: 'Account created' },
    ],
  },
  {
    resource: 'provider_profile_setup_funnel',
    name: 'Provider profile setup',
    events: [
      { event: 'provider_setup_opened', stage: 'Setup opened' },
      {
        event: null,
        stage: 'Services added',
        blockedBy: 'there is no service entity in the reviewed bundle, so nothing can fire this',
      },
      {
        event: null,
        stage: 'Availability published',
        blockedBy: 'there is no availability entity in the reviewed bundle, so nothing can fire this',
      },
      { event: 'provider_profile_publishable', stage: 'Profile publishable' },
    ],
  },
  {
    resource: 'booking_funnel',
    name: 'Booking',
    events: [
      { event: 'stylist_profile_viewed', stage: 'Provider viewed' },
      { event: 'booking_requested', stage: 'Booking requested' },
      { event: 'booking_confirmed', stage: 'Booking confirmed' },
    ],
  },
  {
    resource: 'invitation_funnel',
    name: 'Invitations',
    events: [
      { event: 'invitation_sent', stage: 'Invitation sent' },
      { event: 'invitation_accepted', stage: 'Invitation accepted' },
    ],
  },
  {
    resource: 'appointment_outcome',
    name: 'Appointment outcome',
    events: [
      { event: 'appointment_completed', stage: 'Appointment completed' },
      { event: 'appointment_no_show', stage: 'No show' },
    ],
  },
]

/** Every stage the request describes, flattened. */
export function expectedStages(): ExpectedEvent[] {
  return EXPECTED_FUNNELS.flatMap((f) => f.events)
}

/** Only the stages that name an event. The others have nothing to look for. */
export function expectedEventNames(): string[] {
  return expectedStages().map((e) => e.event).filter((e): e is string => e !== null)
}

/**
 * Shapes that emit an analytics event.
 *
 * Deliberately broad. The request says to write events to the existing Supabase
 * backend rather than add a vendor, so the call could be almost anything — but
 * a product that added a vendor instead is a finding worth surfacing rather
 * than missing, which is why the vendor SDKs are in here too.
 */
export const EMITTERS = [
  'track', 'trackEvent', 'capture', 'logEvent', 'recordEvent', 'emitEvent',
  'analytics.track', 'analytics.capture', 'posthog.capture', 'mixpanel.track',
  'gtag', 'amplitude.track', 'segment.track',
]

/**
 * Third-party analytics, which the request asked POSCHI NOT to add.
 *
 * Found means the constraint was not followed, which is a finding in itself —
 * and it also changes where the events live, so the audit would be looking in
 * the wrong place.
 */
export const VENDOR_MARKERS = [
  'posthog', 'mixpanel', '@segment/', 'amplitude', 'heap-analytics',
  'react-ga', 'gtag', 'google-analytics', 'plausible', 'fathom-client',
]

/**
 * Product entities two funnel stages depend on.
 *
 * Checked because "add the event" is the wrong advice when the thing the event
 * describes has not been built. The report ranks a declared-blind stage above
 * ordinary diagnostics, and a stage blind for want of a feature is a different
 * conversation from one blind for want of a line of code.
 *
 * ── Declarations, not words ─────────────────────────────────────────────────
 *
 * The first version matched the WORD, and reported that POSCHI had both
 * entities. It has neither. The only match was `interface ServiceAgreement` —
 * an agreement between two people, not a catalogue of services — and
 * "availability" appeared in prose. That false positive would have removed two
 * real product gaps from the roadmap, which is the most expensive kind of wrong
 * a report of this sort can be: it does not add a task, it deletes one.
 */
export const EXPECTED_ENTITIES: Array<{
  name: string
  /** Shapes that DECLARE the entity. Not the word. */
  patterns: RegExp[]
  why: string
}> = [
  {
    name: 'service',
    patterns: [
      /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:[\w"`]+\.)?"?services?\b/i,
      /\.from\(\s*[\'"`]services?[\'"`]/i,
      /\b(?:interface|type|class)\s+Services?\b/,
    ],
    why: 'services added',
  },
  {
    name: 'availability',
    patterns: [
      /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:[\w"`]+\.)?"?availabilit(?:y|ies)\b/i,
      /\.from\(\s*[\'"`]availabilit(?:y|ies)[\'"`]/i,
      /\b(?:interface|type|class)\s+Availabilit(?:y|ies)\b/,
    ],
    why: 'availability published',
  },
]
