// daemon/src/flow-reports/analyzers/actionPlan.ts
//
// What to do first, and how you would know it worked.
//
// ── This adds no claims ──────────────────────────────────────────────────────
//
// Every action here is a finding that already exists, placed in an order. The
// plan introduces no work nobody measured, and where it says something will
// change it says so in the finding's own words. A plan that invents a task is
// worse than no plan: the report's authority comes from being traceable, and
// one untraceable line spends all of it.
//
// ── Four horizons, decided by evidence rather than by taste ──────────────────
//
// The methodology asks for immediate, short-term, strategic and exploratory.
// The placement is computed from what the finding model already carries —
// effort, impact and confidence — so two readers of the same report get the
// same plan, and a reader who disagrees can see exactly which number to argue
// with.
//
// ── Thin evidence is not scheduled ───────────────────────────────────────────
//
// A finding under 0.6 confidence goes to exploratory whatever its impact,
// because the first piece of work is establishing whether it is true. Putting
// a hypothesis in "immediate" beside a measured defect is how a plan loses the
// distinction between the two, and the distinction is the point.

import type { Effort, Finding, ReportSectionResult } from '../types.js'
import { classifyFinding } from './classify.js'

const CATEGORY = 'action_plan' as const

export type Horizon = 'immediate' | 'short_term' | 'strategic' | 'exploratory'

export const HORIZON_LABEL: Record<Horizon, string> = {
  immediate: 'Immediate',
  short_term: 'Short-term',
  strategic: 'Strategic',
  exploratory: 'Exploratory',
}

const HORIZON_MEANING: Record<Horizon, string> = {
  immediate: 'Cheap, and worth doing now.',
  // Deliberately two clauses. Some of these are known to be more than an
  // afternoon; the rest are here because nothing established what they cost,
  // and a bucket that only said "larger than an afternoon" would assert that
  // of findings nobody sized.
  short_term: 'Worth doing next: either more than an afternoon, or of a size nothing here '
    + 'established.',
  strategic: 'Substantial work, or a change to how something is built.',
  exploratory: 'Not yet work. Something has to be established before it is.',
}

export interface Action {
  id: string
  horizon: Horizon
  /** What would be done, in the finding's own words. */
  objective: string
  /** The findings this came from. An action with none should not exist. */
  from: Finding[]
  /** Repository paths the constituent findings cite. */
  affected: string[]
  /** Action ids that should come first. Empty where nothing establishes an
   *  order, which is most of the time and is stated rather than guessed. */
  dependsOn: string[]
  /** Null where nothing established a size. Not the same as "small". */
  complexity: Effort | null
  risk: 'low' | 'medium' | 'high'
  /** How to tell it worked. */
  validation: string
  /** Why it sits in this horizon, in the numbers that put it there. */
  because: string
}

/** Findings that are about measurement rather than about a thing to change.
 *  Deliberately narrow: this drives ordering, and a false positive here would
 *  make a real piece of work wait behind something unrelated. */
const MEASUREMENT = /\bno (event|analytics|telemetry)\b|nothing (records|counts|measures)|is unmeasured|no .* records that/i

/** Nothing here is scheduled below this. The first task is finding out whether
 *  the finding is true. */
const SPECULATIVE = 0.6

function horizonOf(f: Finding): { horizon: Horizon; because: string } {
  // Confidence and impact are filled by `classifyFinding`, which `planFrom`
  // runs first; the `??` there is the type system's, not a judgement. Effort
  // is genuinely absent on findings nothing could size, and is handled as
  // absent rather than defaulted — a default here would be a second scale
  // disagreeing with the one on the finding.
  const conf = f.confidenceScore ?? 0.5
  const impact = f.dimensions?.impact ?? 5
  const effort = f.effort

  if (conf < SPECULATIVE) {
    return {
      horizon: 'exploratory',
      because: `Confidence ${conf.toFixed(2)}. Below ${SPECULATIVE} the first piece of work is `
        + 'establishing whether this holds, not acting on it.',
    }
  }
  if (f.type === 'opportunity' && f.requiresManualValidation) {
    return {
      horizon: 'exploratory',
      because: 'An opportunity the repository cannot settle. What it needs first is the '
        + 'question answered, which is not an engineering task.',
    }
  }
  // Placed on value alone, and said so. Calling it cheap or calling it large
  // would both be inventions; what is actually known is that it is worth doing.
  if (!effort) {
    return {
      horizon: 'short_term',
      because: `Impact ${impact}. What this would cost was not established — nothing it cites `
        + 'would say — so it is placed on value alone. Size it before scheduling it.',
    }
  }
  if (effort === 'low' && impact >= 6) {
    return {
      horizon: 'immediate',
      because: `Low effort against impact ${impact}. Cheap enough that deferring it costs more `
        + 'in tracking than in doing.',
    }
  }
  if (effort === 'high') {
    return {
      horizon: 'strategic',
      because: `Effort is high${impact >= 6 ? ` and impact ${impact}` : ''}. This is a change to `
        + 'how something is built rather than a correction to it.',
    }
  }
  return {
    horizon: 'short_term',
    because: `Effort ${effort}, impact ${impact}. Worth doing and larger than an afternoon.`,
  }
}

