// daemon/src/flow-reports/analyzers/competitive.ts
//
// Capability gaps, measured against what products of this kind usually have.
//
// ── Why the Poschi version could not be reused ───────────────────────────────
//
// Poschi's competitive analyser holds a catalogue of styling-marketplace
// competitors and the features they offer. That is exactly right for Poschi and
// meaningless for a repository somebody just pointed at. So this infers the
// kind of product from the manifest and the tree, then checks for capabilities
// that products of that kind generally have.
//
// ── What this section is not allowed to say ──────────────────────────────────
//
// With network research off — the default, and currently the only implemented
// behaviour — nothing here knows anything about any competitor. It has looked
// at one repository and nothing else.
//
// It may say: most products in this category have X, and X was not found here.
// It may NOT say: your competitors have X. The second is a claim about the
// market made by something that never left the machine, and a reader who
// notices that once is right to discount the whole report.
//
// Every finding is therefore an absence, graded `hypothesis`, capped at medium
// severity, and worded as a category expectation. The tests pin all four.
//
// ── Guessing the category is worse than declining to ─────────────────────────
//
// A section that decides a folder of text files is a SaaS product generates
// findings about a product that does not exist. When the signals do not
// identify a category, this returns none.

import type { ErrorFinding as CommonFinding } from './errorLog.js'

interface Source { path: string; text: string }

export type ProductCategory =
  | 'web application'
  | 'library or package'
  | 'command-line tool'
  | 'api service'

export interface CompetitiveOptions {
  /** Off by default. Currently changes only what the limitations say, because
   *  the research itself is not implemented — see the note below. */
  networkResearch: boolean
}

export interface CompetitiveAnalysis {
  /** null when the signals did not identify one. No findings are produced. */
  category: ProductCategory | null
  findings: CommonFinding[]
  researchPerformed: boolean
  limitations: string[]
}

interface Capability {
  id: string
  title: string
  /** What a reader should take from its absence. */
  why: string
  /** Evidence that the capability IS present. */
  present: RegExp
  /** Which categories are judged on it. */
  categories: ProductCategory[]
  severity: 'medium' | 'low' | 'info'
}

/**
 * The capabilities checked, and which kinds of product are judged on each.
 *
 * Kept deliberately small. Every entry is something whose absence is worth a
 * sentence in a report, and whose presence can be recognised without guessing —
 * a longer list of weaker signals would produce a section nobody trusts.
 */
const CAPABILITIES: Capability[] = [
  {
    id: 'CAP-AUTH',
    title: 'No authentication or account handling was found',
    why: 'Most products of this kind let somebody sign in, and almost everything else — '
      + 'personalisation, permissions, billing — depends on it.',
    present: /\b(signin|sign-in|login|log-in|authenticate|useAuth|AuthProvider|session|oauth|passport|next-auth|clerk|auth0|supabase\.auth)\b/i,
    categories: ['web application', 'api service'],
    severity: 'medium',
  },
  {
    id: 'CAP-SEARCH',
    title: 'No search was found',
    why: 'Once a product holds more than a screenful of anything, people expect to be able to '
      + 'search it rather than navigate to it.',
    present: /\b(search|query|filter|fuzzy|algolia|elasticsearch|meilisearch|typesense)\b/i,
    categories: ['web application'],
    severity: 'low',
  },
  {
    id: 'CAP-NOTIFY',
    title: 'No notification or outbound messaging was found',
    why: 'Products of this kind usually need to reach a user who is not currently looking at '
      + 'them — a confirmation, a reminder, an alert.',
    present: /\b(notification|notify|sendmail|sendgrid|nodemailer|resend|twilio|postmark|mailgun|webpush|toast)\b/i,
    categories: ['web application', 'api service'],
    severity: 'low',
  },
  {
    id: 'CAP-SETTINGS',
    title: 'No settings or preferences surface was found',
    why: 'A product people use repeatedly usually gives them somewhere to change how it behaves.',
    present: /\b(settings|preferences|profile|account)\b/i,
    categories: ['web application'],
    severity: 'low',
  },
  {
    id: 'CAP-EXPORT',
    title: 'No data export was found',
    why: 'Being able to get data out is both an expectation and, in several jurisdictions, a '
      + 'requirement once personal data is held.',
    present: /\b(export|download|csv|toBlob|createObjectURL|content-disposition)\b/i,
    categories: ['web application', 'api service'],
    severity: 'low',
  },
  {
    id: 'CAP-README',
    title: 'No README was found',
    why: 'A package with no README is one people cannot evaluate without reading its source.',
    present: /(^|\/)readme(\.md|\.rst|\.txt)?$/i,
    categories: ['library or package', 'command-line tool'],
    severity: 'medium',
  },
  {
    id: 'CAP-TYPES',
    title: 'No published type definitions were found',
    why: 'A JavaScript package without types is harder to adopt in the many projects that '
      + 'expect them.',
    present: /"types"\s*:|"typings"\s*:|\.d\.ts$/i,
    categories: ['library or package'],
    severity: 'low',
  },
  {
    id: 'CAP-LICENSE',
    title: 'No licence was found',
    why: 'Without one, the default is that nobody may use it, which is rarely what a published '
      + 'package intends.',
    present: /(^|\/)licen[cs]e(\.md|\.txt)?$|"license"\s*:/i,
    categories: ['library or package', 'command-line tool', 'web application'],
    severity: 'medium',
  },
]

