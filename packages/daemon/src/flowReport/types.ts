import type { Comprehension } from './comprehend/understand.js'
import type { TailoredText } from './comprehend/rewrite.js'
// daemon/src/flow-reports/types.ts
//
// The normalized shape every Flow Reports section is reduced to.
//
// ── Why a new model rather than the analysers' own ───────────────────────────
//
// The existing Poschi analysers each grew their own finding shape, and they
// disagree in two places that matter: severity has no `critical` band, and
// confidence is spelled `verified | indicated | hypothesis` rather than
// `high | medium | low`. Both spellings are defensible; what is not defensible
// is a report that renders two of them side by side and asks the reader to hold
// the mapping in their head.
//
// So this is the model the report is written against, and a normalizer maps
// each analyser's output into it. The analysers are left alone — they are under
// test and in use by the Poschi pages.
//
// ── Absence is a value here, not a gap ───────────────────────────────────────
//
// `score` is `number | null` and `null` means "not enough evidence to score".
// It is not zero. A section that could not be assessed and a section that was
// assessed and scored nothing are different facts, and every type in this file
// keeps them apart.

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type Confidence = 'high' | 'medium' | 'low'
/** Ordered so the list and the type cannot drift; the type is read off it. */
// `noted` is a response on record with nothing settled: a finding somebody has
// written about and not closed. It exists because saveResolution excludes
// 'open' — reopening deletes the row — so without it there was no way to attach
// an account to a finding that is still open, and a third of a typical response
// document says exactly that. It is not in CLOSED_STATUSES, so it closes
// nothing and the scoring code needed no change to accommodate it.
export const FINDING_STATUSES =
  ['open', 'noted', 'accepted_risk', 'resolved', 'not_applicable'] as const
export type FindingStatus = (typeof FINDING_STATUSES)[number]

/** The statuses that mean the finding is no longer counted as damage. */
export const CLOSED_STATUSES: readonly FindingStatus[] = ['resolved', 'not_applicable']

/**
 * A decision somebody recorded about a finding, and why.
 *
 * ── The reason is the record ─────────────────────────────────────────────────
 *
 * A resolution with no reason is indistinguishable from a mis-click, and it
 * survives into scans run months later where nobody remembers either way. So
 * the reason is required, and a resolution without one does not close anything:
 * the finding stays active and asks to be looked at. That rule is enforced in
 * `isClosedBy` below rather than in the route, so every reader applies it —
 * a row that somehow lacks a reason cannot quietly suppress a finding.
 *
 * ── It outlives the run it was made in ───────────────────────────────────────
 *
 * Kept against the project rather than the run, so a rescan of the same
 * repository finds it. What it is matched on is the analyser's own finding id
 * within its section, which survives a finding's wording changing — a count
 * going from 58 files to 61 is the same finding with a new number.
 *
 * `titleWhenResolved` is kept so that change can still be seen. A resolution
 * whose finding now reads differently stays in force but is marked, because the
 * evidence moving under a reason is exactly when somebody should reread it.
 */
export interface FindingResolution {
  /** Never `open`: an open finding has no resolution record. */
  status: Exclude<FindingStatus, 'open'>
  /** Why it was closed. Never empty — see `isClosedBy`. */
  reason: string
  /** The finding's title when the reason was written. */
  titleWhenResolved: string
  resolvedAt: string
  /** Null on a single-user installation, which has nobody to attribute it to. */
  resolvedBy: string | null
  lastEditedAt: string | null
  lastEditedBy: string | null
  /** Set on the way out when the finding's title has moved since the reason was
   *  written. Derived, never stored. */
  titleChanged?: boolean
}

/**
 * One account of what was done about a finding.
 *
 * A finding has many, ordered oldest first: they read as a history, and the
 * first thing said is what the rest answers.
 */
export interface FindingResponse {
  id: string
  body: string
  /** Typed by hand, or read out of a document somebody uploaded. The two are
   *  not the same kind of claim, and an edit never turns one into the other. */
  source: 'typed' | 'imported'
  /** The file it came from, when it was imported. Null when it was typed. */
  sourceName: string | null
  createdAt: string
  createdBy: string | null
  editedAt: string | null
  editedBy: string | null
}

