// daemon/src/integrations/poschi/sitemap/deriveSitemap.ts
//
// Parsed routes, turned into the two things the error pipeline was missing.
//
// ── The role is the one that changes the report ──────────────────────────────
//
// The triage ranks by reach: anonymous above signed-in above internal, because
// an admin error firing a thousand times reaches four people who all work here.
// The feed carries no role, so today reach is guessed from the path — and a
// path can only say what a prefix makes unambiguous. `/admin/…` is internal and
// `cron:` is scheduled; everything else is `unknown` and lands in the middle.
//
// A guard says it outright. `<Route element={<RequireAuth/>}>` around a subtree
// means every screen inside it is behind a login, and a screen NOT inside one
// is reachable by anybody — which is the P0 case and the one the prefix guess
// can never find.
//
// ── Inference is still inference ─────────────────────────────────────────────
//
// A component called `AdminLayout` is being read as "admin" because of its
// name. That is a convention, not a guarantee, and a product that named its
// public layout `AdminLayout` would be ranked backwards. So every derived role
// carries how it was derived, the report says the basis, and nothing here is
// presented as a fact POSCHI supplied.

/** One route of a sitemap, as Poschi's error-report schema defines it. Only
 *  this shape was ever used from that module, so it is restated here rather
 *  than porting the whole ingest schema for one type. */
export interface PoschiSiteRouteInput {
  route: string
  /** What a person calls this screen. Falls back to the route. */
  name: string
  /** The area it belongs to, when the sender groups them. Null groups by the
   *  first path segment instead. */
  section: string | null
}
import type { ParsedRoute } from './routerParse.js'

/** How a role was arrived at, weakest last. Printed, not implied. */
export type RoleBasis =
  /** A guard named the role in a prop: `allowedRoles={['provider']}`. The
   *  strongest signal there is — a declaration rather than a convention. */
  | 'prop'
  /** A guard or layout component wrapping the route said so. */
  | 'guard'
  /** The path prefix said so, which is what was available before. */
  | 'path'
  /** Nothing said so. Not a role, and must not be ranked as though it were. */
  | 'none'

/** A role the guard itself declared, as opposed to one read off a name. Both
 *  are strong enough to overwrite an `unknown` on an inbound event. */
export function isDeclared(basis: RoleBasis): boolean {
  return basis === 'prop' || basis === 'guard'
}

export interface DerivedRole {
  role: string
  basis: RoleBasis
  /** The component or prefix it came from, so a reader can check the call. */
  because: string
}

/**
 * Guard and layout names, mapped to who gets through them.
 *
 * Ordered: the first match wins, so `SuperAdminLayout` is read as super_admin
 * rather than as admin. Checked against the component name only — a guard's
 * props are expressions this does not evaluate.
 */
const GUARD_ROLES: Array<[RegExp, string]> = [
  [/super.?admin|owner/i, 'super_admin'],
  [/admin|staff|internal|back.?office/i, 'admin'],
  [/provider|stylist|vendor|merchant/i, 'provider'],
  [/client|customer|booker/i, 'client'],
  [/require.?auth|protected|private|authenticated|auth.?guard|signed.?in/i, 'signed_in'],
  [/public|guest|anonymous|marketing/i, 'anonymous'],
]

/**
 * Names that wrap a route without gating it, and must never be read as a role.
 *
 * ── The `Provider` collision ─────────────────────────────────────────────────
 *
 * `XxxProvider` is React's context convention, and a React application wraps its
 * whole tree in several: QueryClientProvider, ThemeProvider, AuthProvider. Every
 * one of them matches `/provider/i`, so before this existed the outermost
 * context turned the entire product — public marketing pages included — into
 * "provider only". Measured against a real router: the landing page and the
 * public category pages were all attributed to the provider role, because a
 * `SurveyProvider` sat above them.
 *
 * The suffix is what distinguishes the two. A guard for providers is named
 * `ProviderLayout`, `ProviderRoute`, `RequireProvider`; a context ENDS in
 * Provider. So the suffix is excluded and the prefix still matches.
 *
 * Lowercase names are DOM elements — `html`, `div` — which reach this list when
 * a router file contains ordinary markup. They gate nothing.
 */
function gatesNothing(name: string): boolean {
  return /Provider$/.test(name) || /^[a-z]/.test(name)
}

/** Path prefixes, the weaker signal, kept as the fallback it always was. */
const PATH_ROLES: Array<[RegExp, string]> = [
  [/^\/super.?admin(\/|$)/i, 'super_admin'],
  [/^\/admin(\/|$)/i, 'admin'],
  [/^\/provider(\/|$)/i, 'provider'],
  // This product calls its providers stylists, and the report should use the
  // product's own word rather than the contract's.
  [/^\/stylist(\/|$)/i, 'stylist'],
  [/^\/client(\/|$)/i, 'client'],
]

/**
 * Who can reach this route.
 *
 * Guards first because they are the real answer — a route is behind a login or
 * it is not, and that is a fact about the tree rather than about naming. The
 * path is consulted only when no guard spoke.
 */
