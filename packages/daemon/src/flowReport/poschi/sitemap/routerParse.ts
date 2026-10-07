// daemon/src/integrations/poschi/sitemap/routerParse.ts
//
// Reading a React Router tree out of source.
//
// ── Why parse source at all ──────────────────────────────────────────────────
//
// Two things the error pipeline needs are sitting in the router and nowhere
// else, and both of them are currently guesses.
//
// The SITEMAP. The error map can only draw screens it has been told about, and
// POSCHI exports none, so today it draws the routes that failed and says that
// is all it can show. A map with only the broken parts on it reads as though
// the rest of the product does not exist. The router knows every screen.
//
// The ROLE. The whole triage ranks by reach — an anonymous route above a
// signed-in one above an admin-only one — and the feed carries no role at all.
// Today that is inferred from the path, which can only recognise what a prefix
// makes unambiguous: `/admin/…` is internal, `cron:` is scheduled, and
// everything else is `unknown` and sorts to the middle. Four of six live rows
// are `unknown`. The router knows which routes sit behind a guard.
//
// ── What this is not ─────────────────────────────────────────────────────────
//
// It is not a TypeScript parser, and it does not pretend the difference does
// not matter. It reads JSX tags and brace-balanced attributes, which covers a
// conventional `<Route path element>` tree and nothing more. Routes built from
// a config array, generated in a loop, or spread from a variable are invisible
// to it.
//
// So it counts what it could not read and reports that alongside what it could.
// A sitemap that quietly omitted half the product would be worse than no
// sitemap: the missing screens would render as "no errors reported here",
// which is the exact false negative this pipeline exists to prevent.

/** One `<Route>` that resolves to a screen. */
export interface ParsedRoute {
  /** The full path pattern, with ancestors joined in. */
  route: string
  /** The component in `element={<X />}`, or null when it was not in a shape
   *  this could read. */
  element: string | null
  /** Components wrapping it: parent route elements (layouts) and any enclosing
   *  non-Route element. The role is inferred from these. */
  guards: string[]
  /**
   * Roles a guard NAMED, from its props, nearest ancestor last.
   *
   * The component name is a convention; this is a declaration. A tree like
   *
   *   <Route path="/provider" element={<ProtectedRoute allowedRoles={['provider']}>…}>
   *
   * says who may enter in the prop, and reading only the name of the guard
   * throws that away — every area of the product wrapped in one `ProtectedRoute`
   * collapses to a single "signed in" role no matter what each one allows.
   * Measured against a real router: five separately-gated areas came back as one.
   */
  roleHints: string[]
  /** An `index` route, which serves its parent's path. */
  index: boolean
}

export interface ParseResult {
  routes: ParsedRoute[]
  /** `<Route>` tags seen in the source, including pathless wrappers. The gap
   *  between this and `routes.length` is layouts and guards, which is expected;
   *  the number is reported so a reader can see the shape of what was read. */
  routeTags: number
  /** Route tags carrying neither a path nor `index` nor an element — the ones
   *  this could make nothing of. Reported rather than swallowed. */
  unreadable: number
}

/** The router's own plumbing. These wrap every screen, so treating them as
 *  guards would put "Routes" on the guard chain of the entire product and
 *  teach the role inference nothing. */
const CONTAINERS = /^(Routes|Router|BrowserRouter|HashRouter|MemoryRouter|StaticRouter|Switch|Suspense|Fragment|React\.Fragment|ErrorBoundary|Outlet)$/

interface Tag {
  name: string
  attrs: string
  selfClosing: boolean
  closing: boolean
}

/**
 * JSX tags, in order.
 *
 * Hand-rolled because `element={<AdminLayout />}` puts a `>` inside an
 * attribute, so the obvious regex closes the tag in the wrong place and every
 * route after it is misattributed. Brace depth and quote state are tracked for
 * that reason alone.
 */
