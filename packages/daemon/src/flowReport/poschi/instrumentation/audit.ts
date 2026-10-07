// daemon/src/integrations/poschi/instrumentation/audit.ts
//
// Which of the events we asked for actually exist in the source.
//
// ── What this can and cannot establish ───────────────────────────────────────
//
// This is the whole design. Reading source tells you a name appears somewhere
// and in what shape. It does not tell you the event fires, because firing
// depends on the branch being reached, the helper being wired to a backend, and
// the call not sitting behind a flag that is off.
//
// So nothing here says "emitted". The strongest thing it says is that the name
// appears as the argument of something that looks like an emitter, which is
// evidence and is labelled as evidence. A report that turned "grep found it"
// into "this is tracked" would send somebody to build a funnel on a stage that
// records nothing — and a funnel with a silent stage is worse than no funnel,
// because everyone lost there is counted against the step before.
//
// ── And absence is the weaker claim, not the stronger one ────────────────────
//
// Not finding a name proves less than finding one. It can be built by
// concatenation, live in a file this did not read, or sit in a package this
// cannot see. So a not-found result is only ever reported as not found, with
// the number of files actually scanned printed beside it — and when the scan
// was partial, every absence is marked inconclusive rather than reported as a
// gap somebody should go and fix.

import {
  EXPECTED_FUNNELS, EMITTERS, VENDOR_MARKERS, EXPECTED_ENTITIES,
  type ExpectedEvent,
} from './contract.js'

export interface SourceFile {
  path: string
  text: string
}

/** What kind of appearance this is. Ordered strongest first. */
export type Evidence =
  /** The name is the argument of something that looks like an emitter. */
  | 'call'
  /** The name is a value in what looks like a constant or enum. Declared, but
   *  nothing here shows it being used. */
  | 'declared'
  /** The name appears, in a comment or a string this could not place. */
  | 'mentioned'
  /** Only in a test or a fixture. A test asserting an event exists is not the
   *  product emitting it, and counting it would make a well-tested absence look
   *  like a presence. */
  | 'test_only'
  /** Not found in anything that was scanned. */
  | 'absent'

export interface EventFinding {
  /** Null where the request asked for no event, because the step does not
   *  exist to fire one. */
  event: string | null
  stage: string
  evidence: Evidence
  /** Where it was seen, at most a handful. */
  sites: Array<{ path: string; line: number }>
  /** Set when the stage cannot be emitted because the feature does not exist. */
  blockedBy?: string
}

export interface FunnelFinding {
  resource: string
  name: string
  events: EventFinding[]
  /** Stages with `call` or `declared` evidence. */
  measurable: number
  /** Stages with nothing, excluding ones blocked on a missing feature — those
   *  are a different problem and are counted separately. */
  blind: number
  blockedOnFeature: number
  /** The sentence the report prints. Written here so the wording and the
   *  arithmetic cannot drift apart. */
  reading: string
}

export interface AuditResult {
  funnels: FunnelFinding[]
  /** Emitter helpers found in the source, by name. Empty means nothing here
   *  looked like analytics plumbing at all. */
  emitters: string[]
  /** Third-party analytics found, which the request asked them not to add. */
  vendors: string[]
  entities: Array<{ name: string; found: boolean; why: string }>
  filesScanned: number
  /** Source files the repository has, when known. Absences are only
   *  conclusive when this equals `filesScanned`. */
  filesTotal: number | null
  /** True when the scan covered everything it knows about. */
  complete: boolean
  /** The paragraph a reader needs before any of the above means anything. */
  caveat: string
}

const TEST_PATH = /(^|\/)(__tests__|__mocks__|test|tests|e2e|cypress|fixtures?)\/|\.(test|spec|stories|fixture)\./i

/** `track('x')`, `analytics.capture("x")`, `logEvent(`x`)`. */
function callPattern(event: string): RegExp {
  const names = EMITTERS.map((e) => e.replace(/\./g, '\\.')).join('|')
  return new RegExp(`(?:${names})\\s*\\(\\s*['"\`]${event}['"\`]`)
}

/** `PROVIDER_SIGNUP_STARTED = 'provider_signup_started'` or `{ x: "event" }`. */
function declaredPattern(event: string): RegExp {
  return new RegExp(`[:=]\\s*['"\`]${event}['"\`]`)
}

function scanFor(event: string, files: SourceFile[]) {
  const sites: Array<{ path: string; line: number; kind: Evidence }> = []
  const call = callPattern(event)
  const declared = declaredPattern(event)
  const bare = new RegExp(`\\b${event}\\b`)

  for (const f of files) {
    if (!bare.test(f.text)) continue
    const isTest = TEST_PATH.test(f.path)
    const lines = f.text.split('\n')
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]!
      if (!bare.test(line)) continue
      const kind: Evidence = isTest
        ? 'test_only'
        : call.test(line) ? 'call' : declared.test(line) ? 'declared' : 'mentioned'
      sites.push({ path: f.path, line: i + 1, kind })
    }
  }
  return sites
}

