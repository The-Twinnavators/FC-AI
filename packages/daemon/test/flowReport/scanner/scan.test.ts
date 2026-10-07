// The bounded walk.
//
// This is where the boundary and the ignore policy are actually used, so the
// tests here are less about path arithmetic and more about the two promises the
// report depends on: nothing outside the root is ever read, and everything not
// read is accounted for by name and reason.
//
// The limits matter as much as the reads. A repository the user chose could be
// their home directory, and a scanner without a ceiling would sit there for an
// hour and then run the machine out of memory.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir, platform } from 'node:os'
import { join } from 'node:path'
import { openRepository } from '../../../src/flowReport/scanner/boundary.js'
import { scanRepository } from '../../../src/flowReport/scanner/scan.js'

let tmp: string
let repo: string

const boundaryFor = (p: string) => {
  const r = openRepository(p)
  if (!r.ok) throw new Error(`fixture failed: ${r.reason}`)
  return r.boundary
}

const file = (rel: string, text: string) => {
  const full = join(repo, rel)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, text)
}

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'flow-reports-scan-'))
  repo = join(tmp, 'repo')
  mkdirSync(repo, { recursive: true })
})

afterEach(() => { rmSync(tmp, { recursive: true, force: true }) })

describe('what it reads', () => {
  it('reads source files and returns repository-relative forward-slash paths', async () => {
    file('src/index.ts', 'export const a = 1')
    file('src/deep/nested/util.ts', 'export const b = 2')
    const r = await scanRepository(boundaryFor(repo))
    const paths = r.files.map((f) => f.path).sort()
    expect(paths).toEqual(['src/deep/nested/util.ts', 'src/index.ts'])
    // Never a backslash, even on Windows: a finding must read the same
    // wherever the scan ran.
    for (const p of paths) expect(p).not.toContain('\\')
  })

  it('carries the file contents through', async () => {
    file('a.ts', 'hello')
    const r = await scanRepository(boundaryFor(repo))
    expect(r.files[0]?.text).toBe('hello')
  })

  it('never emits an absolute path anywhere in its result', async () => {
    file('src/a.ts', 'x')
    mkdirSync(join(repo, 'node_modules'), { recursive: true })
    writeFileSync(join(repo, 'node_modules', 'dep.js'), 'y')
    const r = await scanRepository(boundaryFor(repo))
    const serialised = JSON.stringify({ files: r.files, skipped: r.skipped })
    expect(serialised).not.toContain(repo)
    expect(serialised).not.toContain(tmp)
  })
})

// ── A repository checked out inside itself ──────────────────────────────────
//
// Agent tooling puts branch checkouts under `.claude/worktrees/<name>/`, so the
// whole project appears again below its own root, once per branch. Read, they
// make every analyser see the same file two or three times: counts inflate, a
// finding can point at a stale branch's copy instead of the working tree, and
// the duplicates spend the file and byte budget, so a large project can be
// reported as truncated because of itself.
describe('a working copy checked out inside the repository', () => {
  it('reads the working tree and not the checkouts of it', async () => {
    file('src/x.ts', 'export const real = 1')
    file('.claude/worktrees/lucid-euler/src/x.ts', 'export const stale = 1')
    file('.claude/worktrees/brave-hopper/src/x.ts', 'export const staler = 1')

    const r = await scanRepository(boundaryFor(repo))
    expect(r.files.map((f) => f.path)).toEqual(['src/x.ts'])
    expect(r.files[0]!.text).toBe('export const real = 1')
  })

  it('accounts for the exclusion instead of dropping it silently', async () => {
    file('src/x.ts', 'x')
    file('.claude/worktrees/lucid-euler/src/x.ts', 'y')

    const r = await scanRepository(boundaryFor(repo))
    const entry = r.skipped.find((s) => s.path === '.claude/worktrees')
    expect(entry, 'the exclusion must appear in the report').toBeTruthy()
    expect(entry!.reason).toMatch(/working copies of this repository/)
  })

  it('records the directory once, not every file beneath it', async () => {
    file('src/x.ts', 'x')
    for (let i = 0; i < 12; i += 1) {
      file(`.claude/worktrees/lucid-euler/src/f${i}.ts`, 'y')
    }
    const r = await scanRepository(boundaryFor(repo))
    expect(r.skipped.filter((s) => s.path.startsWith('.claude/worktrees'))).toHaveLength(1)
  })

  it('keeps the rest of the dot-directory, which somebody wrote on purpose', async () => {
    file('.claude/skills/review/SKILL.md', '# a skill')
    file('.claude/worktrees/lucid-euler/src/x.ts', 'y')
    const r = await scanRepository(boundaryFor(repo))
    expect(r.files.map((f) => f.path)).toEqual(['.claude/skills/review/SKILL.md'])
  })

  it('leaves an ordinary directory of that name alone', async () => {
    file('worktrees/notes.md', '# not a checkout')
    const r = await scanRepository(boundaryFor(repo))
    expect(r.files.map((f) => f.path)).toEqual(['worktrees/notes.md'])
  })
})

