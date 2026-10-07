// daemon/src/flow-reports/scanner/ignorePolicy.ts
//
// What Flow Reports refuses to read, and why it can say so.
//
// ── Every skip carries a reason, and the reason reaches the report ───────────
//
// The failure this module exists to prevent is silent omission. A scan that
// quietly drops a directory produces a report saying a project has no tests
// when it has four hundred, and nothing on the page distinguishes "read and
// found clean" from "never opened". So `skip` is never returned alone; it comes
// with prose the report prints verbatim.
//
// ── The gitignore support is a subset, and says which one ────────────────────
//
// Full gitignore semantics are a specification, not a regex. Implemented here:
// comments, blank lines, `!` negation with last-match-wins, a trailing `/` for
// directory-only, a leading `/` to anchor at the root, `*` within a segment,
// `**` across segments, and a bare name matching at any depth.
//
// NOT implemented: per-directory .gitignore files re-anchoring their own
// subtree (only the root file is read), character ranges like [a-z], and
// escaped literal `#`/`!`/space. Those are rare in practice and each one is a
// way to get the match subtly wrong. A pattern this module cannot honour errs
// towards INCLUDING the file — a scan that reads slightly too much produces a
// noisy report, and a scan that reads too little produces a wrong one.

/** Directories skipped before anything inside them is even listed. */
export const DEFAULT_SKIP_DIRS = [
  '.git', 'node_modules', '.next', 'dist', 'build', 'coverage', '.cache',
  '.turbo', '.vercel', '.idea', '.vscode', 'vendor', 'target', 'out',
  '.svn', '.hg', '__pycache__', '.pytest_cache', '.gradle', 'Pods',
] as const

/** The two that stay excluded even when the user asks to include generated
 *  output: one is not source at all, the other is somebody else's code. */
const NEVER_INCLUDE_DIRS = new Set(['.git', 'node_modules', '.svn', '.hg'])

/**
 * A working copy of the repository, checked out inside the repository.
 *
 * Agent tooling puts branch checkouts under a dot-directory — `.claude/
 * worktrees/<name>/`, and `.git/worktrees/` for git's own bookkeeping — so the
 * whole project appears again, once per branch, below its own root. Reading
 * them means every analyser sees the same file two or three times: counts
 * inflate, a finding can be attributed to a stale branch's copy rather than to
 * the working tree, and the duplicates spend the scan's file and byte budget,
 * so a large project can be reported as truncated because of itself.
 *
 * ── Why this is a default and not a fix ──────────────────────────────────────
 *
 * In practice these directories are usually gitignored, and the scan already
 * honours .gitignore — measured against a project that has them, `.claude` was
 * skipped with the reason "matched \".claude/\" in .gitignore" and not one
 * duplicated path reached the report. So this changes nothing for a project
 * that ignores them.
 *
 * It exists for the project that does not. Committing `.claude/` is a
 * reasonable thing to do — it is how a team shares skills, agents and settings
 * — and a repository that commits it and also runs agent worktrees would have
 * its own source read several times with nothing to say so. Relying on each
 * analysed project's .gitignore to prevent that is relying on a file written
 * for a different purpose.
 *
 * Anchored to a dot-directory on purpose: a top-level `worktrees/` folder might
 * be anything, and guessing would exclude source.
 */
const NESTED_CHECKOUT = /^(?:.*\/)?\.[\w.-]+\/worktrees$/

/** Named in the methodology section alongside the directory list, because a
 *  reader comparing the exclusions to their own tree should find every rule. */
const NESTED_CHECKOUT_LABEL = '.*/worktrees (working copies checked out inside the repository)'

const GENERATED_DIRS = new Set([
  '.next', 'dist', 'build', 'coverage', '.cache', '.turbo', '.vercel', 'out',
  'target', '__pycache__', '.pytest_cache', '.gradle',
])

const BINARY_EXT = /\.(png|jpe?g|gif|bmp|ico|webp|avif|svgz|tiff?|mp[34]|m4[av]|mov|avi|mkv|webm|wav|flac|ogg|woff2?|ttf|otf|eot|zip|gz|tgz|bz2|xz|7z|rar|exe|dll|so|dylib|bin|dat|db|sqlite3?|pdf|docx?|xlsx?|pptx?|psd|ai|sketch|jar|war|class|pyc|pyo|wasm|node)$/i

const LOCKFILE = /^(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|composer\.lock|Gemfile\.lock|Cargo\.lock|poetry\.lock|deno\.lock)$/i