/**
 * Whether a resolution actually closes a finding.
 *
 * One place, because the score, the counts, the exports and the page all have
 * to agree about it. A resolution with nothing said for it is not a resolution
 * — it is an unfinished one — and the finding it names stays active.
 *
 * That rule used to read "the reason is not blank". It now reads "at least one
 * response exists", which is the same rule counted rather than measured by the
 * length of a string, now that a finding holds many accounts rather than one.
 */
export function isClosedBy(
  r: FindingResolution | null | undefined,
  responseCount: number,
): boolean {
  return Boolean(r && responseCount > 0 && CLOSED_STATUSES.includes(r.status))
}

/**
 * A finding's identity inside one run.
 *
 * The title rather than `id`, because the title is what the system already
 * treats as identity: `collate` de-duplicates on category and lower-cased
 * title, so two findings that share one cannot both survive into a report. An
 * `id` is only unique within the analyser that wrote it, and two analysers can
 * and do use the same short name.
 *
 * Used to hang a person's decision — resolved, not applicable — on a finding
 * without rewriting the stored analysis. Keeping the key derivable from the
 * finding means nothing has to be migrated into the findings themselves.
 */
export function findingKey(f: { title: string }): string {
  return f.title.trim().toLowerCase()
}

/** The sections a run covers. Ordered as the report presents them. */
export const REPORT_CATEGORIES = [
  'error_log',
  'product_intel',
  'engineering_quality',
  'monetization',
  'seo',
  'marketplace_health',
  'role_journeys',
  'accessibility',
  'competitive_gaps',
  'compliance',
  'security_qa',
  'marketing_opportunity',
  'data_architecture',
  'cross_domain',
  'action_plan',
] as const

export type ReportCategory = (typeof REPORT_CATEGORIES)[number]

export const CATEGORY_LABEL: Record<ReportCategory, string> = {
  marketing_opportunity: 'Marketing opportunity scan',
  data_architecture: 'Data architecture',
  cross_domain: 'Cross-domain synthesis',
  action_plan: 'Action plan',
  error_log: 'Error log & reports',
  product_intel: 'Product intel',
  engineering_quality: 'Engineering quality',
  monetization: 'Monetization',
  seo: 'SEO & link previews',
  marketplace_health: 'Marketplace health',
  role_journeys: 'Role journeys',
  accessibility: 'Accessibility',
  competitive_gaps: 'Competitive gaps',
  compliance: 'Compliance',
  security_qa: 'Security QA',
}

/**
 * What each section examines, and what it does not.
 *
 * ── Why a section has to define itself ───────────────────────────────────────
 *
 * A heading like "Security QA" with two findings under it reads as a verdict on
 * the product's security. It is not: nothing is executed, no request is made to
 * any host, and the deployed configuration is not visible at all. A reader who
 * does not know that takes two findings as "almost nothing wrong", which is the
 * opposite of what the section can support.
 *
 * So both halves are stated wherever a section is introduced. `excludes` is the
 * more important of the two — it is the sentence that stops a reader drawing a
 * conclusion the evidence cannot carry, and it is the thing nobody thinks to
 * write down.
 */
export interface CategoryScope {
  /** What is read, and what is looked for in it. */
  covers: string
  /** What this section cannot see, written so an absence here is never mistaken
   *  for a clean result. */
  excludes: string
}

