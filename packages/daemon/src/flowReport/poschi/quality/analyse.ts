// daemon/src/integrations/poschi/quality/analyse.ts
//
// Engineering and product quality, from source alone.
//
// ── Why this one needs no live data ──────────────────────────────────────────
//
// Almost everything else FlowAgent could say about this product is blocked on
// analytics that do not exist. This is not: tests either exist or they do not,
// a dependency is either declared or it is not, an error boundary is either in
// the tree or it is not. These are facts about a repository, and a repository
// is what we have.
//
// ── The one thing that can make all of it wrong ──────────────────────────────
//
// A checkout that is behind the deployed product. Every absence finding here —
// no tests, no error boundary, no CI — means "not in these files", and if the
// files are three weeks old that is a statement about history.
//
// That is not hypothetical for this product. The deployed system serves an
// agent error feed and its admin panel describes errors "captured by the global
// ErrorBoundary"; neither appears in this checkout. So staleness is carried as
// evidence rather than as a disclaimer, every absence is labelled with it, and
// a caller that can prove the checkout is behind is expected to say so.

import { withPrompts } from './prompts.js'

export interface SourceFile {
  path: string
  text: string
}

export type Severity = 'high' | 'medium' | 'low' | 'info'

/** How sure we are, in the same vocabulary the product report uses. */
export type Confidence = 'verified' | 'indicated' | 'hypothesis'

export interface QualityFinding {
  id: string
  area: string
  title: string
  severity: Severity
  confidence: Confidence
  /** What was found or not found, and where. */
  detail: string
  /** Files a sceptic can open. Empty where the finding is an absence. */
  files: string[]
  /** Why it is this confidence and not a stronger one. */
  because: string
  /** What to do, or the question to answer first. */
  next: string
  /** True where the finding rests on something NOT being in the files. Those
   *  are the ones a stale checkout invalidates, and they are marked so a reader
   *  can discount them as a group rather than one at a time. */
  isAbsence: boolean
  /** A Claude Code prompt, where code is the right response. Null where the
   *  next step is to read something, decide something, or rotate a credential. */
  prompt?: string | null
}

export interface StalenessEvidence {
  /** Something the live system demonstrably has. */
  expected: string
  /** Why we know the live system has it. */
  knownFrom: string
  /** True when this checkout does not contain it. */
  missing: boolean
}

export interface QualityReport {
  findings: QualityFinding[]
  /** Counted facts the report prints as a strip, so a reader sees the shape
   *  before the prose. */
  metrics: {
    sourceFiles: number
    sourceLines: number
    testFiles: number
    largestFile: { path: string; lines: number } | null
    /** Files over the outlier threshold, and what share of all lines they hold. */
    outliers: Array<{ path: string; lines: number }>
    outlierShare: number
    dependencies: number
    devDependencies: number
    hasTestRunner: boolean
    hasCi: boolean
  }
  staleness: StalenessEvidence[]
  /** True when anything proves the checkout is behind the deployed product. */
  stale: boolean
}

const TEST_FILE = /\.(test|spec)\.[tj]sx?$/i
const SOURCE = /\.(ts|tsx|js|jsx)$/i

/** Above this, a file is worth naming. Not a defect — a signal that one file
 *  is carrying more than a reader can hold at once. */
const OUTLIER_LINES = 800

const lines = (t: string) => t.split('\n').length

function has(files: SourceFile[], re: RegExp): SourceFile[] {
  return files.filter((f) => re.test(f.text))
}

export interface AnalyseOptions {
  /** `package.json`, parsed. Absent when it could not be read. */
  pkg?: { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; scripts?: Record<string, string> } | null
  /** Paths in the checkout that are not source — CI configs, migrations. */
  allPaths?: string[]
  /** Capabilities the live product is known to have, to test the checkout
   *  against. Supplied by the caller because only the caller knows what it has
   *  seen the deployed system do. */
  expectLive?: Array<{ expected: string; knownFrom: string; pattern: RegExp }>
}

/**
 * The review.
 *
 * Pure over the files it is handed. Nothing here reaches the network, runs the
 * code, or judges style — a report that spent its pages on naming conventions
 * would bury the two findings that actually decide whether this product can be
 * changed safely.
 */
