// What Flow Reports refuses to read, and why it says so.
//
// Two jobs pull in opposite directions. Skipping too little makes a scan slow,
// noisy and occasionally dangerous — node_modules alone can be a hundred
// thousand files, and .env is not something to put in a report. Skipping too
// much silently produces a report that says a project has no tests when it has
// four hundred.
//
// So every decision carries a REASON, and the reason reaches the final report.
// A file that was never read must never be indistinguishable from a file that
// was read and found clean.

import { describe, it, expect } from 'vitest'
import { buildIgnorePolicy, DEFAULT_SKIP_DIRS } from '../../../src/flowReport/scanner/ignorePolicy.js'

const policy = (over: Parameters<typeof buildIgnorePolicy>[0] = {}) => buildIgnorePolicy(over)

describe('the defaults', () => {
  it('skips the directories that are expensive, generated or private', () => {
    const p = policy()
    for (const dir of ['.git', 'node_modules', 'dist', 'build', 'coverage', '.next',
      '.cache', '.turbo', '.vercel', '.idea', '.vscode', 'vendor', 'target', 'out']) {
      const v = p.directory(dir, dir)
      expect(v.skip, `${dir} should be skipped`).toBe(true)
      expect(v.reason).toBeTruthy()
    }
  })

  it('names every default in one exported list, so the report can print it', () => {
    expect(DEFAULT_SKIP_DIRS).toContain('node_modules')
    expect(DEFAULT_SKIP_DIRS).toContain('.git')
  })

  it('keeps ordinary source directories', () => {
    const p = policy()
    expect(p.directory('src', 'src').skip).toBe(false)
    expect(p.directory('lib', 'app/lib').skip).toBe(false)
  })

  // ── A repository checked out inside itself ────────────────────────────────
  //
  // Agent tooling puts branch checkouts under `.claude/worktrees/<name>/`, so
  // the whole project appears again, once per branch, below its own root.
  // Reading them means every analyser sees the same file two or three times.
  //
  // Usually .gitignore already covers it and this changes nothing. It is here
  // for the repository that commits `.claude/` — a reasonable thing to do, and
  // how a team shares skills and settings — where nothing else would.
  describe('a working copy checked out inside the repository', () => {
    it('skips it, and says what it is', () => {
      const v = policy().directory('worktrees', '.claude/worktrees')
      expect(v.skip).toBe(true)
      expect(v.reason).toMatch(/working copies of this repository/)
    })

    it('skips it wherever the dot-directory sits', () => {
      expect(policy().directory('worktrees', '.git/worktrees').skip).toBe(true)
      expect(policy().directory('worktrees', 'packages/app/.claude/worktrees').skip).toBe(true)
    })

    it('stays skipped when generated output is asked for', () => {
      // Not generated output — it is the project's own source, which is
      // precisely why reading it a second time is wrong.
      expect(policy({ excludeGenerated: false }).directory('worktrees', '.claude/worktrees').skip)
        .toBe(true)
    })

    // Anchored to a dot-directory, because a top-level folder of that name
    // might be anything and guessing would exclude source.
    it('keeps a plain directory that happens to be called worktrees', () => {
      expect(policy().directory('worktrees', 'worktrees').skip).toBe(false)
      expect(policy().directory('worktrees', 'docs/worktrees').skip).toBe(false)
    })

    it('keeps the rest of the dot-directory it lives in', () => {
      // `.claude/skills` is configuration somebody wrote on purpose; only the
      // checkouts are duplicates.
      expect(policy().directory('skills', '.claude/skills').skip).toBe(false)
    })

    it('names the rule where the report prints the exclusions', () => {
      expect(policy().describe().defaults.join(' ')).toMatch(/worktrees/)
    })
  })

  it('skips binaries and media by extension, not by sniffing bytes', () => {
    const p = policy()
    for (const f of ['logo.png', 'clip.mp4', 'font.woff2', 'archive.zip', 'app.exe']) {
      expect(p.file(f, f, 100).skip, `${f} should be skipped`).toBe(true)
    }
  })

  it('skips lockfiles and minified bundles, which are large and tell us little', () => {
    const p = policy()
    expect(p.file('package-lock.json', 'package-lock.json', 100).skip).toBe(true)
    expect(p.file('app.min.js', 'app.min.js', 100).skip).toBe(true)
    expect(p.file('app.js.map', 'app.js.map', 100).skip).toBe(true)
  })

  // Content-hashed bundles are handled by skipping the directories they live
  // in, not by reading their names. A filename heuristic wide enough to catch
  // Vite's `index-BxDIwBdX.js` also catches `my-component.js`, and dropping
  // real source is the failure this module must not have.
  it('leaves a hashed-looking filename alone, and relies on the directory skip', () => {
    const p = policy()
    expect(p.directory('dist', 'dist').skip).toBe(true)
    expect(p.file('index-BxDIwBdX.js', 'src/index-BxDIwBdX.js', 100).skip).toBe(false)
    expect(p.file('my-component.js', 'src/my-component.js', 100).skip).toBe(false)
  })

  it('keeps the manifests that say what a project is', () => {
    const p = policy()
    expect(p.file('package.json', 'package.json', 100).skip).toBe(false)
    expect(p.file('tsconfig.json', 'tsconfig.json', 100).skip).toBe(false)
  })

  // The report is about code, and a scan that reads .env has already failed
  // even if it never prints what it found.
  it('skips environment files outright rather than relying on redaction later', () => {
    const p = policy()
    expect(p.file('.env', '.env', 10).skip).toBe(true)
    expect(p.file('.env.local', '.env.local', 10).skip).toBe(true)
    expect(p.file('.env.example', '.env.example', 10).skip).toBe(false)
  })

  it('skips a file larger than the per-file limit, and says how big it was', () => {
    const p = policy({ maxFileBytes: 1000 })
    const v = p.file('big.ts', 'src/big.ts', 5000)
    expect(v.skip).toBe(true)
    expect(v.reason).toMatch(/larger than|size/i)
  })

  // 400KB used to exclude a 488KB hand-written admin screen, and four findings
  // in the sibling POSCHI analyser spent months counting a version of the
  // product with that file cut out of it.
  it('admits a 488KB source file, which the old 400KB ceiling did not', () => {
    expect(policy().file('Screen.tsx', 'src/pages/admin/Screen.tsx', 488 * 1024).skip).toBe(false)
  })
})