function scanTags(src: string): Tag[] {
  const out: Tag[] = []
  let i = 0

  while (i < src.length) {
    const lt = src.indexOf('<', i)
    if (lt === -1) break

    const after = src[lt + 1]
    if (after === undefined || !/[A-Za-z/]/.test(after)) { i = lt + 1; continue }

    const closing = after === '/'
    let j = lt + (closing ? 2 : 1)

    const nameStart = j
    while (j < src.length && /[A-Za-z0-9_.]/.test(src[j]!)) j += 1
    const name = src.slice(nameStart, j)
    if (!name) { i = lt + 1; continue }

    // Attributes, to the `>` that is not inside braces or a string.
    let depth = 0
    let quote: string | null = null
    const attrStart = j
    while (j < src.length) {
      const c = src[j]!
      if (quote) {
        if (c === quote) quote = null
      } else if (c === '"' || c === "'" || c === '`') {
        quote = c
      } else if (c === '{') {
        depth += 1
      } else if (c === '}') {
        depth -= 1
      } else if (c === '>' && depth <= 0) {
        break
      }
      j += 1
    }
    if (j >= src.length) break

    const raw = src.slice(attrStart, j)
    const selfClosing = raw.trimEnd().endsWith('/')
    out.push({
      name,
      attrs: selfClosing ? raw.trimEnd().slice(0, -1) : raw,
      selfClosing,
      closing,
    })
    i = j + 1
  }

  return out
}

/** A string attribute, single or double quoted. Expressions are not read: a
 *  path built from a variable is not a path this can resolve, and inventing one
 *  would put a route in the sitemap that the product does not serve. */
function stringAttr(attrs: string, name: string): string | null {
  const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`).exec(attrs)
  return m ? (m[2] ?? m[3] ?? null) : null
}

/** The component in `element={<X ... />}` or `Component={X}`. */
function elementComponent(attrs: string): string | null {
  const jsx = /\belement\s*=\s*\{\s*<\s*([A-Za-z][\w.]*)/.exec(attrs)
  if (jsx) return jsx[1]!
  const bare = /\b(?:Component|component)\s*=\s*\{\s*([A-Za-z][\w.]*)\s*\}/.exec(attrs)
  return bare ? bare[1]! : null
}

/** Whether the tag carries a bare `index` prop. */
function hasIndex(attrs: string): boolean {
  return /\bindex\b(?!\s*=\s*\{?\s*false)/.test(attrs)
}

/**
 * Role-naming props, and deliberately not `role` on its own.
 *
 * `role="button"` is an ARIA attribute and appears on ordinary markup. Because
 * an `element={…}` value holds a whole nested JSX expression, its attribute text
 * can contain that markup, and accepting a bare `role` turned a div inside a
 * guard into a role called "button".
 */
const ROLE_PROPS = /\b(?:allowedRoles|allowRoles|requiredRoles|requiredRole|requireRole|roles)\s*=\s*(\{[^}]*\}|"[^"]*"|'[^']*')/g

/** Quoted identifiers inside a role prop's value. An expression that names no
 *  literal — `allowedRoles={ROLES.staff}` — yields nothing, which is correct:
 *  this cannot resolve it and must not guess. */
function roleHintsFrom(attrs: string): string[] {
  const out: string[] = []
  for (const prop of attrs.matchAll(ROLE_PROPS)) {
    for (const lit of prop[1]!.matchAll(/['"`]([A-Za-z_][\w-]{0,39})['"`]/g)) {
      out.push(lit[1]!)
    }
  }
  return out
}

/**
 * Join a child path onto its parents.
 *
 * A leading slash means absolute, as React Router treats it. Everything else is
 * relative, and the empty string is a layout contributing nothing.
 */
export function joinPath(parent: string, child: string | null): string {
  if (child === null || child === '') return parent || '/'
  if (child.startsWith('/')) return child.replace(/\/{2,}/g, '/').replace(/(.)\/$/, '$1')
  const joined = `${parent === '/' ? '' : parent}/${child}`
  return joined.replace(/\/{2,}/g, '/').replace(/(.)\/$/, '$1')
}

/**
 * Every screen the router serves, with what wraps it.
 *
 * Nesting is tracked with a stack rather than by matching pairs, because a JSX
 * tree that fails to balance — a fragment this does not understand, a comment
 * containing a tag — should degrade into fewer routes rather than into wrong
 * ones.
 */