/**
 * How to tell the work landed.
 *
 * The same answer for almost everything, and that is the point: this report is
 * reproducible, so the honest test of a fix is that re-running it no longer
 * produces the finding. It is checkable by the person doing the work, on the
 * day they do it, without anybody's opinion.
 */
function validationFor(f: Finding): string {
  // The same anchor the action is filed under, so the sentence does not name a
  // different file from the one printed beside it. Some analysers put
  // `path:line  the matching source line` in the path, which is useful in a
  // citation list and unreadable mid-sentence; the file is the part needed here.
  const cite = anchorsFor(f)[0]?.split(':')[0]
  switch (f.type) {
    case 'gap':
      return `Re-run this report. "${f.title}" should no longer appear, because the capability `
        + 'it reports missing now exists in the code.'
    case 'opportunity':
      return 'Not verifiable by re-running this report — an opportunity taken is not an absence '
        + 'closed. Decide the measure before starting, because afterwards is too late to '
        + 'establish what it was before.'
    default:
      return `Re-run this report. "${f.title}" should no longer appear`
        + (cite ? `, and ${cite} should no longer match what it was measured on.` : '.')
  }
}

const RISK_OF = (f: Finding): Action['risk'] => {
  const r = f.dimensions?.risk
  if (typeof r === 'number') return r >= 7 ? 'high' : r >= 4 ? 'medium' : 'low'
  // Unknown, so inferred from what changing it touches. A change across many
  // files carries more chance of disturbing something than one across two.
  const files = new Set(f.evidence.map((e) => e.path).filter(Boolean)).size
  return files > 8 ? 'high' : files > 2 ? 'medium' : 'low'
}

/**
 * Findings, as work.
 *
 * Informational findings are left out entirely. An observation asks for
 * nothing, and a plan that lists "151 test files" as an action is one nobody
 * reads to the end.
 */
export function planFrom(sections: ReportSectionResult[]): Action[] {
  const findings = sections
    .flatMap((s) => s.findings)
    // ── Classified here rather than trusted ──
    //
    // The pipeline classifies each section as it finishes, so a fresh run
    // arrives with type, effort and dimensions already set and this changes
    // nothing — `classifyFinding` fills only what is unset. A run persisted
    // before those fields existed arrives without them, and inventing local
    // defaults for it ("no score recorded" read as "low confidence") would put
    // an entire old report in Exploratory and call that a judgement. One scale,
    // derived in one place, is what makes the placement arguable.
    .map(classifyFinding)
    .filter((f) => f.type !== 'observation' && f.severity !== 'info')

  const actions: Action[] = findings.map((f) => {
    const { horizon, because } = horizonOf(f)
    return {
      id: `ACT-${f.category}-${f.id}`,
      horizon,
      objective: f.recommendation,
      from: [f],
      affected: anchorsFor(f),
      dependsOn: [],
      complexity: f.effort ?? null,
      risk: RISK_OF(f),
      validation: validationFor(f),
      because,
    }
  })

  // ── Ordering, only where something establishes it ──
  //
  // One rule, because it is the only one the findings actually support: a
  // change to something nobody measures cannot be judged, so within a section
  // the measurement comes first. Everything else has an empty list rather than
  // an invented order.
  for (const a of actions) {
    const f = a.from[0]!
    if (MEASUREMENT.test(f.title)) continue
    const prerequisite = actions.find((other) => {
      const o = other.from[0]!
      return o.category === f.category && other.id !== a.id && MEASUREMENT.test(o.title)
    })
    if (prerequisite) a.dependsOn = [prerequisite.id]
  }

  const ORDER: Horizon[] = ['immediate', 'short_term', 'strategic', 'exploratory']
  const sorted = actions.sort((a, b) => {
    const h = ORDER.indexOf(a.horizon) - ORDER.indexOf(b.horizon)
    if (h !== 0) return h
    // Within a horizon, by impact. Stable, so two findings of equal impact keep
    // the order their sections produced them in and the report is reproducible.
    return (b.from[0]!.dimensions?.impact ?? 0) - (a.from[0]!.dimensions?.impact ?? 0)
  })

  // ── A prerequisite is printed before the thing that waits on it ──
  //
  // Impact alone would sometimes list "do X — comes after Y" above Y, which
  // reads as a contradiction of the line beside it. Depth here is one: a
  // measurement finding never depends on anything, so a single pass settles it.
  // Only within a horizon — a prerequisite in a later horizon stays where it is
  // rather than being promoted, because that is exactly what it says.
  const placed = new Set<string>()
  const out: Action[] = []
  for (const a of sorted) {
    if (placed.has(a.id)) continue
    for (const id of a.dependsOn) {
      const pre = sorted.find((p) => p.id === id)
      if (pre && pre.horizon === a.horizon && !placed.has(pre.id)) {
        out.push(pre)
        placed.add(pre.id)
      }
    }
    out.push(a)
    placed.add(a.id)
  }
  return out
}