describe('what it refuses, and how it accounts for it', () => {
  it('skips default directories without descending into them', async () => {
    file('src/a.ts', 'keep')
    mkdirSync(join(repo, 'node_modules', 'pkg'), { recursive: true })
    writeFileSync(join(repo, 'node_modules', 'pkg', 'index.js'), 'nope')
    const r = await scanRepository(boundaryFor(repo))
    expect(r.files.map((f) => f.path)).toEqual(['src/a.ts'])
    // Reported by name, so a reader can see it was a decision rather than an
    // oversight — and reported ONCE, for the directory, not once per file
    // inside it.
    const nm = r.skipped.filter((s) => s.path === 'node_modules')
    expect(nm).toHaveLength(1)
    expect(nm[0]?.reason).toMatch(/node_modules/)
  })

  it('honours .gitignore at the root', async () => {
    file('.gitignore', 'secret.txt\n')
    file('secret.txt', 'hidden')
    file('open.txt', 'visible')
    const r = await scanRepository(boundaryFor(repo))
    const paths = r.files.map((f) => f.path)
    expect(paths).toContain('open.txt')
    expect(paths).not.toContain('secret.txt')
    expect(r.skipped.some((s) => s.path === 'secret.txt' && /gitignore/.test(s.reason))).toBe(true)
  })

  it('honours .flowcodeignore as well, and names it in the reason', async () => {
    file('.flowcodeignore', 'private/\n')
    file('private/notes.md', 'mine')
    file('public.md', 'yours')
    const r = await scanRepository(boundaryFor(repo))
    const paths = r.files.map((f) => f.path)
    expect(paths).toContain('public.md')
    expect(paths).not.toContain('private/notes.md')
    expect(r.skipped.some((s) => /flowcodeignore/.test(s.reason))).toBe(true)
  })

  // Kept deliberately: whether .env is gitignored is evidence the security
  // section wants, and the file is project configuration rather than noise.
  it('keeps the ignore files themselves, because they are evidence', async () => {
    file('.gitignore', '.env\n')
    file('app.ts', 'x')
    const r = await scanRepository(boundaryFor(repo))
    expect(r.files.map((f) => f.path)).toContain('.gitignore')
  })

  it('never reads an environment file', async () => {
    file('.env', 'SECRET=abc123')
    file('app.ts', 'x')
    const r = await scanRepository(boundaryFor(repo))
    expect(r.files.map((f) => f.path)).toEqual(['app.ts'])
    expect(JSON.stringify(r)).not.toContain('abc123')
  })

  it('does not follow a symlink that leaves the root', async () => {
    const outside = join(tmp, 'outside')
    mkdirSync(outside, { recursive: true })
    writeFileSync(join(outside, 'secret.txt'), 'ESCAPED')
    file('src/a.ts', 'x')
    try {
      symlinkSync(outside, join(repo, 'link'), platform() === 'win32' ? 'junction' : 'dir')
    } catch {
      console.warn('[scan.test] symlink creation unavailable — escape test not run')
      return
    }
    const r = await scanRepository(boundaryFor(repo))
    expect(JSON.stringify(r)).not.toContain('ESCAPED')
    expect(r.skipped.some((s) => /outside|not within|boundary/i.test(s.reason))).toBe(true)
  })
})