export function parseRouterSource(src: string): ParseResult {
  const tags = scanTags(src)
  const routes: ParsedRoute[] = []

  interface Frame {
    tag: string
    path: string
    /** What wraps this route. Its OWN element is deliberately not here: a
     *  screen called StylistProfile is not evidence that the screen is behind a
     *  stylist guard, and reading it as one ranked a public profile page as
     *  provider-only. Children inherit `guards`; the route itself is emitted
     *  with `inherited`. */
    inherited: string[]
    guards: string[]
    /** Roles named by this route's own guard props and every ancestor's.
     *  Unlike `guards`, a route's OWN hint applies to itself: `allowedRoles` on
     *  the element that renders a screen is a statement about that screen. */
    roleHints: string[]
    element: string | null
    index: boolean
    hasPath: boolean
    /** Set when a Route opens inside this one. A route with children is a
     *  layout: React Router renders it around an Outlet, so it is the frame of
     *  a screen rather than a screen. Emitting it would put every layout in the
     *  sitemap as a page nobody can navigate to. */
    hasRouteChild: boolean
  }

  const stack: Frame[] = []
  let routeTags = 0
  let unreadable = 0

  const top = () => stack[stack.length - 1]
  const nearestRoute = () => {
    for (let k = stack.length - 1; k >= 0; k -= 1) if (stack[k]!.tag === 'Route') return stack[k]
    return undefined
  }

  /** Emit a Route frame if it turned out to be a leaf. */
  const close = (f: Frame) => {
    if (f.tag !== 'Route' || f.hasRouteChild) return
    if (f.element && (f.hasPath || f.index)) {
      routes.push({
        route: f.path,
        element: f.element,
        guards: f.inherited,
        roleHints: f.roleHints,
        index: f.index,
      })
    }
  }

  for (const tag of tags) {
    if (tag.closing) {
      // Unwind to the matching frame. A stray close pops nothing rather than
      // emptying the stack and reparenting everything after it.
      for (let k = stack.length - 1; k >= 0; k -= 1) {
        if (stack[k]!.tag === tag.name) {
          for (let m = stack.length - 1; m >= k; m -= 1) close(stack[m]!)
          stack.length = k
          break
        }
      }
      continue
    }

    const parentPath = top()?.path ?? ''
    const parentGuards = top()?.guards ?? []
    const parentHints = top()?.roleHints ?? []
    const ownHints = roleHintsFrom(tag.attrs)

    if (tag.name !== 'Route') {
      // A non-Route wrapper can be the guard: <RequireAuth><Route …/></RequireAuth>.
      // The router's own containers are not — counting <Routes> as a guard would
      // put it on every screen in the product.
      if (!tag.selfClosing) {
        stack.push({
          tag: tag.name,
          path: parentPath,
          inherited: parentGuards,
          guards: CONTAINERS.test(tag.name) ? parentGuards : [...parentGuards, tag.name],
          roleHints: [...parentHints, ...ownHints],
          element: null,
          index: false,
          hasPath: false,
          hasRouteChild: false,
        })
      }
      continue
    }

    routeTags += 1
    const enclosing = nearestRoute()
    if (enclosing) enclosing.hasRouteChild = true

    const path = stringAttr(tag.attrs, 'path')
    const element = elementComponent(tag.attrs)
    const index = hasIndex(tag.attrs)
    const full = joinPath(parentPath, path)

    if (!element && path === null && !index) unreadable += 1

    const frame: Frame = {
      tag: 'Route',
      path: full,
      inherited: parentGuards,
      // A parent route's element wraps its children, so it becomes a guard for
      // them. That is how `<Route element={<AdminLayout/>}>` marks everything
      // inside it as internal.
      guards: element ? [...parentGuards, element] : [...parentGuards],
      roleHints: [...parentHints, ...ownHints],
      element,
      index,
      hasPath: path !== null,
      hasRouteChild: false,
    }

    // Self-closing cannot have children, so it is a leaf now.
    if (tag.selfClosing) close(frame)
    else stack.push(frame)
  }

  // Anything still open at the end closes here, so an unterminated tree yields
  // the routes it did contain rather than none.
  for (let k = stack.length - 1; k >= 0; k -= 1) close(stack[k]!)

  return { routes, routeTags, unreadable }
}