export function analyseQuality(files: SourceFile[], opts: AnalyseOptions = {}): QualityReport {
  const source = files.filter((f) => SOURCE.test(f.path))
  const tests = source.filter((f) => TEST_FILE.test(f.path))
  const sourceLines = source.reduce((n, f) => n + lines(f.text), 0)

  const sized = source
    .filter((f) => !TEST_FILE.test(f.path))
    .map((f) => ({ path: f.path, lines: lines(f.text) }))
    .sort((a, b) => b.lines - a.lines)

  const outliers = sized.filter((f) => f.lines >= OUTLIER_LINES)
  const outlierShare = sourceLines > 0
    ? outliers.reduce((n, f) => n + f.lines, 0) / sourceLines
    : 0

  const pkg = opts.pkg ?? null
  const deps = Object.keys(pkg?.dependencies ?? {})
  const devDeps = Object.keys(pkg?.devDependencies ?? {})
  const scripts = pkg?.scripts ?? {}
  const hasTestRunner = Object.keys(scripts).some((k) => /^(test|e2e)/i.test(k))
    || devDeps.some((d) => /vitest|jest|playwright|cypress|@testing-library/i.test(d))
  const ciPaths = (opts.allPaths ?? []).filter(
    (p) => /^\.github\/workflows\/|^\.gitlab-ci|^\.circleci\//i.test(p),
  )

  // ── Staleness, first, because it gates everything below ───────────────────
  const staleness: StalenessEvidence[] = (opts.expectLive ?? []).map((e) => ({
    expected: e.expected,
    knownFrom: e.knownFrom,
    missing: !files.some((f) => e.pattern.test(f.path) || e.pattern.test(f.text)),
  }))
  const stale = staleness.some((s) => s.missing)

  const absenceBecause = stale
    ? 'This is an absence, and this checkout is demonstrably behind the deployed product, so it may '
      + 'exist in code not present here.'
    : 'This is an absence. A checkout with no commit cannot prove it is current, so the strongest '
      + 'available claim is that these files do not contain it.'

  const findings: QualityFinding[] = []

  // ── Tests ─────────────────────────────────────────────────────────────────
  if (tests.length === 0) {
    findings.push({
      id: 'no-tests',
      area: 'Change safety',
      title: hasTestRunner
        ? 'A test runner is configured and no tests were found'
        : 'No automated tests, and no test runner configured',
      severity: 'high',
      confidence: stale ? 'indicated' : 'verified',
      detail: `No file matching *.test.* or *.spec.* appears among ${source.length} source files`
        + `${hasTestRunner ? ', though the project declares a test runner' : ''}. `
        + 'Every change to this product is therefore verified by someone opening it and looking.',
      files: [],
      because: absenceBecause,
      // Named generically on purpose. This analyser runs against whatever
      // repository somebody points it at, and naming one product's flows here
      // put "signup and booking" into a report about a CSS design tool.
      next: 'Pick the two flows whose breakage would cost the most — usually the one that gets '
        + 'somebody in, and the one that completes the thing the product exists to do — and cover '
        + 'those first. Coverage percentages are not the goal; being able to change those flows '
        + 'without opening the app is.',
      isAbsence: true,
    })
  } else {
    findings.push({
      id: 'tests',
      area: 'Change safety',
      title: `${tests.length} test files`,
      severity: 'info',
      confidence: 'verified',
      detail: `${tests.length} of ${source.length} source files are tests.`,
      files: tests.slice(0, 5).map((f) => f.path),
      because: 'Counted directly.',
      next: 'What they cover matters more than how many there are. Worth checking whether the flows '
        + 'that would hurt most are among them.',
      isAbsence: false,
    })
  }

  if (ciPaths.length === 0) {
    findings.push({
      id: 'no-ci',
      area: 'Change safety',
      title: 'No continuous integration configuration',
      severity: tests.length === 0 ? 'medium' : 'high',
      confidence: stale ? 'indicated' : 'verified',
      detail: 'No GitHub Actions, GitLab CI or CircleCI configuration is present, so nothing runs '
        + 'automatically when code changes.',
      files: [],
      because: absenceBecause,
      next: tests.length === 0
        ? 'Lower priority than the tests themselves: CI with nothing to run is a green tick that '
          + 'means nothing. Worth doing in the same change as the first tests.'
        : 'Wire the existing tests to run on every push. Tests nobody runs are documentation.',
      isAbsence: true,
    })
  }

  // ── Error handling ────────────────────────────────────────────────────────
  const boundaries = has(source, /ErrorBoundary|componentDidCatch|getDerivedStateFromError/)
  const globalHandlers = has(source, /window\.onerror|unhandledrejection|addEventListener\(\s*['"]error['"]/)

  if (boundaries.length === 0 && globalHandlers.length === 0) {
    findings.push({
      id: 'no-error-capture',
      area: 'Reliability',
      title: 'No error boundary or global handler in these files',
      severity: 'high',
      confidence: stale ? 'indicated' : 'verified',
      detail: 'Nothing here catches a render error or an unhandled rejection. In a React app an '
        + 'uncaught render error unmounts the tree, so a person sees a blank page rather than a '
        + 'message — and nothing records that it happened.',
      files: [],
      because: absenceBecause,
      next: 'Check the deployed product before acting. If it already has one, this is a stale '
        + 'checkout rather than a gap, and the thing to fix is which code this analysis reads.',
      isAbsence: true,
    })
  } else {
    findings.push({
      id: 'error-capture',
      area: 'Reliability',
      title: 'Error capture is present',
      severity: 'info',
      confidence: 'verified',
      detail: `${boundaries.length} file(s) define an error boundary`
        + `${globalHandlers.length ? ` and ${globalHandlers.length} install a global handler` : ''}.`,
      files: [...boundaries, ...globalHandlers].slice(0, 5).map((f) => f.path),
      because: 'Read directly from the source.',
      next: 'Worth confirming the boundary wraps the whole route tree rather than one branch.',
      isAbsence: false,
    })
  }

  // ── Files carrying too much ───────────────────────────────────────────────
  if (outliers.length > 0) {
    findings.push({
      id: 'size-outliers',
      area: 'Maintainability',
      title: `${outliers.length} file(s) over ${OUTLIER_LINES} lines`,
      severity: outlierShare > 0.15 ? 'medium' : 'low',
      confidence: 'verified',
      detail: `${outliers.length} files hold ${Math.round(outlierShare * 100)}% of all source lines. `
        + `The largest is ${outliers[0]!.path} at ${outliers[0]!.lines.toLocaleString('en-US')} lines.`,
      files: outliers.slice(0, 6).map((f) => `${f.path} (${f.lines})`),
      because: 'Line counts are exact. That a long file is a problem is not: length is a signal '
        + 'about how much one person has to hold at once, not a defect in itself.',
      next: 'Not a refactor for its own sake. The question worth asking is whether the largest file '
        + 'is one somebody changes often — a long file nobody touches costs nothing.',
      isAbsence: false,
    })
  }

  // ── Security-sensitive shapes ─────────────────────────────────────────────
  const injection = source.filter((f) => /dangerouslySetInnerHTML|innerHTML\s*=|(?<![\w.])eval\s*\(/.test(f.text))
  if (injection.length > 0) {
    findings.push({
      id: 'html-injection-surface',
      area: 'Security',
      title: `${injection.length} file(s) write HTML directly or evaluate strings`,
      severity: 'medium',
      confidence: 'indicated',
      detail: 'These are the shapes through which user-supplied text becomes markup or code. Each '
        + 'may be perfectly safe — the question is whether what reaches it is ever user-supplied.',
      files: injection.map((f) => f.path).slice(0, 6),
      because: 'The call sites are read directly. Whether the value reaching them can be influenced '
        + 'by a user is a data-flow question this does not trace.',
      next: 'Open each and answer one question: can a person put text into what this renders? If no, '
        + 'it closes in a minute.',
      isAbsence: false,
    })
  }

  // ── Credentials in source ─────────────────────────────────────────────────
  // Counted and located, never printed. A report that quoted the value would
  // publish the secret it was warning about.
  const secretish = source.filter((f) => (
    /(sk_live|sk_test|service_role|-----BEGIN [A-Z ]*PRIVATE KEY)/.test(f.text)
  ))
  if (secretish.length > 0) {
    findings.push({
      id: 'possible-secrets',
      area: 'Security',
      title: `${secretish.length} file(s) contain something shaped like a private credential`,
      severity: 'high',
      confidence: 'indicated',
      detail: 'A service-role key, a live secret key or a private key block appears in source. The '
        + 'value is deliberately not reproduced here.',
      files: secretish.map((f) => f.path).slice(0, 6),
      because: 'The shape is matched, not the meaning — a placeholder, a comment or a test fixture '
        + 'matches too. It is graded to be checked rather than to be believed.',
      next: 'Open each. If any is real, rotate it before anything else on this list: a key in source '
        + 'is a key in every clone and every backup of that repository.',
      isAbsence: false,
    })
  }

  // ── Dependencies ──────────────────────────────────────────────────────────
  if (pkg) {
    findings.push({
      id: 'dependencies',
      area: 'Supply chain',
      title: `${deps.length} runtime dependencies, ${devDeps.length} development`,
      severity: devDeps.length <= 4 && deps.length > 30 ? 'low' : 'info',
      confidence: 'verified',
      detail: `${deps.length} packages ship to users; ${devDeps.length} exist only to build or test.`
        + (devDeps.length <= 4 && deps.length > 30
          ? ' A development list that short alongside a runtime list that long usually means tooling '
            + 'is thin rather than that dependencies are lean.'
          : ''),
      files: ['package.json'],
      because: 'Counted from package.json. Whether any is outdated or vulnerable cannot be answered '
        + 'from a manifest — that needs the registry, which this does not reach.',
      next: 'Run the package manager’s audit against the lockfile. It answers in seconds what '
        + 'reading a manifest never can.',
      isAbsence: false,
    })
  }

  return {
    // Prompts are attached last, so a finding cannot be written to fit a prompt
    // that already existed.
    findings: withPrompts(findings.sort((a, b) => {
      const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2, info: 3 }
      return rank[a.severity] - rank[b.severity]
    })),
    metrics: {
      sourceFiles: source.length,
      sourceLines,
      testFiles: tests.length,
      largestFile: sized[0] ?? null,
      outliers: outliers.slice(0, 8),
      outlierShare,
      dependencies: deps.length,
      devDependencies: devDeps.length,
      hasTestRunner,
      hasCi: ciPaths.length > 0,
    },
    staleness,
    stale,
  }
}
