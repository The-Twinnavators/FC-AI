// daemon/src/flow-reports/analyzers/applicability.ts
//
// Whether a question applies to this repository at all.
//
// ── The failure this exists to stop ──────────────────────────────────────────
//
// Several of these analysers were written for one product — a marketplace where
// providers deliver services to customers — and reused here against whatever
// folder somebody picks. Asked of a project that is not a marketplace, they
// answer anyway: a digital book produced fourteen marketplace findings, and a
// static site was told that "providers are paid for work arranged by the
// platform". Those are not wrong measurements, they are claims about a product
// that does not exist.
//
// A report that says the same thing about every repository is worse than no
// report, because a reader has no way to tell which parts were measured.
//
// ── A gate that passes on one match is not a gate ────────────────────────────
//
// The first version asked whether ANY marketplace primitive was found. The
// primitives include patterns as common as `/\/search\b/` and `/\/profile\b/`,
// so a project with a search route was assessed as a marketplace. Evidence has
// to be structural: several primitives, on several sides of the model, and both
// of the two sides a marketplace is defined by.

export type Side = 'supply' | 'demand' | 'matching' | 'transaction' | 'repeat'

export interface PrimitiveState {
  id: string
  side: Side
  name: string
  inApi: boolean
  hasRoute: boolean | null
}

export interface Applicability {
  applies: boolean
  /** Written to be printed. When it does not apply, this is what the section
   *  says instead of findings. */
  reason: string
  /** What was actually found, so a reader can disagree with the judgement. */
  evidence: string[]
}

/**
 * What it takes to call something a marketplace.
 *
 * Both sides, because a marketplace is defined by having two of them: supply
 * that can be described and demand that can find it. Three distinct sides,
 * because supply and demand alone with no matching, transaction or return is a
 * directory rather than a marketplace. Four primitives, because two or three
 * generic route patterns match in most codebases and the threshold has to sit
 * above the noise.
 *
 * Deliberately conservative. A marketplace wrongly marked not-applicable loses
 * a section and says why; a non-marketplace wrongly assessed gets a page of
 * invented findings, and nothing on it says so.
 */
const MIN_PRIMITIVES = 4
const MIN_SIDES = 3

export function marketplaceApplicability(primitives: PrimitiveState[]): Applicability {
  const present = primitives.filter((p) => p.inApi || p.hasRoute === true)
  const sides = new Set(present.map((p) => p.side))
  const hasBothSides = sides.has('supply') && sides.has('demand')

  const applies = present.length >= MIN_PRIMITIVES && hasBothSides && sides.size >= MIN_SIDES

  const evidence = present.map((p) => `${p.name} (${p.side})`)

  if (applies) {
    return {
      applies: true,
      reason: `${present.length} marketplace primitives were found across ${sides.size} sides of `
        + 'the model, including both supply and demand.',
      evidence,
    }
  }

  // Say which test failed. "Not applicable" with no reason is the same
  // ambiguity the whole report is built to remove.
  const missing: string[] = []
  if (present.length < MIN_PRIMITIVES) {
    missing.push(`only ${present.length} of the ${primitives.length} marketplace primitives were `
      + `found, below the ${MIN_PRIMITIVES} this needs to be confident`)
  }
  if (!hasBothSides) {
    const absent = ['supply', 'demand'].filter((s) => !sides.has(s as Side))
    missing.push(`nothing was found on the ${absent.join(' or ')} side, and a marketplace is `
      + 'defined by having both')
  } else if (sides.size < MIN_SIDES) {
    missing.push(`evidence appeared on only ${sides.size} sides of the model, which describes a `
      + 'directory rather than a marketplace')
  }

  return {
    applies: false,
    reason: 'This does not appear to be a marketplace, so it was not assessed as one: '
      + `${missing.join('; ')}. Findings were not manufactured for a model this project does `
      + 'not have.'
      + (evidence.length > 0
        ? ` What did match: ${evidence.join(', ')} — not enough to support the reading.`
        : ''),
    evidence,
  }
}
