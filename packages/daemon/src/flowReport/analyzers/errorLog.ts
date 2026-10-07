// daemon/src/flow-reports/analyzers/errorLog.ts
//
// How a project handles and reports failure, read from its source.
//
// ── Why this one is new rather than adapted ──────────────────────────────────
//
// Poschi's error section is a live feed from a deployed product's error API.
// That is the right design for a product FlowAgent has credentials for, and it
// says nothing at all about an arbitrary repository somebody just pointed at.
// So this is a static read: what the code does when something goes wrong, and
// whether anybody would find out.
//
// ── The line this must not cross ─────────────────────────────────────────────
//
// It may say a catch block discards what it caught. It may say nothing in the
// tree reports errors anywhere. It may NOT say the product is failing, that
// users are affected, or that an incident occurred — source code does not know
// any of that, and a reliability section that overstates once is a reliability
// section nobody reads twice.
//
// ── Patterns are counted, not listed ─────────────────────────────────────────
//
// One empty catch is a style choice, often a documented one. Forty is a
// pattern. Reporting each occurrence separately would bury every other finding
// in the section under the same sentence repeated, so occurrences are grouped
// into one finding carrying a count and a sample of paths.

export interface ErrorFinding {
  id: string
  area: string
  title: string
  severity: 'high' | 'medium' | 'low' | 'info'
  confidence: 'verified' | 'indicated' | 'hypothesis'
  detail: string
  files: string[]
  because: string
  next: string
  isAbsence: boolean
  prompt?: string | null
}

export interface ErrorAnalysisFacts {
  sourceFiles: number
  swallowedCatches: number
  consoleCalls: number
  hasErrorReporting: boolean
  hasStructuredLogging: boolean
  hasErrorBoundary: boolean
  isReact: boolean
}

export interface ErrorAnalysis {
  findings: ErrorFinding[]
  facts: ErrorAnalysisFacts
}

interface Source { path: string; text: string }

const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte)$/i
const IS_TEST = /(^|\/)(__tests__|__mocks__|tests?|spec|e2e|cypress)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$/i

/**
 * Reporting and logging services, matched as IMPORTS rather than as text.
 *
 * The first version searched the whole tree for these names and got a memorable
 * answer: run against FlowAgent's own daemon, it reported that the daemon has
 * error reporting. The only thing matching was THIS FILE — the analyser
 * detected its own pattern strings. It would do the same for any repository
 * containing a linter rule, a dependency audit, or a paragraph of documentation
 * mentioning Sentry.
 *
 * That is a false positive in the dangerous direction: it suppresses a real
 * absence rather than inventing a presence, so the gap goes unreported and
 * nothing on the page says why.
 *
 * Using a library means importing it or depending on it, so those are what get
 * matched: an `import`/`require`/`from` specifier, or an entry in the
 * dependency manifest. A name inside a regex literal is neither.
 */
const REPORTING_LIBS = /@sentry\/[\w-]+|bugsnag[\w-]*|rollbar|@datadog\/[\w-]+|honeybadger[\w-]*|airbrake[\w-]*|@opentelemetry\/[\w-]+|@appsignal\/[\w-]+|raygun[\w-]*/
const LOGGING_LIBS = /pino|winston|bunyan|loglevel|consola|tslog/

/** An import, require, or bare `from` specifier naming one of these libraries. */
function importsAny(text: string, libs: RegExp): boolean {
  const re = new RegExp(
    `(?:from\\s*|import\\s*\\(\\s*|require\\s*\\(\\s*)['"\`](?:node:)?(${libs.source})(?:/[^'"\`]*)?['"\`]`,
    'i',
  )
  return re.test(text)
}

/** A dependency declared in a package manifest. */
function dependsOnAny(manifest: string | undefined, libs: RegExp): boolean {
  if (!manifest) return false
  try {
    const pkg = JSON.parse(manifest) as Record<string, Record<string, string> | undefined>
    const names = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ]
    return names.some((n) => new RegExp(`^(${libs.source})$`, 'i').test(n))
  } catch {
    return false
  }
}