export const CATEGORY_SCOPE: Record<ReportCategory, CategoryScope> = {
  error_log: {
    covers: 'How this product behaves when something goes wrong: catch blocks that discard the '
      + 'error they caught, error-reporting and logging integrations, error boundaries, console '
      + 'logging left in the source, network calls with no failure path, timers and listeners '
      + 'that are never torn down, and input accepted with no validation.',
    excludes: 'Whether any of it actually fails. Nothing here is run, so this reports how the '
      + 'code is prepared for failure, never how often failure happens or what it costs.',
  },
  product_intel: {
    covers: 'What the product is and who it is for, read from its README, its manifest and its '
      + 'router — and whether anything measures use, through product analytics or a way for '
      + 'somebody to report a problem.',
    excludes: 'Anything about demand, value or whether people want it. Those are questions for '
      + 'discovery and a repository cannot answer them.',
  },
  engineering_quality: {
    covers: 'The shape of the codebase: whether tests and continuous integration exist, files '
      + 'that have grown outsized, code that writes HTML or evaluates strings directly, '
      + 'credential-shaped strings, dependency counts, undocumented environment variables, '
      + 'TypeScript strictness and the wildcard "any", and colours written literally instead of '
      + 'through a theme.',
    excludes: 'Whether the build succeeds and whether the tests pass. This analysis executes '
      + 'nothing, so it can report that tests exist and never that they are green.',
  },
  monetization: {
    covers: 'Where revenue comes from and where more could: the checkout and collection surfaces '
      + 'that exist, placeholder amounts, webhooks, and revenue totalled from records no payment '
      + 'created — alongside opportunities grounded in what is already built, such as an audience '
      + 'nobody charges or a per-use cost nobody meters.',
    // "payment provider" here, and the vocabulary guard caught it: on a product
    // whose own users are called providers the phrase means something else
    // entirely, and this text is printed in every report.
    excludes: 'Pricing, plans, fees and terms configured in the dashboard of a payment processor '
      + 'rather than in code. This section is also not scored and does not count towards the '
      + 'overall figure, because an opportunity is not damage.',
  },
  marketing_opportunity: {
    covers: 'What the product can already do about its own distribution: sharing surfaces, invite '
      + 'and referral paths, an account holder\'s own way to promote themselves, return visits and '
      + 'reactivation, campaigns, attribution, growth events, marketing consent, and whether '
      + 'anything can be varied to test it. Each capability is reported as present, partly '
      + 'present, absent or not checkable, with the files that decided it.',
    // Every noun here is deliberately generic. This text prints in every
    // report, and the vocabulary guard exists because one product's words —
    // "booking", "provider" — read as nonsense in a report about another.
    excludes: 'Whether any of it works. Nothing here observes a user, so this establishes that a '
      + 'mechanism exists and never that it produces traffic, signups, orders or revenue — every '
      + 'expected effect is written as a hypothesis. It also excludes the metadata itself, which '
      + 'the SEO section measures, and pricing, which Monetization covers; this section reads both '
      + 'rather than restating either. Campaign sends, opens and clicks live in an email service '
      + 'and are not read.',
  },
  cross_domain: {
    covers: 'What several sections add up to that none of them says alone. Each theme names '
      + 'the findings it is built from, in which section, and fires only when every one of '
      + 'them is present.',
    excludes: 'Anything measured here, because nothing is. A theme cites findings other '
      + 'sections established and says what they mean together; it introduces no claim of its '
      + 'own, is never more confident than the weakest finding it rests on, and is never more '
      + 'severe than the worst. If one of those findings is wrong, the theme is wrong in the '
      + 'same way. A relationship this section does not report is one whose required findings '
      + 'were not all present, which is not the same as the relationship being absent.',
  },
  action_plan: {
    covers: 'The findings above, as work: what to do first, what it would cost, what it risks, '
      + 'and how you would know it worked. Each action names the finding it came from, and is '
      + 'placed by the effort, impact and confidence already recorded on that finding.',
    excludes: 'Any work nobody found. This section invents no task, estimates no hours, and '
      + 'makes no claim a section above did not already make — it is an ordering of the report, '
      + 'not an addition to it. It also excludes observations, which ask for nothing. A finding '
      + 'below 0.6 confidence is placed in Exploratory whatever its impact, because the first '
      + 'piece of work is establishing whether it is true. Ordering between actions is stated '
      + 'only where the findings support it and is otherwise left to the reader.',
  },
  data_architecture: {
    covers: 'The shape of the data, read from the migrations that built it: the tables, their '
      + 'columns, what references what, which of those references carry an index and which say '
      + 'what happens when the parent row is deleted, which tables have no primary key, which '
      + 'are never named anywhere in the application code, and which columns hold personal or '
      + 'credential-shaped data.',
    excludes: 'Row-level security and policies, which Security QA covers, and consent, retention '
      + 'and data rights, which Compliance covers — so the absence of a finding here says '
      + 'nothing about either. Also excluded: views, functions and triggers, which are not '
      + 'parsed, so a table reached only through one of those looks unused. Migrations are read '
      + 'cumulatively, meaning a column dropped or renamed by a later one still appears. Nothing '
      + 'was executed and no database was connected to, so this is the schema as the migrations '
      + 'describe it rather than as any deployed database actually stands.',
  },
  seo: {
    covers: 'How this product appears to a search engine, to a social card and to an AI '
      + 'assistant: titles and descriptions, Open Graph tags, the canonical link, robots.txt, '
      + 'sitemap.xml, llms.txt, structured data, a web app manifest, icons, the document '
      + 'language, and alt text on images.',
    excludes: 'Rankings, traffic and anything about the deployed site. This reads the source of '
      + 'the pages, not the pages as served.',
  },
  marketplace_health: {
    covers: 'Whether the primitives a two-sided product needs are present: that supply can '
      + 'describe itself and say when it is available, that demand can find and choose it, that '
      + 'a match is recorded, that a transaction completes and its outcome is kept, and that '
      + 'there is a reason to come back.',
    excludes: 'Everything, where the product is not two-sided. The section then says so and '
      + 'assesses nothing, rather than manufacturing findings for a model this product does not '
      + 'have.',
  },
  role_journeys: {
    covers: 'The path each audience takes through the product, from arriving to leaving — read '
      + 'from the roles that the guards in the router name — and whether one person can hold two '
      + 'of those roles at once rather than needing a second account.',
    excludes: 'Permissions checked inside a component rather than at the route, which this cannot '
      + 'see, and anything about how the journeys actually feel to walk.',
  },
  accessibility: {
    covers: 'What the markup says about whether somebody using a keyboard or a screen reader can '
      + 'work the product: elements that respond to a click without being reachable by keyboard, '
      + 'controls with no name to announce, fields with no label, focus outlines that were '
      + 'removed, dialogs that do not declare themselves, and status that changes with nothing to '
      + 'announce it.',
    excludes: 'Everything that needs the page drawn to decide. Contrast ratios, whether focus '
      + 'actually moves into a dialog and is held there, whether it returns afterwards, reflow at '
      + '400% zoom, and the real size of a tap target are all measurements of a rendered page, '
      + 'and this reads files. They are listed as unverified rather than guessed at.',
  },
  competitive_gaps: {
    covers: 'Capabilities that products of this kind commonly have and this one does not — the '
      + 'ability to export your own work, to share something by link, or to drive the product '
      + 'from the keyboard.',
    excludes: 'Any named competitor. Nothing is compared against a specific product, no external '
      + 'research is performed, and no claim is made about what anybody else has built.',
  },
  compliance: {
    covers: 'Obligations that the shape of this code triggers: a privacy notice and terms, access '
      + 'and deletion rights, minors, consent for email and text messages, subscription renewal '
      + 'and cancellation, payment handling, tracking consent, and disclosure where input is sent '
      + 'to an external model.',
    excludes: 'Legal advice, and any judgement about whether a written policy matches actual '
      + 'practice — which is the usual cause of enforcement and is not visible in code.',
  },
  security_qa: {
    covers: 'A static read of the source for privileged operations with no check on the caller, '
      + 'secrets compared unsafely, tables with row-level security enabled and no policy, '
      + 'credential-shaped strings in tracked files, authentication endpoints with no rate limit, '
      + 'source maps in the production build, and missing security response headers.',
    excludes: 'Everything about the running system. No request was made to any host, no exploit '
      + 'was attempted and no endpoint was tested, so nothing here establishes how the deployed '
      + 'product behaves. Cloud permissions, database policies as deployed, and CDN or firewall '
      + 'configuration are not in the repository and were not assessed.',
  },
}

