// daemon/src/flow-reports/scanner/scan.ts
//
// The bounded walk over a user-chosen repository.
//
// ── Two promises ─────────────────────────────────────────────────────────────
//
// Nothing outside the root is ever read, and everything NOT read is accounted
// for by name and reason. The first is `boundary.ts`. The second is why this
// returns a `skipped` list rather than silently omitting entries: a report that
// cannot distinguish "read and found clean" from "never opened" is worse than
// no report, because it reads as reassurance.
//
// ── Limits are not a performance tuning knob ─────────────────────────────────
//
// The chosen folder could be a home directory. Without a ceiling this walks for
// an hour and then exhausts memory holding file contents. Every limit therefore
// sets `truncated`, and `truncated` is what stops a partial scan being rendered
// as a complete one.
//
// ── Why contents are held in memory ──────────────────────────────────────────
//
// The analysers take `{ path, text }[]`, which is the shape the existing
// analysis modules already consume. Holding text is what makes that possible,
// and `maxTotalBytes` is what makes it safe. Streaming would be a larger change
// to every analyser for a repository size nobody is pointing this at yet.

import { readFileSync, readdirSync, lstatSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { resolveInside, type RepositoryBoundary } from './boundary.js'
import {
  buildIgnorePolicy, type IgnoreFileSource, type IgnorePolicyOptions, type SkipKind,
} from './ignorePolicy.js'

export interface ScannedFile {
  /** Repository-relative, forward slashes, on every platform. */
  path: string
  text: string
  bytes: number
}

export interface SkippedEntry {
  path: string
  reason: string
  /** What sort of decision this was, so a report can group the exclusions and
   *  say which of them a reader should look at. Absent only where the walk
   *  itself failed and no policy was consulted. */
  kind?: SkipKind
}

export interface ScanProgress {
  filesRead: number
  entriesSeen: number
  /** Repository-relative, for a progress line somebody can read. */
  currentPath: string
}

export interface ScanOptions extends IgnorePolicyOptions {
  maxFiles?: number
  maxTotalBytes?: number
  timeoutMs?: number
  signal?: AbortSignal
  onProgress?: (p: ScanProgress) => void
  /** Emit progress at most this often, so a large scan does not spend its time
   *  in the callback. */
  progressEveryFiles?: number
}

export interface ScanResult {
  files: ScannedFile[]
  skipped: SkippedEntry[]
  /** Human-readable, printed in the report's limitations section. */
  limitsHit: string[]
  entriesSeen: number
  bytesRead: number
  durationMs: number
  /** True when a limit or a cancellation stopped the walk early. Nothing may
   *  present a truncated scan as a complete one. */
  truncated: boolean
  cancelled: boolean
  /** What shaped the exclusions, for the methodology section. */
  policy: ReturnType<ReturnType<typeof buildIgnorePolicy>['describe']>
}

const DEFAULTS = {
  maxFiles: 4_000,
  maxTotalBytes: 40 * 1024 * 1024,
  timeoutMs: 120_000,
  progressEveryFiles: 25,
}

/** The ignore files read from the root, if present. Read through the boundary
 *  like everything else — a `.gitignore` symlinked out is still an escape. */
function readIgnoreFiles(b: RepositoryBoundary): IgnoreFileSource[] {
  const out: IgnoreFileSource[] = []
  for (const name of ['.gitignore', '.flowcodeignore']) {
    const verdict = resolveInside(b, join(b.root, name))
    if (!verdict.ok) continue
    try {
      out.push({ source: name, text: readFileSync(verdict.path, 'utf8') })
    } catch {
      // Unreadable is not empty, but an unreadable ignore file is not worth
      // failing a scan over. It shows up as one fewer source in `policy`.
    }
  }
  return out
}

const toRel = (root: string, full: string): string =>
  relative(root, full).split(sep).join('/')

/**
 * A byte count in the unit that makes it legible.
 *
 * The first version always printed MB, so a 2,500-byte limit came out as "0 MB
 * total-read limit" — a sentence that tells a reader nothing and looks like a
 * bug in the limit rather than in the wording.
 */
function describeBytes(n: number): string {
  if (n >= 1024 * 1024) return `${Math.round(n / 1024 / 1024)} MB`
  if (n >= 1024) return `${Math.round(n / 1024)} KB`
  return `${n} bytes`
}

export async function scanRepository(
  boundary: RepositoryBoundary,
  o: ScanOptions = {},
): Promise<ScanResult> {
  const startedAt = Date.now()
  const maxFiles = o.maxFiles ?? DEFAULTS.maxFiles
  const maxTotalBytes = o.maxTotalBytes ?? DEFAULTS.maxTotalBytes
  const timeoutMs = o.timeoutMs ?? DEFAULTS.timeoutMs
  const every = o.progressEveryFiles ?? DEFAULTS.progressEveryFiles

  const policy = buildIgnorePolicy({ ...o, ignoreFiles: readIgnoreFiles(boundary) })

  const files: ScannedFile[] = []
  const skipped: SkippedEntry[] = []
  const limitsHit: string[] = []
  let entriesSeen = 0
  let bytesRead = 0
  let cancelled = false
  let stop = false

  const noteLimit = (msg: string): void => {
    if (!limitsHit.includes(msg)) limitsHit.push(msg)
    stop = true
  }

  const checkCeilings = (): void => {
    if (o.signal?.aborted) { cancelled = true; stop = true; return }
    if (files.length >= maxFiles) {
      noteLimit(`Stopped at the ${maxFiles}-file limit; the repository has more.`)
    }
    if (bytesRead >= maxTotalBytes) {
      noteLimit(`Stopped at the ${describeBytes(maxTotalBytes)} total-read limit.`)
    }
    if (Date.now() - startedAt >= timeoutMs) {
      noteLimit(`Stopped at the ${Math.round(timeoutMs / 1000)}s time limit.`)
    }
  }

  // Counted from the last emission rather than tested with a modulus. The
  // modulus version never fired on a scan smaller than the interval — a
  // twelve-file repository reported no progress at all, which is exactly the
  // case where a user is most likely to think nothing is happening.
  let lastEmittedAt = -1
  const emit = (currentPath: string, force = false): void => {
    if (!o.onProgress) return
    if (!force && lastEmittedAt >= 0 && files.length - lastEmittedAt < every) return
    lastEmittedAt = files.length
    o.onProgress({ filesRead: files.length, entriesSeen, currentPath })
  }

  const walk = (dir: string): void => {
    if (stop) return
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch (err: any) {
      skipped.push({
        path: toRel(boundary.root, dir) || '.',
        reason: `could not be listed: ${err?.code ?? err?.message ?? 'unknown error'}`,
      })
      return
    }

    for (const name of entries) {
      checkCeilings()
      if (stop) return

      entriesSeen += 1
      const full = join(dir, name)
      const rel = toRel(boundary.root, full)

      // lstat, not stat: stat follows the link and would report a symlinked
      // directory as an ordinary one, so the boundary check below would never
      // see that it points elsewhere.
      let link
      try {
        link = lstatSync(full)
      } catch (err: any) {
        skipped.push({ path: rel, reason: `could not be read: ${err?.code ?? 'unknown error'}` })
        continue
      }

      // Every entry goes through the boundary, including directories, so an
      // escape is refused before anything inside it is listed.
      const inside = resolveInside(boundary, full)
      if (!inside.ok) {
        skipped.push({ path: rel, reason: inside.reason, kind: 'directory' })
        continue
      }

      let isDir: boolean
      try {
        isDir = statSync(inside.path).isDirectory()
      } catch (err: any) {
        skipped.push({ path: rel, reason: `could not be read: ${err?.code ?? 'unknown error'}` })
        continue
      }

      if (isDir) {
        const verdict = policy.directory(name, rel)
        if (verdict.skip) {
          // Once, for the directory — not once per file inside it. A skipped
          // node_modules would otherwise contribute ninety thousand lines to
          // the exclusions list and bury everything else.
          skipped.push({ path: rel, reason: verdict.reason ?? 'excluded', kind: verdict.kind })
          continue
        }
        walk(inside.path)
        if (stop) return
        continue
      }

      if (!link.isFile()) {
        skipped.push({ path: rel, reason: 'not a regular file.', kind: 'binary' })
        continue
      }

      const verdict = policy.file(name, rel, link.size)
      if (verdict.skip) {
        skipped.push({ path: rel, reason: verdict.reason ?? 'excluded', kind: verdict.kind })
        continue
      }

      try {
        const text = readFileSync(inside.path, 'utf8')
        // Build output is recognisable by its shape and not by its name, so
        // this one verdict needs the bytes. Read, judged, and dropped without
        // reaching an analyser — and counted against the read budget either
        // way, because opening it is what cost the time.
        const shape = policy.content(rel, text)
        bytesRead += link.size
        if (shape.skip) {
          skipped.push({ path: rel, reason: shape.reason ?? 'excluded', kind: shape.kind })
          continue
        }
        files.push({ path: rel, text, bytes: link.size })
        emit(rel)
      } catch (err: any) {
        skipped.push({ path: rel, reason: `could not be read: ${err?.code ?? 'unknown error'}` })
      }
    }
  }

  walk(boundary.root)
  // Checked once more after the walk so a limit reached on the final entry is
  // still recorded rather than lost.
  checkCeilings()
  // One final emission, forced: without it the last partial batch is never
  // reported and a progress display finishes on a stale count.
  emit('', true)

  if (cancelled && !limitsHit.some((l) => /cancel/i.test(l))) {
    limitsHit.push('The run was cancelled before the scan finished.')
  }

  return {
    files,
    skipped,
    limitsHit,
    entriesSeen,
    bytesRead,
    durationMs: Date.now() - startedAt,
    truncated: limitsHit.length > 0 || cancelled,
    cancelled,
    policy: policy.describe(),
  }
}