function detectCategory(files: Source[]): ProductCategory | null {
  const manifest = files.find((f) => /(^|\/)package\.json$/.test(f.path))?.text
  let pkg: Record<string, any> = {}
  if (manifest) { try { pkg = JSON.parse(manifest) } catch { /* unparseable */ } }

  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
  const has = (re: RegExp) => Object.keys(deps).some((d) => re.test(d))
  const hasUiFiles = files.some((f) => /\.(tsx|jsx|vue|svelte)$/i.test(f.path))

  if (has(/^(react|vue|svelte|next|nuxt|@angular\/core|solid-js)$/) || hasUiFiles) {
    return 'web application'
  }
  if (pkg.bin) return 'command-line tool'
  if (has(/^(express|fastify|koa|hapi|@nestjs\/core)$/)) return 'api service'
  // `main`, `module` or `exports` with no application framework is a package.
  if (pkg.main || pkg.module || pkg.exports) return 'library or package'

  // Nothing identified it. Saying so beats inventing a product to critique.
  return null
}

export function analyseCompetitiveGaps(
  files: Source[],
  o: CompetitiveOptions,
): CompetitiveAnalysis {
  const category = detectCategory(files)

  const limitations: string[] = [
    'This section compares the repository against capabilities that products of its kind '
    + 'commonly have. It is not a comparison against any named product.',
  ]

  // Enabling the setting must not, by itself, conjure market claims. Until the
  // research is built, the honest output with the flag on is the output with it
  // off, plus a sentence saying so.
  if (o.networkResearch) {
    limitations.push('External competitive research is enabled in the settings but is not '
      + 'implemented, so no research was performed and nothing left this machine.')
  } else {
    limitations.push('No external research was performed. Nothing left this machine, and no '
      + 'claim here is about a competitor.')
  }

  if (!category) {
    limitations.push('The kind of product could not be identified from the files that were '
      + 'read, so no capability expectations were applied. Findings were not produced for a '
      + 'category this analysis could not establish.')
    return { category: null, findings: [], researchPerformed: false, limitations }
  }

  // Paths are searched as well as contents: a README is a filename, not a word
  // in a file.
  const haystack = files.map((f) => `${f.path}\n${f.text}`).join('\n')
  const paths = files.map((f) => f.path).join('\n')

  const findings: CommonFinding[] = CAPABILITIES
    .filter((c) => c.categories.includes(category))
    .filter((c) => !(c.present.test(haystack) || c.present.test(paths)))
    .map((c) => ({
      id: c.id,
      area: 'category expectations',
      title: c.title,
      severity: c.severity,
      // Never `verified` and never `indicated`. This is a claim about what is
      // usual, tested against one repository, and the grade says so.
      confidence: 'hypothesis' as const,
      detail: `${c.why} No sign of it was found in the files that were read. This is a `
        + `category expectation for a ${category}, not a claim about any other product.`,
      files: [],
      because: `Products of this kind typically have this. Its absence here is a hypothesis to `
        + 'validate — it may exist under a name this analysis does not recognise, live outside '
        + 'the repository, or be a deliberate choice.',
      next: 'Confirm whether this exists. If it does not, decide whether it should — the answer '
        + 'is legitimately no for many products.',
      isAbsence: true,
      // No coding prompt: "should this product have search" is a product
      // decision, and handing it to a coding agent would answer it by default.
      prompt: null,
    }))

  return { category, findings, researchPerformed: false, limitations }
}
