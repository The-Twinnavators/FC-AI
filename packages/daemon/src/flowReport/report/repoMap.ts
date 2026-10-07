// daemon/src/flow-reports/report/repoMap.ts
//
// A map of the repository, and where the findings landed on it.
//
// ── What this is for ─────────────────────────────────────────────────────────
//
// A developer handed a report asks one question before any other: where in the
// codebase is this? A list of findings answers it one file at a time. This
// answers it at a glance — the areas the project is made of, how they feed each
// other, and which of them the problems are concentrated in.
//
// ── It is inferred, and says so ──────────────────────────────────────────────
//
// Nothing here is declared by the project. The lanes come from directory names
// matched against conventions, which are conventions and not rules: a folder
// called `functions` is usually server code and is sometimes a maths library.
// So the diagram is labelled as an inference, and the figure it is drawn beside
// is the file count, which is a fact.
//
// ── The counts must agree with the report ────────────────────────────────────
//
// A finding is attributed to an area by its evidence paths, and a finding whose
// evidence spans two areas counts once in each — so the areas can sum to more
// than the total. That is stated in the caption rather than fixed by dropping
// evidence, because the alternative is a diagram that says a finding is in one
// place when the report says it is in three.

import type { Finding, Severity } from '../types.js'
import {
  TEAL_ON_LIGHT, INK, INK_SECONDARY, INK_TERTIARY, WASH, BORDER_LIGHT,
  SEVERITY_COLOUR, BODY_STACK,
} from '../brand.js'

export type Lane = 'entry' | 'interface' | 'logic' | 'data' | 'support'

export interface RepoArea {
  /** The directory, as it appears in the repository. */
  name: string
  lane: Lane
  files: number
  findings: number
  /** The most severe finding attributed here, for colour. */
  worst: Severity | null
}

export interface RepoMap {
  areas: RepoArea[]
  totalFiles: number
  /** Files that look like the way in — a page shell, a server entry, a manifest. */
  entryPoints: string[]
  /** True when a finding's evidence spanned more than one area, so the caption
   *  can say the counts overlap rather than letting a reader add them up. */
  overlapping: boolean
}

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 5, high: 4, medium: 3, low: 2, info: 1,
}

/**
 * Which lane a directory belongs to.
 *
 * Ordered most specific first. `supabase/functions` is server code even though
 * `supabase` alone is data, so the full path prefix is tested rather than the
 * first segment alone.
 */
const LANE_RULES: Array<{ match: RegExp; lane: Lane }> = [
  { match: /^(supabase\/functions|functions|api|server|backend|daemon|services|edge|workers|lambda|routes|handlers)\b/i, lane: 'logic' },
  { match: /^(supabase|migrations|db|database|prisma|schema|sql|models|entities|seeds)\b/i, lane: 'data' },
  { match: /^(src|app|components|pages|views|ui|screens|client|frontend|web|styles|public|assets)\b/i, lane: 'interface' },
  { match: /^(tests?|__tests__|spec|e2e|cypress|playwright|fixtures)\b/i, lane: 'support' },
  { match: /^(docs?|documentation|examples?)\b/i, lane: 'support' },
  { match: /^(\.github|ci|infra|deploy|docker|k8s|terraform|scripts|tools|config)\b/i, lane: 'support' },
  { match: /^(lib|shared|packages|utils|core|domain|hooks|store|state)\b/i, lane: 'logic' },
]

/** Short enough to sit inside a lane at this width. "Logic and services" was
 *  the first wording and it ran into its neighbours on both sides. */
const LANE_LABEL: Record<Lane, string> = {
  entry: 'Entry',
  interface: 'Interface',
  logic: 'Logic',
  data: 'Data',
  support: 'Supporting',
}

const ENTRY_NAMES = [
  'index.html', 'package.json', 'main.tsx', 'main.ts', 'main.jsx', 'main.js',
  'index.tsx', 'index.ts', 'server.ts', 'server.js', 'app.tsx', 'App.tsx',
  'next.config.js', 'vite.config.ts', 'Dockerfile', 'go.mod', 'manage.py',
]

/**
 * Group a file into the area it belongs to.
 *
 * Two segments deep when the first is a container that says nothing on its own
 * — `src` alone would put an entire project in one box and make the diagram a
 * single rectangle.
 */
function areaOf(path: string): string {
  const parts = path.split('/')
  if (parts.length === 1) return '(root)'
  const first = parts[0]!
  const CONTAINER = /^(src|app|packages|apps|supabase|lib|modules)$/i
  if (CONTAINER.test(first) && parts.length > 2) return `${first}/${parts[1]}`
  return first
}

function laneOf(area: string): Lane {
  if (area === '(root)') return 'entry'
  for (const r of LANE_RULES) if (r.match.test(area)) return r.lane
  // An unrecognised top-level folder is not forced into a lane it may not
  // belong to. "Supporting" is the honest default: it says "part of the
  // project" without claiming to know what it does.
  return 'support'
}

