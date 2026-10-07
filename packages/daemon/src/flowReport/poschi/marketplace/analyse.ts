// daemon/src/integrations/poschi/marketplace/analyse.ts
//
// Whether the product can connect supply to demand.
//
// ── What a repository can say about a marketplace ────────────────────────────
//
// Not liquidity. Liquidity is a ratio of demand met to demand expressed, and
// both sides of that are behaviour — how many people looked, how many found
// somebody, how many booked. None of it is in the code.
//
// What the code can say is whether the PRIMITIVES exist: can supply describe
// itself, can demand find it, can the two be matched, can a booking be made,
// completed, cancelled, and made again. A missing primitive is a ceiling on
// liquidity that no amount of demand can lift, and that is worth knowing before
// anybody spends on acquisition.
//
// ── The finding this module exists to make possible ──────────────────────────
//
// A capability can exist in the API and have no surface. POSCHI has an endpoint
// that lists available stylists and no route that shows one — so the product
// can answer "who is available" and nobody can ask it. Read from either side
// alone that is invisible: the API looks complete, and the router looks like a
// product that never considered discovery.

export interface SourceFile {
  path: string
  text: string
}

export type Severity = 'high' | 'medium' | 'low' | 'info'
export type Confidence = 'verified' | 'indicated' | 'hypothesis'

/** Where in the marketplace loop a primitive sits. */
export type Side = 'supply' | 'demand' | 'matching' | 'transaction' | 'repeat'

export interface MarketFinding {
  id: string
  area: string
  side: Side
  title: string
  severity: Severity
  confidence: Confidence
  detail: string
  files: string[]
  because: string
  next: string
  isAbsence: boolean
  prompt?: string | null
  /** Roughly what acting on this costs, where this module can say and nothing
   *  downstream could work it out. Absent means unsized, never small. */
  effort?: 'low' | 'medium' | 'high'
}

export interface Primitive {
  id: string
  side: Side
  /** What it lets somebody do, in the words a report uses. */
  name: string
  /** Shapes that would show it exists, in the API or the source. */
  api: RegExp[]
  /** A route that surfaces it, where one is expected. Null where the primitive
   *  is backend-only by nature. */
  route: RegExp | null
  /** Why its absence would cap the marketplace. */
  matters: string
}

/**
 * What the supply side is called here.
 *
 * ── Why this is a list and not a word ────────────────────────────────────────
 *
 * These patterns were written against a product that said "stylist", and the
 * route patterns still said it after that product renamed everything to
 * "provider". POSCHI serves `/provider/profile`; `/\/stylist\/profile/` matched
 * none of its 177 routes, so a screen it has was reported as one it lacks. The
 * finding survived to the report and was withdrawn by the model that checks
 * findings against the code — which is luck, not a mechanism, and a rerun could
 * as easily keep it.
 *
 * A marketplace names its supply side whatever its industry names it. Matching
 * one spelling and calling the rest absent is the failure mode this whole
 * module is most prone to, because an absence is what it reports.
 */
const SUPPLY = 'stylist|provider|vendor|seller|host|pro|partner|merchant|artist|practitioner'
const DEMAND = 'client|customer|buyer|guest|patient|member'

/**
 * The loop, as primitives.
 *
 * Ordered supply → demand → matching → transaction → repeat, which is the order
 * a marketplace has to work in: demand that cannot find supply is not a
 * conversion problem.
 */