export type EvidenceKind =
  | 'file' | 'config' | 'dependency' | 'metadata'
  | 'static_analysis' | 'user_input' | 'external_research'

export interface Evidence {
  kind: EvidenceKind
  /** Repository-relative only. An absolute path in a report is both a privacy
   *  leak and useless to anybody reading it on another machine. */
  path?: string
  lineStart?: number
  lineEnd?: number
  /** Already redacted by the time it reaches here. */
  excerpt?: string
  description: string
}

export interface ClaudeCodePrompt {
  title: string
  prompt: string
  intendedOutcome: string
  affectedPaths?: string[]
}

/**
 * What kind of thing a finding is.
 *
 * ── Why this is not severity ─────────────────────────────────────────────────
 *
 * Severity answers "how much would this hurt". It is the wrong question for
 * half of what these analysers produce. A revenue stream the product could add
 * is not a low-severity problem; a capability that may be missing is not a
 * defect until somebody decides it should exist. Forcing both onto the severity
 * ramp made every section read as a list of things that are wrong, and a reader
 * scanning for real damage had to discount most of the page to find it.
 *
 *   defect       Something is broken or incorrect.
 *   risk         Nothing is broken yet; the shape of the code invites it.
 *   gap          A capability is absent. Whether it should exist is a decision.
 *   opportunity  Something could be built or earned from what is already here.
 *   observation  True, worth knowing, and asks for nothing.
 */