/**
 * A catch block whose body does nothing with the error.
 *
 * Matches an empty body, or one containing only console output. Deliberately
 * conservative: a body that rethrows, reports, sets state or calls anything
 * else is left alone, because flagging real handling would bury the genuine
 * cases. Nested braces inside the body end the match, so this under-reports
 * rather than over-reports — the right direction for a pattern finding.
 */
const SWALLOWED = /catch\s*(?:\([^)]*\))?\s*\{\s*(?:\/\/[^\n]*\s*)*(?:console\.[a-z]+\([^;{}]*\)\s*;?\s*)*\}/gi

const CONSOLE_CALL = /\bconsole\.(log|debug|info|warn|error)\s*\(/g

const count = (text: string, re: RegExp): number => {
  re.lastIndex = 0
  let n = 0
  while (re.exec(text) !== null) n += 1
  return n
}

/** A handful of paths, so a finding shows where without becoming a file list. */
const sample = (paths: string[], n = 5): string[] => paths.slice(0, n)

export function analyseErrorHandling(files: Source[]): ErrorAnalysis {
  const source = files.filter((f) => SOURCE.test(f.path))
  const production = source.filter((f) => !IS_TEST.test(f.path))

  const swallowedBy: string[] = []
  let swallowedCatches = 0
  let consoleCalls = 0

  for (const f of production) {
    const swallowed = count(f.text, SWALLOWED)
    if (swallowed > 0) {
      swallowedCatches += swallowed
      swallowedBy.push(f.path)
    }
    consoleCalls += count(f.text, CONSOLE_CALL)
  }

  const manifest = files.find((f) => /(^|\/)package\.json$/.test(f.path))?.text
  const sourceText = source.map((f) => f.text).join('\n')

  const hasErrorReporting = importsAny(sourceText, REPORTING_LIBS)
    || dependsOnAny(manifest, REPORTING_LIBS)
  const hasStructuredLogging = importsAny(sourceText, LOGGING_LIBS)
    || dependsOnAny(manifest, LOGGING_LIBS)

  const isReact = /"react"\s*:/.test(manifest ?? '')
    || source.some((f) => /\.(tsx|jsx)$/.test(f.path))

  // Searched only in React source. The identifiers are ordinary words that
  // appear in analysers, linters and documentation, so scanning the whole tree
  // finds them in code that is looking FOR them rather than using them.
  const hasErrorBoundary = source
    .filter((f) => /\.(tsx|jsx|vue|svelte)$/i.test(f.path))
    .some((f) => /componentDidCatch|getDerivedStateFromError|<ErrorBoundary|errorElement\s*:/
      .test(f.text))

  const facts: ErrorAnalysisFacts = {
    sourceFiles: production.length,
    swallowedCatches,
    consoleCalls,
    hasErrorReporting,
    hasStructuredLogging,
    hasErrorBoundary,
    isReact,
  }

  const findings: ErrorFinding[] = []

  // Nothing to say about nothing. An empty file list means the scan found no
  // source, and inventing findings for it would be the worst kind of output.
  if (source.length === 0) return { findings, facts }

  if (swallowedCatches > 0) {
    findings.push({
      id: 'ERR-001',
      area: 'error handling',
      title: 'Catch blocks that discard the error they caught',
      severity: swallowedCatches > 10 ? 'medium' : 'low',
      // Counted from the source, so this is verified in the narrow sense that
      // matters: the code does say this. Whether it causes a problem is not
      // something the files can settle.
      confidence: 'verified',
      detail: `${swallowedCatches} catch block${swallowedCatches === 1 ? '' : 's'} across `
        + `${swallowedBy.length} file${swallowedBy.length === 1 ? '' : 's'} either have an empty `
        + 'body or only write to the console. An error caught and dropped is a failure nobody '
        + 'can see afterwards, in the code or in a log.',
      files: sample(swallowedBy),
      because: 'The pattern is read directly from the source. What it costs at runtime depends '
        + 'on which paths these sit on, which static analysis cannot tell you.',
      next: 'Decide, per catch, whether the error should be surfaced to the user, reported, or '
        + 'genuinely ignored — and where it is genuinely ignored, say so in a comment so the '
        + 'next reader does not have to guess.',
      isAbsence: false,
      prompt: [
        'Review the catch blocks that currently discard their error.',
        '',
        'First inspect:',
        ...sample(swallowedBy).map((p) => `- ${p}`),
        '- the existing error-handling conventions elsewhere in this project',
        '',
        'For each one, choose deliberately between:',
        '- surfacing the failure to the user through whatever pattern this project already uses',
        '- reporting it to the error-reporting service, if one is configured',
        '- rethrowing, where the caller is the right place to decide',
        '- genuinely ignoring it, with a comment saying why',
        '',
        'Constraints:',
        '- Preserve existing behaviour unless the change is the point.',
        '- Follow the project conventions already in these files.',
        '- Do not log secrets, tokens, or personal data.',
        '- Do not make unrelated refactors.',
        '',
        'Acceptance criteria:',
        '- No catch block is left with an empty body and no comment explaining it.',
        '- Existing tests still pass.',
      ].join('\n'),
    })
  }

  if (!hasErrorReporting) {
    findings.push({
      id: 'ERR-002',
      area: 'observability',
      title: 'No error reporting or monitoring integration was found',
      severity: 'medium',
      // An absence found by pattern matching: the service could be wired up in
      // deployment configuration this scan never saw.
      confidence: 'indicated',
      detail: 'No import of an error-reporting service was found in the files that were read. '
        + 'Without one, a failure that happens to a user is only visible if somebody is '
        + 'watching a console at the time.',
      files: [],
      because: 'This is an absence. The service could be configured outside the repository, or '
        + 'in deployment settings this analysis does not see.',
      next: 'Confirm whether errors are reported anywhere. If they are not, adding a reporting '
        + 'service is usually the single highest-value reliability change available.',
      isAbsence: true,
      prompt: null,
    })
  }

  if (!hasStructuredLogging && production.length > 20) {
    findings.push({
      id: 'ERR-003',
      area: 'observability',
      title: 'No structured logging library was found',
      severity: 'low',
      confidence: 'indicated',
      detail: 'No structured logging library was found in the files that were read. Console '
        + 'output is hard to search, filter or correlate once a project reaches this size.',
      files: [],
      because: 'An absence, and a project can reasonably log through its framework instead.',
      next: 'Consider whether failures in this project need to be searchable after the fact.',
      isAbsence: true,
      prompt: null,
    })
  }

  if (isReact && !hasErrorBoundary) {
    findings.push({
      id: 'ERR-004',
      area: 'user-facing failure',
      title: 'No error boundary was found in a React application',
      severity: 'medium',
      confidence: 'indicated',
      detail: 'No componentDidCatch, getDerivedStateFromError, ErrorBoundary or router '
        + 'errorElement was found. In React, an unhandled render error unmounts the tree, so '
        + 'the user sees a blank page rather than a message.',
      files: [],
      because: 'An absence. A boundary could be provided by a framework or a library this '
        + 'pattern does not recognise.',
      next: 'Confirm what a user sees when a component throws. If it is a blank page, an error '
        + 'boundary around the route tree is a small change with a large effect.',
      isAbsence: true,
      prompt: null,
    })
  }

  // Threshold rather than presence: a handful of console calls is normal, and
  // flagging them would make this section noise in every project.
  if (consoleCalls > 25) {
    findings.push({
      id: 'ERR-005',
      area: 'observability',
      title: 'Console logging appears throughout the production source',
      severity: 'low',
      confidence: 'verified',
      detail: `${consoleCalls} console calls were found outside test files. Console output is `
        + 'invisible on a server and unsearchable in a browser, so it tends to be where '
        + 'diagnostics go to be lost.',
      files: [],
      because: 'Counted directly from the source. Whether each call matters depends on where it '
        + 'runs, which this cannot tell.',
      next: 'Route the calls that matter through a logger, and remove the ones that were '
        + 'debugging aids.',
      isAbsence: false,
      prompt: null,
    })
  }

  return { findings, facts }
}