// Build output is recognisable by its shape and not by its name: the policy
// documents why `index-BxDIwBdX.js` cannot be told from `my-component.js`.
// Every number below is measured from a real file — see the note on
// SHAPE_MEAN_LINE for the distribution these sit in.
describe('build output, recognised by shape', () => {
  /** `lines` lines of `width` characters. */
  const shaped = (lines: number, width: number) =>
    Array.from({ length: lines }, () => 'x'.repeat(width)).join('\n')

  it('skips a minified bundle and says what it measured', () => {
    // assets/index-BzhBNS2H.js: 414KB, 3,117 characters per line.
    const v = policy().content('assets/index-BzhBNS2H.js', shaped(136, 3117))
    expect(v.skip).toBe(true)
    expect(v.reason).toMatch(/build output/)
    expect(v.reason).toMatch(/per line/)
  })

  it('skips a minified stylesheet, which is denser still', () => {
    // assets/index-7mo2Yuo2.css: 36,179 characters per line.
    expect(policy().content('assets/index-7mo2Yuo2.css', shaped(2, 36179)).skip).toBe(true)
  })

  it('keeps the densest hand-written file found across four checkouts', () => {
    // AdminLaunchChecklist.tsx: 488KB at 275 characters per line — the file
    // this whole rule exists to stop excluding.
    expect(policy().content('src/pages/admin/AdminLaunchChecklist.tsx', shaped(1800, 275)).skip)
      .toBe(false)
  })

  it('keeps source that has one very long line in it', () => {
    // The same file has a 6,653-character line. Judging on the longest line
    // rather than the mean would throw the file away for it.
    const text = shaped(1800, 275) + '\n' + 'y'.repeat(6653)
    expect(policy().content('src/pages/admin/AdminLaunchChecklist.tsx', text).skip).toBe(false)
  })

  it('does not judge a small file, where one long line moves the mean', () => {
    // An embedded data URI in a 2KB file is not build output.
    expect(policy().content('src/icon.ts', 'y'.repeat(2000)).skip).toBe(false)
  })

  it('leaves everything alone when generated output is being included', () => {
    expect(policy({ excludeGenerated: false }).content('assets/app.js', shaped(2, 36179)).skip)
      .toBe(false)
  })

  it('names the rule in the methodology, so the exclusions can be checked', () => {
    expect(policy().describe().defaults.join(' ')).toMatch(/characters per line/)
  })
})