/**
 * Minified output and sourcemaps.
 *
 * Deliberately does NOT try to recognise content-hashed bundle names. The first
 * attempt matched `\.[a-f0-9]{8,}\.js`, which misses how the hashes are
 * actually spelled — Vite emits `index-BxDIwBdX.js`, hyphen-separated and mixed
 * case, not dot-separated hex. Widening it to match that shape means matching
 * `[-.][A-Za-z0-9]{8,}\.js`, and at that point `my-component.js` is a content
 * hash too.
 *
 * The case it was reaching for is already covered better elsewhere: hashed
 * bundles live in `dist`, `build`, `out` and `.next`, which are skipped as
 * whole directories before any file in them is considered. A filename
 * heuristic would only add false skips of real source, which is the direction
 * this module must not err in.
 */
const MINIFIED = /(\.min\.(js|css)$|\.map$)/i

/**
 * The same case, decided on the file's shape instead of its name.
 *
 * The note above is still right that a filename cannot carry this — but the
 * content can, and unambiguously. A bundler's job is to delete newlines, so
 * minified output has a mean line length nothing written by hand approaches.
 *
 * Measured across four checkouts, every text file of 50KB or more:
 *
 *   assets/index-7mo2Yuo2.css   36,179 chars per line   built
 *   assets/index-BzhBNS2H.js     3,117                  built
 *   AdminLaunchChecklist.tsx       275                  hand-written
 *   settings.local.json            139
 *   everything else (113 files)   ≤126
 *
 * An eleven-fold gap, so the threshold is not a guess. It sits at 1,000:
 * 3.6× above the densest real source found and 3.1× below the loosest bundle,
 * which leaves room on the side that matters. A false skip of real source is
 * the failure this module must not produce, and it is worth reading an
 * occasional bundle to stay clear of it.
 *
 * Mean rather than longest line, because the longest line does not separate
 * them: that same hand-written admin screen has a 6,653-character line in it.
 *
 * Only files past 50KB are judged. Below that a single long line — an embedded
 * data URI, a wide table of constants — moves the mean enough to matter, and
 * reading a small file costs nothing worth protecting against.
 */
const SHAPE_MIN_BYTES = 50_000
const SHAPE_MEAN_LINE = 1_000

/** Named in the methodology section beside the directory list, so a reader
 *  comparing the exclusions against their own tree finds every rule. */
const SHAPE_LABEL = 'files of 50KB or more averaging over 1,000 characters per line (build output)'

/** Environment files are skipped outright rather than read and redacted. A
 *  scan that opens .env has already failed even if it never prints what it
 *  found — the value is then in memory, in a log, in a crash dump. `.example`
 *  and `.sample` are conventionally placeholders and are useful evidence. */
const ENV_FILE = /(^|\/)\.env(\.[^/]*)?$/i
const ENV_TEMPLATE = /\.(example|sample|template|dist)$/i

const TEST_FILE = /(^|\/)(__tests__|__mocks__|test|tests|spec|e2e|cypress)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$/i
const DOC_FILE = /\.(md|mdx|markdown|rst|adoc|txt)$/i

/**
 * A documentation directory, skipped whole when documentation is excluded.
 *
 * The extension test above is not enough on its own. A docs folder holds more
 * than Markdown — exported HTML, diagrams, sample JSON, a generated site — and
 * every one of those reaches an analyser as source if only the `.md` files are
 * dropped. Skipping the directory also means its contents are never listed,
 * which is the difference between not reporting on a docs tree and spending the
 * scan's file budget on one.
 *
 * Only these two names. `doc` is a real source directory in some projects, and
 * this module errs towards reading too much rather than too little.
 */
const DOC_DIRS = new Set(['docs', 'documentation'])

/** Named in the methodology beside the directory list, so a reader comparing
 *  the exclusions against their own tree finds every rule. */
const DOC_DIR_LABEL = 'docs, documentation (when documentation is excluded)'

export interface IgnoreFileSource {
  /** `.gitignore` or `.flowcodeignore` — printed in the skip reason so a
   *  reader can tell which file removed something. */
  source: string
  text: string
}

export interface IgnorePolicyOptions {
  ignoreFiles?: IgnoreFileSource[]
  customIgnore?: string[]
  excludeGenerated?: boolean
  includeTests?: boolean
  includeDocs?: boolean
  maxFileBytes?: number
}