describe('limits', () => {
  it('stops at the file ceiling and says the scan was truncated', async () => {
    for (let i = 0; i < 20; i++) file(`src/f${i}.ts`, 'x')
    const r = await scanRepository(boundaryFor(repo), { maxFiles: 5 })
    expect(r.files.length).toBeLessThanOrEqual(5)
    expect(r.truncated).toBe(true)
    expect(r.limitsHit.join(' ')).toMatch(/file/i)
  })

  it('stops at the total-bytes ceiling', async () => {
    for (let i = 0; i < 10; i++) file(`src/f${i}.ts`, 'y'.repeat(1000))
    const r = await scanRepository(boundaryFor(repo), { maxTotalBytes: 2500 })
    expect(r.truncated).toBe(true)
    expect(r.limitsHit.join(' ')).toMatch(/total-read limit/i)
  })

  // The limit is stated in whatever unit makes it legible. An earlier version
  // always said MB, so a 2,500-byte limit read as "0 MB" — a sentence that
  // looks like a broken limit rather than a wording problem.
  it('states the limit in a unit a reader can act on', async () => {
    for (let i = 0; i < 10; i++) file(`src/f${i}.ts`, 'y'.repeat(1000))
    const small = await scanRepository(boundaryFor(repo), { maxTotalBytes: 2500 })
    expect(small.limitsHit.join(' ')).toMatch(/2 KB/)
    expect(small.limitsHit.join(' ')).not.toMatch(/0 MB/)
  })

  it('stops at the time ceiling rather than running forever', async () => {
    for (let i = 0; i < 400; i++) file(`src/f${i}.ts`, 'z'.repeat(200))
    const r = await scanRepository(boundaryFor(repo), { timeoutMs: 0 })
    expect(r.truncated).toBe(true)
    expect(r.limitsHit.join(' ')).toMatch(/time/i)
  })

  // A truncated scan that reported a clean bill of health would be the worst
  // outcome this module can produce, so the flag is not optional.
  it('marks truncation even when everything it did read was fine', async () => {
    for (let i = 0; i < 10; i++) file(`src/f${i}.ts`, 'fine')
    const r = await scanRepository(boundaryFor(repo), { maxFiles: 2 })
    expect(r.truncated).toBe(true)
  })

  it('is not truncated when everything fitted', async () => {
    file('src/a.ts', 'x')
    const r = await scanRepository(boundaryFor(repo))
    expect(r.truncated).toBe(false)
    expect(r.limitsHit).toEqual([])
  })
})

describe('progress', () => {
  it('reports progress as it goes, so a run can show real work', async () => {
    for (let i = 0; i < 12; i++) file(`src/f${i}.ts`, 'x')
    const seen: number[] = []
    await scanRepository(boundaryFor(repo), {
      onProgress: (p) => { seen.push(p.filesRead) },
    })
    expect(seen.length).toBeGreaterThan(0)
    // Monotonic: a progress bar that goes backwards is worse than none.
    for (let i = 1; i < seen.length; i++) expect(seen[i]!).toBeGreaterThanOrEqual(seen[i - 1]!)
  })
})

describe('cancellation', () => {
  it('stops promptly when the caller aborts, and says so', async () => {
    for (let i = 0; i < 200; i++) file(`src/f${i}.ts`, 'x')
    const controller = new AbortController()
    const p = scanRepository(boundaryFor(repo), {
      signal: controller.signal,
      onProgress: () => controller.abort(),
    })
    const r = await p
    expect(r.cancelled).toBe(true)
    // Cancelled is not the same as complete, and must never read as it.
    expect(r.truncated).toBe(true)
  })
})