describe('ignore files', () => {
  it('honours a simple pattern', () => {
    const p = policy({ ignoreFiles: [{ source: '.gitignore', text: 'secrets.txt' }] })
    expect(p.file('secrets.txt', 'secrets.txt', 10).skip).toBe(true)
    expect(p.file('other.txt', 'other.txt', 10).skip).toBe(false)
  })

  it('matches a bare name at any depth, the way git does', () => {
    const p = policy({ ignoreFiles: [{ source: '.gitignore', text: 'notes.md' }] })
    expect(p.file('notes.md', 'deep/nested/notes.md', 10).skip).toBe(true)
  })

  it('anchors a pattern that starts with a slash to the root', () => {
    const p = policy({ ignoreFiles: [{ source: '.gitignore', text: '/only-at-root.txt' }] })
    expect(p.file('only-at-root.txt', 'only-at-root.txt', 10).skip).toBe(true)
    expect(p.file('only-at-root.txt', 'sub/only-at-root.txt', 10).skip).toBe(false)
  })

  it('treats a trailing slash as directory-only', () => {
    const p = policy({ ignoreFiles: [{ source: '.gitignore', text: 'logs/' }] })
    expect(p.directory('logs', 'logs').skip).toBe(true)
    expect(p.file('logs', 'logs', 10).skip).toBe(false)
  })

  it('supports * within a segment and ** across segments', () => {
    // Deliberately not *.map: sourcemaps are skipped by the defaults whatever
    // an ignore file says, so they cannot show whether the glob itself works.
    const p = policy({ ignoreFiles: [{ source: '.gitignore', text: '*.tmp\ngenerated/**/*.ts' }] })
    expect(p.file('a.tmp', 'a.tmp', 10).skip).toBe(true)
    expect(p.file('x.ts', 'generated/deep/x.ts', 10).skip).toBe(true)
    expect(p.file('x.ts', 'src/x.ts', 10).skip).toBe(false)
  })

  // Pinned so the default is not quietly removed while tidying the regex.
  it('skips sourcemaps by default, independently of any ignore file', () => {
    expect(policy().file('x.map', 'src/x.map', 10).skip).toBe(true)
  })

  it('lets a later negation win, so a project can re-include one file', () => {
    const p = policy({ ignoreFiles: [{ source: '.gitignore', text: '*.log\n!keep.log' }] })
    expect(p.file('a.log', 'a.log', 10).skip).toBe(true)
    expect(p.file('keep.log', 'keep.log', 10).skip).toBe(false)
  })

  it('ignores comments and blank lines', () => {
    const p = policy({ ignoreFiles: [{ source: '.gitignore', text: '# a comment\n\n  \nreal.txt' }] })
    expect(p.file('real.txt', 'real.txt', 10).skip).toBe(true)
    expect(p.file('a comment', 'a comment', 10).skip).toBe(false)
  })

  it('says which ignore file caused a skip, because two can disagree', () => {
    const p = policy({
      ignoreFiles: [
        { source: '.gitignore', text: 'from-git.txt' },
        { source: '.flowcodeignore', text: 'from-flowcode.txt' },
      ],
    })
    expect(p.file('from-git.txt', 'from-git.txt', 10).reason).toMatch(/\.gitignore/)
    expect(p.file('from-flowcode.txt', 'from-flowcode.txt', 10).reason).toMatch(/\.flowcodeignore/)
  })
})

