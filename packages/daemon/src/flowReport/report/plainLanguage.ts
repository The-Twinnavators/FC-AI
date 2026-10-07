// daemon/src/flow-reports/report/plainLanguage.ts
//
// Saying what a finding means to somebody who does not write code.
//
// ── Why this exists as its own layer ─────────────────────────────────────────
//
// "A service-role key is compared with ordinary string equality" is a precise
// sentence that tells a founder, a lawyer or an investor nothing at all. The
// analysers are right to be precise; precision is what makes a finding
// actionable for the person who will fix it. But a report read only by the
// person who will fix it did not need to be a report.
//
// So the technical statement stays exactly as the analyser wrote it, and this
// adds a second statement beside it. Two registers, both present, neither
// replacing the other.
//
// ── It restates; it never adds ───────────────────────────────────────────────
//
// Nothing here may assert a fact the finding does not already carry. The rules
// below are keyed on what the analyser said and phrase the same claim in
// ordinary words; where no rule fits, the fallback speaks at the level of the
// category and is explicit that it is generic. Inventing a concrete consequence
// to make a paragraph land better would make this the least trustworthy part of
// the document, and a reader has no way to tell which parts were invented.
//
// ── Absence is spoken as absence ─────────────────────────────────────────────
//
// A finding marked `requiresManualValidation` usually rests on something not
// being in the files. The plain reading of that is "we could not see it", not
// "it is not there", and every phrase below keeps that distinction.

import type { Finding, ReportCategory, Severity } from '../types.js'

export interface PlainLanguage {
  /** What was found, in ordinary words. No file paths, no library names. */
  what: string
  /** What it means for the people using the product, or for the business. */
  soWhat: string
  /** What follows if nobody acts. Honest where the answer is "possibly
   *  nothing" — a warning that overstates gets discounted wholesale. */
  ifIgnored: string
}

/** The leading count in titles like "20 file(s) contain…", when there is one. */
const countIn = (title: string): string => {
  const m = title.match(/^(\d[\d,]*)\b/)
  return m ? m[1]! : 'Some'
}

const URGENCY: Record<Severity, string> = {
  critical: 'This needs attention before the product is relied on further.',
  high: 'This is worth fixing soon rather than scheduling.',
  medium: 'This is worth putting on the list, not worth stopping for.',
  low: 'This is a small thing to tidy when the area is next touched.',
  info: 'Nothing needs to happen because of this; it is here so the picture is complete.',
}

interface Rule {
  /** Matched against the finding's title, case-insensitively. */
  match: RegExp
  /** When set, the rule only fires inside this category. */
  category?: ReportCategory
  say: (f: Finding) => PlainLanguage
}

/**
 * Rules keyed on what an analyser said, not on which analyser said it.
 *
 * Phrased against the shape of a finding rather than one product's wording, so
 * a repository that is nothing like the one this was written against still gets
 * sentences that are true of it.
 */
