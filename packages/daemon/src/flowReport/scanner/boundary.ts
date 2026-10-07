// packages/daemon/src/flowReport/scanner/boundary.ts
//
// The one place that decides whether Flow Reports may read a file.
//
// ── Why this exists separately from the scanner ──────────────────────────────
//
// A Flow Reports project points at a folder the USER chose, which makes
// everything under it untrusted input. The scanner walks; this decides. Keeping
// the decision in one module means there is exactly one function to audit, and
// the walk cannot accidentally grow a second path into the filesystem.
//
// Nothing downstream re-checks. An analyser that receives a file assumes this
// module already approved it, so a hole here is a hole in the whole feature.
//
// ── Built on the sandbox's path policy, not beside it ────────────────────────
//
// `./pathPolicy.ts` (FlowAgent's sandbox policy, brought along) answers "is this path inside one
// of these roots", and already gets the two things a hand-rolled check gets
// wrong: it resolves symlinks with realpath before comparing, and it appends a
// separator before the prefix test, so a sibling directory called `repo-evil`
// cannot pass as being inside `repo`. It also carries a denylist for ~/.ssh,
// ~/.aws and the daemon's own credential file.
//
// That denylist is the reason this wraps rather than replaces: a project folder
// chosen high up must not make "inside the chosen root" a way to read a private
// key. FlowCode adds its own rule on top — the root itself may never be a drive
// root, the home folder or a system folder (`isDangerousRoot`), the same check
// every other FlowCode feature applies to a folder it is pointed at.
//
// ── Existence is required, deliberately ──────────────────────────────────────
//
// `isPathAllowed` resolves a non-existent path without realpath, because the
// sandbox needs to approve files that are about to be created. Flow Reports
// only ever reads, so a target that does not exist is a bug or an attempt, and
// an unresolvable path is refused rather than approved on its textual form.

import { existsSync, realpathSync, statSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { isPathAllowed } from './pathPolicy.js'
import { isDangerousRoot } from '../../workspace/projects.js'

/** A validated repository root. Only this module constructs one, so holding a
 *  `RepositoryBoundary` is itself the evidence that the root was checked. */
export interface RepositoryBoundary {
  /** The canonical root, as the filesystem reports it — symlinks resolved. */
  readonly root: string
  /** What the user chose, kept for display and diagnostics. May differ from
   *  `root` in case, in symlinks, or in trailing separators. */
  readonly chosen: string
}

export type OpenResult =
  | { ok: true; boundary: RepositoryBoundary }
  | { ok: false; reason: string }

export type ResolveResult =
  | { ok: true; path: string }
  | { ok: false; reason: string }

/**
 * Validate a user-chosen folder and canonicalize it.
 *
 * Refuses anything that is not an existing, readable directory given as an
 * absolute path. A relative path is refused rather than resolved against the
 * daemon's working directory, which is not a place the user was thinking about.
 */
export function openRepository(chosen: string): OpenResult {
  if (!chosen || !chosen.trim()) {
    return { ok: false, reason: 'No folder was given.' }
  }
  if (!isAbsolute(chosen)) {
    return {
      ok: false,
      reason: 'The folder must be an absolute path. A relative path would be '
        + "resolved against the daemon's working directory, which is not where you are.",
    }
  }
  if (!existsSync(chosen)) {
    return { ok: false, reason: 'That folder does not exist, or is not visible to FlowCode.' }
  }

  let root: string
  try {
    root = realpathSync(chosen)
  } catch (err: any) {
    return { ok: false, reason: `That folder could not be resolved: ${err?.message ?? err}` }
  }

  let stat
  try {
    stat = statSync(root)
  } catch (err: any) {
    return { ok: false, reason: `That folder could not be read: ${err?.message ?? err}` }
  }
  if (!stat.isDirectory()) {
    return { ok: false, reason: 'That path is not a directory. Choose the folder that contains the project.' }
  }

  // FlowCode's rule for every folder it is pointed at: never a drive root, the
  // home folder or a system folder. A report "of" the whole home folder reads
  // every project, every download and every dotfile at once, and is a report
  // about nothing in particular. Checked on both spellings, so a link to one of
  // them is refused as firmly as the folder itself.
  if (isDangerousRoot(chosen) || isDangerousRoot(root)) {
    return {
      ok: false,
      reason: 'That is a drive root, your home folder or a system folder. Choose the folder of the project itself.',
    }
  }

  return { ok: true, boundary: { root, chosen } }
}

/**
 * Approve one path for reading, or refuse it with a reason.
 *
 * The returned path is canonical, so a caller that reads exactly what came back
 * cannot be redirected by a symlink swapped in between the check and the read
 * any more than the filesystem already allows.
 */
export function resolveInside(boundary: RepositoryBoundary, candidate: string): ResolveResult {
  if (!candidate || !candidate.trim()) {
    return { ok: false, reason: 'No path was given.' }
  }

  // Refused before the containment test rather than after: a path that does not
  // exist cannot be canonicalized, and approving it on its spelling alone is
  // how a check that looks right stops being one.
  if (!existsSync(candidate)) {
    return { ok: false, reason: 'That path does not exist inside the repository.' }
  }

  const verdict = isPathAllowed(candidate, [boundary.root])
  if (!verdict.ok) {
    return {
      ok: false,
      reason: verdict.reason ?? 'That path resolves outside the repository.',
    }
  }

  return { ok: true, path: verdict.resolvedPath ?? candidate }
}