describe('custom patterns from the project settings', () => {
  it('applies user patterns alongside the ignore files', () => {
    const p = policy({ customIgnore: ['scratch/**'] })
    expect(p.file('x.ts', 'scratch/x.ts', 10).skip).toBe(true)
    expect(p.file('x.ts', 'src/x.ts', 10).skip).toBe(false)
  })
})

describe('settings that widen the scan', () => {
  it('can include generated directories when the user asks', () => {
    const p = policy({ excludeGenerated: false })
    expect(p.directory('dist', 'dist').skip).toBe(false)
    // .git and node_modules stay out regardless: one is not source and the
    // other is somebody else's.
    expect(p.directory('.git', '.git').skip).toBe(true)
    expect(p.directory('node_modules', 'node_modules').skip).toBe(true)
  })

  it('can drop test files when the user does not want them analysed', () => {
    const withTests = policy({ includeTests: true })
    const without = policy({ includeTests: false })
    expect(withTests.file('a.test.ts', 'src/__tests__/a.test.ts', 10).skip).toBe(false)
    expect(without.file('a.test.ts', 'src/__tests__/a.test.ts', 10).skip).toBe(true)
  })

  it('can drop documentation when the user does not want it analysed', () => {
    const without = policy({ includeDocs: false })
    expect(without.file('README.md', 'README.md', 10).skip).toBe(true)
    expect(policy({ includeDocs: true }).file('README.md', 'README.md', 10).skip).toBe(false)
  })

  // ── The docs directory, not only the Markdown in it ────────────────────────
  //
  // Dropping `.md` alone leaves everything else a docs tree holds — exported
  // HTML, sample JSON, a generated site — arriving at the analysers as source,
  // and leaves the scan's file budget being spent listing it.
  describe('a documentation directory', () => {
    it('is skipped whole when documentation is excluded', () => {
      const p = policy({ includeDocs: false })
      expect(p.directory('docs', 'docs').skip).toBe(true)
      expect(p.directory('documentation', 'documentation').skip).toBe(true)
      // Including the things in it that are not Markdown.
      expect(p.directory('docs', 'packages/web/docs').skip).toBe(true)
    })

    it('is read when the user asks for documentation', () => {
      const p = policy({ includeDocs: true })
      expect(p.directory('docs', 'docs').skip).toBe(false)
    })

    // The skip has to be attributable, like every other one: a reader comparing
    // the exclusions against their own tree must find the rule that removed it.
    it('says why, and under the label a reader can group on', () => {
      const v = policy({ includeDocs: false }).directory('docs', 'docs')
      expect(v.kind).toBe('docs')
      expect(v.reason).toMatch(/documentation/i)
      expect(policy({ includeDocs: false }).describe().defaults)
        .toContain('docs, documentation (when documentation is excluded)')
      expect(policy({ includeDocs: true }).describe().defaults)
        .not.toContain('docs, documentation (when documentation is excluded)')
    })

    // `doc` is a real source directory in some projects. This module errs
    // towards reading too much rather than too little.
    it('does not guess at directories that only look like documentation', () => {
      const p = policy({ includeDocs: false })
      expect(p.directory('doc', 'doc').skip).toBe(false)
      expect(p.directory('document', 'src/document').skip).toBe(false)
      expect(p.directory('docsearch', 'src/docsearch').skip).toBe(false)
    })
  })
})