/**
 * Why something was left out, as a value rather than as prose.
 *
 * The reason string is written for a person and will be reworded; a report that
 * wants to group exclusions — and to say which of them a reader should check —
 * cannot do it by matching on that sentence. So the decision carries its own
 * label from the point where it is made.
 *
 * `too_large` and `build_output` are the two a reader might disagree with: one
 * is a threshold and the other is a judgement about a file's shape. The rest
 * are categorical.
 */
export type SkipKind =
  | 'directory' | 'environment' | 'lockfile' | 'minified' | 'binary'
  | 'tests' | 'docs' | 'too_large' | 'ignore_rule' | 'build_output'

export interface SkipVerdict {
  skip: boolean
  /** Present whenever `skip` is true. Printed in the report's exclusions list. */
  reason?: string
  /** Present whenever `skip` is true. */
  kind?: SkipKind
}

const KEEP: SkipVerdict = { skip: false }

interface Rule {
  /** The compiled matcher. */
  re: RegExp
  negated: boolean
  directoryOnly: boolean
  source: string
  raw: string
}

/**
 * Translate one gitignore pattern into a regular expression over the
 * repository-relative, forward-slash path.
 *
 * `**` has to be substituted before `*`, or the single-star rule eats both
 * stars and `build/**\/x` starts matching `build/a/b/x` only by accident.
 */
function compile(raw: string, source: string): Rule | null {
  let body = raw.trim()
  if (!body || body.startsWith('#')) return null

  const negated = body.startsWith('!')
  if (negated) body = body.slice(1)

  const directoryOnly = body.endsWith('/')
  if (directoryOnly) body = body.slice(0, -1)

  const anchored = body.startsWith('/')
  if (anchored) body = body.slice(1)
  // A pattern containing a slash anywhere is relative to the ignore file's
  // directory — which, since only the root file is read, means the root.
  const hasSlash = body.includes('/')

  const escaped = body
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, ' SLASHSTAR ')
    .replace(/\*\*/g, ' STARSTAR ')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/ SLASHSTAR /g, '(?:.*/)?')
    .replace(/ STARSTAR /g, '.*')

  // A bare name with no slash matches at any depth, which is the gitignore
  // behaviour people actually rely on (`node_modules`, `*.log`).
  const prefix = anchored || hasSlash ? '^' : '^(?:.*/)?'
  return {
    re: new RegExp(`${prefix}${escaped}(?:/.*)?$`),
    negated,
    directoryOnly,
    source,
    raw,
  }
}

export interface IgnorePolicy {
  /** @param name the entry name; @param rel the repository-relative path */
  directory(name: string, rel: string): SkipVerdict
  /** @param size in bytes, so the per-file limit is applied without reading */
  file(name: string, rel: string, size: number): SkipVerdict
  /**
   * The one judgement that needs the bytes.
   *
   * Called after a file is read and before it is kept, because build output is
   * recognisable by its shape and not by its name. A file rejected here has
   * been read into memory and is then dropped — which is the point: it never
   * reaches an analyser.
   */
  content(rel: string, text: string): SkipVerdict
  /** Everything that shaped this policy, for the report's methodology section. */
  describe(): { defaults: string[]; sources: string[]; custom: string[] }
}