/** Files a reader would open to do the work, rather than files the finding
 *  happened to touch. A documentation or build file makes a poor anchor: the
 *  renderer prints the first one beside the action, and "docs/OPEN-ITEMS.md"
 *  next to "a provider cannot be reached from any screen" sends somebody to a
 *  file where there is nothing to do. Code first, everything else after —
 *  nothing is dropped, only ordered. */
const NOT_CODE = /(^|\/)(docs?|documentation|scripts?|\.github)\//i
const isProse = (p: string) => /\.(md|mdx|txt|rst)$/i.test(p)

function anchorsFor(f: Finding): string[] {
  const paths = [...new Set(f.evidence.map((e) => e.path).filter(Boolean) as string[])]
  const code = paths.filter((p) => !NOT_CODE.test(p) && !isProse(p))
  return [...code, ...paths.filter((p) => !code.includes(p))].slice(0, 8)
}

/** The sections a group draws on, in the order the report presents them. */
const sectionsOf = (actions: Action[]): string[] =>
  [...new Set(actions.map((a) => a.from[0]!.category))]

const unsizedIn = (actions: Action[]): number =>
  actions.filter((a) => a.complexity === null).length

/** The gravest thing in the group, named rather than carried as severity. */
function worstOf(actions: Action[]): Finding['severity'] {
  const order = ['info', 'low', 'medium', 'high', 'critical'] as const
  return actions.reduce<Finding['severity']>(
    (w, a) => (order.indexOf(a.from[0]!.severity) > order.indexOf(w) ? a.from[0]!.severity : w),
    'info',
  )
}