export function roleFor(route: ParsedRoute): DerivedRole {
  if (/^cron:/i.test(route.route)) {
    return { role: 'system', basis: 'path', because: 'a cron: route is a scheduled job' }
  }

  // A declared role beats an inferred one. The nearest guard wins, so an area
  // nested inside a broader one is described by its own gate.
  const hints = route.roleHints ?? []
  if (hints.length > 0) {
    const nearest = hints[hints.length - 1]!
    // The product's own word is kept rather than mapped onto a house vocabulary:
    // a router that says `allowedRoles={['stylist']}` has named the role, and
    // rewriting it to "provider" would describe the product in words it does not
    // use. Where a guard allows several, the first is the role and the rest are
    // stated, because the map holds one role per route and dropping the others
    // silently would hide exactly the case worth noticing.
    const also = hints.filter((h) => h !== nearest)
    return {
      role: nearest,
      basis: 'prop',
      because: also.length > 0
        ? `a guard allows ${[...new Set(hints)].join(', ')}`
        : `a guard allows ${nearest}`,
    }
  }

  for (const guard of [...route.guards].reverse()) {
    if (gatesNothing(guard)) continue
    for (const [pattern, role] of GUARD_ROLES) {
      if (pattern.test(guard)) {
        return { role, basis: 'guard', because: `wrapped in ${guard}` }
      }
    }
  }

  for (const [pattern, role] of PATH_ROLES) {
    if (pattern.test(route.route)) {
      return { role, basis: 'path', because: `the path begins ${route.route.split('/')[1]}` }
    }
  }

  // Nothing guards it and nothing in the path says otherwise. On a router whose
  // protected areas ARE guarded, that is a real finding — the screen is open to
  // anybody — but only if the router guards anything at all, which is why the
  // caller decides rather than this function.
  return { role: 'unknown', basis: 'none', because: 'no guard wraps it and the path says nothing' }
}

/** `AdminSystemHealth` -> `Admin system health`. What a person calls the
 *  screen, derived from what the developer called the component. */
export function screenName(component: string | null, route: string): string {
  if (!component) return route
  const words = component
    .replace(/^(Page|Screen|View)|(Page|Screen|View)$/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim()
  if (!words) return route
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase()
}

/** The area of the product, from the first path segment. Null where there is
 *  none, which the schema reads as "group by the first segment" anyway. */
export function sectionFor(route: string): string | null {
  const seg = route.split('/').filter(Boolean)[0]
  if (!seg || seg.startsWith(':')) return null
  return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/[-_]/g, ' ')
}

export interface DerivedMap {
  sitemap: PoschiSiteRouteInput[]
  /** Route pattern -> role, for the events to be re-read against. */
  roles: Record<string, DerivedRole>
  /**
   * Whether this router guards anything at all.
   *
   * The hinge for the whole inference. On a router with guards, a screen
   * outside them is genuinely public and ranks P0. On a router with none — an
   * app that checks permissions inside its components instead — an unguarded
   * screen means only that this could not see the check, and calling it
   * anonymous would promote every internal admin page to the top of the list.
   */
  guardsFound: boolean
  /** Routes whose role could not be established. Counted, because a derivation
   *  that covered a third of the product would otherwise look complete. */
  unresolved: number
}

/**
 * The sitemap and the roles, from the parsed tree.
 *
 * Duplicate patterns collapse: a router can serve the same path from two
 * branches, and the sitemap is a list of screens rather than a list of route
 * declarations.
 */
export function deriveSitemap(routes: ParsedRoute[]): DerivedMap {
  const sitemap = new Map<string, PoschiSiteRouteInput>()
  const roles: Record<string, DerivedRole> = {}
  let unresolved = 0

  const guardsFound = routes.some((r) =>
    (r.roleHints ?? []).length > 0
    || r.guards.some((g) => !gatesNothing(g) && GUARD_ROLES.some(([p]) => p.test(g))))

  for (const r of routes) {
    if (!r.route || r.route === '/' && !r.element) continue

    if (!sitemap.has(r.route)) {
      sitemap.set(r.route, {
        route: r.route,
        name: screenName(r.element, r.route),
        section: sectionFor(r.route),
      })
    }

    const derived = roleFor(r)

    // The distinction that stops this misfiring. Without guards anywhere in the
    // router, "not guarded" carries no information, and the honest answer is
    // the one the pipeline already had: unknown.
    const role = derived.basis === 'none' && guardsFound
      ? {
        role: 'anonymous',
        basis: 'guard' as RoleBasis,
        because: 'no guard wraps it, on a router that guards its other areas',
      }
      : derived

    if (role.basis === 'none') unresolved += 1
    // First declaration wins, matching the sitemap, so the two never disagree.
    if (!roles[r.route]) roles[r.route] = role
  }

  return { sitemap: [...sitemap.values()], roles, guardsFound, unresolved }
}
