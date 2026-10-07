// The security boundary for a user-chosen folder.
//
// Every other part of Flow Reports assumes this module is right. A repository
// the user picked is untrusted input: it can contain symlinks pointing at
// ~/.ssh, a directory named like a sibling of the root, or a path that escapes
// through `..`. Nothing downstream re-checks, so a hole here is a hole in the
// whole feature.
//
// These tests are therefore mostly about REFUSAL. The happy path is one test;
// the rest are attempts to get out.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir, platform } from 'node:os'
import { join } from 'node:path'
import { openRepository, resolveInside } from '../../../src/flowReport/scanner/boundary.js'

let tmp: string
let repo: string
let outside: string
/** Set when the OS let us create a symlink. Windows needs Developer Mode or
 *  elevation for file symlinks, so the escape tests announce a skip rather
 *  than passing vacuously — a green run that tested nothing is worse here
 *  than a visible gap. */
let symlinksWork = false

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), 'flow-reports-boundary-'))
  repo = join(tmp, 'repo')
  outside = join(tmp, 'outside')
  mkdirSync(join(repo, 'src'), { recursive: true })
  mkdirSync(outside, { recursive: true })
  writeFileSync(join(repo, 'src', 'index.ts'), 'export const a = 1')
  writeFileSync(join(outside, 'secret.txt'), 'do not read me')

  // A sibling directory whose name STARTS WITH the repo's name. This is the
  // classic prefix trap: a naive startsWith(root) check lets `repo-evil` pass
  // as if it were inside `repo`.
  mkdirSync(join(tmp, 'repo-evil'), { recursive: true })
  writeFileSync(join(tmp, 'repo-evil', 'gotcha.txt'), 'should never be read')

  try {
    // 'junction' works on Windows without elevation for directories.
    symlinkSync(outside, join(repo, 'escape-link'), platform() === 'win32' ? 'junction' : 'dir')
    symlinksWork = true
  } catch {
    symlinksWork = false
  }
})

afterAll(() => { rmSync(tmp, { recursive: true, force: true }) })

describe('opening a repository', () => {
  it('accepts a real directory and reports a canonical root', () => {
    const r = openRepository(repo)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // Canonical, not merely absolute: the rest of the system compares against
    // this string, so it has to be the form the filesystem itself reports.
    expect(r.boundary.root).toMatch(/repo$/)
  })

  it('refuses a folder that does not exist, and says so', () => {
    const r = openRepository(join(tmp, 'nope'))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.reason).toMatch(/does not exist/i)
  })

  it('refuses a file, because a repository is a directory', () => {
    const r = openRepository(join(repo, 'src', 'index.ts'))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.reason).toMatch(/not a (directory|folder)/i)
  })

  it('refuses an empty or relative path rather than guessing a root', () => {
    expect(openRepository('').ok).toBe(false)
    expect(openRepository('./relative').ok).toBe(false)
  })
})

describe('staying inside the boundary', () => {
  const boundaryOf = (p: string) => {
    const r = openRepository(p)
    if (!r.ok) throw new Error(`fixture failed: ${r.reason}`)
    return r.boundary
  }

  it('allows a file genuinely inside', () => {
    const b = boundaryOf(repo)
    const r = resolveInside(b, join(repo, 'src', 'index.ts'))
    expect(r.ok).toBe(true)
  })

  it('allows the root itself', () => {
    const b = boundaryOf(repo)
    expect(resolveInside(b, repo).ok).toBe(true)
  })

  it('refuses a traversal out through ..', () => {
    const b = boundaryOf(repo)
    const r = resolveInside(b, join(repo, '..', 'outside', 'secret.txt'))
    expect(r.ok).toBe(false)
  })

  // The trap a naive prefix check falls into.
  it('refuses a sibling whose name merely starts with the root name', () => {
    const b = boundaryOf(repo)
    const r = resolveInside(b, join(tmp, 'repo-evil', 'gotcha.txt'))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.reason).toMatch(/outside|not within/i)
  })

  it('refuses an absolute path somewhere else entirely', () => {
    const b = boundaryOf(repo)
    expect(resolveInside(b, join(outside, 'secret.txt')).ok).toBe(false)
  })

  it('refuses a symlink that resolves outside the root', () => {
    if (!symlinksWork) {
      // Announced rather than silent: on a machine without symlink permission
      // this protection is genuinely unverified.
      console.warn('[boundary.test] symlink creation unavailable — escape test not run')
      return
    }
    const b = boundaryOf(repo)
    const r = resolveInside(b, join(repo, 'escape-link', 'secret.txt'))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.reason).toMatch(/outside|not within/i)
  })

  it('refuses a path that does not exist, rather than resolving it optimistically', () => {
    const b = boundaryOf(repo)
    const r = resolveInside(b, join(repo, 'src', 'missing.ts'))
    expect(r.ok).toBe(false)
  })
})

describe('the denylist still applies inside a chosen root', () => {
  // Someone can legitimately point Flow Reports at their home directory. That
  // must not become a way to read ~/.ssh just because it is "inside the root".
  it('refuses a .ssh path even when the root contains it', () => {
    const home = mkdtempSync(join(tmpdir(), 'flow-reports-home-'))
    mkdirSync(join(home, '.ssh'), { recursive: true })
    writeFileSync(join(home, '.ssh', 'id_rsa'), 'PRIVATE')
    try {
      const r = openRepository(home)
      expect(r.ok).toBe(true)
      if (!r.ok) return
      expect(resolveInside(r.boundary, join(home, '.ssh', 'id_rsa')).ok).toBe(false)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })
})