function horizonFinding(horizon: Horizon, actions: Action[]): Finding {
  const worst = worstOf(actions)
  const lowest = Math.min(...actions.map((a) => a.from[0]!.confidenceScore ?? 0.5))

  return {
    id: `PLAN-${horizon.toUpperCase()}`,
    category: CATEGORY,
    title: `${HORIZON_LABEL[horizon]}: ${actions.length} action${actions.length === 1 ? '' : 's'}`,
    summary: `${HORIZON_MEANING[horizon]} The gravest of these is ${worst}.`,
    // ── Informational, and deliberately so ──
    //
    // The run summary counts findings by severity to say how much is wrong.
    // Every action here is a finding that was already counted where it lives,
    // so carrying its severity up would add the same problem to that total
    // twice — a report that reads worse after it explains what to do about
    // itself. The severity belongs to the finding; this heading names it in
    // the summary instead of claiming it.
    severity: 'info',
    confidence: lowest >= 0.8 ? 'high' : lowest >= 0.6 ? 'medium' : 'low',
    confidenceScore: lowest,
    // ── A second statement, not the first one again ──
    //
    // The renderer prints `summary` and then `impact` beneath it, and suppresses
    // the second only when the two match exactly. Repeating the heading with a
    // clause bolted on cleared that guard and read as two findings agreeing.
    // Where the group came from is something the summary does not say.
    impact: `Drawn from ${sectionsOf(actions).length} section`
      + `${sectionsOf(actions).length === 1 ? '' : 's'}: ${sectionsOf(actions).join(', ')}.`
      + (unsizedIn(actions) > 0
        ? ` ${unsizedIn(actions)} of these carr${unsizedIn(actions) === 1 ? 'ies' : 'y'} no `
          + 'size estimate and should be sized before being scheduled.'
        : ''),
    // An observation for the same reason the severity is info: the heading
    // observes that these actions fall together. What each one is — defect,
    // gap, opportunity — is recorded on the finding it came from, and saying
    // it again here would be a second, coarser answer to a settled question.
    type: 'observation',
    status: 'open',
    implication: horizon === 'exploratory'
      ? 'Nothing in this group is scheduled work yet. Each one needs something established '
        + 'before it can be estimated.'
      : 'Each of these comes from a finding above. Nothing here is new work.',
    recommendation: horizon === 'immediate'
      ? 'Start here. These are the cheapest things with the largest effect.'
      : 'Read alongside the findings they come from; each action names its own.',
    rationale: 'Placed by effort, impact and confidence, all of which are on the findings '
      + 'themselves. Nothing was judged here that was not already measured.',
    evidence: actions.map((a) => ({
      kind: 'static_analysis' as const,
      path: a.affected[0],
      // ── The title leads ──
      //
      // Several analysers give every instance of a check the same
      // recommendation, so opening with it printed "Confirm whether a screen
      // already uses it" four times in a row, with the only thing telling them
      // apart at the far end of the line. The title names which one this is.
      description: `${a.from[0]!.title} → ${a.objective} `
        + `— from ${a.from[0]!.category}/${a.from[0]!.id}. `
        + `${a.complexity ? `${a.complexity} effort` : 'effort not established'}, `
        + `${a.risk} risk. ${a.because} `
        + (a.dependsOn.length > 0 ? `Comes after ${a.dependsOn.join(', ')}. ` : '')
        + `How to tell it worked: ${a.validation}`,
    })),
    // The prompts are on the findings. Repeating them here would put the same
    // change in front of a reader twice with two descriptions of it.
    claudeCodePrompts: [],
  }
}

/**
 * The plan.
 *
 * One finding per horizon rather than one per action: forty actions as forty
 * findings is the report again, not a plan. The horizon is the unit a reader
 * decides with, and every action inside it is named in the evidence with what
 * it came from and how it would be checked.
 */
export function buildActionPlan(sections: ReportSectionResult[]): ReportSectionResult {
  // Everything except this section, so a re-run cannot plan its own plan.
  const source = sections.filter((s) => s.category !== CATEGORY)
  const actions = planFrom(source)

  if (actions.length === 0) {
    return {
      category: CATEGORY,
      status: 'not_applicable',
      score: null,
      summary: 'No finding in this report asks for work.',
      reason: 'A plan is built from findings that are not observations. This report produced '
        + 'none, which says the sections found nothing to act on rather than that there is '
        + 'nothing to do.',
      findings: [],
      limitations: [],
    }
  }

  const byHorizon: Horizon[] = ['immediate', 'short_term', 'strategic', 'exploratory']
  const findings = byHorizon
    .map((h) => ({ h, group: actions.filter((a) => a.horizon === h) }))
    .filter(({ group }) => group.length > 0)
    .map(({ h, group }) => horizonFinding(h, group))

  const counts = byHorizon
    .map((h) => ({ h, n: actions.filter((a) => a.horizon === h).length }))
    .filter(({ n }) => n > 0)
    .map(({ h, n }) => `${n} ${HORIZON_LABEL[h].toLowerCase()}`)

  return {
    category: CATEGORY,
    status: 'completed',
    // Unscored: every action is a finding that is already scored where it
    // lives, and a plan is a view of them rather than a further judgement.
    score: null,
    summary: `${actions.length} actions — ${counts.join(', ')}.`,
    findings,
    limitations: [
      'Nothing here is new. Every action is a finding from a section above, placed by the '
      + 'effort, impact and confidence already recorded on it.',
      'Ordering is stated only where the findings support it: within a section, a change to '
      + 'something nobody measures comes after the measurement. Everywhere else the order is '
      + 'left to the reader rather than invented.',
      'Effort and impact are judgements carried from the findings, not estimates of hours. A '
      + 'plan built on them is a starting point for planning, not a schedule.',
      'An action reading "effort not established" is one nothing here could size: the files it '
      + 'cites measure what exists rather than what building the rest would take. Those are '
      + 'placed on value alone, and should be sized before they are scheduled.',
      'A finding below 0.6 confidence is exploratory whatever its impact, because the first '
      + 'piece of work is establishing whether it is true.',
    ],
  }
}