const RULES: Rule[] = [
  // ── The plan ──
  //
  // A rule rather than a fallback, because these findings arrive already
  // written for a reader: the section composes them from the effort, impact and
  // confidence on the findings it points at, in sentences meant to be printed.
  // Sent through the generic path they came out as "This is a finding about the
  // order to take the findings above in" followed by a note explaining that the
  // paragraph was a template — filler wrapped in an apology, over text that
  // needed neither.
  {
    category: 'action_plan',
    match: /^(Immediate|Short-term|Strategic|Exploratory):/i,
    say: (f) => ({
      // Not `f.summary` — the renderer prints that a few lines down as the
      // technical detail, and opening with it would be the same sentence twice.
      what: 'This is a group of things to do, taken from the findings above and put in an '
        + 'order. Each one names the finding it came from, roughly what it would cost, what '
        + 'changing it risks, and how you would know afterwards that it worked.',
      soWhat: f.implication ?? 'These come from the findings above. Nothing here is new work.',
      ifIgnored: /^Exploratory/i.test(f.title)
        ? 'Nothing is lost by leaving these; they are questions rather than work. What is lost '
          + 'is the chance to answer them before somebody builds on the assumption.'
        : 'The report stays a list of things somebody read once. The findings do not expire, '
          + 'but the cheapest moment to act on several of them is before more is built on top.',
    }),
  },
  // ── Error handling and observability ──
  {
    match: /catch blocks? that discard|empty catch|swallow(ed|s)? (the )?error/i,
    say: (f) => ({
      what: 'When something goes wrong inside the product, the code notices the problem '
        + 'and then throws the details away without writing them down anywhere.',
      soWhat: 'If a customer reports that something did not work, there is no record to look '
        + 'at. The team has to reproduce the problem themselves before they can start on it, '
        + 'and problems that only happen occasionally are very hard to catch that way.',
      ifIgnored: 'Faults keep happening and nobody finds out how often. Time that would go '
        + 'into fixing things goes into guessing what broke.',
    }),
  },
  {
    match: /console log|logging (appears|throughout)|structured logging/i,
    say: () => ({
      what: 'The product writes its diagnostic messages to a developer\'s screen rather than '
        + 'to somewhere that keeps them.',
      soWhat: 'Those messages are useful while somebody is sitting watching. Once the product '
        + 'is running for real customers, nobody is watching, and the messages are gone.',
      ifIgnored: 'When a customer hits a problem at two in the morning, there is nothing to '
        + 'read afterwards. Recurring faults look like one-off complaints.',
    }),
  },
  {
    match: /error (capture|reporting|monitoring) is present|crash report/i,
    say: () => ({
      what: 'The product already sends its crashes to a monitoring service.',
      soWhat: 'This is a good sign. It means somebody finds out when the product breaks '
        + 'without waiting for a customer to complain.',
      ifIgnored: 'Nothing is wrong here. It is recorded so the section is not read as a list '
        + 'of failures alone.',
    }),
  },

  // ── Secrets and access ──
  {
    match: /credential|secret|api key|private key|token/i,
    say: (f) => ({
      what: `${countIn(f.title)} file(s) contain text that has the shape of a password, key or `
        + 'access token. Whether any of them is a real, working one cannot be told by reading '
        + 'the files.',
      soWhat: 'A working key in the code is a key anybody with a copy of the code can use. '
        + 'That includes anybody who has ever had access to it, including people who have '
        + 'since left.',
      ifIgnored: 'If even one of these is live, the account it belongs to should be treated '
        + 'as shared with everyone who has seen the code. Each one needs checking, and any '
        + 'that are real need replacing.',
    }),
  },
  {
    // `rls` unbounded matches the "RLs" in "URLs", which is a word that turns
    // up in titles about hardcoded links and would have printed a paragraph
    // about database row policies over them. `row.level` keeps its wildcard
    // deliberately: it spans the hyphen, the space and the underscore.
    match: /row.level security|\brls\b|no policy|policies/i,
    say: () => ({
      what: 'The database has been told to restrict who can see which rows, but the rules '
        + 'saying who may see what are not present in the files that were read.',
      soWhat: 'Restriction switched on with no rules usually means nobody can read anything, '
        + 'which breaks features; the dangerous version is the opposite, where the switch is '
        + 'off and everybody can read everything. Which of the two applies here cannot be '
        + 'told without looking at the live database.',
      ifIgnored: 'Either a feature is quietly broken, or customer data is readable by people '
        + 'who should not see it. Both are worth the few minutes it takes to check.',
    }),
  },
  {
    match: /string equality|timing|constant.time/i,
    say: () => ({
      what: 'A secret is checked by comparing it character by character, and the check stops '
        + 'at the first character that does not match.',
      soWhat: 'In theory somebody could work out the secret one character at a time by '
        + 'measuring how long each attempt takes. Over the public internet this is not a '
        + 'practical attack today.',
      ifIgnored: 'Most likely nothing. It is listed because the fix is small and removes the '
        + 'possibility rather than relying on it staying impractical.',
    }),
  },
  {
    match: /publicly callable|no signature|unauthenticated|without auth/i,
    say: () => ({
      what: 'A part of the system that can act on its own accepts requests from anybody, '
        + 'without first checking who is asking.',
      soWhat: 'Anybody who finds the address can make the product do whatever that part does. '
        + 'If it sends messages, they can send messages; if it changes records, they can '
        + 'change records.',
      ifIgnored: 'This is the kind of thing found by people scanning the internet for it, not '
        + 'by people targeting this product specifically. It does not require anybody to be '
        + 'interested in you first.',
    }),
  },

  // ── Engineering quality ──
  {
    match: /continuous integration|no ci|build pipeline/i,
    say: () => ({
      what: 'Nothing checks the code automatically when somebody changes it.',
      soWhat: 'Every check depends on a person remembering to run it. Mistakes reach '
        + 'customers not because nobody could have caught them, but because nobody happened '
        + 'to look that day.',
      ifIgnored: 'The rate at which broken changes reach customers is set by how careful '
        + 'people are feeling, which gets worse when they are busy — which is when changes '
        + 'are riskiest.',
    }),
  },
  {
    match: /over \d+ lines|file size|very large file/i,
    say: (f) => ({
      what: `${countIn(f.title)} file(s) are long enough that no one person is likely to hold `
        + 'all of what they do in their head at once.',
      soWhat: 'Changes in long files are where unintended side effects come from. It also '
        + 'makes the work slower to hand to somebody new.',
      ifIgnored: 'Nothing breaks today. The cost shows up as changes in these areas taking '
        + 'longer and going wrong more often than changes elsewhere.',
    }),
  },
  {
    match: /write html directly|evaluate strings|innerhtml|eval\(/i,
    say: () => ({
      what: 'Some code builds part of a web page out of text while the product is running, '
        + 'rather than from fixed templates.',
      soWhat: 'If any of that text ever comes from a customer, a customer can put instructions '
        + 'in it and have the product run them in somebody else\'s browser. Whether that is '
        + 'possible here depends on where the text comes from, which reading the code cannot '
        + 'settle.',
      ifIgnored: 'This is the most common way a website gets used to attack its own visitors. '
        + 'It is worth tracing where the text comes from in each case.',
    }),
  },
  {
    match: /^\d+ test files|test (coverage|suite)/i,
    say: (f) => ({
      what: `The project has ${countIn(f.title)} file(s) of automated tests.`,
      soWhat: 'Tests are how a team changes things quickly without breaking what already '
        + 'worked. How much of the product they actually cover cannot be told by counting '
        + 'them.',
      ifIgnored: 'Nothing needs to happen. The count is here as context for the other '
        + 'findings in this section.',
    }),
  },
  {
    match: /no readme|documentation|no docs/i,
    say: () => ({
      what: 'There is no document at the front of the project explaining what it is or how '
        + 'to run it.',
      soWhat: 'Anybody new — a hire, a contractor, an acquirer doing diligence — starts by '
        + 'asking somebody instead of reading. That cost is paid every time.',
      ifIgnored: 'The knowledge stays in the heads of whoever is here now, and leaves when '
        + 'they do.',
    }),
  },

  // ── Money ──
  {
    match: /placeholder|todo|stub|not implemented/i,
    say: (f) => ({
      what: `${countIn(f.title)} place(s) that handle money carry a marker left by a developer `
        + 'saying the work there is not finished.',
      soWhat: 'A marker is not proof that the path is broken — it may be a note about '
        + 'something unrelated. But on a path that moves money, the difference between '
        + '"finished" and "nearly finished" is charges that do not happen or happen twice.',
      ifIgnored: 'Each one needs a person to look and say which it is. That is the only way '
        + 'to tell, and it does not take long.',
    }),
  },
  {
    match: /move money|payment|payout|charge/i,
    category: 'monetization',
    say: (f) => ({
      what: `${countIn(f.title)} place(s) in the code can move real money.`,
      soWhat: 'This is the map of where money enters and leaves the product. It is here so '
        + 'that whoever is responsible for revenue knows which parts of the system they are '
        + 'responsible for.',
      ifIgnored: 'Nothing is wrong. Knowing the list matters when something does go wrong.',
    }),
  },

  // ── The web-facing surface ──
  {
    match: /alt text|accessib/i,
    say: (f) => ({
      what: `${countIn(f.title)} image(s) have no written description attached.`,
      soWhat: 'People using a screen reader get nothing where the image is. Search engines '
        + 'get nothing either, so the images contribute nothing to being found.',
      ifIgnored: 'Some visitors cannot use parts of the product, and in several countries '
        + 'that is a legal exposure as well as a lost customer.',
    }),
  },
  {
    match: /canonical|duplicate content/i,
    say: () => ({
      what: 'The pages do not tell search engines which address is the official one when the '
        + 'same page can be reached more than one way.',
      soWhat: 'Search engines then split the credit for a page between its several addresses, '
        + 'so the page ranks lower than the same content would on one address.',
      ifIgnored: 'Traffic that the content has earned does not arrive. Nothing visibly breaks, '
        + 'which is why this one tends to sit unfixed for years.',
    }),
  },
  {
    match: /open graph|social (preview|card)|link preview/i,
    say: () => ({
      what: 'The pages carry the tags that decide what a link to them looks like when it is '
        + 'shared in a message or a post.',
      soWhat: 'A shared link shows a title, a description and a picture rather than a bare '
        + 'address. Shared links get clicked considerably more often when they do.',
      ifIgnored: 'Nothing needs to happen here.',
    }),
  },
  {
    // Both findings share a title stem, and this asserted the good one for
    // either: "The document language is not declared" was printed under "The
    // pages state which language they are written in." The plain reading said
    // the opposite of the finding it was explaining. Read off the title the way
    // the terms-and-privacy rule below does.
    match: /document language|lang attribute/i,
    say: (f) => (/\bno\b|not |missing|absent/i.test(f.title)
      ? {
        what: 'The pages do not state which language they are written in.',
        soWhat: 'Screen readers use this to choose a voice, and browsers use it to offer '
          + 'translation. Without it a screen reader guesses, and reads the page in the '
          + 'wrong accent or the wrong language entirely.',
        ifIgnored: 'The product stays harder to use for people who rely on a screen reader, '
          + 'for the sake of one attribute.',
      }
      : {
        what: 'The pages state which language they are written in.',
        soWhat: 'Screen readers use this to choose a voice, and browsers use it to offer '
          + 'translation. It is a small correctness detail that is in place.',
        ifIgnored: 'Nothing needs to happen here.',
      }),
  },

  // ── The product itself ──
  {
    match: /nothing in the code does this/i,
    say: () => ({
      what: 'Something a product of this kind normally does could not be found anywhere in '
        + 'the files that were read.',
      soWhat: 'Either it has not been built, or it is handled somewhere these files do not '
        + 'cover — by a person, by a service bought in, or by a part of the system kept '
        + 'elsewhere. Reading the code cannot tell which.',
      ifIgnored: 'If it genuinely is not built, customers will look for it and not find it. '
        + 'Worth a minute to say which of the two it is.',
    }),
  },
  {
    match: /no screen reaches it|not reachable|unreachable/i,
    say: () => ({
      what: 'The machinery for a feature exists, but nothing a customer can click leads to '
        + 'it.',
      soWhat: 'The work is done and nobody is getting the benefit of it. This is usually a '
        + 'missing link or menu entry rather than missing work.',
      ifIgnored: 'Effort already paid for continues to return nothing. Of everything in this '
        + 'report, this is usually the cheapest to turn into value.',
    }),
  },
  {
    match: /two .* vocabular|status .* at once|inconsisten/i,
    say: () => ({
      what: 'Two different sets of words are used for the same set of states, in different '
        + 'parts of the system.',
      soWhat: 'Anything that counts or filters by those states will disagree with anything '
        + 'that uses the other set. Reports come out different depending on where the number '
        + 'was taken from.',
      ifIgnored: 'Numbers that do not reconcile, and a class of bug that is very hard to '
        + 'diagnose because each half of the system is individually correct.',
    }),
  },

  // ── Obligations ──
  {
    match: /licence|license/i,
    say: () => ({
      what: 'No document saying who may use this code, and on what terms, was found.',
      soWhat: 'By default nobody has permission to use it but the owner. That matters when '
        + 'a contractor, an investor or an acquirer asks what they are actually getting.',
      ifIgnored: 'It surfaces during diligence, when it is urgent and somebody else sets the '
        + 'timetable.',
    }),
  },
  {
    // Scoped, because the claim is a compliance one — that the renewal terms
    // are not shown before somebody agrees — and `subscription` alone matched
    // monetization findings that only counted subscription routes. An inventory
    // of endpoints cannot support a statement about what a signup screen
    // displays, and printed under one it reads as though it did.
    category: 'compliance',
    match: /renewal terms|subscription|auto.renew/i,
    say: () => ({
      what: 'The product charges people again on a schedule. Nothing in the code shows the '
        + 'terms of that being put in front of them before they agree.',
      soWhat: 'In several jurisdictions the terms have to be shown at the moment of signing '
        + 'up, and a charge made without that can be reversed. It may well be shown in copy '
        + 'held outside these files.',
      ifIgnored: 'Chargebacks and complaints, and in the worst case a regulator asking to see '
        + 'the signup screen as it was on a given date.',
    }),
  },
  {
    match: /consent|opt.in|unsubscribe/i,
    say: () => ({
      what: 'The product sends messages to people. Where they agreed to receive them is not '
        + 'visible in the code.',
      soWhat: 'Permission to message somebody has to be recorded, and they have to be able to '
        + 'stop it. The record may exist in a system these files do not cover.',
      ifIgnored: 'Fines are calculated per message in several countries, which makes this one '
        + 'of the few items here that scales with how well the product is doing.',
    }),
  },
  {
    match: /data export|account deletion|right to erasure|delete .* account/i,
    say: () => ({
      what: 'No way for a person to get a copy of their data, or to have it deleted, was '
        + 'found in the code.',
      soWhat: 'Where people have a legal right to both, it can be handled by hand at small '
        + 'scale — but it has to be handled, and somebody has to know that they are the one '
        + 'handling it.',
      ifIgnored: 'The first request arrives with a legal deadline attached, and the work to '
        + 'answer it starts then.',
    }),
  },
  {
    match: /terms of service|privacy (notice|policy)/i,
    say: (f) => ({
      what: /no |not found|absent/i.test(f.title)
        ? 'No terms or privacy document was found in the product.'
        : 'A terms or privacy document is present in the product.',
      soWhat: 'These are what a customer is agreeing to, and what a regulator asks for first. '
        + 'A document held only on a marketing site is not the same as one the product shows.',
      ifIgnored: 'Without one, there is no agreed answer to what the product may do with '
        + 'customer data — including for the business itself.',
    }),
  },
  {
    // ── Bounded, and confined to the section it belongs to ──
    //
    // This was `/age|date of birth|minor/i`, unscoped, and it matched the "age"
    // inside "pages". A monetization finding titled "19 monetization
    // endpoint(s) and page(s)", whose evidence was a list of invoice and
    // checkout routes, was printed under "The signup asks for an age or a date
    // of birth" — a claim about children's data attached to a billing
    // inventory, at high confidence, with nothing in the evidence supporting
    // it. "minor" had the same fault from the other direction: it is an
    // ordinary word for "small", so any finding calling something minor
    // acquired a COPPA paragraph.
    //
    // Two changes, and the second is the one that matters. The boundaries stop
    // this regex matching inside a longer word. The category stops any future
    // sloppiness here reaching a finding from another section at all — this
    // sentence is only ever true of the compliance analyser's age-gate finding,
    // so it has no business being reachable from anywhere else.
    category: 'compliance',
    match: /\bages?\b|\bdate of birth\b|\bdob\b|\bminors\b/i,
    say: () => ({
      what: 'The signup asks for an age or a date of birth.',
      soWhat: 'Collecting it brings obligations about children\'s data that do not apply to '
        + 'products that never ask. Whether that is intended is a decision, not a defect.',
      ifIgnored: 'Worth confirming the reason it is collected, and that it is not kept longer '
        + 'than that reason requires.',
    }),
  },
  {
    match: /cancellation|as easy as/i,
    say: () => ({
      what: 'A way to cancel exists. Whether it is as easy to cancel as it was to sign up '
        + 'cannot be judged from the code.',
      soWhat: 'Several jurisdictions now require the two to take a comparable number of '
        + 'steps. This is a question for whoever can click through both.',
      ifIgnored: 'It is a cheap thing to confirm and an expensive thing to be told about by '
        + 'a regulator.',
    }),
  },
]

/**
 * The generic reading, when no rule matched.
 *
 * Deliberately speaks about the kind of question the section asks rather than
 * about this finding's specifics, because the specifics are exactly what is not
 * known here. Vague and true beats specific and invented.
 */
const CATEGORY_FALLBACK: Record<ReportCategory, { area: string; stake: string }> = {
  action_plan: {
    area: 'the order to take the findings above in, and what each one would cost to act on',
    stake: 'whether the report turns into work, or stays a list of things somebody read once',
  },
  cross_domain: {
    area: 'what several of the readings above add up to when they are put together, rather '
      + 'than read one at a time',
    stake: 'whether a pattern spread across the product gets noticed, when each piece of it '
      + 'looks minor on its own',
  },
  data_architecture: {
    area: 'the shape of the information the product stores, and how its pieces point at '
      + 'one another',
    stake: 'whether the data stays consistent as the product grows, and whether a record '
      + 'can still be found when there is a lot of it',
  },
  marketing_opportunity: {
    area: 'what the product can already do to reach people, and what it would need before it '
      + 'could tell whether any of it works',
    stake: 'whether growth is something that can be measured and improved on purpose, or only '
      + 'guessed at',
  },
  error_log: {
    area: 'how the product behaves when something goes wrong, and what gets written down '
      + 'when it does',
    stake: 'whether a problem a customer hits can be understood afterwards',
  },
  product_intel: {
    area: 'what this product appears to be for, judged from how it is built',
    stake: 'whether the thing being built matches the thing being described',
  },
  engineering_quality: {
    area: 'how the code is organised, tested and checked',
    stake: 'how quickly and safely the product can be changed from here',
  },
  monetization: {
    area: 'where money enters and leaves the product',
    stake: 'whether revenue is collected, and collected once',
  },
  seo: {
    area: 'how the product appears to search engines and when a link to it is shared',
    stake: 'whether people who are looking for this can find it',
  },
  marketplace_health: {
    area: 'whether both sides of a marketplace can actually do what they came to do',
    stake: 'whether the product works for the people it has to work for',
  },
  role_journeys: {
    area: 'whether each kind of user has a complete path through the product',
    stake: 'whether somebody gets stuck partway and leaves',
  },
  accessibility: {
    area: 'whether somebody using a keyboard or a screen reader can work the product',
    stake: 'whether a person who cannot use a mouse, or cannot see the screen, is shut out',
  },
  competitive_gaps: {
    area: 'capabilities that products of this kind commonly have',
    stake: 'where this product differs from what a customer will expect',
  },
  compliance: {
    area: 'obligations the product takes on by doing what it does',
    stake: 'whether an obligation is being met, and can be shown to have been met',
  },
  security_qa: {
    area: 'whether the product can be made to do something it should not',
    stake: 'whether customer data and customer money stay where they belong',
  },
}

/**
 * The plain reading of a finding.
 *
 * Always returns something. A finding printed without one would look like the
 * one the report chose not to explain, and a reader would reasonably wonder
 * why.
 */
export function describePlainly(f: Finding): PlainLanguage {
  for (const rule of RULES) {
    if (rule.category && rule.category !== f.category) continue
    if (rule.match.test(f.title)) {
      const said = rule.say(f)
      // The urgency line is read off severity, which the action plan sets to
      // informational on purpose so its groups are not counted a second time
      // in the run's totals. Appending it there printed "nothing needs to
      // happen because of this" directly beneath "start here".
      if (f.category === 'action_plan') return said
      return { ...said, ifIgnored: `${said.ifIgnored} ${URGENCY[f.severity]}` }
    }
  }

  const fb = CATEGORY_FALLBACK[f.category]
  const uncertain = f.requiresManualValidation
    ? ' It rests on something not being visible in the files, which is not the same as it '
      + 'not existing.'
    : ''

  return {
    what: `This is a finding about ${fb.area}.${uncertain} The precise statement is the one `
      + 'above; no shorter version of it was available.',
    soWhat: `What is at stake in this section is ${fb.stake}.`,
    ifIgnored: URGENCY[f.severity],
  }
}

/** Whether the plain reading is the generic one, so a renderer can label it
 *  rather than presenting a template as though it were written for this
 *  finding. */
export function isGenericReading(f: Finding): boolean {
  return !RULES.some((r) => (!r.category || r.category === f.category) && r.match.test(f.title))
}

/**
 * The ordered steps for acting on a finding.
 *
 * ── Built from what the finding holds, not from a template ───────────────────
 *
 * A recommendation is a sentence describing the destination. "What to do" is
 * the route: which files to open, what to change, how to know it worked. Each
 * step below is assembled from a field the finding already carries, so nothing
 * here can instruct somebody to do something the analysis did not support.
 *
 * ── The first step is always to check ────────────────────────────────────────
 *
 * Every one of these findings comes from reading files. None of them was
 * confirmed against a running system, and several are absences — "we could not
 * see it" rather than "it is not there". A list of actions that opens with
 * "change the code" would quietly convert a reading into a fact. So the first
 * step is to look, and it says what looking would settle.
 */
export function actionSteps(f: Finding): string[] {
  const steps: string[] = []
  const paths = [...new Set(f.evidence.map((e) => e.path).filter(Boolean))] as string[]

  if (f.requiresManualValidation || paths.length === 0) {
    steps.push('**Confirm it first.** This rests on something not being visible in the files '
      + 'that were read, which is not the same as it not existing. Check whether it is '
      + 'handled somewhere outside this repository — by a service, by a document, or by a '
      + 'person — before changing anything.')
  } else if (paths.length === 1) {
    steps.push(`**Open \`${paths[0]}\`** and confirm the finding still describes what is there. `
      + 'The analysis read a copy of the files; the working tree may have moved since.')
  } else {
    steps.push(`**Open the ${paths.length} files listed above** and confirm the finding still `
      + 'describes what is there. The analysis read a copy; the working tree may have moved '
      + 'since.')
  }

  steps.push(`**Make the change.** ${f.recommendation}`)

  if (paths.length > 1) {
    steps.push('**Apply it everywhere it applies.** Each location above is a separate '
      + 'instance; fixing one leaves the rest. Search for the same pattern elsewhere before '
      + 'closing this off.')
  }

  // Severity decides who needs to know, which is a real part of what to do and
  // is otherwise left for the reader to infer.
  if (f.severity === 'critical' || f.severity === 'high') {
    steps.push('**Tell whoever owns this area** before the change ships, and record the date '
      + 'it went out. At this severity the question afterwards is usually "how long was this '
      + 'true for", and that is only answerable if somebody wrote it down.')
  }

  steps.push(f.claudeCodePrompts.length > 0
    ? '**Verify.** Re-run this report and confirm the finding is gone. If it is still here, '
      + 'the change did not reach every location — not that the report is stale.'
    : '**Verify.** Re-run this report and confirm the finding is gone, or that it has moved '
      + 'to a lower severity.')

  return steps
}
