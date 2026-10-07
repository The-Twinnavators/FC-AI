// daemon/src/integrations/poschi/journeys/analyse.ts
//
// Each role's path through the product, end to end.
//
// ── Why this is separate from the funnel work ────────────────────────────────
//
// The instrumentation audit asks whether a journey can be MEASURED. This asks
// whether it can be WALKED. They fail differently and they are fixed by
// different people: a stage with no event is a tracking gap, and a stage with
// no screen is a product gap, and confusing the two sends an engineer to
// instrument something that does not exist.
//
// ── Where the stages come from ───────────────────────────────────────────────
//
// Not from the code. The stages are the ones any account-based product has —
// arrive, sign up, get set up, reach the thing you came for, come back, and
// leave — and the analysis is which of them this product has a surface for.
// Deriving the stages from the routes would make the product define its own
// completeness, and a journey with a missing middle would score full marks.
//
// ── The stage nobody builds ──────────────────────────────────────────────────
//
// Exit. Almost every product has signup and almost none has "delete my
// account", and the absence is usually nobody's decision — it is the stage that
// never came up. It is checked here for that reason.

export interface SourceFile {
  path: string
  text: string
}

export type Severity = 'high' | 'medium' | 'low' | 'info'
export type Confidence = 'verified' | 'indicated' | 'hypothesis'

export type StageId =
  | 'arrive' | 'sign_up' | 'set_up' | 'core_value' | 'repeat' | 'support' | 'leave'

export interface Stage {
  id: StageId
  name: string
  /** What the person is trying to do. */
  intent: string
}

export const STAGES: Stage[] = [
  { id: 'arrive', name: 'Arrive', intent: 'Reach the product and understand what it is' },
  { id: 'sign_up', name: 'Sign up', intent: 'Create an account' },
  { id: 'set_up', name: 'Get set up', intent: 'Do whatever is needed before the product is useful' },
  { id: 'core_value', name: 'Core value', intent: 'Do the thing they came for' },
  { id: 'repeat', name: 'Come back', intent: 'Return and do it again' },
  { id: 'support', name: 'Get help', intent: 'Find out what went wrong, or ask somebody' },
  { id: 'leave', name: 'Leave', intent: 'Stop, and take their data with them' },
]

export interface RoleJourney {
  role: string
  steps: Array<{
    stage: StageId
    name: string
    intent: string
    /** Routes that serve this stage for this role. */
    routes: string[]
    /** True when nothing in the product serves it. */
    missing: boolean
  }>
  /** Stages with no surface at all. */
  gaps: StageId[]
}

export interface JourneyFinding {
  id: string
  area: string
  role: string
  title: string
  severity: Severity
  confidence: Confidence
  detail: string
  files: string[]
  because: string
  next: string
  isAbsence: boolean
  prompt?: string | null
}

export interface JourneyReport {
  journeys: RoleJourney[]
  findings: JourneyFinding[]
}

/** What a route serving each stage looks like. Matched against the path, and
 *  against the screen name where the path is uninformative. */
const STAGE_ROUTES: Record<StageId, RegExp> = {
  // Not `^/$`. The root route exists on every product, and here it serves the
  // login screen — counting it as an arrival surface would answer the question
  // "is there anywhere to land" with the very page that is the finding.
  arrive: /landing|welcome|about|^\/home$/i,
  sign_up: /signup|sign-up|register|verify-email|invite|accept-invite|forgot-password|^\/login$/i,
  set_up: /onboard|setup|set-up|profile\/?(edit|new)?$|preferences/i,
  core_value: /appointment|booking|lookbook|stylist\/|client\/|dashboard/i,
  repeat: /dashboard|appointments|notifications|lookbooks/i,
  support: /help|support|faq|contact/i,
  leave: /delete|close-account|deactivate|export|download-my-data/i,
}