export function buildRepoMap(
  files: Array<{ path: string }>,
  findings: Finding[],
): RepoMap {
  const byArea = new Map<string, RepoArea>()

  const touch = (name: string): RepoArea => {
    let a = byArea.get(name)
    if (!a) {
      a = { name, lane: laneOf(name), files: 0, findings: 0, worst: null }
      byArea.set(name, a)
    }
    return a
  }

  for (const f of files) touch(areaOf(f.path)).files += 1

  let overlapping = false
  for (const finding of findings) {
    const areas = new Set(
      finding.evidence.map((e) => e.path).filter(Boolean).map((p) => areaOf(p!)))
    if (areas.size > 1) overlapping = true
    for (const name of areas) {
      // Only areas the scan actually saw. A path cited by an analyser that the
      // scan skipped would otherwise invent a box for a folder with no files.
      const area = byArea.get(name)
      if (!area) continue
      area.findings += 1
      if (!area.worst || SEVERITY_RANK[finding.severity] > SEVERITY_RANK[area.worst]) {
        area.worst = finding.severity
      }
    }
  }

  const entryPoints = files
    .map((f) => f.path)
    .filter((p) => !p.includes('/') || p.split('/').length === 2)
    .filter((p) => ENTRY_NAMES.includes(p.split('/').pop()!))
    .sort()
    .slice(0, 6)

  return {
    areas: [...byArea.values()].sort((a, b) => b.files - a.files),
    totalFiles: files.length,
    entryPoints,
    overlapping,
  }
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const LANE_ORDER: Lane[] = ['entry', 'interface', 'logic', 'data', 'support']

/**
 * The map, as a left-to-right flow.
 *
 * Hand-drawn rather than taken from a charting library: this is a diagram of
 * relationships, and every layout engine that could place it would place it
 * somewhere different each run. Fixed lanes mean the same repository produces
 * the same picture twice, which is what makes the bytes of the export stable.
 *
 * Each box carries its file count — a fact — and is tinted by the worst
 * severity found in it. An area with no findings stays grey, so the eye goes to
 * where the work is.
 */
export function renderFlowDiagram(map: RepoMap, widthMm = 255): string {
  // ── What gets cut, and what is said about it ──
  //
  // A lane holds at most seven boxes. The first version took the seven largest
  // by file count, which dropped `src` — four findings — off the bottom of the
  // interface lane while keeping six folders with none. A diagram whose purpose
  // is "where are the problems" must not hide a box because its folder is
  // small, and must not hide anything silently.
  const PER_LANE = 6
  const lanes = LANE_ORDER
    .map((lane) => {
      const all = map.areas
        .filter((a) => a.lane === lane)
        .sort((a, b) =>
          (b.findings > 0 ? 1 : 0) - (a.findings > 0 ? 1 : 0)
          || b.findings - a.findings
          || b.files - a.files)
      const shown = all.slice(0, PER_LANE)
      const hidden = all.slice(PER_LANE)
      return { lane, areas: shown, hidden }
    })
    .filter((l) => l.areas.length > 0)

  if (lanes.length === 0) {
    return '<div class="fig-empty">No files were read, so there is no structure to draw.</div>'
  }

  // ── The viewBox is in millimetres ──
  //
  // The first version used a 0–100 box scaled to the page, which meant every
  // font size was in hundredths of the diagram's width — "3.5" was nine
  // millimetres of type inside a seventeen-millimetre box, and every label ran
  // out of its rectangle and over its neighbour. One unit is one millimetre
  // here, so a size written as 3.2 is 3.2mm on the page and can be checked
  // against the box it sits in.
  const W = widthMm
  const COL = W / lanes.length
  const BOX_W = COL - 5
  const BOX_H = 11.5
  const GAP = 2.8
  const TOP = 11
  const rowsMax = Math.max(...lanes.map((l) => l.areas.length + (l.hidden.length > 0 ? 1 : 0)))
  const height = TOP + rowsMax * (BOX_H + GAP) + 2

  /** Truncate to what fits. Manrope at 3.2mm averages about 1.7mm a character,
   *  and a name clipped by the box edge looks like a rendering fault where an
   *  ellipsis looks like a decision. */
  const fit = (s: string, mm: number, size: number): string => {
    const max = Math.floor(mm / (size * 0.54))
    return s.length > max ? `${s.slice(0, Math.max(1, max - 1))}…` : s
  }

  const parts: string[] = []

  lanes.forEach((l, li) => {
    const x = li * COL + 2.5
    parts.push(`<text x="${x.toFixed(2)}" y="5" font-size="3" font-weight="600"`
      + ` fill="${TEAL_ON_LIGHT}" letter-spacing="0.5">`
      + `${esc(LANE_LABEL[l.lane].toUpperCase())}</text>`)
    parts.push(`<line x1="${x.toFixed(2)}" y1="7.4" x2="${(x + BOX_W).toFixed(2)}" y2="7.4"`
      + ` stroke="${BORDER_LIGHT}" stroke-width="0.4"/>`)

    // One arrow per gap, at the vertical middle of the tallest lane.
    if (li < lanes.length - 1) {
      const midY = TOP + (rowsMax * (BOX_H + GAP)) / 2 - GAP / 2
      const from = x + BOX_W + 0.8
      const to = (li + 1) * COL + 2.5 - 1.4
      parts.push(`<path d="M${from.toFixed(2)} ${midY.toFixed(2)} H${to.toFixed(2)}"`
        + ` stroke="${INK_TERTIARY}" stroke-width="0.4"/>`)
      parts.push(`<path d="M${to.toFixed(2)} ${(midY - 1).toFixed(2)} l1.3 1 l-1.3 1z"`
        + ` fill="${INK_TERTIARY}"/>`)
    }

    l.areas.forEach((a, ai) => {
      const y = TOP + ai * (BOX_H + GAP)
      const tint = a.worst ? SEVERITY_COLOUR[a.worst].light : null
      const badge = a.findings > 0

      parts.push(`<rect x="${x.toFixed(2)}" y="${y}" width="${BOX_W.toFixed(2)}"`
        + ` height="${BOX_H}" fill="${tint ? '#fff' : WASH}"`
        + ` stroke="${tint ?? BORDER_LIGHT}" stroke-width="${tint ? 0.5 : 0.3}"/>`)
      if (tint) {
        parts.push(`<rect x="${x.toFixed(2)}" y="${y}" width="1" height="${BOX_H}"`
          + ` fill="${tint}"/>`)
      }

      // The badge is a corner block rather than a label beside the name. Two
      // strings competing for one baseline is what put "FINDINGS" through the
      // middle of every folder name in the first version.
      const badgeW = 9
      if (badge) {
        parts.push(`<rect x="${(x + BOX_W - badgeW).toFixed(2)}" y="${y}" width="${badgeW}"`
          + ` height="6" fill="${tint ?? INK}"/>`)
        parts.push(`<text x="${(x + BOX_W - badgeW / 2).toFixed(2)}" y="${(y + 4.3).toFixed(2)}"`
          + ` text-anchor="middle" font-size="3.4" font-weight="600" fill="#fff">`
          + `${a.findings}</text>`)
      }

      const nameRoom = BOX_W - 4 - (badge ? badgeW + 1 : 0)
      parts.push(`<text x="${(x + 2.6).toFixed(2)}" y="${(y + 5).toFixed(2)}" font-size="3.2"`
        + ` font-weight="600" fill="${INK}">${esc(fit(a.name, nameRoom, 3.2))}</text>`)
      parts.push(`<text x="${(x + 2.6).toFixed(2)}" y="${(y + 9.6).toFixed(2)}" font-size="2.7"`
        + ` fill="${INK_SECONDARY}">${a.files.toLocaleString('en-GB')}`
        + ` file${a.files === 1 ? '' : 's'}</text>`)
      if (badge) {
        parts.push(`<text x="${(x + BOX_W - 2).toFixed(2)}" y="${(y + 9.8).toFixed(2)}"`
          + ` text-anchor="end" font-size="2.3" fill="${INK_TERTIARY}"`
          + ` letter-spacing="0.25">FINDING${a.findings === 1 ? '' : 'S'}</text>`)
      }
    })

    // Whatever did not fit says so, with its file count, rather than vanishing.
    if (l.hidden.length > 0) {
      const y = TOP + l.areas.length * (BOX_H + GAP)
      const files = l.hidden.reduce((n, a) => n + a.files, 0)
      const found = l.hidden.reduce((n, a) => n + a.findings, 0)
      parts.push(`<rect x="${x.toFixed(2)}" y="${y}" width="${BOX_W.toFixed(2)}"`
        + ` height="${BOX_H}" fill="none" stroke="${BORDER_LIGHT}" stroke-width="0.3"`
        + ` stroke-dasharray="1.6 1.4"/>`)
      parts.push(`<text x="${(x + 2.6).toFixed(2)}" y="${(y + 5).toFixed(2)}" font-size="3"`
        + ` font-weight="600" fill="${INK_TERTIARY}">+ ${l.hidden.length} more</text>`)
      parts.push(`<text x="${(x + 2.6).toFixed(2)}" y="${(y + 9.6).toFixed(2)}" font-size="2.7"`
        + ` fill="${INK_TERTIARY}">${files.toLocaleString('en-GB')} files`
        + `${found > 0 ? `, ${found} findings` : ''}</text>`)
    }
  })

  return `<div class="fig"><svg viewBox="0 0 ${W} ${height}" width="${W}mm"
    height="${height.toFixed(1)}mm" role="img"
    style="font-family:${BODY_STACK}">${parts.join('')}</svg></div>`
}

/** The sentence that has to sit under the diagram. */
export function flowDiagramCaption(map: RepoMap): string {
  const parts = [
    'Areas are inferred from directory names against common conventions, not declared by '
    + 'the project — a folder named for one thing occasionally holds another.',
    `File counts are what the scan read: ${map.totalFiles.toLocaleString('en-GB')} in total.`,
  ]
  if (map.overlapping) {
    parts.push('A finding citing files in two areas is counted in both, so the counts on the '
      + 'boxes add up to more than the number of findings.')
  }
  if (map.entryPoints.length > 0) {
    parts.push(`Entry points found: ${map.entryPoints.join(', ')}.`)
  }
  return parts.join(' ')
}
