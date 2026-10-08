// packages/daemon/src/flowReport/report/artifacts.ts
//
// Writing the two files, and recording where they went.
//
// ── Artifacts live under the daemon's own directory ──────────────────────────
//
// `<FlowCode data dir>/flow-reports/<runId>/` — beside the database the
// daemon already owns, never inside the repository being analysed. Writing into somebody's
// source folder would make an analysis tool a thing that modifies what it
// analyses, which is the one promise this feature cannot break.
//
// The stored reference is relative to that directory, so nothing persisted in
// the database is an absolute path and a reference on its own reveals nothing.

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, rmdirSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { defaultDataDir } from '../../util/paths.js'
import type { ReportArtifact, ReportCategory } from '../types.js'

let ARTIFACT_ROOT = join(defaultDataDir(), 'flow-reports')

/**
 * Where the files go. The daemon points this at its own data directory at
 * startup (`createApp`), so a FlowCode started with `FLOWCODE_DATA_DIR` keeps
 * its reports beside its database rather than in the default location.
 */
export function setArtifactRoot(dir: string): void {
  ARTIFACT_ROOT = dir
}

export function artifactRoot(): string {
  return ARTIFACT_ROOT
}

/** A filename safe on every platform, derived from the project name — and, for
 *  a single-domain report, from the domain too. */
function safeName(projectName: string, ext: string, category?: string): string {
  const base = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'report'
  return category
    ? `${base}-${category.replace(/_/g, '-')}.${ext}`
    : `${base}-flowreport.${ext}`
}

/**
 * Resolve a path inside the artifact directory, refusing anything that escapes.
 *
 * The run id comes from `randomUUID`, so this should never fire — which is
 * exactly why it is here rather than assumed. A path check that only runs on
 * untrusted input is one nobody notices has stopped working.
 */
function insideArtifactRoot(runId: string, filename: string): string {
  const target = resolve(join(ARTIFACT_ROOT, runId, filename))
  const root = resolve(ARTIFACT_ROOT) + sep
  if (!target.startsWith(root)) {
    throw new Error('Refusing to write an artifact outside the Repo Report directory.')
  }
  return target
}

export interface WrittenArtifact extends ReportArtifact {
  /** Absolute, for the route that serves the download. Never persisted and
   *  never rendered — the store keeps `storageReference` instead. */
  absolutePath: string
}

export function writeArtifact(
  runId: string,
  projectName: string,
  format: 'markdown' | 'pdf',
  contents: Buffer | string,
  /**
   * The one section this file covers, where it covers one.
   *
   * A whole-repository report is a long document, and somebody fixing the
   * security findings has no use for forty pages about SEO. So each section is
   * also written on its own, and the category travels in both the filename and
   * the stored format — `pdf:security_qa` — so a download can ask for one.
   */
  category?: ReportCategory,
): WrittenArtifact {
  const ext = format === 'markdown' ? 'md' : 'pdf'
  const filename = safeName(projectName, ext, category)
  const absolutePath = insideArtifactRoot(runId, filename)

  mkdirSync(join(ARTIFACT_ROOT, runId), { recursive: true })
  const bytes = typeof contents === 'string' ? Buffer.from(contents, 'utf8') : contents
  writeFileSync(absolutePath, bytes)

  return {
    format: (category ? `${format}:${category}` : format) as ReportArtifact['format'],
    filename,
    // Forward slashes so the reference reads the same whichever platform wrote
    // it, and relative so it is meaningless outside this directory.
    storageReference: `${runId}/${filename}`,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    createdAt: new Date().toISOString(),
    absolutePath,
  }
}

/**
 * Read an artifact back for a download, by the reference the store holds.
 *
 * The reference is re-checked against the boundary rather than trusted,
 * because it arrives from a database row and a route parameter.
 */
export function readArtifact(storageReference: string): Buffer | null {
  const [runId, ...rest] = storageReference.split('/')
  if (!runId || rest.length !== 1) return null
  const target = insideArtifactRoot(runId, rest[0]!)
  if (!existsSync(target)) return null
  return readFileSync(target)
}

/**
 * Delete an artifact whose run has gone, by the same reference and through the
 * same boundary check as reading one. A rendered report that outlives the run
 * it describes is a file nothing points at and nobody will ever look for.
 *
 * Returns whether a file was removed. A reference with no file behind it is not
 * an error: the point is that it is gone afterwards, and it already was.
 */
export function removeArtifact(storageReference: string): boolean {
  const [runId, ...rest] = storageReference.split('/')
  if (!runId || rest.length !== 1) return false
  const target = insideArtifactRoot(runId, rest[0]!)
  if (!existsSync(target)) return false
  rmSync(target, { force: true })
  // The run's own directory goes too, once the last file in it has.
  try { rmdirSync(resolve(join(ARTIFACT_ROOT, runId))) } catch { /* not empty, or gone */ }
  return true
}