/**
 * A recommendation somebody can build from.
 *
 * ── Why a shape rather than a paragraph ──────────────────────────────────────
 *
 * "Add an error boundary" is a direction, not a piece of work. What a reader
 * needs before they can start is what triggers the behaviour, what the change
 * must contain, what the user sees, and what would be wrong to do — and those
 * are different questions, so they are different fields. A single block of
 * prose lets a model answer two of them and imply the rest.
 *
 * Every section except `intent` and `requirements` is optional, because they
 * do not all apply. A missing index on a foreign key has no user-facing copy
 * and no flow, and inventing them to fill the shape is how a template starts
 * producing filler.
 *
 * ── It is a proposal, and says so ────────────────────────────────────────────
 *
 * Nothing here is measured. The finding is the measurement; this is what might
 * be done about it, written by a model that read the finding. It must not
 * assert anything new about the repository — that the product already does
 * something, or that a file exists — because no part of it was checked.
 */
export interface Brief {
  /** What should happen, when, and what it is for. Two or three sentences. */
  intent: string
  /** What the change has to include, concretely enough to check off. */
  requirements: string[]
  /** The sequence, where the change has one. */
  flow?: {
    title: string
    steps: string[]
    /** The label on the action a user would take, where there is one. */
    cta?: string
  }
  /** Draft user-facing text, where the change has any. Placeholders are in
   *  square brackets so nobody ships them by accident. */
  copy?: {
    title: string
    /** When this text appears. Decided before the words, because a model not
     *  asked for it writes an announcement of the feature instead of the
     *  message somebody receives when the feature acts on them. */
    moment?: string
    lines: string[]
  }
  /** Constraints, edge cases, and the things it would be wrong to do. */
  considerations: string[]
}

export type FindingType = 'defect' | 'risk' | 'gap' | 'opportunity' | 'observation'

/** Rough cost to act. Deliberately three bands: a repository cannot support a
 *  day estimate, and a number nobody can defend invites planning around it. */
export type Effort = 'low' | 'medium' | 'high'

/**
 * The dimensions a reader can sort by, instead of one number that pretends to
 * know which business decision is right.
 *
 * Every field is optional and absent means unknown, never zero. An analyser
 * that has no basis for a dimension leaves it out, and the UI shows it as
 * unrated rather than as the bottom of the scale.
 */
export interface PriorityDimensions {
  /** 1–10. How much it would matter if acted on, or if ignored. */
  impact?: number
  /** 1–10. Higher is more work. Paired with `Finding.effort`, which is the
   *  banded form the report prints. */
  effort?: number
  /** 1–10. The chance that acting on this breaks something else. */
  risk?: number
  /** 1–10. What it is worth to the people using the product. */
  userValue?: number
  /** 1–10. How much else becomes easier once this is done. */
  technicalLeverage?: number
  /** 1–10. Only meaningful where security is actually implicated. */
  securityImportance?: number
  /** 1–10. Only meaningful where revenue is actually implicated. */
  revenueRelevance?: number
}

