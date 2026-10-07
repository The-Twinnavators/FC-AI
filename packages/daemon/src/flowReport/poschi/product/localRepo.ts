// daemon/src/integrations/poschi/product/localRepo.ts
//
// Reading the product from a checkout on disk.
//
// ── Why this exists alongside the GitHub reader ──────────────────────────────
//
// The GitHub path spent a long session blocked on a token scoped to the wrong
// resource owner, while the codebase sat in a folder on the same machine the
// whole time. One is not a replacement for the other — a local folder has no
// commit and no branch, so it cannot say WHICH version of the product it read —
// but a snapshot you can actually read beats a repository you cannot.
//
// ── What a local read cannot tell you ────────────────────────────────────────
//
// Provenance. A clone reports a commit; a folder reports a path and a newest
// file date, and neither says whether it is current. So this records what it
// can — the root, the file count, the newest modification — and the report is
// required to print that instead of a commit rather than printing nothing and
// letting a reader assume.
//
// Read only. Nothing here writes to the checkout, and nothing is allowed to:
// the standing instruction on this product is that its codebase is not ours to
// change.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import type { SourceFile } from '../instrumentation/audit.js'

/** Directories that hold no product source. */
const SKIP_DIR = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'coverage', '.next', '.turbo',
  '.vercel', '.cache', 'vendor',
])

// The entry HTML, robots.txt and sitemap.xml are read too. Leaving them out
// made the SEO pass report every head tag absent — including a title that is
// plainly there — which is the false-absence this codebase spends most of its
// care avoiding, produced by a file filter rather than by a bad inference.
const KEEP = /\.(ts|tsx|js|jsx|mjs|cjs|sql|json|html?|xml)$/i
const ALWAYS = /(^|\/)(robots\.txt|sitemap\.xml)$/i
const LOCK = /(package-lock|yarn\.lock|pnpm-lock)/i

/**
 * How much of one file is read. Beyond this a file is a bundle or a fixture
 * dump, and scanning it costs more than it can tell us.
 *
 * ── Why 600KB and not 400KB ─────────────────────────────────────────────────
 *
 * At 400KB the ceiling was excluding `src/pages/admin/AdminLaunchChecklist.tsx`
 * — 488KB of hand-written admin screen, not a bundle. Every report discussed
 * that area while blind to its largest component, and the only trace was the
 * scan count reading 1856 of 1857. A number that says "one file excluded" does
 * not tell anyone it was half a megabyte of the product.
 *
 * The cost was measured rather than assumed. The extra file is 3% more bytes,
 * and a full run took 1.74s before and 1.66s after — inside the run-to-run
 * spread either way, so the cost is not measurable at this size.
 *
 * What it bought was not a bigger number but different answers: the
 * accessibility count went from 13 of 222 images without alt text to 19 of
 * 228, the file was added to the list writing HTML directly, and it turned out
 * to hold a credential-shaped string. Four findings had been quietly counting
 * a version of the product with that screen cut out of it.
 */
const MAX_BYTES = 600_000

export interface LocalSource {
  root: string
  files: SourceFile[]
  /** Source files found, which equals `files.length` unless something could not
   *  be read. The two are reported separately so a partial read is visible. */
  total: number
  /** The newest file date in the checkout, as the only version signal a folder
   *  can offer. */
  newest: string | null
}

/**
 * Every source file under a root.
 *
 * Paths are returned relative to the root and with forward slashes, so a
 * finding reads the same whether it came from a folder on Windows or from
 * GitHub — a report that printed backslashes for one and not the other would
 * make the same file look like two.
 */
export function readLocalSource(root: string, opts: { maxFiles?: number } = {}): LocalSource {
  const files: SourceFile[] = []
  let total = 0
  let newest = 0
  const cap = opts.maxFiles ?? 2000

  const walk = (dir: string, depth: number): void => {
    if (depth > 12) return
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const name of entries) {
      if (SKIP_DIR.has(name) || name.startsWith('.')) continue
      const full = join(dir, name)
      let st
      try {
        st = statSync(full)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        walk(full, depth + 1)
        continue
      }
      if ((!KEEP.test(name) && !ALWAYS.test(name)) || LOCK.test(name)) continue

      total += 1
      if (files.length >= cap || st.size > MAX_BYTES) continue
      if (st.mtimeMs > newest) newest = st.mtimeMs

      try {
        files.push({
          path: relative(root, full).split(sep).join('/'),
          text: readFileSync(full, 'utf8'),
        })
      } catch {
        // Unreadable is not empty. Left out of `files` while still counted in
        // `total`, so the gap shows up as an incomplete scan.
      }
    }
  }

  walk(root, 0)
  return { root, files, total, newest: newest ? new Date(newest).toISOString() : null }
}

/** Files whose name suggests they declare routes, strongest first. */
export function routerFiles(files: SourceFile[]): SourceFile[] {
  const score = (p: string): number => {
    const f = p.toLowerCase()
    if (!/\.(t|j)sx?$/.test(f)) return 0
    if (/\.(test|spec|stories|d)\./.test(f)) return 0
    if (/(^|\/)(routes?|router)\.(t|j)sx?$/.test(f)) return 100
    if (/(^|\/)app\.(t|j)sx?$/.test(f)) return 90
    if (/(^|\/)(routes?|router|routing)\//.test(f)) return 80
    if (/(route|router)/.test(f)) return 60
    return 0
  }
  return files
    .map((f) => [f, score(f.path)] as const)
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([f]) => f)
}