/** Backend shapes that serve a stage without a route of their own. */
const STAGE_API: Partial<Record<StageId, RegExp>> = {
  set_up: /\/onboarding\/(complete|status)/,
  // Self-service only, and quoted as a path so a mention in prose does not
  // count. The first version matched `/admin/users/bulk-delete` and reported
  // that everybody could close their own account — an administrator deleting
  // somebody is the opposite of the thing being asked about, and the report
  // said the stage was served for all three roles.
  leave: /["'`]\/(?!admin)[\w/-]*(delete-account|close-account|deactivate-account|export-data|gdpr)/i,
  // A quoted path, not the word. `contact` appears in ordinary prose in almost
  // any codebase, and matching it marked support as served everywhere.
  support: /["'`]\/(support|help|faq|contact)/i,
}

export interface AnalyseJourneyOptions {
  /** Route pattern -> role, from the router analysis. */
  roles?: Record<string, { role: string }>
  stale?: boolean
}

export function analyseJourneys(
  files: SourceFile[],
  opts: AnalyseJourneyOptions = {},
): JourneyReport {
  const roleOf = opts.roles ?? {}
  const all = files.map((f) => f.text).join('\n')

  // Roles worth a journey. `unknown` is not one: a journey for screens whose
  // audience could not be established would be a journey for nobody.
  const roles = [...new Set(Object.values(roleOf).map((r) => r.role))]
    .filter((r) => r !== 'unknown' && r !== 'system')
    .sort()

  const shared = Object.entries(roleOf)
    .filter(([, r]) => r.role === 'unknown' || r.role === 'anonymous')
    .map(([route]) => route)

  const journeys: RoleJourney[] = roles.map((role) => {
    const own = Object.entries(roleOf).filter(([, r]) => r.role === role).map(([route]) => route)
    // The unauthenticated screens belong to every role's journey: everybody
    // arrives and signs up through the same doors.
    const reachable = [...own, ...shared]

    const steps = STAGES.map((s) => {
      const routes = reachable.filter((r) => STAGE_ROUTES[s.id].test(r))
      const api = STAGE_API[s.id]
      const servedByApi = api ? api.test(all) : false
      return {
        stage: s.id,
        name: s.name,
        intent: s.intent,
        routes,
        missing: routes.length === 0 && !servedByApi,
      }
    })

    return { role, steps, gaps: steps.filter((s) => s.missing).map((s) => s.stage) }
  })

  const findings: JourneyFinding[] = []
  const absenceBecause = opts.stale
    ? 'This is an absence, and the checkout is behind the deployed product, so it may exist in code '
      + 'not present here.'
    : 'This is an absence. It means no route and no endpoint serves the stage — not that the stage '
      + 'is impossible, since a screen can do several things at once.'

  // ── Leaving ───────────────────────────────────────────────────────────────
  const cannotLeave = journeys.filter((j) => j.gaps.includes('leave')).map((j) => j.role)
  if (cannotLeave.length > 0) {
    findings.push({
      id: 'no-exit',
      area: 'End of the journey',
      role: cannotLeave.join(', '),
      title: 'Nobody can close their own account',
      severity: 'medium',
      confidence: opts.stale ? 'indicated' : 'verified',
      detail: `No route or endpoint lets a ${cannotLeave.join(' or a ')} delete their account or `
        + 'take their data with them. Every departure therefore becomes a support request, and '
        + 'somewhere there is a regulation that expects otherwise.',
      files: [],
      because: absenceBecause,
      next: 'Decide who handles it today. If the answer is "an admin does it by hand", that is a '
        + 'workload and a response time rather than a feature gap — and worth knowing which.',
      isAbsence: true,
      prompt: [
        'Add self-service account closure to this application.',
        '',
        'No route or endpoint currently lets a person delete their own account or export their own',
        'data, so every departure is a support request.',
        '',
        '1. Add a screen under the account area: what will be deleted, what is kept and why, and a',
        '   confirmation that takes a deliberate action rather than one click.',
        '2. Add the endpoint. Decide explicitly what happens to records that belong to two people —',
        '   a shared record belongs to both of them, and deleting one side must not destroy the',
        '   other side’s history.',
        '3. Offer an export before deletion, of the data that is theirs alone.',
        '',
        'Acceptance: a person can close their own account without support; records shared with',
        'another party survive in a form that other party can still read; the confirmation cannot be',
        'triggered accidentally.',
      ].join('\n'),
    })
  }

  // ── Getting help ──────────────────────────────────────────────────────────
  const noSupport = journeys.filter((j) => j.gaps.includes('support')).map((j) => j.role)
  if (noSupport.length > 0) {
    findings.push({
      id: 'no-support',
      area: 'When something goes wrong',
      role: noSupport.join(', '),
      title: 'No help or contact surface in the product',
      severity: 'medium',
      confidence: opts.stale ? 'indicated' : 'verified',
      detail: 'Nothing routes a confused person anywhere. They either work it out, ask whoever '
        + 'invited them, or leave — and only the last of those is visible to the business, as a '
        + 'person who stopped coming back.',
      files: [],
      because: absenceBecause,
      next: 'The cheapest version is a contact route, not a help centre. Where support happens '
        + 'today is the question to answer first.',
      isAbsence: true,
      prompt: null,
    })
  }

  // ── Arriving ──────────────────────────────────────────────────────────────
  const noArrival = journeys.filter((j) => j.gaps.includes('arrive')).map((j) => j.role)
  if (noArrival.length > 0 && noArrival.length === journeys.length) {
    findings.push({
      id: 'no-arrival',
      area: 'Start of the journey',
      role: 'everyone',
      title: 'The product opens on a login screen',
      severity: 'low',
      confidence: 'verified',
      detail: 'There is no screen that explains what this is to somebody who has not been told. '
        + 'For an invited product that is coherent — the invitation does the explaining — and it '
        + 'means an invitation that arrives without context has nowhere to send somebody.',
      files: [],
      because: 'Read from the router: the root route serves the login screen and no landing or '
        + 'marketing route exists.',
      next: 'Only worth solving if links reach people who were not expecting them. The link-preview '
        + 'finding in the SEO tab is the cheaper half of the same problem.',
      isAbsence: true,
      prompt: null,
    })
  }

  // ── Per-role summaries, so each journey appears even when it is intact ────
  for (const j of journeys) {
    const served = j.steps.filter((s) => !s.missing).length
    findings.push({
      id: `journey-${j.role}`,
      area: 'Journey',
      role: j.role,
      title: `${j.role}: ${served} of ${STAGES.length} stages have a surface`,
      severity: j.gaps.length > 2 ? 'medium' : 'info',
      confidence: 'verified',
      detail: j.gaps.length === 0
        ? 'Every stage has a route or an endpoint behind it.'
        : `Nothing serves: ${j.gaps.map((g) => STAGES.find((s) => s.id === g)!.name).join(', ')}. `
          + `Served by: ${j.steps.filter((s) => !s.missing)
            .map((s) => `${s.name} (${s.routes.length || 'endpoint'})`).join(', ')}.`,
      files: [],
      because: 'Matched from the routes the router declares and the endpoints the backend exposes. '
        + 'A screen can serve a stage this does not associate with it, so a gap is a place to look '
        + 'rather than a proven hole.',
      next: j.gaps.length === 0
        ? 'Nothing here. The stages exist; whether they work is a question for usage data.'
        : 'Walk the journey as this role and confirm each gap. Most take a minute to settle.',
      isAbsence: j.gaps.length > 0,
      prompt: null,
    })
  }

  const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2, info: 3 }
  findings.sort((a, b) => rank[a.severity] - rank[b.severity])

  return { journeys, findings }
}
