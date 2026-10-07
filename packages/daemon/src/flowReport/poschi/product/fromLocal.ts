// daemon/src/integrations/poschi/product/fromLocal.ts
//
// The whole analysis, from a checkout on disk.
//
// ── One entry point, two route dialects ──────────────────────────────────────
//
// A React app declares its routes as JSX or as a config array, and which one is
// not knowable in advance. Both readers run; whichever finds routes contributes
// them. That is not belt and braces — POSCHI uses the config form, and the JSX
// reader was pointed at their router first and honestly reported nothing, which
// is a correct answer that helps nobody.
//
// ── Provenance is weaker here and says so ────────────────────────────────────
//
// A clone reports a commit. A folder reports a path and a newest file date, and
// cannot say whether it is current. Everything derived from here carries that
// distinction so a report can print what it actually knows about which version
// of the product it read.

import { readLocalSource, routerFiles, type LocalSource } from './localRepo.js'
import { parseRouterSource } from '../sitemap/routerParse.js'
import { parseRouteConfig } from '../sitemap/configParse.js'
import { deriveSitemap, type DerivedMap } from '../sitemap/deriveSitemap.js'
import { auditInstrumentation, type AuditResult } from '../instrumentation/audit.js'
import type { ParsedRoute } from '../sitemap/routerParse.js'

export interface LocalAnalysis {
  root: string
  /** The only version signal a folder can give. Null when nothing was dated. */
  newest: string | null
  analysedAt: string
  filesScanned: number
  filesTotal: number
  /** Which files the routes came from, and how many each gave. */
  routerSources: Array<{ path: string; routes: number; dialect: 'jsx' | 'config' }>
  map: DerivedMap
  audit: AuditResult
}

/**
 * Routes from one file, whichever dialect it is written in.
 *
 * Both readers run and their results are concatenated rather than the first
 * non-empty winning: an app mid-migration can have a JSX tree and a config
 * array in the same file, and taking only one would silently halve the product.
 */
export function parseRoutesAnyDialect(src: string): {
  routes: ParsedRoute[]
  dialect: 'jsx' | 'config' | null
} {
  const jsx = parseRouterSource(src)
  const config = parseRouteConfig(src)
  const routes = [...jsx.routes, ...config.routes]
  if (routes.length === 0) return { routes, dialect: null }
  return {
    routes,
    dialect: config.routes.length > jsx.routes.length ? 'config' : 'jsx',
  }
}

/**
 * Read a checkout and derive everything from it.
 *
 * The audit sees every source file; the routes are read only from files whose
 * names suggest routing. That asymmetry is deliberate — an event can be emitted
 * from anywhere, and a route declared in a component file that nothing names
 * "routes" is rare enough that guessing at it would cost more in false screens
 * than it gains.
 */
export function analyseLocal(
  root: string,
  opts: { now?: Date; source?: LocalSource } = {},
): LocalAnalysis {
  const src = opts.source ?? readLocalSource(root)

  const routes: ParsedRoute[] = []
  const routerSources: LocalAnalysis['routerSources'] = []

  for (const f of routerFiles(src.files)) {
    const { routes: found, dialect } = parseRoutesAnyDialect(f.text)
    if (found.length === 0 || dialect === null) continue
    routes.push(...found)
    routerSources.push({ path: f.path, routes: found.length, dialect })
  }

  return {
    root,
    newest: src.newest,
    analysedAt: (opts.now ?? new Date()).toISOString(),
    filesScanned: src.files.length,
    filesTotal: src.total,
    routerSources,
    map: deriveSitemap(routes),
    audit: auditInstrumentation(src.files, { filesTotal: src.total }),
  }
}