/**
 * Evidence strength, 0 to 1.
 *
 * ── Why both this and the word ───────────────────────────────────────────────
 *
 * `Finding.confidence` is a three-value word and it is what the report prints,
 * because "high" is what a reader wants in a sentence and 0.86 is not. This is
 * what a filter and a sort need, and three buckets cannot order forty findings.
 *
 * They are kept from contradicting each other by construction: `bandOf` derives
 * the word from the number, and the normaliser sets both together. Neither is
 * authored independently.
 *
 *   0.95–1.00  very high    the code says so directly
 *   0.80–0.94  high         strong evidence, one reasonable alternative reading
 *   0.60–0.79  moderate     consistent with the evidence, not established by it
 *   0.40–0.59  low          plausible, thinly supported
 *   below 0.40 speculative  a hypothesis worth recording, not a claim
 */
export type ConfidenceScore = number

/** The word for a score, so the two forms can never disagree. */
export function bandOf(score: ConfidenceScore): Confidence {
  if (score >= 0.8) return 'high'
  if (score >= 0.6) return 'medium'
  return 'low'
}

/** A representative score for a word, where only the word is known. Returns the
 *  middle of the band rather than its edge: an inherited value should not sort
 *  above one somebody actually measured. */
export function scoreOfBand(band: Confidence): ConfidenceScore {
  return band === 'high' ? 0.87 : band === 'medium' ? 0.7 : 0.5
}

export interface Finding {
  id: string
  category: ReportCategory
  title: string
  summary: string
  severity: Severity
  confidence: Confidence
  status: FindingStatus
  /** The decision recorded against this finding, if there is one. Laid on when
   *  a run is read; never part of what an analyser produces. */
  resolution?: FindingResolution
  /** Every account of what was done about it, oldest first. Laid on with the
   *  resolution, and empty when nobody has written anything yet. */
  responses?: FindingResponse[]
  impact: string
  recommendation: string
  rationale: string
  evidence: Evidence[]
  claudeCodePrompts: ClaudeCodePrompt[]
  limitations?: string[]

  // ── The methodology fields ────────────────────────────────────────────────
  //
  // All optional, and added rather than substituted. Eleven analysers, four
  // renderers and a page already read the fields above; replacing any of them
  // would have meant changing everything at once to find out whether the model
  // was right. These are filled in by the normaliser for every existing
  // analyser, so nothing had to be rewritten to gain them.

  /** What kind of thing this is. Absent on findings predating the field, which
   *  is why every reader treats absence as "unclassified" rather than as a
   *  defect. */
  type?: FindingType
  /** Rough cost to act on it. */
  effort?: Effort
  /** What follows from the finding being true — the step between the
   *  measurement and the recommendation, which the catalogue prose used to
   *  fold into `impact` and which a reader needs separately to disagree with. */
  implication?: string
  /** What could be built or earned. Set on opportunities, absent on defects:
   *  a defect has a fix, not an opportunity, and giving it one invites the
   *  report to sell work that is simply repair. */
  opportunity?: string
  /** Evidence strength as a number, for sorting and filtering. Kept in step
   *  with `confidence` by construction — see `bandOf`. */
  confidenceScore?: ConfidenceScore
  /** The dimensions a reader can rank by. Absent fields are unknown, not zero. */
  dimensions?: PriorityDimensions
  /** True when the finding rests on something static analysis cannot settle,
   *  so the report can label it rather than letting a reader assume it was
   *  confirmed. */
  requiresManualValidation?: boolean
  /**
   * True when the claim is computed from a complete parse rather than from the
   * files it cites, which are illustrations of it.
   *
   * ── What this is for ─────────────────────────────────────────────────────
   *
   * Most findings are a list of matches, and reading three of them can refute
   * the list: this report's adjudicator exists because six files said
   * "subscription" and every one was the word UNsubscribe in a mailing list.
   *
   * A computed finding does not work that way. "24 foreign keys have no index"
   * comes from parsing all 514 migrations and comparing two complete sets; its
   * citations are twelve examples of a fact established elsewhere. Shown three
   * of them, a model reports that the excerpts are incomplete and withdraws a
   * true finding — which is what happened to this one.
   *
   * Only the analyser knows which kind it produced, so only the analyser sets
   * this. Absent means the ordinary kind.
   */
  computedFromFullParse?: boolean
  /** The recommendation as something buildable. Absent where none was written
   *  — a budget ran out, the model was unreachable, or what came back named
   *  nothing real. */
  brief?: Brief
  /**
   * The same finding, written for this product by the local model.
   *
   * Prose only. It cannot change the severity, the evidence or the claim —
   * the analyser's own statement is still carried in `summary` and is printed
   * beside the rewrite, so a reader can see what was measured next to what
   * was said about it. Absent when the setting is off, when no model was
   * reachable, or when what came back did not validate.
   */
  tailored?: TailoredText

