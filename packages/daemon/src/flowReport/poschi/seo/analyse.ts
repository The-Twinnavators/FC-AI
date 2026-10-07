// daemon/src/integrations/poschi/seo/analyse.ts
//
// What a crawler and a chat app would make of this product.
//
// ── Two audiences, and for this product they are not equally important ───────
//
// SEO assumes somebody searches and lands on a page. That needs public pages,
// and a product whose every route sits behind a login has one page a crawler
// can reach: the login screen. Polishing titles for screens nobody can visit is
// work that cannot pay off, and a report that ranked it highly would be
// optimising for a channel this product does not have.
//
// Link previews are the other half and they are the opposite. Every product
// that grows by people sending each other links depends on them — the card that
// appears when a link is pasted into a message is the first impression, and
// without Open Graph tags it is a bare URL. For an invitation-led product that
// is the growth channel, not a nicety.
//
// So both are checked, and each finding says which audience it serves. Where
// the product has no public surface, the search findings say so rather than
// being reported as opportunities.

export interface SourceFile {
  path: string
  text: string
}

export type Severity = 'high' | 'medium' | 'low' | 'info'
export type Confidence = 'verified' | 'indicated' | 'hypothesis'

/** Who a finding is for. Printed, because the two have different value here. */
export type Audience = 'link previews' | 'search' | 'both'

export interface SeoFinding {
  id: string
  area: string
  audience: Audience
  title: string
  severity: Severity
  confidence: Confidence
  detail: string
  files: string[]
  because: string
  next: string
  isAbsence: boolean
  prompt?: string | null
}

export interface SeoReport {
  findings: SeoFinding[]
  facts: {
    hasRobots: boolean
    hasSitemapXml: boolean
    title: string | null
    description: string | null
    lang: string | null
    canonical: boolean
    openGraph: string[]
    twitter: string[]
    /** Whether anything sets a title per route. */
    perRouteTitles: boolean
    /** Whether anything renders HTML before the browser does. */
    serverRendered: boolean
    images: { total: number; withAlt: number }
    /** Routes a crawler could reach without an account, as far as the router
     *  shows. Null when no router was read. */
    publicRoutes: number | null
  }
}

