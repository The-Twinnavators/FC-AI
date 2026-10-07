// packages/daemon/src/flowReport/scanner/pathPolicy.ts
//
// "Is this path inside one of these roots?" — FlowAgent's sandbox path policy,
// brought across for FlowReport's boundary, which is its only user here.
//
// It gets right the two things a hand-rolled check gets wrong: it resolves
// symlinks with realpath before comparing, and it appends a separator before
// the prefix test, so a sibling directory called `repo-evil` cannot pass as
// being inside `repo`. It also refuses credential locations outright, so a
// repository chosen at a high level cannot become a way to read a private key
// or the daemon's own token.

import { realpathSync, existsSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { defaultDataDir } from '../../util/paths.js'

export interface PathCheckResult {
  ok: boolean
  reason?: string
  resolvedPath?: string
}

const DENY_SEGMENTS = [
  /[\\/]\.ssh([\\/]|$)/i,
  /[\\/]\.aws([\\/]|$)/i,
  /[\\/]\.flowagent[\\/]daemon\.json$/i,
  /^\/etc([\\/]|$)/i,
  /^\/sys([\\/]|$)/i,
  /^\/proc([\\/]|$)/i,
]

/** FlowCode's own secrets, by exact path: the daemon handshake (which holds the
 *  API token) in the data directory. The data directory itself is not denied —
 *  FlowCode's managed workspaces live inside it and are legitimate to report on. */
const DENY_FILES = new Set<string>()

/** Refuse one more file by exact path. The daemon adds its own data directory's
 *  handshake at startup; the default location is refused from the start. */
export function denyFile(p: string): void {
  DENY_FILES.add(resolve(p).toLowerCase())
}
denyFile(join(defaultDataDir(), 'daemon.json'))

function realResolve(p: string): string {
  const abs = resolve(p)
  if (existsSync(abs)) return realpathSync(abs)
  return abs
}

function withTrailingSep(p: string): string {
  return p.endsWith(sep) ? p : p + sep
}

export function isPathAllowed(candidate: string, allowedRoots: string[]): PathCheckResult {
  let resolved: string
  try {
    resolved = realResolve(candidate)
  } catch (err: any) {
    return { ok: false, reason: `cannot resolve path: ${err?.message ?? err}` }
  }

  if (DENY_FILES.has(resolved.toLowerCase())) {
    return { ok: false, reason: "path is one of FlowCode's own credential files", resolvedPath: resolved }
  }
  for (const pat of DENY_SEGMENTS) {
    if (pat.test(resolved)) {
      return { ok: false, reason: `path matches denylist (${pat.source})`, resolvedPath: resolved }
    }
  }

  const resolvedWithSep = withTrailingSep(resolved)
  for (const root of allowedRoots) {
    const rootWithSep = withTrailingSep(realResolve(root))
    if (resolvedWithSep.startsWith(rootWithSep)) {
      return { ok: true, resolvedPath: resolved }
    }
  }

  return { ok: false, reason: 'resolved path is not within allowed roots', resolvedPath: resolved }
}
