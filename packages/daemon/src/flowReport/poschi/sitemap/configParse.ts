// daemon/src/integrations/poschi/sitemap/configParse.ts
//
// Routes declared as data rather than as JSX.
//
// ── Why this exists ──────────────────────────────────────────────────────────
//
// The JSX parser next door reads `<Route path element>` trees and says so when
// it cannot. Pointed at POSCHI it read zero routes and refused, which was the
// correct behaviour and completely useless: their router is
// `createBrowserRouter([{ path, Component }, …])`, a config array, which the
// JSX reader is honest about not understanding.
//
// The refusal was worth having — it meant nobody got a confident empty sitemap
// — but the answer to "this shape is unreadable" is eventually to read it.
//
// ── Still not a parser ───────────────────────────────────────────────────────
//
// This walks balanced brackets and picks out `path`, `Component`, `element`,
// `index` and `children` at each object's own level. A path built from a
// variable, a spread, or a list produced by a function is invisible — and stays
// invisible, because a route the product may not serve is worse in a sitemap
// than a route missing from one.

import type { ParsedRoute, ParseResult } from './routerParse.js'
import { joinPath } from './routerParse.js'

/** The factories whose first argument is a route array. */
const FACTORY = /\b(createBrowserRouter|createHashRouter|createMemoryRouter|createRoutesFromElements|useRoutes)\s*\(/g

/** A bare `routes` array, for apps that declare it and pass it elsewhere. */
const BARE = /\b(?:const|let|var|export\s+const)\s+\w*[Rr]outes\w*\s*(?::[^=]+)?=\s*\[/g

/**
 * The span of a bracketed region starting at `open`.
 *
 * String and template awareness is not decoration: a path like `"/a]"` or a
 * className containing a brace would otherwise close the region early and the
 * rest of the router would be read as though it were outside the array.
 */
function balanced(src: string, open: number): number {
  const pairs: Record<string, string> = { '[': ']', '{': '}', '(': ')' }
  const closer = pairs[src[open]!]
  if (!closer) return -1

  let depth = 0
  let quote: string | null = null
  for (let i = open; i < src.length; i += 1) {
    const c = src[i]!
    if (quote) {
      if (c === '\\') { i += 1; continue }
      if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue }
    if (c === '[' || c === '{' || c === '(') depth += 1
    else if (c === ']' || c === '}' || c === ')') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

/** Object literals that are direct members of this array. */
function membersOf(src: string, arrayOpen: number): Array<[number, number]> {
  const end = balanced(src, arrayOpen)
  if (end === -1) return []

  const out: Array<[number, number]> = []
  let i = arrayOpen + 1
  let quote: string | null = null

  while (i < end) {
    const c = src[i]!
    if (quote) {
      if (c === '\\') { i += 2; continue }
      if (c === quote) quote = null
      i += 1
      continue
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; i += 1; continue }
    if (c === '{') {
      const close = balanced(src, i)
      if (close === -1) break
      out.push([i, close])
      i = close + 1
      continue
    }
    // Anything else at this level — a spread, a call, a variable — is a member
    // this cannot read. Skipped rather than guessed at.
    if (c === '[' || c === '(') {
      const close = balanced(src, i)
      i = close === -1 ? i + 1 : close + 1
      continue
    }
    i += 1
  }
  return out
}

/**
 * Every key at this object's own top level, with where its value starts.
 *
 * One pass rather than a search per key. The first version searched per key and
 * had to decide, at each character, whether a match belonged to this level — it
 * got that wrong on the outermost object and read POSCHI's entire router as one
 * unreadable entry.
 */
function topLevelKeys(
  src: string,
  open: number,
  close: number,
): Map<string, { text: string; start: number }> {
  const out = new Map<string, { text: string; start: number }>()
  let i = open + 1
  let quote: string | null = null
  let depth = 0

  while (i < close) {
    const c = src[i]!
    if (quote) {
      if (c === '\\') { i += 2; continue }
      if (c === quote) quote = null
      i += 1
      continue
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; i += 1; continue }
    if (c === '{' || c === '[' || c === '(') { depth += 1; i += 1; continue }
    if (c === '}' || c === ']' || c === ')') { depth -= 1; i += 1; continue }

    if (depth === 0 && /[A-Za-z_$]/.test(c)) {
      let j = i
      while (j < close && /[\w$]/.test(src[j]!)) j += 1
      const name = src.slice(i, j)
      let k = j
      while (k < close && /\s/.test(src[k]!)) k += 1

      if (src[k] === ':') {
        let v = k + 1
        let d = 0
        let q: string | null = null
        for (; v < close; v += 1) {
          const ch = src[v]!
          if (q) {
            if (ch === '\\') { v += 1; continue }
            if (ch === q) q = null
            continue
          }
          if (ch === '"' || ch === "'" || ch === '`') { q = ch; continue }
          if (ch === '{' || ch === '[' || ch === '(') d += 1
          else if (ch === '}' || ch === ']' || ch === ')') d -= 1
          else if (ch === ',' && d === 0) break
        }
        out.set(name, { text: src.slice(k + 1, v).trim(), start: k + 1 })
        i = v + 1
        continue
      }
      i = j
      continue
    }
    i += 1
  }
  return out
}

const STRING = /^["'`]([^"'`]*)["'`]$/
const COMPONENT = /^([A-Za-z][\w.]*)$/
const JSX_EL = /^<\s*([A-Za-z][\w.]*)/

/** Walk one array of route objects. */
function walk(
  src: string,
  arrayOpen: number,
  parentPath: string,
  parentGuards: string[],
  out: ParsedRoute[],
  counts: { tags: number; unreadable: number },
  depth = 0,
): void {
  // A router nested twenty levels deep is a loop, not a route tree.
  if (depth > 20) return

  for (const [open, close] of membersOf(src, arrayOpen)) {
    counts.tags += 1
    const keys = topLevelKeys(src, open, close)

    const rawPath = keys.get('path')?.text ?? null
    const pathMatch = rawPath ? STRING.exec(rawPath) : null
    const path = pathMatch ? pathMatch[1]! : null
    if (rawPath && !pathMatch) counts.unreadable += 1

    const rawComponent = keys.get('Component')?.text ?? keys.get('component')?.text ?? null
    const rawElement = keys.get('element')?.text ?? null
    const element = rawComponent && COMPONENT.test(rawComponent)
      ? rawComponent
      : rawElement
        ? (JSX_EL.exec(rawElement)?.[1] ?? null)
        : null

    const index = keys.get('index')?.text === 'true'
    const full = joinPath(parentPath, path)
    const children = keys.get('children')

    if (children) {
      // A route with children frames them rather than being a screen, exactly
      // as in the JSX reader.
      const childArray = src.indexOf('[', children.start)
      if (childArray !== -1 && childArray < close) {
        walk(src, childArray, full, element ? [...parentGuards, element] : parentGuards,
          out, counts, depth + 1)
      }
      continue
    }

    if (element && (path !== null || index)) {
      // Empty rather than absent, and it means "this dialect does not read role
      // props yet" rather than "this route names no roles". A config route can
      // carry `allowedRoles: ['admin']` the same way a JSX guard can; until that
      // is read here, these routes fall through to the guard-name inference,
      // which is where they already were.
      out.push({ route: full, element, guards: [...parentGuards], roleHints: [], index })
    } else if (!element && path === null && !index) {
      counts.unreadable += 1
    }
  }
}

export function parseRouteConfig(src: string): ParseResult {
  const routes: ParsedRoute[] = []
  const counts = { tags: 0, unreadable: 0 }
  const seen = new Set<number>()

  const starts: number[] = []
  for (const re of [FACTORY, BARE]) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(src)) !== null) {
      const from = m.index + m[0].length - 1
      const open = src[from] === '[' ? from : src.indexOf('[', from)
      if (open !== -1 && open - from < 8) starts.push(open)
    }
  }

  for (const open of starts) {
    if (seen.has(open)) continue
    seen.add(open)
    walk(src, open, '', [], routes, counts)
  }

  return { routes, routeTags: counts.tags, unreadable: counts.unreadable }
}