  /**
   * Where in the code this finding actually is.
   *
   * The file comes from the scan and the claim from the analyser; only the
   * identifier comes from the model, and it is kept only when it occurs in that
   * file as a whole word. So a reader following this lands on a real name in a
   * real file rather than on a plausible-sounding one.
   *
   * Absent for most findings, and that is ordinary: an absence has nothing to
   * point at, a measurement has no single location, and a model that could not
   * find the right name returns nothing rather than guessing.
   */
  located?: {
    file: string
    identifier: string
    /** Up to ten words narrowing it further. May be empty. */
    where: string
  }
}

export type SectionStatus =
  | 'pending' | 'preparing' | 'in_progress' | 'completed'
  | 'completed_with_warnings' | 'skipped' | 'not_applicable' | 'failed'

export interface ReportSectionResult {
  category: ReportCategory
  status: SectionStatus
  /** null means the evidence did not support a score. Never coerce to 0. */
  score: number | null
  summary: string
  findings: Finding[]
  limitations: string[]
  /** Set when status is `skipped`, `not_applicable` or `failed`. The report
   *  prints it rather than leaving a blank section that reads as "all clear". */
  reason?: string
  startedAt?: string
  completedAt?: string
}

export type RunStatus =
  | 'queued' | 'preparing' | 'scanning' | 'analyzing' | 'generating'
  | 'completed' | 'completed_with_warnings' | 'failed' | 'cancelled'

export interface AnalysisWarning {
  stage: string
  message: string
  category?: ReportCategory
}

export interface AnalysisError {
  stage: string
  message: string
  category?: ReportCategory
}

export interface ReportSummary {
  /** null when too few sections produced a score to mean anything. */
  overallScore: number | null
  /** Why the score is what it is, in words. A number without this is an
   *  opaque judgement, which is the thing this feature is not. */
  scoreExplanation: string
  narrative: string
  priorities: string[]
  quickWins: string[]
  longerTerm: string[]
  /** What the run could not establish. Always present, even when empty. */
  couldNotVerify: string[]
  severityCounts: Record<Severity, number>
  filesScanned: number
  filesSkipped: number
  /**
   * What a person has closed by hand in this report, and what it did to the
   * number.
   *
   * ── Kept beside the score rather than folded into it ─────────────────────
   *
   * A score improved by somebody ticking a box is not the same fact as a score
   * improved by a second scan, and a report that presented them identically
   * would be the least trustworthy thing in this feature. So `overallScore`
   * moves — that is the point of the button — and the figure it was measured
   * at is kept here beside it, with the count that explains the difference.
   *
   * `scoreExplanation` is never rewritten: it describes the run as analysed,
   * and this is printed next to it.
   *
   * Absent when nothing has been marked, so an untouched report carries no
   * trace of a feature it did not use.
   */
  resolved?: {
    /** How many findings are marked resolved or not applicable. */
    count: number
    /** The overall score as the run measured it, before any of that. */
    scoreAsMeasured: number | null
  }
}