export const PRIMITIVES: Primitive[] = [
  {
    id: 'supply-profile',
    side: 'supply',
    name: 'A provider can describe themselves',
    api: [/\/profile\b/, new RegExp(`(${SUPPLY}).?profile`, 'i')],
    route: new RegExp(`/(${SUPPLY})s?/profile`, 'i'),
    matters: 'Without a profile there is nothing for demand to choose between.',
  },
  {
    id: 'supply-services',
    side: 'supply',
    name: 'A provider can list what they offer',
    api: [/service-requests/, /\bservices?\b.*\b(table|from\()/i],
    route: null,
    matters: 'Demand cannot ask for something the supply side cannot describe.',
  },
  {
    id: 'supply-availability',
    side: 'supply',
    name: 'A provider can publish when they are free',
    api: [/\/availability/, /\bavailabilit(y|ies)\b.*\b(table|from\()/i],
    route: null,
    matters: 'Every booking becomes a negotiation when nobody can see the diary, '
      + 'which is the single largest tax a marketplace can put on a transaction.',
  },
  {
    id: 'demand-discovery',
    side: 'demand',
    name: 'A customer can find a provider',
    api: [new RegExp(`(${SUPPLY})s/available`, 'i'), /\/search\b/, /\/browse\b/],
    route: new RegExp(`/(search|browse|discover|explore|(${SUPPLY})s)\\b`, 'i'),
    matters: 'Demand that cannot find supply never becomes a booking, and never '
      + 'appears in any funnel as a loss.',
  },
  {
    id: 'demand-profile-view',
    side: 'demand',
    name: 'A customer can look at a provider',
    api: [new RegExp(`(${SUPPLY}).?profile`, 'i')],
    route: new RegExp(`/(${DEMAND})/(${SUPPLY})s?/|/(${SUPPLY})s/[^/]`, 'i'),
    matters: 'Choosing needs something to look at.',
  },
  {
    id: 'match-invitation',
    side: 'matching',
    name: 'A provider can bring their own customers',
    api: [/invitations\/send/, /invite-client/],
    route: /\/invite/,
    matters: 'The other way a relationship starts, and for some marketplaces the only one.',
  },
  {
    id: 'match-relationship',
    side: 'matching',
    name: 'The pairing is recorded',
    api: [new RegExp(`(${SUPPLY})-(${DEMAND})`, 'i'), /relationship/i],
    route: null,
    matters: 'Repeat business needs the pair to persist beyond one booking.',
  },
  {
    id: 'txn-request',
    side: 'transaction',
    name: 'A booking can be requested',
    api: [/appointments?\/request/, /appointment-requests/],
    route: /\/appointments/,
    matters: 'The transaction itself.',
  },
  {
    id: 'txn-confirm',
    side: 'transaction',
    name: 'A booking can be confirmed',
    api: [/send-appointment-confirmation/, /['"]confirmed['"]/],
    route: null,
    matters: 'An unconfirmed request is demand expressed, not demand met.',
  },
  {
    id: 'txn-cancel',
    side: 'transaction',
    name: 'A booking can be cancelled, and by whom is recorded',
    api: [
      new RegExp(`(${DEMAND})_cancell?ed`, 'i'),
      new RegExp(`(${SUPPLY})_cancell?ed`, 'i'),
    ],
    route: null,
    matters: 'Who cancelled is the difference between a supply problem and a demand one.',
  },
  {
    id: 'txn-outcome',
    side: 'transaction',
    name: 'The outcome is recorded, including a no-show',
    api: [/no_show/, /['"]completed['"]/i],
    route: null,
    matters: 'A marketplace that cannot tell a completed booking from an abandoned one '
      + 'cannot tell whether it works.',
  },
  {
    id: 'repeat-rebooking',
    side: 'repeat',
    name: 'A customer can book the same provider again',
    api: [/rebook/i, /reschedul/i],
    route: null,
    matters: 'Repeat business is what makes acquisition pay for itself.',
  },
  {
    id: 'repeat-engagement',
    side: 'repeat',
    name: 'There is a reason to return between bookings',
    api: [/lookbooks?/i, /\/notifications\b/],
    route: /\/(lookbooks|notifications)/,
    matters: 'A marketplace people only open when they need something is one they forget.',
  },
]

export interface MarketplaceReport {
  findings: MarketFinding[]
  /** Every primitive, with what was found. The inventory a reader checks the
   *  findings against. */
  primitives: Array<{
    id: string
    side: Side
    name: string
    inApi: boolean
    hasRoute: boolean | null
    evidence: string[]
  }>
  /** Status vocabularies found, which is a measurement hazard rather than a
   *  capability. */
  statusVocabularies: { upper: string[]; lower: string[] }
}

const UPPER = /['"]([A-Z_]{4,})['"]/g
const LIFECYCLE = /^(COMPLETED|CANCELLED|PENDING|CONFIRMED|NO_SHOW)$/

/** Prose and tooling, which can mention a capability without implementing it. */
const NOT_IMPLEMENTATION = /\.(md|mdx|txt|rst|html?|ps1|sh|bat|ya?ml|json)$/i
const TOOLING_DIR = /(^|\/)(docs?|documentation|scripts?|\.github)\//i

/** Files that would show somebody the capability, ahead of files that only
 *  talk about it. A stable partition, so two runs over the same repository
 *  cite the same three. */
function orderByUsefulness<T extends { path: string }>(hits: T[]): T[] {
  const implementation = hits.filter(
    (f) => !NOT_IMPLEMENTATION.test(f.path) && !TOOLING_DIR.test(f.path))
  return [...implementation, ...hits.filter((f) => !implementation.includes(f))]
}

export interface AnalyseMarketOptions {
  /** Route patterns the router declares, so a capability with no surface can be
   *  told from one that simply does not exist. */
  routes?: string[]
  stale?: boolean
}

export function analyseMarketplace(
  files: SourceFile[],
  opts: AnalyseMarketOptions = {},
): MarketplaceReport {
  const all = files.map((f) => f.text).join('\n')
  const routes = opts.routes ?? []

  const primitives = PRIMITIVES.map((p) => {
    const hits = files.filter((f) => p.api.some((re) => re.test(f.text)))
    return {
      id: p.id,
      side: p.side,
      name: p.name,
      inApi: hits.length > 0,
      hasRoute: p.route ? routes.some((r) => p.route!.test(r)) : null,
      // ── Code first, because three is all a reader sees ──
      //
      // This used to be the first three matches in scan order. A repository
      // with its documentation at the root — and POSCHI has twenty-five
      // markdown files there, sorting before `src/` — cited a to-do list, a
      // business-model document and a PowerShell script as the evidence that a
      // provider profile is implemented, while `ProviderProfile.tsx` matched
      // and was never shown. The finding was right and unopenable: anybody
      // following the citation arrived somewhere with nothing in it.
      //
      // Ordered rather than filtered. Where only prose matched, prose is still
      // what gets cited, and a reader can see the claim rests on a mention.
      evidence: orderByUsefulness(hits).slice(0, 3).map((f) => f.path),
    }
  })

  const byId = new Map(primitives.map((p) => [p.id, p]))
  const spec = new Map(PRIMITIVES.map((p) => [p.id, p]))

  const absenceBecause = opts.stale
    ? 'This is an absence, and the checkout is behind the deployed product, so it may exist in code '
      + 'not present here.'
    : 'This is an absence. The strongest available claim is that these files contain no such thing.'

  const findings: MarketFinding[] = []

  // ── Capability without a surface ──────────────────────────────────────────
  //
  // The finding that needs both sides read. Reported before the gaps, because a
  // thing that exists and is unreachable is cheaper to fix than a thing that
  // does not exist.
  for (const p of primitives) {
    const s = spec.get(p.id)!
    if (!p.inApi || p.hasRoute !== false) continue
    findings.push({
      id: `unsurfaced-${p.id}`,
      area: 'Reachability',
      side: p.side,
      title: `${p.name} — built, but no screen reaches it`,
      severity: 'high',
      confidence: 'indicated',
      detail: `The API supports this and the router declares no route that would surface it. `
        + `${s.matters}`,
      files: p.evidence,
      because: 'Both sides are read directly. A screen could reach it through a component rather '
        + 'than a route of its own, which this does not trace — worth ten minutes in the app before '
        + 'anything is built.',
      next: 'Confirm whether a screen already uses it. If not, this is the cheapest kind of work '
        + 'there is: the capability exists and needs a way in.',
      // Said on the finding as well as in the comment above, because the report
      // reads the field and not the comment. Nothing downstream can work this
      // out: the files cited here are the capability that already exists, so a
      // reader counting them measures what is built rather than what is left to
      // do, and concludes the opposite of the truth.
      effort: 'low',
      isAbsence: false,
      prompt: null,
    })
  }

  // ── Missing primitives ────────────────────────────────────────────────────
  for (const p of primitives) {
    if (p.inApi) continue
    const s = spec.get(p.id)!
    findings.push({
      id: `missing-${p.id}`,
      area: 'Marketplace loop',
      side: p.side,
      title: `${p.name} — nothing in the code does this`,
      severity: p.side === 'supply' || p.side === 'demand' ? 'high' : 'medium',
      confidence: opts.stale ? 'indicated' : 'verified',
      detail: s.matters,
      files: [],
      because: absenceBecause,
      next: 'Decide whether it belongs in the product. Some marketplaces work without it — one '
        + 'where every booking is arranged between two people who already know each other needs no '
        + 'discovery — and that is a business model rather than a gap.',
      // The other half of the comparison this module opens with: unreachable is
      // cheap, absent is not. Said on the finding because it cites no files —
      // there are none to cite — so nothing downstream could work it out.
      effort: 'high',
      isAbsence: true,
      prompt: null,
    })
  }

  // ── Status vocabularies ───────────────────────────────────────────────────
  const upper = [...new Set([...all.matchAll(UPPER)].map((m) => m[1]!).filter((v) => LIFECYCLE.test(v)))]
  const lower = [...new Set(
    ['completed', 'cancelled', 'client_cancelled', 'stylist_cancelled', 'no_show', 'pending', 'confirmed']
      .filter((v) => new RegExp(`['"]${v}['"]`).test(all)),
  )]

  if (upper.length > 0 && lower.length > 0) {
    findings.push({
      id: 'two-vocabularies',
      area: 'Measurement hazard',
      side: 'transaction',
      title: 'Two appointment status vocabularies are live at once',
      severity: 'high',
      confidence: 'verified',
      detail: `Uppercase: ${upper.join(', ')}. Lowercase: ${lower.join(', ')}. Any count of `
        + 'completed or cancelled bookings is counting one vocabulary and silently skipping the '
        + 'other, so every rate built on it has the wrong denominator — and the number still looks '
        + 'reasonable, which is what makes it dangerous.',
      files: [],
      because: 'Both sets of literals are in the source. Which code path writes which is not traced '
        + 'here; that they coexist is enough to make any aggregate suspect.',
      next: 'Normalise before measuring anything. A funnel built on top of this would be wrong in a '
        + 'way nobody could see, and fixing it afterwards means rebuilding every number derived '
        + 'from it.',
      isAbsence: false,
      prompt: [
        'Normalise the appointment status vocabulary in this application.',
        '',
        `Two are live at once. Uppercase: ${upper.join(', ')}. Lowercase: ${lower.join(', ')}.`,
        '',
        '1. Find every place a status is written and every place one is compared or counted.',
        '2. Pick one vocabulary — the lowercase set is more expressive, since it records WHO',
        '   cancelled — and migrate the stored records to it.',
        '3. Make counting code fail loudly on an unrecognised status rather than skipping it. A',
        '   silent skip is how this became invisible.',
        '4. Add a test that a record in the old vocabulary is either migrated or rejected, never',
        '   quietly ignored.',
        '',
        'Acceptance: one vocabulary in the source; no aggregate silently drops a record; an',
        'unrecognised status raises rather than returning zero.',
      ].join('\n'),
    })
  }

  // ── What cannot be answered ───────────────────────────────────────────────
  findings.push({
    id: 'liquidity-needs-data',
    area: 'What the code cannot say',
    side: 'demand',
    title: 'Liquidity is not a question a repository can answer',
    severity: 'info',
    confidence: 'verified',
    detail: 'Whether demand finds supply is a ratio of behaviour to behaviour — how many looked, '
      + 'how many found somebody, how many booked. The code shows which of those are possible, '
      + 'never which happen.',
    files: [],
    because: 'A statement about this analysis rather than about the product.',
    next: 'The primitives above are the ceiling; usage data is the only thing that says how much of '
      + 'it is being used. Neither is a substitute for the other.',
    isAbsence: false,
    prompt: null,
  })

  const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2, info: 3 }
  findings.sort((a, b) => rank[a.severity] - rank[b.severity])

  return { findings, primitives, statusVocabularies: { upper, lower } }
}