const RANK: Record<Evidence, number> = {
  call: 0, declared: 1, mentioned: 2, test_only: 3, absent: 4,
}

function findEvent(expected: ExpectedEvent, files: SourceFile[]): EventFinding {
  // Nothing to look for. Searching for a name the request never asked for
  // would report an absence that is not a gap.
  if (expected.event === null) {
    return {
      event: null,
      stage: expected.stage,
      evidence: 'absent',
      sites: [],
      ...(expected.blockedBy ? { blockedBy: expected.blockedBy } : {}),
    }
  }

  const sites = scanFor(expected.event, files)
  const evidence: Evidence = sites.length === 0
    ? 'absent'
    : sites.map((s) => s.kind).sort((a, b) => RANK[a] - RANK[b])[0]!

  return {
    event: expected.event,
    stage: expected.stage,
    evidence,
    // The strongest sites first, because that is the one a reader wants to open.
    sites: sites
      .sort((a, b) => RANK[a.kind] - RANK[b.kind])
      .slice(0, 4)
      .map(({ path, line }) => ({ path, line })),
    ...(expected.blockedBy ? { blockedBy: expected.blockedBy } : {}),
  }
}

/** Counted as measurable only where something looked like a call or a
 *  declaration. A mention in a comment is not instrumentation. */
const MEASURABLE: Evidence[] = ['call', 'declared']

function readingFor(f: Omit<FunnelFinding, 'reading'>): string {
  const total = f.events.length
  if (f.measurable === 0) {
    return `Nothing in the source emits any of the ${total} stages of ${f.name.toLowerCase()}. `
      + 'No part of this funnel can be measured, so any figure reported for it came from '
      + 'somewhere other than these events.'
  }
  if (f.measurable === total) {
    return `All ${total} stages of ${f.name.toLowerCase()} have an event in the source.`
  }

  const blind = f.events.filter((e) => !MEASURABLE.includes(e.evidence) && !e.blockedBy)
  const blocked = f.events.filter((e) => !MEASURABLE.includes(e.evidence) && e.blockedBy)

  const parts = [`${f.measurable} of ${total} stages of ${f.name.toLowerCase()} have an event.`]
  if (blind.length) {
    parts.push(
      `Nobody can see ${blind.map((e) => `"${e.stage}"`).join(', ')} — nothing emits there, so anyone `
      + 'lost at that step is counted against the last stage that does emit.',
    )
  }
  if (blocked.length) {
    parts.push(
      `${blocked.map((e) => `"${e.stage}"`).join(', ')} cannot be instrumented at all: `
      + `${blocked.map((e) => e.blockedBy).join('; ')}. That is a missing feature rather than `
      + 'missing tracking, and asking for the event would be asking for something impossible.',
    )
  }
  return parts.join(' ')
}

/**
 * The audit.
 *
 * Pure over the files it is handed, so the scanning rules can be tested without
 * a repository and so a partial fetch is the caller's problem to declare rather
 * than something this quietly absorbs.
 */
export function auditInstrumentation(
  files: SourceFile[],
  opts: { filesTotal?: number | null } = {},
): AuditResult {
  const filesTotal = opts.filesTotal ?? null
  const complete = filesTotal !== null && filesTotal <= files.length

  const funnels: FunnelFinding[] = EXPECTED_FUNNELS.map((f) => {
    const events = f.events.map((e) => findEvent(e, files))
    const measurable = events.filter((e) => MEASURABLE.includes(e.evidence)).length
    const blockedOnFeature = events.filter(
      (e) => e.blockedBy && !MEASURABLE.includes(e.evidence),
    ).length
    const base = {
      resource: f.resource,
      name: f.name,
      events,
      measurable,
      blind: events.length - measurable - blockedOnFeature,
      blockedOnFeature,
    }
    return { ...base, reading: readingFor(base) }
  })

  const all = files.map((f) => f.text).join('\n')
  const emitters = EMITTERS.filter(
    (e) => new RegExp(`\\b${e.replace(/\./g, '\\.')}\\s*\\(`).test(all),
  )
  const vendors = VENDOR_MARKERS.filter((v) => all.toLowerCase().includes(v.toLowerCase()))
  const entities = EXPECTED_ENTITIES.map((e) => ({
    name: e.name,
    why: e.why,
    found: e.patterns.some((p) => p.test(all)),
  }))

  return {
    funnels,
    emitters,
    vendors,
    entities,
    filesScanned: files.length,
    filesTotal,
    complete,
    caveat: complete
      ? 'Every source file in the repository was scanned. Finding a name still only shows that it '
        + 'appears in the source: whether the event fires depends on the branch being reached and the '
        + 'helper being wired to a backend, neither of which can be read from a file.'
      : `Only ${files.length}${filesTotal ? ` of ${filesTotal}` : ''} source files were scanned, so `
        + 'every absence below is inconclusive. A name not found here may be built by concatenation, '
        + 'live in a file that was not read, or come from a package. Treat "not found" as "not seen", '
        + 'not as "not there".',
  }
}