export interface AnalysisSettings {
  depth: 'quick' | 'standard' | 'deep'
  includeTests: boolean
  /**
   * Read documentation as source. Off by default.
   *
   * ── Why the default changed ─────────────────────────────────────────────────
   *
   * The analysers match patterns over whatever files they are handed, and a
   * Markdown file is mostly prose that quotes code. Run against a repository
   * that keeps its reports in `docs/`, the monetization analyser reported "49
   * money path(s) carry a placeholder marker" and cited lines like
   *
   *   docs/NEW-poschi-flowagent-report.md:1103 - 'src/…/ExceptionRadar.tsx:163
   *   placeholder="e.g. known, price ids land with the new processor account"'
   *
   * which is not a money path. It is a sentence in a report, containing the
   * words "placeholder" and "price" — and the report it came from was one of
   * FlowAgent's own, so the tool was reading its findings back in as evidence
   * for themselves and compounding the count on every run.
   *
   * Prose about code is not code. Documentation can still be read by turning
   * this on, and when it is off the exclusion is named in the report's
   * methodology like every other skip, so nothing is dropped silently.
   */
  includeDocs: boolean
  includeDependencyManifests: boolean
  excludeGenerated: boolean
  customIgnore: string[]
  /** Off by default. When on, the UI must disclose what leaves the machine. */
  networkResearch: boolean
  /**
   * Rewrite each finding for THIS product using the local model.
   *
   * On by default: without it the findings are a fixed catalogue, so the same
   * sentences appear whatever repository was analysed, and the report cannot
   * say anything about your product that somebody did not anticipate.
   *
   * The cost is time — roughly one model call per section, which takes a run
   * from about twenty seconds to about two minutes. Turn it off for a quick
   * re-run when only the measurements have changed.
   */
  tailoredWriting: boolean
}

export const DEFAULT_SETTINGS: AnalysisSettings = {
  depth: 'standard',
  includeTests: true,
  includeDocs: false,
  includeDependencyManifests: true,
  excludeGenerated: true,
  customIgnore: [],
  networkResearch: false,
  tailoredWriting: true,
}

export interface ReportArtifact {
  /**
   * `markdown` and `pdf` are the whole report. `pdf:security_qa` and the like
   * are the same report for one section only, written because nobody fixing
   * one area wants to carry the other nine.
   */
  format: 'markdown' | 'pdf' | `markdown:${ReportCategory}` | `pdf:${ReportCategory}`
  filename: string
  /** Relative to the Flow Reports artifact directory, never an absolute path,
   *  so the value is meaningless to anything outside the daemon. */
  storageReference: string
  bytes: number
  sha256: string
  createdAt: string
}

export interface FlowReportProject {
  id: string
  name: string
  repositoryDisplayName: string
  /** Local only. Never serialised into a report, and not returned by the list
   *  API unless a caller explicitly asks for diagnostics. */
  repositoryPath: string
  settings: AnalysisSettings
  latestRunId: string | null
  createdAt: string
  updatedAt: string
}

export interface FlowReportRun {
  id: string
  projectId: string
  status: RunStatus
  /** 0..1. Derived from completed work, never from a timer. */
  progress: number
  currentStage: string | null
  startedAt: string | null
  completedAt: string | null
  durationMs: number | null
  analysisVersion: string
  summary: ReportSummary | null
  /** What the product IS, read from the repository before anything was
   *  measured. Null when no local model was reachable — the measurements are
   *  unaffected and the report says which part is missing. */
  comprehension: Comprehension | null
  sections: ReportSectionResult[]
  warnings: AnalysisWarning[]
  errors: AnalysisError[]
  artifacts: ReportArtifact[]
  createdAt: string
  updatedAt: string
}

export interface RunEvent {
  id: number
  runId: string
  level: 'info' | 'warn' | 'error'
  stage: string | null
  message: string
  createdAt: string
}

/** Bumped when a change would make two runs incomparable. Printed on every
 *  report so an old one can be read in the light of what produced it. */
export const ANALYSIS_VERSION = '1.0.0'