const OG = /<meta[^>]+property=["']og:([\w:]+)["']/gi
const TW = /<meta[^>]+name=["']twitter:([\w:]+)["']/gi

function attr(html: string, re: RegExp): string | null {
  const m = re.exec(html)
  return m?.[1] ?? null
}

export interface AnalyseSeoOptions {
  /** Every path in the checkout, so robots.txt and sitemap.xml can be found
   *  wherever they are served from. */
  allPaths?: string[]
  /** How many routes serve anonymous visitors, from the router analysis. Null
   *  when no router was read — which is different from zero. */
  publicRoutes?: number | null
}

/**
 * The audit.
 *
 * Reads the entry HTML and the source. It does not fetch the deployed site, so
 * anything injected at the edge — a meta tag added by a CDN, a prerender service
 * in front of the app — is invisible here and the findings say so.
 */
export function analyseSeo(files: SourceFile[], opts: AnalyseSeoOptions = {}): SeoReport {
  const paths = opts.allPaths ?? files.map((f) => f.path)
  const entry = files.find((f) => /(^|\/)index\.html$/i.test(f.path))
  const html = entry?.text ?? ''

  const hasRobots = paths.some((p) => /(^|\/)robots\.txt$/i.test(p))
  const hasSitemapXml = paths.some((p) => /(^|\/)sitemap\.xml$/i.test(p))

  const title = attr(html, /<title>([^<]*)<\/title>/i)
  const description = attr(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
  const lang = attr(html, /<html[^>]+lang=["']([^"']*)["']/i)
  const canonical = /<link[^>]+rel=["']canonical["']/i.test(html)

  const openGraph = [...html.matchAll(OG)].map((m) => `og:${m[1]}`)
  const twitter = [...html.matchAll(TW)].map((m) => `twitter:${m[1]}`)

  const source = files.filter((f) => /\.(ts|tsx|js|jsx)$/i.test(f.path))
  const perRouteTitles = source.some(
    (f) => /document\.title\s*=|useDocumentTitle|react-helmet|<Helmet|useTitle\(/.test(f.text),
  )
  const serverRendered = source.some(
    (f) => /react-dom\/server|renderToString|renderToPipeableStream/.test(f.text),
  ) || paths.some((p) => /vite-plugin-ssr|prerender/i.test(p))

  let total = 0
  let withAlt = 0
  for (const f of source) {
    for (const m of f.text.matchAll(/<img\b[^>]*>/gi)) {
      total += 1
      if (/\balt\s*=/.test(m[0])) withAlt += 1
    }
  }

  const publicRoutes = opts.publicRoutes ?? null
  // The hinge. With no public route there is nothing for a crawler to index,
  // and search findings become context rather than opportunities.
  const indexable = publicRoutes === null || publicRoutes > 0

  const findings: SeoFinding[] = []

  // ── Link previews, the half that matters for an invited link ──────────────
  if (openGraph.length === 0) {
    findings.push({
      id: 'no-open-graph',
      area: 'Link previews',
      audience: 'link previews',
      title: 'No Open Graph tags, so a shared link renders as a bare URL',
      severity: 'high',
      confidence: 'verified',
      detail: 'Nothing in the entry HTML sets og:title, og:description or og:image. Every link to '
        + 'this product pasted into a message, a chat app or a social post shows the raw address '
        + 'and nothing else.',
      files: entry ? [entry.path] : [],
      because: 'Read from the entry HTML. A tag injected at the edge by a CDN or a prerender '
        + 'service would not appear here — worth confirming against the deployed page before '
        + 'building anything.',
      next: 'Add the four that matter — og:title, og:description, og:image, og:url — to the entry '
        + 'HTML. Static ones are a large improvement over none, and they take minutes.',
      isAbsence: true,
      prompt: [
        'Add Open Graph and Twitter card tags to this application.',
        '',
        'Nothing currently sets them, so every link to this product pasted into a message renders as',
        'a bare URL. Confirm that is still true of the deployed page before changing anything — a',
        'CDN or prerender service could be adding them.',
        '',
        '1. Add to the entry HTML: og:title, og:description, og:image, og:url, og:type, and the',
        '   twitter:card / twitter:title / twitter:description equivalents.',
        '2. Add an image at the size these expect (1200x630) under the public assets.',
        '3. Do not invent copy. Use the existing <title> and meta description as the source, and say',
        '   in your summary if they read poorly as a preview — that is a decision for whoever owns',
        '   the wording.',
        '',
        'Acceptance: pasting the deployed URL into a link-preview debugger shows a title, a',
        'description and an image; no tag is empty; the image loads over https.',
      ].join('\n'),
    })
  } else {
    const missing = ['og:title', 'og:description', 'og:image', 'og:url']
      .filter((t) => !openGraph.includes(t))
    findings.push({
      id: 'open-graph',
      area: 'Link previews',
      audience: 'link previews',
      title: missing.length
        ? `Open Graph tags present, missing ${missing.join(', ')}`
        : `Open Graph tags present (${openGraph.length})`,
      severity: missing.length ? 'medium' : 'info',
      confidence: 'verified',
      detail: `Found: ${openGraph.join(', ')}.`
        + (twitter.length ? ` Twitter card: ${twitter.join(', ')}.` : ' No Twitter card tags.'),
      files: entry ? [entry.path] : [],
      because: 'Read from the entry HTML.',
      next: missing.length
        ? `Add ${missing.join(', ')}. A preview missing its image is a preview most apps will not show.`
        : 'Worth checking one real link in a preview debugger — a tag can be present and empty.',
      isAbsence: false,
      prompt: null,
    })
  }

  // A single entry HTML means every link previews identically, whatever it
  // points at. That is a different problem from having no tags at all.
  if (!serverRendered && openGraph.length > 0) {
    findings.push({
      id: 'static-previews',
      area: 'Link previews',
      audience: 'link previews',
      title: 'Every link previews the same, because the tags are static',
      severity: 'medium',
      confidence: 'verified',
      detail: 'The tags live in one entry HTML and nothing renders per route on the server, so a '
        + 'link to a specific screen shows the same card as a link to the home page. Crawlers and '
        + 'chat apps read the HTML before any JavaScript runs.',
      files: entry ? [entry.path] : [],
      because: 'Read from the source: no server rendering and no prerender step.',
      next: 'Only worth solving for the links people actually share. Prerendering every route is a '
        + 'large change; giving the shared ones their own tags is usually a small one.',
      isAbsence: false,
      prompt: null,
    })
  }

  // ── Search ────────────────────────────────────────────────────────────────
  if (!indexable) {
    findings.push({
      id: 'nothing-to-index',
      area: 'Search',
      audience: 'search',
      title: 'There is nothing for a search engine to index',
      severity: 'info',
      confidence: 'indicated',
      detail: 'No route serves anonymous visitors, so a crawler reaches the login screen and stops. '
        + 'Search-engine work on this product would be optimising a page nobody searches for.',
      files: [],
      because: 'The router shows no public route. Whether the marketing site lives elsewhere is not '
        + 'something this repository can say — and if it does, it is the thing to audit instead.',
      next: 'Decide whether public content is wanted before spending anything on search. If it is, '
        + 'that is the same question as the discovery surface in the product report.',
      isAbsence: false,
      prompt: null,
    })
  }

  if (!hasRobots) {
    findings.push({
      id: 'no-robots',
      area: 'Search',
      audience: 'search',
      title: 'No robots.txt',
      severity: indexable ? 'medium' : 'low',
      confidence: 'verified',
      detail: 'Crawlers get no instruction at all. For a product that is almost entirely private, '
        + 'the useful version of this file is the one that says so.',
      files: [],
      because: 'No robots.txt appears among the checkout’s files. One served by the host rather '
        + 'than the repository would not appear here.',
      next: 'A three-line file. Disallow the authenticated areas explicitly rather than relying on '
        + 'them being unreachable — a crawler that finds a link into them will try.',
      isAbsence: true,
      prompt: [
        'Add a robots.txt to this application.',
        '',
        'There is none. Most of this product is behind a login, so the useful file is the one that',
        'says which paths are private rather than one that invites crawling.',
        '',
        '1. Serve it from the public assets directory so it lands at the site root.',
        '2. Disallow the authenticated areas by path prefix explicitly.',
        '3. Reference a sitemap only if one exists.',
        '',
        'Acceptance: the file is served at /robots.txt in a production build, and names every',
        'authenticated path prefix the router declares.',
      ].join('\n'),
    })
  }

  if (!hasSitemapXml && indexable) {
    findings.push({
      id: 'no-sitemap',
      area: 'Search',
      audience: 'search',
      title: 'No sitemap.xml',
      severity: 'low',
      confidence: 'verified',
      detail: 'Nothing tells a crawler which pages exist. Worth little while there is nothing public '
        + 'to list, and worth having the moment there is.',
      files: [],
      because: 'No sitemap.xml appears among the checkout’s files.',
      next: 'Defer until public pages exist. Generating one now would list a login screen.',
      isAbsence: true,
      prompt: null,
    })
  }

  if (!perRouteTitles) {
    findings.push({
      id: 'one-title',
      area: 'Search',
      audience: 'both',
      title: 'One title and one description for every screen',
      severity: 'medium',
      confidence: 'verified',
      detail: `The entry HTML sets ${title ? `"${title}"` : 'no title'} and nothing changes it per `
        + 'route. That is what a browser tab, a bookmark, a history entry and a shared link all '
        + 'show, whichever screen somebody is on.',
      files: entry ? [entry.path] : [],
      because: 'No document.title assignment, head-management library or server rendering was found '
        + 'in the source.',
      next: 'Cheap and immediately visible: set the document title per route. It improves bookmarks '
        + 'and browser history for signed-in users, which is a benefit that does not depend on '
        + 'search at all.',
      isAbsence: true,
      prompt: [
        'Set the document title per route in this application.',
        '',
        'One static title currently serves every screen, so a browser tab, a bookmark and a history',
        'entry all read the same whichever screen somebody is on.',
        '',
        '1. Add a small hook that sets document.title, and call it from each routed screen.',
        '2. Use a consistent shape — "Screen — Product" — and derive the screen name from what the',
        '   screen is called in the interface, not from the component name.',
        '3. Restore the default title when a screen unmounts, or a stale title outlives its screen.',
        '',
        'Acceptance: navigating between screens changes the tab title; a bookmark of any screen',
        'carries that screen’s name; no title is empty or duplicated across different screens.',
      ].join('\n'),
    })
  }

  // ── Images ────────────────────────────────────────────────────────────────
  if (total > 0 && withAlt < total) {
    const share = Math.round(((total - withAlt) / total) * 100)
    findings.push({
      id: 'img-alt',
      area: 'Accessibility and images',
      audience: 'both',
      title: `${total - withAlt} of ${total} images have no alt text`,
      severity: share > 50 ? 'high' : 'medium',
      confidence: 'verified',
      detail: `${share}% of image tags in the source carry no alt attribute. A screen reader `
        + 'announces the file name or nothing at all, and an image is invisible to anything that '
        + 'cannot see it — including a preview card and a search index.',
      files: [],
      because: 'Counted from the source. A decorative image correctly carries an empty alt, and an '
        + 'empty alt counts as present here — so these are images with no alt attribute at all.',
      next: 'Accessibility first, search second. This is the finding on this list most likely to '
        + 'affect a person rather than a crawler.',
      isAbsence: false,
      prompt: [
        'Add alt text to the images in this application.',
        '',
        `${total - withAlt} of ${total} image tags carry no alt attribute at all.`,
        '',
        '1. For each, decide whether the image carries meaning or is decorative.',
        '2. Meaningful images get alt text describing what they convey in context — not "image of".',
        '3. Decorative images get alt="" explicitly, so a screen reader skips them rather than',
        '   announcing a file name.',
        '4. Where the image is user-supplied, derive the text from the data that accompanies it and',
        '   fall back to something honest rather than to the file name.',
        '',
        'Acceptance: every <img> has an alt attribute; no alt text begins with "image of" or',
        '"picture of"; decorative images have an empty alt rather than a description.',
      ].join('\n'),
    })
  }

  // ── Context, rather than findings ─────────────────────────────────────────
  if (!canonical && indexable) {
    findings.push({
      id: 'no-canonical',
      area: 'Search',
      audience: 'search',
      title: 'No canonical link',
      severity: 'low',
      confidence: 'verified',
      detail: 'Without one, the same content reached by two addresses can be treated as two pages.',
      files: entry ? [entry.path] : [],
      because: 'Read from the entry HTML.',
      next: 'Only matters once pages are indexable. Defer with the sitemap.',
      isAbsence: true,
      prompt: null,
    })
  }

  if (lang) {
    findings.push({
      id: 'lang',
      area: 'Accessibility and images',
      audience: 'both',
      title: `Document language is declared as "${lang}"`,
      severity: 'info',
      confidence: 'verified',
      detail: 'Screen readers use this to choose a voice, and it is the one head element this '
        + 'product already gets right.',
      files: entry ? [entry.path] : [],
      because: 'Read from the entry HTML.',
      next: 'Nothing, unless the product becomes multilingual.',
      isAbsence: false,
      prompt: null,
    })
  }

  const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2, info: 3 }
  findings.sort((a, b) => rank[a.severity] - rank[b.severity])

  return {
    findings,
    facts: {
      hasRobots,
      hasSitemapXml,
      title,
      description,
      lang,
      canonical,
      openGraph,
      twitter,
      perRouteTitles,
      serverRendered,
      images: { total, withAlt },
      publicRoutes,
    },
  }
}