export function buildIgnorePolicy(o: IgnorePolicyOptions = {}): IgnorePolicy {
  const excludeGenerated = o.excludeGenerated !== false
  const includeTests = o.includeTests !== false
  const includeDocs = o.includeDocs !== false
  // 600KB rather than 400KB. At 400KB this excluded POSCHI's 488KB admin
  // screen — hand-written source, not a bundle — and four findings in the
  // sibling POSCHI analyser had been counting a version of the product with
  // that file cut out of it. The ceiling could only be raised once `content`
  // above existed to catch build output by shape, because until then this
  // number was the only thing keeping a 414KB minified bundle out of a scan.
  const maxFileBytes = o.maxFileBytes ?? 600_000

  const rules: Rule[] = []
  for (const f of o.ignoreFiles ?? []) {
    for (const line of f.text.split(/\r?\n/)) {
      const rule = compile(line, f.source)
      if (rule) rules.push(rule)
    }
  }
  for (const line of o.customIgnore ?? []) {
    const rule = compile(line, 'analysis settings')
    if (rule) rules.push(rule)
  }

  /** Last match wins, which is what makes `!keep.log` after `*.log` work. */
  const matchRules = (rel: string, isDir: boolean): Rule | null => {
    let winner: Rule | null = null
    for (const r of rules) {
      if (r.directoryOnly && !isDir) continue
      if (r.re.test(rel)) winner = r
    }
    return winner && !winner.negated ? winner : null
  }

  return {
    directory(name, rel) {
      if (NEVER_INCLUDE_DIRS.has(name)) {
        return { skip: true, kind: 'directory', reason: `${name} is never analysed: it is not project source.` }
      }
      // Before the generated-output check, and not subject to it: this is the
      // project's own source, which is exactly why reading it again is wrong.
      if (NESTED_CHECKOUT.test(rel)) {
        return {
          skip: true,
          kind: 'directory',
          reason: `${rel} holds working copies of this repository checked out inside it; `
            + 'reading them would analyse the same source once per branch.',
        }
      }
      if (!includeDocs && DOC_DIRS.has(name.toLowerCase())) {
        return {
          skip: true,
          kind: 'docs',
          reason: `${name} holds documentation, which is excluded by the analysis settings. `
            + 'Prose about code quotes code, and an analyser reading it counts the quotation.',
        }
      }
      if (excludeGenerated && GENERATED_DIRS.has(name)) {
        return { skip: true, kind: 'directory', reason: `${name} holds generated output, excluded by default.` }
      }
      if (!excludeGenerated && DEFAULT_SKIP_DIRS.includes(name as never)
        && !GENERATED_DIRS.has(name)) {
        return { skip: true, kind: 'directory', reason: `${name} is excluded by default.` }
      }
      if (excludeGenerated && DEFAULT_SKIP_DIRS.includes(name as never)) {
        return { skip: true, reason: `${name} is excluded by default.` }
      }
      const hit = matchRules(rel, true)
      if (hit) return { skip: true, kind: 'ignore_rule', reason: `matched "${hit.raw}" in ${hit.source}.` }
      return KEEP
    },

    file(name, rel, size) {
      if (ENV_FILE.test(rel) && !ENV_TEMPLATE.test(name)) {
        return {
          skip: true,
          kind: 'environment',
          reason: 'environment files are never read, so their values cannot reach a report.',
        }
      }
      if (LOCKFILE.test(name)) {
        return { skip: true, kind: 'lockfile', reason: 'lockfile: large, generated, and read as metadata elsewhere.' }
      }
      if (MINIFIED.test(name)) {
        return { skip: true, kind: 'minified', reason: 'minified or generated bundle output.' }
      }
      if (BINARY_EXT.test(name)) {
        return { skip: true, kind: 'binary', reason: 'binary or media file, not source.' }
      }
      if (!includeTests && TEST_FILE.test(rel)) {
        return { skip: true, kind: 'tests', reason: 'test files excluded by the analysis settings.' }
      }
      if (!includeDocs && DOC_FILE.test(name)) {
        return { skip: true, kind: 'docs', reason: 'documentation excluded by the analysis settings.' }
      }
      if (size > maxFileBytes) {
        return {
          skip: true,
          kind: 'too_large',
          reason: `${Math.round(size / 1024)} KB is larger than the ${Math.round(maxFileBytes / 1024)} KB per-file limit.`,
        }
      }
      const hit = matchRules(rel, false)
      if (hit) return { skip: true, kind: 'ignore_rule', reason: `matched "${hit.raw}" in ${hit.source}.` }
      return KEEP
    },

    content(rel, text) {
      if (!excludeGenerated) return KEEP
      if (text.length < SHAPE_MIN_BYTES) return KEEP

      // Counting separators rather than splitting: a 400KB string does not need
      // to become an array of strings to be measured.
      let newlines = 0
      for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) newlines++
      const mean = Math.round(text.length / (newlines + 1))
      if (mean < SHAPE_MEAN_LINE) return KEEP

      return {
        skip: true,
        kind: 'build_output',
        reason: `build output: ${mean.toLocaleString()} characters per line on average, past the `
          + `${SHAPE_MEAN_LINE.toLocaleString()} mark that separates minified bundles from source.`,
      }
    },

    describe() {
      return {
        defaults: [
          ...DEFAULT_SKIP_DIRS, NESTED_CHECKOUT_LABEL, SHAPE_LABEL,
          ...(includeDocs ? [] : [DOC_DIR_LABEL]),
        ],
        sources: [...new Set(rules.map((r) => r.source))],
        custom: [...(o.customIgnore ?? [])],
      }
    },
  }
}
